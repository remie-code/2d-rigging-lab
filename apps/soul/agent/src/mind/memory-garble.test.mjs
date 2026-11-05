// @ts-check
/**
 * memory.mjs のテスト（Discord モード Domain L: ②書き出し役の書き込みが「?」に化けたら取り消してやり直す）。
 *
 * 上位文書: [writer-garble-2026-11-01.md](../../../../../discussion/ai-cohost/memory/writer-garble-2026-11-01.md) §5。
 *
 * 頭は偽物（実 LLM・Codex 消費ゼロ）。記憶のフォルダは OS temp のスクラッチだけを使い、本物の
 * `apps/soul/agent/memories/` には触れない。git は一時フォルダの本物の git（memory-store の prepare / commit /
 * 足された行 / 取り消し・ネット不要）。固定値は無害なダミー文だけ。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildWriterSystemPrompt,
  hasGarbledLines,
  isGarbledLine,
  writeStreamRecord,
  WRITER_SYSTEM_PROMPT,
  WRITER_GARBLED_RETRY_WARNING,
  WRITER_GARBLED_WARNING,
  WRITER_GARBLED_REVERT_FAILED_WARNING,
  WRITER_GARBLE_CHECK_FAILED_WARNING,
  WRITER_MISS_RETRY_WARNING,
  WRITER_MISS_WARNING,
  createStreamRecordLog
} from "./memory.mjs";
import { CALL_WORDING } from "./venue-wording.mjs";
import { commitMemoryChanges, pinnedGitArgs, prepareMemoryFolder } from "../memory/memory-store.mjs";

const WRITER_SENTENCE =
  "ファイルは、ファイルを直接書き換える道具で書いてください。シェルのパイプやスクリプトに日本語を通して書くと、文字が「?」に化けます。";

/** 今回の形（シェルのパイプを通って 1 文字ずつ「?」に落ちた本体）。 */
const GARBLED_BODY = "# ????????\n\n- ??????????????\n- ?? 2 ????????\n";
const GOOD_BODY = "# ダミーの配信\n\n- ダミーの出来事があった。\n";

/** 偽物の②が書く本体のファイル名（魂は名前を決めないので、偽物が自分で決める・記憶の整理 Domain A）。 */
const BODY_NAME = "2026-11-01";
/** 2026-11-01（日本時間）に始まった場の持ち回り（createStreamRecordLog）。 */
const newRecord = () => createStreamRecordLog({ startedAtMs: Date.UTC(2026, 10, 1, 3, 0, 0) });
/** 偽物のコミットと組む口（捨てる・変わったファイル）。偽物のハッシュを本物の git に読ませない。 */
const fakeDiscard = async () => /** @type {const} */ ({ ok: true });
const fakeChanged = async () => /** @type {const} */ ({ ok: true, files: [{ status: "A", path: `dummy-topic/${BODY_NAME}.md` }] });
const ENTRIES = Object.freeze([{ text: "ダミーの話", speaker: "you" }]);

// ── 1. 化けの見分け（純関数）──────────────────────────────────────────

test("isGarbledLine: `?` が 4 つ以上続き、ASCII 以外を含まない行は化け", () => {
  assert.equal(isGarbledLine("????"), true);
  assert.equal(isGarbledLine("# ????????"), true);
  assert.equal(isGarbledLine("- ?? 2 ????????"), true);
  assert.equal(isGarbledLine("| ???? | ?????? |"), true);
});

test("isGarbledLine: ふつうの日本語の「??」・英数字だけで `?` の 4 連が無い行・日本語を含む行は化けでない", () => {
  assert.equal(isGarbledLine("え、ほんとに??"), false, "ふつうの日本語の「??」");
  assert.equal(isGarbledLine("what??? really???"), false, "英数字だけで `?` の 4 連が無い");
  assert.equal(isGarbledLine("- elden-ring: 2026-11-01"), false);
  assert.equal(isGarbledLine("なにこれ????"), false, "`?` の 4 連があっても日本語を含む");
  assert.equal(isGarbledLine("？？？？"), false, "全角の「？」は ASCII の `?` ではない");
  assert.equal(isGarbledLine(""), false);
  assert.equal(isGarbledLine(/** @type {any} */ (null)), false);
});

test("hasGarbledLines: 化けの行が 1 行でもあれば化け・空や足された行なしは化けでない", () => {
  assert.equal(hasGarbledLines(["# ダミー", "- ????????"]), true);
  assert.equal(hasGarbledLines(["# ダミー", "え??", "what???"]), false);
  assert.equal(hasGarbledLines([]), false);
  assert.equal(hasGarbledLines([""]), false);
  assert.equal(hasGarbledLines(undefined), false);
  assert.equal(hasGarbledLines(null), false);
});

