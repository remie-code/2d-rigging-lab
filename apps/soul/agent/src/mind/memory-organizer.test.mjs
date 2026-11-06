// @ts-check
/**
 * memory-organizer.mjs のテスト（記憶の整理 Domain B）。
 * OS の temp 配下で実際に git を動かす（ネット不要）。頭は偽物（ask が cwd のファイルを動かす・書く）。本物の LLM・外部 API は
 * 呼ばない。控えの置き場も temp 配下。記憶の中身は使わず、固定値は無害な文字列だけ。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  commitMemoryChanges,
  commitMemoryEmpty,
  pinnedGitArgs,
  prepareMemoryFolder,
  revertMemoryCommit
} from "../memory/memory-store.mjs";
import {
  DEFAULT_MEMORY_BACKUP_ROOT,
  ORGANISE_INTERVAL_MS,
  ORGANISER_ABORTED_WARNING,
  ORGANISER_ASK_FAILED_WARNING,
  ORGANISER_BACKUPS_TO_KEEP,
  ORGANISER_BACKUP_FAILED_WARNING,
  ORGANISER_BACKUP_NAME_PATTERN,
  ORGANISER_BODIES_CHANGED_WARNING,
  ORGANISER_CLEANUP_FAILED_WARNING,
  ORGANISER_COMMIT_FAILED_WARNING,
  ORGANISER_DISCARD_FAILED_WARNING,
  ORGANISER_GUARD_FAILED_WARNING,
  ORGANISER_HEAD_MOVED_WARNING,
  ORGANISER_LOG_FAILED_WARNING,
  ORGANISER_PRUNE_FAILED_WARNING,
  ORGANISER_SNAPSHOT_FAILED_WARNING,
  ORGANISER_SYSTEM_PROMPT,
  bodyContentMultiset,
  buildOrganiserRequest,
  checkOrganiseDue,
  findLastOrganiserCommit,
  formatOrganiserBackupName,
  organiseMemory,
  parseOrganiserCommitTime,
  sameBodyContents,
  startMemoryOrganiser
} from "./memory-organizer.mjs";

const SECOND = 1000;
const DAY = 24 * 60 * 60 * SECOND;
const T0 = new Date("2026-11-05T05:00:00Z"); // 日本時間 2026-11-05 14:00:00
const ROLE_ID = "chappy";

/** @param {number} ms */
const at = (ms) => new Date(T0.getTime() + ms);
/** @param {Date} date */
const clock = (date) => () => date;

/**
 * @param {string} dir
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 */
function git(dir, args, env) {
  return execFileSync("git", pinnedGitArgs(dir, args), {
    cwd: dir,
    encoding: "utf8",
    ...(env ? { env: { ...process.env, ...env } } : {})
  });
}

/** @param {string} dir */
const headOf = (dir) => git(dir, ["rev-parse", "HEAD"]).trim();
/** @param {string} dir */
const subjectOf = (dir) => git(dir, ["log", "-1", "--format=%s"]).trim();
/** @param {string} dir */
const statusOf = (dir) => git(dir, ["status", "--porcelain", "--untracked-files=all"]);
/** @param {string} dir */
const subjects = (dir) => git(dir, ["log", "--format=%s"]).trim().split("\n");
/**
 * HEAD の木の本体（`_` で始まらない `.md`）の中身のハッシュ（並べ替え）。
 * @param {string} dir
 */
