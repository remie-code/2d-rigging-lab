// @ts-check
/**
 * Discord モード Domain E: Discord 向けの再生器（discord-mode.md §7.1・§7.3・§7.4）を偽の @discordjs/voice
 * （src/test-support/fake-discord-audio.mjs・本物の 0.19.2 の AudioPlayer の状態の動きを 20ms ずつ写したもの）で確かめる。
 *  - 作るとき: noSubscriber は Pause・maxMissedFrames は大きく（1.5 秒）・接続に結ぶ（subscribe）。
 *  - open: 発話ごとに 1 本の流れと Raw の resource・鳴らし始める。write: 48kHz ステレオに変えて流す。end: 流れを閉じ、Idle で ended。
 *  - 事象の形と id の扱いは手元の再生器（stream-player / fake-stream-player）と同じ（started / ended / stopped / error・atMs）。
 *  - started の atMs は Playing の時刻 + 決まった遅れ（既定 100ms・替えられる・上限つき）。
 *  - 途切れ: maxMissedFrames より短い途切れは Idle にならない（既定の 5 フレームなら 100ms で Idle になる落とし穴の確かめ）。
 *    長すぎる途切れは end の前の Idle = error。
 *  - stop（鳴っているときは無音 100ms の余韻・鳴っていないときは即）・置き換え・音の無い発話・AutoPaused・dispose。
 * 本物の Discord・網・音の保存は無い。
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createDiscordStreamPlayer,
  DEFAULT_DISCORD_MAX_MISSED_FRAMES,
  DEFAULT_DISCORD_STARTED_DELAY_MS,
  DISCORD_PLAYER_MESSAGES
} from "./discord-stream-player.mjs";
import { createFakeDiscordAudio, fakeSubscribe, FAKE_FRAME_BYTES } from "../test-support/fake-discord-audio.mjs";
import { createFakeStreamPlayer } from "../test-support/fake-stream-player.mjs";

const settle = () => new Promise((resolve) => setImmediate(resolve));

/** 24kHz モノラルの PCM（ms ぶん・中身はうるさくない一定値）。 @param {number} ms */
const pcm24k = (ms) => {
  const b = Buffer.alloc(Math.round(24 * ms) * 2);
  for (let i = 0; i < b.length; i += 2) b.writeInt16LE(1000, i);
  return new Uint8Array(b);
};

/** @param {object} [opts] @param {string} [status] */
function rig(opts = {}, status = "ready") {
  const audio = createFakeDiscordAudio();
  const connection = {
    state: { status },
    /** @param {any} p */
    subscribe(p) {
      return fakeSubscribe(this, p);
    }
  };
  let nowMs = 10_000;
  const player = createDiscordStreamPlayer({ voice: audio, connection, nowImpl: () => nowMs, ...opts });
  /** @type {any[]} */
  const events = [];
  player.onEvent((e) => events.push(e));
  const ap = audio.players[0];
  return {
    audio,
    connection,
    player,
    events,
    ap,
    now: () => nowMs,
    /** 20ms の周期を n 回（時計も進める）。 @param {number} frames */
    async run(frames) {
      for (let i = 0; i < frames; i += 1) {
        nowMs += 20;
        audio.step(1);
      }
      await settle();
    },
    types: () => events.map((e) => e.type)
  };
}

test("作るとき: noSubscriber は Pause・maxMissedFrames は 75（1.5 秒）・その接続に結ぶ", () => {
  const r = rig();
  assert.equal(DEFAULT_DISCORD_MAX_MISSED_FRAMES, 75);
  assert.deepEqual(r.ap.behaviors, { noSubscriber: "pause", maxMissedFrames: 75 });
  assert.equal(r.ap.subscribers.length, 1);
  assert.equal(r.ap.subscribers[0].connection, r.connection);
  assert.equal(r.player.isAlive(), true);
  assert.deepEqual(r.player.settings, { startedDelayMs: DEFAULT_DISCORD_STARTED_DELAY_MS, maxMissedFrames: 75 });
});