// ── 2. 指示の 1 文（配信・通話の両方）──────────────────────────────────

test("buildWriterSystemPrompt: ファイルを直接書き換える道具で書く旨の 1 文が、配信と通話の両方の固定の指示に入る", () => {
  assert.ok(WRITER_SYSTEM_PROMPT.includes(`このフォルダの外には書かないでください。${WRITER_SENTENCE}材料の`));
  assert.ok(buildWriterSystemPrompt(CALL_WORDING).includes(`このフォルダの外には書かないでください。${WRITER_SENTENCE}材料の`));
});

// ── 3. 偽物の②と一時フォルダの本物の git ─────────────────────────────

function tmpDir() {
  return mkdtempSync(path.join(os.tmpdir(), "memory-garble-test-"));
}

/** @param {string} dir @param {string} rel @param {string} body */
function put(dir, rel, body) {
  const full = path.join(dir, ...rel.split("/"));
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, body, "utf8");
}

/**
 * 試験用の記憶のフォルダ（一時フォルダ・本物の git）を用意する。
 * @param {import("node:test").TestContext} t
 * @param {{ baseCommit?: boolean }} [options]  baseCommit: 前の配信の記録を 1 つコミットしておく（ルートのコミットにしない）。
 */
async function prepareDir(t, options = {}) {
  const root = tmpDir();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, "memories");
  const prepared = await prepareMemoryFolder({ dir });
  assert.equal(prepared.ok, true);
  if (options.baseCommit) {
    put(dir, "old-topic/2026-10-31.md", "# ダミーの前の配信\n");
    put(dir, "_map.md", "- old-topic\n");
    const base = await commitMemoryChanges({ dir, role: "書き出し役" });
    assert.equal(base.ok && base.committed, true);
  }
  const git = (/** @type {string[]} */ args) => execFileSync("git", pinnedGitArgs(dir, args), { cwd: dir, encoding: "utf8" });
  const subjects = () => git(["log", "--format=%s"]).trim().split("\n").reverse();
  return { dir, git, subjects };
}

/**
 * 偽物の②（ask のたびに、渡された本文の並びの次を今回の本体と目次に書く・null なら何も書かない）。
 * @param {Array<string | null>} bodies
 * @param {{ topic?: string; baseName?: string; onAsk?: (cwd: string) => void }} [options]
 */
function makeWriter(bodies, options = {}) {
  const topic = options.topic ?? "dummy-topic";
  const baseName = options.baseName ?? BODY_NAME;
  const calls = { create: 0, ask: 0, dispose: 0 };
  const create = (/** @type {any} */ createOptions) => {
    calls.create += 1;
    return {
      async ask() {
        calls.ask += 1;
        options.onAsk?.(createOptions.cwd);
        const body = bodies[calls.ask - 1];
        if (typeof body === "string") {
          put(createOptions.cwd, `${topic}/${baseName}.md`, body);
          put(createOptions.cwd, `${topic}/_map.md`, body === GOOD_BODY ? "- ダミーの目次\n" : "- ????????\n");
        }
        return { replyText: "済み" };
      },
      async dispose() {
        calls.dispose += 1;
      }
    };
  };
  return { create, calls };
}

const REVERT_SUBJECT = /^Revert "書き出し役 /;
const WRITER_SUBJECT = /^書き出し役 /;

test("writeStreamRecord: 1 回目が化け → 取り消しのコミット → やり直しで正常なら written:true（本体に「?」が無い・警告は RETRY の 1 つ）", async (t) => {
  const { dir, git, subjects } = await prepareDir(t);
  const writer = makeWriter([GARBLED_BODY, GOOD_BODY]);
  /** @type {string[]} */
  const warnings = [];
  const record = newRecord();
  const result = await writeStreamRecord({ create: writer.create, entries: ENTRIES, record, dir, onWarning: (w) => warnings.push(w) });
  assert.equal(result.written, true);
  assert.equal(writer.calls.create, 2);
  assert.equal(writer.calls.dispose, 2);
  assert.deepEqual(warnings, [WRITER_GARBLED_RETRY_WARNING]);
  const log = subjects();
  assert.equal(log.length, 4);
  assert.match(log[0], /^魂 /, "準備で種だけがコミットされている（記憶の整理 Domain A）");
  assert.match(log[1], WRITER_SUBJECT);
  assert.match(log[2], REVERT_SUBJECT, "化けたコミットを取り消すコミットが積まれる（履歴は書き換えない）");
  assert.match(log[3], WRITER_SUBJECT);
  const body = readFileSync(path.join(dir, "dummy-topic", "2026-11-01.md"), "utf8");
  assert.equal(body, GOOD_BODY);
  assert.equal(body.includes("?"), false);
  assert.equal(git(["status", "--porcelain"]).trim(), "");
  // 種は準備でコミット済みなので、化けの取り消しで消えない（前は最初の保存がルートのコミットで、種も一緒に消えていた）。
  assert.equal(existsSync(path.join(dir, "_conventions.md")), true);
  assert.deepEqual(record.files(), ["dummy-topic/2026-11-01.md"]);
});

