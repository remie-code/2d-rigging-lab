// @ts-check
/**
 * memory-store.mjs の、③整理役のための git の口のテスト(記憶の整理 Domain B)。
 * OS の temp 配下で実際に git を動かす(ネット不要)。記憶の中身は使わず、固定値は無害な文字列だけ。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MEMORY_GIT_USER_EMAIL,
  MEMORY_GIT_USER_NAME,
  NO_CHANGES_COMMIT_SUFFIX,
  buildNoChangesCommitMessage,
  commitMemoryChanges,
  commitMemoryEmpty,
  createMemoryBundle,
  listMemoryTreeFiles,
  parseLsFilesStageZ,
  parseLsTreeZ,
  parseMemoryLogZ,
  pinnedGitArgs,
  prepareMemoryFolder,
  readMemoryLog,
  resetMemoryToCommit,
  stageAndListMemoryFiles
} from "./memory-store.mjs";

function makeTemp() {
  return mkdtempSync(join(tmpdir(), "memory-store-organizer-test-"));
}

/**
 * @param {string} dir
 * @param {string[]} args
 */
function git(dir, args) {
  return execFileSync("git", pinnedGitArgs(dir, args), { cwd: dir, encoding: "utf8" });
}

/** @param {string} dir */
async function preparedDir(dir) {
  const prepared = await prepareMemoryFolder({ dir });
  assert.equal(prepared.ok, true);
}

/**
 * @param {string} dir
 * @param {string} path
 * @param {string} text
 */
function put(dir, path, text) {
  const full = join(dir, ...path.split("/"));
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, text, "utf8");
}

const NUL = "\x00";
const US = "\x1f";
const AT = new Date("2026-11-05T05:00:00Z"); // 日本時間 2026-11-05 14:00:00

// ── 純関数 ──────────────────────────────────────────────────────────────────

test("buildNoChangesCommitMessage: `<役名> <日本時間>(変更なし)`(括弧は ASCII)", () => {
  assert.strictEqual(NO_CHANGES_COMMIT_SUFFIX, "(変更なし)");
  assert.strictEqual(buildNoChangesCommitMessage("整理役", AT), "整理役 2026-11-05 14:00:00 +09:00(変更なし)");
});

test("parseMemoryLogZ: NUL 区切りのコミットを、ハッシュ・時刻・本文に分ける(形の合わないものは飛ばす)", () => {
  const a = "a".repeat(40);
  const b = "b".repeat(40);
  const out = [
    `${a}${US}1762318800${US}整理役 2026-11-05 14:00:00 +09:00`,
    `\n${b}${US}100${US}Revert "x${US}y"`,
    "broken",
    ""
  ].join(NUL);
  assert.deepEqual(parseMemoryLogZ(out), [
    { commit: a, committedAtMs: 1762318800000, subject: "整理役 2026-11-05 14:00:00 +09:00" },
    { commit: b, committedAtMs: 100000, subject: `Revert "x${US}y"` }
  ]);
  assert.deepEqual(parseMemoryLogZ(""), []);
});

test("parseLsTreeZ: blob だけを取り、日本語の名前をそのまま返す", () => {
  const out = [
    "100644 blob 1111111111111111111111111111111111111111\t雑談/2026-10-21.md",
    "160000 commit 2222222222222222222222222222222222222222\tsub",
    ""
  ].join(NUL);
  assert.deepEqual(parseLsTreeZ(out), [
    { path: "雑談/2026-10-21.md", mode: "100644", object: "1111111111111111111111111111111111111111" }
  ]);
});

test("parseLsFilesStageZ: 段 0 だけを取り、入れ子の git は取らない", () => {
  const out = [
    "100644 1111111111111111111111111111111111111111 0\ta.md",
    "100644 3333333333333333333333333333333333333333 2\tb.md",
    "160000 2222222222222222222222222222222222222222 0\tsub",
    ""
  ].join(NUL);
  assert.deepEqual(parseLsFilesStageZ(out), [
    { path: "a.md", mode: "100644", object: "1111111111111111111111111111111111111111" }
  ]);
});

// ── readMemoryLog ───────────────────────────────────────────────────────────

