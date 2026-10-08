// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFireDiagnostics } from "./fire-diagnostics.mjs";
import { createFireOrchestrator } from "./fire-orchestrator.mjs";
import { createTranscriptBuffer } from "../ears/transcript-buffer.mjs";
import { buildWavBytes } from "../voice/fixtures.mjs";
import { connectChannel } from "../channel/channel-client.mjs";
import { createChannelServerDouble } from "../test-support/ws-double.mjs";
import { MinimalWebSocket } from "../test-support/ws-client.mjs";
import { createLazyChannel } from "../../scripts/cockpit.mjs";

const fixtureDir = new URL("./fixtures/", import.meta.url);
const loadFixture = (name) =>
  readFileSync(new URL(name, fixtureDir), "utf8")
    .trim()
    .split("\n")
    .map(JSON.parse);

class SynchronousSendFailureWebSocket extends MinimalWebSocket {
  send() {
    throw new Error("test-only synchronous socket send failure");
  }
}

function traceHooks(diagnostics) {
  return {
    onFire(info) {
      if (info?.accepted === true) {
        diagnostics.begin({
          injectedChars: typeof info.injectedChars === "number" ? info.injectedChars : null,
          includedCount: typeof info.includedCount === "number" ? info.includedCount : null,
          vision: info.vision === true
        });
      }
    },
    onTrace(trace) {
      if (trace.event === "fire.completed") {
        diagnostics.finish({ fired: trace.fired === true, reason: trace.reason ?? null });
      }
      else if (trace.event === "fire.failed") diagnostics.fail(trace.stage, { name: trace.failureName, code: trace.failureCode ?? null });
      else {
        const { event, ...fields } = trace;
        diagnostics.record(event, fields);
      }
    }
  };
}

test("Fire diagnostics: async success/failure are incremental, bounded, and write failures are nonfatal", async () => {
  const dir = mkdtempSync(join(tmpdir(), "soul-fire-diagnostics-"));
  let now = 1_700_000_000_000;
  let mono = 10;
  const diagnostics = createFireDiagnostics({
    dir,
    retention: 2,
    nowImpl: () => now++,
    monotonicNowImpl: () => mono++
  });

  const success = diagnostics.begin({ injectedChars: 12, includedCount: 1, vision: false });
  diagnostics.record("speech.timeline.built", { timelineCount: 2 });
  diagnostics.finish({ fired: true });
  await diagnostics.flush();
  const successEvents = readFileSync(success.path, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(successEvents.map((event) => event.event), ["fire.accepted", "speech.timeline.built", "fire.completed"]);
  assert.equal(successEvents[1].timelineCount, 2);
  assert.ok(successEvents.every((event) => typeof event.wallTimeMs === "number" && typeof event.monotonicMs === "number"));

  const failure = diagnostics.begin({ injectedChars: 8, includedCount: 1, vision: false });
  diagnostics.record("tts.audio_query.completed", { rawMoraCount: 4 });
  diagnostics.fail("control_channel.close", Object.assign(new Error("private provider detail"), { code: "channel_closed" }));
  await diagnostics.flush();
  const failureEvents = readFileSync(failure.path, "utf8").trim().split("\n").map(JSON.parse);
  assert.deepEqual(failureEvents.map((event) => event.event), ["fire.accepted", "tts.audio_query.completed", "fire.failed"]);
  assert.deepEqual(failureEvents.at(-1).failure, { name: "Error", code: "channel_closed" });
  assert.ok(!readFileSync(failure.path, "utf8").includes("private provider detail"));

  diagnostics.begin({ injectedChars: 1 });
  diagnostics.finish();
  await diagnostics.flush();
  // Retention keeps only the two newest known trace files.
  assert.equal(readdirSync(dir).filter((name) => name.endsWith(".jsonl")).length, 2);

  const blocked = join(dir, "not-a-directory");
  writeFileSync(blocked, "x");
  const nonfatal = createFireDiagnostics({ dir: blocked });
  assert.doesNotThrow(() => {
    nonfatal.begin({ injectedChars: 1 });
    nonfatal.record("anything", { count: 1 });
    nonfatal.finish();
  });
  await nonfatal.flush();
});

test("Fire diagnostics: injected success reaches the parent playback proxy and persisted failure keeps its boundary", async () => {
  const dir = mkdtempSync(join(tmpdir(), "soul-fire-trace-"));
  const diagnostics = createFireDiagnostics({ dir });
  const buffer = createTranscriptBuffer();
  buffer.append({ startMs: 0, endMs: 1, text: "trigger", speaker: "you" });
  let played = 0;
  const success = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "reply" }; } },
    channel: { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
    player: { play() { played += 1; } },
    speakDeps: {
      tts: {
        async audioQuery() {
          return { accent_phrases: [{ moras: [{ text: "ア", vowel: "a" }], pause_mora: null }], prePhonemeLength: 0, postPhonemeLength: 0 };
        },
        async synthesis() { return buildWavBytes({ dataBytes: 48000 }); }
      },
      writeWav: () => "C:/tmp/fake.wav"
    },
    setTimeoutImpl: (fn) => setTimeout(fn, 0),
    ...traceHooks(diagnostics)
  });
  assert.equal((await success.fire()).fired, true);
  assert.equal(played, 1, "parent player.play proxy was reached");

  const failure = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "reply" }; } },
    channel: { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } },
    player: { play() {} },
    speakImpl: async (_text, deps) => {
      deps.onTrace("speech.timeline.built", { timelineCount: 110 });
      const error = new Error("closed without recording this text");
      error.code = "reply_timeout";
      error.diagnosticStage = "control_channel.reply_timeout";
      throw error;
    },
    ...traceHooks(diagnostics)
  });
  assert.equal((await failure.fire()).reason, "error");
  await diagnostics.flush();

  const logs = readdirSync(dir).filter((name) => name.endsWith(".jsonl")).sort();
  assert.equal(logs.length, 2);
  const successLog = readFileSync(join(dir, logs[0]), "utf8");
  const failureLog = readFileSync(join(dir, logs[1]), "utf8");
  assert.ok(successLog.includes("player.play.enqueued"));
  assert.ok(failureLog.includes("speech.timeline.built"));
  assert.ok(failureLog.includes("fire.failed"));
  assert.ok(!failureLog.includes("closed without recording this text"));
  success.dispose();
  failure.dispose();
});