function bodyBlobs(dir) {
  return git(dir, ["ls-tree", "-r", "HEAD"])
    .trim()
    .split("\n")
    .map((line) => {
      const [meta, path] = line.split("\t");
      return { object: meta.split(" ")[2], path: path.replace(/^"|"$/g, "") };
    })
    .filter(({ path }) => path.endsWith(".md") && !path.slice(path.lastIndexOf("/") + 1).startsWith("_"))
    .map(({ object }) => object)
    .sort();
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

/**
 * @param {string} dir
 * @param {string} from
 * @param {string} to
 */
function move(dir, from, to) {
  const target = join(dir, ...to.split("/"));
  mkdirSync(join(target, ".."), { recursive: true });
  renameSync(join(dir, ...from.split("/")), target);
}

/** @param {string} dir @param {string} path */
const read = (dir, path) => readFileSync(join(dir, ...path.split("/")), "utf8");

/**
 * 記憶のフォルダ（準備済み・本体と目次を 1 回コミット済み）と控えの置き場を temp 配下に作る。
 */
async function setupMemory() {
  const root = mkdtempSync(join(tmpdir(), "memory-organizer-test-"));
  const dir = join(root, "memory");
  const backupRoot = join(root, "backups");
  const prepared = await prepareMemoryFolder({ dir });
  assert.equal(prepared.ok, true);
  put(dir, "_map.md", "全体の目次\n");
  put(dir, "elden-ring/_map.md", "トピックの目次\n");
  put(dir, "elden-ring/2026-10-21.md", "本体 一\n");
  put(dir, "elden-ring/2026-10-22.md", "本体 二\n");
  put(dir, "雑談/_map.md", "雑談の目次\n");
  put(dir, "雑談/2026-09-30.md", "雑談の本体\n");
  const committed = await commitMemoryChanges({ dir, role: "書き出し役", at: at(-30 * DAY) });
  assert.equal(committed.ok, true);
  return { root, dir, backupRoot, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/**
 * 偽の頭。ask で work(cwd) を走らせて「済み」と答える。
 * @param {(cwd: string) => void | Promise<void>} [work]
 */
function fakeBrain(work = () => {}) {
  /** @type {{ created: any[]; asked: string[]; disposed: number }} */
  const calls = { created: [], asked: [], disposed: 0 };
  /** @param {any} options */
  const create = (options) => {
    calls.created.push(options);
    return {
      /** @param {string} content */
      async ask(content) {
        calls.asked.push(content);
        await work(options.cwd);
        return { replyText: "済み" };
      },
      async dispose() {
        calls.disposed += 1;
      }
    };
  };
  return { create, calls };
}

/**
 * 決着しない頭。ask で work(cwd) を走らせたあと、いつまでも答えない（dispose されても決着しない最悪の形）。
 * asked は ask が呼ばれて work が終わったら解ける。
 * @param {(cwd: string) => void} [work]
 */
function hangingBrain(work = () => {}) {
  /** @type {() => void} */
  let markAsked = () => {};
  const asked = new Promise((resolve) => {
    markAsked = () => resolve(undefined);
  });
  const calls = { created: 0, disposed: 0 };
  const create = (/** @type {any} */ options) => {
    calls.created += 1;
    return {
      ask() {
        work(options.cwd);
        markAsked();
        return new Promise(() => {});
      },
      async dispose() {
        calls.disposed += 1;
      }
    };
  };
  return { create, calls, asked };
}

/** 本体を年と月の棚へ動かし、目次を書き換える偽の③（中身は一字も変えない）。 */
/** @param {string} cwd */
function shelveBodies(cwd) {
  move(cwd, "elden-ring/2026-10-21.md", "elden-ring/2026/10/2026-10-21.md");
  move(cwd, "elden-ring/2026-10-22.md", "elden-ring/2026/10/2026-10-22.md");
  move(cwd, "雑談/2026-09-30.md", "雑談/2026/09/2026-09-30.md");
  put(cwd, "elden-ring/_map.md", "トピックの目次（棚）\n");
  put(cwd, "_map.md", "全体の目次（作り直し）\n");
  put(cwd, "_conventions.md", "# 記憶の置き場の決まり（書き換え）\n");
}

/** @param {string} backupRoot */
const backupsOf = (backupRoot) => {
  const folder = join(backupRoot, ROLE_ID);
  return existsSync(folder) ? readdirSync(folder).sort() : [];
};

// ── 整理の時期か ─────────────────────────────────────────────────────────────

test("parseOrganiserCommitTime: `整理役 <日本時間>` の日時を読む（後ろに何が続いてもよい・形の合わないものは null）", () => {
  assert.equal(parseOrganiserCommitTime("整理役 2026-11-05 14:00:00 +09:00"), T0.getTime());
  assert.equal(parseOrganiserCommitTime("整理役 2026-11-05 14:00:00 +09:00(変更なし)"), T0.getTime());
  assert.equal(parseOrganiserCommitTime("整理役 2026-13-01 14:00:00 +09:00"), null);
  assert.equal(parseOrganiserCommitTime("整理役 2026-02-30 14:00:00 +09:00"), null);
  assert.equal(parseOrganiserCommitTime("整理役 x"), null);
  assert.equal(parseOrganiserCommitTime('Revert "整理役 2026-11-05 14:00:00 +09:00"'), null);
  assert.equal(parseOrganiserCommitTime("書き出し役 2026-11-05 14:00:00 +09:00"), null);
  assert.equal(parseOrganiserCommitTime(null), null);
});

test("findLastOrganiserCommit: 新しい順の並びから最初の `整理役 ` を選ぶ（Revert は選ばない・日時が読めなければコミットの時刻）", () => {
  const c = (/** @type {string} */ id, /** @type {string} */ subject, ms = 1) => ({ commit: id, committedAtMs: ms, subject });
  assert.equal(findLastOrganiserCommit([]), null);
  assert.equal(findLastOrganiserCommit([c("a", "書き出し役 2026-11-05 14:00:00 +09:00"), c("b", "魂 2026-11-05 14:00:00 +09:00")]), null);
  assert.deepEqual(
    findLastOrganiserCommit([
      c("a", 'Revert "整理役 2026-11-05 14:00:00 +09:00"'),
      c("b", "整理役 2026-11-05 14:00:00 +09:00"),
      c("c", "整理役 2026-10-01 14:00:00 +09:00")
    ]),
    { commit: "b", atMs: T0.getTime(), timeSource: "subject" }
  );
  assert.deepEqual(findLastOrganiserCommit([c("a", "整理役 ?", 42)]), { commit: "a", atMs: 42, timeSource: "commit-time" });
});

test("checkOrganiseDue: コミットが 1 つも無い → 時期（never）", async () => {
  const root = mkdtempSync(join(tmpdir(), "memory-organizer-test-"));
  try {
    execFileSync("git", ["init", "--quiet", root], { cwd: root });
    assert.deepEqual(await checkOrganiseDue({ dir: root, now: clock(T0) }), { due: true, reason: "never" });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkOrganiseDue: `魂`・`書き出し役` のコミットだけ → 時期（never）", async () => {
  const m = await setupMemory();
  try {
    assert.deepEqual(subjects(m.dir).map((s) => s.split(" ")[0]), ["書き出し役", "魂"]);
    assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(T0) }), { due: true, reason: "never" });
  } finally {
    m.cleanup();
  }
});

test("checkOrganiseDue: 7 日未満はまだ・ちょうど 7 日と 7 日超は時期（本文の日時で測る）", async () => {
  const m = await setupMemory();
  try {
    put(m.dir, "_map.md", "目次\n");
    const committed = await commitMemoryChanges({ dir: m.dir, role: "整理役", at: T0 });
    assert.ok(committed.ok && committed.committed);
    const commit = headOf(m.dir);
    // 整理のあとに書き出し役のコミットが積まれても、数えるのは最後の整理役。
    put(m.dir, "elden-ring/2026-11-06.md", "本体\n");
    await commitMemoryChanges({ dir: m.dir, role: "書き出し役", at: at(DAY) });

    assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(at(ORGANISE_INTERVAL_MS - SECOND)) }), {
      due: false,
      reason: "recent",
      lastAtMs: T0.getTime(),
      commit
    });
    assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(at(7 * DAY)) }), {
      due: true,
      reason: "elapsed",
      lastAtMs: T0.getTime(),
      commit
    });
    assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(at(8 * DAY)) }), {
      due: true,
      reason: "elapsed",
      lastAtMs: T0.getTime(),
      commit
    });
  } finally {
    m.cleanup();
  }
});

