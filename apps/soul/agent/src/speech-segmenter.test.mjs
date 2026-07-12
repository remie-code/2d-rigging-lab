// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  segmentSpeech,
  createSpeechSegmenter,
  DEFAULT_FRAME_MS
} from "./speech-segmenter.mjs";
import { probSequence } from "./fixtures-audio.mjs";

// 既定 frameMs=32（512 サンプル @16kHz）。時刻 tMs = frameIndex*32。
const F = DEFAULT_FRAME_MS;

test("無音→発話→無音: 1 セグメントが speechStart/speechEnd で挟まれる", () => {
  const probs = probSequence([
    { n: 5, p: 0.0 }, // 無音 frames 0-4
    { n: 20, p: 0.9 }, // 発話 frames 5-24（640ms）
    { n: 8, p: 0.0 } // 無音 frames 25-32
  ]);
  const { segments, events } = segmentSpeech(probs, { frameMs: F });
  assert.equal(segments.length, 1);
  // 発話開始 frame5=160ms、pad30 → startMs=130。無音開始 frame25=800ms、pad30 → endMs=830。
  assert.deepEqual(segments[0], { startMs: 130, endMs: 830, durationMs: 700, reason: "silence" });
  // イベント順: speechStart(即発火・pad済み130) → speechEnd。
  assert.equal(events[0].type, "speechStart");
  assert.equal(events[0].tMs, 130);
  assert.equal(events[1].type, "speechEnd");
  assert.equal(events.length, 2);
});

test("短すぎるスパイクは棄却: speechEnd を出さず speechCancel", () => {
  const probs = probSequence([
    { n: 5, p: 0.0 },
    { n: 3, p: 0.9 }, // 発話 3 フレーム = 96ms < minSpeech 250 → 棄却
    { n: 8, p: 0.0 }
  ]);
  const { segments, events } = segmentSpeech(probs, { frameMs: F });
  assert.equal(segments.length, 0);
  assert.equal(events[0].type, "speechStart"); // 暫定オンセットは出る（barge-in 用）
  const last = events[events.length - 1];
  assert.equal(last.type, "speechCancel"); // が minSpeech 未満で retraction
  assert.equal(last.startMs, 130); // frame5=160 - pad30
});

test("長発話の分割: maxSpeech を超えたら無音を待たず強制区切り", () => {
  const probs = probSequence([{ n: 25, p: 0.9 }]); // 連続発話 800ms
  const { segments } = segmentSpeech(probs, { frameMs: F, maxSpeechMs: 300 });
  // frame0 開始。frame10(320)>=300 で 1 回目区切り。frame20(640) で 2 回目。
  assert.equal(segments.length, 2);
  assert.equal(segments[0].reason, "maxSpeech");
  assert.equal(segments[1].reason, "maxSpeech");
  assert.deepEqual({ s: segments[0].startMs, e: segments[0].endMs }, { s: 0, e: 350 });
  assert.deepEqual({ s: segments[1].startMs, e: segments[1].endMs }, { s: 290, e: 670 });
});

test("ヒステリシス: negThreshold 上のディップでは区切らない", () => {
  const probs = probSequence([
    { n: 2, p: 0.0 },
    { n: 10, p: 0.9 },
    { n: 3, p: 0.4 }, // threshold 0.5 未満だが negThreshold 0.35 以上 → 発話継続
    { n: 10, p: 0.9 },
    { n: 8, p: 0.0 }
  ]);
  const { segments } = segmentSpeech(probs, { frameMs: F });
  assert.equal(segments.length, 1); // ディップで割れず 1 本
  assert.equal(segments[0].startMs, 34); // frame2=64 - pad30
});

test("パディング: speechPadMs=0 なら生の境界そのまま", () => {
  const probs = probSequence([
    { n: 5, p: 0.0 },
    { n: 20, p: 0.9 },
    { n: 8, p: 0.0 }
  ]);
  const { segments } = segmentSpeech(probs, { frameMs: F, speechPadMs: 0 });
  assert.equal(segments[0].startMs, 160); // pad なし
  assert.equal(segments[0].endMs, 800);
});

test("パディング: 開始が 0ms 未満に食い込まない（clamp 0）", () => {
  const probs = probSequence([
    { n: 1, p: 0.9 }, // frame0 から即発話
    { n: 20, p: 0.9 },
    { n: 8, p: 0.0 }
  ]);
  const { events } = segmentSpeech(probs, { frameMs: F, speechPadMs: 100 });
  assert.equal(events[0].type, "speechStart");
  assert.equal(events[0].tMs, 0); // max(0, 0-100) = 0
});

test("streaming: speechStart は発話オンセットの push で即返る", () => {
  const seg = createSpeechSegmenter({ frameMs: F });
  assert.deepEqual(seg.push(0.0, 0), []); // 無音
  assert.equal(seg.isSpeaking(), false);
  const onOnset = seg.push(0.9, 32); // 立ち上げ
  assert.equal(onOnset.length, 1);
  assert.equal(onOnset[0].type, "speechStart");
  assert.equal(seg.isSpeaking(), true);
});

test("streaming: flush で triggered 中の発話を確定できる", () => {
  const seg = createSpeechSegmenter();
  const acc = [];
  for (let i = 0; i < 20; i += 1) for (const e of seg.push(0.9, i * F)) acc.push(e);
  // まだ無音が来ていないので speechEnd は未発火。
  assert.equal(acc.filter((e) => e.type === "speechEnd").length, 0);
  const flushed = seg.flush(20 * F);
  assert.equal(flushed.length, 1);
  assert.equal(flushed[0].type, "speechEnd");
  assert.equal(flushed[0].reason, "flush");
});

test("onEvent コールバックと返り値の双方でイベントを受け取れる", () => {
  const cbEvents = [];
  const seg = createSpeechSegmenter({}, (e) => cbEvents.push(e));
  seg.push(0.9, 0);
  assert.equal(cbEvents.length, 1);
  assert.equal(cbEvents[0].type, "speechStart");
});

test("reset で状態が初期化される", () => {
  const seg = createSpeechSegmenter();
  seg.push(0.9, 0);
  assert.equal(seg.isSpeaking(), true);
  seg.reset();
  assert.equal(seg.isSpeaking(), false);
  // reset 後は再び tMs=0 から投入できる（単調性エラーにならない）。
  assert.doesNotThrow(() => seg.push(0.0, 0));
});

test("不正: threshold が範囲外は throw", () => {
  assert.throws(() => createSpeechSegmenter({ threshold: 0 }), /threshold/);
  assert.throws(() => createSpeechSegmenter({ threshold: 1.5 }), /threshold/);
});

test("不正: negThreshold >= threshold は throw", () => {
  assert.throws(() => createSpeechSegmenter({ threshold: 0.5, negThreshold: 0.5 }), /negThreshold/);
});

test("不正: push の probability/tMs が非有限は throw", () => {
  const seg = createSpeechSegmenter();
  assert.throws(() => seg.push(NaN, 0), TypeError);
  assert.throws(() => seg.push(0.5, NaN), TypeError);
});

test("不正: tMs が後退したら throw（単調性）", () => {
  const seg = createSpeechSegmenter();
  seg.push(0.1, 100);
  assert.throws(() => seg.push(0.1, 50), /non-decreasing/);
});
