// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createSpeechStreamer, speakOnce, SPEECH_STREAM_APPEND_MAX_ITEMS } from "./speech-streamer.mjs";
import { createFakeStreamPlayer } from "../test-support/fake-stream-player.mjs";
import { createFakeVoiceEngine, createFakeSpeechChannel, defaultFakeChunks } from "../test-support/fake-voice-engine.mjs";
import { createAivisVoiceEngine } from "./engines/aivis-voice-engine.mjs";
import { buildWavBytes } from "./fixtures.mjs";

// 発話の運び手。実 TTS・実プレイヤー・実器は使わない（engine / player / channel は代役）。
// 旧 progressive-speech-delivery / tts-playback-coordinator / speak の activate の検証をこの形に移したもの。

const tick = () => new Promise((resolve) => setImmediate(resolve));
async function settle(n = 3) {
  for (let i = 0; i < n; i += 1) await tick();
}

function deferred() {
  /** @type {(v?: any) => void} */
  let resolve = () => {};
  /** @type {(v?: any) => void} */
  let reject = () => {};
  const promise = new Promise((r, j) => {
    resolve = r;
    reject = j;
  });
  return { promise, resolve, reject };
}

/** player と channel の呼び出しを 1 本の順序に並べる。 */
function makeRig(options = {}) {
  const log = [];
  const player = createFakeStreamPlayer(/** @type {any} */ (options).player);
  const channel = createFakeSpeechChannel(/** @type {any} */ (options).channel);
  const wrap = (/** @type {any} */ target, /** @type {string} */ name, /** @type {string} */ label) => {
    const original = target[name].bind(target);
    target[name] = (/** @type {any[]} */ ...args) => {
      log.push(label);
      return original(...args);
    };
  };
  wrap(player, "open", "player.open");
  wrap(player, "write", "player.write");
  wrap(player, "end", "player.end");
  wrap(player, "stop", "player.stop");
  wrap(channel, "openSpeech", "channel.open");
  wrap(channel, "appendSpeech", "channel.append");
  wrap(channel, "endSpeech", "channel.end");
  wrap(channel, "sendSet", "channel.release");
  return { log, player, channel };
}

test("1 文: open 受理 → player.open → append（音より先）→ write → end、STARTED で声・ENDED で完了", async () => {
  const { log, player, channel } = makeRig();
  const engine = createFakeVoiceEngine();
  const traces = [];
  const started = [];
  const streamer = createSpeechStreamer({
    engine,
    player,
    channel,
    generationId: "g1",
    onTrace: (event, fields) => traces.push({ event, ...fields }),
    onPlaybackStarted: (info) => started.push(info)
  });
  streamer.enqueue({ text: "こんにちは。", index: 0, final: true });
  const done = streamer.finish();
  await settle();
  assert.deepEqual(log, ["channel.open", "player.open", "channel.append", "player.write", "player.end", "channel.end"]);
  const id = player.opened[0];
  assert.deepEqual(player.calls[0], { op: "open", id, format: { sampleRate: 24000, channels: 1 } });
  assert.deepEqual(channel.sent.map((s) => [s.op, s.utteranceId]), [["open", id], ["append", id], ["end", id]]);
  assert.deepEqual(channel.sent[1].timeline, [{ timeMs: 0, vowel: "a", s: 0.5 }]);
  assert.equal(streamer.snapshot().hasAudiblyStarted, false);

  player.emit("started", id, { atMs: 1234 });
  assert.equal(started.length, 1);
  assert.equal(started[0].atMs, 1234);
  assert.equal(streamer.snapshot().active?.startedAtMs, 1234);
  player.emit("ended", id);
  const outcome = await done;
  assert.equal(outcome.status, "completed");
  assert.equal(outcome.terminalCause, "completed");
  assert.equal(outcome.playedText, "こんにちは。");
  assert.equal(outcome.completedSentenceCount, 1);
  assert.equal(channel.sent.some((s) => s.op === "set"), false, "自然完了は endSpeech だけ（release しない）");
  assert.equal(player.listenerCount(), 0, "settle で player の購読を外す");
  // 遅延の材料（engine に依存しない名前・jobId 付き・本文なし）。
  const names = traces.map((t) => t.event);
  for (const name of ["voice.synthesis.requested", "voice.audio.first_chunk", "voice.synthesis.completed", "speech.playback.activated", "voice.player.started", "voice.player.ended"]) {
    assert.ok(names.includes(name), name);
  }
  assert.ok(names.indexOf("voice.synthesis.requested") < names.indexOf("voice.audio.first_chunk"));
  assert.ok(names.indexOf("voice.audio.first_chunk") < names.indexOf("voice.player.started"));
  assert.equal(traces.find((t) => t.event === "voice.player.started").jobId, "g1:sentence-1");
  assert.ok(!JSON.stringify(traces).includes("こんにちは"));
});

