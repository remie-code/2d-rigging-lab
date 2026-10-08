// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { connectChannel, redactToken } from "./channel-client.mjs";
import { createChannelServerDouble } from "../test-support/ws-double.mjs";
import { MinimalWebSocket } from "../test-support/ws-client.mjs";

// 機械テストでは channel-client に最小 WS クライアントを注入し、ws-double サーバと実 TCP で
// 疎通させて channel-client のロジックを検証する（本番は globalThis.WebSocket=undici・実器と
// 疎通実績あり。undici↔実器のワイヤ疎通は人間ゲート preflight-e2e.mjs で通す。根拠は
// ws-client.mjs / domain-b.md）。
const WS = MinimalWebSocket;

/** 契約 speechPath の 15 モーラ列（channel-exchange-examples.json と同一形）。 */
const SPEECH_TIMELINE = [
  { timeMs: 0, vowel: "o", s: 0.6 },
  { timeMs: 120, vowel: "e", s: 0.7 },
  { timeMs: 250, vowel: "i", s: 0.5 }
];

test("connectChannel: hello 照合 → intent.speech accepted（実 WS 配線）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    const outcome = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.equal(outcome.result, "accepted");
    assert.equal(outcome.error, null);
    assert.ok(outcome.rttMs >= 0);
    assert.match(outcome.requestId, /^req-/);
    assert.equal(
      outcome.serializedUtf8Bytes,
      Buffer.byteLength(
        JSON.stringify({ v: 1, id: outcome.requestId, kind: "intent.speech", payload: { timeline: SPEECH_TIMELINE } }),
        "utf8"
      )
    );
    // サーバが受けた payload が契約形（kind/payload.timeline）である。
    const speechMsg = server.received.find((m) => m.kind === "intent.speech");
    assert.ok(speechMsg, "server received intent.speech");
    assert.equal(speechMsg.v, 1);
    assert.match(speechMsg.id, /^req-/);
    assert.deepEqual(speechMsg.payload.timeline, SPEECH_TIMELINE);
    assert.equal(channel.supportedKinds.includes("intent.speech"), true);
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel diagnostics: speech の実 envelope UTF-8 bytes と request identity を記録する", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  /** @type {Array<{ event: string; fields: any }>} */
  const traces = [];
  const channel = await connectChannel(url, {
    WebSocketImpl: WS,
    connectionGeneration: 7,
    onTrace: (event, fields) => traces.push({ event, fields })
  });
  try {
    await channel.sendSpeech(SPEECH_TIMELINE);
    const sent = traces.find((entry) => entry.event === "channel.request.send" && entry.fields.kind === "intent.speech");
    const replied = traces.find((entry) => entry.event === "channel.request.reply" && entry.fields.kind === "intent.speech");
    assert.ok(sent);
    assert.ok(replied);
    assert.match(sent.fields.requestId, /^req-\d+$/);
    assert.equal(sent.fields.connectionGeneration, 7);
    assert.equal(sent.fields.timelineCount, SPEECH_TIMELINE.length);
    assert.equal(
      sent.fields.serializedUtf8Bytes,
      Buffer.byteLength(JSON.stringify({ v: 1, id: sent.fields.requestId, kind: "intent.speech", payload: { timeline: SPEECH_TIMELINE } }), "utf8")
    );
    assert.equal(replied.fields.requestId, sent.fields.requestId);
    const outcome = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.match(outcome.requestId, /^req-\d+$/);
    assert.equal(typeof outcome.serializedUtf8Bytes, "number");
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: 4 KiB 級の通常文は通し、64 KiB 超だけを local failure に留める", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const traces = [];
  const channel = await connectChannel(url, {
    WebSocketImpl: WS,
    onTrace: (event, fields) => traces.push({ event, fields })
  });
  try {
    const observedLongSentenceTimeline = Array.from({ length: 120 }, (_v, i) => ({
      timeMs: i * 10,
      vowel: ["a", "i", "u", "e", "o"][i % 5],
      s: 0.5
    }));
    const observedOutcome = await channel.sendSpeech(observedLongSentenceTimeline);
    assert.equal(observedOutcome.result, "accepted");
    assert.ok(observedOutcome.serializedUtf8Bytes > 4096);
    assert.ok(observedOutcome.serializedUtf8Bytes <= 64 * 1024);

    const oversizeTimeline = Array.from({ length: 2500 }, (_v, i) => ({
      timeMs: i * 10,
      vowel: ["a", "i", "u", "e", "o"][i % 5],
      s: 0.5
    }));
    await assert.rejects(() => channel.sendSpeech(oversizeTimeline), (error) => {
      assert.equal(error.code, "speech_envelope_oversize");
      assert.equal(error.diagnosticStage, "control_channel.preflight");
      return true;
    });
    assert.equal(server.received.filter((message) => message.kind === "intent.speech").length, 1);
    const rejected = traces.find((entry) => entry.event === "channel.request.preflight_rejected");
    assert.ok(rejected);
    assert.equal(rejected.fields.configuredUtf8Cap, 64 * 1024);
    assert.ok(rejected.fields.serializedUtf8Bytes > rejected.fields.configuredUtf8Cap);

    const outcome = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.equal(outcome.result, "accepted");
    assert.equal(server.received.filter((message) => message.kind === "intent.speech").length, 2);
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: rejected は result/error を返し接続は維持（次も送れる）", async () => {
  const server = createChannelServerDouble({
    onSpeech: () => ({
      result: "rejected",
      error: { code: "slotValueOutOfRange", message: "s out of range" }
    })
  });
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    const first = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.equal(first.result, "rejected");
    assert.equal(first.error.code, "slotValueOutOfRange");
    // 接続は維持されている → 2 通目も replyTo 相関で返る。
    const second = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.equal(second.result, "rejected");
    assert.equal(server.received.filter((m) => m.kind === "intent.speech").length, 2);
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: supportedKinds に intent.speech が無ければ throw", async () => {
  const server = createChannelServerDouble({
    supportedKinds: ["intent.set", "intent.envelope"]
  });
  const url = await server.listen();
  try {
    await assert.rejects(
      () => connectChannel(url, { WebSocketImpl: WS, helloTimeoutMs: 2000 }),
      /missing required supportedKinds.*intent\.speech/s
    );
  } finally {
    await server.close();
  }
});

test("connectChannel: 既定 requiredKinds に intent.envelope が無ければ throw（S4 fail-fast）", async () => {
  // 器は C5 から envelope を広告するが、envelope 非対応の相手には接続時に大声で失敗する。
  const server = createChannelServerDouble({
    supportedKinds: ["intent.set", "intent.speech"]
  });
  const url = await server.listen();
  try {
    await assert.rejects(
      () => connectChannel(url, { WebSocketImpl: WS, helloTimeoutMs: 2000 }),
      /missing required supportedKinds.*intent\.envelope/s
    );
  } finally {
    await server.close();
  }
});

test("connectChannel: sendEnvelope 送出 → accepted（payload 形・replyTo 相関・S4）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    const intent = {
      slotId: "head-horizontal",
      peak: 0.8,
      attackMs: 120,
      sustainMs: 2500,
      decayMs: 400
    };
    const outcome = await channel.sendEnvelope(intent);
    assert.equal(outcome.result, "accepted");
    assert.equal(outcome.error, null);
    assert.ok(outcome.rttMs >= 0);
    // サーバが受けた payload が契約形（kind/payload の 5 フィールド）である。
    const envMsg = server.received.find((m) => m.kind === "intent.envelope");
    assert.ok(envMsg, "server received intent.envelope");
    assert.equal(envMsg.v, 1);
    assert.match(envMsg.id, /^req-/);
    assert.deepEqual(envMsg.payload, intent);
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: sendEnvelope rejected は result/error を返し接続は維持（S4 部分適用の素）", async () => {
  const server = createChannelServerDouble({
    onEnvelope: () => ({
      result: "rejected",
      error: { code: "slotValueOutOfRange", message: "peak out of range" }
    })
  });
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    const intent = { slotId: "gaze-horizontal", peak: 2, attackMs: 100, sustainMs: 2000, decayMs: 300 };
    const first = await channel.sendEnvelope(intent);
    assert.equal(first.result, "rejected");
    assert.equal(first.error.code, "slotValueOutOfRange");
    // 接続は維持 → speech も続けて送れる（発話は演出の rejected で止まらない）。
    const speech = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.equal(speech.result, "accepted");
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: sendSet 送出 → accepted（payload 形 slotId/value/ttlMs・replyTo 相関・S6 barge-in の口閉じ）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    const intent = { slotId: "mouth-open", value: 0, ttlMs: 400 };
    const outcome = await channel.sendSet(intent);
    assert.equal(outcome.result, "accepted");
    assert.equal(outcome.error, null);
    assert.ok(outcome.rttMs >= 0);
    // サーバが受けた payload が契約形（kind=intent.set・payload の 3 フィールド）である。
    const setMsg = server.received.find((m) => m.kind === "intent.set");
    assert.ok(setMsg, "server received intent.set");
    assert.equal(setMsg.v, 1);
    assert.match(setMsg.id, /^req-/);
    assert.deepEqual(setMsg.payload, { slotId: "mouth-open", value: 0, ttlMs: 400 });
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: sendSet は ttlMs 省略時 payload に載せない（省略 = 器既定窓）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    await channel.sendSet({ slotId: "mouth-open", value: 0 });
    const setMsg = server.received.find((m) => m.kind === "intent.set");
    assert.ok(setMsg);
    assert.deepEqual(setMsg.payload, { slotId: "mouth-open", value: 0 });
    assert.equal("ttlMs" in setMsg.payload, false);
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: sendSet rejected は result/error を返し接続は維持（口閉じは best-effort）", async () => {
  const server = createChannelServerDouble({
    onSet: () => ({ result: "rejected", error: { code: "slotValueOutOfRange", message: "value out of range" } })
  });
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    const outcome = await channel.sendSet({ slotId: "mouth-open", value: 5 });
    assert.equal(outcome.result, "rejected");
    assert.equal(outcome.error.code, "slotValueOutOfRange");
    // 接続は維持 → 続けて speech も送れる（口閉じの rejected で会話は止まらない）。
    const speech = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.equal(speech.result, "accepted");
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: hello 不着はタイムアウト throw", async () => {
  const server = createChannelServerDouble({ sendHello: false });
  const url = await server.listen();
  try {
    await assert.rejects(
      () => connectChannel(url, { WebSocketImpl: WS, helloTimeoutMs: 300 }),
      /timed out.*server\.hello/s
    );
  } finally {
    await server.close();
  }
});

