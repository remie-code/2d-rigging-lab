// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildElevenLabsTtdUrl, createElevenLabsVoiceEngine, ELEVENLABS_TTS_DEFAULTS } from "./elevenlabs-voice-engine.mjs";
import { createVoiceEngine } from "./voice-engine.mjs";
import { createFakeWebSocketClass } from "../../test-support/fake-websocket.mjs";
import { createFakeClock } from "../../test-support/fake-clock.mjs";
import { createFakeStreamPlayer } from "../../test-support/fake-stream-player.mjs";
import { createFakeSpeechChannel } from "../../test-support/fake-voice-engine.mjs";
import { createSpeechStreamer } from "../speech-streamer.mjs";

// ElevenLabs の声の差し替え口。WebSocket と時計と読みの口は偽物（本物の API・AivisSpeech は叩かない）。

const KEY = "test-key-do-not-leak-7f3a";

/** 文 → AivisSpeech 形の読み（テストで使う文だけ）。 */
const READINGS = {
  "あい。": [{ moras: [{ text: "ア", vowel: "a" }, { text: "イ", vowel: "i" }, { text: ".", vowel: "pau" }], pause_mora: null }],
  "うえ。": [{ moras: [{ text: "ウ", vowel: "u" }, { text: "エ", vowel: "e" }, { text: ".", vowel: "pau" }], pause_mora: null }],
  "おか。": [{ moras: [{ text: "オ", vowel: "o" }, { text: "カ", vowel: "a" }, { text: ".", vowel: "pau" }], pause_mora: null }],
  "先に。": [{ moras: [{ text: "サ", vowel: "a" }, { text: "キ", vowel: "i" }, { text: "ニ", vowel: "i" }, { text: ".", vowel: "pau" }], pause_mora: null }]
};

const tick = async (n = 4) => {
  for (let k = 0; k < n; k += 1) await new Promise((resolve) => setImmediate(resolve));
};

/** @param {any} [overrides] */
function setup(overrides = {}) {
  const { FakeWebSocket, sockets, last } = createFakeWebSocketClass();
  const clock = createFakeClock();
  /** @type {any[]} */
  const diags = [];
  /** @type {string[]} */
  const statuses = [];
  let fallbacks = 0;
  /** @type {string[]} */
  const readingCalls = [];
  const readingClient = {
    async accentPhrases(/** @type {string} */ text) {
      readingCalls.push(text);
      const found = /** @type {any} */ (READINGS)[text];
      if (!found) throw new Error("no reading");
      return found;
    }
  };
  const engine = createElevenLabsVoiceEngine({
    apiKey: KEY,
    WebSocketImpl: FakeWebSocket,
    setTimeoutImpl: clock.setTimeoutImpl,
    clearTimeoutImpl: clock.clearTimeoutImpl,
    readingClient,
    onDiagnostic: (/** @type {any} */ d) => diags.push(d),
    onReadingsFallback: () => {
      fallbacks += 1;
    },
    ...overrides
  });
  engine.onStatus((s) => statuses.push(s));
  return { engine, sockets, last, clock, diags, statuses, readingCalls, fallbacks: () => fallbacks };
}

/** @param {any} socket */
const sentMessages = (socket) => socket.sent.map((/** @type {string} */ s) => JSON.parse(s));

/** @param {any} socket */
const sentTexts = (socket) =>
  sentMessages(socket)
    .filter((/** @type {any} */ m) => Array.isArray(m.inputs))
    .map((/** @type {any} */ m) => m.inputs[0].text);

/** @param {number[]} bytes */
const b64 = (bytes) => Buffer.from(bytes).toString("base64");

/** @param {string[]} chars @param {number[]} starts @param {number[]} durations @param {number[]} [audio] */
const alignmentMessage = (chars, starts, durations, audio = [1, 0, 2, 0]) => ({
  audio: b64(audio),
  alignment: { chars, char_start_times_ms: starts, char_durations_ms: durations },
  normalized_alignment: { chars, char_start_times_ms: starts, char_durations_ms: durations }
});

