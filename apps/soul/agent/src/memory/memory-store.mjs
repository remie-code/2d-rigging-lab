// @ts-check
/**
 * 記憶の置き場(記憶のフォルダ)の準備と git の部品(記憶の作り直し Wave 1 Domain B・新設)— apps/soul/agent。
 *
 * 上位文書:
 *  - [recall-flow.md](../../../../../discussion/ai-cohost/memory/recall-flow.md) — 役の区別・git は魂が機械的にコミット。
 *  - [conventions-draft.md](../../../../../discussion/ai-cohost/memory/conventions-draft.md) — `_conventions.md` の本文。
 *  - [memory-recall-wave-plan.md](../../../../../discussion/ai-cohost/implementation/orchestration/memory-recall-wave-plan.md) — §1 Domain B。
 *  - [stream-restructure.md](../../../../../discussion/ai-cohost/architecture/stream-restructure.md) — §2.3 記憶はロールごと。
 *  記憶の作り直しの当時は記憶のフォルダが `memories/` の直下だった。配信の組み直し(2026-10-31)から、記憶のフォルダは
 *  ロールごとの `memories/<role-id>/`(チャッピーは `memories/chappy/`)で、この部品が受け取る `dir` はそのフォルダ。
 *
 * ── この部品がやること ───────────────────────────────────────────────────
 *  1. prepareMemoryFolder: 記憶のフォルダが無ければ作り、`.git` が無ければ `git init` し、
 *     フォルダ内のローカル設定(user.name / user.email / 改行を変換しない)を入れ、
 *     `_conventions.md` が無ければ種(conventions-seed.md)から置く。あれば触らない(③整理役が将来書き換える)。
 *  2. commitMemoryChanges: 変更があれば全部を add してコミットする。本文は「誰が(役名)・いつ」だけで、
 *     記憶の中身(ファイル名・差分)は書かない。変更が無ければ何もしない。
 *
 * ── 魂は記憶の中身について判断しない ─────────────────────────────────────
 *  ここはフォルダの形(トピック・目次)を知らない。書くのは②③の役、ここは「全部をコミットする」だけ。
 *
 * ── 配信を止めない ───────────────────────────────────────────────────────
 *  どちらの関数も **throw しない**。git が無い・失敗した・フォルダが作れないときは
 *  `{ ok: false, error }` を返す(error は git の短い説明。記憶の中身は含まない)。
 *
 * ── ロールごとの記憶のフォルダ(配信の組み直し Domain B)──────────────────────
 *  記憶のフォルダはロールごと(`memories/<role-id>/`・git もロールごとに 1 つ・stream-restructure.md §2.3)。
 *  `memories/` そのもの(DEFAULT_MEMORY_DIR)はロールのフォルダを並べる根で、記憶のフォルダではない。
 *  根に git を作らないように、prepareMemoryFolder と commitMemoryChanges は `dir` を省略できない
 *  (省略すると失敗で返す)。新しいロールの `_conventions.md` は、種の「チャッピー」をそのロールの呼び名に
 *  差し替えて書く(soulName・種のファイルそのものは変えない)。
 *
 * ── 親リポジトリを巻き込まない ───────────────────────────────────────────
 *  記憶のフォルダはプロジェクトのリポジトリの中(apps/soul/agent/memories/<role-id>/・.gitignore 済み)にある。
 *  `.git` が無いまま `git add -A` を走らせると親リポジトリを触ってしまうため、
 *  init 以外の git は必ず `--git-dir=<dir>/.git --work-tree=<dir>` で記憶のフォルダに固定し、
 *  コミットは `<dir>/.git` が無ければ git を呼ばずに失敗で返す。GIT_DIR 等の継承環境変数も落とす。
 *  git は execFile で呼ぶ(シェルを通さない)。
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isRoleId } from "../mind/model-identity.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 記憶の根(`apps/soul/agent/memories/`・プロジェクトの .gitignore 対象)。配信の組み直し Domain B から、ここは
 * ロールの記憶のフォルダ(`<根>/<role-id>/`・それぞれ別の git)を並べる所で、記憶のフォルダそのものではない
 * ({@link memoryDirForRole})。
 */
export const DEFAULT_MEMORY_DIR = join(here, "..", "..", "memories");

/**
 * ロールの記憶のフォルダ(`<根>/<role-id>/`・stream-restructure.md §2.3)。role-id はフォルダ名になるので
 * ロールの id の形(英小文字・数字・`-`)だけを通す。
 * @param {string} root  記憶の根(本番は DEFAULT_MEMORY_DIR)。
 * @param {string} roleId
 * @returns {string}
 */
export function memoryDirForRole(root, roleId) {
  if (typeof root !== "string" || root.length === 0) throw new TypeError("memoryDirForRole: root is required.");
  if (!isRoleId(roleId)) throw new TypeError(`memoryDirForRole: invalid role id: ${String(roleId)}`);
  return join(root, roleId);
}

/** `_conventions.md` の種(conventions-draft.md の「本文」)。 */
export const CONVENTIONS_SEED_PATH = join(here, "conventions-seed.md");

