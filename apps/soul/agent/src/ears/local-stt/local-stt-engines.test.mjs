// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  LOCAL_STT_DEFAULTS,
  LOCAL_STT_ENGINES,
  LOCAL_STT_MODEL_LAYOUT,
  DEFAULT_LOCAL_STT_MODELS_DIR,
  isLocalSttEngine,
  normalizeLocalSttSettings,
  normalizeHotwords,
  resolveLocalSttModel,
  checkLocalSttModel,
  hotwordsToTokenPhrases,
  parseTokensText,
  buildRecognizerConfig,
  padWithSilence
} from "./local-stt-engines.mjs";

// ローカルの文字起こしの純関数（設定の正規化・モデルの場所と存在確認・hotwords の token 化・認識器の設定・無音の余白）。

test("local-stt-engines: 語彙と既定（スレッド 2・前 200ms・無音 300ms・hotwords 2 語）", () => {
  assert.deepEqual([...LOCAL_STT_ENGINES], ["parakeet", "zipformer"]);
  assert.equal(isLocalSttEngine("zipformer"), true);
  assert.equal(isLocalSttEngine("whisper"), false);
  assert.equal(isLocalSttEngine(undefined), false);
  assert.deepEqual(normalizeLocalSttSettings(null), {
    threads: 2,
    preRollMs: 200,
    silencePadMs: 300,
    hotwords: ["チャッピー", "コーディ"],
    hotwordsScore: 1.5
  });
  assert.deepEqual([...LOCAL_STT_DEFAULTS.hotwords], ["チャッピー", "コーディ"]);
});

test("local-stt-engines: 範囲外・型違いは既定に戻す（範囲内はそのまま）", () => {
  assert.deepEqual(normalizeLocalSttSettings({ threads: 4, preRollMs: 0, silencePadMs: 1000, hotwords: [], hotwordsScore: 3 }), {
    threads: 4,
    preRollMs: 0,
    silencePadMs: 1000,
    hotwords: [],
    hotwordsScore: 3
  });
  const bad = normalizeLocalSttSettings({ threads: 0, preRollMs: -1, silencePadMs: 1001, hotwords: "チャッピー" });
  assert.deepEqual(bad, { threads: 2, preRollMs: 200, silencePadMs: 300, hotwords: ["チャッピー", "コーディ"], hotwordsScore: 1.5 });
  // hotwords の強さ（localSttHotwordsScore）: 0.1〜10・範囲外と数でない値は既定 1.5。
  assert.equal(normalizeLocalSttSettings({ hotwordsScore: 0.1 }).hotwordsScore, 0.1);
  assert.equal(normalizeLocalSttSettings({ hotwordsScore: 10 }).hotwordsScore, 10);
  assert.equal(normalizeLocalSttSettings({ hotwordsScore: 0 }).hotwordsScore, 1.5);
  assert.equal(normalizeLocalSttSettings({ hotwordsScore: 10.5 }).hotwordsScore, 1.5);
  assert.equal(normalizeLocalSttSettings({ hotwordsScore: "2" }).hotwordsScore, 1.5);
  assert.equal(normalizeLocalSttSettings({ threads: 2.5 }).threads, 2);
  assert.equal(normalizeLocalSttSettings({ threads: 17 }).threads, 2);
  assert.equal(normalizeLocalSttSettings({ threads: "4" }).threads, 2);
  assert.equal(normalizeLocalSttSettings({ preRollMs: Number.NaN }).preRollMs, 200);
});

test("local-stt-engines: hotwords の正規化（空白を落とす・重複なし・使える語が無い非空配列は既定）", () => {
  assert.deepEqual(normalizeHotwords([" チャッピー ", "チャッピー", "", 3, "ラビ"]), ["チャッピー", "ラビ"]);
  assert.deepEqual(normalizeHotwords(["", 1]), ["チャッピー", "コーディ"]);
  assert.deepEqual(normalizeHotwords([]), []);
  assert.deepEqual(normalizeHotwords(["あ".repeat(33)]), ["チャッピー", "コーディ"]);
  assert.equal(normalizeHotwords(Array.from({ length: 80 }, (_, i) => `語${i}`)).length, 50);
});

test("local-stt-engines: モデルの場所（既定は agent/vendor/models）", () => {
  assert.equal(path.basename(DEFAULT_LOCAL_STT_MODELS_DIR), "models");
  assert.equal(path.basename(path.dirname(DEFAULT_LOCAL_STT_MODELS_DIR)), "vendor");
  const z = resolveLocalSttModel("zipformer", { modelsDir: "/m" });
  assert.equal(z.dir, path.join("/m", "zipformer-ja-reazonspeech-2024-08-01-int8"));
  assert.deepEqual(Object.keys(z.files).sort(), ["decoder", "encoder", "joiner", "tokens"]);
  assert.equal(path.basename(z.files.encoder), "encoder-epoch-99-avg-1.int8.onnx");
  const p = resolveLocalSttModel("parakeet", { modelsDir: "/m" });
  assert.deepEqual(Object.keys(p.files).sort(), ["model", "tokens"]);
  assert.equal(p.dir, path.join("/m", LOCAL_STT_MODEL_LAYOUT.parakeet.dir));
  assert.throws(() => resolveLocalSttModel(/** @type {any} */ ("whisper")), RangeError);
});