test("1 発話: open で Raw の resource を鳴らし始め、write は 48kHz ステレオで流れ、Playing で started（+100ms）、end → 鳴り終わって ended", async () => {
  const r = rig();
  r.player.open("u1", { sampleRate: 24000, channels: 1 });
  assert.equal(r.audio.resources.length, 1);
  assert.equal(r.audio.resources[0].inputType, "raw", "StreamType.Raw");
  assert.equal(r.ap.state.status, "buffering");
  assert.equal(r.player.write("u1", pcm24k(200)), true);
  await settle();
  assert.equal(r.audio.resources[0].received, 200 * 48 * 2 * 2, "24kHz モノラル 200ms → 48kHz ステレオ 200ms");
  assert.equal(r.ap.state.status, "playing");
  assert.equal(r.events.length, 1);
  assert.deepEqual(r.events[0], { type: "started", id: "u1", atMs: r.now() + DEFAULT_DISCORD_STARTED_DELAY_MS });
  assert.equal(r.player.end("u1"), true);
  await settle();
  await r.run(10); // 200ms
  assert.deepEqual(r.types(), ["started"], "鳴り終わる前は ended を出さない");
  await r.run(6); // 無音の詰め物 5 フレーム → Idle
  assert.deepEqual(r.types(), ["started", "ended"]);
  assert.deepEqual(Object.keys(r.events[1]).sort(), ["atMs", "id", "type"]);
  assert.equal(r.events[1].id, "u1");
  assert.equal(r.audio.record.framesSent, 10, "実音のフレームは 200ms = 10");
  assert.equal(r.player.current(), null);
});

test("手元の再生器と同じ口: 今の発話でない id・end の後の write / end は false・二度目の end は false・形の確かめ", async () => {
  const r = rig();
  assert.equal(r.player.write("nope", pcm24k(20)), false, "開いていない");
  assert.equal(r.player.end("nope"), false);
  r.player.open("u1", { sampleRate: 24000, channels: 1 });
  assert.equal(r.player.write("other", pcm24k(20)), false);
  assert.equal(r.player.write("u1", pcm24k(20)), true);
  assert.equal(r.player.end("u1"), true);
  assert.equal(r.player.end("u1"), false);
  assert.equal(r.player.write("u1", pcm24k(20)), false);
  assert.throws(() => r.player.open("u2", { sampleRate: 7000, channels: 1 }), RangeError);
  assert.throws(() => r.player.open("u2", { sampleRate: 24000, channels: 3 }), RangeError);
  assert.throws(() => r.player.open("bad\tid", { sampleRate: 24000, channels: 1 }), TypeError);
  assert.throws(() => r.player.write("u1", /** @type {any} */ ("pcm")), TypeError);
  // 同じ形の偽物（運び手のテストが使う）と同じ口を持つ。
  const fake = createFakeStreamPlayer();
  for (const method of ["open", "write", "end", "stop", "onEvent", "isAlive", "dispose", "whenReady"]) {
    assert.equal(typeof (/** @type {any} */ (r.player)[method]), "function", method);
    assert.equal(typeof (/** @type {any} */ (fake)[method]), "function", method);
  }
  assert.equal(await r.player.whenReady(), true);
});

test("音の無い発話: 鳴らさずに ended だけ（STARTED なし・手元の再生器と同じ）", async () => {
  const r = rig();
  r.player.open("u0", { sampleRate: 44100, channels: 1 });
  assert.equal(r.player.end("u0"), true);
  await settle();
  assert.deepEqual(r.events.map((e) => [e.type, e.id]), [["ended", "u0"]]);
  assert.equal(r.ap.state.status, "idle");
  await r.run(10);
  assert.deepEqual(r.types(), ["ended"], "Idle の移り変わりで二重に出さない");
});

test("44.1kHz モノラル（AivisSpeech）: 48kHz ステレオに変えて流す・20ms の倍数まで埋めて最後まで鳴らす", async () => {
  const r = rig();
  r.player.open("a1", { sampleRate: 44100, channels: 1 });
  r.player.write("a1", new Uint8Array(Buffer.alloc(4410 * 2))); // 100ms
  r.player.end("a1");
  await settle();
  const received = r.audio.resources[0].received;
  assert.equal(received % FAKE_FRAME_BYTES, 0);
  assert.equal(received, 5 * FAKE_FRAME_BYTES, "100ms = 4800 フレーム = 20ms × 5");
  await r.run(12);
  assert.deepEqual(r.types(), ["started", "ended"]);
});

