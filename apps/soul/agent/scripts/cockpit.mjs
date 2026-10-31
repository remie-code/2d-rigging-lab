// @ts-check
/**
 * コクピット本番起動エントリ（S2.5 Domain B・人間ゲートの「起動コマンド 1 個」）— apps/soul/agent。
 *
 *   node apps/soul/agent/scripts/cockpit.mjs [--port N] [--channel <ws-url>] [...]
 *   （package.json scripts: `npm run cockpit --prefix apps/soul/agent`）
 *
 * 実 pipeline factory（createEarPipeline・既定）+ file-backed settings store + 実ページで
 * `createCockpitServer` を構成し、**127.0.0.1** に listen して**アクセス URL を標準出力に表示**する。
 * ユーザーはその URL をブラウザで開き、マイクを選んで Start を押す（CLI を一切触らない）。
 *
 * 実マイクが無い/未接続でもサーバ自体は起動しページは開ける（耳の Start を押すまで実デバイスに触れない）。
 * SIGINT（Ctrl+C）/ stdin EOF で clean close（ears-cli.mjs の型を踏襲・server.close() でハンドル解放）。
 *
 * ── S3: 発火（Fire）の本番結線 ─────────────────────────────────────────────
 *  fireOrchestratorFactory は**常に注入**する（実 createLlmSession（FIRE_SYSTEM_PROMPT・
 *  claude-opus-4-8 既定）+ connectChannel + 流し込みプレイヤー（createStreamPlayer）+ 声の差し替え口
 *  （createVoiceEngine・既定 AivisSpeech）+ SpeechStreamer）。Channel URL は
 *  `--channel <ws-url>`（後方互換の初期値）**または操縦席の URL 入力**（POST /api/channel）で渡せる。
 *
 *  ── S2.5 無退行【session/player の遅延生成】(S3 追撃 domain-c) ─────────────────
 *  操縦席から URL を後入力する構造にすると「fire を常時受けられる」形になるが、**URL も fire も
 *  使わないユーザー（S2.5 挙動）に LLM セッションの spawn（≈12s）を強いてはならない**。よって
 *  session/player は `ensureFireResources()` で**遅延生成**する:
 *    - `--channel` 明示指定時のみ起動時に eager 生成（従来どおり TTFT 先払い・挙動不変）。
 *    - それ以外（URL 未設定 / settings 復元 / 操縦席入力）は**初回 fire 時**に生成。
 *  声の差し替え Wave 2: 流し込みプレイヤー（起動に約 0.5 秒）と声の差し替え口は耳の Start のときに作る
 *  （最初の Fire に乗せない・申し送り 1）。Start より前の Fire は従来どおりその場で作る。
 *  声の差し替え Wave 3: 声の方式（設定キー `ttsEngine`・AivisSpeech / ElevenLabs）は耳の Start で読み、
 *  種類が前回と違えば engine を作り直す（createVoiceEngineManager）。ElevenLabs のキーは engine を作るときに読む
 *  （種類が同じでも、落ちた（down の）ElevenLabs の engine は Start で作り直し、キーを読み直す）。
 *  URL 未設定のまま fire しても発話の送出前に session.ask で弾く（lazyChannel が URL 未設定を
 *  明示エラーにする前に、ここで no-URL を検出して spawn しない）。→ S2.5 ユーザーは何も spawn しない。
 *  配信の組み直し Domain C: この URL の確かめは**ロールに体があるときだけ**（stream-restructure.md §4）。体の無い
 *  ロールは器を使わないので、URL が無くても頭に聞き、発火を受理し、手元の再生器だけで鳴らす（器は運び手・
 *  発火に渡さない・§resolveFireChannel）。体があるときの断りと文面は今のまま。
 *
 *  ── Channel URL の記憶（settings）──────────────────────────────────────────
 *  URL はマイク選択と同じ file-backed settings（`cockpit-settings.local.json`・.gitignore 済み・
 *  token を含むためコミットしない）に `lastChannelUrl` として記憶し、次回起動で初期値に復元する。
 *  `--channel` 指定があればそれを初期値に（＋ settings にも載せる）。UI/ログは redactToken を通す。
 *
 *  ── 接続タイミングの設計判断【lazy connect】───────────────────────────────
 *  channel は **初回 fire 時に接続し成功をキャッシュする lazy proxy**（createLazyChannel）。接続失敗は
 *  キャッシュせず throw → orchestrator が fireError 診断に落とす（起動は止めない・操縦席のゴースト行で
 *  見える・次の fire で再試行 = 器を後から立てても操縦席の再起動不要）。URL 変更（setUrl）時は既存
 *  接続キャッシュを破棄し次回 fire で再接続する。
 */

import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";

