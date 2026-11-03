// @ts-check
/**
 * Discord モード Domain M: 判定の札を同じ場の中だけで結ぶ（gate-3-stale-judgment-chip.md §5）。
 * 正本の seq は場を開くたびに 0 から数え直す。画面の「会話」の欄（glance-timeline）は同じ起動の間、前の場の行を残すので、
 * seq での結び付け（判定の札・推論の範囲・きっかけの行）は今の場の行だけにする。合図は SSE state の stream（phase "opening"）。
 * 1 つの場の中の結び付けは今と同じ（glance-timeline.test.mjs・glance-discord-g.test.mjs が変わらずに通る）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  conversationRowsView,
  commentRowsView,
  emptyGlance,
  glanceAfterSseEvent,
  glanceAfterVenueStatus,
  glanceFromHistory,
  isNewVenue,
  venueMarkOf
} from "./glance-timeline.mjs";

const T0 = new Date(2026, 10, 3, 9, 15, 54).getTime();
const OPEN_1 = T0 - 3_600_000;
const OPEN_2 = T0 - 300_000;

/** SSE を順に流す。 @param {Array<[string, any]>} events */
function run(events, g = emptyGlance()) {
  for (const [name, d] of events) g = glanceAfterSseEvent(g, name, d, T0);
  return g;
}

/** SSE state（snapshot のうち stream だけを持たせる・ほかのキーは glance に関係しない）。 */
const state = (/** @type {string} */ phase, /** @type {number | null} */ openedAtMs = null, extra = {}) =>
  /** @type {[string, any]} */ (["state", { ears: "listening", stream: { phase, error: null, openedAtMs, experience: "discord", connection: null, vcName: null, ...extra } }]);
const you = (/** @type {number} */ seq, /** @type {string} */ text) =>
  /** @type {[string, any]} */ (["transcript", { seq, speaker: "you", text, appendedAtMs: T0 }]);
const soul = (/** @type {number} */ seq, /** @type {number | null} */ fireId, /** @type {string} */ text) =>
  /** @type {[string, any]} */ (["transcript", { seq, speaker: "soul", text, appendedAtMs: T0, fireId }]);
const judged = (/** @type {number} */ seq, /** @type {string} */ choice, /** @type {number} */ probability, action = "fire") =>
  /** @type {[string, any]} */ (["selfFire", { kind: "speak-now-judgment", choice, probability, action, trigger: "transcript", triggerSeq: seq }]);
const accepted = (/** @type {number} */ fireId, /** @type {any} */ cause) => /** @type {[string, any]} */ (["fire", { accepted: true, fireId, cause }]);
const ask = (/** @type {number} */ fireId, /** @type {number} */ first, /** @type {number} */ last) =>
  /** @type {[string, any]} */ (["fireAsk", { fireId, windowFirstSeq: first, windowLastSeq: last, includedCount: last - first + 1, vision: false, atMs: T0 }]);

/** 1 回目の場（ゲート 3 の 08:29 の通話の終わり）: seq 23〜25、seq 24 が「応答 0.34」で発火して返事。 */
const FIRST_VENUE = [
  state("opening"),
  state("open", OPEN_1),
  you(23, "前の通話の 23"),
  you(24, "前の通話の 24"),
  judged(24, "respond", 0.34),
  accepted(1, { type: "speak-now", choice: "respond", probability: 0.34, triggerSeq: 24 }),
  ask(1, 23, 24),
  soul(25, 1, "前の通話の返事"),
  ["latency", { fireId: 1, spoken: true, segments: { llmFirstMs: 500 }, otherMs: 100, totalMs: 600, level: "ok" }]
];

/** 閉じて、同じ起動のまま開き直す（seq は 0 から数え直し）。 */
const REOPEN = [state("closing", OPEN_1), state("closed", null), state("opening"), state("open", OPEN_2)];

