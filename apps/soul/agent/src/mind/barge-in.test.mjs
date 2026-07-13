// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeSpokenPrefix,
  createBargeInGate,
  BARGE_IN_MIN_SPEECH_MS,
  BARGE_IN_NOTE,
  MOUTH_CLOSE_SLOT_ID,
  MOUTH_CLOSE_TTL_MS
} from "./barge-in.mjs";

// barge-in の純部品（切断点算出 + 機械弁）の決定論テスト。実 clock・実 timer は使わず fake 注入。
// blocking 基準 4「声に出とらん文字を出たことにしない」を境界で固定する。

/** 手動 fake タイマ（決定論）。advance(ms) で期限到達したタイマを順に発火する。 */
function makeFakeTimers() {
  let now = 0;
  let seq = 0;
  /** @type {Map<number, { fn: () => void; at: number }>} */
  const timers = new Map();
  const setTimeoutImpl = /** @type {any} */ ((fn, ms) => {
    const id = (seq += 1);
    timers.set(id, { fn, at: now + ms });
    return id;
  });
  const clearTimeoutImpl = /** @type {any} */ ((id) => {
    timers.delete(id);
  });
  const advance = (ms) => {
    const target = now + ms;
    for (;;) {
      /** @type {{ id: number; at: number; fn: () => void } | null} */
      let next = null;
      for (const [id, t] of timers) {
        if (t.at <= target && (next === null || t.at < next.at || (t.at === next.at && id < next.id))) {
          next = { id, at: t.at, fn: t.fn };
        }
      }
      if (next === null) break;
      timers.delete(next.id);
      now = next.at;
      next.fn();
    }
    now = target;
  };
  return { setTimeoutImpl, clearTimeoutImpl, advance, pending: () => timers.size };
}

// ── 定数 ─────────────────────────────────────────────────────────────

test("barge-in: 定数が export される（機械弁窓・中断注記・口閉じスロット）", () => {
  assert.equal(typeof BARGE_IN_MIN_SPEECH_MS, "number");
  assert.ok(BARGE_IN_MIN_SPEECH_MS > 0);
  assert.equal(typeof BARGE_IN_NOTE, "string");
  assert.ok(BARGE_IN_NOTE.length > 0);
  assert.equal(MOUTH_CLOSE_SLOT_ID, "mouth-open");
  assert.equal(typeof MOUTH_CLOSE_TTL_MS, "number");
  assert.ok(MOUTH_CLOSE_TTL_MS > 0);
});

// ── computeSpokenPrefix（切断点算出・正直性）─────────────────────────────

/** 「こんにちは」5 母音の等間隔タイムライン（pre 無音 100ms・以後 100ms 間隔）。 */
const TIMELINE_5 = [
  { timeMs: 100, vowel: "o", s: 0.6 }, // こ
  { timeMs: 200, vowel: "o", s: 0.6 }, // ん→省略されるが、ここでは 5 母音固定で単純化
  { timeMs: 300, vowel: "i", s: 0.5 }, // に
  { timeMs: 400, vowel: "i", s: 0.5 }, // ち
  { timeMs: 500, vowel: "a", s: 0.85 } // は
];
const TEXT_5 = "こんにちは"; // 5 文字・timeline 5 要素（1:1 に近い理想ケース）

test("computeSpokenPrefix: 経過0 は何も出ていない（空接頭辞）", () => {
  const r = computeSpokenPrefix({ speechText: TEXT_5, timeline: TIMELINE_5, elapsedMs: 0 });
  assert.equal(r.charsSpoken, 0);
  assert.equal(r.prefix, "");
});

test("computeSpokenPrefix: 経過が負でも空（下限で保守側）", () => {
  const r = computeSpokenPrefix({ speechText: TEXT_5, timeline: TIMELINE_5, elapsedMs: -50 });
  assert.equal(r.charsSpoken, 0);
  assert.equal(r.prefix, "");
});

