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
 */

/**
 * usage ノートの文字列。usage が無ければ tokens は "?"、vision:true なら "usage(vision)"。
 * @param {{ usage?: { input_tokens?: number | null; output_tokens?: number | null } | null; vision?: boolean } | null | undefined} d
 * @returns {string}
 */
export function usageNoteText(d) {
  const usage = d && d.usage ? d.usage : {};
  const it = usage.input_tokens != null ? usage.input_tokens : "?";
  const ot = usage.output_tokens != null ? usage.output_tokens : "?";
  return "usage" + (d && d.vision ? "(vision)" : "") + ": input=" + it + " output=" + ot;
}