test("ゲート 3 の再現: 開き直したあと、同じ seq の新しい判定が「待つ」（札を覚えない）でも前の場の「応答 0.34」が出ない", () => {
  const before = run(FIRST_VENUE);
  assert.equal(conversationRowsView(before)[1].chipText, "応答 0.34", "1 つの場の中では今まで通り札が付く");
  const g = run([...REOPEN, you(23, "新しい通話の 23"), you(24, "新しい通話の 24"), judged(24, "wait", 0.62, "none")], before);
  const rows = conversationRowsView(g);
  const fresh = rows.find((r) => r.text === "新しい通話の 24");
  assert.ok(fresh);
  assert.equal(fresh.chipText, null, "新しい場の seq 24 に前の場の札が出ない");
  assert.ok(rows.every((r) => r.chipText !== "応答 0.34"), "前の場の札の覚えは捨てた");
  // 前の場の行は残す（行そのものは消さない）。
  assert.deepEqual(rows.map((r) => r.text), [
    "前の通話の 23", "前の通話の 24", "前の通話の返事", "新しい通話の 23", "新しい通話の 24"
  ]);
  assert.deepEqual(g.judgments, {});
});

test("前の場の行に新しい場の札が付かない（新しい場の札は新しい場の同じ seq の行だけ）", () => {
  const g = run([...FIRST_VENUE, ...REOPEN, you(23, "新 23"), you(24, "新 24"), judged(24, "initiate", 0.55), judged(23, "backchannel", 0.47)]);
  const rows = conversationRowsView(g);
  assert.deepEqual(rows.map((r) => [r.text, r.chipText]), [
    ["前の通話の 23", null],
    ["前の通話の 24", null],
    ["前の通話の返事", null],
    ["新 23", "相槌 0.47"],
    ["新 24", "自発 0.55"]
  ]);
});

test("推論の範囲: 開き直したら前の場の範囲を捨てる・新しい場の範囲は前の場の同じ seq の行に付かない", () => {
  const reopened = run([...FIRST_VENUE, ...REOPEN]);
  assert.equal(reopened.window, null, "前の場の範囲は捨てた");
  assert.ok(conversationRowsView(reopened).every((r) => !r.inRange));
  const g = run([
    you(23, "新 23"),
    ["selfFire", { kind: "speak-now-judgment", choice: "backchannel", probability: 0.41, action: "skip-interval", triggerSeq: 23 }],
    you(24, "新 24"),
    you(25, "新 25"),
    ask(2, 23, 24)
  ], reopened);
  const rows = conversationRowsView(g);
  assert.deepEqual(rows.map((r) => [r.kind, r.inRange, r.rangeStart, r.rangeEnd]), [
    ["you", false, false, false], //  前の 23
    ["you", false, false, false], //  前の 24
    ["soul", false, false, false], // 前の 25
    ["you", true, true, false], //    新 23
    ["note", true, false, false], //  間の薄い行
    ["you", true, false, true], //    新 24
    ["you", false, false, false] //   新 25
  ]);
});

test("きっかけの結び付け: 前の場の返事の speak-now は前の場の seq なので、今の場の行とつながず、返事の行に小さく出す", () => {
  // 開き直した直後（新しい場の返事がまだ無い）: 最新の返事は前の場の行。そのきっかけ seq 24 を新しい場の seq 24 とつながない。
  const g = run([...FIRST_VENUE, ...REOPEN, you(24, "新 24")]);
  const rows = conversationRowsView(g, { latencyView: (rec) => ({ total: rec.totalMs }) });
  assert.deepEqual(rows.map((r) => r.linked), [false, false, false, false], "前の場の行とも新しい場の行ともつながない");
  const oldSoul = rows[2];
  assert.equal(oldSoul.latest, true, "最新の返事の強調は今まで通り");
  assert.equal(oldSoul.kindText, "応答 0.34", "前の場の札の覚えは捨てたので、fireId で結ぶきっかけを返事の行に出す");
  assert.deepEqual(oldSoul.latency, { total: 600 }, "遅延は fireId で結ぶのでそのまま");

  // 新しい場の返事: きっかけ seq 3 の行は新しい場の seq 3（前の場に seq 3 があっても、そちらとはつながない）。
  const h = run([
    ...REOPEN,
    you(3, "新 3"),
    judged(3, "respond", 0.7),
    accepted(2, { type: "speak-now", choice: "respond", probability: 0.7, triggerSeq: 3 }),
    soul(4, 2, "新しい返事")
  ], run([state("opening"), state("open", OPEN_1), you(3, "前 3"), soul(4, null, "前の返事")]));
  const hr = conversationRowsView(h);
  assert.deepEqual(hr.map((r) => [r.text, r.linked, r.chipText, r.kindText]), [
    ["前 3", false, null, null],
    ["前の返事", false, null, null],
    ["新 3", true, "応答 0.70", null],
    ["新しい返事", false, null, null]
  ]);

  // 新しい場の返事のきっかけ seq が、前の場の行にしか無い（新しい場の行が手元に無い）なら、返事の行に小さく出す。
  const k = run([
    ...REOPEN,
    accepted(3, { type: "speak-now", choice: "initiate", probability: 0.5, triggerSeq: 23 }),
    soul(0, 3, "新しい返事")
  ], run(FIRST_VENUE));
  const kr = conversationRowsView(k);
  assert.equal(kr[3].kindText, "自発 0.50");
  assert.ok(kr.every((r) => !r.linked));
});