const FINAL = { is_final_audio_for_turn: true };

/** 列を裏で読み切る。 @param {AsyncIterable<any>} iterable */
function collect(iterable) {
  /** @type {any[]} */
  const chunks = [];
  const state = { error: /** @type {any} */ (null), done: false };
  const done = (async () => {
    try {
      for await (const chunk of iterable) chunks.push(chunk);
    } catch (error) {
      state.error = error;
    } finally {
      state.done = true;
    }
  })();
  return { chunks, state, done };
}

/** @param {any[]} chunks */
const timelineOf = (chunks) => chunks.filter((c) => c.type === "timeline").flatMap((c) => c.entries);

test("接続: TTD の URL（v4_turbo・pcm_24000・ja・sync_alignment）・キーはヘッダだけ・open で voices を送り up", () => {
  const { engine, sockets, statuses } = setup();
  assert.equal(engine.kind, "elevenlabs");
  assert.equal(engine.status, "connecting");
  assert.equal(sockets.length, 1, "作った時点で繋ぐ");
  const socket = sockets[0];
  const url = new URL(socket.url);
  assert.equal(`${url.origin}${url.pathname}`, "wss://api.elevenlabs.io/v1/text-to-dialogue/stream-input");
  assert.equal(url.searchParams.get("model_id"), "eleven_v4_turbo");
  assert.equal(url.searchParams.get("output_format"), "pcm_24000");
  assert.equal(url.searchParams.get("language_code"), "ja");
  assert.equal(url.searchParams.get("sync_alignment"), "true");
  assert.ok(!socket.url.includes(KEY));
  assert.equal(socket.headers["xi-api-key"], KEY);
  socket.serverOpen();
  assert.equal(engine.status, "up");
  assert.deepEqual(statuses, ["up"]);
  assert.deepEqual(sentMessages(socket), [{ voices: ["Ona22sJYfzcps6cE1jVk"] }], "voice_settings は既定では送らない");
  assert.equal(ELEVENLABS_TTS_DEFAULTS.voiceId, "Ona22sJYfzcps6cE1jVk");
  assert.match(buildElevenLabsTtdUrl({ modelId: "m", outputFormat: "pcm_16000" }), /model_id=m&output_format=pcm_16000/);
  engine.dispose();
});

test("接続: voice_settings は渡されたときだけ最初のメッセージに載せる・pcm 以外の形式は投げる", async () => {
  const { engine, sockets, clock } = setup({ voiceSettings: { stability: 0.4 } });
  sockets[0].serverOpen();
  assert.deepEqual(sentMessages(sockets[0])[0], { voices: ["Ona22sJYfzcps6cE1jVk"], voice_settings: { stability: 0.4 } });
  const run = collect(engine.synthesize("あい。"));
  await tick();
  clock.advance(10000);
  const later = sentMessages(sockets[0]).slice(1);
  assert.ok(later.length >= 3);
  assert.ok(later.every((m) => !("voice_settings" in m)), "後のメッセージには載せない（1008 protocol_violation）");
  sockets[0].serverSend(FINAL);
  await run.done;
  engine.dispose();
  assert.throws(() => createElevenLabsVoiceEngine({ apiKey: KEY, outputFormat: "mp3_44100_128", readingClient: null }), RangeError);
});

