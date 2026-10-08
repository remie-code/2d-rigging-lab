// @ts-check
/**
 * 会話 CLI（S1 Domain C）— apps/soul/agent。一文が縦に貫通する本体。
 *
 * stdin から一文を読み、常駐 LLM セッション（llm-session）で応答を得て、Domain B の speak() で
 * 器の口 + スピーカーへ同期発話する。S1 の歩くスケルトンの縦串そのもの:
 *
 *   env-guard → LLM セッション常駐起動 → チャネル接続（channel-client）→ 常駐プレイヤー起動
 *   （audio-player）→ stdin 一文 → session.ask() → speak()（口 + 声）→ 次の入力待ち（ループ）。
 *   Ctrl+C / EOF で全 dispose（event loop に何も残さない）。
 *
 * ── 計測フック（計測記録の材料）─────────────────────────────────────────
 *  各発話で usage・ttft_ms・ask_ms・e2e_ms（stdin 確定 → player.play まで）を 1 行 JSON で
 *  stderr に出す。stdout は人向けの促し・応答テキスト。
 *
 * ── 実行（人間ゲート・Gnome は実行しない）───────────────────────────────
 *  node apps/soul/agent/src/cli.mjs "ws://127.0.0.1:<port>/channel?token=<token>"
 *  実器接続・実再生を伴うため Gnome は動かさない。配線検証は llm-session をダブルに差し替えた
 *  node:test（cli.test.mjs・ws-double + echo-player 再利用）で行う。
 */

import { createInterface } from "node:readline";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { assertSubscriptionAuthEnv } from "../mind/env-guard.mjs";
import { createLlmSession } from "../mind/llm-session.mjs";
import { connectChannel, redactToken } from "../channel/channel-client.mjs";
import { createAudioPlayer, writeTempWav } from "../voice/audio-player.mjs";
import { speak } from "../voice/speak.mjs";

/**
 * 会話ループ本体（依存注入で配線検証可能）。stdin の各行を 1 発話として処理する。
 *
 * @param {object} deps
 * @param {string} deps.url  Channel URL（`ws://127.0.0.1:<port>/channel?token=..`）。
 * @param {() => { ask: (t: string) => Promise<{ replyText: string; usage: any; ttftMs: number | null; elapsedMs: number }>; dispose: () => Promise<void> | void }} deps.createSession
 *   LLM セッションのファクトリ（本番 createLlmSession / テストはダブル）。
 * @param {(url: string) => Promise<{ sendSpeech: Function; close: () => Promise<void> }>} deps.connect
 *   チャネル接続（本番 connectChannel / テストは ws-double + MinimalWebSocket）。
 * @param {() => { play: (p: string) => void; dispose: () => void }} deps.createPlayer
 *   プレイヤーのファクトリ（本番 createAudioPlayer / テストは echo-player 注入）。
 * @param {(text: string, sd: object) => Promise<{ timeline: any[]; rttMs: number; wavDurationSec: number }>} [deps.speakImpl]
 *   発話同期（既定 Domain B speak）。テストで fake tts を渡すため差し替え可能。
 * @param {object} [deps.speakDeps]  speakImpl へ渡す追加 deps（tts/ttsBaseUrl/speaker/sConfig 等）。
 * @param {import("node:stream").Readable} deps.stdin  一文の入力元。
 * @param {import("node:stream").Writable} deps.stdout  人向け出力。
 * @param {import("node:stream").Writable} deps.stderr  計測 JSON 出力。
 * @param {AbortSignal} [deps.signal]  abort で入力ループを閉じる（Ctrl+C 配線用）。
 * @returns {Promise<{ utterances: number }>}
 */
