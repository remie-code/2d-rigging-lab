// @ts-check
/**
 * view-logic: タイムラインのマーカー行の表示文字列導出（preact 非依存の純関数）。
 *
 * 現 cockpit.html の各 `add*Row` から、DOM 構築を剥がして「.text に入る文字列」の導出だけを取り出す。
 * 機能同値（fixture で固定）。null フォールバック（`?` / `unknown`）の意味論を厳密に踏襲する。
 *
 * 対応（現 cockpit.html）:
 *  - fireMarkerText     → :456-457 `addFireMarkerRow` の text（"fired (N lines, M chars injected)"）
 *  - expressionRowText  → :474-478 `addExpressionRow` の text（"word args ✓A/✗R"）
 *  - visionMarkerText   → :495-496 `addVisionMarkerRow` の text（'saw "title" (WxH, Nms)'）
 *  - bargeInMarkerText  → :520-521 `addBargeInMarkerRow` の text（"interrupted (X/Y chars spoken, Nms)"）
 *  - selfFireMarkerText → :539     `addSelfFireMarkerRow` の text（"self-fire (kind)"）
 */

/**
 * 発火マーカー行の文字列（Fire 受理・SSE fire accepted:true）。
 * @param {{ includedCount?: number | null; injectedChars?: number | null }} d
 * @returns {string}
 */
export function fireMarkerText(d) {
  const lines = d && d.includedCount != null ? d.includedCount : "?";
  const chars = d && d.injectedChars != null ? d.injectedChars : "?";
  return "fired (" + lines + " lines, " + chars + " chars injected)";
}

/**
 * 演出イベント行の文字列（S4「表情が乗る」・SSE expression {word,args?,applied,rejected}）。
 * @param {{ word?: string | null; args?: string | null; applied?: number | null; rejected?: number | null }} d
 * @returns {string}
 */
export function expressionRowText(d) {
  const word = d && d.word != null ? d.word : "?";
  const args = d && d.args ? " " + d.args : "";
  const applied = d && d.applied != null ? d.applied : 0;
  const rejected = d && d.rejected != null ? d.rejected : 0;
  return word + args + " ✓" + applied + "/✗" + rejected;
}

/**
 * 「見た」マーカー行の文字列（S5「目が開く」・SSE visionCaptured {title,width,height,elapsedMs}）。
 * サムネ（jpegBase64）は行の <img> 側の責務でここには含めない（文字列導出のみ）。
 * @param {{ title?: string | null; width?: number | string; height?: number | string; elapsedMs?: number | null }} d
 * @returns {string}
 */
export function visionMarkerText(d) {
  const title = (d && d.title) || "?";
  const elapsed = d && d.elapsedMs != null ? d.elapsedMs : "?";
  return "saw \"" + title + "\" (" + (d && d.width) + "x" + (d && d.height) + ", " + elapsed + "ms)";
}

/**
 * barge-in 中断マーカー行の文字列（S6「会話が続く」・diagnostic type=="bargeIn"）。
 * @param {{ charsSpoken?: number | null; totalChars?: number | null; elapsedMs?: number | null }} d
 * @returns {string}
 */
export function bargeInMarkerText(d) {
  const spoken = d && d.charsSpoken != null ? d.charsSpoken : "?";
  const total = d && d.totalChars != null ? d.totalChars : "?";
  const elapsed = d && d.elapsedMs != null ? d.elapsedMs : "?";
  return "interrupted (" + spoken + "/" + total + " chars spoken, " + elapsed + "ms)";
}

/**
 * 自発発火マーカー行の文字列（S6/S7・SSE selfFire fired:true・kind 非依存）。
 * @param {{ kind?: string | null }} d
 * @returns {string}
 */
export function selfFireMarkerText(d) {
  return "self-fire (" + ((d && d.kind) || "?") + ")";
}
