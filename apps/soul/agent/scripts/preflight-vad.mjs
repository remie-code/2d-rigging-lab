// @ts-check
/**
 * VAD 実機疎通 preflight（S2 Domain C・機械検証）— apps/soul/agent。**配線 ≠ 疎通**。
 *
 * 実 silero_vad.onnx（vendor 配置・非コミット）+ 実 onnxruntime-node で、
 * Domain A レビューの使い捨てプローブ（I/O 名照合）を**再現可能な資材**にしたもの。
 *
 * ── 検証する項目 ─────────────────────────────────────────────────────
 *  1. ONNX セッションの実 I/O 名が silero-vad.mjs の v5 既定（input/state/sr → output/stateN）
 *     と一致すること（モデル版の取り違え検知）。
 *  2. init → 合成 PCM（無音 / 正弦波）→ 発話確率が有限 [0,1] で返ること。無音は低確率。
 *  3.（任意・AivisSpeech 実機が生きていれば）日本語 TTS 合成音声で発話確率が threshold を
 *     超えること = 「魂の耳が音声らしい音声に反応する」の実機裏取り。**メモリ上のみ・
 *     ディスク不書き出し・実マイク不使用**（プライバシー絶対規律）。
 *  4. dispose 後にプロセスがハングせず終了すること。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-vad.mjs
 *   [--model PATH]（既定 vendor/models/silero_vad.onnx）
 *   [--synthetic]（TTS を試さず合成 PCM のみで検証）
 *   [--text "…"]（TTS 検証に使う日本語テキスト）
 * exit 0 = PASS、exit 1 = I/O 名不一致 or 確率取得失敗。
 */

import {
  createSileroVad,
  DEFAULT_SILERO_MODEL_PATH,
  SILERO_V5_INPUT_NAMES,
  SILERO_V5_OUTPUT_NAME,
  SILERO_V5_STATE_OUTPUT_NAME
} from "../src/ears/silero-vad.mjs";
import { sinePcm, silencePcm } from "../src/ears/fixtures-audio.mjs";
import { int16ToFloat32, decodeInt16LE } from "../src/ears/pcm-framing.mjs";
import { createTtsClient } from "../src/voice/tts-client.mjs";

const log = (msg) => process.stdout.write(`[preflight-vad] ${msg}\n`);

function parseArgs(argv) {
  const args = { model: undefined, synthetic: false, text: "こんにちは、耳のテストです" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--model") args.model = argv[++i];
    else if (a === "--synthetic") args.synthetic = true;
    else if (a === "--text") args.text = argv[++i];
  }
  return args;
}

/**
 * WAV バイト列から data チャンクの PCM 部分を取り出す最小 RIFF パーサ（16bit PCM 前提）。
 * @param {Uint8Array} wav
 * @returns {Uint8Array}
 */
function wavDataBytes(wav) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  if (view.getUint32(0, false) !== 0x52494646 /* RIFF */) {
    throw new Error("not a RIFF file");
  }
  let offset = 12; // RIFF ヘッダ（12 byte）以降をチャンク走査。
  while (offset + 8 <= wav.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x64617461 /* data */) {
      return wav.subarray(offset + 8, offset + 8 + size);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk found");
}

/**
 * PCM（Int16Array）を 512 サンプルフレームに割って VAD に通し、確率列を返す。
 * @param {ReturnType<typeof createSileroVad>} vad
 * @param {Int16Array} pcm
 */
async function probsOf(vad, pcm) {
  const f32 = int16ToFloat32(pcm);
  const probs = [];
  for (let i = 0; i + 512 <= f32.length; i += 512) {
    probs.push(await vad.process(f32.subarray(i, i + 512).slice()));
  }
  return probs;
}

const fmt = (probs) =>
  `n=${probs.length} max=${Math.max(...probs).toFixed(4)} mean=${(probs.reduce((a, b) => a + b, 0) / probs.length).toFixed(4)}`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const modelPath = args.model ?? DEFAULT_SILERO_MODEL_PATH;
  let failed = false;

  // 1. 実 I/O 名照合（silero-vad.mjs と同じ動的 import 経路で onnxruntime-node を引く）。
  const ortModule = await import("onnxruntime-node");
  const ort = ortModule.default ?? ortModule;
  const session = await ort.InferenceSession.create(modelPath);
  const expectedInputs = Object.values(SILERO_V5_INPUT_NAMES).sort();
  const actualInputs = [...session.inputNames].sort();
  const expectedOutputs = [SILERO_V5_OUTPUT_NAME, SILERO_V5_STATE_OUTPUT_NAME].sort();
  const actualOutputs = [...session.outputNames].sort();
  log(`model: ${modelPath}`);
  log(`io: inputs=${JSON.stringify(session.inputNames)} outputs=${JSON.stringify(session.outputNames)}`);
  const ioMatch =
    JSON.stringify(expectedInputs) === JSON.stringify(actualInputs) &&
    JSON.stringify(expectedOutputs) === JSON.stringify(actualOutputs);
  log(`io match (v5 expectation input/state/sr -> output/stateN): ${ioMatch ? "OK" : "MISMATCH"}`);
  if (!ioMatch) failed = true;
  if (typeof session.release === "function") await session.release();

  // 2. init → 合成 PCM → 確率（ラッパ経由の実到達）。
  const vad = createSileroVad({ modelPath });
  await vad.init();
  try {
    const silenceProbs = await probsOf(vad, silencePcm({ durationMs: 512 }));
    log(`prob(silence 512ms): ${fmt(silenceProbs)}`);
    vad.reset();
    const sineProbs = await probsOf(vad, sinePcm({ freq: 440, durationMs: 512 }));
    log(`prob(sine 440Hz 512ms): ${fmt(sineProbs)}`);
    const allFinite = [...silenceProbs, ...sineProbs].every((p) => Number.isFinite(p) && p >= 0 && p <= 1);
    log(`probabilities finite & in [0,1]: ${allFinite ? "OK" : "NG"}`);
    if (!allFinite) failed = true;
    if (Math.max(...silenceProbs) >= 0.3) {
      log(`FAIL: silence probability unexpectedly high (${Math.max(...silenceProbs)})`);
      failed = true;
    }

    // 3.（任意）AivisSpeech 実機の TTS 合成音声で「音声らしい音声に反応する」を裏取り。
    if (!args.synthetic) {
      try {
        const tts = createTtsClient();
        const query = await tts.audioQuery(args.text);
        if (typeof query === "object" && query !== null) {
          query.outputSamplingRate = 16000; // VAD と揃える。
          query.outputStereo = false;
        }
        const wav = await tts.synthesis(query); // メモリ上のみ・ディスク不書き出し。
        const pcm = decodeInt16LE(wavDataBytes(wav));
        vad.reset();
        const speechProbs = await probsOf(vad, pcm);
        const maxProb = Math.max(...speechProbs);
        const above = speechProbs.filter((p) => p >= 0.5).length;
        log(
          `prob(tts "${args.text}" ${(pcm.length / 16000).toFixed(2)}s): ${fmt(speechProbs)} frames>=0.5: ${above}/${speechProbs.length}`
        );
        if (maxProb < 0.5) {
          log("FAIL: TTS 音声に対して VAD 確率が threshold(0.5) を一度も超えない");
          failed = true;
        }
      } catch (error) {
        log(
          `AivisSpeech 不在または失敗 → TTS 検証をスキップ（合成 PCM の疎通のみ）: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  } finally {
    await vad.dispose();
  }

  log(failed ? "RESULT: FAIL" : "RESULT: PASS (io names match; probabilities sane; dispose clean)");
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-vad] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
