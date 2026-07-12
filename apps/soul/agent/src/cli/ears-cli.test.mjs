// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runEars, normalizeDevice, parseEarsArgs, buildPipelineOptions } from "./ears-cli.mjs";

// 耳 CLI の配線テスト（S1 cli.test.mjs の型）。ear-pipeline を fake factory に差し替え、
// 実マイク・実 ONNX・実 whisper-server を一切使わずに表示・計測 JSON・終了経路を固定する。

function collectingWritable(sink) {
  return new Writable({
    write(chunk, _enc, cb) {
      sink.push(String(chunk));
      cb();
    }
  });
}

/** fake パイプライン: factory に渡された callbacks を握り、テストから発火できる。 */
function makeFakePipeline() {
  const record = { started: false, disposed: false, options: /** @type {any} */ (null) };
  let entries = 0;
  const factory = (options) => {
    record.options = options;
    return {
      transcriptBuffer: { size: () => entries, stats: () => ({ appended: entries, discarded: 0 }) },
      async start() {
        record.started = true;
      },
      async dispose() {
        record.disposed = true;
      },
      isDisposed: () => record.disposed,
      streamMs: () => 0,
      stats: () => ({ frames: 42, speechEnds: entries, asrDone: entries, asrFailed: 0, asrDropped: 0, buffer: { appended: entries, discarded: 0 } })
    };
  };
  return { factory, record, addEntry: () => (entries += 1) };
}

test("ears-cli: VAD/転写/診断が stdout に、1 行 JSON 計測が stderr に出て、EOF で dispose する", async () => {
  const fake = makeFakePipeline();
  const stdoutLines = [];
  const stderrLines = [];
  const stdin = new Readable({ read() {} });

  const run = runEars({
    pipelineFactory: /** @type {any} */ (fake.factory),
    pipelineOptions: { ringMs: 1000 },
    stdin,
    stdout: collectingWritable(stdoutLines),
    stderr: collectingWritable(stderrLines)
  });
  // start 完了（耳が開く）を待つ。
  while (!fake.record.started) {
    await new Promise((r) => setTimeout(r, 5));
  }
  // パイプラインからのイベントを模擬発火。
  fake.record.options.onVadEvent({ type: "speechStart", tMs: 1000 });
  fake.record.options.onVadEvent({
    type: "speechEnd",
    tMs: 2500,
    startMs: 970,
    endMs: 2100,
    durationMs: 1130,
    reason: "silence"
  });
  fake.addEntry();
  fake.record.options.onTranscript(
    { seq: 0, startMs: 970, endMs: 2100, text: "こんにちは", appendedAtMs: 1 },
    { latencyMs: 1499.6, audioCtx: 256 }
  );
  fake.record.options.onDiagnostic({ type: "asrFailure", message: "boom" });

  stdin.push(null); // EOF → 終了経路
  const result = await run;

  const out = stdoutLines.join("");
  assert.match(out, /耳が開きました/);
  assert.match(out, /\[vad\] 1\.00s speechStart/);
  assert.match(out, /\[vad\] 2\.50s speechEnd 0\.97s\.\.2\.10s \(1130ms, silence\)/);
  assert.match(out, /\[text\] 0\.97s\.\.2\.10s\s+「こんにちは」\s+\(\+1500ms\)/);
  assert.match(out, /\[diag\] asrFailure: boom/);
  assert.match(out, /終了（転写 1 件）/);

  const jsons = stderrLines.join("").trim().split("\n").map((l) => JSON.parse(l));
  const transcript = jsons.find((j) => j.event === "transcript");
  assert.deepEqual(transcript, {
    event: "transcript",
    seq: 0,
    start_ms: 970,
    end_ms: 2100,
    latency_ms: 1500,
    audio_ctx: 256,
    chars: 5
  });
  assert.ok(jsons.some((j) => j.event === "vad" && j.type === "speechStart"));
  assert.ok(jsons.some((j) => j.event === "diagnostic" && j.type === "asrFailure"));
  assert.ok(jsons.some((j) => j.event === "shutdown" && j.frames === 42));

  assert.equal(result.transcripts, 1);
  assert.equal(fake.record.disposed, true);
  // callbacks 以外の pipelineOptions が素通しされる。
  assert.equal(fake.record.options.ringMs, 1000);
});

