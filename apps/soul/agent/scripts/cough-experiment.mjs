#!/usr/bin/env node
// @ts-check
/**
 * 咳払いの聞き取り実験（段階 1）の道具 — apps/soul/agent。
 *
 *   node apps/soul/agent/scripts/cough-experiment.mjs                 # 操縦席で最後に選んだマイクで 40 回
 *   node apps/soul/agent/scripts/cough-experiment.mjs --device "マイク (USB Audio)"
 *   node apps/soul/agent/scripts/cough-experiment.mjs --per-kind 2    # 短く試す（4 種類 × 2 回）
 *   オプション: --out-dir <dir> / --models-dir <dir> / --seed <整数>（合図の順を再現する）
 *
 * 計画: discussion/ai-cohost/implementation/orchestration/cough-experiment-plan.md。
 * 調査: discussion/ai-cohost/research/cough-filter-audio-tagging-2026-11.md。
 *
 * ── 流れ（本番の耳に揃える）─────────────────────────────────────────────
 *  マイク → 本番の耳 `createEarPipeline`（ffmpeg・Silero VAD・区切り・本物の音の前 0.2 秒・作り物の無音 0.3 秒、
 *  すべて本番の既定と設定ファイルの値のまま）→ Zipformer の文字起こし（本番の `createLocalSttClient` が fork する子を
 *  実験の子 `cough-experiment-worker.mjs` に差し替える。子は本番の子の中身で文字起こしをし、同じ音を無音で約 5 秒に
 *  のばして CED-tiny int8 で音の種類を判定する）→ 記録。
 *  マイクの選び方は操縦席と同じ（操縦席が最後に選んだマイク `lastDevice`・dshow なら `audio=` を付ける）。
 *  文字起こしの設定は操縦席と同じ設定ファイルの `localStt*`（ロールの hotwords の上書きは読まない）。
 *
 * ── 親で sherpa-onnx-node を読まない ─────────────────────────────────────
 *  このファイルは耳の VAD（onnxruntime-node）を動かす親。sherpa は子だけが読む（no-sherpa-in-parent.test.mjs で固定）。
 *
 * ── 声は保存しない ─────────────────────────────────────────────────
 *  音はメモリの中（耳のリングと IPC）だけ。結果のファイル（`cough-experiments/<日時>.jsonl`・git 外）は 1 行 1 件で、
 *  合図の種類・回数・文字起こしの文字・文字数・区間の長さ・3 つの確率・1 位のラベルと確率・時刻だけを持つ。
 *
 * ── 合図 ─────────────────────────────────────────────────────────
 *  4 種類 × 10 回を混ぜた順で 1 つずつ出す。区間は話し始めたときの合図のもの。区間が来なければ「区間なし」、
 *  複数来たら全部その合図の印で記録する（cough-experiment-lib.mjs の createCueSession）。Ctrl+C でそれまでの分を残して終わる。
 */

import { fork } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createEarPipeline } from "../src/ears/ear-pipeline.mjs";
import { createTranscriptBuffer } from "../src/ears/transcript-buffer.mjs";
import { checkLocalSttModel, DEFAULT_LOCAL_STT_MODELS_DIR } from "../src/ears/local-stt/local-stt-engines.mjs";
import { normalizeDevice } from "../src/cli/ears-cli.mjs";
import {
  buildCuePlan,
  checkCedTinyModel,
  createCueSession,
  CUE_TIMING_DEFAULTS,
  CUES_PER_KIND,
  experimentFileName,
  formatSummary,
  resolveCedTinyModel,
  sanitizeTagMessage,
  seededRng,
  summarizeRecords
} from "./cough-experiment-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const AGENT_ROOT = path.resolve(HERE, "..");

/** 実験の子の入口（sherpa を読む）。 */
export const COUGH_EXPERIMENT_WORKER_PATH = path.join(HERE, "cough-experiment-worker.mjs");

/** 結果の置き場の既定（apps/soul/agent/cough-experiments/・.gitignore 済み）。 */
export const DEFAULT_COUGH_EXPERIMENT_OUT_DIR = path.join(AGENT_ROOT, "cough-experiments");

/** 判定のスレッド数（調査 §4: tiny 1 スレッドで 5 秒の入力が約 15ms）。 */
export const TAGGER_THREADS = 1;

/**
 * 実験の子への引数（CED-tiny のファイル）。
 * @param {{ model: string; labels: string }} files
 * @param {number} [threads]
 */
export function buildTaggerWorkerArgs(files, threads = TAGGER_THREADS) {
  return ["--ced-model", files.model, "--ced-labels", files.labels, "--ced-threads", String(threads)];
}

