// @ts-check
/**
 * S3 発火計測「measure-fire」（Domain B）— apps/soul/agent。**実 SDK を最小回数だけ叩く**。
 *
 * Fire → 注入 → ask（実 SDK・claude-opus-4-8・FIRE_SYSTEM_PROMPT）→（fake speak）→ soul 記録の
 * 縦串で、fire 1 発あたりの TTFT / ask 所要 / usage / 注入文字数を計測する（first-light.mjs の型）。
 *
 * ── 何が実物で何が fake か ──────────────────────────────────────────────
 *  実物: createLlmSession（Agent SDK・サブスク OAuth）・createFireOrchestrator・
 *        createTranscriptBuffer（実時計・you 発話は fixture で積む）・formatFireInjection（経由）。
 *  fake: speak / channel / player（実 TTS・実器・実再生・実マイクは人間ゲートの領分）。
 *
 * ── SDK 実消費の上限（鉄の規律）───────────────────────────────────────────
 *  **実 ask は 5 回まで**（fire 5 発 = ask 5 回・ハードガードで 6 回目は throw）。
 *  サブスク枠を使うため不用意に走らせない。env ガード（assertSubscriptionAuthEnv）が
 *  ANTHROPIC_API_KEY 等を検出したら起動拒否される（その場合は未実測として記録する）。
 *
 * ── 会話が積もる形で計測する ─────────────────────────────────────────────
 *  各 fire の前に fixture の you 発話を 1 件ずつ積む。soul の応答も orchestrator が正本へ
 *  追記する（speaker:"soul"）ので、後の fire ほど注入は you/soul 混在で長くなる = 実運用形。
 *
 * 実行（サブスク枠を消費するので不用意に走らせない）:
 *   node apps/soul/agent/scripts/measure-fire.mjs
 * 前提: /login 済み・ガード対象環境変数が未設定。AivisSpeech・器・マイクは不要（全 fake）。
 * 音声開始 E2E（Fire → 音声開始）は全器官起動が要るため人間ゲートで取得する
 * （discussion/ai-cohost/experiments/s3-summon.md の記入欄）。
 */

import { performance } from "node:perf_hooks";

import { assertSubscriptionAuthEnv } from "../src/mind/env-guard.mjs";
import { createLlmSession } from "../src/mind/llm-session.mjs";
import { createFireOrchestrator, FIRE_SYSTEM_PROMPT } from "../src/mind/fire-orchestrator.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";

/** 実 ask のハード上限（鉄の規律・wave 計画 §4-3）。 */
const MAX_ASKS = 5;

/** 独り言 fixture（配信中のゲーム独り言を模す・各 fire の前に 1 件ずつ積む）。 */
const YOU_UTTERANCES = [
  "今日は新しいゲームを始めてみたんだけど、操作が意外と難しいね。",
  "あ、ここの隠し通路、前に視聴者さんが教えてくれたところだ。",
  "うわ、このボス強すぎない？回復アイテムもう無いんだけど。",
  "やっと倒せた……この達成感はたまらないね。",
  "次は雪原マップか。BGM がきれいで癒される。"
];

function log(line) {
  process.stdout.write(`${line}\n`);
}
function round1(v) {
  return v == null ? null : Number(Number(v).toFixed(1));
}

