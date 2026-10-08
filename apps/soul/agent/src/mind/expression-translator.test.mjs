// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { translateExpression } from "./expression-translator.mjs";
import { EXPRESSION_TABLE, EXPRESSION_WORDS } from "./expression-table.mjs";

// 翻訳層の純関数 fixture テスト（S4 Domain A）。強さ係数の適用点はこの層（表の外）。

test("translate: 既知語は表の束を payload 列へ写す（係数 1.0 は基準値そのまま）", () => {
  const { payloads, diagnostics } = translateExpression("smile");
  assert.deepEqual(diagnostics, []);
  assert.equal(payloads.length, EXPRESSION_TABLE.smile.length);
  for (let i = 0; i < payloads.length; i += 1) {
    const p = payloads[i];
    const e = EXPRESSION_TABLE.smile[i];
    assert.equal(p.slotId, e.slotId);
    assert.equal(p.peak, e.peak); // 係数 1.0 → スケールなし。
    assert.equal(p.attackMs, e.attackMs);
    assert.equal(p.sustainMs, e.sustainMs);
    assert.equal(p.decayMs, e.decayMs);
  }
});

test("translate: 全 6 語が payload を返し、payload 形が器契約 { slotId, peak, attackMs, sustainMs, decayMs }", () => {
  for (const word of EXPRESSION_WORDS) {
    const { payloads } = translateExpression(word);
    assert.ok(payloads.length >= 1, `${word}: payload あり`);
    for (const p of payloads) {
      assert.deepEqual(
        Object.keys(p).sort(),
        ["attackMs", "decayMs", "peak", "slotId", "sustainMs"]
      );
      assert.equal(typeof p.slotId, "string");
      assert.equal(typeof p.peak, "number");
      assert.ok(p.attackMs + p.sustainMs + p.decayMs > 0);
    }
  }
});

test("translate: 存在しない語は空 payloads + unknownWord 診断（声にも演出にも出さない）", () => {
  const { payloads, diagnostics } = translateExpression("teleport");
  assert.deepEqual(payloads, []);
  assert.deepEqual(diagnostics, [{ type: "unknownWord", word: "teleport" }]);
});

test("translate: 強さ係数は全 peak を一括スケール（attack/sustain/decay は不変）", () => {
  const { payloads } = translateExpression("troubled", undefined, 0.5);
  for (let i = 0; i < payloads.length; i += 1) {
    const p = payloads[i];
    const e = EXPRESSION_TABLE.troubled[i];
    assert.ok(Math.abs(p.peak - e.peak * 0.5) < 1e-9, `${p.slotId}: peak がスケールされる`);
    // 時間相は不変。
    assert.equal(p.attackMs, e.attackMs);
    assert.equal(p.sustainMs, e.sustainMs);
    assert.equal(p.decayMs, e.decayMs);
  }
});

test("translate: 係数 0 は peak 0（演出なし）", () => {
  const { payloads } = translateExpression("smile", undefined, 0);
  for (const p of payloads) {
    assert.equal(p.peak, 0);
  }
});

test("translate: 係数 > 1 で域を超える peak は境界へクランプ（器は域外を拒否＝魂側で収める）", () => {
  // smile.mouth-smile=0.8 → ×2 = 1.6 → クランプ 1.0（重み域）。
  // look-away.gaze-horizontal=-0.6 → ×2 = -1.2 → クランプ -1.0（中央域）。
  const smile = translateExpression("smile", undefined, 2.0);
  const mouth = smile.payloads.find((p) => p.slotId === "mouth-smile");
  assert.ok(mouth);
  assert.equal(mouth.peak, 1.0);

  const away = translateExpression("look-away", undefined, 2.0);
  const gaze = away.payloads.find((p) => p.slotId === "gaze-horizontal");
  assert.ok(gaze);
  assert.equal(gaze.peak, -1.0);
});

test("translate: クランプ後も全 peak が域内（中央 -1..1 / 重み 0..1）", () => {
  const CENTERED = new Set([
    "head-horizontal",
    "head-vertical",
    "head-tilt",
    "gaze-horizontal",
    "gaze-vertical",
    "body-x",
    "body-z"
  ]);
  for (const word of EXPRESSION_WORDS) {
    // 極端な係数でも域内。
    for (const k of [0, 0.3, 1, 3, 100]) {
      for (const p of translateExpression(word, undefined, k).payloads) {
        const min = CENTERED.has(p.slotId) ? -1 : 0;
        assert.ok(p.peak >= min && p.peak <= 1, `${word}/${p.slotId} k=${k}: peak=${p.peak} 域外`);
      }
    }
  }
});

test("translate: 非有限/負の係数は 1.0 に丸める（基準値そのまま）", () => {
  for (const bad of [NaN, Infinity, -Infinity, -0.5, "1.0", null]) {
    const { payloads } = translateExpression("nod", undefined, /** @type {any} */ (bad));
    assert.equal(payloads[0].peak, EXPRESSION_TABLE.nod[0].peak, `係数 ${String(bad)} → 1.0 扱い`);
  }
});

test("translate: args を受け取る口はあるが 6 語では payload に影響しない（S5 の口）", () => {
  const withArgs = translateExpression("smile", "reason=shy");
  const without = translateExpression("smile");
  assert.deepEqual(withArgs.payloads, without.payloads);
});