test("文: 本文 + flush を送り、format → 音 → 時間割（読みで割り付け）→ end を出す", async () => {
  const { engine, sockets, readingCalls, fallbacks } = setup();
  const socket = sockets[0];
  socket.serverOpen();
  /** @type {Array<[string, any]>} */
  const traces = [];
  const run = collect(engine.synthesize("  先に。", { onTrace: (event, fields) => traces.push([event, fields]) }));
  await tick();
  assert.deepEqual(sentMessages(socket).slice(1), [{ inputs: [{ text: "先に。", voice_id: "Ona22sJYfzcps6cE1jVk" }] }, { flush: true }]);
  assert.deepEqual(readingCalls, ["先に。"]);
  socket.serverSend({ audio: b64([9, 0, 8, 0]) });
  socket.serverSend(alignmentMessage(["先", "に"], [0, 320], [320, 160], [7, 0]));
  socket.serverSend(alignmentMessage(["。"], [0], [400], [6, 0]));
  socket.serverSend({ audio: b64([5, 0]) });
  socket.serverSend(FINAL);
  await run.done;
  assert.equal(run.state.error, null);
  const chunks = run.chunks;
  assert.deepEqual(chunks[0], { type: "format", sampleRate: 24000, channels: 1 });
  assert.equal(chunks[chunks.length - 1].type, "end");
  const audio = chunks.filter((c) => c.type === "audio");
  assert.ok(audio.every((c) => c.pcm instanceof Uint8Array));
  assert.deepEqual(audio.map((c) => [...c.pcm]), [[9, 0, 8, 0], [7, 0], [6, 0], [5, 0]]);
  // 先（0〜320 にサ・キ）・に（320〜480）、文末の句点の始まりで閉じる。
  assert.deepEqual(timelineOf(chunks), [
    { timeMs: 0, vowel: "a", s: 0.85 },
    { timeMs: 160, vowel: "i", s: 0.5 },
    { timeMs: 320, vowel: "i", s: 0.5 },
    { timeMs: 480, vowel: "i", s: 0 }
  ]);
  assert.equal(fallbacks(), 0);
  const final = traces.find(([event]) => event === "voice.elevenlabs.turn.final");
  assert.ok(final);
  assert.equal(final[1].timelineMode, "readings");
  assert.equal(final[1].pcmBytes, 10);
  assert.ok(!JSON.stringify(traces).includes("先に"), "トレースに本文を載せない");
  engine.dispose();
});

test("文: 時間割は音より先に出てよい・alignmentLeadMs を足す・奇数バイトは次へ持ち越す", async () => {
  const { engine, sockets } = setup({ alignmentLeadMs: 120 });
  sockets[0].serverOpen();
  const run = collect(engine.synthesize("あい。"));
  await tick();
  sockets[0].serverSend({ alignment: { chars: ["あ", "い", "。"], char_start_times_ms: [0, 100, 200], char_durations_ms: [100, 100, 300] } });
  sockets[0].serverSend({ audio: b64([1, 2, 3]) });
  sockets[0].serverSend({ audio: b64([4]) });
  sockets[0].serverSend(FINAL);
  await run.done;
  const types = run.chunks.map((c) => c.type);
  assert.deepEqual(types, ["format", "timeline", "audio", "audio", "end"]);
  assert.deepEqual(run.chunks[1].entries.map((/** @type {any} */ e) => e.timeMs), [120, 220, 320]);
  assert.deepEqual(run.chunks.filter((c) => c.type === "audio").map((c) => [...c.pcm]), [[1, 2], [3, 4]]);
  engine.dispose();
});

test("文: 同じメッセージの中では時間割を音より先に出す（読みが揃っていれば alignment → audio の順）", async () => {
  const { engine, sockets } = setup();
  sockets[0].serverOpen();
  const run = collect(engine.synthesize("あい。"));
  await tick(); // 読みが返り、組み立て器ができてから最初のメッセージが届く（通常時）。
  sockets[0].serverSend(alignmentMessage(["あ", "い"], [0, 100], [100, 100], [1, 0]));
  sockets[0].serverSend(alignmentMessage(["。"], [0], [300], [2, 0]));
  sockets[0].serverSend(FINAL);
  await run.done;
  assert.equal(run.state.error, null);
  const types = run.chunks.map((c) => c.type);
  // 1 通目: timeline（あ・い）→ audio。2 通目: timeline（文末の句点で閉じる）→ audio。
  assert.deepEqual(types, ["format", "timeline", "audio", "timeline", "audio", "end"]);
  assert.deepEqual(run.chunks[1].entries.map((/** @type {any} */ e) => e.vowel), ["a", "i"]);
  assert.deepEqual([...run.chunks[2].pcm], [1, 0]);
  assert.deepEqual(run.chunks[3].entries, [{ timeMs: 200, vowel: "i", s: 0 }]);
  assert.deepEqual([...run.chunks[4].pcm], [2, 0]);
  engine.dispose();
});

