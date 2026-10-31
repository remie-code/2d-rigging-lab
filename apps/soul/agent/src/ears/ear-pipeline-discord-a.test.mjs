// @ts-check
/**
 * Discord モード Domain A: 会話の正本を場へ（discord-mode.md §3.1）— 耳の側。
 *
 *  - 耳は外から渡された正本（積む口）に積む。渡されなければ今まで通り自分で作る（テストの互換）。
 *  - 渡された正本には耳が onAppend を張らない（張るのは持ち主の場が 1 回だけ）。耳が 2 本でも、持ち主の購読は 1 行 1 回。
 *  - 耳ごとの情報（遅延・audioCtx）は、その耳が積んだ行だけ onTranscript（耳ごとの口）で届く。
 * 実マイク・実 ONNX・実 whisper-server・実ネットワークは使わない（既存 ear-pipeline.test.mjs と同じ偽物）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createEarPipeline } from "./ear-pipeline.mjs";
import { createTranscriptBuffer } from "./transcript-buffer.mjs";
import { sinePcm, silencePcm, concatInt16, int16ToBytesLE } from "./fixtures-audio.mjs";
import { createFakeWebSocketClass } from "../test-support/fake-websocket.mjs";

/** 有界の条件待ち。 */
async function until(cond, ms = 3000, label = "condition") {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/**
 * 偽物一式の耳。
 * @param {{ pipelineOptions?: object }} [p]
 */
function makeEar({ pipelineOptions = {} } = {}) {
  const record = {
    /** @type {any[]} */ transcripts: [],
    /** @type {any[]} */ diagnostics: [],
    transcribeCount: 0,
    /** @type {any} */ captureOptions: null
  };
  const pipeline = createEarPipeline({
    segmenter: { minSpeechMs: 100, minSilenceMs: 64, speechPadMs: 0 },
    onTranscript: (entry, meta) => record.transcripts.push({ entry, meta }),
    onDiagnostic: (d) => record.diagnostics.push(d),
    ...pipelineOptions,
    captureFactory: /** @type {any} */ (
      (opts) => {
        record.captureOptions = opts;
        return { restartCount: () => 0, isDisposed: () => false, currentChild: () => null, dispose() {} };
      }
    ),
    vadFactory: /** @type {any} */ (
      () => ({
        modelPath: "(fake)",
        frameSamples: 512,
        async init() {},
        async process(frame) {
          let sum = 0;
          for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
          return Math.sqrt(sum / frame.length) > 0.1 ? 0.9 : 0.05;
        },
        reset() {},
        async dispose() {}
      })
    ),
    serverFactory: /** @type {any} */ (
      () => ({
        ready: Promise.resolve(),
        baseUrl: "http://127.0.0.1:0",
        isDisposed: () => false,
        hasExited: () => false,
        currentChild: () => null,
        dispose() {}
      })
    ),
    transcribeImpl: async () => {
      record.transcribeCount += 1;
      return { text: `転写${record.transcribeCount}`, rawText: `転写${record.transcribeCount}` };
    }
  });
  const feedUtterance = (/** @type {number} */ durationMs) =>
    record.captureOptions.onPcm(
      int16ToBytesLE(concatInt16(silencePcm({ durationMs: 96 }), sinePcm({ freq: 440, durationMs }), silencePcm({ durationMs: 160 })))
    );
  return { pipeline, record, feedUtterance };
}

/** ElevenLabs の耳（commit が同期で正本に積む・耳を 2 本並べる試しに使う）。 */
async function makeElevenLabsEar(/** @type {any} */ transcriptBuffer) {
  const wsClass = createFakeWebSocketClass();
  const ear = makeEar({
    pipelineOptions: {
      ...(transcriptBuffer ? { transcriptBuffer } : {}),
      stt: { engine: "elevenlabs", apiKey: "sk_fake", elevenLabs: { WebSocketImpl: wsClass.FakeWebSocket } }
    }
  });
  const p = ear.pipeline.start();
  await until(() => wsClass.sockets.length === 1, 3000, "websocket created");
  wsClass.last().serverSessionStarted();
  await p;
  return { ...ear, commit: (/** @type {string} */ text) => wsClass.last().serverCommit(text) };
}

test("Domain A 耳: 渡された正本に積む（耳の transcriptBuffer はその正本・自前では作らない）", async () => {
  const venue = createTranscriptBuffer({ nowImpl: () => 1000 });
  const ear = makeEar({ pipelineOptions: { transcriptBuffer: venue } });
  await ear.pipeline.start();
  try {
    ear.feedUtterance(480);
    await until(() => venue.size() === 1, 3000, "appended to the venue transcript");
    assert.equal(ear.pipeline.transcriptBuffer, venue);
    assert.equal(venue.all()[0].text, "転写1");
    assert.equal(venue.all()[0].speaker, "you");
    // 耳ごとの口: この耳が積んだ行が遅延と audioCtx を添えて 1 回だけ届く。
    assert.equal(ear.record.transcripts.length, 1);
    assert.equal(ear.record.transcripts[0].entry, venue.all()[0]);
    assert.ok(ear.record.transcripts[0].meta.latencyMs >= 0);
    assert.equal(ear.record.transcripts[0].meta.audioCtx, 256);
    assert.deepEqual(ear.pipeline.stats().buffer, venue.stats());
  } finally {
    await ear.pipeline.dispose();
  }
});

test("Domain A 耳: 正本が渡されなければ今まで通り自分で作り、正本のすべての行で onTranscript を呼ぶ（互換）", async () => {
  const ear = makeEar();
  await ear.pipeline.start();
  try {
    ear.feedUtterance(480);
    await until(() => ear.pipeline.transcriptBuffer.size() === 1, 3000, "appended to the own transcript");
    // ほかの者（魂）が同じ正本に積んだ行も、自前の正本では onAppend 経由で届く（従来どおり）。
    ear.pipeline.transcriptBuffer.append({ startMs: 0, endMs: 0, text: "はーい", speaker: "soul" });
    assert.deepEqual(ear.record.transcripts.map((t) => [t.entry.speaker, t.entry.text]), [
      ["you", "転写1"],
      ["soul", "はーい"]
    ]);
    assert.deepEqual(ear.record.transcripts[1].meta, { latencyMs: NaN, audioCtx: null });
  } finally {
    await ear.pipeline.dispose();
  }
});

test("Domain A 耳: 渡された正本には onAppend を張らない（ほかの者が積んだ行で耳の onTranscript は呼ばれない）", async () => {
  const venue = createTranscriptBuffer({ nowImpl: () => 1000 });
  const ear = await makeElevenLabsEar(venue);
  try {
    venue.append({ startMs: 0, endMs: 0, text: "はーい", speaker: "soul" });
    venue.append({ startMs: 0, endMs: 0, text: "こんばんは", speaker: "viewer", displayName: "a" });
    assert.equal(ear.record.transcripts.length, 0);
    ear.commit("こんにちは");
    assert.deepEqual(ear.record.transcripts.map((t) => t.entry.text), ["こんにちは"]);
    assert.deepEqual(ear.record.transcripts[0].meta, { latencyMs: null, audioCtx: null });
  } finally {
    await ear.pipeline.dispose();
  }
});

test("Domain A 耳: 耳 2 本で同じ正本に積んでも、持ち主の購読は 1 行 1 回・耳ごとの口は自分の行だけ", async () => {
  const venue = createTranscriptBuffer({ nowImpl: () => 1000 });
  /** @type {string[]} */
  const ownerSeen = [];
  venue.onAppend((entry) => ownerSeen.push(entry.text));
  const a = await makeElevenLabsEar(venue);
  const b = await makeElevenLabsEar(venue);
  try {
    a.commit("Aの一言");
    b.commit("Bの一言");
    a.commit("Aの二言");
    venue.append({ startMs: 0, endMs: 0, text: "魂の返事", speaker: "soul" });
    assert.deepEqual(venue.all().map((e) => e.text), ["Aの一言", "Bの一言", "Aの二言", "魂の返事"]);
    assert.deepEqual(ownerSeen, ["Aの一言", "Bの一言", "Aの二言", "魂の返事"], "N 重にならない");
    assert.deepEqual(a.record.transcripts.map((t) => t.entry.text), ["Aの一言", "Aの二言"]);
    assert.deepEqual(b.record.transcripts.map((t) => t.entry.text), ["Bの一言"]);
  } finally {
    await a.pipeline.dispose();
    await b.pipeline.dispose();
  }
});

test("Domain A 耳: 耳ごとの口が投げても listenerError の診断に落として耳は続く（自前の正本のときと同じ扱い）", async () => {
  const venue = createTranscriptBuffer({ nowImpl: () => 1000 });
  const wsClass = createFakeWebSocketClass();
  /** @type {any[]} */
  const diagnostics = [];
  const ear = makeEar({
    pipelineOptions: {
      transcriptBuffer: venue,
      stt: { engine: "elevenlabs", apiKey: "sk_fake", elevenLabs: { WebSocketImpl: wsClass.FakeWebSocket } },
      onTranscript: () => {
        throw new Error("subscriber broke");
      },
      onDiagnostic: (/** @type {any} */ d) => diagnostics.push(d)
    }
  });
  const p = ear.pipeline.start();
  await until(() => wsClass.sockets.length === 1, 3000, "websocket created");
  wsClass.last().serverSessionStarted();
  await p;
  try {
    wsClass.last().serverCommit("一言");
    wsClass.last().serverCommit("二言");
    assert.deepEqual(venue.all().map((e) => e.text), ["一言", "二言"]);
    assert.equal(diagnostics.filter((d) => d.type === "listenerError").length, 2);
  } finally {
    await ear.pipeline.dispose();
  }
});
