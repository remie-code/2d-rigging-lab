// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  COUGH_CHIP_TTL_MS,
  COUGH_CHIP_TITLE_MAX,
  emptyCoughChip,
  coughChipAfterDiscard,
  coughChipEntryText,
  coughChipView
} from "./cough-chip.mjs";

// 咳払いの落とし 段階 2（Domain B）: 上の帯の「咳 ×N」の札の純関数（cough-filter-stage2-plan.md §1「知らせ」・§2 の 9・§4 B）。

const T0 = 1_000_000;

/** reason "cough" の SSE discard の data（Domain A の確定した形）。 */
function cough(/** @type {string} */ text, /** @type {number} */ speech) {
  return { startMs: 1, endMs: 2, reason: "cough", appended: 3, discarded: 4, text, speech };
}

test("cough-chip: 定数は 8 秒と 5 件", () => {
  assert.equal(COUGH_CHIP_TTL_MS, 8000);
  assert.equal(COUGH_CHIP_TITLE_MAX, 5);
});

test("cough-chip: 空の状態では札を出さない", () => {
  assert.equal(coughChipView(emptyCoughChip(), T0), null);
  assert.equal(coughChipView(null, T0), null);
  assert.equal(coughChipView(undefined, T0), null);
});

test("cough-chip: reason cough を受けると「咳 ×1」・title は「「うん」 Speech 0.05」・薄いグレーの札のクラス", () => {
  const s = coughChipAfterDiscard(emptyCoughChip(), cough("うん", 0.05), T0);
  assert.deepEqual(s, { lastAtMs: T0, count: 1, entries: [{ text: "うん", speech: 0.05 }] });
  assert.deepEqual(coughChipView(s, T0), { text: "咳 ×1", title: "「うん」 Speech 0.05", className: "cough-chip" });
});

test("cough-chip: blank・reason の無い discard・形の違う値は札に影響しない（同じ状態を返す）", () => {
  const empty = emptyCoughChip();
  const blank = { startMs: 1, endMs: 2, reason: "blank", appended: 3, discarded: 4 };
  assert.equal(coughChipAfterDiscard(empty, blank, T0), empty);
  assert.equal(coughChipAfterDiscard(empty, { discarded: 4 }, T0), empty);
  assert.equal(coughChipAfterDiscard(empty, null, T0), empty);
  assert.equal(coughChipAfterDiscard(empty, "cough", T0), empty);
  assert.equal(coughChipAfterDiscard(empty, cough("うん", 0.05), Number.NaN), empty, "時刻が数でなければ数えない");
  const live = coughChipAfterDiscard(empty, cough("うん", 0.05), T0);
  assert.equal(coughChipAfterDiscard(live, blank, T0 + 1000), live, "札が出ている間の blank も N を増やさない");
  assert.equal(coughChipView(coughChipAfterDiscard(live, blank, T0 + 7000), T0 + 7000)?.text, "咳 ×1", "blank は 8 秒を数え直さない");
  assert.equal(coughChipView(coughChipAfterDiscard(live, blank, T0 + 7000), T0 + 8000), null);
});

test("cough-chip: 最後の咳からちょうど 8 秒で消える（7999ms は出す・8000ms は消す）", () => {
  const s = coughChipAfterDiscard(emptyCoughChip(), cough("うん", 0.05), T0);
  assert.equal(coughChipView(s, T0 + 7999)?.text, "咳 ×1");
  assert.equal(coughChipView(s, T0 + 8000), null);
  assert.equal(coughChipView(s, T0 + 60_000), null);
  // 1 秒の時計が受け取りより少し前の値でも出す（受け取った直後の描画）。
  assert.equal(coughChipView(s, T0 - 900)?.text, "咳 ×1");
});

test("cough-chip: 消える前に次が来れば N が増え、8 秒をその時刻から数え直す", () => {
  let s = coughChipAfterDiscard(emptyCoughChip(), cough("うん", 0.05), T0);
  s = coughChipAfterDiscard(s, cough("ん", 0.02), T0 + 7999);
  assert.equal(s.count, 2);
  assert.equal(s.lastAtMs, T0 + 7999);
  assert.equal(coughChipView(s, T0 + 8000)?.text, "咳 ×2", "最初の咳から 8 秒を過ぎても消えない");
  assert.equal(coughChipView(s, T0 + 7999 + 7999)?.text, "咳 ×2");
  assert.equal(coughChipView(s, T0 + 7999 + 8000), null, "最後の咳から 8 秒で消える");
});

