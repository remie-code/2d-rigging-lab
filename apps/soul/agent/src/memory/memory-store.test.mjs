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

import { createHash } from "node:crypto";

import {
  CONVENTIONS_FILE_NAME,
  CONVENTIONS_SEED_NAME,
  CONVENTIONS_SEED_PATH,
  DEFAULT_MEMORY_DIR,
  MEMORY_GIT_USER_EMAIL,
  MEMORY_GIT_USER_NAME,
  buildCommitMessage,
  commitMemoryChanges,
  conventionsSeedForName,
  formatJst,
  memoryDirForRole,
  pinnedGitArgs,
  parseAddedLines,
  prepareMemoryFolder,
  readCommitAddedLines,
  revertMemoryCommit
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
  assert.ok(!seed.includes("視聴者の名前"), "名前の縛りは置かない");
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

// ── ロールごとの記憶のフォルダ(配信の組み直し Domain B)─────────────────────────────

test("memoryDirForRole: 記憶の根の下のロールの id のフォルダ。ロールの id の形でなければ TypeError", () => {
  assert.equal(memoryDirForRole(join("x", "memories"), "chappy"), join("x", "memories", "chappy"));
  assert.equal(memoryDirForRole(join("x", "memories"), "mio-2"), join("x", "memories", "mio-2"));
  for (const bad of ["", "..", "Chappy", "a/b", "a\\b", ".git", null]) {
    assert.throws(() => memoryDirForRole("x", /** @type {any} */ (bad)), TypeError, String(bad));
  }
  assert.throws(() => memoryDirForRole("", "chappy"), TypeError);
});

test("memoryDirForRole: Windows の予約名（con・nul・com1・lpt1 など）はフォルダ名にしない（配信の組み直し Domain E）", () => {
  for (const reserved of ["con", "nul", "prn", "aux", "com1", "com9", "lpt1", "lpt9"]) {
    assert.throws(() => memoryDirForRole(join("x", "memories"), reserved), TypeError, reserved);
  }
  assert.equal(memoryDirForRole(join("x", "memories"), "con-2"), join("x", "memories", "con-2"));
});

test("conventionsSeedForName: 種の「チャッピー」だけを呼び名に差し替える(ほかの文面は一字も変えない)", () => {
  const seed = readFileSync(CONVENTIONS_SEED_PATH, "utf8").replace(/\r\n/g, "\n");
  const count = seed.split(CONVENTIONS_SEED_NAME).length - 1;
  assert.ok(count >= 3, "種に名前が入っている(棚卸し: 3 か所)");
  const forCody = conventionsSeedForName(seed, "コーディ");
  assert.ok(!forCody.includes(CONVENTIONS_SEED_NAME));
  assert.equal(forCody.split("コーディ").join(CONVENTIONS_SEED_NAME), seed, "名前を戻せば種と同じ");
  // チャッピー自身は種のまま。置換文字列の `$&` などを解釈しない。
  assert.equal(conventionsSeedForName(seed, "チャッピー"), seed);
  assert.equal(conventionsSeedForName("ここはチャッピーの", "$&$1"), "ここは$&$1の");
  // 呼び名が使えなければ種のまま。
  for (const bad of [undefined, null, "", "  ", "a\nb", 3]) assert.equal(conventionsSeedForName(seed, bad), seed);
});

test("prepareMemoryFolder: soulName があれば、無い _conventions.md を呼び名に差し替えた種で書く(種のファイルは変えない)", async (t) => {
  const root = makeTemp();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const seedHash = () => createHash("sha256").update(readFileSync(CONVENTIONS_SEED_PATH)).digest("hex");
  const before = seedHash();
  const seed = readFileSync(CONVENTIONS_SEED_PATH, "utf8").replace(/\r\n/g, "\n");

  const cody = join(root, "memories", "cody");
  const result = await prepareMemoryFolder({ dir: cody, soulName: "コーディ" });
  assert.equal(result.ok, true);
  assert.ok(existsSync(join(cody, ".git")), "git もロールのフォルダごと");
  assert.ok(!existsSync(join(root, "memories", ".git")), "記憶の根には git を作らない");
  assert.equal(readFileSync(join(cody, CONVENTIONS_FILE_NAME), "utf8"), seed.split(CONVENTIONS_SEED_NAME).join("コーディ"));

  // チャッピーのフォルダは種と同じ文面。
  const chappy = join(root, "memories", "chappy");
  await prepareMemoryFolder({ dir: chappy, soulName: "チャッピー" });
  assert.equal(readFileSync(join(chappy, CONVENTIONS_FILE_NAME), "utf8"), seed);

  // 既にある _conventions.md(チャッピーの既存のもの)は、呼び名が違っても触らない。
  writeFileSync(join(chappy, CONVENTIONS_FILE_NAME), "既存の決まり\n", "utf8");
  const again = await prepareMemoryFolder({ dir: chappy, soulName: "コーディ" });
  assert.equal(again.ok && again.seededConventions, false);
  assert.equal(readFileSync(join(chappy, CONVENTIONS_FILE_NAME), "utf8"), "既存の決まり\n");

  assert.equal(seedHash(), before, "種のファイルそのものは変わらない");
});

test("prepareMemoryFolder / commitMemoryChanges: dir が無ければ git を呼ばずに失敗で返す(記憶の根に git を作らない)", async () => {
  const prepared = await prepareMemoryFolder(/** @type {any} */ ({}));
  assert.equal(prepared.ok, false);
  assert.match(prepared.ok ? "" : prepared.error, /dir is required/);
  const prepared2 = await prepareMemoryFolder(/** @type {any} */ (undefined));
  assert.equal(prepared2.ok, false);
  const committed = await commitMemoryChanges(/** @type {any} */ ({ role: "test-role" }));
  assert.equal(committed.ok, false);
  assert.match(committed.ok ? "" : committed.error, /dir is required/);
});

// ── Discord モード Domain L: 足された行・取り消し(書き出し役の書き込みが「?」に化けたとき)──────────────

test("parseAddedLines: `@@` の後ろの `+` 行だけを拾う(見出しの `+++`・`---`・Binary は拾わず、本文の `++` 行は拾う)", () => {
  const diff = [
    "diff --git a/a.md b/a.md",
    "new file mode 100644",
    "--- /dev/null",
    "+++ b/a.md",
    "@@ -0,0 +1,3 @@",
    "+one",
    "+++ two",
    "+",
    "diff --git a/b.md b/b.md",
    "--- a/b.md",
    "+++ b/b.md",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "\ No newline at end of file",
    "diff --git a/c.png b/c.png",
    "Binary files a/c.png and b/c.png differ",
    ""
  ].join("\n");
  assert.deepEqual(parseAddedLines(diff), ["one", "++ two", "", "new"]);
  assert.deepEqual(parseAddedLines(""), []);
});

test("readCommitAddedLines: ルートのコミット(親なし)でも、そのコミットで足された行を返す(HEAD もハッシュも)", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  writeFileSync(join(dir, "a.md"), "first line\n?????\n", "utf8");
  const first = await commitMemoryChanges({ dir, role: "test-role" });
  assert.equal(first.ok && first.committed, true);
  const hash = first.ok && first.committed ? first.commit : "";

  const byHash = await readCommitAddedLines({ dir, commit: hash });
  assert.equal(byHash.ok, true);
  const lines = byHash.ok ? byHash.lines : [];
  assert.ok(lines.includes("first line"));
  assert.ok(lines.includes("?????"));
  assert.ok(lines.includes("# 記憶の置き場の決まり"), "未コミットだった _conventions.md もルートのコミットに入る");
  assert.deepEqual(await readCommitAddedLines({ dir }), byHash, "既定は HEAD");

  // 2 つ目のコミットでは、そのコミットで足された行だけ(変えた行の古い側・変えていない行は入らない)。
  writeFileSync(join(dir, "a.md"), "first line\nreplaced\nadded\n", "utf8");
  await commitMemoryChanges({ dir, role: "test-role" });
  assert.deepEqual(await readCommitAddedLines({ dir }), { ok: true, lines: ["replaced", "added"] });
  assert.equal(commitCount(dir), 2);
});

