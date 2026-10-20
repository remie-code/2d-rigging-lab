// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createQuotaMonitor,
  fetchElevenLabsSubscription,
  mergeCodexRateLimitUpdate,
  normalizeCodexRateLimits,
  normalizeElevenLabsSubscription,
  pickCodexWindow,
  ELEVENLABS_SUBSCRIPTION_URL,
  ELEVENLABS_QUOTA_INTERVAL_MS,
  CODEX_QUOTA_INTERVAL_MS,
  QUOTA_LOW_PERCENT,
  QUOTA_CRITICAL_PERCENT
} from "./quota.mjs";

// 残量ゲージの材料。実 API・実 Codex には繋がない（読み口・fetch・タイマはすべて偽物）。

const SECRET = "xi-SECRET-key-value";

test("定数: ElevenLabs は 10 分おき・Codex は数分（5 分）おき・20% / 5% の区分", () => {
  assert.equal(ELEVENLABS_QUOTA_INTERVAL_MS, 600_000);
  assert.equal(CODEX_QUOTA_INTERVAL_MS, 300_000);
  assert.equal(QUOTA_LOW_PERCENT, 20);
  assert.equal(QUOTA_CRITICAL_PERCENT, 5);
  assert.equal(ELEVENLABS_SUBSCRIPTION_URL, "https://api.elevenlabs.io/v1/user/subscription");
});

test("pickCodexWindow: 週の窓（10080 分）を優先・無ければ primary", () => {
  const weekly = { usedPercent: 30, windowDurationMins: 10080, resetsAt: 1 };
  const fiveHour = { usedPercent: 80, windowDurationMins: 300, resetsAt: 2 };
  assert.equal(pickCodexWindow({ primary: fiveHour, secondary: weekly }), weekly);
  assert.equal(pickCodexWindow({ primary: fiveHour, secondary: null }), fiveHour);
  assert.equal(pickCodexWindow({ primary: null, secondary: null }), null);
  assert.equal(pickCodexWindow(null), null);
});

test("normalizeCodexRateLimits: 残り = 100 − 使用率・resetsAt（秒）→ ms・止まっているか・codex の枠を優先", () => {
  const response = {
    ordinaryUsageAllowed: true,
    rateLimits: { limitId: "other", primary: { usedPercent: 99, windowDurationMins: 10080, resetsAt: 5 }, rateLimitReachedType: null },
    rateLimitsByLimitId: {
      codex: { limitId: "codex", primary: { usedPercent: 12.34, windowDurationMins: 10080, resetsAt: 1_763_000_000 }, rateLimitReachedType: null }
    }
  };
  assert.deepEqual(normalizeCodexRateLimits(response, 42), {
    remainingPercent: 87.7,
    usedPercent: 12.3,
    resetsAtMs: 1_763_000_000_000,
    windowMins: 10080,
    limited: false,
    reachedType: null,
    limitId: "codex",
    updatedAtMs: 42
  });
  const blocked = normalizeCodexRateLimits(
    { ordinaryUsageAllowed: false, rateLimits: { primary: { usedPercent: 100, windowDurationMins: 10080, resetsAt: null } } },
    1
  );
  assert.equal(blocked?.limited, true);
  assert.equal(blocked?.remainingPercent, 0);
  assert.equal(normalizeCodexRateLimits({ rateLimits: {} }, 1), null);
  assert.equal(normalizeCodexRateLimits(null, 1), null);
});