test("cough-chip: 消えたあとの次の咳は ×1 から（受け取りの時点で期限切れなら数え直す・前の区間は title に残さない）", () => {
  let s = coughChipAfterDiscard(emptyCoughChip(), cough("うん", 0.05), T0);
  s = coughChipAfterDiscard(s, cough("ん", 0.02), T0 + 1000);
  assert.equal(s.count, 2);
  // 描画が一度も挟まらなくても、受け取りの時刻で期限切れを判定する。
  s = coughChipAfterDiscard(s, cough("え", 0.08), T0 + 1000 + 8000);
  assert.deepEqual(s, { lastAtMs: T0 + 9000, count: 1, entries: [{ text: "え", speech: 0.08 }] });
  assert.deepEqual(coughChipView(s, T0 + 9000), { text: "咳 ×1", title: "「え」 Speech 0.08", className: "cough-chip" });
});

test("cough-chip: title は今の札が数えている区間を新しい順に最大 5 件（N は 5 を超えても数える）", () => {
  let s = emptyCoughChip();
  const words = ["一", "二", "三", "四", "五", "六", "七"];
  words.forEach((w, i) => {
    s = coughChipAfterDiscard(s, cough(w, i / 100), T0 + i * 1000);
  });
  assert.equal(s.count, 7);
  assert.equal(s.entries.length, 5, "持つのも 5 件まで");
  const view = coughChipView(s, T0 + 6000);
  assert.equal(view?.text, "咳 ×7");
  assert.equal(
    view?.title,
    ["「七」 Speech 0.06", "「六」 Speech 0.05", "「五」 Speech 0.04", "「四」 Speech 0.03", "「三」 Speech 0.02"].join("\n")
  );
});

test("cough-chip: 確率は小数 2 桁（四捨五入は toFixed）・文字は trim", () => {
  assert.equal(coughChipEntryText({ text: "うん", speech: 0.046 }), "「うん」 Speech 0.05");
  assert.equal(coughChipEntryText({ text: "うん", speech: 0.004 }), "「うん」 Speech 0.00");
  assert.equal(coughChipEntryText({ text: "うん", speech: 0 }), "「うん」 Speech 0.00");
  const s = coughChipAfterDiscard(emptyCoughChip(), cough("  うん ", 0.091), T0);
  assert.equal(coughChipView(s, T0)?.title, "「うん」 Speech 0.09");
});

test("cough-chip: text / speech が欠けた・型違いでも札は数え、title は「?」で埋める", () => {
  const cases = [
    [{ reason: "cough" }, "「?」 Speech ?"],
    [{ reason: "cough", text: 12, speech: "0.05" }, "「?」 Speech ?"],
    [{ reason: "cough", text: "   ", speech: Number.NaN }, "「?」 Speech ?"],
    [{ reason: "cough", text: "うん", speech: Infinity }, "「うん」 Speech ?"],
    [{ reason: "cough", text: null, speech: 0.03 }, "「?」 Speech 0.03"]
  ];
  for (const [d, title] of cases) {
    const s = coughChipAfterDiscard(emptyCoughChip(), d, T0);
    assert.deepEqual(coughChipView(s, T0), { text: "咳 ×1", title, className: "cough-chip" }, JSON.stringify(d));
  }
});

test("cough-chip: 壊れた状態（数でない時刻・0 件）は出さない・受け取りは ×1 から始める", () => {
  const broken = /** @type {any} */ ({ lastAtMs: "x", count: 3, entries: null });
  assert.equal(coughChipView(broken, T0), null);
  assert.equal(coughChipView(/** @type {any} */ ({ lastAtMs: T0, count: 0, entries: [] }), T0), null);
  const s = coughChipAfterDiscard(broken, cough("うん", 0.05), T0);
  assert.deepEqual(s, { lastAtMs: T0, count: 1, entries: [{ text: "うん", speech: 0.05 }] });
  const fromNull = coughChipAfterDiscard(null, cough("うん", 0.05), T0);
  assert.equal(fromNull.count, 1);
});

test("cough-chip: 受け取りは前の状態を書き換えない（純関数）", () => {
  const a = coughChipAfterDiscard(emptyCoughChip(), cough("うん", 0.05), T0);
  const snapshot = JSON.stringify(a);
  const b = coughChipAfterDiscard(a, cough("ん", 0.02), T0 + 1000);
  assert.equal(JSON.stringify(a), snapshot);
  assert.notEqual(a, b);
  assert.equal(b.count, 2);
});