test("connectChannel: cap 未満の複数モーラ timeline も往復する（16bit length 経路）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    // 100 モーラ → JSON は 126byte 超だが 64 KiB safety cap 未満。
    const big = Array.from({ length: 100 }, (_v, i) => ({
      timeMs: i * 10,
      vowel: ["a", "i", "u", "e", "o"][i % 5],
      s: 0.5
    }));
    const outcome = await channel.sendSpeech(big);
    assert.equal(outcome.result, "accepted");
    const speechMsg = server.received.find((m) => m.kind === "intent.speech");
    assert.equal(speechMsg.payload.timeline.length, 100);
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: 未知イベント（未知 kind / 非 JSON / 相関先なし replyTo）を黙殺し計数する", async () => {
  // Domain B レビュー note 1 の回収。写経元 ref-driver の寛容規則を魂側コピーとして独立に固定する。
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    // (a) 未知 kind のサーバ発イベント（replyTo なし・server.hello でもない）→ 黙殺。
    server.sendServerEvent({ v: 1, kind: "server.somethingNew", payload: { x: 1 } });
    // (b) 非 JSON テキストフレーム → 黙殺。
    server.sendRawText("not-json-at-all");
    // (c) 相関先の無い replyTo → 黙殺。
    server.sendServerEvent({ v: 1, replyTo: "req-999", result: "accepted" });

    // 黙殺されても接続は生きており、正規の送出は今までどおり accepted で返る。
    const outcome = await channel.sendSpeech(SPEECH_TIMELINE);
    assert.equal(outcome.result, "accepted");

    // 上記 3 件が未知イベントとして計数されている（consume で読み取り + リセット）。
    const count = channel.consumeUnknownEventCount();
    assert.equal(count, 3);
    // consume はリセットする（2 回目は 0）。
    assert.equal(channel.consumeUnknownEventCount(), 0);
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel: 応答前にサーバ切断すると pending は closedError で reject", async () => {
  // Domain B レビュー note 2 の回収。sendSpeech の応答を待つ間に接続が落ちると pending が
  // closedError で reject される（channel-client.mjs の close ハンドラ経路）。
  const server = createChannelServerDouble({
    // intent.speech を受けたら返信せず接続を落とす。
    onSpeech: () => ({ result: "drop" })
  });
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    await assert.rejects(
      () => channel.sendSpeech(SPEECH_TIMELINE),
      /closed unexpectedly/
    );
  } finally {
    await channel.close();
    await server.close();
  }
});

