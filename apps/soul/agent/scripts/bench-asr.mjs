// @ts-check
/**
 * ASR レイテンシベンチ（S2 Domain C・有界チューニング用の計測資材）— apps/soul/agent。
 *
 * preflight-asr の型を拡張し、チューニング 3 系統（Undine 裁定）を 1 コマンドで計測する:
 *   (a) --server-ac N   : whisper-server 起動引数 `-ac N`（静的 audio context 縮小）
 *       --request-ac N  : /inference multipart の `audio_ctx` フィールド（動的・実機照合対象）
 *   (b) --threads N     : `-t N`
 *   (c) --extra "…"     : 追加起動引数（例 "--no-fallback" / "-bo 1"）を空白区切りで
 *
 * 音声素材は preflight-asr と同じ絶対規律: AivisSpeech の TTS 合成（メモリ上のみ・実マイク不使用・
 * ディスク不書き出し）。--synthetic で正弦波にフォールバック可。転写品質は入力テキストとの
 * 目視比較のため毎回出力する。
 *
 * 使い方: node apps/soul/agent/scripts/bench-asr.mjs
 *   [--threads N] [--server-ac N] [--request-ac N] [--extra "…"] [--runs N（warm 回数・既定 3）]
 *   [--text "…"] [--synthetic] [--port N]
 * exit 0 = 計測完了、exit 1 = 失敗。
 */

import { createWhisperServer } from "../src/ears/whisper-server.mjs";
import { createTtsClient } from "../src/voice/tts-client.mjs";
import { encodeWav } from "../src/voice/wav-encode.mjs";
import { wavDurationSec } from "../src/voice/wav-duration.mjs";
import { sinePcm, silencePcm, concatInt16 } from "../src/ears/fixtures-audio.mjs";
import { parseInferenceResponse, normalizeTranscript } from "../src/ears/whisper-client.mjs";

const log = (msg) => process.stdout.write(`[bench-asr] ${msg}\n`);

function parseArgs(argv) {
  const args = {
    threads: undefined,
    serverAc: undefined,
    requestAc: undefined,
    extra: [],
    runs: 3,
    text: "こんにちは、耳のテストです。今日はいい天気ですね",
    synthetic: false,
    port: undefined
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--threads") args.threads = Number(argv[++i]);
    else if (a === "--server-ac") args.serverAc = Number(argv[++i]);
    else if (a === "--request-ac") args.requestAc = Number(argv[++i]);
    else if (a === "--extra") args.extra = argv[++i].split(/\s+/).filter(Boolean);
    else if (a === "--runs") args.runs = Number(argv[++i]);
    else if (a === "--text") args.text = argv[++i];
    else if (a === "--synthetic") args.synthetic = true;
    else if (a === "--port") args.port = Number(argv[++i]);
  }
  return args;
}

async function acquireWav(args) {
  if (!args.synthetic) {
    try {
      const tts = createTtsClient();
      const query = await tts.audioQuery(args.text);
      if (typeof query === "object" && query !== null) {
        query.outputSamplingRate = 16000;
        query.outputStereo = false;
      }
      const wav = await tts.synthesis(query);
      return { wav, source: "tts" };
    } catch (error) {
      log(`AivisSpeech 不在 → 合成 WAV へ: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const pcm = concatInt16(
    silencePcm({ durationMs: 300 }),
    sinePcm({ freq: 440, durationMs: 800 }),
    silencePcm({ durationMs: 300 })
  );
  return { wav: encodeWav(pcm, { sampleRate: 16000, channels: 1, bitsPerSample: 16 }), source: "synthetic" };
}

/** /inference を叩く（audio_ctx フィールドの動的注入に対応・ベンチ専用のローカル実装）。 */
async function inference(baseUrl, wavBytes, requestAc) {
  const form = new FormData();
  form.append("file", new Blob([wavBytes], { type: "audio/wav" }), "speech.wav");
  form.append("temperature", "0");
  form.append("response_format", "json");
  if (requestAc != null) {
    form.append("audio_ctx", String(requestAc));
  }
  const response = await fetch(`${baseUrl}/inference`, { method: "POST", body: form });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${await response.text().then((t) => t.slice(0, 300)).catch(() => "")}`);
  }
  const { text } = parseInferenceResponse(await response.json());
  return normalizeTranscript(text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { wav, source } = await acquireWav(args);
  const wavSec = wavDurationSec(wav);
  const extraArgs = [...args.extra];
  if (args.serverAc != null) {
    extraArgs.push("-ac", String(args.serverAc));
  }
  log(
    `config: source=${source} wav=${wavSec.toFixed(3)}s threads=${args.threads ?? "(default 4)"} ` +
      `server-ac=${args.serverAc ?? "-"} request-ac=${args.requestAc ?? "-"} extra=${JSON.stringify(args.extra)} runs=${args.runs}`
  );
  log(`text(in): "${args.synthetic ? "(synthetic)" : args.text}"`);

  const server = createWhisperServer({
    port: args.port,
    threads: args.threads,
    extraArgs: extraArgs.length > 0 ? extraArgs : undefined,
    onStderr: () => {}
  });
  let failed = false;
  try {
    const t0 = Date.now();
    await server.ready;
    log(`server READY in ${Date.now() - t0}ms`);

    const times = [];
    for (let i = 0; i <= args.runs; i += 1) {
      const t = Date.now();
      const text = await inference(server.baseUrl, wav, args.requestAc);
      const ms = Date.now() - t;
      const label = i === 0 ? "cold" : `warm#${i}`;
      log(`${label}: ${ms}ms  text="${text}"`);
      if (i > 0) times.push(ms);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)];
    log(`WARM: min=${times[0]}ms median=${median}ms max=${times[times.length - 1]}ms (n=${times.length})`);
  } catch (error) {
    log(`FAILED: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    failed = true;
  } finally {
    server.dispose();
    log("server disposed");
  }
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  process.stderr.write(`[bench-asr] FAILED (setup): ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
