// @ts-check
/**
 * S1 初回計測「first light」（Domain C）— apps/soul/agent。**実 SDK を最小回数だけ叩く**。
 *
 * サブスク枠を使うため SDK 実行は厳格に 4 回まで（wave 計画 §3 Domain C・Gnome 委任規律）:
 *   ask #1 = tools:[] 動作確認（応答にツール使用が現れないこと + system/init の tools[] を記録）。
 *            この初回 ask は常駐サブプロセスの spawn（≈12 秒問題）を含む＝初期化時間の実測も兼ねる。
 *   ask #2〜#4 = 計測サンプル 3 種（短い一文 → ask → TTS(audio_query+synthesis) → timeline 構築）。
 *            **実器送出・再生はしない**（チャネルなし計測）。E2E 完全計測（音声開始まで）は人間ゲート。
 *
 * 全 4 ask を **1 つの常駐セッション**で行う（residency の実証。初回のみ spawn コスト、以降は温間）。
 * 出力: 生ログ（stdout）+ 末尾に JSON サマリ（experiments 記録へ貼るため）。
 *
 * 実行（サブスク枠を消費するので不用意に走らせない）:
 *   node apps/soul/agent/scripts/first-light.mjs
 * 前提: /login 済み・ガード対象環境変数が未設定・AivisSpeech 起動（127.0.0.1:10101）。
 */

import { performance } from "node:perf_hooks";

import { assertSubscriptionAuthEnv } from "../src/mind/env-guard.mjs";
import { createLlmSession } from "../src/mind/llm-session.mjs";
import { createTtsClient, parseAudioQuery } from "../src/voice/tts-client.mjs";
import { wavDurationSec } from "../src/voice/wav-duration.mjs";
import { buildSpeechTimeline } from "../src/voice/mora-timeline.mjs";

const TOOLS_CHECK_PROMPT = "ツールを使わずに、一言だけで挨拶して。";
const SAMPLE_PROMPTS = [
  "今日はいい天気だね。",
  "好きな食べ物は何？",
  "配信を始めるよ、意気込みを一言。"
];

function log(line) {
  process.stdout.write(`${line}\n`);
}

