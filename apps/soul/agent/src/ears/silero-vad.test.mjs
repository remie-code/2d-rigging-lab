// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  createSileroVad,
  DEFAULT_SILERO_MODEL_PATH,
  SILERO_V5_INPUT_NAMES,
  SILERO_V5_OUTPUT_NAME,
  SILERO_V5_STATE_OUTPUT_NAME
} from "./silero-vad.mjs";
import { sinePcm, silencePcm } from "./fixtures-audio.mjs";
import { int16ToFloat32 } from "./pcm-framing.mjs";

// VAD ラッパ到達テスト（S2 Domain C・domain-a 続行残項目の回収）。
// ortImpl 注入の fake で契約（init/process/reset/dispose・フレーム長検査・出力名不一致の明示 throw）
// を実 ONNX 非依存で固定し、実モデル到達テストを 1 本だけ置く（合成 PCM のみ・実マイク不使用）。

/**
 * onnxruntime-node の差し替え fake。run に渡された feeds を記録し、指定した出力名で
 * 確率と新状態を返す（新状態は呼び出し回数で変わる決定論値 = 状態持ち回りを観測できる）。
 */
function makeFakeOrt({ outputName = SILERO_V5_OUTPUT_NAME, stateOutputName = SILERO_V5_STATE_OUTPUT_NAME, prob = 0.75 } = {}) {
  /** @type {any[]} */
  const runs = [];
  /** @type {any[]} */
  const creates = [];
  let released = false;
  let runCount = 0;
  class Tensor {
    constructor(type, data, dims) {
      this.type = type;
      this.data = data;
      this.dims = dims;
    }
  }
  const fake = {
    Tensor,
    InferenceSession: {
      async create(modelPath, sessionOptions) {
        creates.push({ modelPath, sessionOptions });
        return {
          modelPath,
          async run(feeds) {
            runs.push(feeds);
            runCount += 1;
            return {
              [outputName]: { data: Float32Array.from([prob]) },
              [stateOutputName]: { data: new Float32Array(2 * 1 * 128).fill(runCount) }
            };
          },
          async release() {
            released = true;
          }
        };
      }
    }
  };
  return { fake, runs, creates, isReleased: () => released };
}

function frameOf(length = 512, value = 0.1) {
  return new Float32Array(length).fill(value);
}

test("silero-vad: init 前の process は throw する", async () => {
  const vad = createSileroVad({ ortImpl: makeFakeOrt().fake });
  await assert.rejects(() => vad.process(frameOf()), /init\(\) must be awaited/);
});

test("silero-vad: init→process で v5 I/O 契約（64 文脈 + 512 = 576 入力）どおりの feeds を組み、確率を返す", async () => {
  const { fake, runs } = makeFakeOrt({ prob: 0.5 }); // float32 で正確に表せる値。
  const vad = createSileroVad({ ortImpl: fake, modelPath: "C:/fake/model.onnx" });
  await vad.init();
  const prob = await vad.process(frameOf(512, 0.2));
  assert.equal(prob, 0.5);
  assert.equal(runs.length, 1);
  const feeds = runs[0];
  // 入力名（v5 既定）と形状。
  const input = feeds[SILERO_V5_INPUT_NAMES.input];
  const state = feeds[SILERO_V5_INPUT_NAMES.state];
  const sr = feeds[SILERO_V5_INPUT_NAMES.sr];
  assert.ok(input && state && sr, "input/state/sr の 3 feeds が揃う");
  // v5 の入力は 64 文脈 + 512 フレーム = 576（512 単独では実音声で確率が壊れる——実測済み）。
  assert.deepEqual(input.dims, [1, 576]);
  assert.equal(input.type, "float32");
  // 初回の文脈（先頭 64）は全ゼロ、後続 512 はフレームそのもの。
  assert.ok([...input.data.subarray(0, 64)].every((v) => v === 0), "初回の入力文脈は全ゼロ");
  assert.ok([...input.data.subarray(64)].every((v) => Math.abs(v - 0.2) < 1e-6), "文脈の後にフレーム本体");
  assert.deepEqual(state.dims, [2, 1, 128]);
  assert.equal(sr.type, "int64");
  assert.equal(sr.data[0], 16000n);
  // 初期状態は全ゼロ。
  assert.ok([...state.data].every((v) => v === 0), "初回の再帰状態は全ゼロ");
});

test("silero-vad: 入力文脈（直前フレーム末尾 64 サンプル）を持ち回り、reset() でゼロに戻る", async () => {
  const { fake, runs } = makeFakeOrt();
  const vad = createSileroVad({ ortImpl: fake });
  await vad.init();
  await vad.process(frameOf(512, 0.25)); // 1 フレーム目（全サンプル 0.25）
  await vad.process(frameOf(512, 0.75)); // 2 フレーム目
  const input2 = runs[1][SILERO_V5_INPUT_NAMES.input];
  assert.ok(
    [...input2.data.subarray(0, 64)].every((v) => Math.abs(v - 0.25) < 1e-6),
    "2 フレーム目の入力文脈 = 1 フレーム目の末尾 64 サンプル"
  );
  vad.reset();
  await vad.process(frameOf(512, 0.5));
  const input3 = runs[2][SILERO_V5_INPUT_NAMES.input];
  assert.ok([...input3.data.subarray(0, 64)].every((v) => v === 0), "reset 後の入力文脈は全ゼロ");
});

