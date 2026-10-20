// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createAivisVoiceEngine } from "./aivis-voice-engine.mjs";
import { buildSpeechTimeline, MAX_UTTERANCE_TIMELINE_LENGTH } from "../mora-timeline.mjs";
import { parseAudioQuery } from "../tts-client.mjs";
import { buildWavBytes, GOLDEN_KONNICHIWA_WAV_DURATION_SEC, AIVIS_BYTE_RATE } from "../fixtures.mjs";

// AivisSpeech の声の差し替え口。実 AivisSpeech は叩かない（fake tts）。旧 speak.test.mjs の
// prepareSpeech の検証（時間割・診断・上限超・失敗の code）をこの形に移したもの。

/** 実機形の audio_query（fixtures GOLDEN と整合・11 モーラ）。 */
function goldenAudioQuery() {
  return {
    accent_phrases: [
      {
        moras: [
          { text: "コ", vowel: "o" },
          { text: "ン", vowel: "N" },
          { text: "ニ", vowel: "i" },
          { text: "チ", vowel: "i" },
          { text: "ワ", vowel: "a" },
          { text: ",", vowel: "pau" }
        ],
        pause_mora: null
      },
      {
        moras: [
          { text: "テ", vowel: "e" },
          { text: "ス", vowel: "u" },
          { text: "ト", vowel: "o" },
          { text: "デ", vowel: "e" },
          { text: "ス", vowel: "u" }
        ],
        pause_mora: null
      }
    ],
    prePhonemeLength: 0.1,
    postPhonemeLength: 0.1
  };
}

/** GOLDEN の WAV 実長（1.5468s）を宣言し、先頭 6 byte だけ本体を持つ WAV。 */
function goldenWavBytes() {
  const dataBytes = Math.round(GOLDEN_KONNICHIWA_WAV_DURATION_SEC * AIVIS_BYTE_RATE);
  const header = buildWavBytes({ dataBytes });
  const bytes = new Uint8Array(header.byteLength + 6);
  bytes.set(header, 0);
  bytes.set([1, 2, 3, 4, 5, 6], header.byteLength);
  return bytes;
}

function fakeTts(order = [], wav = goldenWavBytes(), query = goldenAudioQuery()) {
  return {
    /** @type {any[]} */
    calls: [],
    async audioQuery(/** @type {string} */ _text, /** @type {any} */ options) {
      order.push("audioQuery");
      this.calls.push(options);
      return query;
    },
    async synthesis(/** @type {any} */ _q, /** @type {any} */ options) {
      order.push("synthesis");
      this.calls.push(options);
      return wav;
    }
  };
}

/** @param {AsyncIterable<any>} iterable */
async function collect(iterable) {
  const out = [];
  for await (const chunk of iterable) out.push(chunk);
  return out;
}

test("aivis engine: format → timeline → audio(PCM) → end を一度に出し、時間割は旧 prepareSpeech と同じ均等割り", async () => {
  const order = [];
  const engine = createAivisVoiceEngine({ tts: fakeTts(order) });
  const chunks = await collect(engine.synthesize("こんにちは、テストです"));
  assert.deepEqual(order, ["audioQuery", "synthesis"]);
  assert.deepEqual(chunks.map((c) => c.type), ["format", "timeline", "audio", "end"]);
  assert.deepEqual(chunks[0], { type: "format", sampleRate: 44100, channels: 1 });
  assert.deepEqual([...chunks[2].pcm], [1, 2, 3, 4, 5, 6], "WAV ヘッダを外した data の中身");
  const { moras, prePhonemeSec, postPhonemeSec } = parseAudioQuery(goldenAudioQuery());
  const expected = buildSpeechTimeline(moras, GOLDEN_KONNICHIWA_WAV_DURATION_SEC, prePhonemeSec, postPhonemeSec).timeline;
  assert.deepEqual(chunks[1].entries, expected);
  assert.equal(chunks[1].entries.length, 9);
  assert.equal(chunks[1].entries[0].timeMs, 100, "先頭無音 pre 0.1s 込みの通し値");
});

test("aivis engine: 本体のない WAV（data が空）は audio を出さない", async () => {
  const engine = createAivisVoiceEngine({ tts: fakeTts([], buildWavBytes({ dataBytes: 48000 })) });
  const chunks = await collect(engine.synthesize("あ"));
  assert.deepEqual(chunks.map((c) => c.type), ["format", "timeline", "end"]);
});

test("aivis engine: sConfig（母音別の開き）を時間割へ渡す", async () => {
  const engine = createAivisVoiceEngine({ tts: fakeTts(), sConfig: { vowelMap: { o: 0.2 } } });
  const chunks = await collect(engine.synthesize("こんにちは"));
  assert.equal(chunks[1].entries[0].vowel, "o");
  assert.equal(chunks[1].entries[0].s, 0.2);
});

