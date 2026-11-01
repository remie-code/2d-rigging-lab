// @ts-check
/**
 * Discord モード Domain E: 運び手（src/voice/speech-streamer.mjs・変えていない）の見張りと Discord 向けの再生器の関係
 * （discord-mode.md §7.3・§7.4・§12.3）。偽の時計（src/test-support/fake-clock.mjs）と偽の @discordjs/voice（20ms ずつ進める）で、
 * 本物の運び手に Discord 向けの再生器を差して確かめる。
 *  - STARTED の見張り（最初の音を書いてから 5 秒）: 音が届けば Playing = started がすぐ出る（見張りに引っかからない）。
 *  - ENDED の見張り（started + 音の長さ + 750ms）: started の遅れ 100ms が無音の詰め物 100ms をちょうど打ち消す。
 *    合成が実時間に遅れて生じた途切れの合計が 500ms なら間に合う。1 秒なら打ち切られる（限界の確かめ・ゲート 2 で見る）。
 *  - 相手が Ready でない（AutoPaused）: started は出るが、戻らなければ ENDED の見張りで打ち切られる。短い間（300ms）なら間に合う。
 *  - 割り込み: 切断点の材料の startedAtMs は Playing の時刻 + 遅れ。computeSpokenPrefix（変えていない）で少なめに数える。
 *  - 場を閉じた（再生器の dispose）: 進行中の発話は stopped で世代を閉じる（見張りの時間切れを待たない）。
 * 本物の Discord・TTS・音の保存は無い。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { createSpeechStreamer, DEFAULT_PLAYBACK_COMPLETION_MARGIN_MS, DEFAULT_PLAYBACK_START_TIMEOUT_MS } from "../voice/speech-streamer.mjs";
import { computeSpokenPrefix } from "../mind/barge-in.mjs";
import { createDiscordStreamPlayer, DEFAULT_DISCORD_STARTED_DELAY_MS } from "./discord-stream-player.mjs";
import { createFakeDiscordAudio, fakeSubscribe } from "../test-support/fake-discord-audio.mjs";
import { createFakeClock } from "../test-support/fake-clock.mjs";
import { createFakeVoiceEngine } from "../test-support/fake-voice-engine.mjs";

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** 24kHz モノラル（ms ぶん）。 @param {number} ms */
const pcm24k = (ms) => new Uint8Array(Buffer.alloc(Math.round(24 * ms) * 2, 1));

/**
 * 合成の段取り: [{ audioMs } | { waitMs }] の順に、音のかたまりを出す・偽の時計で待つ。最初に 24kHz モノラルの形と、
 * 100ms ごとの母音の時間割（音の長さぶん）を出す。
 * @param {ReturnType<typeof createFakeClock>} clock @param {Array<{ audioMs?: number; waitMs?: number }>} plan
 */
function plannedEngine(clock, plan) {
  const totalMs = plan.reduce((n, step) => n + (step.audioMs ?? 0), 0);
  const sleep = (/** @type {number} */ ms) => new Promise((resolve) => clock.setTimeoutImpl(resolve, ms));
  return createFakeVoiceEngine({
    synthesizeImpl: () =>
      (async function* () {
        yield { type: "format", sampleRate: 24000, channels: 1 };
        yield {
          type: "timeline",
          entries: Array.from({ length: Math.floor(totalMs / 100) }, (_, i) => ({ timeMs: i * 100, vowel: "a", s: 0.5 }))
        };
        for (const step of plan) {
          if (step.waitMs) await sleep(step.waitMs);
          if (step.audioMs) yield { type: "audio", pcm: pcm24k(step.audioMs) };
        }
        yield { type: "end" };
      })()
  });
}

/**
 * 本物の運び手 + Discord 向けの再生器 + 偽の時計。
 * @param {Array<{ audioMs?: number; waitMs?: number }>} plan @param {{ status?: string; text?: string }} [opts]
 */