test("computeSpokenPrefix: 最初のオンセット丁度では数えない（厳密不等号・まだ音になっていない）", () => {
  // elapsedMs = 100 = timeline[0].timeMs。timeMs < elapsedMs を満たす要素は無い → 0 文字。
  const r = computeSpokenPrefix({ speechText: TEXT_5, timeline: TIMELINE_5, elapsedMs: 100 });
  assert.equal(r.startedMoras, 0);
  assert.equal(r.charsSpoken, 0);
});

test("computeSpokenPrefix: 途中経過は接頭辞（過大にならない・floor）", () => {
  // elapsedMs = 350 → timeMs<350 は 100,200,300 の 3 要素 → fraction 3/5 → floor(0.6*5)=3 → "こんに"。
  const r = computeSpokenPrefix({ speechText: TEXT_5, timeline: TIMELINE_5, elapsedMs: 350 });
  assert.equal(r.startedMoras, 3);
  assert.equal(r.charsSpoken, 3);
  assert.equal(r.prefix, "こんに");
});

test("computeSpokenPrefix: 最後のオンセットを厳密に過ぎたら全文（経過≥全長 = 全文）", () => {
  const r = computeSpokenPrefix({ speechText: TEXT_5, timeline: TIMELINE_5, elapsedMs: 501 });
  assert.equal(r.startedMoras, 5);
  assert.equal(r.charsSpoken, 5);
  assert.equal(r.prefix, TEXT_5);
});

test("computeSpokenPrefix: 最後のオンセット丁度ではまだ全文でない（保守側・末尾母音は立ち上がる瞬間）", () => {
  // elapsedMs = 500 = 最後の timeMs。timeMs<500 は 4 要素 → floor(4/5*5)=4 → "こんにち"（全文でない）。
  const r = computeSpokenPrefix({ speechText: TEXT_5, timeline: TIMELINE_5, elapsedMs: 500 });
  assert.equal(r.startedMoras, 4);
  assert.equal(r.charsSpoken, 4);
  assert.equal(r.prefix, "こんにち");
});

test("computeSpokenPrefix: 文字数 > モーラ数でも過大評価しない（各経過で floor・単調非減少）", () => {
  // モーラ 5・文字 10（っ/ー/句読点などで文字がモーラより多い現実ケース）。
  const text10 = "あいうえおかきくけこ";
  let prev = 0;
  for (let elapsed = 0; elapsed <= 700; elapsed += 25) {
    const r = computeSpokenPrefix({ speechText: text10, timeline: TIMELINE_5, elapsedMs: elapsed });
    // 単調非減少（時間が進んで文字が減ることはない）。
    assert.ok(r.charsSpoken >= prev, `charsSpoken monotonic at elapsed=${elapsed}`);
    prev = r.charsSpoken;
    // 過大評価しない上限: 始まったモーラ割合 × 文字数を超えない（floor 済み）。
    assert.ok(r.charsSpoken <= Math.floor((r.startedMoras / 5) * 10));
    // 経過0 で 0・全経過超で全文。
    if (elapsed === 0) assert.equal(r.charsSpoken, 0);
  }
  const full = computeSpokenPrefix({ speechText: text10, timeline: TIMELINE_5, elapsedMs: 999 });
  assert.equal(full.charsSpoken, 10);
});

test("computeSpokenPrefix: 空 timeline・空文字は 0 文字（材料が無い = 何も主張しない）", () => {
  assert.equal(computeSpokenPrefix({ speechText: TEXT_5, timeline: [], elapsedMs: 999 }).charsSpoken, 0);
  assert.equal(computeSpokenPrefix({ speechText: "", timeline: TIMELINE_5, elapsedMs: 999 }).charsSpoken, 0);
});

