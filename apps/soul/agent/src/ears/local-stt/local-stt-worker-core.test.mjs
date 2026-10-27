// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createLocalSttWorkerCore } from "./local-stt-worker-core.mjs";

// 子プロセスの中身（IPC の受け答え）を偽物の sherpa で固定する。本物の sherpa-onnx-node は読まない。

const ZF_FILES = { encoder: "e.onnx", decoder: "d.onnx", joiner: "j.onnx", tokens: "tokens.txt" };
const TOKENS = "<blk> 0\nチ 1\nャ 2\nッ 3\nピ 4\nー 5\nコ 6\nデ 7\nィ 8\n";

/** 偽物の sherpa（認識器の設定・createStream の hotwords・受け取ったサンプルを記録する）。 */
function makeFakeSherpa({ withAsync = true, throwOnCreate = null, decodeDelayMs = 0, textFor = (/** @type {Float32Array} */ s) => `n=${s.length}` } = {}) {
  const rec = { configs: /** @type {any[]} */ ([]), streams: /** @type {any[]} */ ([]), order: /** @type {number[]} */ ([]) };
  class OfflineRecognizer {
    /** @param {any} config */
    constructor(config) {
      if (throwOnCreate) throw throwOnCreate;
      rec.configs.push(config);
    }
    /** @param {string} [hotwords] */
    createStream(hotwords) {
      const s = { hotwords, argCount: arguments.length, samples: /** @type {Float32Array | null} */ (null), sampleRate: 0 };
      rec.streams.push(s);
      return {
        /** @param {{ samples: Float32Array; sampleRate: number }} w */
        acceptWaveform(w) {
          s.samples = w.samples;
          s.sampleRate = w.sampleRate;
        },
        _s: s
      };
    }
    /** @param {any} stream */
    decode(stream) {
      stream._done = true;
    }
    /** @param {any} stream */
    getResult(stream) {
      return { text: textFor(stream._s.samples) };
    }
  }
  if (withAsync) {
    /** @param {any} stream */
    /** @type {any} */ (OfflineRecognizer.prototype).decodeAsync = async function (stream) {
      if (decodeDelayMs) await new Promise((r) => setTimeout(r, decodeDelayMs));
      rec.order.push(stream._s.samples.length);
      return { text: textFor(stream._s.samples) };
    };
  }
  return { sherpa: { OfflineRecognizer }, rec };
}

function makeCore(fake, { tokens = TOKENS } = {}) {
  /** @type {any[]} */
  const sent = [];
  /** @type {number[]} */
  const exits = [];
  let loads = 0;
  let clock = 0;
  const core = createLocalSttWorkerCore({
    loadSherpa: () => {
      loads += 1;
      clock += 1500; // 読み込みに 1.5 秒かかったことにする
      return fake.sherpa;
    },
    send: (m) => sent.push(m),
    readTextFile: () => tokens,
    nowImpl: () => clock,
    exit: (c) => exits.push(c)
  });
  return { core, sent, exits, loads: () => loads };
}

test("worker-core: Zipformer の init → ready（読み込み時間・modified_beam_search・hotwords を token 列で createStream に渡す）", async () => {
  const fake = makeFakeSherpa();
  const w = makeCore(fake);
  await w.core.handle({ type: "init", engine: "zipformer", files: ZF_FILES, threads: 2, hotwords: ["チャッピー", "コーディ", "ラビ"] });
  assert.equal(w.loads(), 1);
  assert.deepEqual(w.sent, [
    { type: "ready", loadMs: 1500, decodingMethod: "modified_beam_search", hotwordsUsed: ["チャッピー", "コーディ"], hotwordsDropped: ["ラビ"] }
  ]);
  assert.equal(fake.rec.configs[0].modelConfig.numThreads, 2);
  assert.equal(fake.rec.configs[0].modelConfig.transducer.encoder, "e.onnx");
  assert.equal(fake.rec.configs[0].hotwordsScore, 1.5, "強さの指定が無ければ既定");

  await w.core.handle({ type: "transcribe", id: 7, pcm: Int16Array.from([16384, -32768, 0]) });
  const s = fake.rec.streams[0];
  assert.equal(s.hotwords, "チ ャ ッ ピ ー/コ ー デ ィ");
  assert.equal(s.sampleRate, 16000);
  assert.deepEqual([...s.samples], [0.5, -1, 0]);
  assert.deepEqual(w.sent[1], { type: "result", id: 7, text: "n=3", ms: 0 });
});