import { createCockpitServer, DEFAULT_COCKPIT_PORT } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore, DEFAULT_SETTINGS_PATH } from "../src/cockpit/cockpit-settings-store.mjs";
import { cockpitHtmlPath } from "../src/cockpit/cockpit-page.mjs";
import { assertSubscriptionAuthEnv } from "../src/mind/env-guard.mjs";
import { createLlmSession } from "../src/mind/llm-session.mjs";
import { BRAINS } from "../src/mind/brains.mjs";
import { buildFireSystemPrompt, createFireOrchestrator } from "../src/mind/fire-orchestrator.mjs";
import { MODEL_IDENTITIES } from "../src/mind/model-identity.mjs";
import {
  DEFAULT_ROLES_DIR,
  createRoleInstructionStore,
  listRoles,
  normalizeRole,
  readRole,
  roleFromIdentity,
  roleIdentity,
  roleToJson,
  writeRole
} from "../src/roles/role-store.mjs";
import {
  DEFAULT_MIGRATION_BACKUP_ROOT,
  formatStartupMigrationReport,
  migrationBackupDir,
  runStartupMigration
} from "../src/roles/role-migration.mjs";
import { createFireDiagnostics } from "../src/mind/fire-diagnostics.mjs";
import {
  createContextCompactor,
  normalizeCompactThresholdTokens,
  DEFAULT_COMPACT_THRESHOLD_TOKENS,
  DEFAULT_COMPACT_QUIET_MS,
  DEFAULT_COMPACT_MIN_INTERVAL_MS
} from "../src/mind/context-compactor.mjs";
import { createSessionUsageLog, fireUsageRecord, compactionUsageRecord, replyLatencyUsageRecord } from "../src/mind/session-usage-log.mjs";
import { resolveLatencyThresholds } from "../src/mind/fire-latency.mjs";
import { createQuotaMonitor, fetchElevenLabsSubscription } from "../src/cockpit/quota.mjs";
import { createResidentCapture } from "../src/eyes/resident-capture.mjs";
import { FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "../src/mind/fire-injection.mjs";
import { connectChannel, redactToken } from "../src/channel/channel-client.mjs";
import { createStreamPlayer } from "../src/voice/stream-player.mjs";
import { createVoiceEngine } from "../src/voice/engines/voice-engine.mjs";
import { createTtsClient } from "../src/voice/tts-client.mjs";
import { loadElevenLabsApiKey } from "../src/ears/elevenlabs-stt.mjs";
import { STT_ENGINES } from "../src/ears/ear-pipeline.mjs";
import { createLiveChatClient } from "../src/chat/live-chat-client.mjs";
import { writeStreamRecord, createStreamRecordIdentity } from "../src/mind/memory.mjs";
import { DEFAULT_MEMORY_DIR, memoryDirForRole, prepareMemoryFolder } from "../src/memory/memory-store.mjs";
import { MCP_CONFIG_READ_FAILED_WARNING, sweepCodexRollouts } from "../src/mind/codex-session.mjs";
import { runRecall } from "../src/mind/recall.mjs";
import { appendSoulSkills, listSoulSkills, loadSoulSkills, soulSkillNamesForBody } from "../src/mind/soul-skills.mjs";

/**
 * 配信間記憶: 定期保存の間隔（裁定4「15〜30分ごと」の中庸・inventory §2-4 の 20 分固定）。
 */
export const MEMORY_CHECKPOINT_INTERVAL_MS = 20 * 60 * 1000;

/**
 * 配信間記憶: Ctrl+C の最後の保存を待つ上限（best-effort・shutdown が固まらない）。
 * ②書き出し役は使い捨ての Codex のセッションを起こし、`_conventions.md`・目次・本体をツールで読み書きする。
 * 実機の参考は、書き出しの turn だけで約 21 秒、セッションの起動から後片付けまでで約 41 秒（短いダミーの材料・
 * memory-recall-inventory.md §6・Wave 1 Domain A 報告 §2.2）。配信 1 本分の材料ではもう少し延びうるうえ、
 * Ctrl+C の時点で定期保存などが走っていれば、その終わりを待ってから最後の 1 回が走る（保存は直列）。
 * そこで 1 回分の約 2 倍の 90 秒にする。待っている間にもう一度 Ctrl+C を押せば待たずに終わる。
 * ②が書かずに答えたときの 1 回だけのやり直し（writeStreamRecord）もこの枠の中で走り、収まらなければ打ち切りが優先する。
 */
export const SHUTDOWN_MEMORY_TIMEOUT_MS = 90_000;

/**
 * Compose the system prompt for one newly-created brain session.
 *
 * 配信の組み直し Domain A: 名前と性格の指示はロールから引く（頭の id から名前を決めない）。本番の
 * ensureFireResources() は今のロールの名前（roleIdentity）と instructions.md の本文でこれを呼ぶ。
 *
 * 記憶の作り直し Wave 2: 起動時に直近の記録を載せる仕組みは撤去した（①は配信の最初に記憶を持たない・
 * recall-flow.md §7）。人格の指示は「名前 + 会話指示」に、Wave 3 で魂の教え（skills/ の `<recall>` の使い方・
 * soul-skills.mjs）を足した。教えは名前の一文と同じく魂が足す固定の部分で、会話指示を書き換えても消えない。
 *
 * @param {unknown} identity  ロールの名前（roleIdentity の形）。形が壊れていれば既定（コーディ）。
 * @param {string} [instructionBody]  性格の指示（無い・空なら既定の本文）。
 * @param {string} [skillsText]  足す教え（既定は skills/ から読む）。
 * @returns {string}
 */
export function buildRoleSessionSystemPrompt(identity, instructionBody = undefined, skillsText = undefined) {
  return appendSoulSkills(buildFireSystemPrompt(identity, instructionBody), skillsText ?? loadSoulSkills());
}

/** @param {string[]} argv */
export function parseCockpitArgs(argv) {
  const args = {
    port: /** @type {number | undefined} */ (undefined),
    help: false,
    open: false,
    /** @type {string | undefined} */ channel: undefined,
    /** @type {string | undefined} */ ttsBaseUrl: undefined,
    /** @type {string | undefined} */ speaker: undefined,
    /** @type {number | undefined} */ fireWindowMin: undefined,
    /** @type {number | undefined} */ fireMaxChars: undefined
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--open") args.open = true;
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--channel") args.channel = argv[++i];
    else if (a === "--tts-base-url") args.ttsBaseUrl = argv[++i];
    else if (a === "--speaker") args.speaker = argv[++i];
    else if (a === "--fire-window-min") args.fireWindowMin = Number(argv[++i]);
    else if (a === "--fire-max-chars") args.fireMaxChars = Number(argv[++i]);
  }
  return args;
}

/**
 * Windows launcher: open the actual listening URL without a shell or extra console.
 * A browser-launch failure must not stop the already-running server.
 * @param {string} url
 * @param {typeof execFile} [execFileImpl]
 * @param {(message: string) => void} [warn]
 */
export function openCockpitBrowser(url, execFileImpl = execFile, warn = (message) => process.stderr.write(message)) {
  const onFailure = (error) => {
    if (error) warn(`[cockpit] Could not open the browser. Open ${url} manually: ${error.message}\n`);
  };
  try {
    execFileImpl("rundll32.exe", ["url.dll,FileProtocolHandler", url], { windowsHide: true }, onFailure);
  } catch (error) {
    onFailure(error);
  }
}

/**
 * 初回 sendSpeech で接続し、成功した接続をキャッシュする lazy チャネル（S3 設計判断・ヘッダ注記）。
 * 接続失敗はキャッシュせず throw（次回 fire で再試行）。close() は接続済みのときだけ畳む。
 *
 * S3 追撃 domain-c: URL を**後から設定/変更**できる（操縦席入力）。setUrl(url) で URL を差し替えると
 * 既存の接続キャッシュを破棄し、次回 fire で新 URL に再接続する（旧接続は best-effort で畳む）。
 * URL 未設定（null）で sendSpeech は**明示エラー**（操縦席で URL を入れる前の発火を弾く）。
 *
 * @param {string | null | undefined} url  初期 Channel URL（`ws://127.0.0.1:<port>/channel?token=..`）。
 *   未設定（null/undefined/空）なら操縦席から setUrl されるまで sendSpeech はエラー。
 * @param {object} [options]
 * @param {typeof connectChannel} [options.connectImpl]  接続実装（テスト注入・既定 connectChannel）。
 * @param {(event: string, fields?: Record<string, unknown>) => void} [options.onTrace] passive diagnostics hook.
 * @returns {{
 *   sendSpeech: (timeline: unknown) => Promise<any>;
 *   openSpeech: (utteranceId: string) => Promise<any>;
 *   appendSpeech: (utteranceId: string, timeline: unknown) => Promise<any>;
 *   endSpeech: (utteranceId: string) => Promise<any>;
 *   sendEnvelope: (intent: unknown) => Promise<any>;
 *   sendSet: (intent: unknown) => Promise<any>;
 *   setUrl: (next: string | null | undefined) => void;
 *   getUrl: () => string | null;
 *   connectionStatus: () => string;
 *   connectionGeneration: () => number;
 *   acceptedConnectionGeneration: () => number;
 *   connect: () => Promise<void>;
 *   close: () => Promise<void>;
 * }}
 */
export function createLazyChannel(url, options = {}) {
  const connectImpl = options.connectImpl ?? connectChannel;
  const onTrace = options.onTrace;
  let currentUrl = typeof url === "string" && url.length > 0 ? url : null;
  /** @type {Promise<{ sendSpeech: Function; sendEnvelope: Function; close: () => Promise<void> }> | null} */
  let channelPromise = null;
  /** @type {"unset" | "idle" | "connecting" | "connected" | "error"} */
  let connState = currentUrl == null ? "unset" : "idle";
  let connectionGeneration = 0;

  const ensure = () => {
    if (currentUrl == null) {
      // URL 未設定で sendSpeech は明示エラー（操縦席で URL を入れる前の発火を弾く）。
      return Promise.reject(
        new Error("createLazyChannel: channel URL is not set (set it in the cockpit before firing).")
      );
    }
    if (channelPromise == null) {
      connState = "connecting";
      connectionGeneration += 1;
      const pending = Promise.resolve(connectImpl(currentUrl, { onTrace, connectionGeneration }))
        .then((channel) => {
          if (channelPromise === pending) connState = "connected";
          return channel;
        })
        .catch((error) => {
          // A superseded URL/connection must never clear a newer cache.
          if (channelPromise === pending) {
            channelPromise = null; // 失敗は非キャッシュ = 次回 fire で再接続を試みる。
            connState = "error";
          }
          throw error;
        });
      channelPromise = pending;
    }
    return channelPromise;
  };

  const terminalConnectionCodes = new Set([
    "channel_closed",
    "channel_socket_error",
    "channel_send_failed",
    "reply_timeout"
  ]);
  const invalidateExact = (pending, error) => {
    if (channelPromise !== pending || !terminalConnectionCodes.has(error?.code)) return;
    channelPromise = null;
    connState = "error";
    Promise.resolve(pending)
      .then((channel) => channel.close())
      .catch(() => {});
  };
  const delegate = async (method, ...values) => {
    const pending = ensure();
    const channel = await pending;
    try {
      return await channel[method](...values);
    } catch (error) {
      // Never retry an ambiguous request. Only retire the exact failed cached
      // generation; the next Fire/request is allowed to connect once afresh.
      invalidateExact(pending, error);
      throw error;
    }
  };

  return {
    async sendSpeech(timeline) {
      return delegate("sendSpeech", timeline);
    },
    /**
     * intent.speechStream（声の差し替え Wave 2・発話の流し込み）。sendSpeech と同型に ensure()→接続へ委譲。
     * 同じ接続の上で呼んだ順に送られる（open → append… → end）。
     * @param {string} utteranceId
     */
    async openSpeech(utteranceId) {
      return delegate("openSpeech", utteranceId);
    },
    /** @param {string} utteranceId @param {unknown} timeline */
    async appendSpeech(utteranceId, timeline) {
      return delegate("appendSpeech", utteranceId, timeline);
    },
    /** @param {string} utteranceId */
    async endSpeech(utteranceId) {
      return delegate("endSpeech", utteranceId);
    },
    /**
     * intent.envelope を送る（S4 表情演出）。sendSpeech と同型に ensure()→接続へ委譲。
     * orchestrator が channel.sendEnvelope をスロット毎に呼ぶ。
     * @param {unknown} intent
     */
    async sendEnvelope(intent) {
      return delegate("sendEnvelope", intent);
    },
    /**
     * intent.set を送る（S6 barge-in の口閉じ）。sendSpeech/sendEnvelope と同型に ensure()→接続へ委譲。
     * orchestrator の interrupt() が mouth-open へ value=0 を着弾させるために呼ぶ。
     * @param {unknown} intent
     */
    async sendSet(intent) {
      return delegate("sendSet", intent);
    },
    /**
     * URL を後から設定/変更する。変更時は既存接続キャッシュを破棄（次回 fire で新 URL に再接続）。
     * 同一 URL は現状維持（接続を切らない）。空/null はクリア（以後 sendSpeech は明示エラー）。
     * @param {string | null | undefined} next
     */
    setUrl(next) {
      const normalized = typeof next === "string" && next.length > 0 ? next : null;
      if (normalized === currentUrl) return;
      const previous = channelPromise;
      channelPromise = null;
      currentUrl = normalized;
      connState = normalized == null ? "unset" : "idle";
      if (previous) {
        // 旧接続は畳む（未接続/接続失敗なら畳むものはない）。fire 経路をブロックしないよう非同期に。
        Promise.resolve(previous)
          .then((channel) => channel.close())
          .catch(() => {});
      }
    },
    /** 現在の URL（生・内部用。UI/ログには redactToken を通すこと）。 */
    getUrl() {
      return currentUrl;
    },
    /** 接続の現況（unset/idle/connecting/connected/error）。操縦席の状態表示用。 */
    connectionStatus() {
      return connState;
    },
    connectionGeneration() {
      return connectionGeneration;
    },
    /**
     * This accepted Fire's exact logical connection generation. A cached
     * connection keeps its generation; an idle proxy reserves the one ensure()
     * will allocate on that Fire's first send without connecting early.
     */
    acceptedConnectionGeneration() {
      return channelPromise == null ? connectionGeneration + 1 : connectionGeneration;
    },
    /**
     * 今の URL で器につないでおく（配信の組み直し Domain D:「配信を始める」で体のあるロールの器を確かめる口）。
     * つながっていればそのまま。URL が無い・つながらない（runtime-player が起動していない・channel が開いていない・
     * hello が来ない）なら投げる（失敗は非キャッシュ = 次の始める / Fire でもう一度つなぐ）。
     * @returns {Promise<void>}
     */
    async connect() {
      await ensure();
    },
    /**
     * 接続を畳む。URL はそのまま残し、次の送信（か connect）でつなぎ直せる（配信の組み直し Domain D: 場の終わりで畳み、
     * 次の場の始まりでつなぐ）。
     */
    async close() {
      if (channelPromise == null) return;
      const pending = channelPromise;
      channelPromise = null;
      connState = currentUrl == null ? "unset" : "idle";
      try {
        const channel = await pending;
        await channel.close();
      } catch {
        // 未接続（接続失敗）だった場合は畳むものがない。
      }
    }
  };
}

/** 体のあるロールで器の URL が無いまま発火したときの断りの文面（今と同じ）。 */
export const CHANNEL_URL_NOT_SET_MESSAGE = "Channel URL is not set — set it in the cockpit (Channel field) before firing.";

/**
 * 受理する Fire の器を決める（配信の組み直し Domain C・stream-restructure.md §4）。
 *  - 体あり: 今どおり、器の URL が無ければ断る（受理しない）。器（lazyChannel）と受理の時点の URL を返す。
 *  - 体なし: 器を使わない。URL の有無を見ず、器は渡さない（channel: null）。運び手は手元の再生器だけで鳴らす。
 * @param {object} options
 * @param {boolean} options.body  受理の時点のロールの体の有無。
 * @param {{ getUrl: () => string | null }} options.channel  器（lazyChannel）。
 * @returns {{ body: boolean; channel: any | null; channelUrl: string | null }}
 */
export function resolveFireChannel({ body, channel }) {
  if (body === false) return { body: false, channel: null, channelUrl: null };
  const channelUrl = channel.getUrl();
  if (channelUrl == null) throw new Error(CHANNEL_URL_NOT_SET_MESSAGE);
  return { body: true, channel, channelUrl };
}

/**
 * session.ask への透過プロキシを作る（S3 の Channel URL 未設定チェック + 遅延生成は不変）。
 * S5: `ask(input)` は文字列（通常 Fire）と content ブロック配列（視覚発火）の両方を素通しする。
 * Progressive Speech C1: additive な ask options（onTextDelta）も同じ session へ透過する。
 * （分岐しない＝透過。型ガードは session 側が担う）。
 * @param {object} options
 * 配信の組み直し Domain C: URL の確かめは `hasBody()` が true のとき（今のロールに体があるとき）だけ。体なしは
 * URL が無くても頭に聞く。hasBody を渡さなければ今どおり（いつも確かめる）。
 * @param {() => string | null} options.getUrl  現在の Channel URL（lazyChannel.getUrl）。
 * @param {() => boolean} [options.hasBody]  今のロールに体があるか（聞くたびに読む・既定 いつも true）。
 * @param {() => void} options.ensureFireResources  session/player の遅延生成（冪等）。
 * @param {() => void | Promise<void>} [options.ensureSessionCurrent] 次の accepted Fire の設定反映。
 * @param {() => { ask: (input: string | Array<any>, askOptions?: object) => Promise<any> } | null} options.getSession
 * @returns {{ ask: (input: string | Array<any>, askOptions?: object) => Promise<any> }}
 */
export function createSessionProxy(options) {
  const { getUrl, ensureFireResources, getSession, ensureSessionCurrent } = options;
  const hasBody = typeof options.hasBody === "function" ? options.hasBody : () => true;
  return {
    /** @param {string | Array<any>} input @param {object} [askOptions] */
    async ask(input, askOptions) {
      if (typeof ensureSessionCurrent === "function") {
        await ensureSessionCurrent();
      }
      if (hasBody() !== false && getUrl() == null) {
        throw new Error(CHANNEL_URL_NOT_SET_MESSAGE);
      }
      ensureFireResources();
      return /** @type {any} */ (getSession()).ask(input, askOptions);
    }
  };
}

/**
 * Track the in-process effective instruction revision. Callers must invoke
 * `markPersisted()` only after a durable settings write succeeds; failed
 * writes leave the revision unchanged and therefore cannot invalidate a live
 * session.
 */
export function createInstructionRevisionController(initialRevision = 0) {
  let revision = Number.isInteger(initialRevision) && initialRevision >= 0 ? initialRevision : 0;
  return {
    getRevision() {
      return revision;
    },
    markPersisted() {
      revision += 1;
      return revision;
    }
  };
}

/**
 * Adapt the file-backed settings store to the dedicated Cockpit instruction
 * surface. Persistence owns validation and durable writes; this thin seam is
 * responsible only for incrementing the effective revision after success.
 *
 * Wave 3 仕上げ（記憶の作り直し）: 魂が①の固定の指示にいつも足す教え（skills/）を、会話指示の編集画面に読むだけで
 * 見せるため、getSoulSkills で名前・置き場・本文を返す（①に足すものと同じ listSoulSkills から読む・編集はできない）。
 *
 * 配信の組み直し Domain A: 会話指示はロールの性格の指示（roles/<id>/instructions.md）になった。本番は
 * role-store.mjs の createRoleInstructionStore を置き場の口として渡し、鍵はロールの id。置き場の口が
 * `isKnownConversationInstructionId` を持てば、知らない id を isKnownId で断れる（API の 400）。
 *
 * @param {object} settings  置き場の口（getConversationInstructionProfile / set… / reset…）。
 * @param {() => string} getRoleId  今のロールの id。
 * @param {ReturnType<typeof createInstructionRevisionController>} [revision]
 * @param {() => Array<{ name: string; path: string; body: string }>} [getSoulSkills]  テスト注入（既定 listSoulSkills）。
 */
export function createConversationInstructionHooks(
  settings,
  getRoleId,
  revision = createInstructionRevisionController(),
  getSoulSkills = () => listSoulSkills()
) {
  const store = /** @type {any} */ (settings);
  const currentId = () => getRoleId();
  return {
    /** 知っている id か（置き場の口が知らなければ、形の確かめは API に任せて通す）。 @param {string} id */
    isKnownId(id) {
      return typeof store.isKnownConversationInstructionId === "function"
        ? store.isKnownConversationInstructionId(id) === true
        : true;
    },
    getProfile(brainId = currentId()) {
      return store.getConversationInstructionProfile(brainId);
    },
    getOverrides() {
      return store.getConversationInstructionOverrides();
    },
    save(brainId, instruction) {
      const persisted = store.setConversationInstruction(brainId, instruction);
      if (persisted === true) revision.markPersisted();
      return persisted;
    },
    reset(brainId) {
      const persisted = store.resetConversationInstruction(brainId);
      if (persisted === true) revision.markPersisted();
      return persisted;
    },
    getRevision() {
      return revision.getRevision();
    },
    getSoulSkills() {
      return getSoulSkills();
    }
  };
}

/**
 * settings の視覚発火対象ウインドウ（visionTarget）を、cockpit-server の口
 * （onSetVisionTarget/visionTargetStatus）と fire-orchestrator の口（getVisionTarget）へ橋渡しする
 * （S5「目が開く」・Domain C 前半）。Channel URL の onSetChannelUrl/channelStatus と同型の薄い配線層
 * （テスト可能化のため main() から抽出・export）。
 *
 * @param {{ getVisionTarget: () => string | null; setVisionTarget: (title: string | null) => void }} settings
 * @returns {{
 *   getVisionTarget: () => string | null;
 *   onSetVisionTarget: (title: string | null) => void;
 *   visionTargetStatus: () => { title: string | null };
 * }}
 */
export function createVisionTargetHooks(settings) {
  return {
    /** fire-orchestrator の getVisionTarget（対象タイトルの解決関数）。 */
    getVisionTarget: () => settings.getVisionTarget(),
    /** cockpit-server の onSetVisionTarget（POST /api/vision-target が呼ぶ）。 */
    onSetVisionTarget: (title) => {
      try {
        settings.setVisionTarget(title ?? null); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetChannelUrl と同型の失敗寛容）。
      }
    },
    /** cockpit-server の visionTargetStatus（state snapshot に載せる現況）。 */
    visionTargetStatus: () => ({ title: settings.getVisionTarget() })
  };
}

/**
 * settings の出力デバイス（audioDevice）を、cockpit-server の口（onSetAudioDevice/audioDeviceStatus）へ
 * 橋渡しする（S6「会話が続く」・Domain D。visionTarget と同型の薄い配線層）。
 *
 * **常駐プレイヤーの再起動はここでは行わない**（settings の getter/setter に閉じた層のまま）。
 * main() が返り値の `onSetAudioDevice` をラップして常駐プレイヤーの再生成トリガに使う（§createStreamPlayer 呼び出し側）。
 *
 * @param {{ getAudioDevice: () => string | null; setAudioDevice: (name: string | null) => void }} settings
 * @returns {{
 *   getAudioDevice: () => string | null;
 *   onSetAudioDevice: (name: string | null) => void;
 *   audioDeviceStatus: () => { name: string | null };
 * }}
 */
export function createAudioDeviceHooks(settings) {
  return {
    /** 起動時 / プレイヤー再生成時に読む出力デバイス名（未記憶なら null=既定デバイス）。 */
    getAudioDevice: () => settings.getAudioDevice(),
    /** cockpit-server の onSetAudioDevice（POST /api/audio-device が呼ぶ）。 */
    onSetAudioDevice: (name) => {
      try {
        settings.setAudioDevice(name ?? null); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetVisionTarget と同型の失敗寛容）。
      }
    },
    /** cockpit-server の audioDeviceStatus（state snapshot に載せる現況）。 */
    audioDeviceStatus: () => ({ name: settings.getAudioDevice() })
  };
}

/**
 * settings の自発発火 ON/OFF トグル（selfFireEnabled）を、cockpit-server の口
 * （onSetSelfFireEnabled）へ橋渡しする（S6「会話が続く」・Domain D。visionTarget と同型の薄い配線層）。
 * 起動時の初期値解決（`resolveInitialEnabled`）は既定値（false）へのフォールバックを担う——bool の
 * 「未記憶」（null）と「明示 false」を区別する settings 契約を、呼び出し側が意識せずに使えるようにする。
 *
 * @param {{ getSelfFireEnabled: () => boolean | null; setSelfFireEnabled: (enabled: boolean) => void }} settings
 * @param {boolean} [defaultEnabled=false]  未記憶時のフォールバック（v0 は既定 OFF・wave 計画 §1 の順序どおり）。
 * @returns {{
 *   resolveInitialEnabled: () => boolean;
 *   onSetSelfFireEnabled: (enabled: boolean) => void;
 * }}
 */
export function createSelfFireHooks(settings, defaultEnabled = false) {
  return {
    /** 起動時の初期 ON/OFF（未記憶なら defaultEnabled）。 */
    resolveInitialEnabled: () => {
      const remembered = settings.getSelfFireEnabled();
      return typeof remembered === "boolean" ? remembered : defaultEnabled;
    },
    /** cockpit-server の onSetSelfFireEnabled（POST /api/self-fire が呼ぶ）。 */
    onSetSelfFireEnabled: (enabled) => {
      try {
        settings.setSelfFireEnabled(enabled === true); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetVisionTarget と同型の失敗寛容）。
      }
    }
  };
}

/**
 * settings の barge-in ON/OFF トグル（bargeInEnabled）を、cockpit-server の口
 * （onSetBargeInEnabled）へ橋渡しする（「朗読と合いの手」裁定 1・createSelfFireHooks と同型の
 * 薄い配線層）。**既定は defaultEnabled=true**（selfFire の既定 false とは意図的に非対称・裁定 1
 * 「既定 ON」）。起動時の初期値解決（`resolveInitialEnabled`）は既定値へのフォールバックを担う——
 * bool の「未記憶」（null）と「明示 false」を区別する settings 契約を、呼び出し側が意識せずに
 * 使えるようにする（createSelfFireHooks と同じ規律）。
 *
 * @param {{ getBargeInEnabled: () => boolean | null; setBargeInEnabled: (enabled: boolean) => void }} settings
 * @param {boolean} [defaultEnabled=true]  未記憶時のフォールバック（既定 ON・「朗読と合いの手」裁定 1）。
 * @returns {{
 *   resolveInitialEnabled: () => boolean;
 *   onSetBargeInEnabled: (enabled: boolean) => void;
 * }}
 */
export function createBargeInHooks(settings, defaultEnabled = true) {
  return {
    /** 起動時の初期 ON/OFF（未記憶なら defaultEnabled）。 */
    resolveInitialEnabled: () => {
      const remembered = settings.getBargeInEnabled();
      return typeof remembered === "boolean" ? remembered : defaultEnabled;
    },
    /** cockpit-server の onSetBargeInEnabled（POST /api/barge-in が呼ぶ）。 */
    onSetBargeInEnabled: (enabled) => {
      try {
        settings.setBargeInEnabled(enabled === true); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetSelfFireEnabled と同型の失敗寛容）。
      }
    }
  };
}

/**
 * 配信間記憶: 定期保存を空回りさせない判定（inventory §2-4「転写が前回生成から変化しとらん時は
 * スキップ」）。転写件数（=seq・transcriptBuffer.all().length）が前回記録時から不変ならスキップする
 * （true=スキップ）。純関数（I/O ゼロ）——20 分ごとに同じ会話を②へ渡してトークンを燃やさない
 * 防波堤。手動「今日を記録」/ 耳の Stop / Ctrl+C はこの判定を経由しない（明示操作・最後の版は必ず試みる）。
 * @param {number} currentSeq  現在の転写件数。
 * @param {number} lastRecordedSeq  直近に記録が成立した時点の転写件数。
 * @returns {boolean}
 */
export function shouldSkipMemoryCheckpoint(currentSeq, lastRecordedSeq) {
  return currentSeq === lastRecordedSeq;
}

/**
 * ②書き出し役・④思い出し役の頭（申し送り 1: Codex に固定）。今の頭が Codex 系ならその頭（①と同じ頭・
 * recall-flow.md §6）、Claude 系なら既定の Codex（Claude の頭は cwd / sandbox / finalAnswerOnly を黙って無視するため
 * 使わない）。④も同じ決め方（記憶の作り直し Wave 2 からの申し送り 1）。
 * @param {unknown} currentBrain
 * @param {Record<string, { create: Function }>} [brains=BRAINS]
 * @returns {{ id?: string; create: Function }}
 */
export function resolveWriterBrainDef(currentBrain, brains = BRAINS) {
  if (isCodexBrainId(currentBrain) && typeof currentBrain === "string" && brains[currentBrain]) {
    return brains[currentBrain];
  }
  return brains.codex;
}

/**
 * 配信間記憶: 保存の係（定期・手動「今日を記録」・耳の Stop・Ctrl+C のどれもこれを通る）。
 *
 * **直列にする**（申し送り 3・記憶のフォルダの git の index.lock がぶつからないように）:
 *  - 何も走っていなければ、すぐ 1 回走らせる。
 *  - 走っている間に次の保存が来たら、1 件だけ待たせ、今のが終わってから 1 回だけ走らせる。待っている間に
 *    さらに来たら、待っている 1 件の材料を新しい方に差し替える（件数が減る差し替えはしない。耳の Stop の
 *    あとはライブの転写が空になるため、Stop のときに取った転写を後から来た空や短い転写で上書きしない）。
 *  - 材料（転写）は保存を頼んだ時点で取る（耳の Stop では pipeline を畳む前に取ったものが渡る）。
 *  - 空の転写は走らせない。
 *  - **置き場も保存を頼んだ時点で取る**（配信の組み直し Domain B・getPlace = その時点のロールの記憶のフォルダ）。
 *    走っている保存・待っている保存は、頼んだときのロールのフォルダに書く（あとでロールが替わっても、ほかの
 *    ロールのフォルダに書かない・stream-restructure.md §2.3）。待っている 1 件と置き場が違う頼みは差し替えずに
 *    後ろに並べる（置き場ごとに順に走らせる）。getPlace が無ければ今まで通り（置き場は undefined で 1 つ）。
 * 1 回の保存（writeImpl）の失敗は握って onError に渡す（どの呼び出し元も巻き込まない）。
 *
 * @param {object} deps
 * @param {() => ReadonlyArray<any>} deps.getLiveEntries  材料の省略時に使うライブの転写（cockpit-server の getTranscript）。
 * @param {(entries: ReadonlyArray<any>, place: any) => Promise<{ written: boolean; commit?: any }>} deps.writeImpl
 *   1 回の保存（本番は②書き出し役 writeStreamRecord + コミット）。place は頼んだ時点の getPlace() の値。
 * @param {() => any} [deps.getPlace]  保存を頼んだ時点の置き場（本番は今のロールの記憶のフォルダ・§createRoleMemoryPlaces）。
 *   同じ置き場には同じ値（=== で比べる）を返すこと。投げたら null。
 * @param {(info: { atMs: number; entriesLength: number; commit?: any; place?: any }) => void} [deps.onSaved]
 *   保存が成り立ったあと（main() 側がここで lastRecordAtMs / lastRecordedSeq を更新する）。place は getPlace があるとき
 *   だけ載る（その保存を頼んだ時点の置き場・配信の組み直し Domain D の場ごとの数え方）。
 * @param {(error: unknown) => void} [deps.onError]
 * @param {(recording: boolean) => void} [deps.onRecordingChange]  走り始めと全部終わったとき（操縦席の「記録中」）。
 * @param {() => number} [deps.nowImpl=Date.now]
 * @returns {{
 *   record: (entriesOverride?: ReadonlyArray<any>) => Promise<void>;
 *   isRecording: () => boolean;
 *   whenIdle: () => Promise<void>;
 * }}
 *   record の戻りは、その頼みを受け持った 1 回の保存が終わったら解決する（失敗しても reject しない）。
 */
export function createMemoryRecorder(deps) {
  const nowImpl = deps.nowImpl ?? Date.now;
  /** @type {Promise<void> | null} 走っている保存の一続き（待たせた分まで含む）。 */
  let chain = null;
  /** @type {Array<{ entries: ReadonlyArray<any>; place: any; promise: Promise<void>; resolve: () => void }>} 待っている保存（置き場ごと）。 */
  const waiting = [];

  const callSafely = (/** @type {Function | undefined} */ fn, /** @type {any} */ arg) => {
    if (typeof fn !== "function") return;
    try {
      fn(arg);
    } catch {
      // 通知先の失敗で保存の係を止めない。
    }
  };

  const placeNow = () => {
    if (typeof deps.getPlace !== "function") return undefined;
    try {
      return deps.getPlace();
    } catch {
      return null;
    }
  };

  const runOnce = async (/** @type {ReadonlyArray<any>} */ entries, /** @type {any} */ place) => {
    try {
      const result = await deps.writeImpl(entries, place);
      if (result && result.written) {
        // 置き場（getPlace があるときだけ）も渡す: main() が「頼んだ時点の場」の保存だけを数える（配信の組み直し Domain D）。
        callSafely(deps.onSaved, {
          atMs: nowImpl(),
          entriesLength: entries.length,
          commit: result.commit,
          ...(place !== undefined ? { place } : {})
        });
      }
    } catch (error) {
      callSafely(deps.onError, error);
    }
  };

  const start = (/** @type {ReadonlyArray<any>} */ entries, /** @type {any} */ place) => {
    /** @type {() => void} */
    let resolveOwn = () => {};
    const own = new Promise((resolve) => {
      resolveOwn = () => resolve(undefined);
    });
    callSafely(deps.onRecordingChange, true);
    chain = (async () => {
      try {
        await runOnce(entries, place);
        resolveOwn();
        while (waiting.length > 0) {
          const next = /** @type {(typeof waiting)[number]} */ (waiting.shift());
          await runOnce(next.entries, next.place);
          next.resolve();
        }
      } finally {
        resolveOwn();
        chain = null;
        callSafely(deps.onRecordingChange, false);
      }
    })();
    return own;
  };

  return {
    record(entriesOverride) {
      const entries = entriesOverride ?? deps.getLiveEntries();
      if (!Array.isArray(entries) || entries.length === 0) return Promise.resolve();
      const place = placeNow();
      if (!chain) return start(entries, place);
      const last = waiting[waiting.length - 1];
      if (last && last.place === place) {
        if (entries.length >= last.entries.length) last.entries = entries;
        return last.promise;
      }
      /** @type {() => void} */
      let resolve = () => {};
      const promise = new Promise((r) => {
        resolve = () => r(undefined);
      });
      waiting.push({ entries, place, promise, resolve });
      return promise;
    },
    isRecording: () => chain != null,
    whenIdle: () => chain ?? Promise.resolve()
  };
}

/**
 * @typedef {object} RoleMemoryPlace
 * @property {string} roleId  この置き場のロール。
 * @property {string} dir  ロールの記憶のフォルダ（`memories/<role-id>/`・②④の作業フォルダ）。
 * @property {Promise<void>} ready  準備（git init・ローカル設定・`_conventions.md` の種）が終わったら解決する（失敗しても reject しない）。
 * @property {{ get: () => { dateJst: string; baseName: string } }} streamRecord  このロールの今回の配信の本体のファイル名。
 * @property {number} streamNo  この置き場を作った場の番号（beginStream のたびに 1 つ進む・まだ場が無ければ 0）。
 */

/**
 * 記憶の置き場を今のロールに付いていかせる（配信の組み直し Domain B・stream-restructure.md §2.3）。
 *
 *  - place(): 今のロールの置き場を返す。ロールごとに 1 回だけ作って持ち回る（同じロールなら同じ値）。作るときに
 *    そのロールのフォルダの準備（prepareMemoryFolder・`_conventions.md` が無ければ種の「チャッピー」をロールの呼び名に
 *    差し替えて書く）を始め、本体のファイル名（createStreamRecordIdentity・最初の保存で 1 回だけ決める）を作る。
 *    同じ場の中でロールを戻したときは前に作った置き場（同じ本体のファイル名）を使う。
 *  - beginStream(startedAtMs): 配信の組み直し Domain D。場の始まりで置き場を作り直す（作った置き場を捨て、場の番号を
 *    進め、次の place() でそのときのロールの置き場を新しい本体のファイル名で作る・準備もそこでもう一度走らせる =
 *    冪等）。場の始まりで place() を呼び、その ready を待てば「場の始まりでそのロールの置き場が用意されている」。
 *  - available が false（記憶の引っ越しが失敗した起動）のときは、どのロールのフォルダも準備せず、place() は null
 *    （前の形の記録が残る根の中に、ロールのフォルダや git を作らない）。
 *  - 準備の失敗は配信を止めない（onPrepareFailed へ・保存のたびにコミットが失敗として警告に出る・今までと同じ）。
 *
 * @param {object} deps
 * @param {string} deps.root  記憶の根（本番は DEFAULT_MEMORY_DIR）。
 * @param {() => { id: string; name: { canonical: string } }} deps.currentRole  今のロール（roleHooks.current）。
 * @param {number} deps.startedAtMs  配信の始まり（本体のファイル名の日付）。
 * @param {boolean} [deps.available=true]
 * @param {(options: { dir: string; soulName: string }) => Promise<{ ok: boolean; error?: string }>} [deps.prepareImpl]
 * @param {(options: { dir: string; startedAtMs: number }) => { get: () => { dateJst: string; baseName: string } }} [deps.createIdentityImpl]
 * @param {(info: { roleId: string; error: string }) => void} [deps.onPrepareFailed]
 * @returns {{ place: () => Readonly<RoleMemoryPlace> | null; beginStream: (startedAtMs: number) => void; streamNo: () => number }}
 */
export function createRoleMemoryPlaces(deps) {
  const prepareImpl = deps.prepareImpl ?? ((/** @type {any} */ options) => prepareMemoryFolder(options));
  const createIdentityImpl = deps.createIdentityImpl ?? createStreamRecordIdentity;
  const available = deps.available !== false;
  /** @type {Map<string, Readonly<RoleMemoryPlace>>} */
  const places = new Map();
  // 今の場の始まり（本体のファイル名の日付）と番号（配信の組み直し Domain D）。まだ場が無ければ起動の時刻と 0。
  let startedAtMs = deps.startedAtMs;
  let streamNo = 0;
  const reportFailure = (/** @type {string} */ roleId, /** @type {string} */ error) => {
    try {
      deps.onPrepareFailed?.({ roleId, error });
    } catch {
      // 知らせ先の失敗で準備を止めない。
    }
  };
  return {
    place() {
      if (!available) return null;
      const role = deps.currentRole();
      const cached = places.get(role.id);
      if (cached) return cached;
      /** @type {string} */
      let dir;
      try {
        dir = memoryDirForRole(deps.root, role.id);
      } catch {
        return null;
      }
      const ready = Promise.resolve()
        .then(() => prepareImpl({ dir, soulName: role.name.canonical }))
        .then(
          (result) => {
            if (!result || !result.ok) reportFailure(role.id, String(result?.error ?? "unknown"));
          },
          (error) => reportFailure(role.id, error instanceof Error ? error.message : String(error))
        );
      const place = Object.freeze({
        roleId: role.id,
        dir,
        ready,
        streamRecord: createIdentityImpl({ dir, startedAtMs }),
        streamNo
      });
      places.set(role.id, place);
      return place;
    },
    beginStream(nextStartedAtMs) {
      startedAtMs = nextStartedAtMs;
      streamNo += 1;
      places.clear();
    },
    streamNo: () => streamNo
  };
}

/** 体のあるロールで器（runtime-player）につながらず、場を開かなかったときの知らせ（配信の組み直し Domain D・scope §19）。 */
export const BODY_CONNECT_FAILED_MESSAGE =
  "体の器（runtime-player）につながらない — runtime-player が起動していないか、channel が開いていない。" +
  "runtime-player を起動して channel を開いてから、もう一度「配信を始める」を押す。";

/** 体のあるロールで器の URL が入っていないまま「配信を始める」を押したときの知らせ（配信の組み直し Domain D）。 */
export const BODY_URL_NOT_SET_MESSAGE =
  "体の器（runtime-player）の URL が入っていない — 準備・設定の Channel 欄に runtime-player の channel の URL を入れてから、" +
  "もう一度「配信を始める」を押す。";

/**
 * 場（配信を始める / 終える）の cockpit.mjs 側の口と、場ごとの記録（配信の組み直し Domain D・stream-restructure.md §3）。
 * cockpit-server の openStream / closeStream が `hooks` を順に呼ぶ（server の `streamHooks`）。
 *
 *  - hooks.renewRecords（始める 2）: 場の記録を作り直す。場の番号を進め、記憶の本体のファイル名（memoryPlaces.beginStream）と
 *    頭の文脈の記録のファイル（renewUsageLog）を新しくし、保存の数え（lastRecordedSeq / lastRecordAtMs）を 0 / null に
 *    戻す（新しい場の転写は 0 から始まるので、前の場の seq と比べて保存を飛ばさない）。そのロールの置き場の準備
 *    （git init・種）もここで待つ（ロールの切り替えの応答を git init で待たせない・場の始まりで用意されている）。
 *  - hooks.openSession（始める 5）: 頭のセッションを今のロールのモデルと指示で作る（前の場のセッションは使わない）。
 *  - hooks.connectBody（始める 6）: ロールに体があれば器につなぐ（resolveFireChannel と同じく今のロールの body を見る）。
 *    URL が無い・つながらないなら `{ ok:false, reason }`（場は開かない）。体なしは器を見ない・つながない。
 *  - hooks.closeSession / hooks.closeBody（畳む）: 頭のセッションを畳む・器を畳む（器は体の有無に関わらず）。
 *  - hooks.saveFinal（終える 3）: 写した転写が前の保存から増えていれば最後の保存を頼み、走っている保存の終わりまで待つ
 *    （上限 memoryTimeoutMs・skipMemoryWait で打ち切れる = もう一度の Ctrl+C）。増えていなければ頼まない。
 *  - checkpoint(): 20 分ごとの保存の 1 回分。場が開いている間だけ、前の保存から転写が増えていれば頼む。
 *  - noteSaved(info): 保存の係の onSaved。頼んだ時点の場（置き場の streamNo）が今の場のときだけ数える（前の場の
 *    遅れて終わった保存で、新しい場の数えを上書きしない）。
 *  - waitForRunningSaves(): Ctrl+C で場が閉じていたとき、走っている保存（前の場の最後の保存の残りなど）を待つ（頼まない）。
 *
 * @param {object} deps
 * @param {{ beginStream: (startedAtMs: number) => void; place: () => any; streamNo: () => number }} deps.memoryPlaces
 * @param {{ record: (entries?: ReadonlyArray<any>) => Promise<void>; whenIdle: () => Promise<void>; isRecording: () => boolean }} deps.memoryRecorder
 * @param {(startedAtMs: number) => void} [deps.renewUsageLog]  頭の文脈の記録のファイルを新しくする（本番は createSessionUsageLog の作り直し）。
 * @param {() => (void | Promise<void>)} deps.openSession  頭のセッションを作り直す（前のセッションを畳んでから作る）。
 * @param {() => (void | Promise<void>)} deps.closeSession  頭のセッションを畳む（冪等）。
 * @param {() => boolean} deps.hasBody  今のロールに体があるか（roleHooks.current().body）。
 * @param {{ getUrl: () => string | null; connect: () => Promise<void>; close: () => Promise<void> }} deps.channel  器（lazyChannel）。
 * @param {() => boolean} [deps.isStreamOpen]  場が開いているか（20 分ごとの保存の判定・server.streamStatus）。
 * @param {() => ReadonlyArray<any>} [deps.getEntries]  ライブの転写（server.getTranscript）。
 * @param {() => number} [deps.nowImpl=Date.now]
 * @param {number} [deps.memoryTimeoutMs=SHUTDOWN_MEMORY_TIMEOUT_MS]  最後の保存を待つ上限。
 * @param {typeof setTimeout} [deps.setTimeoutImpl]
 * @param {(info: { timeoutMs: number }) => void} [deps.onMemoryWait]  保存を待ち始めたとき（ターミナルに 1 行）。
 */
export function createStreamVenueHooks(deps) {
  const nowImpl = deps.nowImpl ?? Date.now;
  const memoryTimeoutMs = deps.memoryTimeoutMs ?? SHUTDOWN_MEMORY_TIMEOUT_MS;
  const setTimeoutImpl = deps.setTimeoutImpl ?? setTimeout;
  /** この場で最後に保存が成り立った時刻（snapshot の memory.lastRecordAtMs）。場の始まりで null に戻す。 @type {number | null} */
  let lastRecordAtMs = null;
  /** この場で最後に保存が成り立った時点の転写の件数（保存を飛ばす判定）。場の始まりで 0 に戻す。 */
  let lastRecordedSeq = 0;
  /** 保存を待っている間だけ入る「待たずに進む」口。 @type {(() => void) | null} */
  let skipWait = null;

  /** 走っている保存を、上限つき・打ち切れる形で待つ。 @param {Promise<any>} done */
  const waitBounded = async (done) => {
    try {
      deps.onMemoryWait?.({ timeoutMs: memoryTimeoutMs });
    } catch {
      // 知らせの失敗で待ちを止めない。
    }
    await Promise.race([
      raceMemoryRecordWithTimeout(done, memoryTimeoutMs, setTimeoutImpl),
      new Promise((resolve) => {
        skipWait = () => resolve(undefined);
      })
    ]);
    skipWait = null;
  };

  return {
    hooks: {
      async renewRecords() {
        const startedAtMs = nowImpl();
        lastRecordedSeq = 0;
        lastRecordAtMs = null;
        deps.renewUsageLog?.(startedAtMs);
        deps.memoryPlaces.beginStream(startedAtMs);
        await deps.memoryPlaces.place()?.ready;
      },
      async openSession() {
        try {
          await deps.openSession();
          return { ok: true };
        } catch (error) {
          return { ok: false, reason: `頭のセッションを作れない（${error instanceof Error ? error.message : String(error)}）` };
        }
      },
      async connectBody() {
        if (deps.hasBody() === false) return { ok: true, body: false };
        if (deps.channel.getUrl() == null) return { ok: false, reason: BODY_URL_NOT_SET_MESSAGE };
        try {
          await deps.channel.connect();
          return { ok: true, body: true };
        } catch {
          return { ok: false, reason: BODY_CONNECT_FAILED_MESSAGE };
        }
      },
      async closeSession() {
        try {
          await deps.closeSession();
        } catch {
          // best-effort（畳めなかったセッションは使わない）。
        }
      },
      async closeBody() {
        try {
          await deps.channel.close();
        } catch {
          // best-effort
        }
      },
      /** @param {ReadonlyArray<any>} transcript */
      async saveFinal(transcript) {
        const entries =
          Array.isArray(transcript) && !shouldSkipMemoryCheckpoint(transcript.length, lastRecordedSeq) ? transcript : [];
        const done = Promise.all([deps.memoryRecorder.record(entries), deps.memoryRecorder.whenIdle()]);
        if (!deps.memoryRecorder.isRecording()) return;
        await waitBounded(done);
      }
    },
    /**
     * 20 分ごとの保存の 1 回分（場が開いている間だけ・転写が前の保存から増えていなければ頼まない）。
     * @returns {boolean}  頼んだら true。
     */
    checkpoint() {
      if (typeof deps.isStreamOpen !== "function" || !deps.isStreamOpen()) return false;
      const entries = typeof deps.getEntries === "function" ? deps.getEntries() : [];
      if (shouldSkipMemoryCheckpoint(entries.length, lastRecordedSeq)) return false; // 空回しでトークンを燃やさない。
      deps.memoryRecorder.record(entries).catch(() => {});
      return true;
    },
    /**
     * 保存の係の onSaved。今の場の保存だけを数える（置き場を持たない保存 = テストの係は数える）。
     * @param {{ atMs: number; entriesLength: number; place?: any }} info
     * @returns {boolean}  数えたら true。
     */
    noteSaved(info) {
      const place = info ? info.place : undefined;
      if (place && typeof place.streamNo === "number" && place.streamNo !== deps.memoryPlaces.streamNo()) return false;
      lastRecordAtMs = info.atMs;
      lastRecordedSeq = info.entriesLength;
      return true;
    },
    lastRecordAtMs: () => lastRecordAtMs,
    lastRecordedSeq: () => lastRecordedSeq,
    /** 走っている保存を待つ（頼まない・上限つき・打ち切れる）。走っていなければすぐ返る。 */
    async waitForRunningSaves() {
      if (!deps.memoryRecorder.isRecording()) return;
      await waitBounded(deps.memoryRecorder.whenIdle());
    },
    /**
     * 保存の待ちを打ち切る（もう一度の Ctrl+C）。待っていなければ false。
     * @returns {boolean}
     */
    skipMemoryWait() {
      if (!skipWait) return false;
      skipWait();
      return true;
    }
  };
}

/**
 * Codex の頭の警告が「MCP の名前の読み取り（config/read）に失敗した」ものか（codex-session.mjs の
 * MCP_CONFIG_READ_FAILED_WARNING との一致で判定する・文言の一部の一致はやめた＝Wave 2 からの申し送り 2）。
 * 操縦席の上の帯に alert として出す（ユーザー決定 2026-10-21: 続けるが目立たせる）。
 * @param {unknown} warning
 * @returns {boolean}
 */
export function isMcpConfigReadFailureWarning(warning) {
  return warning === MCP_CONFIG_READ_FAILED_WARNING;
}

/**
 * 思い出しの係の出来事のターミナル 1 行（記憶の作り直し Wave 3・頼みごと・記憶の中身は書かない）。
 * @param {{ phase?: string; avoidProbability?: number | null; judgeFailed?: boolean; reason?: string | null; silent?: boolean; failed?: boolean }} event
 * @returns {string}
 */
export function formatRecallEventLine(event) {
  const parts = [`[cockpit] recall: ${typeof event?.phase === "string" ? event.phase : "?"}`];
  if (typeof event?.avoidProbability === "number" && Number.isFinite(event.avoidProbability)) {
    parts.push(`avoid=${event.avoidProbability.toFixed(2)}`);
  }
  if (event?.judgeFailed === true) parts.push("judge=error");
  if (typeof event?.reason === "string" && event.reason.length > 0) parts.push(`reason=${event.reason}`);
  // Wave 3 仕上げ: 自発 OFF で黙って渡した（silent）・④の失敗を届けた（failed）。
  if (event?.silent === true) parts.push("silent");
  if (event?.failed === true) parts.push("failed");
  return `${parts.join(" ")}\n`;
}

/**
 * 配信間記憶: shutdown 最終生成の best-effort + timeout（blocking #3・shutdown が固まらない）。
 * promise が timeoutMs 以内に解決/棄却しなければ待たずに進む。promise 自体の例外は握って捨てる
 * （呼び出し元へ伝播させない・best-effort の意味そのもの）。setTimeoutImpl はテスト注入用
 * （既定は setTimeout・fire-scheduler.mjs/barge-in.mjs のタイマ注入規律を踏襲）。
 * @param {Promise<any>} promise
 * @param {number} timeoutMs
 * @param {typeof setTimeout} [setTimeoutImpl]
 * @returns {Promise<void>}
 */
export function raceMemoryRecordWithTimeout(promise, timeoutMs, setTimeoutImpl = setTimeout) {
  return Promise.race([
    Promise.resolve(promise).catch(() => {}),
    new Promise((resolve) => setTimeoutImpl(resolve, timeoutMs))
  ]).then(() => undefined);
}

/**
 * settings の口数モード（verbosityMode）を、cockpit-server の口（resolveInitialVerbosity/
 * onSetVerbosity）へ橋渡しする（wave 計画「口数配線」§2 裁定 A・createSelfFireHooks と同型の薄い
 * 配線層）。settings に記憶が無い、または既知3モード（quiet/normal/chatty）以外の値が入っていた
 * 場合は defaultMode（既定 "normal"）にフォールバックする（防御的・fire-scheduler.mjs 側の
 * setVerbosity/初期 mode 解決と同じ「未知値は normal」の規律）。
 *
 * @param {{ getVerbosityMode: () => string | null; setVerbosityMode: (mode: string | null) => void }} settings
 * @param {string} [defaultMode="normal"]  未記憶/未知値のフォールバック。
 * @returns {{
 *   resolveInitialVerbosity: () => string;
 *   onSetVerbosity: (mode: string) => void;
 * }}
 */
export function createVerbosityHooks(settings, defaultMode = "normal") {
  return {
    /** 起動時の初期口数モード（未記憶/未知値は defaultMode）。 */
    resolveInitialVerbosity: () => {
      const remembered = settings.getVerbosityMode();
      return remembered === "quiet" || remembered === "normal" || remembered === "chatty"
        ? remembered
        : defaultMode;
    },
    /** cockpit-server の onSetVerbosity（POST /api/verbosity が呼ぶ）。 */
    onSetVerbosity: (mode) => {
      try {
        settings.setVerbosityMode(mode); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetSelfFireEnabled と同型の失敗寛容）。
      }
    }
  };
}

/**
 * ロールの選択（配信の組み直し Domain A・旧 createBrainHooks の置き換え）。頭を選ぶ代わりにロールを選び、ロールが
 * 名前・性格の指示・動かすモデル（頭の id）・声・口数・話し始め・hotwords・体を持つ（stream-restructure.md §2）。
 *
 *  - 起動時: ロールの置き場（roles/）を読み、設定の `roleChoice` のロールを選ぶ。無ければ（引っ越し直後など）
 *    今までの頭の選択（`brainChoice`）の系統で選ぶ（GPT 系 → chappy、それ以外・未記憶 → cody＝今までの既定）。
 *    それも無ければ id の順で最初のロール。ロールが 1 つも読めなければ、こーでぃーの名前の既定のロールを
 *    手元だけに持つ（置き場には書かない＝`roles/` を作らないので、次の起動で引っ越しがもう一度走れる）。
 *  - select(id): 置き場から読み直して今のロールにし、`roleChoice` に覚える（失敗寛容）。読めなければ ok:false。
 *  - update(patch): 今のロールの持ち物を書き換えて role.json に書く（手元だけの既定のロールは書かない・失敗寛容）。
 *  - roleSettings: 口数・話し始め・声の方式の hooks（createVerbosityHooks / createSpeakStartHooks /
 *    createTtsEngineHooks）へ、設定の代わりに渡す読み書きの口（値の出どころを設定 → ロールに替える）。
 *
 * @param {object} options
 * @param {string} options.rolesDir
 * @param {{ getRoleChoice?: () => string | null; setRoleChoice?: (id: string | null) => void;
 *   getBrainChoice?: () => string | null }} options.settings
 * @param {(role: any) => any} [options.writeRoleImpl]  テスト注入（既定 role-store の writeRole）。
 */
export function createRoleHooks(options) {
  const rolesDir = options.rolesDir;
  const settings = options.settings;
  const writeRoleImpl = options.writeRoleImpl ?? ((/** @type {any} */ role) => writeRole({ dir: rolesDir, role }));
  /** @type {Array<Readonly<import("../src/roles/role-store.mjs").Role>>} */
  let roles = listRoles({ dir: rolesDir }).roles;
  const call = (/** @type {() => any} */ fn) => {
    try {
      return fn();
    } catch {
      return null;
    }
  };
  const pickInitial = () => {
    const byId = (/** @type {unknown} */ id) => roles.find((role) => role.id === id) ?? null;
    const remembered = byId(call(() => settings.getRoleChoice?.()));
    if (remembered) return remembered;
    const legacyBrain = call(() => settings.getBrainChoice?.());
    const family = byId(isCodexBrainId(legacyBrain) ? "chappy" : "cody");
    return family ?? roles[0] ?? null;
  };
  const initial = pickInitial();
  /** 置き場から読んだロールか（手元だけの既定のロールは書かない）。 */
  let persisted = initial != null;
  let current = initial ?? roleFromIdentity(MODEL_IDENTITIES.cody);

  /** @param {Record<string, unknown>} patch */
  const update = (patch) => {
    const next = normalizeRole(current.id, { ...roleToJson(current), ...patch });
    if (persisted) {
      try {
        writeRoleImpl(next);
      } catch {
        // 書き込みの失敗は操作を止めない（設定の set と同じ失敗寛容）。
      }
    }
    current = next;
    roles = roles.map((role) => (role.id === next.id ? next : role));
    return current;
  };

  return {
    /** 今のロール（凍っている）。 */
    current: () => current,
    currentId: () => current.id,
    /** 今のロールの名前（発火の指示・whisper・呼びかけ・snapshot が読む）。 */
    identity: () => roleIdentity(current),
    /** 置き場から読んだロールか。 */
    isPersisted: () => persisted,
    /** 選べるロールの一覧（id・見せる名前・動かす頭の id だけ）。 */
    list: () => roles.map((role) => ({ id: role.id, displayName: role.name.display, brain: role.brain })),
    /** 置き場にあるロールの id（会話指示の API が知っている id）。 */
    knownIds: () => roles.map((role) => role.id),
    /**
     * @param {string} id
     * @returns {{ ok: true; role: Readonly<import("../src/roles/role-store.mjs").Role> } | { ok: false; reason: string }}
     */
    select(id) {
      const read = readRole({ dir: rolesDir, id });
      if (!read.ok) return { ok: false, reason: `ロール ${id} を読めない（${read.reason}）` };
      roles = listRoles({ dir: rolesDir }).roles;
      current = read.role;
      persisted = true;
      call(() => settings.setRoleChoice?.(id)); // 次回起動で復元（file-backed・失敗寛容）。
      return { ok: true, role: current };
    },
    update,
    roleSettings: {
      getVerbosityMode: () => current.verbosity,
      setVerbosityMode: (/** @type {string | null} */ mode) => void update({ verbosity: mode }),
      getSpeakStartMode: () => current.speakStartMode,
      setSpeakStartMode: (/** @type {string | null} */ mode) => void update({ speakStartMode: mode }),
      getTtsEngine: () => current.voice.engine,
      setTtsEngine: (/** @type {string | null} */ engine) => void update({ voice: { ...current.voice, engine } })
    }
  };
}

/**
 * ロールの声を声の engine の deps にする（配信の組み直し Domain A）。AivisSpeech の話者は起動引数 `--speaker` が
 * あればそれ（ロールの値を上書きする）、無ければロールの値、それも無ければ undefined（tts-client の既定の話者）。
 * ElevenLabs の声の id はロールの値（無ければ undefined = engine の既定の声）。
 * @param {{ voice: { aivisSpeaker: number | null; elevenLabsVoiceId: string | null } }} role
 * @param {{ speaker?: string }} args
 * @returns {{ speaker: string | number | undefined; voiceId: string | undefined }}
 */
export function resolveRoleVoice(role, args) {
  const speaker = args.speaker != null && args.speaker !== "" ? args.speaker : (role.voice.aivisSpeaker ?? undefined);
  return { speaker, voiceId: role.voice.elevenLabsVoiceId ?? undefined };
}

/**
 * ローカルの文字起こしの設定に、ロールの hotwords を重ねる（配信の組み直し Domain A）。ロールが hotwords を
 * 持っていればそれ（空の配列 = hotwords なし）、null なら設定ファイルの値か既定のまま。
 * @param {any} localStt  settings.getLocalStt() の値。
 * @param {{ nameHints: { hotwords: ReadonlyArray<string> | null } }} role
 */
export function applyRoleHotwords(localStt, role) {
  const hotwords = role.nameHints.hotwords;
  if (hotwords == null) return localStt;
  return { ...(localStt && typeof localStt === "object" ? localStt : {}), hotwords: [...hotwords] };
}

/**
 * settings の視聴者チャット配信 source（chatSource）を、cockpit-server の口（onSetChatSource/
 * chatSourceStatus）へ橋渡しする（S7「視聴者が混ざる」・Domain C。Channel URL/visionTarget と同型の
 * 薄い配線層）。実チャット器官の生成/Connect/停止ライフサイクルは cockpit-server が所有する
 * （POST /api/chat/connect 駆動・ear-pipeline の流儀）——ここは「Connect した配信 URL を次回起動で
 * 復元するための永続化」だけを担う（token を含まない YouTube 公開 URL/ID）。
 *
 * @param {{ getChatSource: () => string | null; setChatSource: (source: string | null) => void }} settings
 * @returns {{
 *   onSetChatSource: (source: string | null) => void;
 *   chatSourceStatus: () => { source: string | null };
 * }}
 */
export function createChatSourceHooks(settings) {
  return {
    /** cockpit-server の onSetChatSource（POST /api/chat/connect が呼ぶ）。 */
    onSetChatSource: (source) => {
      try {
        settings.setChatSource(source ?? null); // 次回起動で入力欄に復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は Connect を止めない（onSetVisionTarget と同型の失敗寛容）。
      }
    },
    /** cockpit-server の chatSourceStatus（state snapshot の chat.source に載る記憶済み source）。 */
    chatSourceStatus: () => ({ source: settings.getChatSource() })
  };
}

/**
 * settings の文字起こしの方式（sttEngine）を、cockpit-server の口（sttEngineInitial/onSetSttEngine）へ
 * 橋渡しする（操縦席の文字起こし選択・cockpit-stt-selection.md・createVerbosityHooks と同型の薄い配線層）。
 * 未記憶/未知値は defaultEngine（既定 "whisper"）。選択だけを記憶し、ElevenLabs のキーはここで扱わない
 * （キーは cockpit-server が Start ごとに .env.elevenlabs.local から直接読む）。
 *
 * 既知値は ear-pipeline の STT_ENGINES（whisper / elevenlabs / parakeet / zipformer）。
 *
 * @param {{ getSttEngine: () => string | null; setSttEngine: (engine: string | null) => void }} settings
 * @param {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} [defaultEngine="whisper"]
 * @returns {{
 *   resolveInitialSttEngine: () => "whisper" | "elevenlabs" | "parakeet" | "zipformer";
 *   onSetSttEngine: (engine: string) => void;
 * }}
 */
export function createSttEngineHooks(settings, defaultEngine = "whisper") {
  return {
    /** 起動時の初期選択（未記憶/未知値は defaultEngine）。 */
    resolveInitialSttEngine: () => {
      const remembered = settings.getSttEngine();
      return remembered != null && STT_ENGINES.includes(remembered)
        ? /** @type {"whisper" | "elevenlabs" | "parakeet" | "zipformer"} */ (remembered)
        : defaultEngine;
    },
    /** cockpit-server の onSetSttEngine（耳の Start ごとに呼ぶ）。 */
    onSetSttEngine: (engine) => {
      try {
        settings.setSttEngine(engine); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は Start を止めない（onSetVerbosity と同型の失敗寛容）。
      }
    }
  };
}

/** 声の方式（設定キー `ttsEngine`・cockpit-server の TTS_ENGINES と同じ語彙）。 */
const TTS_ENGINE_CHOICES = Object.freeze(["aivis", "elevenlabs"]);

/**
 * settings の声の方式（ttsEngine）を、cockpit-server の口（ttsEngineInitial/onSetTtsEngine）へ橋渡しする
 * （声の差し替え Wave 3 Domain E・createSttEngineHooks の写経）。未記憶/未知値は defaultEngine（既定 "aivis"）。
 * 選択だけを記憶し、ElevenLabs のキーはここで扱わない（キーは createVoiceEngineManager が engine を作るときに読む）。
 *
 * @param {{ getTtsEngine: () => string | null; setTtsEngine: (engine: string | null) => void }} settings
 * @param {"aivis" | "elevenlabs"} [defaultEngine="aivis"]
 * @returns {{
 *   resolveInitialTtsEngine: () => "aivis" | "elevenlabs";
 *   onSetTtsEngine: (engine: string) => void;
 * }}
 */
export function createTtsEngineHooks(settings, defaultEngine = "aivis") {
  return {
    /** 起動時の初期選択（未記憶/未知値は defaultEngine）。 */
    resolveInitialTtsEngine: () => {
      const remembered = settings.getTtsEngine();
      return TTS_ENGINE_CHOICES.includes(/** @type {any} */ (remembered))
        ? /** @type {"aivis" | "elevenlabs"} */ (remembered)
        : defaultEngine;
    },
    /** cockpit-server の onSetTtsEngine（耳の Start ごとに呼ぶ）。 */
    onSetTtsEngine: (engine) => {
      try {
        settings.setTtsEngine(engine); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は Start を止めない。
      }
    }
  };
}

/** 声の警告の detail に載せる理由の上限（字数・cockpit-server 側でも切る）。 */
const VOICE_REASON_MAX_CHARS = 80;

/**
 * ElevenLabs の声の engine の診断（onDiagnostic）から、警告の detail に載せる短い理由を作る
 * （声の差し替え Wave 3 仕上げ・STT の `closed code=1006` と同じ流儀）。engine の reason は決まった語彙・close code・
 * サーバーの error の識別子だけ（キー・本文は入らない・D がテストで固定）だが、ここでも制御文字を除き長さを切る。
 * message は使わない。
 *
 * @param {unknown} diagnostic
 * @returns {string | null | undefined}  理由（string）・繋がったので消す（null）・理由に関係しない診断（undefined）。
 */
export function voiceDiagnosticReason(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object") return undefined;
  const d = /** @type {{ type?: unknown; reason?: unknown }} */ (diagnostic);
  const raw = typeof d.reason === "string" ? d.reason.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim() : "";
  /** @param {string} text */
  const clip = (text) => (text.length > VOICE_REASON_MAX_CHARS ? `${text.slice(0, VOICE_REASON_MAX_CHARS - 1)}…` : text);
  switch (d.type) {
    case "ttsDisconnected":
      return clip(`closed ${raw || "code=?"}`);
    case "ttsConnectFailed":
      return clip(`接続できない（${raw || "?"}）`);
    case "ttsServerError":
      return clip(`サーバーのエラー（${raw || "unknown"}）`);
    case "ttsConnected":
    case "ttsReconnected":
      return null;
    default:
      return undefined;
  }
}

/**
 * 声の engine の持ち主（声の差し替え Wave 3 Domain E・voice-swap-wave-plan.md §3「D と E の接点」・Wave 2 申し送り 2）。
 * 耳の Start で `prepare(kind)` を呼ぶ。種類が前回と同じなら使い回し、違えば古い engine を dispose して
 * `createVoiceEngine(kind, deps)` で作り直す。ただし ElevenLabs で status が `down` の engine は、種類が同じでも
 * dispose して作り直す（キーを読み直す。無効なキーを直して Stop → Start したときに古いキーで繋ぎ直し続けないように）。
 * ElevenLabs は作るときに `loadElevenLabsApiKey()` を読み、`apiKey` として渡す（process.env に入れない・キーは状態にも
 * ログにも出さない）。engine の status は `onStatus` へ流す（今の engine の分だけ・作り直した古い engine の通知は捨てる）。
 *
 * ElevenLabs の engine には deps の `onDiagnostic` を渡し、切断・接続失敗・サーバーのエラーの理由を覚えておく
 * （{@link voiceDiagnosticReason}・短い理由だけ。キーも会話の本文も入らない）。`reconnecting` / `down` を知らせる
 * ときはその理由を `reason` に載せる（`tts-reconnecting` / `tts-down` の警告の detail・STT と同じ流儀）。繋がれば消す。
 *
 * 失敗（キーが無い・工場が投げた）は `{ ok:false, reason }` を返し、engine は持たない（自動で AivisSpeech に戻さない）。
 * Start より前の Fire は `ensure(kind)` で同じ道を通り、失敗は reason の Error を投げる。
 *
 * @param {object} [options]
 * @param {(kind: string, deps: any) => any} [options.createEngine=createVoiceEngine]  工場関数（テストは偽物）。
 * @param {() => ({ ok: true; apiKey: string } | { ok: false; reason: string })} [options.loadApiKey=loadElevenLabsApiKey]
 * @param {() => object} [options.aivisDeps]  AivisSpeech の deps（ttsBaseUrl / speaker）。
 * @param {() => object} [options.elevenLabsDeps]  ElevenLabs の追加 deps（readingClient など・apiKey と onReadingsFallback と onDiagnostic はここで足す）。
 * @param {(info: { engine: string; status: string; reason: string | null }) => void} [options.onStatus]
 * @param {(info?: unknown) => void} [options.onReadingsFallback]  読みが取れず簡易版の口になったとき。
 * @param {() => string} [options.voiceKey]  声の中身（話者・声の id）の鍵（配信の組み直し Domain A）。種類が同じでも
 *   鍵が engine を作ったときと違えば作り直す（ロールを替えて声が替わったとき）。既定は常に同じ鍵。
 */
export function createVoiceEngineManager(options = {}) {
  const createEngine = options.createEngine ?? createVoiceEngine;
  const loadApiKey = options.loadApiKey ?? (() => loadElevenLabsApiKey());
  const aivisDeps = options.aivisDeps ?? (() => ({}));
  const elevenLabsDeps = options.elevenLabsDeps ?? (() => ({}));
  const onStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};
  const onReadingsFallback = typeof options.onReadingsFallback === "function" ? options.onReadingsFallback : () => {};
  const voiceKey = typeof options.voiceKey === "function" ? options.voiceKey : () => "";
  /** @type {any} */
  let engine = null;
  /** @type {string | null} */
  let engineKind = null;
  /** 今の engine を作ったときの声の鍵。 @type {string | null} */
  let engineKey = null;
  /** @type {(() => void) | null} */
  let statusOff = null;
  /** 今の engine の診断の受け口（作り直したら古い engine の診断は捨てる）。 @type {{ live: boolean; reason: string | null } | null} */
  let diagSlot = null;

  const report = (/** @type {string} */ kind, /** @type {string} */ status, /** @type {string | null} */ reason) => {
    try {
      onStatus({ engine: kind, status, reason });
    } catch {
      // 通知先の失敗で声を止めない。
    }
  };

  const drop = () => {
    const old = engine;
    if (statusOff) {
      try {
        statusOff();
      } catch {
        // best-effort
      }
    }
    statusOff = null;
    if (diagSlot) diagSlot.live = false;
    diagSlot = null;
    engine = null;
    engineKind = null;
    engineKey = null;
    if (old) {
      try {
        old.dispose();
      } catch {
        // best-effort（古い engine は使わない）。
      }
    }
  };

  /**
   * @param {string} kind
   * @returns {{ ok: true } | { ok: false; reason: string }}
   */
  const prepare = (kind) => {
    const key = voiceKey();
    if (engine != null && engineKind === kind && engineKey === key) {
      // 落ちた ElevenLabs の engine は使い回さない（下で dispose し、キーを読み直して作り直す）。
      if (!(kind === "elevenlabs" && engine.status === "down")) return { ok: true };
    }
    drop();
    /** @type {{ live: boolean; reason: string | null }} */
    const slot = { live: true, reason: null };
    /** reconnecting / down のときだけ覚えた理由を載せる（それ以外は null）。 @param {string} status */
    const reasonFor = (status) => (status === "reconnecting" || status === "down" ? slot.reason : null);
    /** @type {any} */
    let made = null;
    /** @type {any} */
    let deps;
    if (kind === "elevenlabs") {
      /** @type {any} */
      let key;
      try {
        key = loadApiKey();
      } catch {
        key = { ok: false };
      }
      if (!key || key.ok !== true || typeof key.apiKey !== "string" || key.apiKey.length === 0) {
        const reason = (key && typeof key.reason === "string" && key.reason) || "ElevenLabs のキーが見つからない";
        report(kind, "down", reason);
        return { ok: false, reason };
      }
      deps = {
        ...elevenLabsDeps(),
        apiKey: key.apiKey,
        onReadingsFallback: (/** @type {unknown} */ info) => {
          try {
            onReadingsFallback(info);
          } catch {
            // 警告の失敗で声を止めない。
          }
        },
        // 切断などの理由を覚え、reconnecting / down の通知に載せる（engine は診断を出してから status を変える）。
        onDiagnostic: (/** @type {unknown} */ diagnostic) => {
          if (!slot.live) return;
          const next = voiceDiagnosticReason(diagnostic);
          if (next === undefined) return;
          slot.reason = next;
          // 状態はそのままで理由だけ変わったとき（繋ぎ直しの失敗が続くなど）も知らせ直す。
          if (made != null && engine === made && typeof made.status === "string" && reasonFor(made.status) !== null) {
            report(kind, made.status, reasonFor(made.status));
          }
        }
      };
    } else {
      deps = { ...aivisDeps() };
    }
    try {
      made = createEngine(kind, deps);
    } catch (error) {
      slot.live = false;
      // 工場のエラー文言（キーは含まない）だけを理由にする。
      const reason = `声の engine を作れない（${kind}: ${error instanceof Error ? error.message : String(error)}）`;
      report(kind, "down", reason);
      return { ok: false, reason };
    }
    engine = made;
    engineKind = kind;
    engineKey = key;
    diagSlot = slot;
    if (made && typeof made.onStatus === "function") {
      statusOff = made.onStatus((/** @type {string} */ status) => {
        if (engine === made) report(kind, status, reasonFor(status));
      });
    }
    const initial = made && typeof made.status === "string" ? made.status : "unknown";
    report(kind, initial, reasonFor(initial));
    return { ok: true };
  };

  return {
    prepare,
    /**
     * Start より前の Fire 用: 今の engine を返す（無ければ kind で作る）。用意できなければ理由の Error を投げる。
     * 声の鍵が作ったときと違えば（ロールを替えて声が替わった）作り直す。
     * @param {string} kind
     */
    ensure(kind) {
      if (engine != null && engineKey === voiceKey()) return engine;
      const result = prepare(kind);
      if (!result.ok) throw new Error(result.reason);
      return engine;
    },
    /** 今の engine（無ければ null）。 */
    current: () => engine,
    /** 今の engine の種類（無ければ null）。 */
    currentKind: () => engineKind,
    /** 畳む（終了時）。 */
    dispose: drop
  };
}

