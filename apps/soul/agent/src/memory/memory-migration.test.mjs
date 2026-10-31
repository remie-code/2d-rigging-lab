// @ts-check
/**
 * memory-migration.mjs のテスト(起動時の引っ越し・記憶の分・配信の組み直し Domain B)。
 * OS の temp 配下に前の形の記憶のフォルダ(本物の git で履歴を積んだもの)を作って走らせる。本物の
 * apps/soul/agent/memories/ には触れない。記憶の中身は無害な固定の文字列だけ。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commitMemoryChanges, pinnedGitArgs, prepareMemoryFolder } from "./memory-store.mjs";
import {
  LEGACY_MEMORY_ROLE_ID,
  countMemoryRecords,
  findMemoryMigrationLeftovers,
  formatMemoryMigrationReport,
  inspectMemoryRoot,
  migrateMemoriesToRole
} from "./memory-migration.mjs";

function makeTemp() {
  return mkdtempSync(join(tmpdir(), "memory-migration-test-"));
}

/** @param {import("node:test").TestContext} t */
function setup(t) {
  const root = makeTemp();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return {
    root,
    memoriesDir: join(root, "memories"),
    backupDir: join(root, "tmp", "restructure-backups", "restructure-test")
  };
}

/** @param {string} dir @param {string} rel @param {string} [body] */
function touch(dir, rel, body = "ダミー\n") {
  const full = join(dir, ...rel.split("/"));
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, body, "utf8");
}

/** 記憶のフォルダの git を読む(親リポジトリを触らないよう固定する)。 @param {string} dir @param {string[]} args */
function git(dir, args) {
  return execFileSync("git", pinnedGitArgs(dir, args), { cwd: dir, encoding: "utf8" }).trim();
}

/**
 * 前の形(記憶のフォルダ = memories/)を、今の部品で作る: 準備(git init・種)→ 記録 2 つを 2 回に分けてコミット。
 * @param {string} memoriesDir
 */
async function makeLegacyMemories(memoriesDir) {
  const prepared = await prepareMemoryFolder({ dir: memoriesDir });
  assert.equal(prepared.ok, true);
  touch(memoriesDir, "_map.md", "- topic-a\n");
  touch(memoriesDir, "topic-a/_map.md", "- 2026-10-20\n");
  touch(memoriesDir, "topic-a/2026-10-20.md", "ダミーの本体 1\n");
  const first = await commitMemoryChanges({ dir: memoriesDir, role: "書き出し役" });
  assert.equal(first.ok && first.committed, true);
  touch(memoriesDir, "topic-b/2026-10-21.md", "ダミーの本体 2\n");
  touch(memoriesDir, "topic-b/2026-10-21-2.md", "ダミーの本体 3\n");
  const second = await commitMemoryChanges({ dir: memoriesDir, role: "書き出し役" });
  assert.equal(second.ok && second.committed, true);
  return { head: git(memoriesDir, ["rev-parse", "HEAD"]), count: git(memoriesDir, ["rev-list", "--count", "HEAD"]) };
}

/** git の環境変数を落とした env(テストの git がほかのリポジトリを指さないように)。 */
function cleanGitEnv() {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key];
  return env;
}

/** git が返すパスと比べられる形(実パス・`/`・Windows は小文字)。 @param {string} p */
function samePathKey(p) {
  const real = realpathSync.native(p).replace(/\\/g, "/").replace(/\/$/, "");
  return process.platform === "win32" ? real.toLowerCase() : real;
}

/** cwd から上へ git の根を探した結果(Codex の頭が cwd から根を探すときと同じ探し方)。 @param {string} cwd */
function showToplevel(cwd) {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", env: cleanGitEnv() }).trim();
}

