// @ts-check
/**
 * 魂のローカル Web コクピット・サーバ（S2.5 Domain A）— apps/soul/agent。
 *
 * 「エンジンが自分の顔を持つ」型のローカル操縦席（UX 定義 screens/soul-cockpit.md・Accepted）。
 * 魂プロセスが **127.0.0.1 限定**の小さな HTTP を立て、ユーザーはブラウザで開く。CLI を触らずに
 * マイクを選び・耳を起動し・喋ると転写がタイムラインに積もるのを見る。器（runtime-player）には
 * 一切作らない（憲章「器は魂を知らない」）。
 *
 * ── このモジュールの守備範囲（Domain A）─────────────────────────────────
 *  cockpit の**土台**: HTTP 静的 1 ページ配信 + 制御 API（デバイス列挙 / 耳 start/stop / 状態取得）
 *  + ライブ更新チャネル（転写 append・discard・VAD イベント・死活変化を push）+ 耳パイプラインの
 *  結線 + クリーンシャットダウン。**ページ本体の HTML・設定の永続化実体・起動スクリプト・docs は
 *  Domain B が乗せる**。ここは「B が消費するワイヤ契約」を確定させ、waves/s2.5/domain-a.md に明文化する。
 *
 * ── ライブ更新は SSE（Server-Sent Events）を選ぶ【設計判断】────────────────────
 *  転送は server→client の一方向 push（転写・VAD・死活）だけで足り、制御は HTTP POST が担う。
 *  自作 WS を選ぶと機械テストのクライアントで既知の相性問題（undici WebSocket が自作 WS サーバの
 *  Sec-WebSocket-Accept を "Incorrect hash received" で拒否・S2 記録）を避けるため MinimalWebSocket
 *  注入が要る。SSE（node:http の text/event-stream）はこの問題自体が消え、機械テストは素の
 *  node:http クライアントで読める。ゆえに SSE。
 *
 * ── 正本はプロセス側・UI は使い捨てのビュー ──────────────────────────────
 *  転写バッファ（正本）・死活・耳の状態はサーバが握る。**ブラウザのタブ（SSE 接続）が切れても
 *  魂（pipeline）は生き続ける**（SSE 切断は購読者集合から外すだけ）。開き直せば /api/state と
 *  SSE 接続時の初期 state で現状が復元される。魂を畳むのは close() だけ。
 *
 * ── バインドは 127.0.0.1 限定（外部露出の構造的防止）─────────────────────────
 *  listen は常に loopback。host option は loopback リテラルのみ許容し、非 loopback は throw
 *  （0.0.0.0 等でうっかり公開しない・blocking 基準 3）。認証は v0 なし（UX §4）。
 *
 * ── クリーンシャットダウン（S1/S2 教訓）───────────────────────────────────
 *  close() は冪等: 全 SSE 応答を end → pipeline.dispose() → http server close（closeAllConnections
 *  で生存接続を即断）。デバイス列挙の spawn タイマは unref。リークするタイマ/ハンドル/子プロセスを
 *  残さない（node:test が自然終了する型）。
 *
 * ── 既存コードは変更しない ────────────────────────────────────────────
 *  ear-pipeline / transcript-buffer / whisper-server / ffmpeg-capture は購読・呼び出しのみ。
 *  結線に必要なフックは全て既存 API（onVadEvent/onTranscript/onDiagnostic・transcriptBuffer.onDiscard・
 *  stats()）で足りる。
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createEarPipeline } from "../ears/ear-pipeline.mjs";
import { resolveFfmpegPath } from "../ears/ffmpeg-capture.mjs";
import { normalizeDevice } from "../cli/ears-cli.mjs";
import { listWindows as defaultListWindows } from "../eyes/window-list.mjs";
import { listAudioDevices as defaultListAudioDevices } from "../voice/audio-player.mjs";
import { createBargeInGate } from "../mind/barge-in.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";
import { CONVERSATION_INSTRUCTION_BRAIN_IDS } from "../mind/fire-orchestrator.mjs";
import { resolveBrainIdentity } from "../mind/brains.mjs";
import { resolveModelIdentity } from "../mind/model-identity.mjs";

/** コクピット既定 host（loopback 束縛・外に開かない）。 */
export const DEFAULT_COCKPIT_HOST = "127.0.0.1";
/** コクピット既定ポート（whisper 8178 / AivisSpeech 10101 / editor 5173 系と離す）。 */
export const DEFAULT_COCKPIT_PORT = 8181;
/** 状態スナップショットに載せる直近転写の件数（タブ開き直し時の復元用）。 */
export const DEFAULT_TRANSCRIPT_HISTORY = 200;

/** loopback リテラルのみ許容（非 loopback は外部露出になるため拒否）。 */
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/**
 * このモジュール（src/cockpit/cockpit-server.mjs）が置かれたディレクトリ = 操縦席 UI アセットの既定ルート。
 * 操縦席 UI 改定（コントロールルーム化・preact+htm no-build）で、cockpit.html の inline module が読む
 * `vendor/*.mjs`・`ui/*.mjs`・`view-logic/*.mjs` を配る静的ルートのルートに使う。
 */
const COCKPIT_DIR = path.dirname(fileURLToPath(import.meta.url));
/**
 * 静的配信を許可する UI アセットのサブツリー（この 3 つ配下の `.mjs` のみ配る）。cockpit-server.mjs 本体・
 * テスト・settings-store 等（UI ルート直下の他 `.mjs`）は配らない（配信は UI アセットに限定する）。
 */
const UI_ASSET_SUBDIRS = new Set(["vendor", "ui", "view-logic"]);

/**
 * host が loopback であることを保証する（非 loopback は throw）。
 * @param {string} host
 * @returns {string}
 */
export function assertLoopbackHost(host) {
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `cockpit-server: host must be loopback (127.0.0.1/::1/localhost); got "${host}". ` +
        "コクピットは外部公開しない（UX §4・blocking 基準 3）。"
    );
  }
  return host;
}

/** Domain A 既定の最小プレースホルダ HTML（Domain B が本体に差し替える）。 */
const PLACEHOLDER_HTML = `<!doctype html>
<meta charset="utf-8">
<title>Soul Cockpit</title>
<h1>Soul Cockpit</h1>
<p>Domain A placeholder. The real page is served by Domain B.</p>
<p>State: <code>GET /api/state</code> — Live: <code>GET /api/events</code> (SSE).</p>`;

/**
 * dshow の `-list_devices true` 出力からデバイス名を構造化抽出する純関数。
 *
 * 2 系統の ffmpeg 出力形式に両対応する:
 *  (旧) セクション見出し `DirectShow audio devices` / `DirectShow video devices` の下に `"名前"`。
 *  (新) 各行に `"名前" (audio)` / `"名前" (video)` の種別サフィックス。
 * `Alternative name "@device_..."` 行は直前デバイスの別名として畳む（種別行としては数えない）。
 *
 * @param {string} text  ffmpeg stderr 全文。
 * @returns {{ audio: Array<{ name: string; alternativeName: string | null }>; video: Array<{ name: string; alternativeName: string | null }> }}
 */
export function parseDshowDeviceList(text) {
  /** @type {Array<{ name: string; alternativeName: string | null }>} */
  const audio = [];
  /** @type {Array<{ name: string; alternativeName: string | null }>} */
  const video = [];
  /** @type {"audio" | "video" | null} */
  let section = null;
  /** @type {typeof audio | null} */
  let lastList = null;

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0) continue;

    if (/DirectShow video devices/i.test(line)) {
      section = "video";
      continue;
    }
    if (/DirectShow audio devices/i.test(line)) {
      section = "audio";
      continue;
    }

    // Alternative name 行（引用符を含むが device 名ではない）を先に処理する。
    const alt = line.match(/Alternative name\s+"([^"]+)"/i);
    if (alt) {
      if (lastList && lastList.length > 0) {
        lastList[lastList.length - 1].alternativeName = alt[1];
      }
      continue;
    }

    // device 名行: 引用符で囲まれた名前 + 任意の (audio)/(video) サフィックス。
    const m = line.match(/"([^"]+)"\s*(?:\((audio|video)\))?/i);
    if (m) {
      const name = m[1];
      const explicitKind = m[2] ? m[2].toLowerCase() : null;
      const kind = explicitKind ?? section;
      if (kind === "audio") {
        audio.push({ name, alternativeName: null });
        lastList = audio;
      } else if (kind === "video") {
        video.push({ name, alternativeName: null });
        lastList = video;
      }
      // 種別不明（セクション外・サフィックスなし）は採らない。
    }
  }

  return { audio, video };
}

/**
 * ffmpeg のデバイス列挙を実行して音声デバイス一覧を構造化して返す（録音はしない）。
 * dshow の一覧は stderr に出るので stderr を集めてパースする。spawnImpl 注入でテスト可能。
 *
 * @param {object} [options]
 * @param {string} [options.inputFormat]  既定 win32→"dshow"。
 * @param {string} [options.ffmpegPath]   既定 PATH 解決（env FFMPEG_PATH）。
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {number} [options.timeoutMs=5000]  列挙のハング保険。
 * @param {typeof spawn} [options.spawnImpl]
 * @param {typeof setTimeout} [options.setTimeoutImpl]
 * @param {typeof clearTimeout} [options.clearTimeoutImpl]
 * @returns {Promise<{ devices: Array<{ name: string; alternativeName: string | null }>; inputFormat: string; error: string | null }>}
 */
export function enumerateDevices(options = {}) {
  const inputFormat = options.inputFormat ?? (process.platform === "win32" ? "dshow" : "");
  const ffmpegPath = resolveFfmpegPath(options.ffmpegPath, options.env);
  const spawnImpl = options.spawnImpl ?? spawn;
  const setTimeoutImpl = options.setTimeoutImpl ?? setTimeout;
  const clearTimeoutImpl = options.clearTimeoutImpl ?? clearTimeout;
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve) => {
    let stderrText = "";
    let settled = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;

    const finish = (/** @type {{ devices: any[]; inputFormat: string; error: string | null }} */ result) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeoutImpl(timer);
      resolve(result);
    };

    /** @type {import("node:child_process").ChildProcess} */
    let child;
    try {
      child = spawnImpl(
        ffmpegPath,
        ["-hide_banner", "-f", inputFormat || "dshow", "-list_devices", "true", "-i", "dummy"],
        { stdio: ["ignore", "ignore", "pipe"] }
      );
    } catch (err) {
      finish({ devices: [], inputFormat, error: `ffmpeg spawn failed: ${errMessage(err)}` });
      return;
    }

    timer = setTimeoutImpl(() => {
      try {
        child.kill();
      } catch {
        // best-effort
      }
      finish({ devices: [], inputFormat, error: `device enumeration timed out after ${timeoutMs}ms.` });
    }, timeoutMs);
    if (timer && typeof (/** @type {any} */ (timer).unref) === "function") {
      /** @type {any} */ (timer).unref();
    }

    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk) => {
        stderrText += chunk;
      });
    }
    child.on("error", (err) => {
      finish({ devices: [], inputFormat, error: `ffmpeg spawn failed: ${errMessage(err)}` });
    });
    child.on("exit", () => {
      // -list_devices は dummy 入力で必ず非 0 終了する。一覧は stderr に出ているのでパースする。
      const parsed = parseDshowDeviceList(stderrText);
      finish({ devices: parsed.audio, inputFormat, error: null });
    });
  });
}

/**
 * 「最後に選んだデバイス / Channel URL」の in-memory settings store（既定・no-op 永続）。
 * file-backed 実体は Domain B が供給する（テストがディスクに触れないための分離）。
 * @param {string | null} [initialDevice]
 * @param {string | null} [initialChannelUrl]  S3 追撃 domain-c: Channel URL の初期値（テスト用）。
 * @returns {{
 *   getLastDevice: () => string | null;
 *   setLastDevice: (device: string | null) => void;
 *   getLastChannelUrl: () => string | null;
 *   setLastChannelUrl: (url: string | null) => void;
 * }}
 */
