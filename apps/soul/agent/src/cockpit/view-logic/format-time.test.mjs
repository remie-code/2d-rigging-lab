// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";

import { pad, formatHms, formatClock, computeUptimeMs } from "./format-time.mjs";

test("pad: 1桁は0埋め・2桁以上はそのまま（時の桁あふれを切らない）", () => {
  assert.equal(pad(0), "00");
  assert.equal(pad(9), "09");
  assert.equal(pad(10), "10");
  assert.equal(pad(59), "59");
  assert.equal(pad(100), "100"); // 時が 3 桁でも切らない（原実装 cockpit.html:249）。
});

test("formatHms: 経過ms → HH:MM:SS（fmtHms 同値・cockpit.html:250-253）", () => {
  assert.equal(formatHms(0), "00:00:00");
  assert.equal(formatHms(1000), "00:00:01");
  assert.equal(formatHms(59_000), "00:00:59");
  assert.equal(formatHms(61_000), "00:01:01");
  assert.equal(formatHms(3_599_000), "00:59:59");
  assert.equal(formatHms(3_661_000), "01:01:01");
  assert.equal(formatHms(360_000_000), "100:00:00"); // 100 時間（桁あふれ）。
  assert.equal(formatHms(500), "00:00:00"); // 1s 未満は切り捨て（Math.floor）。
});

test("formatClock: エポックms → ローカル HH:MM:SS（fmtClock 同値・TZ非依存に検証）", () => {
  // ローカル成分から epoch を作り、同じローカル成分に戻ることを確認する（TZ に依存しない）。
  const a = new Date(2026, 0, 2, 3, 4, 5).getTime(); // ローカル 03:04:05
  assert.equal(formatClock(a), "03:04:05");
  const b = new Date(2026, 5, 13, 14, 25, 59).getTime(); // ローカル 14:25:59
  assert.equal(formatClock(b), "14:25:59");
  const c = new Date(2026, 11, 31, 0, 0, 0).getTime(); // ローカル 00:00:00
  assert.equal(formatClock(c), "00:00:00");
});

test("computeUptimeMs: listening 中はローカル刻み・stopped は 0（renderUptime 同値）", () => {
  // listening: base + (now - anchor)。
  assert.equal(computeUptimeMs({ listening: true, baseMs: 5000, anchorMs: 1000, nowMs: 4000 }), 8000);
  // stopped は常に 0（base/anchor に関わらず）。
  assert.equal(computeUptimeMs({ listening: false, baseMs: 5000, anchorMs: 1000, nowMs: 9999 }), 0);
  // 負クランプはしない（原実装同様）: now < anchor なら負になりうる。
  assert.equal(computeUptimeMs({ listening: true, baseMs: 0, anchorMs: 1000, nowMs: 400 }), -600);
});