test("文: 文ごとの synthesize は engine 内で直列（前の文の is_final の後に次の本文を送る）", async () => {
  const { engine, sockets } = setup();
  const socket = sockets[0];
  socket.serverOpen();
  const first = collect(engine.synthesize("あい。"));
  const second = collect(engine.synthesize("うえ。"));
  await tick();
  assert.deepEqual(sentTexts(socket), ["あい。"], "2 文目はまだ送らない");
  socket.serverSend(alignmentMessage(["あ", "い", "。"], [0, 100, 200], [100, 100, 300], [1, 0]));
  socket.serverSend(FINAL);
  await tick();
  assert.deepEqual(sentTexts(socket), ["あい。", "うえ。"]);
  socket.serverSend(alignmentMessage(["う", "え", "。"], [0, 100, 200], [100, 100, 300], [2, 0]));
  socket.serverSend(FINAL);
  await Promise.all([first.done, second.done]);
  assert.deepEqual(timelineOf(first.chunks).map((e) => e.vowel), ["a", "i", "i"]);
  assert.deepEqual(timelineOf(second.chunks).map((e) => e.vowel), ["u", "e", "e"]);
  assert.deepEqual(first.chunks.filter((c) => c.type === "audio").map((c) => [...c.pcm]), [[1, 0]]);
  assert.deepEqual(second.chunks.filter((c) => c.type === "audio").map((c) => [...c.pcm]), [[2, 0]]);
  engine.dispose();
});

test("中止: 終わった文の abort は無視（切らない）", async () => {
  const { engine, sockets } = setup();
  sockets[0].serverOpen();
  const controller = new AbortController();
  const run = collect(engine.synthesize("あい。", { signal: controller.signal }));
  await tick();
  sockets[0].serverSend(FINAL);
  await run.done;
  controller.abort();
  await tick();
  assert.equal(run.state.error, null);
  assert.equal(sockets.length, 1);
  assert.equal(sockets[0].closedByClientCode, null, "終わった文の中止で接続を切らない");
  engine.dispose();
});

test("中止: barge-in の一斉 abort（終わった文・送った文・待ちの文）は切断とつなぎ直しを 1 回にまとめ、状態は up のまま", async () => {
  const { engine, sockets, statuses, diags } = setup();
  sockets[0].serverOpen();
  const controllers = [new AbortController(), new AbortController(), new AbortController()];
  const runs = ["あい。", "うえ。", "おか。"].map((text, k) => collect(engine.synthesize(text, { signal: controllers[k].signal })));
  await tick();
  sockets[0].serverSend(FINAL); // 1 文目は終わり、2 文目が送られる
  await tick();
  assert.deepEqual(sentTexts(sockets[0]), ["あい。", "うえ。"]);
  sockets[0].serverSend({ audio: b64([1, 0]) }); // 2 文目の途中
  await tick();
  for (const controller of controllers) controller.abort(); // markTerminal と同じく全 job を一斉に
  await Promise.all(runs.map((r) => r.done));
  assert.equal(runs[0].state.error, null, "終わった文は無視");
  assert.equal(runs[1].state.error?.name, "AbortError");
  assert.equal(runs[1].state.error?.code, "voice_synthesis_aborted");
  assert.equal(runs[2].state.error?.name, "AbortError");
  assert.equal(sockets.length, 2, "つなぎ直しは 1 回");
  assert.equal(sockets[0].closedByClientCode, 1000);
  assert.equal(diags.filter((d) => d.type === "ttsRestarted").length, 1);
  assert.equal(engine.status, "up");
  sockets[1].serverOpen();
  assert.deepEqual(statuses, ["up"], "中止のつなぎ直しでは状態を変えない");
  assert.deepEqual(sentTexts(sockets[1]), [], "中止した待ちの文は送らない");
  // つなぎ直した接続で次の文が鳴る。
  const next = collect(engine.synthesize("あい。"));
  await tick();
  assert.deepEqual(sentTexts(sockets[1]), ["あい。"]);
  sockets[1].serverSend(FINAL);
  await next.done;
  assert.equal(next.state.error, null);
  engine.dispose();
});