test("local-stt-engines: モデルが無ければ理由つきで ok:false（揃っていれば ok:true・0 byte は無い扱い）", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "local-stt-models-"));
  try {
    const missing = checkLocalSttModel("parakeet", { modelsDir: dir });
    assert.equal(missing.ok, false);
    assert.match(/** @type {any} */ (missing).reason, /Parakeet のモデルが見つからない/);
    assert.match(/** @type {any} */ (missing).reason, /model\.int8\.onnx/);
    assert.match(/** @type {any} */ (missing).reason, /fetch-local-stt-models\.mjs/);

    const pdir = path.join(dir, LOCAL_STT_MODEL_LAYOUT.parakeet.dir);
    mkdirSync(pdir, { recursive: true });
    writeFileSync(path.join(pdir, "model.int8.onnx"), "x");
    writeFileSync(path.join(pdir, "tokens.txt"), ""); // 0 byte は揃っていない。
    const partial = checkLocalSttModel("parakeet", { modelsDir: dir });
    assert.equal(partial.ok, false);
    assert.deepEqual(/** @type {any} */ (partial).missing.map((/** @type {string} */ p) => path.basename(p)), ["tokens.txt"]);
    writeFileSync(path.join(pdir, "tokens.txt"), "<unk> 0\n");
    assert.deepEqual(checkLocalSttModel("parakeet", { modelsDir: dir }), { ok: true });

    // 注入した存在確認でも同じ（zipformer は 4 ファイル）。
    assert.deepEqual(checkLocalSttModel("zipformer", { existsImpl: () => true }), { ok: true });
    const z = checkLocalSttModel("zipformer", { modelsDir: dir, existsImpl: (p) => !p.endsWith("joiner-epoch-99-avg-1.int8.onnx") });
    assert.equal(z.ok, false);
    assert.match(/** @type {any} */ (z).reason, /^Zipformer のモデルが見つからない/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("local-stt-engines: hotwords → token 列（文字単位・空白区切り・表せない語は落とす）", () => {
  const tokens = parseTokensText("<blk> 0\nチ\t1\nャ 2\nッ 3\nピ 4\nー 5\nコ 6\nデ 7\nィ 8\n▁ 9\n");
  assert.equal(tokens.has("チ"), true);
  assert.equal(tokens.has("<blk>"), true);
  const r = hotwordsToTokenPhrases(["チャッピー", "コーディ", "ラビ"], tokens);
  assert.deepEqual(r.phrases, ["チ ャ ッ ピ ー", "コ ー デ ィ"]);
  assert.deepEqual(r.used, ["チャッピー", "コーディ"]);
  assert.deepEqual(r.dropped, ["ラビ"]);
});

test("local-stt-engines: 実物の Zipformer の tokens.txt で既定の hotwords が表せる（モデルがあるときだけ）", (t) => {
  const { files } = resolveLocalSttModel("zipformer");
  if (!existsSync(files.tokens)) {
    t.skip("zipformer の tokens.txt が無い（vendor/models 未配置）");
    return;
  }
  const r = hotwordsToTokenPhrases([...LOCAL_STT_DEFAULTS.hotwords], parseTokensText(readFileSync(files.tokens, "utf8")));
  assert.deepEqual(r.dropped, []);
  assert.deepEqual(r.phrases, ["チ ャ ッ ピ ー", "コ ー デ ィ"]);
});

test("local-stt-engines: 認識器の設定（Parakeet は nemoCtc・Zipformer は transducer、hotwords ありは modified_beam_search）", () => {
  const p = buildRecognizerConfig("parakeet", { model: "m.onnx", tokens: "t.txt" }, { threads: 2 });
  assert.deepEqual(p, {
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: { nemoCtc: { model: "m.onnx" }, tokens: "t.txt", numThreads: 2, provider: "cpu", debug: 0 },
    decodingMethod: "greedy_search"
  });
  const files = { encoder: "e", decoder: "d", joiner: "j", tokens: "t" };
  const zg = buildRecognizerConfig("zipformer", files, { threads: 3, hotwordsEnabled: false });
  assert.equal(zg.decodingMethod, "greedy_search");
  assert.deepEqual(zg.modelConfig.transducer, { encoder: "e", decoder: "d", joiner: "j" });
  assert.equal(zg.modelConfig.numThreads, 3);
  assert.equal("hotwordsScore" in zg, false);
  const zb = buildRecognizerConfig("zipformer", files, { threads: 2, hotwordsEnabled: true });
  assert.equal(zb.decodingMethod, "modified_beam_search");
  assert.equal(zb.maxActivePaths, 4);
  assert.equal(zb.hotwordsScore, 1.5);
  assert.equal(buildRecognizerConfig("zipformer", files, { threads: 2, hotwordsEnabled: true, hotwordsScore: 4 }).hotwordsScore, 4);
  assert.throws(() => buildRecognizerConfig(/** @type {any} */ ("whisper"), files, { threads: 1 }), RangeError);
});

test("local-stt-engines: 作り物の無音を前後に足す（0ms は元のまま）", () => {
  const src = Int16Array.from([1, 2, 3]);
  assert.equal(padWithSilence(src, 0), src);
  const out = padWithSilence(src, 1, 2000); // 1ms @2kHz = 2 サンプル
  assert.deepEqual([...out], [0, 0, 1, 2, 3, 0, 0]);
  assert.equal(padWithSilence(new Int16Array(16000), 300).length, 16000 + 2 * 4800);
});