function rig(plan, opts = {}) {
  const clock = createFakeClock();
  const audio = createFakeDiscordAudio();
  const connection = {
    state: { status: opts.status ?? "ready" },
    /** @param {any} p */
    subscribe(p) {
      return fakeSubscribe(this, p);
    }
  };
  const player = createDiscordStreamPlayer({ voice: audio, connection, nowImpl: clock.now });
  /** @type {any[]} */
  const playerEvents = [];
  player.onEvent((e) => playerEvents.push({ type: e.type, atMs: e.atMs }));
  /** @type {number | null} */
  let playingAtMs = null;
  audio.players[0].on("playing", () => {
    if (playingAtMs === null) playingAtMs = clock.now();
  });
  /** @type {any[]} */
  const traces = [];
  const streamer = createSpeechStreamer({
    engine: plannedEngine(clock, plan),
    player,
    channel: null,
    generationId: "discord-e",
    nowImpl: clock.now,
    setTimeoutImpl: /** @type {any} */ (clock.setTimeoutImpl),
    clearTimeoutImpl: /** @type {any} */ (clock.clearTimeoutImpl),
    onTrace: (event, fields) => traces.push({ event, ...fields })
  });
  /** @type {any} */
  let outcome = null;
  streamer.enqueue({ text: opts.text ?? "あいうえおかきくけこ", index: 0, final: true });
  void streamer.finish().then((o) => {
    outcome = o;
  });
  return {
    clock,
    audio,
    connection,
    player,
    streamer,
    playerEvents,
    traces,
    playingAtMs: () => playingAtMs,
    outcome: () => outcome,
    /** 20ms ずつ（時計 → 合成の続き → 再生の 1 周期）。 @param {number} ms */
    async run(ms) {
      for (let t = 0; t < ms; t += 20) {
        await settle();
        clock.advance(20);
        await settle();
        audio.step(1);
      }
      await settle();
    }
  };
}

test("前提: 運び手の見張りは STARTED 5 秒・ENDED は started + 音の長さ + 750ms（変えていない）・started の遅れの既定は 100ms", () => {
  assert.equal(DEFAULT_PLAYBACK_START_TIMEOUT_MS, 5000);
  assert.equal(DEFAULT_PLAYBACK_COMPLETION_MARGIN_MS, 750);
  assert.equal(DEFAULT_DISCORD_STARTED_DELAY_MS, 100);
});

test("途切れなし（合成が実時間より速い）: すぐ started・鳴り終わって ended・見張りに引っかからずに完了", async () => {
  const r = rig([{ audioMs: 200 }, { audioMs: 200 }, { audioMs: 200 }, { audioMs: 200 }, { audioMs: 200 }]);
  await r.run(100);
  assert.notEqual(r.playingAtMs(), null);
  assert.equal(r.outcome(), null, "まだ鳴っている");
  await r.run(1200);
  const o = r.outcome();
  assert.ok(o, "完了した");
  assert.equal(o.status, "completed", JSON.stringify(o.terminalCause));
  assert.equal(o.playedText, "あいうえおかきくけこ");
  assert.equal(r.traces.some((t) => /timeout/.test(t.event)), false);
  const started = r.playerEvents.find((e) => e.type === "started");
  assert.equal(started.atMs, /** @type {number} */ (r.playingAtMs()) + DEFAULT_DISCORD_STARTED_DELAY_MS);
});

test("合成が遅れて 500ms 途切れた: 途切れの間は無音（Idle にならない）・ENDED の見張りに間に合って完了", async () => {
  // 400ms ぶん届いてから 900ms 待つ → 400ms 鳴らしたあと 500ms 途切れる → 残り 600ms。
  const r = rig([{ audioMs: 200 }, { audioMs: 200 }, { waitMs: 900 }, { audioMs: 200 }, { audioMs: 200 }, { audioMs: 200 }]);
  await r.run(2400);
  const o = r.outcome();
  assert.ok(o);
  assert.equal(o.status, "completed", JSON.stringify(o.terminalCause));
  assert.ok(r.audio.record.silenceSent >= 25, "途切れの間は無音を送った");
});