/**
 * 文字起こしの遅延ログ 1 行（操縦席の標準出力・数字だけ・文字起こし本文は書かない）。
 * 物差しは whisper が「speechEnd → 転写到着」、ElevenLabs が「直前の commit 以降で最後の speechEnd →
 * commit 到着」（ear-pipeline.mjs）。物差しが無い commit（直前の commit 以降に speechEnd が無い）は "-"。
 * @param {{ engine: string; latencyMs: number | null }} info
 * @returns {string}
 */
export function formatSttLatencyLine(info) {
  const ms = typeof info.latencyMs === "number" && Number.isFinite(info.latencyMs) ? String(Math.round(info.latencyMs)) : "-";
  return `[cockpit] stt latency: engine=${info.engine} ms=${ms}\n`;
}

/**
 * 画面キャプチャの撮る係（常駐 PowerShell・src/eyes/resident-capture.mjs）の記録 1 行（操縦席の標準出力）。
 * 数字と種類だけ（窓タイトル・画像は書かない）。撮影 1 回ごとの `capture:` 行の ms が撮影の待ち時間
 * （via=resident が撮る係・via=spawn が毎回起動に戻った回。fallback= は戻った理由）。
 * @param {import("../src/eyes/resident-capture.mjs").ResidentCaptureEvent} event
 * @returns {string}
 */