test("記憶の引っ越し: 前の形の中身を .git ごと memories/chappy/ へ移す(履歴が残る・写しがある・件数)", async (t) => {
  const { memoriesDir, backupDir } = setup(t);
  const legacy = await makeLegacyMemories(memoriesDir);
  const conventionsBefore = readFileSync(join(memoriesDir, "_conventions.md"), "utf8");

  const result = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.equal(result.status, "migrated");
  const migrated = /** @type {Extract<typeof result, { status: "migrated" }>} */ (result);
  const chappy = join(memoriesDir, LEGACY_MEMORY_ROLE_ID);
  assert.equal(migrated.target, chappy);
  assert.equal(migrated.records, 3, "回ごとの本体 3 つ(_map.md・_conventions.md は数えない)");
  assert.equal(migrated.resumed, false);

  // 根にはロールのフォルダだけが残る。
  assert.deepEqual(readdirSync(memoriesDir), [LEGACY_MEMORY_ROLE_ID]);
  // 履歴がそのまま残る(同じ HEAD・同じコミット数)。作業ツリーも clean。
  assert.equal(git(chappy, ["rev-parse", "HEAD"]), legacy.head);
  assert.equal(git(chappy, ["rev-list", "--count", "HEAD"]), legacy.count);
  assert.match(git(chappy, ["log", "-1", "--format=%s"]), /^書き出し役 /);
  assert.equal(git(chappy, ["status", "--porcelain", "--untracked-files=all"]), "");
  assert.equal(readFileSync(join(chappy, "topic-b", "2026-10-21-2.md"), "utf8"), "ダミーの本体 3\n");
  // チャッピーの _conventions.md は移すだけ(一字も変わらない)。
  assert.equal(readFileSync(join(chappy, "_conventions.md"), "utf8"), conventionsBefore);

  // 移す前の写し(.git ごと・同じ HEAD)。
  assert.equal(migrated.backupPath, join(backupDir, "memories"));
  assert.equal(git(migrated.backupPath, ["rev-parse", "HEAD"]), legacy.head);
  assert.equal(readFileSync(join(migrated.backupPath, "topic-a", "2026-10-20.md"), "utf8"), "ダミーの本体 1\n");
  // 作業用のフォルダは残らない。
  assert.deepEqual(findMemoryMigrationLeftovers(memoriesDir), []);

  // 移したあとも記憶の部品はそのまま使える(準備は冪等・コミットが積める)。
  const again = await prepareMemoryFolder({ dir: chappy, soulName: "チャッピー" });
  assert.equal(again.ok && again.initializedGit, false);
  assert.equal(readFileSync(join(chappy, "_conventions.md"), "utf8"), conventionsBefore);
  touch(chappy, "topic-a/2026-10-31.md", "ダミーの本体 4\n");
  const committed = await commitMemoryChanges({ dir: chappy, role: "書き出し役" });
  assert.equal(committed.ok && committed.committed, true);
  assert.equal(git(chappy, ["rev-list", "--count", "HEAD"]), String(Number(legacy.count) + 1));
});

test("記憶の引っ越し: 2 回目は何もしない(memories/chappy/ がある・写しも取らない)", async (t) => {
  const { memoriesDir, backupDir, root } = setup(t);
  const legacy = await makeLegacyMemories(memoriesDir);
  assert.equal(migrateMemoriesToRole({ memoriesDir, backupDir }).status, "migrated");
  const secondBackup = join(root, "tmp", "restructure-backups", "restructure-second");
  const second = migrateMemoriesToRole({ memoriesDir, backupDir: secondBackup });
  assert.deepEqual(second, { status: "skipped", legacyLeft: false, leftovers: [] });
  assert.equal(existsSync(secondBackup), false);
  assert.equal(git(join(memoriesDir, "chappy"), ["rev-parse", "HEAD"]), legacy.head);
  assert.deepEqual(formatMemoryMigrationReport(second), []);
});

test("記憶の引っ越し: 前の形が無ければ何もしない(根が無い・空・新しい形でロールのフォルダだけ)", async (t) => {
  const { memoriesDir, backupDir } = setup(t);
  assert.equal(migrateMemoriesToRole({ memoriesDir, backupDir }).status, "skipped", "根が無い");
  mkdirSync(memoriesDir);
  assert.equal(migrateMemoriesToRole({ memoriesDir, backupDir }).status, "skipped", "空");
  // 新しい形: ロールのフォルダ(それぞれ .git)だけ。チャッピーが無くても、こーでぃーのフォルダを移さない。
  await prepareMemoryFolder({ dir: join(memoriesDir, "cody"), soulName: "コーディ" });
  touch(join(memoriesDir, "cody"), "topic/2026-10-31.md");
  const result = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.deepEqual(result, { status: "skipped", legacyLeft: false, leftovers: [] });
  assert.deepEqual(readdirSync(memoriesDir), ["cody"]);
  assert.equal(existsSync(backupDir), false, "写しも取らない");
  // .git の無いロールのフォルダ(準備に失敗したもの)だけでも、前の形とはみなさない。
  mkdirSync(join(memoriesDir, "mio"));
  // OS が置く小さなファイル(.md でないもの)も、前の形の記録とはみなさない。
  touch(memoriesDir, "desktop.ini", "[.ShellClassInfo]\n");
  assert.deepEqual(inspectMemoryRoot(memoriesDir), { legacy: false, roleFolders: ["cody"] });
  assert.equal(migrateMemoriesToRole({ memoriesDir, backupDir }).status, "skipped");
  assert.deepEqual(readdirSync(memoriesDir).sort(), ["cody", "desktop.ini", "mio"]);
});