test("checkOrganiseDue: 最後が `Revert \"整理役 …\"` でも、その前の `整理役 ` を数える", async () => {
  const m = await setupMemory();
  try {
    put(m.dir, "_map.md", "目次\n");
    await commitMemoryChanges({ dir: m.dir, role: "整理役", at: at(-2 * DAY) });
    const organiserCommit = headOf(m.dir);
    const reverted = await revertMemoryCommit({ dir: m.dir });
    assert.equal(reverted.ok, true);
    assert.ok(subjectOf(m.dir).startsWith('Revert "整理役 '));
    assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(T0) }), {
      due: false,
      reason: "recent",
      lastAtMs: at(-2 * DAY).getTime(),
      commit: organiserCommit
    });
  } finally {
    m.cleanup();
  }
});

test("checkOrganiseDue: `整理役 <日時>(変更なし)` の空のコミットも数える", async () => {
  const m = await setupMemory();
  try {
    await commitMemoryEmpty({ dir: m.dir, role: "整理役", at: T0 });
    const result = await checkOrganiseDue({ dir: m.dir, now: clock(at(DAY)) });
    assert.equal(result.due, false);
    assert.equal(result.reason, "recent");
  } finally {
    m.cleanup();
  }
});

test("checkOrganiseDue: 本文の日時が読めなければコミットの時刻で測る", async () => {
  const m = await setupMemory();
  try {
    const committerDate = "2026-11-01T00:00:00Z";
    git(m.dir, ["commit", "--quiet", "--allow-empty", "-m", "整理役 (手で積んだもの)"], {
      GIT_COMMITTER_DATE: committerDate,
      GIT_AUTHOR_DATE: committerDate
    });
    const result = await checkOrganiseDue({ dir: m.dir, now: clock(T0) });
    assert.deepEqual(result, {
      due: false,
      reason: "recent",
      lastAtMs: Date.parse(committerDate),
      commit: headOf(m.dir)
    });
  } finally {
    m.cleanup();
  }
});

test("checkOrganiseDue: 履歴が読めない（.git が無い）→ 時期とみなさず（unreadable）、固定文で 1 行警告する", async () => {
  const root = mkdtempSync(join(tmpdir(), "memory-organizer-test-"));
  try {
    /** @type {string[]} */
    const warnings = [];
    const result = await checkOrganiseDue({ dir: root, now: clock(T0), onWarning: (w) => warnings.push(w) });
    assert.deepEqual(result, { due: false, reason: "unreadable" });
    assert.deepEqual(warnings, [ORGANISER_LOG_FAILED_WARNING]);
    assert.equal(existsSync(join(root, ".git")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("checkOrganiseDue: 引数の誤りは TypeError", async () => {
  // @ts-expect-error dir を省いた呼び間違い
  await assert.rejects(() => checkOrganiseDue({}), TypeError);
  // @ts-expect-error now を関数でなく渡した呼び間違い
  await assert.rejects(() => checkOrganiseDue({ dir: "x", now: T0 }), TypeError);
});

// ── 合格の整理 ──────────────────────────────────────────────────────────────

test("organiseMemory: 本体を年と月の棚へ動かし目次を書き換える → 魂がコミット 1 つ・本文 `整理役 <日時>`・本体の中身が同じ", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    const blobsBefore = bodyBlobs(m.dir);
    const brain = fakeBrain(shelveBodies);
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w)
    });

    assert.deepEqual(result, { status: "organised", commit: headOf(m.dir), changed: true });
    assert.equal(subjectOf(m.dir), "整理役 2026-11-05 14:00:00 +09:00");
    assert.equal(git(m.dir, ["rev-parse", "HEAD^"]).trim(), before);
    assert.deepEqual(bodyBlobs(m.dir), blobsBefore);
    assert.equal(read(m.dir, "elden-ring/2026/10/2026-10-21.md"), "本体 一\n");
    assert.equal(read(m.dir, "雑談/2026/09/2026-09-30.md"), "雑談の本体\n");
    assert.equal(existsSync(join(m.dir, "elden-ring", "2026-10-21.md")), false);
    assert.equal(read(m.dir, "_map.md"), "全体の目次（作り直し）\n");
    assert.equal(statusOf(m.dir), "");
    assert.deepEqual(warnings, []);

    // 頭の作り方は書き出し役と同じ（使い捨て・最後の答えだけ・cwd は記憶のフォルダ）。
    assert.equal(brain.calls.created.length, 1);
    const options = brain.calls.created[0];
    assert.equal(options.systemPrompt, ORGANISER_SYSTEM_PROMPT);
    assert.equal(options.cwd, m.dir);
    assert.equal(options.sandbox, "workspace-write");
    assert.equal(options.finalAnswerOnly, true);
    assert.equal(options.ephemeral, true);
    assert.equal(typeof options.onWarning, "function");
    // 頼みは今日（注入した時計の日本時間）の日付の行つき。
    assert.deepEqual(brain.calls.asked, [buildOrganiserRequest("2026-11-05")]);
    assert.equal(brain.calls.disposed, 1);

    // 控えが 1 つ（日本時間の名前）。
    assert.deepEqual(backupsOf(m.backupRoot), ["2026-11-05_14-00-00.bundle"]);

    // 時刻が進んだ。
    const due = await checkOrganiseDue({ dir: m.dir, now: clock(at(DAY)) });
    assert.equal(due.due, false);
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: 変更が無ければ空のコミット `整理役 <日時>(変更なし)`・そのあと 7 日は時期でない", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    const brain = fakeBrain();
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0)
    });
    assert.deepEqual(result, { status: "organised", commit: headOf(m.dir), changed: false });
    assert.equal(subjectOf(m.dir), "整理役 2026-11-05 14:00:00 +09:00(変更なし)");
    assert.equal(git(m.dir, ["rev-parse", "HEAD^"]).trim(), before);
    assert.equal(git(m.dir, ["diff-tree", "--no-commit-id", "-r", "--name-only", "HEAD"]).trim(), "");
    assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(at(DAY)) }), {
      due: false,
      reason: "recent",
      lastAtMs: T0.getTime(),
      commit: headOf(m.dir)
    });
    assert.equal((await checkOrganiseDue({ dir: m.dir, now: clock(at(7 * DAY)) })).due, true);
  } finally {
    m.cleanup();
  }
});