test("中止: 送る前の文の abort は列から外すだけ（切らない）・最初から中止済みの signal は送らない", async () => {
  const { engine, sockets } = setup();
  sockets[0].serverOpen();
  const first = collect(engine.synthesize("あい。"));
  const controller = new AbortController();
  const second = collect(engine.synthesize("うえ。", { signal: controller.signal }));
  const pre = new AbortController();
  pre.abort();
  const third = collect(engine.synthesize("おか。", { signal: pre.signal }));
  await tick();
  controller.abort();
  await tick();
  assert.equal(second.state.error?.name, "AbortError");
  assert.equal(third.state.error?.name, "AbortError");
  assert.equal(sockets[0].closedByClientCode, null);
  sockets[0].serverSend(FINAL);
  await first.done;
  await tick();
  assert.deepEqual(sentTexts(sockets[0]), ["あい。"]);
  assert.equal(sockets.length, 1);
  engine.dispose();
});

test("中止: 消費者が end の前に読むのをやめたら中止と同じ（送った文なら切ってつなぎ直す）", async () => {
  const { engine, sockets } = setup();
  sockets[0].serverOpen();
  const iterator = engine.synthesize("あい。")[Symbol.asyncIterator]();
  assert.equal((await iterator.next()).value.type, "format");
  await tick();
  assert.deepEqual(sentTexts(sockets[0]), ["あい。"]);
  await iterator.return?.(undefined);
  assert.equal(sockets[0].closedByClientCode, 1000);
  assert.equal(sockets.length, 2);
  engine.dispose();
});

test("keep_alive: 10 秒何も送らなければ {keep_alive:true} を送る・送るたびに数え直す", async () => {
  const { engine, sockets, clock } = setup();
  const socket = sockets[0];
  socket.serverOpen();
  const keepAlives = () => sentMessages(socket).filter((/** @type {any} */ m) => m.keep_alive === true).length;
  clock.advance(9999);
  assert.equal(keepAlives(), 0);
  clock.advance(1);
  assert.equal(keepAlives(), 1);
  clock.advance(10000);
  assert.equal(keepAlives(), 2);
  clock.advance(5000);
  const run = collect(engine.synthesize("あい。"));
  await tick();
  clock.advance(9999);
  assert.equal(keepAlives(), 2, "本文を送ってから 10 秒経つまでは送らない");
  clock.advance(1);
  assert.equal(keepAlives(), 3);
  assert.deepEqual(sentMessages(socket).find((/** @type {any} */ m) => m.keep_alive), { keep_alive: true });
  socket.serverSend(FINAL);
  await run.done;
  engine.dispose();
  clock.advance(60000);
  assert.equal(keepAlives(), 3, "dispose 後は送らない");
});

