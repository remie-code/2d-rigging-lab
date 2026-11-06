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
    {
      type: "ready",
      loadMs: 1500,
      decodingMethod: "modified_beam_search",
      hotwordsUsed: ["チャッピー", "コーディ"],
      hotwordsDropped: ["ラビ"],
      audioTagging: { enabled: false, reason: "not configured", loadMs: null }
    }
  ]);
  assert.equal(fake.rec.configs[0].modelConfig.numThreads, 2);
  assert.equal(fake.rec.configs[0].modelConfig.transducer.encoder, "e.onnx");
  assert.equal(fake.rec.configs[0].hotwordsScore, 1.5, "強さの指定が無ければ既定");

  await w.core.handle({ type: "transcribe", id: 7, pcm: Int16Array.from([16384, -32768, 0]) });
  const s = fake.rec.streams[0];
  assert.equal(s.hotwords, "チ ャ ッ ピ ー/コ ー デ ィ");
  assert.equal(s.sampleRate, 16000);
  assert.deepEqual([...s.samples], [0.5, -1, 0]);
  assert.deepEqual(w.sent[1], { type: "result", id: 7, text: "n=3", ms: 0, tagged: false, speech: null, tagMs: null });
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
  assert.deepEqual(w.sent[1], { type: "result", id: 3, text: "n=5", ms: 0, tagged: false, speech: null, tagMs: null });
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

// ── 音の種類の判定（咳払いの落とし 段階 2 §4 A の 1）────────────────────────────────

const CED = { model: "/m/ced/model.int8.onnx", labels: "/m/ced/class_labels_indices.csv" };
/** 偽物のラベルの表（見出し + 527 行）。 */
const LABELS_CSV = ["index,mid,display_name", ...Array.from({ length: 527 }, (_, i) => `${i},/m/${i},"label ${i}"`)].join("\n");

/**
 * 偽物の sherpa（OfflineRecognizer + AudioTagging）。認識の文字・判定の結果・失敗を差し替えられる。
 * @param {{ textFor?: (s: Float32Array) => string; eventsFor?: (s: Float32Array) => any; throwOnTaggerCreate?: Error | null;
 *   throwOnCompute?: Error | null; noAudioTagging?: boolean }} [opts]
 */
function makeFakeSherpaWithTagger(opts = {}) {
  const base = makeFakeSherpa({ textFor: opts.textFor ?? (() => "うん") });
  const rec = {
    /** @type {any[]} */ taggerConfigs: [],
    /** @type {Float32Array[]} */ taggedSamples: [],
    /** @type {number[]} */ topK: []
  };
  const eventsFor =
    opts.eventsFor ??
    (() => [
      { name: "Throat clearing", prob: 0.44, index: 48 },
      { name: "Speech", prob: 0.05, index: 0 },
      { name: "Cough", prob: 0.02, index: 47 }
    ]);
  class AudioTagging {
    /** @param {any} config */
    constructor(config) {
      if (opts.throwOnTaggerCreate) throw opts.throwOnTaggerCreate;
      rec.taggerConfigs.push(config);
    }
    createStream() {
      const s = { samples: /** @type {Float32Array | null} */ (null), sampleRate: 0 };
      return {
        /** @param {{ samples: Float32Array; sampleRate: number }} w */
        acceptWaveform(w) {
          s.samples = w.samples;
          s.sampleRate = w.sampleRate;
        },
        _s: s
      };
    }
    /** @param {any} stream @param {number} topK */
    compute(stream, topK) {
      if (opts.throwOnCompute) throw opts.throwOnCompute;
      rec.topK.push(topK);
      rec.taggedSamples.push(stream._s.samples);
      return eventsFor(stream._s.samples);
    }
  }
  const sherpa = opts.noAudioTagging ? { ...base.sherpa } : { ...base.sherpa, AudioTagging };
  return { sherpa, rec, base: base.rec };
}

/** @param {any} fake */
function makeTagCore(fake) {
  /** @type {any[]} */
  const sent = [];
  /** @type {number[]} */
  const exits = [];
  let clock = 0;
  let loads = 0;
  const core = createLocalSttWorkerCore({
    loadSherpa: () => {
      loads += 1;
      return fake.sherpa;
    },
    send: (m) => sent.push(m),
    readTextFile: (p) => (p.endsWith("tokens.txt") ? TOKENS : LABELS_CSV),
    nowImpl: () => (clock += 3),
    exit: (c) => exits.push(c)
  });
  return { core, sent, exits, loads: () => loads };
}

