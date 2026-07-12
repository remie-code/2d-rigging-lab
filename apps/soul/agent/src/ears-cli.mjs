// @ts-check
/**
 * 耳 CLI 診断（S2 Domain C）— apps/soul/agent。「喋ると転写が積もる」を見る窓。
 *
 * 耳パイプライン（ear-pipeline.mjs）を常駐させ、stdout に人向けの流れ
 * （VAD イベント・積もる転写・診断）を、stderr に 1 行 JSON の計測（S1 cli.mjs の型）を出す。
 * Ctrl+C / stdin EOF で全 dispose して終了する。既存の会話 CLI（cli.mjs・S1）には触れない。
 *
 * ── 実行（人間ゲート・Gnome は実行しない）───────────────────────────────
 *  node apps/soul/agent/src/ears-cli.mjs --device "マイク名"
 *  実マイク取り込みを伴うため Gnome は動かさない（規律）。配線検証は ear-pipeline を
 *  fake factory に差し替えた node:test（ears-cli.test.mjs・S1 cli.test.mjs の型）で行う。
 *
 * ── マイクデバイス名の調べ方（Windows/dshow）─────────────────────────────
 *  node apps/soul/agent/src/ears-cli.mjs --list-devices
 *  （内部で `ffmpeg -hide_banner -f dshow -list_devices true -i dummy` を実行して一覧を表示。
 *   出てきた音声デバイス名をそのまま --device に渡す。"audio=" 前置は CLI が補う。）
 */

import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

import { createEarPipeline, EAR_DEFAULTS } from "./ear-pipeline.mjs";
import { resolveFfmpegPath } from "./ffmpeg-capture.mjs";

/**
 * dshow のデバイス指定は `audio=<名前>` 形式。人が `--device マイク名` とだけ書けるよう、
 * dshow で "audio="/"video=" が付いていなければ前置する純関数。
 * @param {string | undefined} device
 * @param {string} inputFormat
 * @returns {string | undefined}
 */
export function normalizeDevice(device, inputFormat) {
  if (device == null || device.length === 0) return device;
  if (inputFormat === "dshow" && !/^(audio|video)=/.test(device)) {
    return `audio=${device}`;
  }
  return device;
}

const fmtSec = (ms) => `${(ms / 1000).toFixed(2)}s`;

/**
 * 耳 CLI 本体（依存注入で配線検証可能）。パイプラインを起動し、イベントを表示し、
 * signal abort / stdin EOF まで常駐する。
 *
 * @param {object} deps
 * @param {object} [deps.pipelineOptions]  createEarPipeline へ渡すオプション（callbacks 以外）。
 * @param {typeof createEarPipeline} [deps.pipelineFactory]  テスト注入（既定 createEarPipeline）。
 * @param {import("node:stream").Readable} deps.stdin   EOF 検出に使う（行は読み捨て）。
 * @param {import("node:stream").Writable} deps.stdout  人向け出力。
 * @param {import("node:stream").Writable} deps.stderr  1 行 JSON 計測。
 * @param {AbortSignal} [deps.signal]  abort で常駐を閉じる（Ctrl+C 配線用）。
 * @returns {Promise<{ transcripts: number; stats: object }>}
 */
