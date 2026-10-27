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
 * ── 操縦席の作り直し 1 回目: 画面へ届けるデータ（cockpit-glance-redesign.md §9）──────────────────
 *  画面そのものは 2 回目。ここでは画面が使うデータを SSE / snapshot まで届ける（既存の SSE と画面は壊さない）:
 *   - 発火番号ときっかけ: 発火ごとに `fire({ cause })` できっかけを渡し、orchestrator が振る fireId を
 *     SSE "fire"（受理）・"fireAsk"・"transcript"（soul 行）・"latency"・"selfFire"（発火結果）に載せる。
 *     判定の行（selfFire の speak-now-judgment / comment-judgment）には、きっかけの seq と行き先（action）を載せる。
 *   - 推論の範囲: SSE "fireAsk"（ask の時点の会話の窓の始まりと終わりの seq・復元しない）。
 *   - 遅延: SSE "latency"（1 返事 1 レコード・区間と合計と区分）。しきい値は snapshot の latencyThresholds。
 *   - 残量: snapshot の quota と SSE "quota"（Codex / ElevenLabs の残りの割合とリセット時刻・不明は null）。
 *   - 警告: snapshot の warnings と SSE "warnings"（状態で決まるもの・60 秒で消える出来事・./warnings.mjs）。
 *   - 圧縮中: snapshot の compacting（頭の会話の圧縮の最中だけ true・状態のピルの「圧縮中」）。started で true、
 *     finished / failed / 頭の作り直し（resetContextCompaction）で false。変わったら SSE "state" で押す。
 *   - 圧縮の目安: snapshot の compaction（`{ thresholdTokens }` = 圧縮を始める大きさ・直近の入力トークン）。
 *     POST /api/compact-threshold で変え（設定の「頭脳・会話」タブ）、onSetCompactThresholdTokens が保存と走っている
 *     compactor の差し替えを担う（cockpit.mjs）。
 *
 * ── 思い出す流れ（記憶の作り直し Wave 3 Domain D）──────────────────────────────────
 *  orchestrator の onRecallRequest（①の返事の中の `<recall 頼みごと>`）を思い出しの係（../mind/recall-desk.mjs）へ
 *  渡す。係は④（options.recallRunner・cockpit.mjs が Codex の使い捨てセッションで走らせる）→「避けるか」判定
 *  （options.recallJudge・既定は Decisions API）→ ①の発火（selfFire kind:"recall"）/ 黙って前置き（orchestrator の
 *  deferInstruction）を受け持つ。係の出来事は SSE "selfFire" の kind:"recall-step"（{ phase, request, … }・頼みごとは
 *  画面のログにだけ出す）と
 *  onRecallEvent（cockpit.mjs のターミナル 1 行・頼みごとは渡さない）へ。判定の失敗は judge-error の警告（source
 *  "recall"）、④の失敗は recall-error の警告（一回きりの出来事）で、そのうえ「見つからなかった」と同じ扱いで①へ届ける。
 *  自発の発火が OFF のときは結果をしゃべらせず黙って前置きで渡す（Wave 3 仕上げ）。recallRunner が無ければ係は作らない
 *  （目印は捨てる）。
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

import { createEarPipeline, STT_ENGINES } from "../ears/ear-pipeline.mjs";
import { loadElevenLabsApiKey } from "../ears/elevenlabs-stt.mjs";
// ローカルの文字起こしの語彙とモデルの存在確認だけ（sherpa-onnx-node は子プロセスだけが読む）。
import { isLocalSttEngine, checkLocalSttModel, LOCAL_STT_ENGINE_TITLES } from "../ears/local-stt/local-stt-engines.mjs";
import { resolveFfmpegPath } from "../ears/ffmpeg-capture.mjs";
import { normalizeDevice } from "../cli/ears-cli.mjs";
import { listWindows as defaultListWindows } from "../eyes/window-list.mjs";
import { listAudioDevices as defaultListAudioDevices } from "../voice/audio-devices.mjs";
import { createBargeInGate } from "../mind/barge-in.mjs";
import { createFireScheduler } from "../mind/fire-scheduler.mjs";
import {
  createSpeakNowController,
  SPEAK_NOW_BACKCHANNEL_INSTRUCTION,
  SPEAK_NOW_BACKCHANNEL_MIN_INTERVAL_MS
} from "../mind/speak-now.mjs";
import { createDecisionsJudge, createDecisionsQuestionsJudge, loadDecisionsApiKey } from "../mind/speak-now-decisions.mjs";
import { createCommentGuard, COMMENT_JUDGE_TIMEOUT_MS } from "../mind/comment-guard.mjs";
import {
  createCommentReactController,
  buildCommentReactFireInstruction,
  COMMENT_BUSY_POLICIES,
  DEFAULT_COMMENT_BUSY_POLICY,
  COMMENT_HOLD_MAX_AGE_MS,
  COMMENT_HOLD_MAX_COUNT
} from "../mind/comment-react.mjs";
import { CONVERSATION_INSTRUCTION_BRAIN_IDS } from "../mind/fire-orchestrator.mjs";
import { createRecallDesk } from "../mind/recall-desk.mjs";
import { RECALL_JUDGE_TIMEOUT_MS } from "../mind/recall.mjs";
import { composeReplyLatency, resolveLatencyThresholds } from "../mind/fire-latency.mjs";
import {
  createWarningBoard,
  isCreditExhaustedError,
  quotaLowWarning,
  WARNING_EVENT_TTL_MS
} from "./warnings.mjs";
import { resolveBrainIdentity } from "../mind/brains.mjs";
import { resolveModelIdentity } from "../mind/model-identity.mjs";
import { normalizeCompactThresholdTokens } from "../mind/context-compactor.mjs";

/** コクピット既定 host（loopback 束縛・外に開かない）。 */
export const DEFAULT_COCKPIT_HOST = "127.0.0.1";
/** コクピット既定ポート（whisper 8178 / AivisSpeech 10101 / editor 5173 系と離す）。 */
export const DEFAULT_COCKPIT_PORT = 8181;
/** 状態スナップショットに載せる直近転写の件数（タブ開き直し時の復元用）。 */
export const DEFAULT_TRANSCRIPT_HISTORY = 200;
/** 声の方式（POST /api/ears/start の body `ttsEngine`・設定キー `ttsEngine` と同じ語彙・声の差し替え Wave 3）。 */
export const TTS_ENGINES = Object.freeze(["aivis", "elevenlabs"]);
/** 声の engine の状態の語彙（VoiceEngine の status と同じ + まだ知らない unknown）。 */
const VOICE_STATUSES = Object.freeze(["unknown", "connecting", "up", "reconnecting", "down"]);
/** 声の状態の理由（警告 tts-reconnecting / tts-down の detail）の上限字数。キーの置き場所を示す Start 失敗の理由が収まる長さ。 */
const VOICE_REASON_MAX_CHARS = 160;

/**
 * 声の状態の理由を表示用に整える（制御文字を除き・空なら null・長ければ切る）。
 * @param {unknown} reason
 * @returns {string | null}
 */