test("mergeCodexRateLimitUpdate: 差分の窓で更新・差分の null は前の値を消さない・別の limitId は混ぜない", () => {
  const prev = normalizeCodexRateLimits(
    { ordinaryUsageAllowed: true, rateLimits: { limitId: "codex", primary: { usedPercent: 10, windowDurationMins: 10080, resetsAt: 100 } } },
    1
  );
  const merged = mergeCodexRateLimitUpdate(prev, { primary: { usedPercent: 25, windowDurationMins: null, resetsAt: null } }, 2);
  assert.equal(merged?.remainingPercent, 75);
  assert.equal(merged?.resetsAtMs, 100_000, "null の resetsAt は前の値を保つ");
  assert.equal(merged?.windowMins, 10080);
  assert.equal(merged?.updatedAtMs, 2);
  const reached = mergeCodexRateLimitUpdate(merged, { rateLimitReachedType: "rate_limit_reached", primary: null }, 3);
  assert.equal(reached?.limited, true);
  assert.equal(reached?.remainingPercent, 75);
  const other = mergeCodexRateLimitUpdate(prev, { limitId: "something-else", primary: { usedPercent: 99 } }, 4);
  assert.equal(other, prev);
  assert.equal(mergeCodexRateLimitUpdate(null, { primary: null }, 5), null);
  assert.equal(mergeCodexRateLimitUpdate(null, { primary: { usedPercent: 50, windowDurationMins: 10080, resetsAt: 1 } }, 5)?.remainingPercent, 50);
});

test("normalizeElevenLabsSubscription: 残り = 1 − 使用 ÷ 上限・リセット時刻・読めなければ null（数値以外は持たない）", () => {
  const json = {
    tier: "free",
    character_count: 4444,
    character_limit: 10000,
    next_character_count_reset_unix: 1_763_164_800,
    voice_limit: 3,
    currency: "usd"
  };
  assert.deepEqual(normalizeElevenLabsSubscription(json, 9), {
    remainingPercent: 55.6,
    used: 4444,
    limit: 10000,
    resetsAtMs: 1_763_164_800_000,
    updatedAtMs: 9
  });
  assert.equal(normalizeElevenLabsSubscription({ character_count: 1, character_limit: 0 }, 1), null);
  assert.equal(normalizeElevenLabsSubscription({}, 1), null);
});

test("fetchElevenLabsSubscription: xi-api-key で GET・キー無し / HTTP エラーは throw（キーを理由に含めない）", async () => {
  /** @type {any[]} */
  const calls = [];
  const fetchImpl = /** @type {any} */ (async (url, init) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ character_count: 1, character_limit: 2 }) };
  });
  const json = await fetchElevenLabsSubscription({ apiKeyProvider: () => ({ ok: true, apiKey: SECRET }), fetchImpl });
  assert.equal(json.character_limit, 2);
  assert.equal(calls[0].url, ELEVENLABS_SUBSCRIPTION_URL);
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers["xi-api-key"], SECRET);
  await assert.rejects(
    fetchElevenLabsSubscription({ apiKeyProvider: () => ({ ok: false, reason: "なし" }), fetchImpl }),
    /キーが見つからない/
  );
  const fail401 = /** @type {any} */ (async () => ({ ok: false, status: 401, json: async () => ({ detail: SECRET }) }));
  await assert.rejects(fetchElevenLabsSubscription({ apiKeyProvider: () => ({ ok: true, apiKey: SECRET }), fetchImpl: fail401 }), (e) => {
    assert.equal(e.message, "ElevenLabs の残量: HTTP 401");
    assert.equal(e.message.includes(SECRET), false);
    return true;
  });
  const boom = /** @type {any} */ (async () => {
    throw new Error(`network ${SECRET}`);
  });
  await assert.rejects(fetchElevenLabsSubscription({ apiKeyProvider: () => ({ ok: true, apiKey: SECRET }), fetchImpl: boom }), (e) => {
    assert.equal(e.message.includes(SECRET), false);
    return true;
  });
});

/** 手で回す setInterval。 */
function makeIntervals() {
  /** @type {Array<{ fn: () => void; ms: number; cleared: boolean }>} */
  const timers = [];
  return {
    timers,
    setIntervalImpl: /** @type {any} */ ((fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    }),
    clearIntervalImpl: /** @type {any} */ ((t) => {
      t.cleared = true;
    }),
    tick(ms) {
      for (const t of timers) if (!t.cleared && t.ms === ms) t.fn();
    }
  };
}