test("限界の確かめ: 合成が遅れて 1 秒途切れると、鳴り終わる前に ENDED の見張り（started + 長さ + 750ms）で打ち切られる", async () => {
  const r = rig([{ audioMs: 200 }, { audioMs: 200 }, { waitMs: 1400 }, { audioMs: 200 }, { audioMs: 200 }, { audioMs: 200 }]);
  await r.run(3000);
  const o = r.outcome();
  assert.ok(o);
  assert.equal(o.status, "failed");
  assert.equal(/** @type {any} */ (r.streamer.failure())?.code, "player_end_timeout");
  assert.ok(r.traces.some((t) => t.event === "speech.playback.completion_timeout"));
  assert.equal(r.audio.players[0].state.status, "idle", "打ち切りで player.stop → 止まる");
});

test("相手が Ready でない（AutoPaused）: started は出る（STARTED の見張りには引っかからない）が、戻らなければ ENDED の見張りで打ち切られる", async () => {
  const r = rig([{ audioMs: 500 }], { status: "connecting" });
  await r.run(200);
  assert.ok(r.playerEvents.some((e) => e.type === "started"));
  assert.equal(r.audio.players[0].state.status, "autopaused");
  await r.run(1500);
  const o = r.outcome();
  assert.ok(o);
  assert.equal(o.status, "failed");
  assert.equal(/** @type {any} */ (r.streamer.failure())?.code, "player_end_timeout");
  assert.equal(r.audio.record.framesSent, 0, "Ready でない間は送っていない");
});

test("相手が 300ms だけ Ready でなかった: 戻れば続きを鳴らし、ENDED の見張りに間に合って完了", async () => {
  const r = rig([{ audioMs: 600 }]);
  await r.run(200);
  r.connection.state = { status: "connecting" };
  await r.run(300);
  r.connection.state = { status: "ready" };
  await r.run(1000);
  const o = r.outcome();
  assert.ok(o);
  assert.equal(o.status, "completed", JSON.stringify(o.terminalCause));
});

test("割り込み: 切断点の材料の startedAtMs は Playing の時刻 + 遅れ。今の計算（computeSpokenPrefix）のまま少なめに数える", async () => {
  const r = rig([{ audioMs: 1000 }]);
  await r.run(40);
  const playingAt = /** @type {number} */ (r.playingAtMs());
  assert.notEqual(playingAt, null);
  // Playing から 500ms 後に割り込む。
  await r.run(playingAt + 500 - r.clock.now());
  const interruptAt = r.clock.now();
  const snapBefore = r.streamer.snapshot();
  assert.equal(snapBefore.active?.startedAtMs, playingAt + DEFAULT_DISCORD_STARTED_DELAY_MS);
  assert.equal(r.streamer.bargeIn(), true);
  await settle();
  const snap = r.streamer.snapshot();
  assert.equal(snap.status, "cancelled");
  assert.equal(snap.stoppedActive?.startedAtMs, playingAt + DEFAULT_DISCORD_STARTED_DELAY_MS);
  const timeline = /** @type {any} */ (snap.stoppedActive).timeline;
  const text = "あいうえおかきくけこ";
  const withDelay = computeSpokenPrefix({ speechText: text, timeline, elapsedMs: interruptAt - /** @type {number} */ (snap.stoppedActive?.startedAtMs) });
  const withoutDelay = computeSpokenPrefix({ speechText: text, timeline, elapsedMs: interruptAt - playingAt });
  assert.equal(withoutDelay.charsSpoken, 5);
  assert.equal(withDelay.charsSpoken, 4, "網の遅れのぶん少なめに「言った」とする");
  assert.equal(r.audio.record.stops.at(-1), false, "鳴っている所を余韻つきで止める");
});

test("場を閉じた（再生器を畳んだ）: 進行中の発話は stopped で世代を閉じる（見張りの時間切れを待たない）", async () => {
  const r = rig([{ audioMs: 2000 }]);
  await r.run(300);
  assert.equal(r.outcome(), null);
  r.player.dispose();
  await settle();
  await settle();
  const o = r.outcome();
  assert.ok(o, "すぐ閉じる");
  assert.equal(o.terminalCause, "stopped");
  assert.equal(r.clock.pending().length, 0, "見張りのタイマーは残らない");
});