function clipVoiceReason(reason) {
  if (typeof reason !== "string") return null;
  const text = reason.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  if (text.length === 0) return null;
  return text.length > VOICE_REASON_MAX_CHARS ? `${text.slice(0, VOICE_REASON_MAX_CHARS - 1)}…` : text;
}

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
 *   onAsk: (info: object) => void;
 *   onLatency: (info: object) => void;
 *   onRecallRequest: (info: { request: string; fireId: number | null }) => void;
 *   initialKilled: boolean;
 * }) => { fire: (fireOptions?: object) => Promise<object>; getState: () => string; dispose: () => void;
 *   kill?: (atMs?: number) => Promise<object>; revive?: () => void; getKilled?: () => boolean;
 *   deferInstruction?: (text: string) => boolean }} [options.fireOrchestratorFactory]
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
 *   **操縦席の作り直し 1 回目**: onAsk（推論の範囲）は SSE "fireAsk"、onLatency（発火の中の遅延）は文字起こし・判定の
 *   区間を足して SSE "latency" へ。fire() には `{ cause }`（きっかけ）を渡す。
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
 *   getSoulSkills?: () => ReadonlyArray<{ name: string; path: string; body: string }>;
 * }} [options.conversationInstructionHooks]
 *   Dedicated local API hooks for the effective per-brain conversation-instruction body. The hook owns
 *   durable persistence and increments its revision only after a successful write; the server exposes the
 *   body only through /api/conversation-instructions/:brainId.
 *   getSoulSkills（任意・記憶の作り直し Wave 3 仕上げ）: 魂が①の固定の指示にいつも足す教え（skills/）の名前・置き場・
 *   本文。同じ API の応答に soulSkills として載せ、会話指示の編集画面が読むだけで見せる（編集の口は無い）。
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
 * @param {() => (Promise<void> | void)} [options.onMemoryRecord]
 *   手動「今日を記録」フック（POST /api/memory-record が呼ぶ）。**cockpit-server は記憶の書き出し/保存を
 *   知らない**（実体は cockpit.mjs の保存の係・ライブ転写取得含め呼び出し側の責務）。フックの
 *   throw は 500 にせず握って続行する（記録失敗で操作を止めない・failure-tolerant）。未注入なら
 *   POST /api/memory-record は 503。記憶の ON/OFF（POST /api/memory）は撤去した（記憶の作り直し Wave 2・全部残す）。
 * @param {() => (object | null)} [options.memoryStatus]
 *   記憶の現況（`{ lastRecordAtMs: number | null, recording: boolean }`）を返す。
 *   state snapshot の `memory` に載せる（brainStatus/audioDeviceStatus と同型）。未注入なら
 *   snapshot の memory:null。変わったら呼び出し側が `memoryStatusChanged()` で知らせる。
 * @param {(transcript: Array<any>) => void} [options.onEarsStopping]
 *   耳の Stop で、pipeline を畳む**前**に、その時点の全量転写（transcriptBuffer.all() のコピー）を渡す口
 *   （記憶の作り直し Wave 2: 耳の Stop でも記録する）。待たない・throw は握る。耳が起動していなければ呼ばない。
 *   close() 経由では呼ばない（Ctrl+C の最後の保存は cockpit.mjs が close の前に転写を取る）。
 * @param {(tokens: number) => void | Promise<void>} [options.onSetCompactThresholdTokens]
 *   圧縮を始める大きさ（直近の入力トークン・整数で 5 万〜45 万）の変更フック（POST /api/compact-threshold が呼ぶ・
 *   onSetBargeInEnabled と同型）。**cockpit-server は圧縮の実体を知らない**（実体は cockpit.mjs が settings 永続 +
 *   走っている compactor の setThresholdTokens で担う＝次の確認から効く）。未注入なら POST /api/compact-threshold は 503。
 * @param {() => ({ thresholdTokens: number } | null)} [options.contextCompactionStatus]
 *   圧縮の目安の現況（`{ thresholdTokens }`）を返す。state snapshot の `compaction` に載せる（memoryStatus と同型・
 *   未注入なら null）。
 * @param {(enabled: boolean) => void | Promise<void>} [options.onSetCodexFastMode]
 *   ①チャッピーの Codex の頭の fast（service tier "priority"）の ON/OFF の変更フック（POST /api/codex-fast が呼ぶ・
 *   onSetCompactThresholdTokens と同型）。**cockpit-server は fast の実体を知らない**（実体は cockpit.mjs が settings
 *   永続 + 次の受理の configuration に載せる＝次の返事から効く）。未注入なら POST /api/codex-fast は 503。
 * @param {() => ({ enabled: boolean; applicable: boolean; supported: boolean | null } | null)} [options.codexFastStatus]
 *   fast の現況（enabled = 設定・applicable = 今の頭が Codex か・supported = 今の頭のモデルが priority を持つか
 *   （まだ確かめていなければ null））。state snapshot の `codexFast` に載せる（未注入なら null）。変わったら
 *   呼び出し側が `codexFastStatusChanged()` で知らせる。
 * @param {(engine: "parakeet" | "zipformer") => ({ ok: true } | { ok: false; reason: string })} [options.localSttModelCheck]
 *   ローカルの文字起こし（parakeet / zipformer）のモデルが揃っているか（既定 checkLocalSttModel = vendor/models を
 *   見る）。Start ごとに呼び、揃っていなければ耳を開かずに Start を失敗にする（ElevenLabs のキー切れと同じ流儀）。
 * @param {(() => object | null) | object} [options.localSttSettings]
 *   ローカルの文字起こしの設定（{ threads, preRollMs, silencePadMs, hotwords, hotwordsScore }・範囲外は既定）。関数なら Start ごとに
 *   読む（設定ファイルの書き換えが次の Start から効く）。pipeline の stt.local へそのまま渡す。
 * @param {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} [options.sttEngineInitial="whisper"]
 *   文字起こしの方式の初期選択（操縦席の文字起こし選択・cockpit-stt-selection.md）。起動時の値は
 *   呼び出し側（cockpit.mjs）が settings から読んでここへ渡す（selfFireInitialEnabled と同型）。
 *   選択は POST /api/ears/start の body `sttEngine` で受け、Start ごとに onSetSttEngine で永続化する
 *   （マイクと同じく [Start] の前に選ぶ・動作中に変えるなら Stop→Start）。
 * @param {(engine: string) => void | Promise<void>} [options.onSetSttEngine]
 *   文字起こしの方式の永続化フック（Start 時に呼ぶ・失敗寛容）。**cockpit-server は永続化実体を知らない**。
 * @param {() => ({ ok: true; apiKey: string } | { ok: false; reason: string })} [options.elevenLabsApiKeyProvider]
 *   ElevenLabs のキーを返す（既定 loadElevenLabsApiKey = `apps/soul/agent/.env.elevenlabs.local` を
 *   コード内で直接読む・process.env に入れない）。Start ごとに読む。キーは pipeline へ渡すだけで、
 *   state/SSE/ログ/エラーには載せない。
 * @param {"aivis" | "elevenlabs"} [options.ttsEngineInitial="aivis"]
 *   声の方式の初期選択（声の差し替え Wave 3 Domain E・voice-swap-wave-plan.md §3）。sttEngineInitial の写経:
 *   起動時の値は cockpit.mjs が settings から読んで渡す（未知値は aivis）。選択は POST /api/ears/start の body
 *   `ttsEngine` で受け、Start ごとに onSetTtsEngine で永続化する（効くのは次の Start から）。
 * @param {(engine: string) => void | Promise<void>} [options.onSetTtsEngine]
 *   声の方式の永続化フック（Start 時に呼ぶ・失敗寛容）。**cockpit-server は永続化実体を知らない**。
 * @param {(engine: "aivis" | "elevenlabs") => ({ ok: boolean; reason?: string } | Promise<{ ok: boolean; reason?: string }>)} [options.onPrepareVoiceEngine]
 *   耳の Start で声の engine を用意する口（cockpit.mjs が engine の作成・作り直し・ElevenLabs のキーの読み込みを
 *   担う。**cockpit-server は engine の実体もキーも知らない**）。耳を開く前に呼び、`ok:false` なら Start を失敗に
 *   する（理由は STT のキー切れと同じく Start の応答とエラー欄へ。理由にキーは含めない前提）。未注入なら呼ばない。
 *   engine の状態は cockpit.mjs が `setVoiceEngineStatus` で知らせる。
 * @param {(info: { engine: string; latencyMs: number | null }) => void} [options.onSttLatency]
 *   you の転写 1 件ごとの遅延（数字のみ・本文は渡さない）。cockpit.mjs が標準出力に 1 行書く
 *   （画面の行の横の遅延表示は出さない方針・合意 §4.2）。
 * @param {() => void} [options.onEarsStarted]
 *   耳の Start が成功したときに呼ぶ（画面キャプチャの撮る係を立ち上げる口・
 *   discussion/ai-cohost/research/vision-capture-latency-2026-10.md §4 の 2）。待たない・失敗しても耳は止めない。
 * @param {() => void} [options.onEarsStopped]
 *   耳の Stop と close() のときに呼ぶ（撮る係を止める口）。冪等な実装を渡す前提（耳が起動していなくても呼ぶ）。
 * @param {"classic" | "speak-now"} [options.speakStartModeInitial="classic"]
 *   話し始めの方式（speak-now 合意 §5 の「話し始め: 従来 / speak-now」）の初期値。サーバ単体の既定は
 *   "classic"（従来・無退行）で、操縦席の初回既定 speak-now は呼び出し側（cockpit.mjs の settings 橋渡し）が
 *   決める（selfFireInitialEnabled と同型）。"speak-now" の間は fireScheduler の turn-end / call /
 *   interjection を止め、you の転写ごとに speak-now の判定を回す（src/mind/speak-now.mjs）。
 *   scheduler が無ければ意味を持たない。
 * @param {(mode: string) => void | Promise<void>} [options.onSetSpeakStartMode]
 *   話し始めの方式の永続化フック（POST /api/speak-start が呼ぶ・onSetVerbosity と同型の失敗寛容）。
 * @param {(request: { input: string; instructions: string; choices: ReadonlyArray<{ value: string; description: string }> }) =>
 *   Promise<{ choice: string; probs?: Record<string, number>; latencyMs?: number }>} [options.speakNowJudge]
 *   speak-now の判定エンジン（テスト注入用）。既定は Decisions API 実装（createDecisionsJudge・キーは
 *   decisionsApiKeyProvider で判定ごとに読む・タイムアウト 3 秒）。
 * @param {() => ({ ok: true; apiKey: string } | { ok: false; reason: string })} [options.decisionsApiKeyProvider]
 *   Decisions API のキーの読み口（既定 loadDecisionsApiKey = `.env.decisions.local` を直接読む・
 *   process.env に入れない）。キーは state/SSE/ログ/エラーに載せない。
 * @param {(info: object) => void} [options.onSpeakNowJudgment]
 *   判定ごとの記録（遅延・選択・確率・行き先 or 失敗理由。会話の本文は渡さない）。cockpit.mjs が標準出力に
 *   1 行書く（合意 §5）。
 * @param {number} [options.backchannelMinIntervalMs=SPEAK_NOW_BACKCHANNEL_MIN_INTERVAL_MS]
 *   相槌どうしの最小間隔（前の相槌を喋り始めてから次の相槌を喋らせない時間・既定 8 秒・
 *   discussion/ai-cohost/decisions/speak-now/backchannel.md §2）。0 なら歯止めなし。cockpit.mjs が settings の
 *   `backchannelMinIntervalSec` から渡す（commentHoldMaxAgeMs と同型）。
 * @param {(comment: { text: string; displayName: string | null; name: string }) =>
 *   (import("../mind/comment-guard.mjs").CommentGuardDecision | Promise<import("../mind/comment-guard.mjs").CommentGuardDecision>)} [options.commentGuard]
 *   コメントの弾く判定（discussion/ai-cohost/decisions/comment-react/integration.md §1-3）。既定は Decisions API
 *   実装（createCommentGuard・タイムアウト 5 秒・キーは decisionsApiKeyProvider で判定ごとに読む）。**全モード**
 *   （KILL 中・自発 OFF・従来モードも）で、通ったコメントだけを転写バッファに積む。テスト注入用に同期で
 *   `{ pass, kind }` を返してもよい（そのときは従来どおり同期で追記・放送する）。
 * @param {(request: { input: string; instructions: string; choices: ReadonlyArray<{ value: string; description: string }> }) =>
 *   Promise<{ choice: string; probs?: Record<string, number>; latencyMs?: number }>} [options.commentReactJudge]
 *   コメントの反応する判定（合意 §1-6・speak-now モードの間だけ）。既定は Decisions API 実装（createDecisionsJudge・
 *   タイムアウト 5 秒）。
 * @param {"hold" | "drop"} [options.commentBusyPolicyInitial="hold"]
 *   忙しい間に届いたコメントの扱い（"hold" = あとで拾う・既定 / "drop" = 見逃す・合意 §2）の初期値。
 * @param {(policy: string) => void | Promise<void>} [options.onSetCommentBusyPolicy]
 *   その永続化フック（POST /api/comment-busy が呼ぶ・onSetSpeakStartMode と同型の失敗寛容）。
 * @param {number} [options.commentHoldMaxAgeMs=COMMENT_HOLD_MAX_AGE_MS]  あとで拾う: 届いてから捨てるまで（約 20 秒）。
 * @param {number} [options.commentHoldMaxCount=COMMENT_HOLD_MAX_COUNT]  あとで拾う: まとめる件数（新しい方から 3 件）。
 * @param {(info: object) => void} [options.onCommentJudgment]
 *   コメント判定ごとの記録（弾く判定・反応する判定。遅延・結果・コメント ID。コメント本文は渡さない）。
 *   cockpit.mjs が標準出力に 1 行書く（合意 §3）。
 * @param {{ warnSec?: number; alertSec?: number }} [options.latencyThresholds]
 *   返事の遅延の合計の「遅い」しきい値（秒・既定 4 / 6・cockpit-glance-redesign.md §9.1）。cockpit.mjs が settings の
 *   `latencyWarnSec` / `latencyAlertSec` から渡す。snapshot の latencyThresholds に載せ、latency の level に使う。
 * @param {{ snapshot: () => any; onChange: (fn: (snapshot: any) => void) => (() => void) }} [options.quotaSource]
 *   残量の正本（./quota.mjs の createQuotaMonitor）。snapshot の quota に載せ、変わったら SSE "quota" と警告を更新する。
 *   未注入なら quota:null。
 * @param {(record: object) => void} [options.onReplyLatency]  1 返事の遅延レコード（数字ときっかけの種類だけ・本文なし）。
 *   cockpit.mjs が標準出力に 1 行書く。
 * @param {number} [options.warningEventTtlMs=WARNING_EVENT_TTL_MS]  一回きりの警告が消えるまで（テスト注入用）。
 * @param {(job: { request: string; entries: ReadonlyArray<any>; nowMs: number }) => Promise<{ found: boolean; summary: string }>} [options.recallRunner]
 *   ④思い出し役を 1 回走らせる口（記憶の作り直し Wave 3・cockpit.mjs が recall.mjs の runRecall を Codex の頭で渡す）。
 *   未注入なら思い出しの係を作らない（①の目印は捨てる）。
 * @param {(request: { input: string; questions: ReadonlyArray<any> }) => Promise<{ answers: Record<string, any>; latencyMs?: number }>} [options.recallJudge]
 *   「避けるか」判定（テスト注入用）。既定は Decisions API（createDecisionsQuestionsJudge・タイムアウト 5 秒・キーは
 *   decisionsApiKeyProvider で判定ごとに読む）。
 * @param {(event: { phase: string; atMs: number; avoidProbability?: number | null; judgeFailed?: boolean; reason?: string | null; silent?: boolean; failed?: boolean }) => void} [options.onRecallEvent]
 *   思い出しの係の出来事（頼みごとは含めない）。cockpit.mjs がターミナルに 1 行書く。
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
 *   ingestChatMessage: (msg: { text?: string; displayName?: string; messageId?: string | null } | null) => void;
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
  const onMemoryRecord = options.onMemoryRecord;
  const memoryStatusImpl = options.memoryStatus;
  // 圧縮の目安（圧縮を始める大きさ）: 変更フック + 現況（未注入ならそれぞれ 503/null・memory と同型）。
  // 目安の正本は cockpit.mjs の compactor（サーバは二重に持たない）。
  const onSetCompactThresholdTokens = options.onSetCompactThresholdTokens;
  const contextCompactionStatusImpl = options.contextCompactionStatus;
  // Codex の fast（①の速さの段）: 変更フック + 現況（未注入ならそれぞれ 503/null・圧縮の目安と同型）。
  // 設定の正本は cockpit.mjs（サーバは二重に持たない）。
  const onSetCodexFastMode = options.onSetCodexFastMode;
  const codexFastStatusImpl = options.codexFastStatus;
  // 操縦席の文字起こし選択: 現在の選択（Start のたびに更新・耳が動いている間は使用中の方式）・
  // 永続化フック・ElevenLabs キーの読み口・遅延ログの口。
  /** @type {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} */
  let sttEngine = STT_ENGINES.includes(/** @type {any} */ (options.sttEngineInitial))
    ? /** @type {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} */ (options.sttEngineInitial)
    : "whisper";
  const localSttModelCheck =
    typeof options.localSttModelCheck === "function" ? options.localSttModelCheck : (engine) => checkLocalSttModel(engine);
  const localSttSettingsProvider =
    typeof options.localSttSettings === "function"
      ? options.localSttSettings
      : () => (options.localSttSettings && typeof options.localSttSettings === "object" ? options.localSttSettings : null);
  const onSetSttEngine = typeof options.onSetSttEngine === "function" ? options.onSetSttEngine : null;
  const elevenLabsApiKeyProvider =
    typeof options.elevenLabsApiKeyProvider === "function" ? options.elevenLabsApiKeyProvider : () => loadElevenLabsApiKey();
  const onSttLatency = typeof options.onSttLatency === "function" ? options.onSttLatency : null;
  // 声の方式の選択（声の差し替え Wave 3 Domain E）: 現在の選択（Start のたびに更新）・永続化フック・engine を
  // 用意する口。engine の状態（connecting / up / reconnecting / down）は cockpit.mjs から setVoiceEngineStatus で届く。
  /** @type {"aivis" | "elevenlabs"} */
  let ttsEngine = TTS_ENGINES.includes(/** @type {any} */ (options.ttsEngineInitial))
    ? /** @type {"aivis" | "elevenlabs"} */ (options.ttsEngineInitial)
    : "aivis";
  const onSetTtsEngine = typeof options.onSetTtsEngine === "function" ? options.onSetTtsEngine : null;
  const onPrepareVoiceEngine = typeof options.onPrepareVoiceEngine === "function" ? options.onPrepareVoiceEngine : null;
  /**
   * 今の声の engine の状態（engine = 状態を知らせた engine の種類・まだ無ければ null）。
   * @type {{ engine: string | null; status: "unknown" | "connecting" | "up" | "reconnecting" | "down"; reason: string | null }}
   */
  const voice = { engine: null, status: "unknown", reason: null };
  // 画面キャプチャの撮る係の寿命を耳の Start / Stop に合わせる口（vision-capture-latency §4 の 2）。
  const onEarsStarted = typeof options.onEarsStarted === "function" ? options.onEarsStarted : null;
  const onEarsStopped = typeof options.onEarsStopped === "function" ? options.onEarsStopped : null;
  // 耳の Stop で pipeline を畳む前の転写を渡す口（記憶の作り直し Wave 2・耳の Stop でも記録する）。
  const onEarsStopping = typeof options.onEarsStopping === "function" ? options.onEarsStopping : null;
  /** @param {(() => void) | null} hook */
  const callEarsHook = (hook) => {
    if (!hook) return;
    try {
      hook();
    } catch {
      // 撮る係の起動/停止の失敗で耳の操作を止めない（撮影は毎回起動に戻るだけ）。
    }
  };
  // speak-now（話し始めの判定・discussion/ai-cohost/decisions/speak-now/integration.md）: 方式の現在値・
  // 永続化フック・判定エンジン・判定ログの口。
  /** @type {"classic" | "speak-now"} */
  let speakStartMode = options.speakStartModeInitial === "speak-now" ? "speak-now" : "classic";
  const onSetSpeakStartMode = typeof options.onSetSpeakStartMode === "function" ? options.onSetSpeakStartMode : null;
  const speakNowJudge =
    typeof options.speakNowJudge === "function"
      ? options.speakNowJudge
      : createDecisionsJudge({
          apiKeyProvider:
            typeof options.decisionsApiKeyProvider === "function" ? options.decisionsApiKeyProvider : () => loadDecisionsApiKey()
        });
  const onSpeakNowJudgment = typeof options.onSpeakNowJudgment === "function" ? options.onSpeakNowJudgment : null;
  const backchannelMinIntervalMs =
    typeof options.backchannelMinIntervalMs === "number" &&
    Number.isFinite(options.backchannelMinIntervalMs) &&
    options.backchannelMinIntervalMs >= 0
      ? options.backchannelMinIntervalMs
      : SPEAK_NOW_BACKCHANNEL_MIN_INTERVAL_MS;
  // コメント判定（discussion/ai-cohost/decisions/comment-react/integration.md）: 弾く判定・反応する判定・
  // 忙しい間のコメントの扱い（あとで拾う / 見逃す）・判定ログの口。
  const commentGuard =
    typeof options.commentGuard === "function"
      ? options.commentGuard
      : createCommentGuard(
          typeof options.decisionsApiKeyProvider === "function" ? { apiKeyProvider: options.decisionsApiKeyProvider } : {}
        );
  const commentReactJudge =
    typeof options.commentReactJudge === "function"
      ? options.commentReactJudge
      : createDecisionsJudge({
          timeoutMs: COMMENT_JUDGE_TIMEOUT_MS,
          apiKeyProvider:
            typeof options.decisionsApiKeyProvider === "function" ? options.decisionsApiKeyProvider : () => loadDecisionsApiKey()
        });
  /** @type {"hold" | "drop"} */
  let commentBusyPolicy = COMMENT_BUSY_POLICIES.includes(/** @type {any} */ (options.commentBusyPolicyInitial))
    ? /** @type {"hold" | "drop"} */ (options.commentBusyPolicyInitial)
    : /** @type {"hold"} */ (DEFAULT_COMMENT_BUSY_POLICY);
  const onSetCommentBusyPolicy = typeof options.onSetCommentBusyPolicy === "function" ? options.onSetCommentBusyPolicy : null;
  const commentHoldMaxAgeMs =
    typeof options.commentHoldMaxAgeMs === "number" && options.commentHoldMaxAgeMs > 0 ? options.commentHoldMaxAgeMs : COMMENT_HOLD_MAX_AGE_MS;
  const commentHoldMaxCount =
    typeof options.commentHoldMaxCount === "number" && options.commentHoldMaxCount >= 1
      ? Math.floor(options.commentHoldMaxCount)
      : COMMENT_HOLD_MAX_COUNT;
  const onCommentJudgment = typeof options.onCommentJudgment === "function" ? options.onCommentJudgment : null;
  // 思い出す流れ（記憶の作り直し Wave 3）: ④を走らせる口・「避けるか」判定・出来事のターミナルの口。
  const recallRunner = typeof options.recallRunner === "function" ? options.recallRunner : null;
  const recallJudge =
    typeof options.recallJudge === "function"
      ? options.recallJudge
      : createDecisionsQuestionsJudge({
          timeoutMs: RECALL_JUDGE_TIMEOUT_MS,
          apiKeyProvider:
            typeof options.decisionsApiKeyProvider === "function" ? options.decisionsApiKeyProvider : () => loadDecisionsApiKey()
        });
  const onRecallEvent = typeof options.onRecallEvent === "function" ? options.onRecallEvent : null;
  // 操縦席の作り直し 1 回目（データ側）: 遅延のしきい値・残量の正本・遅延ログの口。
  const latencyThresholds = resolveLatencyThresholds(options.latencyThresholds);
  const quotaSource =
    options.quotaSource && typeof options.quotaSource.snapshot === "function" ? options.quotaSource : null;
  const onReplyLatency = typeof options.onReplyLatency === "function" ? options.onReplyLatency : null;
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
  // 頭の会話の圧縮の最中か（broadcastContextCompaction の started → finished / failed・resetContextCompaction で
  // 戻す）。snapshot の compacting に載せ、開き直した操縦席にも「圧縮中」を出す。
  let contextCompacting = false;
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
  // speak-now の判定部品（fireScheduler と同じく orchestrator が fire/getState を持つときだけ生成する）。
  /** @type {ReturnType<typeof createSpeakNowController> | null} */
  let speakNow = null;
  // コメント反応の判定部品（speakNow と同じく orchestrator が fire/getState を持つときだけ生成する）。
  /** @type {ReturnType<typeof createCommentReactController> | null} */
  let commentReact = null;
  // 思い出しの係（記憶の作り直し Wave 3・orchestrator が fire/getState を持ち、recallRunner があるときだけ生成する）。
  /** @type {ReturnType<typeof createRecallDesk> | null} */
  let recallDesk = null;
  // 弾く判定の待ち行列。判定は並行に走らせるが、転写バッファへは届いた順に積む（先のコメントの判定完了を
  // 待つ・合意 §1-5）。decision が付いた先頭から順に取り出す。
  /** @type {Array<{ id: string; text: string; displayName: string | undefined; arrivedAtMs: number; decision: any }>} */
  let guardQueue = [];
  // チャット器官が ID を持たないコメント（テスト・旧器官）に振る操縦席内の ID。
  let localCommentSeq = 0;
  // サーバが呼んだ fire() のうち、まだ Promise が片付いていない数。orchestrator は fire() の受理直後
  // （fireClaimed）から thinking に入るまで getState() が idle のままなので、speak-now の「忙しい」は
  // この数も見る（最小の安全側: 受理の窓も忙しいとみなす）。
  let fireInFlight = 0;
  // speak-now の相槌の発火がまだ片付いていない間か（backchannel.md §2）。この間に orchestrator が speaking に
  // なったら、それは相槌を喋り始めた時点 = 相槌どうしの歯止めの数え始め（speakNow.markBackchannelSpoken）。
  // fire() は single-flight で、相槌の発火は「忙しくない」ときにしか要求しないので、この間の speaking は
  // その相槌のもの。
  let backchannelFirePending = false;
  // 隙間で手動の圧縮（context-growth-2026-10.md §6）の材料: 配信者が今喋っているか（VAD の speechStart から
  // speechEnd / speechCancel まで）と、喋り終わりの時刻（壁時計）。getQuietGap() が読む。
  let userSpeaking = false;
  /** @type {number | null} */
  let lastSpeechEndAtMs = null;
  // S7「視聴者が混ざる」チャット器官（cockpit-server 所有・POST 駆動遅延起動＝ear-pipeline の流儀）。
  // POST /api/chat/connect で chatClientFactory から生成し start()・onMessage/onStatus/onDiagnostic を
  // 取り込み経路（ingestChatMessage/broadcastChatStatus/broadcastChatDiagnostic）へ繋ぐ。POST
  // /api/chat/disconnect と close() で stop()+破棄（タイマ/プロセスを残さない）。
  /** @type {{ start: () => Promise<void>; stop: () => void; getState: () => string; getSource: () => string } | null} */
  let chatClient = null;
  /** @type {Array<() => void>} チャット器官フックの購読解除（破棄時に全撤去）。 */
  let chatUnsubs = [];
  /** チャット器官が最後に知らせた状態（connect / 畳むときに戻す・警告の材料）。 */
  /** @type {string | null} */
  let lastChatStatus = null;
  /**
   * 配信者の行の文字起こしの遅延（seq → ms・遅延の「文字起こし」区間の材料）。直近だけ持つ。
   * @type {Map<number, number | null>}
   */
  const sttLatencyBySeq = new Map();
  const STT_LATENCY_KEEP = 500;
  // 上の帯の警告（状態で決まるもの・一回きりの出来事）。変わったら SSE "warnings" で一覧ごと流す。
  const warningBoard = createWarningBoard({
    nowImpl,
    eventTtlMs:
      typeof options.warningEventTtlMs === "number" && options.warningEventTtlMs > 0 ? options.warningEventTtlMs : WARNING_EVENT_TTL_MS,
    onChange: (list) => broadcast("warnings", { warnings: list })
  });
  /** @type {(() => void) | null} */
  let quotaUnsub = null;

  const health = {
    /** @type {"up" | "down" | "unknown"} */ whisper: "unknown",
    /** @type {string | null} */ whisperReason: null,
    /** @type {"up" | "down" | "unknown"} */ ffmpeg: "unknown",
    /** @type {string | null} */ ffmpegReason: null,
    // 文字起こし（engine は sttEngine）の状態。whisper は whisper の死活に連動、ElevenLabs は接続状態
    // （connecting / up / reconnecting / down）。耳が止まっている間は unknown。
    /** @type {"up" | "down" | "unknown" | "connecting" | "reconnecting"} */ stt: "unknown",
    /** @type {string | null} */ sttReason: null
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
      // 操縦席の文字起こし選択: 方式（耳が動いている間は使用中、止まっている間は前回 Start の選択）と状態。
      // ヘッダの `stt: ElevenLabs up` 表示と、設定の選択肢の復元に使う（キーは載せない）。
      stt: { engine: sttEngine, status: health.stt, reason: health.sttReason },
      // 声の方式（前回 Start の選択・起動直後は記憶の値）と、今の engine の状態（キーは載せない）。
      // 設定の選択肢の復元と、ログのタブの健康 1 行の `tts:` に使う。
      tts: { engine: ttsEngine, status: voice.status, reason: voice.reason },
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
      // 話し始めの方式（"classic" | "speak-now"・scheduler 未生成なら null・verbosity と同型）。
      speakStart: fireScheduler ? speakStartMode : null,
      // 忙しい間に届いたコメントの扱い（"hold" = あとで拾う / "drop" = 見逃す・scheduler 未生成なら null・
      // コメント反応の合意 §2）。
      commentBusy: fireScheduler ? commentBusyPolicy : null,
      // S8「キルスイッチ」: キル状態の正本（サーバ側 boolean をそのまま載せる・既定 false・additive）。
      killed: killed,
      // 多頭化 Domain B: 頭脳の現況（頭札 + 資格情報の存在確認・未注入なら null・audioDevice/channel と同型）。
      brain: publicBrain,
      // 配信間記憶: 記憶の現況（{lastRecordAtMs, recording}・未注入なら null・brain と同型）。
      memory: typeof memoryStatusImpl === "function" ? (memoryStatusImpl() ?? null) : null,
      // S6「会話が続く」: 魂の声の出力デバイスの現況（未注入なら null）。
      audioDevice: typeof audioDeviceStatusImpl === "function" ? (audioDeviceStatusImpl() ?? null) : null,
      // S7「視聴者が混ざる」: チャット器官の現況。source は settings 由来（Connect 前でも入力欄の既定に
      // 復元できる・切断後も残る）。connected/state は live client 由来（未接続なら false/null）。
      chat: {
        source: typeof chatSourceStatusImpl === "function" ? (chatSourceStatusImpl()?.source ?? null) : null,
        connected: chatClient != null,
        state: chatClient ? chatClient.getState() : null
      },
      // 操縦席の作り直し 1 回目（データ側・cockpit-glance-redesign.md §9）: 残量・警告・遅延のしきい値。
      quota: quotaSource ? quotaSnapshotSafe() : null,
      warnings: warningBoard.list(),
      latencyThresholds: { ...latencyThresholds },
      // 頭の会話の圧縮の最中か（状態のピルの「圧縮中」・既定 false・killed と同じく常に boolean）。
      compacting: contextCompacting,
      // 圧縮の目安（{ thresholdTokens }・設定の「頭脳・会話」タブ。未注入なら null・memory と同型）。
      compaction: typeof contextCompactionStatusImpl === "function" ? (contextCompactionStatusImpl() ?? null) : null,
      // ①の Codex の頭の fast（{ enabled, applicable, supported }・設定の「頭脳・会話」タブ。未注入なら null）。
      codexFast: typeof codexFastStatusImpl === "function" ? (codexFastStatusImpl() ?? null) : null
    };
  }

  /**
   * 圧縮の最中かを変える（変わったときだけ SSE "state" で押す）。
   * @param {boolean} next
   */
  function setContextCompacting(next) {
    if (closed || contextCompacting === next) return;
    contextCompacting = next;
    broadcastState();
  }

  /** 残量の今の値（読み口の throw は不明として扱う）。 */
  function quotaSnapshotSafe() {
    try {
      return /** @type {any} */ (quotaSource).snapshot() ?? null;
    } catch {
      return null;
    }
  }

  /**
   * 状態で決まる警告を今の状態から決め直す（死活・チャット・残量が変わるたびに呼ぶ）。直ったものは消える。
   */
  function refreshStateWarnings() {
    if (closed) return;
    // 文字起こし（耳を止めている間は unknown = 警告なし）。
    const sttLabel = sttEngine === "elevenlabs" ? "ElevenLabs" : LOCAL_STT_ENGINE_TITLES[sttEngine] ?? "whisper";
    warningBoard.setCondition(
      "stt",
      health.stt === "down"
        ? { kind: "stt-down", severity: "alert", message: "文字起こしが止まっている", detail: health.sttReason, source: sttEngine }
        : health.stt === "reconnecting"
          ? { kind: "stt-reconnecting", severity: "warn", message: `文字起こしを繋ぎ直し中（${sttLabel}）`, detail: health.sttReason, source: sttEngine }
          : null
    );
    // 声（ElevenLabs のときだけ。AivisSpeech は状態で警告を出さない＝今どおり）。組み立ては文字起こしと同じ。
    warningBoard.setCondition(
      "tts",
      voice.engine === "elevenlabs"
        ? voice.status === "down"
          ? { kind: "tts-down", severity: "alert", message: "声が止まっている（ElevenLabs）", detail: voice.reason, source: voice.engine }
          : voice.status === "reconnecting"
            ? { kind: "tts-reconnecting", severity: "warn", message: "声を繋ぎ直し中（ElevenLabs）", detail: voice.reason, source: voice.engine }
            : null
        : null
    );
    warningBoard.setCondition(
      "mic",
      health.ffmpeg === "down"
        ? { kind: "mic-down", severity: "alert", message: "マイクの取り込みが止まっている", detail: health.ffmpegReason }
        : null
    );
    // チャット（繋いでいる間だけ。自分で切ったら警告なし）。
    const chatState = chatClient ? (lastChatStatus ?? chatClient.getState()) : null;
    warningBoard.setCondition(
      "chat",
      chatState === "dead"
        ? { kind: "chat-disconnected", severity: "warn", message: "チャットが切れている" }
        : chatState === "retrying"
          ? { kind: "chat-reconnecting", severity: "warn", message: "チャットを繋ぎ直し中" }
          : null
    );
    // 残量（残り 20% 未満・5% 未満は赤）と Codex の使用上限。
    const quota = quotaSource ? quotaSnapshotSafe() : null;
    warningBoard.setCondition("quota-low:codex", quotaLowWarning("Codex", quota?.codex));
    warningBoard.setCondition("quota-low:elevenlabs", quotaLowWarning("ElevenLabs", quota?.elevenlabs));
    warningBoard.setCondition(
      "codex-limited",
      quota?.codex?.limited ? { kind: "codex-limited", severity: "alert", message: "Codex の使用上限に達した", detail: quota.codex.reachedType ?? null } : null
    );
  }

  /**
   * 判定のエラーを一回きりの警告にする（OpenAI の残高切れは別の警告）。detail は本文を含まない文言だけを渡す。
   * @param {"speak-now" | "comment-react" | "comment-guard" | "recall"} source  @param {string | null | undefined} message
   */
  function warnJudgeError(source, message) {
    if (isCreditExhaustedError(message)) {
      warningBoard.pushEvent("openai-credit", {
        kind: "openai-credit",
        severity: "alert",
        message: "OpenAI の残高切れ（判定が止まる）",
        source
      });
      return;
    }
    warningBoard.pushEvent(`judge-error:${source}`, {
      kind: "judge-error",
      severity: "warn",
      message: "判定のエラー",
      detail: typeof message === "string" ? message : null,
      source
    });
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

  /** 現在状態を丸ごと push（ヘッダ/フッタの権威スナップショット）。状態で決まる警告もここで決め直す。 */
  function broadcastState() {
    refreshStateWarnings();
    broadcast("state", snapshot());
  }

  // ── 死活の反映 ─────────────────────────────────────────────────────

  /**
   * @param {"whisper" | "ffmpeg" | "stt"} which
   * @param {"up" | "down" | "unknown" | "connecting" | "reconnecting"} status
   * @param {string | null} reason
   */
  function setHealth(which, status, reason) {
    const statusKey = which;
    const reasonKey = /** @type {"whisperReason" | "ffmpegReason" | "sttReason"} */ (`${which}Reason`);
    if (health[statusKey] === status && health[reasonKey] === reason) return;
    /** @type {any} */ (health)[statusKey] = status;
    health[reasonKey] = reason;
    broadcastState();
  }

  /** @param {any} d  pipeline の診断イベント。 */
  function handleDiagnostic(d) {
    if (d && d.type === "whisperDown") {
      const reason = `whisper-server down (${d.phase ?? "runtime"}; code=${d.code ?? "?"}, signal=${d.signal ?? "?"})`;
      setHealth("whisper", "down", reason);
      // whisper で文字起こし中なら stt も down（ヘッダの `stt: whisper down`）。
      if (sttEngine === "whisper" && earsState !== "stopped") setHealth("stt", "down", reason);
    } else if (d && d.type === "localSttDown") {
      // ローカルの文字起こしの子プロセスが落ちた（whisperDown と同格: stt down = 上の帯の alert「文字起こしが止まっている」）。
      const title = LOCAL_STT_ENGINE_TITLES[d.engine] ?? String(d.engine ?? "local");
      const reason = `${title} の文字起こしの子プロセスが落ちた (code=${d.code ?? "?"}, signal=${d.signal ?? "?"})`;
      if (isLocalSttEngine(sttEngine) && earsState !== "stopped") setHealth("stt", "down", reason);
    } else if (d && d.type === "ffmpegExit" && d.willRestart === false) {
      // willRestart=false = 再起動予算切れ/恒久死（capture の再起動耐性が尽きた）。
      // willRestart=true は capture が自己回復するため up のまま（transient blip）。
      setHealth("ffmpeg", "down", `ffmpeg exited (code=${d.code ?? "?"}, signal=${d.signal ?? "?"})`);
    }
    // 頭のエラー（発火の失敗）は一回きりの警告にも出す（cockpit-glance-redesign.md §9.2）。
    if (d && d.type === "fireError") {
      warningBoard.pushEvent("brain-error", {
        kind: "brain-error",
        severity: "alert",
        message: "頭のエラー",
        detail: typeof d.message === "string" ? d.message : null
      });
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
   * @param {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} [engineChoice]  文字起こしの方式（省略時は現在の選択）。
   * @param {"aivis" | "elevenlabs"} [ttsChoice]  声の方式（省略時は現在の選択）。
   * @returns {Promise<{ ok: true; state: object } | { ok: false; error: string; state: object }>}
   */
  async function startEars(deviceRaw, engineChoice, ttsChoice) {
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

    // 文字起こしの方式（マイクと同じく Start の前に選ぶ）。Start ごとに記憶する（失敗寛容）。
    if (engineChoice) sttEngine = engineChoice;
    const engine = sttEngine;
    if (onSetSttEngine) {
      try {
        await onSetSttEngine(engine);
      } catch {
        // 永続化失敗は起動を止めない（setLastDevice と同型）。
      }
    }
    // 声の方式（文字起こしと同じく Start の前に選び、Start ごとに記憶する・失敗寛容）。
    if (ttsChoice) ttsEngine = ttsChoice;
    const voiceKind = ttsEngine;
    if (onSetTtsEngine) {
      try {
        await onSetTtsEngine(voiceKind);
      } catch {
        // 永続化失敗は起動を止めない。
      }
    }

    earsState = "starting";
    health.whisper = "unknown";
    health.whisperReason = null;
    health.ffmpeg = "unknown";
    health.ffmpegReason = null;
    health.stt = engine === "elevenlabs" ? "connecting" : "unknown";
    health.sttReason = null;
    // Start 押下直後からヘッダを「Starting」にする（whisper のモデル読み込み待ち等の間も Stopped のまま
    // にならないように・合意 §2 範囲 3）。
    broadcastState();

    /** @type {{ engine: "elevenlabs"; apiKey: string } | null} */
    let elevenLabs = null;
    if (engine === "elevenlabs") {
      // キーは Start ごとにコード内で読む（process.env に入れない）。無ければ Start 失敗（理由はキーを含まない）。
      /** @type {{ ok: boolean; apiKey?: string; reason?: string }} */
      let key;
      try {
        key = elevenLabsApiKeyProvider();
      } catch {
        key = { ok: false };
      }
      if (!key || !key.ok || typeof key.apiKey !== "string" || key.apiKey.length === 0) {
        const reason = (key && key.reason) || "ElevenLabs のキーが見つからない";
        earsState = "stopped";
        startedAtMs = null;
        health.stt = "down";
        health.sttReason = reason;
        broadcastState();
        return { ok: false, error: reason, state: snapshot() };
      }
      elevenLabs = { engine: "elevenlabs", apiKey: key.apiKey };
    }

    // ローカルの文字起こし（parakeet / zipformer）: モデルが揃っていなければ Start 失敗（キー切れと同じ流儀・
    // 勝手に取得しない）。設定（スレッド数・余白・hotwords）は Start ごとに読む（次の Start から効く）。
    /** @type {{ engine: "parakeet" | "zipformer"; local: object | null } | null} */
    let localStt = null;
    if (isLocalSttEngine(engine)) {
      /** @type {{ ok: boolean; reason?: string }} */
      let check;
      try {
        check = localSttModelCheck(engine);
      } catch (error) {
        check = { ok: false, reason: `モデルを確かめられない（${errMessage(error)}）` };
      }
      if (!check || check.ok !== true) {
        const reason = (check && typeof check.reason === "string" && check.reason) || `${LOCAL_STT_ENGINE_TITLES[engine]} のモデルが見つからない`;
        earsState = "stopped";
        startedAtMs = null;
        health.stt = "down";
        health.sttReason = reason;
        broadcastState();
        return { ok: false, error: reason, state: snapshot() };
      }
      /** @type {object | null} */
      let local = null;
      try {
        local = localSttSettingsProvider() ?? null;
      } catch {
        local = null; // 読めなければ既定（pipeline 側で正規化）。
      }
      localStt = { engine, local };
    }

    // 声の engine を用意する（種類が変わっていれば cockpit.mjs が作り直す。ElevenLabs はここでキーを読んで繋ぎ始める）。
    // 用意できなければ耳を開かずに Start を失敗にする（文字起こしのキー切れと同じ流儀・自動で AivisSpeech に戻さない）。
    if (onPrepareVoiceEngine) {
      /** @type {{ ok: boolean; reason?: string }} */
      let prepared;
      try {
        prepared = await onPrepareVoiceEngine(voiceKind);
      } catch (error) {
        prepared = { ok: false, reason: `声の engine を用意できない（${errMessage(error)}）` };
      }
      if (!prepared || prepared.ok !== true) {
        const reason = (prepared && typeof prepared.reason === "string" && prepared.reason) || "声の engine を用意できない";
        earsState = "stopped";
        startedAtMs = null;
        health.stt = "unknown";
        health.sttReason = null;
        voice.engine = voiceKind;
        voice.status = "down";
        voice.reason = clipVoiceReason(reason);
        broadcastState();
        return { ok: false, error: reason, state: snapshot() };
      }
    }

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
      // ElevenLabs のときだけ stt を渡す（whisper は pipeline の既定＝従来と同じ options 形）。
      ...(elevenLabs ? { stt: { ...(/** @type {any} */ (baseOptions).stt ?? {}), ...elevenLabs } } : {}),
      // ローカルのときは engine と設定（stt.local）を渡す（pipelineOptions.stt.local があればその上に重ねる）。
      ...(localStt
        ? {
            stt: {
              ...(/** @type {any} */ (baseOptions).stt ?? {}),
              engine: localStt.engine,
              local: { ...(/** @type {any} */ (baseOptions).stt?.local ?? {}), ...(localStt.local ?? {}) }
            }
          }
        : {}),
      onSttStatus: (status, info) => {
        if (pipeline !== p) return; // 畳んだ後・別の Start の通知は無視。
        setHealth("stt", /** @type {any} */ (status), info && info.reason ? info.reason : null);
      },
      capture: {
        ...(/** @type {any} */ (baseOptions).capture ?? {}),
        ...(device != null ? { device } : {}),
        ...(inputFormat ? { inputFormat } : {})
      },
      onVadEvent: (e) => {
        if (e && e.type === "speechStart") userSpeaking = true;
        else if (e && (e.type === "speechEnd" || e.type === "speechCancel")) {
          userSpeaking = false;
          lastSpeechEndAtMs = nowImpl();
        }
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
        // speak-now: you の転写 1 件ごとに判定（soul/viewer は部品内で無視・モード外/OFF/KILL も部品内で無視）。
        if (speakNow) speakNow.handleTranscript(entry);
        // soul の発話行はここ（耳の onTranscript 経路）では放送しない。soul も you と同じ
        // transcriptBuffer に append されるため onAppend→onTranscript を必ず通るが、soul の正経路は
        // orchestrator の onSoulTranscript → broadcastSoulTranscript の 1 本。ここで除外しないと
        // 同一エントリが二重に broadcast("transcript") される（S3 追撃 domain-c で接地した二重表示バグ）。
        // ★ S7: viewer コメントも同じ transcriptBuffer へ append されるため onTranscript を通るが、
        // viewer 行の放送は取り込み経路（ingestChatMessage）が 1 本で担う。ここで除外しないと二重放送。
        if (/** @type {any} */ (entry).speaker === "soul" || /** @type {any} */ (entry).speaker === "viewer") return;
        // 文字起こしの遅延は画面に出さず（合意 §4.2）、数字だけをログの口へ（本文は渡さない）。
        if (onSttLatency) {
          const latency = meta && typeof meta.latencyMs === "number" && Number.isFinite(meta.latencyMs) ? meta.latencyMs : null;
          try {
            onSttLatency({ engine, latencyMs: latency });
          } catch {
            // ログの失敗で耳を止めない。
          }
        }
        // 遅延の「文字起こし」区間の材料（この行がきっかけで喋ったときに使う・直近だけ持つ）。
        if (typeof (/** @type {any} */ (entry).seq) === "number") {
          const ms = meta && typeof meta.latencyMs === "number" && Number.isFinite(meta.latencyMs) ? meta.latencyMs : null;
          sttLatencyBySeq.set(/** @type {any} */ (entry).seq, ms);
          if (sttLatencyBySeq.size > STT_LATENCY_KEEP) sttLatencyBySeq.delete(sttLatencyBySeq.keys().next().value);
        }
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
      const reason = `ears failed to start: ${errMessage(error)}`;
      if (engine === "whisper") {
        health.stt = "down";
        health.sttReason = reason;
        setHealth("whisper", "down", reason);
      } else {
        // ElevenLabs は whisper を起動していない（whisper の死活は unknown のまま）。
        setHealth("stt", "down", reason);
      }
      earsState = "stopped"; // setHealth の broadcast 後も stopped を確定。
      return { ok: false, error: errMessage(error), state: snapshot() };
    }

    earsState = "listening";
    startedAtMs = nowImpl();
    // start 成功 = (whisper ready または ElevenLabs session_started)・ffmpeg spawn 済み
    // （楽観的 up。以後の死は診断で down に落ちる）。
    if (engine === "whisper") {
      health.whisper = "up";
      health.whisperReason = null;
    }
    health.stt = "up";
    health.sttReason = null;
    health.ffmpeg = "up";
    health.ffmpegReason = null;
    broadcastState();
    callEarsHook(onEarsStarted);
    return { ok: true, state: snapshot() };
  }

  /** @returns {Promise<object>} 停止後の状態。 */
  async function stopEars() {
    callEarsHook(onEarsStopped);
    if (!pipeline) {
      earsState = "stopped";
      return snapshot();
    }
    const p = pipeline;
    // 記憶: 転写は pipeline が持つので、畳む前に渡す（close 経由の onEarsStopped では、もう空になっている）。
    if (onEarsStopping) {
      try {
        onEarsStopping(p.transcriptBuffer.all());
      } catch {
        // 記録の失敗で耳の Stop を止めない。
      }
    }
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
    health.stt = "unknown";
    health.sttReason = null;
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
      revision,
      ...(typeof conversationInstructionHooks.getSoulSkills === "function" ? { soulSkills: readSoulSkills() } : {})
    };
  }

  /**
   * 魂が足す教えの一覧（読むだけの表示用）。読めない・形が違うものは落とす（会話指示の読み書きは止めない）。
   * @returns {Array<{ name: string; path: string; body: string }>}
   */
  function readSoulSkills() {
    try {
      const list = /** @type {any} */ (conversationInstructionHooks).getSoulSkills();
      if (!Array.isArray(list)) return [];
      return list
        .filter(
          (skill) =>
            skill &&
            typeof skill.name === "string" &&
            typeof skill.path === "string" &&
            typeof skill.body === "string" &&
            skill.body.trim().length > 0
        )
        .map((skill) => ({ name: skill.name, path: skill.path, body: skill.body }));
    } catch {
      return [];
    }
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
        // 文字起こしの方式（任意・省略時は現在の選択）。未知値は 400（誤 POST を早期に弾く）。
        if (body.sttEngine !== undefined && body.sttEngine !== null && !STT_ENGINES.includes(body.sttEngine)) {
          sendJson(res, 400, { error: "invalid stt engine", state: snapshot() });
          return;
        }
        // 声の方式（任意・省略時は現在の選択）。未知値は 400（sttEngine と同じ）。
        if (body.ttsEngine !== undefined && body.ttsEngine !== null && !TTS_ENGINES.includes(body.ttsEngine)) {
          sendJson(res, 400, { error: "invalid tts engine", state: snapshot() });
          return;
        }
        const result = await startEars(deviceRaw ?? null, body.sttEngine ?? undefined, body.ttsEngine ?? undefined);
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
      // きっかけ = 手動（操縦席のボタン・AHK のホットキー）。
      const result = await trackFire(() => /** @type {any} */ (fireOrchestrator).fire({ cause: { type: "manual", vision: false } }));
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
      const result = await trackFire(() =>
        /** @type {any} */ (fireOrchestrator).fire({ vision: true, cause: { type: "manual", vision: true } })
      );
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
    if (method === "POST" && pathname === "/api/speak-start") {
      // 話し始めの方式（従来 / speak-now）の切替継ぎ目（speak-now 合意 §5・POST /api/verbosity の写経）。
      // scheduler 未生成（orchestrator 未注入）なら 503。
      if (!fireScheduler) {
        sendJson(res, 503, { error: "speak-start control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const mode = body.mode;
      if (mode !== "classic" && mode !== "speak-now") {
        sendJson(res, 400, { error: "invalid speak-start mode" });
        return;
      }
      applySpeakStartMode(mode);
      if (onSetSpeakStartMode) {
        try {
          await onSetSpeakStartMode(speakStartMode);
        } catch {
          // 永続化失敗は操作を止めない（onSetVerbosity と同型の失敗寛容）。
        }
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/comment-busy") {
      // 忙しい間に届いたコメントの扱い（あとで拾う / 見逃す）の切替継ぎ目（コメント反応の合意 §2・
      // POST /api/speak-start の写経）。scheduler 未生成（orchestrator 未注入）なら 503。
      if (!fireScheduler) {
        sendJson(res, 503, { error: "comment-busy control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const policy = body.policy;
      if (!COMMENT_BUSY_POLICIES.includes(policy)) {
        sendJson(res, 400, { error: "invalid comment-busy policy" });
        return;
      }
      commentBusyPolicy = policy;
      // 見逃すへ切り替えたら、取っておいたコメントも捨てる（以後は忙しい間のコメントを判定しない）。
      if (commentBusyPolicy === "drop" && commentReact) commentReact.reset();
      if (onSetCommentBusyPolicy) {
        try {
          await onSetCommentBusyPolicy(commentBusyPolicy);
        } catch {
          // 永続化失敗は操作を止めない（onSetSpeakStartMode と同型の失敗寛容）。
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
      // トグル禁止・明示値のみ受理する（誤 POST を早期に弾く・verbosity の mode 検証と同型）。頭 id 6 値は
      // ここに直書きする（API の受理値/技術札は従来のワイヤ検証を保持する）。
      // `resolveBrainIdentity` の import はこの検証表を置き換えるためではなく、下流の current public
      // projection だけを canonical resolver から導出するための additive read-path である。2026-07-17
      // 追撃で Codex 側 2 頭（GPT-5.5 / GPT-5.6 Sol）がここへ追加された既存契約は変えない。2026-10-16 に
      // GPT-5.5（"codex-55"）を外し、GPT-6.1 Sol / Claude Opus 5.5 を追加（brains.mjs と同じ値を保つ）。
      if (
        body.brain !== "claude" &&
        body.brain !== "claude-opus-55" &&
        body.brain !== "codex" &&
        body.brain !== "codex-56-sol" &&
        body.brain !== "codex-astra" &&
        body.brain !== "codex-61-sol"
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
    if (method === "POST" && pathname === "/api/compact-threshold") {
      // 圧縮を始める大きさの変更継ぎ目（POST /api/barge-in の写経）。保存 + 走っている compactor の差し替えは
      // cockpit.mjs の onSetCompactThresholdTokens が担う。未注入なら 503。値は整数で 5 万〜45 万だけ受ける。
      if (typeof onSetCompactThresholdTokens !== "function") {
        sendJson(res, 503, { error: "compaction control not available" });
        return;
      }
      const body = await readJsonBody(req);
      const tokens = normalizeCompactThresholdTokens(body.tokens);
      if (tokens == null) {
        sendJson(res, 400, { error: "tokens must be an integer from 50000 to 450000" });
        return;
      }
      try {
        await onSetCompactThresholdTokens(tokens);
      } catch {
        // 永続化 / 差し替えの失敗は操作を止めない（onSetBargeInEnabled と同型の失敗寛容）。
      }
      broadcastState();
      sendJson(res, 200, snapshot());
      return;
    }
    if (method === "POST" && pathname === "/api/codex-fast") {
      // ①の Codex の頭の fast の切り替え継ぎ目（POST /api/compact-threshold の写経）。保存と次の受理への反映は
      // cockpit.mjs の onSetCodexFastMode が担う（次の返事から効く・セッションは作り直さない）。未注入なら 503。
      if (typeof onSetCodexFastMode !== "function") {
        sendJson(res, 503, { error: "codex fast control not available" });
        return;
      }
      const body = await readJsonBody(req);
      // トグル禁止・明示の boolean だけ受ける（verbosity の mode 検証と同型）。
      if (typeof body.enabled !== "boolean") {
        sendJson(res, 400, { error: "enabled must be a boolean" });
        return;
      }
      try {
        await onSetCodexFastMode(body.enabled);
      } catch {
        // 永続化の失敗は操作を止めない（onSetCompactThresholdTokens と同型の失敗寛容）。
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
        // 記録失敗（②書き出し役・コミットの失敗を含む）は 500 にせず握って続行する
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
      brain,
      // その返事を出した発火の番号（受理・推論の範囲・遅延と結ぶ・cockpit-glance-redesign.md §9）。
      fireId: entry && typeof (/** @type {any} */ (entry).fireId) === "number" ? /** @type {any} */ (entry).fireId : null
    });
  }

  /**
   * 1 返事の遅延（orchestrator の発火の中の区間）に、文字起こし（きっかけの配信者の行）と判定の区間を足して流す。
   * @param {any} inFire
   */
  function broadcastReplyLatency(inFire) {
    const cause = inFire && inFire.cause && typeof inFire.cause === "object" ? inFire.cause : null;
    const triggerSeq = cause && typeof cause.triggerSeq === "number" ? cause.triggerSeq : null;
    const record = composeReplyLatency(inFire, {
      transcribeMs: triggerSeq != null ? sttLatencyBySeq.get(triggerSeq) ?? null : null,
      judgeMs: cause && typeof cause.judgeLatencyMs === "number" ? cause.judgeLatencyMs : null,
      thresholds: latencyThresholds
    });
    const brain = typeof brainStatusImpl === "function" ? (brainStatusImpl()?.brain ?? null) : null;
    // voice = その返事を鳴らした声の engine の種類（遅延の TTS / 声の区間を engine ごとに見比べる材料・additive）。
    // stt = 文字起こしの方式（文字起こしの区間を方式ごとに見比べる材料・additive・応答の遅れの直し §2-5）。
    // serviceTier = その返事の turn/start に送った Codex の速さの段（fast の比較の材料・additive・送っていなければ null）。
    const payload = {
      ...record,
      vision: inFire?.vision === true,
      brain,
      voice: voice.engine ?? ttsEngine,
      stt: sttEngine,
      serviceTier: typeof inFire?.serviceTier === "string" ? inFire.serviceTier : null
    };
    broadcast("latency", payload);
    if (onReplyLatency) {
      try {
        onReplyLatency(payload);
      } catch {
        // ログの失敗で発火を止めない。
      }
    }
  }

  /** @type {{ fire: () => Promise<object>; interrupt?: (atMs?: number) => Promise<object>; getState: () => string; dispose: () => void } | null} */
  let fireOrchestrator = null;
  if (typeof options.fireOrchestratorFactory === "function") {
    fireOrchestrator = options.fireOrchestratorFactory({
      getBuffer: () => (pipeline ? pipeline.transcriptBuffer : null),
      onState: (state) => {
        broadcast("soul", { state });
        // speak-now の相槌: 相槌の発火でチャッピーが喋り始めた時点を、相槌どうしの歯止めの数え始めにする
        // （backchannel.md §2）。この忙しさが明けたときの after-busy の判定も止まる。
        if (state === "speaking" && backchannelFirePending && speakNow) speakNow.markBackchannelSpoken();
        // speak-now: 喋り終わって手が空いたら、忙しい間の配信者の発言を 1 回判定する（合意 §3）。
        // fire() の Promise がまだ片付いていなければ、片付いた時点（trackFire）で改めて確かめる。
        if (state === "idle" && speakNow) speakNow.notifyIdle();
        // コメント反応: 忙しい間に取っておいたコメントを、手が空いたらまとめて判定する（合意 §2）。
        if (state === "idle" && commentReact) commentReact.notifyIdle();
        // 思い出しの係: 喋り終わって手が空いたら、届ける結果を片付ける（recall-flow.md §4）。
        if (state === "idle" && recallDesk) recallDesk.notifyIdle();
      },
      onFire: (info) => broadcast("fire", info),
      onDiagnostic: (diag) => handleDiagnostic(diag),
      onSoulTranscript: (entry) => broadcastSoulTranscript(entry),
      // 推論の範囲: ask の時点の会話の窓の始まりと終わりの seq（全経路・SSE "fireAsk"）。
      onAsk: (info) => broadcast("fireAsk", info),
      // 遅延: 1 返事 1 レコード（SSE "latency"）。
      onLatency: (info) => broadcastReplyLatency(info),
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
      // 記憶の作り直し Wave 3: 返事の中の思い出しの目印（返事が終わったあとに 1 つずつ）を思い出しの係へ。
      onRecallRequest: (info) => {
        if (recallDesk && info && typeof info.request === "string") recallDesk.request(info.request);
      },
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
      speakNowMode: speakStartMode === "speak-now",
      onFireRequest: (req) => {
        // S6 追撃（Domain E）: silence は従来どおり視覚発火（見えなければ中止）。call/turn-end および
        // S7 の comment/comment-call は視覚優先（対象あれば画像付き・無/失敗なら画像なしの通常発火へ
        // 劣化）。手動 Fire は scheduler 非経由で無関係。
        const kind = req && req.kind;
        // きっかけ = スケジューラの語彙（silence = 沈黙・call / turn-end / interjection / comment / comment-call）。
        const cause = { type: typeof kind === "string" ? kind : "unknown" };
        requestSelfFire(kind, req && req.kind === "silence" ? { vision: true, cause } : { vision: "preferred", cause });
      }
    });

    // speak-now（話し始めの判定・合意 §1〜§3）の部品。fire-scheduler の外に置き、結線だけをここで張る。
    //  - 忙しい: orchestrator が idle でない、またはサーバが呼んだ fire() がまだ片付いていない。
    //  - 判定してよい: speak-now モード・自発 pill ON・KILL でない。
    //  - 応答・自発 → 通常の自発発火と同じ fire({vision:"preferred"})（LLM に区別は伝えない・合意 §2）。
    //  - 画面を見る（look）→ 応答と同じ fire({vision:"preferred"})（追加の指示なし・撮れなかったときの特別扱いもなし・
    //    experiments/04-look-request.md）。cause.choice に "look" が載る。
    //  - 相槌 → 同じ頭・同じセッションで fire({vision:"preferred", instruction})（画面も見る・2026-10-17 改め。その 1 回だけ先頭に
    //    「今は配信者の話に相槌を打つタイミング。」・backchannel.md §2）。発火結果は kind:"speak-now" で
    //    応答・自発と同じ selfFire 行（判定行「判定: 相槌 0.xx」の直後に出る）。前の相槌を喋り始めてから
    //    backchannelMinIntervalMs の間は部品が流す（action=skip-interval・ターミナルの 1 行だけ）。
    //  - 判定行（待つ以外）と失敗は selfFire SSE に相乗りしてフィードへ（合意 §5・新 SSE を足さない）。
    speakNow = createSpeakNowController({
      judge: speakNowJudge,
      getEntries: () => (pipeline ? pipeline.transcriptBuffer.all() : []),
      isBusy: () => fireInFlight > 0 || /** @type {any} */ (fireOrchestrator).getState() !== "idle",
      isActive: () =>
        speakStartMode === "speak-now" && fireScheduler != null && fireScheduler.isEnabled() && !killed,
      getName: () => currentSoulName(),
      getVerbosity: () => (fireScheduler ? fireScheduler.getVerbosity() : "normal"),
      nowImpl,
      backchannelMinIntervalMs,
      onFire: ({ choice, probability, trigger, triggerSeq, latencyMs }) => {
        // きっかけ = 判定（応答 / 自発 / 相槌 / 画面を見る + 確率 + きっかけの配信者の行の seq + 判定の遅延）。
        const cause = {
          type: "speak-now",
          choice,
          probability: probability ?? null,
          trigger: trigger ?? null,
          triggerSeq: triggerSeq ?? null,
          judgeLatencyMs: latencyMs ?? null
        };
        if (choice !== "backchannel") {
          // 応答・自発・画面を見る（look）は同じ発火（画面付き・指示なし）。
          requestSelfFire("speak-now", { vision: "preferred", cause });
          return;
        }
        backchannelFirePending = true;
        // 相槌も画面を見る（2026-10-17 ユーザー判断: 常駐撮影で応答時間がほぼ変わらないため）。
        requestSelfFire("speak-now", { vision: "preferred", instruction: SPEAK_NOW_BACKCHANNEL_INSTRUCTION, cause }).finally(() => {
          backchannelFirePending = false;
        });
      },
      onJudgment: (j) => {
        if (j.choice !== "wait") {
          // 判定の行: きっかけの seq と行き先（fire / drop-busy / drop-inactive / skip-interval）も載せる（§9）。
          broadcast("selfFire", {
            kind: "speak-now-judgment",
            choice: j.choice,
            probability: j.probability,
            latencyMs: j.latencyMs,
            action: j.action,
            trigger: j.trigger,
            triggerSeq: j.triggerSeq ?? null
          });
        }
        reportSpeakNow({ ok: true, ...j });
      },
      onError: (e) => {
        broadcast("selfFire", {
          kind: "speak-now-judgment",
          error: e.message,
          latencyMs: e.latencyMs,
          trigger: e.trigger,
          triggerSeq: e.triggerSeq ?? null
        });
        reportSpeakNow({ ok: false, trigger: e.trigger, error: e.message, latencyMs: e.latencyMs });
        warnJudgeError("speak-now", e.message);
      }
    });

    // コメント反応（反応する判定・コメント反応の合意 §1-6〜§2）の部品。speak-now と同じ置き方・同じ「忙しい」と
    // 「判定してよい」（speak-now モード・自発 ON・KILL でない）。従来モードでは呼ばない（今の comment /
    // comment-call のまま）。
    //  - 反応する → 通常の自発発火と同じ fire({vision:"preferred"}) に、どのコメントかを明示する内部指示を
    //    付ける（コメント本文は視聴者の発言として括る・返事は短め）。speak-now の発火とは先に出た方が勝つ
    //    （後から返った方は忙しいので、あとで拾う / 捨てる）。
    //  - 判定行（反応する のときだけ）と失敗は selfFire SSE に相乗りしてフィードへ（新 SSE を足さない）。
    commentReact = createCommentReactController({
      judge: commentReactJudge,
      getEntries: () => (pipeline ? pipeline.transcriptBuffer.all() : []),
      isBusy: () => fireInFlight > 0 || /** @type {any} */ (fireOrchestrator).getState() !== "idle",
      isActive: () =>
        speakStartMode === "speak-now" && fireScheduler != null && fireScheduler.isEnabled() && !killed,
      getName: () => currentSoulName(),
      getVerbosity: () => (fireScheduler ? fireScheduler.getVerbosity() : "normal"),
      getBusyPolicy: () => commentBusyPolicy,
      getHoldLimits: () => ({ maxAgeMs: commentHoldMaxAgeMs, maxCount: commentHoldMaxCount }),
      nowImpl,
      onFire: ({ comments, probabilities, latencyMs }) =>
        requestSelfFire(
          "comment-react",
          {
            vision: "preferred",
            instruction: buildCommentReactFireInstruction(comments, currentSoulName()),
            // きっかけ = コメント反応（どのコメントか: ID と転写の seq・反応するの確率・判定の遅延）。
            cause: {
              type: "comment-react",
              commentIds: comments.map((c) => c.id),
              commentSeqs: comments.map((c) => (typeof c.seq === "number" ? c.seq : null)),
              probabilities: Array.isArray(probabilities) ? probabilities : comments.map(() => null),
              judgeLatencyMs: typeof latencyMs === "number" ? latencyMs : null
            }
          },
          { commentIds: comments.map((c) => c.id) }
        ),
      onJudgment: (j) => {
        if (j.choice === "react") {
          broadcast("selfFire", {
            kind: "comment-judgment",
            choice: j.choice,
            probability: j.probability,
            latencyMs: j.latencyMs,
            commentId: j.commentId,
            // 行き先（fire / hold-busy / drop-busy / drop-inactive）ときっかけ（comment / after-busy）。
            action: j.action,
            trigger: j.trigger
          });
        }
        reportComment({ stage: "react", ok: true, ...j });
      },
      onError: (e) => {
        broadcast("selfFire", { kind: "comment-judgment", error: e.message, latencyMs: e.latencyMs, commentId: e.commentId, trigger: e.trigger });
        reportComment({ stage: "react", ok: false, trigger: e.trigger, commentId: e.commentId, error: e.message, latencyMs: e.latencyMs });
        warnJudgeError("comment-react", e.message);
      },
      onSkip: (s) => reportComment({ stage: "react", ok: true, skipped: true, commentId: s.commentId, action: s.action })
    });
  }

  // 思い出しの係（記憶の作り直し Wave 3 Domain D・recall-flow.md §4・§7）。speak-now / コメント反応とは違い、話し始めの
  // 方式や自発の ON/OFF に関係なく④は動く（①が自分で頼んだことの続き）。KILL 中は発火せず黙って前置きで渡す。
  // 自発の発火が OFF（scheduler の isEnabled が偽・①が自分からしゃべらない設定）のときは、結果をしゃべらせず、
  // 見つかった・見つからなかった・失敗のいずれも次の ask の先頭へ 1 回だけ黙って前置きする（Wave 3 仕上げ・
  // ユーザー決定 2026-10-21。ON/OFF は snapshot の selfFire.enabled と同じ fireScheduler.isEnabled() で見る）。
  if (
    recallRunner &&
    fireOrchestrator &&
    typeof (/** @type {any} */ (fireOrchestrator).fire) === "function" &&
    typeof (/** @type {any} */ (fireOrchestrator).getState) === "function"
  ) {
    recallDesk = createRecallDesk({
      runRecall: recallRunner,
      judge: recallJudge,
      getEntries: () => (pipeline ? pipeline.transcriptBuffer.all() : []),
      isBusy: () => fireInFlight > 0 || /** @type {any} */ (fireOrchestrator).getState() !== "idle",
      isKilled: () => killed,
      isSelfFireOn: () => fireScheduler != null && fireScheduler.isEnabled(),
      getName: () => currentSoulName(),
      nowImpl,
      // 避けない・見つからなかった・④の失敗（見つからなかったと同じ扱い）: 括った指示で①を発火させる（結果は selfFire kind:"recall" でフィードへ）。
      fire: (fireOptions) => requestSelfFire("recall", fireOptions),
      // 避けた・発火できなかった・自発 OFF: 次の ask の先頭に 1 回だけ黙って前置きする。
      defer: (text) => {
        const target = /** @type {any} */ (fireOrchestrator);
        return typeof target.deferInstruction === "function" ? target.deferInstruction(text) : false;
      },
      onEvent: (event) => {
        // 画面のログには頼みごとを出してよい（記憶の中身は係が載せない）。ターミナルには頼みごとを渡さない。
        // 新しい SSE は足さず、selfFire に kind:"recall-step" で相乗りする（判定行と同じ流儀）。
        broadcast("selfFire", { kind: "recall-step", ...event });
        if (onRecallEvent) {
          const { request: _request, ...rest } = event;
          try {
            onRecallEvent(rest);
          } catch {
            // ログの失敗で係を止めない。
          }
        }
      },
      onJudgeError: (message) => warnJudgeError("recall", message),
      onRecallError: (message) => {
        warningBoard.pushEvent("recall-error", {
          kind: "recall-error",
          severity: "warn",
          message: "思い出しの失敗",
          detail: typeof message === "string" ? message.slice(0, 200) : null,
          source: "recall"
        });
      }
    });
  }

  /**
   * 自発の発火要求を fire() へ渡し、結果を SSE "selfFire" で結線層外へ通知する（S6 Domain D・
   * 操縦席のタイムラインが自発発火マーカー行/ゴースト行を描く材料・domain-d.md §）。scheduler の
   * onFireRequest と speak-now の発火が共有する。fire() 自体は best-effort（throw は握る・自発発火の
   * 失敗で常駐を殺さない）。結果（fired/reason）が判明してから broadcast する（同期 throw も非同期
   * rejection もどちらも "fired:false" として扱う）。
   * @param {string | undefined} kind
   * @param {{ vision?: boolean | "preferred"; instruction?: string; cause?: object }} fireOptions  vision:false（と省略）は画面を撮らない通常発火
   *   （思い出しの係）。speak-now は相槌も含めて画面を見る "preferred"（相槌は 2026-10-17 改め）。instruction はその 1 回だけ
   *   先頭に付ける内部指示（相槌・コメント反応・思い出し）。cause はきっかけ（orchestrator が受理・遅延に載せる）。
   * @param {object} [extra]  selfFire SSE に足す付随情報（コメント反応の commentIds = どのコメントで発火したか）。
   * @returns {Promise<any>}  発火の結果を放送し終えたら、その結果で片付く（reject しない・失敗は
   *   `{ fired:false, reason:"error" }`）。思い出しの係が「忙しかったか・受理されたか」を見る。
   */
  function requestSelfFire(kind, fireOptions, extra = {}) {
    try {
      return trackFire(() => /** @type {any} */ (fireOrchestrator).fire(fireOptions))
        .then((result) => {
          const fireId = result && typeof (/** @type {any} */ (result).fireId) === "number" ? /** @type {any} */ (result).fireId : null;
          broadcast("selfFire", {
            kind,
            fired: !!(result && /** @type {any} */ (result).fired),
            reason: result && /** @type {any} */ (result).reason != null ? /** @type {any} */ (result).reason : null,
            ...extra,
            // 受理した発火の番号（受理・返事・遅延と結ぶ）。受理しなかった発火には付けない。
            ...(fireId != null ? { fireId } : {})
          });
          return result;
        })
        .catch((error) => {
          broadcast("selfFire", { kind, fired: false, reason: "error", message: errMessage(error), ...extra });
          return { fired: false, reason: "error" };
        });
    } catch (error) {
      broadcast("selfFire", { kind, fired: false, reason: "error", message: errMessage(error), ...extra });
      return Promise.resolve({ fired: false, reason: "error" });
    }
  }

  /**
   * fire() を呼び、Promise が片付くまでを fireInFlight に数える（speak-now の「忙しい」用）。片付いたら
   * speak-now に「手が空いたかも」を知らせる。同期 throw は数を戻してそのまま投げ直す（呼び出し側の
   * 既存の握り方を変えない）。
   * @param {() => any} start
   * @returns {Promise<any>}
   */
  function trackFire(start) {
    fireInFlight += 1;
    /** @type {Promise<any>} */
    let p;
    try {
      p = Promise.resolve(start());
    } catch (error) {
      fireInFlight -= 1;
      throw error;
    }
    return p.finally(() => {
      fireInFlight -= 1;
      if (speakNow) speakNow.notifyIdle();
      if (commentReact) commentReact.notifyIdle();
      if (recallDesk) recallDesk.notifyIdle();
    });
  }

  // 残量: 変わったら SSE "quota" で流し、残量の警告を決め直す（cockpit-glance-redesign.md §9.2）。
  if (quotaSource && typeof quotaSource.onChange === "function") {
    try {
      quotaUnsub = quotaSource.onChange((q) => {
        if (closed) return;
        broadcast("quota", q ?? null);
        refreshStateWarnings();
      });
    } catch {
      quotaUnsub = null;
    }
  }

  /**
   * 話し始めの方式を切り替える（POST /api/speak-start の実体）。scheduler の turn-end / call /
   * interjection のスイッチを合わせ、speak-now の積み残しを捨てる。
   * @param {"classic" | "speak-now"} mode
   */
  function applySpeakStartMode(mode) {
    speakStartMode = mode;
    if (fireScheduler) fireScheduler.setSpeakNowMode(mode === "speak-now");
    if (speakNow) speakNow.reset();
    if (commentReact) commentReact.reset();
  }

  /** 今の頭の名前（判定の問いと会話のラベル用・snapshot の identity と同じ解決）。 */
  function currentSoulName() {
    if (currentBrainIdentityImpl) return resolveModelIdentity(currentBrainIdentityImpl()?.id).canonicalName;
    const rawBrain = typeof brainStatusImpl === "function" ? brainStatusImpl() ?? null : null;
    return resolveBrainIdentity(rawBrain && typeof rawBrain === "object" ? /** @type {any} */ (rawBrain).brain : undefined)
      .canonicalName;
  }

  /** 判定ごとの記録を呼び出し側（cockpit.mjs のターミナル 1 行）へ渡す（本文は含めない・失敗寛容）。 */
  function reportSpeakNow(/** @type {object} */ info) {
    if (!onSpeakNowJudgment) return;
    try {
      onSpeakNowJudgment(info);
    } catch {
      // ログの失敗で判定を止めない。
    }
  }

  /** コメント判定ごとの記録を呼び出し側（cockpit.mjs のターミナル 1 行）へ渡す（本文は含めない・失敗寛容）。 */
  function reportComment(/** @type {object} */ info) {
    if (!onCommentJudgment) return;
    try {
      onCommentJudgment(info);
    } catch {
      // ログの失敗で判定を止めない。
    }
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

  //  ── コメント判定（discussion/ai-cohost/decisions/comment-react/integration.md §1）──────────────
  //  (a) の前に**弾く判定**（commentGuard）を挟む。全モード（KILL 中・自発 OFF・従来モードも）で動く。
  //   - 弾いたら: 積まない（LLM・記憶・履歴のどれにも入らない）・発火判定にも渡さない・場の活動にも数えない。
  //     フィードには chatDiagnostic kind:"commentRejected"（種類だけ・本文は送らない）。
  //   - 通ったら: (a)(b)(c) を今と同じく行い、speak-now モードなら (d) 反応する判定（commentReact）へ回す。
  //   - 判定は並行に走らせるが、積むのは届いた順（guardQueue の先頭から、判定が付いたものだけ取り出す）。
  //   - 判定がテスト注入の同期値なら、その場で (a)(b)(c) まで終える（従来の同期の追記と放送を保つ）。
  //  コメント ID（チャット器官の messageId・無ければ操縦席内の連番）を viewer 行・弾いた行・判定行・発火結果に
  //  載せ、どのコメントで判定して発火したかを結べるようにする（合意 §3）。

  /**
   * チャット器官の 1 コメントを取り込む（Domain C の onMessage フックから呼ぶ attach 点）。best-effort
   * （throw は握って診断に落とす・器官の常駐を殺さない）。フックは戻り値を見ないので、非同期の判定の
   * 失敗もここで握る（settleGuard へ「判定できず」として渡す）。
   * @param {{ text?: string; displayName?: string; messageId?: string | null } | null} msg
   */
  function ingestChatMessage(msg) {
    if (closed) return;
    try {
      const text = msg && typeof msg.text === "string" ? msg.text : "";
      const displayName = msg && typeof msg.displayName === "string" ? msg.displayName : undefined;
      if (text.trim().length === 0) return; // 空コメントは捨てる（バッファも捨てる・二度手間を避ける）。
      const buffer = pipeline ? pipeline.transcriptBuffer : null;
      if (!buffer) {
        // 耳未起動 = 合流先の正本バッファが無い。UI にゴースト行を出し、判定・append/scheduler はスキップ。
        handleDiagnostic({
          type: "chatBufferAbsent",
          message: "ears not running; viewer comment cannot merge into transcript buffer (no fire).",
          reason: displayName ?? null
        });
        return;
      }
      const id =
        msg && typeof msg.messageId === "string" && msg.messageId.length > 0 ? msg.messageId : `local-${++localCommentSeq}`;
      const slot = { id, text, displayName, arrivedAtMs: nowImpl(), decision: null };
      guardQueue.push(slot);
      /** @type {any} */
      let out;
      try {
        out = commentGuard({ text, displayName: displayName ?? null, name: currentSoulName() });
      } catch (error) {
        out = { pass: false, kind: "error", error: errMessage(error), latencyMs: null };
      }
      if (out != null && typeof out.then === "function") {
        Promise.resolve(out).then(
          (decision) => settleGuard(slot, decision),
          (error) => settleGuard(slot, { pass: false, kind: "error", error: errMessage(error), latencyMs: null })
        );
      } else {
        settleGuard(slot, out);
      }
    } catch (error) {
      handleDiagnostic({ type: "chatIngestError", message: errMessage(error) });
    }
  }

  /**
   * 弾く判定の結果を付け、届いた順に取り出せる分を処理する。
   * @param {{ id: string; text: string; displayName: string | undefined; arrivedAtMs: number; decision: any }} slot
   * @param {any} decision
   */
  function settleGuard(slot, decision) {
    if (closed) return;
    const pass = !!(decision && decision.pass === true);
    slot.decision = {
      pass,
      kind: pass ? "ok" : decision && typeof decision.kind === "string" && decision.kind !== "ok" ? decision.kind : "error",
      verdict: decision && typeof decision.verdict === "string" ? decision.verdict : null,
      hijackProbability: decision && typeof decision.hijackProbability === "number" ? decision.hijackProbability : null,
      latencyMs: decision && typeof decision.latencyMs === "number" ? decision.latencyMs : null,
      // 判定できなかった理由に本文が混ざっていたら（サーバの文言が入力を引用した等）理由ごと伏せる（フィードにも
      // ターミナルにも本文を出さない）。
      error: decision && typeof decision.error === "string" ? scrubCommentText(decision.error, slot.text) : null
    };
    while (guardQueue.length > 0 && guardQueue[0].decision != null) {
      const head = /** @type {any} */ (guardQueue.shift());
      try {
        reportComment({
          stage: "guard",
          commentId: head.id,
          pass: head.decision.pass,
          kind: head.decision.kind,
          verdict: head.decision.verdict,
          hijackProbability: head.decision.hijackProbability,
          latencyMs: head.decision.latencyMs,
          error: head.decision.error
        });
        if (head.decision.pass) commitComment(head);
        else rejectComment(head);
        // 判定できずに弾いた（キー欠落・タイムアウト等）は判定のエラーの警告にも出す（理由は本文を伏せた文言）。
        if (!head.decision.pass && head.decision.kind === "error") warnJudgeError("comment-guard", head.decision.error);
      } catch (error) {
        handleDiagnostic({ type: "chatIngestError", message: errMessage(error) });
      }
    }
  }

  /**
   * 弾いたコメントをフィードに 1 行だけ知らせる（種類と ID・本文と名前は送らない）。
   * @param {{ id: string; text: string; decision: any }} slot
   */
  function rejectComment(slot) {
    broadcast("chatDiagnostic", {
      kind: "commentRejected",
      message: null,
      atMs: nowImpl(),
      delayMs: null,
      attempt: null,
      commentId: slot.id,
      reject: slot.decision.kind,
      error: slot.decision.error,
      latencyMs: slot.decision.latencyMs
    });
  }

  /**
   * 通ったコメントを今と同じく積んで放送し、発火判定へ回す（(a)(b)(c)）。speak-now モードなら反応する判定へ（(d)）。
   * @param {{ id: string; text: string; displayName: string | undefined; arrivedAtMs: number }} slot
   */
  function commitComment(slot) {
    const { text, displayName } = slot;
    const buffer = pipeline ? pipeline.transcriptBuffer : null;
    if (!buffer) {
      // 判定を待つ間に耳が止まった = 合流先が無い（取り込み時と同じ扱い）。
      handleDiagnostic({
        type: "chatBufferAbsent",
        message: "ears not running; viewer comment cannot merge into transcript buffer (no fire).",
        reason: displayName ?? null
      });
      return;
    }
    const result = buffer.append({ startMs: 0, endMs: 0, text, speaker: "viewer", displayName });
    if (!result.appended || !result.entry) return; // blank discard 等。
    // (b) viewer 行を放送（耳の onTranscript は viewer を除外＝ここが唯一の放送元）。commentId は追加フィールド。
    const stats = buffer.stats();
    broadcast("transcript", {
      ...toWireEntry(result.entry),
      latencyMs: null,
      audioCtx: null,
      appended: stats.appended,
      discarded: stats.discarded,
      commentId: slot.id
    });
    // (c) 発火スケジューラへ（従来モードは comment / comment-call 判定・speak-now モードは活動の反映だけ）。
    // scheduler 未生成なら活動反映もスキップ。
    if (fireScheduler) fireScheduler.handleChatMessage({ text, displayName });
    // (d) 反応する判定（speak-now モード・自発 ON・KILL でないときだけ・部品内で判定）。
    if (commentReact) {
      commentReact.handleComment({
        id: slot.id,
        seq: result.entry.seq,
        text,
        displayName: displayName ?? null,
        arrivedAtMs: slot.arrivedAtMs
      });
    }
  }

  /**
   * チャット器官の状態遷移を SSE "chatStatus" に載せる口（Domain C の onStatus フックから呼ぶ）。
   * 状態表示（connecting/live/retrying/dead）は Domain C が描く。
   * @param {string} status
   */
  function broadcastChatStatus(status) {
    if (closed) return;
    lastChatStatus = typeof status === "string" ? status : String(status);
    broadcast("chatStatus", { status: lastChatStatus });
    refreshStateWarnings();
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
    lastChatStatus = null;
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
        ingestChatMessage({
          text: msg && msg.text,
          displayName: msg && msg.displayName,
          // コメント ID（器官の messageId）を操縦席まで通す（判定と発火の結び付け・コメント反応の合意 §3）。
          messageId: msg && typeof msg.messageId === "string" ? msg.messageId : null
        })
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
     * 隙間で手動の圧縮（context-growth-2026-10.md §6）の材料（additive な内部 JS API・HTTP/SSE の契約ではない）。
     * soulIdle = orchestrator が idle で、サーバが呼んだ fire() も片付いている。judging = 話し始め・コメント反応の
     * 判定が進行中か積み残しがある、または弾く判定の待ち行列がある。userSpeaking / lastSpeechEndAtMs = 配信者の
     * VAD（耳が止まっていれば喋っていない扱い）。orchestrator 未注入なら null（圧縮しない）。
     * @returns {{ soulIdle: boolean; judging: boolean; userSpeaking: boolean; lastSpeechEndAtMs: number | null } | null}
     */
    getQuietGap() {
      if (!fireOrchestrator) return null;
      const judging =
        (speakNow != null && (speakNow.inFlight() > 0 || speakNow.pendingWhileBusy() > 0)) ||
        (commentReact != null && (commentReact.inFlight() > 0 || commentReact.heldCount() > 0)) ||
        guardQueue.length > 0;
      return {
        soulIdle: fireInFlight === 0 && fireOrchestrator.getState() === "idle",
        judging,
        userSpeaking: pipeline != null && userSpeaking,
        lastSpeechEndAtMs
      };
    },
    /**
     * 声の engine の状態を知らせる口（cockpit.mjs が engine の onStatus を繋ぐ・additive な内部 JS API）。
     * ElevenLabs の reconnecting / down は上の帯の警告になる（AivisSpeech は状態で警告を出さない）。reason に
     * キーや会話の本文を入れない前提（切断などの短い理由・警告の detail）。表示側でも制御文字を除き
     * VOICE_REASON_MAX_CHARS 字で切る。
     * @param {{ engine: string; status: string; reason?: string | null }} info
     */
    setVoiceEngineStatus(info) {
      if (closed || !info || typeof info.engine !== "string") return;
      const status = VOICE_STATUSES.includes(/** @type {any} */ (info.status)) ? /** @type {any} */ (info.status) : "unknown";
      const reason = clipVoiceReason(info.reason);
      if (voice.engine === info.engine && voice.status === status && voice.reason === reason) return;
      voice.engine = info.engine;
      voice.status = status;
      voice.reason = reason;
      broadcastState();
    },
    /**
     * 読みが取れず、口の時間割を簡易版にしたことを知らせる口（ElevenLabs engine の onReadingsFallback から）。
     * 一回きりの警告（60 秒・続けば回数を数える）。detail は出さない（文の本文を警告に載せない）。
     */
    reportVoiceReadingsFallback() {
      if (closed) return;
      warningBoard.pushEvent("tts-readings-fallback", {
        kind: "tts-readings-fallback",
        severity: "warn",
        message: "口の動きを簡易版にした（読みが取れない）",
        source: "elevenlabs"
      });
    },
    /**
     * 頭（Codex）の MCP の名前の読み取り（config/read）に失敗したことを知らせる口（記憶の作り直し Wave 2・
     * ユーザー決定 2026-10-21）。会話は続けるが、ユーザーの MCP サーバーが起動しうるので、上の帯に alert の
     * 一回きりの出来事として出す（60 秒・続けば回数を数える）。detail は出さない（設定の中身を警告に載せない）。
     */
    reportMcpConfigReadFailed() {
      if (closed) return;
      warningBoard.pushEvent("mcp-config-read", {
        kind: "mcp-config-read",
        severity: "alert",
        message: "MCP の一覧を読めなかった（ユーザーの MCP が起動しうる）",
        source: "codex"
      });
    },
    /** 記憶の現況（memoryStatus）が変わったことを知らせる口（記録中の始まり・終わり）。SSE "state" で押す。 */
    memoryStatusChanged() {
      if (closed) return;
      broadcastState();
    },
    /** fast の現況（codexFastStatus・モデルが priority を持つかが分かったとき等）が変わったことを知らせる口。SSE "state" で押す。 */
    codexFastStatusChanged() {
      if (closed) return;
      broadcastState();
    },
    /**
     * 圧縮の開始・終了をログのタブへ 1 行（SSE "diagnostic" type:"contextCompaction"）。
     * 数字と種類だけ（本文なし）。kind = "started" | "finished" | "failed"、elapsedMs = 所要時間。started には
     * inputTokens（直近の入力トークン）・thresholdTokens（そのときの目安）・ratio（窓に対する割合の参考）を載せる。
     * あわせて圧縮の最中か（snapshot の compacting・状態のピルの「圧縮中」）を started で true、
     * finished / failed で false にする（変わったら SSE "state"）。
     * @param {{ phase: "started" | "finished" | "failed"; inputTokens?: number | null; thresholdTokens?: number | null; ratio?: number | null; durationMs?: number | null; reason?: string | null; personaInjected?: boolean }} info
     */
    broadcastContextCompaction(info) {
      if (closed) return;
      const phase = info && typeof info.phase === "string" ? info.phase : null;
      if (phase === "started") setContextCompacting(true);
      else if (phase === "finished" || phase === "failed") setContextCompacting(false);
      broadcast("diagnostic", {
        type: "contextCompaction",
        message: null,
        reason: info && typeof info.reason === "string" ? info.reason : null,
        startMs: null,
        endMs: null,
        tag: null,
        kind: phase,
        elapsedMs: info && typeof info.durationMs === "number" ? info.durationMs : null,
        charsSpoken: null,
        totalChars: null,
        prefix: null,
        inputTokens: info && typeof info.inputTokens === "number" ? info.inputTokens : null,
        thresholdTokens: info && typeof info.thresholdTokens === "number" ? info.thresholdTokens : null,
        ratio: info && typeof info.ratio === "number" ? info.ratio : null,
        personaInjected: info?.personaInjected === true
      });
    },
    /**
     * 圧縮の最中の表示を戻す（頭のセッションを畳んで作り直すとき・cockpit.mjs）。畳んだセッションの圧縮は
     * もう続かないので、finished / failed が届かなくても「圧縮中」を出しっぱなしにしない。冪等。
     */
    resetContextCompaction() {
      setContextCompacting(false);
    },
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
      if (speakNow) {
        speakNow.dispose(); // 返事待ちの判定が後から返っても無視する（タイマは judge 側で畳まれる）。
        speakNow = null;
      }
      if (commentReact) {
        commentReact.dispose(); // speakNow と同じ（取っておいたコメントも捨てる）。
        commentReact = null;
      }
      if (recallDesk) {
        recallDesk.dispose(); // 走っている④の結果が後から返っても無視する（届ける列も捨てる）。
        recallDesk = null;
      }
      guardQueue = []; // 返事待ちの弾く判定は後から返っても settleGuard が closed で無視する。
      warningBoard.dispose(); // 一回きりの警告の消えるタイマを残さない。
      if (quotaUnsub) {
        try {
          quotaUnsub();
        } catch {
          // best-effort
        }
        quotaUnsub = null;
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
      callEarsHook(onEarsStopped);
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

/**
 * 判定の失敗理由にコメント本文が混ざっていたら理由ごと伏せる（本文はサーバから送らない・ログにも書かない）。
 * @param {string} message  @param {string} text
 */
function scrubCommentText(message, text) {
  const t = String(text).trim();
  return t.length > 0 && message.includes(t) ? "理由は伏せた（本文を含むため）" : message;
}

/** @param {unknown} err */
function errMessage(err) {
  return err instanceof Error ? err.message : String(err);
}