// ── 見張り ──────────────────────────────────────────────────────────────────

/** @type {Array<[string, (cwd: string) => void]>} */
const bodyTampering = [
  [
    "本体 1 つの 1 文字を変える",
    (cwd) => {
      shelveBodies(cwd);
      put(cwd, "elden-ring/2026/10/2026-10-21.md", "本体 壱\n");
    }
  ],
  [
    "本体を消す",
    (cwd) => {
      shelveBodies(cwd);
      unlinkSync(join(cwd, "雑談", "2026", "09", "2026-09-30.md"));
    }
  ],
  [
    "本体を足す",
    (cwd) => {
      shelveBodies(cwd);
      put(cwd, "elden-ring/2026/10/2026-10-23.md", "足した本体\n");
    }
  ],
  [
    "本体の名前を `_` で始める（本体が減る）",
    (cwd) => move(cwd, "elden-ring/2026-10-22.md", "elden-ring/_2026-10-22.md")
  ],
  ["目次の名前から `_` を外す（本体が増える）", (cwd) => move(cwd, "elden-ring/_map.md", "elden-ring/map.md")]
];

test("organiseMemory: 動かした本体を .gitignore で隠す（コミットに入らない）のも、見張りが拒む", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    const brain = fakeBrain((cwd) => {
      shelveBodies(cwd);
      put(cwd, ".gitignore", "2026/\n");
    });
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0)
    });
    assert.deepEqual(result, { status: "skipped", reason: "guard-bodies-changed" });
    assert.equal(headOf(m.dir), before);
    assert.equal(read(m.dir, "elden-ring/2026-10-21.md"), "本体 一\n");
    assert.equal(existsSync(join(m.dir, ".gitignore")), false);
  } finally {
    m.cleanup();
  }
});

for (const [label, tamper] of bodyTampering) {
  test(`organiseMemory: 見張りが本体の中身の変化を拒む（${label}）→ コミットされず、作業ツリーが走る前に戻り、時刻は進まない`, async () => {
    const m = await setupMemory();
    try {
      const before = headOf(m.dir);
      const brain = fakeBrain(tamper);
      /** @type {string[]} */
      const warnings = [];
      const result = await organiseMemory({
        create: brain.create,
        dir: m.dir,
        backupRoot: m.backupRoot,
        roleId: ROLE_ID,
        now: clock(T0),
        onWarning: (w) => warnings.push(w)
      });
      assert.deepEqual(result, { status: "skipped", reason: "guard-bodies-changed" });
      assert.equal(headOf(m.dir), before);
      assert.equal(statusOf(m.dir), "");
      assert.equal(read(m.dir, "elden-ring/2026-10-21.md"), "本体 一\n");
      assert.equal(read(m.dir, "elden-ring/_map.md"), "トピックの目次\n");
      assert.equal(existsSync(join(m.dir, "elden-ring", "2026")), false);
      assert.deepEqual(warnings, [ORGANISER_BODIES_CHANGED_WARNING]);
      assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(T0) }), { due: true, reason: "never" });
    } finally {
      m.cleanup();
    }
  });
}

/**
 * 偽の頭が本体を書き換えて `git commit` し、その上に書きかけを残す。積んだコミットのハッシュを holder に入れる。
 * @param {string} subject
 * @param {{ commit: string | null }} holder
 * @param {() => void} [after]  コミットと書きかけのあとに続ける（例 throw して ask を失敗させる）。
 */
function committingBrain(subject, holder, after = () => {}) {
  return fakeBrain((cwd) => {
    shelveBodies(cwd);
    put(cwd, "elden-ring/2026/10/2026-10-21.md", "本体 壱（頭が書き換えた）\n");
    git(cwd, ["add", "--all"]);
    git(cwd, ["commit", "--quiet", "-m", subject]);
    holder.commit = headOf(cwd);
    put(cwd, "_map.md", "コミットのあとの書きかけ\n");
    put(cwd, "stray/_note.md", "書きかけ\n");
    after();
  });
}

/**
 * 走る前と同じか（先頭・作業ツリー・頭のコミットが履歴に無い・時刻が進まない）。
 * @param {{ dir: string }} m
 * @param {string} before
 * @param {string | null} headCommit
 */
async function assertRolledBack(m, before, headCommit) {
  assert.equal(headOf(m.dir), before);
  assert.ok(typeof headCommit === "string" && headCommit !== before);
  assert.ok(!git(m.dir, ["log", "--format=%H", "HEAD"]).includes(String(headCommit)));
  assert.equal(statusOf(m.dir), "");
  assert.equal(read(m.dir, "elden-ring/2026-10-21.md"), "本体 一\n");
  assert.equal(read(m.dir, "_map.md"), "全体の目次\n");
  assert.equal(read(m.dir, "_conventions.md"), git(m.dir, ["show", `${before}:_conventions.md`]));
  assert.equal(existsSync(join(m.dir, "elden-ring", "2026")), false);
  assert.equal(existsSync(join(m.dir, "stray")), false);
  assert.ok(!subjects(m.dir).some((s) => s.startsWith("整理役 ")));
  assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(T0) }), { due: true, reason: "never" });
}

