// @ts-check
/**
 * ui: 観測フィード（主役・cockpit-redesign.md §2/§7）。
 *
 * rows.mjs が構築した行レコードを**機械的に描くだけ**の層（表示文字列の導出はここに無い・
 * すべて view-logic → rows.mjs で済んでいる・L0 裁定）。現 cockpit.html の #timeline
 * （:225-228）+ 各 add*Row の DOM 構築部 + フッタ（:230-233 discarded/uptime）+
 * usage-note（:222）の移植先。
 *
 * 自動スクロール（モック §2 準拠・hooks）:
 *  - 末尾追従が既定（現 cockpit.html の `timeline.scrollTop = timeline.scrollHeight` :383 等と同値）。
 *  - ユーザーが上へスクロールしたら追従を止め「最新へ ↓」ボタンを出す。
 *  - ボタン押下 or 末尾近くまで戻ると追従再開。
 *
 * props 契約:
 *  - rows:       rows.mjs の行レコード配列（feed.rows）。
 *  - usageNote:  string  usage 表示（view-logic usageNoteText 導出済み・初期 ""）。
 *  - discarded:  number|string  破棄カウンタ（SSE discard / state スナップショット由来）。
 *  - uptimeText: string  formatHms 導出済みの uptime（初期 "00:00:00"）。
 *
 * トップレベル副作用ゼロ（export function のみ）。
 */

import { html, useRef, useState, useEffect, useCallback } from "../vendor/htm.preact.standalone.mjs";

/** 末尾追従とみなすスクロール残量の閾値（px）。 */
export const STICK_THRESHOLD_PX = 40;

/**
 * スクロール位置から「末尾に貼り付いている」かを判定する純関数（fixture 対象）。
 * @param {{ scrollTop: number; scrollHeight: number; clientHeight: number }} m
 * @returns {boolean}
 */
export function isStuckToBottom({ scrollTop, scrollHeight, clientHeight }) {
  return scrollHeight - scrollTop - clientHeight < STICK_THRESHOLD_PX;
}

/**
 * 行レコード 1 件の描画（rows.mjs の行レコード契約に対する機械的な写像）。
 * 行構造は現 cockpit.html の DOM 構築（time/who/marker/text/lat/img）と機能同値。
 * @param {{ row: any }} props
 */
export function FeedRow({ row }) {
  switch (row.kind) {
    case "speaking":
      // showSpeakingRow :374-384 同値（時刻空・who "you"・固定文言）。
      return html`<div class="row speaking">
        <span class="time"></span><span class="who">you</span><span class="text">······(speaking)</span>
      </div>`;
    case "transcript":
      // addTranscriptRow :386-408 同値（lat は live 行のみ・rows.mjs で null 済み）。
      return html`<div class=${row.rowClass}>
        <span class="time">${row.timeText}</span><span class="who">${row.whoText}</span><span class="marker" />
        <span class="text">${row.text}</span>${row.latText != null ? html`<span class="lat">${row.latText}</span>` : null}
      </div>`;
    case "ghost":
      // addGhostRow :417-429 同値（話者不明のため who は空）。
      return html`<div class="row ghost">
        <span class="time">${row.timeText}</span><span class="who" /><span class="marker" />
        <span class="text">${row.text}</span>
      </div>`;
    case "expression":
      // addExpressionRow :466-482 同値の文字列 + §7 の器（サブ行インデント + ↳）。
      return html`<div class="row expression">
        <span class="time">${row.timeText}</span><span class="sub-arrow">↳</span>
        <span class="who">${row.whoText}</span><span class="text">${row.text}</span>
      </div>`;
    case "vision-marker":
      // addVisionMarkerRow :487-507 同値（サムネは data URI を <img> にだけ渡す・非保存）。
      return html`<div class="row vision-marker">
        <span class="time">${row.timeText}</span><span class="who">${row.whoText}</span>
        <span class="marker">${row.markerText}</span><span class="text">${row.text}</span>
        ${row.thumbSrc ? html`<img class="vision-thumb" alt="captured window thumbnail" src=${row.thumbSrc} />` : null}
      </div>`;
    case "fire-marker":
    case "barge-in-marker":
    case "self-fire-marker":
      // addFireMarkerRow :448-461 / addBargeInMarkerRow :512-525 / addSelfFireMarkerRow :531-543 同値。
      return html`<div class=${"row " + row.kind}>
        <span class="time">${row.timeText}</span><span class="who">${row.whoText}</span>
        <span class="marker">${row.markerText}</span><span class="text">${row.text}</span>
      </div>`;
    default:
      return null;
  }
}

/**
 * 観測フィード本体（スクロール領域 + メタ計器 + 「最新へ ↓」）。
 * @param {{ rows: any[]; usageNote?: string; discarded?: number | string; uptimeText?: string }} props
 */
export function Feed({ rows, usageNote, discarded, uptimeText }) {
  const scrollRef = useRef(/** @type {HTMLElement | null} */ (null));
  const stuckRef = useRef(true); // 追従状態の即時参照（effect と onScroll の間で 1 render 遅れない）。
  const [stuck, setStuck] = useState(true);

  // 行が増えたら末尾追従（追従中のみ）。現 cockpit.html は行追加のたび scrollTop=scrollHeight（:383 等）。
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stuckRef.current) el.scrollTop = el.scrollHeight;
  }, [rows]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = isStuckToBottom({
      scrollTop: el.scrollTop,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight
    });
    stuckRef.current = next;
    setStuck(next);
  }, []);

  const jumpToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    stuckRef.current = true;
    setStuck(true);
  }, []);

  return html`
    <section class="feed-panel" aria-label="observation feed">
      <div class="feed-scroll" role="log" aria-live="polite" ref=${scrollRef} onScroll=${onScroll}>
        ${rows.map((row) => html`<${FeedRow} key=${row.id} row=${row} />`)}
      </div>
      ${stuck ? null : html`<button class="jump-to-latest" type="button" onClick=${jumpToLatest}>最新へ ↓</button>`}
      <div class="feed-meta">
        <span class="usage-note">${usageNote}</span>
        <span>discarded: <span class="footer-discarded">${discarded}</span></span>
        <span>uptime: <span class="footer-uptime">${uptimeText}</span></span>
      </div>
    </section>
  `;
}