test("computeSpokenPrefix: timeMs が数でない要素は数えない（成功を捏造しない側）", () => {
  const dirty = [
    { timeMs: 100, vowel: "a", s: 0.5 },
    { timeMs: /** @type {any} */ ("x"), vowel: "a", s: 0.5 },
    { timeMs: 300, vowel: "a", s: 0.5 }
  ];
  const r = computeSpokenPrefix({ speechText: "abcd", timeline: dirty, elapsedMs: 400 });
  // 有効オンセット timeMs<400 は 100,300 の 2 要素（"x" は無視）→ floor(2/3*4)=2。
  assert.equal(r.startedMoras, 2);
  assert.equal(r.charsSpoken, 2);
});

test("computeSpokenPrefix: 不正入力は throw（呼び出し側のバグを黙殺しない）", () => {
  assert.throws(() => computeSpokenPrefix({ speechText: 1, timeline: [], elapsedMs: 0 }), /speechText/);
  assert.throws(() => computeSpokenPrefix({ speechText: "a", timeline: "x", elapsedMs: 0 }), /timeline/);
  assert.throws(() => computeSpokenPrefix({ speechText: "a", timeline: [], elapsedMs: NaN }), /elapsedMs/);
});

// ── createBargeInGate（機械弁・確定/取消/境界）─────────────────────────────

test("bargeInGate: speechStart 後 minSpeechMs 経過で確定（speechCancel が来なければ）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  gate.handle({ type: "speechStart", tMs: 1000 });
  assert.equal(gate.isPending(), true);
  timers.advance(199);
  assert.equal(confirms.length, 0); // まだ確定しない。
  timers.advance(1); // 200ms 到達。
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].tMs, 1000); // speechStart イベントが渡る。
  assert.equal(gate.isPending(), false);
  gate.dispose();
});

test("bargeInGate: 窓内に speechCancel が来たら確定しない（瞬間スパイクでは声を止めない）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  gate.handle({ type: "speechStart", tMs: 1000 });
  timers.advance(150);
  gate.handle({ type: "speechCancel", tMs: 1150 }); // 窓内で取消。
  assert.equal(gate.isPending(), false);
  timers.advance(500); // 元の窓を跨いでも発火しない。
  assert.equal(confirms.length, 0);
  gate.dispose();
});

test("bargeInGate: speechEnd は機械弁に無関係（確定判断を変えない）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 1000 });
  gate.handle({ type: "speechEnd", tMs: 1100, startMs: 970, endMs: 1130, durationMs: 160, reason: "silence" });
  timers.advance(200);
  assert.equal(confirms.length, 1); // speechEnd は取消でない → 確定はそのまま起きる。
  gate.dispose();
});

test("bargeInGate: 連続 speechStart は待機を張り替える（新オンセット優先・二重確定しない）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 1000 });
  timers.advance(100);
  gate.handle({ type: "speechStart", tMs: 1100 }); // 張り替え。
  timers.advance(100); // 最初の窓の元期限（200）だが張り替え済みで発火しない。
  assert.equal(confirms.length, 0);
  timers.advance(100); // 2 本目の 200ms（tMs=1100 の窓）到達。
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].tMs, 1100);
  gate.dispose();
});

test("bargeInGate: dispose 後は待機タイマを畳み以後のイベントも無視（ハングしない）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 1000 });
  gate.dispose();
  assert.equal(timers.pending(), 0); // タイマは畳まれた。
  timers.advance(500);
  assert.equal(confirms.length, 0);
  gate.handle({ type: "speechStart", tMs: 2000 }); // dispose 後は無視。
  assert.equal(gate.isPending(), false);
});

test("bargeInGate: 既定 minSpeechMs（未指定）は BARGE_IN_MIN_SPEECH_MS", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 0 });
  timers.advance(BARGE_IN_MIN_SPEECH_MS - 1);
  assert.equal(confirms.length, 0);
  timers.advance(1);
  assert.equal(confirms.length, 1);
  gate.dispose();
});