test("FIFO: 後の文の合成が先に終わっても、鳴らす順と器への open は enqueue 順・前の文の ENDED の後", async () => {
  const { player, channel } = makeRig();
  const first = deferred();
  const engine = createFakeVoiceEngine({
    synthesizeImpl: (text) =>
      (async function* () {
        if (text === "一。") await first.promise;
        yield* defaultFakeChunks(text);
      })()
  });
  const streamer = createSpeechStreamer({ engine, player, channel, generationId: "fifo" });
  streamer.enqueue({ text: "一。", index: 0, final: false });
  streamer.enqueue({ text: "二。", index: 1, final: true });
  assert.deepEqual(engine.requests.map((r) => r.text), ["一。", "二。"], "次の文は裏ですぐ合成を始める");
  const done = streamer.finish();
  await settle();
  assert.equal(player.opened.length, 0, "先頭の文が揃うまで後の文を追い越させない");
  assert.equal(channel.sent.length, 0);
  first.resolve();
  await settle();
  assert.equal(player.opened.length, 1);
  assert.equal(channel.sent.filter((s) => s.op === "open").length, 1, "二文目の open は番が来るまで送らない");
  player.emitFor("started", 0);
  player.emitFor("ended", 0);
  await settle();
  assert.equal(player.opened.length, 2);
  assert.deepEqual(streamer.snapshot().playedChunks.map((c) => c.text), ["一。"]);
  player.emitFor("started", 1);
  player.emitFor("ended", 1);
  const outcome = await done;
  assert.equal(outcome.playedText, "一。二。");
  assert.notEqual(player.opened[0], player.opened[1]);
});

test("口の時間割: 512 要素ごとに分けて append し、続きのかたまりも届くたびに送る", async () => {
  const { player, channel } = makeRig();
  const more = deferred();
  const entries = Array.from({ length: SPEECH_STREAM_APPEND_MAX_ITEMS + 10 }, (_, i) => ({ timeMs: i * 10, vowel: "a", s: 0.5 }));
  const engine = createFakeVoiceEngine({
    synthesizeImpl: () =>
      (async function* () {
        yield { type: "format", sampleRate: 24000, channels: 1 };
        yield { type: "audio", pcm: new Uint8Array(4) };
        yield { type: "timeline", entries };
        await more.promise;
        yield { type: "audio", pcm: new Uint8Array(8) };
        yield { type: "timeline", entries: [{ timeMs: 99999, vowel: "o", s: 0.6 }] };
        yield { type: "end" };
      })()
  });
  const streamer = createSpeechStreamer({ engine, player, channel });
  streamer.enqueue({ text: "長い文" });
  const done = streamer.finish();
  await settle();
  const appends = () => channel.sent.filter((s) => s.op === "append").map((s) => s.timeline.length);
  assert.deepEqual(appends(), [512, 10]);
  assert.equal(channel.sent.some((s) => s.op === "end"), false, "engine の end までは end を送らない");
  more.resolve();
  await settle();
  assert.deepEqual(appends(), [512, 10, 1]);
  assert.deepEqual(player.calls.filter((c) => c.op === "write").map((c) => c.bytes), [4, 8]);
  assert.equal(channel.sent.at(-1).op, "end");
  player.emit("started");
  player.emit("ended");
  assert.equal((await done).status, "completed");
});

