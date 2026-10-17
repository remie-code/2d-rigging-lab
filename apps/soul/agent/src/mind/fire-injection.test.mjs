// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  formatFireInjection,
  formatFireInjectionSince,
  FIRE_NO_NEW_LINES_TEXT,
  FIRE_WINDOW_MS,
  FIRE_MAX_CHARS
} from "./fire-injection.mjs";

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

test("推論の範囲: 残った行の始まりと終わりの seq（窓と文字上限で落とした後・空窓は null）", () => {
  const withSeq = (seq, appendedAtMs, text) => ({ ...entry(appendedAtMs, text), seq });
  const entries = [
    withSeq(3, 10, "窓の外"),
    withSeq(4, 1000, "AAAAA"),
    withSeq(5, 1001, "BBBBB"),
    withSeq(6, 1002, "CCCCC")
  ];
  // 窓で seq 3 を落とし、文字上限（21）で seq 4 を落とす → 範囲は 5〜6。
  const out = formatFireInjection(entries, { nowMs: 2000, windowMs: 1500, maxChars: 21 });
  assert.equal(out.firstSeq, 5);
  assert.equal(out.lastSeq, 6);
  const empty = formatFireInjection(entries, { nowMs: 10_000_000, windowMs: 1 });
  assert.equal(empty.firstSeq, null);
  assert.equal(empty.lastSeq, null);
  // seq を持たない行（防御的）は null。
  const noSeq = formatFireInjection([{ text: "x", appendedAtMs: 1000 }], { nowMs: 2000 });
  assert.equal(noSeq.firstSeq, null);
  assert.equal(noSeq.lastSeq, null);
});

// ── 増えた分だけ渡す（context-growth-2026-10.md §6）──────────────────────────────

/** seq 付きの最小エントリ。 */
function seqEntry(seq, appendedAtMs, text, speaker = "you") {
  return { seq, startMs: 0, endMs: 0, text, speaker, appendedAtMs };
}

test("増えた分だけ: afterSeq より後ろの行だけ（you / soul / viewer）・範囲はその行の seq", () => {
  const nowMs = 100_000;
  const entries = [
    seqEntry(1, 90_000, "前に渡した"),
    seqEntry(2, 91_000, "これも前", "soul"),
    seqEntry(3, 95_000, "新しい"),
    seqEntry(4, 96_000, "聞こえた分", "soul"),
    { ...seqEntry(5, 97_000, "こんにちは", "viewer"), displayName: "A" }
  ];
  const out = formatFireInjectionSince(entries, { nowMs, afterSeq: 2 });
  assert.equal(out.text, "you: 新しい\nsoul: 聞こえた分\nviewer(A): こんにちは");
  assert.equal(out.includedCount, 3);
  assert.equal(out.charCount, out.text.length);
  assert.equal(out.firstSeq, 3);
  assert.equal(out.lastSeq, 5);
  assert.equal(out.droppedBySeq, 2);
});

test("増えた分だけ: 新しい行が無ければ「（前回から新しい発言はなし）」・範囲は null", () => {
  const out = formatFireInjectionSince([seqEntry(1, 90_000, "前に渡した")], { nowMs: 100_000, afterSeq: 1 });
  assert.equal(FIRE_NO_NEW_LINES_TEXT, "（前回から新しい発言はなし）");
  assert.equal(out.text, FIRE_NO_NEW_LINES_TEXT);
  assert.equal(out.includedCount, 0);
  assert.equal(out.charCount, FIRE_NO_NEW_LINES_TEXT.length);
  assert.equal(out.firstSeq, null);
  assert.equal(out.lastSeq, null);
});

test("増えた分だけ: 直近の窓と 4000 字の上限はそのまま効く・afterSeq null は窓の全部", () => {
  const nowMs = 1_000_000;
  const entries = [seqEntry(1, 0, "窓の外"), seqEntry(2, 999_000, "a".repeat(30)), seqEntry(3, 999_500, "b".repeat(30))];
  const windowed = formatFireInjectionSince(entries, { nowMs, windowMs: 5000, afterSeq: null });
  assert.equal(windowed.includedCount, 2, "窓の外（5 分より前）は新しくても入れない");
  assert.equal(windowed.firstSeq, 2);
  const limited = formatFireInjectionSince(entries, { nowMs, windowMs: 5000, maxChars: 40, afterSeq: 1 });
  assert.equal(limited.includedCount, 1, "上限を超えたら古い方から落とす");
  assert.equal(limited.lastSeq, 3);
  assert.equal(limited.droppedByLimit, 1);
});

test("増えた分だけ: seq を持たない行は前回より後か分からないので入れない", () => {
  const out = formatFireInjectionSince([{ text: "seq なし", speaker: "you", appendedAtMs: 99_000 }], { nowMs: 100_000, afterSeq: 0 });
  assert.equal(out.text, FIRE_NO_NEW_LINES_TEXT);
});
