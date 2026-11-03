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
  replyLatencyUsageRecord,
  judgmentUsageRecord,
  fireRefusedUsageRecord,
  controlUsageRecord,
  JUDGMENT_ERROR_KINDS,
  USAGE_CONTROL_KINDS,
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
    serviceTier: "priority",
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
    injectedChars: 120,
    serviceTier: "priority"
  });
  const empty = fireUsageRecord({ fireId: 1, vision: false });
  assert.equal(empty.lastInputTokens, null);
  assert.equal(empty.modelContextWindow, null);
  assert.equal(empty.serviceTier, null, "段を送っていない（Claude 等）なら null");
  assert.equal(fireUsageRecord({ fireId: 2, serviceTier: "default" }).serviceTier, "default");
  assert.equal(fireUsageRecord({ fireId: 3, serviceTier: 1 }).serviceTier, null, "文字列でなければ null");
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

// ── 応答の遅れの直し（latency-fix-plan.md §2-5）: 返事ごとの遅延の内訳 ─────────────────────────────

test("遅延の 1 行: SSE latency と同じレコードから、区間・合計・きっかけの種類・エンジン名だけを拾う（本文・ID は落とす）", () => {
  const record = replyLatencyUsageRecord({
    fireId: 7,
    cause: { type: "speak-now", choice: "respond", probability: 0.72, trigger: "turn-end", triggerSeq: 12, judgeLatencyMs: 812 },
    spoken: true,
    segments: { transcribeMs: 512, judgeMs: 812, screenMs: null, llmFirstMs: 2100, firstSentenceMs: 90, ttsMs: 130, voiceMs: 60 },
    otherMs: 40,
    totalMs: 3744,
    level: "ok",
    vision: true,
    brain: "codex-56-sol",
    voice: "aivis",
    stt: "parakeet",
    serviceTier: "priority",
    text: "本文は来ないはず"
  });
  assert.deepEqual(record, {
    type: "latency",
    fireId: 7,
    causeType: "speak-now",
    causeChoice: "respond",
    spoken: true,
    vision: true,
    level: "ok",
    brain: "codex-56-sol",
    sttEngine: "parakeet",
    voiceEngine: "aivis",
    transcribeMs: 512,
    judgeMs: 812,
    screenMs: null,
    llmFirstMs: 2100,
    firstSentenceMs: 90,
    ttsMs: 130,
    voiceMs: 60,
    otherMs: 40,
    totalMs: 3744,
    serviceTier: "priority"
  });
  const comment = replyLatencyUsageRecord({ fireId: 8, cause: { type: "comment-react", commentIds: ["msg-9"], commentSeqs: [3] }, spoken: false, segments: {} });
  assert.equal(comment.causeType, "comment-react");
  assert.equal(comment.causeChoice, null);
  assert.equal(comment.totalMs, null);
  assert.equal(comment.serviceTier, null, "段を送っていない返事は null");
  assert.equal(JSON.stringify(comment).includes("msg-9"), false, "コメントの ID は残さない");
  assert.equal(replyLatencyUsageRecord(null).type, "latency");
});

test("遅延の行は既存の行（発火・圧縮）と同じファイルに type を分けて足される", async () => {
  await withDir(async (dir) => {
    const log = createSessionUsageLog({ dir, startedAtMs: Date.UTC(2026, 9, 27, 10, 0, 0, 0), nowImpl: () => 1 });
    log.append(fireUsageRecord({ fireId: 1, brain: "codex" }));
    log.append(replyLatencyUsageRecord({ fireId: 1, cause: { type: "manual" }, spoken: true, segments: { llmFirstMs: 900 }, totalMs: 1500 }));
    await log.flush();
    const lines = readLines(log.path);
    assert.deepEqual(lines.map((l) => l.type), ["fire", "latency"]);
    assert.equal(lines[1].schema, SESSION_USAGE_SCHEMA);
    assert.equal(lines[1].llmFirstMs, 900);
    assert.equal(lines[1].causeType, "manual");
  });
});

