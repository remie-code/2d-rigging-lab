// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createVoiceEngine,
  DEFAULT_VOICE_ENGINE_KIND,
  isVoiceEngine,
  VOICE_ENGINE_KINDS,
  VOICE_ENGINE_STATUSES
} from "./voice-engine.mjs";
import { createEngineStatusCell } from "./engine-status.mjs";

test("createVoiceEngine: aivis を作れる（既定）・形を満たす・知らない kind は投げる", () => {
  assert.deepEqual(VOICE_ENGINE_KINDS, ["aivis"]);
  assert.equal(DEFAULT_VOICE_ENGINE_KIND, "aivis");
  const engine = createVoiceEngine("aivis", { tts: { async audioQuery() { return {}; }, async synthesis() { return new Uint8Array(); } } });
  assert.equal(engine.kind, "aivis");
  assert.ok(isVoiceEngine(engine));
  assert.throws(() => createVoiceEngine("elevenlabs"), RangeError);
  assert.throws(() => createVoiceEngine("toString"), RangeError, "prototype の名前を kind と取り違えない");
  assert.equal(isVoiceEngine({}), false);
  engine.dispose();
});

test("engine の状態: STT と同じ語彙・同じ値は通知しない・購読者の失敗で壊れない・解除できる", () => {
  assert.deepEqual(VOICE_ENGINE_STATUSES, ["connecting", "up", "reconnecting", "down"]);
  const cell = createEngineStatusCell("connecting");
  const seen = [];
  cell.onStatus(() => {
    throw new Error("listener failure");
  });
  const off = cell.onStatus((s) => seen.push(s));
  cell.set("up");
  cell.set("up");
  cell.set("reconnecting");
  off();
  cell.set("down");
  assert.equal(cell.get(), "down");
  assert.deepEqual(seen, ["up", "reconnecting"]);
  assert.throws(() => cell.set(/** @type {any} */ ("broken")), RangeError);
  assert.throws(() => createEngineStatusCell(/** @type {any} */ ("nope")), RangeError);
});
