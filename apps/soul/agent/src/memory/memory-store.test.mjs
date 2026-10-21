// @ts-check
/**
 * memory-store.mjs のテスト(記憶の作り直し Wave 1 Domain B)。
 * OS の temp 配下で実際に git を動かす(ネット不要)。記憶の中身は使わず、固定値は無害な文字列だけ。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  CONVENTIONS_FILE_NAME,
  CONVENTIONS_SEED_PATH,
  DEFAULT_MEMORY_DIR,
  MEMORY_GIT_USER_EMAIL,
  MEMORY_GIT_USER_NAME,
  buildCommitMessage,
  commitMemoryChanges,
  formatJst,
  pinnedGitArgs,
  prepareMemoryFolder
} from "./memory-store.mjs";

function makeTemp() {
  return mkdtempSync(join(tmpdir(), "memory-store-test-"));
}

/**
 * テスト側から記憶のフォルダの git を読む(親リポジトリを触らないよう固定する)。
 * @param {string} dir
 * @param {string[]} args
 */
function git(dir, args) {
  return execFileSync("git", pinnedGitArgs(dir, args), { cwd: dir, encoding: "utf8" });
}

/** @param {string} dir */
function commitCount(dir) {
  return Number(git(dir, ["rev-list", "--count", "HEAD"]).trim());
}

test("DEFAULT_MEMORY_DIR は apps/soul/agent/memories を指す", () => {
  assert.match(DEFAULT_MEMORY_DIR.replace(/\\/g, "/"), /apps\/soul\/agent\/memories$/);
});

test("種は conventions-draft の本文(見出しから始まり、たたき台のメモを含まない)", () => {
  const seed = readFileSync(CONVENTIONS_SEED_PATH, "utf8");
  assert.ok(seed.startsWith("# 記憶の置き場の決まり"));
  assert.ok(!seed.includes("たたき台"));
  assert.ok(seed.includes("視聴者の名前"));
});

test("prepareMemoryFolder: 無いフォルダを作り、git init し、ローカル設定と種を置く", async (t) => {
  const root = makeTemp();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, "nested", "memories");

  const result = await prepareMemoryFolder({ dir });
  assert.deepEqual(result, { ok: true, dir, createdDir: true, initializedGit: true, seededConventions: true });
  assert.ok(existsSync(join(dir, ".git")));

  assert.equal(git(dir, ["config", "--local", "user.name"]).trim(), MEMORY_GIT_USER_NAME);
  assert.equal(git(dir, ["config", "--local", "user.email"]).trim(), MEMORY_GIT_USER_EMAIL);
  assert.equal(git(dir, ["config", "--local", "core.autocrlf"]).trim(), "false");

  const written = readFileSync(join(dir, CONVENTIONS_FILE_NAME), "utf8");
  const seed = readFileSync(CONVENTIONS_SEED_PATH, "utf8").replace(/\r\n/g, "\n");
  assert.equal(written, seed);
  assert.ok(!written.includes("\r\n"), "種は LF で置く");
});

test("prepareMemoryFolder: 2 回呼んでも同じ(冪等)", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const first = await prepareMemoryFolder({ dir });
  assert.equal(first.ok, true);
  assert.equal(first.ok && first.createdDir, false, "既にある temp フォルダは作らない");
  const second = await prepareMemoryFolder({ dir });
  assert.deepEqual(second, { ok: true, dir, createdDir: false, initializedGit: false, seededConventions: false });
  assert.equal(git(dir, ["config", "--local", "--get-all", "user.name"]).trim(), MEMORY_GIT_USER_NAME);
});

test("prepareMemoryFolder: 既にある _conventions.md は上書きしない", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, CONVENTIONS_FILE_NAME), "rewritten by organizer\n", "utf8");

  const result = await prepareMemoryFolder({ dir });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.seededConventions, false);
  assert.equal(readFileSync(join(dir, CONVENTIONS_FILE_NAME), "utf8"), "rewritten by organizer\n");
});

test("prepareMemoryFolder: 既にある .git は作り直さず、コミットも残る", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  const committed = await commitMemoryChanges({ dir, role: "test-role" });
  assert.equal(committed.ok && committed.committed, true);

  const again = await prepareMemoryFolder({ dir });
  assert.equal(again.ok && again.initializedGit, false);
  assert.equal(commitCount(dir), 1);
});

