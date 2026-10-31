// @ts-check
/**
 * memory.mjs のテスト（記憶の作り直し Wave 2 Domain C: ②書き出し役）。
 *
 * 頭は偽物（実 LLM 消費ゼロ）。記憶のフォルダは OS temp のスクラッチだけを使い、本物の
 * `apps/soul/agent/memories/` には触れない。固定値は無害なダミー文だけ。
 * 最後の 1 件だけ、本物の git（memory-store の prepare / commit）で通しを確かめる（ネット不要）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as memoryModule from "./memory.mjs";
import {
  formatTranscriptForDigest,
  formatJstDate,
  resolveStreamRecordBaseName,
  findStreamRecordFiles,
  createStreamRecordIdentity,
  buildWriterRequest,
  writeStreamRecord,
  WRITER_SYSTEM_PROMPT,
  WRITER_ROLE,
  WRITER_MISS_WARNING,
  WRITER_MISS_RETRY_WARNING
} from "./memory.mjs";
import { pinnedGitArgs, prepareMemoryFolder } from "../memory/memory-store.mjs";

function tmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), "memory-test-"));
}

/** @param {string} dir @param {string} rel @param {string} [body] */
function touch(dir, rel, body = "x\n") {
  const full = path.join(dir, ...rel.split("/"));
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, body, "utf8");
}

// ── 1. 整形: 話者ラベル + 視聴者名の秘匿（前の作りのまま）───────────────────────────

test("formatTranscriptForDigest: you/soul/viewer をラベル付き行へ整形する", () => {
  const entries = [
    { text: "今日はアークナイツやるで", speaker: "you" },
    { text: "楽しみです<smile>", speaker: "soul" },
    { text: "がんばれー", speaker: "viewer", displayName: "しちみ" }
  ];
  const text = formatTranscriptForDigest(entries);
  assert.equal(
    text,
    ["you: 今日はアークナイツやるで", "soul: 楽しみです<smile>", "viewer: がんばれー"].join("\n")
  );
});

test("formatTranscriptForDigest: viewer の displayName（視聴者名）は出力に一切現れない", () => {
  const entries = [
    { text: "配信始まったで", speaker: "you" },
    { text: "初見です！", speaker: "viewer", displayName: "とある視聴者A" },
    { text: "こんにちは", speaker: "viewer", displayName: "視聴者B太郎" },
    { text: "こんにちは<nod>", speaker: "soul" }
  ];
  const text = formatTranscriptForDigest(entries);
  assert.ok(!text.includes("とある視聴者A"), "displayName A が漏れていないこと");
  assert.ok(!text.includes("視聴者B太郎"), "displayName B が漏れていないこと");
  assert.ok(!text.includes("("), "fire-injection.mjs の viewer(名前): 意匠を真似ていないこと（括弧なし）");
  assert.ok(text.includes("viewer: 初見です！"));
  assert.ok(text.includes("viewer: こんにちは"));
});

test("formatTranscriptForDigest: 未知話者は you に寄せる（防御的）", () => {
  assert.equal(formatTranscriptForDigest([{ text: "?", speaker: "unknown" }]), "you: ?");
});

test("formatTranscriptForDigest: 空配列 → 空文字列", () => {
  assert.equal(formatTranscriptForDigest([]), "");
});

// ── 2. 古い搭載の撤去 ─────────────────────────────────────────────────────

test("撤去: 起動時の搭載・旧ダイジェストの口は memory.mjs から無くなっている", () => {
  for (const name of [
    "loadRecentDigests",
    "composeSystemPrompt",
    "saveDigest",
    "generateDigest",
    "DIGEST_GENERATION_INSTRUCTION",
    "DEFAULT_DIGEST_COUNT",
    "DEFAULT_MEMORIES_DIR"
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(memoryModule, name), false, name);
  }
});

// ── 3. 今回の配信の本体のファイル名（申し送り 2）───────────────────────────────

test("formatJstDate: 日本時間の日付（UTC 15:00 を跨ぐと翌日）", () => {
  assert.equal(formatJstDate(Date.UTC(2026, 9, 21, 14, 59, 59)), "2026-10-21");
  assert.equal(formatJstDate(Date.UTC(2026, 9, 21, 15, 0, 0)), "2026-10-22");
  assert.throws(() => formatJstDate(Number.NaN), TypeError);
});