test("readMemoryLog: `.git` が無ければ git を呼ばずに失敗で返す・dir は必須", async () => {
  const root = makeTemp();
  try {
    const result = await readMemoryLog({ dir: root });
    assert.equal(result.ok, false);
    assert.equal(existsSync(join(root, ".git")), false);
    // @ts-expect-error dir を省いた呼び間違い
    const missing = await readMemoryLog({});
    assert.equal(missing.ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readMemoryLog: コミットが無ければ空・あれば新しい順に、日本語の本文を壊さずに返す", async () => {
  const root = makeTemp();
  try {
    execFileSync("git", ["init", "--quiet", root], { cwd: root });
    for (const [key, value] of [
      ["user.name", MEMORY_GIT_USER_NAME],
      ["user.email", MEMORY_GIT_USER_EMAIL],
      ["core.autocrlf", "false"]
    ]) {
      git(root, ["config", "--local", key, value]);
    }
    assert.deepEqual(await readMemoryLog({ dir: root }), { ok: true, commits: [] });

    put(root, "雑談/2026-10-21.md", "一\n");
    assert.equal((await commitMemoryChanges({ dir: root, role: "書き出し役", at: AT })).ok, true);
    assert.equal((await commitMemoryEmpty({ dir: root, role: "整理役", at: AT })).ok, true);

    const log = await readMemoryLog({ dir: root });
    assert.equal(log.ok, true);
    if (!log.ok) return;
    assert.deepEqual(
      log.commits.map((c) => c.subject),
      ["整理役 2026-11-05 14:00:00 +09:00(変更なし)", "書き出し役 2026-11-05 14:00:00 +09:00"]
    );
    assert.equal(log.commits[0].commit, git(root, ["rev-parse", "HEAD"]).trim());
    for (const c of log.commits) assert.ok(Number.isFinite(c.committedAtMs) && c.committedAtMs > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── commitMemoryEmpty ───────────────────────────────────────────────────────

test("commitMemoryEmpty: 変更が無ければ空のコミットを積み、本文は `整理役 <日時>(変更なし)`", async () => {
  const root = makeTemp();
  try {
    await preparedDir(root);
    const before = git(root, ["rev-parse", "HEAD"]).trim();
    const result = await commitMemoryEmpty({ dir: root, role: "整理役", at: AT });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    assert.equal(result.commit, head);
    assert.notEqual(head, before);
    assert.equal(git(root, ["log", "-1", "--format=%s"]).trim(), "整理役 2026-11-05 14:00:00 +09:00(変更なし)");
    assert.equal(git(root, ["diff-tree", "--no-commit-id", "-r", "--name-only", "HEAD"]).trim(), "");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("commitMemoryEmpty: コミットされていない変更があれば積まない・役名の誤り・.git が無いときも失敗で返す", async () => {
  const root = makeTemp();
  const bare = makeTemp();
  try {
    await preparedDir(root);
    const before = git(root, ["rev-parse", "HEAD"]).trim();
    put(root, "t/2026-10-21.md", "x\n");
    const dirty = await commitMemoryEmpty({ dir: root, role: "整理役", at: AT });
    assert.equal(dirty.ok, false);
    assert.equal(git(root, ["rev-parse", "HEAD"]).trim(), before);
    assert.equal((await commitMemoryEmpty({ dir: root, role: "a\nb", at: AT })).ok, false);
    assert.equal((await commitMemoryEmpty({ dir: bare, role: "整理役", at: AT })).ok, false);
    assert.equal(existsSync(join(bare, ".git")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
});

// ── createMemoryBundle ──────────────────────────────────────────────────────

test("createMemoryBundle: git を丸ごと 1 つのファイルに固める(git bundle verify が通る)", async () => {
  const root = makeTemp();
  const out = makeTemp();
  try {
    await preparedDir(root);
    put(root, "雑談/2026-10-21.md", "一\n");
    await commitMemoryChanges({ dir: root, role: "書き出し役", at: AT });
    const file = join(out, "2026-11-05_14-00-00.bundle");
    const result = await createMemoryBundle({ dir: root, file });
    assert.deepEqual(result, { ok: true, file });
    assert.ok(statSync(file).size > 0);
    execFileSync("git", ["bundle", "verify", "--quiet", file], { cwd: root, stdio: "pipe" });
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});

test("createMemoryBundle: 相対パス・置き場が無い・.git が無いときは失敗で返す", async () => {
  const root = makeTemp();
  const bare = makeTemp();
  try {
    await preparedDir(root);
    assert.equal((await createMemoryBundle({ dir: root, file: "x.bundle" })).ok, false);
    assert.equal((await createMemoryBundle({ dir: root, file: join(bare, "no-such-folder", "x.bundle") })).ok, false);
    assert.equal((await createMemoryBundle({ dir: bare, file: join(bare, "x.bundle") })).ok, false);
    assert.equal(existsSync(join(bare, "x.bundle")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
});

// ── listMemoryTreeFiles / stageAndListMemoryFiles ───────────────────────────

test("listMemoryTreeFiles: HEAD の木のファイルを、日本語の名前と中身のハッシュで返す", async () => {
  const root = makeTemp();
  try {
    await preparedDir(root);
    put(root, "雑談/2026-10-21.md", "一\n");
    await commitMemoryChanges({ dir: root, role: "書き出し役", at: AT });
    const result = await listMemoryTreeFiles({ dir: root });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const body = result.files.find((f) => f.path === "雑談/2026-10-21.md");
    assert.ok(body);
    const expected = execFileSync("git", ["hash-object", join(root, "雑談", "2026-10-21.md")], { encoding: "utf8" }).trim();
    assert.equal(body.object, expected);
    assert.ok(result.files.some((f) => f.path === "_conventions.md"));
    assert.equal((await listMemoryTreeFiles({ dir: root, commit: "--bad" })).ok, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stageAndListMemoryFiles: 動かした・足したファイルを index に載せて返す(.gitignore されたものは載らない)・コミットはしない", async () => {
  const root = makeTemp();
  try {
    await preparedDir(root);
    put(root, "雑談/2026-10-21.md", "一\n");
    await commitMemoryChanges({ dir: root, role: "書き出し役", at: AT });
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    const blob = git(root, ["rev-parse", "HEAD:雑談/2026-10-21.md"]).trim();

    mkdirSync(join(root, "雑談", "2026", "10"), { recursive: true });
    renameSync(join(root, "雑談", "2026-10-21.md"), join(root, "雑談", "2026", "10", "2026-10-21.md"));
    put(root, "雑談/_map.md", "目次\n");
    put(root, ".gitignore", "ignored.md\n");
    put(root, "ignored.md", "x\n");

    const result = await stageAndListMemoryFiles({ dir: root });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const paths = result.files.map((f) => f.path).sort();
    assert.deepEqual(paths, [".gitignore", "_conventions.md", "雑談/2026/10/2026-10-21.md", "雑談/_map.md"]);
    assert.equal(result.files.find((f) => f.path === "雑談/2026/10/2026-10-21.md")?.object, blob);
    assert.equal(git(root, ["rev-parse", "HEAD"]).trim(), head);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("stageAndListMemoryFiles: .git が無ければ git を呼ばずに失敗で返す", async () => {
  const bare = makeTemp();
  try {
    assert.equal((await stageAndListMemoryFiles({ dir: bare })).ok, false);
    assert.equal(existsSync(join(bare, ".git")), false);
  } finally {
    rmSync(bare, { recursive: true, force: true });
  }
});

// ── resetMemoryToCommit ─────────────────────────────────────────────────────

test("resetMemoryToCommit: 後ろに積まれたコミットと未コミットの変更・追跡外を消して、そのコミットの状態へ戻す(.gitignore されたものは残す)", async () => {
  const root = makeTemp();
  try {
    await preparedDir(root);
    put(root, ".gitignore", "ignored.txt\n");
    put(root, "雑談/2026-10-21.md", "一\n");
    await commitMemoryChanges({ dir: root, role: "書き出し役", at: AT });
    const before = git(root, ["rev-parse", "HEAD"]).trim();

    put(root, "雑談/2026-10-21.md", "書き換え\n");
    put(root, "雑談/_map.md", "目次\n");
    await commitMemoryChanges({ dir: root, role: "整理役", at: AT });
    const later = git(root, ["rev-parse", "HEAD"]).trim();
    put(root, "雑談/2026-10-21.md", "未コミット\n");
    put(root, "stray/2026-01-01.md", "追跡外\n");
    put(root, "ignored.txt", "残す\n");

    assert.deepEqual(await resetMemoryToCommit({ dir: root, commit: before }), { ok: true });
    assert.equal(git(root, ["rev-parse", "HEAD"]).trim(), before);
    assert.ok(!git(root, ["log", "--format=%H", "HEAD"]).includes(later));
    assert.equal(git(root, ["status", "--porcelain", "--untracked-files=all"]), "");
    assert.equal(readFileSync(join(root, "雑談", "2026-10-21.md"), "utf8"), "一\n");
    assert.equal(existsSync(join(root, "雑談", "_map.md")), false);
    assert.equal(existsSync(join(root, "stray")), false);
    assert.equal(readFileSync(join(root, "ignored.txt"), "utf8"), "残す\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("resetMemoryToCommit: コミットの形でない値・dir の省略・.git が無いときは git を呼ばずに失敗で返す", async () => {
  const root = makeTemp();
  const bare = makeTemp();
  try {
    await preparedDir(root);
    const head = git(root, ["rev-parse", "HEAD"]).trim();
    put(root, "t/2026-10-21.md", "x\n");
    for (const commit of ["--hard", "-x", "main", "", "HEAD~1"]) {
      assert.equal((await resetMemoryToCommit({ dir: root, commit })).ok, false, commit);
    }
    // @ts-expect-error commit を省いた呼び間違い
    assert.equal((await resetMemoryToCommit({ dir: root })).ok, false);
    // 何も触っていない。
    assert.equal(git(root, ["rev-parse", "HEAD"]).trim(), head);
    assert.ok(existsSync(join(root, "t", "2026-10-21.md")));
    // @ts-expect-error dir を省いた呼び間違い
    assert.equal((await resetMemoryToCommit({ commit: head })).ok, false);
    assert.equal((await resetMemoryToCommit({ dir: bare, commit: head })).ok, false);
    assert.equal(existsSync(join(bare, ".git")), false);
    // 無いコミットは git が断る。
    assert.equal((await resetMemoryToCommit({ dir: root, commit: "0".repeat(40) })).ok, false);
    assert.equal(git(root, ["rev-parse", "HEAD"]).trim(), head);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(bare, { recursive: true, force: true });
  }
});
