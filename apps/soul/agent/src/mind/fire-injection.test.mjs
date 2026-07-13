// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatFireInjection, FIRE_WINDOW_MS, FIRE_MAX_CHARS } from "./fire-injection.mjs";

// 注入整形の純関数（S3 Domain A）の fixture テスト。窓の内外境界・話者ラベル・文字上限で
// 古い方落とし・空窓・you/soul 混在を網羅的に固定する。純関数なので I/O・時計は全て引数。

/** all() が返す形の最小エントリ（appendedAtMs と speaker と text だけ使う）。 */
function entry(appendedAtMs, text, speaker = "you", displayName = undefined) {
  return { seq: 0, startMs: 0, endMs: 0, text, speaker, displayName, appendedAtMs };
}

test("定数: 既定窓 5 分・上限が妥当な安全弁", () => {
  assert.equal(FIRE_WINDOW_MS, 5 * 60 * 1000);
  assert.equal(FIRE_MAX_CHARS, 4000);
});

test("窓: appendedAtMs >= nowMs - windowMs だけ含める（内外境界）", () => {
  const nowMs = 1_000_000;
  const windowMs = 5000;
  // threshold = 995000。境界ちょうど（995000）は含む・その 1ms 前（994999）は落とす。
  const entries = [
    entry(994_999, "古すぎ"),
    entry(995_000, "境界ちょうど"),
    entry(999_000, "窓内")
  ];
  const out = formatFireInjection(entries, { nowMs, windowMs });
  assert.equal(out.includedCount, 2);
  assert.equal(out.droppedByWindow, 1);
  assert.equal(out.text, "you: 境界ちょうど\nyou: 窓内");
  assert.equal(out.charCount, out.text.length);
  assert.equal(out.droppedByLimit, 0);
});

test("空窓: 窓内が 0 件なら includedCount=0・text=''（ask 無駄撃ち回避の材料）", () => {
  const out = formatFireInjection([entry(0, "大昔")], { nowMs: 10_000_000, windowMs: 1000 });
  assert.equal(out.includedCount, 0);
  assert.equal(out.text, "");
  assert.equal(out.charCount, 0);
  assert.equal(out.droppedByWindow, 1);
});

test("空配列: 何も無ければ空注入（throw しない）", () => {
  const out = formatFireInjection([], { nowMs: 1000 });
  assert.equal(out.includedCount, 0);
  assert.equal(out.text, "");
  assert.equal(out.droppedByWindow, 0);
  assert.equal(out.droppedByLimit, 0);
});

test("話者ラベル: you/soul 混在を seq 昇順で 'you:'/'soul:' 整形（改行区切り）", () => {
  const entries = [
    entry(1000, "今日は寒いね", "you"),
    entry(1001, "そうだね、こたつ入ろう", "soul"),
    entry(1002, "みかんもある", "you")
  ];
  const out = formatFireInjection(entries, { nowMs: 2000, windowMs: FIRE_WINDOW_MS });
  assert.equal(out.text, "you: 今日は寒いね\nsoul: そうだね、こたつ入ろう\nyou: みかんもある");
  assert.equal(out.includedCount, 3);
});

test("viewer: `viewer(名前): 本文` で描く（you/soul/viewer 混在を seq 昇順で整形・S7）", () => {
  const entries = [
    entry(1000, "配信始まったね", "you"),
    entry(1001, "きたよー", "viewer", "ハナコ"),
    entry(1002, "ようこそ", "soul"),
    entry(1003, "楽しみ", "viewer", "Taro")
  ];
  const out = formatFireInjection(entries, { nowMs: 2000, windowMs: FIRE_WINDOW_MS });
  assert.equal(
    out.text,
    "you: 配信始まったね\nviewer(ハナコ): きたよー\nsoul: ようこそ\nviewer(Taro): 楽しみ"
  );
  assert.equal(out.includedCount, 4);
});

test("viewer: displayName 欠落/空白は `viewer: 本文` へ劣化（名前括弧を付けない）", () => {
  const entries = [
    entry(1000, "名無しコメント", "viewer", undefined),
    entry(1001, "空白名", "viewer", "   ")
  ];
  const out = formatFireInjection(entries, { nowMs: 2000, windowMs: FIRE_WINDOW_MS });
  assert.equal(out.text, "viewer: 名無しコメント\nviewer: 空白名");
});

test("文字上限: 超過時は古い方から落とす（新しい方優先）", () => {
  // 各行 "you: XXXX" は "you: " (5) + 本文。本文 5 文字 → 行 10 文字。
  const entries = [
    entry(1000, "AAAAA"), // you: AAAAA (10)
    entry(1001, "BBBBB"), // you: BBBBB (10)
    entry(1002, "CCCCC") //  you: CCCCC (10)
  ];
  // 3 行 join = 10+1+10+1+10 = 32。上限 21 なら最古を 1 行落として 2 行(21)に収める。
  const out = formatFireInjection(entries, { nowMs: 2000, maxChars: 21 });
  assert.equal(out.text, "you: BBBBB\nyou: CCCCC");
  assert.equal(out.includedCount, 2);
  assert.equal(out.droppedByLimit, 1);
  assert.ok(out.charCount <= 21);
});

test("文字上限: 最新 1 行が上限超でも空にはしない（安全弁はベストエフォート・発火を殺さない）", () => {
  const entries = [entry(1000, "あ".repeat(50))];
  const out = formatFireInjection(entries, { nowMs: 2000, maxChars: 10 });
  assert.equal(out.includedCount, 1);
  assert.ok(out.text.startsWith("you: "));
  assert.equal(out.droppedByLimit, 0); // 最新 1 行は落とさない
});

test("不正 nowMs は throw", () => {
  assert.throws(() => formatFireInjection([], /** @type {any} */ ({})), TypeError);
  assert.throws(() => formatFireInjection([], { nowMs: /** @type {any} */ ("x") }), TypeError);
  assert.throws(() => formatFireInjection([], { nowMs: NaN }), TypeError);
});