test("revertMemoryCommit: コミットを取り消すコミットを積み(履歴は書き換えない)、中身が前の状態に戻る", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  writeFileSync(join(dir, "a.md"), "before\n", "utf8");
  await commitMemoryChanges({ dir, role: "test-role" });
  writeFileSync(join(dir, "a.md"), "????\n", "utf8");
  writeFileSync(join(dir, "b.md"), "????\n", "utf8");
  const bad = await commitMemoryChanges({ dir, role: "test-role" });
  const badHash = bad.ok && bad.committed ? bad.commit : "";

  const reverted = await revertMemoryCommit({ dir, commit: badHash });
  assert.equal(reverted.ok, true);
  assert.match(reverted.ok ? reverted.commit : "", /^[0-9a-f]{40}$/);
  assert.equal(readFileSync(join(dir, "a.md"), "utf8"), "before\n");
  assert.equal(existsSync(join(dir, "b.md")), false);
  assert.equal(commitCount(dir), 3, "取り消しのコミットが 1 つ積まれる");
  assert.equal(git(dir, ["rev-parse", "HEAD~1"]).trim(), badHash, "取り消したコミットは履歴に残る");
  assert.equal(git(dir, ["status", "--porcelain"]).trim(), "");
  assert.equal(git(dir, ["log", "-1", "--format=%an <%ae>"]).trim(), `${MEMORY_GIT_USER_NAME} <${MEMORY_GIT_USER_EMAIL}>`);
});