/** @param {any} [audioTagging] */
const tagInit = (audioTagging) => ({
  type: "init",
  engine: "zipformer",
  files: ZF_FILES,
  threads: 2,
  hotwords: [],
  ...(audioTagging === undefined ? {} : { audioTagging })
});

test("worker-core 判定: init に CED-tiny と上限があれば AudioTagging を作り（ラベルの数を topK に・1 スレッド）、ready に判定ありを載せる", async () => {
  const fake = makeFakeSherpaWithTagger();
  const w = makeTagCore(fake);
  await w.core.handle(tagInit({ ...CED, maxChars: 4 }));
  assert.equal(w.loads(), 1, "sherpa の読み込みは 1 回（認識器と判定で同じもの）");
  assert.deepEqual(fake.rec.taggerConfigs, [
    { model: { ced: CED.model, numThreads: 1, provider: "cpu", debug: 0 }, labels: CED.labels, topK: 527 }
  ]);
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].type, "ready");
  assert.equal(w.sent[0].audioTagging.enabled, true);
  assert.equal(w.sent[0].audioTagging.reason, null);
  assert.equal(typeof w.sent[0].audioTagging.loadMs, "number");
  assert.deepEqual(w.exits, []);
});

test("worker-core 判定: 上限以下の文字なら区間の音（余白込み）を 0 で 5 秒にのばして判定し、result に Speech の確率", async () => {
  const fake = makeFakeSherpaWithTagger({ textFor: () => "うん" });
  const w = makeTagCore(fake);
  await w.core.handle(tagInit({ ...CED, maxChars: 4 }));
  const pcm = new Int16Array(16000 * 0.8).fill(16384); // 0.8 秒（余白込みの区間の音）
  await w.core.handle({ type: "transcribe", id: 5, pcm });
  const result = w.sent[1];
  assert.deepEqual(Object.keys(result).sort(), ["id", "ms", "speech", "tagMs", "tagged", "text", "type"]);
  assert.equal(result.type, "result");
  assert.equal(result.id, 5);
  assert.equal(result.text, "うん");
  assert.equal(result.tagged, true);
  assert.equal(result.speech, 0.05);
  assert.equal(typeof result.tagMs, "number");
  // 認識器には区間の音そのまま、判定には 5 秒にのばした音（前後に同じだけ 0）。
  assert.equal(fake.base.streams[0].samples.length, pcm.length);
  assert.deepEqual(fake.rec.topK, [527]);
  const tagged = fake.rec.taggedSamples[0];
  assert.equal(tagged.length, 80000);
  const lead = Math.floor((80000 - pcm.length) / 2);
  assert.equal(tagged[lead - 1], 0);
  assert.equal(tagged[lead], 0.5);
  assert.equal(tagged[lead + pcm.length - 1], 0.5);
  assert.equal(tagged[lead + pcm.length], 0);
  // result に音（配列・物）を載せない。
  for (const v of Object.values(result)) assert.equal(typeof v === "object" && v !== null, false);
});

test("worker-core 判定: 上限を超える文字・0 文字（空・空白だけ）は判定しない（tagged false・speech null・compute を呼ばない）", async () => {
  const texts = ["こんにちは", "", "   ", "うん うん"];
  let i = 0;
  const fake = makeFakeSherpaWithTagger({ textFor: () => texts[i++] });
  const w = makeTagCore(fake);
  await w.core.handle(tagInit({ ...CED, maxChars: 4 }));
  for (let id = 1; id <= texts.length; id += 1) await w.core.handle({ type: "transcribe", id, pcm: new Int16Array(1600) });
  const results = w.sent.slice(1);
  assert.deepEqual(
    results.map((r) => [r.type, r.id, r.text, r.tagged, r.speech]),
    [
      ["result", 1, "こんにちは", false, null],
      ["result", 2, "", false, null],
      ["result", 3, "   ", false, null],
      ["result", 4, "うん うん", true, 0.05]
    ]
  );
  assert.equal(results[0].tagMs, null);
  assert.equal(fake.rec.taggedSamples.length, 1, "判定にかけたのは上限以下の 1 回だけ");
});

test("worker-core 判定: maxChars 0 は判定なし（AudioTagging を作らない・ready に理由）", async () => {
  const fake = makeFakeSherpaWithTagger();
  const w = makeTagCore(fake);
  await w.core.handle(tagInit({ ...CED, maxChars: 0 }));
  assert.equal(fake.rec.taggerConfigs.length, 0);
  assert.deepEqual(w.sent[0].audioTagging, { enabled: false, reason: "disabled (max chars is 0)", loadMs: null });
  await w.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(1600) });
  assert.deepEqual(w.sent[1], { type: "result", id: 1, text: "うん", ms: 3, tagged: false, speech: null, tagMs: null });
  assert.equal(fake.rec.taggedSamples.length, 0);
});