test("fireId で結ぶもの（きっかけ・遅延・コメント反応）は場をまたいでもそのまま（鍵の扱いは変えない）", () => {
  const g = run([
    state("opening"),
    state("open", OPEN_1, { experience: "stream" }),
    ["transcript", { seq: 1, speaker: "viewer", displayName: "moco", text: "宝箱ありそう！", appendedAtMs: T0, commentId: "c1" }],
    accepted(5, { type: "comment-react", commentIds: ["c1"] }),
    soul(2, 5, "宝箱につながってるかも。"),
    accepted(6, { type: "manual", vision: false }),
    soul(3, 6, "手動の返事"),
    ...REOPEN
  ]);
  assert.ok("5" in g.causes && "6" in g.causes);
  const rows = conversationRowsView(g);
  assert.equal(rows[0].reactText, "💬 moco に反応");
  assert.equal(rows[1].kindText, "手動");
  assert.equal(commentRowsView(g)[0].reacted, true);
});

test("1 つの場の中は今と同じ: state を挟まない並びと、開いたあと同じ並びを流した結果の表示が同じ", () => {
  const body = FIRST_VENUE.slice(2);
  const opts = { soulName: "チャッピー", latencyView: (/** @type {any} */ rec) => ({ total: rec.totalMs }) };
  const plain = conversationRowsView(run(body), opts);
  const opened = conversationRowsView(run(FIRST_VENUE), opts);
  assert.deepEqual(opened, plain);
  // 場が閉じても（新しい場が開くまで）前の場の札と範囲はそのまま（行は seq で結んだまま）。
  const closed = conversationRowsView(run([...FIRST_VENUE, state("closing", OPEN_1), state("closed", null)]), opts);
  assert.deepEqual(closed, plain);
});

test("配信の場でも同じ（同じ起動で配信を 2 回開いたとき）", () => {
  const s = (/** @type {string} */ phase, /** @type {number | null} */ at = null) => state(phase, at, { experience: phase === "closed" ? null : "stream" });
  const g = run([
    s("opening"), s("open", OPEN_1),
    you(0, "配信 1 の 0"), judged(0, "respond", 0.8),
    s("closing", OPEN_1), s("closed"),
    s("opening"), s("open", OPEN_2),
    you(0, "配信 2 の 0"), judged(0, "wait", 0.9, "none")
  ]);
  assert.deepEqual(conversationRowsView(g).map((r) => [r.text, r.chipText]), [["配信 1 の 0", null], ["配信 2 の 0", null]]);
});

test("合図: phase \"opening\" で新しい場（opening → open・open → closing → closed は同じ場）・取り逃したら open の違いで控える", () => {
  const m = (/** @type {string} */ phase, /** @type {number | null} */ at = null) => ({ phase, openedAtMs: at });
  assert.equal(isNewVenue(null, m("opening")), true);
  assert.equal(isNewVenue(null, m("open", OPEN_1)), false, "途中から見始めただけ");
  assert.equal(isNewVenue(null, m("closed")), false);
  assert.equal(isNewVenue(m("closed"), m("opening")), true);
  assert.equal(isNewVenue(m("opening"), m("opening")), false);
  assert.equal(isNewVenue(m("opening"), m("open", OPEN_1)), false);
  assert.equal(isNewVenue(m("open", OPEN_1), m("open", OPEN_1)), false);
  assert.equal(isNewVenue(m("open", OPEN_1), m("closing", OPEN_1)), false);
  assert.equal(isNewVenue(m("closing", OPEN_1), m("closed")), false);
  // 始められなかった（opening → closed）あとに開き直す。
  assert.equal(isNewVenue(m("closed"), m("opening")), true);
  // opening を取り逃した控え。
  assert.equal(isNewVenue(m("closed"), m("open", OPEN_2)), true);
  assert.equal(isNewVenue(m("closing", OPEN_1), m("open", OPEN_2)), true);
  assert.equal(isNewVenue(m("open", OPEN_1), m("open", OPEN_2)), true);
  assert.equal(isNewVenue(m("open", OPEN_1), m("opening")), true);
  // venueMarkOf: 形が違えば null（古いサーバ・stream が null）。
  assert.equal(venueMarkOf(null), null);
  assert.equal(venueMarkOf({ phase: 1 }), null);
  assert.deepEqual(venueMarkOf({ phase: "open", openedAtMs: OPEN_1, experience: "discord", vcName: "雑談" }), m("open", OPEN_1));
  assert.deepEqual(venueMarkOf({ phase: "opening", openedAtMs: "x" }), m("opening"));
});