for (const subject of ["head commit", "整理役 2026-11-05 14:00:00 +09:00"]) {
  test(`organiseMemory: 見張りが先頭の変化を拒む（偽の頭が「${subject}」で git commit する）→ 走る前の先頭へ戻し、頭のコミットを残さず、魂もコミットしない`, async () => {
    const m = await setupMemory();
    try {
      const before = headOf(m.dir);
      /** @type {{ commit: string | null }} */
      const holder = { commit: null };
      /** @type {string[]} */
      const warnings = [];
      const result = await organiseMemory({
        create: committingBrain(subject, holder).create,
        dir: m.dir,
        backupRoot: m.backupRoot,
        roleId: ROLE_ID,
        now: clock(T0),
        onWarning: (w) => warnings.push(w)
      });
      assert.deepEqual(result, { status: "skipped", reason: "guard-head-moved" });
      assert.deepEqual(warnings, [ORGANISER_HEAD_MOVED_WARNING]);
      await assertRolledBack(m, before, holder.commit);
      // 走る前の全部は控えにある。
      const [bundle] = backupsOf(m.backupRoot);
      const heads = execFileSync("git", ["bundle", "list-heads", join(m.backupRoot, ROLE_ID, bundle)], { encoding: "utf8" });
      assert.ok(heads.includes(before));
    } finally {
      m.cleanup();
    }
  });
}

test("organiseMemory: 頭が git commit してから ask が失敗しても、走る前の先頭へ戻す（ask-failed）", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    /** @type {{ commit: string | null }} */
    const holder = { commit: null };
    const brain = committingBrain("整理役 2026-11-05 14:00:00 +09:00", holder, () => {
      throw new Error("boom");
    });
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w)
    });
    assert.deepEqual(result, { status: "skipped", reason: "ask-failed" });
    assert.deepEqual(warnings, [ORGANISER_ASK_FAILED_WARNING]);
    await assertRolledBack(m, before, holder.commit);
  } finally {
    m.cleanup();
  }
});

test("startMemoryOrganiser: 頭が git commit してから打ち切っても、走る前の先頭へ戻す（aborted）", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    /** @type {string | null} */
    let headCommit = null;
    const brain = hangingBrain((cwd) => {
      shelveBodies(cwd);
      git(cwd, ["add", "--all"]);
      git(cwd, ["commit", "--quiet", "-m", "整理役 2026-11-05 14:00:00 +09:00"]);
      headCommit = headOf(cwd);
      put(cwd, "stray/_note.md", "書きかけ\n");
    });
    const handle = startMemoryOrganiser({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0)
    });
    await brain.asked;
    assert.deepEqual(await handle.abort(), { status: "skipped", reason: "aborted" });
    assert.equal(brain.calls.disposed, 1);
    await assertRolledBack(m, before, headCommit);
  } finally {
    m.cleanup();
  }
});

// ── 控え ────────────────────────────────────────────────────────────────────

test("organiseMemory: 控えは直近 4 個を残す（5 個目で最古が消える・名前の形の違うファイルは触らない）", async () => {
  const m = await setupMemory();
  try {
    mkdirSync(join(m.backupRoot, ROLE_ID), { recursive: true });
    writeFileSync(join(m.backupRoot, ROLE_ID, "note.txt"), "x");
    writeFileSync(join(m.backupRoot, ROLE_ID, "old.bundle"), "x");
    for (let i = 0; i < 5; i += 1) {
      const result = await organiseMemory({
        create: fakeBrain().create,
        dir: m.dir,
        backupRoot: m.backupRoot,
        roleId: ROLE_ID,
        now: clock(at(i * 8 * DAY))
      });
      assert.equal(result.status, "organised");
    }
    assert.equal(ORGANISER_BACKUPS_TO_KEEP, 4);
    assert.deepEqual(backupsOf(m.backupRoot), [
      "2026-11-13_14-00-00.bundle",
      "2026-11-21_14-00-00.bundle",
      "2026-11-29_14-00-00.bundle",
      "2026-12-07_14-00-00.bundle",
      "note.txt",
      "old.bundle"
    ]);
    // 控えは git bundle として読める。
    execFileSync("git", ["bundle", "verify", "--quiet", join(m.backupRoot, ROLE_ID, "2026-12-07_14-00-00.bundle")], {
      cwd: m.dir,
      stdio: "pipe"
    });
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: 控えが作れない（置き場に書けない）→ 走らず、頭を呼ばず、固定文で 1 行警告する", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    writeFileSync(join(m.root, "not-a-folder"), "x"); // ファイルの下にはフォルダを作れない。
    const brain = fakeBrain(shelveBodies);
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: join(m.root, "not-a-folder"),
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w)
    });
    assert.deepEqual(result, { status: "skipped", reason: "backup-failed" });
    assert.equal(brain.calls.created.length, 0);
    assert.deepEqual(warnings, [ORGANISER_BACKUP_FAILED_WARNING]);
    assert.equal(headOf(m.dir), before);
    assert.equal((await checkOrganiseDue({ dir: m.dir, now: clock(T0) })).due, true);
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: git bundle が失敗したら作りかけの控えを消して走らない", async () => {
  const m = await setupMemory();
  try {
    const brain = fakeBrain(shelveBodies);
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w),
      bundleImpl: async ({ file }) => {
        writeFileSync(file, "partial");
        return { ok: false, error: "x" };
      }
    });
    assert.deepEqual(result, { status: "skipped", reason: "backup-failed" });
    assert.equal(brain.calls.created.length, 0);
    assert.deepEqual(backupsOf(m.backupRoot), []);
    assert.deepEqual(warnings, [ORGANISER_BACKUP_FAILED_WARNING]);
  } finally {
    m.cleanup();
  }
});