test("aivis engine diagnostics: 旧 prepareSpeech と同じ名前・本文なしの counts だけ", async () => {
  const traces = [];
  const engine = createAivisVoiceEngine({ tts: fakeTts() });
  await collect(engine.synthesize("本文をログに残さない", { onTrace: (event, fields) => traces.push({ event, fields }) }));
  assert.deepEqual(traces.map((entry) => entry.event), [
    "tts.audio_query.started",
    "tts.audio_query.request_completed",
    "tts.audio_query.completed",
    "tts.synthesis.started",
    "tts.synthesis.request_completed",
    "tts.synthesis.completed",
    "speech.timeline.started",
    "speech.timeline.build_completed",
    "speech.timeline.built"
  ]);
  assert.equal(traces.find((entry) => entry.event === "speech.timeline.built").fields.timelineCount, 9);
  assert.ok(traces.every((entry) => !JSON.stringify(entry).includes("本文をログに残さない")));
});

test("aivis engine: 失敗は旧と同じ code / diagnosticStage で列の途中に投げる", async () => {
  const cases = [
    {
      tts: { async audioQuery() { throw new Error("x"); }, async synthesis() { return goldenWavBytes(); } },
      code: "tts_audio_query_failed",
      stage: "tts.audio_query"
    },
    {
      tts: { async audioQuery() { return {}; }, async synthesis() { return goldenWavBytes(); } },
      code: "tts_audio_query_invalid",
      stage: "tts.audio_query.parse"
    },
    {
      tts: { async audioQuery() { return goldenAudioQuery(); }, async synthesis() { throw new Error("x"); } },
      code: "tts_synthesis_failed",
      stage: "tts.synthesis"
    },
    {
      tts: { async audioQuery() { return goldenAudioQuery(); }, async synthesis() { return new Uint8Array([1, 2, 3]); } },
      code: "speech_wav_invalid",
      stage: "speech.wav.inspect"
    },
    {
      tts: {
        async audioQuery() {
          return { accent_phrases: [{ moras: Array.from({ length: MAX_UTTERANCE_TIMELINE_LENGTH + 1 }, () => ({ text: "ア", vowel: "a" })), pause_mora: null }], prePhonemeLength: 0.1, postPhonemeLength: 0.1 };
        },
        async synthesis() { return goldenWavBytes(); }
      },
      code: "timeline_build_failed",
      stage: "speech.timeline.build"
    },
    {
      tts: { async audioQuery() { return goldenAudioQuery(); }, async synthesis() { return buildWavBytes({ dataBytes: 88200, bitsPerSample: 8 }); } },
      code: "speech_wav_invalid",
      stage: "speech.wav.inspect"
    }
  ];
  for (const c of cases) {
    const engine = createAivisVoiceEngine({ tts: /** @type {any} */ (c.tts) });
    const seen = [];
    await assert.rejects(
      async () => {
        for await (const chunk of engine.synthesize("あ")) seen.push(chunk.type);
      },
      (/** @type {any} */ error) => error.code === c.code && error.diagnosticStage === c.stage
    );
    assert.deepEqual(seen, [], `${c.code}: 何も出さずに投げる`);
  }
});

test("aivis engine: signal を fetch 層へ渡し、中止済みなら AbortError で終わる", async () => {
  const tts = fakeTts();
  const engine = createAivisVoiceEngine({ tts });
  const controller = new AbortController();
  await collect(engine.synthesize("あ", { signal: controller.signal }));
  assert.equal(tts.calls[0].signal, controller.signal);
  assert.equal(tts.calls[1].signal, controller.signal);

  const aborted = new AbortController();
  const slowTts = {
    async audioQuery() {
      aborted.abort();
      return goldenAudioQuery();
    },
    async synthesis() { throw new Error("must not be reached"); }
  };
  const engine2 = createAivisVoiceEngine({ tts: slowTts });
  await assert.rejects(() => collect(engine2.synthesize("あ", { signal: aborted.signal })), { name: "AbortError" });
});

test("aivis engine: status は up・dispose で down・以後の synthesize は投げる・空文字は投げる", () => {
  const engine = createAivisVoiceEngine({ tts: fakeTts() });
  assert.equal(engine.kind, "aivis");
  assert.equal(engine.status, "up");
  const seen = [];
  const off = engine.onStatus((s) => seen.push(s));
  assert.throws(() => engine.synthesize(""), TypeError);
  engine.dispose();
  engine.dispose();
  assert.equal(engine.status, "down");
  assert.deepEqual(seen, ["down"]);
  off();
  assert.throws(() => engine.synthesize("あ"), /disposed/);
});
