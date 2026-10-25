// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  emptyGlance,
  glanceFromHistory,
  glanceAfterSseEvent,
  conversationRowsView,
  commentRowsView,
  judgmentChipText,
  skippedJudgmentText,
  causeKindText,
  commentReactText,
  CONVO_KEEP,
  COMMENTS_KEEP,
  STREAMER_LABEL
} from "./glance-timeline.mjs";

// 横目で見る操縦席の会話とコメント（cockpit-glance-redesign.md §3・§8・§9 / データの形 cockpit-glance-data-contract.md）。
// 時刻はローカル成分から作る（format-time.test.mjs の流儀・TZ 非依存）。
const T0 = new Date(2026, 9, 17, 21, 34, 11).getTime();

/** SSE を順に流す。 @param {Array<[string, any]>} events */
function run(events, g = emptyGlance()) {
  for (const [name, d] of events) g = glanceAfterSseEvent(g, name, d, T0);
  return g;
}

const you = (seq, text) => ["transcript", { seq, speaker: "you", text, appendedAtMs: T0 }];
const soul = (seq, fireId, text) => ["transcript", { seq, speaker: "soul", text, appendedAtMs: T0, fireId }];
const viewer = (seq, name, text, commentId) => ["transcript", { seq, speaker: "viewer", displayName: name, text, appendedAtMs: T0, commentId }];

test("転写: 配信者と相方は会話・視聴者はコメント（会話に混ぜない）・話者欠落は配信者", () => {
  const g = run([you(1, "宝箱あったわ"), viewer(2, "moco", "その先に宝箱ありそう！", "c1"), soul(3, 1, "奥の壁際だね。"), ["transcript", { seq: 4, text: "speaker 欠落", appendedAtMs: T0 }]]);
  assert.deepEqual(g.convo.map((r) => [r.kind, r.seq, r.text]), [
    ["you", 1, "宝箱あったわ"],
    ["soul", 3, "奥の壁際だね。"],
    ["you", 4, "speaker 欠落"]
  ]);
  assert.equal(g.convo[1].fireId, 1);
  assert.deepEqual(g.comments.map((c) => [c.kind, c.displayName, c.text, c.commentId]), [["comment", "moco", "その先に宝箱ありそう！", "c1"]]);
  const rows = conversationRowsView(g, { soulName: "チャッピー" });
  assert.deepEqual(rows.map((r) => r.whoText), [STREAMER_LABEL, "チャッピー", STREAMER_LABEL]);
  assert.equal(rows[0].timeText, "21:34:11");
});

test("判定の札: action が fire の判定だけ、triggerSeq の配信者の行に付く（after-busy も同じ seq）", () => {
  const g = run([
    you(1, "宝箱あったわ"),
    you(2, "これどう思う？"),
    you(3, "いまの無し"),
    ["selfFire", { kind: "speak-now-judgment", choice: "initiate", probability: 0.512, action: "fire", trigger: "transcript", triggerSeq: 1 }],
    ["selfFire", { kind: "speak-now-judgment", choice: "respond", probability: 0.72, action: "fire", trigger: "after-busy", triggerSeq: 2 }],
    ["selfFire", { kind: "speak-now-judgment", choice: "respond", probability: 0.6, action: "drop-busy", trigger: "transcript", triggerSeq: 3 }],
    ["selfFire", { kind: "speak-now-judgment", choice: "respond", probability: 0.6, action: "drop-inactive", trigger: "transcript", triggerSeq: 3 }],
    ["selfFire", { kind: "speak-now-judgment", error: "タイムアウト", triggerSeq: 3 }]
  ]);
  const rows = conversationRowsView(g);
  assert.deepEqual(rows.map((r) => r.chipText), ["自発 0.51", "応答 0.72", null]);
  // 捨てた判定は行を足さない。
  assert.equal(rows.length, 3);
});

