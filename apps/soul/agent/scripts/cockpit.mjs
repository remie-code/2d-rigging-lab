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
 *  `--channel <ws-url>`（器の Control Channel URL）を指定したときだけ fireOrchestratorFactory を
 *  注入する: 実 createLlmSession（FIRE_SYSTEM_PROMPT・claude-opus-4-8 既定）+ connectChannel +
 *  createAudioPlayer + speak（cli.mjs と同じ結線の型）。**--channel 未指定なら従来どおり
 *  （POST /api/fire は 503）= S2.5 挙動不変**。
 *
 *  接続タイミングの設計判断【lazy connect】: createCockpitServer の fireOrchestratorFactory は
 *  同期に呼ばれるが connectChannel は async。そこで channel は **初回 fire 時に接続し成功を
 *  キャッシュする lazy proxy**（createLazyChannel）にする。接続失敗はキャッシュせず throw →
 *  orchestrator が fireError 診断に落とす（起動は止めない・操縦席のゴースト行で見える・次の fire で
 *  再試行 = 器を後から立てても操縦席の再起動不要）。一方 **LLM セッションは起動時に作る**
 *  （常駐サブプロセスの spawn ≈12s を先払いし初回 fire の TTFT に乗せない）。player（常駐
 *  PowerShell）も起動時に作る（spawn ≈155ms・軽い）。
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
 * @param {string} url  Channel URL（`ws://127.0.0.1:<port>/channel?token=..`）。
 * @param {object} [options]
 * @param {typeof connectChannel} [options.connectImpl]  接続実装（テスト注入・既定 connectChannel）。
 * @returns {{ sendSpeech: (timeline: unknown) => Promise<any>; close: () => Promise<void> }}
 */
export function createLazyChannel(url, options = {}) {
  const connectImpl = options.connectImpl ?? connectChannel;
  /** @type {Promise<{ sendSpeech: Function; close: () => Promise<void> }> | null} */
  let channelPromise = null;

  const ensure = () => {
    if (channelPromise == null) {
      channelPromise = Promise.resolve(connectImpl(url)).catch((error) => {
        channelPromise = null; // 失敗は非キャッシュ = 次回 fire で再接続を試みる。
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
  --channel <ws-url>    器の Control Channel URL（ws://127.0.0.1:<port>/channel?token=..）。
                        指定時のみ Fire（POST /api/fire）が有効になる（実 LLM + TTS + 器）。
                        未指定なら S2.5 と同じ（Fire は 503）。
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

  // ── S3: --channel 指定時のみ fire を結線（未指定は S2.5 挙動そのまま）──────────
  /** @type {ReturnType<typeof createLlmSession> | null} */
  let session = null;
  /** @type {ReturnType<typeof createAudioPlayer> | null} */
  let player = null;
  /** @type {ReturnType<typeof createLazyChannel> | null} */
  let lazyChannel = null;
  /** @type {((hooks: any) => any) | undefined} */
  let fireOrchestratorFactory;

  if (args.channel) {
    // 起動経路でも env ガードを明示的に通す（llm-session 内でも呼ばれるが二重の防波堤・cli.mjs の型）。
    const { warnings } = assertSubscriptionAuthEnv(process.env);
    for (const warning of warnings) {
      process.stderr.write(`[cockpit] WARN: ${warning}\n`);
    }

    // LLM セッションは起動時に常駐起動（spawn コスト先払い・初回 fire の TTFT に乗せない）。
    session = createLlmSession({
      systemPrompt: FIRE_SYSTEM_PROMPT,
      onWarning: (w) => process.stderr.write(`[cockpit] WARN: ${w}\n`),
      onInit: (init) =>
        process.stderr.write(
          `${JSON.stringify({ event: "session_init", model: init.model, apiKeySource: init.apiKeySource, tools: init.tools })}\n`
        )
    });
    player = createAudioPlayer();
    lazyChannel = createLazyChannel(args.channel);

    const windowMs = args.fireWindowMin != null && Number.isFinite(args.fireWindowMin)
      ? args.fireWindowMin * 60_000
      : undefined;
    const maxChars = args.fireMaxChars != null && Number.isFinite(args.fireMaxChars)
      ? args.fireMaxChars
      : undefined;

    fireOrchestratorFactory = (hooks) =>
      createFireOrchestrator({
        ...hooks,
        session: /** @type {any} */ (session),
        channel: /** @type {any} */ (lazyChannel),
        player: /** @type {any} */ (player),
        speakDeps: {
          ttsBaseUrl: args.ttsBaseUrl,
          speaker: args.speaker,
          writeWav: writeTempWav
        },
        ...(windowMs != null ? { windowMs } : {}),
        ...(maxChars != null ? { maxChars } : {})
      });
  }

  const server = createCockpitServer({
    port: args.port ?? DEFAULT_COCKPIT_PORT,
    indexHtmlPath: cockpitHtmlPath,
    settingsStore: createFileSettingsStore(),
    ...(fireOrchestratorFactory ? { fireOrchestratorFactory } : {})
  });

  const url = await server.listen();
  process.stdout.write(`[cockpit] listening on ${url} (loopback only)\n`);
  process.stdout.write(`[cockpit] open  ${url}/  in your browser — pick a mic, press Start, speak.\n`);
  if (args.channel) {
    process.stdout.write(
      `[cockpit] fire enabled: channel = ${redactToken(args.channel)} ` +
        `(window ${(args.fireWindowMin ?? FIRE_WINDOW_MS / 60000)} min, max ${args.fireMaxChars ?? FIRE_MAX_CHARS} chars). ` +
        "Channel は初回 Fire 時に接続します（失敗は fire error として操縦席に出ます・次の Fire で再試行）。\n"
    );
  } else {
    process.stdout.write("[cockpit] fire disabled (no --channel). POST /api/fire は 503 を返します。\n");
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