async function main() {
  const { warnings } = assertSubscriptionAuthEnv(process.env); // ガード違反はここで throw = 起動拒否。
  for (const w of warnings) {
    log(`[measure-fire] WARN: ${w}`);
  }
  log(
    `[measure-fire] ${new Date().toISOString()} node ${process.version} ${process.platform} — ` +
      `実 ask は最大 ${MAX_ASKS} 回（fire ${MAX_ASKS} 発）。speak/channel/player は fake。`
  );

  const buffer = createTranscriptBuffer(); // 実時計 = すべて窓内（既定 5 分）。

  /** @type {any} */
  let initMessage = null;
  const sessionStartMs = performance.now();
  const session = createLlmSession({
    systemPrompt: FIRE_SYSTEM_PROMPT, // 最小仮面 v0（本番結線と同一）。
    onInit: (init) => {
      initMessage = init;
    },
    onWarning: (w) => log(`[measure-fire] WARN: ${w}`)
  });

  // ask 計測ラッパ + ハード予算ガード（6 回目の ask は throw）。
  let askCount = 0;
  /** @type {{ usage: any; ttftMs: number | null; elapsedMs: number } | null} */
  let lastAsk = null;
  const measuringSession = {
    /** @param {string} text */
    async ask(text) {
      if (askCount >= MAX_ASKS) {
        throw new Error(`measure-fire: ask budget (${MAX_ASKS}) exceeded — refusing further SDK calls.`);
      }
      askCount += 1;
      const asked = await session.ask(text);
      lastAsk = { usage: asked.usage, ttftMs: asked.ttftMs, elapsedMs: asked.elapsedMs };
      return asked;
    }
  };

  // fake speak（実 TTS・実器・実再生なし・所要ゼロ相当）。
  let spokenCount = 0;
  const fakeSpeak = async () => {
    spokenCount += 1;
    return { timeline: [], rttMs: 0, wavDurationSec: 0, wavPath: "fake" };
  };

  const orchestrator = createFireOrchestrator({
    getBuffer: () => buffer,
    session: measuringSession,
    speakImpl: /** @type {any} */ (fakeSpeak),
    channel: /** @type {any} */ ({ sendSpeech: async () => ({ result: "accepted", error: null, rttMs: 0 }) }),
    player: /** @type {any} */ ({ play() {} }),
    onDiagnostic: (d) => log(`[measure-fire] diagnostic: ${JSON.stringify(d)}`)
  });

  /** @type {any[]} */
  const fires = [];
  try {
    for (let i = 0; i < MAX_ASKS; i += 1) {
      // 実マイクの代わりに fixture の you 発話を正本へ積む（startMs/endMs はダミーのストリーム時刻）。
      buffer.append({ startMs: i * 5000, endMs: i * 5000 + 3000, text: YOU_UTTERANCES[i] });

      const t0 = performance.now();
      const result = /** @type {any} */ (await orchestrator.fire());
      const fireElapsedMs = performance.now() - t0;

      const record = {
        fire: i + 1,
        fired: result.fired,
        reason: result.reason ?? null,
        injectedChars: result.injectedChars ?? null,
        includedCount: result.includedCount ?? null,
        replyText: result.replyText ?? null,
        replyChars: typeof result.replyText === "string" ? result.replyText.length : null,
        ttft_ms: round1(lastAsk?.ttftMs),
        ask_ms: round1(lastAsk?.elapsedMs),
        usage: lastAsk?.usage ?? null,
        fire_elapsed_ms: round1(fireElapsedMs)
      };
      fires.push(record);

      log("");
      log(`=== fire #${i + 1} ===`);
      log(`you   : ${YOU_UTTERANCES[i]}`);
      log(`inject: ${record.includedCount} lines, ${record.injectedChars} chars`);
      log(`reply : ${record.replyText}`);
      log(
        `ttft_ms = ${record.ttft_ms}  ask_ms = ${record.ask_ms}  fire_elapsed_ms = ${record.fire_elapsed_ms}` +
          `${i === 0 ? "（cold: 常駐サブプロセス spawn 込み）" : "（warm）"}`
      );
      log(`usage = ${JSON.stringify(record.usage)}`);
      lastAsk = null;
    }

    const summary = {
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      model: initMessage?.model ?? null,
      apiKeySource: initMessage?.apiKeySource ?? null,
      systemPrompt: "FIRE_SYSTEM_PROMPT (最小仮面 v0)",
      asks: askCount,
      spoken: spokenCount,
      bufferEntries: buffer.size(), // you 5 + soul 応答（発話成功分）。
      fires
    };
    log("");
    log("=== JSON SUMMARY (experiments/s3-summon.md 記録用) ===");
    log(JSON.stringify(summary, null, 2));
  } finally {
    orchestrator.dispose();
    await session.dispose();
    log("");
    log(`[measure-fire] session disposed. (SDK 実行 = ${askCount} ask で完了)`);
  }
}

main().catch((error) => {
  process.stderr.write(
    `[measure-fire] FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