test("ears-cli: signal abort（Ctrl+C 経路）で dispose して終了する", async () => {
  const fake = makeFakePipeline();
  const stdin = new Readable({ read() {} }); // 終端しない stdin
  const controller = new AbortController();
  const run = runEars({
    pipelineFactory: /** @type {any} */ (fake.factory),
    stdin,
    stdout: collectingWritable([]),
    stderr: collectingWritable([]),
    signal: controller.signal
  });
  while (!fake.record.started) {
    await new Promise((r) => setTimeout(r, 5));
  }
  controller.abort();
  const result = await run;
  assert.equal(result.transcripts, 0);
  assert.equal(fake.record.disposed, true);
  stdin.destroy();
});

test("ears-cli: start 失敗（whisper spawn 失敗等）はそのまま伝播する", async () => {
  const factory = () => ({
    transcriptBuffer: { size: () => 0, stats: () => ({}) },
    async start() {
      throw new Error("failed to bring up ears (spawn ENOENT)");
    },
    async dispose() {},
    isDisposed: () => true,
    streamMs: () => 0,
    stats: () => ({})
  });
  await assert.rejects(
    () =>
      runEars({
        pipelineFactory: /** @type {any} */ (factory),
        stdin: new Readable({ read() {} }),
        stdout: collectingWritable([]),
        stderr: collectingWritable([])
      }),
    /failed to bring up ears/
  );
});

test("ears-cli: normalizeDevice は dshow でのみ audio= を前置する", () => {
  assert.equal(normalizeDevice("マイク (USB Audio)", "dshow"), "audio=マイク (USB Audio)");
  assert.equal(normalizeDevice("audio=既に前置", "dshow"), "audio=既に前置");
  assert.equal(normalizeDevice("video=画面", "dshow"), "video=画面");
  assert.equal(normalizeDevice("hw:0", "pulse"), "hw:0");
  assert.equal(normalizeDevice(undefined, "dshow"), undefined);
  assert.equal(normalizeDevice("", "dshow"), "");
});

test("ears-cli: 引数パース → pipeline オプション組み立て（設定可能点の裏取り）", () => {
  const args = parseEarsArgs(
    [
      "--device",
      "My Mic",
      "--threads",
      "8",
      "--port",
      "9000",
      "--max-speech-ms",
      "15000",
      "--min-silence-ms",
      "300",
      "--threshold",
      "0.6",
      "--language",
      "ja",
      "--no-dynamic-audio-ctx"
    ],
    {}
  );
  const opts = buildPipelineOptions(args);
  if (process.platform === "win32") {
    assert.equal(opts.capture.device, "audio=My Mic");
  }
  assert.equal(opts.whisper.threads, 8);
  assert.equal(opts.whisper.port, 9000);
  assert.equal(opts.whisper.language, "ja");
  assert.equal(opts.segmenter.maxSpeechMs, 15000);
  assert.equal(opts.segmenter.minSilenceMs, 300);
  assert.equal(opts.segmenter.threshold, 0.6);
  assert.equal(opts.asr.dynamicAudioCtx, false);

  // 何も指定しなければ常駐既定（ear-pipeline の EAR_DEFAULTS）に任せて上書きしない。
  const bare = buildPipelineOptions(parseEarsArgs([], {}));
  assert.deepEqual(bare.segmenter, {});
  assert.deepEqual(bare.whisper, {});
  assert.equal(bare.asr.dynamicAudioCtx, true);

  // env EARS_DEVICE がフォールバックになる。
  const fromEnv = parseEarsArgs([], { EARS_DEVICE: "Env Mic" });
  assert.equal(fromEnv.device, "Env Mic");
});
