// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildElevenLabsRealtimeUrl,
  loadElevenLabsApiKey,
  createElevenLabsRealtimeStt,
  ELEVENLABS_STT_DEFAULTS,
  DEFAULT_ELEVENLABS_ENV_PATH
} from "./elevenlabs-stt.mjs";
import { createFakeWebSocketClass, createManualTimers } from "../test-support/fake-websocket.mjs";

// ElevenLabs リアルタイム STT 接続の機械テスト。WebSocket は fake を注入し、実 ElevenLabs には繋がない。
// タイマも手動（実時間を待たない）。

const SECRET = "sk_test_secret_value_never_logged";

/** 1 件の Promise を microtask 数回ぶん進める（fake の同期イベント後の then を流す）。 */
async function tick() {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
}

function makeStt(overrides = {}) {
  const wsClass = createFakeWebSocketClass();
  const timers = createManualTimers();
  const record = {
    /** @type {string[]} */ commits: [],
    /** @type {Array<{ status: string; reason: string | null }>} */ statuses: [],
    /** @type {any[]} */ diagnostics: []
  };
  const stt = createElevenLabsRealtimeStt({
    apiKey: SECRET,
    WebSocketImpl: wsClass.FakeWebSocket,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    onCommit: ({ text }) => record.commits.push(text),
    onStatus: (status, info) => record.statuses.push({ status, reason: info.reason }),
    onDiagnostic: (d) => record.diagnostics.push(d),
    ...overrides
  });
  return { stt, wsClass, timers, record };
}

/** 記録全体を文字列にしてキーが漏れていないことを確かめる。 */
function assertNoSecret(...values) {
  for (const v of values) {
    assert.equal(JSON.stringify(v).includes(SECRET), false, "API key leaked");
  }
}

test("buildElevenLabsRealtimeUrl: 合意の設定（scribe_v2_realtime / vad 0.3 / pcm_16000 / ja）をクエリに載せる", () => {
  const url = new URL(buildElevenLabsRealtimeUrl());
  assert.equal(url.origin + url.pathname, "wss://api.elevenlabs.io/v1/speech-to-text/realtime");
  assert.equal(url.searchParams.get("model_id"), "scribe_v2_realtime");
  assert.equal(url.searchParams.get("commit_strategy"), "vad");
  assert.equal(url.searchParams.get("vad_silence_threshold_secs"), "0.3");
  assert.equal(url.searchParams.get("audio_format"), "pcm_16000");
  assert.equal(url.searchParams.get("language_code"), "ja");
  // キーは URL に載せない（ヘッダで送る）。
  assert.equal([...url.searchParams.keys()].some((k) => /key/i.test(k)), false);
  assert.equal(ELEVENLABS_STT_DEFAULTS.sendChunkBytes, 3200);
});

test("loadElevenLabsApiKey: env ファイルから ELEVENLABS_API_KEY を読む（process.env には入れない）", () => {
  const before = process.env.ELEVENLABS_API_KEY;
  const r = loadElevenLabsApiKey({
    path: "X:/fake/.env.elevenlabs.local",
    readFileImpl: () => `# comment\nOTHER=1\nELEVENLABS_API_KEY="${SECRET}"\n`
  });
  assert.deepEqual(r, { ok: true, apiKey: SECRET });
  assert.equal(process.env.ELEVENLABS_API_KEY, before);
  assert.match(DEFAULT_ELEVENLABS_ENV_PATH.replace(/\\/g, "/"), /apps\/soul\/agent\/\.env\.elevenlabs\.local$/);
});

test("loadElevenLabsApiKey: ファイルが無い・キーが無い・空は ok:false + 理由（キー値を含まない）", () => {
  const noFile = loadElevenLabsApiKey({
    readFileImpl: () => {
      throw new Error("ENOENT");
    }
  });
  assert.equal(noFile.ok, false);
  assert.match(/** @type {any} */ (noFile).reason, /ElevenLabs のキーが見つからない/);
  for (const body of ["OTHER=1\n", "ELEVENLABS_API_KEY=\n", "ELEVENLABS_API_KEY=   \n"]) {
    const r = loadElevenLabsApiKey({ readFileImpl: () => body });
    assert.equal(r.ok, false, body);
  }
});