const f3 = (/** @type {number | null} */ v) => (v === null ? "-" : v.toFixed(3));

/** @param {import("./cough-experiment-lib.mjs").ExperimentRecord} r */
function formatRecordLine(r) {
  if (r.outcome === "no_segment") return "  → 区間なし\n";
  if (r.outcome === "failed") return `  → 失敗（${r.reason ?? "unknown"}）\n`;
  const text = r.text && r.text.length > 0 ? `「${r.text}」` : "（空）";
  const tags =
    r.speech === null
      ? "判定なし"
      : `Speech ${f3(r.speech)} / Cough ${f3(r.cough)} / Throat clearing ${f3(r.throatClearing)}・1 位 ${r.topLabel ?? "-"} ${f3(r.topProb)}`;
  return `  → ${text}（${r.chars} 文字・${r.durationMs}ms） ${tags}\n`;
}

/**
 * @param {number} perKind
 */
function explanation(perKind) {
  const total = perKind * 4;
  return [
    "咳払いの聞き取り実験（段階 1）",
    `  合図が ${total} 回出ます（咳払い・「うん」・「うーん」・軽い咳を ${perKind} 回ずつ、混ぜた順）。`,
    "  合図が出たら、その音を 1 回だけ出して、次の合図が出るまで待ってください。",
    "  声は保存しません。記録に残るのは文字起こしの文字・長さ・判定の確率だけです。",
    "  途中でやめるときは Ctrl+C（それまでの分は残ります）。",
    ""
  ].join("\n");
}

/**
 * 実験を 1 回走らせる（依存は注入できる・テストは偽物のマイク・偽物の子で回す）。
 * @param {object} deps
 * @param {string | null} [deps.device]  マイク（操縦席の lastDevice か --device）。
 * @param {string} [deps.inputFormat]  既定 win32 → dshow（操縦席と同じ）。
 * @param {object | null} [deps.localStt]  設定ファイルの localStt*（settings.getLocalStt()）。
 * @param {string} [deps.modelsDir]
 * @param {string} [deps.outDir]
 * @param {number} [deps.perKind]
 * @param {() => number} [deps.rng]
 * @param {Partial<import("./cough-experiment-lib.mjs").CueTiming>} [deps.timing]
 * @param {(p: string) => boolean} [deps.existsImpl]  モデルの在否（テスト注入）。
 * @param {typeof createEarPipeline} [deps.pipelineFactory]
 * @param {object} [deps.pipelineOptions]  耳への追加（テスト注入: captureFactory / vadFactory / segmenter 等）。
 * @param {typeof fork} [deps.forkImpl]  実験の子の fork（テスト注入）。
 * @param {() => Promise<void>} [deps.waitForStart]  説明のあと始めるまで待つ（既定 待たない）。
 * @param {AbortSignal} [deps.signal]  Ctrl+C。
 * @param {(text: string) => void} [deps.write]  ターミナルへ。
 * @param {() => number} [deps.nowImpl]
 * @param {() => Date} [deps.dateImpl]
 * @param {(ms: number) => Promise<void>} [deps.sleep]
 * @returns {Promise<{ exitCode: number; filePath: string | null; records: import("./cough-experiment-lib.mjs").ExperimentRecord[]; aborted: boolean }>}
 */
