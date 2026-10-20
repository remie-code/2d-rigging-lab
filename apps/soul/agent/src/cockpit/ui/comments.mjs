// @ts-check
/**
 * ui: コメント（脇役・右 約 3.5 割・cockpit-glance-redesign.md §3・§8・§9.2）。
 *
 * view-logic/glance-timeline.mjs の commentRowsView が作った表示行を描くだけ。新しいものが上。入る分だけ表示し、
 * あふれた古い行は下で切る（スクロールしない）。
 *  - 普通のコメント: 投稿者名・本文だけ（札は付けない）。
 *  - チャッピーが反応したコメント: 淡く強調し、小さな「反応」の印。
 *  - 弾いたコメント: 1 行に畳んで薄く、赤い小さな札「弾いた: 種類」だけ（本文はサーバから来ない）。
 *
 * トップレベル副作用ゼロ（export function のみ）。hooks は使わない（vnode 走査テスト対象）。
 */

import { html } from "../vendor/htm.preact.standalone.mjs";

/**
 * コメントの 1 行（hooks 非使用）。
 * @param {{ row: import("../view-logic/glance-timeline.mjs").CommentRowView }} props
 */
export function CommentRow({ row }) {
  if (row.kind === "rejected") {
    return html`<div class="comment-row rejected"><span class="reject-chip">${row.rejectText}</span></div>`;
  }
  return html`
    <div class=${"comment-row" + (row.reacted ? " reacted" : "")}>
      <span class="name">${row.nameText}</span>
      <span class="text">${row.text}</span>
      ${row.reacted ? html`<span class="react-mark">反応</span>` : null}
    </div>
  `;
}

/**
 * コメントの列（hooks 非使用）。
 * @param {{ rows: import("../view-logic/glance-timeline.mjs").CommentRowView[] }} props
 */
export function CommentsPanel({ rows }) {
  return html`
    <section class="glance-panel comments-panel" aria-label="コメント">
      <h2 class="panel-title">コメント</h2>
      <div class="comments-list">
        ${rows.map((row) => html`<${CommentRow} key=${row.key} row=${row} />`)}
      </div>
    </section>
  `;
}
