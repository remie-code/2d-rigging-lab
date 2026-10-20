// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { createWarningBoard, isCreditExhaustedError, quotaLowWarning, WARNING_EVENT_TTL_MS } from "./warnings.mjs";

// 上の帯の警告の正本（純ロジック + 注入タイマ）。

function makeTimers() {
  /** @type {Array<{ fn: () => void; ms: number; cleared: boolean }>} */
  const timers = [];
  return {
    timers,
    setTimeoutImpl: /** @type {any} */ ((fn, ms) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    }),
    clearTimeoutImpl: /** @type {any} */ ((t) => {
      t.cleared = true;
    }),
    fireAll() {
      for (const t of timers) if (!t.cleared) {
        t.cleared = true;
        t.fn();
      }
    }
  };
}

test("定数と判定: 一回きりは 60 秒・残高切れは credit_balance_exhausted を含む文言", () => {
  assert.equal(WARNING_EVENT_TTL_MS, 60_000);
  assert.equal(isCreditExhaustedError("HTTP 429: low [credit_balance_exhausted]"), true);
  assert.equal(isCreditExhaustedError("HTTP 429: rate limited [rate_limit_exceeded]"), false);
  assert.equal(isCreditExhaustedError(null), false);
});

test("quotaLowWarning: 20% 未満は warn・5% 未満は alert・それ以外と不明は null", () => {
  assert.equal(quotaLowWarning("Codex", { remainingPercent: 20 }), null);
  assert.deepEqual(quotaLowWarning("Codex", { remainingPercent: 19.9 }), {
    kind: "quota-low",
    severity: "warn",
    message: "Codex の残りが少ない（19%）",
    source: "codex"
  });
  assert.equal(quotaLowWarning("ElevenLabs", { remainingPercent: 4.5 })?.severity, "alert");
  assert.equal(quotaLowWarning("ElevenLabs", null), null);
});

test("状態で決まる警告: 出す・同じ内容なら何もしない（出た時刻を保つ）・null で消える", () => {
  let now = 1000;
  /** @type {any[][]} */
  const changes = [];
  const board = createWarningBoard({ nowImpl: () => now, onChange: (l) => changes.push(l) });
  board.setCondition("stt", { kind: "stt-down", severity: "alert", message: "文字起こしが止まっている", detail: "x" });
  assert.equal(changes.length, 1);
  now = 2000;
  board.setCondition("stt", { kind: "stt-down", severity: "alert", message: "文字起こしが止まっている", detail: "x" });
  assert.equal(changes.length, 1, "同じ内容は通知しない");
  board.setCondition("stt", { kind: "stt-reconnecting", severity: "warn", message: "繋ぎ直し中" });
  assert.equal(changes.length, 2);
  const [w] = board.list();
  assert.deepEqual(w, {
    id: "stt",
    kind: "stt-reconnecting",
    lifetime: "state",
    severity: "warn",
    message: "繋ぎ直し中",
    detail: null,
    source: null,
    sinceMs: 1000,
    lastAtMs: 2000,
    count: 1,
    expiresAtMs: null
  });
  board.setCondition("stt", null);
  assert.deepEqual(board.list(), []);
  board.setCondition("stt", null);
  assert.equal(changes.length, 3, "無いものを消しても通知しない");
});

test("一回きりの出来事: 60 秒で消える・続けば延ばして数える・赤が先に並ぶ・dispose でタイマを残さない", () => {
  let now = 0;
  const timers = makeTimers();
  /** @type {any[][]} */
  const changes = [];
  const board = createWarningBoard({
    nowImpl: () => now,
    setTimeoutImpl: timers.setTimeoutImpl,
    clearTimeoutImpl: timers.clearTimeoutImpl,
    onChange: (l) => changes.push(l)
  });
  board.pushEvent("judge-error:speak-now", { kind: "judge-error", severity: "warn", message: "判定のエラー", source: "speak-now" });
  now = 10;
  board.setCondition("mic", { kind: "mic-down", severity: "alert", message: "マイク" });
  now = 30_000;
  board.pushEvent("judge-error:speak-now", { kind: "judge-error", severity: "warn", message: "判定のエラー", source: "speak-now" });
  const list = board.list();
  assert.deepEqual(list.map((w) => w.id), ["mic", "judge-error:speak-now"], "赤が先");
  const je = list[1];
  assert.deepEqual([je.lifetime, je.count, je.sinceMs, je.lastAtMs, je.expiresAtMs], ["event", 2, 0, 30_000, 90_000]);
  assert.equal(timers.timers[0].cleared, true, "前のタイマは外す");
  assert.equal(timers.timers[1].ms, 60_000);
  timers.fireAll();
  assert.deepEqual(board.list().map((w) => w.id), ["mic"]);
  board.pushEvent("brain-error", { kind: "brain-error", severity: "alert", message: "頭のエラー" });
  board.dispose();
  assert.ok(timers.timers.every((t) => t.cleared));
  assert.deepEqual(board.list(), []);
});
