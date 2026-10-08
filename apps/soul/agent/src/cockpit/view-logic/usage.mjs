// @ts-check
/**
 * view-logic: usage 表示の整形（preact 非依存の純関数）。
 *
 * askごとの usage（input/output tokens・vision 区別）の最小表示文字列を導出する。
 * 現 cockpit.html の `applyUsage`（cockpit.html:547-554）と機能同値（fixture で固定）。
 * ツマミは置かない（v0 裁定）: 直近 ask の input/output tokens を控えめに出すだけ。
 *
 * 対応（現 cockpit.html）:
 *  - usageNoteText → :551-553 `"usage" + (d && d.vision ? "(vision)" : "") + ": input=" + it + " output=" + ot`
 *
 * 多頭化 Domain C（brain-swap-wave-plan.md §3）追加抽出: usageNoteText に brain 札を additive で
 * 足す（"usage[claude]: input=... output=..." 形・brain 未指定は従来どおりの文字列＝後方互換）。
 */

/**
 * usage ノートの文字列。usage が無ければ tokens は "?"、vision:true なら "usage(vision)"。
 * d.brain（多頭化 Domain C・additive）があれば `[brain]` を vision 表記の直後に付ける。
 * @param {{ usage?: { input_tokens?: number | null; output_tokens?: number | null } | null; vision?: boolean; brain?: string | null } | null | undefined} d
 * @returns {string}
 */
export function usageNoteText(d) {
  const usage = d && d.usage ? d.usage : {};
  const it = usage.input_tokens != null ? usage.input_tokens : "?";
  const ot = usage.output_tokens != null ? usage.output_tokens : "?";
  const brainTag = d && d.brain ? "[" + d.brain + "]" : "";
  return "usage" + (d && d.vision ? "(vision)" : "") + brainTag + ": input=" + it + " output=" + ot;
}