test("started の遅れは替えられる（0・250）・範囲の外は丸める（負は 0・上限 2000・数でなければ既定）", async () => {
  for (const [given, expected] of [[0, 0], [250, 250], [-5, 0], [99_999, 2000], [Number.NaN, DEFAULT_DISCORD_STARTED_DELAY_MS]]) {
    const r = rig({ startedDelayMs: given });
    assert.equal(r.player.settings.startedDelayMs, expected, String(given));
    r.player.open("u", { sampleRate: 24000, channels: 1 });
    r.player.write("u", pcm24k(40));
    await settle();
    assert.equal(r.events[0].atMs, r.now() + expected);
  }
});

test("途切れ: 1.2 秒の途切れでは Idle にならず続きを鳴らす（maxMissedFrames 75）・長すぎる途切れは end の前の Idle = error", async () => {
  const r = rig();
  r.player.open("g1", { sampleRate: 24000, channels: 1 });
  r.player.write("g1", pcm24k(100));
  await settle();
  await r.run(5 + 60); // 100ms 鳴らして 1.2 秒の途切れ
  assert.equal(r.ap.state.status, "playing", "途切れの間は無音を送って待つ");
  r.player.write("g1", pcm24k(100));
  r.player.end("g1");
  await settle();
  await r.run(5 + 6);
  assert.deepEqual(r.types(), ["started", "ended"]);

  const long = rig();
  long.player.open("g2", { sampleRate: 24000, channels: 1 });
  long.player.write("g2", pcm24k(100));
  await settle();
  await long.run(5 + DEFAULT_DISCORD_MAX_MISSED_FRAMES + 6); // 1.5 秒の途切れ → stop → 詰め物 → Idle
  assert.deepEqual(long.events.map((e) => [e.type, e.id]), [["started", "g2"], ["error", "g2"]]);
  assert.equal(long.events[1].message, DISCORD_PLAYER_MESSAGES.idleBeforeEnd);
  assert.equal(long.player.write("g2", pcm24k(20)), false, "Idle になった発話には足せない");
});

test("落とし穴の確かめ: maxMissedFrames が既定の 5 のままなら 100ms の途切れで Idle になる（だから大きくする）", async () => {
  const r = rig({ maxMissedFrames: 5 });
  r.player.open("t", { sampleRate: 24000, channels: 1 });
  r.player.write("t", pcm24k(60));
  await settle();
  await r.run(3 + 5 + 6);
  assert.deepEqual(r.types(), ["started", "error"]);
});

test("stop: 鳴っているときは player.stop()（無音 100ms の余韻）・stopped（id 付き）・そのあとの Idle で ended / error を出さない", async () => {
  const r = rig();
  r.player.open("s1", { sampleRate: 24000, channels: 1 });
  r.player.write("s1", pcm24k(500));
  await settle();
  await r.run(3);
  r.player.stop();
  assert.deepEqual(r.audio.record.stops, [false], "鳴っているときは余韻つきの stop");
  await settle();
  assert.deepEqual(r.events.map((e) => [e.type, e.id]), [["started", "s1"], ["stopped", "s1"]]);
  const sentBefore = r.audio.record.framesSent;
  await r.run(10);
  assert.equal(r.audio.record.framesSent, sentBefore, "止めたあとは実音を送らない（無音だけ）");
  assert.equal(r.ap.state.status, "idle");
  assert.deepEqual(r.types(), ["started", "stopped"]);
  assert.equal(r.player.write("s1", pcm24k(20)), false);
  // 何も鳴っていないときの stop は id なしの stopped（手元の再生器の "STOPPED" と同じ）。
  r.player.stop();
  await settle();
  assert.deepEqual(r.events.at(-1), { type: "stopped", id: null, atMs: r.now() });
});

test("stop: まだ鳴り始めていない（Buffering）ときはすぐ Idle にする", async () => {
  const r = rig();
  r.player.open("b1", { sampleRate: 24000, channels: 1 });
  r.player.write("b1", pcm24k(5)); // 1 フレームに満たない
  await settle();
  assert.equal(r.ap.state.status, "buffering");
  r.player.stop();
  assert.deepEqual(r.audio.record.stops, [true]);
  assert.equal(r.ap.state.status, "idle");
  await settle();
  assert.deepEqual(r.events.map((e) => [e.type, e.id]), [["stopped", "b1"]]);
});