async function main() {
  const { warnings } = assertSubscriptionAuthEnv(process.env);
  for (const w of warnings) {
    log(`[first-light] WARN: ${w}`);
  }
  log(
    `[first-light] ${new Date().toISOString()} node ${process.version} ${process.platform} — ` +
      "SDK 実行は 4 ask（tools確認1 + 計測3）のみ。"
  );

  const tts = createTtsClient();

  /** @type {any} */
  let initMessage = null;
  let initAtMs = null;

  const sessionStartMs = performance.now();
  const session = createLlmSession({
    onInit: (init) => {
      initMessage = init;
      initAtMs = performance.now();
    },
    onWarning: (w) => log(`[first-light] WARN: ${w}`)
  });

  /** @type {any[]} */
  const samples = [];
  try {
    // ── ask #1: tools:[] 動作確認（+ 初期化時間の実測）─────────────────────
    const a1Start = performance.now();
    const a1 = await session.ask(TOOLS_CHECK_PROMPT);
    const initFromAskMs = initAtMs != null ? initAtMs - a1Start : null;
    const initFromCreateMs = initAtMs != null ? initAtMs - sessionStartMs : null;

    log("");
    log("=== ask #1 (tools:[] 動作確認) ===");
    log(`prompt: ${TOOLS_CHECK_PROMPT}`);
    log(`reply : ${a1.replyText}`);
    log(
      `init.tools = ${JSON.stringify(initMessage?.tools)}  ` +
        `apiKeySource = ${initMessage?.apiKeySource}  model = ${initMessage?.model}`
    );
    log(
      `init.slash_commands.len = ${initMessage?.slash_commands?.length}  ` +
        `init.skills.len = ${initMessage?.skills?.length}`
    );
    log(
      `usage = ${JSON.stringify(a1.usage)}  ttft_ms = ${fmt(a1.ttftMs)}  ` +
        `ask_ms(cold, spawn込み) = ${fmt(a1.elapsedMs)}`
    );
    log(
      `init到達: ask開始から ${fmt(initFromAskMs)} ms / セッション生成から ${fmt(initFromCreateMs)} ms ` +
        "（≒ 常駐サブプロセス spawn + 初期化 = 12秒スポーン問題の実測）"
    );

    const toolsEmpty = Array.isArray(initMessage?.tools) && initMessage.tools.length === 0;
    log(`tools:[] で全ツール無効か: ${toolsEmpty ? "YES (init.tools=[])" : "NO — " + JSON.stringify(initMessage?.tools)}`);

    // ── ask #2〜#4: 計測サンプル（ask → TTS → timeline。送出・再生なし）─────────
    for (let i = 0; i < SAMPLE_PROMPTS.length; i += 1) {
      const prompt = SAMPLE_PROMPTS[i];
      const asked = await session.ask(prompt);

      const tqStart = performance.now();
      const query = await tts.audioQuery(asked.replyText);
      const tqMs = performance.now() - tqStart;

      const synStart = performance.now();
      const wav = await tts.synthesis(query);
      const synMs = performance.now() - synStart;

      const { moras, prePhonemeSec, postPhonemeSec } = parseAudioQuery(query);
      const wavSec = wavDurationSec(wav);
      const tlStart = performance.now();
      const { timeline } = buildSpeechTimeline(moras, wavSec, prePhonemeSec, postPhonemeSec);
      const tlMs = performance.now() - tlStart;

      const sample = {
        index: i + 2,
        prompt,
        reply: asked.replyText,
        usage: asked.usage,
        ttft_ms: round1(asked.ttftMs),
        ask_ms: round1(asked.elapsedMs),
        audio_query_ms: round1(tqMs),
        synthesis_ms: round1(synMs),
        wav_bytes: wav.length,
        wav_sec: round4(wavSec),
        moras: moras.length,
        timeline_items: timeline.length,
        timeline_build_ms: round3(tlMs)
      };
      samples.push(sample);

      log("");
      log(`=== ask #${i + 2} (計測サンプル) ===`);
      log(`prompt: ${prompt}`);
      log(`reply : ${asked.replyText}`);
      log(
        `usage = ${JSON.stringify(asked.usage)}  ttft_ms = ${fmt(asked.ttftMs)}  ask_ms(warm) = ${fmt(asked.elapsedMs)}`
      );
      log(
        `TTS: audio_query ${round1(tqMs)}ms + synthesis ${round1(synMs)}ms → ` +
          `${wav.length} WAV bytes, wav_sec ${round4(wavSec)}s`
      );
      log(`timeline: ${moras.length} moras → ${timeline.length} items, build ${round3(tlMs)}ms（送出・再生なし）`);
    }

    // ── JSON サマリ（experiments 記録へ貼る）─────────────────────────────
    const summary = {
      recordedAt: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      model: initMessage?.model ?? null,
      apiKeySource: initMessage?.apiKeySource ?? null,
      init_tools: initMessage?.tools ?? null,
      tools_all_disabled: toolsEmpty,
      cold_ask1_ms: round1(a1.elapsedMs),
      init_from_ask_ms: round1(initFromAskMs),
      init_from_create_ms: round1(initFromCreateMs),
      ask1_usage: a1.usage,
      ask1_ttft_ms: round1(a1.ttftMs),
      samples
    };
    log("");
    log("=== JSON SUMMARY (experiments 記録用) ===");
    log(JSON.stringify(summary, null, 2));
  } finally {
    await session.dispose();
    log("");
    log("[first-light] session disposed. (SDK 実行 = 4 ask で完了)");
  }
}

function fmt(v) {
  return v == null ? "n/a" : `${Number(v).toFixed(1)}`;
}
function round1(v) {
  return v == null ? null : Number(Number(v).toFixed(1));
}
function round3(v) {
  return v == null ? null : Number(Number(v).toFixed(3));
}
function round4(v) {
  return v == null ? null : Number(Number(v).toFixed(4));
}

main().catch((error) => {
  process.stderr.write(
    `[first-light] FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
