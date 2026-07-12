// @ts-check
/**
 * TTS 実機疎通 preflight（S1 Domain B・機械検証）— apps/soul/agent。**再生はしない**。
 *
 * AivisSpeech 実機（既定 http://127.0.0.1:10101）に対して発話パイプラインの音声側を 1 回通す:
 *   /audio_query → moras 平坦化 + pre/post → /synthesis → WAV バイト取得 → wavDurationSec →
 *   buildSpeechTimeline → **契約スキーマ全条件を assert**（timeline 長 1..512・timeMs 整数厳密
 *   単調・vowel は a/i/u/e/o の 5 値・s は 0..1）。
 *
 * これは「合成テスト（wavDurationSec → buildSpeechTimeline の合成が実 WAV で成立するか）」の
 * 裁定（レビュー note 3）を果たす。スピーカーからは鳴らさない（SoundPlayer は起動しない）＝
 * 実再生は人間ゲート（preflight-e2e.mjs）の領分。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-tts.mjs [--text "…"] [--base-url URL] [--speaker ID]
 * exit 0 = 全 assert 合格、exit 1 = 疎通失敗 or 契約違反。
 */

import { createTtsClient, parseAudioQuery } from "../src/tts-client.mjs";
import { wavDurationSec } from "../src/wav-duration.mjs";
import { buildSpeechTimeline, MAX_TIMELINE_ITEMS } from "../src/mora-timeline.mjs";

function parseArgs(argv) {
  const args = { text: "こんにちは、テストです", baseUrl: undefined, speaker: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--text") {
      args.text = argv[++i];
    } else if (a === "--base-url") {
      args.baseUrl = argv[++i];
    } else if (a === "--speaker") {
      args.speaker = argv[++i];
    }
  }
  return args;
}

/** 契約 intent.speech payload スキーマの全条件を assert する（違反は throw）。 */
function assertContract(timeline) {
  const failures = [];
  if (!Array.isArray(timeline)) {
    throw new Error("timeline is not an array");
  }
  if (timeline.length < 1) {
    failures.push(`length ${timeline.length} < minItems 1`);
  }
  if (timeline.length > MAX_TIMELINE_ITEMS) {
    failures.push(`length ${timeline.length} > maxItems ${MAX_TIMELINE_ITEMS}`);
  }
  const VOWELS = new Set(["a", "i", "u", "e", "o"]);
  let prev = -1;
  timeline.forEach((item, i) => {
    if (!Number.isInteger(item.timeMs)) {
      failures.push(`[${i}] timeMs ${item.timeMs} is not an integer`);
    }
    if (!(item.timeMs >= 0)) {
      failures.push(`[${i}] timeMs ${item.timeMs} is negative`);
    }
    if (!(item.timeMs > prev)) {
      failures.push(`[${i}] timeMs ${item.timeMs} not strictly > previous ${prev}`);
    }
    prev = item.timeMs;
    if (!VOWELS.has(item.vowel)) {
      failures.push(`[${i}] vowel "${item.vowel}" not in a/i/u/e/o`);
    }
    if (typeof item.s !== "number" || !(item.s >= 0 && item.s <= 1)) {
      failures.push(`[${i}] s ${item.s} out of 0..1`);
    }
  });
  return failures;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = createTtsClient({ baseUrl: args.baseUrl, speaker: args.speaker });
  process.stdout.write(
    `[preflight-tts] baseUrl=${client.baseUrl} speaker=${client.speaker} text="${args.text}"\n`
  );

  // 1. audio_query。
  const query = await client.audioQuery(args.text);
  const { moras, prePhonemeSec, postPhonemeSec } = parseAudioQuery(query);
  process.stdout.write(
    `[preflight-tts] audio_query OK: ${moras.length} moras (flattened), ` +
      `pre=${prePhonemeSec}s post=${postPhonemeSec}s, vowels=[${moras
        .map((m) => m.vowel)
        .join(",")}]\n`
  );

  // 2. synthesis → WAV バイト（再生しない）。
  const wav = await client.synthesis(query);
  process.stdout.write(`[preflight-tts] synthesis OK: ${wav.byteLength} WAV bytes (not played)\n`);

  // 3. WAV 実長。
  const wavSec = wavDurationSec(wav);
  process.stdout.write(`[preflight-tts] wavDurationSec = ${wavSec.toFixed(4)}s\n`);

  // 4. timeline 合成。
  const { timeline } = buildSpeechTimeline(moras, wavSec, prePhonemeSec, postPhonemeSec);
  const compact = timeline
    .map((t) => `[${t.timeMs}:${t.vowel}:${t.s}]`)
    .join("");
  process.stdout.write(
    `[preflight-tts] buildSpeechTimeline OK: ${timeline.length} items\n  ${compact}\n`
  );

  // 5. 契約 assert。
  const failures = assertContract(timeline);
  if (failures.length > 0) {
    process.stderr.write(
      `[preflight-tts] CONTRACT VIOLATIONS (${failures.length}):\n` +
        failures.map((f) => `  - ${f}`).join("\n") +
        "\n"
    );
    process.exit(1);
    return;
  }
  process.stdout.write(
    "[preflight-tts] CONTRACT OK: length 1..512 ✓, timeMs integer & strictly monotonic & non-negative ✓, " +
      "vowel ∈ a/i/u/e/o ✓, s ∈ 0..1 ✓\n"
  );
  process.stdout.write("[preflight-tts] RESULT: PASS (audio path verified end-to-end, no playback)\n");
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-tts] FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
