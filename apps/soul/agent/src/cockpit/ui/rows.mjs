// @ts-check
/**
 * ui: 観測フィードの行レコード構築（preact 非依存の純関数・nowMs 注入）。
 *
 * 現 cockpit.html の Timeline 系ハンドラ（addTranscriptRow/addGhostRow/addFireMarkerRow/
 * addExpressionRow/addVisionMarkerRow/addBargeInMarkerRow/addSelfFireMarkerRow/
 * showSpeakingRow/removeSpeakingRow/renderHistory・SSE 購読の分岐 :813-897）の移植先。
 * DOM append の代わりに **immutable な feed 状態 { rows, nextId } を返す**。表示文字列・状態導出は
 * すべて view-logic 経由（ここで再実装しない・L0 裁定）。feed.mjs は行レコードを機械的に描くだけ。
 *
 * 行レコード（描画済みフィールドのみ・feed.mjs に表示ロジックを持ち込まない）:
 *  - transcript:       { id, kind:"transcript", timeText, rowClass, whoText, text, latText: string|null }
 *  - speaking:         { id, kind:"speaking" }（文言/クラスは固定・feed.mjs が定型で描く）
 *  - ghost:            { id, kind:"ghost", timeText, text }
 *  - fire-marker:      { id, kind:"fire-marker", timeText, whoText:"fire", markerText:"*", text }
 *  - expression:       { id, kind:"expression", timeText, whoText:"expr", text }（サブ行 ↳ は feed.mjs の器）
 *  - vision-marker:    { id, kind:"vision-marker", timeText, whoText:"vision", markerText:"*", text, thumbSrc: string|null }
 *  - barge-in-marker:  { id, kind:"barge-in-marker", timeText, whoText:"barge-in", markerText:"!!", text }
 *  - self-fire-marker: { id, kind:"self-fire-marker", timeText, whoText:"self", markerText:"~", text }
 *
 * speaking 行の規律（現 cockpit.html と機能同値）:
 *  - transcript / ghost の追加は speaking 行を**除去してから**積む（:387 :418 removeSpeakingRow）。
 *  - マーカー行（fire/expression/vision/barge-in/self-fire）は除去**しない**（原実装も呼ばない＝
 *    speaking 行がタイムライン途中に残る挙動まで保存）。
 */

import {
  speakerLabel,
  speakerRowClass,
  latencyLabel
} from "../view-logic/transcript.mjs";
import {
  fireMarkerText,
  expressionRowText,
  visionMarkerText,
  bargeInMarkerText,
  selfFireMarkerText
} from "../view-logic/markers.mjs";
import {
  discardGhostLabel,
  diagnosticGhostLabel,
  selfFireGhostLabel,
  chatDiagnosticGhostLabel
} from "../view-logic/ghost.mjs";
import { formatClock } from "../view-logic/format-time.mjs";

/** @typedef {{ rows: any[]; nextId: number }} FeedState */

/** 空のフィード状態。 */
export function emptyFeed() {
  return { rows: [], nextId: 1 };
}

/** @param {FeedState} feed  @param {any} row */
function appended(feed, row) {
  return { rows: [...feed.rows, { ...row, id: feed.nextId }], nextId: feed.nextId + 1 };
}

/** speaking 行を除去した rows（無ければ同一配列）。 */
function rowsWithoutSpeaking(rows) {
  return rows.some((r) => r.kind === "speaking") ? rows.filter((r) => r.kind !== "speaking") : rows;
}

/**
 * 転写行を積む（addTranscriptRow :386-408 同値・speaking 行は除去してから）。
 * 時刻は d.appendedAtMs 優先（:392 `fmtClock(d.appendedAtMs || Date.now())`）。
 * レイテンシは live 行のみ（latencyLabel が null なら描かない・履歴行は契約上載らない）。
 * @param {FeedState} feed  @param {any} d  SSE transcript ペイロード。  @param {number} nowMs
 */