export async function runEars(deps) {
  const { pipelineOptions = {}, pipelineFactory = createEarPipeline, stdin, stdout, stderr, signal } = deps;

  const jsonl = (obj) => stderr.write(`${JSON.stringify(obj)}\n`);

  const pipeline = pipelineFactory({
    ...pipelineOptions,
    onVadEvent: (e) => {
      if (e.type === "speechStart") {
        stdout.write(`[vad] ${fmtSec(e.tMs)} speechStart\n`);
      } else if (e.type === "speechEnd") {
        stdout.write(
          `[vad] ${fmtSec(e.tMs)} speechEnd ${fmtSec(e.startMs)}..${fmtSec(e.endMs)} (${Math.round(e.durationMs)}ms, ${e.reason})\n`
        );
      } else if (e.type === "speechCancel") {
        stdout.write(`[vad] ${fmtSec(e.tMs)} speechCancel (start ${fmtSec(e.startMs)} を取り消し)\n`);
      }
      jsonl({ event: "vad", type: e.type, t_ms: Math.round(e.tMs) });
    },
    onTranscript: (entry, meta) => {
      stdout.write(
        `[text] ${fmtSec(entry.startMs)}..${fmtSec(entry.endMs)}  「${entry.text}」  (+${Math.round(meta.latencyMs)}ms)\n`
      );
      jsonl({
        event: "transcript",
        seq: entry.seq,
        start_ms: Math.round(entry.startMs),
        end_ms: Math.round(entry.endMs),
        latency_ms: Math.round(meta.latencyMs),
        audio_ctx: meta.audioCtx,
        chars: entry.text.length
      });
    },
    onDiagnostic: (d) => {
      stdout.write(`[diag] ${d.type}${d.message ? `: ${d.message}` : ""}${d.reason ? ` (${d.reason})` : ""}\n`);
      if (d.type === "whisperDown") {
        stdout.write("[diag] whisper-server が落ちました。ASR は停止・VAD は継続します。CLI を再起動してください。\n");
      }
      jsonl({ event: "diagnostic", ...d });
    }
  });

  await pipeline.start();
  stdout.write("[ears] 耳が開きました。マイクに向かって喋ると転写が積もります（Ctrl+C / EOF で終了）。\n");

  // 常駐: signal abort か stdin EOF まで待つ（stdin の行は読み捨て・EOF 検出のみ）。
  const rl = createInterface({ input: stdin, crlfDelay: Infinity });
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      rl.close();
      resolve(undefined);
    };
    rl.on("close", finish);
    if (signal) {
      if (signal.aborted) finish();
      else signal.addEventListener("abort", finish, { once: true });
    }
  });

  const stats = pipeline.stats();
  await pipeline.dispose();
  jsonl({ event: "shutdown", ...statsSummary(stats) });
  stdout.write(`[ears] 終了（転写 ${pipeline.transcriptBuffer.size()} 件）。\n`);
  return { transcripts: pipeline.transcriptBuffer.size(), stats };
}

function statsSummary(stats) {
  return {
    frames: stats.frames,
    speech_ends: stats.speechEnds,
    asr_done: stats.asrDone,
    asr_failed: stats.asrFailed,
    asr_dropped: stats.asrDropped,
    discarded: stats.buffer?.discarded
  };
}

/** --list-devices: ffmpeg のデバイス列挙を実行して表示する（録音はしない）。 */
async function listDevices(inputFormat) {
  const ffmpeg = resolveFfmpegPath(undefined);
  process.stdout.write(`[ears] ${ffmpeg} -hide_banner -f ${inputFormat} -list_devices true -i dummy\n`);
  await new Promise((resolve) => {
    const child = spawn(ffmpeg, ["-hide_banner", "-f", inputFormat, "-list_devices", "true", "-i", "dummy"], {
      stdio: ["ignore", "inherit", "inherit"]
    });
    child.on("exit", () => resolve(undefined));
    child.on("error", (err) => {
      process.stderr.write(`[ears] ffmpeg の起動に失敗: ${err.message}（PATH か FFMPEG_PATH を確認）\n`);
      resolve(undefined);
    });
  });
}

const HELP = `usage: node src/ears-cli.mjs [--device "マイク名"] [options]
  --device NAME          マイクデバイス（dshow は "audio=" を自動前置。既定: 既定デバイスに任せず必須推奨）
  --input-format FMT     取り込みフォーマット（既定: win32 は dshow）
  --list-devices         ffmpeg のデバイス一覧を表示して終了
  --threads N            whisper-server スレッド数（既定 ${EAR_DEFAULTS.threads}）
  --port N               whisper-server ポート（既定 8178）
  --model PATH           kotoba モデル（既定 vendor/models/…・env WHISPER_MODEL_PATH）
  --server-path PATH     whisper-server.exe（既定 vendor/whisper/…・env WHISPER_SERVER_PATH)
  --language L           転写言語（既定 ja）
  --max-speech-ms N      発話の強制区切り（既定 ${EAR_DEFAULTS.maxSpeechMs}）
  --min-silence-ms N     無音確定までの長さ（既定 ${EAR_DEFAULTS.minSilenceMs}）
  --threshold X          VAD 立ち上げ閾値（既定 0.5）
  --no-dynamic-audio-ctx audio_ctx の動的縮小を無効化（全窓・遅いが検証用）
`;

