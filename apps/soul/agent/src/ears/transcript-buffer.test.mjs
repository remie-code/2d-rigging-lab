// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createTranscriptBuffer, isBlankTranscript } from "./transcript-buffer.mjs";

// ── isBlankTranscript（空転写判定の純関数）──────────────────────────────

test("isBlankTranscript: 空文字・空白のみ・改行のみは blank", () => {
  assert.equal(isBlankTranscript(""), true);
  assert.equal(isBlankTranscript("   "), true);
  assert.equal(isBlankTranscript("\n\t "), true);
  assert.equal(isBlankTranscript("こんにちは"), false);
  assert.equal(isBlankTranscript(" 。"), false); // 記号 1 文字でも内容ありとみなす（S3 の領分を侵さない）
});

test("isBlankTranscript: 非文字列は throw", () => {
  assert.throws(() => isBlankTranscript(/** @type {any} */ (null)), TypeError);
  assert.throws(() => isBlankTranscript(/** @type {any} */ (42)), TypeError);
});

// ── append と読み取り ───────────────────────────────────────────────

test("append: 積んだ順に seq が振られ、all() が append 順で返す", () => {
  let clock = 1000;
  const buffer = createTranscriptBuffer({ nowImpl: () => (clock += 1) });
  const r1 = buffer.append({ startMs: 100, endMs: 900, text: "こんにちは" });
  const r2 = buffer.append({ startMs: 1200, endMs: 2500, text: "テストです" });

  assert.equal(r1.appended, true);
  assert.equal(r1.reason, "appended");
  assert.equal(r1.entry?.seq, 0);
  assert.equal(r2.entry?.seq, 1);
  assert.equal(r1.entry?.appendedAtMs, 1001);
  assert.equal(r2.entry?.appendedAtMs, 1002);

  const all = buffer.all();
  assert.equal(all.length, 2);
  assert.deepEqual(
    all.map((e) => ({ startMs: e.startMs, endMs: e.endMs, text: e.text })),
    [
      { startMs: 100, endMs: 900, text: "こんにちは" },
      { startMs: 1200, endMs: 2500, text: "テストです" }
    ]
  );
  assert.equal(buffer.size(), 2);
});

test("append-only: エントリは frozen・all() は防御的コピー・削除 API は存在しない", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  buffer.append({ startMs: 0, endMs: 500, text: "正本" });

  const all = buffer.all();
  // エントリ書き換えは無効（frozen）。
  assert.ok(Object.isFrozen(all[0]));
  assert.throws(() => {
    "use strict";
    /** @type {any} */ (all[0]).text = "改ざん";
  }, TypeError);
  // 返り配列をいじっても正本に影響しない（防御的コピー）。
  all.pop();
  assert.equal(buffer.size(), 1);
  assert.equal(buffer.all()[0].text, "正本");
  // 削除・clear の API を公開していない。
  assert.equal(/** @type {any} */ (buffer).clear, undefined);
  assert.equal(/** @type {any} */ (buffer).remove, undefined);
});

test("append: 空文字・空白のみの転写は積まずに捨てる（stats で観測可能）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  const r1 = buffer.append({ startMs: 0, endMs: 300, text: "" });
  const r2 = buffer.append({ startMs: 400, endMs: 700, text: " \n" });
  const r3 = buffer.append({ startMs: 800, endMs: 1600, text: "本物の発話" });

  assert.deepEqual(
    [r1, r2].map((r) => ({ appended: r.appended, entry: r.entry, reason: r.reason })),
    [
      { appended: false, entry: null, reason: "blank" },
      { appended: false, entry: null, reason: "blank" }
    ]
  );
  assert.equal(r3.appended, true);
  assert.equal(r3.entry?.seq, 0); // 捨てた分は seq を消費しない
  assert.deepEqual(buffer.stats(), { appended: 1, discarded: 2 });
  assert.equal(buffer.size(), 1);
});