export function formatCaptureEventLine(event) {
  const ms = (/** @type {unknown} */ value) =>
    typeof value === "number" && Number.isFinite(value) ? String(Math.round(value)) : "-";
  switch (event.type) {
    case "capture": {
      const result = event.ok ? "ok" : (event.kind ?? "error");
      const fallback = event.via === "spawn" && event.fallbackReason ? ` fallback=${event.fallbackReason}` : "";
      return `[cockpit] capture: via=${event.via} ms=${ms(event.elapsedMs)} result=${result}${fallback}\n`;
    }
    case "starting":
      return "[cockpit] capture helper: starting\n";
    case "ready":
      return `[cockpit] capture helper: ready ms=${ms(event.startupMs)}\n`;
    case "exited":
      return `[cockpit] capture helper: exited code=${event.code ?? "-"} restart=${event.willRestart ? "yes" : "no"} reason=${event.reason}\n`;
    case "gaveUp":
      return `[cockpit] capture helper: gave up after ${event.failures} failed starts (captures use one-shot powershell until next ears Start)\n`;
    case "stopped":
      return "[cockpit] capture helper: stopped\n";
    default:
      return "";
  }
}

/**
 * settings の話し始めの方式（speakStartMode）を、cockpit-server の口（speakStartModeInitial/
 * onSetSpeakStartMode）へ橋渡しする（speak-now 合意 §5・createVerbosityHooks と同型の薄い配線層）。
 * 未記憶/未知値は defaultMode（**初回既定 "speak-now"**・合意 §5）。相槌どうしの最小間隔
 * （settings の backchannelMinIntervalSec・backchannel.md §2）も cockpit-server の backchannelMinIntervalMs へ橋渡しする
 * （createCommentBusyHooks の resolveCommentHold と同型）。
 *
 * @param {{ getSpeakStartMode: () => string | null; setSpeakStartMode: (mode: string | null) => void;
 *   getBackchannelMinIntervalSec?: () => number | null }} settings
 * @param {"classic" | "speak-now"} [defaultMode="speak-now"]
 * @returns {{
 *   resolveInitialSpeakStartMode: () => "classic" | "speak-now";
 *   onSetSpeakStartMode: (mode: string) => void;
 *   resolveBackchannelMinIntervalMs: () => number | undefined;
 * }}
 */
