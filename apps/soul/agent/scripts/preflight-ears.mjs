// @ts-check
/**
 * 耳パイプライン実機疎通 preflight（S2 Domain C・機械検証の最終段）— apps/soul/agent。
 * **配線 ≠ 疎通**。実マイクだけを使わずに、S2 の縦貫通を実部品で通す:
 *
 *   fake マイク（TTS 合成 PCM を実時間レートで流す）→ 実 Silero VAD（実 ONNX）→ セグメンタ →
 *   リング切り出し → 実 whisper-server（実 kotoba・採用チューニング設定）→ 転写バッファ
 *
 * 人間ゲートとの差分は「音源が実マイクか TTS か」だけになる（プライバシー絶対規律:
 * 音声はメモリ上のみ・ディスク不書き出し・実マイク不使用）。
 *
 * 使い方: node apps/soul/agent/scripts/preflight-ears.mjs
 *   [--threads N（既定 = 常駐既定 6）] [--port N] [--no-dynamic-audio-ctx]
 * exit 0 = PASS（両発話が転写されバッファに積まれた）、exit 1 = 失敗。
 */

import { createEarPipeline, EAR_DEFAULTS } from "../src/ears/ear-pipeline.mjs";
import { createTtsClient } from "../src/voice/tts-client.mjs";
import { decodeInt16LE } from "../src/ears/pcm-framing.mjs";
import { silencePcm, concatInt16 } from "../src/ears/fixtures-audio.mjs";

const log = (msg) => process.stdout.write(`[preflight-ears] ${msg}\n`);

function parseArgs(argv) {
  const args = { threads: undefined, port: undefined, dynamicAudioCtx: true };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--threads") args.threads = Number(argv[++i]);
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--no-dynamic-audio-ctx") args.dynamicAudioCtx = false;
  }
  return args;
}

/** WAV → data チャンクの PCM（16bit 前提の最小 RIFF パーサ・preflight-vad と同型）。 */
function wavDataBytes(wav) {
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  if (view.getUint32(0, false) !== 0x52494646) throw new Error("not a RIFF file");
  let offset = 12;
  while (offset + 8 <= wav.byteLength) {
    const id = view.getUint32(offset, false);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x64617461) return wav.subarray(offset + 8, offset + 8 + size);
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk found");
}

async function ttsPcm(text) {
  const tts = createTtsClient();
  const query = await tts.audioQuery(text);
  if (typeof query === "object" && query !== null) {
    query.outputSamplingRate = 16000;
    query.outputStereo = false;
  }
  return decodeInt16LE(wavDataBytes(await tts.synthesis(query)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const utterances = ["こんにちは、耳のテストです", "今日はメッシュ生成の続きをやります"];

  // 1. 音源（メモリ上のみ）: 無音 → 発話1 → 無音 → 発話2 → 無音。
  log(`TTS 合成中（AivisSpeech 実機・実マイク不使用）: ${utterances.map((t) => `"${t}"`).join(" / ")}`);
  const pcm1 = await ttsPcm(utterances[0]);
  const pcm2 = await ttsPcm(utterances[1]);
  const stream = concatInt16(
    silencePcm({ durationMs: 500 }),
    pcm1,
    silencePcm({ durationMs: 900 }), // minSilence(400ms) を確実に超える発話間無音
    pcm2,
    silencePcm({ durationMs: 900 })
  );
  log(
    `stream: ${(stream.length / 16000).toFixed(2)}s (utt1 ${(pcm1.length / 16000).toFixed(2)}s / utt2 ${(pcm2.length / 16000).toFixed(2)}s)`
  );

  // 2. fake マイク: 実時間レート（100ms = 1600 サンプル）で onPcm へ流す。
  const captureFactory = (opts) => {
    let cursor = 0;
    const timer = setInterval(() => {
      if (cursor >= stream.length) return; // 流し終えたら無音すら送らない（終端で静止）
      const next = Math.min(cursor + 1600, stream.length);
      const chunk = stream.subarray(cursor, next);
      cursor = next;
      const bytes = new Uint8Array(chunk.length * 2);
      new Int16Array(bytes.buffer).set(chunk);
      opts.onPcm(bytes);
    }, 100);
    return {
      dispose() {
        clearInterval(timer);
      }
    };
  };

  // 3. 実部品で常駐（採用既定: threads 6・動的 audio_ctx・maxSpeech 20000・minSilence 400）。
  /** @type {any[]} */
  const transcripts = [];
  /** @type {any[]} */
  const diags = [];
  const pipeline = createEarPipeline({
    captureFactory: /** @type {any} */ (captureFactory),
    whisper: { threads: args.threads ?? EAR_DEFAULTS.threads, port: args.port },
    asr: { dynamicAudioCtx: args.dynamicAudioCtx },
    onVadEvent: (e) => {
      if (e.type === "speechEnd") {
        log(`vad: speechEnd ${(e.startMs / 1000).toFixed(2)}..${(e.endMs / 1000).toFixed(2)}s (${e.reason})`);
      }
    },
    onTranscript: (entry, meta) => {
      transcripts.push({ entry, meta });
      log(
        `transcript[${entry.seq}] ${(entry.startMs / 1000).toFixed(2)}..${(entry.endMs / 1000).toFixed(2)}s ` +
          `latency=${Math.round(meta.latencyMs)}ms audio_ctx=${meta.audioCtx}  "${entry.text}"`
      );
    },
    onDiagnostic: (d) => {
      diags.push(d);
      log(`diag: ${JSON.stringify(d)}`);
    }
  });

  let failed = false;
  try {
    const t0 = Date.now();
    await pipeline.start();
    log(`pipeline started in ${Date.now() - t0}ms (VAD init + whisper ready)`);

    // 4. 両発話の転写が積もるまで待つ（有界 90s）。
    const deadline = Date.now() + 90000;
    while (pipeline.transcriptBuffer.size() < 2 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    const entries = pipeline.transcriptBuffer.all();
    if (entries.length < 2) {
      log(`FAIL: 期待 2 発話に対し転写 ${entries.length} 件（90s 以内）`);
      failed = true;
    } else if (entries.some((e) => e.text.length === 0)) {
      log("FAIL: 空転写が正本に積まれている（isBlank が守られていない）");
      failed = true;
    } else {
      log(
        `RESULT: PASS (2 utterances transcribed via real VAD + real whisper; ` +
          `stats=${JSON.stringify(pipeline.stats())})`
      );
    }
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    await pipeline.dispose();
    log("pipeline disposed (capture → queue → VAD → whisper-server)");
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(
    `[preflight-ears] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exit(1);
});