test("worker-core 判定: CED-tiny が渡されない（無い・null・パスが欠ける）なら判定なしで ready（fatal にしない）", async () => {
  for (const [audioTagging, reason] of /** @type {Array<[any, string]>} */ ([
    [undefined, "not configured"],
    [null, "not configured"],
    [{ maxChars: 4 }, "model paths are missing"],
    [{ model: CED.model, labels: "", maxChars: 4 }, "model paths are missing"]
  ])) {
    const fake = makeFakeSherpaWithTagger();
    const w = makeTagCore(fake);
    await w.core.handle(tagInit(audioTagging));
    assert.equal(w.sent[0].type, "ready");
    assert.deepEqual(w.sent[0].audioTagging, { enabled: false, reason, loadMs: null });
    assert.equal(fake.rec.taggerConfigs.length, 0);
    await w.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(1600) });
    assert.equal(w.sent[1].type, "result");
    assert.equal(w.sent[1].tagged, false);
    assert.deepEqual(w.exits, []);
  }
});

test("worker-core 判定: AudioTagging が作れなくても fatal にしない（認識器は作り、ready に判定なしと理由の 1 行）", async () => {
  const fake = makeFakeSherpaWithTagger({ throwOnTaggerCreate: new Error("bad ced\nmodel") });
  const w = makeTagCore(fake);
  await w.core.handle(tagInit({ ...CED, maxChars: 4 }));
  assert.equal(w.sent.length, 1);
  assert.equal(w.sent[0].type, "ready");
  assert.deepEqual(w.sent[0].audioTagging, { enabled: false, reason: "failed to load: bad ced model", loadMs: null });
  assert.equal(fake.base.configs.length, 1, "認識器は作った");
  assert.deepEqual(w.exits, []);
  await w.core.handle({ type: "transcribe", id: 2, pcm: new Int16Array(1600) });
  assert.deepEqual(w.sent[1], { type: "result", id: 2, text: "うん", ms: 3, tagged: false, speech: null, tagMs: null });

  // sherpa に AudioTagging が無いときも同じ（判定なし）。
  const noTag = makeFakeSherpaWithTagger({ noAudioTagging: true });
  const w2 = makeTagCore(noTag);
  await w2.core.handle(tagInit({ ...CED, maxChars: 4 }));
  assert.equal(w2.sent[0].type, "ready");
  assert.equal(w2.sent[0].audioTagging.enabled, false);
  assert.match(w2.sent[0].audioTagging.reason, /^failed to load: AudioTagging is not available/);
});

test("worker-core 判定: compute の失敗・おかしな結果は speech null（tagged true）で、error にも fatal にもしない", async () => {
  const fake = makeFakeSherpaWithTagger({ throwOnCompute: new Error("compute boom") });
  const w = makeTagCore(fake);
  await w.core.handle(tagInit({ ...CED, maxChars: 4 }));
  await w.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(1600) });
  assert.equal(w.sent[1].type, "result");
  assert.equal(w.sent[1].text, "うん", "文字起こしの結果は必ず返す");
  assert.equal(w.sent[1].tagged, true);
  assert.equal(w.sent[1].speech, null);
  assert.equal(typeof w.sent[1].tagMs, "number");
  assert.deepEqual(w.exits, []);

  const odd = makeFakeSherpaWithTagger({ eventsFor: () => "not-an-array" });
  const w2 = makeTagCore(odd);
  await w2.core.handle(tagInit({ ...CED, maxChars: 4 }));
  await w2.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(1600) });
  assert.equal(w2.sent[1].tagged, true);
  assert.equal(w2.sent[1].speech, null);
  // 次の発話も続けて判定できる。
  await w2.core.handle({ type: "transcribe", id: 2, pcm: new Int16Array(1600) });
  assert.equal(w2.sent[2].type, "result");
});

test("worker-core 判定: 文字起こしの失敗は今までどおり error（判定はしない）・shutdown で exit(0)", async () => {
  const fake = makeFakeSherpaWithTagger();
  const w = makeTagCore(fake);
  await w.core.handle(tagInit({ ...CED, maxChars: 4 }));
  await w.core.handle({ type: "transcribe", id: 9, pcm: /** @type {any} */ ([1, 2]) });
  assert.equal(w.sent[1].type, "error");
  assert.equal(w.sent[1].id, 9);
  assert.equal(fake.rec.taggedSamples.length, 0);
  await w.core.handle({ type: "shutdown" });
  assert.deepEqual(w.exits, [0]);
});