test("記憶の引っ越し: memories/chappy/ があれば、前の形の記録が残っていても触らない(知らせるだけ)", async (t) => {
  const { memoriesDir, backupDir } = setup(t);
  await makeLegacyMemories(memoriesDir);
  mkdirSync(join(memoriesDir, "chappy"));
  const result = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.deepEqual(result, { status: "skipped", legacyLeft: true, leftovers: [] });
  assert.ok(existsSync(join(memoriesDir, ".git")), "動かしていない");
  assert.equal(existsSync(backupDir), false);
  assert.equal(formatMemoryMigrationReport(result).length, 1);
});

test("記憶の引っ越し: 写しが取れなければ移さない(元の形のまま・次の起動でもう一度)", async (t) => {
  const { memoriesDir, root } = setup(t);
  const legacy = await makeLegacyMemories(memoriesDir);
  // 写しのフォルダの置き場がファイルで塞がれている。
  const blocker = join(root, "blocker");
  writeFileSync(blocker, "x", "utf8");
  const result = migrateMemoriesToRole({ memoriesDir, backupDir: join(blocker, "restructure-test") });
  assert.equal(result.status, "failed");
  assert.match(result.status === "failed" ? result.error : "", /記憶の写しを取れない/);
  assert.equal(git(memoriesDir, ["rev-parse", "HEAD"]), legacy.head, "元の形のまま");
  assert.equal(existsSync(join(memoriesDir, "chappy")), false);
  assert.deepEqual(findMemoryMigrationLeftovers(memoriesDir), []);
  // 写しの置き場に同じ名前がもうあるときも上書きせずに失敗で返す。
  const backupDir = join(root, "tmp", "b");
  mkdirSync(join(backupDir, "memories"), { recursive: true });
  const again = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.equal(again.status, "failed");
  assert.equal(existsSync(join(memoriesDir, ".git")), true);
  const lines = formatMemoryMigrationReport(again);
  assert.match(lines[0], /^記憶の引っ越しに失敗した: /);
  assert.match(lines.at(-1) ?? "", /今回は記憶を読み書きしない/);
});

test("記憶の引っ越し: 前の形の直下にロールのフォルダが混ざっていたら移さずに失敗で返す", async (t) => {
  const { memoriesDir, backupDir } = setup(t);
  await makeLegacyMemories(memoriesDir);
  await prepareMemoryFolder({ dir: join(memoriesDir, "cody") });
  const result = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.equal(result.status, "failed");
  assert.match(result.status === "failed" ? result.error : "", /cody/);
  assert.equal(existsSync(join(memoriesDir, ".git")), true);
  assert.equal(existsSync(backupDir), false);
});

test("記憶の引っ越し: 途中で止まった残り(作業用のフォルダ)が 1 つなら、写しを取ってから続きをする", async (t) => {
  const { memoriesDir, backupDir, root } = setup(t);
  // 前の起動が 2(memories/ → 作業用への rename)のあとで落ちた形を作る。
  const staging = join(root, "memories.migrating-99999");
  const legacy = await makeLegacyMemories(staging);
  const result = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.equal(result.status, "migrated");
  const migrated = /** @type {Extract<typeof result, { status: "migrated" }>} */ (result);
  assert.equal(migrated.resumed, true);
  assert.equal(migrated.records, 3);
  assert.equal(git(join(memoriesDir, "chappy"), ["rev-parse", "HEAD"]), legacy.head);
  assert.equal(git(migrated.backupPath, ["rev-parse", "HEAD"]), legacy.head, "続きの前にも写しを取る");
  assert.equal(existsSync(staging), false);
  assert.match(formatMemoryMigrationReport(result)[0], /途中で止まった記憶の引っ越しを終えた（記録 3 件/);
});

