// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  runCoughExperiment,
  parseCoughExperimentArgs,
  buildTaggerWorkerArgs,
  COUGH_EXPERIMENT_WORKER_PATH,
  DEFAULT_COUGH_EXPERIMENT_OUT_DIR
} from "./cough-experiment.mjs";
import { seededRng, buildCuePlan, CED_TINY_FETCH_COMMAND } from "./cough-experiment-lib.mjs";
import { sinePcm, silencePcm, concatInt16, int16ToBytesLE } from "../src/ears/fixtures-audio.mjs";
import {
  makeFakeSherpaWithTagging,
  makeInProcessFork,
  makeFakeCapture,
  fakeVadFactory
} from "../src/test-support/fake-cough-experiment.mjs";

// 実験の道具の機械テスト。偽物のマイク・偽物の VAD・同じプロセスの中の偽物の子（偽物の sherpa）で回す。
// 本物のマイク（ffmpeg）・本物の sherpa・モデル・実データの設定ファイルには触れない。書き出しは OS の一時ディレクトリ。

/** 記録の 1 行に許す欄（音のバイト・サンプル配列は入らない）。 */
const RECORD_KEYS = new Set([
  "cue",
  "cueLabel",
  "round",
  "seq",
  "outcome",
  "text",
  "chars",
  "durationMs",
  "speech",
  "cough",
  "throatClearing",
  "topLabel",
  "topProb",
  "reason",
  "at"
]);