/** 種の文面に入っている名前(新しいロールのフォルダではこれをそのロールの呼び名に差し替える)。 */
export const CONVENTIONS_SEED_NAME = "チャッピー";

/**
 * 種の本文の「チャッピー」を、ロールの呼び名に差し替える純関数(配信の組み直し Domain B・stream-restructure.md §2.3)。
 * 差し替えるのは名前だけで、ほかの文面は一字も変えない。呼び名が空・複数行・文字列でなければ種のまま返す。
 * @param {string} seed  種の本文。
 * @param {unknown} soulName  ロールの呼び名(role.json の name.canonical)。
 * @returns {string}
 */
export function conventionsSeedForName(seed, soulName) {
  if (typeof soulName !== "string" || soulName.trim() === "" || /[\r\n]/.test(soulName)) return seed;
  // split / join で置く(replace の置換文字列の `$&` などを名前の中で解釈させない)。
  return seed.split(CONVENTIONS_SEED_NAME).join(soulName.trim());
}

/** 記憶のフォルダ内の置き場の決まりのファイル名。 */
export const CONVENTIONS_FILE_NAME = "_conventions.md";

/** 記憶のフォルダの git のローカル設定(コミットするのは魂。人のアカウントを名乗らない)。 */
export const MEMORY_GIT_USER_NAME = "soul";
export const MEMORY_GIT_USER_EMAIL = "soul@memory.invalid";

/** 1 回の git 呼び出しの上限(配信を止めないため、待ち続けない)。 */
export const DEFAULT_GIT_TIMEOUT_MS = 30_000;

/** 継承すると記憶のフォルダ以外を指しうる git の環境変数。 */
const INHERITED_GIT_ENV_TO_DROP = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_PREFIX"
];

/**
 * @typedef {{ code: number | string | null; stdout: string; stderr: string; error?: string }} GitRun
 * @typedef {{ gitPath?: string; timeoutMs?: number }} GitOptions
 */

/** @returns {NodeJS.ProcessEnv} */
function gitEnv() {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env };
  for (const key of INHERITED_GIT_ENV_TO_DROP) delete env[key];
  env.GIT_TERMINAL_PROMPT = "0";
  return env;
}

/**
 * git を 1 回呼ぶ。**throw しない**(起動失敗・タイムアウト・非 0 終了も結果で返す)。
 * @param {string[]} args
 * @param {string} cwd
 * @param {GitOptions} [options]
 * @returns {Promise<GitRun>}
 */
function runGit(args, cwd, options = {}) {
  const gitPath = options.gitPath ?? "git";
  const timeout = options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
  return new Promise((resolve) => {
    try {
      execFile(
        gitPath,
        args,
        { cwd, env: gitEnv(), timeout, windowsHide: true, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const err = /** @type {NodeJS.ErrnoException & { killed?: boolean }} */ (error);
            const code = typeof err.code === "number" || typeof err.code === "string" ? err.code : null;
            const reason = err.killed ? "timeout" : code === "ENOENT" ? "git not found" : `exit ${String(code)}`;
            resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), error: reason });
            return;
          }
          resolve({ code: 0, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
        }
      );
    } catch (e) {
      resolve({ code: null, stdout: "", stderr: "", error: e instanceof Error ? e.message : String(e) });
    }
  });
}

/**
 * 記憶のフォルダに固定した git 引数を組む(init 以外はすべてこれを通す)。
 * @param {string} dir
 * @param {string[]} args
 * @returns {string[]}
 */
export function pinnedGitArgs(dir, args) {
  return [`--git-dir=${join(dir, ".git")}`, `--work-tree=${dir}`, ...args];
}

/**
 * 失敗の説明を短く組む(git の stderr の最初の行だけ。記憶の中身は含まない)。
 * @param {string} step
 * @param {GitRun} run
 * @returns {string}
 */
function describeFailure(step, run) {
  const firstLine = run.stderr.split(/\r?\n/).find((line) => line.trim() !== "") ?? "";
  return `${step}: ${run.error ?? "failed"}${firstLine ? ` (${firstLine.trim().slice(0, 200)})` : ""}`;
}

/**
 * @typedef {{
 *   ok: true;
 *   dir: string;
 *   createdDir: boolean;
 *   initializedGit: boolean;
 *   seededConventions: boolean;
 * } | { ok: false; dir: string; error: string }} PrepareResult
 */

/**
 * 記憶のフォルダを準備する(冪等)。**throw しない**。
 *  - フォルダが無ければ作る。
 *  - `.git` が無ければ `git init`。
 *  - ローカル設定: user.name / user.email / core.autocrlf=false / core.safecrlf=false(毎回入れ直す・冪等)。
 *  - `_conventions.md` が無ければ種から置く(改行は LF にそろえる)。あれば触らない。soulName があれば種の
 *    「チャッピー」をその呼び名に差し替えて置く({@link conventionsSeedForName}・種のファイルは読むだけ)。
 *  - `dir` は省略できない(記憶の根に git を作らないため・配信の組み直し Domain B)。
 *
 * @param {{ dir: string; seedPath?: string; soulName?: string } & GitOptions} options
 * @returns {Promise<PrepareResult>}
 */