test("遅延の 1 行（体なし・配信の組み直し Domain C）: bodyless の返事には bodyless: true を足す・体ありの行は今と同じ形", () => {
  const base = { fireId: 9, cause: { type: "manual" }, spoken: true, segments: { ttsMs: 120, voiceMs: 15 }, totalMs: 800, level: "ok" };
  const bodyless = replyLatencyUsageRecord({ ...base, bodyless: true });
  assert.equal(bodyless.bodyless, true);
  assert.equal(bodyless.voiceMs, 15);
  const withBody = replyLatencyUsageRecord(base);
  assert.equal("bodyless" in withBody, false, "体ありはキーを足さない");
  assert.deepEqual({ ...bodyless, bodyless: undefined }, { ...withBody, bodyless: undefined });
  assert.equal("bodyless" in replyLatencyUsageRecord({ ...base, bodyless: "yes" }), false, "true だけを印と読む");
});

// ── Discord モード Domain H: 判定・発火の断り・つまみの行（discord-mode.md §13.7）──────────────────────────

test("判定の 1 行（成功）: きっかけ・選択・確率・行き先・遅延だけを拾う（本文・名前・id は落とす）", () => {
  const record = judgmentUsageRecord({
    ok: true,
    trigger: "after-busy",
    triggerSeq: 12,
    choice: "respond",
    probability: 0.72,
    probs: { wait: 0.1, backchannel: 0.05, respond: 0.72, initiate: 0.08, look: 0.05, "たろう": 0.9 },
    latencyMs: 812,
    action: "drop-busy",
    input: "たろう: 本文は拾わない",
    displayName: "たろう",
    speakerId: "123456789012345678"
  });
  assert.deepEqual(record, {
    type: "judgment",
    ok: true,
    trigger: "after-busy",
    triggerSeq: 12,
    choice: "respond",
    p: 0.72,
    probs: { wait: 0.1, backchannel: 0.05, respond: 0.72, initiate: 0.08, look: 0.05 },
    action: "drop-busy",
    latencyMs: 812,
    errorKind: null,
    errorStatus: null
  });
  const text = JSON.stringify(record);
  for (const leak of ["本文", "たろう", "123456789012345678"]) assert.equal(text.includes(leak), false, leak);
  // 欠けた値は null（確率の無い選択肢も null）。
  const sparse = judgmentUsageRecord({ ok: true, trigger: "transcript", choice: "wait", probs: { wait: 0.9 }, action: "none" });
  assert.equal(sparse.p, null);
  assert.equal(sparse.triggerSeq, null);
  assert.deepEqual(sparse.probs, { wait: 0.9, backchannel: null, respond: null, initiate: null, look: null });
  // 決まった語でないもの（文・知らない選択肢）は null に落とす。
  const odd = judgmentUsageRecord({ ok: true, trigger: "本文の文", choice: "なにか", action: "Fire Now", probs: null });
  assert.equal(odd.trigger, null);
  assert.equal(odd.choice, null);
  assert.equal(odd.action, null);
  assert.equal(odd.probs, null);
});

test("判定の 1 行（失敗）: エラーの種類と HTTP の状態の数だけ（エラー文・相手の返した文は書かない）", () => {
  const record = judgmentUsageRecord({
    ok: false,
    trigger: "transcript",
    error: "HTTP 429: You exceeded your current quota, たろう [credit_balance_exhausted]",
    latencyMs: 640,
    errorKind: "http",
    errorStatus: 429
  });
  assert.deepEqual(record, {
    type: "judgment",
    ok: false,
    trigger: "transcript",
    triggerSeq: null,
    choice: null,
    p: null,
    probs: null,
    action: null,
    latencyMs: 640,
    errorKind: "http",
    errorStatus: 429
  });
  const text = JSON.stringify(record);
  for (const leak of ["quota", "たろう", "credit_balance_exhausted", "HTTP 429"]) assert.equal(text.includes(leak), false, leak);
  for (const kind of JUDGMENT_ERROR_KINDS) {
    assert.equal(judgmentUsageRecord({ ok: false, error: "x", errorKind: kind }).errorKind, kind);
  }
  assert.deepEqual([...JUDGMENT_ERROR_KINDS], ["no-key", "network", "auth", "http", "timeout", "shape"]);
  // 種類を持たない失敗（判定エンジンの外の throw など）は unknown・文は書かない。
  const unknown = judgmentUsageRecord({ ok: false, trigger: "transcript", error: "通信失敗: getaddrinfo ENOTFOUND たろう", latencyMs: null });
  assert.equal(unknown.errorKind, "unknown");
  assert.equal(JSON.stringify(unknown).includes("ENOTFOUND"), false);
  assert.equal(judgmentUsageRecord({ ok: false, errorKind: "通信失敗の文" }).errorKind, "unknown", "一覧に無い種類は unknown");
  assert.equal(judgmentUsageRecord(null).ok, false);
});