test("記憶の引っ越し: 残りが決められないとき(2 つ以上・直下にも記録・chappy もある)は続きをしない", async (t) => {
  const { memoriesDir, backupDir, root } = setup(t);
  mkdirSync(join(root, "memories.migrating-1"));
  mkdirSync(join(root, "memories.migrating-2"));
  const two = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.equal(two.status, "failed");
  assert.equal(two.status === "failed" ? two.leftovers.length : 0, 2);
  rmSync(join(root, "memories.migrating-2"), { recursive: true });

  await makeLegacyMemories(memoriesDir);
  const mixed = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.equal(mixed.status, "failed");
  assert.ok(existsSync(join(memoriesDir, ".git")));

  rmSync(memoriesDir, { recursive: true });
  mkdirSync(join(memoriesDir, "chappy"), { recursive: true });
  const withTarget = migrateMemoriesToRole({ memoriesDir, backupDir });
  assert.equal(withTarget.status, "skipped");
  assert.deepEqual(withTarget.status === "skipped" ? withTarget.leftovers : [], [join(root, "memories.migrating-1")]);
  assert.ok(existsSync(join(root, "memories.migrating-1")), "残りは触らない");
  assert.match(formatMemoryMigrationReport(withTarget)[0], /前の記憶の引っ越しの残り/);
});

test("countMemoryRecords / inspectMemoryRoot: 記録は _ で始まらない .md(.git の中は見ない)・前の形は .git かファイル", async (t) => {
  const { memoriesDir } = setup(t);
  touch(memoriesDir, "_conventions.md");
  touch(memoriesDir, "_map.md");
  touch(memoriesDir, "2026-09-01.md"); // 古いダイジェスト
  touch(memoriesDir, "topic/_map.md");
  touch(memoriesDir, "topic/2026-10-20.md");
  touch(memoriesDir, "topic/note.txt");
  touch(memoriesDir, ".git/x.md");
  assert.equal(countMemoryRecords(memoriesDir), 2);
  assert.equal(countMemoryRecords(join(memoriesDir, "missing")), 0);
  assert.deepEqual(inspectMemoryRoot(memoriesDir), { legacy: true, roleFolders: [] });
  assert.deepEqual(inspectMemoryRoot(join(memoriesDir, "missing")), { legacy: false, roleFolders: [] });
});

test("Codex の git の根(設計 §9): ロールのフォルダから上へ根を探すと、ロールのフォルダの .git で止まる", async (t) => {
  // 外側のリポジトリ(プロジェクトの代わり)の中に記憶の根を置く入れ子を一時フォルダで作る。
  const { root, memoriesDir, backupDir } = setup(t);
  execFileSync("git", ["init", "--quiet", root], { env: cleanGitEnv() });
  assert.equal(samePathKey(showToplevel(root)), samePathKey(root));

  // 引っ越したチャッピーのフォルダ・新しく準備したこーでぃーのフォルダ、どちらからも自分のフォルダが根になる。
  await makeLegacyMemories(memoriesDir);
  assert.equal(migrateMemoriesToRole({ memoriesDir, backupDir }).status, "migrated");
  const chappy = join(memoriesDir, "chappy");
  const cody = join(memoriesDir, "cody");
  assert.equal((await prepareMemoryFolder({ dir: cody, soulName: "コーディ" })).ok, true);
  assert.equal(samePathKey(showToplevel(chappy)), samePathKey(chappy));
  assert.equal(samePathKey(showToplevel(join(chappy, "topic-a"))), samePathKey(chappy), "トピックのフォルダからも");
  assert.equal(samePathKey(showToplevel(cody)), samePathKey(cody));

  // 対照: .git の無いフォルダからは外側のリポジトリまで上がる(.git があることで止まっている)。
  const plain = join(memoriesDir, "plain");
  mkdirSync(plain);
  assert.equal(samePathKey(showToplevel(plain)), samePathKey(root));
});
