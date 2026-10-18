// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createContextCompactor,
  decideCompaction,
  normalizeCompactThresholdTokens,
  DEFAULT_COMPACT_THRESHOLD_TOKENS,
  COMPACT_THRESHOLD_TOKENS_MIN,
  COMPACT_THRESHOLD_TOKENS_MAX,
  DEFAULT_COMPACT_QUIET_MS,
  DEFAULT_COMPACT_MIN_INTERVAL_MS,
  DEFAULT_COMPACT_CHECK_INTERVAL_MS
} from "./context-compactor.mjs";

// 隙間で手動の圧縮（context-growth-2026-10.md §6）。偽物の頭・偽物の時計・偽物のタイマで固定する（実 LLM なし）。

const quiet = () => ({ soulIdle: true, judging: false, userSpeaking: false, lastSpeechEndAtMs: null });

function makeHead(lastInputTokens = 210_000, modelContextWindow = 500_000, result = { compacted: true, durationMs: 1234, personaInjected: true, personaDeferred: false, compactionUsage: { last: { inputTokens: 710 } } }) {
  const head = {
    calls: 0,
    usage: /** @type {any} */ ({ lastInputTokens, modelContextWindow, totalInputTokens: 9000 }),
    /** @type {any} */
    result,
    /** @type {null | ((r: any) => void)} */
    release: null,
    hold: false,
    getContextUsage: () => head.usage,
    compact: () => {
      head.calls += 1;
      if (!head.hold) return Promise.resolve(head.result);
      return new Promise((resolve) => { head.release = resolve; });
    }
  };
  return head;
}

function makeTimers() {
  const timeouts = [];
  const intervals = [];
  return {
    timeouts,
    intervals,
    setTimeoutImpl: /** @type {any} */ ((fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; }),
    setIntervalImpl: /** @type {any} */ ((fn, ms) => { const h = { fn, ms, cleared: false, unref() {} }; intervals.push(h); return h; }),
    clearIntervalImpl: /** @type {any} */ ((h) => { h.cleared = true; })
  };
}

test("既定値: 目安 20 万トークン（設定の範囲 5 万〜45 万）・隙間 3 秒・間隔 10 分・数秒おき", () => {
  assert.equal(DEFAULT_COMPACT_THRESHOLD_TOKENS, 200_000);
  assert.equal(COMPACT_THRESHOLD_TOKENS_MIN, 50_000);
  assert.equal(COMPACT_THRESHOLD_TOKENS_MAX, 450_000);
  assert.equal(DEFAULT_COMPACT_QUIET_MS, 3000);
  assert.equal(DEFAULT_COMPACT_MIN_INTERVAL_MS, 600_000);
  assert.ok(DEFAULT_COMPACT_CHECK_INTERVAL_MS >= 1000 && DEFAULT_COMPACT_CHECK_INTERVAL_MS <= 10_000);
});