test("last(n): 直近 n 件を append 順で返す・0 は空・過大 n は全件", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  for (let i = 0; i < 5; i += 1) {
    buffer.append({ startMs: i * 1000, endMs: i * 1000 + 500, text: `発話${i}` });
  }
  assert.deepEqual(buffer.last(2).map((e) => e.text), ["発話3", "発話4"]);
  assert.deepEqual(buffer.last(0), []);
  assert.equal(buffer.last(99).length, 5);
  assert.throws(() => buffer.last(-1), RangeError);
  assert.throws(() => buffer.last(1.5), RangeError);
});

test("inRange: 範囲に重なるエントリを返す（境界含む・省略側は無限）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  buffer.append({ startMs: 0, endMs: 1000, text: "a" });
  buffer.append({ startMs: 2000, endMs: 3000, text: "b" });
  buffer.append({ startMs: 4000, endMs: 5000, text: "c" });

  // 重なり判定: endMs >= fromMs かつ startMs <= toMs。
  assert.deepEqual(buffer.inRange({ fromMs: 900, toMs: 2100 }).map((e) => e.text), ["a", "b"]);
  // 境界ちょうど（endMs == fromMs）も含む。
  assert.deepEqual(buffer.inRange({ fromMs: 1000, toMs: 1500 }).map((e) => e.text), ["a"]);
  // 片側省略。
  assert.deepEqual(buffer.inRange({ fromMs: 3500 }).map((e) => e.text), ["c"]);
  assert.deepEqual(buffer.inRange({ toMs: 1500 }).map((e) => e.text), ["a"]);
  assert.equal(buffer.inRange({}).length, 3);
  // 不正範囲は throw。
  assert.throws(() => buffer.inRange({ fromMs: 100, toMs: 0 }), RangeError);
  assert.throws(() => buffer.inRange({ fromMs: NaN }), TypeError);
});

// ── 購読 ───────────────────────────────────────────────────────────

test("onAppend: 追加のたびに entry が届き、解除後は届かない（S3 発火判定の入口）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  /** @type {string[]} */
  const seen = [];
  const unsubscribe = buffer.onAppend((entry) => seen.push(entry.text));

  buffer.append({ startMs: 0, endMs: 500, text: "一" });
  buffer.append({ startMs: 600, endMs: 999, text: "" }); // blank は onAppend に来ない
  buffer.append({ startMs: 1000, endMs: 1500, text: "二" });
  unsubscribe();
  buffer.append({ startMs: 2000, endMs: 2500, text: "三" });

  assert.deepEqual(seen, ["一", "二"]);
  assert.equal(buffer.size(), 3);
});

test("onDiscard: 空転写の破棄が診断イベントとして観測できる", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  /** @type {any[]} */
  const discardsSeen = [];
  const unsubscribe = buffer.onDiscard((info) => discardsSeen.push(info));

  buffer.append({ startMs: 100, endMs: 400, text: "  " });
  buffer.append({ startMs: 500, endMs: 900, text: "実発話" });

  assert.equal(discardsSeen.length, 1);
  assert.deepEqual(discardsSeen[0], { startMs: 100, endMs: 400, text: "  ", reason: "blank" });
  assert.ok(Object.isFrozen(discardsSeen[0]));
  unsubscribe();
  buffer.append({ startMs: 1000, endMs: 1200, text: "" });
  assert.equal(discardsSeen.length, 1);
  assert.deepEqual(buffer.stats(), { appended: 1, discarded: 2 });
});

// ── 検証（不正入力）─────────────────────────────────────────────────

test("append: 不正入力は throw（非有限時刻・endMs<startMs・非文字列 text）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  assert.throws(() => buffer.append(/** @type {any} */ (null)), TypeError);
  assert.throws(() => buffer.append({ startMs: NaN, endMs: 100, text: "x" }), TypeError);
  assert.throws(() => buffer.append({ startMs: 0, endMs: Infinity, text: "x" }), TypeError);
  assert.throws(() => buffer.append({ startMs: 500, endMs: 100, text: "x" }), RangeError);
  assert.throws(() => buffer.append({ startMs: 0, endMs: 100, text: /** @type {any} */ (42) }), TypeError);
  assert.equal(buffer.size(), 0); // 失敗 append は何も残さない
});

