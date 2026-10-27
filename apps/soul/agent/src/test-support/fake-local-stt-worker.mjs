// @ts-check
/**
 * 偽物のローカル文字起こしの子プロセス（テスト用・本物の fork と IPC で動く・sherpa は読まない）。
 * local-stt-client.mjs の workerPath / workerArgs で差し替える。argv[2] がふるまい:
 *  - "ok"（既定）: init → ready（loadMs 5）。transcribe → result（text = `n=<サンプル数>`・ms 1）。
 *  - "fatal": init → fatal を送って exit(1)。
 *  - "crash-on-transcribe": ready のあと、最初の transcribe で exit(3)（応答しない）。
 *  - "silent": 何も返さない（ready のタイムアウト用）。
 */

const mode = process.argv[2] ?? "ok";

process.on("message", (/** @type {any} */ msg) => {
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "init") {
    if (mode === "silent") return;
    if (mode === "fatal") {
      process.send?.({ type: "fatal", message: "fake model load failure" });
      setImmediate(() => process.exit(1));
      return;
    }
    process.send?.({
      type: "ready",
      loadMs: 5,
      decodingMethod: msg.engine === "zipformer" && msg.hotwords.length > 0 ? "modified_beam_search" : "greedy_search",
      hotwordsUsed: msg.engine === "zipformer" ? msg.hotwords : [],
      hotwordsDropped: msg.engine === "zipformer" ? [] : msg.hotwords,
      echo: { engine: msg.engine, threads: msg.threads, fileRoles: Object.keys(msg.files).sort() }
    });
  } else if (msg.type === "transcribe") {
    if (mode === "crash-on-transcribe") {
      process.exit(3);
      return;
    }
    const isInt16 = msg.pcm instanceof Int16Array;
    process.send?.({ type: "result", id: msg.id, text: isInt16 ? ` n=${msg.pcm.length} ` : "not-int16", ms: 1 });
  }
});
process.on("disconnect", () => process.exit(0));