test("connect: session_started で成功（open だけでは成功にしない）・ヘッダにキー・状態 connecting→up", async () => {
  const { stt, wsClass, record } = makeStt();
  let resolved = false;
  const p = stt.connect().then(() => {
    resolved = true;
  });
  const ws = wsClass.last();
  assert.equal(ws.headers["xi-api-key"], SECRET);
  ws.serverOpen();
  await tick();
  assert.equal(resolved, false, "open だけでは成功にしない");
  ws.serverSend({ message_type: "session_started", session_id: "s", config: {} });
  await p;
  assert.equal(resolved, true);
  assert.deepEqual(record.statuses.map((s) => s.status), ["connecting", "up"]);
  assert.equal(stt.status(), "up");
  stt.dispose();
});

test("connect: auth_error は接続失敗（reject・状態 down・理由にキー値を含まない）", async () => {
  const { stt, wsClass, record } = makeStt();
  const p = stt.connect();
  const ws = wsClass.last();
  ws.serverOpen();
  ws.serverSend({ message_type: "auth_error", error: "You must be authenticated to use this endpoint." });
  await assert.rejects(p, /ElevenLabs に接続できない（auth_error: You must be authenticated/);
  assert.equal(stt.status(), "down");
  assert.equal(ws.readyState, 3, "失敗したソケットは閉じる");
  // 失敗後の close は再接続に回らない。
  ws.serverClose(1000);
  assert.equal(wsClass.sockets.length, 1);
  assertNoSecret(record);
  await p.catch((e) => assertNoSecret(e.message));
});

test("connect: session_started 前の close / タイムアウトは接続失敗", async () => {
  {
    const { stt, wsClass } = makeStt();
    const p = stt.connect();
    wsClass.last().serverClose(1006, "handshake failed");
    await assert.rejects(p, /closed code=1006 handshake failed/);
  }
  {
    const { stt, timers } = makeStt({ connectTimeoutMs: 1234 });
    const p = stt.connect();
    assert.deepEqual(timers.pending().map((t) => t.ms), [1234]);
    timers.runNext();
    await assert.rejects(p, /1234ms 以内に session_started が届かない/);
  }
});

test("connect: キーが空なら繋がずに失敗", async () => {
  const { stt, wsClass } = makeStt({ apiKey: "" });
  await assert.rejects(stt.connect(), /ElevenLabs のキーが見つからない/);
  assert.equal(wsClass.sockets.length, 0);
});

test("sendPcm: 100ms(3200B) 単位で input_audio_chunk を送る（commit:false・sample_rate 16000）・端数は持ち越す", async () => {
  const { stt, wsClass } = makeStt();
  const p = stt.connect();
  const ws = wsClass.last();
  ws.serverSessionStarted();
  await p;
  stt.sendPcm(new Uint8Array(1600).fill(1)); // 50ms: まだ送らない
  assert.equal(ws.sent.length, 0);
  stt.sendPcm(new Uint8Array(1600 + 100).fill(2)); // 計 3300B → 1 本送って 100B 持ち越し
  assert.equal(ws.sent.length, 1);
  const chunk = ws.sentChunks()[0];
  assert.equal(chunk.message_type, "input_audio_chunk");
  assert.equal(chunk.commit, false);
  assert.equal(chunk.sample_rate, 16000);
  const bytes = Buffer.from(chunk.audio_base_64, "base64");
  assert.equal(bytes.length, 3200);
  assert.equal(bytes[0], 1);
  assert.equal(bytes[3199], 2);
  stt.sendPcm(new Uint8Array(3100));
  assert.equal(ws.sent.length, 2);
  stt.dispose();
});

test("sendPcm: 接続前は捨てる（溜めない）", async () => {
  const { stt, wsClass } = makeStt();
  const p = stt.connect();
  const ws = wsClass.last();
  stt.sendPcm(new Uint8Array(6400));
  ws.serverSessionStarted();
  await p;
  stt.sendPcm(new Uint8Array(1600));
  assert.equal(ws.sent.length, 0, "接続前の 6400B は送られない");
  stt.dispose();
});