test("revertMemoryCommit: ルートのコミットも取り消せる(足したファイルが消える・既定は HEAD)", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  writeFileSync(join(dir, "a.md"), "????\n", "utf8");
  await commitMemoryChanges({ dir, role: "test-role" });

  const reverted = await revertMemoryCommit({ dir });
  assert.equal(reverted.ok, true);
  assert.equal(existsSync(join(dir, "a.md")), false);
  assert.equal(commitCount(dir), 2);
  assert.equal(git(dir, ["ls-files"]).trim(), "");
  assert.equal(git(dir, ["status", "--porcelain"]).trim(), "");
});

test("revertMemoryCommit: 失敗しても throw せず、途中の状態を残さない(無いコミット)", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  writeFileSync(join(dir, "a.md"), "x\n", "utf8");
  await commitMemoryChanges({ dir, role: "test-role" });

  const reverted = await revertMemoryCommit({ dir, commit: "0123456789abcdef0123456789abcdef01234567" });
  assert.equal(reverted.ok, false);
  assert.match(reverted.ok ? "" : reverted.error, /^git revert:/);
  assert.equal(commitCount(dir), 1);
  assert.equal(git(dir, ["status", "--porcelain"]).trim(), "");
  assert.equal(existsSync(join(dir, ".git", "REVERT_HEAD")), false);
});

test("readCommitAddedLines / revertMemoryCommit: .git が無い・dir が無い・コミットの形でなければ git を呼ばずに失敗で返す", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "a.md"), "x\n", "utf8");
  // 無い git を指しても「git not found」にならない = git を呼ぶ前に止まっている。
  const gitPath = join(dir, "no-such-git-binary");

  const added = await readCommitAddedLines({ dir, gitPath });
  assert.equal(added.ok, false);
  assert.match(added.ok ? "" : added.error, /no \.git/);
  const reverted = await revertMemoryCommit({ dir, gitPath });
  assert.equal(reverted.ok, false);
  assert.match(reverted.ok ? "" : reverted.error, /no \.git/);
  assert.equal(existsSync(join(dir, ".git")), false);

  for (const call of [readCommitAddedLines, revertMemoryCommit]) {
    const noDir = await call(/** @type {any} */ ({ gitPath }));
    assert.equal(noDir.ok, false);
    assert.match(noDir.ok ? "" : noDir.error, /dir is required/);
    const noOptions = await call(/** @type {any} */ (undefined));
    assert.equal(noOptions.ok, false);
    for (const commit of ["--hard", "HEAD~1", "", "main"]) {
      const bad = await call({ dir, commit, gitPath });
      assert.equal(bad.ok, false);
      assert.match(bad.ok ? "" : bad.error, /commit must be/);
    }
  }
});

test("readCommitAddedLines / revertMemoryCommit: git が無いときは throw せず失敗で返す", async (t) => {
  const dir = makeTemp();
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  await prepareMemoryFolder({ dir });
  await commitMemoryChanges({ dir, role: "test-role" });
  const gitPath = join(dir, "no-such-git-binary");
  const added = await readCommitAddedLines({ dir, gitPath });
  assert.equal(added.ok, false);
  assert.match(added.ok ? "" : added.error, /git not found/);
  const reverted = await revertMemoryCommit({ dir, gitPath });
  assert.equal(reverted.ok, false);
  assert.match(reverted.ok ? "" : reverted.error, /git not found/);
});
