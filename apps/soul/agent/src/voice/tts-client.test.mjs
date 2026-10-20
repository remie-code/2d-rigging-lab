// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  flattenMoras,
  parseAudioQuery,
  createTtsClient,
  DEFAULT_SPEAKER_ID
} from "./tts-client.mjs";
import { GOLDEN_MORAS_KONNICHIWA } from "./fixtures.mjs";

/**
 * 実機構造を模した audio_query fixture（2026-07-12 実測形。fixtures.mjs GOLDEN と整合）。
 * 句読点「、」は AP0.moras 内に vowel="pau" で出る。両 AP とも pause_mora=null。
 */
function goldenAudioQuery() {
  return {
    accent_phrases: [
      {
        moras: [
          { text: "コ", vowel: "o", consonant_length: 0, vowel_length: 0 },
          { text: "ン", vowel: "N", consonant_length: null, vowel_length: 0 },
          { text: "ニ", vowel: "i", consonant_length: 0, vowel_length: 0 },
          { text: "チ", vowel: "i", consonant_length: 0, vowel_length: 0 },
          { text: "ワ", vowel: "a", consonant_length: 0, vowel_length: 0 },
          { text: ",", vowel: "pau", consonant_length: null, vowel_length: 0 }
        ],
        pause_mora: null
      },
      {
        moras: [
          { text: "テ", vowel: "e", consonant_length: 0, vowel_length: 0 },
          { text: "ス", vowel: "u", consonant_length: 0, vowel_length: 0 },
          { text: "ト", vowel: "o", consonant_length: 0, vowel_length: 0 },
          { text: "デ", vowel: "e", consonant_length: 0, vowel_length: 0 },
          { text: "ス", vowel: "u", consonant_length: 0, vowel_length: 0 }
        ],
        pause_mora: null
      }
    ],
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1
  };
}

test("flattenMoras 実機形の平坦化は GOLDEN と一致（11 要素・vowel 並び）", () => {
  const moras = flattenMoras(goldenAudioQuery());
  assert.equal(moras.length, 11);
  assert.deepEqual(
    moras.map((m) => m.vowel),
    GOLDEN_MORAS_KONNICHIWA.map((m) => m.vowel)
  );
  assert.deepEqual(
    moras.map((m) => m.vowel),
    ["o", "N", "i", "i", "a", "pau", "e", "u", "o", "e", "u"]
  );
});

test("flattenMoras は pause_mora が非 null なら当該フレーズ末尾に加える", () => {
  const query = {
    accent_phrases: [
      {
        moras: [{ text: "ア", vowel: "a" }],
        pause_mora: { text: "、", vowel: "pau" }
      },
      {
        moras: [{ text: "イ", vowel: "i" }],
        pause_mora: null
      }
    ],
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1
  };
  const moras = flattenMoras(query);
  assert.deepEqual(
    moras.map((m) => m.vowel),
    ["a", "pau", "i"]
  );
});

test("flattenMoras は構造不正で TypeError", () => {
  assert.throws(() => flattenMoras(null), TypeError);
  assert.throws(() => flattenMoras({}), TypeError);
  assert.throws(() => flattenMoras({ accent_phrases: [{}] }), TypeError);
});

test("parseAudioQuery は moras + pre/post を返す", () => {
  const parsed = parseAudioQuery(goldenAudioQuery());
  assert.equal(parsed.moras.length, 11);
  assert.equal(parsed.prePhonemeSec, 0.1);
  assert.equal(parsed.postPhonemeSec, 0.1);
});

test("parseAudioQuery は pre/post が数でないと TypeError", () => {
  const q = goldenAudioQuery();
  delete q.prePhonemeLength;
  assert.throws(() => parseAudioQuery(q), TypeError);
});

test("createTtsClient の既定 speaker は 888753760・baseUrl 末尾スラッシュ除去", () => {
  const client = createTtsClient({ baseUrl: "http://x:1/", fetchImpl: async () => {} });
  assert.equal(client.speaker, DEFAULT_SPEAKER_ID);
  assert.equal(client.baseUrl, "http://x:1");
});

test("audioQuery は正しい URL/method で叩き JSON を返す", async () => {
  let capturedUrl = null;
  let capturedInit = null;
  const fetchImpl = async (url, init) => {
    capturedUrl = url;
    capturedInit = init;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async json() {
        return { accent_phrases: [], prePhonemeLength: 0.1, postPhonemeLength: 0.1 };
      }
    };
  };
  const client = createTtsClient({
    baseUrl: "http://127.0.0.1:10101",
    speaker: 888753760,
    fetchImpl
  });
  const query = await client.audioQuery("こんにちは");
  assert.equal(capturedInit.method, "POST");
  assert.match(capturedUrl, /\/audio_query\?text=/);
  assert.match(capturedUrl, /speaker=888753760/);
  // text は URL エンコードされている（生の日本語ではない）。
  assert.ok(!capturedUrl.includes("こんにちは"));
  assert.deepEqual(query.accent_phrases, []);
});

