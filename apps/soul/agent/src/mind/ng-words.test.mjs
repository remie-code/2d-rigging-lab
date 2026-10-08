// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { NG_WORDS, containsNgWord, NG_BLOCKED_NOTE } from "./ng-words.mjs";

// NG 最終検査表の宣言健全性テスト（S8 Domain C）。
//
// 注意: このテストファイルは NG_WORDS の照合を直接検証するため、実際の NG 実語（差別語級）を
// 直書きする。これは health/照合の検証に不可欠であり、NG_WORDS 自体の定義（ng-words.mjs）と
// 同じ理由（プレースホルダやダミー語では機能を検証できない）による。

test("NG 語彙: 凍結されている（Object.freeze）", () => {
  assert.ok(Object.isFrozen(NG_WORDS), "NG_WORDS は凍結必須");
});

test("NG 語彙: 全要素が非空文字列", () => {
  for (const w of NG_WORDS) {
    assert.equal(typeof w, "string", `${String(w)} は文字列であること`);
    assert.ok(w.length > 0, "空文字列は不可");
  }
});

test("NG 語彙: 語数は想定範囲（3〜5 語・過剰に広げない）", () => {
  assert.ok(NG_WORDS.length >= 3 && NG_WORDS.length <= 5, `語数=${NG_WORDS.length} が 3〜5 帯外`);
});

test("NG 語彙: 重複なし", () => {
  assert.equal(new Set(NG_WORDS).size, NG_WORDS.length, "NG_WORDS 内に重複がある");
});

test("containsNgWord: NG 語を含む文で true（命中）", () => {
  assert.equal(containsNgWord(`これは${NG_WORDS[0]}という言葉です`), true);
});

test("containsNgWord: NG 語を含まない普通の文で false（非命中・無退行の要）", () => {
  assert.equal(containsNgWord("今日はいい天気ですね、散歩に行きましょう"), false);
});

test("containsNgWord: 全角/半角カタカナの揺れを NFKC 正規化で吸収する", () => {
  // NG_WORDS の "ガイジ"（全角カタカナ）を、半角カタカナ + 半角濁点の等価表現で埋め込む。
  // 半角ｶ(U+FF76) + 半角濁点(U+FF9E) + 半角ｲ(U+FF72) + 半角ｼ(U+FF7C) + 半角濁点(U+FF9E)
  // は NFKC 正規化で "ガイジ" に等しくなる（Node.js String.prototype.normalize で確認済み）。
  const halfWidth = String.fromCharCode(0xff76, 0xff9e, 0xff72, 0xff7c, 0xff9e);
  assert.equal(halfWidth.normalize("NFKC"), "ガイジ", "前提: 半角カタカナ+濁点が NFKC でガイジへ正規化される");
  assert.equal(containsNgWord(`あの${halfWidth}って言うな`), true, "半角カタカナ表記でも命中すること");
});

test("containsNgWord: 空文字列は false", () => {
  assert.equal(containsNgWord(""), false);
});

test("containsNgWord: 非文字列（null/undefined/数値/オブジェクト）は false（防御的）", () => {
  assert.equal(containsNgWord(null), false);
  assert.equal(containsNgWord(undefined), false);
  assert.equal(containsNgWord(123), false);
  assert.equal(containsNgWord({}), false);
  assert.equal(containsNgWord(["a"]), false);
});

test("NG_BLOCKED_NOTE: 非空文字列であり NG_WORDS のいずれの語も含まない（本文を持たない事実文字列）", () => {
  assert.equal(typeof NG_BLOCKED_NOTE, "string");
  assert.ok(NG_BLOCKED_NOTE.length > 0);
  assert.equal(containsNgWord(NG_BLOCKED_NOTE), false, "NG_BLOCKED_NOTE 自体が NG 語を含んではならない");
});
