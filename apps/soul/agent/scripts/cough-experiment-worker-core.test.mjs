// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCoughExperimentWorkerCore, parseTaggerArgs } from "./cough-experiment-worker-core.mjs";
import { buildRecognizerConfig } from "../src/ears/local-stt/local-stt-engines.mjs";
import { makeFakeSherpaWithTagging, FAKE_LABELS_CSV, FAKE_TOKENS } from "../src/test-support/fake-cough-experiment.mjs";

// 実験の子の中身を偽物の sherpa（OfflineRecognizer + AudioTagging）で固定する。本物の sherpa-onnx-node・モデルは読まない。

const ZF_FILES = { encoder: "e.onnx", decoder: "d.onnx", joiner: "j.onnx", tokens: "tokens.txt" };
const TAGGER = { model: "/m/ced/model.int8.onnx", labels: "/m/ced/class_labels_indices.csv", threads: 1 };

/** @param {any} fake @param {{ tagger?: any }} [opts] */
function makeCore(fake, opts = {}) {
  /** @type {any[]} */
  const sent = [];
  /** @type {number[]} */
  const exits = [];
  /** @type {string[]} */
  const reads = [];
  let clock = 0;
  const core = createCoughExperimentWorkerCore({
    loadSherpa: () => fake.sherpa,
    send: (m) => sent.push(m),
    readTextFile: (p) => {
      reads.push(p);
      return p.endsWith("tokens.txt") ? FAKE_TOKENS : FAKE_LABELS_CSV;
    },
    tagger: "tagger" in opts ? opts.tagger : TAGGER,
    nowImpl: () => (clock += 5),
    exit: (c) => exits.push(c)
  });
  return { core, sent, exits, reads };
}

const init = { type: "init", engine: "zipformer", files: ZF_FILES, threads: 2, hotwords: ["チャッピー", "コーディ"], hotwordsScore: 1.5 };

test("cough-experiment-worker-core: init は判定（CED-tiny・ラベルの数を topK に）と本番と同じ認識器を作り、ready を返す", async () => {
  const fake = makeFakeSherpaWithTagging();
  const h = makeCore(fake);
  await h.core.handle(init);
  assert.equal(fake.rec.taggerConfigs.length, 1);
  assert.deepEqual(fake.rec.taggerConfigs[0], {
    model: { ced: TAGGER.model, numThreads: 1, provider: "cpu", debug: 0 },
    labels: TAGGER.labels,
    topK: 527
  });
  // 文字起こしは本番の子の中身のまま（同じ設定の組み立て・hotwords で modified_beam_search）。
  assert.equal(fake.rec.recognizerConfigs.length, 1);
  assert.deepEqual(fake.rec.recognizerConfigs[0], buildRecognizerConfig("zipformer", ZF_FILES, { threads: 2, hotwordsEnabled: true, hotwordsScore: 1.5 }));
  assert.equal(h.sent.length, 1);
  assert.equal(h.sent[0].type, "ready");
  assert.equal(h.sent[0].decodingMethod, "modified_beam_search");
  assert.deepEqual(h.sent[0].hotwordsUsed, ["チャッピー", "コーディ"]);
  assert.equal(typeof h.sent[0].taggerLoadMs, "number");
  assert.deepEqual(h.exits, []);
});

test("cough-experiment-worker-core: transcribe → 同じ音を 5 秒にのばして判定し、result の前に tags（数だけ・音は載せない）", async () => {
  const fake = makeFakeSherpaWithTagging({ textFor: () => "うん" });
  const h = makeCore(fake);
  await h.core.handle(init);
  const pcm = new Int16Array(16000 * 0.8).fill(16384); // 0.8 秒
  await h.core.handle({ type: "transcribe", id: 7, pcm });
  const [, tags, result] = h.sent;
  assert.equal(tags.type, "tags");
  assert.equal(tags.id, 7);
  assert.equal(result.type, "result");
  assert.equal(result.id, 7);
  assert.equal(result.text, "うん");
  // 認識器には区間の音そのまま、判定には 5 秒にのばした音。
  assert.deepEqual(fake.rec.recognizedLengths, [pcm.length]);
  assert.deepEqual(fake.rec.taggedLengths, [80000]);
  assert.deepEqual(fake.rec.computeTopK, [527]);
  const tagged = fake.rec.taggedSamples[0];
  const lead = Math.floor((80000 - pcm.length) / 2);
  assert.equal(tagged[0], 0);
  assert.equal(tagged[lead], 0.5);
  assert.equal(tagged[lead + pcm.length], 0);
  assert.deepEqual(
    { speech: tags.speech, cough: tags.cough, throatClearing: tags.throatClearing, topLabel: tags.topLabel, topIndex: tags.topIndex, topProb: tags.topProb },
    { speech: 0.31, cough: 0.02, throatClearing: 0.44, topLabel: "Throat clearing", topIndex: 48, topProb: 0.44 }
  );
  assert.equal(tags.taggedMs, 5000);
  // 判定の知らせに音（配列）を載せない。
  for (const v of Object.values(tags)) assert.equal(typeof v === "object" && v !== null, false, "tags に配列・物を載せない");
});

test("cough-experiment-worker-core: 判定が失敗しても文字起こしの result は返す（tags は error）", async () => {
  const fake = makeFakeSherpaWithTagging({ throwOnCompute: new Error("compute boom") });
  const h = makeCore(fake);
  await h.core.handle(init);
  await h.core.handle({ type: "transcribe", id: 1, pcm: new Int16Array(1600) });
  assert.deepEqual(h.sent.slice(1).map((m) => m.type), ["tags", "result"]);
  assert.equal(h.sent[1].error, "compute boom");
  // 文字起こしの失敗は本番の子と同じ error（tags は出さない）。
  await h.core.handle({ type: "transcribe", id: 2, pcm: /** @type {any} */ ([1, 2, 3]) });
  assert.deepEqual(h.sent.slice(3).map((m) => [m.type, m.id]), [["error", 2]]);
});

test("cough-experiment-worker-core: 判定のモデルの引数が無い・作れないときは fatal → exit(1)（認識器は作らない）", async () => {
  const fake = makeFakeSherpaWithTagging();
  const a = makeCore(fake, { tagger: {} });
  await a.core.handle(init);
  assert.equal(a.sent[0].type, "fatal");
  assert.match(a.sent[0].message, /--ced-model/);
  assert.deepEqual(a.exits, [1]);
  assert.equal(fake.rec.recognizerConfigs.length, 0);

  const broken = makeFakeSherpaWithTagging({ throwOnTaggerCreate: new Error("bad model") });
  const b = makeCore(broken);
  await b.core.handle(init);
  assert.equal(b.sent[0].type, "fatal");
  assert.match(b.sent[0].message, /bad model/);
  assert.deepEqual(b.exits, [1]);
});

test("cough-experiment-worker-core: 入口の引数", () => {
  assert.deepEqual(parseTaggerArgs(["--ced-model", "a.onnx", "--ced-labels", "b.csv", "--ced-threads", "2"]), {
    model: "a.onnx",
    labels: "b.csv",
    threads: 2
  });
  assert.deepEqual(parseTaggerArgs([]), {});
});