test("相槌の間隔で流れた判定（skip-interval）だけ薄い 1 行「(相槌したかった 0.41 · 間隔)」", () => {
  const g = run([
    you(1, "右に足跡がある気がする。"),
    ["selfFire", { kind: "speak-now-judgment", choice: "backchannel", probability: 0.41, action: "skip-interval", trigger: "transcript", triggerSeq: 1 }]
  ]);
  const rows = conversationRowsView(g);
  assert.deepEqual(rows.map((r) => [r.kind, r.text, r.timeText, r.whoText]), [
    ["you", "右に足跡がある気がする。", "21:34:11", STREAMER_LABEL],
    ["note", "(相槌したかった 0.41 · 間隔)", "", ""]
  ]);
  assert.equal(skippedJudgmentText("backchannel", null), "(相槌したかった ? · 間隔)");
});

test("コメント反応: 受理の cause.commentIds でチャッピーの行に「💬 名前 に反応」・右列の該当コメントに印", () => {
  const g = run([
    viewer(1, "かなた", "右のルートに足跡あるね", "c1"),
    viewer(2, "moco", "その先に宝箱ありそう！", "c2"),
    ["fire", { accepted: true, fireId: 7, cause: { type: "comment-react", commentIds: ["c2"], commentSeqs: [2], probabilities: [0.9], judgeLatencyMs: 300 } }],
    soul(3, 7, "宝箱につながってるかも。")
  ]);
  const rows = conversationRowsView(g);
  assert.equal(rows[0].reactText, "💬 moco に反応");
  assert.equal(rows[0].kindText, null);
  const comments = commentRowsView(g);
  assert.deepEqual(comments.map((c) => [c.nameText, c.reacted]), [["moco", true], ["かなた", false]], "新しいものが上");
  // 複数・名前が引けない。
  assert.equal(commentReactText(["c2", "c1"], g.comments), "💬 moco ほか 1 に反応");
  assert.equal(commentReactText(["zz"], g.comments), "💬 コメントに反応");
});

test("コメント反応: 受理の fire を取り逃しても、発火結果（selfFire comment-react の fireId + commentIds）で結べる", () => {
  const g = run([
    viewer(1, "moco", "その先に宝箱ありそう！", "c2"),
    ["selfFire", { kind: "comment-react", fired: true, reason: null, commentIds: ["c2"], fireId: 9 }],
    soul(2, 9, "宝箱につながってるかも。")
  ]);
  assert.equal(conversationRowsView(g)[0].reactText, "💬 moco に反応");
  assert.equal(commentRowsView(g)[0].reacted, true);
});

test("きっかけの行が無い発火はチャッピーの行に小さく種類（手動・沈黙など）・speak-now はきっかけの行が無いときだけ", () => {
  const g = run([
    ["fire", { accepted: true, fireId: 1, cause: { type: "manual", vision: false } }],
    soul(1, 1, "a"),
    ["fire", { accepted: true, fireId: 2, cause: { type: "manual", vision: true } }],
    soul(2, 2, "b"),
    ["fire", { accepted: true, fireId: 3, cause: { type: "silence" } }],
    soul(3, 3, "c"),
    you(4, "これどう思う？"),
    ["fire", { accepted: true, fireId: 4, cause: { type: "speak-now", choice: "respond", probability: 0.72, triggerSeq: 4 } }],
    soul(5, 4, "d"),
    ["fire", { accepted: true, fireId: 5, cause: { type: "speak-now", choice: "initiate", probability: 0.5, triggerSeq: 999 } }],
    soul(6, 5, "e"),
    soul(7, null, "fireId の無い行（履歴など）")
  ]);
  assert.deepEqual(conversationRowsView(g).filter((r) => r.kind === "soul").map((r) => r.kindText), [
    "手動", "手動·画面", "沈黙", null, "自発 0.50", null
  ]);
  assert.equal(causeKindText({ type: "turn-end" }), "区切り");
  assert.equal(causeKindText({ type: "comment-call" }), "コメント呼びかけ");
  assert.equal(causeKindText({ type: "unknown" }), null);
  assert.equal(causeKindText(null), null);
});