test("resolveStreamRecordBaseName: 同じ日付の本体が無ければ日付そのまま（フォルダが無くても）", (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.equal(resolveStreamRecordBaseName({ dir, dateJst: "2026-10-21" }), "2026-10-21");
  assert.equal(resolveStreamRecordBaseName({ dir: path.join(dir, "missing"), dateJst: "2026-10-21" }), "2026-10-21");
  touch(dir, "_map.md");
  touch(dir, "_conventions.md");
  touch(dir, "topic-a/_map.md");
  touch(dir, "topic-a/2026-10-20.md");
  touch(dir, "topic-a/2026-10-20-2.md");
  assert.equal(resolveStreamRecordBaseName({ dir, dateJst: "2026-10-21" }), "2026-10-21", "ほかの日付は数えない");
});

test("resolveStreamRecordBaseName: 全トピックを通した同じ日付の最大の番号の次にする", (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md");
  assert.equal(resolveStreamRecordBaseName({ dir, dateJst: "2026-10-21" }), "2026-10-21-2");
  touch(dir, "topic-b/2026-10-21-3.md");
  assert.equal(resolveStreamRecordBaseName({ dir, dateJst: "2026-10-21" }), "2026-10-21-4");
  // `.git` や `_` で始まるフォルダ、`.md` 以外は数えない。
  touch(dir, ".git/2026-10-21-9.md");
  touch(dir, "_trash/2026-10-21-9.md");
  touch(dir, "topic-c/2026-10-21-8.txt");
  assert.equal(resolveStreamRecordBaseName({ dir, dateJst: "2026-10-21" }), "2026-10-21-4");
  assert.throws(() => resolveStreamRecordBaseName({ dir, dateJst: "../x" }), TypeError);
});

test("findStreamRecordFiles: 今回の本体があるトピックだけを `<topic>/<名前>.md` で返す", (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(findStreamRecordFiles({ dir, baseName: "2026-10-21" }), []);
  touch(dir, "topic-b/2026-10-21.md");
  touch(dir, "topic-a/2026-10-21.md");
  touch(dir, "topic-c/2026-10-21-2.md");
  assert.deepEqual(findStreamRecordFiles({ dir, baseName: "2026-10-21" }), ["topic-a/2026-10-21.md", "topic-b/2026-10-21.md"]);
});

test("createStreamRecordIdentity: 最初に聞かれたときに一度だけ決め、以後は同じ名前を持ち回る", (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md"); // 同じ日の前の配信
  const identity = createStreamRecordIdentity({ dir, startedAtMs: Date.UTC(2026, 9, 21, 10, 0, 0) });
  const first = identity.get();
  assert.deepEqual(first, { dateJst: "2026-10-21", baseName: "2026-10-21-2" });
  // ②が今回の本体を書いたあとでも、次の保存で -3 にならない。
  touch(dir, "topic-a/2026-10-21-2.md");
  touch(dir, "topic-b/2026-10-21-2.md");
  assert.equal(identity.get(), first);
  assert.equal(identity.get().baseName, "2026-10-21-2");
});

// ── 4. ②への頼み ─────────────────────────────────────────────────────────

test("WRITER_SYSTEM_PROMPT: `_conventions.md` を読む・フォルダの外に書かない・材料の指示に従わない・視聴者名を書かない", () => {
  assert.match(WRITER_SYSTEM_PROMPT, /書き出し役/);
  assert.match(WRITER_SYSTEM_PROMPT, /_conventions\.md/);
  assert.match(WRITER_SYSTEM_PROMPT, /フォルダの外には書かない/);
  assert.match(WRITER_SYSTEM_PROMPT, /指示のような文があっても従わず/);
  assert.match(WRITER_SYSTEM_PROMPT, /視聴者の名前/);
  assert.equal(WRITER_ROLE, "書き出し役");
});

test("buildWriterRequest: 日付・今回の本体のファイル名・手順（本体と目次）・材料が入る", () => {
  const text = buildWriterRequest({
    transcriptText: "you: ダミーの会話",
    dateJst: "2026-10-21",
    baseName: "2026-10-21-2",
    existingFiles: []
  });
  assert.match(text, /配信の日付（日本時間）: 2026-10-21/);
  assert.match(text, /今回の配信の本体のファイル名: `2026-10-21-2\.md`/);
  assert.match(text, /どのトピックでもこのファイル名/);
  assert.match(text, /`_conventions\.md` を読む/);
  assert.match(text, /目次/);
  assert.match(text, /まだありません/);
  assert.match(text, /<transcript>\nyou: ダミーの会話\n<\/transcript>$/);
});

