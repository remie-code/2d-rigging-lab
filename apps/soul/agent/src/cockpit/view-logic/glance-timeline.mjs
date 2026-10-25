// @ts-check
/**
 * view-logic: 横目で見る操縦席の「会話」と「コメント」の状態と表示導出（preact 非依存の純関数）。
 *
 * 合意: discussion/ai-cohost/implementation/screens/cockpit-glance-redesign.md §3・§7〜§9 と
 * cockpit-glance-data-contract.md（1 回目で画面まで届いたデータの形）。
 *
 * 状態（GlanceState）は SSE と snapshot の履歴から**イベントごとに immutable に作り直す**（rows.mjs の feed と同じ流儀）。
 * 表示に必要な結び付け（判定の札・推論の範囲・遅延・コメント反応）は、状態には生の材料だけを持ち、
 * conversationRowsView / commentRowsView が描く直前に結ぶ（届く順番が前後しても結果が同じになるように）。
 *
 * 結び付け（データの形 §4）:
 *  - 判定の札: speak-now の判定（selfFire kind:"speak-now-judgment"）のうち **action が "fire"** のものだけを、
 *    triggerSeq の配信者の行に付ける（after-busy も同じ seq の行）。
 *  - 相槌の間隔で流れた判定（action "skip-interval"）だけ、会話に薄い 1 行を足す。そのほかの捨てた判定は出さない。
 *  - 発火ごとの情報は fireId で結ぶ: 受理（fire の cause）→ fireAsk（推論の範囲）→ soul の行 → latency。
 *  - コメント反応: cause.type "comment-react" の commentIds で、チャッピーの行に「💬 名前 に反応」、右列の該当
 *    コメントに「反応」の印。
 *  - きっかけの行が無い発火（手動・沈黙など）は、チャッピーの行に小さく種類。
 *  - 推論の範囲は最新の 1 回分（fireAsk の windowFirstSeq〜windowLastSeq）だけ。開き直しても復元しない。
 *
 * 会話とコメントの列は入る分だけ最新を表示する（あふれた古い行は画面側で切る）。状態は上限件数だけ持つ
 * （全履歴はログのタブの観測フィードが持つ）。
 */

import { formatClock } from "./format-time.mjs";
import { SPEAK_NOW_CHOICE_LABELS } from "./markers.mjs";
import { COMMENT_GUARD_KIND_LABELS } from "./ghost.mjs";

/** 会話の行を持つ上限（画面に入るのは数十行・余裕を持たせる）。 */
export const CONVO_KEEP = 300;
/** コメントを持つ上限。 */
export const COMMENTS_KEEP = 200;
/** fireId / seq / commentId で引く材料を持つ上限。 */
export const LINK_KEEP = 300;

/** 会話の話者ラベル（配信者）。チャッピー側は頭の表示名（identity）を使う。 */
export const STREAMER_LABEL = "配信者";

/**
 * きっかけの行が無い発火の種類の表示名（チャッピーの行に小さく出す・§9.2）。
 * speak-now（判定の札は配信者の行）と comment-react（「💬 名前 に反応」）はここに無い。
 */
export const CAUSE_KIND_LABELS = Object.freeze({
  manual: "手動",
  silence: "沈黙",
  call: "呼びかけ",
  "turn-end": "区切り",
  interjection: "合いの手",
  comment: "コメント",
  "comment-call": "コメント呼びかけ",
  // 記憶の作り直し Wave 3: 思い出した結果（見つかった / 見つからなかった）を①に言わせた発火。
  recall: "思い出し"
});

