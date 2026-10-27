// @ts-check
/**
 * ローカルの文字起こしの子プロセスの入口（fork される側）— apps/soul/agent。
 *
 * **sherpa-onnx-node を読み込んでよいのはこのファイルだけ。** 親（魂の本体）は耳の Silero VAD で
 * onnxruntime-node（1.27.0）の onnxruntime.dll を読んでおり、sherpa の onnxruntime.dll（別の版）と
 * 同じプロセスではぶつかって落ちる（discussion/ai-cohost/research/stt-candidates-2026-10.md §6）。
 * 親は `local-stt-client.mjs` からこのファイルを fork するだけで、import しない（テストで固定）。
 *
 * IPC の形は local-stt-worker-core.mjs のヘッダ。親との IPC が切れたら（親の死）自分も終わる。
 */

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createLocalSttWorkerCore } from "./local-stt-worker-core.mjs";

const require = createRequire(import.meta.url);

if (typeof process.send !== "function") {
  process.stderr.write("local-stt-worker: must be started with an IPC channel (child_process.fork).\n");
  process.exit(2);
}

const core = createLocalSttWorkerCore({
  loadSherpa: () => require("sherpa-onnx-node"),
  send: (message) => {
    try {
      process.send?.(message);
    } catch {
      // 親が先に居なくなった（disconnect で終わる）。
    }
  },
  readTextFile: (p) => readFileSync(p, "utf8"),
  exit: (code) => {
    // 送りかけの IPC を流し切ってから終える。
    setImmediate(() => process.exit(code));
  }
});

process.on("message", (message) => {
  void core.handle(message);
});
process.on("disconnect", () => process.exit(0));
