// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { emptyFeed, feedAfterSseEvent } from "./ui/rows.mjs";
import { CommentBusySelect, COMMENT_BUSY_OPTIONS } from "./ui/control-bar.mjs";
import { SSE_EVENT_NAMES, settingsFromSnapshot } from "./ui/app.mjs";
import { commentJudgmentText, COMMENT_REACT_CHOICE_LABELS } from "./view-logic/markers.mjs";
import {
  commentRejectedGhostLabel,
  commentJudgmentErrorGhostLabel,
  chatDiagnosticGhostLabel,
  COMMENT_GUARD_KIND_LABELS
} from "./view-logic/ghost.mjs";
import { commentBusyPostErrorText, commentBusyRequestErrorText } from "./view-logic/control.mjs";
import { COMMENT_REACT_CHOICE_LABELS as MIND_REACT_LABELS } from "../mind/comment-react.mjs";
import { COMMENT_GUARD_KIND_LABELS as MIND_GUARD_LABELS } from "../mind/comment-guard.mjs";

// 操縦席 UI のコメント判定部分（コメント反応の合意 §3: 弾いた行・反応の判定行・判定エラー / §2: 忙しい間の
// コメントの切替）。画面の作り直しはせず、今の画面に最低限の行と切替だけを足す。

const T0 = Date.UTC(2026, 9, 16, 3, 4, 5);

/** vnode を平坦化して要素を集める（関数コンポーネントは展開）。 */
function collectElements(node, out = []) {
  if (node == null || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const c of node) collectElements(c, out);
    return out;
  }
  if (typeof node.type === "function") return collectElements(node.type(node.props), out);
  if (node.type) out.push(node);
  return collectElements(node.props && node.props.children, out);
}

/** vnode 内のテキストを集める。 */
function collectText(node, out = []) {
  if (node == null || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const c of node) collectText(c, out);
    return out;
  }
  if (typeof node.type === "function") return collectText(node.type(node.props), out);
  return collectText(node.props && node.props.children, out);
}

test("表示名は mind 側と同じ（UI は mind を import しないので写しを持つ）", () => {
  assert.deepEqual({ ...COMMENT_REACT_CHOICE_LABELS }, { ...MIND_REACT_LABELS });
  assert.deepEqual({ ...COMMENT_GUARD_KIND_LABELS }, { ...MIND_GUARD_LABELS });
});

test("commentJudgmentText: 「コメント判定: 反応 0.92」・欠落は ?", () => {
  assert.equal(commentJudgmentText({ choice: "react", probability: 0.923 }), "コメント判定: 反応 0.92");
  assert.equal(commentJudgmentText({ choice: "react", probability: null }), "コメント判定: 反応 ?");
});

test("弾いた行・判定エラーのラベル", () => {
  assert.equal(commentRejectedGhostLabel({ reject: "hijack" }), "(弾いた: 乗っ取り)");
  assert.equal(commentRejectedGhostLabel({ reject: "harassment" }), "(弾いた: 誹謗中傷)");
  assert.equal(commentRejectedGhostLabel({ reject: "spam" }), "(弾いた: 荒らし)");
  assert.equal(commentRejectedGhostLabel({ reject: "error", error: "タイムアウト（5 秒）" }), "(弾いた: 判定できず — タイムアウト（5 秒）)");
  assert.equal(commentRejectedGhostLabel({}), "(弾いた: 判定できず)");
  assert.equal(chatDiagnosticGhostLabel({ kind: "commentRejected", reject: "spam" }), "(弾いた: 荒らし)");
  assert.equal(chatDiagnosticGhostLabel({ kind: "connected" }), null, "観測補助は従来どおり非表示");
  assert.equal(commentJudgmentErrorGhostLabel({ error: "キーが見つからない" }), "(コメント判定エラー: キーが見つからない)");
});

test("feedAfterSseEvent: 弾いた行（chatDiagnostic）・反応の判定行 / 判定エラー（selfFire 相乗り）・発火結果は自発マーカー", () => {
  let feed = feedAfterSseEvent(emptyFeed(), "chatDiagnostic", { kind: "commentRejected", reject: "hijack", commentId: "m1" }, T0);
  assert.equal(feed.rows[0].kind, "ghost");
  assert.equal(feed.rows[0].text, "(弾いた: 乗っ取り)");
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "comment-judgment", choice: "react", probability: 0.92, latencyMs: 240, commentId: "m2" }, T0);
  assert.equal(feed.rows[1].kind, "judgment-marker");
  assert.equal(feed.rows[1].text, "コメント判定: 反応 0.92");
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "comment-judgment", error: "タイムアウト（5 秒）", commentId: "m3" }, T0);
  assert.equal(feed.rows[2].kind, "ghost");
  assert.equal(feed.rows[2].text, "(コメント判定エラー: タイムアウト（5 秒）)");
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "comment-react", fired: true, reason: null, commentIds: ["m2"] }, T0);
  assert.equal(feed.rows[3].kind, "self-fire-marker");
  assert.equal(feed.rows[3].text, "self-fire (comment-react)");
  // speak-now の判定行は従来どおり。
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "speak-now-judgment", choice: "respond", probability: 0.8 }, T0);
  assert.equal(feed.rows[4].text, "判定: 応答 0.80");
});

test("SSE は増やさない（13 本のまま）・settingsFromSnapshot は commentBusy を取り出す", () => {
  assert.equal(SSE_EVENT_NAMES.length, 13);
  assert.equal(settingsFromSnapshot({ commentBusy: "drop" }).commentBusy, "drop");
  assert.equal(settingsFromSnapshot({}).commentBusy, null);
});

test("CommentBusySelect vnode: 「忙しい間のコメント: あとで拾う / 見逃す」・controlled・null は disable", () => {
  assert.deepEqual(COMMENT_BUSY_OPTIONS, [
    { value: "hold", label: "あとで拾う" },
    { value: "drop", label: "見逃す" }
  ]);
  let vnode = CommentBusySelect({ commentBusy: "drop", onChange: () => {} });
  let select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "drop");
  assert.equal(select.props.disabled, false);
  assert.ok(collectText(vnode).join("").includes("忙しい間のコメント"));
  vnode = CommentBusySelect({ commentBusy: null, onChange: () => {} });
  select = collectElements(vnode).find((n) => n.type === "select");
  assert.equal(select.props.value, "hold");
  assert.equal(select.props.disabled, true);
});

test("ControlBar: 話し始めの隣に忙しい間のコメントのプルダウン・POST /api/comment-busy・エラー文言", () => {
  const src = readFileSync(new URL("./ui/control-bar.mjs", import.meta.url), "utf8");
  const speakAt = src.indexOf("<${SpeakStartSelect}");
  const busyAt = src.indexOf("<${CommentBusySelect}");
  assert.ok(speakAt > 0 && busyAt > speakAt, "話し始めの直後");
  assert.ok(src.includes('doFetch("/api/comment-busy"'));
  assert.equal(commentBusyPostErrorText({ status: 503, ok: false, j: null }), "comment-busy control not available");
  assert.equal(commentBusyPostErrorText({ status: 400, ok: false, j: { error: "invalid comment-busy policy" } }), "set failed: invalid comment-busy policy");
  assert.equal(commentBusyPostErrorText({ status: 200, ok: true, j: {} }), null);
  assert.equal(commentBusyRequestErrorText(new Error("net")), "comment-busy error: Error: net");
});