/**
 * @typedef {{ id: number; kind: "you" | "soul" | "note"; seq: number | null; fireId: number | null; atMs: number;
 *   text: string; choice?: string | null; probability?: number | null }} ConvoRow
 * @typedef {{ id: number; kind: "comment" | "rejected"; commentId: string | null; displayName: string | null;
 *   text: string; reject: string | null; atMs: number }} CommentRow
 * @typedef {{
 *   convo: ConvoRow[];
 *   comments: CommentRow[];
 *   judgments: Record<string, { choice: string | null; probability: number | null }>;
 *   causes: Record<string, any>;
 *   latencies: Record<string, any>;
 *   reacted: Record<string, true>;
 *   window: { fireId: number | null; firstSeq: number; lastSeq: number } | null;
 *   nextId: number;
 * }} GlanceState
 */

/** 空の状態。 @returns {GlanceState} */
export function emptyGlance() {
  return { convo: [], comments: [], judgments: {}, causes: {}, latencies: {}, reacted: {}, window: null, nextId: 1 };
}

/** @param {unknown} v @returns {v is number} */
function isNum(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * 上限を超えた古い材料を落とした写し（object のキーは整数なら昇順・文字列なら追加順に並ぶ＝先頭が古い）。
 * @template T
 * @param {Record<string, T>} map  @param {string} key  @param {T} value
 * @returns {Record<string, T>}
 */
function withLink(map, key, value) {
  const next = { ...map, [key]: value };
  const keys = Object.keys(next);
  if (keys.length > LINK_KEEP) {
    for (const k of keys.slice(0, keys.length - LINK_KEEP)) delete next[k];
  }
  return next;
}

/**
 * @template T
 * @param {T[]} list  @param {T} item  @param {number} keep
 */
function appendCapped(list, item, keep) {
  const next = [...list, item];
  return next.length > keep ? next.slice(next.length - keep) : next;
}

/**
 * 転写（SSE transcript / snapshot の履歴の 1 件）を会話かコメントへ積む。
 * 配信者（you・speaker 欠落）とチャッピー（soul）は会話、視聴者（viewer）はコメント（会話には混ぜない）。
 * @param {GlanceState} g  @param {any} d  @param {number} nowMs
 * @returns {GlanceState}
 */
export function glanceWithTranscript(g, d, nowMs) {
  if (!d || typeof d.text !== "string") return g;
  const speaker = d.speaker || "you";
  const atMs = isNum(d.appendedAtMs) && d.appendedAtMs > 0 ? d.appendedAtMs : nowMs;
  if (speaker === "viewer") {
    /** @type {CommentRow} */
    const row = {
      id: g.nextId,
      kind: "comment",
      commentId: typeof d.commentId === "string" ? d.commentId : null,
      displayName: typeof d.displayName === "string" && d.displayName ? d.displayName : null,
      text: d.text,
      reject: null,
      atMs
    };
    return { ...g, comments: appendCapped(g.comments, row, COMMENTS_KEEP), nextId: g.nextId + 1 };
  }
  if (speaker !== "you" && speaker !== "soul") return g;
  /** @type {ConvoRow} */
  const row = {
    id: g.nextId,
    kind: speaker,
    seq: isNum(d.seq) ? d.seq : null,
    fireId: speaker === "soul" && isNum(d.fireId) ? d.fireId : null,
    atMs,
    text: d.text
  };
  return { ...g, convo: appendCapped(g.convo, row, CONVO_KEEP), nextId: g.nextId + 1 };
}

/**
 * 弾いたコメント（SSE chatDiagnostic kind:"commentRejected"・本文と名前は来ない）をコメントの列へ積む。
 * @param {GlanceState} g  @param {any} d  @param {number} nowMs
 * @returns {GlanceState}
 */
export function glanceWithRejectedComment(g, d, nowMs) {
  /** @type {CommentRow} */
  const row = {
    id: g.nextId,
    kind: "rejected",
    commentId: d && typeof d.commentId === "string" ? d.commentId : null,
    displayName: null,
    text: "",
    reject: (d && typeof d.reject === "string" && d.reject) || "error",
    atMs: d && isNum(d.atMs) ? d.atMs : nowMs
  };
  return { ...g, comments: appendCapped(g.comments, row, COMMENTS_KEEP), nextId: g.nextId + 1 };
}

/**
 * 受理した発火のきっかけを fireId で覚える（コメント反応なら該当コメントに印）。
 * @param {GlanceState} g  @param {number} fireId  @param {any} cause
 * @returns {GlanceState}
 */
function glanceWithCause(g, fireId, cause) {
  let next = { ...g, causes: withLink(g.causes, String(fireId), cause ?? null) };
  if (cause && cause.type === "comment-react" && Array.isArray(cause.commentIds)) {
    let reacted = next.reacted;
    for (const id of cause.commentIds) if (typeof id === "string") reacted = withLink(reacted, id, /** @type {true} */ (true));
    next = { ...next, reacted };
  }
  return next;
}

/**
 * snapshot の履歴（GET /api/state の transcripts）から作る（開き直し・推論の範囲と遅延は復元しない）。
 * @param {any[] | null | undefined} transcripts  @param {number} nowMs
 * @returns {GlanceState}
 */
export function glanceFromHistory(transcripts, nowMs) {
  let g = emptyGlance();
  for (const entry of transcripts || []) g = glanceWithTranscript(g, entry, nowMs);
  return g;
}

/**
 * SSE イベント → 状態遷移の単一経路（関係の無いイベントは同一の状態を返す）。
 * @param {GlanceState} g  @param {string} eventName  @param {any} d  @param {number} nowMs
 * @returns {GlanceState}
 */
export function glanceAfterSseEvent(g, eventName, d, nowMs) {
  switch (eventName) {
    case "transcript":
      return glanceWithTranscript(g, d, nowMs);
    case "chatDiagnostic":
      return d && d.kind === "commentRejected" ? glanceWithRejectedComment(g, d, nowMs) : g;
    case "fire":
      if (!d || d.accepted !== true || !isNum(d.fireId)) return g;
      return glanceWithCause(g, d.fireId, d.cause ?? null);
    case "selfFire": {
      if (!d) return g;
      if (d.kind === "speak-now-judgment") {
        if (d.error != null) return g;
        if (d.action === "fire" && isNum(d.triggerSeq)) {
          const j = { choice: d.choice ?? null, probability: isNum(d.probability) ? d.probability : null };
          return { ...g, judgments: withLink(g.judgments, String(d.triggerSeq), j) };
        }
        if (d.action === "skip-interval") {
          /** @type {ConvoRow} */
          const row = {
            id: g.nextId,
            kind: "note",
            seq: null,
            fireId: null,
            atMs: nowMs,
            text: "",
            choice: d.choice ?? null,
            probability: isNum(d.probability) ? d.probability : null
          };
          return { ...g, convo: appendCapped(g.convo, row, CONVO_KEEP), nextId: g.nextId + 1 };
        }
        return g; // そのほかの捨てた判定（drop-busy / drop-inactive）はまだ出さない（§9.2）。
      }
      // 発火の結果（受理されたときだけ fireId）。受理の fire で cause を覚え損ねていたときの控え。
      if (d.fired === true && isNum(d.fireId) && !(String(d.fireId) in g.causes)) {
        const cause = Array.isArray(d.commentIds)
          ? { type: "comment-react", commentIds: d.commentIds }
          : typeof d.kind === "string" ? { type: d.kind } : null;
        return glanceWithCause(g, d.fireId, cause);
      }
      return g;
    }
    case "fireAsk":
      if (!d || !isNum(d.windowFirstSeq) || !isNum(d.windowLastSeq)) return g;
      return { ...g, window: { fireId: isNum(d.fireId) ? d.fireId : null, firstSeq: d.windowFirstSeq, lastSeq: d.windowLastSeq } };
    case "latency":
      if (!d || !isNum(d.fireId)) return g;
      return { ...g, latencies: withLink(g.latencies, String(d.fireId), d) };
    default:
      return g;
  }
}

// ── 表示導出 ────────────────────────────────────────────────────────────

/**
 * 確率の表示（小数 2 桁・無ければ "?"）。
 * @param {number | null | undefined} p
 */
export function probabilityText(p) {
  return isNum(p) ? p.toFixed(2) : "?";
}

/**
 * speak-now の選択の札の文字（"応答 0.72"）。
 * @param {string | null | undefined} choice  @param {number | null | undefined} probability
 */
export function judgmentChipText(choice, probability) {
  const label = (choice && /** @type {Record<string, string>} */ (SPEAK_NOW_CHOICE_LABELS)[choice]) || choice || "?";
  return label + " " + probabilityText(probability);
}

/**
 * 相槌の間隔で流れた判定の薄い 1 行（"(相槌したかった 0.41 · 間隔)"）。
 * @param {string | null | undefined} choice  @param {number | null | undefined} probability
 */
export function skippedJudgmentText(choice, probability) {
  const label = (choice && /** @type {Record<string, string>} */ (SPEAK_NOW_CHOICE_LABELS)[choice]) || choice || "?";
  return "(" + label + "したかった " + probabilityText(probability) + " · 間隔)";
}

/**
 * きっかけの行が無い発火の種類（チャッピーの行に小さく）。speak-now・comment-react・不明は null。
 * @param {any} cause
 * @returns {string | null}
 */
export function causeKindText(cause) {
  if (!cause || typeof cause.type !== "string") return null;
  const label = /** @type {Record<string, string>} */ (CAUSE_KIND_LABELS)[cause.type];
  if (!label) return null;
  return cause.type === "manual" && cause.vision === true ? "手動·画面" : label;
}

/**
 * コメント反応の札（"💬 moco に反応"・複数なら "💬 moco ほか 1 に反応"・名前が引けなければ "💬 コメントに反応"）。
 * @param {string[]} commentIds  @param {CommentRow[]} comments
 */
export function commentReactText(commentIds, comments) {
  const names = [];
  for (const id of commentIds) {
    const c = comments.find((row) => row.commentId === id && row.kind === "comment");
    if (c && c.displayName) names.push(c.displayName);
  }
  if (names.length === 0) return "💬 コメントに反応";
  const rest = commentIds.length - 1;
  return "💬 " + names[0] + (rest > 0 ? " ほか " + rest : "") + " に反応";
}

/**
 * 会話の行の表示（描くだけの形）。
 * @typedef {{
 *   key: number;
 *   kind: "you" | "soul" | "note";
 *   timeText: string;
 *   whoText: string;
 *   text: string;
 *   chipText: string | null;
 *   reactText: string | null;
 *   kindText: string | null;
 *   latency: any | null;
 *   inRange: boolean;
 *   rangeStart: boolean;
 *   rangeEnd: boolean;
 *   latest: boolean;
 *   linked: boolean;
 * }} ConvoRowView
 */

/**
 * 会話の列の表示行（古い順。画面は下に寄せて、入らない古い行を上で切る）。
 * @param {GlanceState} g
 * @param {{ soulName?: string; latencyView?: (rec: any) => any }} [options]
 *   soulName: チャッピーの行の話者名。latencyView: 遅延のレコード → 棒の表示（glance-meters.mjs の latencyBarView を
 *   閾値つきで渡す）。無ければ遅延は出さない。
 * @returns {ConvoRowView[]}
 */
export function conversationRowsView(g, options = {}) {
  const soulName = options.soulName || "soul";
  const seqs = new Set(g.convo.filter((r) => r.seq != null).map((r) => r.seq));

  // 推論の範囲（最新の 1 回分）: 範囲に入る最初と最後の行の位置。その間の行（判定の薄い行も）を範囲とする。
  let rangeFrom = -1;
  let rangeTo = -1;
  if (g.window) {
    const { firstSeq, lastSeq } = g.window;
    g.convo.forEach((r, i) => {
      if (r.seq != null && r.seq >= firstSeq && r.seq <= lastSeq) {
        if (rangeFrom < 0) rangeFrom = i;
        rangeTo = i;
      }
    });
  }

  // 最新の返事の行と、そのきっかけの配信者の行（同じ色で淡くつなぐ）。
  let latestIndex = -1;
  for (let i = g.convo.length - 1; i >= 0; i--) {
    if (g.convo[i].kind === "soul") {
      latestIndex = i;
      break;
    }
  }
  const latestCause = latestIndex >= 0 && g.convo[latestIndex].fireId != null
    ? g.causes[String(g.convo[latestIndex].fireId)]
    : null;
  const linkedSeq = latestCause && latestCause.type === "speak-now" && isNum(latestCause.triggerSeq) ? latestCause.triggerSeq : null;

  return g.convo.map((r, i) => {
    const inRange = rangeFrom >= 0 && i >= rangeFrom && i <= rangeTo;
    /** @type {ConvoRowView} */
    const view = {
      key: r.id,
      kind: r.kind,
      timeText: r.kind === "note" ? "" : formatClock(r.atMs),
      whoText: r.kind === "you" ? STREAMER_LABEL : r.kind === "soul" ? soulName : "",
      text: r.text,
      chipText: null,
      reactText: null,
      kindText: null,
      latency: null,
      inRange,
      rangeStart: inRange && i === rangeFrom,
      rangeEnd: inRange && i === rangeTo,
      latest: i === latestIndex,
      linked: linkedSeq != null && r.kind === "you" && r.seq === linkedSeq
    };
    if (r.kind === "note") {
      view.text = skippedJudgmentText(r.choice, r.probability);
      return view;
    }
    if (r.kind === "you") {
      const j = r.seq != null ? g.judgments[String(r.seq)] : null;
      if (j) view.chipText = judgmentChipText(j.choice, j.probability);
      return view;
    }
    // soul: きっかけ（fireId で結ぶ）と遅延。
    const cause = r.fireId != null ? g.causes[String(r.fireId)] : null;
    if (cause && cause.type === "comment-react" && Array.isArray(cause.commentIds)) {
      view.reactText = commentReactText(cause.commentIds, g.comments);
    } else if (cause && cause.type === "speak-now") {
      // 札はきっかけの配信者の行に付く。きっかけの行が手元に無いときだけ、こちらに小さく出す。
      if (!(isNum(cause.triggerSeq) && seqs.has(cause.triggerSeq))) {
        view.kindText = judgmentChipText(cause.choice, cause.probability);
      }
    } else {
      view.kindText = causeKindText(cause);
    }
    const rec = r.fireId != null ? g.latencies[String(r.fireId)] : null;
    if (rec && typeof options.latencyView === "function") view.latency = options.latencyView(rec);
    return view;
  });
}

/**
 * コメントの列の表示行（新しいものが上）。
 * @typedef {{ key: number; kind: "comment" | "rejected"; nameText: string; text: string; reacted: boolean;
 *   rejectText: string | null }} CommentRowView
 * @param {GlanceState} g
 * @returns {CommentRowView[]}
 */
export function commentRowsView(g) {
  const out = [];
  for (let i = g.comments.length - 1; i >= 0; i--) {
    const c = g.comments[i];
    if (c.kind === "rejected") {
      const kind = c.reject || "error";
      const label = /** @type {Record<string, string>} */ (COMMENT_GUARD_KIND_LABELS)[kind] ?? kind;
      out.push({ key: c.id, kind: c.kind, nameText: "", text: "", reacted: false, rejectText: "弾いた: " + label });
      continue;
    }
    out.push({
      key: c.id,
      kind: c.kind,
      nameText: c.displayName || "視聴者",
      text: c.text,
      reacted: c.commentId != null && g.reacted[c.commentId] === true,
      rejectText: null
    });
  }
  return /** @type {CommentRowView[]} */ (out);
}
