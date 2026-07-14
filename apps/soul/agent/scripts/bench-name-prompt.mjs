// @ts-check
/**
 * 「コーディ」語彙登録スイープ計測（wave「口数配線+コーディ語彙登録」Domain B・§3）— apps/soul/agent。
 *
 * whisper-inference.mjs の Whisper initial prompt（`DEFAULT_WHISPER_PROMPT`）が実際に転写精度へ
 * 効くかを計測する。bench-asr.mjs の部品（TTS 合成:55-76・/inference 直投:78-93）を写経し、
 * prompt 有/無で ①名前入り音声の正答率 ②名前なし音声への幻聴混入率 を対比出力する
 * （inventory §B-2・出自 s6-followup.md §2）。
 *
 * ── 絶対規律（bench-asr.mjs / preflight-asr.mjs と同一継承）───────────────
 *  実マイク不使用・音声メモリ内のみ・ディスク非書き込み。whisper-server/AivisSpeech への実接続は
 *  **人間がこのスクリプトを実行したときのみ**（実走 = 人間ゲート/計測の領分）。このモジュールを
 *  import しただけでは main() は走らない（direct execution ガード・下記）——node:test から
 *  スコアリング純関数・スイープの中核ロジック（fetch/TTS 注入可能）を安全に import できるように
 *  するため。
 *
 * ── テスタビリティ（wave-plan §3 Domain B の要求）─────────────────────────
 *  名前揺れ集合照合・幻聴検出のスコアリングは `containsNameVariant`/`scoreNameHitRate`/
 *  `summarizeSweep` として純関数化（fetch/TTS 非依存・export 済み）。スイープの中核 `runSweep` は
 *  `synthesizeImpl`/`inferenceImpl` を注入できるため、実ネット/実 TTS 無しで「prompt 有無の対比が
 *  組める構造」を機械テストできる。
 *
 * 使い方（人間が走らせる・前提: whisper-server + AivisSpeech 起動）:
 *   node apps/soul/agent/scripts/bench-name-prompt.mjs
 *     [--runs N（既定 1・各バリエーション×prompt 有無の繰り返し回数）] [--port N] [--synthetic]
 * exit 0 = 計測完了、exit 1 = 失敗。記録先: discussion/ai-cohost/experiments/name-prompt.md。
 */

import { pathToFileURL } from "node:url";
import { createWhisperServer } from "../src/ears/whisper-server.mjs";
import { createTtsClient } from "../src/voice/tts-client.mjs";
import { encodeWav } from "../src/voice/wav-encode.mjs";
import { sinePcm, silencePcm, concatInt16 } from "../src/ears/fixtures-audio.mjs";
import { parseInferenceResponse, normalizeTranscript } from "../src/ears/whisper-client.mjs";
import { DEFAULT_WHISPER_PROMPT } from "../src/ears/whisper-inference.mjs";

const log = (msg) => process.stdout.write(`[bench-name-prompt] ${msg}\n`);

// ── 素材（v0・データ定数）────────────────────────────────────────────

/** 名前入り文群 v0（「コーディ」呼びかけを含む自然文）。 */
export const NAMED_SENTENCES_V0 = Object.freeze([
  "コーディ、これ見て",
  "コーディ、どう思う?",
  "ねえコーディ、聞いてる?"
]);

/** 名前なし文群 v0（幻聴混入判定用・名前を一切含まない自然文）。 */
export const UNNAMED_SENTENCES_V0 = Object.freeze([
  "今日はいい天気ですね",
  "このステージちょっと難しいかも",
  "次はどこに行こうか迷うな"
]);

/**
 * 話速/ピッチ/抑揚の振れ幅 v0（AivisSpeech/VOICEVOX 系 audio_query スキーマ前提・
 * `speedScale`/`pitchScale`/`intonationScale`。**このフィールド名はスキーマ一般知識に基づく前提で
 * 実機未検証**（本スクリプトは書くだけで実走しない・§質問に明記）。base + 各軸 1 パラメータのみ
 * 変化させる設計（直積にすると 1 文あたりの合成数が爆発するため）。
 */