test("割り込み: 最初の STARTED の前は効かない・後は player.stop → 口の release・後ろの文の合成を signal で中止", async () => {
  const { log, player, channel } = makeRig();
  const hold = deferred();
  const engine = createFakeVoiceEngine({
    synthesizeImpl: (text, opts) =>
      (async function* () {
        if (text === "後。") await hold.promise;
        yield* defaultFakeChunks(text);
      })()
  });
  const releases = [];
  const streamer = createSpeechStreamer({
    engine,
    player,
    channel,
    releaseMouth: (info) => {
      releases.push(info.cause);
      return channel.sendSet({ slotId: "mouth-open", value: 0, ttlMs: 400 });
    }
  });
  streamer.enqueue({ text: "先。", index: 0 });
  streamer.enqueue({ text: "後。", index: 1 });
  await settle();
  assert.equal(streamer.bargeIn(), false, "STARTED 前の割り込みは同じ世代のまま続ける");
  player.emitFor("started", 0);
  assert.equal(streamer.bargeIn(), true);
  assert.equal(streamer.bargeIn(), false, "冪等");
  assert.equal(engine.requests[1].signal?.aborted, true, "鳴らしていない文の合成にも中止を伝える");
  assert.equal(engine.requests[0].signal?.aborted, true);
  const outcome = await streamer.whenSettled();
  assert.equal(outcome.status, "cancelled");
  assert.equal(outcome.terminalCause, "barge-in");
  assert.equal(outcome.playedText, "", "鳴り終わっていない文は playedText に入れない");
  assert.deepEqual(releases, ["barge-in"]);
  assert.ok(log.indexOf("player.stop") < log.indexOf("channel.release"));
  hold.resolve();
  await settle();
  assert.equal(player.opened.length, 1, "中止した後の文は鳴らさない");
});

test("文と文の間（鳴っている文がない）の割り込みは stop も release もしない", async () => {
  const { player, channel } = makeRig();
  const hold = deferred();
  const engine = createFakeVoiceEngine({
    synthesizeImpl: (text) =>
      (async function* () {
        if (text === "後。") await hold.promise;
        yield* defaultFakeChunks(text);
      })()
  });
  const streamer = createSpeechStreamer({ engine, player, channel });
  streamer.enqueue({ text: "先。", index: 0 });
  streamer.enqueue({ text: "後。", index: 1 });
  await settle();
  player.emitFor("started", 0);
  player.emitFor("ended", 0);
  await settle();
  assert.equal(streamer.snapshot().activePlaybackId, null);
  assert.equal(streamer.bargeIn(), true);
  const outcome = await streamer.whenSettled();
  assert.equal(outcome.playedText, "先。");
  assert.equal(player.stops, 0);
  assert.equal(channel.sent.some((s) => s.op === "set"), false);
});

test("kill / dispose: 閉じて release・dispose は購読も外す・遅れて届いた ENDED で完了にならない", async () => {
  for (const action of ["kill", "dispose"]) {
    const { player, channel } = makeRig();
    const streamer = createSpeechStreamer({ engine: createFakeVoiceEngine(), player, channel });
    streamer.enqueue({ text: "あ。" });
    await settle();
    player.emitFor("started", 0);
    assert.equal(action === "kill" ? streamer.kill() : streamer.dispose(), true);
    const outcome = await streamer.whenSettled();
    assert.equal(outcome.status, "cancelled");
    assert.equal(outcome.terminalCause, action === "kill" ? "killed" : "disposed");
    assert.equal(player.stops, 1);
    assert.equal(channel.sent.filter((s) => s.op === "set").length, 1, "既定の release は mouth-open=0");
    assert.deepEqual(channel.sent.find((s) => s.op === "set").intent, { slotId: "mouth-open", value: 0, ttlMs: 400 });
    player.emitFor("ended", 0);
    assert.equal(streamer.snapshot().completedSentenceCount, 0);
    assert.equal(player.listenerCount(), 0);
  }
});

