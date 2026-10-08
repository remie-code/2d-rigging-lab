// @ts-check
/**
 * view-logic: 転写行の表示文字列導出（preact 非依存の純関数）。
 *
 * 現 cockpit.html の `addTranscriptRow`（cockpit.html:386-408）から、DOM 構築を剥がして
 * 「話者ラベル」「レイテンシ表示」「行クラス」の導出だけを取り出す。機能同値（fixture で固定）。
 *
 * 対応（現 cockpit.html）:
 *  - resolveSpeaker → :389 `var speaker = d.speaker || "you";`
 *  - speakerLabel   → :396 `who.textContent = (speaker === "viewer" && d.displayName)
 *                              ? ("viewer(" + d.displayName + ")") : speaker;`
 *  - speakerRowClass→ :390 `row.className = "row speaker-" + speaker;`
 *  - latencyLabel   → :401-404 `if (d.latencyMs != null) lat.textContent = "(" + (d.latencyMs / 1000).toFixed(1) + "s)";`
 *                     （履歴行には latencyMs が載らない＝ live 行のみ (Ns) が付く・domain-a.md §3.3 注）
 *
 * 多頭化 Domain C（brain-swap-wave-plan.md §3）追加抽出: latencyLabel に brain 札を additive な第 2
 * 引数で足す（soul 行がどの頭の応答かを一目で示す・blocking #6 additive・brain 未指定は従来どおり
 * (Ns) のみ＝後方互換）。
 */

/**
 * 話者を解決する（未指定は you・S2 挙動不変）。
 * @param {{ speaker?: string | null }} entry
 * @returns {string}
 */
export function resolveSpeaker(entry) {
  return (entry && entry.speaker) || "you";
}

/**
 * 話者ラベル文字列（viewer は displayName があれば `viewer(名前)`・注入描画と対称）。
 * displayName 欠落の viewer は素の `viewer` へ劣化する。
 * @param {{ speaker?: string | null; displayName?: string | null }} entry
 * @returns {string}
 */
export function speakerLabel(entry) {
  const speaker = resolveSpeaker(entry);
  return speaker === "viewer" && entry && entry.displayName
    ? "viewer(" + entry.displayName + ")"
    : speaker;
}

/**
 * 転写行の className（話者で色分け・CSS `.row.speaker-<speaker>`）。
 * @param {{ speaker?: string | null }} entry
 * @returns {string}
 */
export function speakerRowClass(entry) {
  return "row speaker-" + resolveSpeaker(entry);
}

/**
 * レイテンシ表示（live 行のみ・履歴行は null＝表示しない）。`latencyMs != null` の意味論を踏襲
 * （null と undefined の両方で非表示）。
 *
 * 多頭化 Domain C: 第 2 引数 `brain` を additive に受ける（発話ごとの頭札・brain-swap.md §2）。
 * `latencyMs` が null/undefined なら brain の有無に関わらず null（レイテンシが無ければ札も出さない
 * ＝発話していない soul 行 (NG ブロック等) では表示しない）。brain 未指定/null は従来どおり `(Ns)` のみ
 * （後方互換・you/viewer 行や brain 未注入時の soul 行はこの分岐を通る）。
 * @param {number | null | undefined} latencyMs
 * @param {string | null | undefined} [brain]
 * @returns {string | null}
 */
export function latencyLabel(latencyMs, brain) {
  if (latencyMs == null) return null;
  const secs = (latencyMs / 1000).toFixed(1) + "s";
  return brain ? "(" + secs + " · " + brain + ")" : "(" + secs + ")";
}
