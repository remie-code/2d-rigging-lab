// @ts-check
/**
 * view-logic: 時刻/経過の整形（preact 非依存の純関数）。
 *
 * 操縦席 UI 改定 Domain A の「保存オラクルの表示側の固定点」。現 cockpit.html の該当ロジックと
 * **機能同値**（DOM 構築を剥がし、SSE/state データ → 表示文字列の変換だけを取り出す）。html/render は
 * 一切 import しない（node:test でブラウザ非依存に回るための制約 b）。
 *
 * 対応（現 cockpit.html）:
 *  - pad             → cockpit.html:249 `function pad(n)`
 *  - formatHms       → cockpit.html:250-253 `function fmtHms(ms)`（フッタ uptime の HH:MM:SS）
 *  - formatClock     → cockpit.html:254-257 `function fmtClock(epochMs)`（行の時刻 HH:MM:SS・**ローカル時刻**）
 *  - computeUptimeMs → cockpit.html:258-261 `function renderUptime()` の ms 計算部
 *                      （listening 中はローカル刻み・state 到着で再同期。負クランプは原実装同様しない）
 */

/**
 * 1 桁を 0 埋めして 2 桁にする（10 以上はそのまま＝原実装踏襲・時が 3 桁でも切らない）。
 * @param {number} n
 * @returns {string}
 */
export function pad(n) {
  return (n < 10 ? "0" : "") + n;
}

/**
 * 経過ミリ秒を HH:MM:SS へ（時は桁あふれを許す＝ pad が 2 桁未満のみ 0 埋め）。
 * @param {number} ms
 * @returns {string}
 */
export function formatHms(ms) {
  const s = Math.floor(ms / 1000);
  return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
}

/**
 * エポックミリ秒を **ローカル時刻**の HH:MM:SS へ（行の時刻表示）。
 * @param {number} epochMs
 * @returns {string}
 */
export function formatClock(epochMs) {
  const d = new Date(epochMs);
  return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
}

/**
 * uptime のミリ秒を求める（listening 中のみローカル刻み・stopped は 0）。
 * 原実装 `renderUptime` の `earsListening ? (uptimeBaseMs + (Date.now() - uptimeAnchor)) : 0` と同値。
 * @param {object} args
 * @param {boolean} args.listening  耳が listening 中か。
 * @param {number} args.baseMs      state 到着時点の基準経過（uptimeBaseMs）。
 * @param {number} args.anchorMs    その基準を受けたローカル時刻（uptimeAnchor）。
 * @param {number} args.nowMs       現在のローカル時刻（Date.now()）。
 * @returns {number}
 */
export function computeUptimeMs({ listening, baseMs, anchorMs, nowMs }) {
  return listening ? (baseMs + (nowMs - anchorMs)) : 0;
}
