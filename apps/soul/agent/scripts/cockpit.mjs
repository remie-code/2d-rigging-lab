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
 *  claude-opus-4-8 既定）+ connectChannel + createAudioPlayer + speak）。Channel URL は
 *  `--channel <ws-url>`（後方互換の初期値）**または操縦席の URL 入力**（POST /api/channel）で渡せる。
 *
 *  ── S2.5 無退行【session/player の遅延生成】(S3 追撃 domain-c) ─────────────────
 *  操縦席から URL を後入力する構造にすると「fire を常時受けられる」形になるが、**URL も fire も
 *  使わないユーザー（S2.5 挙動）に LLM セッションの spawn（≈12s）を強いてはならない**。よって
 *  session/player は `ensureFireResources()` で**遅延生成**する:
 *    - `--channel` 明示指定時のみ起動時に eager 生成（従来どおり TTFT 先払い・挙動不変）。
 *    - それ以外（URL 未設定 / settings 復元 / 操縦席入力）は**初回 fire 時**に生成。
 *  URL 未設定のまま fire しても sendSpeech 前に session.ask で弾く（lazyChannel が URL 未設定を
 *  明示エラーにする前に、ここで no-URL を検出して spawn しない）。→ S2.5 ユーザーは何も spawn しない。
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

import { createCockpitServer, DEFAULT_COCKPIT_PORT } from "../src/cockpit/cockpit-server.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { cockpitHtmlPath } from "../src/cockpit/cockpit-page.mjs";
import { assertSubscriptionAuthEnv } from "../src/mind/env-guard.mjs";
import { createLlmSession } from "../src/mind/llm-session.mjs";
import { createFireOrchestrator, FIRE_SYSTEM_PROMPT } from "../src/mind/fire-orchestrator.mjs";
import { FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "../src/mind/fire-injection.mjs";
import { connectChannel, redactToken } from "../src/channel/channel-client.mjs";
import { createAudioPlayer, writeTempWav } from "../src/voice/audio-player.mjs";

/** @param {string[]} argv */
export function parseCockpitArgs(argv) {
  const args = {
    port: /** @type {number | undefined} */ (undefined),
    help: false,
    /** @type {string | undefined} */ channel: undefined,
    /** @type {string | undefined} */ ttsBaseUrl: undefined,
    /** @type {string | undefined} */ speaker: undefined,
    /** @type {number | undefined} */ fireWindowMin: undefined,
    /** @type {number | undefined} */ fireMaxChars: undefined
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
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
 * @returns {{
 *   sendSpeech: (timeline: unknown) => Promise<any>;
 *   setUrl: (next: string | null | undefined) => void;
 *   getUrl: () => string | null;
 *   connectionStatus: () => string;
 *   close: () => Promise<void>;
 * }}
 */
export function createLazyChannel(url, options = {}) {
  const connectImpl = options.connectImpl ?? connectChannel;
  let currentUrl = typeof url === "string" && url.length > 0 ? url : null;
  /** @type {Promise<{ sendSpeech: Function; close: () => Promise<void> }> | null} */
  let channelPromise = null;
  /** @type {"unset" | "idle" | "connecting" | "connected" | "error"} */
  let connState = currentUrl == null ? "unset" : "idle";

  const ensure = () => {
    if (currentUrl == null) {
      // URL 未設定で sendSpeech は明示エラー（操縦席で URL を入れる前の発火を弾く）。
      return Promise.reject(
        new Error("createLazyChannel: channel URL is not set (set it in the cockpit before firing).")
      );
    }
    if (channelPromise == null) {
      connState = "connecting";
      channelPromise = Promise.resolve(connectImpl(currentUrl))
        .then((channel) => {
          connState = "connected";
          return channel;
        })
        .catch((error) => {
          channelPromise = null; // 失敗は非キャッシュ = 次回 fire で再接続を試みる。
          connState = "error";
          throw error;
        });
    }
    return channelPromise;
  };

  return {
    async sendSpeech(timeline) {
      const channel = await ensure();
      return channel.sendSpeech(timeline);
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
    async close() {
      if (channelPromise == null) return;
      const pending = channelPromise;
      channelPromise = null;
      try {
        const channel = await pending;
        await channel.close();
      } catch {
        // 未接続（接続失敗）だった場合は畳むものがない。
      }
    }
  };
}

const HELP = `usage: node scripts/cockpit.mjs [--port N] [--channel <ws-url>] [options]
  --port N              listen port（既定 ${DEFAULT_COCKPIT_PORT}・127.0.0.1 限定）
  --channel <ws-url>    器の Control Channel URL（ws://127.0.0.1:<port>/channel?token=..）の**初期値**
                        （後方互換）。指定すると起動時に LLM セッションを eager 生成し Fire を先充填。
                        未指定でも操縦席（ブラウザ）の Channel 欄から URL を入力すれば Fire が有効化される
                        （URL は次回起動まで記憶される）。URL も Fire も使わなければ何も spawn しない（S2.5）。
  --tts-base-url <url>  AivisSpeech の base URL（既定 http://127.0.0.1:10101）
  --speaker <id>        TTS 話者 ID
  --fire-window-min <m> 注入窓の幅（分・既定 ${FIRE_WINDOW_MS / 60000}）
  --fire-max-chars <n>  注入テキストの文字数上限（既定 ${FIRE_MAX_CHARS}）
  起動後、表示された http://127.0.0.1:<port>/ をブラウザで開く。Ctrl+C / EOF で終了。
`;

async function main() {
  const args = parseCockpitArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
    return;
  }

  // ── S3 追撃 domain-c: fire は常時結線・session/player は遅延生成・Channel URL は後入力可 ──────
  const settings = createFileSettingsStore();

  /** @type {ReturnType<typeof createLlmSession> | null} */
  let session = null;
  /** @type {ReturnType<typeof createAudioPlayer> | null} */
  let player = null;

  // 初期 Channel URL: --channel（後方互換）> settings の lastChannelUrl（前回起動の記憶）> 未設定。
  const initialUrl = args.channel ?? settings.getLastChannelUrl() ?? null;
  const lazyChannel = createLazyChannel(initialUrl);
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
   */
  const ensureFireResources = () => {
    if (session == null) {
      // 起動経路でも env ガードを明示的に通す（llm-session 内でも呼ばれるが二重の防波堤・cli.mjs の型）。
      const { warnings } = assertSubscriptionAuthEnv(process.env);
      for (const warning of warnings) {
        process.stderr.write(`[cockpit] WARN: ${warning}\n`);
      }
      session = createLlmSession({
        systemPrompt: FIRE_SYSTEM_PROMPT,
        onWarning: (w) => process.stderr.write(`[cockpit] WARN: ${w}\n`),
        onInit: (init) =>
          process.stderr.write(
            `${JSON.stringify({ event: "session_init", model: init.model, apiKeySource: init.apiKeySource, tools: init.tools })}\n`
          )
      });
    }
    if (player == null) {
      player = createAudioPlayer();
    }
  };

  // orchestrator に渡す session/player は proxy（実体は ensureFireResources で遅延生成）。
  // session.ask は URL 未設定なら spawn せず明示エラー（→ orchestrator が fireError 診断に落とす）。
  const sessionProxy = {
    /** @param {string} text */
    async ask(text) {
      if (lazyChannel.getUrl() == null) {
        throw new Error("Channel URL is not set — set it in the cockpit (Channel field) before firing.");
      }
      ensureFireResources();
      return /** @type {any} */ (session).ask(text);
    }
  };
  const playerProxy = {
    /** @param {...any} playArgs */
    play(...playArgs) {
      ensureFireResources();
      return /** @type {any} */ (player).play(...playArgs);
    }
  };

  /** fireOrchestratorFactory は常に注入する（Channel URL 未設定でも fire は「使えないが結線済み」）。 */
  const fireOrchestratorFactory = (/** @type {any} */ hooks) =>
    createFireOrchestrator({
      ...hooks,
      session: /** @type {any} */ (sessionProxy),
      channel: /** @type {any} */ (lazyChannel),
      player: /** @type {any} */ (playerProxy),
      speakDeps: {
        ttsBaseUrl: args.ttsBaseUrl,
        speaker: args.speaker,
        writeWav: writeTempWav
      },
      ...(windowMs != null ? { windowMs } : {}),
      ...(maxChars != null ? { maxChars } : {})
    });

  /** 操縦席（POST /api/channel）から Channel URL を設定/変更する。token を平文で保持/ログしない。 */
  const onSetChannelUrl = async (/** @type {string | null} */ url) => {
    lazyChannel.setUrl(url); // URL 変更は既存接続キャッシュを破棄（次回 fire で再接続）。
    try {
      settings.setLastChannelUrl(url); // 次回起動で復元（file-backed・失敗寛容）。
    } catch {
      // 永続化失敗は起動/操作を止めない。
    }
    process.stdout.write(
      url ? `[cockpit] channel set: ${redactToken(url)}\n` : "[cockpit] channel cleared\n"
    );
  };

  /** state snapshot に載せる Channel の現況（redact 済み・token を平文で出さない）。 */
  const channelStatus = () => {
    const u = lazyChannel.getUrl();
    return {
      configured: u != null,
      url: u != null ? redactToken(u) : null,
      connection: lazyChannel.connectionStatus()
    };
  };

  // --channel 明示指定は従来どおり起動時に eager 生成（TTFT 先払い・S3 挙動不変）。
  if (args.channel) {
    ensureFireResources();
  }

  const server = createCockpitServer({
    port: args.port ?? DEFAULT_COCKPIT_PORT,
    indexHtmlPath: cockpitHtmlPath,
    settingsStore: settings,
    fireOrchestratorFactory,
    onSetChannelUrl,
    channelStatus
  });

  const url = await server.listen();
  process.stdout.write(`[cockpit] listening on ${url} (loopback only)\n`);
  process.stdout.write(`[cockpit] open  ${url}/  in your browser — pick a mic, press Start, speak.\n`);
  const startupUrl = lazyChannel.getUrl();
  if (startupUrl) {
    process.stdout.write(
      `[cockpit] fire enabled: channel = ${redactToken(startupUrl)} ` +
        `(window ${(args.fireWindowMin ?? FIRE_WINDOW_MS / 60000)} min, max ${args.fireMaxChars ?? FIRE_MAX_CHARS} chars). ` +
        (args.channel
          ? "LLM セッションは起動時に先充填済み。"
          : "設定から復元。LLM セッションは初回 Fire 時に生成します。") +
        " Channel は初回 Fire 時に接続します（失敗は fire error として操縦席に出ます・次の Fire で再試行）。\n"
    );
  } else {
    process.stdout.write(
      "[cockpit] fire wired but no channel URL yet — 操縦席の Channel 欄に URL を入れると Fire が有効化されます" +
        "（URL も Fire も使わなければ何も spawn しません = S2.5 挙動）。\n"
    );
  }
  process.stdout.write("[cockpit] Ctrl+C / EOF で終了します（魂は close で畳みます）。\n");

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    process.stdout.write("\n[cockpit] closing…\n");
    try {
      await server.close(); // orchestrator.dispose を含む（cockpit-server の close 契約）。
      // S3: fire 結線の常駐リソースも確実に畳む（リーク禁止・cli.mjs の dispose 順の型）。
      if (session) {
        try {
          await session.dispose();
        } catch {
          // best-effort
        }
      }
      if (player) {
        try {
          player.dispose();
        } catch {
          // best-effort
        }
      }
      if (lazyChannel) {
        try {
          await lazyChannel.close();
        } catch {
          // best-effort
        }
      }
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  // stdin EOF（Ctrl+Z→Enter / パイプ終端）でも畳む（ears-cli.mjs の型）。
  const rl = createInterface({ input: process.stdin });
  rl.on("close", shutdown);
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