test("decideCompaction: 直近の入力トークンが目安の量を超え、隙間にいるときだけ ok（割合は参考で添える）", () => {
  const base = { nowMs: 100_000, lastAttemptAtMs: null, thresholdTokens: 200_000, quietMs: 3000, minIntervalMs: 600_000 };
  const usage = { lastInputTokens: 237_500, modelContextWindow: 475_000 };
  assert.deepEqual(decideCompaction({ ...base, usage, gap: quiet() }), { ok: true, inputTokens: 237_500, ratio: 0.5 });
  assert.deepEqual(
    decideCompaction({ ...base, usage: { lastInputTokens: 200_000, modelContextWindow: 475_000 }, gap: quiet() }),
    { ok: false, reason: "below-threshold", inputTokens: 200_000, ratio: 200_000 / 475_000 },
    "ちょうど目安は超えていない"
  );
  assert.equal(decideCompaction({ ...base, usage: { lastInputTokens: 200_001, modelContextWindow: 475_000 }, gap: quiet() }).ok, true);
  // 窓の大きさに依らない（窓が違う頭でも同じ量で判定する・窓が分からなくても量だけで判定できる）。
  assert.equal(decideCompaction({ ...base, usage: { lastInputTokens: 210_000, modelContextWindow: 1_000_000 }, gap: quiet() }).ok, true);
  assert.deepEqual(
    decideCompaction({ ...base, usage: { lastInputTokens: 210_000, modelContextWindow: null }, gap: quiet() }),
    { ok: true, inputTokens: 210_000, ratio: null }
  );
  assert.equal(decideCompaction({ ...base, usage: null, gap: quiet() }).reason, "no-usage");
  assert.equal(decideCompaction({ ...base, usage: { lastInputTokens: null, modelContextWindow: 475_000 }, gap: quiet() }).reason, "no-usage");
  assert.equal(decideCompaction({ ...base, usage, gap: { ...quiet(), soulIdle: false } }).reason, "soul-busy");
  assert.equal(decideCompaction({ ...base, usage, gap: { ...quiet(), judging: true } }).reason, "judging");
  assert.equal(decideCompaction({ ...base, usage, gap: { ...quiet(), userSpeaking: true } }).reason, "user-speaking");
  assert.equal(decideCompaction({ ...base, usage, gap: { ...quiet(), lastSpeechEndAtMs: 97_001 } }).reason, "user-recent", "喋り終わりから 3 秒未満");
  assert.equal(decideCompaction({ ...base, usage, gap: { ...quiet(), lastSpeechEndAtMs: 97_000 } }).ok, true, "ちょうど 3 秒は隙間");
  assert.equal(decideCompaction({ ...base, usage, gap: quiet(), lastAttemptAtMs: 100_000 - 599_999 }).reason, "too-soon");
  assert.equal(decideCompaction({ ...base, usage, gap: quiet(), lastAttemptAtMs: 100_000 - 600_000 }).ok, true);
  assert.equal(decideCompaction({ ...base, usage, gap: null }).reason, "no-gap-info");
});

test("compactor: 条件がそろうと compact を呼び、開始と終了を 1 回ずつ通知する（本文なし・数字だけ）", async () => {
  const head = makeHead();
  const events = [];
  let now = 1_000_000;
  const compactor = createContextCompactor({
    getSession: () => head,
    getQuietGap: quiet,
    onEvent: (e) => events.push(e),
    nowImpl: () => now
  });
  assert.deepEqual(await compactor.check(), { started: true });
  assert.equal(head.calls, 1);
  assert.deepEqual(events, [
    { type: "started", atMs: 1_000_000, lastInputTokens: 210_000, thresholdTokens: 200_000, ratio: 0.42, totalInputTokens: 9000, modelContextWindow: 500_000 },
    { type: "finished", atMs: 1_000_000, ok: true, durationMs: 1234, reason: null, message: null, personaInjected: true, personaDeferred: false, compactionInputTokens: 710 }
  ]);
  // 前の圧縮から 10 分経つまでは呼ばない。
  now += 599_000;
  assert.deepEqual(await compactor.check(), { started: false, reason: "too-soon" });
  now += 1_000;
  assert.deepEqual(await compactor.check(), { started: true });
  assert.equal(head.calls, 2);
  compactor.dispose();
});

test("compactor: しきい値（設定）より小さい・頭が無い（Claude）・隙間でないときは呼ばない", async () => {
  const head = makeHead(210_000, 500_000);
  /** @type {any} */
  let session = head;
  let gap = { ...quiet(), soulIdle: false };
  const compactor = createContextCompactor({ getSession: () => session, getQuietGap: () => gap, thresholdTokens: 300_000 });
  assert.equal(compactor.getThresholdTokens(), 300_000);
  assert.equal((await compactor.check()).reason, "below-threshold");
  head.usage = { lastInputTokens: 310_000, modelContextWindow: 500_000 };
  assert.equal((await compactor.check()).reason, "soul-busy");
  gap = quiet();
  session = null;
  assert.equal((await compactor.check()).reason, "no-session");
  session = { ask() {} };
  assert.equal((await compactor.check()).reason, "no-session", "compact を持たない頭");
  assert.equal(head.calls, 0);
  compactor.dispose();
});

