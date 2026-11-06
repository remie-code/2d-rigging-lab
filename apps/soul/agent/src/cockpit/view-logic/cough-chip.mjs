// @ts-check
/**
 * view-logic: 上の帯の「咳 ×N」の札（咳払いの落とし 段階 2・Domain B・preact 非依存の純関数）。
 *
 * 合意: discussion/ai-cohost/implementation/orchestration/cough-filter-stage2-plan.md §1「知らせ」・§2 の 9・§4 B。
 *  - SSE discard の reason "cough"（耳が咳として落とした区間）を受けると、状態のピルの隣に薄いグレーの札「咳 ×N」。
 *    reason "blank"（空の文字起こし）は札に関わらない。
 *  - 最後の咳から COUGH_CHIP_TTL_MS（8 秒）で消える。消える前に次が来れば N が増え、8 秒を数え直す。消えたあとの
 *    次の咳は ×1 から（受け取りの時点でも期限切れなら数え直す）。
 *  - 消すのは画面の 1 秒ごとの時計（app.mjs の nowTick）と最後の時刻を描画のたびに比べるだけ（setTimeout は使わない・
 *    サーバは状態を持たない）。
 *  - マウスを乗せたとき（title）だけ、今の札が数えている区間を新しい順に「「うん」 Speech 0.05」の形で最大 5 件。
 *    文字と確率はこの札の title だけに出す（ブラウザに保存しない・サーバへ送り返さない・ログのタブにも出さない）。
 */

/** 札が出ている長さ（最後の咳から・ms）。 */
export const COUGH_CHIP_TTL_MS = 8000;

/** ホバー（title）に並べる区間の数の上限（新しい順）。 */
export const COUGH_CHIP_TITLE_MAX = 5;

/**
 * @typedef {{ text: string | null; speech: number | null }} CoughChipEntry
 * @typedef {{ lastAtMs: number | null; count: number; entries: ReadonlyArray<CoughChipEntry> }} CoughChipState
 */

/** @param {unknown} v @returns {v is number} */
function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/** 札の空の状態（何も数えていない）。 @returns {CoughChipState} */
export function emptyCoughChip() {
  return { lastAtMs: null, count: 0, entries: [] };
}

/**
 * 札が nowMs の時点で生きているか（最後の咳からちょうど 8 秒で消える・時計が受け取りより少し遅れていても出す）。
 * @param {CoughChipState | null | undefined} state  @param {number} nowMs
 */
function isLive(state, nowMs) {
  if (!state || !isNum(state.lastAtMs) || !isNum(state.count) || state.count <= 0 || !isNum(nowMs)) return false;
  return nowMs - state.lastAtMs < COUGH_CHIP_TTL_MS;
}

/**
 * SSE discard を受けたときの札の次の状態。reason "cough" だけを数え、それ以外（blank・形の違う値）は同じ状態を返す。
 * 期限が切れていれば ×1 から数え直す。文字は文字列（trim）で空なら null、確率は有限の数でなければ null。
 * @param {CoughChipState | null | undefined} state
 * @param {any} d  SSE discard の data（{ startMs, endMs, reason, appended, discarded, text?, speech? }）。
 * @param {number} nowMs  受け取った時刻。
 * @returns {CoughChipState}
 */
export function coughChipAfterDiscard(state, d, nowMs) {
  const prev = state ?? emptyCoughChip();
  if (!d || typeof d !== "object" || d.reason !== "cough" || !isNum(nowMs)) return prev;
  const prevEntries = Array.isArray(prev.entries) ? prev.entries : [];
  const text = typeof d.text === "string" && d.text.trim() !== "" ? d.text.trim() : null;
  const speech = isNum(d.speech) ? d.speech : null;
  /** @type {CoughChipEntry} */
  const entry = { text, speech };
  if (!isLive(prev, nowMs)) return { lastAtMs: nowMs, count: 1, entries: [entry] };
  return {
    lastAtMs: nowMs,
    count: prev.count + 1,
    entries: [entry, ...prevEntries].slice(0, COUGH_CHIP_TITLE_MAX)
  };
}

/**
 * ホバーの 1 行（「「うん」 Speech 0.05」・確率は小数 2 桁・欠けた文字は「?」・欠けた確率は「?」）。
 * @param {CoughChipEntry} entry
 */
export function coughChipEntryText(entry) {
  const text = entry && typeof entry.text === "string" && entry.text !== "" ? entry.text : "?";
  const speech = entry && isNum(entry.speech) ? entry.speech.toFixed(2) : "?";
  return "「" + text + "」 Speech " + speech;
}

/**
 * nowMs での札の表示（出さないときは null）。text は「咳 ×N」、title は数えている区間を新しい順に改行で並べる（最大 5 件）。
 * @param {CoughChipState | null | undefined} state  @param {number} nowMs
 * @returns {{ text: string; title: string; className: string } | null}
 */
export function coughChipView(state, nowMs) {
  if (!state || !isLive(state, nowMs)) return null;
  const entries = Array.isArray(state.entries) ? state.entries.slice(0, COUGH_CHIP_TITLE_MAX) : [];
  return {
    text: "咳 ×" + state.count,
    title: entries.map(coughChipEntryText).join("\n"),
    className: "cough-chip"
  };
}
