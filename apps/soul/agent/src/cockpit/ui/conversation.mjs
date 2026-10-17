// @ts-check
/**
 * ui: 会話タイムライン（主役・左 約 6 割・cockpit-glance-redesign.md §3・§4・§8・§9）。
 *
 * view-logic/glance-timeline.mjs の conversationRowsView が作った表示行を**機械的に描くだけ**（結び付けと文言は
 * view-logic で済んでいる）。最新が下。入る分だけ最新を表示し、あふれた古い行は上で切る（スクロールしない・
 * CSS の .convo-list が下寄せ + overflow:hidden。全履歴は準備・設定の「ログ」タブ）。
 *  - 推論に使った範囲: 範囲の行の左端につながった細い縦線（.in-range）と、範囲の始まりの上に極小の「推論に使った範囲」。
 *  - 判定の札: 配信者の行の右端（"応答 0.72"）。
 *  - チャッピーの行: 右端に遅延の棒（長さ固定・区間は比・8 色）と合計（4 秒超琥珀・6 秒超赤）。
 *    コメント反応は本文の後ろに「💬 名前 に反応」、きっかけの行が無い発火は小さく種類（「手動」「沈黙」）。
 *  - 相槌の間隔で流れた判定: 薄い灰色の 1 行。
 *  - 最新の返事の行は淡く強調し、そのきっかけの配信者の行も同じ色で淡くつなぐ。
 * 配信前（耳が止まっている間）は会話の場所の中央に大きく「準備・設定を開く」（§4・§9.2）。
 *
 * トップレベル副作用ゼロ（export function のみ）。hooks は使わない（vnode 走査テスト対象）。
 */

import { html } from "../vendor/htm.preact.standalone.mjs";

/**
 * 遅延の棒（長さ固定・hooks 非使用）。
 * @param {{ view: { parts: Array<{ key: string; className: string; percent: number }>; totalText: string;
 *   levelClassName: string; title: string } }} props
 */
export function LatencyBar({ view }) {
  return html`
    <span class="lat" title=${view.title}>
      <span class="lat-bar">
        ${view.parts.map((p) => html`<span key=${p.key} class=${"lat-seg " + p.className} style=${"width:" + p.percent + "%"}></span>`)}
      </span>
      <span class=${view.levelClassName}>${view.totalText}</span>
    </span>
  `;
}

/**
 * 会話の 1 行（hooks 非使用）。
 * @param {{ row: import("../view-logic/glance-timeline.mjs").ConvoRowView }} props
 */
export function ConversationRow({ row }) {
  const cls =
    "convo-row " + row.kind +
    (row.inRange ? " in-range" : "") +
    (row.rangeStart ? " range-start" : "") +
    (row.rangeEnd ? " range-end" : "") +
    (row.latest ? " latest" : "") +
    (row.linked ? " linked" : "");
  if (row.kind === "note") {
    return html`<div class=${cls}><span class="time"></span><span class="who"></span><span class="text">${row.text}</span></div>`;
  }
  return html`
    <div class=${cls}>
      <span class="time">${row.timeText}</span>
      <span class="who">${row.whoText}</span>
      <span class="text">
        <span class="body">${row.text}</span>
        ${row.reactText ? html`<span class="react-tag">${row.reactText}</span>` : null}
        ${row.kindText ? html`<span class="kind-tag">${row.kindText}</span>` : null}
      </span>
      <span class="side">
        ${row.chipText ? html`<span class="judge-chip">${row.chipText}</span>` : null}
        ${row.latency ? html`<${LatencyBar} view=${row.latency} />` : null}
      </span>
    </div>
  `;
}

/**
 * 会話タイムライン本体（hooks 非使用）。
 * @param {{ rows: import("../view-logic/glance-timeline.mjs").ConvoRowView[]; preStream?: boolean;
 *   onOpenSettings?: () => void }} props
 */
export function ConversationPanel({ rows, preStream = false, onOpenSettings }) {
  return html`
    <section class="glance-panel convo-panel" aria-label="会話">
      <h2 class="panel-title">会話</h2>
      ${preStream
        ? html`
          <div class="prestream">
            <button class="prestream-open" type="button" onClick=${onOpenSettings}>準備・設定を開く</button>
          </div>`
        : html`
          <div class="convo-list" role="log" aria-live="polite">
            ${rows.flatMap((row) => [
              ...(row.rangeStart ? [html`<div key=${"range-" + row.key} class="range-label">推論に使った範囲</div>`] : []),
              html`<${ConversationRow} key=${row.key} row=${row} />`
            ])}
          </div>`}
    </section>
  `;
}