export const PARAM_VARIATIONS_V0 = Object.freeze([
  Object.freeze({ label: "base", speedScale: 1.0, pitchScale: 0.0, intonationScale: 1.0 }),
  Object.freeze({ label: "speed-slow", speedScale: 0.85, pitchScale: 0.0, intonationScale: 1.0 }),
  Object.freeze({ label: "speed-fast", speedScale: 1.15, pitchScale: 0.0, intonationScale: 1.0 }),
  Object.freeze({ label: "pitch-low", speedScale: 1.0, pitchScale: -0.05, intonationScale: 1.0 }),
  Object.freeze({ label: "pitch-high", speedScale: 1.0, pitchScale: 0.05, intonationScale: 1.0 }),
  Object.freeze({ label: "intonation-flat", speedScale: 1.0, pitchScale: 0.0, intonationScale: 0.8 }),
  Object.freeze({ label: "intonation-strong", speedScale: 1.0, pitchScale: 0.0, intonationScale: 1.2 })
]);

/**
 * 名前照合の揺れ集合 v0（fire-scheduler.mjs `NAME_VARIANTS_V0` と同じ 4 表記 + ひらがな `こーでぃー`
 * を明示追加。fire-scheduler.mjs の正規化 `normalizeForMatch` はここでは再利用しない——このスクリプト
 * は Domain A（口数）の fire-scheduler.mjs に依存させず独立させる設計判断。単純な部分文字列一致で
 * 十分（whisper 出力はカタカナ/漢字混じりが主で、正規化なしでも v0 の実用粒度としては足りる）。
 * @type {ReadonlyArray<string>}
 */
export const NAME_MATCH_VARIANTS_V0 = Object.freeze([
  "コーディー",
  "コーディ",
  "コーティー",
  "コーティ",
  "こーでぃー"
]);

// ── スコアリング純関数（export・fixture テスト対象）──────────────────────

/**
 * 転写テキストに名前揺れ集合のいずれかが部分文字列として含まれるか。
 * @param {string} text
 * @param {ReadonlyArray<string>} [variants]
 * @returns {boolean}
 */
export function containsNameVariant(text, variants = NAME_MATCH_VARIANTS_V0) {
  if (typeof text !== "string") return false;
  return variants.some((v) => text.includes(v));
}

/**
 * 転写結果配列 → ヒット率集計（純関数）。名前正答率にも幻聴混入率にも同じ形の集計を使う
 * （意味づけは呼び出し側のラベルで区別・§ summarizeSweep 参照）。
 * @param {ReadonlyArray<string>} transcripts
 * @param {ReadonlyArray<string>} [variants]
 * @returns {{ total: number; hits: number; rate: number }}
 */
export function scoreNameHitRate(transcripts, variants = NAME_MATCH_VARIANTS_V0) {
  if (!Array.isArray(transcripts)) {
    throw new TypeError("scoreNameHitRate: transcripts must be an array.");
  }
  const total = transcripts.length;
  const hits = transcripts.filter((t) => containsNameVariant(t, variants)).length;
  return { total, hits, rate: total === 0 ? 0 : hits / total };
}

/**
 * prompt 有/無の転写結果セット → 対比レポート（純関数）。
 * @param {{
 *   named: { withPrompt: ReadonlyArray<string>; withoutPrompt: ReadonlyArray<string> };
 *   unnamed: { withPrompt: ReadonlyArray<string>; withoutPrompt: ReadonlyArray<string> };
 * }} transcriptSets
 * @param {ReadonlyArray<string>} [variants]
 */
export function summarizeSweep(transcriptSets, variants = NAME_MATCH_VARIANTS_V0) {
  if (transcriptSets == null || typeof transcriptSets !== "object") {
    throw new TypeError("summarizeSweep: transcriptSets must be an object.");
  }
  return {
    nameAccuracy: {
      withPrompt: scoreNameHitRate(transcriptSets.named.withPrompt, variants),
      withoutPrompt: scoreNameHitRate(transcriptSets.named.withoutPrompt, variants)
    },
    hallucination: {
      withPrompt: scoreNameHitRate(transcriptSets.unnamed.withPrompt, variants),
      withoutPrompt: scoreNameHitRate(transcriptSets.unnamed.withoutPrompt, variants)
    }
  };
}

// ── CLI 引数（bench-asr.mjs に倣う）──────────────────────────────────────