export async function prepareMemoryFolder(options) {
  const dir = options?.dir;
  if (typeof dir !== "string" || dir.length === 0) {
    return { ok: false, dir: "", error: "dir is required (a role's memory folder)" };
  }
  const seedPath = options.seedPath ?? CONVENTIONS_SEED_PATH;
  const gitOptions = { gitPath: options.gitPath, timeoutMs: options.timeoutMs };

  let createdDir = false;
  try {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      createdDir = true;
    }
  } catch (e) {
    return { ok: false, dir, error: `mkdir: ${e instanceof Error ? e.message : String(e)}` };
  }

  let initializedGit = false;
  if (!existsSync(join(dir, ".git"))) {
    const init = await runGit(["init", "--quiet", dir], dir, gitOptions);
    if (init.error) return { ok: false, dir, error: describeFailure("git init", init) };
    initializedGit = true;
  }

  const localConfig = [
    ["user.name", MEMORY_GIT_USER_NAME],
    ["user.email", MEMORY_GIT_USER_EMAIL],
    ["core.autocrlf", "false"],
    ["core.safecrlf", "false"]
  ];
  for (const [key, value] of localConfig) {
    const set = await runGit(pinnedGitArgs(dir, ["config", "--local", key, value]), dir, gitOptions);
    if (set.error) return { ok: false, dir, error: describeFailure(`git config ${key}`, set) };
  }

  let seededConventions = false;
  const conventionsPath = join(dir, CONVENTIONS_FILE_NAME);
  try {
    if (!existsSync(conventionsPath)) {
      const seed = conventionsSeedForName(readFileSync(seedPath, "utf8").replace(/\r\n/g, "\n"), options.soulName);
      writeFileSync(conventionsPath, seed, { encoding: "utf8", flag: "wx" });
      seededConventions = true;
    }
  } catch (e) {
    return { ok: false, dir, error: `seed ${CONVENTIONS_FILE_NAME}: ${e instanceof Error ? e.message : String(e)}` };
  }

  return { ok: true, dir, createdDir, initializedGit, seededConventions };
}

/**
 * 日時を日本時間の `YYYY-MM-DD HH:MM:SS +09:00` に整形する純関数(記憶の日付の決まりに合わせる)。
 * @param {Date} at
 * @returns {string}
 */
export function formatJst(at) {
  const jst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  return (
    `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())} ` +
    `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}:${pad(jst.getUTCSeconds())} +09:00`
  );
}

/**
 * コミットの本文を組む純関数。「誰が(役名)・いつ」だけ。
 * @param {string} role 役名(例 "書き出し役")。魂が渡す固定の語。1 行に限る。
 * @param {Date} at
 * @returns {string}
 */
export function buildCommitMessage(role, at) {
  return `${role} ${formatJst(at)}`;
}

/**
 * @typedef {{ ok: true; committed: false } | { ok: true; committed: true; commit: string } | { ok: false; error: string }} CommitResult
 */

/**
 * 記憶のフォルダの変更をすべてコミットする。変更が無ければ何もしない。**throw しない**。
 * `dir` は省略できない(ロールの記憶のフォルダ・配信の組み直し Domain B)。
 *
 * @param {{ dir: string; role: string; at?: Date } & GitOptions} options
 * @returns {Promise<CommitResult>}
 */
export async function commitMemoryChanges(options) {
  const dir = options?.dir;
  const role = options?.role;
  const at = options?.at ?? new Date();
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };

  if (typeof dir !== "string" || dir.length === 0) {
    return { ok: false, error: "dir is required (a role's memory folder)" };
  }
  if (typeof role !== "string" || role.trim() === "" || /[\r\n]/.test(role)) {
    return { ok: false, error: "role must be a non-empty single line" };
  }
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
    return { ok: false, error: "at must be a valid Date" };
  }
  // `.git` が無いまま git を呼ぶと親リポジトリを触りうる。呼ぶ前に止める。
  if (!existsSync(join(dir, ".git"))) {
    return { ok: false, error: "memory folder is not prepared (no .git)" };
  }

  const status = await runGit(pinnedGitArgs(dir, ["status", "--porcelain", "--untracked-files=all"]), dir, gitOptions);
  if (status.error) return { ok: false, error: describeFailure("git status", status) };
  if (status.stdout.trim() === "") return { ok: true, committed: false };

  const add = await runGit(pinnedGitArgs(dir, ["add", "--all"]), dir, gitOptions);
  if (add.error) return { ok: false, error: describeFailure("git add", add) };

  const commit = await runGit(
    pinnedGitArgs(dir, ["commit", "--quiet", "-m", buildCommitMessage(role.trim(), at)]),
    dir,
    gitOptions
  );
  if (commit.error) return { ok: false, error: describeFailure("git commit", commit) };

  const head = await runGit(pinnedGitArgs(dir, ["rev-parse", "HEAD"]), dir, gitOptions);
  if (head.error) return { ok: false, error: describeFailure("git rev-parse", head) };
  return { ok: true, committed: true, commit: head.stdout.trim() };
}
