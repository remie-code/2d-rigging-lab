// @ts-check
/**
 * 演出翻訳層（S4 Domain A・純関数）— apps/soul/agent。
 *
 * 演出語（+ 任意引数 + 強さ係数）を器の intent.envelope payload 列へ写像する純関数。
 * 数値の在り処は演出表（expression-table.mjs）**のみ**——ここには数値を書かない。この層の唯一の
 * 数値仕事は「強さ係数の適用（全 peak 一括スケール）」と「域外クランプ」だが、クランプ境界
 * （-1..1 / 0..1）は**器契約 normalizedRanges の構造事実**であって演出チューニング値ではない。
 *
 * ── API（S5 拡張性を今から満たす形）─────────────────────────────────────────────
 *   translateExpression(word, args?, intensity = 1.0) → {
 *     payloads    : Array<{ slotId, peak, attackMs, sustainMs, decayMs }>（1 語 → 複数スロットなら複数）。
 *     diagnostics : Array<{ type, ... }>（存在しない語 → 空 payloads + { type:"unknownWord", word }）。
 *   }
 *   - args : v0 の 6 語は不要（受け取る口だけ開ける）。S5 の look-at(x,y) は表へ行追加 + ここで
 *            args 解釈を足すことで拡張できる（署名は不変）。
 *   - intensity : 演出強さ係数（既定 1.0・**表の外のこの層で適用**）。全 peak を一括スケール。
 *                 非有限 / 負値は 1.0 に丸める（intensity ≥ 0 を期待。0 = 演出なし＝peak 0）。
 *
 * ── クランプ規則 ────────────────────────────────────────────────────────────
 *  peakScaled = peak * intensity を、スロット種別の域へクランプ（器が「域外は clamp せず拒否」する
 *  ため、魂側で必ず域内に収めてから送る）。中央スロット（head/gaze/body）は [-1, 1]、重みスロット
 *  （eye-blink-* / mouth-smile）は [0, 1]。係数 > 1 で基準値が域を超えたら境界へ張り付く。
 */

import { EXPRESSION_TABLE } from "./expression-table.mjs";

/** 中央スロット（peak -1..1）。それ以外の演出スロットは重み [0..1]。契約 normalizedRanges 由来の構造事実。 */
const CENTERED_SLOTS = new Set([
  "head-horizontal",
  "head-vertical",
  "head-tilt",
  "gaze-horizontal",
  "gaze-vertical",
  "body-x",
  "body-z"
]);

/**
 * スロット種別の正規化域を返す（契約 normalizedRanges・演出値ではない）。
 * @param {string} slotId
 * @returns {{ min: number; max: number }}
 */
function slotRange(slotId) {
  return CENTERED_SLOTS.has(slotId) ? { min: -1, max: 1 } : { min: 0, max: 1 };
}

/**
 * 演出語を intent.envelope payload 列へ翻訳する（純関数）。
 * @param {string} word  演出語（既知 6 語のいずれか。未知は空 + 診断）。
 * @param {string} [args]  任意引数（v0 6 語は未使用・S5 の口）。
 * @param {number} [intensity=1.0]  強さ係数（全 peak 一括スケール・既定 1.0）。
 * @returns {{
 *   payloads: Array<{ slotId: string; peak: number; attackMs: number; sustainMs: number; decayMs: number }>;
 *   diagnostics: Array<{ type: string; [k: string]: unknown }>;
 * }}
 */
export function translateExpression(word, args, intensity = 1.0) {
  const bundle = Object.prototype.hasOwnProperty.call(EXPRESSION_TABLE, word)
    ? EXPRESSION_TABLE[word]
    : undefined;

  if (!bundle) {
    // 存在しない語（パーサは既知語しかイベント化しないので通常は来ない・防御）。
    return { payloads: [], diagnostics: [{ type: "unknownWord", word }] };
  }

  const k = typeof intensity === "number" && Number.isFinite(intensity) && intensity >= 0 ? intensity : 1.0;

  const payloads = bundle.map((entry) => {
    const { min, max } = slotRange(entry.slotId);
    const scaled = entry.peak * k;
    const peak = clamp(scaled, min, max);
    return {
      slotId: entry.slotId,
      peak,
      attackMs: entry.attackMs,
      sustainMs: entry.sustainMs,
      decayMs: entry.decayMs
    };
  });

  return { payloads, diagnostics: [] };
}

/**
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