test("つなぎ直し: 切れたら reconnecting・1s→2s→4s…15s で繋ぎ直し続け、繋がれば up（待ち時間は戻る）", async () => {
  const { engine, sockets, clock, statuses, diags } = setup();
  sockets[0].serverOpen();
  const run = collect(engine.synthesize("あい。"));
  await tick();
  sockets[0].serverClose(1006, "");
  await run.done;
  assert.equal(run.state.error?.code, "elevenlabs_tts_disconnected", "送った文は失敗で返る");
  assert.equal(engine.status, "reconnecting");
  const delays = [];
  let count = sockets.length;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    let waited = 0;
    while (sockets.length === count) {
      clock.advance(500);
      waited += 500;
      assert.ok(waited <= 30000);
    }
    delays.push(waited);
    count = sockets.length;
    sockets[count - 1].serverClose(1006, ""); // open 前に失敗
  }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 15000, 15000]);
  assert.equal(engine.status, "reconnecting");
  clock.advance(15000);
  sockets[sockets.length - 1].serverOpen();
  assert.equal(engine.status, "up");
  assert.deepEqual(statuses, ["up", "reconnecting", "up"]);
  assert.ok(diags.some((d) => d.type === "ttsReconnected"));
  // 繋がった後にまた切れたら 1s から。
  count = sockets.length;
  sockets[count - 1].serverClose(1006, "");
  clock.advance(999);
  assert.equal(sockets.length, count);
  clock.advance(1);
  assert.equal(sockets.length, count + 1);
  engine.dispose();
});

test("つなぎ直し: 最初の接続に失敗したら down・裏で繋ぎ直し、繋がれば up", () => {
  const { engine, sockets, clock, statuses } = setup();
  sockets[0].serverClose(1006, "");
  assert.equal(engine.status, "down");
  clock.advance(1000);
  assert.equal(sockets.length, 2);
  sockets[1].serverOpen();
  assert.equal(engine.status, "up");
  assert.deepEqual(statuses, ["down", "up"]);
  engine.dispose();
});

test("つなぎ直し: 繋がらない間の文は上限まで待って elevenlabs_tts_unavailable・待ち中に文が来たらすぐ試す", async () => {
  const { engine, sockets, clock } = setup();
  sockets[0].serverOpen();
  sockets[0].serverClose(1006, "");
  assert.equal(engine.status, "reconnecting");
  const run = collect(engine.synthesize("あい。"));
  await tick();
  assert.equal(sockets.length, 2, "待ち中の繋ぎ直しを前倒しする");
  clock.advance(ELEVENLABS_TTS_DEFAULTS.connectWaitMs);
  await run.done;
  assert.equal(run.state.error?.code, "elevenlabs_tts_unavailable");
  // 繋がれば次の文は送られる。
  sockets[1].serverOpen();
  const next = collect(engine.synthesize("うえ。"));
  await tick();
  assert.deepEqual(sentTexts(sockets[1]), ["うえ。"]);
  sockets[1].serverSend(FINAL);
  await next.done;
  assert.equal(next.state.error, null);
  engine.dispose();
});

test("サーバーのエラー: 文は elevenlabs_tts_server_error で失敗・種類だけを診断に載せる・つなぎ直す", async () => {
  const { engine, sockets, diags } = setup();
  sockets[0].serverOpen();
  const run = collect(engine.synthesize("あい。"));
  await tick();
  sockets[0].serverSend({ message: "something about 'あい。'", error: "protocol_violation", code: 1008 });
  await run.done;
  assert.equal(run.state.error?.code, "elevenlabs_tts_server_error");
  const serverDiag = diags.find((d) => d.type === "ttsServerError");
  assert.equal(serverDiag.reason, "protocol_violation");
  assert.ok(!JSON.stringify(diags).includes("あい"), "サーバーの message（本文を含みうる）は載せない");
  assert.ok(diags.every((d) => d.message === null), "診断の message はいつも null");
  assert.equal(sockets.length, 2);
  engine.dispose();
});

