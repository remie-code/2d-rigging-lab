// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeAudioCtx,
  createWhisperInference,
  DEFAULT_AUDIO_CTX_OPTIONS,
  WHISPER_FULL_AUDIO_CTX
} from "./whisper-inference.mjs";

// 動的 audio_ctx 推論呼び出しのテスト（S2 Domain C）。式は実測（experiments/s2-ears.md）を
// コードに固定したもの: ac = clamp(ceil(sec*50) + 96, 256, 1500)。

test("computeAudioCtx: 実測に基づく式（50tok/s + margin96・下限 256・上限 1500）", () => {
  assert.equal(computeAudioCtx(0), 256); // 下限
  assert.equal(computeAudioCtx(1700), 256); // 1.7s → 85+96=181 → 下限 256 に clamp
  assert.equal(computeAudioCtx(4400), 316); // 4.4s → 220+96
  assert.equal(computeAudioCtx(14600), 826); // 14.6s → 730+96
  assert.equal(computeAudioCtx(20060), 1099); // maxSpeech 20s + pad 相当
  assert.equal(computeAudioCtx(60000), WHISPER_FULL_AUDIO_CTX); // 上限 = 全窓
  assert.equal(computeAudioCtx(3000, { marginTokens: 0, minTokens: 1 }), 150); // オプション上書き
  assert.throws(() => computeAudioCtx(-1), TypeError);
  assert.throws(() => computeAudioCtx(NaN), TypeError);
  assert.equal(DEFAULT_AUDIO_CTX_OPTIONS.minTokens, 256);
});

test("whisper-inference: multipart に audio_ctx フィールドを積む（省略時は積まない）", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ text: " こんにちは\n" })
      };
    }
  );
  const inference = createWhisperInference({ baseUrl: "http://127.0.0.1:9999/", fetchImpl });
  const wav = Uint8Array.from([1, 2, 3, 4]);

  const withCtx = await inference.transcribe(wav, { audioCtx: 256 });
  assert.equal(withCtx.text, "こんにちは");
  assert.equal(withCtx.rawText, " こんにちは\n");
  assert.equal(calls[0].url, "http://127.0.0.1:9999/inference");
  const form = calls[0].init.body;
  assert.ok(form instanceof FormData);
  assert.equal(form.get("audio_ctx"), "256");
  assert.equal(form.get("temperature"), "0");
  assert.equal(form.get("response_format"), "json");
  const file = form.get("file");
  assert.deepEqual(new Uint8Array(await file.arrayBuffer()), wav);

  await inference.transcribe(wav); // audioCtx 省略 = 全窓（フィールド不送出）
  assert.equal(calls[1].init.body.get("audio_ctx"), null);

  await assert.rejects(() => inference.transcribe(wav, { audioCtx: 0 }), RangeError);
  await assert.rejects(() => inference.transcribe(/** @type {any} */ ([1]), {}), TypeError);
});

test("whisper-inference: 非 200 は本文込み throw・タイムアウトは本文読み取りも覆う", async () => {
  const failFetch = /** @type {any} */ (
    async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "boom",
      json: async () => ({})
    })
  );
  const failing = createWhisperInference({ fetchImpl: failFetch });
  await assert.rejects(() => failing.transcribe(new Uint8Array(2)), /HTTP 500.*boom/s);

  // ヘッダは返るが本文が永遠に返らないサーバ → タイムアウトで有界に reject
  // （whisper-client note 1 の「本文読み取りがタイマの外」をこのモジュールは構造で回収）。
  const hangingBodyFetch = /** @type {any} */ (
    async (_url, init) => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
        })
    })
  );
  const hanging = createWhisperInference({ fetchImpl: hangingBodyFetch, timeoutMs: 30 });
  await assert.rejects(() => hanging.transcribe(new Uint8Array(2)), /timed out after 30ms/);
});
