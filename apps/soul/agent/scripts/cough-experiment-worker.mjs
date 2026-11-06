// @ts-check
/**
 * 咳払いの聞き取り実験の子プロセスの入口（fork される側）— apps/soul/agent。
 *
 * **sherpa-onnx-node を読み込んでよいのは、本番の子の入口 `src/ears/local-stt/local-stt-worker.mjs` とこのファイルだけ。**
 * 親（実験の道具 `cough-experiment.mjs`）は耳の Silero VAD で onnxruntime-node（1.27.0）を読んでおり、sherpa の
 * onnxruntime.dll（別の版）と同じプロセスではぶつかる（discussion/ai-cohost/research/stt-candidates-2026-10.md §6）。
 * 親は本番の `createLocalSttClient` の workerPath としてこのファイルを fork するだけで、import しない（テストで固定）。
 *
 * 引数: `--ced-model <model.int8.onnx> --ced-labels <class_labels_indices.csv> [--ced-threads <n>]`。
 * IPC の形は本番の子と同じ（local-stt-worker-core.mjs のヘッダ）+ result の前の `tags`（cough-experiment-worker-core.mjs）。
 * 音はファイルに書かない（IPC のメモリだけ）。
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createCoughExperimentWorkerCore, parseTaggerArgs } from "./cough-experiment-worker-core.mjs";

const require = createRequire(import.meta.url);

if (typeof process.send !== "function") {
  process.stderr.write("cough-experiment-worker: must be started with an IPC channel (child_process.fork).\n");
  process.exit(2);
}

const core = createCoughExperimentWorkerCore({
  loadSherpa: () => require("sherpa-onnx-node"),
  send: (message) => {
    try {
      process.send?.(message);
    } catch {
      // 親が先に居なくなった（disconnect で終わる）。
    }
  },
  readTextFile: (p) => readFileSync(p, "utf8"),
  tagger: parseTaggerArgs(process.argv.slice(2)),
  exit: (code) => {
    setImmediate(() => process.exit(code));
  }
});

process.on("message", (message) => {
  void core.handle(message);
});
process.on("disconnect", () => process.exit(0));
