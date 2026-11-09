#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { normalizeDevice } from "../src/cli/ears-cli.mjs";
import { createFfmpegCapture } from "../src/ears/ffmpeg-capture.mjs";
import { createLocalSttClient } from "../src/ears/local-stt/local-stt-client.mjs";
import { checkLocalSttModel, normalizeLocalSttSettings } from "../src/ears/local-stt/local-stt-engines.mjs";
import { encodeWav } from "../src/voice/wav-encode.mjs";
import { readWavPcm } from "../src/voice/wav-pcm.mjs";
import { createHaasExperimentWorker } from "./haas-experiment-worker-client.mjs";
import { compareExperimentClip } from "./haas-experiment-replay.mjs";

const agentRoot = fileURLToPath(new URL("..", import.meta.url));
const vendorDir = path.join(agentRoot, "vendor", "haas-ja-experiment");
const resultDir = path.join(agentRoot, "haas-experiments");
const modelName = "Haas-616M-ja-v1.0-Q8_0.gguf";
const publicWarmup = path.join(vendorDir, "jsut-sample.wav");
const sampleRate = 16_000;
const trialSeconds = 7;
const cues = [
  { kind: "conversation", prompt: "普段の話し方で短い文を一つ" },
  { kind: "response", prompt: "相づちの「うん」を一度" },
  { kind: "throat_clearing", prompt: "咳払いを一度" },
  { kind: "proper_noun", prompt: "よく使う固有名詞を入れた短い文を一つ" }
];

export async function captureExperimentClip({
  device, seconds = trialSeconds, signal, captureFactory = createFfmpegCapture, onStart = () => {}
}) {
  signal?.throwIfAborted();
  const pcm = Buffer.alloc(sampleRate * 2 * seconds);
  let captured = 0;
  let started = false;
  const { promise, resolve, reject } = Promise.withResolvers();
  const abort = () => reject(signal.reason);
  let capture;
  let lastError = "";
  const timeout = setTimeout(
    () => reject(new Error(`マイクの取り込みを完了できませんでした。${lastError ? ` ${lastError}` : ""}`)),
    (seconds + 10) * 1000
  );
  signal?.addEventListener("abort", abort, { once: true });
  try {
    capture = captureFactory({
      device: normalizeDevice(device, "dshow"),
      inputFormat: "dshow",
      sampleRate,
      channels: 1,
      maxRestarts: 0,
      onPcm(chunk) {
        if (!started) {
          started = true;
          onStart();
        }
        const count = Math.min(chunk.length, pcm.length - captured);
        pcm.set(chunk.subarray(0, count), captured);
        captured += count;
        if (captured === pcm.length) resolve(pcm);
      },
      onError(line) { lastError = line; },
      onExit({ code }) { reject(new Error(`ffmpeg が終了しました (${code ?? "signal"})。${lastError ? ` ${lastError}` : ""}`)); }
    });
    return await promise;
  } finally {
    signal?.removeEventListener("abort", abort);
    clearTimeout(timeout);
    capture?.dispose();
  }
}

function readFixture(filename) {
  const { pcm, channels, sampleRate: hz } = readWavPcm(readFileSync(filename));
  if (channels !== 1 || hz !== sampleRate) throw new Error("--fixture には 16 kHz・モノラル・PCM16 の WAV を指定してください。");
  return pcm;
}

function warmupInput() {
  if (existsSync(publicWarmup)) return readFileSync(publicWarmup);
  return encodeWav(new Int16Array(sampleRate), { sampleRate, channels: 1, bitsPerSample: 16 });
}

function showTrial(trial) {
  console.log(`\n${trial.kind}: ${trial.outcome}${trial.unsettled ? "（末尾未確定あり）" : ""}`);
  for (const segment of trial.segments) {
    for (const [engine, result] of Object.entries(segment)) {
      const text = result.outcome === "failed" ? "（認識失敗）" : result.text || "（空）";
      console.log(`  ${engine}: ${text} | 認識 ${result.recognitionMs ?? "-"} ms | 発話末尾→確定（再生での推定） ${result.replayEndEstimateToFinalMs ?? "-"} ms`);
    }
  }
}