test("commit: committed_transcript を 1 件ずつ渡す（空も渡す）・partial は渡さない", async () => {
  const { stt, wsClass, record } = makeStt();
  const p = stt.connect();
  const ws = wsClass.last();
  ws.serverSessionStarted();
  await p;
  ws.serverSend({ message_type: "partial_transcript", text: "こんに" });
  ws.serverCommit("こんにちは");
  ws.serverSend({ message_type: "partial_transcript", text: "だから" });
  ws.serverCommit("だから-");
  ws.serverCommit("");
  assert.deepEqual(record.commits, ["こんにちは", "だから-", ""]);
  stt.dispose();
});

test("切断: reconnecting → 待ってから繋ぎ直し → up。繋ぎ直し中の音は捨てる", async () => {
  const { stt, wsClass, timers, record } = makeStt({ reconnectInitialDelayMs: 1000 });
  const p = stt.connect();
  const first = wsClass.last();
  first.serverSessionStarted();
  await p;
  first.serverClose(1006, "network");
  assert.equal(stt.status(), "reconnecting");
  assert.equal(record.statuses.at(-1)?.status, "reconnecting");
  assert.deepEqual(timers.pending().map((t) => t.ms), [1000]);
  // 繋ぎ直し中の音は捨てる。
  stt.sendPcm(new Uint8Array(6400));
  timers.runNext(); // 再接続を開始
  assert.equal(wsClass.sockets.length, 2);
  const second = wsClass.last();
  stt.sendPcm(new Uint8Array(6400)); // session_started 前もまだ捨てる
  second.serverSessionStarted();
  await tick();
  assert.equal(stt.status(), "up");
  assert.equal(second.sent.length, 0);
  stt.sendPcm(new Uint8Array(3200));
  assert.equal(second.sent.length, 1);
  second.serverCommit("戻った");
  assert.deepEqual(record.commits, ["戻った"]);
  assert.ok(record.diagnostics.some((d) => d.type === "sttDisconnected"));
  assert.ok(record.diagnostics.some((d) => d.type === "sttReconnected"));
  stt.dispose();
});

test("切断: 繋ぎ直しの失敗は待ち時間を倍々（上限あり）にして続ける・whisper へは切り替えない", async () => {
  const { stt, wsClass, timers, record } = makeStt({ reconnectInitialDelayMs: 1000, reconnectMaxDelayMs: 3000 });
  const p = stt.connect();
  wsClass.last().serverSessionStarted();
  await p;
  wsClass.last().serverClose(1006);
  const delays = [];
  for (let i = 0; i < 4; i += 1) {
    const reconnectTimer = timers.pending().find((t) => t.ms !== ELEVENLABS_STT_DEFAULTS.connectTimeoutMs);
    assert.ok(reconnectTimer);
    delays.push(reconnectTimer.ms);
    timers.runNext();
    wsClass.last().serverClose(1006, "still down"); // session_started 前に切れる = 失敗
    await tick();
  }
  assert.deepEqual(delays, [1000, 2000, 3000, 3000]);
  assert.equal(stt.status(), "reconnecting");
  assert.equal(record.diagnostics.filter((d) => d.type === "sttReconnectFailed").length, 4);
  stt.dispose();
  assert.equal(timers.pending().length, 0, "dispose で再接続タイマを止める");
});

test("接続後のエラー通知は診断へ（キーを含まない）", async () => {
  const { stt, wsClass, record } = makeStt();
  const p = stt.connect();
  wsClass.last().serverSessionStarted();
  await p;
  wsClass.last().serverSend({ message_type: "quota_exceeded", error: "quota" });
  assert.deepEqual(record.diagnostics.at(-1), { type: "sttServerError", reason: "quota_exceeded", message: "quota" });
  assertNoSecret(record);
  stt.dispose();
});

test("dispose: ソケットを閉じ・以後のイベントは無視・冪等", async () => {
  const { stt, wsClass, record, timers } = makeStt();
  const p = stt.connect();
  const ws = wsClass.last();
  ws.serverSessionStarted();
  await p;
  stt.dispose();
  stt.dispose();
  assert.equal(ws.closedByClientCode, 1000);
  ws.serverCommit("遅れて来た");
  assert.deepEqual(record.commits, []);
  assert.equal(wsClass.sockets.length, 1, "dispose 後の close で再接続しない");
  assert.equal(timers.pending().length, 0);
});