// ── 始める前に捨てる ────────────────────────────────────────────────────────

test("organiseMemory: 始める前に、未コミットの変更と追跡外のファイルを捨てる（整理の材料に入らない）", async () => {
  const m = await setupMemory();
  try {
    put(m.dir, "elden-ring/2026-10-21.md", "未コミットの手直し\n");
    put(m.dir, "stray/2026-01-01.md", "追跡外の本体\n");
    /** @type {{ body: string; stray: boolean } | null} */
    let seen = null;
    const brain = fakeBrain((cwd) => {
      seen = { body: read(cwd, "elden-ring/2026-10-21.md"), stray: existsSync(join(cwd, "stray")) };
    });
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0)
    });
    assert.deepEqual(seen, { body: "本体 一\n", stray: false });
    assert.deepEqual(result, { status: "organised", commit: headOf(m.dir), changed: false });
    assert.equal(statusOf(m.dir), "");
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: 始める前に捨てられなければ走らない（固定文で 1 行警告）", async () => {
  const m = await setupMemory();
  try {
    const brain = fakeBrain();
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w),
      discardImpl: async () => ({ ok: false, error: "x" })
    });
    assert.deepEqual(result, { status: "skipped", reason: "discard-failed" });
    assert.equal(brain.calls.created.length, 0);
    assert.deepEqual(backupsOf(m.backupRoot), []);
    assert.deepEqual(warnings, [ORGANISER_DISCARD_FAILED_WARNING]);
  } finally {
    m.cleanup();
  }
});

// ── 打ち切り・待つ上限が無いこと・失敗 ────────────────────────────────────────

test("startMemoryOrganiser: 頼みの最中に打ち切ると、決着を待たずに戻る・dispose・変更を捨てる・コミットしない・時刻は進まない", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    const brain = hangingBrain((cwd) => {
      shelveBodies(cwd);
      put(cwd, "stray/_note.md", "書きかけ\n");
    });
    /** @type {string[]} */
    const warnings = [];
    const handle = startMemoryOrganiser({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w)
    });
    await brain.asked;
    const result = await handle.abort();
    assert.deepEqual(result, { status: "skipped", reason: "aborted" });
    assert.deepEqual(await handle.done, result);
    assert.deepEqual(await handle.abort(), result); // 何度呼んでもよい。
    assert.equal(brain.calls.disposed, 1);
    assert.equal(headOf(m.dir), before);
    assert.equal(statusOf(m.dir), "");
    assert.equal(read(m.dir, "elden-ring/2026-10-21.md"), "本体 一\n");
    assert.deepEqual(warnings, [ORGANISER_ABORTED_WARNING]);
    assert.deepEqual(await checkOrganiseDue({ dir: m.dir, now: clock(T0) }), { due: true, reason: "never" });
  } finally {
    m.cleanup();
  }
});

test("startMemoryOrganiser: 始めてすぐ打ち切ると、控えも頭も作らずに戻る", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    const brain = fakeBrain(shelveBodies);
    const handle = startMemoryOrganiser({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0)
    });
    const result = await handle.abort();
    assert.deepEqual(result, { status: "skipped", reason: "aborted" });
    assert.equal(brain.calls.created.length, 0);
    assert.deepEqual(backupsOf(m.backupRoot), []);
    assert.equal(headOf(m.dir), before);
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: 打ち切り済みの signal なら何もせずに戻る（git も呼ばない）", async () => {
  const m = await setupMemory();
  try {
    let discardCalls = 0;
    const controller = new AbortController();
    controller.abort();
    const result = await organiseMemory({
      create: fakeBrain().create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      signal: controller.signal,
      discardImpl: async () => {
        discardCalls += 1;
        return { ok: true };
      }
    });
    assert.deepEqual(result, { status: "skipped", reason: "aborted" });
    assert.equal(discardCalls, 0);
  } finally {
    m.cleanup();
  }
});

/**
 * git を呼ばない差し替え口（待つ上限の確かめで、偽の時計の下でも git の子プロセスを動かさないため）。
 * 控えは本物の makeBackup が見るので、渡された置き場に中身のあるファイルを書く。
 * @param {{ resets: Array<{ dir: string; commit: string }> }} log
 */
function stubbedImpls(log) {
  return {
    discardImpl: async () => ({ ok: true }),
    bundleImpl: async (/** @type {{ file: string }} */ { file }) => {
      writeFileSync(file, "bundle");
      return { ok: true };
    },
    headImpl: async () => ({ ok: true, head: FAKE_HEAD }),
    treeFilesImpl: async () => ({ ok: true, files: [{ path: "t/2026-10-21.md", object: "aa" }] }),
    stageFilesImpl: async () => ({ ok: true, files: [{ path: "t/2026/10/2026-10-21.md", object: "aa" }] }),
    commitImpl: async () => ({ ok: true, committed: true, commit: FAKE_COMMIT }),
    resetImpl: async (/** @type {{ dir: string; commit: string }} */ args) => {
      log.resets.push(args);
      return { ok: true };
    }
  };
}
const FAKE_HEAD = "0123456789abcdef0123456789abcdef01234567";
const FAKE_COMMIT = "89abcdef0123456789abcdef0123456789abcdef";