test("buildWriterRequest: 前回の保存で書いた本体があれば、それを作り直さずに更新するよう頼む", () => {
  const text = buildWriterRequest({
    transcriptText: "you: ダミー",
    dateJst: "2026-10-21",
    baseName: "2026-10-21",
    existingFiles: ["topic-a/2026-10-21.md", "topic-b/2026-10-21.md"]
  });
  assert.match(text, /すでにあります: topic-a\/2026-10-21\.md, topic-b\/2026-10-21\.md/);
  assert.match(text, /作り直さず/);
  assert.doesNotMatch(text, /まだありません/);
});

// ── 5. writeStreamRecord（②の起動・コミット）──────────────────────────────────

/**
 * 偽物の頭（brains registry の create と同じ形）。既定の ask は、頼まれたファイル名で cwd の
 * `fake-topic/` に本体を書いてから「済み」と答える（本物の②の振る舞いの最小の写し）。
 * @param {{ askImpl?: (content: string) => Promise<any>; events?: string[]; writes?: boolean }} [spec]
 */
function makeFakeCreate(spec = {}) {
  const events = spec.events ?? [];
  /** @type {{ create: number; createOptions: any; ask: string[]; dispose: number }} */
  const calls = { create: 0, createOptions: null, ask: [], dispose: 0 };
  const create = (/** @type {any} */ options) => {
    calls.create += 1;
    calls.createOptions = options;
    events.push("create");
    return {
      async ask(/** @type {string} */ content) {
        calls.ask.push(content);
        events.push("ask");
        if (spec.askImpl) return spec.askImpl(content);
        const name = /本体のファイル名: `([^`]+)`/.exec(content);
        if (spec.writes !== false && name && options && typeof options.cwd === "string") {
          touch(options.cwd, `fake-topic/${name[1]}`, "ダミーの本体\n");
        }
        return { replyText: "済み" };
      },
      async dispose() {
        calls.dispose += 1;
        events.push("dispose");
      }
    };
  };
  return { create, calls, events };
}

/**
 * @param {string[]} events
 * @param {any} [result]  配列なら呼ばれた順に返す（尽きたら最後のものを返し続ける）。
 */
function makeFakeCommit(events, result = { ok: true, committed: true, commit: "abc1234" }) {
  /** @type {any[]} */
  const calls = [];
  const commitImpl = async (/** @type {any} */ options) => {
    calls.push(options);
    events.push("commit");
    if (Array.isArray(result)) return result[Math.min(calls.length, result.length) - 1];
    return result;
  };
  return { commitImpl, calls };
}

const RECORD = Object.freeze({ dateJst: "2026-10-21", baseName: "2026-10-21" });

test("writeStreamRecord: ②を cwd=記憶のフォルダ・workspace-write・最後の答えだけで作り、ask→dispose→commit の順", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { create, calls, events } = makeFakeCreate();
  const commit = makeFakeCommit(events);
  const result = await writeStreamRecord({
    create,
    entries: [
      { text: "ダミーの話", speaker: "you" },
      { text: "ダミーのコメント", speaker: "viewer", displayName: "ダミー視聴者名" }
    ],
    record: { dateJst: "2026-10-21", baseName: "2026-10-21-2" },
    dir,
    commitImpl: commit.commitImpl
  });
  assert.deepEqual(result, { written: true, commit: { ok: true, committed: true, commit: "abc1234" } });
  assert.deepEqual(events, ["create", "ask", "dispose", "commit"]);
  assert.equal(calls.create, 1);
  assert.equal(calls.createOptions.cwd, dir);
  assert.equal(calls.createOptions.sandbox, "workspace-write");
  assert.equal(calls.createOptions.finalAnswerOnly, true);
  assert.equal(calls.createOptions.ephemeral, true, "使い捨て（記録ファイルを作らない・掃除しない）");
  assert.equal(calls.createOptions.systemPrompt, WRITER_SYSTEM_PROMPT);
  // 頼む内容に今回の配信の識別（日付とファイル名）が入り、視聴者名は入らない。
  assert.equal(calls.ask.length, 1);
  assert.match(calls.ask[0], /2026-10-21-2\.md/);
  assert.match(calls.ask[0], /配信の日付（日本時間）: 2026-10-21/);
  assert.match(calls.ask[0], /viewer: ダミーのコメント/);
  assert.ok(!calls.ask[0].includes("ダミー視聴者名"));
  // コミットは記憶のフォルダに、役名「書き出し役」で。
  assert.deepEqual(commit.calls, [{ dir, role: "書き出し役" }]);
});

test("writeStreamRecord: 2 回目の保存では、前回書いた今回の本体を頼む内容に載せる", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md");
  const { create, calls, events } = makeFakeCreate();
  const commit = makeFakeCommit(events);
  await writeStreamRecord({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir, commitImpl: commit.commitImpl });
  assert.match(calls.ask[0], /すでにあります: topic-a\/2026-10-21\.md/);
});

test("writeStreamRecord: 空転写なら②を作らず、コミットもしない", async () => {
  const { create, calls, events } = makeFakeCreate();
  const commit = makeFakeCommit(events);
  const result = await writeStreamRecord({ create, entries: [], record: RECORD, dir: os.tmpdir(), commitImpl: commit.commitImpl });
  assert.deepEqual(result, { written: false });
  assert.equal(calls.create, 0);
  assert.equal(commit.calls.length, 0);
});

test("writeStreamRecord: ask が失敗しても dispose とコミット（書きかけを残す）をしてから throw する", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { create, calls, events } = makeFakeCreate({
    askImpl: async () => {
      throw new Error("ask failed (fake)");
    }
  });
  const commit = makeFakeCommit(events);
  await assert.rejects(
    () => writeStreamRecord({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir, commitImpl: commit.commitImpl }),
    /ask failed \(fake\)/
  );
  assert.equal(calls.dispose, 1);
  assert.deepEqual(events, ["create", "ask", "dispose", "commit"]);
});

test("writeStreamRecord: コミットの失敗は throw せず、警告で知らせる（中身は書かない）", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { create, events } = makeFakeCreate();
  const commit = makeFakeCommit(events, { ok: false, error: "git commit: exited 1" });
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create,
    entries: [{ text: "秘密っぽいダミー本文", speaker: "you" }],
    record: RECORD,
    dir,
    commitImpl: commit.commitImpl,
    onWarning: (w) => warnings.push(w)
  });
  assert.equal(result.written, true);
  assert.deepEqual(warnings, ["memory: commit failed (git commit: exited 1)"]);
});

test("writeStreamRecord: onWarning は②のセッションにも渡る（config/read の失敗などを拾うため）", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { create, calls, events } = makeFakeCreate();
  const commit = makeFakeCommit(events);
  const onWarning = () => {};
  await writeStreamRecord({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir, commitImpl: commit.commitImpl, onWarning });
  assert.equal(calls.createOptions.onWarning, onWarning);
});

test("writeStreamRecord: 1 回目の保存で②が本体を書かずに答え、やり直しでも書かなければ written:false（missing）で警告する（やり直しは 1 回だけ・毎回コミットはする）", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "fake-topic/2026-10-20.md"); // ほかの日の本体は数えない。
  const { create, calls, events } = makeFakeCreate({ writes: false });
  const commit = makeFakeCommit(events, { ok: true, committed: false });
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create,
    entries: [{ text: "x", speaker: "you" }],
    record: RECORD,
    dir,
    commitImpl: commit.commitImpl,
    onWarning: (w) => warnings.push(w)
  });
  assert.deepEqual(result, { written: false, missing: true, commit: { ok: true, committed: false } });
  assert.deepEqual(events, ["create", "ask", "dispose", "commit", "create", "ask", "dispose", "commit"]);
  assert.equal(calls.create, 2);
  assert.equal(calls.dispose, 2);
  assert.deepEqual(warnings, [WRITER_MISS_RETRY_WARNING, WRITER_MISS_WARNING]);
  assert.equal(WRITER_MISS_WARNING, "memory: the writer finished without writing this stream's record");
});

test("writeStreamRecord: 1 回目の保存で②が書かずに答えたら、同じ材料で新しいセッションを作って 1 回だけやり直し、書けたら written:true", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let asks = 0;
  const { create, calls, events } = makeFakeCreate({
    askImpl: async () => {
      asks += 1;
      if (asks === 2) touch(dir, "fake-topic/2026-10-21.md", "ダミーの本体\n");
      return { replyText: "済み" };
    }
  });
  const commit = makeFakeCommit(events, [
    { ok: true, committed: false },
    { ok: true, committed: true, commit: "def5678" }
  ]);
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create,
    entries: [{ text: "x", speaker: "you" }],
    record: RECORD,
    dir,
    commitImpl: commit.commitImpl,
    onWarning: (w) => warnings.push(w)
  });
  assert.deepEqual(result, { written: true, commit: { ok: true, committed: true, commit: "def5678" } });
  assert.equal(calls.create, 2);
  assert.equal(calls.ask.length, 2);
  assert.equal(calls.ask[1], calls.ask[0]); // 同じ材料・同じ頼み。
  assert.deepEqual(commit.calls, [
    { dir, role: "書き出し役" },
    { dir, role: "書き出し役" }
  ]);
  assert.deepEqual(warnings, [WRITER_MISS_RETRY_WARNING]);
});

test("writeStreamRecord: 1 回目の保存で目次だけ書いて本体を書かなくても（コミットはある）、本体が無いのでやり直す", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { create, calls, events } = makeFakeCreate({ writes: false });
  const commit = makeFakeCommit(events, { ok: true, committed: true, commit: "abc1234" });
  const result = await writeStreamRecord({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir, commitImpl: commit.commitImpl });
  assert.equal(result.written, false);
  assert.equal(calls.create, 2);
});

test("writeStreamRecord: 2 回目以降の保存で、コミットが変更なしなら書き損じとみなして 1 回だけやり直す", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md"); // 前回の保存で書いた今回の本体。
  const { create, calls, events } = makeFakeCreate({ writes: false });
  const commit = makeFakeCommit(events, [
    { ok: true, committed: false },
    { ok: true, committed: true, commit: "def5678" }
  ]);
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create,
    entries: [{ text: "x", speaker: "you" }],
    record: RECORD,
    dir,
    commitImpl: commit.commitImpl,
    onWarning: (w) => warnings.push(w)
  });
  assert.deepEqual(result, { written: true, commit: { ok: true, committed: true, commit: "def5678" } });
  assert.equal(calls.create, 2);
  assert.equal(calls.ask[1], calls.ask[0]);
  assert.match(calls.ask[1], /すでにあります: topic-a\/2026-10-21\.md/);
  assert.deepEqual(warnings, [WRITER_MISS_RETRY_WARNING]);
});

test("writeStreamRecord: 2 回目以降の保存で、やり直しも変更なしなら written:false（記録できなかった扱い）", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md");
  const { create, calls, events } = makeFakeCreate({ writes: false });
  const commit = makeFakeCommit(events, { ok: true, committed: false });
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create,
    entries: [{ text: "x", speaker: "you" }],
    record: RECORD,
    dir,
    commitImpl: commit.commitImpl,
    onWarning: (w) => warnings.push(w)
  });
  assert.deepEqual(result, { written: false, missing: true, commit: { ok: true, committed: false } });
  assert.equal(calls.create, 2);
  assert.deepEqual(warnings, [WRITER_MISS_RETRY_WARNING, WRITER_MISS_WARNING]);
});

test("writeStreamRecord: 2 回目以降の保存で、コミットに変更があればやり直さない", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md");
  const { create, calls, events } = makeFakeCreate({ writes: false });
  const commit = makeFakeCommit(events);
  const result = await writeStreamRecord({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir, commitImpl: commit.commitImpl });
  assert.equal(result.written, true);
  assert.equal(calls.create, 1);
});

test("writeStreamRecord: 2 回目以降の保存でコミットに失敗したときは判断できないので、やり直さない（失敗は警告済み）", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md");
  const { create, calls, events } = makeFakeCreate({ writes: false });
  const commit = makeFakeCommit(events, { ok: false, error: "git commit: exited 1" });
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create,
    entries: [{ text: "x", speaker: "you" }],
    record: RECORD,
    dir,
    commitImpl: commit.commitImpl,
    onWarning: (w) => warnings.push(w)
  });
  assert.equal(result.written, true);
  assert.equal(calls.create, 1);
  assert.deepEqual(warnings, ["memory: commit failed (git commit: exited 1)"]);
});

test("writeStreamRecord: ask の失敗はやり直さない（コミットしてから throw）", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  touch(dir, "topic-a/2026-10-21.md");
  const { create, calls, events } = makeFakeCreate({
    askImpl: async () => {
      throw new Error("ask failed (fake)");
    }
  });
  const commit = makeFakeCommit(events, { ok: true, committed: false });
  await assert.rejects(
    () => writeStreamRecord({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir, commitImpl: commit.commitImpl }),
    /ask failed \(fake\)/
  );
  assert.equal(calls.create, 1);
  assert.equal(commit.calls.length, 1);
});

test("writeStreamRecord: やり直しの ask が失敗したら、コミットしてから throw する", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  let asks = 0;
  const { create, calls, events } = makeFakeCreate({
    askImpl: async () => {
      asks += 1;
      if (asks === 2) throw new Error("retry ask failed (fake)");
      return { replyText: "済み" };
    }
  });
  const commit = makeFakeCommit(events, { ok: true, committed: false });
  await assert.rejects(
    () => writeStreamRecord({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir, commitImpl: commit.commitImpl }),
    /retry ask failed \(fake\)/
  );
  assert.equal(calls.create, 2);
  assert.equal(calls.dispose, 2);
  assert.equal(commit.calls.length, 2);
});

test("writeStreamRecord: create と record が無ければ TypeError", async () => {
  await assert.rejects(() => writeStreamRecord(/** @type {any} */ ({ entries: [{ text: "x" }], record: RECORD })), TypeError);
  await assert.rejects(
    () => writeStreamRecord(/** @type {any} */ ({ create: () => ({}), entries: [{ text: "x" }] })),
    TypeError
  );
});

test("writeStreamRecord: dir が無ければ TypeError（配信の組み直し Domain B: 既定の置き場=記憶の根へは書かない）", async () => {
  const { create, calls } = makeFakeCreate();
  await assert.rejects(
    () => writeStreamRecord(/** @type {any} */ ({ create, entries: [{ text: "x", speaker: "you" }], record: RECORD })),
    /options\.dir is required/
  );
  assert.equal(calls.create, 0, "②を作らない");
});

test("writeStreamRecord: 本物の git の通し（試験用の記憶のフォルダに偽物の②が書き、書き出し役のコミットが 1 つ積まれる）", async (t) => {
  const root = tmpDir();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, "memories");
  const prepared = await prepareMemoryFolder({ dir });
  assert.equal(prepared.ok, true);
  const git = (/** @type {string[]} */ args) => execFileSync("git", pinnedGitArgs(dir, args), { cwd: dir, encoding: "utf8" });
  // 準備ではコミットしない（_conventions.md は未コミットのまま、最初の書き出しで入る）。
  const writerCreate = (/** @type {any} */ options) => ({
    async ask() {
      touch(options.cwd, "dummy-topic/2026-10-21.md", "ダミーの本体\n");
      touch(options.cwd, "dummy-topic/_map.md", "- ダミー\n");
      touch(options.cwd, "_map.md", "- dummy-topic\n");
      return { replyText: "済み" };
    },
    async dispose() {}
  });
  const result = await writeStreamRecord({ create: writerCreate, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir });
  assert.equal(result.written, true);
  assert.equal(/** @type {any} */ (result).commit.committed, true);
  assert.equal(git(["log", "--format=%s"]).trim().split("\n").length, 1);
  assert.match(git(["log", "-1", "--format=%s"]), /^書き出し役 \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+09:00/);
  assert.equal(git(["status", "--porcelain"]).trim(), "");
  assert.equal(readFileSync(path.join(dir, "dummy-topic", "2026-10-21.md"), "utf8"), "ダミーの本体\n");

  // 2 回目の保存で②が何も書かずに答えると、本物の git でも「変更なし」になり、1 回だけやり直してから
  // 記録できなかった扱いになる（コミットは増えない・作業ツリーは clean のまま）。
  let idleAsks = 0;
  const idleCreate = () => ({
    async ask() {
      idleAsks += 1;
      return { replyText: "済み" };
    },
    async dispose() {}
  });
  const second = await writeStreamRecord({ create: idleCreate, entries: [{ text: "x", speaker: "you" }], record: RECORD, dir });
  assert.equal(second.written, false);
  assert.equal(idleAsks, 2);
  assert.equal(git(["log", "--format=%s"]).trim().split("\n").length, 1);
  assert.equal(git(["status", "--porcelain"]).trim(), "");
});