export function createInMemorySettingsStore(initialDevice = null, initialChannelUrl = null) {
  let lastDevice = initialDevice;
  let lastChannelUrl = initialChannelUrl;
  return {
    getLastDevice: () => lastDevice,
    setLastDevice: (device) => {
      lastDevice = device;
    },
    getLastChannelUrl: () => lastChannelUrl,
    setLastChannelUrl: (url) => {
      lastChannelUrl = url;
    }
  };
}

/**
 * コクピット・サーバを作る（listen() で開き・close() で全畳み）。
 *
 * @param {object} [options]
 * @param {number} [options.port=DEFAULT_COCKPIT_PORT]  0 で自動割当（テスト用）。
 * @param {string} [options.host=DEFAULT_COCKPIT_HOST]  loopback リテラルのみ許容。
 * @param {string} [options.indexHtml]      配信する HTML 文字列（最優先）。
 * @param {string} [options.indexHtmlPath]  配信する HTML のファイルパス（B が本体を渡す）。
 * @param {string} [options.uiRootPath]     操縦席 UI アセット（vendor/ui/view-logic の .mjs ツリー）の静的配信
 *   ルート。既定は本モジュールのディレクトリ（= 実 UI ツリー）。トラバーサル防止・許可拡張子 .mjs・
 *   許可サブツリー限定でこの配下だけを配る（既存 22 エンドポイント×13 SSE のワイヤ契約は不変・追加ルートのみ）。
 * @param {string} [options.inputFormat]    ffmpeg 入力フォーマット（既定 win32→dshow）。
 * @param {number} [options.transcriptHistory=DEFAULT_TRANSCRIPT_HISTORY]  状態に載せる直近転写件数。
 * @param {{ getLastDevice: () => any; setLastDevice: (d: any) => any }} [options.settingsStore]
 *   既定は in-memory。get/set は同期でも Promise でもよい（await する）。
 * @param {object} [options.pipelineOptions]  createEarPipeline へ渡す追加設定（whisper/segmenter/asr 等）。
 * @param {typeof createEarPipeline} [options.pipelineFactory]  テスト注入（既定 createEarPipeline）。
 * @param {(opts?: object) => Promise<{ devices: any[]; inputFormat: string; error: string | null }>} [options.enumerateDevicesImpl]
 *   デバイス列挙の差し替え（テスト注入。既定は enumerateDevices）。
 * @param {() => number} [options.nowImpl]  uptime 用時計（既定 Date.now）。
 * @param {(url: string | null) => void | Promise<void>} [options.onSetChannelUrl]
 *   Channel URL 設定フック（S3 追撃 domain-c）。POST /api/channel が受けた URL を渡す。
 *   **cockpit-server は channel の中身を知らない**（責務境界）: URL を lazyChannel / settings に載せ、
 *   session/player の spawn 判断をするのは Domain B（scripts/cockpit.mjs）の役目。ここは POST を
 *   フックに橋渡しし、state に channelStatus() を載せるだけ。未注入なら POST /api/channel は 503。
 * @param {() => (object | null)} [options.channelStatus]
 *   Channel の現況（redact 済み・{ configured, url, connection } 等）を返す。state snapshot に載せる。
 *   **token を平文で含めないこと**（Domain B が redactToken を通した値を返す）。未注入なら channel:null。
 * @param {(title: string | null) => void | Promise<void>} [options.onSetVisionTarget]
 *   視覚発火の対象ウインドウ設定フック（S5「目が開く」・POST /api/channel の写経）。POST /api/vision-target
 *   が受けた title（trim 済み・空はクリア=null）を渡す。**cockpit-server は対象タイトルの永続化実体を
 *   知らない**（責務境界: Channel URL と同型・実体は cockpit.mjs が settings へ橋渡しする）。未注入なら
 *   POST /api/vision-target は 503。
 * @param {() => (object | null)} [options.visionTargetStatus]
 *   視覚発火の対象ウインドウの現況（`{ title: string | null }`）を返す。state snapshot に載せる。
 *   未注入なら visionTarget:null。
 * @param {(opts?: object) => Promise<{ windows: Array<{ pid: number; processName: string; title: string }> } | { error: { kind: string; message: string } }>} [options.listWindowsImpl]
 *   ウインドウ列挙の差し替え（テスト注入。既定は Domain A の `listWindows`・**実 PowerShell を起動する**）。
 *   GET /api/windows が呼ぶ。
 * @param {(opts?: object) => Promise<{ devices: Array<{ id: string; name: string }> } | { error: { kind: string; message: string } }>} [options.listAudioDevicesImpl]
 *   出力オーディオデバイス列挙の差し替え（テスト注入。既定は Domain A の `listAudioDevices`・**実
 *   PowerShell を起動する**）。GET /api/audio-devices が呼ぶ（S6「会話が続く」・魂の声の出力先選択）。
 * @param {(name: string | null) => void | Promise<void>} [options.onSetAudioDevice]
 *   出力デバイス設定フック（S6・POST /api/vision-target の写経）。POST /api/audio-device が受けた
 *   name（trim 済み・空はクリア=null）を渡す。**cockpit-server は永続化・常駐プレイヤーの再起動実体を
 *   知らない**（責務境界: vision target と同型・実体は cockpit.mjs が settings/player へ橋渡しする）。
 *   未注入なら POST /api/audio-device は 503。
 * @param {() => (object | null)} [options.audioDeviceStatus]
 *   出力デバイスの現況（`{ name: string | null }`）を返す。state snapshot に載せる。未注入なら
 *   audioDevice:null。
 * @param {(hooks: {
 *   getBuffer: () => any;
 *   onState: (state: string) => void;
 *   onFire: (info: object) => void;
 *   onDiagnostic: (diag: object) => void;
 *   onSoulTranscript: (entry: object) => void;
 *   onExpression: (info: object) => void;
 *   onVisionCaptured: (info: object) => void;
 *   onUsage: (info: object) => void;
 *   initialKilled: boolean;
 * }) => { fire: (fireOptions?: object) => Promise<object>; getState: () => string; dispose: () => void;
 *   kill?: (atMs?: number) => Promise<object>; revive?: () => void; getKilled?: () => boolean }} [options.fireOrchestratorFactory]
 *   発火オーケストレータのファクトリ（S3 Domain A の追加的結線・未注入時は POST /api/fire・/api/vision-fire
 *   が 503）。cockpit が握る getBuffer（=pipeline?.transcriptBuffer ?? null）と broadcast フックを渡し、
 *   返った orchestrator の fire()/fire({vision:true}) を POST /api/fire・POST /api/vision-fire で await
 *   する。onState/onFire/onDiagnostic/onSoulTranscript/onExpression は SSE（soul/fire/diagnostic/
 *   transcript/expression）へ broadcast される。onExpression は S4「表情が乗る」の演出適用通知
 *   （{word, args?, applied, rejected}・domain-a.md §7）。**S5**: onVisionCaptured/onUsage は SSE
 *   （visionCaptured/usage）へ broadcast される（domain-c.md §）。fireVisionError は既存 onDiagnostic
 *   経由（diagnostic イベントに kind フィールドが乗る）。**S8**: initialKilled はサーバのキル状態正本
 *   （born-killed・下の `killed` 変数）を生成時に渡す。orchestrator が kill/revive/getKilled を持てば
 *   POST /api/kill がそれらを呼ぶ（未対応でも 503 にはならない・fireOrchestrator 自体の有無だけがゲート）。
 *   本番は Domain B が session/speak/channel/player を結線した createFireOrchestrator を返す。
 * @param {boolean} [options.selfFireInitialEnabled=false]
 *   S6「会話が続く」自発発火（呼びかけ/区切り/沈黙）の初期 ON/OFF。既定 OFF。orchestrator 注入時のみ
 *   スケジューラを生成し、onVadEvent/onTranscript を回す。永続トグル（UI/設定）は Domain D が
 *   `setSelfFireEnabled` を継ぎ目に配線する。scheduler は純ロジック（fire-scheduler.mjs・LLM 非依存）。
 *   起動時の初期値は呼び出し側（cockpit.mjs）が settings から読んでここへ渡す（Domain D §）。
 * @param {(enabled: boolean) => void | Promise<void>} [options.onSetSelfFireEnabled]
 *   自発発火トグルの永続化フック（S6・POST /api/self-fire が呼ぶ・vision target と同型）。
 *   **cockpit-server は永続化実体を知らない**（実体は cockpit.mjs が settings へ橋渡しする）。
 *   未注入でも POST /api/self-fire 自体は 503 にならない（scheduler があれば切替は効く。永続化のみ
 *   スキップ）。
 * @param {typeof createFireScheduler} [options.fireSchedulerFactory]
 *   fireScheduler のファクトリ（テスト注入用・既定 createFireScheduler・fireOrchestratorFactory と
 *   同型の差し替えパターン）。本番は指定しない（挙動不変）。テストは fake scheduler を注入し、
 *   onFireRequest コールバックへ直接 kind を渡してタイマー駆動の語彙（interjection 等）の vision
 *   振り分けを即時に検証できる。
 * @param {boolean} [options.bargeInInitialEnabled=true]
 *   「朗読と合いの手」barge-in トグルの初期 ON/OFF（裁定 1「既定 ON」・selfFireInitialEnabled とは
 *   **既定が逆**）。orchestrator が interrupt を持つときのみ機械弁（createBargeInGate）を生成し、
 *   生成時にこの値を渡す（born-disabled: 永続 OFF 値が起動直後から gate へ効く・構築後の setEnabled
 *   後追いはしない＝割り込み窓を作らない）。起動時の初期値は呼び出し側（cockpit.mjs）が settings から
 *   読んでここへ渡す（selfFireInitialEnabled と同型）。
 * @param {(enabled: boolean) => void | Promise<void>} [options.onSetBargeInEnabled]
 *   barge-in トグルの永続化フック（POST /api/barge-in が呼ぶ・onSetSelfFireEnabled と同型）。
 *   **cockpit-server は永続化実体を知らない**（実体は cockpit.mjs が settings へ橋渡しする）。
 *   未注入でも POST /api/barge-in 自体は 503 にならない（gate があれば切替は効く。永続化のみ
 *   スキップ）。
 * @param {string} [options.verbosityInitialMode="normal"]
 *   口数モード（quiet/normal/chatty）の初期値（wave 計画「口数配線」§2 裁定 A）。既定 "normal"。
 *   orchestrator 注入時のみ生成される fireScheduler の createFireScheduler({ verbosity }) へ渡す
 *   （selfFireInitialEnabled と同型・scheduler が無ければ意味を持たない）。起動時の初期値は呼び出し側
 *   （cockpit.mjs）が settings から読んでここへ渡す。
 * @param {(mode: string) => void | Promise<void>} [options.onSetVerbosity]
 *   口数モードの永続化フック（POST /api/verbosity が呼ぶ・onSetSelfFireEnabled と同型）。
 *   **cockpit-server は永続化実体を知らない**（実体は cockpit.mjs が settings へ橋渡しする）。
 *   未注入でも POST /api/verbosity 自体は 503 にならない（scheduler があれば切替は効く。永続化のみ
 *   スキップ）。
 * @param {(choice: string) => void | Promise<void>} [options.onSetBrain]
 *   頭脳切替フック（多頭化 Domain B・POST /api/brain が呼ぶ・onSetVerbosity と同型）。choice は検証済みの
 *   "claude" | "codex"。**cockpit-server は永続化・頭のホットスワップ実体を知らない**（責務境界: 実体は
 *   cockpit.mjs が settings 永続 + 現 session の dispose→null で担う）。未注入なら POST /api/brain は 503
 *   （onSetChannelUrl/onSetAudioDevice と同型の未注入ゲート）。
 * @param {() => (object | null)} [options.brainStatus]
 *   頭脳の現況（`{ brain: string, credentialHealth: boolean }`）を返す。state snapshot に載せる
 *   （audioDevice/channel と同型）。credentialHealth は資格情報ファイルの**存在確認のみ**（中身は読まない）。
 *   brain の状態正本は cockpit.mjs 側にあり、起動時の現況もこの status が運ぶ（サーバは brain 状態を
 *   二重管理せず・別途 initial 値は持たない）。未注入なら snapshot の brain:null。
 * @param {() => (Readonly<import("../mind/model-identity.mjs").ModelIdentity> | null | undefined)} [options.currentBrainIdentity]
 *   現在の registry identity を返す request/handling-time provider。起動スクリプトの currentBrain
 *   closure を正本とし、Whisper/scheduler/public snapshot が同じ provider を読む。brainStatus が
 *   未注入でも snapshot.brain.identity だけは provider から構成し、technical status が provider と
 *   不一致でも identity は provider を権威とする。
 * @param {{
 *   getProfile: (brainId: string) => { body: string; hasOverride: boolean };
 *   save: (brainId: string, instruction: string) => boolean | Promise<boolean>;
 *   reset: (brainId: string) => boolean | Promise<boolean>;
 *   getRevision: () => number;
 * }} [options.conversationInstructionHooks]
 *   Dedicated local API hooks for the effective per-brain conversation-instruction body. The hook owns
 *   durable persistence and increments its revision only after a successful write; the server exposes the
 *   body only through /api/conversation-instructions/:brainId.
 * @param {(opts: { source: string }) => { start: () => Promise<void>; stop: () => void; getState: () => string; getSource: () => string; onMessage: (fn: (msg: any) => void) => () => void; onStatus: (fn: (state: string) => void) => () => void; onDiagnostic: (fn: (info: any) => void) => () => void }} [options.chatClientFactory]
 *   S7「視聴者が混ざる」チャット器官のファクトリ（本番は Domain C の `createLiveChatClient`・テストは
 *   fake 器官 factory を注入して実ネットに出さない）。POST /api/chat/connect で `factory({ source })` を
 *   生成し start()・onMessage→ingestChatMessage / onStatus→broadcastChatStatus /
 *   onDiagnostic→broadcastChatDiagnostic を繋ぐ（ear-pipeline の POST 駆動遅延起動と同じ流儀）。
 *   **cockpit-server は器官の中身（innertube 取得）を知らない**（責務境界: fireOrchestratorFactory と
 *   同型・実体は cockpit.mjs が注入する）。未注入なら POST /api/chat/connect は 503。
 * @param {(source: string | null) => void | Promise<void>} [options.onSetChatSource]
 *   配信 source の永続化フック（S7・onSetChannelUrl の写経）。Connect 時に受けた source（trim 済み）を
 *   渡す。**cockpit-server は永続化実体を知らない**（実体は cockpit.mjs が settings へ橋渡しする）。
 *   未注入でも Connect 自体は成立する（永続化のみスキップ）。
 * @param {() => ({ source: string | null } | null)} [options.chatSourceStatus]
 *   記憶済みの配信 source（`{ source }`）を返す。state snapshot の `chat.source`（入力欄の既定復元用・
 *   Connect 前/切断後も残る）に載せる。未注入なら chat.source:null。
 * @param {(enabled: boolean) => void | Promise<void>} [options.onSetMemoryEnabled]
 *   配信間記憶 ON/OFF の永続化フック（POST /api/memory が呼ぶ・onSetBargeInEnabled と同型）。
 *   **cockpit-server は記憶の実体（注入テキスト・生成・保存）を知らない**（責務境界: 実体は
 *   cockpit.mjs が settings 永続 + memoryText 差し替え + 現 session の dispose→null で担う）。
 *   未注入なら POST /api/memory は 503。
 * @param {() => (Promise<void> | void)} [options.onMemoryRecord]
 *   手動「今日を記録」フック（POST /api/memory-record が呼ぶ）。**cockpit-server は記憶の生成/保存を
 *   知らない**（実体は cockpit.mjs の recordMemory・ライブ転写取得含め呼び出し側の責務）。フックの
 *   throw は 500 にせず握って続行する（記録失敗で操作を止めない・failure-tolerant）。未注入なら
 *   POST /api/memory-record は 503。
 * @param {() => (object | null)} [options.memoryStatus]
 *   記憶の現況（`{ enabled: boolean, count: number, lastRecordAtMs: number | null }`）を返す。
 *   state snapshot の `memory` に載せる（brainStatus/audioDeviceStatus と同型）。未注入なら
 *   snapshot の memory:null。
 * @returns {{
 *   listen: (port?: number) => Promise<string>;
 *   url: () => string;
 *   close: () => Promise<void>;
 *   isListening: () => boolean;
 *   earsStatus: () => string;
 *   fireState: () => string | null;
 *   setSelfFireEnabled: (enabled: boolean) => boolean;
 *   selfFireStatus: () => { enabled: boolean } | null;
 *   bargeInStatus: () => { enabled: boolean } | null;
 *   ingestChatMessage: (msg: { text?: string; displayName?: string } | null) => void;
 *   broadcastChatStatus: (status: string) => void;
 *   broadcastChatDiagnostic: (info: any) => void;
 *   getTranscript: () => Array<any>;
 * }}
 */