test("場の状態が変わらない state（接続・VC の名前だけの変化・stream の無い snapshot）は同じ状態を返す・場の番号は開くたびに 1 つ", () => {
  const g = run([state("opening"), state("open", OPEN_1), you(1, "a"), judged(1, "respond", 0.6)]);
  assert.equal(g.venue, 1);
  assert.equal(glanceAfterSseEvent(g, "state", { stream: { phase: "open", openedAtMs: OPEN_1, connection: "outside", vcName: null } }, T0), g, "VC を抜けても場は同じ");
  assert.equal(glanceAfterSseEvent(g, "state", { stream: { phase: "open", openedAtMs: OPEN_1, connection: "joined", vcName: "別の VC" } }, T0), g, "VC を移っても場は同じ");
  assert.equal(glanceAfterSseEvent(g, "state", { ears: "listening" }, T0), g, "stream の無い snapshot");
  assert.equal(glanceAfterSseEvent(g, "state", null, T0), g);
  assert.equal(glanceAfterVenueStatus(g, null), g);
  assert.equal(conversationRowsView(g)[0].chipText, "応答 0.60");
  // 閉じる・閉じたは印だけ替える（札は残す）。
  const closed = run([state("closing", OPEN_1), state("closed")], g);
  assert.equal(closed.venue, 1);
  assert.deepEqual(closed.venueMark, { phase: "closed", openedAtMs: null });
  assert.equal(closed.judgments, g.judgments);
  const reopened = run([state("opening"), state("open", OPEN_2)], closed);
  assert.equal(reopened.venue, 2);
  assert.deepEqual(reopened.venueMark, { phase: "open", openedAtMs: OPEN_2 });
});

test("開き直し（snapshot の履歴から作る glanceFromHistory）でも崩れない: 履歴の行は今の場・そのあと新しい場が開けば前の場になる", () => {
  const history = [
    { seq: 0, speaker: "you", text: "履歴 0", appendedAtMs: T0 },
    { seq: 1, speaker: "soul", text: "履歴 1", appendedAtMs: T0 },
    { seq: 2, speaker: "you", text: "履歴 2", appendedAtMs: T0 }
  ];
  const stream = { phase: "open", error: null, openedAtMs: OPEN_1, experience: "discord", connection: "joined", vcName: "雑談" };
  const h = glanceFromHistory(history, T0, stream);
  assert.deepEqual(h.venueMark, { phase: "open", openedAtMs: OPEN_1 });
  // 同じ場の SSE が続けば、履歴の行に札と範囲が付く（今まで通り）。
  const same = run([state("open", OPEN_1), judged(2, "respond", 0.66), ask(1, 0, 2)], h);
  assert.equal(same.venue, h.venue, "同じ場の state では進まない");
  const sameRows = conversationRowsView(same);
  assert.equal(sameRows[2].chipText, "応答 0.66");
  assert.deepEqual(sameRows.map((r) => r.inRange), [true, true, true]);
  // そのあと閉じて開き直したら、履歴の行は前の場の行（新しい場の同じ seq の札・範囲が付かない）。
  const next = run([state("closing", OPEN_1), state("closed"), state("opening"), you(2, "新 2"), judged(2, "initiate", 0.5), ask(2, 0, 2), state("open", OPEN_2)], same);
  assert.deepEqual(conversationRowsView(next).map((r) => [r.text, r.chipText, r.inRange]), [
    ["履歴 0", null, false],
    ["履歴 1", null, false],
    ["履歴 2", null, false],
    ["新 2", "自発 0.50", true]
  ]);
  // stream を渡さない（古い呼び方）・閉じている間の snapshot（履歴は空）。
  assert.deepEqual(glanceFromHistory(history, T0).venueMark, null);
  const closedStart = glanceFromHistory([], T0, { phase: "closed", openedAtMs: null });
  assert.deepEqual(closedStart.venueMark, { phase: "closed", openedAtMs: null });
  assert.equal(run([state("opening")], closedStart).venue, closedStart.venue + 1);
});