export function createSpeakStartHooks(settings, defaultMode = "speak-now") {
  return {
    /** 起動時の話し始めの方式（未記憶/未知値は defaultMode）。 */
    resolveInitialSpeakStartMode: () => {
      const remembered = settings.getSpeakStartMode();
      return remembered === "classic" || remembered === "speak-now" ? remembered : defaultMode;
    },
    /** cockpit-server の onSetSpeakStartMode（POST /api/speak-start が呼ぶ）。 */
    onSetSpeakStartMode: (mode) => {
      try {
        settings.setSpeakStartMode(mode); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetVerbosity と同型の失敗寛容）。
      }
    },
    /** 相槌どうしの最小間隔（秒 → ミリ秒）。未設定・読めなければ undefined（= cockpit-server の既定 8 秒）。 */
    resolveBackchannelMinIntervalMs: () => {
      try {
        if (typeof settings.getBackchannelMinIntervalSec !== "function") return undefined;
        const sec = settings.getBackchannelMinIntervalSec();
        return typeof sec === "number" && Number.isFinite(sec) && sec >= 0 ? sec * 1000 : undefined;
      } catch {
        return undefined; // 読めなければ既定。
      }
    }
  };
}

/**
 * settings の忙しい間のコメントの扱い（commentBusyPolicy）とあとで拾うの鮮度・件数を、cockpit-server の口
 * （commentBusyPolicyInitial / onSetCommentBusyPolicy / commentHoldMaxAgeMs / commentHoldMaxCount）へ橋渡しする
 * （コメント反応の合意 §2・createSpeakStartHooks と同型の薄い配線層）。未記憶/未知値は "hold"（あとで拾う・既定）。
 *
 * @param {{ getCommentBusyPolicy: () => string | null; setCommentBusyPolicy: (policy: string | null) => void;
 *   getCommentHold?: () => { maxAgeSec: number | null; maxCount: number | null } }} settings
 * @returns {{
 *   resolveInitialCommentBusyPolicy: () => "hold" | "drop";
 *   onSetCommentBusyPolicy: (policy: string) => void;
 *   resolveCommentHold: () => { maxAgeMs: number | undefined; maxCount: number | undefined };
 * }}
 */
export function createCommentBusyHooks(settings) {
  return {
    /** 起動時の扱い（未記憶/未知値は hold）。 */
    resolveInitialCommentBusyPolicy: () => {
      const remembered = settings.getCommentBusyPolicy();
      return remembered === "drop" ? "drop" : "hold";
    },
    /** cockpit-server の onSetCommentBusyPolicy（POST /api/comment-busy が呼ぶ）。 */
    onSetCommentBusyPolicy: (policy) => {
      try {
        settings.setCommentBusyPolicy(policy); // 次回起動で復元（file-backed・失敗寛容）。
      } catch {
        // 永続化失敗は操作を止めない（onSetSpeakStartMode と同型の失敗寛容）。
      }
    },
    /** 鮮度（秒 → ミリ秒）と件数。未設定は undefined（= cockpit-server の既定 20 秒 / 3 件）。 */
    resolveCommentHold: () => {
      let hold = { maxAgeSec: null, maxCount: null };
      try {
        if (typeof settings.getCommentHold === "function") hold = settings.getCommentHold() ?? hold;
      } catch {
        // 読めなければ既定。
      }
      return {
        maxAgeMs: typeof hold.maxAgeSec === "number" ? hold.maxAgeSec * 1000 : undefined,
        maxCount: typeof hold.maxCount === "number" ? hold.maxCount : undefined
      };
    }
  };
}

/**
 * コメント判定のログ 1 行（操縦席の標準出力・コメント反応の合意 §3「遅延・判定結果」。コメント本文は書かない）。
 * 弾く判定（stage:"guard"）: 遅延・ID・通した/弾いた（種類）・4 択の選択・乗っ取りの確率・判定できなかった理由。
 * 反応する判定（stage:"react"）: 遅延・ID・選択・確率・行き先・きっかけ。判定しなかったコメントは行き先だけ。
 * @param {any} info  cockpit-server の onCommentJudgment が渡す記録。
 * @returns {string}
 */
export function formatCommentJudgmentLine(info) {
  const ms = typeof info?.latencyMs === "number" && Number.isFinite(info.latencyMs) ? String(Math.round(info.latencyMs)) : "-";
  const id = info?.commentId ?? "-";
  if (info?.stage === "guard") {
    const action = info.pass ? "pass" : `reject:${info.kind ?? "error"}`;
    const reason = info.pass || !info.error ? "" : ` reason=${info.error}`;
    return (
      `[cockpit] comment-guard: ms=${ms} id=${id} action=${action} verdict=${info.verdict ?? "-"} ` +
      `hijack=${fmtProb(info.hijackProbability)}${reason}\n`
    );
  }
  if (info?.skipped) return `[cockpit] comment-react: id=${id} action=${info.action ?? "-"}\n`;
  if (!info || info.ok !== true) {
    return `[cockpit] comment-react: error ms=${ms} id=${id} trigger=${info?.trigger ?? "-"} reason=${info?.error ?? "unknown"}\n`;
  }
  return (
    `[cockpit] comment-react: ms=${ms} id=${id} choice=${info.choice} p=${fmtProb(info.probability)} ` +
    `action=${info.action ?? "-"} trigger=${info.trigger ?? "-"}\n`
  );
}

/** @param {unknown} v */
function fmtProb(v) {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(2) : "-";
}

/**
 * speak-now の判定ログ 1 行（操縦席の標準出力・合意 §5「遅延・選択・確率」。会話の本文は書かない）。
 * 成功: 遅延・選択・その確率・行き先（fire / drop-busy / drop-inactive / skip-interval / none）・きっかけ・全選択肢の確率。
 * skip-interval は相槌どうしの歯止めで流した相槌（backchannel.md §2・フィードには判定行だけ）。
 * 失敗: 遅延（分かれば）・きっかけ・理由（キー欠落・タイムアウト等。キー値は judge 側で含めない）。
 * @param {any} info  cockpit-server の onSpeakNowJudgment が渡す記録。
 * @returns {string}
 */
export function formatSpeakNowLine(info) {
  const ms = typeof info?.latencyMs === "number" && Number.isFinite(info.latencyMs) ? String(Math.round(info.latencyMs)) : "-";
  const trigger = info?.trigger ?? "-";
  if (!info || info.ok !== true) {
    return `[cockpit] speak-now: error ms=${ms} trigger=${trigger} reason=${info?.error ?? "unknown"}\n`;
  }
  const probs = info.probs && typeof info.probs === "object" ? info.probs : {};
  const all = ["wait", "backchannel", "respond", "initiate", "look"].map((k) => `${k}:${fmtProb(probs[k])}`).join(",");
  return (
    `[cockpit] speak-now: ms=${ms} choice=${info.choice} p=${fmtProb(info.probability)} ` +
    `action=${info.action ?? "-"} trigger=${trigger} probs=${all}\n`
  );
}

/**
 * 頭が Codex 系か（Codex の残量ゲージは頭が Codex のときだけ・cockpit-glance-redesign.md §9.2）。
 * @param {unknown} brainId
 */
export function isCodexBrainId(brainId) {
  return typeof brainId === "string" && (brainId === "codex" || brainId.startsWith("codex-"));
}

/**
 * Codex の使用率の読み口（残量の監視が呼ぶ）。頭が Codex で、今のセッションが App Server を持つ
 * （readRateLimits がある）ときだけ読む。それ以外は null（不明）。セッションは起動していなければ自分で null を返す
 * （読むためだけに App Server を起こさない）。
 * @param {{ getBrain: () => string; getSession: () => any }} deps
 * @returns {() => Promise<any | null>}
 */
export function createCodexQuotaReader(deps) {
  return async () => {
    if (!isCodexBrainId(deps.getBrain())) return null;
    const session = deps.getSession();
    if (!session || typeof session.readRateLimits !== "function") return null;
    return session.readRateLimits();
  };
}

/**
 * settings の遅延の「遅い」しきい値（latencyWarnSec / latencyAlertSec）→ cockpit-server の latencyThresholds
 * （未設定・読めなければ既定 4 / 6 秒）。
 * @param {{ getLatencyThresholds?: () => { warnSec: number | null; alertSec: number | null } }} settings
 * @returns {{ warnSec: number; alertSec: number }}
 */
export function resolveLatencyThresholdsFromSettings(settings) {
  let raw = null;
  try {
    raw = typeof settings.getLatencyThresholds === "function" ? settings.getLatencyThresholds() : null;
  } catch {
    raw = null;
  }
  return resolveLatencyThresholds({ warnSec: raw?.warnSec ?? undefined, alertSec: raw?.alertSec ?? undefined });
}

/**
 * settings の圧縮の目安（compactThresholdTokens / compactQuietSec / compactMinIntervalMin）→ 圧縮の部品の
 * options（未設定・読めなければ既定 20 万トークン / 3 秒 / 10 分・context-growth-2026-10.md §6・§8）。
 * @param {{ getContextCompaction?: () => { thresholdTokens: number | null; quietSec: number | null; minIntervalMin: number | null } }} settings
 * @returns {{ thresholdTokens: number; quietMs: number; minIntervalMs: number }}
 */
export function resolveContextCompactionOptions(settings) {
  let raw = null;
  try {
    raw = typeof settings.getContextCompaction === "function" ? settings.getContextCompaction() : null;
  } catch {
    raw = null;
  }
  return {
    thresholdTokens: normalizeCompactThresholdTokens(raw?.thresholdTokens) ?? DEFAULT_COMPACT_THRESHOLD_TOKENS,
    quietMs: raw?.quietSec != null ? raw.quietSec * 1000 : DEFAULT_COMPACT_QUIET_MS,
    minIntervalMs: raw?.minIntervalMin != null ? raw.minIntervalMin * 60_000 : DEFAULT_COMPACT_MIN_INTERVAL_MS
  };
}

/**
 * 操縦席の設定（頭脳・会話のタブ）の「圧縮を始める大きさ」を、cockpit-server の口（onSetCompactThresholdTokens /
 * contextCompactionStatus）へ橋渡しする（createBargeInHooks と同じ流儀の薄い配線層）。変えたら settings へ保存し
 * （次回起動で復元）、走っている compactor の目安をその場で差し替える（次の確認 = 数秒以内から効く）。
 * 目安の正本は compactor（サーバは二重に持たない）。
 * @param {{ setCompactThresholdTokens?: (tokens: number | null) => void }} settings
 * @param {{ getThresholdTokens: () => number; setThresholdTokens: (tokens: number) => number }} compactor
 * @returns {{ onSetCompactThresholdTokens: (tokens: number) => void; contextCompactionStatus: () => { thresholdTokens: number } }}
 */
export function createContextCompactionHooks(settings, compactor) {
  return {
    /** cockpit-server の onSetCompactThresholdTokens（POST /api/compact-threshold が呼ぶ・値は検証済み）。 */
    onSetCompactThresholdTokens: (tokens) => {
      compactor.setThresholdTokens(tokens);
      try {
        if (typeof settings.setCompactThresholdTokens === "function") settings.setCompactThresholdTokens(tokens);
      } catch {
        // 永続化失敗は操作を止めない（走っている compactor には効いている）。
      }
    },
    /** state snapshot の compaction。 */
    contextCompactionStatus: () => ({ thresholdTokens: compactor.getThresholdTokens() })
  };
}

/**
 * ①チャッピーの返事の turn/start に送る速さの段（service tier）。Codex の頭なら fast の ON で "priority"・OFF で
 * "default"（OFF に戻したとき同じ thread を通常へ戻すため、OFF でも明示して送る）。Claude の頭は null（送らない）。
 * @param {unknown} brainId
 * @param {boolean} fastEnabled
 * @returns {"priority" | "default" | null}
 */
export function resolveCodexServiceTier(brainId, fastEnabled) {
  if (!isCodexBrainId(brainId)) return null;
  return fastEnabled === true ? "priority" : "default";
}

/**
 * 操縦席の設定（頭脳・会話のタブ）の「Codex の fast」（①チャッピーの Codex の頭だけ・service tier "priority"・
 * 2026-10-27 合意）を、cockpit-server の口（onSetCodexFastMode / codexFastStatus）へ橋渡しする
 * （createBargeInHooks と同じ流儀の薄い配線層）。設定の正本はここ（ON/OFF）で、次の受理の configuration に
 * serviceTierFor の値を載せる＝次の返事から効く（セッションは作り直さない）。②書き出し役・④思い出し役は通らない。
 * モデルが priority を持つかは、codex-session が model/list で読んだ結果（noteServiceTiers）を頭ごとに覚える。
 * @param {{ getCodexFastMode?: () => boolean | null; setCodexFastMode?: (enabled: boolean) => void }} settings
 * @param {boolean} [defaultEnabled=false]  未記憶時のフォールバック（既定 OFF）。
 */
export function createCodexFastHooks(settings, defaultEnabled = false) {
  let enabled = defaultEnabled;
  try {
    const remembered = typeof settings.getCodexFastMode === "function" ? settings.getCodexFastMode() : null;
    if (typeof remembered === "boolean") enabled = remembered;
  } catch {
    // 読めなければ既定。
  }
  /** @type {Map<string, boolean | null>} 頭 → そのモデルが priority を持つか（読めなければ null）。 */
  const support = new Map();
  return {
    isEnabled: () => enabled,
    /** cockpit-server の onSetCodexFastMode（POST /api/codex-fast が呼ぶ・値は検証済みの boolean）。 */
    onSetCodexFastMode: (/** @type {boolean} */ next) => {
      enabled = next === true;
      try {
        if (typeof settings.setCodexFastMode === "function") settings.setCodexFastMode(enabled);
      } catch {
        // 永続化失敗は操作を止めない（次の返事には効いている）。
      }
    },
    /** 次の受理で①へ渡す段（resolveCodexServiceTier）。 */
    serviceTierFor: (/** @type {unknown} */ brainId) => resolveCodexServiceTier(brainId, enabled),
    /**
     * codex-session の onServiceTiers（model/list で読んだ今のモデルの段）を覚える。変わったら true。
     * @param {string} brainId
     * @param {unknown} serviceTiers
     */
    noteServiceTiers: (brainId, serviceTiers) => {
      const value = Array.isArray(serviceTiers) ? serviceTiers.includes("priority") : null;
      const changed = !support.has(brainId) || support.get(brainId) !== value;
      support.set(brainId, value);
      return changed;
    },
    /**
     * state snapshot の codexFast（enabled = 設定・applicable = 今の頭が Codex か・supported = priority を持つか
     * （まだ確かめていない・Claude の頭なら null））。
     * @param {unknown} brainId
     */
    codexFastStatus: (brainId) => {
      const applicable = isCodexBrainId(brainId);
      const supported = applicable && typeof brainId === "string" && support.has(brainId) ? support.get(brainId) ?? null : null;
      return { enabled, applicable, supported };
    }
  };
}

/**
 * 圧縮の開始・終了の記録 1 行（session-usage/）。compactionUsageRecord の形（ratio = 窓に対する割合・
 * lastInputTokens・totalInputTokens・modelContextWindow）に、開始のときだけそのときの目安 thresholdTokens を足す
 * （目安は操縦席から変えられるので、記録の行だけで「どの目安で走ったか」が読めるように・追加のキーだけ）。
 * @param {any} event  context-compactor の onEvent。
 * @param {string | null} brain
 * @returns {Record<string, unknown>}
 */
export function contextCompactionUsageRecord(event, brain) {
  const record = compactionUsageRecord(event, brain);
  if (event?.type !== "started") return record;
  return { ...record, thresholdTokens: typeof event.thresholdTokens === "number" ? event.thresholdTokens : null };
}

/**
 * 頭の会話の圧縮の開始・終了のターミナル 1 行（数字と理由だけ・本文は書かない）。開始は量（直近の入力トークンと
 * そのときの目安）を主に、窓に対する割合を参考で添える。
 * @param {any} event  context-compactor の onEvent。
 * @returns {string}
 */
export function formatContextCompactionLine(event) {
  if (event?.type === "started") {
    const pct = typeof event.ratio === "number" ? `${Math.round(event.ratio * 100)}%` : "-";
    return (
      `[cockpit] context compaction started: last input ${event.lastInputTokens ?? "-"} tokens > threshold ${event.thresholdTokens ?? "-"} ` +
      `(${pct} of window ${event.modelContextWindow ?? "-"}, total ${event.totalInputTokens ?? "-"})\n`
    );
  }
  const secs = typeof event?.durationMs === "number" ? `${(event.durationMs / 1000).toFixed(1)}s` : "-";
  if (event?.ok === true) {
    const persona = event.personaInjected ? "persona re-injected" : event.personaDeferred ? "persona deferred to next turn" : "persona not injected";
    return `[cockpit] context compaction finished: ${secs} (${persona})\n`;
  }
  return `[cockpit] context compaction failed: ${secs} reason=${event?.reason ?? "unknown"}${event?.message ? ` — ${event.message}` : ""}\n`;
}

/**
 * 返事の遅延のログ 1 行（操縦席の標準出力・数字ときっかけの種類だけ・本文は書かない）。
 * @param {any} record  cockpit-server の onReplyLatency が渡すレコード。
 * @returns {string}
 */
export function formatReplyLatencyLine(record) {
  const ms = (/** @type {unknown} */ v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : "-");
  const seg = record && record.segments ? record.segments : {};
  const cause = record && record.cause && typeof record.cause.type === "string" ? record.cause.type : "-";
  return (
    `[cockpit] latency: fire=${record?.fireId ?? "-"} cause=${cause} total=${ms(record?.totalMs)} level=${record?.level ?? "-"} ` +
    `stt=${ms(seg.transcribeMs)} judge=${ms(seg.judgeMs)} screen=${ms(seg.screenMs)} llm=${ms(seg.llmFirstMs)} ` +
    `sentence=${ms(seg.firstSentenceMs)} tts=${ms(seg.ttsMs)} voice=${ms(seg.voiceMs)} other=${ms(record?.otherMs)}` +
    `${typeof record?.voice === "string" ? ` voiceEngine=${record.voice}` : ""}` +
    `${record?.spoken === false ? " spoken=no" : ""}` +
    // 体なしの返事（声の区間に器の往復が入らない・配信の組み直し Domain C）。体があるときは今と同じ行。
    `${record?.bodyless === true ? " body=none" : ""}\n`
  );
}