export function feedWithTranscript(feed, d, nowMs) {
  const base = { ...feed, rows: rowsWithoutSpeaking(feed.rows) };
  return appended(base, {
    kind: "transcript",
    timeText: formatClock((d && d.appendedAtMs) || nowMs),
    rowClass: speakerRowClass(d),
    whoText: speakerLabel(d),
    text: d && d.text,
    latText: latencyLabel(d && d.latencyMs)
  });
}

/**
 * ゴースト行を積む（addGhostRow :417-429 同値・speaking 行は除去してから）。
 * **label が null なら行を作らない**（意図的非表示リストの機械的遵守・同一 feed を返す）。
 * label は必ず view-logic ghost.mjs の導出値を渡すこと（ここで文字列を組まない）。
 * @param {FeedState} feed  @param {string | null} label  @param {number} nowMs
 */
export function feedWithGhost(feed, label, nowMs) {
  if (label == null) return feed;
  const base = { ...feed, rows: rowsWithoutSpeaking(feed.rows) };
  return appended(base, { kind: "ghost", timeText: formatClock(nowMs), text: label });
}

/**
 * 発火マーカー行を積む（addFireMarkerRow :448-461 同値・時刻は d.atMs 優先 :452）。
 * @param {FeedState} feed  @param {any} d  SSE fire ペイロード（accepted:true）。  @param {number} nowMs
 */
export function feedWithFireMarker(feed, d, nowMs) {
  return appended(feed, {
    kind: "fire-marker",
    timeText: formatClock((d && d.atMs) || nowMs),
    whoText: "fire",
    markerText: "*",
    text: fireMarkerText(d)
  });
}

/**
 * 演出イベント行を積む（addExpressionRow :466-482 同値・サブ行の器は feed.mjs）。
 * @param {FeedState} feed  @param {any} d  SSE expression ペイロード。  @param {number} nowMs
 */
export function feedWithExpression(feed, d, nowMs) {
  return appended(feed, {
    kind: "expression",
    timeText: formatClock(nowMs),
    whoText: "expr",
    text: expressionRowText(d)
  });
}

/**
 * 「見た」マーカー行を積む（addVisionMarkerRow :487-507 同値）。
 * サムネは data URI を組んで <img> にだけ渡す（どこにも保存しない・:498-504）。
 * @param {FeedState} feed  @param {any} d  SSE visionCaptured ペイロード。  @param {number} nowMs
 */
export function feedWithVisionMarker(feed, d, nowMs) {
  return appended(feed, {
    kind: "vision-marker",
    timeText: formatClock(nowMs),
    whoText: "vision",
    markerText: "*",
    text: visionMarkerText(d),
    thumbSrc: d && d.jpegBase64 ? "data:image/jpeg;base64," + d.jpegBase64 : null
  });
}

/**
 * barge-in 中断マーカー行を積む（addBargeInMarkerRow :512-525 同値）。
 * @param {FeedState} feed  @param {any} d  diagnostic type=="bargeIn" ペイロード。  @param {number} nowMs
 */
export function feedWithBargeInMarker(feed, d, nowMs) {
  return appended(feed, {
    kind: "barge-in-marker",
    timeText: formatClock(nowMs),
    whoText: "barge-in",
    markerText: "!!",
    text: bargeInMarkerText(d)
  });
}

/**
 * 自発発火マーカー行を積む（addSelfFireMarkerRow :531-543 同値・fired:true のみ）。
 * @param {FeedState} feed  @param {any} d  SSE selfFire ペイロード（fired:true）。  @param {number} nowMs
 */
export function feedWithSelfFireMarker(feed, d, nowMs) {
  return appended(feed, {
    kind: "self-fire-marker",
    timeText: formatClock(nowMs),
    whoText: "self",
    markerText: "~",
    text: selfFireMarkerText(d)
  });
}

/**
 * speaking 行の出現/消滅（showSpeakingRow :374-384 / removeSpeakingRow :370-373 同値）。
 * visible=true: 既にあれば同一 feed（:375 `if (speakingRow) return;`）・なければ末尾に追加。
 * visible=false: あれば除去・なければ同一 feed。
 * @param {FeedState} feed  @param {boolean} visible
 */