test("Fire diagnostics: writer ordering, failure recovery, and queue cap are bounded without awaiting Fire", async () => {
  const writes = [];
  let firstWrite = true;
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const fs = {
    async mkdir() {},
    async readdir() { return []; },
    async rm() {},
    async appendFile(_path, line) {
      writes.push(line);
      if (firstWrite) {
        firstWrite = false;
        await held;
        throw new Error("disk full once");
      }
    }
  };
  const diagnostics = createFireDiagnostics({ dir: "C:/fake-fire-diagnostics", fs, maxQueue: 2 });
  diagnostics.begin({ injectedChars: 1 });
  diagnostics.record("first");
  diagnostics.record("second");
  diagnostics.record("third");
  assert.equal(diagnostics.getQueueStats().maxQueue, 2);
  assert.ok(diagnostics.getQueueStats().dropped >= 1, "the in-memory async queue is bounded");
  release();
  await diagnostics.flush();
  assert.ok(writes.some((line) => line.includes('"event":"first"') || line.includes('"event":"fire.accepted"')));
  diagnostics.record("recovered");
  diagnostics.finish();
  await diagnostics.flush();
  assert.ok(writes.some((line) => line.includes('"event":"recovered"')), "a failed write does not poison later writes");
});

test("Fire diagnostics: production-shaped persisted failures retain every TTS/WAV/channel boundary", async () => {
  const query = (moras) => ({
    accent_phrases: [{ moras, pause_mora: null }],
    prePhonemeLength: 0,
    postPhonemeLength: 0
  });
  const run = async ({ tts, channel, createChannel, writeWav, speakImpl } = {}) => {
    const dir = mkdtempSync(join(tmpdir(), "soul-fire-boundary-"));
    const diagnostics = createFireDiagnostics({ dir });
    const effectiveChannel = typeof createChannel === "function" ? await createChannel(diagnostics) : channel;
    const buffer = createTranscriptBuffer();
    buffer.append({ startMs: 0, endMs: 1, text: "trigger", speaker: "you" });
    const orchestrator = createFireOrchestrator({
      getBuffer: () => buffer,
      session: { async ask() { return { replyText: "reply" }; } },
      channel: effectiveChannel,
      player: { play() {} },
      ...(typeof speakImpl === "function" ? { speakImpl } : {}),
      speakDeps: { tts, writeWav: writeWav ?? (() => "C:/tmp/fake.wav") },
      ...traceHooks(diagnostics)
    });
    const result = await orchestrator.fire();
    await diagnostics.flush();
    const file = readdirSync(dir).find((name) => name.endsWith(".jsonl"));
    const events = readFileSync(join(dir, file), "utf8").trim().split("\n").map(JSON.parse);
    orchestrator.dispose();
    return { result, events, diagnostics, channel: effectiveChannel };
  };
  const accepted = { async sendSpeech() { return { result: "accepted", error: null, rttMs: 1 }; } };

  const audioQuery = await run({
    channel: accepted,
    tts: { async audioQuery() { throw new Error("secret audio failure"); }, async synthesis() { throw new Error("unused"); } }
  });
  assert.equal(audioQuery.events.at(-1).stage, "tts.audio_query");
  assert.equal(audioQuery.events.at(-1).failure.code, "tts_audio_query_failed");

  const audioQueryParse = await run({
    channel: accepted,
    tts: { async audioQuery() { return {}; }, async synthesis() { throw new Error("unused"); } }
  });
  assert.equal(audioQueryParse.events.at(-1).stage, "tts.audio_query.parse");
  assert.equal(audioQueryParse.events.at(-1).failure.code, "tts_audio_query_invalid");
  assert.ok(audioQueryParse.events.some((event) => event.event === "tts.audio_query.request_completed"));
  assert.ok(audioQueryParse.events.some((event) => event.event === "tts.audio_query.parse.failed" && event.failureCode === "tts_audio_query_invalid"));

  const synthesis = await run({
    channel: accepted,
    tts: {
      async audioQuery() { return query([{ text: "ア", vowel: "a" }]); },
      async synthesis() { throw new Error("provider failure"); }
    }
  });
  assert.equal(synthesis.events.at(-1).stage, "tts.synthesis");
  assert.equal(synthesis.events.at(-1).failure.code, "tts_synthesis_failed");
  assert.ok(synthesis.events.some((event) => event.event === "tts.audio_query.completed"));
  assert.ok(synthesis.events.some((event) => event.event === "tts.synthesis.failed" && event.failureCode === "tts_synthesis_failed"));

  const invalidWav = await run({
    channel: accepted,
    tts: {
      async audioQuery() { return query([{ text: "ア", vowel: "a" }]); },
      async synthesis() { return new Uint8Array([1, 2, 3]); }
    }
  });
  assert.equal(invalidWav.events.at(-1).stage, "speech.wav.inspect");
  assert.equal(invalidWav.events.at(-1).failure.code, "speech_wav_invalid");
  assert.ok(invalidWav.events.some((event) => event.event === "tts.synthesis.completed" && event.wavBytes === 3));
  assert.ok(invalidWav.events.some((event) => event.event === "speech.wav.inspect.failed" && event.failureCode === "speech_wav_invalid"));

  const wavWrite = await run({
    channel: accepted,
    tts: {
      async audioQuery() { return query([{ text: "ア", vowel: "a" }]); },
      async synthesis() { return buildWavBytes({ dataBytes: 48000 }); }
    },
    writeWav() { throw new Error("private path failure"); }
  });
  assert.equal(wavWrite.events.at(-1).stage, "speech.wav.write");
  assert.equal(wavWrite.events.at(-1).failure.code, "speech_wav_write_failed");
  assert.ok(wavWrite.events.some((event) => event.event === "speech.timeline.built"));
  assert.ok(wavWrite.events.some((event) => event.event === "speech.wav.write.failed" && event.failureCode === "speech_wav_write_failed"));

  const timeline = await run({
    channel: accepted,
    tts: {
      async audioQuery() { return query(Array.from({ length: 513 }, () => ({ text: "ア", vowel: "a" }))); },
      async synthesis() { return buildWavBytes({ dataBytes: 48000 }); }
    }
  });
  assert.equal(timeline.events.at(-1).stage, "speech.timeline.build");
  assert.equal(timeline.events.at(-1).failure.code, "timeline_build_failed");

  const rejected = await run({
    channel: { async sendSpeech() { return { result: "rejected", error: { code: "rejectedByRuntime" }, rttMs: 1 }; } },
    tts: {
      async audioQuery() { return query([{ text: "ア", vowel: "a" }]); },
      async synthesis() { return buildWavBytes({ dataBytes: 48000 }); }
    }
  });
  assert.equal(rejected.events.at(-1).stage, "control_channel.rejection");
  assert.equal(rejected.events.at(-1).failure.code, "speech_rejected");
  assert.ok(rejected.events.some((event) => event.event === "speech.channel.rejected"));

  const unknownPostAsk = await run({
    channel: accepted,
    speakImpl: async () => { throw new Error("private post-ask processing detail"); }
  });
  assert.equal(unknownPostAsk.events.at(-1).stage, "fire.processing.unknown");
  assert.equal(unknownPostAsk.events.at(-1).failure.code, "fire_processing_unknown");
  assert.ok(!JSON.stringify(unknownPostAsk.events).includes("private post-ask processing detail"));

  const closeServer = createChannelServerDouble({ onSpeech: () => ({ result: "drop" }) });
  await closeServer.listen();
  const close = await run({
    createChannel: (diagnostics) =>
      connectChannel(closeServer.url(), { WebSocketImpl: MinimalWebSocket, onTrace: (event, fields) => diagnostics.record(event, fields) }),
    tts: { async audioQuery() { return query([{ text: "ア", vowel: "a" }]); }, async synthesis() { return buildWavBytes({ dataBytes: 48000 }); } }
  });
  assert.equal(close.events.at(-1).stage, "control_channel.close");
  assert.equal(close.events.at(-1).failure.code, "channel_closed");
  assert.ok(close.events.some((event) => event.event === "channel.close"));
  await close.channel.close();
  await closeServer.close();

  const sendServer = createChannelServerDouble();
  await sendServer.listen();
  const send = await run({
    createChannel: (diagnostics) =>
      connectChannel(sendServer.url(), {
        WebSocketImpl: SynchronousSendFailureWebSocket,
        onTrace: (event, fields) => diagnostics.record(event, fields)
      }),
    tts: { async audioQuery() { return query([{ text: "ア", vowel: "a" }]); }, async synthesis() { return buildWavBytes({ dataBytes: 48000 }); } }
  });
  assert.equal(send.events.at(-1).stage, "control_channel.send");
  assert.equal(send.events.at(-1).failure.code, "channel_send_failed");
  assert.ok(send.events.some((event) => event.event === "speech.timeline.built"));
  assert.ok(send.events.some((event) => event.event === "channel.request.send_failed" && event.failureCode === "channel_send_failed"));
  assert.ok(send.events.some((event) => event.event === "speech.channel.failed" && event.failureCode === "channel_send_failed"));
  await send.channel.close();
  await sendServer.close();

  const timeoutServer = createChannelServerDouble({ onSpeech: () => ({ result: "pending" }) });
  await timeoutServer.listen();
  const timeout = await run({
    createChannel: (diagnostics) =>
      connectChannel(timeoutServer.url(), {
        WebSocketImpl: MinimalWebSocket,
        replyTimeoutMs: 20,
        onTrace: (event, fields) => diagnostics.record(event, fields)
      }),
    tts: { async audioQuery() { return query([{ text: "ア", vowel: "a" }]); }, async synthesis() { return buildWavBytes({ dataBytes: 48000 }); } }
  });
  assert.equal(timeout.events.at(-1).stage, "control_channel.reply_timeout");
  assert.equal(timeout.events.at(-1).failure.code, "reply_timeout");
  await timeout.channel.close();
  await timeoutServer.close();
});