test("connectChannel diagnostics: close-before-reply と reply timeout は machine-readable に区別する", async () => {
  const closeServer = createChannelServerDouble({ onSpeech: () => ({ result: "drop" }) });
  const closeTraces = [];
  const closeChannel = await connectChannel(await closeServer.listen(), {
    WebSocketImpl: WS,
    onTrace: (event, fields) => closeTraces.push({ event, fields })
  });
  try {
    await assert.rejects(() => closeChannel.sendSpeech(SPEECH_TIMELINE), (error) => {
      assert.equal(error.code, "channel_closed");
      assert.equal(error.diagnosticStage, "control_channel.close");
      return true;
    });
    assert.ok(closeTraces.some((entry) => entry.event === "channel.request.failed" && entry.fields.failureCode === "channel_closed"));
  } finally {
    await closeChannel.close();
    await closeServer.close();
  }

  const timeoutServer = createChannelServerDouble({ onSpeech: () => ({ result: "pending" }) });
  const timeoutTraces = [];
  const timeoutChannel = await connectChannel(await timeoutServer.listen(), {
    WebSocketImpl: WS,
    replyTimeoutMs: 20,
    onTrace: (event, fields) => timeoutTraces.push({ event, fields })
  });
  try {
    await assert.rejects(() => timeoutChannel.sendSpeech(SPEECH_TIMELINE), (error) => {
      assert.equal(error.code, "reply_timeout");
      assert.equal(error.diagnosticStage, "control_channel.reply_timeout");
      return true;
    });
    assert.equal(
      timeoutServer.received.filter((message) => message.kind === "intent.speech").length,
      1,
      "an ambiguous accepted/reply-lost request is never blindly retried"
    );
    assert.ok(timeoutTraces.some((entry) => entry.event === "channel.request.failed" && entry.fields.failureCode === "reply_timeout"));
  } finally {
    await timeoutChannel.close();
    await timeoutServer.close();
  }
});

test("redactToken は token を伏せる（URL は保つ）", () => {
  const out = redactToken("ws://127.0.0.1:17310/channel?token=secret123");
  assert.match(out, /token=%3Credacted%3E|token=<redacted>/);
  assert.ok(!out.includes("secret123"));
  assert.match(out, /127\.0\.0\.1:17310/);
});