test("推論の範囲: 最新の fireAsk の windowFirstSeq〜windowLastSeq だけ（間の薄い行も範囲・始まりと終わりの印）", () => {
  const g = run([
    you(1, "a"),
    you(2, "b"),
    ["fireAsk", { fireId: 1, windowFirstSeq: 1, windowLastSeq: 1, includedCount: 1, vision: false, atMs: T0 }],
    you(3, "c"),
    ["selfFire", { kind: "speak-now-judgment", choice: "backchannel", probability: 0.41, action: "skip-interval", triggerSeq: 3 }],
    you(4, "d"),
    you(5, "e"),
    ["fireAsk", { fireId: 2, windowFirstSeq: 2, windowLastSeq: 4, includedCount: 3, vision: false, atMs: T0 }]
  ]);
  const rows = conversationRowsView(g);
  assert.deepEqual(rows.map((r) => r.inRange), [false, true, true, true, true, false]);
  assert.deepEqual(rows.map((r) => r.rangeStart), [false, true, false, false, false, false]);
  assert.deepEqual(rows.map((r) => r.rangeEnd), [false, false, false, false, true, false]);
  // 範囲に入る行が手元に無い（古くて落ちた等）なら範囲は出さない。
  const none = glanceAfterSseEvent(g, "fireAsk", { fireId: 3, windowFirstSeq: 100, windowLastSeq: 120 }, T0);
  assert.ok(conversationRowsView(none).every((r) => !r.inRange));
  // 形の崩れた fireAsk は無視。
  assert.equal(glanceAfterSseEvent(g, "fireAsk", { fireId: 3, windowFirstSeq: null, windowLastSeq: 4 }, T0), g);
});

test("遅延: fireId で返事の行に結ぶ（latency が先に届いても後に届いても同じ）・latencyView が無ければ出さない", () => {
  const rec = { fireId: 3, spoken: true, segments: { llmFirstMs: 500 }, otherMs: 100, totalMs: 600, level: "ok" };
  const view = (/** @type {any} */ r) => ({ total: r.totalMs });
  const before = run([["latency", rec], soul(1, 3, "a")]);
  const after = run([soul(1, 3, "a"), ["latency", rec]]);
  assert.deepEqual(conversationRowsView(before, { latencyView: view })[0].latency, { total: 600 });
  assert.deepEqual(conversationRowsView(after, { latencyView: view })[0].latency, { total: 600 });
  assert.equal(conversationRowsView(after)[0].latency, null);
});

test("最新の返事の行を強調し、そのきっかけ（speak-now の triggerSeq）の配信者の行を同じ色でつなぐ", () => {
  const g = run([
    you(1, "a"),
    ["fire", { accepted: true, fireId: 1, cause: { type: "silence" } }],
    soul(2, 1, "b"),
    you(3, "c"),
    ["fire", { accepted: true, fireId: 2, cause: { type: "speak-now", choice: "respond", probability: 0.7, triggerSeq: 3 } }],
    soul(4, 2, "d"),
    you(5, "e")
  ]);
  const rows = conversationRowsView(g);
  assert.deepEqual(rows.map((r) => r.latest), [false, false, false, true, false]);
  assert.deepEqual(rows.map((r) => r.linked), [false, false, true, false, false]);
});

test("弾いたコメント: 種類だけの行（本文・名前なし）・新しいものが上", () => {
  const g = run([
    viewer(1, "はる", "右ルート気になる！", "c1"),
    ["chatDiagnostic", { kind: "commentRejected", commentId: "c2", reject: "harassment", atMs: T0 }],
    ["chatDiagnostic", { kind: "commentRejected", commentId: "c3", reject: "error", error: "タイムアウト" }],
    ["chatDiagnostic", { kind: "notLive", message: "x" }]
  ]);
  assert.deepEqual(commentRowsView(g).map((c) => [c.kind, c.rejectText, c.text, c.nameText]), [
    ["rejected", "弾いた: 判定できず", "", ""],
    ["rejected", "弾いた: 誹謗中傷", "", ""],
    ["comment", null, "右ルート気になる！", "はる"]
  ]);
});

