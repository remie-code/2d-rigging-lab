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

test("connectChannel: 複数モーラの大きな timeline も往復する（16bit length 経路）", async () => {
  const server = createChannelServerDouble();
  const url = await server.listen();
  const channel = await connectChannel(url, { WebSocketImpl: WS });
  try {
    // 200 モーラ → JSON は 126byte 超（フレームの 16bit length 経路を通る）。
    const big = Array.from({ length: 200 }, (_v, i) => ({
      timeMs: i * 10,
      vowel: ["a", "i", "u", "e", "o"][i % 5],
      s: 0.5
    }));
    const outcome = await channel.sendSpeech(big);
    assert.equal(outcome.result, "accepted");
    const speechMsg = server.received.find((m) => m.kind === "intent.speech");
    assert.equal(speechMsg.payload.timeline.length, 200);
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

test("redactToken は token を伏せる（URL は保つ）", () => {
  const out = redactToken("ws://127.0.0.1:17310/channel?token=secret123");
  assert.match(out, /token=%3Credacted%3E|token=<redacted>/);
  assert.ok(!out.includes("secret123"));
  assert.match(out, /127\.0\.0\.1:17310/);
});