test("履歴を作ったあと、opening を取り逃して別の場の open が届いても控えで新しい場とみなす", () => {
  const h = glanceFromHistory([{ seq: 5, speaker: "you", text: "前 5", appendedAtMs: T0 }], T0, { phase: "open", openedAtMs: OPEN_1 });
  const g = run([state("open", OPEN_2), you(5, "新 5"), judged(5, "respond", 0.9)], h);
  assert.deepEqual(conversationRowsView(g).map((r) => [r.text, r.chipText]), [["前 5", null], ["新 5", "応答 0.90"]]);
});

test("App の結線: SSE はそのまま glanceAfterSseEvent（state も通る）・初期化は snapshot の stream を glanceFromHistory に渡す", () => {
  const app = readFileSync(new URL("../ui/app.mjs", import.meta.url), "utf8");
  assert.match(app, /setGlance\(\(g\) => glanceAfterSseEvent\(g, name, d, nowMs\)\)/);
  assert.match(app, /setGlance\(glanceFromHistory\(s\.transcripts \|\| \[\], now\(\), s\.stream\)\)/);
  // state は SSE の購読に入っている（glance にも流れる）。
  assert.match(app, /"state", \/\/ +snapshot の適用/);
});

// ── 追補（レビューの止めない指摘: テストの抜け） ───────────────────────────────────

test("追補 1: 読み込み時の snapshot が開きかけ（phase \"opening\"）でも、そのあとの open で札・範囲が今の場の行に結ばれる", () => {
  // 開きかけの間に積まれた行（コメントや早めの発言）は新しい場の行。履歴に入って届く。
  const history = [
    { seq: 0, speaker: "you", text: "開きかけの 0", appendedAtMs: T0 },
    { seq: 1, speaker: "you", text: "開きかけの 1", appendedAtMs: T0 }
  ];
  const h = glanceFromHistory(history, T0, { phase: "opening", error: null, openedAtMs: null, experience: "discord" });
  assert.deepEqual(h.venueMark, { phase: "opening", openedAtMs: null });
  // 購読の直後にサーバが配る state（まだ開きかけ）→ 開き終えた state → 判定と範囲。
  const g = run([state("opening"), state("open", OPEN_2), judged(1, "respond", 0.71), ask(1, 0, 1), you(2, "開いたあとの 2")], h);
  assert.equal(g.venue, h.venue, "開きかけ → 開いたは同じ場（場の番号は進まない）");
  assert.equal(glanceAfterSseEvent(h, "state", state("opening")[1], T0), h, "購読直後の同じ state は同一の状態");
  assert.deepEqual(conversationRowsView(g).map((r) => [r.text, r.chipText, r.inRange]), [
    ["開きかけの 0", null, true],
    ["開きかけの 1", "応答 0.71", true],
    ["開いたあとの 2", null, false]
  ]);
});

test("追補 2: 始められなかった場をはさむ（opening → closed → opening → open）でも、前の場の札・範囲が出ず、新しい場で正しく結ぶ", () => {
  const g = run([
    ...FIRST_VENUE,
    state("closing", OPEN_1),
    state("closed"),
    // 2 回目: 開きかけで始められなかった（その間に 1 行積まれた）。
    state("opening"),
    you(0, "始められなかった場の 0"),
    judged(0, "initiate", 0.66),
    ["state", { stream: { phase: "closed", error: "Discord の VC に入れない", openedAtMs: null, experience: null } }],
    // 3 回目: 開き直して開けた。
    state("opening"),
    state("open", OPEN_2),
    you(0, "3 回目の 0"),
    you(24, "3 回目の 24"),
    judged(24, "wait", 0.62, "none"),
    judged(0, "respond", 0.58)
  ]);
  assert.equal(g.venue, 3, "開き始めるたびに 1 つ（始められなかった場も 1 つの場）");
  const rows = conversationRowsView(g);
  assert.deepEqual(rows.map((r) => [r.text, r.chipText, r.inRange]), [
    ["前の通話の 23", null, false],
    ["前の通話の 24", null, false],
    ["前の通話の返事", null, false],
    ["始められなかった場の 0", null, false],
    ["3 回目の 0", "応答 0.58", false],
    ["3 回目の 24", null, false]
  ]);
  // 3 回目の場の範囲は 3 回目の行だけ。
  const ranged = conversationRowsView(run([ask(9, 0, 24)], g));
  assert.deepEqual(ranged.map((r) => r.inRange), [false, false, false, false, true, true]);
  // 3 回目の返事は 3 回目のきっかけの行とだけつながる（始められなかった場の seq 0 とはつながない）。
  const linked = conversationRowsView(run([
    accepted(10, { type: "speak-now", choice: "respond", probability: 0.58, triggerSeq: 0 }),
    soul(25, 10, "3 回目の返事")
  ], g));
  assert.deepEqual(linked.map((r) => r.linked), [false, false, false, false, true, false, false]);
  assert.equal(linked[6].kindText, null, "きっかけの行（3 回目の seq 0）が手元にあるので返事の行には出さない");
});

