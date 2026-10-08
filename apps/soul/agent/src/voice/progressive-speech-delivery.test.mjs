// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { createProgressiveSpeechDelivery } from "./progressive-speech-delivery.mjs";
import { writeOwnedTempWav } from "./audio-player.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));

function makePlayer() {
  const listeners = new Set();
  const plays = [];
  const playbackIds = [];
  let stops = 0;
  return {
    plays,
    playbackIds,
    get stops() { return stops; },
    play(path, playbackId) { plays.push(path); playbackIds.push(playbackId); },
    stop() { stops += 1; },
    subscribeOutput(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(line) {
      for (const listener of [...listeners]) listener(line);
    }
  };
}

function emitOwned(player, type, index = player.plays.length - 1) {
  player.emit(`${type}\t${player.playbackIds[index]}\t${player.plays[index]}`);
}

function artifact(name, chars = 2) {
  return {
    wavPath: `${name}.wav`,
    timeline: [{ timeMs: 0, vowel: "a", s: 0.5 }],
    wavDurationSec: 0.1,
    rawMoraCount: 1,
    wavBytes: 100,
    speechChars: chars
  };
}

function acceptedChannel(log = []) {
  let request = 0;
  return {
    async sendSpeech(timeline) {
      request += 1;
      log.push({ request, timeline });
      return {
        result: "accepted",
        error: null,
        rttMs: 1,
        requestId: `req-${request}`,
        serializedUtf8Bytes: 200 + request
      };
    }
  };
}

test("C2 delivery: preparation overlap, FIFO, active<=1, and LLM terminal waits for queue terminal", async () => {
  const player = makePlayer();
  const prepared = new Map();
  const channelCalls = [];
  const traces = [];
  const delivery = createProgressiveSpeechDelivery({
    generationId: "fire-1",
    channel: acceptedChannel(channelCalls),
    player,
    prepareSpeechImpl: (text) => new Promise((resolve) => prepared.set(text, resolve)),
    cleanupArtifact: () => {},
    onTrace: (event, fields) => traces.push({ event, fields })
  });
  delivery.enqueue({ text: "一。", index: 0, final: false });
  delivery.enqueue({ text: "二。", index: 1, final: false });
  await tick();
  const done = delivery.finishLlm();
  let settled = false;
  done.then(() => { settled = true; });

  prepared.get("二。")(artifact("two"));
  await tick();
  assert.deepEqual(player.plays, [], "later preparation cannot overtake queue head");
  prepared.get("一。")(artifact("one"));
  await tick();
  await tick();
  assert.deepEqual(player.plays, ["one.wav"]);
  assert.equal(settled, false, "LLM completion is distinct from playback completion");
  assert.equal(delivery.snapshot().activePlaybackId != null, true);

  emitOwned(player, "STARTED", 0);
  emitOwned(player, "ENDED", 0);
  await tick();
  assert.deepEqual(player.plays, ["one.wav", "two.wav"]);
  assert.equal(settled, false);
  emitOwned(player, "STARTED", 1);
  emitOwned(player, "ENDED", 1);
  const result = await done;
  assert.equal(result.status, "completed");
  assert.equal(result.completedSentenceCount, 2);
  assert.equal(result.playedText, "一。二。");
  assert.deepEqual(channelCalls.map((call) => call.timeline.length), [1, 1]);
  assert.ok(
    traces.some(
      (entry) =>
        entry.event === "progressive.playback.activated" &&
        entry.fields.jobId === "fire-1:sentence-1" &&
        entry.fields.requestId === "req-1" &&
        entry.fields.serializedUtf8Bytes === 201
    )
  );
});

test("C2 delivery: exact path/playback ownership ignores stale markers and never advances newer generation", async () => {
  const player = makePlayer();
  const old = createProgressiveSpeechDelivery({
    generationId: "old",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("old"),
    cleanupArtifact: () => {}
  });
  old.enqueue({ text: "旧。", index: 0, final: false });
  await tick();
  await tick();
  old.finishLlm();
  old.kill();
  const oldState = await old.finishLlm();
  assert.equal(oldState.status, "cancelled");

  const fresh = createProgressiveSpeechDelivery({
    generationId: "fresh",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("fresh"),
    cleanupArtifact: () => {}
  });
  fresh.enqueue({ text: "新。", index: 0, final: false });
  await tick();
  await tick();
  const freshDone = fresh.finishLlm();
  const active = fresh.snapshot().activePlaybackId;
  player.emit(`STARTED\t${player.playbackIds[0]}\told.wav`);
  player.emit(`ENDED\t${player.playbackIds[0]}\told.wav`);
  player.emit("ERROR\tlate old error");
  assert.equal(fresh.snapshot().activePlaybackId, active);
  emitOwned(player, "STARTED", 1);
  emitOwned(player, "ENDED", 1);
  assert.equal((await freshDone).playedText, "新。");
});

test("C2 delivery: kill/dispose close their generation once and clear late preparation", async () => {
  for (const method of ["kill", "dispose"]) {
    const player = makePlayer();
    let resolveLate;
    const cleanups = [];
    const delivery = createProgressiveSpeechDelivery({
      generationId: method,
      channel: acceptedChannel(),
      player,
      prepareSpeechImpl: () => new Promise((resolve) => { resolveLate = resolve; }),
      cleanupArtifact: (value) => cleanups.push(value.wavPath)
    });
    delivery.enqueue({ text: "遅延。", index: 0, final: false });
    await tick();
    delivery.finishLlm();
    assert.equal(delivery[method](), true);
    assert.equal(delivery[method](), false);
    resolveLate(artifact(`${method}-late`));
    await tick();
    const result = await delivery.finishLlm();
    assert.equal(result.status, "cancelled");
    assert.equal(result.completedSentenceCount, 0);
    assert.deepEqual(player.plays, []);
    assert.deepEqual(cleanups, [`${method}-late.wav`]);
  }
});

test("C2 delivery: barge-in is gated until matching STARTED, then closes once", async () => {
  const player = makePlayer();
  const delivery = createProgressiveSpeechDelivery({
    generationId: "barge-start-gate",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("barge-start-gate"),
    cleanupArtifact: () => {}
  });
  delivery.enqueue({ text: "開始。", index: 0, final: false });
  await tick();
  await tick();
  assert.equal(delivery.bargeIn(), false);
  assert.equal(delivery.snapshot().status, "open");
  emitOwned(player, "STARTED");
  assert.equal(delivery.snapshot().hasAudiblyStarted, true);
  assert.equal(delivery.bargeIn(), true);
  assert.equal(delivery.bargeIn(), false);
  const result = await delivery.finishLlm();
  assert.equal(result.status, "cancelled");
  assert.equal(result.terminalCause, "barge-in");
});

test("C2 delivery: channel/preflight-like failure contains the generation, does not retry, and a later Fire recovers", async () => {
  const player = makePlayer();
  let sends = 0;
  const failingChannel = {
    async sendSpeech() {
      sends += 1;
      const error = new Error("intent.speech envelope is over cap");
      error.code = "speech_envelope_oversize";
      error.diagnosticStage = "control_channel.preflight";
      throw error;
    }
  };
  const failed = createProgressiveSpeechDelivery({
    generationId: "failed",
    channel: failingChannel,
    player,
    prepareSpeechImpl: () => artifact("failed"),
    cleanupArtifact: () => {}
  });
  failed.enqueue({ text: "失敗。", index: 0, final: false });
  await tick();
  await tick();
  const failedResult = await failed.finishLlm();
  assert.equal(failedResult.status, "failed");
  assert.equal(sends, 1, "ambiguous/local failures are never blindly retried");
  assert.deepEqual(player.plays, []);

  const recovered = createProgressiveSpeechDelivery({
    generationId: "recovered",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("recovered"),
    cleanupArtifact: () => {}
  });
  recovered.enqueue({ text: "復帰。", index: 0, final: false });
  await tick();
  await tick();
  const recoveredDone = recovered.finishLlm();
  emitOwned(player, "STARTED");
  emitOwned(player, "ENDED");
  assert.equal((await recoveredDone).status, "completed");
});

test("C2 delivery: prepare failure closes queued work and preserves only completed watermark", async () => {
  const player = makePlayer();
  const delivery = createProgressiveSpeechDelivery({
    generationId: "prepare-failure",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: (text) => {
      if (text === "失敗。") return Promise.reject(new Error("tts unavailable"));
      return artifact(text === "先行。" ? "prefix" : "later");
    },
    cleanupArtifact: () => {}
  });
  delivery.enqueue({ text: "先行。", index: 0, final: false });
  await tick();
  await tick();
  emitOwned(player, "STARTED");
  emitOwned(player, "ENDED");
  delivery.enqueue({ text: "失敗。", index: 1, final: false });
  delivery.enqueue({ text: "後続。", index: 2, final: false });
  await tick();
  await tick();
  const result = await delivery.finishLlm();
  assert.equal(result.status, "failed");
  assert.equal(result.playedText, "先行。");
  assert.equal(result.completedSentenceCount, 1);
  assert.deepEqual(player.plays, ["prefix.wav"]);
});

test("C2 marker auth: terminal-before-STARTED and duplicate markers cannot commit or advance", async () => {
  const player = makePlayer();
  const delivery = createProgressiveSpeechDelivery({
    generationId: "marker-order",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("ordered"),
    cleanupArtifact: () => {}
  });
  delivery.enqueue({ text: "認証。", index: 0, final: false });
  await tick();
  await tick();
  const done = delivery.finishLlm();
  emitOwned(player, "ENDED");
  emitOwned(player, "STOPPED");
  assert.equal(delivery.snapshot().completedSentenceCount, 0);
  emitOwned(player, "STARTED");
  emitOwned(player, "STARTED");
  emitOwned(player, "ENDED");
  emitOwned(player, "ENDED");
  const outcome = await done;
  assert.equal(outcome.completedSentenceCount, 1);
  assert.equal(outcome.playedText, "認証。");
});

test("C2 marker auth: stale same-path markers carry old playbackId and cannot commit a fresh generation", async () => {
  const player = makePlayer();
  const old = createProgressiveSpeechDelivery({
    generationId: "same-old",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("same"),
    cleanupArtifact: () => {}
  });
  old.enqueue({ text: "旧。", index: 0, final: false });
  await tick();
  await tick();
  const oldPlaybackId = player.playbackIds[0];
  old.kill();
  await old.finishLlm();

  const fresh = createProgressiveSpeechDelivery({
    generationId: "same-fresh",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("same"),
    cleanupArtifact: () => {}
  });
  fresh.enqueue({ text: "新。", index: 0, final: false });
  await tick();
  await tick();
  const done = fresh.finishLlm();
  player.emit(`STARTED\t${oldPlaybackId}\tsame.wav`);
  player.emit(`ENDED\t${oldPlaybackId}\tsame.wav`);
  assert.equal(fresh.snapshot().completedSentenceCount, 0);
  emitOwned(player, "STARTED", 1);
  emitOwned(player, "ENDED", 1);
  assert.equal((await done).playedText, "新。");
});

test("C2 marker watchdog: missing ENDED fails its generation and a later Fire recovers", async () => {
  const player = makePlayer();
  const timers = [];
  const setTimeoutImpl = (fn, ms) => {
    const timer = { fn, ms, cancelled: false };
    timers.push(timer);
    return timer;
  };
  const clearTimeoutImpl = (timer) => { timer.cancelled = true; };
  const stalled = createProgressiveSpeechDelivery({
    generationId: "watchdog-old",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("same"),
    cleanupArtifact: () => {},
    setTimeoutImpl,
    clearTimeoutImpl,
    playbackCompletionMarginMs: 100
  });
  stalled.enqueue({ text: "停止。", index: 0, final: false });
  await tick();
  await tick();
  const stalledDone = stalled.finishLlm();
  emitOwned(player, "STARTED", 0);
  const watchdog = timers.at(-1);
  assert.equal(watchdog.ms, 200, "prepared 100ms duration plus bounded 100ms margin");
  watchdog.fn();
  const failed = await stalledDone;
  assert.equal(failed.status, "failed");
  assert.equal(failed.completedSentenceCount, 0);

  const fresh = createProgressiveSpeechDelivery({
    generationId: "watchdog-fresh",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => artifact("same"),
    cleanupArtifact: () => {}
  });
  fresh.enqueue({ text: "復帰。", index: 0, final: false });
  await tick();
  await tick();
  const freshDone = fresh.finishLlm();
  watchdog.fn();
  emitOwned(player, "STARTED", 1);
  emitOwned(player, "ENDED", 1);
  assert.equal((await freshDone).status, "completed");
});

function ownedArtifact(name) {
  const owned = writeOwnedTempWav(new Uint8Array([1, 2, 3]), { prefix: `${name}-` });
  return { ...artifact(name), ...owned };
}

test("C2 temp ownership: natural completion removes exact WAV and owned directory once", async () => {
  const player = makePlayer();
  const prepared = ownedArtifact("natural");
  let cleanupCalls = 0;
  const exactCleanup = prepared.cleanup;
  prepared.cleanup = () => { cleanupCalls += 1; return exactCleanup(); };
  const delivery = createProgressiveSpeechDelivery({
    generationId: "cleanup-natural",
    channel: acceptedChannel(),
    player,
    prepareSpeechImpl: () => prepared
  });
  delivery.enqueue({ text: "完了。", index: 0, final: false });
  await tick();
  await tick();
  const done = delivery.finishLlm();
  assert.equal(existsSync(prepared.wavPath), true);
  emitOwned(player, "STARTED");
  emitOwned(player, "ENDED");
  await done;
  emitOwned(player, "ENDED");
  assert.equal(cleanupCalls, 1);
  assert.equal(existsSync(prepared.wavPath), false);
  assert.equal(existsSync(prepared.ownedDirectory), false);
});

test("C2 temp ownership: late prepare, channel/play failure, and dispose clean exact owned temp once", async () => {
  for (const mode of ["late", "channel", "play", "dispose"]) {
    const player = makePlayer();
    const prepared = ownedArtifact(mode);
    let cleanupCalls = 0;
    const exactCleanup = prepared.cleanup;
    prepared.cleanup = () => { cleanupCalls += 1; return exactCleanup(); };
    let resolveLate;
    if (mode === "play") player.play = () => { throw new Error("play failed"); };
    const delivery = createProgressiveSpeechDelivery({
      generationId: `cleanup-${mode}`,
      channel: mode === "channel" ? { async sendSpeech() { throw new Error("channel failed"); } } : acceptedChannel(),
      player,
      prepareSpeechImpl: () =>
        mode === "late" ? new Promise((resolve) => { resolveLate = resolve; }) : prepared
    });
    delivery.enqueue({ text: "後始末。", index: 0, final: false });
    await tick();
    if (mode === "late") {
      delivery.dispose();
      resolveLate(prepared);
    } else {
      await tick();
      if (mode === "dispose") delivery.dispose();
    }
    await delivery.finishLlm();
    delivery.dispose();
    await tick();
    assert.equal(cleanupCalls, 1, mode);
    assert.equal(existsSync(prepared.wavPath), false, mode);
    assert.equal(existsSync(prepared.ownedDirectory), false, mode);
  }
});