test("失敗: 合成の失敗は prepare-failed（鳴らす前なら release しない）・合成が同期に投げても enqueue を巻き込まない", async () => {
  const { player, channel } = makeRig();
  const failing = createFakeVoiceEngine({
    synthesizeImpl: () =>
      (async function* () {
        await Promise.resolve();
        throw Object.assign(new Error("provider"), { code: "tts_synthesis_failed" });
      })()
  });
  const s1 = createSpeechStreamer({ engine: failing, player, channel });
  s1.enqueue({ text: "失敗。" });
  const o1 = await s1.whenSettled();
  assert.equal(o1.status, "failed");
  assert.equal(o1.terminalCause, "prepare-failed");
  assert.equal(/** @type {any} */ (s1.failure()).code, "tts_synthesis_failed");
  assert.equal(channel.sent.length, 0);

  const syncThrow = createFakeVoiceEngine({
    synthesizeImpl: () => {
      throw new Error("sync");
    }
  });
  const s2 = createSpeechStreamer({ engine: syncThrow, player, channel });
  assert.doesNotThrow(() => s2.enqueue({ text: "同期。" }));
  assert.equal((await s2.whenSettled()).terminalCause, "prepare-failed");
  assert.throws(() => s2.enqueue({ text: "もう一つ。" }), /not accepting/);
});

test("失敗: 器の open 拒否・送信失敗は play-failed（code 付き）・口の release を送る・player は開かない", async () => {
  const rejected = makeRig({
    channel: { reply: (/** @type {string} */ op) => (op === "open" ? { result: "rejected", error: { code: "slotNotWritable", message: "x" }, rttMs: 1 } : undefined) }
  });
  const s1 = createSpeechStreamer({ engine: createFakeVoiceEngine(), player: rejected.player, channel: rejected.channel });
  s1.enqueue({ text: "拒否。" });
  const o1 = await s1.whenSettled();
  assert.equal(o1.terminalCause, "play-failed");
  assert.equal(/** @type {any} */ (s1.failure()).code, "speech_rejected");
  assert.equal(/** @type {any} */ (s1.failure()).diagnosticStage, "control_channel.rejection");
  assert.equal(rejected.player.opened.length, 0);
  assert.equal(rejected.channel.sent.filter((s) => s.op === "set").length, 1, "open を送ったら必ず口を閉じる側に倒す");

  const thrown = makeRig({
    channel: {
      reply: (/** @type {string} */ op) => {
        if (op === "open") throw Object.assign(new Error("closed"), { code: "channel_closed" });
        return undefined;
      }
    }
  });
  const s2 = createSpeechStreamer({ engine: createFakeVoiceEngine(), player: thrown.player, channel: thrown.channel });
  s2.enqueue({ text: "切断。" });
  await s2.whenSettled();
  assert.equal(/** @type {any} */ (s2.failure()).code, "channel_closed");
  assert.equal(thrown.player.opened.length, 0);
});

test("失敗: player の ERROR / 外からの STOPPED / 異常終了は世代を閉じて release する", async () => {
  for (const [type, cause] of [["error", "error"], ["stopped", "stopped"], ["exit", "error"]]) {
    const { player, channel } = makeRig();
    const streamer = createSpeechStreamer({ engine: createFakeVoiceEngine(), player, channel });
    streamer.enqueue({ text: "あ。" });
    await settle();
    player.emitFor("started", 0);
    player.emit(/** @type {any} */ (type), type === "exit" ? null : player.opened[0]);
    const outcome = await streamer.whenSettled();
    assert.equal(outcome.terminalCause, cause, type);
    assert.equal(channel.sent.filter((s) => s.op === "set").length, 1, type);
  }
});