test("Fire diagnostic fixtures: real production hook chain enforces exact success event/field parity", async () => {
  const server = createChannelServerDouble({ onSpeech: () => ({ result: "accepted" }) });
  await server.listen();
  const dir = mkdtempSync(join(tmpdir(), "soul-fire-fixture-parity-"));
  const diagnostics = createFireDiagnostics({ dir });
  const channel = createLazyChannel(server.url(), {
    connectImpl: (url, options) => connectChannel(url, { ...options, WebSocketImpl: MinimalWebSocket }),
    onTrace: (event, fields) => diagnostics.record(event, fields)
  });
  const buffer = createTranscriptBuffer();
  buffer.append({ startMs: 0, endMs: 1, text: "trigger", speaker: "you" });
  const orchestrator = createFireOrchestrator({
    getBuffer: () => buffer,
    session: { async ask() { return { replyText: "12345678", elapsedMs: 120 }; } },
    channel,
    player: { play() { queueMicrotask(() => diagnostics.record("player.child", { marker: "STARTED" })); } },
    speakDeps: {
      tts: {
        async audioQuery() {
          return { accent_phrases: [{ moras: [{ text: "ア", vowel: "a" }, { text: "イ", vowel: "i" }], pause_mora: null }], prePhonemeLength: 0.1, postPhonemeLength: 0.1 };
        },
        async synthesis() { return buildWavBytes({ dataBytes: 48000 }); }
      },
      writeWav: () => "C:/tmp/fake.wav"
    },
    setTimeoutImpl: (fn) => { queueMicrotask(fn); return null; },
    ...traceHooks(diagnostics)
  });
  assert.equal((await orchestrator.fire()).fired, true);
  await diagnostics.flush();
  const actualFile = readdirSync(dir).find((name) => name.endsWith(".jsonl"));
  const actual = readFileSync(join(dir, actualFile), "utf8").trim().split("\n").map(JSON.parse);
  const fixture = loadFixture("fire-diagnostics.success.jsonl");
  assert.deepEqual(actual.map((record) => record.event), fixture.map((record) => record.event));
  for (let i = 0; i < fixture.length; i += 1) {
    assert.deepEqual(Object.keys(actual[i]).sort(), Object.keys(fixture[i]).sort(), fixture[i].event);
  }
  await channel.close();
  await server.close();
  orchestrator.dispose();
});

