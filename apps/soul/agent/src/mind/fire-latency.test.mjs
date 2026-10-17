// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createFireTiming,
  composeReplyLatency,
  latencyLevel,
  resolveLatencyThresholds,
  LATENCY_WARN_SEC_DEFAULT,
  LATENCY_ALERT_SEC_DEFAULT,
  LATENCY_SEGMENT_KEYS
} from "./fire-latency.mjs";

// 返事の遅延の記録（純ロジック）。時計は注入、トレースは event 名と数値だけ。

test("既定のしきい値は 4 秒（琥珀）と 6 秒（赤）・区間のキーは凡例の順", () => {
  assert.equal(LATENCY_WARN_SEC_DEFAULT, 4);
  assert.equal(LATENCY_ALERT_SEC_DEFAULT, 6);
  assert.deepEqual(LATENCY_SEGMENT_KEYS, [
    "transcribeMs",
    "judgeMs",
    "screenMs",
    "llmFirstMs",
    "firstSentenceMs",
    "ttsMs",
    "voiceMs"
  ]);
});

test("resolveLatencyThresholds: 正の有限数だけ採り、赤が琥珀より小さければ琥珀に揃える", () => {
  assert.deepEqual(resolveLatencyThresholds(undefined), { warnSec: 4, alertSec: 6 });
  assert.deepEqual(resolveLatencyThresholds({ warnSec: 3, alertSec: 5 }), { warnSec: 3, alertSec: 5 });
  assert.deepEqual(resolveLatencyThresholds({ warnSec: -1, alertSec: "x" }), { warnSec: 4, alertSec: 6 });
  assert.deepEqual(resolveLatencyThresholds({ warnSec: 7 }), { warnSec: 7, alertSec: 7 });
});

test("latencyLevel: 4 秒「超」で warn、6 秒「超」で alert（ちょうどは下の区分）", () => {
  const t = { warnSec: 4, alertSec: 6 };
  assert.equal(latencyLevel(4000, t), "ok");
  assert.equal(latencyLevel(4001, t), "warn");
  assert.equal(latencyLevel(6000, t), "warn");
  assert.equal(latencyLevel(6001, t), "alert");
  assert.equal(latencyLevel(null, t), null);
});

test("createFireTiming: 最初の文の jobId だけを見る・同じ event の 2 回目は無視・知らない event は無視", () => {
  let now = 100;
  const timing = createFireTiming({ nowImpl: () => now });
  now = 200;
  timing.observe("llm.ask.started");
  now = 500;
  timing.observe("llm.first_delta");
  now = 600;
  timing.observe("llm.first_delta"); // 2 回目は無視。
  now = 700;
  timing.observe("progressive.first_safe_sentence");
  now = 720;
  timing.observe("tts.audio_query.started", { jobId: "fire-1:sentence-2" }); // 2 文目は見ない。
  now = 750;
  timing.observe("tts.audio_query.started", { jobId: "fire-1:sentence-1" });
  now = 1000;
  timing.observe("tts.synthesis.completed", { jobId: "fire-1:sentence-1" });
  timing.observe("something.else", { elapsedMs: 9 });
  assert.equal(timing.hasVoiceStarted(), false);
  now = 1300;
  timing.observe("progressive.player.started", { jobId: "fire-1:sentence-1" });
  assert.equal(timing.hasVoiceStarted(), true);
  assert.equal(timing.markVoiceStarted(), false, "鳴り始めは 1 回だけ");
  timing.noteTtft(9999); // first delta があればそちらが優先。
  assert.deepEqual(timing.segments(), {
    screenMs: null,
    llmFirstMs: 300,
    firstSentenceMs: 200,
    ttsMs: 250,
    voiceMs: 300,
    inFireMs: 1200,
    otherMs: 1200 - (300 + 200 + 250 + 300)
  });
});

test("createFireTiming: 声が鳴らなければ inFire / other は null・画面は capture の elapsedMs", () => {
  let now = 0;
  const timing = createFireTiming({ nowImpl: () => now });
  timing.observe("vision.capture.completed", { elapsedMs: 612.4 });
  timing.observe("llm.ask.started");
  timing.noteTtft(450.6);
  const s = timing.segments();
  assert.equal(s.screenMs, 612);
  assert.equal(s.llmFirstMs, 451);
  assert.equal(s.inFireMs, null);
  assert.equal(s.otherMs, null);
  assert.equal(timing.hasAsked(), true);
});

test("composeReplyLatency: 合計 = 文字起こし + 判定 + 発火の中（声が鳴ったときだけ）と区分", () => {
  const inFire = {
    fireId: 7,
    cause: { type: "speak-now", choice: "respond", probability: 0.72, triggerSeq: 41 },
    vision: false,
    spoken: true,
    screenMs: null,
    llmFirstMs: 900,
    firstSentenceMs: 300,
    ttsMs: 400,
    voiceMs: 200,
    inFireMs: 1900,
    otherMs: 100
  };
  const rec = composeReplyLatency(inFire, { transcribeMs: 512.3, judgeMs: 812, thresholds: { warnSec: 4, alertSec: 6 } });
  assert.deepEqual(rec, {
    fireId: 7,
    cause: inFire.cause,
    spoken: true,
    segments: {
      transcribeMs: 512,
      judgeMs: 812,
      screenMs: null,
      llmFirstMs: 900,
      firstSentenceMs: 300,
      ttsMs: 400,
      voiceMs: 200
    },
    otherMs: 100,
    totalMs: 512 + 812 + 1900,
    level: "ok"
  });
  const slow = composeReplyLatency({ ...inFire, inFireMs: 5500 }, { thresholds: { warnSec: 4, alertSec: 6 } });
  assert.equal(slow.totalMs, 5500);
  assert.equal(slow.segments.transcribeMs, null);
  assert.equal(slow.level, "warn");
  const silent = composeReplyLatency({ ...inFire, spoken: false, inFireMs: null }, { thresholds: { warnSec: 4, alertSec: 6 } });
  assert.equal(silent.totalMs, null);
  assert.equal(silent.level, null);
});
