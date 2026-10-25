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
 *  - speakNowJudgmentText → speak-now の判定行（SSE selfFire kind:"speak-now-judgment"・"判定: 自発 0.45"・
 *                           speak-now 合意 §5。待つはサーバが流さない）
 *  - commentJudgmentText  → コメント反応の判定行（SSE selfFire kind:"comment-judgment"・"コメント判定: 反応 0.92"・
 *                           コメント反応の合意 §3。反応しないはサーバが流さない）
 *  - recallStepText       → 思い出しの係の行（SSE selfFire kind:"recall-step"・「思い出し中: 「頼みごと」」・
 *                           記憶の作り直し Wave 3。記憶の中身はサーバが流さない）
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

/** speak-now の選択の表示名（src/mind/speak-now.mjs の SPEAK_NOW_CHOICE_LABELS と同じ。UI は mind を import しない）。 */
export const SPEAK_NOW_CHOICE_LABELS = Object.freeze({
  wait: "待つ",
  backchannel: "相槌",
  respond: "応答",
  initiate: "自発",
  look: "画面を見る"
});

/**
 * speak-now の判定行の文字列（"判定: 自発 0.45"・speak-now 合意 §5）。未知の選択は値をそのまま、
 * 確率が無ければ "?"。
 * @param {{ choice?: string | null; probability?: number | null }} d
 * @returns {string}
 */
export function speakNowJudgmentText(d) {
  const choice = (d && d.choice) || "?";
  const label = /** @type {Record<string, string>} */ (SPEAK_NOW_CHOICE_LABELS)[choice] ?? choice;
  const p = d && typeof d.probability === "number" && Number.isFinite(d.probability) ? d.probability.toFixed(2) : "?";
  return "判定: " + label + " " + p;
}

/** コメント反応の選択の表示名（src/mind/comment-react.mjs の COMMENT_REACT_CHOICE_LABELS と同じ。UI は mind を import しない）。 */
export const COMMENT_REACT_CHOICE_LABELS = Object.freeze({ react: "反応", ignore: "反応しない" });

/**
 * コメント反応の判定行の文字列（"コメント判定: 反応 0.92"・コメント反応の合意 §3。反応しないはサーバが流さない）。
 * @param {{ choice?: string | null; probability?: number | null }} d
 * @returns {string}
 */
export function commentJudgmentText(d) {
  const choice = (d && d.choice) || "?";
  const label = /** @type {Record<string, string>} */ (COMMENT_REACT_CHOICE_LABELS)[choice] ?? choice;
  const p = d && typeof d.probability === "number" && Number.isFinite(d.probability) ? d.probability.toFixed(2) : "?";
  return "コメント判定: " + label + " " + p;
}

/**
 * 思い出しの係の出来事の表示名（src/mind/recall-desk.mjs の phase。UI は mind を import しない）。
 */
export const RECALL_STEP_LABELS = Object.freeze({
  started: "思い出し中",
  queued: "思い出し待ち",
  dropped: "思い出しを見送った（重なり）",
  found: "思い出した",
  "not-found": "見つからなかった",
  avoided: "避けた",
  deferred: "言えなかったので次の返事に渡した",
  failed: "思い出せなかった（失敗）"
});

/**
 * 思い出しの係の行の文字列（「思い出し中: 「エルデンリング 前回どこまで」」・記憶の作り直し Wave 3）。
 * 判定の失敗で言う側に倒したときは末尾に「（判定エラー）」。未知の phase は値をそのまま。
 * Wave 3 仕上げ: 自発 OFF で黙って渡したとき（silent）は「思い出した（黙って渡した）」、④の失敗を「見つからなかった」と
 * 同じ扱いで届けたとき（failed・phase not-found）は「見つからなかった（失敗）」のように表示名の直後に括弧で添える。
 * @param {{ phase?: string | null; request?: string | null; judgeFailed?: boolean | null; silent?: boolean | null; failed?: boolean | null }} d
 * @returns {string}
 */
export function recallStepText(d) {
  const phase = (d && d.phase) || "?";
  const label = /** @type {Record<string, string>} */ (RECALL_STEP_LABELS)[phase] ?? phase;
  const request = d && typeof d.request === "string" && d.request.length > 0 ? "「" + d.request + "」" : "";
  /** @type {string[]} */
  const notes = [];
  if (d && d.failed === true && phase === "not-found") notes.push("失敗");
  if (d && d.silent === true) notes.push("黙って渡した");
  return (
    label +
    (notes.length > 0 ? "（" + notes.join("・") + "）" : "") +
    (request ? ": " + request : "") +
    (d && d.judgeFailed === true ? "（判定エラー）" : "")
  );
}
