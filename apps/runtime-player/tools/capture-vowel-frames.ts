/**
 * capture-vowel-frames.ts — iFacialMocap 母音参照フレームのキャプチャツール
 *
 * 目的: ユーザーが「中立・あ・い・う・え・お」を発音した実測 blendshape 値を
 * 正典参照フレームとして保存する（母音推定器の係数導出の一次ソース）。
 *
 * 使い方（リポジトリルートから）:
 *   npx tsx apps/runtime-player/tools/capture-vowel-frames.ts [--iphone <iPhoneのIP>]
 *
 * オプション:
 *   --iphone <ip>    iFacialMocap 開始要求の送信先（アプリが既に送信中なら省略可）
 *   --port <n>       受信ポート（既定: 49983 = player と同じ。player は閉じておくこと）
 *   --out <dir>      出力先（既定: test_data/iFaceMocap/vowels）
 *   --duration <ms>  1ラベルあたりのサンプリング窓（既定: 1500）
 *   --self-test      合成パケットでの自己検証（実機不要・非対話）
 */
import fs from "node:fs";
import path from "node:path";
import { createSocket } from "node:dgram";
import * as readline from "node:readline/promises";

import { parseIFacialMocapFrame } from "../src/main/input-adapters/ifacialmocap/ifacialmocap-frame-parser";
import { normalizeIFacialMocapParsedFrame } from "../src/main/input-adapters/ifacialmocap/ifacialmocap-normalizer";
import { IFacialMocapUdpReceiver } from "../src/main/input-adapters/ifacialmocap/ifacialmocap-udp-receiver";
import { IFACIALMOCAP_DEFAULT_UDP_PORT } from "../src/main/input-adapters/ifacialmocap/ifacialmocap-udp-start-request";

const captureTargets = [
  { key: "neutral", instruction: "中立（力を抜いて口を閉じる）" },
  { key: "a", instruction: "「あ」（大きく開く）" },
  { key: "i", instruction: "「い」（横に引く）" },
  { key: "u", instruction: "「う」（すぼめる）" },
  { key: "e", instruction: "「え」（中くらいに開く）" },
  { key: "o", instruction: "「お」（縦にすぼめて開く）" }
] as const;

const summaryBlendshapeNames = [
  "jawOpen",
  "mouthClose",
  "mouthFunnel",
  "mouthPucker",
  "mouthStretch_L",
  "mouthStretch_R",
  "mouthSmile_L",
  "mouthSmile_R",
  "mouthLowerDown_L",
  "mouthLowerDown_R",
  "mouthUpperUp_L",
  "mouthUpperUp_R",
  "mouthRollLower",
  "mouthRollUpper"
];

type CliArgs = {
  readonly iphoneHost?: string;
  readonly port: number;
  readonly outDir: string;
  readonly durationMs: number;
  readonly selfTest: boolean;
};

type BlendshapeStats = {
  sum: number;
  min: number;
  max: number;
  count: number;
};

type LabelCapture = {
  readonly label: string;
  readonly capturedAtIso: string;
  readonly sampleCount: number;
  readonly durationMs: number;
  readonly rawFrameSample: string;
  readonly blendshapes: Record<
    string,
    { mean: number; min: number; max: number }
  >;
};