test("writeStreamRecord: やり直しでも化けたら、それも取り消して written:false（garbled）・本体は化けていない（前の状態のまま）・警告は RETRY → 最終", async (t) => {
  const { dir, git, subjects } = await prepareDir(t, { baseCommit: true });
  const headBefore = git(["rev-parse", "HEAD"]).trim();
  const writer = makeWriter([GARBLED_BODY, GARBLED_BODY]);
  /** @type {string[]} */
  const warnings = [];
  const record = newRecord();
  const result = await writeStreamRecord({ create: writer.create, entries: ENTRIES, record, dir, onWarning: (w) => warnings.push(w) });
  assert.equal(result.written, false);
  assert.equal(/** @type {any} */ (result).garbled, true);
  assert.equal(/** @type {any} */ (result).missing, undefined);
  assert.equal(writer.calls.create, 2, "やり直しは 1 回だけ");
  assert.deepEqual(warnings, [WRITER_GARBLED_RETRY_WARNING, WRITER_GARBLED_WARNING]);
  assert.deepEqual(record.files(), [], "取り消したコミットのファイルは持ち回りに足さない");
  const log = subjects();
  assert.equal(log.length, 6);
  assert.match(log[2], WRITER_SUBJECT);
  assert.match(log[3], REVERT_SUBJECT);
  assert.match(log[4], WRITER_SUBJECT);
  assert.match(log[5], REVERT_SUBJECT);
  // 中身は前の状態のまま（今回の本体は無く、前の配信の記録と目次はそのまま・作業ツリーは clean）。
  assert.equal(existsSync(path.join(dir, "dummy-topic", "2026-11-01.md")), false);
  assert.equal(readFileSync(path.join(dir, "old-topic", "2026-10-31.md"), "utf8"), "# ダミーの前の配信\n");
  assert.equal(git(["diff", "--stat", headBefore, "HEAD"]).trim(), "", "木は前のコミットと同じ");
  assert.equal(git(["status", "--porcelain"]).trim(), "");
});

test("writeStreamRecord: 1 回目が書き損じ → 2 回目が化けなら、合わせて 2 回で打ち止め（create は 2 回だけ・written:false）", async (t) => {
  const { dir, git, subjects } = await prepareDir(t, { baseCommit: true });
  const writer = makeWriter([null, GARBLED_BODY]);
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({ create: writer.create, entries: ENTRIES, record: newRecord(), dir, onWarning: (w) => warnings.push(w) });
  assert.equal(result.written, false);
  assert.equal(/** @type {any} */ (result).garbled, true);
  assert.equal(writer.calls.create, 2);
  assert.equal(writer.calls.ask, 2);
  assert.deepEqual(warnings, [WRITER_MISS_RETRY_WARNING, WRITER_GARBLED_WARNING]);
  const log = subjects();
  assert.equal(log.length, 4, "種 + 前の記録 + 化けたコミット + その取り消し（書き損じの回はコミットなし）");
  assert.match(log[3], REVERT_SUBJECT);
  assert.equal(existsSync(path.join(dir, "dummy-topic", "2026-11-01.md")), false);
  assert.equal(git(["status", "--porcelain"]).trim(), "");
});

test("writeStreamRecord: 1 回目が化け → 2 回目が書き損じでも、合わせて 2 回で打ち止め（written:false・missing）", async (t) => {
  const { dir } = await prepareDir(t, { baseCommit: true });
  const writer = makeWriter([GARBLED_BODY, null]);
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({ create: writer.create, entries: ENTRIES, record: newRecord(), dir, onWarning: (w) => warnings.push(w) });
  assert.equal(result.written, false);
  assert.equal(/** @type {any} */ (result).missing, true);
  assert.equal(writer.calls.create, 2);
  assert.deepEqual(warnings, [WRITER_GARBLED_RETRY_WARNING, WRITER_MISS_WARNING]);
});