test("発火の断りの 1 行: きっかけの種類・断った理由・視覚か だけ（ほかの欄は拾わない・文は null に落とす）", () => {
  assert.deepEqual(fireRefusedUsageRecord({ cause: "speak-now", reason: "stream-not-open", vision: false }), {
    type: "fire-refused",
    cause: "speak-now",
    reason: "stream-not-open",
    vision: false
  });
  assert.deepEqual(fireRefusedUsageRecord({ cause: "manual", reason: "busy", vision: true, commentIds: ["yt-123"], displayName: "たろう" }), {
    type: "fire-refused",
    cause: "manual",
    reason: "busy",
    vision: true
  });
  const odd = fireRefusedUsageRecord({ cause: "コメントの本文", reason: "Error: boom at たろう", vision: "yes" });
  assert.deepEqual(odd, { type: "fire-refused", cause: null, reason: null, vision: false });
  for (const reason of ["killed", "busy", "ears-not-running", "empty-window", "vision-no-target", "not-in-vc"]) {
    assert.equal(fireRefusedUsageRecord({ cause: "recall", reason }).reason, reason);
  }
});

test("つまみの 1 行: 許す一覧の名前と前後の真偽だけ（一覧に無い名前は null = 書かない・VC の名前や id は載らない）", () => {
  assert.deepEqual(controlUsageRecord({ control: "self-fire", from: true, to: false }), {
    type: "control",
    control: "self-fire",
    from: true,
    to: false
  });
  assert.deepEqual(controlUsageRecord({ control: "kill", from: false, to: true }), { type: "control", control: "kill", from: false, to: true });
  // Domain I〜K の VC の出来事（真偽を持たない・名前・id を渡されても載せない）。
  const join = controlUsageRecord({ control: "vc-join", channelName: "雑談部屋", channelId: "123456789012345678", guildId: "987654321098765432" });
  assert.deepEqual(join, { type: "control", control: "vc-join", from: null, to: null });
  const text = JSON.stringify(join);
  for (const leak of ["雑談部屋", "123456789012345678", "987654321098765432"]) assert.equal(text.includes(leak), false, leak);
  assert.deepEqual([...USAGE_CONTROL_KINDS], [
    "self-fire",
    "barge-in",
    "kill",
    "vc-join",
    "vc-leave",
    "vc-move",
    "vc-disconnect",
    "vc-moved",
    "vc-kicked"
  ]);
  for (const control of USAGE_CONTROL_KINDS) assert.equal(controlUsageRecord({ control })?.control, control);
  assert.equal(controlUsageRecord({ control: "雑談部屋" }), null);
  assert.equal(controlUsageRecord({ control: "verbosity" }), null, "一覧に無いつまみは書かない");
  assert.equal(controlUsageRecord(null), null);
  assert.equal(controlUsageRecord({ control: "barge-in", from: "on", to: 1 })?.from, null, "真偽でなければ null");
});

test("判定・断り・つまみの行は既存の行と同じ場のファイルに type を分けて足される（時刻は wallTimeMs）", async () => {
  await withDir(async (dir) => {
    let now = 100;
    const log = createSessionUsageLog({ dir, startedAtMs: Date.UTC(2026, 10, 1, 3, 0, 0, 0), nowImpl: () => (now += 1) });
    log.append(judgmentUsageRecord({ ok: true, trigger: "transcript", choice: "respond", probability: 0.8, probs: { respond: 0.8 }, action: "fire", latencyMs: 700 }));
    log.append(fireUsageRecord({ fireId: 1, brain: "codex" }));
    log.append(fireRefusedUsageRecord({ cause: "speak-now", reason: "stream-not-open" }));
    log.append(/** @type {any} */ (controlUsageRecord({ control: "barge-in", from: false, to: true })));
    await log.flush();
    const lines = readLines(log.path);
    assert.deepEqual(lines.map((l) => l.type), ["judgment", "fire", "fire-refused", "control"]);
    assert.deepEqual(lines.map((l) => l.wallTimeMs), [101, 102, 103, 104]);
    assert.ok(lines.every((l) => l.schema === SESSION_USAGE_SCHEMA));
  });
});
