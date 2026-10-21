// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { emptyFeed, feedAfterSseEvent } from "./ui/rows.mjs";
import { recallStepText, RECALL_STEP_LABELS } from "./view-logic/markers.mjs";
import { causeKindText } from "./view-logic/glance-timeline.mjs";
import { SSE_EVENT_NAMES } from "./ui/app.mjs";

// 操縦席のログのタブの思い出しの行（記憶の作り直し Wave 3 Domain D）。新しい SSE は足さず selfFire に相乗りする。

const T0 = new Date(2026, 9, 21, 20, 1, 2).getTime();

test("recallStepText: 思い出し中 / 思い出した / 見つからなかった / 避けた を頼みごとつきで 1 行に", () => {
  assert.equal(recallStepText({ phase: "started", request: "エルデンリング 前回どこまで" }), "思い出し中: 「エルデンリング 前回どこまで」");
  assert.equal(recallStepText({ phase: "found", request: "前回" }), "思い出した: 「前回」");
  assert.equal(recallStepText({ phase: "not-found", request: "前回" }), "見つからなかった: 「前回」");
  assert.equal(recallStepText({ phase: "avoided", request: "前回" }), "避けた: 「前回」");
  assert.equal(recallStepText({ phase: "found", request: "前回", judgeFailed: true }), "思い出した: 「前回」（判定エラー）");
  assert.equal(recallStepText({ phase: "mystery" }), "mystery");
  for (const phase of ["started", "queued", "dropped", "found", "not-found", "avoided", "deferred", "failed"]) {
    assert.equal(typeof /** @type {any} */ (RECALL_STEP_LABELS)[phase], "string", phase);
  }
});

test("feedAfterSseEvent: selfFire kind:recall-step は思い出しの行・思い出させた発火（kind:recall）は従来の自発マーカー", () => {
  let feed = feedAfterSseEvent(emptyFeed(), "selfFire", { kind: "recall-step", phase: "started", request: "前回", atMs: T0 }, T0);
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "recall-step", phase: "found", request: "前回", atMs: T0 }, T0);
  feed = feedAfterSseEvent(feed, "selfFire", { kind: "recall", fired: true, reason: null, fireId: 4 }, T0);
  assert.deepEqual(
    feed.rows.map((r) => [r.kind, r.whoText, r.text]),
    [
      ["recall-marker", "recall", "思い出し中: 「前回」"],
      ["recall-marker", "recall", "思い出した: 「前回」"],
      ["self-fire-marker", "self", "self-fire (recall)"]
    ]
  );
  assert.equal(SSE_EVENT_NAMES.includes("recall"), false, "新しい SSE は足さない");
});

test("会話の行: 思い出しの発火のきっかけは「思い出し」", () => {
  assert.equal(causeKindText({ type: "recall", found: true }), "思い出し");
});

test("recallStepText（Wave 3 仕上げ）: 自発 OFF で黙って渡した・④の失敗を見つからなかったとして届けた、を見分ける", () => {
  assert.equal(recallStepText({ phase: "found", request: "前回", silent: true }), "思い出した（黙って渡した）: 「前回」");
  assert.equal(recallStepText({ phase: "not-found", request: "前回", silent: true }), "見つからなかった（黙って渡した）: 「前回」");
  assert.equal(recallStepText({ phase: "not-found", request: "前回", failed: true }), "見つからなかった（失敗）: 「前回」");
  assert.equal(
    recallStepText({ phase: "not-found", request: "前回", failed: true, silent: true }),
    "見つからなかった（失敗・黙って渡した）: 「前回」"
  );
  assert.equal(recallStepText({ phase: "failed", request: "前回", failed: true }), "思い出せなかった（失敗）: 「前回」", "失敗の時点の行はそのまま");
  assert.equal(
    recallStepText({ phase: "found", request: "前回", silent: true, judgeFailed: true }),
    "思い出した（黙って渡した）: 「前回」（判定エラー）"
  );
  const feed = feedAfterSseEvent(emptyFeed(), "selfFire", { kind: "recall-step", phase: "found", request: "前回", silent: true, atMs: T0 }, T0);
  assert.equal(feed.rows.at(-1).kind, "recall-marker");
  assert.equal(feed.rows.at(-1).text, "思い出した（黙って渡した）: 「前回」");
});