test("置き換え: 鳴っている間に次の open → 前の発話の事象は出さず、Idle を挟まずに次を鳴らす", async () => {
  const r = rig();
  r.player.open("p1", { sampleRate: 24000, channels: 1 });
  r.player.write("p1", pcm24k(400));
  await settle();
  await r.run(2);
  r.player.open("p2", { sampleRate: 24000, channels: 1 });
  r.player.write("p2", pcm24k(40));
  r.player.end("p2");
  await settle();
  await r.run(10);
  assert.deepEqual(r.events.map((e) => [e.type, e.id]), [["started", "p1"], ["started", "p2"], ["ended", "p2"]]);
  assert.equal(r.audio.resources[0].destroyed, true, "前の resource はプレイヤーが壊す");
  assert.deepEqual(r.ap.transitions, ["buffering", "playing", "buffering", "playing", "idle"], "差し替えの間に Idle を挟まない");
});

test("AutoPaused: 接続が Ready でない間は止まって待ち、戻れば続きを鳴らして ended（STARTED は Playing になった時点）", async () => {
  const r = rig({}, "connecting");
  r.player.open("ap", { sampleRate: 24000, channels: 1 });
  r.player.write("ap", pcm24k(100));
  r.player.end("ap");
  await settle();
  assert.deepEqual(r.types(), ["started"], "Ready でなくても Playing になった時点で started（ゲート 2 で見る所）");
  await r.run(50);
  assert.equal(r.ap.state.status, "autopaused");
  assert.equal(r.audio.record.framesSent, 0);
  r.connection.state = { status: "ready" };
  await r.run(5 + 6);
  assert.deepEqual(r.types(), ["started", "ended"]);
  assert.equal(r.audio.record.framesSent, 5);
});

test("流れの失敗: resource の流れが壊れたら error（決まった文面・生のエラー文を入れない）", async () => {
  const r = rig();
  r.player.open("e1", { sampleRate: 24000, channels: 1 });
  r.player.write("e1", pcm24k(100));
  await settle();
  /** @type {any} */ (r.audio.resources[0].input).destroy(new Error("raw failure with secret-ish text"));
  await settle();
  assert.deepEqual(r.events.map((e) => [e.type, e.id]), [["started", "e1"], ["error", "e1"]]);
  assert.equal(r.events[1].message, DISCORD_PLAYER_MESSAGES.resourceError);
  await r.run(10);
  assert.equal(r.events.length, 2);
});

test("dispose: 鳴っている発話があれば stopped を出してから止めて接続から外す・以後は事象なし・open は投げる・stop は投げない", async () => {
  const r = rig();
  r.player.open("d1", { sampleRate: 24000, channels: 1 });
  r.player.write("d1", pcm24k(300));
  await settle();
  r.player.dispose();
  assert.deepEqual(r.events.map((e) => [e.type, e.id]), [["started", "d1"], ["stopped", "d1"]]);
  assert.equal(r.ap.state.status, "idle");
  assert.equal(r.ap.subscribers.length, 0, "接続から外す");
  assert.equal(r.player.isAlive(), false);
  assert.equal(await r.player.whenReady(), false);
  assert.throws(() => r.player.open("d2", { sampleRate: 24000, channels: 1 }), /disposed/);
  assert.throws(() => r.player.write("d1", pcm24k(20)), /disposed/);
  assert.doesNotThrow(() => r.player.stop());
  r.player.dispose(); // 冪等
  await r.run(10);
  assert.equal(r.events.length, 2);
  // 鳴っていなければ事象は出さない。
  const quiet = rig();
  quiet.player.dispose();
  await settle();
  assert.deepEqual(quiet.events, []);
});

test("作るときの確かめ: voice の部品と接続が無ければ投げる", () => {
  const audio = createFakeDiscordAudio();
  assert.throws(() => createDiscordStreamPlayer(/** @type {any} */ ({ voice: {}, connection: { subscribe() {} } })), TypeError);
  assert.throws(() => createDiscordStreamPlayer(/** @type {any} */ ({ voice: audio, connection: {} })), TypeError);
});