test("worker-core: hotwords が空なら greedy_search で createStream に何も渡さない・Parakeet は hotwords を使わない", async () => {
  const z = makeFakeSherpa();
  const wz = makeCore(z);
  await wz.core.handle({ type: "init", engine: "zipformer", files: ZF_FILES, threads: 1, hotwords: [] });
  assert.equal(wz.sent[0].decodingMethod, "greedy_search");
  await wz.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(4) });
  assert.equal(z.rec.streams[0].argCount, 0);

  const p = makeFakeSherpa();
  const wp = makeCore(p);
  await wp.core.handle({
    type: "init",
    engine: "parakeet",
    files: { model: "m.onnx", tokens: "tokens.txt" },
    threads: 2,
    hotwords: ["チャッピー"]
  });
  assert.equal(wp.sent[0].type, "ready");
  assert.equal(wp.sent[0].decodingMethod, "greedy_search");
  assert.deepEqual(wp.sent[0].hotwordsUsed, []);
  assert.deepEqual(wp.sent[0].hotwordsDropped, ["チャッピー"]);
  assert.deepEqual(p.rec.configs[0].modelConfig.nemoCtc, { model: "m.onnx" });
  await wp.core.handle({ type: "transcribe", id: 2, pcm: new Int16Array(2) });
  assert.equal(p.rec.streams[0].argCount, 0);
});

test("worker-core: init の hotwordsScore（設定ファイルの強さ）が認識器の設定に入る", async () => {
  const fake = makeFakeSherpa();
  const w = makeCore(fake);
  await w.core.handle({ type: "init", engine: "zipformer", files: ZF_FILES, threads: 2, hotwords: ["チャッピー"], hotwordsScore: 3.5 });
  assert.equal(fake.rec.configs[0].decodingMethod, "modified_beam_search");
  assert.equal(fake.rec.configs[0].hotwordsScore, 3.5);
});

test("worker-core: decodeAsync が無ければ同期の decode + getResult", async () => {
  const fake = makeFakeSherpa({ withAsync: false });
  const w = makeCore(fake);
  await w.core.handle({ type: "init", engine: "zipformer", files: ZF_FILES, threads: 2, hotwords: [] });
  await w.core.handle({ type: "transcribe", id: 3, pcm: new Int16Array(5) });
  assert.deepEqual(w.sent[1], { type: "result", id: 3, text: "n=5", ms: 0 });
});

test("worker-core: 認識器が作れなければ fatal を送って exit(1)", async () => {
  const fake = makeFakeSherpa({ throwOnCreate: new Error("bad model") });
  const w = makeCore(fake);
  await w.core.handle({ type: "init", engine: "zipformer", files: ZF_FILES, threads: 2, hotwords: [] });
  assert.deepEqual(w.sent, [{ type: "fatal", message: "bad model" }]);
  assert.deepEqual(w.exits, [1]);
});

test("worker-core: 1 発話の失敗は error（id つき）で常駐は続く・ready 前の要求も error", async () => {
  const fake = makeFakeSherpa();
  const w = makeCore(fake);
  await w.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(1) });
  assert.equal(w.sent[0].type, "error");
  assert.equal(w.sent[0].id, 1);
  await w.core.handle({ type: "init", engine: "zipformer", files: ZF_FILES, threads: 2, hotwords: [] });
  await w.core.handle({ type: "transcribe", id: 2, pcm: /** @type {any} */ ([1, 2]) });
  assert.equal(w.sent[2].type, "error");
  assert.match(w.sent[2].message, /Int16Array/);
  await w.core.handle({ type: "transcribe", id: 3, pcm: new Int16Array(2) });
  assert.equal(w.sent[3].type, "result");
});

test("worker-core: 推論は直列（後から来た要求は前の推論が終わってから）・shutdown で exit(0)", async () => {
  const fake = makeFakeSherpa({ decodeDelayMs: 20 });
  const w = makeCore(fake);
  await w.core.handle({ type: "init", engine: "zipformer", files: ZF_FILES, threads: 2, hotwords: [] });
  await Promise.all([
    w.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(10) }),
    w.core.handle({ type: "transcribe", id: 2, pcm: new Int16Array(20) })
  ]);
  assert.deepEqual(fake.rec.order, [10, 20]);
  assert.deepEqual(
    w.sent.filter((m) => m.type === "result").map((m) => m.id),
    [1, 2]
  );
  await w.core.handle({ type: "shutdown" });
  assert.deepEqual(w.exits, [0]);
});