test("startMemoryOrganiser: 頼みに待つ上限は無い（偽の時計で 1 年進めても決着しない・打ち切りでだけ止まる → aborted）", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "memory-organizer-test-"));
  try {
    t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    const brain = hangingBrain();
    /** @type {{ resets: Array<{ dir: string; commit: string }> }} */
    const log = { resets: [] };
    /** @type {string[]} */
    const warnings = [];
    const dir = join(root, "memory");
    const handle = startMemoryOrganiser({
      create: brain.create,
      dir,
      backupRoot: join(root, "backups"),
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w),
      ...stubbedImpls(log)
    });
    let settled = false;
    void handle.done.then(() => {
      settled = true;
    });
    await brain.asked;
    // 以前の既定（30 分）も、setTimeout が受けられる最大（約 24.8 日）も、ずっと越える。
    t.mock.timers.tick(365 * DAY);
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(settled, false, "上限で決着しない");
    assert.equal(brain.calls.disposed, 0, "上限でセッションを閉じない");
    assert.deepEqual(warnings, []);
    assert.deepEqual(log.resets, []);

    const result = await handle.abort();
    assert.deepEqual(result, { status: "skipped", reason: "aborted" });
    assert.equal(brain.calls.disposed, 1);
    assert.deepEqual(log.resets, [{ dir, commit: FAKE_HEAD }]);
    assert.deepEqual(warnings, [ORGANISER_ABORTED_WARNING]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("organiseMemory: 頼みの間に③整理役は setTimeout を使わない・長くかかった頼みも答えが来れば見張りへ進んでコミットする", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "memory-organizer-test-"));
  try {
    /** @type {() => void} */
    let answer = () => {};
    /** @type {() => void} */
    let markAsked = () => {};
    const askedPromise = new Promise((resolve) => {
      markAsked = () => resolve(undefined);
    });
    let disposed = 0;
    const create = () => ({
      ask() {
        markAsked();
        return new Promise((resolve) => {
          answer = () => resolve({ replyText: "済み" });
        });
      },
      async dispose() {
        disposed += 1;
      }
    });
    /** @type {{ resets: Array<{ dir: string; commit: string }> }} */
    const log = { resets: [] };
    const setTimeoutSpy = t.mock.method(globalThis, "setTimeout");
    const done = organiseMemory({
      create,
      dir: join(root, "memory"),
      backupRoot: join(root, "backups"),
      roleId: ROLE_ID,
      now: clock(T0),
      ...stubbedImpls(log)
    });
    await askedPromise;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(setTimeoutSpy.mock.callCount(), 0, "頼みを待つのにタイマーを掛けない");
    answer();
    assert.deepEqual(await done, { status: "organised", commit: FAKE_COMMIT, changed: true });
    assert.equal(disposed, 1);
    assert.deepEqual(log.resets, []);
    assert.equal(setTimeoutSpy.mock.callCount(), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("organiseMemory: 頼みの日付の行は、整理を始めたときの注入した時計の日本時間の日付（UTC の日付とずれる時刻・年の変わり目）", async () => {
  const root = mkdtempSync(join(tmpdir(), "memory-organizer-test-"));
  try {
    const brain = fakeBrain();
    /** @type {{ resets: Array<{ dir: string; commit: string }> }} */
    const log = { resets: [] };
    // UTC 2026-12-31 15:00:00 = 日本時間 2027-01-01 00:00:00。
    const result = await organiseMemory({
      create: brain.create,
      dir: join(root, "memory"),
      backupRoot: join(root, "backups"),
      roleId: ROLE_ID,
      now: clock(new Date("2026-12-31T15:00:00Z")),
      ...stubbedImpls(log)
    });
    assert.equal(result.status, "organised");
    assert.deepEqual(brain.calls.asked, [buildOrganiserRequest("2027-01-01")]);
    assert.ok(brain.calls.asked[0].split("\n").includes("- 今日の日付（日本時間）: 2027-01-01"));
    assert.ok(!brain.calls.asked[0].includes("2026-12-31"));
    // 控えの名前も同じ始めたときの時刻。
    assert.deepEqual(readdirSync(join(root, "backups", ROLE_ID)), ["2027-01-01_00-00-00.bundle"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("organiseMemory: ask の失敗は、変更を捨ててコミットしない（ask-failed）", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    const brain = fakeBrain((cwd) => {
      shelveBodies(cwd);
      throw new Error("boom");
    });
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w)
    });
    assert.deepEqual(result, { status: "skipped", reason: "ask-failed" });
    assert.equal(brain.calls.disposed, 1);
    assert.equal(headOf(m.dir), before);
    assert.equal(statusOf(m.dir), "");
    assert.deepEqual(warnings, [ORGANISER_ASK_FAILED_WARNING]);
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: 頭が作れない（create が throw）も ask-failed", async () => {
  const m = await setupMemory();
  try {
    const result = await organiseMemory({
      create: () => {
        throw new Error("no brain");
      },
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0)
    });
    assert.deepEqual(result, { status: "skipped", reason: "ask-failed" });
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: コミットに失敗したら変更を捨てる（commit-failed）", async () => {
  const m = await setupMemory();
  try {
    const before = headOf(m.dir);
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: fakeBrain(shelveBodies).create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w),
      commitImpl: async () => ({ ok: false, error: "x" })
    });
    assert.deepEqual(result, { status: "skipped", reason: "commit-failed" });
    assert.equal(headOf(m.dir), before);
    assert.equal(statusOf(m.dir), "");
    assert.deepEqual(warnings, [ORGANISER_COMMIT_FAILED_WARNING]);
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: 見張りの読み取りに失敗したら走る前の先頭へ戻す・戻せなければ cleanupFailed で知らせる", async () => {
  const m = await setupMemory();
  try {
    /** @type {string[]} */
    const warnings = [];
    const before = headOf(m.dir);
    /** @type {Array<{ dir: string; commit: string }>} */
    const resets = [];
    const result = await organiseMemory({
      create: fakeBrain(shelveBodies).create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w),
      stageFilesImpl: async () => ({ ok: false, error: "x" }),
      resetImpl: async (args) => {
        resets.push({ dir: args.dir, commit: args.commit });
        return { ok: false, error: "x" };
      }
    });
    assert.deepEqual(result, { status: "skipped", reason: "guard-unreadable", cleanupFailed: true });
    assert.deepEqual(warnings, [ORGANISER_CLEANUP_FAILED_WARNING, ORGANISER_GUARD_FAILED_WARNING]);
    // 後始末は走る前の先頭へ戻す口で行う。
    assert.deepEqual(resets, [{ dir: m.dir, commit: before }]);
  } finally {
    m.cleanup();
  }
});