test("関係の無い SSE は同じ状態を返す・履歴は会話とコメントに分ける（範囲と遅延は復元しない）", () => {
  const g = emptyGlance();
  for (const name of ["state", "vad", "expression", "discard", "diagnostic", "soul", "visionCaptured", "usage", "chatStatus", "quota", "warnings"]) {
    assert.equal(glanceAfterSseEvent(g, name, { anything: 1 }, T0), g, name);
  }
  assert.equal(glanceAfterSseEvent(g, "fire", { accepted: false, reason: "busy" }, T0), g);
  assert.equal(glanceAfterSseEvent(g, "latency", { totalMs: 1 }, T0), g, "fireId の無い latency は無視");
  const h = glanceFromHistory([
    { seq: 1, speaker: "you", text: "a", appendedAtMs: T0 },
    { seq: 2, speaker: "viewer", displayName: "moco", text: "b", appendedAtMs: T0 },
    { seq: 3, speaker: "soul", text: "c", appendedAtMs: T0 }
  ], T0);
  assert.deepEqual(h.convo.map((r) => [r.kind, r.fireId]), [["you", null], ["soul", null]]);
  assert.equal(h.comments.length, 1);
  assert.equal(h.window, null);
  assert.deepEqual(glanceFromHistory(undefined, T0), emptyGlance());
});

test("持つ件数には上限がある（会話・コメント）・行の key は一意", () => {
  let g = emptyGlance();
  for (let i = 1; i <= CONVO_KEEP + 5; i++) g = glanceAfterSseEvent(g, "transcript", { seq: i, speaker: "you", text: "x" + i }, T0);
  for (let i = 1; i <= COMMENTS_KEEP + 5; i++) g = glanceAfterSseEvent(g, "transcript", { seq: 1000 + i, speaker: "viewer", text: "y" + i }, T0);
  assert.equal(g.convo.length, CONVO_KEEP);
  assert.equal(g.convo[0].text, "x6");
  assert.equal(g.comments.length, COMMENTS_KEEP);
  const keys = [...conversationRowsView(g).map((r) => r.key), ...commentRowsView(g).map((r) => r.key)];
  assert.equal(new Set(keys).size, keys.length);
});

test("judgmentChipText: 選択の表示名 + 確率 2 桁・欠落は ?", () => {
  assert.equal(judgmentChipText("respond", 0.7249), "応答 0.72");
  assert.equal(judgmentChipText("backchannel", 0.44), "相槌 0.44");
  assert.equal(judgmentChipText("look", 0.58), "画面を見る 0.58");
  assert.equal(judgmentChipText(null, null), "? ?");
});

test("画面を見る（look）の発火: きっかけの行があればその行に札、無ければチャッピーの行に「画面を見る 0.58」", () => {
  const g = run([
    you(1, "チャッピー、画面見て。"),
    ["selfFire", { kind: "speak-now-judgment", choice: "look", probability: 0.58, action: "fire", trigger: "transcript", triggerSeq: 1 }],
    ["fire", { accepted: true, fireId: 1, cause: { type: "speak-now", choice: "look", probability: 0.58, triggerSeq: 1 } }],
    soul(2, 1, "a"),
    ["fire", { accepted: true, fireId: 2, cause: { type: "speak-now", choice: "look", probability: 0.58, triggerSeq: 999 } }],
    soul(3, 2, "b")
  ]);
  const rows = conversationRowsView(g);
  assert.equal(rows[0].chipText, "画面を見る 0.58");
  assert.deepEqual(rows.filter((r) => r.kind === "soul").map((r) => r.kindText), [null, "画面を見る 0.58"]);
});