/**
 * 操縦席の終わり（Ctrl+C / stdin の EOF）の手順（配信の組み直し Domain D・stream-restructure.md §3「Ctrl+C」）。
 *  1. もう一度呼ばれたら（2 回目の Ctrl+C）、記録の待ちを打ち切るだけ（待っていなければ何もしない）。
 *  2. 場が閉じていなければ「配信を終える」と同じ道（server.endStream = 写し → 畳む → 記憶の最後の保存を待つ → 閉じる）を
 *     通る。開きかけ・閉じかけなら終わるのを待つ。閉じていれば保存は頼まない（場の外では記録しない）。
 *  3. server.close() → 場が閉じていたときだけ、走っている保存（前の場の最後の保存の残りなど）を待つ（頼まない・
 *     上限つき・打ち切れる。2 で終えたときはそこで待ったので待たない）→ 残りの常駐を畳む（disposeRest）。どこで
 *     失敗しても finalize（プロセスの終わり）は必ず走る。
 * @param {object} deps
 * @param {(line: string) => void} deps.write
 * @param {() => void} [deps.beforeClose]  最初に畳むもの（隙間の圧縮の見張り）。
 * @param {{ streamStatus: () => { phase: string }; endStream: () => Promise<any>; close: () => Promise<void> }} deps.server
 * @param {{ skipMemoryWait: () => boolean; waitForRunningSaves: () => Promise<void> }} deps.venue
 * @param {() => Promise<void>} deps.disposeRest
 * @param {() => Promise<void>} deps.finalize
 * @returns {() => Promise<void>}
 */
export function createCockpitShutdown(deps) {
  let closing = false;
  return async function shutdown() {
    if (closing) {
      if (deps.venue.skipMemoryWait()) deps.write("[cockpit] 記録の書き出しを待たずに終了します。\n");
      return;
    }
    closing = true;
    deps.write("\n[cockpit] closing…\n");
    try {
      try {
        deps.beforeClose?.();
      } catch {
        // best-effort
      }
      let ended = false;
      if (deps.server.streamStatus().phase !== "closed") {
        deps.write("[cockpit] 配信を終えます（記録してから畳みます・もう一度 Ctrl+C で記録を待たずに終了）。\n");
        await deps.server.endStream();
        ended = true;
      }
      await deps.server.close(); // orchestrator.dispose を含む（cockpit-server の close 契約）。
      // 終えるを通ったときは、そこで走っている保存の終わりまで待った（か打ち切った）ので、もう一度は待たない。
      if (!ended) await deps.venue.waitForRunningSaves();
      await deps.disposeRest();
    } finally {
      await deps.finalize();
    }
  };
}

const HELP = `usage: node scripts/cockpit.mjs [--port N] [--channel <ws-url>] [options]
  --port N              listen port（既定 ${DEFAULT_COCKPIT_PORT}・127.0.0.1 限定）
  --open                待受け完了後に既定ブラウザを開く（Windows）
  --channel <ws-url>    器の Control Channel URL（ws://127.0.0.1:<port>/channel?token=..）の**初期値**
                        （後方互換）。指定しても起動時には LLM セッションを作らない（頭のセッションと Channel の
                        接続は「配信を始める」で作る）。未指定でも操縦席（ブラウザ）の Channel 欄から URL を入力
                        できる（URL は次回起動まで記憶される）。
  --tts-base-url <url>  AivisSpeech の base URL（既定 http://127.0.0.1:10101）
  --speaker <id>        AivisSpeech の話者 ID（ロールの話者を上書きする・無ければロールの値）
  --fire-window-min <m> 注入窓の幅（分・既定 ${FIRE_WINDOW_MS / 60000}）
  --fire-max-chars <n>  注入テキストの文字数上限（既定 ${FIRE_MAX_CHARS}）
  起動後、表示された http://127.0.0.1:<port>/ をブラウザで開き「配信を始める」を押す。Ctrl+C / EOF で終了
  （配信中なら「配信を終える」と同じ道で記録してから畳む）。
`;

