// @ts-check
/**
 * view-logic: ゴースト行ラベルの導出（preact 非依存の純関数）。
 *
 * 「破棄/取得死/失敗の無言の消失をタイムラインに淡色行で残す」= 保存オラクルの表示側の固定点。
 * 現 cockpit.html の各 SSE ハンドラ（discard / diagnostic / selfFire / chatDiagnostic）に散っている
 * 「type/kind → ゴースト行ラベル文字列」の対応を純関数へ括り出す。**意図的非表示リストを厳密に遵守**
 * （該当型は null を返す＝行を作らない）。
 *
 * 対応（現 cockpit.html）:
 *  - discardGhostLabel        → :828 `addGhostRow("(discarded)")`
 *  - diagnosticGhostLabel     → :831-855 の diagnostic ハンドラ全分岐
 *  - selfFireGhostLabel       → :877 selfFire fired:false のゴースト行
 *  - chatDiagnosticGhostLabel → :888-897 chatDiagnostic の取得死分類ゴースト行
 *
 * ★ 意図的非表示（cockpit.html:850-854 の裁定・page test:244-246 が根拠）:
 *   expressionBrokenTag / expressionRejected / expressionSendError は行を作らない（→ null）。
 *   演出行の ✗N（拒否スロット数）が既に伝えるため二重表示を避ける。壊れ括弧の除去痕もノイズ。
 * ★ chatDiagnostic の観測補助（connected/stopped/ignoredRenderers/listenerError）も非表示（→ null）。
 * ★ bargeIn（type=="bargeIn"）はゴーストではなく専用マーカー行（markers.bargeInMarkerText）へ回るため
 *   ここでは null を返す（診断ハンドラが type=="bargeIn" を先に分岐して marker に振る）。
 */

/** 破棄（空転写破棄・SSE discard）のゴースト行ラベル。 */
export function discardGhostLabel() {
  return "(discarded)";
}

/**
 * diagnostic 型 → ゴースト行ラベル（表示しない型は null）。
 * @param {{ type?: string | null; message?: string | null; tag?: string | null; kind?: string | null }} d
 * @returns {string | null}
 */
export function diagnosticGhostLabel(d) {
  const type = d && d.type;
  switch (type) {
    case "asrFailure":
      return "(asr failed)";
    case "fireEmptyReply":
      return "(fire: empty reply)";
    case "fireError":
      return "(fire error: " + ((d && d.message) || "unknown") + ")";
    case "expressionUnknownTag":
      return "(unknown tag: " + ((d && d.tag) || "?") + ")";
    case "fireVisionError":
      return "(vision fire: " + ((d && d.kind) || "?") + (d && d.message ? " — " + d.message : "") + ")";
    case "bargeInStopError":
      return "(barge-in: player.stop failed — " + ((d && d.message) || "?") + ")";
    case "bargeInMouthCloseRejected":
      return "(barge-in: mouth-close rejected)";
    case "bargeInMouthCloseError":
      return "(barge-in: mouth-close failed — " + ((d && d.message) || "?") + ")";
    case "chatBufferAbsent":
      return "(chat: ears not running — comment did not merge)";
    // 意図的非表示（行を作らない）: expressionBrokenTag / expressionRejected / expressionSendError。
    // bargeIn は専用マーカー行へ（ここでは null）。他の未知型も拡張予約で非表示（null）。
    default:
      return null;
  }
}

/**
 * 自発発火のスケジューラ診断（fired:false）のゴースト行ラベル。
 * 呼び出し側は SSE selfFire の `d.fired` が false のときにのみ使う（fired:true は selfFireMarkerText）。
 * @param {{ kind?: string | null; reason?: string | null }} d
 * @returns {string}
 */
export function selfFireGhostLabel(d) {
  return "(self-fire: " + ((d && d.kind) || "?") + " not fired — " + ((d && d.reason) || "?") + ")";
}

/**
 * チャット器官の診断（取得死/抽出失敗）のゴースト行ラベル（観測補助の内部診断は null＝非表示）。
 * @param {{ kind?: string | null; message?: string | null }} d
 * @returns {string | null}
 */
export function chatDiagnosticGhostLabel(d) {
  const kind = (d && d.kind) || "?";
  if (
    kind === "notLive" ||
    kind === "ended" ||
    kind === "extractFailed" ||
    kind === "network" ||
    kind === "internalError"
  ) {
    return "(chat: " + kind + (d && d.message ? " — " + d.message : "") + ")";
  }
  return null;
}