test("見張り: STARTED が来ない・ENDED が来ないと error で閉じる（音の長さ + 余裕）", async () => {
  /** @type {Array<{ fn: () => void; ms: number }>} */
  const timers = [];
  const setTimeoutImpl = /** @type {any} */ ((fn, ms) => {
    timers.push({ fn, ms });
    return timers.length;
  });
  const clearTimeoutImpl = /** @type {any} */ ((id) => {
    if (timers[id - 1]) timers[id - 1].fn = () => {};
  });
  const { player, channel } = makeRig();
  const s1 = createSpeechStreamer({ engine: createFakeVoiceEngine(), player, channel, setTimeoutImpl, clearTimeoutImpl, playbackStartTimeoutMs: 1234 });
  s1.enqueue({ text: "あ。" });
  await settle();
  assert.equal(timers[0].ms, 1234);
  timers[0].fn();
  assert.equal((await s1.whenSettled()).terminalCause, "error");
  assert.equal(/** @type {any} */ (s1.failure()).code, "player_start_timeout");

  timers.length = 0;
  const rig = makeRig();
  let clock = 1000;
  const engine = createFakeVoiceEngine({
    chunksFor: () => [
      { type: "format", sampleRate: 24000, channels: 1 },
      { type: "audio", pcm: new Uint8Array(48000) }, // 1 秒分
      { type: "end" }
    ]
  });
  const s2 = createSpeechStreamer({ engine, player: rig.player, channel: rig.channel, setTimeoutImpl, clearTimeoutImpl, nowImpl: () => clock, playbackCompletionMarginMs: 750 });
  s2.enqueue({ text: "い。" });
  await settle();
  rig.player.emit("started", rig.player.opened[0], { atMs: 1000 });
  const completion = timers.at(-1);
  assert.equal(completion?.ms, 1750);
  completion?.fn();
  assert.equal(/** @type {any} */ (s2.failure()).code, "player_end_timeout");
});

test("音のない文: STARTED なしの ENDED で完了する", async () => {
  const { player, channel } = makeRig();
  const engine = createFakeVoiceEngine({
    chunksFor: () => [{ type: "format", sampleRate: 44100, channels: 1 }, { type: "timeline", entries: [{ timeMs: 100, vowel: "a", s: 0.85 }] }, { type: "end" }]
  });
  const streamer = createSpeechStreamer({ engine, player, channel });
  streamer.enqueue({ text: "無音。" });
  const done = streamer.finish();
  await settle();
  assert.equal(player.calls.filter((c) => c.op === "write").length, 0);
  player.emit("ended", player.opened[0]);
  const outcome = await done;
  assert.equal(outcome.status, "completed");
  assert.equal(outcome.hasAudiblyStarted, false);
});

test("endSpeech が届かなかった文は、鳴り終わりで口の release を送る（開けっぱなしにしない）", async () => {
  const { player, channel } = makeRig({
    channel: { reply: (/** @type {string} */ op) => (op === "end" ? { result: "rejected", error: { code: "x" }, rttMs: 1 } : undefined) }
  });
  const streamer = createSpeechStreamer({ engine: createFakeVoiceEngine(), player, channel });
  streamer.enqueue({ text: "あ。" });
  const done = streamer.finish();
  await settle();
  player.emitFor("started", 0);
  player.emitFor("ended", 0);
  const outcome = await done;
  assert.equal(outcome.status, "completed", "end の失敗で声は止めない");
  assert.equal(channel.sent.filter((s) => s.op === "set").length, 1);
});

test("古い発話の事象（別 id）は今の文に効かない", async () => {
  const { player, channel } = makeRig();
  const streamer = createSpeechStreamer({ engine: createFakeVoiceEngine(), player, channel });
  streamer.enqueue({ text: "あ。" });
  const done = streamer.finish();
  await settle();
  player.emit("started", "old-utterance");
  player.emit("ended", "old-utterance");
  player.emit("stopped", "old-utterance");
  player.emit("stopped", null);
  assert.equal(streamer.snapshot().hasAudiblyStarted, false);
  assert.equal(streamer.snapshot().status, "open");
  player.emitFor("started", 0);
  player.emitFor("ended", 0);
  assert.equal((await done).status, "completed");
});

test("空の世代: 文が無いまま finish すると completed で閉じる", async () => {
  const { player, channel } = makeRig();
  const streamer = createSpeechStreamer({ engine: createFakeVoiceEngine(), player, channel });
  const outcome = await streamer.finish();
  assert.equal(outcome.status, "completed");
  assert.equal(outcome.enqueuedSentenceCount, 0);
  assert.throws(() => streamer.enqueue({ text: "遅い。" }), /not accepting/);
});

