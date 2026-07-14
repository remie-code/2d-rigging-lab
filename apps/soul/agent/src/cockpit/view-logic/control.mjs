// @ts-check
/**
 * view-logic: 運転バー（Fire / Fire+視覚 / 自発トグル）の表示導出（preact 非依存の純関数）。
 *
 * 操縦席 UI 改定 Domain C の追加抽出（L0 裁定済みの申し送り・domain-a.md §7-2 / domain-b.md §8-2）。
 * 現 cockpit.html の applySoulState（busy disable + soul-status 文言）・applySelfFire（トグル状態導出）・
 * fire-note 文言体系（Fire ボタン応答の 503/エラー文言 + SSE fire の非受理文言）から DOM 構築 /
 * fetch 配線を剥がして「状態 → 表示構造体 / 文字列」の導出だけを取り出す。機能同値（fixture で固定）。
 *
 * 様式統一（全 view-logic 共通・L0 裁定）: 行テキスト=文字列・状態導出={text, className, …}構造体・
 * **非表示（更新しない）= null**（view-logic が null を返したら呼び出し側は表示を変えない）。
 *
 * 対応（現 cockpit.html）:
 *  - soulStatusView           → :434-441 `applySoulState(state)`（thinking/speaking 以外は idle へ畳む・
 *                                busy 中は Fire / Fire(vision) を disable = 二重の防波堤のUI側）
 *  - fireNoteFromSseFire      → :860-864 SSE fire（accepted:true はノートをクリア=""・
 *                                非受理は "not fired: reason"。Domain B app.mjs:126-128 の暫定移植の統合先）
 *  - fireNoteFromFireResponse → :561-563 / :580-582 POST /api/fire・/api/vision-fire 応答
 *                                （503 = fire 未結線・fired:false は reason・受理は null = ノートを変えない）
 *  - fireRequestErrorNote     → :566-567 / :585-586 fetch catch（"fire error: e" / "vision fire error: e"）
 *  - selfFireToggleView       → :324-340 `applySelfFire(sf)`（null = scheduler 未生成 → disable +
 *                                "not available"・それ以外は checked/on/off 導出）
 *  - selfFirePostErrorText    → :645-648 POST /api/self-fire 応答（503 / set failed・成功は null）
 *  - selfFireRequestErrorText → :649-650 fetch catch（"self-fire error: e"）
 *  - verbosityPostErrorText    → POST /api/verbosity 応答（503 / invalid mode / set failed・成功は null・
 *                                 selfFirePostErrorText の写経・wave 計画「口数配線」§2 裁定 A）
 *  - verbosityRequestErrorText → POST /api/verbosity の fetch catch（"verbosity error: e"・
 *                                 selfFireRequestErrorText の写経）
 */

/**
 * soul 状態の表示 + Fire/Fire(vision) の busy disable 導出。
 * thinking / speaking 以外はすべて idle へ畳む（:435）。busy 中（idle 以外）は Fire を disable
 * （busy 中の Fire はサーバ側でも無視される・二重の防波堤 :433 :439-440）。
 * @param {string | null | undefined} state  SSE soul / POST fire 応答の state。
 * @returns {{ text: string; className: string; fireDisabled: boolean }}
 */
export function soulStatusView(state) {
  const st = state === "thinking" || state === "speaking" ? state : "idle";
  return { text: st, className: "soul-state " + st, fireDisabled: st !== "idle" };
}

/**
 * SSE fire イベント → fire-note 文言（:860-864）。
 * accepted:true は ""（ノートをクリア :862）・それ以外は "not fired: reason"（:863）。
 * @param {{ accepted?: boolean; reason?: string | null } | null | undefined} d
 * @returns {string}
 */
export function fireNoteFromSseFire(d) {
  if (d && d.accepted === true) return "";
  return "not fired: " + ((d && d.reason) || "unknown");
}

/**
 * POST /api/fire・/api/vision-fire 応答 → fire-note 文言（:561-563 / :580-582・両ボタン同文言）。
 * 503 = fire 未結線（--channel なしで起動）・fired:false は reason を控えめに表示・
 * 受理（fired:true）は **null = ノートを変えない**（押下時に "" クリア済み :557 :575 の挙動を保存）。
 * @param {{ status: number; j?: { fired?: boolean; reason?: string | null } | null }} res
 * @returns {string | null}
 */
export function fireNoteFromFireResponse(res) {
  if (res.status === 503) return "fire not available (start cockpit with --channel)";
  if (res.j && res.j.fired === false) return "not fired: " + (res.j.reason || "unknown");
  return null;
}

/**
 * Fire / Fire(vision) の fetch 失敗 → fire-note 文言（:566-567 / :585-586）。
 * e の文字列化は原実装と同じ文字列連結（"prefix: " + e）。
 * @param {"fire" | "vision"} kind
 * @param {unknown} e
 * @returns {string}
 */
export function fireRequestErrorNote(kind, e) {
  return (kind === "vision" ? "vision fire error: " : "fire error: ") + e;
}

/**
 * 自発トグルの状態導出（applySelfFire :324-340）。
 * sf が null / undefined（scheduler 未生成 = orchestrator 未注入）は「使えない」ことを
 * disable + "not available" で表す（:327-333）。className の末尾スペース（off 時
 * "self-fire-status "）は原実装 :339 `"self-fire-status " + (sf.enabled ? "on" : "")` の踏襲。
 * @param {{ enabled?: boolean } | null | undefined} sf  state snapshot の selfFire。
 * @returns {{ disabled: boolean; checked: boolean; statusText: string; statusClassName: string }}
 */
export function selfFireToggleView(sf) {
  if (!sf) {
    return { disabled: true, checked: false, statusText: "not available", statusClassName: "self-fire-status" };
  }
  const on = !!sf.enabled;
  return {
    disabled: false,
    checked: on,
    statusText: on ? "on" : "off",
    statusClassName: "self-fire-status " + (on ? "on" : "")
  };
}

/**
 * POST /api/self-fire 応答 → エラー文言（:645-648）。成功（200）は **null = エラーなし**
 * （呼び出し側は snapshot 応答を適用する）。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function selfFirePostErrorText(res) {
  if (res.status === 503) return "self-fire control not available";
  if (!res.ok) return "set failed: " + ((res.j && res.j.error) || "error");
  return null;
}

/**
 * POST /api/self-fire の fetch 失敗 → エラー文言（:649-650）。
 * @param {unknown} e
 * @returns {string}
 */
export function selfFireRequestErrorText(e) {
  return "self-fire error: " + e;
}

/**
 * POST /api/verbosity 応答 → エラー文言（selfFirePostErrorText の写経・wave 計画「口数配線」§2 裁定 A）。
 * 成功（200）は **null = エラーなし**（呼び出し側は snapshot 応答を適用する）。
 * @param {{ status: number; ok: boolean; j?: { error?: string | null } | null }} res
 * @returns {string | null}
 */
export function verbosityPostErrorText(res) {
  if (res.status === 503) return "verbosity control not available";
  if (!res.ok) return "set failed: " + ((res.j && res.j.error) || "error");
  return null;
}

/**
 * POST /api/verbosity の fetch 失敗 → エラー文言（selfFireRequestErrorText の写経）。
 * @param {unknown} e
 * @returns {string}
 */
export function verbosityRequestErrorText(e) {
  return "verbosity error: " + e;
}