async function main() {
  const { values: args } = parseArgs({ options: {
    device: { type: "string" },
    fixture: { type: "string" },
    "haas-device": { type: "string" },
    help: { type: "boolean" }
  } });
  if (args.help) {
    console.log("node apps/soul/agent/scripts/haas-experiment.mjs [--device マイク名] [--haas-device Vulkan0]");
    console.log("試験入力でマイクを開かずに比較する場合: --fixture <16 kHz モノラル PCM16 WAV>");
    return;
  }
  if (process.platform !== "win32") throw new Error("この実験は Windows 用です。");
  const fixture = args.fixture ? readFixture(args.fixture) : null;
  const executable = path.join(vendorDir, "speech.exe");
  const model = path.join(vendorDir, modelName);
  if (!existsSync(executable) || !existsSync(model)) {
    throw new Error(`speech.cpp v0.10.1 と ${modelName} を ${vendorDir} に配置してください。`);
  }
  const modelCheck = checkLocalSttModel("zipformer");
  if (!modelCheck.ok) {
    throw new Error("Zipformer がありません。node apps/soul/agent/scripts/fetch-local-stt-models.mjs --only zipformer で取得してください。");
  }
  let device = args.device;
  let localStt;
  if (!fixture) {
    // Only the user's explicit microphone run uses the saved mic/Zipformer settings.
    const { createFileSettingsStore } = await import("../src/cockpit/cockpit-settings-store.mjs");
    const settings = createFileSettingsStore();
    device ??= settings.getLastDevice();
    localStt = settings.getLocalStt();
    if (!device) throw new Error("操縦席でマイクを選ぶか、--device に Windows のマイク名を指定してください。");
  }
  const zip = normalizeLocalSttSettings(localStt);
  const abort = new AbortController();
  const cancel = () => abort.abort(new Error("実験を中断しました。"));
  process.on("SIGINT", cancel);
  const haas = createHaasExperimentWorker({ executable, model, device: args["haas-device"] });
  let zipformer;
  let terminal;
  const disposeEngines = () => {
    haas.dispose();
    zipformer?.dispose();
  };
  abort.signal.addEventListener("abort", disposeEngines, { once: true });
  try {
    const haasInfo = await haas.ready;
    zipformer = createLocalSttClient({
      engine: "zipformer", threads: zip.threads, hotwords: zip.hotwords, hotwordsScore: zip.hotwordsScore
    });
    const zipInfo = await zipformer.ready;
    const warmup = warmupInput();
    await zipformer.transcribe(warmup);
    await haas.transcribe(warmup);
    abort.signal.throwIfAborted();

    const conditions = {
      haas: {
        version: haasInfo.version,
        model: haasInfo.model.name,
        weightType: haasInfo.model.weight_type,
        device: haasInfo.model.device,
        threads: haasInfo.model.threads,
        decodeOnCpu: haasInfo.model.options?.find((option) => option.name === "decode_on_cpu")?.default,
        hotwords: 0
      },
      zipformer: {
        device: "cpu", threads: zip.threads, hotwords: zipInfo.hotwordsUsed.length, decodingMethod: zipInfo.decodingMethod,
        settings: fixture ? "defaults" : "saved shared settings", roleHotwordsOverride: false
      },
      shared: { preRollMs: zip.preRollMs, silencePadMs: zip.silencePadMs, vad: "Silero (production defaults)", coughFilter: false },
      replay: {
        order: ["zipformer", "haas"], endpoint: "first low-probability VAD frame (silence onset estimate)",
        includesCaptureDeviceBuffering: false, exactSpeechEndMeasured: false
      }
    };
    console.log(JSON.stringify(conditions, null, 2));
    console.log("語彙補助: Zipformer は共通設定のみ（ロール上書きなし）、Haas は補助なし。");
    console.log("発話末尾の厳密な時刻は計測しません。再生時のVAD低確率フレームを起点に推定し、マイク機器の取り込み遅延は含めません。");
    const compare = (pcm) => compareExperimentClip(pcm, {
      signal: abort.signal, preRollMs: zip.preRollMs, silencePadMs: zip.silencePadMs,
      zipformer: async (wav) => (await zipformer.transcribe(wav)).text,
      haas: (wav) => haas.transcribe(wav)
    });
    const trials = [];
    if (fixture) {
      const pcm = Buffer.concat([Buffer.alloc(3200), fixture, Buffer.alloc(32000)]);
      const trial = { kind: "fixture", ...await compare(pcm) };
      showTrial(trial);
      if (!trial.segments.some(({ zipformer, haas }) => zipformer.outcome === "text" && haas.outcome === "text") ||
          trial.segments.some(({ zipformer, haas }) => zipformer.outcome === "failed" || haas.outcome === "failed")) {
        throw new Error("両方式の同じ区間に対する転写を確認できませんでした。");
      }
      return;
    }

    terminal = createInterface({ input: process.stdin, output: process.stdout });
    terminal.on("SIGINT", cancel);
    console.log("合図を4つ出します。『どうぞ』から短く一度だけ発話して、音声を出さずに待ってください。音声は保存しません。");
    for (const cue of cues) {
      await terminal.question(`\n${cue.prompt}。準備できたら Enter: `, { signal: abort.signal });
      const pcm = await captureExperimentClip({
        device, signal: abort.signal, onStart: () => console.log("どうぞ")
      });
      console.log("比較中。録った音声を2方式に順番に流します。");
      const trial = { ...cue, ...await compare(pcm) };
      pcm.fill(0);
      trials.push(trial);
      showTrial(trial);
    }
    mkdirSync(resultDir, { recursive: true });
    const output = path.join(resultDir, `${new Date().toISOString().replaceAll(":", "-")}.json`);
    writeFileSync(output, JSON.stringify({ conditions, trials }, null, 2) + "\n", { flag: "wx" });
    console.log(`結果（転写・計測のみ、Git対象外）: ${output}`);
  } finally {
    terminal?.close();
    process.off("SIGINT", cancel);
    abort.signal.removeEventListener("abort", disposeEngines);
    disposeEngines();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    await main();
  } catch (error) {
    console.error(`[haas-experiment] ${error.message}`);
    process.exitCode = 1;
  }
}