export async function runCoughExperiment(deps = {}) {
  const write = deps.write ?? ((t) => process.stdout.write(t));
  const nowImpl = deps.nowImpl ?? Date.now;
  const dateImpl = deps.dateImpl ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const timing = { ...CUE_TIMING_DEFAULTS, ...(deps.timing ?? {}) };
  const modelsDir = deps.modelsDir ?? DEFAULT_LOCAL_STT_MODELS_DIR;
  const outDir = deps.outDir ?? DEFAULT_COUGH_EXPERIMENT_OUT_DIR;
  const perKind = deps.perKind ?? CUES_PER_KIND;
  const inputFormat = deps.inputFormat ?? (process.platform === "win32" ? "dshow" : "");
  const forkImpl = deps.forkImpl ?? fork;
  const pipelineFactory = deps.pipelineFactory ?? createEarPipeline;
  /** @type {import("./cough-experiment-lib.mjs").ExperimentRecord[]} */
  const records = [];
  const signal = deps.signal;
  const isAborted = () => signal?.aborted === true;
  const fail = (/** @type {string} */ line) => {
    write(`[cough-experiment] ${line}\n`);
    return { exitCode: 1, filePath: null, records, aborted: isAborted() };
  };

  // モデル（無ければ取得の仕方を 1 行出して止まる）。
  const zip = checkLocalSttModel("zipformer", { modelsDir, existsImpl: deps.existsImpl });
  if ("reason" in zip) return fail(zip.reason);
  const ced = checkCedTinyModel({ modelsDir, existsImpl: deps.existsImpl });
  if ("reason" in ced) return fail(ced.reason);

  // マイク（操縦席と同じ: dshow なら `audio=` を付ける）。
  const device = normalizeDevice(deps.device ?? undefined, inputFormat) ?? null;
  if (inputFormat === "dshow" && !device) {
    return fail("マイクが決まっていない（操縦席で一度マイクを選んで配信を始めるか、--device \"マイクの名前\" で指定する）。");
  }

  const cues = buildCuePlan({ perKind, rng: deps.rng });
  write(explanation(perKind));
  write(`マイク: ${device ?? "（既定の入力）"}\n準備しています（VAD・文字起こし・判定のモデルを読み込む）…\n`);

  /** 子から最後に来た判定（result の直前に来る・耳の転写は直列なので 1 つで足りる）。 */
  /** @type {import("./cough-experiment-lib.mjs").TagSummary | null} */
  let lastTags = null;
  const takeTags = () => {
    const t = lastTags;
    lastTags = null;
    return t;
  };
  /** @type {ReturnType<typeof createCueSession> | null} */
  let session = null;
  let childDown = false;

  /** @type {typeof fork} */
  const forkWithTags = /** @type {any} */ (
    (/** @type {string} */ modulePath, /** @type {string[]} */ args, /** @type {any} */ opts) => {
      const child = forkImpl(modulePath, args, opts);
      child.on("message", (/** @type {any} */ msg) => {
        if (msg && typeof msg === "object" && msg.type === "tags") lastTags = sanitizeTagMessage(msg);
      });
      return child;
    }
  );

  /** @param {number} endMs @param {import("./cough-experiment-lib.mjs").SegmentResult} result */
  const segment = (endMs, result) => {
    if (!session) {
      takeTags();
      return;
    }
    session.onSegment(endMs, result);
  };

  // 会話の正本は実験の中だけのもの（ほかへは流さない）。積まれた行も捨てられた（空の）行も区間 1 つとして数える。
  const buffer = createTranscriptBuffer();
  buffer.onAppend((entry) => {
    segment(entry.endMs, { outcome: "segment", text: entry.text, durationMs: entry.endMs - entry.startMs, tags: takeTags() });
  });
  buffer.onDiscard((info) => {
    segment(info.endMs, { outcome: "segment", text: info.text, durationMs: info.endMs - info.startMs, tags: takeTags() });
  });

  const cedFiles = resolveCedTinyModel({ modelsDir }).files;
  /** @type {any} */
  let pipeline = null;
  try {
    pipeline = pipelineFactory({
      ...(/** @type {any} */ (deps.pipelineOptions) ?? {}),
      capture: { ...(device != null ? { device } : {}), ...(inputFormat ? { inputFormat } : {}) },
      stt: {
        engine: "zipformer",
        local: {
          ...(deps.localStt && typeof deps.localStt === "object" ? deps.localStt : {}),
          modelsDir,
          client: {
            workerPath: COUGH_EXPERIMENT_WORKER_PATH,
            workerArgs: buildTaggerWorkerArgs(cedFiles),
            forkImpl: forkWithTags
          }
        }
      },
      transcriptBuffer: buffer,
      onVadEvent: (/** @type {any} */ event) => session?.onVadEvent(event),
      onDiagnostic: (/** @type {any} */ d) => {
        if (!d || typeof d !== "object") return;
        if (d.type === "localSttReady") {
          write(`文字起こしの準備ができた（${d.loadMs}ms・${d.decodingMethod}）。\n`);
        } else if (d.type === "localSttDown") {
          // Ctrl+C はターミナルの子プロセス（実験の子・ffmpeg）にも届くので、中断のあとの終了は落ちた扱いにしない。
          if (isAborted()) return;
          childDown = true;
          write(`[cough-experiment] 文字起こしの子プロセスが落ちた（code ${d.code}）。ここで終わる。\n`);
        } else if (d.type === "ffmpegExit") {
          write(`[cough-experiment] マイクの取り込み（ffmpeg）が終わった（code ${d.code ?? "-"}）。\n`);
        } else if (d.type === "asrFailure" || d.type === "emptyCut" || d.type === "asrSkipped" || d.type === "asrDropped") {
          if (d.type === "asrFailure") takeTags();
          const durationMs = typeof d.startMs === "number" && typeof d.endMs === "number" ? d.endMs - d.startMs : null;
          if (typeof d.endMs === "number") segment(d.endMs, { outcome: "failed", durationMs, reason: d.type });
        }
      }
    });
    await pipeline.start();
  } catch (error) {
    try {
      await pipeline?.dispose();
    } catch {
      // best-effort
    }
    return fail(`耳を起こせなかった: ${error instanceof Error ? error.message : String(error)}`);
  }

  /** @type {string | null} */
  let filePath = null;
  try {
    if (!isAborted() && deps.waitForStart) {
      write("準備ができた。Enter で始める。\n");
      await Promise.race([deps.waitForStart(), abortPromise(signal)]);
    }
    if (!isAborted()) {
      mkdirSync(outDir, { recursive: true });
      filePath = path.join(outDir, experimentFileName(dateImpl()));
      writeFileSync(filePath, "", { flag: "wx" });
      const out = filePath;
      session = createCueSession({
        cues,
        timing,
        nowImpl,
        dateImpl,
        onCue: (cue) => write(`\n[${cue.seq}/${cue.total}] ${cue.prompt}\n`),
        onRecord: (record) => {
          records.push(record);
          appendFileSync(out, `${JSON.stringify(record)}\n`);
          write(formatRecordLine(record));
        }
      });
      session.begin();
      while (!session.tick() && !isAborted() && !childDown) await sleep(timing.tickMs);
    }
  } finally {
    session = null;
    try {
      await pipeline.dispose();
    } catch {
      // best-effort
    }
  }

  const aborted = isAborted();
  if (aborted) write("\n中断した（ここまでの分を残す）。\n");
  write(`\n${formatSummary(summarizeRecords(records))}`);
  if (filePath) write(`結果: ${filePath}（${records.length} 件）\n`);
  return { exitCode: childDown && !aborted ? 1 : 0, filePath, records, aborted };
}