function parseArgs(argv) {
  const args = { runs: 1, port: undefined, synthetic: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--runs") args.runs = Number(argv[++i]);
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--synthetic") args.synthetic = true;
  }
  return args;
}

// ── TTS 合成（bench-asr.mjs acquireWav:55-76 写経・話速/ピッチ/抑揚振り）──────

/**
 * 1 文 × パラメータ振りで WAV 群を合成する（既定は実 AivisSpeech・注入可能）。
 * @param {string} text
 * @param {{ synthetic?: boolean; paramVariations?: ReadonlyArray<any> }} [args]
 * @param {{ ttsClientFactory?: typeof createTtsClient }} [inject]
 * @returns {Promise<Uint8Array[]>}
 */
export async function synthesizeVariants(text, args = {}, inject = {}) {
  const paramVariations = args.paramVariations ?? PARAM_VARIATIONS_V0;
  if (args.synthetic) {
    // AivisSpeech 不在時の構造疎通フォールバック（bench-asr.mjs の synthetic 分岐写経）。
    // 名前判定には使えない（正弦波は転写できない）が、経路が壊れていないことの確認用。
    const pcm = concatInt16(
      silencePcm({ durationMs: 300 }),
      sinePcm({ freq: 440, durationMs: 800 }),
      silencePcm({ durationMs: 300 })
    );
    return [encodeWav(pcm, { sampleRate: 16000, channels: 1, bitsPerSample: 16 })];
  }
  const ttsClientFactory = inject.ttsClientFactory ?? createTtsClient;
  const tts = ttsClientFactory();
  const wavs = [];
  for (const variation of paramVariations) {
    const query = await tts.audioQuery(text);
    if (typeof query === "object" && query !== null) {
      query.outputSamplingRate = 16000;
      query.outputStereo = false;
      query.speedScale = variation.speedScale;
      query.pitchScale = variation.pitchScale;
      query.intonationScale = variation.intonationScale;
    }
    wavs.push(await tts.synthesis(query));
  }
  return wavs;
}

// ── /inference 直投（bench-asr.mjs inference:78-93 写経 + prompt 1 行）──────────

/**
 * /inference を叩く（audio_ctx・prompt フィールドの注入に対応・ベンチ専用のローカル実装）。
 * @param {string} baseUrl
 * @param {Uint8Array} wavBytes
 * @param {{ requestAc?: number; prompt?: string; fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<string>}
 */