test("compactor: 圧縮の最中は重ねて呼ばない・失敗も終了として通知し、10 分は再試行しない", async () => {
  const head = makeHead();
  head.hold = true;
  const events = [];
  let now = 0;
  const compactor = createContextCompactor({ getSession: () => head, getQuietGap: quiet, onEvent: (e) => events.push(e), nowImpl: () => now });
  const first = compactor.check();
  assert.equal(compactor.isRunning(), true);
  assert.deepEqual(await compactor.check(), { started: false, reason: "running" });
  /** @type {any} */ (head.release)({ compacted: false, reason: "failed", message: "compaction failed — x", durationMs: 50 });
  await first;
  assert.equal(compactor.isRunning(), false);
  assert.deepEqual(events.at(-1), {
    type: "finished", atMs: 0, ok: false, durationMs: 50, reason: "failed", message: "compaction failed — x",
    personaInjected: false, personaDeferred: false, compactionInputTokens: null
  });
  now = 60_000;
  assert.equal((await compactor.check()).reason, "too-soon", "失敗のあとも間隔を空ける");
  compactor.dispose();
});

test("compactor: 返事が終わるたび（次のタスクで）と数秒おきに確かめる・dispose で止まる", async () => {
  const head = makeHead();
  const timers = makeTimers();
  const compactor = createContextCompactor({
    getSession: () => head,
    getQuietGap: quiet,
    checkIntervalMs: 4000,
    ...timers
  });
  compactor.start();
  compactor.start();
  assert.equal(timers.intervals.length, 1, "start は冪等");
  assert.equal(timers.intervals[0].ms, 4000);
  compactor.noteReplyFinished();
  assert.equal(timers.timeouts.length, 1);
  assert.equal(timers.timeouts[0].ms, 0);
  assert.equal(head.calls, 0, "その場では確かめない（発火の後始末が先）");
  timers.timeouts[0].fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(head.calls, 1);
  compactor.dispose();
  assert.equal(timers.intervals[0].cleared, true);
  assert.deepEqual(await compactor.check(), { started: false, reason: "disposed" });
});

test("compactor: setThresholdTokens で走っている部品の目安を差し替える（次の確認から効く・正の数でなければ変えない）", async () => {
  const head = makeHead(210_000, 500_000);
  const events = [];
  const compactor = createContextCompactor({ getSession: () => head, getQuietGap: quiet, onEvent: (e) => events.push(e), thresholdTokens: 250_000 });
  assert.equal((await compactor.check()).reason, "below-threshold");
  assert.equal(compactor.setThresholdTokens(200_000), 200_000);
  assert.equal(compactor.getThresholdTokens(), 200_000);
  assert.deepEqual(await compactor.check(), { started: true }, "次の確認から新しい目安で判定する");
  assert.equal(events[0].thresholdTokens, 200_000, "開始の通知に、そのときの目安を載せる");
  assert.equal(compactor.setThresholdTokens(/** @type {any} */ (0)), 200_000);
  assert.equal(compactor.setThresholdTokens(/** @type {any} */ ("300000")), 200_000);
  assert.equal(compactor.setThresholdTokens(Number.NaN), 200_000);
  assert.equal(createContextCompactor({ getSession: () => null, getQuietGap: quiet }).getThresholdTokens(), DEFAULT_COMPACT_THRESHOLD_TOKENS, "未指定は既定 20 万");
  compactor.dispose();
});

test("normalizeCompactThresholdTokens: 整数で 5 万〜45 万だけ通す（範囲外・小数・数でない値は null）", () => {
  assert.equal(normalizeCompactThresholdTokens(50_000), 50_000);
  assert.equal(normalizeCompactThresholdTokens(200_000), 200_000);
  assert.equal(normalizeCompactThresholdTokens(450_000), 450_000);
  assert.equal(normalizeCompactThresholdTokens(230_097), 230_097, "1 万刻みでなくても整数なら通す（設定ファイルを手で書いた値）");
  for (const bad of [49_999, 450_001, 0, -200_000, 200_000.5, 0.42, Number.NaN, Number.POSITIVE_INFINITY, "200000", null, undefined]) {
    assert.equal(normalizeCompactThresholdTokens(bad), null, String(bad));
  }
});