test("silero-vad: セッションは既定で 1 スレッド（アイドル CPU スピン対策・上書き可能）", async () => {
  const one = makeFakeOrt();
  const vad = createSileroVad({ ortImpl: one.fake });
  await vad.init();
  assert.deepEqual(one.creates[0].sessionOptions, { intraOpNumThreads: 1 });
  const two = makeFakeOrt();
  const vad2 = createSileroVad({ ortImpl: two.fake, sessionOptions: { intraOpNumThreads: 4 } });
  await vad2.init();
  assert.deepEqual(two.creates[0].sessionOptions, { intraOpNumThreads: 4 });
});

test("silero-vad: 再帰状態を持ち回り、reset() でゼロに戻る", async () => {
  const { fake, runs } = makeFakeOrt();
  const vad = createSileroVad({ ortImpl: fake });
  await vad.init();
  await vad.process(frameOf()); // 1 回目 → 新状態 = 全 1
  await vad.process(frameOf()); // 2 回目の feeds には 1 回目の新状態が入る
  const state2 = runs[1][SILERO_V5_INPUT_NAMES.state];
  assert.ok([...state2.data].every((v) => v === 1), "2 回目の状態 feed = 1 回目の出力 stateN");
  vad.reset();
  await vad.process(frameOf());
  const state3 = runs[2][SILERO_V5_INPUT_NAMES.state];
  assert.ok([...state3.data].every((v) => v === 0), "reset 後の状態 feed は全ゼロ");
});

test("silero-vad: フレーム長・型の検査（512 以外/非 Float32Array は TypeError）", async () => {
  const vad = createSileroVad({ ortImpl: makeFakeOrt().fake });
  await vad.init();
  await assert.rejects(() => vad.process(frameOf(511)), TypeError);
  await assert.rejects(() => vad.process(frameOf(1024)), TypeError);
  await assert.rejects(() => vad.process(/** @type {any} */ (new Int16Array(512))), TypeError);
  // frameSamples を変えれば整合する長さを受ける。
  const vad256 = createSileroVad({ ortImpl: makeFakeOrt().fake, frameSamples: 256, sampleRate: 8000 });
  await vad256.init();
  assert.equal(typeof (await vad256.process(frameOf(256))), "number");
});

test("silero-vad: 出力名不一致は NaN でなく明示 throw（note 7 回収）", async () => {
  // モデルが別名（例 v4 系や別 export）で出力してきた場合を fake で再現。
  const { fake } = makeFakeOrt({ outputName: "probs", stateOutputName: "hn" });
  const vad = createSileroVad({ ortImpl: fake });
  await vad.init();
  await assert.rejects(
    () => vad.process(frameOf()),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /outputs "output"\/"stateN" not found/);
      assert.match(error.message, /actual outputs: probs, hn/);
      return true;
    }
  );
  // 逆に outputName/stateOutputName を上書きすれば同じモデルで通る。
  const vad2 = createSileroVad({ ortImpl: fake, outputName: "probs", stateOutputName: "hn" });
  await vad2.init();
  assert.equal(await vad2.process(frameOf()), 0.75);
});

test("silero-vad: dispose でセッションを解放し、以後の process は throw", async () => {
  const { fake, isReleased } = makeFakeOrt();
  const vad = createSileroVad({ ortImpl: fake });
  await vad.init();
  await vad.process(frameOf());
  await vad.dispose();
  assert.equal(isReleased(), true);
  await assert.rejects(() => vad.process(frameOf()), /init\(\) must be awaited/);
  await vad.dispose(); // 冪等
});

// ── 実モデル到達テスト（実 onnx + 合成 PCM のみ・実マイク不使用）───────────────
// vendor/models/silero_vad.onnx は非コミット配置（choke point で配置済みの環境事実）。
// 未配置の環境ではスキップする（機械ゲートを環境非依存に保つ）。

test("silero-vad: 実モデル到達（合成 PCM → 有限確率 [0,1]・無音は低確率・dispose でハングしない）", { timeout: 60000 }, async (t) => {
  if (!existsSync(DEFAULT_SILERO_MODEL_PATH)) {
    t.skip(`model not found: ${DEFAULT_SILERO_MODEL_PATH}`);
    return;
  }
  const vad = createSileroVad();
  await vad.init();
  try {
    // 無音 512 サンプル × 4 フレーム。
    const silence = int16ToFloat32(silencePcm({ durationMs: 128 }));
    let maxSilenceProb = 0;
    for (let i = 0; i < 4; i += 1) {
      const p = await vad.process(silence.subarray(i * 512, (i + 1) * 512).slice());
      assert.ok(Number.isFinite(p) && p >= 0 && p <= 1, `silence prob in [0,1]; got ${p}`);
      maxSilenceProb = Math.max(maxSilenceProb, p);
    }
    // 実モデルの無音確率は極小（レビュー実測 ≈0.0006）。閾値 0.5 を大きく下回ることだけ固定。
    assert.ok(maxSilenceProb < 0.3, `silence prob should stay low; got ${maxSilenceProb}`);
    // 正弦波（非音声）も有限 [0,1] を返す（値の高低はモデルの領分なので固定しない）。
    vad.reset();
    const sine = int16ToFloat32(sinePcm({ freq: 220, durationMs: 64 }));
    const p = await vad.process(sine.subarray(0, 512).slice());
    assert.ok(Number.isFinite(p) && p >= 0 && p <= 1, `sine prob in [0,1]; got ${p}`);
  } finally {
    await vad.dispose();
  }
});