function parseCliArgs(argv: readonly string[]): CliArgs {
  let iphoneHost: string | undefined;
  let port = IFACIALMOCAP_DEFAULT_UDP_PORT;
  let outDir = path.join("test_data", "iFaceMocap", "vowels");
  let durationMs = 1500;
  let selfTest = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--iphone") {
      iphoneHost = argv[++index];
    } else if (arg === "--port") {
      port = Number(argv[++index]);
    } else if (arg === "--out") {
      outDir = argv[++index];
    } else if (arg === "--duration") {
      durationMs = Number(argv[++index]);
    } else if (arg === "--self-test") {
      selfTest = true;
    } else {
      throw new Error(`不明な引数: ${arg}`);
    }
  }

  if (!Number.isFinite(port) || port <= 0 || port > 65535) {
    throw new Error(`ポートが不正: ${port}`);
  }
  if (!Number.isFinite(durationMs) || durationMs < 200) {
    throw new Error(`--duration は 200ms 以上を指定: ${durationMs}`);
  }

  return {
    ...(iphoneHost === undefined ? {} : { iphoneHost }),
    port,
    outDir,
    durationMs,
    selfTest
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeSamples(
  label: string,
  rawFrames: readonly string[],
  durationMs: number
): LabelCapture {
  const stats = new Map<string, BlendshapeStats>();

  for (const rawFrame of rawFrames) {
    const parsed = parseIFacialMocapFrame(rawFrame);
    const { trackingFrame } = normalizeIFacialMocapParsedFrame(parsed);
    for (const [name, value] of Object.entries(trackingFrame.blendshapes)) {
      const entry = stats.get(name);
      if (entry === undefined) {
        stats.set(name, { sum: value, min: value, max: value, count: 1 });
      } else {
        entry.sum += value;
        entry.min = Math.min(entry.min, value);
        entry.max = Math.max(entry.max, value);
        entry.count += 1;
      }
    }
  }

  const blendshapes: Record<string, { mean: number; min: number; max: number }> =
    {};
  for (const [name, entry] of [...stats.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    blendshapes[name] = {
      mean: round4(entry.sum / entry.count),
      min: round4(entry.min),
      max: round4(entry.max)
    };
  }

  return {
    label,
    capturedAtIso: new Date().toISOString(),
    sampleCount: rawFrames.length,
    durationMs,
    rawFrameSample: truncate(rawFrames[0] ?? "", 600),
    blendshapes
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function printSummaryTable(captures: readonly LabelCapture[]): void {
  const labelWidth = 18;
  const colWidth = 9;
  const header =
    "".padEnd(labelWidth) +
    captures.map((c) => c.label.padStart(colWidth)).join("");
  console.log("\n=== 主要口形 blendshape 平均値（0..1）===");
  console.log(header);
  for (const name of summaryBlendshapeNames) {
    const row =
      name.padEnd(labelWidth) +
      captures
        .map((c) => {
          const entry = c.blendshapes[name];
          return (entry === undefined ? "-" : entry.mean.toFixed(3)).padStart(
            colWidth
          );
        })
        .join("");
    console.log(row);
  }
}

function writeOutputs(
  outDir: string,
  args: CliArgs,
  captures: readonly LabelCapture[]
): string {
  fs.mkdirSync(outDir, { recursive: true });
  for (const capture of captures) {
    fs.writeFileSync(
      path.join(outDir, `vowel_${capture.label}.json`),
      `${JSON.stringify(capture, null, 2)}\n`,
      "utf8"
    );
  }
  const combinedPath = path.join(outDir, "vowel-captures.json");
  fs.writeFileSync(
    combinedPath,
    `${JSON.stringify(
      {
        capturedAtIso: new Date().toISOString(),
        receivePort: args.port,
        durationMs: args.durationMs,
        labels: Object.fromEntries(captures.map((c) => [c.label, c]))
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  return combinedPath;
}

async function runCaptureSession(
  args: CliArgs,
  waitForOperator: (instruction: string) => Promise<void>
): Promise<void> {
  const collector = {
    active: false,
    samples: [] as string[],
    packetCount: 0
  };

  const receiver = new IFacialMocapUdpReceiver({
    receivePort: args.port,
    ...(args.iphoneHost === undefined ? {} : { iphoneHost: args.iphoneHost }),
    handlers: {
      onListening: (address) => {
        console.log(`UDP 受信待機: ${address.address}:${address.port}`);
      },
      onMessage: (rawFrame) => {
        collector.packetCount += 1;
        if (collector.active) {
          collector.samples.push(rawFrame);
        }
      },
      onError: (error) => {
        console.error(`受信エラー: ${error.message}`);
      },
      onStartRequestChanged: (diagnostics) => {
        if (diagnostics.result === "sent") {
          console.log(
            `開始要求を送信: ${diagnostics.target.address}:${diagnostics.target.port}`
          );
        } else if (diagnostics.result === "error") {
          console.error(`開始要求の送信に失敗: ${diagnostics.errorMessage}`);
        }
      }
    }
  });

  try {
    await receiver.start();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("EADDRINUSE")) {
      throw new Error(
        `ポート ${args.port} が使用中です。runtime-player を終了してから再実行してください。`
      );
    }
    throw error;
  }

  try {
    console.log("パケット受信を待っています…（iFacialMocap を起動して送信状態にする）");
    const waitStartedAt = Date.now();
    while (collector.packetCount === 0) {
      await sleep(250);
      if (Date.now() - waitStartedAt > 15000) {
        console.log(
          "  15秒間パケットなし。確認: iFacialMocap の送信先 IP がこの PC か / --iphone <IP> を付けたか / player を閉じたか / ファイアウォール"
        );
        break;
      }
    }
    while (collector.packetCount === 0) {
      await sleep(250);
    }
    console.log(`受信確認（${collector.packetCount} パケット）。キャプチャを始めます。\n`);

    const captures: LabelCapture[] = [];
    for (const target of captureTargets) {
      await waitForOperator(target.instruction);
      await sleep(300);
      collector.samples = [];
      collector.active = true;
      await sleep(args.durationMs);
      collector.active = false;

      if (collector.samples.length === 0) {
        throw new Error(
          `「${target.key}」のサンプリング窓でパケットが 0 件でした。送信が続いているか確認して再実行してください。`
        );
      }

      const capture = summarizeSamples(
        target.key,
        collector.samples,
        args.durationMs
      );
      captures.push(capture);
      console.log(
        `  ${target.key}: ${capture.sampleCount} フレーム収集（jawOpen 平均 ${
          capture.blendshapes.jawOpen?.mean ?? "-"
        }）\n`
      );
    }

    const combinedPath = writeOutputs(args.outDir, args, captures);
    printSummaryTable(captures);
    console.log(`\n保存先: ${combinedPath}（ラベル別ファイルも同じディレクトリ）`);
  } finally {
    await receiver.stop();
  }
}

async function runInteractive(args: CliArgs): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  try {
    console.log(
      `母音参照フレームのキャプチャを ${captureTargets.length} ラベル分行います。` +
        `各ラベルで口を作って維持したまま Enter → ${args.durationMs}ms サンプリングします。\n`
    );
    await runCaptureSession(args, async (instruction) => {
      await rl.question(`▶ ${instruction} の口を作って維持したまま Enter: `);
    });
  } finally {
    rl.close();
  }
}

async function runSelfTest(args: CliArgs): Promise<void> {
  const port = args.port === IFACIALMOCAP_DEFAULT_UDP_PORT ? 49984 : args.port;
  const outDir = path.join(args.outDir, "self-test");
  const testArgs: CliArgs = {
    ...args,
    port,
    outDir,
    durationMs: Math.min(args.durationMs, 400)
  };

  const syntheticFrame =
    "jawOpen-80|mouthPucker-5|mouthFunnel-10|mouthStretch_L-20|mouthStretch_R-20|" +
    "mouthSmile_L-30|mouthSmile_R-30|mouthClose-2|trackingStatus-1|";
  const sender = createSocket("udp4");
  const timer = setInterval(() => {
    sender.send(syntheticFrame, port, "127.0.0.1");
  }, 16);

  try {
    await runCaptureSession(testArgs, async (instruction) => {
      console.log(`▶ [self-test] ${instruction}（自動進行）`);
    });

    const combined = JSON.parse(
      fs.readFileSync(path.join(outDir, "vowel-captures.json"), "utf8")
    ) as {
      labels: Record<string, LabelCapture>;
    };
    const labelKeys = Object.keys(combined.labels);
    const jawOpenMean = combined.labels.a?.blendshapes.jawOpen?.mean;
    const pass =
      labelKeys.length === captureTargets.length &&
      jawOpenMean !== undefined &&
      Math.abs(jawOpenMean - 0.8) < 0.001;
    console.log(
      pass
        ? "\nself-test PASS（全ラベル保存・正規化平均 jawOpen=0.8 一致）"
        : `\nself-test FAIL（labels=${labelKeys.length}, jawOpen mean=${jawOpenMean}）`
    );
    process.exitCode = pass ? 0 : 1;
  } finally {
    clearInterval(timer);
    sender.close();
  }
}

async function main(): Promise<void> {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.selfTest) {
    await runSelfTest(args);
  } else {
    await runInteractive(args);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
