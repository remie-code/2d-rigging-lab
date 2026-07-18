// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeSpokenPrefix,
  createBargeInGate,
  BARGE_IN_MIN_SPEECH_MS,
  BARGE_IN_GRACE_MS,
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

test("barge-in: 定数が export される（機械弁窓・猶予窓・中断注記・口閉じスロット）", () => {
  assert.equal(typeof BARGE_IN_MIN_SPEECH_MS, "number");
  assert.ok(BARGE_IN_MIN_SPEECH_MS > 0);
  assert.equal(typeof BARGE_IN_GRACE_MS, "number");
  assert.ok(BARGE_IN_GRACE_MS > 0);
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

test("bargeInGate: 第一段(minSpeechMs)通過後、第二段(graceMs)も発話継続で満了すると確定（二段の合成）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });

  gate.handle({ type: "speechStart", tMs: 1000 });
  assert.equal(gate.isPending(), true);
  timers.advance(199);
  assert.equal(confirms.length, 0); // 第一段もまだ通過しない。
  timers.advance(1); // 200ms 到達 = 第一段通過 → 即座に第二段(猶予)へ。
  assert.equal(confirms.length, 0, "第一段通過直後はまだ確定しない(猶予段へ)");
  assert.equal(gate.isPending(), true, "猶予段も pending 扱い");
  timers.advance(1999);
  assert.equal(confirms.length, 0);
  timers.advance(1); // 猶予(2000ms)満了・speechEnd 未着 = 確定。
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

test("bargeInGate: 猶予中の speechEnd は確定を取り消す（見合い成立=切られない・新意味論）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 1000 });
  timers.advance(200); // 第一段通過 → 猶予段(2000ms)へ。
  assert.equal(gate.isPending(), true);
  gate.handle({ type: "speechEnd", tMs: 1200, startMs: 970, endMs: 1230, durationMs: 260, reason: "silence" });
  assert.equal(gate.isPending(), false, "猶予中の speechEnd で猶予は取り消される");
  timers.advance(2000); // 猶予の元期限を跨いでも発火しない。
  assert.equal(confirms.length, 0, "見合い成立 = onConfirm は呼ばれない(切らない)");
  gate.dispose();
});

test("bargeInGate: 第一段中の speechEnd は無視する（第一段の挙動不変・speechCancel のみが第一段に効く）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 1000 });
  // 第一段(200ms 窓)進行中に speechEnd が来ても無視する(第二段のみに効く仕様)。
  gate.handle({ type: "speechEnd", tMs: 1050, startMs: 970, endMs: 1080, durationMs: 110, reason: "silence" });
  timers.advance(200); // 第一段通過(speechCancel が来なかった) → 猶予段へ。
  assert.equal(confirms.length, 0);
  assert.equal(gate.isPending(), true, "猶予段(2000ms)が進行中");
  timers.advance(2000); // 猶予も speechEnd なしで満了 → 確定。
  assert.equal(confirms.length, 1, "第一段中の speechEnd は無視されたので猶予は取り消されていない");
  gate.dispose();
});

test("bargeInGate: 短い相槌(<graceMs)は無害（猶予の早いタイミングで来た speechEnd でも切られない）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 0 });
  timers.advance(200); // 第一段通過 → 猶予段へ。
  timers.advance(50); // 猶予開始からわずか 50ms(短い相槌の想定)。
  gate.handle({ type: "speechEnd", tMs: 250 });
  assert.equal(gate.isPending(), false, "短い相槌でも猶予中の speechEnd は確定を取り消す");
  timers.advance(5000); // 十分に時間を進めても発火しない。
  assert.equal(confirms.length, 0);
  gate.dispose();
});

test("bargeInGate: 猶予超過(speechEnd 未着のまま満了)で切断する", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 5000 });
  timers.advance(200); // 第一段通過 → 猶予段へ。
  timers.advance(1999);
  assert.equal(confirms.length, 0, "猶予未満はまだ確定しない");
  timers.advance(1); // 猶予(2000ms)満了・発話継続中(speechEnd 未着) = 切断。
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].tMs, 5000);
  gate.dispose();
});

test("bargeInGate: 猶予段中に speechCancel が来ても無関係（speechCancel は第一段のみに効く）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 0 });
  timers.advance(200); // 猶予段へ。
  gate.handle({ type: "speechCancel", tMs: 200 }); // 猶予段中は無関係。
  assert.equal(gate.isPending(), true, "猶予段中の speechCancel は無視される");
  timers.advance(2000);
  assert.equal(confirms.length, 1, "猶予段中の speechCancel では取り消されず、満了どおり確定する");
  gate.dispose();
});

test("bargeInGate: 猶予段中の新たな speechStart は無視する（次の一巡は見合い成立後のみ・裁量）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 0 });
  timers.advance(200); // 猶予段へ(pendingEvent は tMs:0 の speechStart)。
  gate.handle({ type: "speechStart", tMs: 250 }); // 猶予段中の新オンセットは無視。
  timers.advance(2000); // 満了 → 確定(元の tMs:0 のイベントで確定する)。
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].tMs, 0, "猶予段中に無視された新オンセットで張り替わらない");
  gate.dispose();
});