test("入口の検査: engine / player / channel の形が足りなければ投げる", () => {
  const { player, channel } = makeRig();
  assert.throws(() => createSpeechStreamer(/** @type {any} */ ({ engine: {}, player, channel })), /voice engine/);
  assert.throws(() => createSpeechStreamer(/** @type {any} */ ({ engine: createFakeVoiceEngine(), player: { play() {} }, channel })), /stream player/);
  assert.throws(() => createSpeechStreamer(/** @type {any} */ ({ engine: createFakeVoiceEngine(), player, channel: { sendSpeech() {} } })), /openSpeech/);
});

test("speakOnce: 鳴らし始めたら返り、ended は ENDED で解決（WAV 長のタイマーは使わない）", async () => {
  const { player, channel } = makeRig();
  const handle = await speakOnce("こんにちは", { engine: createFakeVoiceEngine(), player, channel });
  assert.equal(player.opened.length, 1);
  let ended = false;
  void handle.ended.then(() => {
    ended = true;
  });
  await settle();
  assert.equal(ended, false);
  player.emitFor("started", 0);
  assert.equal(typeof handle.snapshot().startedAtMs, "number");
  assert.deepEqual(handle.snapshot().timeline, [{ timeMs: 0, vowel: "a", s: 0.5 }]);
  player.emitFor("ended", 0);
  const outcome = await handle.ended;
  assert.equal(outcome.status, "completed");
});

test("speakOnce: 鳴らす前の失敗は code 付きで投げる・stop(cause) は止めて release し、切断点の材料を残す", async () => {
  const rig = makeRig({ channel: { reply: (/** @type {string} */ op) => (op === "open" ? { result: "rejected", error: { code: "invalidPayload" }, rttMs: 1 } : undefined) } });
  await assert.rejects(
    () => speakOnce("だめ", { engine: createFakeVoiceEngine(), player: rig.player, channel: rig.channel }),
    (/** @type {any} */ error) => error.code === "speech_rejected" && /invalidPayload/.test(error.message)
  );

  const { player, channel } = makeRig();
  const causes = [];
  const handle = await speakOnce("こんにちは", {
    engine: createFakeVoiceEngine(),
    player,
    channel,
    releaseMouth: (info) => {
      causes.push(info.cause);
    }
  });
  player.emit("started", player.opened[0], { atMs: 5000 });
  await handle.stop("barge-in");
  assert.equal(player.stops, 1);
  assert.deepEqual(causes, ["barge-in"]);
  assert.equal(handle.snapshot().startedAtMs, 5000, "止めた後も STARTED 時刻と時間割を返す");
  assert.equal(handle.snapshot().timeline.length, 1);
  assert.equal((await handle.ended).status, "cancelled");
});

test("speakOnce: 鳴らし始めた後の失敗でも、ended は失敗の時刻を返し、snapshot() は止まる前の時間割と STARTED 時刻を返す", async () => {
  const { player, channel } = makeRig();
  const engine = createFakeVoiceEngine({
    chunksFor: () => [
      { type: "format", sampleRate: 24000, channels: 1 },
      { type: "timeline", entries: [{ timeMs: 0, vowel: "a", s: 0.5 }, { timeMs: 100, vowel: "i", s: 0.5 }] },
      { type: "audio", pcm: new Uint8Array(480) },
      { type: "end" }
    ]
  });
  const handle = await speakOnce("あい", { engine, player, channel });
  await settle();
  player.emit("started", player.opened[0], { atMs: 2000 });
  player.emit("error", player.opened[0], { atMs: 2150 });
  const outcome = await handle.ended;
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.cause, "error");
  assert.equal(outcome.atMs, 2150, "失敗の時刻は player の事象の atMs");
  assert.equal(/** @type {any} */ (outcome.error).code, "player_error");
  assert.deepEqual(handle.snapshot(), {
    timeline: [{ timeMs: 0, vowel: "a", s: 0.5 }, { timeMs: 100, vowel: "i", s: 0.5 }],
    startedAtMs: 2000
  });
});