test("Fire diagnostic fixtures: production event shape exposes the dominant pre-playback fact without overlap arithmetic", () => {
  const success = loadFixture("fire-diagnostics.success.jsonl");
  const failure = loadFixture("fire-diagnostics.failure.jsonl");
  assert.ok(success.some((record) => record.event === "channel.request.send"));
  assert.equal(success.some((record) => record.event === "speech.timeline.built" && "serializedSpeechUtf8Bytes" in record), false);
  const sent = success.find((record) => record.event === "channel.request.send");
  const timeline = [
    { timeMs: 100, vowel: "a", s: 0.5 },
    { timeMs: 300, vowel: "i", s: 0.6 }
  ];
  assert.equal(
    sent.serializedUtf8Bytes,
    Buffer.byteLength(JSON.stringify({ v: 1, id: sent.requestId, kind: "intent.speech", payload: { timeline } }), "utf8")
  );
  const started = success.find((record) => record.event === "player.child" && record.marker === "STARTED");
  const prePlaybackStages = success.filter((record) => record.monotonicMs <= started.monotonicMs && typeof record.durationMs === "number");
  const dominant = prePlaybackStages.reduce((largest, record) => (record.durationMs > largest.durationMs ? record : largest));
  assert.equal(dominant.event, "tts.synthesis.request_completed");
  assert.equal(dominant.durationMs, 320);
  assert.equal(started.sinceFireAcceptedMs, 499);
  assert.ok(success.at(-1).monotonicMs > started.monotonicMs, "post-STARTED playback occupancy stays visibly outside pre-playback comparison");
  assert.equal(
    failure.find((record) => record.event === "fire.failed").stage,
    "control_channel.close"
  );
  assert.equal(
    failure.find((record) => record.event === "channel.request.failed").failureCode,
    "channel_closed"
  );
});