async function main() {
  const args = parseCockpitArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
    return;
  }

  // 前回の起動で取り残した Codex の記録ファイル（台帳 codex-rollouts.local.json の分）を、起動時に 1 回だけ消す。
  // 以後のセッション（①・②書き出し役・④思い出し役）を作っても掃除は走らない（応答の遅れの直し・latency-fix-plan.md §2-1）。
  try {
    sweepCodexRollouts();
  } catch {
    // 掃除は best effort（起動を止めない）。
  }
  // 配信の組み直し Domain A・B: 起動時の引っ越し（stream-restructure.md §2.4）。設定の分はロールの置き場（roles/）が
  // 無いときだけ設定ファイルから chappy と cody を作る（古いキーは消さない）。記憶の分は memories/ の直下に記録があって
  // memories/chappy/ が無いときだけ、中身を .git ごと memories/chappy/ へ移す（記憶のフォルダの準備より前）。2 つの
  // 条件は混ぜずに独立に判定する。移す前の写しは、この起動の 1 つの写しのフォルダ（tmp/restructure-backups/ の下）に
  // 両方置く。何が起きたかはここでターミナルへ 1 回だけ出し、操縦席のログのタブにも同じ行を出す。
  const migrationBackup = migrationBackupDir(DEFAULT_MIGRATION_BACKUP_ROOT, Date.now());
  const startupMigration = runStartupMigration({
    rolesDir: DEFAULT_ROLES_DIR,
    settingsPath: DEFAULT_SETTINGS_PATH,
    memoriesDir: DEFAULT_MEMORY_DIR,
    backupDir: migrationBackup
  });
  const startupNotices = formatStartupMigrationReport(startupMigration);
  const startupMigrationFailed =
    startupMigration.roles.status === "failed" || startupMigration.memories.status === "failed";
  for (const line of startupNotices) {
    if (startupMigrationFailed) process.stderr.write(`[cockpit] WARN: ${line}\n`);
    else process.stdout.write(`[cockpit] ${line}\n`);
  }

  // ── S3 追撃 domain-c: fire は常時結線・session/player は遅延生成・Channel URL は後入力可 ──────
  const settings = createFileSettingsStore();
  // 配信の組み直し Domain A: ロールの選択（頭の選択の置き換え・§createRoleHooks）。名前・性格の指示・動かすモデル・
  // 声・口数・話し始め・hotwords は今のロールから引く。
  const roleHooks = createRoleHooks({ rolesDir: DEFAULT_ROLES_DIR, settings });
  // S5「目が開く」: 視覚発火の対象ウインドウ設定（Channel URL と同型の薄い橋渡し・§createVisionTargetHooks）。
  const visionTargetHooks = createVisionTargetHooks(settings);
  // S6「会話が続く」: 魂の声の出力デバイス設定（vision target と同型の薄い橋渡し・§createAudioDeviceHooks）。
  const audioDeviceHooks = createAudioDeviceHooks(settings);
  // S6「会話が続く」: 自発発火 ON/OFF の永続トグル（既定 OFF・§createSelfFireHooks）。
  const selfFireHooks = createSelfFireHooks(settings, false);
  // 「朗読と合いの手」: barge-in ON/OFF の永続トグル（既定 ON・裁定 1・§createBargeInHooks）。
  const bargeInHooks = createBargeInHooks(settings, true);
  // 口数モード（quiet/normal/chatty・既定 "normal"・§createVerbosityHooks）。配信の組み直し Domain A から値の
  // 出どころは今のロール（role.json の verbosity）。
  const verbosityHooks = createVerbosityHooks(roleHooks.roleSettings);
  // S7「視聴者が混ざる」: 視聴者チャット配信 source の永続化（Channel URL と同型の薄い橋渡し・
  // §createChatSourceHooks）。実チャット器官の Connect/停止は cockpit-server 所有（POST 駆動）。
  const chatSourceHooks = createChatSourceHooks(settings);
  // 操縦席の文字起こし選択（whisper / ElevenLabs・既定 whisper・§createSttEngineHooks）。
  const sttEngineHooks = createSttEngineHooks(settings);
  // 声の方式（AivisSpeech / ElevenLabs・既定 aivis・§createTtsEngineHooks）。出どころは今のロール（voice.engine）。
  const ttsEngineHooks = createTtsEngineHooks(roleHooks.roleSettings);
  // 話し始めの方式（従来 / speak-now・初回既定 speak-now・§createSpeakStartHooks）。出どころは今のロール
  // （speakStartMode）。相槌どうしの最小間隔は技術のつまみなので設定ファイルのまま。
  const speakStartHooks = createSpeakStartHooks({
    ...roleHooks.roleSettings,
    getBackchannelMinIntervalSec: () => settings.getBackchannelMinIntervalSec()
  });
  // 忙しい間のコメントの扱い（あとで拾う / 見逃す・既定 あとで拾う・§createCommentBusyHooks）。
  const commentBusyHooks = createCommentBusyHooks(settings);
  const commentHold = commentBusyHooks.resolveCommentHold();
  // ①チャッピーの Codex の頭の fast（service tier "priority"・既定 OFF・§createCodexFastHooks）。次の受理の
  // configuration に段を載せる＝次の返事から効く（セッションは作り直さない・②④は通らない）。
  const codexFastHooks = createCodexFastHooks(settings, false);

  /** @type {ReturnType<typeof createLlmSession> | null} */
  let session = null;
  // Instruction changes are persisted independently from existing settings.
  // A session captures the revision used to compose its system prompt; the
  // next Fire refreshes only when this effective revision is stale.
  const instructionRevision = createInstructionRevisionController();
  let sessionInstructionRevision = null;
  let sessionContextRevision = 0;
  let sessionAcceptedContextRevision = null;
  // 今のセッションを作ったときのロールの体の有無（①に表情の教えを足したか）。今のロールの体と違えば次の Fire の境目で
  // 作り直す（配信の組み直し Domain C）。
  /** @type {boolean | null} */
  let sessionBody = null;
  /** @type {ReturnType<typeof createStreamPlayer> | null} */
  let player = null;
  let audioRevision = 0;
  let playerAudioRevision = null;
  // 声の差し替え口（Start のときに作る・種類が変われば作り直す）。desiredTtsEngine は最後に Start で選ばれた方式
  // （起動直後は記憶の値）で、Start より前の Fire もこの方式で作る。
  let desiredTtsEngine = ttsEngineHooks.resolveInitialTtsEngine();
  // 配信の組み直し Domain A: 声（AivisSpeech の話者・ElevenLabs の声の id）は今のロールから引く。`--speaker` は
  // ロールの話者を上書きする（§resolveRoleVoice）。話者・声の id が替われば engine を作り直す（voiceKey）。
  const roleVoice = () => resolveRoleVoice(roleHooks.current(), args);
  const voiceEngines = createVoiceEngineManager({
    aivisDeps: () => ({ ttsBaseUrl: args.ttsBaseUrl, speaker: roleVoice().speaker }),
    // D と E の接点（voice-swap-wave-plan.md §3）: 読みは AivisSpeech の /accent_phrases（tts-client の口）から取る。
    elevenLabsDeps: () => {
      const voice = roleVoice();
      return {
        readingClient: createTtsClient({ baseUrl: args.ttsBaseUrl, speaker: voice.speaker }),
        ttsBaseUrl: args.ttsBaseUrl,
        speaker: voice.speaker,
        ...(voice.voiceId ? { voiceId: voice.voiceId } : {})
      };
    },
    voiceKey: () => JSON.stringify(roleVoice()),
    onStatus: (info) => server?.setVoiceEngineStatus(info),
    onReadingsFallback: () => server?.reportVoiceReadingsFallback()
  });
  // 配信間記憶: cockpit-server の実体（createCockpitServer 呼び出しは本ファイル下方）。保存の係が
  // ライブ転写取得（server.getTranscript）に使うための前方参照（let・sessionProxy が session を forward
  // 参照するのと同型 = 実際の呼び出しは起動完了後にしか起きないため安全）。
  /** @type {ReturnType<typeof createCockpitServer> | undefined} */
  let server;
  // 多頭化 Domain B: 現在の頭。session let と同格の main() スコープ let。ensureFireResources がこの値で頭を分岐する。
  // 配信の組み直し Domain A: 頭は今のロールが指す（role.json の brain）。onSetRole がロールを替えたときに更新する
  // （切替は現 session を次の Fire の境目で dispose→null にし、次の ensureFireResources が新しい頭を生成する）。
  // KILL 状態は orchestrator 側にあり切替を跨いで生存する（頭非依存・触らない）。
  let currentBrain = roleHooks.current().brain;
  // 配信の組み直し Domain C: 今のロールに体があるか（role.json の body）。値は持ち回らず、使う時点でいつも今のロールから
  // 読む（受理のたび・頭に聞くたび・セッションを作るとき）。耳が止まっている間にロールを替えても古い値が残らない。
  const currentBody = () => roleHooks.current().body !== false;
  // 会話指示 = 今のロールの性格の指示（roles/<id>/instructions.md・§createRoleInstructionStore）。
  // 編集画面に読むだけで見せる教えは、①に足すものと同じく今のロールの体に合わせる（体なしは expression を出さない）。
  const conversationInstructionHooks = createConversationInstructionHooks(
    createRoleInstructionStore({ dir: DEFAULT_ROLES_DIR, knownIds: () => roleHooks.knownIds() }),
    () => roleHooks.currentId(),
    instructionRevision,
    () => listSoulSkills({ names: soulSkillNamesForBody(currentBody()) })
  );
  // One runtime authority for the current name. All identity seams (prompt, Whisper, scheduler, and public
  // state) read this closure at the appropriate lifecycle boundary. 配信の組み直し Domain A: 名前は今のロールが
  // 持つ（頭からは引かない）。
  const getCurrentRoleIdentity = () => roleHooks.identity();

  // 配信間記憶（記憶の作り直し Wave 2）: 起動時に記憶を①へ載せることはしない（①は思い出したいときに頼む・
  // recall-flow.md §7）。記憶のフォルダを準備し（無ければ作る・git init・`_conventions.md` の種）、
  // 今回の配信の本体のファイル名を最初の保存で一度だけ決めて持ち回る（申し送り 2）。
  // 配信の組み直し Domain B: 記憶のフォルダは今のロールのフォルダ（memories/<role-id>/・§createRoleMemoryPlaces）。
  // 準備・本体のファイル名・②・④はどれも今のロールの置き場を使う。記憶の引っ越しが失敗した起動では、記憶を読み書き
  // しない（前の形の記録が残る根を触らない）。配信の組み直し Domain D: 置き場（本体のファイル名）は場の始まりで作り直し、
  // そのロールの置き場の準備もそこで待つ（§createStreamVenueHooks の renewRecords・起動時とロールの切り替えでは待たない）。
  const memoryStartedAtMs = Date.now();
  const memoryPlaces = createRoleMemoryPlaces({
    root: DEFAULT_MEMORY_DIR,
    currentRole: () => roleHooks.current(),
    startedAtMs: memoryStartedAtMs,
    available: startupMigration.memories.status !== "failed",
    onPrepareFailed: ({ roleId, error }) => {
      // 記録できないだけで配信は止めない（保存のたびにコミットが失敗として警告に出る）。
      process.stderr.write(`[cockpit] WARN: memory folder is not ready (${roleId}: ${error})\n`);
    }
  });
  // 頭のセッション（①・②）の警告はターミナルへ 1 行。MCP の名前の読み取り（config/read）の失敗は、ユーザーの
  // MCP が起動しうるので操縦席の上の帯にも alert で出す（ユーザー決定 2026-10-21・続けるのは同じ）。
  const onBrainWarning = (/** @type {string} */ w) => {
    process.stderr.write(`[cockpit] WARN: ${w}\n`);
    if (isMcpConfigReadFailureWarning(w)) server?.reportMcpConfigReadFailed();
  };
  // 最新の記録時刻（snapshot の memory.lastRecordAtMs）と「転写が前回記録から不変ならスキップ」の判定用の件数は、
  // 配信の組み直し Domain D から場ごと（§createStreamVenueHooks が持つ・場の始まりで null / 0 に戻す）。

  // 初期 Channel URL: --channel（後方互換）> settings の lastChannelUrl（前回起動の記憶）> 未設定。
  const initialUrl = args.channel ?? settings.getLastChannelUrl() ?? null;
  let desiredChannelUrl = initialUrl;
  let channelRevision = 0;
  let appliedChannelRevision = 0;
  const fireDiagnostics = createFireDiagnostics();
  // 頭の文脈の記録（session-usage/・本文なし・context-growth-2026-10.md §6）。発火ごとの 1 行（Codex の頭のとき）と、
  // 圧縮の開始・終了を 1 行ずつ。配信の組み直し Domain D: 場 1 つに 1 ファイル（場の始まりで作り直す・
  // §createStreamVenueHooks の renewRecords）。起動から最初の場までの分は起動の時刻のファイル（書くものが無ければ作られない）。
  let sessionUsageLog = createSessionUsageLog();
  // 隙間で手動の圧縮（Codex の頭のみ・context-growth-2026-10.md §6・§8）。目安は settings ファイルのキー
  // （無ければ 20 万トークン / 3 秒 / 10 分）。圧縮を始める大きさは操縦席の設定（頭脳・会話のタブ）からも変えられ、
  // contextCompactionHooks が保存と走っている compactor の差し替えを担う（次の確認から効く）。隙間の材料は
  // cockpit-server、頭のセッションは今の session（Codex で、設定の変更で作り直し待ちになっていないときだけ）。見え方はターミナル 1 行・ログのタブ 1 行・記録 1 行と、
  // 最中の間の上の帯の状態のピル「圧縮中」（broadcastContextCompaction が snapshot の compacting を切り替える）。
  const contextCompactor = createContextCompactor({
    ...resolveContextCompactionOptions(settings),
    getSession: () => {
      if (!isCodexBrainId(currentBrain) || session == null) return null;
      const stale =
        sessionInstructionRevision !== instructionRevision.getRevision() ||
        sessionAcceptedContextRevision !== sessionContextRevision;
      return stale ? null : /** @type {any} */ (session);
    },
    getQuietGap: () => (server ? server.getQuietGap() : null),
    onEvent: (event) => {
      process.stdout.write(formatContextCompactionLine(event));
      sessionUsageLog.append(contextCompactionUsageRecord(event, currentBrain));
      server?.broadcastContextCompaction(
        event.type === "started"
          ? { phase: "started", inputTokens: event.lastInputTokens, thresholdTokens: event.thresholdTokens, ratio: event.ratio }
          : {
              phase: event.ok ? "finished" : "failed",
              durationMs: event.durationMs,
              reason: event.reason,
              personaInjected: event.personaInjected
            }
      );
    }
  });
  const contextCompactionHooks = createContextCompactionHooks(settings, contextCompactor);
  // 残量ゲージの材料（Codex は頭が Codex のときに App Server から・ElevenLabs は 10 分おき・cockpit-glance-redesign.md §9.2）。
  // 監視は listen の後に始め、終了時に止める。キーやアカウント情報は状態にもログにも載せない。
  const quotaMonitor = createQuotaMonitor({
    readCodex: createCodexQuotaReader({ getBrain: () => currentBrain, getSession: () => session }),
    readElevenLabs: () => fetchElevenLabsSubscription()
  });
  // 画面キャプチャの撮る係（常駐 PowerShell）。耳の Start で立ち上げ、耳の Stop・操縦席の終了で止める
  // （discussion/ai-cohost/research/vision-capture-latency-2026-10.md §4）。使えない間の撮影は今の
  // captureWindow（毎回起動）に戻る。記録は標準出力へ 1 行（数字と種類だけ）。
  const residentCapture = createResidentCapture({
    onEvent: (event) => process.stdout.write(formatCaptureEventLine(event))
  });
  const lazyChannel = createLazyChannel(initialUrl, {
    onTrace: (event, fields) => fireDiagnostics.record(event, fields)
  });
  if (args.channel) {
    // --channel 明示指定は初期値として settings にも載せる（次回起動で復元）。
    settings.setLastChannelUrl(args.channel);
  }

  const windowMs = args.fireWindowMin != null && Number.isFinite(args.fireWindowMin)
    ? args.fireWindowMin * 60_000
    : undefined;
  const maxChars = args.fireMaxChars != null && Number.isFinite(args.fireMaxChars)
    ? args.fireMaxChars
    : undefined;

  /**
   * session/player を遅延生成する（S2.5 無退行の要）。呼ばれるまで LLM の spawn（≈12s）は走らない。
   * 冪等（既に生成済みなら何もしない）。env ガードは session 初回生成時に一度だけ通す。
   *
   * S6「会話が続く」: player は起動時（またはデバイス変更後の再生成時）に settings の出力デバイス名を
   * env 経由で渡す（`createStreamPlayer({ deviceName })`）。未記憶なら deviceName 未指定 = 既定デバイス。
   * 声の差し替え Wave 2: player と声の差し替え口は ensureVoiceResources()（耳の Start で先に作る）。
   */
  const ensureFireResources = () => {
    ensureSession();
    ensureVoiceResources();
  };

  /**
   * 頭のセッションを遅延生成する（冪等・既に生成済みなら何もしない）。配信の組み直し Domain D から、ふだんは「配信を始める」
   * で作る（§openStreamSession）。場の途中で会話指示・体が替わったときは、次の Fire の境目で作り直す（applyDesiredFireSettings）。
   */
  const ensureSession = () => {
    if (session == null) {
      // 多頭化 Domain B: 頭の生成は registry 経由（brains.mjs の BRAINS）。未知値は防御的に Claude へ。
      const brainDef = BRAINS[currentBrain] ?? BRAINS.claude;
      // Resolve once for this newly-created session. A later role selection
      // disposes this session; the next Fire resolves the new identity again.
      const sessionIdentity = getCurrentRoleIdentity();
      // このセッションの頭（fast の対応の有無をどの頭のものとして覚えるか）。
      const sessionBrain = currentBrain;
      // このセッションのロールの体の有無（体なしは表情の教えを①に足さない・配信の組み直し Domain C）。
      const sessionHasBody = currentBody();
      // ── Claude 既定経路は現状と完全同一（blocking #2「1 ビット不変」）───────────────────────
      //  currentBrain === "claude" のとき: 起動経路でも Anthropic env ガードを明示的に通す（llm-session
      //  内でも呼ばれるが二重の防波堤・cli.mjs の型）→ 従来と同じ warnings 出力順序。BRAINS.claude.create は
      //  `(o) => createLlmSession(o)` の薄いラッパゆえ、下の create({...}) は従来の createLlmSession({...})
      //  と同じ引数・同じ呼び出しになりバイト等価。
      //  Codex 経路では codex-session が内部で OpenAI 版ガード（assertSubscriptionAuthEnvOpenAI）を
      //  onWarning 経由で走らせるため、ここで Anthropic ガードは呼ばない（別 provider へ Anthropic ガードを
      //  当てると誤った拒否/検査になる）。
      //  2026-10-16: Claude Opus 5.5（"claude-opus-55"）も同じ llm-session 経路なので同じガードを通す。
      if (currentBrain === "claude" || currentBrain === "claude-opus-55") {
        const { warnings } = assertSubscriptionAuthEnv(process.env);
        for (const warning of warnings) {
          process.stderr.write(`[cockpit] WARN: ${warning}\n`);
        }
      }
      // onInit は createCodexSession では余剰プロパティとして単に無視される（JS の余剰プロパティ・
      // Domain A 確認済み）。createLlmSession は従来どおり onInit/onWarning を使う。
      session = brainDef.create({
        // 人格の指示は「名前 + 会話指示」+ 魂の教え（`<recall>` の使い方・skills/）。起動時の記憶の搭載は撤去
        // （記憶の作り直し Wave 2）。教えは会話指示とは別の固定の部分で、会話指示を書き換えても消えない（Wave 3）。
        // 配信の組み直し Domain A: 名前と性格の指示は今のロールから（§buildRoleSessionSystemPrompt）。
        systemPrompt: buildRoleSessionSystemPrompt(
          sessionIdentity,
          conversationInstructionHooks.getProfile(roleHooks.currentId()).body,
          loadSoulSkills({ names: soulSkillNamesForBody(sessionHasBody), onWarning: onBrainWarning })
        ),
        onWarning: onBrainWarning,
        // Codex の使用率の差分（account/rateLimits/updated）を残量にマージする。Claude のセッションは無視する。
        onRateLimits: (/** @type {any} */ rateLimits) => {
          if (isCodexBrainId(currentBrain)) quotaMonitor.mergeCodexUpdate(rateLimits);
        },
        // 今のモデルが fast（priority）を持つか（codex-session が model/list で読んだ段）。操縦席の
        // 「このモデルは fast 非対応」の表示に使う。Claude のセッションは無視する。
        onServiceTiers: (/** @type {any} */ info) => {
          if (codexFastHooks.noteServiceTiers(sessionBrain, info?.serviceTiers)) server?.codexFastStatusChanged();
        },
        onInit: (init) =>
          process.stderr.write(
            `${JSON.stringify({ event: "session_init", model: init.model, apiKeySource: init.apiKeySource, tools: init.tools })}\n`
          )
      });
      sessionInstructionRevision = instructionRevision.getRevision();
      sessionAcceptedContextRevision = sessionContextRevision;
      sessionBody = sessionHasBody;
    }
  };

  /**
   * 頭のセッションを畳む（冪等・配信の組み直し Domain D: 「配信を終える」と、始めるの途中の失敗の巻き戻し）。畳んだ頭の
   * 圧縮はもう続かないので、操縦席の「圧縮中」も戻す。
   */
  const disposeSession = async () => {
    const current = session;
    if (current == null) return;
    session = null;
    sessionInstructionRevision = null;
    sessionAcceptedContextRevision = null;
    sessionBody = null;
    server?.resetContextCompaction();
    try {
      await current.dispose();
    } catch {
      // best-effort（畳んだセッションは使わない）。
    }
  };

  /**
   * 「配信を始める」の頭のセッション（stream-restructure.md §3 の 5）: 前の場のセッション（や起動時に作ったもの）は使わず、
   * 今のロールのモデルと指示で作り直す。
   */
  const openStreamSession = async () => {
    await disposeSession();
    ensureSession();
  };

  /**
   * 流し込みプレイヤー（常駐 PowerShell + C#・起動に約 0.5 秒）と声の差し替え口を用意する（冪等）。
   * 耳の Start のときに呼んで先に起こしておく（申し送り 1・最初の Fire に起動を乗せない）。常駐が
   * 落ちていたら作り直す。出力デバイスの変更は applyDesiredFireSettings が次の Fire の境目で反映する
   * （revision 方式・進行中の発話は accepted snapshot の player を最後まで使う）。
   */
  const ensureVoiceResources = () => {
    if (player != null && !player.isAlive()) {
      try {
        player.dispose();
      } catch {
        // best-effort（落ちた常駐は使わない）。
      }
      player = null;
      playerAudioRevision = null;
    }
    if (player == null) {
      const deviceName = audioDeviceHooks.getAudioDevice() ?? undefined;
      player = createStreamPlayer({
        ...(deviceName ? { deviceName } : {}),
        // 診断は行の種類だけ（id や本文は残さない）。
        onOutput: (line) => {
          const marker = typeof line === "string" ? line.split("\t", 1)[0] : "unknown";
          fireDiagnostics.record("player.child", { marker });
        },
        onError: () => fireDiagnostics.record("player.child.error")
      });
      playerAudioRevision = audioRevision;
    }
    // 声の engine（Start で用意済みならそれ・Start より前の Fire は今の方式で作る。用意できなければ理由で投げる）。
    voiceEngines.ensure(desiredTtsEngine);
  };

  const applyDesiredFireSettings = async () => {
    // 器の URL の差し替えは体のあるロールのときだけ（体なしは器を使わない。差し替えは体のあるロールに戻った最初の
    // Fire の境目で効く・配信の組み直し Domain C）。
    if (currentBody() && appliedChannelRevision !== channelRevision) {
      lazyChannel.setUrl(desiredChannelUrl);
      appliedChannelRevision = channelRevision;
    }
    if (player != null && playerAudioRevision !== audioRevision) {
      try {
        player.dispose();
      } catch {
        // Best effort; replacement remains authoritative for the next Fire.
      }
      player = null;
      playerAudioRevision = null;
    }
    const sessionStale =
      session != null &&
      (sessionInstructionRevision !== instructionRevision.getRevision() ||
        sessionAcceptedContextRevision !== sessionContextRevision ||
        sessionBody !== currentBody());
    if (sessionStale) {
      const stale = session;
      try {
        await stale.dispose();
      } catch {
        // Best effort; the stale session is never reused for the next Fire.
      }
      // 畳んだ頭の圧縮はもう続かない（dispose が待っている compact() を失敗で返し、ふつうは failed が先に届く）。
      // 届かなかったときも操縦席の「圧縮中」を出しっぱなしにしない（冪等）。
      server?.resetContextCompaction();
      if (session === stale) {
        session = null;
        sessionInstructionRevision = null;
        sessionAcceptedContextRevision = null;
        sessionBody = null;
      }
    }
  };

  // orchestrator に渡す session/player は proxy（実体は ensureFireResources で遅延生成）。
  // session.ask は URL 未設定なら spawn せず明示エラー（→ orchestrator が fireError 診断に落とす）。
  // 配信の組み直し Domain C: URL の確かめはロールに体があるときだけ（hasBody）。
  // S5: ask(input) は string | content ブロック配列を透過する（createSessionProxy 参照）。
  const sessionProxy = createSessionProxy({
    getUrl: () => lazyChannel.getUrl(),
    hasBody: currentBody,
    ensureFireResources,
    getSession: () => session,
    ensureSessionCurrent: applyDesiredFireSettings
  });
  // acquireFireResources が無い経路のための proxy（本番は accepted snapshot の player 実体を使う）。
  const playerProxy = {
    /** @param {string} id @param {{ sampleRate: number; channels: number }} format */
    open(id, format) {
      ensureFireResources();
      return /** @type {any} */ (player).open(id, format);
    },
    /** @param {string} id @param {Uint8Array} pcm */
    write(id, pcm) {
      return player != null ? player.write(id, pcm) : false;
    },
    /** @param {string} id */
    end(id) {
      return player != null ? player.end(id) : false;
    },
    /** barge-in の声止め（S6）。open が走った後にしか呼ばれない = player は生成済み。best-effort。 */
    stop() {
      if (player != null) player.stop();
    },
    /** @param {(event: any) => void} listener */
    onEvent(listener) {
      ensureVoiceResources();
      return /** @type {any} */ (player).onEvent(listener);
    }
  };
  // 既定の AivisSpeech engine の deps（話者は今のロールの声・`--speaker` が上書き）。受理のたびに作る。
  const productionSpeakDeps = () =>
    Object.freeze({
      ttsBaseUrl: args.ttsBaseUrl,
      speaker: roleVoice().speaker
    });
  const acquireAcceptedFireResources = async () => {
    await applyDesiredFireSettings();
    // 配信の組み直し Domain C: 体の有無は受理の時点の今のロールから読む。体ありは今どおり URL が無ければ断る。
    // 体なしは器を渡さない（URL を見ない・運び手は手元の再生器だけで鳴らす・§resolveFireChannel）。
    const fireChannel = resolveFireChannel({ body: currentBody(), channel: lazyChannel });
    ensureFireResources();
    const acceptedSession = session;
    // 進行中の発話はこの player / engine を最後まで使う（デバイス変更の作り直しは次の Fire の境目）。
    const acceptedPlayer = player;
    const acceptedEngine = voiceEngines.current();
    return Object.freeze({
      session: acceptedSession,
      channel: fireChannel.channel,
      body: fireChannel.body,
      player: acceptedPlayer,
      engine: acceptedEngine,
      speakDeps: productionSpeakDeps(),
      configuration: Object.freeze({
        brain: currentBrain,
        sessionContextRevision,
        instructionRevision: instructionRevision.getRevision(),
        audioDevice: audioDeviceHooks.getAudioDevice(),
        audioRevision,
        channelUrl: fireChannel.channelUrl,
        channelRevision,
        // ①の turn/start に送る速さの段（Codex の頭のときだけ・受理の時点の fast の設定・Claude は null）。
        serviceTier: codexFastHooks.serviceTierFor(currentBrain)
      }),
      metadata: Object.freeze({
        sessionContextRevision,
        instructionRevision: instructionRevision.getRevision(),
        audioRevision,
        channelRevision,
        // 体なしの Fire は器につながないので、器の接続の世代も持たない（null）。
        channelConnectionGeneration: fireChannel.body ? lazyChannel.acceptedConnectionGeneration() : null
      })
    });
  };

  /**
   * 操縦席（POST /api/audio-device）から出力デバイスを設定/変更する（S6「会話が続く」）。
   *
   * ── デバイス変更の適用方式【次 accepted Fire で再起動】──────────────────────
   *  常駐プレイヤーは起動時に env `SOUL_AUDIO_DEVICE_NAME` でデバイス名を受ける（Domain A）ため、
   *  デバイス変更を反映するには常駐プロセスの再起動が要る。「次回起動から適用」（設定だけ書き換えて
   *  次回 `cockpit.mjs` 起動まで待つ）と「次 accepted Fire で再起動」の後者を採る。進行中 Fire は accepted
   *  snapshot の player を最後まで保持し、次の sessionProxy.ask 境界でのみ dispose→再生成する。
   * @param {string | null} name
   */
  const onSetAudioDevice = async (name) => {
    audioDeviceHooks.onSetAudioDevice(name); // 次回起動でも復元（file-backed・失敗寛容）。
    audioRevision += 1;
    process.stdout.write(
      name ? `[cockpit] audio device set: ${name}\n` : "[cockpit] audio device cleared (default)\n"
    );
  };

  /**
   * 操縦席（POST /api/role）からロールを選ぶ（配信の組み直し Domain A・旧 onSetBrain の置き換え）。
   * 場が閉じていない間は cockpit-server が断る（場の途中でロールを替えない・stream-restructure.md §2.1・Domain D）。
   *
   * ── ロールの切替【次 accepted Fire で dispose→再生成】────────────────────────
   *  頭・名前・性格の指示は、desired context revision を進めて次の sessionProxy.ask 境界でセッションを作り直して
   *  替わる（旧 onSetBrain と同じ。進行中 Fire の session は触らない）。声は次の Start（か Start より前の Fire）で、
   *  話者・声の id が違えば engine を作り直す（voiceKey）。口数・話し始め・声の方式は戻り値で cockpit-server へ
   *  渡す（scheduler と Start の既定に入れる）。whisper の手がかり・呼びかけの照合は次の発話から今のロールを読む。
   *  体の有無（Domain C）は持ち回らず、次の受理・頭に聞くとき・セッションを作るときに今のロールから読む（currentBody）。
   * @param {string} id
   */
  const onSetRole = async (id) => {
    const selected = roleHooks.select(id);
    if (!selected.ok) return selected;
    const role = selected.role;
    currentBrain = role.brain;
    desiredTtsEngine = role.voice.engine;
    sessionContextRevision += 1;
    // Codex の残量は頭が Codex のときだけ（Codex でなくなったら不明に戻す・Codex 同士の切替は同じアカウントなので保つ）。
    if (!isCodexBrainId(currentBrain)) quotaMonitor.clearCodex();
    // 配信の組み直し Domain B・D: 記憶の置き場は替えたロールのフォルダ。準備（git init・種）は場の始まりで待つ
    // （ロールの切り替えの応答を待たせない・§createStreamVenueHooks の renewRecords）。走っている・待っている保存は、
    // 頼んだときのロールの置き場に書く（createMemoryRecorder の getPlace）。
    process.stdout.write(`[cockpit] role set: ${role.id} (brain ${role.brain})\n`);
    return { ok: true, verbosity: role.verbosity, speakStartMode: role.speakStartMode, ttsEngine: role.voice.engine };
  };

  /** state snapshot に載せるロールの現況（今のロールと選べるロールの一覧・名前と頭の id だけ）。 */
  const roleStatus = () => {
    const role = roleHooks.current();
    return { id: role.id, displayName: role.name.display, brain: role.brain, body: role.body, roles: roleHooks.list() };
  };

  /**
   * 操縦席（POST /api/codex-fast）から①の Codex の頭の fast を切り替える。保存して、次の受理の configuration から
   * 効かせる（進行中の返事・セッションは触らない）。
   * @param {boolean} enabled
   */
  const onSetCodexFastMode = (enabled) => {
    codexFastHooks.onSetCodexFastMode(enabled);
    process.stdout.write(`[cockpit] codex fast: ${codexFastHooks.isEnabled() ? "on" : "off"} (from the next reply)\n`);
  };

  /**
   * state snapshot に載せる頭脳の現況（audioDeviceStatus と同型）。資格情報は **existsSync の存在確認のみ**
   * （blocking #4）——auth.json / .credentials.json の中身は絶対に読まない・ログ/SSE にも出さない。
   */
  const brainStatus = () => {
    const def = BRAINS[currentBrain] ?? BRAINS.claude;
    return { brain: currentBrain, credentialHealth: existsSync(def.credentialPath) };
  };

  // ── 配信間記憶: 保存の係（定期・手動「今日を記録」・配信を終える（Ctrl+C）のどれもここを通る・直列）──────────
  //  1 回の保存 = ②書き出し役（使い捨ての Codex・cwd = 記憶のフォルダ・workspace-write）が本体と目次を書き、
  //  魂が記憶のフォルダの git にコミットする（writeStreamRecord）。②の頭は Codex に固定（resolveWriterBrainDef）。
  //  server は下方の createCockpitServer(...) で代入される前方参照(sessionProxy の getSession と同型)。
  //  配信の組み直し Domain B: 記憶のフォルダ（と本体のファイル名）は保存を頼んだ時点のロールの置き場（getPlace）。
  //  配信の組み直し Domain D: 引き金は 20 分ごと・手動「今日を記録」（どちらも場が開いている間だけ）・「配信を終える」
  //  （Ctrl+C も同じ道）。耳の Stop の引き金は「配信を終える」に 1 本化した。
  const memoryRecorder = createMemoryRecorder({
    getLiveEntries: () => (server ? server.getTranscript() : []),
    getPlace: () => memoryPlaces.place(),
    writeImpl: async (entries, /** @type {ReturnType<typeof memoryPlaces.place>} */ place) => {
      if (!place) throw new Error("memory folder is not available (the memory move failed; see the startup log)");
      await place.ready;
      return writeStreamRecord({
        create: /** @type {any} */ (resolveWriterBrainDef(currentBrain).create),
        entries,
        record: place.streamRecord.get(),
        dir: place.dir,
        onWarning: onBrainWarning
      });
    },
    onSaved: (info) => {
      // 配信の組み直し Domain D: 頼んだ時点の場の保存だけを、その場の数えにする（§createStreamVenueHooks の noteSaved）。
      streamVenue.noteSaved(info);
      const { commit } = info;
      // 本文・トピック名は出さない（コミットの有無だけ）。
      const what = commit && commit.ok ? (commit.committed ? `commit ${String(commit.commit).slice(0, 7)}` : "no changes") : "commit failed";
      process.stdout.write(`[cockpit] memory recorded (${what})\n`);
    },
    onError: (error) => {
      process.stderr.write(
        `[cockpit] WARN: memory record failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
    },
    // 「記録中」の表示を操縦席へ（走り始めと全部終わったとき）。
    onRecordingChange: () => server?.memoryStatusChanged()
  });

  // 配信の組み直し Domain D: 場（配信を始める / 終える）の cockpit.mjs 側の口と場ごとの記録（§createStreamVenueHooks）。
  // cockpit-server の openStream / closeStream が streamHooks として順に呼ぶ。器の URL は場の始まりで今の値に揃えてから
  // 確かめる（体のあるロールのときだけ・体なしは器を見ない）。
  const streamVenue = createStreamVenueHooks({
    memoryPlaces,
    memoryRecorder,
    renewUsageLog: (startedAtMs) => {
      const previous = sessionUsageLog;
      sessionUsageLog = createSessionUsageLog({ startedAtMs });
      void previous.flush();
    },
    openSession: openStreamSession,
    closeSession: disposeSession,
    hasBody: currentBody,
    channel: {
      getUrl: () => {
        if (appliedChannelRevision !== channelRevision) {
          lazyChannel.setUrl(desiredChannelUrl);
          appliedChannelRevision = channelRevision;
        }
        return lazyChannel.getUrl();
      },
      connect: () => lazyChannel.connect(),
      close: () => lazyChannel.close()
    },
    isStreamOpen: () => server?.streamStatus().phase === "open",
    getEntries: () => (server ? server.getTranscript() : []),
    onMemoryWait: ({ timeoutMs }) =>
      process.stdout.write(`[cockpit] 記録を書き出し中…（最大 ${timeoutMs / 1000} 秒・Ctrl+C で終了中ならもう一度 Ctrl+C で待たずに終了）\n`)
  });

  // 引き金①: 定期保存(20 分毎・場が開いている間だけ・転写が前回記録から不変ならスキップ=inventory §2-4)。
  // unref() でプロセス生存に寄与させない(ears-cli 等の既存タイマ規律)。
  const memoryCheckpointTimer = setInterval(() => {
    streamVenue.checkpoint();
  }, MEMORY_CHECKPOINT_INTERVAL_MS);
  memoryCheckpointTimer.unref();

  /** 引き金②: 操縦席(POST /api/memory-record)からの手動「今日を記録」(保存の係の薄いラッパ・場が閉じていればサーバが断る)。 */
  const onMemoryRecord = () => memoryRecorder.record();

  /**
   * ④思い出し役を 1 回走らせる（記憶の作り直し Wave 3・思い出しの係が呼ぶ）。使い捨ての Codex（resolveWriterBrainDef と
   * 同じ決め方）を cwd = 記憶のフォルダ・read-only・最後の答えだけで作る。警告は①②と同じ onBrainWarning へ。
   * 配信の組み直し Domain B: 記憶のフォルダは今のロールのフォルダ（ほかのロールの記憶は読まない）。
   * @param {{ request: string; entries: ReadonlyArray<any>; nowMs: number }} job
   */
  const recallRunner = async (job) => {
    const place = memoryPlaces.place();
    if (!place) throw new Error("memory folder is not available (the memory move failed; see the startup log)");
    await place.ready;
    return runRecall({
      create: /** @type {any} */ (resolveWriterBrainDef(currentBrain).create),
      request: job.request,
      entries: job.entries,
      nowMs: job.nowMs,
      dir: place.dir,
      onWarning: onBrainWarning
    });
  };

  /** state snapshot に載せる記憶の現況（この場で最後に記録した時刻と、今記録中か）。 */
  const memoryStatus = () => ({ lastRecordAtMs: streamVenue.lastRecordAtMs(), recording: memoryRecorder.isRecording() });

  /** fireOrchestratorFactory は常に注入する（Channel URL 未設定でも fire は「使えないが結線済み」）。 */
  const fireOrchestratorFactory = (/** @type {any} */ hooks) =>
    createFireOrchestrator({
      ...hooks,
      onFire: (info) => {
        if (info?.accepted === true) {
          fireDiagnostics.begin({
            injectedChars: typeof info.injectedChars === "number" ? info.injectedChars : null,
            includedCount: typeof info.includedCount === "number" ? info.includedCount : null,
            vision: info.vision === true,
            // 操縦席の発火番号ときっかけの種類（本文なし）で、診断の JSONL と画面のデータを結べるようにする。
            fireNo: typeof info.fireId === "number" ? info.fireId : null,
            causeType: info.cause && typeof info.cause.type === "string" ? info.cause.type : null
          });
        }
        hooks.onFire?.(info);
      },
      onDiagnostic: (diagnostic) => {
        fireDiagnostics.record("fire.diagnostic", {
          diagnosticType: typeof diagnostic?.type === "string" ? diagnostic.type : "unknown",
          kind: typeof diagnostic?.kind === "string" ? diagnostic.kind : null
        });
        hooks.onDiagnostic?.(diagnostic);
      },
      // 頭の文脈の記録: ask が返るたびに 1 行（Codex の頭のときだけ・本文なし）。
      onAskRecord: (info) => {
        if (isCodexBrainId(info?.brain ?? currentBrain)) sessionUsageLog.append(fireUsageRecord(info));
      },
      onTrace: (trace) => {
        // 発火のたびに Codex の使用率を読む（ask が済んだ直後・失敗したとき。App Server の起動後にしか読めない）。
        if (trace?.event === "llm.ask.completed" || trace?.event === "fire.failed") void quotaMonitor.refreshCodex();
        // 返事が終わるたびに、隙間で圧縮してよいかを確かめる（発火の後始末が済んでから）。
        if (trace?.event === "fire.completed" || trace?.event === "fire.failed") contextCompactor.noteReplyFinished();
        if (trace?.event === "fire.completed") {
          fireDiagnostics.finish({ fired: trace.fired === true, reason: trace.reason ?? null });
          return;
        }
        if (trace?.event === "fire.failed") {
          fireDiagnostics.fail(
            typeof trace.stage === "string" ? trace.stage : "unknown",
            { name: trace.failureName ?? "Error", code: trace.failureCode ?? null }
          );
          return;
        }
        if (trace && typeof trace.event === "string") {
          const { event, ...fields } = trace;
          fireDiagnostics.record(event, fields);
        }
      },
      session: /** @type {any} */ (sessionProxy),
      channel: /** @type {any} */ (lazyChannel),
      player: /** @type {any} */ (playerProxy),
      progressivePlayback: true,
      acquireFireResources: acquireAcceptedFireResources,
      // S5「目が開く」: 対象ウインドウの解決関数（settings 経由）。撮影は常駐の撮る係に頼む
      // （vision-capture-latency §4・使えない間は captureWindow＝毎回起動に戻る）。
      getVisionTarget: visionTargetHooks.getVisionTarget,
      captureImpl: residentCapture.capture,
      speakDeps: productionSpeakDeps(),
      ...(windowMs != null ? { windowMs } : {}),
      ...(maxChars != null ? { maxChars } : {})
    });

  /** 操縦席（POST /api/channel）から Channel URL を設定/変更する。token を平文で保持/ログしない。 */
  const onSetChannelUrl = async (/** @type {string | null} */ url) => {
    desiredChannelUrl = url;
    channelRevision += 1;
    try {
      settings.setLastChannelUrl(url); // 次回起動で復元（file-backed・失敗寛容）。
    } catch {
      // 永続化失敗は起動/操作を止めない。
    }
    process.stdout.write(
      url ? `[cockpit] channel set: ${redactToken(url)}\n` : "[cockpit] channel cleared\n"
    );
  };

  /**
   * state snapshot に載せる Channel の現況（redact 済み・token を平文で出さない）。
   * 配信の組み直し Domain C: 今のロールの体の有無（body）も載せる。体なしなら画面の器の状態は「体なし」
   * （view-logic/status.mjs の channelStatusView）。
   */
  const channelStatus = () => {
    const u = desiredChannelUrl;
    return {
      configured: u != null,
      url: u != null ? redactToken(u) : null,
      connection: lazyChannel.connectionStatus(),
      body: currentBody()
    };
  };

  // 配信の組み直し Domain D: --channel で起動しても、起動時には頭のセッションを作らない（先充填はやめた）。頭のセッションは
  // 「配信を始める」で今のロールのモデルと指示で作る（§openStreamSession・stream-restructure.md §3 の 5）。

  server = createCockpitServer({
    port: args.port ?? DEFAULT_COCKPIT_PORT,
    indexHtmlPath: cockpitHtmlPath,
    settingsStore: settings,
    // Current identity providers are request/handling-time closures. The
    // server consumes this same role-backed view for Whisper, scheduler,
    // and additive public state; changing the role does not require ear or
    // scheduler recreation.
    currentRoleIdentity: getCurrentRoleIdentity,
    // 配信の組み直し Domain A: 起動時の引っ越しの結果（ログのタブに出す・引っ越しが無ければ空）。
    notices: startupNotices,
    fireOrchestratorFactory,
    onSetChannelUrl,
    channelStatus,
    // S5「目が開く」: 対象ウインドウ設定の口（GET /api/windows は既定 listWindowsImpl=Domain A listWindows
    // をそのまま使う・差し替え不要）。
    onSetVisionTarget: visionTargetHooks.onSetVisionTarget,
    visionTargetStatus: visionTargetHooks.visionTargetStatus,
    // S6「会話が続く」: 出力デバイス設定の口（GET /api/audio-devices は既定 listAudioDevicesImpl=
    // Domain A listAudioDevices をそのまま使う・差し替え不要）。
    onSetAudioDevice,
    audioDeviceStatus: audioDeviceHooks.audioDeviceStatus,
    // S6「会話が続く」: 自発発火 ON/OFF の永続トグル（起動時は settings から復元・既定 OFF）。
    selfFireInitialEnabled: selfFireHooks.resolveInitialEnabled(),
    onSetSelfFireEnabled: selfFireHooks.onSetSelfFireEnabled,
    // 「朗読と合いの手」: barge-in ON/OFF の永続トグル（起動時は settings から復元・既定 ON・裁定 1）。
    // resolveInitialEnabled() を bargeInGate 構築時の enabled へ直接渡す（born-disabled の伝播経路）。
    bargeInInitialEnabled: bargeInHooks.resolveInitialEnabled(),
    onSetBargeInEnabled: bargeInHooks.onSetBargeInEnabled,
    // 口数モード（quiet/normal/chatty・起動時は settings から復元・既定 "normal"）。
    verbosityInitialMode: verbosityHooks.resolveInitialVerbosity(),
    onSetVerbosity: verbosityHooks.onSetVerbosity,
    // 配信の組み直し Domain A: ロールの選択（旧 頭脳選択）。POST /api/role で onSetRole（選択の永続化 + 次の Fire の
    // 境目でのセッションの作り直し）を呼び、snapshot に roleStatus()（今のロール・一覧）と brainStatus()（ロールが
    // 指す頭の札 + 資格情報の存在確認）を載せる。状態の正本は cockpit.mjs 側（roleHooks・currentBrain）。
    onSetRole,
    roleStatus,
    brainStatus,
    // Conversation instructions are exposed only through the dedicated local API. The hook owns durable
    // settings writes and effective revision advancement; no instruction text enters state/SSE/transcript.
    conversationInstructionHooks,
    // S7「視聴者が混ざる」: 実チャット器官のファクトリを注入（本番 createLiveChatClient）。生成/Connect/
    // 停止のライフサイクルは cockpit-server が所有し、POST /api/chat/connect で `factory({ source })` を
    // 生成 start()・onMessage/onStatus/onDiagnostic を取り込み経路へ繋ぐ。配信 source は settings に記憶。
    chatClientFactory: createLiveChatClient,
    onSetChatSource: chatSourceHooks.onSetChatSource,
    chatSourceStatus: chatSourceHooks.chatSourceStatus,
    // 配信間記憶: 手動「今日を記録」+ 現況（最後に記録した時刻・記録中か）。記憶の ON/OFF は撤去（Wave 2）。
    onMemoryRecord,
    memoryStatus,
    // 圧縮を始める大きさ（設定の「頭脳・会話」タブ）: 保存 + 走っている compactor の差し替え・snapshot の compaction。
    onSetCompactThresholdTokens: contextCompactionHooks.onSetCompactThresholdTokens,
    contextCompactionStatus: contextCompactionHooks.contextCompactionStatus,
    // ①の Codex の頭の fast（設定の「頭脳・会話」タブ・POST /api/codex-fast と snapshot の codexFast）。
    onSetCodexFastMode,
    codexFastStatus: () => codexFastHooks.codexFastStatus(currentBrain),
    // 操縦席の文字起こし選択: 起動時に前回の選択を復元・Start ごとに記憶・遅延は標準出力へ 1 行（数字のみ）。
    // ElevenLabs のキーは cockpit-server の既定（.env.elevenlabs.local をコード内で直接読む）に任せる。
    sttEngineInitial: sttEngineHooks.resolveInitialSttEngine(),
    onSetSttEngine: sttEngineHooks.onSetSttEngine,
    // ローカルの文字起こし（Parakeet / Zipformer）の設定（画面なし・設定ファイルのキー）。Start ごとに読む。
    // モデルの存在確認は cockpit-server の既定（vendor/models）に任せる。
    // 配信の組み直し Domain A: hotwords は今のロールの名前の手がかり（ロールに無ければ設定ファイルか既定）。
    localSttSettings: () => applyRoleHotwords(settings.getLocalStt(), roleHooks.current()),
    onSttLatency: (info) => process.stdout.write(formatSttLatencyLine(info)),
    // 声の方式（声の差し替え Wave 3）: 起動時に前回の選択を復元・Start ごとに記憶し、耳を開く前に engine を用意する
    // （種類が変われば作り直す・ElevenLabs のキーはここで読む）。用意できなければ Start は理由つきで失敗する。
    ttsEngineInitial: desiredTtsEngine,
    onSetTtsEngine: ttsEngineHooks.onSetTtsEngine,
    onPrepareVoiceEngine: (kind) => {
      desiredTtsEngine = kind;
      return voiceEngines.prepare(kind);
    },
    // 画面キャプチャの撮る係の寿命を耳に合わせる（vision-capture-latency §4 の 2）。close() でも止まる。
    // 声の差し替え Wave 2: 流し込みプレイヤーと声の差し替え口も Start のときに起こす（最初の Fire に乗せない）。
    onEarsStarted: () => {
      residentCapture.start();
      try {
        ensureVoiceResources();
      } catch (error) {
        process.stderr.write(
          `[cockpit] WARN: voice resources failed to start: ${error instanceof Error ? error.message : String(error)}\n`
        );
      }
    },
    onEarsStopped: () => residentCapture.stop(),
    // 配信の組み直し Domain D: 場（配信を始める / 終える）の口。場の記録の作り直し・頭のセッション・器・記憶の最後の保存。
    streamHooks: streamVenue.hooks,
    // speak-now（話し始めの判定）: 方式は settings から復元（初回既定 speak-now）・切替ごとに記憶・判定ごとに
    // 標準出力へ 1 行（遅延・選択・確率のみ）。Decisions API のキーは cockpit-server の既定
    // （.env.decisions.local をコード内で直接読む）に任せる。
    speakStartModeInitial: speakStartHooks.resolveInitialSpeakStartMode(),
    onSetSpeakStartMode: speakStartHooks.onSetSpeakStartMode,
    onSpeakNowJudgment: (info) => process.stdout.write(formatSpeakNowLine(info)),
    // 相槌どうしの最小間隔は settings ファイルの backchannelMinIntervalSec（無ければ 8 秒・backchannel.md §2）。
    backchannelMinIntervalMs: speakStartHooks.resolveBackchannelMinIntervalMs(),
    // コメント判定（弾く判定は全モード・反応する判定は speak-now の間）: 忙しい間のコメントの扱いは settings から
    // 復元（既定 あとで拾う）・切替ごとに記憶。鮮度と件数は settings ファイルの値（無ければ 20 秒 / 3 件）。
    // 判定ごとに標準出力へ 1 行（コメント本文は書かない）。キーは speak-now と同じ既定の読み口。
    commentBusyPolicyInitial: commentBusyHooks.resolveInitialCommentBusyPolicy(),
    onSetCommentBusyPolicy: commentBusyHooks.onSetCommentBusyPolicy,
    commentHoldMaxAgeMs: commentHold.maxAgeMs,
    commentHoldMaxCount: commentHold.maxCount,
    onCommentJudgment: (info) => process.stdout.write(formatCommentJudgmentLine(info)),
    // 記憶の作り直し Wave 3: 思い出しの係（④は使い捨ての Codex・「避けるか」判定は cockpit-server の既定の Decisions API）。
    // 係の出来事は標準出力へ 1 行（頼みごと・記憶の中身は書かない）。
    recallRunner,
    onRecallEvent: (event) => process.stdout.write(formatRecallEventLine(event)),
    // 操縦席の作り直し 1 回目（データ側）: 残量・遅延のしきい値（settings の latencyWarnSec / latencyAlertSec・既定 4 / 6 秒）・
    // 返事ごとの遅延の 1 行（数字ときっかけの種類だけ）。
    quotaSource: quotaMonitor,
    latencyThresholds: resolveLatencyThresholdsFromSettings(settings),
    onReplyLatency: (record) => {
      process.stdout.write(formatReplyLatencyLine(record));
      // 返事ごとの遅延の内訳を起動ごとの記録（session-usage/）にも 1 行（SSE "latency" と同じ値・本文なし・全部の頭）。
      sessionUsageLog.append(replyLatencyUsageRecord(record));
    }
  });

  const url = await server.listen();
  quotaMonitor.start();
  contextCompactor.start();
  process.stdout.write(`[cockpit] listening on ${url} (loopback only)\n`);
  process.stdout.write(`[cockpit] open  ${url}/  in your browser — 「配信を始める」を押して、話しかける。\n`);
  const startupUrl = lazyChannel.getUrl();
  // 配信の組み直し Domain D: 頭のセッションと器の接続は「配信を始める」で作る（起動時には作らない・--channel でも同じ）。
  if (!currentBody()) {
    // 配信の組み直し Domain C: 体の無いロールは器を使わない（URL の有無を案内しない）。
    process.stdout.write(
      `[cockpit] fire wired: ロール ${roleHooks.currentId()} は体なし — 器（Channel）にはつながず、手元の再生器だけで声を出します` +
        "（表情タグは使いません）。LLM セッションは「配信を始める」で作ります。\n"
    );
  } else if (startupUrl) {
    process.stdout.write(
      `[cockpit] fire enabled: channel = ${redactToken(startupUrl)} ` +
        `(window ${(args.fireWindowMin ?? FIRE_WINDOW_MS / 60000)} min, max ${args.fireMaxChars ?? FIRE_MAX_CHARS} chars). ` +
        (args.channel ? "起動引数から。" : "設定から復元。") +
        "LLM セッションと Channel の接続は「配信を始める」で作ります（Channel につながらなければ配信は始まりません）。\n"
    );
  } else {
    process.stdout.write(
      "[cockpit] fire wired but no channel URL yet — 操縦席の Channel 欄に URL を入れてから「配信を始める」を押してください" +
        "（体のあるロールは Channel につながらないと配信を始められません）。\n"
    );
  }
  process.stdout.write("[cockpit] Ctrl+C / EOF で終了します（配信中なら「配信を終える」と同じ道で記録してから畳みます）。\n");

  // 配信の組み直し Domain D: Ctrl+C は、場が開いていれば「配信を終える」と同じ道（server.endStream）を通ってから畳む
  // （§createCockpitShutdown）。閉じていれば保存は頼まない。もう一度の Ctrl+C で記録の待ちを打ち切る。
  const shutdown = createCockpitShutdown({
    write: (line) => process.stdout.write(line),
    beforeClose: () => contextCompactor.dispose(),
    server,
    venue: streamVenue,
    // S3: fire 結線の常駐リソースも確実に畳む（リーク禁止・cli.mjs の dispose 順の型）。頭のセッションと器は場の終わりで
    // 畳み済みのはず（冪等）。
    disposeRest: async () => {
      await disposeSession();
      if (player) {
        try {
          player.dispose();
        } catch {
          // best-effort
        }
      }
      voiceEngines.dispose();
      try {
        await lazyChannel.close();
      } catch {
        // best-effort
      }
    },
    finalize: async () => {
      // 撮る係は close() の onEarsStopped で止まっているはずだが、途中で throw しても取り残さない（冪等）。
      residentCapture.stop();
      quotaMonitor.stop();
      // 記録の書き残しを少しだけ待つ（固まらないよう上限つき）。
      await Promise.race([sessionUsageLog.flush(), new Promise((resolve) => setTimeout(resolve, 1000))]);
      process.exit(0);
    }
  });
  process.on("SIGINT", shutdown);
  // stdin EOF（Ctrl+Z→Enter / パイプ終端）でも畳む（ears-cli.mjs の型）。
  const rl = createInterface({ input: process.stdin });
  rl.on("close", shutdown);
  if (args.open) openCockpitBrowser(`${url}/`);
}

const invokedDirectly = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `[cockpit] FATAL: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exit(1);
  });
}