test("onAppend/onDiscard: 非関数 listener は throw", () => {
  const buffer = createTranscriptBuffer();
  assert.throws(() => buffer.onAppend(/** @type {any} */ (null)), TypeError);
  assert.throws(() => buffer.onDiscard(/** @type {any} */ ("x")), TypeError);
});

// ── 話者ラベル（S3 会話ログ昇格・追加的）─────────────────────────────────

test("speaker: 未指定は既定 'you'（S2 挙動不変）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  const r = buffer.append({ startMs: 0, endMs: 500, text: "独り言" });
  assert.equal(r.entry?.speaker, "you");
  assert.equal(buffer.all()[0].speaker, "you");
});

test("speaker: 'soul' を指定すると soul エントリになる（startMs/endMs=0 の魂発話）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  const you = buffer.append({ startMs: 100, endMs: 900, text: "ねえ" });
  const soul = buffer.append({ startMs: 0, endMs: 0, text: "はーい", speaker: "soul" });
  assert.equal(you.entry?.speaker, "you");
  assert.equal(soul.entry?.speaker, "soul");
  assert.deepEqual(buffer.all().map((e) => [e.speaker, e.text]), [
    ["you", "ねえ"],
    ["soul", "はーい"]
  ]);
  // soul エントリも frozen（正本の不変性を維持）。
  assert.ok(Object.isFrozen(soul.entry));
});

test("speaker: 不正値は throw（you/soul/viewer 以外を黙殺しない）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  assert.throws(
    () => buffer.append({ startMs: 0, endMs: 0, text: "x", speaker: /** @type {any} */ ("bot") }),
    RangeError
  );
  assert.throws(
    () => buffer.append({ startMs: 0, endMs: 0, text: "x", speaker: /** @type {any} */ (1) }),
    RangeError
  );
  assert.equal(buffer.size(), 0); // 失敗 append は何も残さない
});

// ── viewer コメント合流（S7「視聴者が混ざる」・追加的）─────────────────────────

test("speaker: 'viewer' + displayName で視聴者コメントが合流する（soul 同型 startMs/endMs=0）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 5000 });
  const you = buffer.append({ startMs: 100, endMs: 900, text: "ねえ" });
  const viewer = buffer.append({ startMs: 0, endMs: 0, text: "こんばんは", speaker: "viewer", displayName: "ハナコ" });
  assert.equal(you.entry?.speaker, "you");
  assert.equal(you.entry?.displayName, undefined); // you は displayName を持たない（従来と同形）。
  assert.equal(viewer.entry?.speaker, "viewer");
  assert.equal(viewer.entry?.displayName, "ハナコ");
  assert.equal(viewer.entry?.startMs, 0);
  assert.equal(viewer.entry?.endMs, 0);
  assert.ok(Object.isFrozen(viewer.entry)); // viewer エントリも frozen（正本の不変性）。
  assert.deepEqual(buffer.all().map((e) => [e.speaker, e.text, e.displayName]), [
    ["you", "ねえ", undefined],
    ["viewer", "こんばんは", "ハナコ"]
  ]);
});

test("displayName: viewer 以外でも省略時は undefined（従来と同形・S1〜S6 挙動不変）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  const you = buffer.append({ startMs: 0, endMs: 500, text: "独り言" });
  const soul = buffer.append({ startMs: 0, endMs: 0, text: "はーい", speaker: "soul" });
  assert.equal(you.entry?.displayName, undefined);
  assert.equal(soul.entry?.displayName, undefined);
});

test("displayName: 非文字列は throw（軽い型検証・呼び出し側のバグを黙殺しない）", () => {
  const buffer = createTranscriptBuffer({ nowImpl: () => 0 });
  assert.throws(
    () => buffer.append({ startMs: 0, endMs: 0, text: "x", speaker: "viewer", displayName: /** @type {any} */ (42) }),
    TypeError
  );
  assert.equal(buffer.size(), 0); // 失敗 append は何も残さない
});