test("文の時間切れ: 送ったあと便りが途絶えたら elevenlabs_tts_turn_timeout でつなぎ直す", async () => {
  const { engine, sockets, clock } = setup();
  sockets[0].serverOpen();
  const run = collect(engine.synthesize("あい。"));
  await tick();
  sockets[0].serverSend({ audio: b64([1, 0]) });
  clock.advance(ELEVENLABS_TTS_DEFAULTS.turnIdleTimeoutMs - 1);
  assert.equal(run.state.done, false);
  clock.advance(1);
  await run.done;
  assert.equal(run.state.error?.code, "elevenlabs_tts_turn_timeout");
  assert.equal(sockets.length, 2);
  engine.dispose();
});

test("読みが取れない: 簡易版の口にして onReadingsFallback を文ごとに 1 回・時間切れも同じ", async () => {
  const { engine, sockets, fallbacks } = setup();
  sockets[0].serverOpen();
  /** @type {Array<[string, any]>} */
  const traces = [];
  const run = collect(engine.synthesize("見て。", { onTrace: (event, fields) => traces.push([event, fields]) }));
  await tick();
  sockets[0].serverSend(alignmentMessage(["見", "て", "。"], [0, 160, 320], [160, 160, 400]));
  sockets[0].serverSend(FINAL);
  await run.done;
  assert.equal(fallbacks(), 1);
  // 見 = 開け閉め（a）、て = 表で e、句点で閉じる。
  assert.deepEqual(timelineOf(run.chunks).map((e) => `${e.timeMs}${e.vowel}${e.s === 0 ? "_" : ""}`), ["0a", "80a_", "160e", "320e_"]);
  assert.ok(traces.some(([event, fields]) => event === "voice.elevenlabs.readings.fallback" && fields.reason === "failed"));
  engine.dispose();

  // 読みの口が返らない → 上限で簡易版。
  const hanging = setup({ readingClient: { accentPhrases: () => new Promise(() => {}) } });
  hanging.sockets[0].serverOpen();
  const slow = collect(hanging.engine.synthesize("あい。"));
  await tick();
  hanging.sockets[0].serverSend(alignmentMessage(["あ", "い", "。"], [0, 100, 200], [100, 100, 300]));
  hanging.sockets[0].serverSend(FINAL);
  await tick();
  assert.equal(slow.state.done, false, "読みを待っている");
  hanging.clock.advance(ELEVENLABS_TTS_DEFAULTS.readingsTimeoutMs);
  await slow.done;
  assert.equal(hanging.fallbacks(), 1);
  assert.deepEqual(timelineOf(slow.chunks).map((e) => e.vowel), ["a", "i", "i"]);
  hanging.engine.dispose();
});

test("読みの口が null なら読みを取らず簡易版（通知しない）", async () => {
  const { engine, sockets, fallbacks } = setup({ readingClient: null });
  sockets[0].serverOpen();
  const run = collect(engine.synthesize("あい。"));
  await tick();
  sockets[0].serverSend(alignmentMessage(["あ", "い", "。"], [0, 100, 200], [100, 100, 300]));
  sockets[0].serverSend(FINAL);
  await run.done;
  assert.equal(fallbacks(), 0);
  assert.deepEqual(timelineOf(run.chunks).map((e) => e.vowel), ["a", "i", "i"]);
  engine.dispose();
});

test("キーが無い: down のまま繋がず、synthesize は elevenlabs_api_key_missing で失敗", async () => {
  const { engine, sockets } = setup({ apiKey: "" });
  assert.equal(engine.status, "down");
  assert.equal(sockets.length, 0);
  const run = collect(engine.synthesize("あい。"));
  await run.done;
  assert.equal(run.state.error?.code, "elevenlabs_api_key_missing");
  engine.dispose();
});

