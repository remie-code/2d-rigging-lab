// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createPcmRingBuffer } from "./pcm-ring-buffer.mjs";

// PCM リングバッファの fixture テスト（S2 Domain C）。
// 実データは決定論の合成サンプル（値 = 絶対サンプル位置 % 32768）で、切り出し結果の
// 「どの範囲が返ったか」をサンプル値そのもので検算できるようにする。

/** 値 = 絶対位置 % 32768 の Int16Array を作る（開始位置 from・長さ n）。 */
function seq(from, n) {
  const out = new Int16Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (from + i) % 32768;
  return out;
}

test("ring: 書いた範囲をそのまま切り出せる（1000ms 中の 250..500ms）", () => {
  const ring = createPcmRingBuffer({ capacityMs: 1000, sampleRate: 16000 });
  ring.write(seq(0, 16000)); // 0..1000ms
  const cut = ring.slice({ startMs: 250, endMs: 500 });
  assert.equal(cut.samples.length, 4000);
  assert.equal(cut.startMs, 250);
  assert.equal(cut.endMs, 500);
  assert.equal(cut.clamped, false);
  assert.equal(cut.samples[0], 4000); // 絶対サンプル位置 4000 = 250ms
  assert.equal(cut.samples[3999], 7999);
});

test("ring: 複数回の write をまたぐ切り出し（チャンク境界に依存しない）", () => {
  const ring = createPcmRingBuffer({ capacityMs: 1000, sampleRate: 16000 });
  for (let i = 0; i < 10; i += 1) {
    ring.write(seq(i * 1600, 1600)); // 100ms ずつ 10 回
  }
  const cut = ring.slice({ startMs: 150, endMs: 350 });
  assert.equal(cut.samples.length, 3200);
  assert.equal(cut.samples[0], 2400); // 150ms = sample 2400
  assert.equal(cut.samples[3199], 5599);
});

test("ring: 容量超過で古いデータが破棄され、破棄済み範囲への要求は保持窓先頭に clamp", () => {
  const ring = createPcmRingBuffer({ capacityMs: 500, sampleRate: 16000 }); // 容量 8000 サンプル
  ring.write(seq(0, 16000)); // 1000ms 書く → 先頭 500ms は破棄済み
  assert.equal(ring.totalMs(), 1000);
  assert.equal(ring.oldestMs(), 500);
  const cut = ring.slice({ startMs: 100, endMs: 700 }); // 100..500ms は失われている
  assert.equal(cut.clamped, true);
  assert.equal(cut.startMs, 500); // 保持窓の先頭へ clamp
  assert.equal(cut.endMs, 700);
  assert.equal(cut.samples.length, 3200);
  assert.equal(cut.samples[0], 8000); // 500ms = sample 8000（新しいデータが正しく残っている）
  assert.equal(cut.samples[3199], 11199);
});

test("ring: endMs が実データ末尾を超える要求は末尾へ clamp（flush 時 pad 超過の契約・note 1）", () => {
  const ring = createPcmRingBuffer({ capacityMs: 1000, sampleRate: 16000 });
  ring.write(seq(0, 8000)); // 500ms まで実在
  const cut = ring.slice({ startMs: 400, endMs: 530 }); // endMs は pad 分だけ実在範囲超え
  assert.equal(cut.clamped, true);
  assert.equal(cut.startMs, 400);
  assert.equal(cut.endMs, 500); // 実データ末尾へ clamp
  assert.equal(cut.samples.length, 1600);
  assert.equal(cut.samples[1599], 7999);
});

test("ring: startMs 負値は 0 に、全範囲欠落は空切り出しに退化（throw しない）", () => {
  const ring = createPcmRingBuffer({ capacityMs: 1000, sampleRate: 16000 });
  ring.write(seq(0, 1600)); // 100ms
  const cut = ring.slice({ startMs: -30, endMs: 50 });
  assert.equal(cut.clamped, true);
  assert.equal(cut.startMs, 0);
  assert.equal(cut.samples[0], 0);
  // 実データより完全に先の範囲 → 空（startMs=endMs=末尾）。
  const empty = ring.slice({ startMs: 200, endMs: 300 });
  assert.equal(empty.samples.length, 0);
  assert.equal(empty.startMs, 100);
  assert.equal(empty.endMs, 100);
});

test("ring: 1 回の write が容量を超えたら末尾 capacity 分だけ残る", () => {
  const ring = createPcmRingBuffer({ capacityMs: 250, sampleRate: 16000 }); // 容量 4000
  ring.write(seq(0, 16000)); // 1000ms 一括
  assert.equal(ring.totalMs(), 1000);
  assert.equal(ring.oldestMs(), 750);
  const cut = ring.slice({ startMs: 750, endMs: 1000 });
  assert.equal(cut.samples.length, 4000);
  assert.equal(cut.samples[0], 12000);
  assert.equal(cut.samples[3999], 15999);
});

test("ring: 切り出しはコピー（後続 write で書き換わらない）", () => {
  const ring = createPcmRingBuffer({ capacityMs: 100, sampleRate: 16000 }); // 容量 1600
  ring.write(seq(0, 1600));
  const cut = ring.slice({ startMs: 0, endMs: 100 });
  const before = cut.samples[0];
  ring.write(seq(1600, 1600)); // リングを一周させて上書き
  assert.equal(cut.samples[0], before);
});

test("ring: 入力検査（非 Int16Array・不正 range は throw）と reset", () => {
  const ring = createPcmRingBuffer({ capacityMs: 100 });
  assert.throws(() => ring.write(/** @type {any} */ (new Uint8Array(4))), TypeError);
  assert.throws(() => ring.slice(/** @type {any} */ ({ startMs: NaN, endMs: 1 })), TypeError);
  assert.throws(() => ring.slice({ startMs: 100, endMs: 50 }), RangeError);
  assert.throws(() => createPcmRingBuffer({ capacityMs: 0 }), RangeError);
  ring.write(seq(0, 160));
  ring.reset();
  assert.equal(ring.totalMs(), 0);
  assert.equal(ring.slice({ startMs: 0, endMs: 100 }).samples.length, 0);
});