export async function runConversation(deps) {
  const {
    url,
    createSession,
    connect,
    createPlayer,
    speakImpl = speak,
    speakDeps = {},
    stdin,
    stdout,
    stderr,
    signal
  } = deps;

  const session = createSession();
  /** @type {{ sendSpeech: Function; close: () => Promise<void> }} */
  const channel = await connect(url);
  const player = createPlayer();

  const rl = createInterface({ input: stdin, crlfDelay: Infinity });
  if (signal) {
    if (signal.aborted) {
      rl.close();
    } else {
      signal.addEventListener("abort", () => rl.close(), { once: true });
    }
  }

  let utterances = 0;
  try {
    stdout.write("[cli] 会話を開始します。一文を入力してください（Ctrl+C / EOF で終了）。\n");
    for await (const rawLine of rl) {
      const text = String(rawLine).trim();
      if (text.length === 0) {
        continue;
      }
      const t0 = performance.now();
      const asked = await session.ask(text);
      const replyText = asked.replyText;
      if (typeof replyText !== "string" || replyText.length === 0) {
        stderr.write(
          `${JSON.stringify({ event: "empty_reply", input: text })}\n`
        );
        continue;
      }
      stdout.write(`> ${replyText}\n`);
      const spoken = await speakImpl(replyText, { channel, player, ...speakDeps });
      const e2eMs = performance.now() - t0;
      utterances += 1;
      stderr.write(
        `${JSON.stringify({
          event: "utterance",
          usage: asked.usage,
          ttft_ms: asked.ttftMs,
          ask_ms: Number(asked.elapsedMs.toFixed(1)),
          e2e_ms: Number(e2eMs.toFixed(1)),
          channel_rtt_ms: Number((spoken.rttMs ?? 0).toFixed(1)),
          timeline_items: Array.isArray(spoken.timeline) ? spoken.timeline.length : null,
          wav_sec: spoken.wavDurationSec ?? null
        })}\n`
      );
    }
  } finally {
    rl.close();
    // 常駐リソースを確実に畳む（event loop に何も残さない）。順序: session → player → channel。
    try {
      await session.dispose();
    } catch (error) {
      stderr.write(`${JSON.stringify({ event: "dispose_error", where: "session", message: String(error) })}\n`);
    }
    try {
      player.dispose();
    } catch (error) {
      stderr.write(`${JSON.stringify({ event: "dispose_error", where: "player", message: String(error) })}\n`);
    }
    try {
      await channel.close();
    } catch (error) {
      stderr.write(`${JSON.stringify({ event: "dispose_error", where: "channel", message: String(error) })}\n`);
    }
  }
  return { utterances };
}

/** 位置引数 = Channel URL。--system で systemPrompt、--base-url / --speaker で TTS 設定。 */
function parseArgs(argv) {
  const positionals = argv.filter((a) => !a.startsWith("--"));
  const getFlag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    url: positionals[0],
    systemPrompt: getFlag("--system"),
    baseUrl: getFlag("--base-url"),
    speaker: getFlag("--speaker")
  };
}

/** 本番起動: env ガード → 実配線で会話ループ。SIGINT/EOF で全 dispose。 */
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.url !== "string" || args.url.length === 0) {
    process.stderr.write(
      "usage: node src/cli.mjs <ws-url> [--system ..] [--base-url ..] [--speaker ..]\n"
    );
    process.exit(2);
    return;
  }

  // 起動経路でも env ガードを明示的に通す（llm-session 内でも呼ばれるが二重の防波堤）。
  const { warnings } = assertSubscriptionAuthEnv(process.env);
  for (const warning of warnings) {
    process.stderr.write(`[cli] WARN: ${warning}\n`);
  }

  process.stdout.write(`[cli] channel = ${redactToken(args.url)}\n`);

  const controller = new AbortController();
  const onSigint = () => {
    process.stdout.write("\n[cli] SIGINT — 会話を終了します。\n");
    controller.abort();
  };
  process.on("SIGINT", onSigint);

  try {
    const { utterances } = await runConversation({
      url: args.url,
      createSession: () =>
        createLlmSession({
          systemPrompt: args.systemPrompt,
          onWarning: (w) => process.stderr.write(`[cli] WARN: ${w}\n`),
          onInit: (init) =>
            process.stderr.write(
              `${JSON.stringify({
                event: "session_init",
                model: init.model,
                apiKeySource: init.apiKeySource,
                tools: init.tools
              })}\n`
            )
        }),
      connect: (url) => connectChannel(url),
      createPlayer: () => createAudioPlayer(),
      speakDeps: {
        ttsBaseUrl: args.baseUrl,
        speaker: args.speaker,
        writeWav: writeTempWav
      },
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      signal: controller.signal
    });
    process.stdout.write(`[cli] 終了（発話数 ${utterances}）。\n`);
  } finally {
    process.removeListener("SIGINT", onSigint);
  }
  process.exit(0);
}

// 直接実行時のみ main を走らせる（import 時は runConversation のみ公開）。
const invokedDirectly =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `[cli] FATAL: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
