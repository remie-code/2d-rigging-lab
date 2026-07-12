// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createWhisperClient,
  parseInferenceResponse,
  normalizeTranscript
} from "./whisper-client.mjs";

// ── parseInferenceResponse（純関数・fixture）────────────────────────────

test("parseInferenceResponse: {text} を取り出す（whisper-server response_format=json の形）", () => {
  assert.deepEqual(parseInferenceResponse({ text: " こんにちは、テストです。\n" }), {
    text: " こんにちは、テストです。\n"
  });
  assert.deepEqual(parseInferenceResponse({ text: "" }), { text: "" });
  // 余計なフィールドが付いても text だけ読む（前方互換）。
  assert.deepEqual(parseInferenceResponse({ text: "x", model: "kotoba" }), { text: "x" });
});

test("parseInferenceResponse: 構造不正は throw", () => {
  assert.throws(() => parseInferenceResponse(null), TypeError);
  assert.throws(() => parseInferenceResponse("text"), TypeError);
  assert.throws(() => parseInferenceResponse({}), TypeError);
  assert.throws(() => parseInferenceResponse({ text: 42 }), TypeError);
  assert.throws(() => parseInferenceResponse({ text: null }), TypeError);
});

// ── normalizeTranscript（純関数）────────────────────────────────────────

test("normalizeTranscript: 前後空白のみトリム（本文中はいじらない）", () => {
  assert.equal(normalizeTranscript(" こんにちは、テストです。\n"), "こんにちは、テストです。");
  assert.equal(normalizeTranscript("そのまま"), "そのまま");
  assert.equal(normalizeTranscript("  \n\t "), "");
  // 本文中の空白・句読点は S3 の領分なので保存する。
  assert.equal(normalizeTranscript(" あ い　う "), "あ い　う");
  assert.throws(() => normalizeTranscript(/** @type {any} */ (null)), TypeError);
});

// ── transcribe（fetchImpl 注入・実サーバ非依存）─────────────────────────

/** 成功レスポンスの Response 風スタブ。 */
function okResponse(json) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => json,
    text: async () => JSON.stringify(json)
  };
}

test("transcribe: /inference へ multipart POST（file=WAV バイト列・temperature・response_format）", async () => {
  /** @type {{ url: string; init: any } | null} */
  let captured = null;
  const client = createWhisperClient({
    baseUrl: "http://127.0.0.1:9999/",
    fetchImpl: /** @type {any} */ (
      async (url, init) => {
        captured = { url: String(url), init };
        return okResponse({ text: " 転写結果です。\n" });
      }
    )
  });

  const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4]); // "RIFF" + ダミー
  const result = await client.transcribe(wav);

  assert.ok(captured);
  assert.equal(captured.url, "http://127.0.0.1:9999/inference"); // 末尾スラッシュは正規化
  assert.equal(captured.init.method, "POST");
  assert.ok(captured.init.signal instanceof AbortSignal); // タイムアウト abort が配線されている

  const form = captured.init.body;
  assert.ok(form instanceof FormData);
  const file = /** @type {File} */ (form.get("file"));
  assert.ok(file instanceof Blob);
  assert.equal(file.name, "speech.wav");
  assert.equal(file.type, "audio/wav");
  const sent = new Uint8Array(await file.arrayBuffer());
  assert.deepEqual(Array.from(sent), Array.from(wav)); // WAV バイト列が無傷で載る
  assert.equal(form.get("temperature"), "0");
  assert.equal(form.get("response_format"), "json");

  // text はトリム済み・rawText はサーバ出力そのまま。
  assert.equal(result.text, "転写結果です。");
  assert.equal(result.rawText, " 転写結果です。\n");
});

test("transcribe: 非 200 はステータスと本文込みで throw", async () => {
  const client = createWhisperClient({
    baseUrl: "http://127.0.0.1:9999",
    fetchImpl: /** @type {any} */ (
      async () => ({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "failed to decode audio"
      })
    )
  });
  await assert.rejects(
    client.transcribe(new Uint8Array([1, 2])),
    /HTTP 500 Internal Server Error.*failed to decode audio/
  );
});

test("transcribe: 接続拒否（fetch reject）はそのまま伝播", async () => {
  const client = createWhisperClient({
    baseUrl: "http://127.0.0.1:9999",
    fetchImpl: /** @type {any} */ (
      async () => {
        throw new Error("fetch failed: ECONNREFUSED");
      }
    )
  });
  await assert.rejects(client.transcribe(new Uint8Array([1, 2])), /ECONNREFUSED/);
});

test("transcribe: タイムアウトで abort し、タイムアウトを理由に reject する", async () => {
  const client = createWhisperClient({
    baseUrl: "http://127.0.0.1:9999",
    timeoutMs: 5,
    fetchImpl: /** @type {any} */ (
      (url, init) =>
        new Promise((_resolve, reject) => {
          // 応答しないサーバ: abort されたら reason で reject（実 fetch の挙動を模す）。
          init.signal.addEventListener("abort", () => reject(init.signal.reason));
        })
    )
  });
  await assert.rejects(client.transcribe(new Uint8Array([1, 2])), /timed out after 5ms/);
});

test("transcribe: レスポンス構造不正（text 欠落）は throw", async () => {
  const client = createWhisperClient({
    baseUrl: "http://127.0.0.1:9999",
    fetchImpl: /** @type {any} */ (async () => okResponse({ transcription: "wrong shape" }))
  });
  await assert.rejects(client.transcribe(new Uint8Array([1, 2])), TypeError);
});

test("transcribe: wavBytes が Uint8Array でなければ throw（fetch は呼ばれない）", async () => {
  let fetchCalls = 0;
  const client = createWhisperClient({
    fetchImpl: /** @type {any} */ (
      async () => {
        fetchCalls += 1;
        return okResponse({ text: "x" });
      }
    )
  });
  await assert.rejects(client.transcribe(/** @type {any} */ ("not bytes")), TypeError);
  await assert.rejects(client.transcribe(/** @type {any} */ (null)), TypeError);
  assert.equal(fetchCalls, 0);
});

test("createWhisperClient: fetchImpl が関数でなければ構築時に throw", () => {
  assert.throws(
    () => createWhisperClient({ fetchImpl: /** @type {any} */ ("not a function") }),
    /no fetch implementation/
  );
});