/** 位置引数なし・フラグのみ。 */
export function parseEarsArgs(argv, env = process.env) {
  const args = {
    help: false,
    listDevices: false,
    device: env.EARS_DEVICE,
    inputFormat: undefined,
    threads: undefined,
    port: undefined,
    model: undefined,
    serverPath: undefined,
    language: undefined,
    maxSpeechMs: undefined,
    minSilenceMs: undefined,
    threshold: undefined,
    dynamicAudioCtx: true
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--list-devices") args.listDevices = true;
    else if (a === "--device") args.device = argv[++i];
    else if (a === "--input-format") args.inputFormat = argv[++i];
    else if (a === "--threads") args.threads = Number(argv[++i]);
    else if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--model") args.model = argv[++i];
    else if (a === "--server-path") args.serverPath = argv[++i];
    else if (a === "--language") args.language = argv[++i];
    else if (a === "--max-speech-ms") args.maxSpeechMs = Number(argv[++i]);
    else if (a === "--min-silence-ms") args.minSilenceMs = Number(argv[++i]);
    else if (a === "--threshold") args.threshold = Number(argv[++i]);
    else if (a === "--no-dynamic-audio-ctx") args.dynamicAudioCtx = false;
  }
  return args;
}

/** args → createEarPipeline のオプション（純関数・テスト対象）。 */
export function buildPipelineOptions(args) {
  const inputFormat = args.inputFormat ?? (process.platform === "win32" ? "dshow" : undefined);
  return {
    capture: {
      device: normalizeDevice(args.device, inputFormat ?? ""),
      ...(args.inputFormat != null ? { inputFormat: args.inputFormat } : {})
    },
    segmenter: {
      ...(args.maxSpeechMs != null ? { maxSpeechMs: args.maxSpeechMs } : {}),
      ...(args.minSilenceMs != null ? { minSilenceMs: args.minSilenceMs } : {}),
      ...(args.threshold != null ? { threshold: args.threshold } : {})
    },
    whisper: {
      ...(args.threads != null ? { threads: args.threads } : {}),
      ...(args.port != null ? { port: args.port } : {}),
      ...(args.model != null ? { modelPath: args.model } : {}),
      ...(args.serverPath != null ? { serverPath: args.serverPath } : {}),
      ...(args.language != null ? { language: args.language } : {})
    },
    asr: { dynamicAudioCtx: args.dynamicAudioCtx }
  };
}

/** 本番起動: 実マイク・実 whisper-server（人間ゲートの領分）。SIGINT/EOF で全 dispose。 */
async function main() {
  const args = parseEarsArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
    return;
  }
  if (args.listDevices) {
    await listDevices(args.inputFormat ?? (process.platform === "win32" ? "dshow" : "avfoundation"));
    process.exit(0);
    return;
  }
  if (!args.device) {
    process.stdout.write(
      "[ears] WARN: --device 未指定。ffmpeg の既定入力に任せます（失敗するなら --list-devices で名前を調べて指定）。\n"
    );
  }

  const controller = new AbortController();
  const onSigint = () => {
    process.stdout.write("\n[ears] SIGINT — 耳を閉じます。\n");
    controller.abort();
  };
  process.on("SIGINT", onSigint);
  try {
    const { transcripts } = await runEars({
      pipelineOptions: buildPipelineOptions(args),
      stdin: process.stdin,
      stdout: process.stdout,
      stderr: process.stderr,
      signal: controller.signal
    });
    process.stdout.write(`[ears] transcripts=${transcripts}\n`);
  } finally {
    process.removeListener("SIGINT", onSigint);
  }
  process.exit(0);
}

const invokedDirectly =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(
      `[ears] FATAL: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
    );
    process.exit(1);
  });
}