test("createSpeechStreamer: 世代を閉じたとき鳴らしていた文を stoppedActive に残す（閉じた時刻つき・自然完了では null）", async () => {
  const { player, channel } = makeRig();
  const streamer = createSpeechStreamer({ engine: createFakeVoiceEngine(), player, channel, nowImpl: () => 777 });
  streamer.enqueue({ text: "一。" });
  const done = streamer.finish();
  await settle();
  player.emit("started", player.opened[0], { atMs: 700 });
  assert.equal(streamer.snapshot().stoppedActive, null);
  streamer.abort("error");
  const outcome = await done;
  assert.equal(outcome.active, null);
  assert.deepEqual(outcome.stoppedActive, {
    jobId: outcome.stoppedActive.jobId,
    index: 0,
    playbackId: player.opened[0],
    started: true,
    startedAtMs: 700,
    timeline: [{ timeMs: 0, vowel: "a", s: 0.5 }],
    stoppedAtMs: 777
  });

  const rig = makeRig();
  const natural = createSpeechStreamer({ engine: createFakeVoiceEngine(), player: rig.player, channel: rig.channel });
  natural.enqueue({ text: "二。" });
  const naturalDone = natural.finish();
  await settle();
  rig.player.emitFor("started", 0);
  rig.player.emitFor("ended", 0);
  assert.equal((await naturalDone).stoppedActive, null);
});

test("一括の読み上げの長い返事: 512 を超える時間割も 1 発話のまま、器へは 1 回 512 要素以下に分けて append する", async () => {
  const { player, channel } = makeRig();
  const voiced = 1300;
  const moras = Array.from({ length: voiced }, (_, i) => ({ text: "ア", vowel: i % 2 === 0 ? "a" : "i" }));
  const wav = buildWavBytes({ dataBytes: 44100 * 2 * 60, includeBody: true });
  const engine = createAivisVoiceEngine({
    tts: {
      async audioQuery() {
        return { accent_phrases: [{ moras, pause_mora: null }], prePhonemeLength: 0, postPhonemeLength: 0 };
      },
      async synthesis() {
        return wav;
      }
    }
  });
  const handle = await speakOnce("長い返事", { engine, player, channel });
  await settle();
  const appends = channel.sent.filter((s) => s.op === "append").map((s) => s.timeline.length);
  assert.deepEqual(appends, [512, 512, 276]);
  assert.ok(appends.every((n) => n <= SPEECH_STREAM_APPEND_MAX_ITEMS));
  assert.equal(channel.sent.filter((s) => s.op === "open").length, 1, "1 発話のまま");
  assert.deepEqual([...new Set(channel.sent.map((s) => s.utteranceId))], [player.opened[0]], "open / append / end は同じ発話 id");
  assert.equal(channel.sent.at(-1).op, "end");
  player.emitFor("started", 0);
  player.emitFor("ended", 0);
  assert.equal((await handle.ended).status, "completed");
});

test("AivisSpeech engine と組んだ 1 文: 均等割りの時間割を append・WAV の PCM 部を write（一時 WAV なし）", async () => {
  const { player, channel } = makeRig();
  const wav = buildWavBytes({ dataBytes: 8820, includeBody: true });
  const engine = createAivisVoiceEngine({
    tts: {
      async audioQuery() {
        return { accent_phrases: [{ moras: [{ text: "ア", vowel: "a" }, { text: "イ", vowel: "i" }], pause_mora: null }], prePhonemeLength: 0, postPhonemeLength: 0 };
      },
      async synthesis() {
        return wav;
      }
    }
  });
  const handle = await speakOnce("あい", { engine, player, channel });
  await settle();
  assert.deepEqual(player.calls[0].format, { sampleRate: 44100, channels: 1 });
  assert.deepEqual(player.calls.filter((c) => c.op === "write").map((c) => c.bytes), [8820]);
  assert.deepEqual(channel.sent.find((s) => s.op === "append").timeline, [
    { timeMs: 0, vowel: "a", s: 0.85 },
    { timeMs: 50, vowel: "i", s: 0.5 }
  ]);
  player.emitFor("started", 0);
  player.emitFor("ended", 0);
  assert.equal((await handle.ended).status, "completed");
});
