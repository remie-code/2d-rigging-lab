// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { EXPRESSION_TABLE, EXPRESSION_WORDS } from "./expression-table.mjs";

// 演出表の宣言健全性テスト（S4 Domain A）。数値の在り処はここだけなので、契約と裁定への
// 適合（slotId が契約 16 語彙内・sustain 2〜4 秒帯・peak 域内・ADS 合計 > 0・各語が束を持つ）を固定する。

/** 器契約 channel-intent-envelope-payload-schema.json の slotId enum（16 個・ミラー）。 */
const CONTRACT_SLOTS = new Set([
  "head-horizontal",
  "head-vertical",
  "head-tilt",
  "eye-blink-left",
  "eye-blink-right",
  "gaze-horizontal",
  "gaze-vertical",
  "mouth-open",
  "mouth-smile",
  "mouth-vowel-a",
  "mouth-vowel-i",
  "mouth-vowel-u",
  "mouth-vowel-e",
  "mouth-vowel-o",
  "body-x",
  "body-z"
]);

/** 中央スロット（peak -1..1）。それ以外は重み [0..1]。 */
const CENTERED = new Set([
  "head-horizontal",
  "head-vertical",
  "head-tilt",
  "gaze-horizontal",
  "gaze-vertical",
  "body-x",
  "body-z"
]);

test("演出表: 語彙は 6 語ちょうど（smile/troubled/surprised/nod/look-away/look-camera）", () => {
  assert.deepEqual(
    [...EXPRESSION_WORDS].sort(),
    ["look-away", "look-camera", "nod", "smile", "surprised", "troubled"]
  );
});

test("演出表: 全語が 1 つ以上のスロット束を持つ", () => {
  for (const word of EXPRESSION_WORDS) {
    const bundle = EXPRESSION_TABLE[word];
    assert.ok(Array.isArray(bundle) && bundle.length >= 1, `${word}: 束が空でない`);
  }
});

test("演出表: 全束エントリの slotId が契約 16 語彙内", () => {
  for (const word of EXPRESSION_WORDS) {
    for (const e of EXPRESSION_TABLE[word]) {
      assert.ok(CONTRACT_SLOTS.has(e.slotId), `${word} の slotId ${e.slotId} が契約外`);
    }
  }
});

test("演出表: sustainMs は 2〜4 秒帯（2000〜4000ms・裁定 4）", () => {
  for (const word of EXPRESSION_WORDS) {
    for (const e of EXPRESSION_TABLE[word]) {
      assert.ok(
        e.sustainMs >= 2000 && e.sustainMs <= 4000,
        `${word}/${e.slotId}: sustainMs=${e.sustainMs} が 2000〜4000 帯外`
      );
    }
  }
});

test("演出表: peak はスロット種別の域内（中央 -1..1 / 重み 0..1）", () => {
  for (const word of EXPRESSION_WORDS) {
    for (const e of EXPRESSION_TABLE[word]) {
      const min = CENTERED.has(e.slotId) ? -1 : 0;
      const max = 1;
      assert.ok(
        e.peak >= min && e.peak <= max,
        `${word}/${e.slotId}: peak=${e.peak} が [${min}, ${max}] 外`
      );
    }
  }
});

test("演出表: ADS 各相は非負・合計 > 0（zero-life envelope 禁止・器契約）", () => {
  for (const word of EXPRESSION_WORDS) {
    for (const e of EXPRESSION_TABLE[word]) {
      assert.ok(e.attackMs >= 0, `${word}/${e.slotId}: attackMs<0`);
      assert.ok(e.sustainMs >= 0, `${word}/${e.slotId}: sustainMs<0`);
      assert.ok(e.decayMs >= 0, `${word}/${e.slotId}: decayMs<0`);
      assert.ok(
        e.attackMs + e.sustainMs + e.decayMs > 0,
        `${word}/${e.slotId}: ADS 合計が 0`
      );
    }
  }
});

test("演出表: 1 語内で slotId は重複しない（同一 slot 二重宣言は事故）", () => {
  for (const word of EXPRESSION_WORDS) {
    const ids = EXPRESSION_TABLE[word].map((e) => e.slotId);
    assert.equal(new Set(ids).size, ids.length, `${word}: slotId 重複`);
  }
});
