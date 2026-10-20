// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createCommentGuard,
  decideCommentGuard,
  commentGuardChoices,
  commentGuardInstructions,
  commentGuardHijackPredicate,
  COMMENT_JUDGE_TIMEOUT_MS
} from "./comment-guard.mjs";

// コメントの弾く判定（discussion/ai-cohost/decisions/comment-react/integration.md §1-3）の機械テスト。
// 判定エンジンは fake（実 Decisions API には繋がない）。

const choice = (c) => ({ type: "choice", choice: c, probs: { [c]: 0.9 } });
const pred = (p) => ({ type: "predicate", probability: p });
const refusal = () => ({ type: "refusal" });

test("decideCommentGuard: 4 択が問題なし以外は弾く（種類 = 選択）", () => {
  for (const c of ["hijack", "harassment", "spam"]) {
    const d = decideCommentGuard({ verdict: choice(c), hijack: pred(0.01) });
    assert.equal(d.pass, false, c);
    assert.equal(d.kind, c);
  }
});

test("decideCommentGuard: 問題なしでも乗っ取り predicate ≥ 0.5 なら乗っ取りで弾く・< 0.5 なら通す", () => {
  assert.deepEqual(decideCommentGuard({ verdict: choice("ok"), hijack: pred(0.5) }), {
    pass: false,
    kind: "hijack",
    verdict: "ok",
    hijackProbability: 0.5
  });
  assert.deepEqual(decideCommentGuard({ verdict: choice("ok"), hijack: pred(0.49) }), {
    pass: true,
    kind: "ok",
    verdict: "ok",
    hijackProbability: 0.49
  });
});

test("decideCommentGuard: 4 択が判定拒否なら predicate だけで決める（< 0.5 なら通す）", () => {
  assert.equal(decideCommentGuard({ verdict: refusal(), hijack: pred(0.1) }).pass, true);
  assert.equal(decideCommentGuard({ verdict: refusal(), hijack: pred(0.1) }).verdict, "refusal");
  const r = decideCommentGuard({ verdict: refusal(), hijack: pred(0.8) });
  assert.equal(r.pass, false);
  assert.equal(r.kind, "hijack");
});

test("decideCommentGuard: 読めない答え（4 択欠落・predicate 欠落/拒否）は throw（呼び出し側が判定できずで弾く）", () => {
  assert.throws(() => decideCommentGuard({ hijack: pred(0.1) }), /想定外/);
  assert.throws(() => decideCommentGuard({ verdict: choice("ok") }), /想定外/);
  assert.throws(() => decideCommentGuard({ verdict: choice("ok"), hijack: refusal() }), /想定外/);
  assert.throws(() => decideCommentGuard({ verdict: refusal(), hijack: refusal() }), /想定外/);
});

test("createCommentGuard: 4 択 + 乗っ取り predicate を 1 リクエストで聞く・入力は本文だけ・名前は今の頭", async () => {
  /** @type {any[]} */
  const calls = [];
  const guard = createCommentGuard({
    judgeQuestions: async (req) => {
      calls.push(req);
      return { answers: { verdict: choice("ok"), hijack: pred(0.02) }, latencyMs: 210 };
    }
  });
  const d = await guard({ text: "こんばんは", name: "コーディ" });
  assert.deepEqual(d, { pass: true, kind: "ok", verdict: "ok", hijackProbability: 0.02, latencyMs: 210 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "こんばんは");
  assert.equal(calls[0].questions.length, 2);
  const [q4, qp] = calls[0].questions;
  assert.equal(q4.type, "choice");
  assert.equal(q4.name, "verdict");
  assert.equal(q4.instructions, commentGuardInstructions("コーディ"));
  assert.match(q4.instructions, /AI Tuber「コーディ」/);
  assert.deepEqual(q4.choices.map((c) => c.value), ["ok", "hijack", "harassment", "spam"]);
  assert.match(q4.choices[1].description, /ignore previous instructions/, "乗っ取りの説明は具体化した版（v2）");
  assert.match(q4.choices[2].description, /配信者・コーディ・視聴者/);
  assert.deepEqual(qp, commentGuardHijackPredicate("コーディ"));
  assert.equal(qp.type, "predicate");
  assert.equal(qp.name, "hijack");
  assert.match(qp.instructions, /AI\(コーディ\)/);
  assert.deepEqual(commentGuardChoices("チャッピー").map((c) => c.value), ["ok", "hijack", "harassment", "spam"]);
});

test("createCommentGuard: 判定の失敗・読めない答えは throw せず kind:error で弾く（理由つき・遅延が分かれば載せる）", async () => {
  const failing = createCommentGuard({
    judgeQuestions: async () => {
      throw Object.assign(new Error("タイムアウト（5 秒）"), { latencyMs: 5000 });
    }
  });
  assert.deepEqual(await failing({ text: "x", name: "チャッピー" }), {
    pass: false,
    kind: "error",
    verdict: null,
    hijackProbability: null,
    latencyMs: 5000,
    error: "タイムアウト（5 秒）"
  });
  const malformed = createCommentGuard({ judgeQuestions: async () => ({ answers: { verdict: choice("ok") }, latencyMs: 90 }) });
  const d = await malformed({ text: "x", name: "チャッピー" });
  assert.equal(d.pass, false);
  assert.equal(d.kind, "error");
  assert.equal(d.latencyMs, 90);
  assert.match(String(d.error), /想定外/);
});

test("createCommentGuard: 既定エンジンはキーが無ければ通信せずに kind:error（タイムアウトは 5 秒）", async () => {
  assert.equal(COMMENT_JUDGE_TIMEOUT_MS, 5000);
  const realFetch = globalThis.fetch;
  let fetched = 0;
  globalThis.fetch = /** @type {any} */ (async () => {
    fetched += 1;
    throw new Error("must not fetch");
  });
  try {
    const guard = createCommentGuard({ apiKeyProvider: () => ({ ok: false, reason: "キーが見つからない（テスト）" }) });
    const d = await guard({ text: "こんにちは", name: "チャッピー" });
    assert.equal(d.pass, false);
    assert.equal(d.kind, "error");
    assert.equal(d.error, "キーが見つからない（テスト）");
    assert.equal(fetched, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

