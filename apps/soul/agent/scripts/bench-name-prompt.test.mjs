// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  containsNameVariant,
  scoreNameHitRate,
  summarizeSweep,
  synthesizeVariants,
  inference,
  runSweep,
  NAME_MATCH_VARIANTS_V0,
  PARAM_VARIATIONS_V0,
  NAMED_SENTENCES_V0,
  UNNAMED_SENTENCES_V0
} from "./bench-name-prompt.mjs";

// bench-name-prompt.mjs のスコアリング純関数 + スイープ中核ロジックの機械テスト
// （wave-plan §3 Domain B・実ネット/実マイク/実 whisper-server/実 TTS 一切不使用）。
// このスクリプト自体（main()）は import しただけでは走らない（direct execution ガード）ため
// node:test から安全に import できる。

test("containsNameVariant: 揺れ集合のいずれかが部分文字列として含まれれば true", () => {
  assert.equal(containsNameVariant("コーディ、これ見て"), true);
  assert.equal(containsNameVariant("コーディーどう思う"), true);
  assert.equal(containsNameVariant("コーティ聞いてる?"), true);
  assert.equal(containsNameVariant("こーでぃーおはよう"), true);
  assert.equal(containsNameVariant("今日はいい天気ですね"), false);
  assert.equal(containsNameVariant("コーピーしといて"), false); // 見送り表記（fire-scheduler と同じ精度方針）
  assert.equal(containsNameVariant(123), false); // 非文字列は false（throw しない）
});

test("containsNameVariant: 揺れ集合を明示指定すればそちらのみで照合する", () => {
  assert.equal(containsNameVariant("カスタム名", ["カスタム名"]), true);
  assert.equal(containsNameVariant("コーディ", ["カスタム名"]), false);
});

test("scoreNameHitRate: ヒット数/率を集計する（空配列は rate=0・非配列は throw）", () => {
  assert.deepEqual(scoreNameHitRate([]), { total: 0, hits: 0, rate: 0 });
  assert.deepEqual(scoreNameHitRate(["コーディ", "今日はいい天気"]), { total: 2, hits: 1, rate: 0.5 });
  assert.deepEqual(scoreNameHitRate(["コーディ", "コーディー"]), { total: 2, hits: 2, rate: 1 });
  assert.throws(() => scoreNameHitRate(/** @type {any} */ ("not array")), TypeError);
});

test("summarizeSweep: 名前正答率/幻聴混入率を prompt 有無で対比する形に組む", () => {
  const summary = summarizeSweep({
    named: { withPrompt: ["コーディこれ見て", "コーディー"], withoutPrompt: ["これ見て", "コーディー"] },
    unnamed: { withPrompt: ["コーディさんこんにちは"], withoutPrompt: ["こんにちは"] }
  });
  assert.deepEqual(summary.nameAccuracy.withPrompt, { total: 2, hits: 2, rate: 1 });
  assert.deepEqual(summary.nameAccuracy.withoutPrompt, { total: 2, hits: 1, rate: 0.5 });
  assert.deepEqual(summary.hallucination.withPrompt, { total: 1, hits: 1, rate: 1 }); // 幻聴混入
  assert.deepEqual(summary.hallucination.withoutPrompt, { total: 1, hits: 0, rate: 0 }); // 幻聴なし
  assert.throws(() => summarizeSweep(/** @type {any} */ (null)), TypeError);
});

test("inference: prompt/audio_ctx フィールドを form に積む（fake fetch・実ネット不使用）", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "テスト" }) };
    }
  );
  const text = await inference("http://127.0.0.1:9999", Uint8Array.from([1, 2, 3]), {
    prompt: "刷り込み文",
    requestAc: 300,
    fetchImpl
  });
  assert.equal(text, "テスト");
  assert.equal(calls[0].url, "http://127.0.0.1:9999/inference");
  const form = calls[0].init.body;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("prompt"), "刷り込み文");
  assert.equal(form.get("audio_ctx"), "300");
});

test("inference: prompt/audio_ctx 省略時は各フィールド不送出（fake fetch）", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "x" }) };
    }
  );
  await inference("http://127.0.0.1:1", Uint8Array.from([1]), { fetchImpl });
  assert.equal(calls[0].init.body.get("prompt"), null);
  assert.equal(calls[0].init.body.get("audio_ctx"), null);
});