export async function inference(baseUrl, wavBytes, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const form = new FormData();
  form.append("file", new Blob([wavBytes], { type: "audio/wav" }), "speech.wav");
  form.append("temperature", "0");
  form.append("response_format", "json");
  if (opts.requestAc != null) {
    form.append("audio_ctx", String(opts.requestAc));
  }
  if (opts.prompt) {
    form.append("prompt", opts.prompt);
  }
  const response = await fetchImpl(`${baseUrl}/inference`, { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${await response.text().then((t) => t.slice(0, 300)).catch(() => "")}`
    );
  }
  const { text } = parseInferenceResponse(await response.json());
  return normalizeTranscript(text);
}

// ── スイープ中核ロジック（テスト可能・fetch/TTS 注入可能）───────────────────

/**
 * 名前入り/名前なし文群を対象に prompt 有/無で /inference を叩き集計する（中核ロジック）。
 * 実ネット/実 TTS は `synthesizeImpl`/`inferenceImpl` 経由で差し替え可能（既定は実 TTS/実 fetch・
 * `synthesizeVariants`/`inference` そのまま）。node:test からは fake 実装を注入して構造のみ検証する
 * （実 whisper-server/実 AivisSpeech 不使用）。
 * @param {object} opts
 * @param {string} opts.baseUrl
 * @param {ReadonlyArray<string>} [opts.namedSentences]
 * @param {ReadonlyArray<string>} [opts.unnamedSentences]
 * @param {{ runs?: number; synthetic?: boolean; paramVariations?: ReadonlyArray<any> }} [opts.args]
 * @param {typeof synthesizeVariants} [opts.synthesizeImpl]
 * @param {typeof inference} [opts.inferenceImpl]
 * @param {(msg: string) => void} [opts.logImpl]
 */
export async function runSweep(opts) {
  if (opts == null || typeof opts.baseUrl !== "string") {
    throw new TypeError("runSweep: opts.baseUrl must be a string.");
  }
  const namedSentences = opts.namedSentences ?? NAMED_SENTENCES_V0;
  const unnamedSentences = opts.unnamedSentences ?? UNNAMED_SENTENCES_V0;
  const args = { runs: 1, synthetic: false, ...(opts.args ?? {}) };
  const synthesizeImpl = opts.synthesizeImpl ?? synthesizeVariants;
  const inferenceImpl = opts.inferenceImpl ?? inference;
  const logImpl = opts.logImpl ?? (() => {});

  /** @type {{ named: { withPrompt: string[]; withoutPrompt: string[] }; unnamed: { withPrompt: string[]; withoutPrompt: string[] } }} */
  const transcriptSets = {
    named: { withPrompt: [], withoutPrompt: [] },
    unnamed: { withPrompt: [], withoutPrompt: [] }
  };

  async function runGroup(sentences, bucket) {
    for (const sentence of sentences) {
      const wavs = await synthesizeImpl(sentence, args);
      for (const wav of wavs) {
        for (let i = 0; i < args.runs; i += 1) {
          const withPrompt = await inferenceImpl(opts.baseUrl, wav, { prompt: DEFAULT_WHISPER_PROMPT });
          const withoutPrompt = await inferenceImpl(opts.baseUrl, wav, { prompt: "" });
          bucket.withPrompt.push(withPrompt);
          bucket.withoutPrompt.push(withoutPrompt);
          logImpl(`"${sentence}" withPrompt="${withPrompt}" withoutPrompt="${withoutPrompt}"`);
        }
      }
    }
  }

  await runGroup(namedSentences, transcriptSets.named);
  await runGroup(unnamedSentences, transcriptSets.unnamed);

  return summarizeSweep(transcriptSets);
}

// ── main（人間が直接実行したときのみ・direct execution ガード）───────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  log(`config: runs=${args.runs} synthetic=${args.synthetic} port=${args.port ?? "-"}`);

  const server = createWhisperServer({ port: args.port, onStderr: () => {} });
  let failed = false;
  try {
    const t0 = Date.now();
    await server.ready;
    log(`server READY in ${Date.now() - t0}ms`);

    const summary = await runSweep({
      baseUrl: server.baseUrl,
      args: { runs: args.runs, synthetic: args.synthetic },
      logImpl: log
    });

    log(
      `RESULT nameAccuracy: withPrompt=${(summary.nameAccuracy.withPrompt.rate * 100).toFixed(1)}% ` +
        `(${summary.nameAccuracy.withPrompt.hits}/${summary.nameAccuracy.withPrompt.total}) ` +
        `withoutPrompt=${(summary.nameAccuracy.withoutPrompt.rate * 100).toFixed(1)}% ` +
        `(${summary.nameAccuracy.withoutPrompt.hits}/${summary.nameAccuracy.withoutPrompt.total})`
    );
    log(
      `RESULT hallucination: withPrompt=${(summary.hallucination.withPrompt.rate * 100).toFixed(1)}% ` +
        `(${summary.hallucination.withPrompt.hits}/${summary.hallucination.withPrompt.total}) ` +
        `withoutPrompt=${(summary.hallucination.withoutPrompt.rate * 100).toFixed(1)}% ` +
        `(${summary.hallucination.withoutPrompt.hits}/${summary.hallucination.withoutPrompt.total})`
    );
    log("記録先: discussion/ai-cohost/experiments/name-prompt.md へ数値を書き写すこと。");
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    server.dispose();
    log("server disposed");
  }
  process.exit(failed ? 1 : 0);
}

// direct execution ガード（node:test からの import では main() を走らせない）。
// pathToFileURL で Windows パス（バックスラッシュ・ドライブレター）を正しく file:// URL 化する
// （bench-asr.mjs 等の既存スクリプトは無条件 main() 実行だが、本スクリプトは node:test から
//  スコアリング純関数/runSweep を import するためガードが要る＝新規スクリプトゆえの設計判断）。
const isMainModule = (() => {
  try {
    return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();
if (isMainModule) {
  main().catch((error) => {
    process.stderr.write(
      `[bench-name-prompt] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exit(1);
  });
}