test("organiseMemory: 走る前の先頭が読めなければ走らない（snapshot-failed）", async () => {
  const m = await setupMemory();
  try {
    const brain = fakeBrain();
    /** @type {string[]} */
    const warnings = [];
    const result = await organiseMemory({
      create: brain.create,
      dir: m.dir,
      backupRoot: m.backupRoot,
      roleId: ROLE_ID,
      now: clock(T0),
      onWarning: (w) => warnings.push(w),
      headImpl: async () => ({ ok: false, error: "x" })
    });
    assert.deepEqual(result, { status: "skipped", reason: "snapshot-failed" });
    assert.equal(brain.calls.created.length, 0);
    assert.deepEqual(warnings, [ORGANISER_SNAPSHOT_FAILED_WARNING]);
  } finally {
    m.cleanup();
  }
});

// ── 警告・引数・純関数 ──────────────────────────────────────────────────────

test("警告はすべて `memory: ` で始まる固定の英語 1 行で、名前や本文を含まない", () => {
  const all = [
    ORGANISER_LOG_FAILED_WARNING,
    ORGANISER_DISCARD_FAILED_WARNING,
    ORGANISER_BACKUP_FAILED_WARNING,
    ORGANISER_SNAPSHOT_FAILED_WARNING,
    ORGANISER_ASK_FAILED_WARNING,
    ORGANISER_ABORTED_WARNING,
    ORGANISER_HEAD_MOVED_WARNING,
    ORGANISER_BODIES_CHANGED_WARNING,
    ORGANISER_GUARD_FAILED_WARNING,
    ORGANISER_COMMIT_FAILED_WARNING,
    ORGANISER_CLEANUP_FAILED_WARNING,
    ORGANISER_PRUNE_FAILED_WARNING
  ];
  assert.equal(new Set(all).size, all.length);
  for (const warning of all) {
    assert.ok(warning.startsWith("memory: "), warning);
    assert.ok(/^[\x20-\x7e]+$/.test(warning), warning);
    assert.ok(!/chappy|elden|\.md|\.bundle|[0-9a-f]{7,}/.test(warning), warning);
  }
});

test("引数の誤りは TypeError（控えの置き場は必須・絶対パス・ロールの id はパスの 1 区切りとして安全な形だけ）", async () => {
  const base = { create: fakeBrain().create, dir: "C:/x", backupRoot: join(tmpdir(), "x"), roleId: ROLE_ID };
  /** @type {Array<Record<string, unknown>>} */
  const wrong = [
    { backupRoot: undefined },
    { backupRoot: "" },
    { backupRoot: "relative/backups" },
    { roleId: "../x" },
    { roleId: "a/b" },
    { roleId: "a\\b" },
    { roleId: ".." },
    { roleId: "" },
    { roleId: "con" },
    { create: undefined },
    { dir: "" },
    { now: T0 }
  ];
  for (const patch of wrong) {
    const options = /** @type {any} */ ({ ...base, ...patch });
    assert.throws(() => startMemoryOrganiser(options), TypeError, JSON.stringify(patch));
    await assert.rejects(() => organiseMemory(options), TypeError, JSON.stringify(patch));
  }
  await assert.rejects(() => organiseMemory(/** @type {any} */ ({ ...base, signal: {} })), TypeError);
});

test("既定値: 間隔は 7 日・本番の控えの置き場は apps/soul/agent/memory-backups（ここでは触らない）", () => {
  assert.equal(ORGANISE_INTERVAL_MS, 7 * DAY);
  assert.match(DEFAULT_MEMORY_BACKUP_ROOT.replace(/\\/g, "/"), /apps\/soul\/agent\/memory-backups$/);
});

test("formatOrganiserBackupName: 日本時間の `YYYY-MM-DD_HH-MM-SS.bundle`（`:` を使わない・名前の順 = 時刻の順）", () => {
  assert.equal(formatOrganiserBackupName(T0), "2026-11-05_14-00-00.bundle");
  assert.equal(formatOrganiserBackupName(new Date("2026-12-31T15:30:05Z")), "2027-01-01_00-30-05.bundle");
  assert.ok(ORGANISER_BACKUP_NAME_PATTERN.test(formatOrganiserBackupName(T0)));
  const names = [at(DAY), at(0), at(SECOND), at(-DAY)].map(formatOrganiserBackupName);
  assert.deepEqual([...names].sort(), [at(-DAY), at(0), at(SECOND), at(DAY)].map(formatOrganiserBackupName));
});

test("bodyContentMultiset / sameBodyContents: 名前が変わっても中身が同じなら同じ・中身が違えば違う", () => {
  const before = bodyContentMultiset([
    { path: "t/2026-10-21.md", object: "aa" },
    { path: "t/_map.md", object: "bb" },
    { path: "_conventions.md", object: "cc" },
    { path: "t/2026-10-22.md", object: "aa" }
  ]);
  assert.deepEqual(before, ["aa", "aa"]);
  assert.ok(sameBodyContents(before, bodyContentMultiset([
    { path: "t/2026/10/2026-10-21.md", object: "aa" },
    { path: "t/2026/10/2026-10-22.md", object: "aa" },
    { path: "t/_map.md", object: "dd" }
  ])));
  assert.ok(!sameBodyContents(before, bodyContentMultiset([{ path: "t/2026-10-21.md", object: "aa" }])));
  assert.ok(!sameBodyContents(before, bodyContentMultiset([
    { path: "t/2026-10-21.md", object: "aa" },
    { path: "t/2026-10-22.md", object: "ab" }
  ])));
});