test("追補 3: App の SSE の口と同じ形（SSE_EVENT_NAMES の名前だけ・JSON の data・更新関数）で state が glance に渡り、場が切り替わる", async () => {
  // App 本体（preact の hooks・EventSource・fetch）は DOM の無い node:test では描けない（既存のテストも App を描かない）ので、
  // App の useEffect の購読と初期化と同じ手順を写した小さな再生器で確かめる（手順そのものはソースの照合で固定する）。
  const { SSE_EVENT_NAMES } = await import("../ui/app.mjs");
  assert.ok(SSE_EVENT_NAMES.includes("state"), "state は購読する名前に入っている");
  const app = readFileSync(new URL("../ui/app.mjs", import.meta.url), "utf8");
  assert.match(app, /for \(const name of SSE_EVENT_NAMES\) \{\s*source\.addEventListener\(name,/);
  assert.match(app, /const d = JSON\.parse\(ev\.data\);/);

  /** App の再生器: 初期化（GET /api/state → glanceFromHistory）→ 購読（名前ごとに更新関数で glanceAfterSseEvent）。 */
  function appLike(/** @type {any} */ snapshot) {
    let glance = emptyGlance();
    const setGlance = (/** @type {any} */ next) => (glance = typeof next === "function" ? next(glance) : next);
    setGlance(glanceFromHistory(snapshot.transcripts || [], T0, snapshot.stream));
    /** @type {Map<string, (ev: { data: string }) => void>} */
    const listeners = new Map();
    for (const name of SSE_EVENT_NAMES) {
      listeners.set(name, (ev) => {
        const d = JSON.parse(ev.data);
        const nowMs = T0;
        setGlance((/** @type {any} */ g) => glanceAfterSseEvent(g, name, d, nowMs));
      });
    }
    return {
      emit: (/** @type {string} */ name, /** @type {any} */ d) => listeners.get(name)?.({ data: JSON.stringify(d) }),
      get glance() {
        return glance;
      }
    };
  }

  const openSnapshot = (/** @type {number} */ at) => ({ ears: "listening", transcripts: [], stream: { phase: "open", error: null, openedAtMs: at, experience: "discord" } });
  const session = appLike({ ...openSnapshot(OPEN_1), transcripts: [{ seq: 24, speaker: "you", text: "前の 24", appendedAtMs: T0 }] });
  session.emit("state", openSnapshot(OPEN_1)); // 購読直後の state（同じ場）
  session.emit("selfFire", { kind: "speak-now-judgment", choice: "respond", probability: 0.34, action: "fire", triggerSeq: 24 });
  assert.equal(conversationRowsView(session.glance)[0].chipText, "応答 0.34");
  session.emit("state", { ...openSnapshot(OPEN_1), stream: { phase: "closing", openedAtMs: OPEN_1 } });
  session.emit("state", { ...openSnapshot(OPEN_1), stream: { phase: "closed", openedAtMs: null } });
  session.emit("state", { ...openSnapshot(OPEN_1), stream: { phase: "opening", openedAtMs: null } });
  assert.equal(session.glance.venue, 1, "state で場が切り替わる");
  session.emit("state", openSnapshot(OPEN_2));
  session.emit("transcript", { seq: 24, speaker: "you", text: "新の 24", appendedAtMs: T0 });
  session.emit("selfFire", { kind: "speak-now-judgment", choice: "wait", probability: 0.62, action: "none", triggerSeq: 24 });
  assert.deepEqual(conversationRowsView(session.glance).map((r) => [r.text, r.chipText]), [["前の 24", null], ["新の 24", null]]);
});
