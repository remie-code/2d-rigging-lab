// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeAudioCtx,
  createWhisperInference,
  DEFAULT_AUDIO_CTX_OPTIONS,
  DEFAULT_WHISPER_PROMPT,
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

// wave-plan §2 裁定B / inventory §B-1・B-2: コーディ語彙登録（Whisper initial prompt）。
// prompt はリクエスト毎の form field のみに乗る——転写バッファ/セグメンタ/VAD を一切通らない
// （正本の形は不変・戻り値はサーバ応答のテキストのみ由来）ことをここで固定する。

test("whisper-inference: options.prompt 省略時は DEFAULT_WHISPER_PROMPT が常時注入される", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "こんにちは" }) };
    }
  );
  const inference = createWhisperInference({ fetchImpl });
  await inference.transcribe(Uint8Array.from([1, 2, 3]));
  assert.equal(calls[0].init.body.get("prompt"), DEFAULT_WHISPER_PROMPT);
});

test("whisper-inference: options.prompt にカスタム文字列を渡すとそれが form に乗る", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "こんにちは" }) };
    }
  );
  const inference = createWhisperInference({ fetchImpl, prompt: "カスタム刷り込み文" });
  await inference.transcribe(Uint8Array.from([1, 2, 3]));
  assert.equal(calls[0].init.body.get("prompt"), "カスタム刷り込み文");
});

test("whisper-inference: options.prompt に空文字を明示指定すると prompt field は不送出", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "こんにちは" }) };
    }
  );
  const inference = createWhisperInference({ fetchImpl, prompt: "" });
  await inference.transcribe(Uint8Array.from([1, 2, 3]));
  assert.equal(calls[0].init.body.get("prompt"), null);
});

test("whisper-inference: promptProvider は推論器を作り直さず各 transcribe 時点で再評価する", async () => {
  /** @type {any[]} */
  const calls = [];
  let activePrompt = "こーでぃー、コーディ。";
  let providerCalls = 0;
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "サーバ応答" }) };
    }
  );
  const inference = createWhisperInference({
    fetchImpl,
    promptProvider: () => {
      providerCalls += 1;
      return activePrompt;
    }
  });
  const wav = Uint8Array.from([1, 2]);

  await inference.transcribe(wav);
  activePrompt = "ちゃっぴー、チャッピー。";
  await inference.transcribe(wav);

  assert.equal(providerCalls, 2);
  assert.equal(calls[0].init.body.get("prompt"), "こーでぃー、コーディ。");
  assert.equal(calls[1].init.body.get("prompt"), "ちゃっぴー、チャッピー。");
});

test("whisper-inference: promptProvider が未定義/非関数なら既定 Cody prompt に戻る", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "応答" }) };
    }
  );
  const inference = createWhisperInference({ fetchImpl, promptProvider: /** @type {any} */ ("not a getter") });
  await inference.transcribe(Uint8Array.from([1]));
  assert.equal(calls[0].init.body.get("prompt"), DEFAULT_WHISPER_PROMPT);
});

test("whisper-inference: promptProvider の非文字列結果は literal options.prompt へフォールバックする", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "応答" }) };
    }
  );
  const inference = createWhisperInference({
    fetchImpl,
    prompt: "固定 prompt",
    promptProvider: () => /** @type {any} */ (undefined)
  });
  await inference.transcribe(Uint8Array.from([1]));
  assert.equal(calls[0].init.body.get("prompt"), "固定 prompt");
});

test("whisper-inference: prompt 注入は転写正本を汚さない（返り値はサーバ応答のテキストのみ由来）", async () => {
  // fake サーバ応答のテキストに DEFAULT_WHISPER_PROMPT の断片を意図的に含めない・
  // prompt そのものとは無関係な文字列を返すことで「返り値 = サーバ応答由来のみ」を固定する。
  const fetchImpl = /** @type {any} */ (
    async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ text: " 今日の天気は晴れです\n" })
    })
  );
  const inference = createWhisperInference({ fetchImpl }); // prompt 省略 = 既定注入
  const result = await inference.transcribe(Uint8Array.from([9, 9]));
  assert.equal(result.rawText, " 今日の天気は晴れです\n");
  assert.equal(result.text, "今日の天気は晴れです");
  // prompt 文字列（「コーディ」等）が転写結果に紛れ込んでいないことを確認（正本不変の直接証拠）。
  assert.ok(!result.text.includes("コーディ"));
  assert.ok(!result.rawText.includes("コーディ"));
});

test("whisper-inference: audio_ctx 省略時の既存挙動は prompt 追加後も無退行（prompt に非干渉）", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (
    async (url, init) => {
      calls.push({ url, init });
      return { ok: true, status: 200, statusText: "OK", json: async () => ({ text: "こんにちは" }) };
    }
  );
  const inference = createWhisperInference({ fetchImpl });
  await inference.transcribe(Uint8Array.from([1, 2, 3])); // audioCtx 省略
  assert.equal(calls[0].init.body.get("audio_ctx"), null); // 既存アサート（:57-58 相当）維持
  assert.equal(calls[0].init.body.get("prompt"), DEFAULT_WHISPER_PROMPT); // prompt は常時注入
});