test("dispose: 接続を閉じ、待ちの文は voice_engine_disposed で失敗・状態 down・以後の synthesize は投げる・つなぎ直さない", async () => {
  const { engine, sockets, clock, statuses } = setup();
  sockets[0].serverOpen();
  const first = collect(engine.synthesize("あい。"));
  const second = collect(engine.synthesize("うえ。"));
  await tick();
  engine.dispose();
  await Promise.all([first.done, second.done]);
  assert.equal(first.state.error?.code, "voice_engine_disposed");
  assert.equal(second.state.error?.code, "voice_engine_disposed");
  assert.equal(sockets[0].closedByClientCode, 1000);
  assert.equal(engine.status, "down");
  assert.deepEqual(statuses, ["up", "down"]);
  assert.throws(() => engine.synthesize("あい。"), /disposed/);
  assert.throws(() => engine.synthesize(""), TypeError);
  clock.advance(60000);
  assert.equal(sockets.length, 1);
});

test("秘密: キーは診断・トレース・エラー文のどこにも出ない", async () => {
  const { engine, sockets, diags, clock } = setup();
  /** @type {any[]} */
  const traces = [];
  sockets[0].serverOpen();
  const run = collect(engine.synthesize("あい。", { onTrace: (event, fields) => traces.push([event, fields]) }));
  await tick();
  sockets[0].serverClose(1008, `reason with ${KEY} and あい`);
  await run.done;
  clock.advance(1000);
  sockets[1].serverClose(1006, "");
  const everything = JSON.stringify({ diags, traces, error: String(run.state.error?.message), stack: String(run.state.error?.stack) });
  assert.ok(!everything.includes(KEY));
  assert.ok(!everything.includes("あい"), "close の reason 文も載せない");
  engine.dispose();
});

test("工場関数: createVoiceEngine('elevenlabs', deps) で同じ engine が作れる", () => {
  const { FakeWebSocket, sockets } = createFakeWebSocketClass();
  const engine = createVoiceEngine("elevenlabs", { apiKey: KEY, WebSocketImpl: FakeWebSocket, readingClient: null, voiceId: "v2", modelId: "eleven_v4" });
  assert.equal(engine.kind, "elevenlabs");
  assert.equal(new URL(sockets[0].url).searchParams.get("model_id"), "eleven_v4");
  sockets[0].serverOpen();
  assert.deepEqual(JSON.parse(sockets[0].sent[0]), { voices: ["v2"] });
  engine.dispose();
});

test("SpeechStreamer に載る: 文が順に鳴り器へ open/append/end が届く・barge-in で送った文の分だけ 1 回つなぎ直す", async () => {
  const { engine, sockets } = setup();
  sockets[0].serverOpen();
  const player = createFakeStreamPlayer({ autoStart: true });
  const channel = createFakeSpeechChannel();
  const streamer = createSpeechStreamer({ engine, player, channel, generationId: "g1" });
  streamer.enqueue({ text: "あい。", index: 0, final: false });
  streamer.enqueue({ text: "うえ。", index: 1, final: true });
  const done = streamer.finish();
  await tick();
  assert.deepEqual(sentTexts(sockets[0]), ["あい。"], "2 文目は 1 文目の is_final まで送らない");
  sockets[0].serverSend(alignmentMessage(["あ", "い", "。"], [0, 100, 200], [100, 100, 300], [1, 0, 2, 0]));
  sockets[0].serverSend(FINAL);
  await tick();
  const id = player.opened[0];
  assert.deepEqual(player.calls[0], { op: "open", id, format: { sampleRate: 24000, channels: 1 } });
  assert.deepEqual(channel.sent.map((entry) => entry.op), ["open", "append", "end"]);
  assert.deepEqual(channel.sent[1].timeline.map((/** @type {any} */ e) => e.vowel), ["a", "i", "i"]);
  assert.deepEqual(sentTexts(sockets[0]), ["あい。", "うえ。"]);
  sockets[0].serverSend({ audio: b64([3, 0]) }); // 2 文目は生成の途中
  await tick();
  assert.equal(streamer.bargeIn(), true);
  await tick();
  assert.equal(sockets.length, 2, "送った 2 文目の分だけ切ってつなぎ直す（1 文目は終わっているので無視）");
  assert.equal(engine.status, "up");
  const result = await done;
  assert.equal(result.status, "cancelled");
  engine.dispose();
});