test("bargeInGate: 連続 speechStart は待機を張り替える（新オンセット優先・二重確定しない・二段タイミングへ追随）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 1000 });
  timers.advance(100);
  gate.handle({ type: "speechStart", tMs: 1100 }); // 張り替え(第一段のみ・猶予段はまだ始まっていない)。
  timers.advance(100); // 最初の窓の元期限（200）だが張り替え済みで発火しない。
  assert.equal(confirms.length, 0);
  timers.advance(100); // 2 本目の 200ms（tMs=1100 の窓）到達 → 第一段通過 → 猶予段へ。
  assert.equal(confirms.length, 0, "第一段通過直後はまだ確定しない(猶予段へ)");
  timers.advance(2000); // 猶予満了・speechEnd なし → 確定。
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

test("bargeInGate: 既定 minSpeechMs/graceMs（未指定）は BARGE_IN_MIN_SPEECH_MS/BARGE_IN_GRACE_MS", () => {
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
  timers.advance(1); // 第一段通過 → 猶予段(既定 BARGE_IN_GRACE_MS)へ。
  assert.equal(confirms.length, 0, "第一段通過直後はまだ確定しない");
  timers.advance(BARGE_IN_GRACE_MS - 1);
  assert.equal(confirms.length, 0);
  timers.advance(1); // 猶予満了。
  assert.equal(confirms.length, 1);
  gate.dispose();
});

// ── setEnabled/isEnabled（トグル・L0 設計裁定 1）─────────────────────────────

test("bargeInGate: 既定 enabled=true（未指定）・setEnabled/isEnabled で切替できる", () => {
  const timers = makeFakeTimers();
  const gate = createBargeInGate({
    onConfirm: () => {},
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  assert.equal(gate.isEnabled(), true, "既定は ON(裁定 1)");
  gate.setEnabled(false);
  assert.equal(gate.isEnabled(), false);
  gate.setEnabled(true);
  assert.equal(gate.isEnabled(), true);
  gate.dispose();
});

test("bargeInGate: options.enabled=false で初期 OFF にできる", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    enabled: false,
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  assert.equal(gate.isEnabled(), false);
  gate.handle({ type: "speechStart", tMs: 0 }); // OFF 中は無視。
  assert.equal(gate.isPending(), false);
  timers.advance(2200);
  assert.equal(confirms.length, 0);
  gate.dispose();
});

test("OFF トグル: setEnabled(false) 後は speechStart→十分な経過でも onConfirm ゼロ（割り込みゼロ）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.setEnabled(false);
  gate.handle({ type: "speechStart", tMs: 0 });
  assert.equal(gate.isPending(), false, "OFF 中は待機すら開始しない");
  timers.advance(10_000); // 第一段+猶予を大きく超えて経過。
  assert.equal(confirms.length, 0);
  gate.dispose();
});

test("OFF トグル: 猶予段の進行中に OFF にすると畳まれる（onConfirm に至る経路がゼロになる）", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 0 });
  timers.advance(200); // 猶予段(進行中)へ。
  assert.equal(gate.isPending(), true);
  gate.setEnabled(false); // 猶予段の途中で OFF。
  assert.equal(gate.isPending(), false, "OFF で進行中の猶予も畳まれる");
  timers.advance(2000); // 元の猶予期限を跨いでも発火しない。
  assert.equal(confirms.length, 0);
  gate.dispose();
});

test("OFF トグル: 第一段(ノイズ弁)の進行中に OFF にすると畳まれる", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.handle({ type: "speechStart", tMs: 0 });
  timers.advance(100); // 第一段の途中。
  gate.setEnabled(false);
  assert.equal(gate.isPending(), false);
  timers.advance(10_000);
  assert.equal(confirms.length, 0);
  gate.dispose();
});

test("OFF→ON 復帰: OFF から ON に戻すと以後の新規 speechStart は通常どおり機能する", () => {
  const timers = makeFakeTimers();
  /** @type {any[]} */
  const confirms = [];
  const gate = createBargeInGate({
    onConfirm: (e) => confirms.push(e),
    minSpeechMs: 200,
    graceMs: 2000,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl
  });
  gate.setEnabled(false);
  gate.handle({ type: "speechStart", tMs: 0 }); // OFF 中は無視。
  timers.advance(3000);
  assert.equal(confirms.length, 0);
  gate.setEnabled(true); // ON へ復帰。
  gate.handle({ type: "speechStart", tMs: 3000 }); // 新規発話は通常どおり二段を通る。
  timers.advance(200);
  timers.advance(2000);
  assert.equal(confirms.length, 1, "ON 復帰後の新規 speechStart は通常どおり確定する");
  assert.equal(confirms[0].tMs, 3000);
  gate.dispose();
});