/** 有界の条件待ち。 */
async function until(/** @type {() => boolean} */ cond, ms = 5000, label = "condition") {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

const FAST_TIMING = { cueTimeoutMs: 400, settleMs: 150, maxCueMs: 5000, tickMs: 10 };
// テストを速く回すための短い区切り（道具そのものは区切りを上書きしない＝本番の既定のまま・下の別テストで固定）。
const FAST_SEGMENTER = { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 0 };

/** 「無音 → 音 durationMs → 無音」。 */
const utterance = (/** @type {number} */ durationMs) =>
  concatInt16(silencePcm({ durationMs: 96 }), sinePcm({ freq: 440, durationMs }), silencePcm({ durationMs: 160 }));

function setup() {
  const outDir = mkdtempSync(path.join(tmpdir(), "cough-experiment-"));
  const fake = makeFakeSherpaWithTagging({ textFor: (s) => (s.length > 25000 ? "うーん" : "うん") });
  const fork = makeInProcessFork(fake.sherpa);
  const capture = makeFakeCapture();
  /** @type {string[]} */
  const output = [];
  const feed = (/** @type {Int16Array} */ pcm) => capture.rec.options.onPcm(int16ToBytesLE(pcm));
  return { outDir, fake, fork, capture, output, feed, cleanup: () => rmSync(outDir, { recursive: true, force: true }) };
}

test("cough-experiment: 合図ごとに区間を記録する（1 つ・2 つ・区間なし）・結果のファイルは JSONL で音を持たない・まとめを出す", { timeout: 30000 }, async () => {
  const h = setup();
  try {
    // 合図が出たら、その通し番号に合わせて偽物のマイクへ音を流す: 1 = 1 回・2 = 長めに 1 回・3 = 2 回・4 = 何もしない。
    const write = (/** @type {string} */ t) => {
      h.output.push(t);
      const m = /^\n\[(\d+)\/(\d+)\]/.exec(t);
      if (!m) return;
      const seq = Number(m[1]);
      setTimeout(() => {
        if (seq === 1) h.feed(utterance(480));
        else if (seq === 2) h.feed(utterance(1200));
        else if (seq === 3) h.feed(concatInt16(utterance(400), utterance(400)));
      }, 5);
    };
    const result = await runCoughExperiment({
      device: "USB Mic",
      inputFormat: "dshow",
      localStt: null,
      modelsDir: "/fake-models",
      outDir: h.outDir,
      perKind: 1,
      rng: seededRng(1),
      timing: FAST_TIMING,
      existsImpl: () => true,
      forkImpl: h.fork.forkImpl,
      pipelineOptions: { captureFactory: h.capture.captureFactory, vadFactory: fakeVadFactory, segmenter: FAST_SEGMENTER },
      write
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.aborted, false);
    const plan = buildCuePlan({ perKind: 1, rng: seededRng(1) });

    // 実験の子を本番の係で fork（入口は実験の子・判定のファイルは引数）。
    assert.equal(h.fork.rec.calls.length, 1);
    assert.equal(h.fork.rec.calls[0].modulePath, COUGH_EXPERIMENT_WORKER_PATH);
    assert.deepEqual(
      h.fork.rec.calls[0].args,
      buildTaggerWorkerArgs({
        model: path.join("/fake-models", "ced-tiny-audio-tagging-2024-04-19-int8", "model.int8.onnx"),
        labels: path.join("/fake-models", "ced-tiny-audio-tagging-2024-04-19-int8", "class_labels_indices.csv")
      })
    );
    assert.equal(h.fork.rec.toChild[0].engine, "zipformer");
    // マイクは操縦席と同じ形（dshow なら audio=）。
    assert.equal(h.capture.rec.options.device, "audio=USB Mic");
    assert.equal(h.capture.rec.options.inputFormat, "dshow");
    assert.equal(h.capture.rec.disposed, true, "終わったらマイクを閉じる");

    // 記録（合図の順・種類・回数）。
    const filePath = /** @type {string} */ (result.filePath);
    assert.ok(filePath.startsWith(h.outDir));
    assert.match(path.basename(filePath), /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.jsonl$/);
    const lines = readFileSync(filePath, "utf8").trim().split("\n");
    const records = lines.map((l) => JSON.parse(l));
    assert.deepEqual(records, result.records);
    assert.deepEqual(
      records.map((r) => [r.seq, r.outcome]),
      [
        [1, "segment"],
        [2, "segment"],
        [3, "segment"],
        [3, "segment"],
        [4, "no_segment"]
      ]
    );
    for (const r of records) {
      const cue = plan[r.seq - 1];
      assert.equal(r.cue, cue.kind);
      assert.equal(r.cueLabel, cue.label);
      assert.equal(r.round, 1);
      assert.match(r.at, /^\d{4}-\d{2}-\d{2}T/);
    }
    const [first, second] = records;
    assert.equal(first.text, "うん");
    assert.equal(first.chars, 2);
    assert.ok(Math.abs(first.durationMs - 480) <= 32, `区間の長さ（フレーム 32ms の粒度） ${first.durationMs}`);
    assert.equal(first.speech, 0.31);
    assert.equal(first.cough, 0.02);
    assert.equal(first.throatClearing, 0.44);
    assert.equal(first.topLabel, "Throat clearing");
    assert.equal(first.topProb, 0.44);
    assert.equal(second.text, "うーん");
    assert.ok(Math.abs(second.durationMs - 1200) <= 32, `区間の長さ ${second.durationMs}`);
    assert.equal(records[4].text, null);

    // 判定は全区間（文字数に関係なく）・5 秒にのばして。
    assert.deepEqual(h.fake.rec.taggedLengths, [80000, 80000, 80000, 80000]);

    // 音を書かない: 欄は決まったものだけ・値は文字・数・null だけ・ファイルは小さい。
    for (const r of records) {
      for (const [k, v] of Object.entries(r)) {
        assert.ok(RECORD_KEYS.has(k), `unexpected key ${k}`);
        assert.ok(v === null || ["string", "number"].includes(typeof v), `${k} は文字・数・null だけ`);
      }
    }
    assert.ok(statSync(filePath).size < 4096, "結果のファイルに音は入らない");
    // 結果の置き場には JSONL 1 つだけ（一時ファイル・音のファイルを作らない）。
    assert.deepEqual(readdirSync(h.outDir), [path.basename(filePath)]);

    // ターミナル: 説明・何回目か・まとめ・結果の場所。
    const text = h.output.join("");
    assert.match(text, /咳払いの聞き取り実験/);
    assert.match(text, /\[1\/4\]/);
    assert.match(text, /\[4\/4\]/);
    assert.match(text, /区間なし/);
    assert.match(text, /── まとめ ──/);
    assert.match(text, /Throat clearing\s+最小/);
    assert.ok(text.includes(filePath));
  } finally {
    h.cleanup();
  }
});

test("cough-experiment: 耳への設定は本番の既定のまま（区切り・VAD を上書きしない・設定ファイルの localStt を渡す・Zipformer）", async () => {
  /** @type {any} */
  let seen = null;
  const outDir = mkdtempSync(path.join(tmpdir(), "cough-experiment-"));
  try {
    const result = await runCoughExperiment({
      device: "audio=Mic",
      inputFormat: "dshow",
      localStt: { threads: 3, preRollMs: 150, silencePadMs: 250, hotwords: ["チャッピー"], hotwordsScore: 2 },
      modelsDir: "/fake-models",
      outDir,
      existsImpl: () => true,
      pipelineFactory: /** @type {any} */ (
        (/** @type {any} */ opts) => {
          seen = opts;
          return {
            start: async () => {
              throw new Error("stop here");
            },
            dispose: async () => {}
          };
        }
      ),
      write: () => {}
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.filePath, null);
    assert.ok(seen);
    assert.equal("segmenter" in seen, false, "区切りは本番の既定（EAR_DEFAULTS）のまま");
    assert.equal("vad" in seen, false, "VAD は本番の既定のまま");
    assert.equal("asr" in seen, false);
    assert.equal(seen.stt.engine, "zipformer");
    assert.equal(seen.stt.local.threads, 3);
    assert.equal(seen.stt.local.preRollMs, 150);
    assert.equal(seen.stt.local.silencePadMs, 250);
    assert.deepEqual(seen.stt.local.hotwords, ["チャッピー"]);
    assert.equal(seen.stt.local.modelsDir, "/fake-models");
    assert.equal(seen.stt.local.client.workerPath, COUGH_EXPERIMENT_WORKER_PATH);
    assert.deepEqual(seen.capture, { device: "audio=Mic", inputFormat: "dshow" });
    assert.ok(seen.transcriptBuffer, "実験の中だけの正本");
    assert.deepEqual(readdirSync(outDir), [], "耳が起きなければファイルを作らない");
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test("cough-experiment: モデルが無ければ取得の仕方を 1 行出して止まる（耳を作らない・ファイルを作らない）", async () => {
  const outDir = path.join(mkdtempSync(path.join(tmpdir(), "cough-experiment-")), "out");
  try {
    for (const [missing, expect] of /** @type {const} */ ([
      [".onnx", CED_TINY_FETCH_COMMAND],
      ["encoder-epoch-99-avg-1.int8.onnx", "fetch-local-stt-models.mjs"]
    ])) {
      /** @type {string[]} */
      const output = [];
      let built = 0;
      const result = await runCoughExperiment({
        device: "Mic",
        inputFormat: "dshow",
        modelsDir: "/fake-models",
        outDir,
        existsImpl: (p) => (missing === ".onnx" ? !(p.includes("ced-tiny") && p.endsWith(".onnx")) : !p.endsWith(missing)),
        pipelineFactory: /** @type {any} */ (
          () => {
            built += 1;
            throw new Error("should not build");
          }
        ),
        write: (t) => output.push(t)
      });
      assert.equal(result.exitCode, 1);
      assert.equal(built, 0);
      assert.equal(output.length, 1);
      assert.equal(output[0].trim().split("\n").length, 1, "1 行");
      assert.ok(output[0].includes(expect));
      assert.equal(existsSync(outDir), false);
    }
    // マイクが決まっていない（dshow）も 1 行で止まる。
    /** @type {string[]} */
    const output = [];
    const r = await runCoughExperiment({ device: null, inputFormat: "dshow", modelsDir: "/m", outDir, existsImpl: () => true, write: (t) => output.push(t) });
    assert.equal(r.exitCode, 1);
    assert.match(output.join(""), /--device/);
  } finally {
    rmSync(path.dirname(outDir), { recursive: true, force: true });
  }
});

test("cough-experiment: Ctrl+C（abort）でそれまでの分を残して終わる", { timeout: 30000 }, async () => {
  const h = setup();
  const controller = new AbortController();
  try {
    const write = (/** @type {string} */ t) => {
      h.output.push(t);
      const m = /^\n\[(\d+)\/(\d+)\]/.exec(t);
      if (!m) return;
      if (Number(m[1]) === 1) setTimeout(() => h.feed(utterance(480)), 5);
      if (Number(m[1]) === 2) setTimeout(() => controller.abort(), 20);
    };
    const result = await runCoughExperiment({
      device: "Mic",
      inputFormat: "dshow",
      modelsDir: "/fake-models",
      outDir: h.outDir,
      perKind: 10,
      rng: seededRng(3),
      timing: FAST_TIMING,
      existsImpl: () => true,
      forkImpl: h.fork.forkImpl,
      pipelineOptions: { captureFactory: h.capture.captureFactory, vadFactory: fakeVadFactory, segmenter: FAST_SEGMENTER },
      signal: controller.signal,
      write
    });
    assert.equal(result.aborted, true);
    assert.equal(result.exitCode, 0);
    const records = readFileSync(/** @type {string} */ (result.filePath), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(records.length, 1);
    assert.equal(records[0].seq, 1);
    assert.equal(records[0].outcome, "segment");
    assert.equal(h.capture.rec.disposed, true);
    const text = h.output.join("");
    assert.match(text, /中断した/);
    assert.match(text, /── まとめ ──/);
    assert.equal(/\[3\/40\]/.test(text), false, "中断のあとは合図を出さない");
  } finally {
    h.cleanup();
  }
});

test("cough-experiment: 始める前に待つ（waitForStart）・待っている間の Ctrl+C はファイルを作らずに終わる", async () => {
  const h = setup();
  const controller = new AbortController();
  try {
    const result = await runCoughExperiment({
      device: "Mic",
      inputFormat: "dshow",
      modelsDir: "/fake-models",
      outDir: h.outDir,
      existsImpl: () => true,
      forkImpl: h.fork.forkImpl,
      pipelineOptions: { captureFactory: h.capture.captureFactory, vadFactory: fakeVadFactory },
      signal: controller.signal,
      waitForStart: () => {
        setTimeout(() => controller.abort(), 10);
        return new Promise(() => {});
      },
      write: (t) => h.output.push(t)
    });
    assert.equal(result.aborted, true);
    assert.equal(result.filePath, null);
    assert.deepEqual(readdirSync(h.outDir), []);
    assert.match(h.output.join(""), /Enter で始める/);
    assert.equal(h.capture.rec.disposed, true);
  } finally {
    h.cleanup();
  }
});

test("cough-experiment: 引数・結果の置き場の既定（apps/soul/agent/cough-experiments）", () => {
  assert.deepEqual(parseCoughExperimentArgs(["--device", "Mic", "--per-kind", "2", "--seed", "5", "--out-dir", "/o", "--models-dir", "/m"]), {
    device: "Mic",
    perKind: 2,
    seed: 5,
    outDir: "/o",
    modelsDir: "/m"
  });
  assert.throws(() => parseCoughExperimentArgs(["--per-kind", "0"]), /positive/);
  assert.throws(() => parseCoughExperimentArgs(["--device"]), /missing value/);
  assert.throws(() => parseCoughExperimentArgs(["--bogus"]), /unknown argument/);
  assert.equal(path.basename(DEFAULT_COUGH_EXPERIMENT_OUT_DIR), "cough-experiments");
  assert.equal(path.basename(path.dirname(DEFAULT_COUGH_EXPERIMENT_OUT_DIR)), "agent");
  // .gitignore で直下の置き場だけを無視している。
  const gitignore = readFileSync(path.join(path.dirname(DEFAULT_COUGH_EXPERIMENT_OUT_DIR), ".gitignore"), "utf8");
  assert.match(gitignore, /^\/cough-experiments\/$/m);
});

test("cough-experiment: 実験の子が落ちたらそこで終わる（それまでの分は残す・終了コード 1）", { timeout: 30000 }, async () => {
  const h = setup();
  try {
    const crashingFork = /** @type {any} */ (
      (/** @type {string} */ modulePath, /** @type {string[]} */ args, /** @type {any} */ opts) => {
        const child = h.fork.forkImpl(modulePath, args, opts);
        const send = child.send;
        child.send = (/** @type {any} */ m) => {
          if (m && m.type === "transcribe") {
            setImmediate(() => child.emit("exit", 3, null));
            return true;
          }
          return send(m);
        };
        return child;
      }
    );
    const write = (/** @type {string} */ t) => {
      h.output.push(t);
      if (/^\n\[1\//.test(t)) setTimeout(() => h.feed(utterance(480)), 5);
    };
    const result = await runCoughExperiment({
      device: "Mic",
      inputFormat: "dshow",
      modelsDir: "/fake-models",
      outDir: h.outDir,
      perKind: 10,
      rng: seededRng(4),
      timing: FAST_TIMING,
      existsImpl: () => true,
      forkImpl: crashingFork,
      pipelineOptions: { captureFactory: h.capture.captureFactory, vadFactory: fakeVadFactory, segmenter: FAST_SEGMENTER },
      write
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.aborted, false);
    assert.match(h.output.join(""), /子プロセスが落ちた/);
    assert.match(h.output.join(""), /── まとめ ──/);
    assert.ok(result.filePath && existsSync(result.filePath));
    assert.equal(h.capture.rec.disposed, true);
  } finally {
    h.cleanup();
  }
});

test("cough-experiment: 本番の咳払いの落とし（段階 2）は実験では切る（上限 0・線 0・設定ファイルに書いてあっても）", async () => {
  /** @type {any} */
  let seen = null;
  const outDir = mkdtempSync(path.join(tmpdir(), "cough-experiment-"));
  try {
    await runCoughExperiment({
      device: "audio=Mic",
      inputFormat: "dshow",
      localStt: { threads: 2, coughMaxChars: 4, coughSpeechThreshold: 0.1 },
      modelsDir: "/fake-models",
      outDir,
      existsImpl: () => true,
      pipelineFactory: /** @type {any} */ (
        (/** @type {any} */ opts) => {
          seen = opts;
          return {
            start: async () => {
              throw new Error("stop here");
            },
            dispose: async () => {}
          };
        }
      ),
      write: () => {}
    });
    assert.ok(seen);
    assert.equal(seen.stt.local.coughMaxChars, 0, "内側の本番の中身に AudioTagging を作らせない");
    assert.equal(seen.stt.local.coughSpeechThreshold, 0, "親で落とさない（区間の記録は段階 1 のまま）");
    assert.equal(seen.stt.local.threads, 2);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