test("commitMemoryChanges: 変更をすべてコミットし、本文は役名と日時だけ", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  mkdirSync(join(dir, "some-topic"));
  writeFileSync(join(dir, "some-topic", "2026-01-02.md"), "body text\r\nline two\n", "utf8");
  writeFileSync(join(dir, "_map.md"), "map\n", "utf8");

  const at = new Date("2026-01-02T15:30:05Z");
  const result = await commitMemoryChanges({ dir, role: "書き出し役", at });
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.committed, true);
  assert.match(result.ok && result.committed ? result.commit : "", /^[0-9a-f]{40}$/);

  const message = git(dir, ["log", "-1", "--format=%B"]).trim();
  assert.equal(message, "書き出し役 2026-01-03 00:30:05 +09:00");
  assert.equal(message, buildCommitMessage("書き出し役", at));
  assert.ok(!message.includes("body text") && !message.includes("some-topic"));

  assert.equal(git(dir, ["log", "-1", "--format=%an <%ae>"]).trim(), `${MEMORY_GIT_USER_NAME} <${MEMORY_GIT_USER_EMAIL}>`);
  assert.equal(git(dir, ["status", "--porcelain"]).trim(), "", "全部コミットされている");

  const tracked = git(dir, ["ls-files"]).trim().split("\n").sort();
  assert.deepEqual(tracked, ["_conventions.md", "_map.md", "some-topic/2026-01-02.md"]);

  // 改行を変換しない(CRLF はそのまま残る)
  const blob = execFileSync("git", pinnedGitArgs(dir, ["show", "HEAD:some-topic/2026-01-02.md"]), { cwd: dir });
  assert.equal(blob.toString("utf8"), "body text\r\nline two\n");
});

test("commitMemoryChanges: 変更が無ければコミットしない", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  const first = await commitMemoryChanges({ dir, role: "test-role" });
  assert.equal(first.ok && first.committed, true);

  const second = await commitMemoryChanges({ dir, role: "test-role" });
  assert.deepEqual(second, { ok: true, committed: false });
  assert.equal(commitCount(dir), 1);
});

test("commitMemoryChanges: 削除もコミットに含める", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  writeFileSync(join(dir, "old.md"), "x\n", "utf8");
  await commitMemoryChanges({ dir, role: "test-role" });
  rmSync(join(dir, "old.md"));

  const result = await commitMemoryChanges({ dir, role: "test-role" });
  assert.equal(result.ok && result.committed, true);
  assert.equal(git(dir, ["ls-files"]).trim(), "_conventions.md");
  assert.equal(commitCount(dir), 2);
});

test("commitMemoryChanges: 準備されていない(.git が無い)フォルダでは git を呼ばず失敗で返す", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "a.md"), "x\n", "utf8");

  const result = await commitMemoryChanges({ dir, role: "test-role" });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /no \.git/);
});

test("commitMemoryChanges: 役名が空・複数行なら失敗で返す", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  for (const role of ["", "  ", "a\nb"]) {
    const result = await commitMemoryChanges({ dir, role });
    assert.equal(result.ok, false);
  }
  // @ts-expect-error 役名なし
  const missing = await commitMemoryChanges({ dir });
  assert.equal(missing.ok, false);
});

test("git が無いときは throw せず失敗で返す", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const gitPath = join(dir, "no-such-git-binary");

  const prepared = await prepareMemoryFolder({ dir, gitPath });
  assert.equal(prepared.ok, false);
  assert.match(prepared.ok ? "" : prepared.error, /git init: git not found/);

  // 本物の git で準備したあとに、無い git でコミットしようとしても throw しない
  await prepareMemoryFolder({ dir });
  writeFileSync(join(dir, "a.md"), "x\n", "utf8");
  const committed = await commitMemoryChanges({ dir, role: "test-role", gitPath });
  assert.equal(committed.ok, false);
  assert.match(committed.ok ? "" : committed.error, /git not found/);
});

test("git が失敗したとき(壊れた .git)は throw せず失敗で返す", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, ".git"), "not a git dir\n", "utf8");

  const prepared = await prepareMemoryFolder({ dir });
  assert.equal(prepared.ok, false);
  const committed = await commitMemoryChanges({ dir, role: "test-role" });
  assert.equal(committed.ok, false);
});

test("フォルダが作れないとき(同名のファイル)は throw せず失敗で返す", async (t) => {
  const root = makeTemp();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const blocker = join(root, "blocker");
  writeFileSync(blocker, "x", "utf8");

  const result = await prepareMemoryFolder({ dir: join(blocker, "memories") });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /^mkdir:/);
});

test("種が読めないときは throw せず失敗で返す(フォルダと git は準備済み)", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const result = await prepareMemoryFolder({ dir, seedPath: join(dir, "missing-seed.md") });
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /^seed _conventions\.md:/);
  assert.ok(existsSync(join(dir, ".git")));
  assert.ok(!existsSync(join(dir, CONVENTIONS_FILE_NAME)));
});

test("formatJst は日本時間で日付をまたぐ", () => {
  assert.equal(formatJst(new Date("2026-08-30T15:00:00Z")), "2026-08-31 00:00:00 +09:00");
  assert.equal(formatJst(new Date("2026-12-31T14:59:59Z")), "2026-12-31 23:59:59 +09:00");
});