/** @param {AbortSignal | undefined} signal */
function abortPromise(signal) {
  if (!signal) return new Promise(() => {});
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => signal.addEventListener("abort", () => resolve(undefined), { once: true }));
}

/** @param {string[]} argv */
export function parseCoughExperimentArgs(argv) {
  /** @type {{ device?: string; outDir?: string; modelsDir?: string; perKind?: number; seed?: number }} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value for ${a}`);
      return v;
    };
    if (a === "--device") out.device = value();
    else if (a === "--out-dir") out.outDir = value();
    else if (a === "--models-dir") out.modelsDir = value();
    else if (a === "--per-kind" || a === "--seed") {
      const n = Number(value());
      if (!Number.isInteger(n) || (a === "--per-kind" && n < 1)) throw new Error(`${a} must be ${a === "--per-kind" ? "a positive" : "an"} integer`);
      if (a === "--per-kind") out.perKind = n;
      else out.seed = n;
    } else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    const args = parseCoughExperimentArgs(process.argv.slice(2));
    // 実データの設定ファイル（操縦席のマイクの記憶と localStt*）を読むのは、ユーザーが道具を走らせたこのときだけ。
    const { createFileSettingsStore } = await import("../src/cockpit/cockpit-settings-store.mjs");
    const settings = createFileSettingsStore();
    const controller = new AbortController();
    let sigints = 0;
    process.on("SIGINT", () => {
      sigints += 1;
      if (sigints >= 2) process.exit(130);
      controller.abort();
    });
    const { createInterface } = await import("node:readline");
    const result = await runCoughExperiment({
      device: args.device ?? settings.getLastDevice(),
      localStt: settings.getLocalStt(),
      modelsDir: args.modelsDir,
      outDir: args.outDir,
      perKind: args.perKind,
      rng: args.seed !== undefined ? seededRng(args.seed) : undefined,
      signal: controller.signal,
      waitForStart: () =>
        new Promise((resolve) => {
          const rl = createInterface({ input: process.stdin, output: process.stdout });
          let closed = false;
          const close = () => {
            if (closed) return;
            closed = true;
            rl.close();
            resolve(undefined);
          };
          rl.once("line", close);
          rl.once("SIGINT", () => {
            controller.abort();
            close();
          });
          controller.signal.addEventListener("abort", close, { once: true });
        })
    });
    process.exitCode = result.exitCode;
    // 標準入力を開いたままにしない。
    process.stdin.pause();
  } catch (error) {
    process.stderr.write(`[cough-experiment] 失敗: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