test("writeStreamRecord: 2 回目以降の保存（今回の本体あり）で化けたら、取り消しで前の本体に戻ってからやり直す", async (t) => {
  const { dir, git, subjects } = await prepareDir(t, { baseCommit: true });
  const prevBody = "# ダミーの配信（前半）\n\n- 前半の出来事。\n";
  put(dir, "dummy-topic/2026-11-01.md", prevBody);
  const first = await commitMemoryChanges({ dir, role: "書き出し役" });
  assert.equal(first.ok && first.committed, true);

  /** @type {string[]} */
  const seenAtAsk = [];
  const writer = makeWriter([GARBLED_BODY, GOOD_BODY], {
    onAsk: (cwd) => seenAtAsk.push(readFileSync(path.join(cwd, "dummy-topic", "2026-11-01.md"), "utf8"))
  });
  /** @type {string[]} */
  const warnings = [];
  const record = newRecord();
  record.note(["dummy-topic/2026-11-01.md"]);
  const result = await writeStreamRecord({ create: writer.create, entries: ENTRIES, record, dir, onWarning: (w) => warnings.push(w) });
  assert.equal(result.written, true);
  assert.equal(writer.calls.create, 2);
  assert.deepEqual(seenAtAsk, [prevBody, prevBody], "やり直しの②は、取り消しで戻った前の本体を見る");
  assert.deepEqual(warnings, [WRITER_GARBLED_RETRY_WARNING]);
  const log = subjects();
  assert.equal(log.length, 6);
  assert.match(log[4], REVERT_SUBJECT);
  assert.equal(readFileSync(path.join(dir, "dummy-topic", "2026-11-01.md"), "utf8"), GOOD_BODY);
  assert.equal(git(["status", "--porcelain"]).trim(), "");
});

test("writeStreamRecord: 警告に中身（本文・ファイル名・トピック名・材料）が載らない（固定文だけ）", async (t) => {
  const { dir } = await prepareDir(t, { baseCommit: true });
  const record = newRecord();
  const writer = makeWriter(["secret-marker ????????\n", "secret-marker ????????\n"], { topic: "secret-topic", baseName: "2026-11-01-7" });
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create: writer.create,
    entries: [{ text: "秘密っぽいダミー本文", speaker: "viewer", displayName: "ダミー視聴者名" }],
    record,
    dir,
    onWarning: (w) => warnings.push(w)
  });
  assert.equal(result.written, false);
  assert.deepEqual(warnings, [WRITER_GARBLED_RETRY_WARNING, WRITER_GARBLED_WARNING]);
  for (const warning of warnings) {
    for (const leaked of ["secret-marker", "secret-topic", "2026-11-01-7", "秘密", "ダミー", "????", dir]) {
      assert.equal(warning.includes(leaked), false, leaked);
    }
    assert.equal(/[^\x00-\x7F]/.test(warning), false, "英語の固定文");
  }
});

// ── 4. 化けの確かめ・取り消しの失敗と ask の失敗（差し替えの口）──────────────────

/** @param {string[]} events */
function fakeCommit(events) {
  return async () => {
    events.push("commit");
    return /** @type {const} */ ({ ok: true, committed: true, commit: "abc1234" });
  };
}

test("writeStreamRecord: コミットが変更なし・コミットの失敗のときは、足された行を見ない", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  put(dir, "topic-a/2026-11-01.md", "x\n");
  let reads = 0;
  const addedLinesImpl = async () => {
    reads += 1;
    return /** @type {const} */ ({ ok: true, lines: ["????"] });
  };
  for (const commitResult of [{ ok: true, committed: false }, { ok: false, error: "git commit: exited 1" }]) {
    const writer = makeWriter([null, null]);
    await writeStreamRecord({
      create: writer.create,
      entries: ENTRIES,
      record: newRecord(),
      dir,
      commitImpl: /** @type {any} */ (async () => commitResult),
      addedLinesImpl,
      discardImpl: fakeDiscard
    });
  }
  assert.equal(reads, 0);
});