test("inference: 非 200 は本文込み throw", async () => {
  const fetchImpl = /** @type {any} */ (
    async () => ({ ok: false, status: 500, statusText: "Internal Server Error", text: async () => "boom" })
  );
  await assert.rejects(
    () => inference("http://127.0.0.1:1", Uint8Array.from([1]), { fetchImpl }),
    /HTTP 500.*boom/s
  );
});

test("synthesizeVariants: synthetic=true は実 TTS 不使用で 1 本の WAV を返す", async () => {
  const wavs = await synthesizeVariants("dummy", { synthetic: true });
  assert.equal(wavs.length, 1);
  assert.ok(wavs[0] instanceof Uint8Array);
});

test("synthesizeVariants: fake ttsClientFactory でパラメータ振りの数だけ WAV を合成する", async () => {
  /** @type {any[]} */
  const queries = [];
  const ttsClientFactory = () => ({
    audioQuery: async (text) => ({ text, accent_phrases: [] }),
    synthesis: async (query) => {
      queries.push(query);
      return new Uint8Array([queries.length]);
    }
  });
  const wavs = await synthesizeVariants("コーディ、これ見て", {}, { ttsClientFactory });
  assert.equal(wavs.length, PARAM_VARIATIONS_V0.length);
  assert.equal(queries.length, PARAM_VARIATIONS_V0.length);
  assert.equal(queries[0].outputSamplingRate, 16000);
  assert.equal(queries[0].outputStereo, false);
  assert.equal(queries[0].speedScale, PARAM_VARIATIONS_V0[0].speedScale);
  assert.equal(queries[0].pitchScale, PARAM_VARIATIONS_V0[0].pitchScale);
  assert.equal(queries[0].intonationScale, PARAM_VARIATIONS_V0[0].intonationScale);
});

test("runSweep: fake synthesize/inference の注入で prompt 有無の対比が組める構造（実ネット/実TTS不使用）", async () => {
  const fakeSynthesize = /** @type {any} */ (async (text) => [new TextEncoder().encode(text)]);
  const fakeInference = /** @type {any} */ (
    async (_baseUrl, wav, opts) => {
      const text = new TextDecoder().decode(wav);
      const hasPrompt = Boolean(opts?.prompt);
      if (text === "コーディ、これ見て") {
        // 名前入り音声: prompt 有のときだけ正しく名前を拾う（正答率の対比を模擬）。
        return hasPrompt ? "コーディこれ見て" : "これ見て";
      }
      // 名前なし音声: prompt 有のときに幻聴混入する（幻聴混入率の対比を模擬）。
      return hasPrompt ? "コーディさんこんにちは" : "こんにちは";
    }
  );

  const summary = await runSweep({
    baseUrl: "http://fake.invalid",
    namedSentences: ["コーディ、これ見て"],
    unnamedSentences: ["おはよう"],
    args: { runs: 1, paramVariations: [PARAM_VARIATIONS_V0[0]] },
    synthesizeImpl: fakeSynthesize,
    inferenceImpl: fakeInference
  });

  assert.equal(summary.nameAccuracy.withPrompt.rate, 1);
  assert.equal(summary.nameAccuracy.withoutPrompt.rate, 0);
  assert.equal(summary.hallucination.withPrompt.rate, 1); // 幻聴混入率（prompt 有）
  assert.equal(summary.hallucination.withoutPrompt.rate, 0); // 幻聴混入率（prompt 無）
});

test("runSweep: baseUrl 欠落は throw（引数契約）", async () => {
  await assert.rejects(() => runSweep(/** @type {any} */ ({})), TypeError);
});

test("runSweep: 既定素材（NAMED_SENTENCES_V0/UNNAMED_SENTENCES_V0）が空でないことの前提確認", () => {
  assert.ok(NAMED_SENTENCES_V0.length > 0);
  assert.ok(UNNAMED_SENTENCES_V0.length > 0);
  assert.ok(NAME_MATCH_VARIANTS_V0.length > 0);
  assert.ok(PARAM_VARIATIONS_V0.length > 0);
});