export function feedWithSpeaking(feed, visible) {
  const has = feed.rows.some((r) => r.kind === "speaking");
  if (visible) {
    return has ? feed : appended(feed, { kind: "speaking" });
  }
  return has ? { ...feed, rows: feed.rows.filter((r) => r.kind !== "speaking") } : feed;
}

/**
 * タブ開き直しの履歴復元（renderHistory :410-413 同値・全置換）。
 * GET /api/state の transcripts[] を新規フィードへ積む（履歴エントリに latencyMs は契約上
 * 載らない = latText は自然に null・live 行のみ (Ns) が付く・domain-a.md §3.3 注）。
 * @param {any[]} transcripts  @param {number} nowMs
 * @returns {FeedState}
 */
export function feedFromHistory(transcripts, nowMs) {
  let feed = emptyFeed();
  for (const entry of transcripts || []) feed = feedWithTranscript(feed, entry, nowMs);
  return feed;
}

/**
 * SSE イベント → フィード状態遷移の単一経路（現 cockpit.html subscribe :814-897 の
 * タイムライン系分岐の移植先）。**タイムラインに行を作らないイベント
 * （state/soul/usage/chatStatus・vad の未知 type・fire の accepted!=true）は同一 feed を返す**。
 * 非タイムライン効果（discarded カウンタ・fire-note・usage 表示・chat 状態・snapshot 適用）は
 * app.mjs のハンドラが担う（§ SSE 対応表は waves/cockpit-redesign/domain-b.md §3）。
 *
 * 分岐の根拠:
 *  - vad（:817-821）: speechStart → speaking 出現 / speechEnd・speechCancel → 消滅。
 *  - transcript（:822）: 転写行。
 *  - expression（:824）: 演出行。
 *  - discard（:825-829）: ゴースト行 "(discarded)"（カウンタ更新は app.mjs）。
 *  - diagnostic（:830-855）: **type=="bargeIn" を先に専用マーカー行へ分流**（L0 裁定・:842）。
 *    それ以外は diagnosticGhostLabel 経由（null = 意図的非表示 = 行を作らない）。
 *  - fire（:860-864）: accepted:true のみマーカー行（fire-note は app.mjs）。
 *  - visionCaptured（:866）: 視覚マーカー行。
 *  - selfFire（:874-878）: fired:true はマーカー行 / fired:false はゴースト行。
 *  - chatDiagnostic（:888-897）: chatDiagnosticGhostLabel 経由（観測補助 4 種は null = 非表示）。
 *
 * @param {FeedState} feed  @param {string} eventName  @param {any} d  @param {number} nowMs
 * @returns {FeedState}
 */
export function feedAfterSseEvent(feed, eventName, d, nowMs) {
  switch (eventName) {
    case "vad": {
      const type = d && d.type;
      if (type === "speechStart") return feedWithSpeaking(feed, true);
      if (type === "speechEnd" || type === "speechCancel") return feedWithSpeaking(feed, false);
      return feed;
    }
    case "transcript":
      return feedWithTranscript(feed, d, nowMs);
    case "expression":
      return feedWithExpression(feed, d, nowMs);
    case "discard":
      return feedWithGhost(feed, discardGhostLabel(), nowMs);
    case "diagnostic":
      if (d && d.type === "bargeIn") return feedWithBargeInMarker(feed, d, nowMs);
      return feedWithGhost(feed, diagnosticGhostLabel(d), nowMs);
    case "fire":
      return d && d.accepted === true ? feedWithFireMarker(feed, d, nowMs) : feed;
    case "visionCaptured":
      return feedWithVisionMarker(feed, d, nowMs);
    case "selfFire":
      return d && d.fired
        ? feedWithSelfFireMarker(feed, d, nowMs)
        : feedWithGhost(feed, selfFireGhostLabel(d), nowMs);
    case "chatDiagnostic":
      return feedWithGhost(feed, chatDiagnosticGhostLabel(d), nowMs);
    default:
      // state / soul / usage / chatStatus はタイムライン行を作らない（app.mjs が別状態へ反映）。
      return feed;
  }
}