test("writeStreamRecord: 足された行が読めないときは、判断できないので書けたものとして扱う（固定文で警告・取り消さない）", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  /** @type {string[]} */
  const events = [];
  let reverts = 0;
  const writer = makeWriter([GOOD_BODY]);
  /** @type {string[]} */
  const warnings = [];
  const result = await writeStreamRecord({
    create: writer.create,
    entries: ENTRIES,
    record: newRecord(),
    dir,
    commitImpl: fakeCommit(events),
    changedFilesImpl: fakeChanged,
    discardImpl: fakeDiscard,
    addedLinesImpl: async () => ({ ok: false, error: "git diff-tree: exit 128 (fatal: secret-topic)" }),
    revertImpl: async () => {
      reverts += 1;
      return { ok: true, commit: "def5678" };
    },
    onWarning: (w) => warnings.push(w)
  });
  assert.equal(result.written, true);
  assert.equal(writer.calls.create, 1);
  assert.equal(reverts, 0);
  assert.deepEqual(warnings, [WRITER_GARBLE_CHECK_FAILED_WARNING]);
});

test("writeStreamRecord: 化けを取り消せなかったら、その上に重ねてやり直さず written:false（garbled）・固定文で警告", async (t) => {
  const dir = tmpDir();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  /** @type {string[]} */
  const events = [];
  /** @type {any[]} */
  const revertCalls = [];
  const writer = makeWriter([GARBLED_BODY, GOOD_BODY]);
  /** @type {string[]} */
  const warnings = [];
  const record = newRecord();
  const result = await writeStreamRecord({
    create: writer.create,
    entries: ENTRIES,
    record,
    dir,
    commitImpl: fakeCommit(events),
    changedFilesImpl: fakeChanged,
    discardImpl: fakeDiscard,
    addedLinesImpl: async () => ({ ok: true, lines: ["????????"] }),
    revertImpl: async (options) => {
      revertCalls.push(options);
      return { ok: false, error: "git revert: exit 1 (error: secret-topic)" };
    },
    onWarning: (w) => warnings.push(w)
  });
  assert.equal(result.written, false);
  assert.equal(/** @type {any} */ (result).garbled, true);
  assert.equal(writer.calls.create, 1);
  assert.deepEqual(revertCalls, [{ dir, commit: "abc1234" }], "化けたそのコミットを取り消す");
  assert.deepEqual(warnings, [WRITER_GARBLED_REVERT_FAILED_WARNING]);
  assert.deepEqual(record.files(), ["dummy-topic/2026-11-01.md"], "取り消せなかったコミットは HEAD に残るので、そのファイルは持ち回りに足す");
});

test("writeStreamRecord: ask が失敗した回でも、化けていれば取り消してから throw する（やり直さない）", async (t) => {
  const { dir, subjects } = await prepareDir(t, { baseCommit: true });
  let creates = 0;
  const create = (/** @type {any} */ options) => {
    creates += 1;
    return {
      async ask() {
        put(options.cwd, "dummy-topic/2026-11-01.md", GARBLED_BODY);
        throw new Error("ask failed (fake)");
      },
      async dispose() {}
    };
  };
  /** @type {string[]} */
  const warnings = [];
  const record = newRecord();
  await assert.rejects(
    () => writeStreamRecord({ create, entries: ENTRIES, record, dir, onWarning: (w) => warnings.push(w) }),
    /ask failed \(fake\)/
  );
  assert.equal(creates, 1);
  assert.deepEqual(warnings, [WRITER_GARBLED_WARNING]);
  const log = subjects();
  assert.equal(log.length, 4);
  assert.match(log[3], REVERT_SUBJECT);
  assert.equal(existsSync(path.join(dir, "dummy-topic", "2026-11-01.md")), false);
  assert.deepEqual(record.files(), [], "取り消したコミットのファイルは持ち回りに足さない");
});

test("writeStreamRecord: 化けて取り消した回のファイルは持ち回りに足さず、やり直しで書いたファイルだけを足す（本物の git）", async (t) => {
  const { dir } = await prepareDir(t, { baseCommit: true });
  let asks = 0;
  const create = (/** @type {any} */ options) => ({
    async ask() {
      asks += 1;
      if (asks === 1) put(options.cwd, "garbled-topic/2026-11-01.md", GARBLED_BODY);
      else put(options.cwd, "good-topic/2026-11-01.md", GOOD_BODY);
      return { replyText: "済み" };
    },
    async dispose() {}
  });
  const record = newRecord();
  const result = await writeStreamRecord({ create, entries: ENTRIES, record, dir });
  assert.equal(result.written, true);
  assert.equal(asks, 2);
  assert.deepEqual(record.files(), ["good-topic/2026-11-01.md"]);
  assert.equal(existsSync(path.join(dir, "garbled-topic")), false);
});