export function createCockpitServer(options = {}) {
  const host = assertLoopbackHost(options.host ?? DEFAULT_COCKPIT_HOST);
  const defaultPort = options.port ?? DEFAULT_COCKPIT_PORT;
  const inputFormat = options.inputFormat ?? (process.platform === "win32" ? "dshow" : "");
  const transcriptHistory = options.transcriptHistory ?? DEFAULT_TRANSCRIPT_HISTORY;
  const settings = options.settingsStore ?? createInMemorySettingsStore();
  const pipelineFactory = options.pipelineFactory ?? createEarPipeline;
  const enumerateDevicesImpl = options.enumerateDevicesImpl ?? enumerateDevices;
  const nowImpl = options.nowImpl ?? Date.now;
  const onSetChannelUrl = options.onSetChannelUrl;
  const channelStatusImpl = options.channelStatus;
  const onSetVisionTarget = options.onSetVisionTarget;
  const visionTargetStatusImpl = options.visionTargetStatus;
  const listWindowsImpl = options.listWindowsImpl ?? defaultListWindows;
  const listAudioDevicesImpl = options.listAudioDevicesImpl ?? defaultListAudioDevices;
  const onSetAudioDevice = options.onSetAudioDevice;
  const audioDeviceStatusImpl = options.audioDeviceStatus;
  const onSetSelfFireEnabled = options.onSetSelfFireEnabled;
  // S7「視聴者が混ざる」: チャット器官のファクトリ（cockpit.mjs が本番 createLiveChatClient を注入・
  // テストは fake 器官 factory を注入して実ネットに出さない）。未注入なら POST /api/chat/connect は 503。
  const chatClientFactory = options.chatClientFactory;
  const onSetChatSource = options.onSetChatSource;
  const chatSourceStatusImpl = options.chatSourceStatus;
  // S6「会話が続く」自発発火の初期 ON/OFF（既定 OFF）。Domain D が永続トグル（設定/UI）で制御する
  // までは、テスト or 明示指定でのみ ON にする（既定 OFF ＝ 操縦席にトグルが無い間は自発が暴発しない）。
  const selfFireInitialEnabled = options.selfFireInitialEnabled === true;
  // 「朗読と合いの手」barge-in の初期 ON/OFF（**既定 ON**・裁定 1）。selfFireInitialEnabled とは
  // 意図的に非対称（`!== false` = 明示 false のときだけ OFF・未指定/true は ON）。born-disabled
  // （起動時に永続 OFF 値が gate 構築時の enabled へ届く）はこの値を createBargeInGate({ enabled }) へ
  // そのまま渡すことで担保する（構築後の setEnabled 後追いはしない＝起動直後の割り込み窓を作らない）。
  const bargeInInitialEnabled = options.bargeInInitialEnabled !== false;
  const onSetBargeInEnabled = options.onSetBargeInEnabled;
  // 口数モード（wave 計画「口数配線」§2 裁定 A）: 初期値（既定 "normal"）と永続化フック
  // （未注入なら POST /api/verbosity 自体は 503 にならない・onSetSelfFireEnabled と同型の失敗寛容）。
  const verbosityInitialMode = typeof options.verbosityInitialMode === "string" ? options.verbosityInitialMode : "normal";
  const onSetVerbosity = typeof options.onSetVerbosity === "function" ? options.onSetVerbosity : null;
  // 多頭化 Domain B: 頭脳切替フック（未注入なら POST /api/brain は 503・onSetChannelUrl と同型のゲート）と
  // 現況（snapshot の brain に載せる・未注入なら null）。brain の状態正本は cockpit.mjs の currentBrain で、
  // 起動時の現況も brainStatus() が運ぶ（サーバは brain 状態を二重管理しない＝別途 initial 値は受けない）。
  const onSetBrain = options.onSetBrain;
  const brainStatusImpl = options.brainStatus;
  const currentBrainIdentityImpl =
    typeof options.currentBrainIdentity === "function" ? options.currentBrainIdentity : null;
  const conversationInstructionHooks = options.conversationInstructionHooks ?? null;
  // 配信間記憶: ON/OFF の永続化フック + 手動「今日を記録」フック + 現況(未注入ならそれぞれ 503/null・
  // onSetBrain/brainStatus と同型)。
  const onSetMemoryEnabled = options.onSetMemoryEnabled;
  const onMemoryRecord = options.onMemoryRecord;
  const memoryStatusImpl = options.memoryStatus;
  // 操縦席 UI アセット（vendor/ui/view-logic の .mjs ツリー）の静的配信ルート。既定は本モジュール
  // ディレクトリ（= 実際の UI ツリーの場所）。テストは fixture ルートを差し込める（既定で無指定なら
  // scripts/cockpit.mjs は無改変で動く）。
  const uiRootPath = options.uiRootPath ?? COCKPIT_DIR;

  /** @type {Set<import("node:http").ServerResponse>} */
  const sseClients = new Set();

  /** @type {ReturnType<typeof createEarPipeline> | null} */
  let pipeline = null;
  /** @type {(() => void) | null} */
  let discardUnsub = null;
  /** @type {"stopped" | "starting" | "listening"} */
  let earsState = "stopped";
  /** @type {string | null} */
  let currentDevice = null;
  /** @type {number | null} */
  let startedAtMs = null;
  let transitioning = false;
  let closed = false;
  // S8「キルスイッチ」: キル状態の正本（サーバ側に一つ）。POST /api/kill が設定・snapshot() に露出・
  // fireOrchestrator 生成時（initialKilled）+ 遷移時（kill()/revive()）の両方へ伝播する（domain-b.md §）。
  let killed = false;
  let boundPort = 0;
  // S6「会話が続く」barge-in の機械弁（VAD → 確定 → orchestrator.interrupt）。fireOrchestrator が
  // interrupt を持つときだけ生成する（下の orchestrator 結線で代入・onVadEvent が handle を回す）。
  /** @type {ReturnType<typeof createBargeInGate> | null} */
  let bargeInGate = null;
  // S6「会話が続く」自発発火スケジューラ（VAD/転写 → 自発 3 種判定 → onFireRequest → fire）。
  // fireOrchestrator が fire/getState を持つときだけ生成する（下の orchestrator 結線で代入・
  // onVadEvent と onTranscript が handleVadEvent/handleTranscript を回す）。純ロジックは fire-scheduler
  // 側で fake clock/注入 RNG により全分岐テスト済み（domain-c.md）。
  /** @type {ReturnType<typeof createFireScheduler> | null} */
  let fireScheduler = null;
  // S7「視聴者が混ざる」チャット器官（cockpit-server 所有・POST 駆動遅延起動＝ear-pipeline の流儀）。
  // POST /api/chat/connect で chatClientFactory から生成し start()・onMessage/onStatus/onDiagnostic を
  // 取り込み経路（ingestChatMessage/broadcastChatStatus/broadcastChatDiagnostic）へ繋ぐ。POST
  // /api/chat/disconnect と close() で stop()+破棄（タイマ/プロセスを残さない）。
  /** @type {{ start: () => Promise<void>; stop: () => void; getState: () => string; getSource: () => string } | null} */
  let chatClient = null;
  /** @type {Array<() => void>} チャット器官フックの購読解除（破棄時に全撤去）。 */
  let chatUnsubs = [];

  const health = {
    /** @type {"up" | "down" | "unknown"} */ whisper: "unknown",
    /** @type {string | null} */ whisperReason: null,
    /** @type {"up" | "down" | "unknown"} */ ffmpeg: "unknown",
    /** @type {string | null} */ ffmpegReason: null
  };

  // ── 状態スナップショット ───────────────────────────────────────────

  /** @param {any} entry */
  const toWireEntry = (entry) => ({
    seq: entry.seq,
    startMs: entry.startMs,
    endMs: entry.endMs,
    text: entry.text,
    appendedAtMs: entry.appendedAtMs,
    speaker: entry.speaker ?? "you", // S3 で会話ログへ昇格（you/soul）。既定は you（S2 挙動不変）。
    // S7「視聴者が混ざる」: viewer コメントの投稿者名（Domain C が `viewer(名前):` を描く材料）。
    // you/soul では null（追加フィールド・既存の購読者は無視）。
    displayName: entry.displayName ?? null
  });

  function snapshot() {
    const bufStats = pipeline ? pipeline.transcriptBuffer.stats() : { appended: 0, discarded: 0 };
    const rawBrain = typeof brainStatusImpl === "function" ? brainStatusImpl() ?? null : null;
    // currentBrainIdentity is the single current-identity source for every C
    // consumer. Normalize its frozen contract through the canonical resolver;
    // malformed/absent values retain the Cody fallback. When the technical
    // brain status is unavailable, the additive public identity still remains
    // available for the title/header. The status object never overrides it.
    const providedIdentity = currentBrainIdentityImpl
      ? resolveModelIdentity(currentBrainIdentityImpl()?.id)
      : null;
    const publicBrain =
      rawBrain && typeof rawBrain === "object"
        ? {
            ...rawBrain,
            identity: providedIdentity
              ? { id: providedIdentity.id, displayName: providedIdentity.displayName }
              : (() => {
                  const identity = resolveBrainIdentity(/** @type {any} */ (rawBrain).brain);
                  return { id: identity.id, displayName: identity.displayName };
                })()
          }
        : providedIdentity
          ? { identity: { id: providedIdentity.id, displayName: providedIdentity.displayName } }
          : null;
    return {
      ears: earsState,
      device: currentDevice,
      health: {
        whisper: { status: health.whisper, reason: health.whisperReason },
        ffmpeg: { status: health.ffmpeg, reason: health.ffmpegReason }
      },
      appended: bufStats.appended,
      discarded: bufStats.discarded,
      uptimeMs: earsState === "listening" && startedAtMs != null ? Math.max(0, nowImpl() - startedAtMs) : 0,
      transcripts: pipeline ? pipeline.transcriptBuffer.last(transcriptHistory).map(toWireEntry) : [],
      // S3 追撃 domain-c: Channel の現況（Domain B が redact 済みで返す・未注入なら null）。
      channel: typeof channelStatusImpl === "function" ? (channelStatusImpl() ?? null) : null,
      // S5「目が開く」: 視覚発火の対象ウインドウの現況（未注入なら null）。
      visionTarget: typeof visionTargetStatusImpl === "function" ? (visionTargetStatusImpl() ?? null) : null,
      // S6「会話が続く」: 自発発火の現況（scheduler 未生成 = orchestrator 未注入なら null）。
      selfFire: fireScheduler ? { enabled: fireScheduler.isEnabled() } : null,
      // 「朗読と合いの手」: barge-in トグルの現況（gate 未生成 = orchestrator.interrupt 未対応なら null・
      // selfFire と同型）。
      bargeIn: bargeInGate ? { enabled: bargeInGate.isEnabled() } : null,
      // 口数モードの現況（scheduler 未生成 = orchestrator 未注入なら null・selfFire と同型）。
      verbosity: fireScheduler ? fireScheduler.getVerbosity() : null,
      // S8「キルスイッチ」: キル状態の正本（サーバ側 boolean をそのまま載せる・既定 false・additive）。
      killed: killed,
      // 多頭化 Domain B: 頭脳の現況（頭札 + 資格情報の存在確認・未注入なら null・audioDevice/channel と同型）。
      brain: publicBrain,
      // 配信間記憶: 記憶の現況（{enabled, count, lastRecordAtMs}・未注入なら null・brain と同型）。
      memory: typeof memoryStatusImpl === "function" ? (memoryStatusImpl() ?? null) : null,
      // S6「会話が続く」: 魂の声の出力デバイスの現況（未注入なら null）。
      audioDevice: typeof audioDeviceStatusImpl === "function" ? (audioDeviceStatusImpl() ?? null) : null,
      // S7「視聴者が混ざる」: チャット器官の現況。source は settings 由来（Connect 前でも入力欄の既定に
      // 復元できる・切断後も残る）。connected/state は live client 由来（未接続なら false/null）。
      chat: {
        source: typeof chatSourceStatusImpl === "function" ? (chatSourceStatusImpl()?.source ?? null) : null,
        connected: chatClient != null,
        state: chatClient ? chatClient.getState() : null
      }
    };
  }

  // ── SSE ライブチャネル ─────────────────────────────────────────────

  /**
   * @param {string} event
   * @param {unknown} data
   */
  function broadcast(event, data) {
    if (sseClients.size === 0) return;
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(frame);
      } catch {
        // best-effort（切断済みは req 'close' で除去される）。
      }
    }
  }

  /** 現在状態を丸ごと push（ヘッダ/フッタの権威スナップショット）。 */
  function broadcastState() {
    broadcast("state", snapshot());
  }

  // ── 死活の反映 ─────────────────────────────────────────────────────

  /**
   * @param {"whisper" | "ffmpeg"} which
   * @param {"up" | "down" | "unknown"} status
   * @param {string | null} reason
   */
  function setHealth(which, status, reason) {
    const statusKey = which;
    const reasonKey = /** @type {"whisperReason" | "ffmpegReason"} */ (`${which}Reason`);
    if (health[statusKey] === status && health[reasonKey] === reason) return;
    health[statusKey] = status;
    health[reasonKey] = reason;
    broadcastState();
  }

  /** @param {any} d  pipeline の診断イベント。 */
  function handleDiagnostic(d) {
    if (d && d.type === "whisperDown") {
      setHealth(
        "whisper",
        "down",
        `whisper-server down (${d.phase ?? "runtime"}; code=${d.code ?? "?"}, signal=${d.signal ?? "?"})`
      );
    } else if (d && d.type === "ffmpegExit" && d.willRestart === false) {
      // willRestart=false = 再起動予算切れ/恒久死（capture の再起動耐性が尽きた）。
      // willRestart=true は capture が自己回復するため up のまま（transient blip）。
      setHealth("ffmpeg", "down", `ffmpeg exited (code=${d.code ?? "?"}, signal=${d.signal ?? "?"})`);
    }
    // 診断そのものも流す（B が任意で表示できる。健康以外は状態を変えない）。
    // startMs/endMs はゴースト行の対象 span（asrFailure が持つ・S2.5 追撃 domain-f）。
    // tag は演出の未知タグ（expressionUnknownTag が持つ・S4）。ページがゴースト行に語を出す。
    // kind は視覚発火の失敗種別（fireVisionError が持つ・S5「目が開く」・domain-c.md §）。
    // elapsedMs/charsSpoken/totalChars/prefix は barge-in の切断点情報（type:"bargeIn" が持つ・
    // S6「会話が続く」・domain-d.md §）。ページが barge-in マーカー行に切断点を出す。
    // 元々これらを持たない診断型では null になるだけで契約破壊はない（追加フィールド）。
    broadcast("diagnostic", {
      type: d?.type ?? "unknown",
      message: d?.message ?? null,
      reason: d?.reason ?? null,
      startMs: d?.startMs ?? null,
      endMs: d?.endMs ?? null,
      tag: d?.tag ?? null,
      kind: d?.kind ?? null,
      elapsedMs: d?.elapsedMs ?? null,
      charsSpoken: d?.charsSpoken ?? null,
      totalChars: d?.totalChars ?? null,
      prefix: d?.prefix ?? null
    });
  }

  // ── 耳のライフサイクル ─────────────────────────────────────────────

  /**
   * @param {string | null} deviceRaw
   * @returns {Promise<{ ok: true; state: object } | { ok: false; error: string; state: object }>}
   */
  async function startEars(deviceRaw) {
    if (pipeline && earsState !== "stopped") {
      // 既に起動中/起動済み。冪等に現状を返す（デバイス変更は Stop→Start）。
      return { ok: true, state: snapshot() };
    }
    const device = normalizeDevice(deviceRaw ?? undefined, inputFormat) ?? null;
    currentDevice = deviceRaw ?? null;
    try {
      await settings.setLastDevice(currentDevice);
    } catch {
      // 永続化失敗は起動を止めない（B の file-backed 実体の I/O 失敗を握る）。
    }

    earsState = "starting";
    health.whisper = "unknown";
    health.whisperReason = null;
    health.ffmpeg = "unknown";
    health.ffmpegReason = null;

    const baseOptions = options.pipelineOptions ?? {};
    // Resolve the Whisper lexical-bias prompt at request time. The injected
    // provider observes cockpit.mjs currentBrain, so switching heads does not
    // require restarting the ear pipeline.
    const whisperOptions = {
      ...(/** @type {any} */ (baseOptions).whisper ?? {})
    };
    if (currentBrainIdentityImpl) {
      whisperOptions.promptProvider = () => {
        const identity = currentBrainIdentityImpl();
        return identity && typeof identity.whisperPrompt === "string" ? identity.whisperPrompt : undefined;
      };
    }
    const p = pipelineFactory({
      ...baseOptions,
      whisper: whisperOptions,
      capture: {
        ...(/** @type {any} */ (baseOptions).capture ?? {}),
        ...(device != null ? { device } : {}),
        ...(inputFormat ? { inputFormat } : {})
      },
      onVadEvent: (e) => {
        broadcast("vad", {
          type: e.type,
          tMs: e.tMs,
          startMs: e.startMs ?? null,
          endMs: e.endMs ?? null,
          durationMs: e.durationMs ?? null,
          reason: e.reason ?? null
        });
        // S6 barge-in: SSE 放送と**並んで**機械弁へ回す（結線は薄く・核心は純部品側）。
        // speechStart→Nms 内に speechCancel が来なければ確定→orchestrator.interrupt で声を止める。
        if (bargeInGate) bargeInGate.handle(e);
        // S6 自発発火: VAD を発火スケジューラへも回す（区切り応答の無音待ち・沈黙の活動リセット）。
        if (fireScheduler) fireScheduler.handleVadEvent(e);
      },
      onTranscript: (entry, meta) => {
        // S6 自発発火: 転写を発火スケジューラへ回す（you = 呼びかけ照合 + 活動 / soul = 不応期リセット /
        // viewer = handleTranscript 内で no-op ★二重発火の断ち）。**soul 除外の前**に回す（scheduler は
        // soul 発話を不応期の基点に使うため you/soul 両方を要る。viewer は scheduler 内で無視される）。
        if (fireScheduler) fireScheduler.handleTranscript(entry);
        // soul の発話行はここ（耳の onTranscript 経路）では放送しない。soul も you と同じ
        // transcriptBuffer に append されるため onAppend→onTranscript を必ず通るが、soul の正経路は
        // orchestrator の onSoulTranscript → broadcastSoulTranscript の 1 本。ここで除外しないと
        // 同一エントリが二重に broadcast("transcript") される（S3 追撃 domain-c で接地した二重表示バグ）。
        // ★ S7: viewer コメントも同じ transcriptBuffer へ append されるため onTranscript を通るが、
        // viewer 行の放送は取り込み経路（ingestChatMessage）が 1 本で担う。ここで除外しないと二重放送。
        if (/** @type {any} */ (entry).speaker === "soul" || /** @type {any} */ (entry).speaker === "viewer") return;
        const stats = pipeline ? pipeline.transcriptBuffer.stats() : { appended: 0, discarded: 0 };
        broadcast("transcript", {
          ...toWireEntry(entry),
          latencyMs: meta?.latencyMs ?? null,
          audioCtx: meta?.audioCtx ?? null,
          appended: stats.appended,
          discarded: stats.discarded
        });
      },
      onDiagnostic: handleDiagnostic
    });

    // discard 購読は transcriptBuffer 直参照（正本の破棄を footer の diagnostic 材料に）。
    discardUnsub = p.transcriptBuffer.onDiscard((info) => {
      const stats = p.transcriptBuffer.stats();
      broadcast("discard", {
        startMs: info.startMs,
        endMs: info.endMs,
        reason: info.reason,
        appended: stats.appended,
        discarded: stats.discarded
      });
    });

    pipeline = p;
    try {
      await p.start();
    } catch (error) {
      // start 失敗（whisper spawn 失敗等）: pipeline は自身で dispose 済み。状態を畳む。
      if (discardUnsub) {
        discardUnsub();
        discardUnsub = null;
      }
      pipeline = null;
      earsState = "stopped";
      startedAtMs = null;
      setHealth("whisper", "down", `ears failed to start: ${errMessage(error)}`);
      earsState = "stopped"; // setHealth の broadcast 後も stopped を確定。
      return { ok: false, error: errMessage(error), state: snapshot() };
    }

    earsState = "listening";
    startedAtMs = nowImpl();
    // start 成功 = whisper ready・ffmpeg spawn 済み（楽観的 up。以後の死は診断で down に落ちる）。
    health.whisper = "up";
    health.whisperReason = null;
    health.ffmpeg = "up";
    health.ffmpegReason = null;
    broadcastState();
    return { ok: true, state: snapshot() };
  }

  /** @returns {Promise<object>} 停止後の状態。 */
  async function stopEars() {
    if (!pipeline) {
      earsState = "stopped";
      return snapshot();
    }
    const p = pipeline;
    pipeline = null;
    if (discardUnsub) {
      discardUnsub();
      discardUnsub = null;
    }
    try {
      await p.dispose();
    } catch {
      // best-effort
    }
    earsState = "stopped";
    startedAtMs = null;
    health.whisper = "unknown";
    health.whisperReason = null;
    health.ffmpeg = "unknown";
    health.ffmpegReason = null;
    broadcastState();
    return snapshot();
  }

  /**
   * Return the effective instruction response for the dedicated local API.
   * Instruction text intentionally has no other projection in the server.
   * @param {string} brainId
   */
  function conversationInstructionResponse(brainId) {
    if (!conversationInstructionHooks) throw new Error("conversation instruction control not available");
    const profile = conversationInstructionHooks.getProfile(brainId);
    if (!profile || typeof profile.body !== "string" || typeof profile.hasOverride !== "boolean") {
      throw new Error("conversation instruction profile is invalid");
    }
    const revision = conversationInstructionHooks.getRevision();
    if (!Number.isInteger(revision) || revision < 0) throw new Error("conversation instruction revision is invalid");
    return {
      ok: true,
      brainId,
      instruction: profile.body,
      isOverride: profile.hasOverride,
      revision
    };
  }

  // ── HTTP ルーティング ─────────────────────────────────────────────

  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      sendJson(res, 500, { error: `internal error: ${errMessage(error)}` });
    });
  });

  /**
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  async function handleRequest(req, res) {
    if (closed) {
      sendJson(res, 503, { error: "cockpit server is closing." });
      return;
    }
    const method = req.method ?? "GET";
    const url = new URL(req.url ?? "/", `http://${host}`);
    const pathname = url.pathname;

    const conversationRoute = pathname.match(/^\/api\/conversation-instructions\/([^/]+)$/);
    if (conversationRoute && (method === "GET" || method === "PUT" || method === "DELETE")) {
      if (!conversationInstructionHooks) {
        sendJson(res, 503, { error: "conversation instruction control not available" });
        return;
      }
      let brainId;
      try {
        brainId = decodeURIComponent(conversationRoute[1]);
      } catch {
        sendJson(res, 400, { error: "invalid conversation instruction brain id" });
        return;
      }
      if (!CONVERSATION_INSTRUCTION_BRAIN_IDS.includes(brainId)) {
        sendJson(res, 400, { error: "invalid conversation instruction brain id" });
        return;
      }
      if (method === "GET") {
        try {
          sendJson(res, 200, conversationInstructionResponse(brainId));
        } catch {
          sendJson(res, 500, { error: "failed to read conversation instruction" });
        }
        return;
      }
      if (method === "PUT") {
        const parsed = await readJsonBodyStrict(req);
        if (!parsed.ok) {
          sendJson(res, 400, { error: "malformed JSON body" });
          return;
        }
        const instruction = parsed.value.instruction;
        if (typeof instruction !== "string") {
          sendJson(res, 400, { error: "instruction must be a string" });
          return;
        }
        if (instruction.trim().length === 0) {
          sendJson(res, 400, { error: "instruction must not be empty" });
          return;
        }
        try {
          const persisted = await conversationInstructionHooks.save(brainId, instruction);
          if (persisted !== true) throw new Error("instruction persistence failed");
          sendJson(res, 200, conversationInstructionResponse(brainId));
        } catch {
          // Do not expose the instruction or persistence path. The hook advances revision only after durable
          // persistence, so a failed save cannot invalidate the existing session.
          sendJson(res, 500, { error: "failed to persist conversation instruction" });
        }
        return;
      }
      try {
        const persisted = await conversationInstructionHooks.reset(brainId);
        if (persisted !== true) throw new Error("instruction persistence failed");
        sendJson(res, 200, conversationInstructionResponse(brainId));
      } catch {
        sendJson(res, 500, { error: "failed to reset conversation instruction" });
      }
      return;
    }

    if (method === "GET" && pathname === "/") {
      await serveIndex(res);
      return;
    }
    if (method === "GET" && pathname === "/api/devices") {
      const result = await enumerateDevicesImpl({ inputFormat });
      sendJson(res, 200, {
        devices: result.devices,
        inputFormat: result.inputFormat,
        lastDevice: await resolveLastDevice(),
        error: result.error
      });
      return;
    }
    if (method === "GET" && pathname === "/api/state") {
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "GET" && pathname === "/api/events") {
      openSse(req, res);
      return;
    }
    if (method === "POST" && pathname === "/api/ears/start") {
      if (transitioning) {
        sendJson(res, 409, { error: "ears are transitioning; retry shortly.", state: snapshot() });
        return;
      }
      transitioning = true;
      try {
        const body = await readJsonBody(req);
        const deviceRaw = body.device ?? url.searchParams.get("device") ?? (await resolveLastDevice());
        const result = await startEars(deviceRaw ?? null);
        sendJson(res, result.ok ? 200 : 500, result.ok ? result.state : { error: result.error, state: result.state });
      } finally {
        transitioning = false;
      }
      return;
    }
    if (method === "POST" && pathname === "/api/ears/stop") {
      if (transitioning) {
        sendJson(res, 409, { error: "ears are transitioning; retry shortly.", state: snapshot() });
        return;
      }
      transitioning = true;
      try {
        const state = await stopEars();
        sendJson(res, 200, state);
      } finally {
        transitioning = false;
      }
      return;
    }
    if (method === "POST" && pathname === "/api/fire") {
      if (!fireOrchestrator) {
        // 未注入（S2.5 単体で立てた等）: 発火は使えない。S2.5 テストはここを叩かない = 無退行。
        sendJson(res, 503, { error: "fire not available" });
        return;
      }
      // busy 保護は orchestrator の状態機械が担う（2 発目は即 reason:"busy"）。
      const result = await fireOrchestrator.fire();
      // accepted（発火成功）は 202・busy/empty/ears-not-running/error は 200 に {fired:false,...}。
      const status = /** @type {any} */ (result).fired ? 202 : 200;
      sendJson(res, status, { ...result, state: /** @type {any} */ (result).state ?? fireOrchestrator.getState() });
      return;
    }
    if (method === "GET" && pathname === "/api/windows") {
      // S5「目が開く」: 対象ウインドウ選択用の一覧取得（実 PowerShell を起動しうる・棚卸し §3-4）。
      const result = await listWindowsImpl();
      if (result && Array.isArray(/** @type {any} */ (result).windows)) {
        sendJson(res, 200, { windows: /** @type {any} */ (result).windows, error: null });
      } else {
        const err = /** @type {any} */ (result) && /** @type {any} */ (result).error;
        sendJson(res, 200, { windows: [], error: err ? err.message ?? String(err) : "unknown error" });
      }
      return;
    }
    if (method === "POST" && pathname === "/api/vision-target") {
      if (typeof onSetVisionTarget !== "function") {
        // 未注入（S2.5/S3/S4 単体で立てた等）: 視覚発火の対象設定は使えない。
        sendJson(res, 503, { error: "vision target control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const raw = typeof body.title === "string" ? body.title.trim() : "";
      const title = raw.length > 0 ? raw : null; // 空 = クリア（対象未設定へ）。
      // タイトル自体はここに保持/ログしない。フックへ橋渡しし、state は visionTargetStatus() だけを載せる
      // （責務境界: cockpit-server は永続化実体を知らない・Channel URL と同型）。
      await onSetVisionTarget(title);
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/vision-fire") {
      if (!fireOrchestrator) {
        // 未注入（S2.5/S3/S4 単体で立てた等）: 発火は使えない。既存 /api/fire と同型の 503。
        sendJson(res, 503, { error: "fire not available" });
        return;
      }
      // busy 保護は orchestrator の状態機械が担う（通常 Fire と共有・2 発目は即 reason:"busy"）。
      const result = await fireOrchestrator.fire({ vision: true });
      // accepted（発火成功）は 202・busy/no-target/capture-failed/empty/error は 200 に {fired:false,...}。
      const status = /** @type {any} */ (result).fired ? 202 : 200;
      sendJson(res, status, { ...result, state: /** @type {any} */ (result).state ?? fireOrchestrator.getState() });
      return;
    }
    if (method === "GET" && pathname === "/api/audio-devices") {
      // S6「会話が続く」: 出力デバイス選択用の一覧取得（実 PowerShell を起動しうる・GET /api/windows の写経）。
      const result = await listAudioDevicesImpl();
      if (result && Array.isArray(/** @type {any} */ (result).devices)) {
        sendJson(res, 200, { devices: /** @type {any} */ (result).devices, error: null });
      } else {
        const err = /** @type {any} */ (result) && /** @type {any} */ (result).error;
        sendJson(res, 200, { devices: [], error: err ? err.message ?? String(err) : "unknown error" });
      }
      return;
    }
    if (method === "POST" && pathname === "/api/audio-device") {
      if (typeof onSetAudioDevice !== "function") {
        // 未注入（S2.5〜S5 単体で立てた等）: 出力デバイス設定は使えない。
        sendJson(res, 503, { error: "audio device control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const raw = typeof body.name === "string" ? body.name.trim() : "";
      const name = raw.length > 0 ? raw : null; // 空 = クリア（既定デバイスへ）。
      // デバイス名自体はここに保持/ログしない。フックへ橋渡しし、state は audioDeviceStatus() だけを
      // 載せる（責務境界: cockpit-server は永続化・常駐プレイヤーの再起動実体を知らない）。
      await onSetAudioDevice(name);
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/self-fire") {
      // S6「会話が続く」: 自発発火 ON/OFF の永続トグル継ぎ目（Domain C が用意した setSelfFireEnabled を
      // HTTP から叩く）。scheduler 未生成（orchestrator 未注入）なら 503（手動 Fire は無関係・生きたまま）。
      if (!fireScheduler) {
        sendJson(res, 503, { error: "self-fire control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const enabled = body.enabled === true;
      fireScheduler.setEnabled(enabled);
      if (typeof onSetSelfFireEnabled === "function") {
        try {
          await onSetSelfFireEnabled(fireScheduler.isEnabled());
        } catch {
          // 永続化失敗は操作を止めない（onSetVisionTarget と同型の失敗寛容）。
        }
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/barge-in") {
      // 「朗読と合いの手」: barge-in ON/OFF の永続トグル継ぎ目（POST /api/self-fire の写経）。
      // gate 未生成（orchestrator.interrupt 未対応）なら 503（既存 barge-in 結線は無関係・生きたまま）。
      if (!bargeInGate) {
        sendJson(res, 503, { error: "barge-in control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const enabled = body.enabled === true;
      bargeInGate.setEnabled(enabled);
      if (typeof onSetBargeInEnabled === "function") {
        try {
          await onSetBargeInEnabled(bargeInGate.isEnabled());
        } catch {
          // 永続化失敗は操作を止めない（onSetSelfFireEnabled と同型の失敗寛容）。
        }
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/verbosity") {
      // 口数モードの切替継ぎ目（wave 計画「口数配線」§2 裁定 A・POST /api/self-fire の写経）。
      // scheduler 未生成（orchestrator 未注入）なら 503（自発発火制御と同型・生きたまま）。
      if (!fireScheduler) {
        sendJson(res, 503, { error: "verbosity control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const mode = body.mode;
      // self-fire は boolean 強制だが、verbosity は妥当な mode（quiet/normal/chatty）を要求する
      // （無効入力を早期に弾く・防御的）。
      if (typeof mode !== "string" || (mode !== "quiet" && mode !== "normal" && mode !== "chatty")) {
        sendJson(res, 400, { error: "invalid verbosity mode" });
        return;
      }
      fireScheduler.setVerbosity(mode);
      if (onSetVerbosity) {
        try {
          await onSetVerbosity(fireScheduler.getVerbosity());
        } catch {
          // 永続化失敗は操作を止めない（onSetSelfFireEnabled と同型の失敗寛容）。
        }
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/kill") {
      // S8「キルスイッチ」: 全発火 OFF + 声の即切断（POST /api/fire の :798 と同型のゲート・orchestrator が
      // 要る）。キル状態の正本はサーバ側（この関数を囲む `killed` 変数）にあり、ここが唯一の書き手。
      if (!fireOrchestrator) {
        sendJson(res, 503, { error: "kill control not available" });
        return;
      }
      const body = await readJsonBody(req);
      // トグル禁止・明示 boolean のみ受理する（誤 POST での意図しない反転を避ける・verbosity の mode
      // 検証 :909-912 と同型の早期防御）。
      if (typeof body.killed !== "boolean") {
        sendJson(res, 400, { error: "killed must be a boolean" });
        return;
      }
      killed = body.killed; // 正本更新。
      // orchestrator へ遷移時伝播（best-effort・onSetSelfFireEnabled :887-893 と同型の失敗寛容）。
      // POST /api/kill は fire() の Promise には一切依存しない（kill 中の再生を barge-in と見分けられない
      // ため・レスポンス正本は snapshot + kill() 自身の戻り値のみ・domain-a.md 申し送り）。
      try {
        if (killed) {
          await fireOrchestrator.kill();
        } else {
          fireOrchestrator.revive();
        }
      } catch {
        // best-effort（失敗しても操作は止めない・killed フラグはサーバ側で既に反映済み）。
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/brain") {
      // 多頭化 Domain B: 頭脳の切替継ぎ目（POST /api/verbosity / /api/kill の写経）。永続化 + 現 session の
      // dispose→null（次発火から新頭）は cockpit.mjs の onSetBrain が担う（責務境界: cockpit-server は
      // brain の中身を知らない）。未注入（S2.5 単体等）なら 503（onSetChannelUrl と同型の未注入ゲート）。
      if (typeof onSetBrain !== "function") {
        sendJson(res, 503, { error: "brain control not available" });
        return;
      }
      const body = await readJsonBody(req);
      // トグル禁止・明示値のみ受理する（誤 POST を早期に弾く・verbosity の mode 検証と同型）。頭 id 4 値は
      // ここに直書きする（API の受理値/技術札は従来のワイヤ検証を保持する）。
      // `resolveBrainIdentity` の import はこの検証表を置き換えるためではなく、下流の current public
      // projection だけを canonical resolver から導出するための additive read-path である。2026-07-17
      // 追撃で Codex 側 2 頭（GPT-5.5 / GPT-5.6 Sol）がここへ追加された既存契約は変えない。
      if (
        body.brain !== "claude" &&
        body.brain !== "codex" &&
        body.brain !== "codex-55" &&
        body.brain !== "codex-56-sol"
      ) {
        sendJson(res, 400, { error: "invalid brain" });
        return;
      }
      try {
        await onSetBrain(body.brain);
      } catch {
        // best-effort（永続化 / dispose 失敗で操作を止めない・onSetVerbosity と同型の失敗寛容）。
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/channel") {
      if (typeof onSetChannelUrl !== "function") {
        // 未注入（S2.5 単体で立てた等）: channel 制御は使えない。
        sendJson(res, 503, { error: "channel control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const raw = typeof body.url === "string" ? body.url.trim() : "";
      const url = raw.length > 0 ? raw : null; // 空 = クリア（未設定へ）。
      // URL 自体はここに保持/ログしない（token を含む）。フックへ橋渡しし、state は redact 済みの
      // channelStatus() だけを載せる（責務境界: cockpit-server は channel の中身を知らない）。
      await onSetChannelUrl(url);
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/chat/connect") {
      // S7「視聴者が混ざる」: 実チャット器官を Connect（POST 駆動遅延起動・ear-pipeline の流儀）。
      if (typeof chatClientFactory !== "function") {
        // 未注入（S2.5〜S6 単体で立てた等）: チャット合流は使えない（POST /api/fire と同型の 503）。
        sendJson(res, 503, { error: "chat not available" });
        return;
      }
      const body = await readJsonBody(req);
      const raw = typeof body.source === "string" ? body.source.trim() : "";
      if (raw.length === 0) {
        // Connect には配信 source が要る（空はクリアではなくエラー・停止は disconnect で行う）。
        sendJson(res, 400, { error: "chat source is required (stream URL / video ID / channel /live URL)." });
        return;
      }
      try {
        await connectChat(raw);
      } catch (error) {
        // 器官生成/start の想定外 throw（factory 自体の throw 等）。器官内エラーは Domain A が診断へ
        // 落とすので通常ここには来ないが、防波堤として畳んで正直に返す（盲目の「接続済み」を残さない）。
        foldChatClient();
        sendJson(res, 500, { error: `chat connect failed: ${errMessage(error)}`, state: snapshot() });
        return;
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/chat/disconnect") {
      // 稼働中のチャット器官を停止して畳む（冪等・器官が無くても 200）。
      foldChatClient();
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/memory") {
      // 配信間記憶: 記憶 ON/OFF の永続トグル継ぎ目（POST /api/self-fire・POST /api/barge-in の写経）。
      // 未注入（Domain B 未配線・単体起動等）なら 503（onSetBrain と同型の未注入ゲート）。
      if (typeof onSetMemoryEnabled !== "function") {
        sendJson(res, 503, { error: "memory control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const enabled = body.enabled === true;
      try {
        await onSetMemoryEnabled(enabled);
      } catch {
        // 永続化/ホットスワップ失敗は操作を止めない（onSetSelfFireEnabled と同型の失敗寛容）。
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/memory-record") {
      // 配信間記憶: 手動「今日を記録」継ぎ目。onMemoryRecord 未注入なら 503。
      if (typeof onMemoryRecord !== "function") {
        sendJson(res, 503, { error: "memory record control not available" });
        return;
      }
      try {
        await onMemoryRecord();
      } catch {
        // 記録失敗（generateDigest/saveDigest の throw 含む）は 500 にせず握って続行する
        // （手動記録が失敗しても操縦席の他の操作を止めない・failure-tolerant）。
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }

    // 操縦席 UI アセットの静的配信（vendor/ui/view-logic の .mjs ツリー）。**追加ルートのみ**——
    // 既存 22 エンドポイント×13 SSE のワイヤ契約は一切変えない（上の分岐で全て return 済みで、ここに
    // 落ちてくる GET は非 API・非 root だけ）。UI アセットサブツリー宛のみ握り、その他は既存 404 へ。
    if (method === "GET" && (await tryServeUiAsset(res, pathname))) {
      return;
    }

    sendJson(res, 404, { error: `not found: ${method} ${pathname}` });
  }

  /**
   * 操縦席 UI アセット（vendor/ui/view-logic 配下の `.mjs`）を配る静的ルート（serveIndex 同型の readFile→
   * JS MIME）。**トラバーサル防止**: `..` を含んでも path.relative で UI ルート脱出を弾き、正規化後の第一区画が
   * 許可サブツリー（vendor/ui/view-logic）に収まり、かつ拡張子が `.mjs` のものだけ 200 で返す。それ以外は 404。
   *
   * @param {import("node:http").ServerResponse} res
   * @param {string} pathname  リクエストパス（先頭 "/"）。
   * @returns {Promise<boolean>}  UI アセット宛として応答を握ったら true（握らなければ既存 404 へフォールスルー）。
   */
  async function tryServeUiAsset(res, pathname) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return false; // 不正な %エンコードは UI アセットとして扱わない（既存 404 へ委譲）。
    }
    rel = rel.replace(/^\/+/, "");
    const firstSeg = rel.split("/")[0];
    // このハンドラが「握る」のは第一区画が UI アセットサブツリーのリクエストのみ。それ以外（/api/... 等）は
    // false を返し、既存の 404 フォールスルーに委ねる（他ルートの 404 レスポンス形を 1 バイトも変えない）。
    if (!UI_ASSET_SUBDIRS.has(firstSeg)) return false;

    const notFound = () => sendJson(res, 404, { error: `not found: GET ${pathname}` });

    // 解決して UI ルート脱出とサブツリー逸脱を弾く（`..` / URL エンコードのトラバーサル防止）。
    const resolved = path.resolve(uiRootPath, rel);
    const relFromRoot = path.relative(uiRootPath, resolved);
    if (relFromRoot === "" || relFromRoot.startsWith("..") || path.isAbsolute(relFromRoot)) {
      notFound(); // UI ルートの外に出た（脱出）。
      return true;
    }
    // 正規化後の第一区画が許可サブツリー外なら拒否（例: /vendor/../cockpit-server.mjs → 第一区画が cockpit-server.mjs）。
    if (!UI_ASSET_SUBDIRS.has(relFromRoot.split(path.sep)[0])) {
      notFound();
      return true;
    }
    if (!resolved.endsWith(".mjs")) {
      notFound(); // 許可拡張子は .mjs のみ（module script は JS MIME 必須・他拡張子は配らない）。
      return true;
    }
    let body;
    try {
      body = await readFile(resolved);
    } catch {
      notFound(); // 存在しない .mjs。
      return true;
    }
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" });
    res.end(body);
    return true;
  }

  async function serveIndex(res) {
    let htmlBody = options.indexHtml;
    if (htmlBody == null && options.indexHtmlPath != null) {
      try {
        htmlBody = await readFile(options.indexHtmlPath, "utf8");
      } catch (error) {
        sendText(res, 500, `failed to read index html: ${errMessage(error)}`);
        return;
      }
    }
    if (htmlBody == null) htmlBody = PLACEHOLDER_HTML;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(htmlBody);
  }

  /**
   * SSE 接続を開き、購読者集合へ加える。接続が切れても pipeline は畳まない（UI は使い捨て）。
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   */
  function openSse(req, res) {
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive"
    });
    // 接続直後に現在状態を 1 発（タブ開き直しの復元）。
    res.write(": connected\n\n");
    res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`);
    sseClients.add(res);
    // クライアント切断 = 購読解除のみ。魂は生き続ける（blocking 基準 5）。
    req.on("close", () => {
      sseClients.delete(res);
    });
  }

  async function resolveLastDevice() {
    try {
      return (await settings.getLastDevice()) ?? null;
    } catch {
      return null;
    }
  }

  // ── 発火オーケストレータ（S3 Domain A・追加的結線）────────────────────────
  //
  //  未注入時は fireOrchestrator=null（POST /api/fire は 503・S2.5 は無退行）。注入時は cockpit が
  //  getBuffer（正本 = pipeline?.transcriptBuffer）と broadcast フックを渡す。soul の発話行の正経路は
  //  orchestrator の onSoulTranscript フックで受け、既存 transcript イベント（speaker:"soul"）として
  //  broadcast する（domain-a.md ワイヤ契約 §）。
  //  注意（S3 追撃 domain-c）: soul も同じ transcriptBuffer に append されるため耳の onTranscript
  //  （startEars 内）も必ず通る。そちらは speaker:"soul" を除外して二重放送を断つ（onTranscript の
  //  先頭ガード参照）。ここ（onSoulTranscript 経路）が soul の唯一の放送元。

  /**
   * soul の追記を既存 transcript イベントとして push（耳の onTranscript 経路とは別口）。
   *
   * 多頭化 Domain C（wave-plan §3・blocking #6 additive）: 2 点を additive で乗せる。
   *  - latencyMs: fire-orchestrator の processAskedReply（自然完了パス）が entry に乗せてきた実測値
   *    （asked.elapsedMs）をそのまま使う。NG ブロック/barge-in 中断等の entry には乗らないため null
   *    のまま＝従来どおり（後方互換）。
   *  - brain: Domain B が注入した brainStatus()（cockpit.mjs の currentBrain）から**今の**頭を読む。
   *    在庫（既知の近似・followup 記録済み）: 配信中に頭を切り替えた直後の in-flight 応答は「切替前の
   *    頭が生成した」が、この実装は broadcast 時点の brainStatus() を読むため、稀に札がズレうる
   *    （配信前選択が本線・切替は運用外という v0 裁定の下で許容）。
   */
  function broadcastSoulTranscript(entry) {
    const stats = pipeline ? pipeline.transcriptBuffer.stats() : { appended: 0, discarded: 0 };
    const latencyMs = entry && typeof (/** @type {any} */ (entry).latencyMs) === "number"
      ? /** @type {any} */ (entry).latencyMs
      : null;
    const brain = typeof brainStatusImpl === "function" ? (brainStatusImpl()?.brain ?? null) : null;
    broadcast("transcript", {
      ...toWireEntry(entry),
      latencyMs,
      audioCtx: null,
      appended: stats.appended,
      discarded: stats.discarded,
      brain
    });
  }

  /** @type {{ fire: () => Promise<object>; interrupt?: (atMs?: number) => Promise<object>; getState: () => string; dispose: () => void } | null} */
  let fireOrchestrator = null;
  if (typeof options.fireOrchestratorFactory === "function") {
    fireOrchestrator = options.fireOrchestratorFactory({
      getBuffer: () => (pipeline ? pipeline.transcriptBuffer : null),
      onState: (state) => broadcast("soul", { state }),
      onFire: (info) => broadcast("fire", info),
      onDiagnostic: (diag) => handleDiagnostic(diag),
      onSoulTranscript: (entry) => broadcastSoulTranscript(entry),
      // S4「表情が乗る」: 演出適用の語ごとの通知（{word, args?, applied, rejected}）を
      // SSE "expression" として broadcast する（onFire→broadcast("fire") と同型）。ページは
      // fire マーカーと同型の演出イベント行に描く。orchestrator の onExpression ワイヤ契約は
      // waves/s4/domain-a.md §7。cockpit.mjs の factory は ...hooks を spread するため自動で届く。
      onExpression: (info) => broadcast("expression", info),
      // S5「目が開く」: キャプチャ成功の「見た」事実（サムネ用 base64 込み）を SSE "visionCaptured" へ。
      // ディスクには一切書かない（notify-and-forget・domain-b.md §4-1 / domain-c.md §）。
      onVisionCaptured: (info) => broadcast("visionCaptured", info),
      // askごとの usage（input_tokens 等・通常 Fire/視覚発火共通）を SSE "usage" へ（domain-b.md §4-2）。
      // 多頭化 Domain C: brain 札を additive で乗せる（broadcastSoulTranscript と同じ brainStatusImpl()
      // 読み取り・in-flight 切替時の近似は同節の注記のとおり）。
      onUsage: (info) => broadcast("usage", { ...info, brain: typeof brainStatusImpl === "function" ? (brainStatusImpl()?.brain ?? null) : null }),
      // S8「キルスイッチ」born-killed: orchestrator 生成時にサーバの現況キル状態を渡す。killed 変数は
      // 上（:435 付近）で宣言済みゆえここより前に存在する。「キル中に生まれる orchestrator はキル済みで
      // 生まれる」不変の下地（cockpit.mjs の factory は ...hooks を spread するため自動で届く）。
      initialKilled: killed
    });
  }

  // S6「会話が続く」barge-in の結線（additive・薄い）: orchestrator が interrupt を持つときだけ機械弁を
  // 生成する。onVadEvent（startEars 内）が gate.handle を回し、確定で orchestrator.interrupt を呼ぶ。
  // 核心ロジック（機械弁・切断点・interrupt）は純部品/orchestrator 側で fake テスト済み（domain-b.md）。
  if (fireOrchestrator && typeof (/** @type {any} */ (fireOrchestrator).interrupt) === "function") {
    bargeInGate = createBargeInGate({
      // born-disabled（「朗読と合いの手」裁定 1・L0 設計裁定 1）: 起動時の永続 OFF 値をここで直接渡す。
      // 構築後に setEnabled で後追いしない＝起動直後の VAD イベントが割り込み窓を作らない。
      enabled: bargeInInitialEnabled,
      onConfirm: () => {
        try {
          // 中断は best-effort（発話中でなければ no-op・throw は握る）。fire 経路をブロックしない。
          void /** @type {any} */ (fireOrchestrator).interrupt();
        } catch {
          // best-effort（barge-in の失敗で常駐を殺さない）。
        }
      }
    });
  }

  // S6「会話が続く」自発発火スケジューラの結線（additive・薄い）: orchestrator が fire/getState を持つときだけ
  // 生成する。onVadEvent/onTranscript（startEars 内）が handleVadEvent/handleTranscript を回し、判定に応じて
  // onFireRequest で kind 付き発火要求が来る。
  //  S6 追撃（Domain E・人間ゲート裁定）: call/turn-end を**視覚優先**（fire({vision:"preferred"})）へ格上げ
  //  ——視覚対象が設定済みなら画像付き発火、無/キャプチャ失敗なら画像なしの通常発火へ静かに劣化する（誰も
  //  ボタンを押していない自発発火ゆえ盲目でも嘘にならない・劣化痕跡は fireVisionDegraded 診断のゴースト行）。
  //  silence は従来どおり fire({vision:true})（見えなければ中止＝1 ビットも変えない）。手動 Fire・手動視覚 Fire
  //  は scheduler 非経由ゆえ無関係。busy 無視・空窓等は既存状態機械（fire-orchestrator）に従う。
  //  S7「視聴者が混ざる」: comment / comment-call も call/turn-end と同じ**視覚優先**へ振り分ける（silence 以外
  //  ＝下の三項の else 枝で fire({vision:"preferred"}) になる）。kind は selfFire SSE にそのまま載る（Domain C の
  //  自発発火マーカー材料）。ingestChatMessage（下の取り込み経路）が scheduler.handleChatMessage を回す入口。
  //  「朗読と合いの手」: 第 7 の語彙 interjection（合いの手）も silence ではない＝下の三項の else 枝に
  //  自動的に入り fire({vision:"preferred"}) になる（コード分岐は無改修・scheduler が kind を出すだけ）。
  //  kind:"interjection" も同じ selfFire SSE にそのまま素通しで載る（server/UI 無改修・inventory §3）。
  if (
    fireOrchestrator &&
    typeof (/** @type {any} */ (fireOrchestrator).fire) === "function" &&
    typeof (/** @type {any} */ (fireOrchestrator).getState) === "function"
  ) {
    // fireSchedulerFactory はテスト注入用（既定 createFireScheduler・fireOrchestratorFactory/
    // pipelineFactory と同型の差し替えパターン）。本番（scripts/cockpit.mjs）は指定しない＝常に
    // createFireScheduler が使われ挙動は不変。テストはこれで fake scheduler を注入し、cockpit-server の
    // onFireRequest コールバック（このすぐ下）へ直接 kind を「食わせて」vision 振り分けを検証できる
    // （interjection はタイマー駆動のみで即時発火経路が無いため・server 側ロジックの直接テストに必要）。
    const fireSchedulerFactory =
      typeof options.fireSchedulerFactory === "function" ? options.fireSchedulerFactory : createFireScheduler;
    fireScheduler = fireSchedulerFactory({
      enabled: selfFireInitialEnabled,
      verbosity: verbosityInitialMode,
      isBusy: () => /** @type {any} */ (fireOrchestrator).getState() !== "idle",
      // Name variants are handling-time providers. They share the current
      // registry identity with Whisper/public state and therefore switch
      // families without recreating the scheduler.
      ...(currentBrainIdentityImpl
        ? {
            nameVariantsProvider: () => {
              const identity = currentBrainIdentityImpl();
              return identity?.voiceCallVariants;
            },
            commentNameVariantsProvider: () => {
              const identity = currentBrainIdentityImpl();
              return identity?.commentCallVariants;
            }
          }
        : {}),
      onFireRequest: (req) => {
        // S6 Domain D: 発火要求の kind（call/turn-end/silence）を SSE "selfFire" で結線層外へ通知する
        // （操縦席のタイムラインが自発発火マーカー行/スケジューラ診断のゴースト行を描く材料・domain-d.md §）。
        // fire() 自体は best-effort（throw は握る・自発発火の失敗で常駐を殺さない）。結果（fired/reason）が
        // 判明してから broadcast する（同期 throw も非同期 rejection もどちらも "fired:false" として扱う）。
        const kind = req && req.kind;
        try {
          // S6 追撃（Domain E）: silence は従来どおり視覚発火（見えなければ中止）。call/turn-end および
          // S7 の comment/comment-call は視覚優先（対象あれば画像付き・無/失敗なら画像なしの通常発火へ
          // 劣化）。手動 Fire は scheduler 非経由で無関係。
          const firePromise =
            req && req.kind === "silence"
              ? /** @type {any} */ (fireOrchestrator).fire({ vision: true })
              : /** @type {any} */ (fireOrchestrator).fire({ vision: "preferred" });
          Promise.resolve(firePromise)
            .then((result) => {
              broadcast("selfFire", {
                kind,
                fired: !!(result && /** @type {any} */ (result).fired),
                reason: result && /** @type {any} */ (result).reason != null ? /** @type {any} */ (result).reason : null
              });
            })
            .catch((error) => {
              broadcast("selfFire", { kind, fired: false, reason: "error", message: errMessage(error) });
            });
        } catch (error) {
          broadcast("selfFire", { kind, fired: false, reason: "error", message: errMessage(error) });
        }
      }
    });
  }

  // ── チャット器官（S7「視聴者が混ざる」）の取り込み経路（プラミング + attach 点）─────────────
  //
  //  Domain A のチャット器官（src/chat/・独立）は魂の他部位を知らない。合流はこの取り込み経路が
  //  **器官の外から** hooks 経由で行う（逆方向 import を作らない）。Domain C が実チャット器官を生成し、
  //  client.onMessage → server.ingestChatMessage / client.onStatus → server.broadcastChatStatus /
  //  client.onDiagnostic → server.broadcastChatDiagnostic を繋ぐ（クライアント生成と Connect/停止
  //  ライフサイクルは Domain C の領分）。ingestChatMessage は 1 コメントを:
  //   (a) 転写バッファへ speaker:"viewer"+displayName で append（単一タイムライン・startMs/endMs=0）、
  //   (b) SSE "transcript"（speaker:"viewer"+displayName）を 1 本放送（Domain C が `viewer(名前):` を描く）、
  //   (c) fireScheduler.handleChatMessage（comment / comment-call 判定）を回す。
  //
  //  ★ 二重発火/二重放送の断ち: (a) の append は buffer.onAppend→耳の onTranscript を通るが、そこでは
  //  viewer は handleTranscript（scheduler 内で no-op）+ 放送除外（viewer 分岐）で無害化済み。発火は
  //  handleChatMessage だけ・放送はこの経路だけが担う。
  //
  //  バッファ生存の裁定（v0・§質問で escalate）: 転写バッファは耳パイプライン所有（遅延起動）。耳が
  //  未起動ならバッファが無い。その場合は**合流先が無い**ので append/scheduler をスキップし、ゴースト行の
  //  診断（chatBufferAbsent）だけ出す（バッファ無しで発火しても会話ログにコメントが載らず盲目発火に
  //  なるため scheduler も回さない）。バッファ所有権の巻き上げ（耳非依存化）は S1〜S6 挙動・器不変を
  //  脅かしうる構造変更ゆえ v0 では実装せず domain-b.md §質問で escalate する。

  /**
   * チャット器官の 1 コメントを取り込む（Domain C の onMessage フックから呼ぶ attach 点）。best-effort
   * （throw は握って診断に落とす・器官の常駐を殺さない）。
   * @param {{ text?: string; displayName?: string } | null} msg
   */
  function ingestChatMessage(msg) {
    if (closed) return;
    try {
      const text = msg && typeof msg.text === "string" ? msg.text : "";
      const displayName = msg && typeof msg.displayName === "string" ? msg.displayName : undefined;
      if (text.trim().length === 0) return; // 空コメントは捨てる（バッファも捨てる・二度手間を避ける）。
      const buffer = pipeline ? pipeline.transcriptBuffer : null;
      if (!buffer) {
        // 耳未起動 = 合流先の正本バッファが無い。UI にゴースト行を出し、append/scheduler はスキップ。
        handleDiagnostic({
          type: "chatBufferAbsent",
          message: "ears not running; viewer comment cannot merge into transcript buffer (no fire).",
          reason: displayName ?? null
        });
        return;
      }
      const result = buffer.append({ startMs: 0, endMs: 0, text, speaker: "viewer", displayName });
      if (!result.appended || !result.entry) return; // blank discard 等。
      // (b) viewer 行を放送（耳の onTranscript は viewer を除外＝ここが唯一の放送元）。
      const stats = buffer.stats();
      broadcast("transcript", {
        ...toWireEntry(result.entry),
        latencyMs: null,
        audioCtx: null,
        appended: stats.appended,
        discarded: stats.discarded
      });
      // (c) 発火スケジューラへ（comment / comment-call 判定）。scheduler 未生成なら活動反映もスキップ。
      if (fireScheduler) fireScheduler.handleChatMessage({ text, displayName });
    } catch (error) {
      handleDiagnostic({ type: "chatIngestError", message: errMessage(error) });
    }
  }

  /**
   * チャット器官の状態遷移を SSE "chatStatus" に載せる口（Domain C の onStatus フックから呼ぶ）。
   * 状態表示（connecting/live/retrying/dead）は Domain C が描く。
   * @param {string} status
   */
  function broadcastChatStatus(status) {
    if (closed) return;
    broadcast("chatStatus", { status: typeof status === "string" ? status : String(status) });
  }

  /**
   * チャット器官の診断を SSE "chatDiagnostic" に載せる口（Domain C の onDiagnostic フックから呼ぶ）。
   * 取得死/抽出失敗のゴースト行は Domain C が描く。診断オブジェクトはそのまま透過（token 等は器官側で
   * 載せない前提・Domain A は URL/token を診断に含めない）。
   * @param {any} info
   */
  function broadcastChatDiagnostic(info) {
    if (closed) return;
    broadcast("chatDiagnostic", {
      kind: info?.kind ?? null,
      message: info?.message ?? null,
      atMs: info?.atMs ?? null,
      delayMs: info?.delayMs ?? null,
      attempt: info?.attempt ?? null
    });
  }

  /**
   * 稼働中のチャット器官を畳む（フック購読解除 + stop()・冪等）。器官は dead へ落ち、以後の自動
   * 再接続タイマを残さない（Domain A の stop() 契約）。connect の作り直し・disconnect・close で使う。
   */
  function foldChatClient() {
    for (const unsub of chatUnsubs) {
      try {
        unsub();
      } catch {
        // best-effort（購読解除の失敗で畳みを止めない）。
      }
    }
    chatUnsubs = [];
    if (chatClient) {
      const c = chatClient;
      chatClient = null;
      try {
        c.stop();
      } catch {
        // best-effort（既に dead でも冪等）。
      }
    }
  }

  /**
   * チャット器官を生成して Connect する（POST /api/chat/connect の実体・ear-pipeline の遅延起動の流儀）。
   * 既存器官があれば先に畳んでから**新しい source で作り直す**（ended で dead に落ちた器官の restart は
   * 無い＝Connect 再操作で新器官を生成する・Domain A §7-2）。onMessage→ingestChatMessage /
   * onStatus→broadcastChatStatus / onDiagnostic→broadcastChatDiagnostic を繋ぐ（器官の外から hooks
   * 経由・逆方向 import を作らない）。start() は bootstrap + 初回 poll を await する（notLive/network は
   * 内部で retrying をスケジュールして即 return するので、ここで無限に待たされない・Domain A）。
   * @param {string} source  配信 URL / video ID / チャンネル `/live` URL。
   * @returns {Promise<void>}
   */
  async function connectChat(source) {
    foldChatClient(); // 作り直し: 既存器官を畳んでから新規生成（同一インスタンス restart は無い）。
    const client = /** @type {any} */ (chatClientFactory)({ source });
    chatClient = client;
    // フックを取り込み経路へ結線（購読解除は畳み時に全撤去）。器官のフック throw は器官側が握る（Domain A）。
    chatUnsubs.push(
      client.onMessage((/** @type {any} */ msg) =>
        ingestChatMessage({ text: msg && msg.text, displayName: msg && msg.displayName })
      )
    );
    chatUnsubs.push(client.onStatus((/** @type {any} */ state) => broadcastChatStatus(state)));
    chatUnsubs.push(client.onDiagnostic((/** @type {any} */ info) => broadcastChatDiagnostic(info)));
    // 永続化（次回起動で入力欄に復元・失敗寛容）。source は YouTube 公開 URL/ID＝token を含まない。
    if (typeof onSetChatSource === "function") {
      try {
        await onSetChatSource(source);
      } catch {
        // 永続化失敗は Connect を止めない（onSetChannelUrl と同型の失敗寛容）。
      }
    }
    await client.start();
  }

  // ── ライフサイクル ─────────────────────────────────────────────────

  return {
    listen(port = defaultPort) {
      return new Promise((resolve, reject) => {
        const onError = (/** @type {Error} */ err) => reject(err);
        server.once("error", onError);
        server.listen(port, host, () => {
          const address = server.address();
          boundPort = typeof address === "object" && address ? address.port : 0;
          server.removeListener("error", onError);
          resolve(`http://${host}:${boundPort}`);
        });
      });
    },
    url() {
      return `http://${host}:${boundPort}`;
    },
    isListening: () => server.listening,
    earsStatus: () => earsState,
    /** 発火状態（idle/thinking/speaking）。orchestrator 未注入なら null。 */
    fireState: () => (fireOrchestrator ? fireOrchestrator.getState() : null),
    /**
     * 自発発火の ON/OFF を切り替える（S6・Domain D の永続トグルが呼ぶ継ぎ目）。scheduler 未生成
     * （orchestrator 未注入）なら no-op。返り値は反映後の enabled（scheduler 無しは false）。
     * @param {boolean} enabled
     */
    setSelfFireEnabled(enabled) {
      if (fireScheduler) fireScheduler.setEnabled(enabled === true);
      return fireScheduler ? fireScheduler.isEnabled() : false;
    },
    /** 自発発火の現況（enabled）。scheduler 未生成なら null。 */
    selfFireStatus: () => (fireScheduler ? { enabled: fireScheduler.isEnabled() } : null),
    /** barge-in トグルの現況（enabled）。gate 未生成なら null（selfFireStatus と同型）。 */
    bargeInStatus: () => (bargeInGate ? { enabled: bargeInGate.isEnabled() } : null),
    /**
     * 配信間記憶: 転写の全量スナップショット（cockpit.mjs のチェックポイント/手動記録/shutdown 最終版が
     * ライブ転写を読む口・additive な内部 JS API=HTTP/SSE のワイヤ契約ではない）。pipeline 未生成
     * （耳が一度も start していない）なら空配列。transcriptBuffer.all() は防御的コピーを返す
     * （ears/transcript-buffer.mjs）ので呼び出し側が書き換えても正本は壊れない。
     * @returns {Array<any>}
     */
    getTranscript: () => (pipeline ? pipeline.transcriptBuffer.all() : []),
    // ── S7「視聴者が混ざる」: チャット器官の取り込み経路（Domain C の attach 点）───────────────
    /** チャット器官の 1 コメントを取り込む（append + SSE viewer 行放送 + scheduler.handleChatMessage）。 */
    ingestChatMessage,
    /** チャット器官の状態遷移を SSE "chatStatus" へ載せる口。 */
    broadcastChatStatus,
    /** チャット器官の診断を SSE "chatDiagnostic" へ載せる口。 */
    broadcastChatDiagnostic,
    /**
     * 全畳み（冪等）: 全 SSE 応答を end → orchestrator.dispose → pipeline.dispose → http server close。
     * リークするタイマ/ハンドル/子プロセスを残さない。
     */
    async close() {
      if (closed) return;
      closed = true;
      // S7: 稼働中のチャット器官も畳む（stop()+購読解除・タイマ/プロセスを残さない）。
      foldChatClient();
      if (bargeInGate) {
        try {
          bargeInGate.dispose();
        } catch {
          // best-effort
        }
        bargeInGate = null;
      }
      if (fireScheduler) {
        try {
          fireScheduler.dispose();
        } catch {
          // best-effort
        }
        fireScheduler = null;
      }
      if (fireOrchestrator) {
        try {
          fireOrchestrator.dispose();
        } catch {
          // best-effort
        }
      }
      for (const res of sseClients) {
        try {
          res.end();
        } catch {
          // best-effort
        }
      }
      sseClients.clear();
      if (discardUnsub) {
        discardUnsub();
        discardUnsub = null;
      }
      if (pipeline) {
        const p = pipeline;
        pipeline = null;
        try {
          await p.dispose();
        } catch {
          // best-effort
        }
      }
      earsState = "stopped";
      startedAtMs = null;
      await new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve(undefined));
      });
    }
  };
}

// ── HTTP レスポンスヘルパ ─────────────────────────────────────────────

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {unknown} obj
 */
function sendJson(res, status, obj) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(obj);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {number} status
 * @param {string} text
 */
function sendText(res, status, text) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, { "content-type": "text/plain; charset=utf-8" });
  res.end(text);
}

/**
 * POST の body を JSON として読む（非 JSON / 空は {} にフォールバック・上限 1MiB）。
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<Record<string, any>>}
 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    let aborted = false;
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        aborted = true;
        req.destroy();
        resolve({});
      }
    });
    req.on("end", () => {
      if (aborted) return;
      if (data.length === 0) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(data);
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/**
 * Read a JSON object while preserving malformed-body information for strict APIs.
 * Existing routes intentionally use readJsonBody()'s permissive `{}` fallback; the conversation-instruction
 * API uses this helper so malformed JSON is rejected without changing those endpoint contracts.
 * @param {import("node:http").IncomingMessage} req
 * @returns {Promise<{ ok: true; value: Record<string, any> } | { ok: false }>}
 */
function readJsonBodyStrict(req) {
  return new Promise((resolve) => {
    let data = "";
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      resolve({ ok: false });
    };
    req.on("data", (chunk) => {
      if (settled) return;
      data += chunk;
      if (data.length > 1_000_000) {
        try {
          req.destroy();
        } catch {
          // best-effort
        }
        fail();
      }
    });
    req.on("end", () => {
      if (settled) return;
      try {
        const parsed = JSON.parse(data);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          fail();
          return;
        }
        settled = true;
        resolve({ ok: true, value: parsed });
      } catch {
        fail();
      }
    });
    req.on("error", fail);
  });
}

/** @param {unknown} err */
function errMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
