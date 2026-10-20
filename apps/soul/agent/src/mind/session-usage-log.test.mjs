// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  createSessionUsageLog,
  fireUsageRecord,
  compactionUsageRecord,
  sessionUsageFileName,
  SESSION_USAGE_RETENTION,
  SESSION_USAGE_SCHEMA
} from "./session-usage-log.mjs";

// 頭の文脈の記録（context-growth-2026-10.md §6）。OS temp の使い捨てディレクトリで固定する（実ファイルに触れない）。

function withDir(fn) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "session-usage-test-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

const readLines = (file) => readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));

test("ファイル名は起動時刻（UTC・記号を - に）・直近 20 個を残す", () => {
  assert.equal(sessionUsageFileName(Date.UTC(2026, 9, 17, 5, 6, 7, 89)), "2026-10-17T05-06-07-089Z.jsonl");
  assert.equal(SESSION_USAGE_RETENTION, 20);
});

test("発火の 1 行: 数字と種類だけ（本文を持つ欄は無い）", () => {
  const record = fireUsageRecord({
    fireId: 7,
    brain: "codex-61-sol",
    vision: true,
    windowMode: "delta",
    includedCount: 3,
    injectedChars: 120,
    usage: { input_tokens: 1 },
    tokenUsage: {
      last: { inputTokens: 52_000, cachedInputTokens: 50_000, outputTokens: 30 },
      total: { inputTokens: 900_000, cachedInputTokens: 800_000 },
      modelContextWindow: 258_400
    },
    ttftMs: 812.5,
    elapsedMs: 1500,
    replyText: "本文は拾わない"
  });
  assert.deepEqual(record, {
    type: "fire",
    fireId: 7,
    brain: "codex-61-sol",
    lastInputTokens: 52_000,
    lastCachedInputTokens: 50_000,
    totalInputTokens: 900_000,
    totalCachedInputTokens: 800_000,
    modelContextWindow: 258_400,
    ttftMs: 812.5,
    vision: true,
    windowMode: "delta",
    includedCount: 3,
    injectedChars: 120
  });
  const empty = fireUsageRecord({ fireId: 1, vision: false });
  assert.equal(empty.lastInputTokens, null);
  assert.equal(empty.modelContextWindow, null);
});

test("圧縮の開始・終了の 1 行", () => {
  assert.deepEqual(
    compactionUsageRecord({ type: "started", ratio: 0.7, lastInputTokens: 180_000, totalInputTokens: 2_000_000, modelContextWindow: 258_400 }, "codex-61-sol"),
    { type: "compactStarted", brain: "codex-61-sol", ratio: 0.7, lastInputTokens: 180_000, totalInputTokens: 2_000_000, modelContextWindow: 258_400 }
  );
  assert.deepEqual(
    compactionUsageRecord({ type: "finished", ok: true, durationMs: 9000, reason: null, message: "x", personaInjected: true, personaDeferred: false, compactionInputTokens: 181_000 }, null),
    { type: "compactFinished", brain: null, ok: true, durationMs: 9000, reason: null, personaInjected: true, personaDeferred: false, compactionInputTokens: 181_000 }
  );
});

test("append: 起動ごと 1 ファイルに 1 行ずつ追記・最初の 1 行で古いものを消して今回を含め 20 個に", async () => {
  await withDir(async (dir) => {
    // 既存 22 個（＋関係ないファイル 1 個）。
    for (let i = 0; i < 22; i += 1) {
      writeFileSync(path.join(dir, sessionUsageFileName(Date.UTC(2026, 9, 1, 0, 0, i))), "{}\n");
    }
    writeFileSync(path.join(dir, "notes.txt"), "keep");
    const log = createSessionUsageLog({ dir, startedAtMs: Date.UTC(2026, 9, 17), nowImpl: () => 42 });
    log.append({ type: "fire", fireId: 1 });
    log.append({ type: "fire", fireId: 2 });
    await log.flush();
    const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
    assert.equal(files.length, 20);
    assert.equal(files.at(-1), "2026-10-17T00-00-00-000Z.jsonl");
    assert.equal(files[0], sessionUsageFileName(Date.UTC(2026, 9, 1, 0, 0, 3)), "古い方から消す");
    assert.ok(readdirSync(dir).includes("notes.txt"), "記録以外のファイルは消さない");
    assert.deepEqual(readLines(log.path), [
      { schema: SESSION_USAGE_SCHEMA, wallTimeMs: 42, type: "fire", fireId: 1 },
      { schema: SESSION_USAGE_SCHEMA, wallTimeMs: 42, type: "fire", fireId: 2 }
    ]);
  });
});

test("append: 置き場が無ければ作る・書けなくても throw しない（発火を止めない）", async () => {
  await withDir(async (root) => {
    const dir = path.join(root, "nested", "session-usage");
    const log = createSessionUsageLog({ dir, startedAtMs: 0 });
    log.append({ type: "fire", fireId: 1 });
    await log.flush();
    assert.equal(readLines(log.path).length, 1);
    const failing = createSessionUsageLog({
      dir,
      startedAtMs: 1,
      fs: {
        mkdir: async () => {},
        readdir: async () => [],
        rm: async () => {},
        appendFile: async () => { throw new Error("disk full"); }
      }
    });
    assert.doesNotThrow(() => failing.append({ type: "fire" }));
    await failing.flush();
    mkdirSync(dir, { recursive: true });
  });
});