const settle = () => new Promise((r) => setImmediate(r));

test("createQuotaMonitor: ElevenLabs は start で 1 回 + 10 分おき・読めなければ不明（null）・値が変わったときだけ通知", async () => {
  const iv = makeIntervals();
  let n = 0;
  /** @type {any[]} */
  const changes = [];
  const monitor = createQuotaMonitor({
    readElevenLabs: async () => {
      n += 1;
      if (n === 3) throw new Error("down");
      return { character_count: 100, character_limit: 1000, next_character_count_reset_unix: 10 };
    },
    nowImpl: () => n * 1000,
    setIntervalImpl: iv.setIntervalImpl,
    clearIntervalImpl: iv.clearIntervalImpl,
    onChange: (s) => changes.push(s)
  });
  assert.deepEqual(monitor.snapshot(), { codex: null, elevenlabs: null });
  monitor.start();
  await settle();
  assert.equal(monitor.snapshot().elevenlabs?.remainingPercent, 90);
  assert.equal(changes.length, 1);
  iv.tick(ELEVENLABS_QUOTA_INTERVAL_MS);
  await settle();
  assert.equal(n, 2);
  assert.equal(changes.length, 1, "読んだ時刻だけの変化は通知しない");
  iv.tick(ELEVENLABS_QUOTA_INTERVAL_MS);
  await settle();
  assert.equal(monitor.snapshot().elevenlabs, null, "取れないときは不明");
  assert.equal(changes.length, 2);
  monitor.stop();
  assert.ok(iv.timers.every((t) => t.cleared));
});

test("createQuotaMonitor: Codex は start では読まず（App Server 起動前は不明）・refreshCodex と数分おき・通知でマージ・clearCodex で不明", async () => {
  const iv = makeIntervals();
  /** @type {any} */
  let response = null; // App Server がまだ起動していない。
  let reads = 0;
  const monitor = createQuotaMonitor({
    readCodex: async () => {
      reads += 1;
      return response;
    },
    nowImpl: () => 5,
    setIntervalImpl: iv.setIntervalImpl,
    clearIntervalImpl: iv.clearIntervalImpl
  });
  monitor.start();
  await settle();
  assert.equal(reads, 0, "start では読まない");
  await monitor.refreshCodex();
  assert.equal(monitor.snapshot().codex, null, "起動前は不明");
  response = { ordinaryUsageAllowed: true, rateLimits: { primary: { usedPercent: 40, windowDurationMins: 10080, resetsAt: 100 } } };
  iv.tick(CODEX_QUOTA_INTERVAL_MS);
  await settle();
  assert.equal(monitor.snapshot().codex?.remainingPercent, 60);
  monitor.mergeCodexUpdate({ primary: { usedPercent: 85, windowDurationMins: 10080, resetsAt: null } });
  assert.equal(monitor.snapshot().codex?.remainingPercent, 15);
  assert.equal(monitor.snapshot().codex?.resetsAtMs, 100_000);
  monitor.clearCodex();
  assert.equal(monitor.snapshot().codex, null);
  monitor.stop();
});

test("createQuotaMonitor: clearCodex の後に遅れて返った前の読みは捨てる・読み口が無ければ常に不明", async () => {
  /** @type {(v: any) => void} */
  let release = () => {};
  const monitor = createQuotaMonitor({
    readCodex: () => new Promise((r) => (release = r)),
    nowImpl: () => 1
  });
  const p = monitor.refreshCodex();
  monitor.clearCodex();
  release({ rateLimits: { primary: { usedPercent: 10, windowDurationMins: 10080, resetsAt: 1 } } });
  await p;
  assert.equal(monitor.snapshot().codex, null);
  const empty = createQuotaMonitor({});
  empty.start();
  await empty.refreshCodex();
  await empty.refreshElevenLabs();
  assert.deepEqual(empty.snapshot(), { codex: null, elevenlabs: null });
  empty.stop();
});