test("audioQuery は空文字で TypeError（叩かない）", async () => {
  let called = false;
  const client = createTtsClient({
    fetchImpl: async () => {
      called = true;
      return { ok: true, async json() { return {}; } };
    }
  });
  await assert.rejects(() => client.audioQuery(""), TypeError);
  assert.equal(called, false);
});

test("synthesis は WAV を Uint8Array で返し、body に query JSON を載せる", async () => {
  let capturedInit = null;
  const wavBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
  const fetchImpl = async (_url, init) => {
    capturedInit = init;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async arrayBuffer() {
        return wavBytes.buffer;
      }
    };
  };
  const client = createTtsClient({ fetchImpl });
  const query = { accent_phrases: [], prePhonemeLength: 0.1 };
  const wav = await client.synthesis(query);
  assert.ok(wav instanceof Uint8Array);
  assert.deepEqual([...wav], [0x52, 0x49, 0x46, 0x46]);
  assert.deepEqual(JSON.parse(capturedInit.body), query);
});

test("audioQuery は非 200 をメッセージ付きで throw", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 422,
    statusText: "Unprocessable Entity",
    async text() {
      return "bad speaker";
    }
  });
  const client = createTtsClient({ fetchImpl });
  await assert.rejects(() => client.audioQuery("x"), /422.*bad speaker/s);
});

test("synthesis は非 200 をメッセージ付きで throw", async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 500,
    statusText: "Internal Server Error",
    async text() {
      return "engine down";
    }
  });
  const client = createTtsClient({ fetchImpl });
  await assert.rejects(() => client.synthesis({ a: 1 }), /500.*engine down/s);
});

test("audioQuery/synthesis は中止の合図（signal）を fetch へそのまま渡す・渡さなければ付けない", async () => {
  /** @type {any[]} */
  const inits = [];
  const fetchImpl = async (_url, init) => {
    inits.push(init);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      async json() { return { accent_phrases: [] }; },
      async arrayBuffer() { return new Uint8Array([1]).buffer; }
    };
  };
  const client = createTtsClient({ fetchImpl });
  const controller = new AbortController();
  await client.audioQuery("あ", { signal: controller.signal });
  await client.synthesis({ accent_phrases: [] }, { signal: controller.signal });
  await client.audioQuery("あ");
  assert.equal(inits[0].signal, controller.signal);
  assert.equal(inits[1].signal, controller.signal);
  assert.equal("signal" in inits[2], false);
});

test("accentPhrases（読みだけの口）: /accent_phrases を POST で叩き配列を返す・signal を渡す・空文字と非 200 は投げる", async () => {
  /** @type {any[]} */
  const calls = [];
  const phrases = [{ moras: [{ text: "ア", vowel: "a" }], pause_mora: null }];
  const fetchImpl = async (/** @type {string} */ url, /** @type {any} */ init) => {
    calls.push({ url, init });
    if (url.includes("speaker=7")) {
      return { ok: false, status: 500, statusText: "Internal Server Error", async text() { return "down"; } };
    }
    return { ok: true, status: 200, statusText: "OK", async json() { return phrases; } };
  };
  const client = createTtsClient({ baseUrl: "http://127.0.0.1:10101", speaker: 888753760, fetchImpl });
  const controller = new AbortController();
  const result = await client.accentPhrases("あいう", { signal: controller.signal });
  assert.deepEqual(result, phrases);
  assert.equal(calls[0].init.method, "POST");
  assert.match(calls[0].url, /^http:\/\/127\.0\.0\.1:10101\/accent_phrases\?text=/);
  assert.match(calls[0].url, /speaker=888753760/);
  assert.ok(!calls[0].url.includes("あいう"), "本文は URL エンコードされる");
  assert.equal(calls[0].init.signal, controller.signal);
  await assert.rejects(() => client.accentPhrases(""), TypeError);
  assert.equal(calls.length, 1, "空文字は叩かない");
  const failing = createTtsClient({ speaker: 7, fetchImpl });
  await assert.rejects(() => failing.accentPhrases("x"), /accent_phrases failed: HTTP 500.*down/s);
});
