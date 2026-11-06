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
 *     `_conventions.md` が無ければ種(conventions-seed.md)から置く。あれば触らない(③整理役が書き換える)。
 *     `_conventions.md` が HEAD に入っていなければ、そのファイルだけをコミットする(役名「魂」・記憶の整理 Domain A。
 *     書き出し役の前に未コミットの変更を捨てるので、置いただけの種が消えないように)。
 *  2. commitMemoryChanges: 変更があれば全部を add してコミットする。本文は「誰が(役名)・いつ」だけで、
 *     記憶の中身(ファイル名・差分)は書かない。変更が無ければ何もしない。
 *  3. readCommitAddedLines / revertMemoryCommit(Discord モード Domain L): 1 つのコミットで足された行を返す・
 *     そのコミットを `git revert` で取り消す(書き出し役の書き込みが「?」に化けたときの取り消し。化けかどうかの
 *     見分けは呼び出し側 mind/memory.mjs)。
 *  4. readCommitChangedFiles / readMemoryHead / discardUncommittedChanges(記憶の整理 Domain A・organization.md §4・§6):
 *     1 つのコミットで足された・変わった・消えたファイルの一覧・今の先頭(HEAD のハッシュ)・コミットされていない
 *     変更を捨てる(追跡済みは HEAD に戻し、追跡外は消す。`.gitignore` されたものは残す)。
 *  5. readMemoryLog / commitMemoryEmpty / createMemoryBundle / listMemoryTreeFiles / stageAndListMemoryFiles /
 *     resetMemoryToCommit(記憶の整理 Domain B・organization.md §5・§6): コミットの並び(ハッシュ・時刻・本文の 1 行目)・
 *     空のコミット(`<役名> <日時>(変更なし)`)・丸ごとの控え(`git bundle create … --all`)・木と index のファイルの
 *     一覧(中身のハッシュ付き。③整理役の見張りが本体の中身を比べるため)・走る前の先頭へ戻す(③の後始末)。
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
import { dirname, isAbsolute, join } from "node:path";
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
 *   committedConventions: boolean;
 * } | { ok: false; dir: string; error: string }} PrepareResult
 */

/** 準備で `_conventions.md` をコミットするときの役名(buildCommitMessage に渡す固定の語・記憶の整理 Domain A)。 */
export const PREPARE_COMMIT_ROLE = "魂";

/**
 * 記憶のフォルダを準備する(冪等)。**throw しない**。
 *  - フォルダが無ければ作る。
 *  - `.git` が無ければ `git init`。
 *  - ローカル設定: user.name / user.email / core.autocrlf=false / core.safecrlf=false(毎回入れ直す・冪等)。
 *  - `_conventions.md` が無ければ種から置く(改行は LF にそろえる)。あれば触らない。soulName があれば種の
 *    「チャッピー」をその呼び名に差し替えて置く({@link conventionsSeedForName}・種のファイルは読むだけ)。
 *  - `_conventions.md` があって HEAD に入っていなければ(今置いた種・前の形で置いたまま未コミットの種)、
 *    そのファイルだけをコミットする(`add -- _conventions.md` と `commit -- _conventions.md`。ほかの未コミットの
 *    変更は入れない・本文は `魂 <日本時間>`・記憶の整理 Domain A)。書き出し役の前に未コミットの変更を捨てる
 *    (discardUncommittedChanges)ので、置いただけの種が消えないようにする。HEAD に入っていれば触らない。
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

  let committedConventions = false;
  if (existsSync(conventionsPath)) {
    const tracked = await isTrackedInHead(dir, CONVENTIONS_FILE_NAME, gitOptions);
    if (!tracked.ok) return { ok: false, dir, error: tracked.error };
    if (!tracked.tracked) {
      const add = await runGit(pinnedGitArgs(dir, ["add", "--", CONVENTIONS_FILE_NAME]), dir, gitOptions);
      if (add.error) return { ok: false, dir, error: describeFailure(`git add ${CONVENTIONS_FILE_NAME}`, add) };
      const commit = await runGit(
        pinnedGitArgs(dir, [
          "commit",
          "--quiet",
          "-m",
          buildCommitMessage(PREPARE_COMMIT_ROLE, new Date()),
          "--",
          CONVENTIONS_FILE_NAME
        ]),
        dir,
        gitOptions
      );
      if (commit.error) return { ok: false, dir, error: describeFailure(`git commit ${CONVENTIONS_FILE_NAME}`, commit) };
      committedConventions = true;
    }
  }

  return { ok: true, dir, createdDir, initializedGit, seededConventions, committedConventions };
}

/**
 * 記憶のフォルダの HEAD の木に、そのパス(フォルダ直下のファイル名)が入っているか。HEAD がまだ無ければ入っていない。
 * **throw しない**。
 * @param {string} dir
 * @param {string} path
 * @param {GitOptions} gitOptions
 * @returns {Promise<{ ok: true; tracked: boolean } | { ok: false; error: string }>}
 */
async function isTrackedInHead(dir, path, gitOptions) {
  const head = await readMemoryHead({ dir, ...gitOptions });
  if (!head.ok) return head;
  if (head.head === null) return { ok: true, tracked: false };
  const listed = await runGit(pinnedGitArgs(dir, ["ls-tree", "--name-only", "-z", "HEAD", "--", path]), dir, gitOptions);
  if (listed.error) return { ok: false, error: describeFailure("git ls-tree", listed) };
  return { ok: true, tracked: listed.stdout.split("\0").includes(path) };
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

/**
 * 記憶のフォルダのコミットを指す引数として受ける形(`HEAD` か、16 進のハッシュ)。`-` で始まる値などを
 * git のオプションとして読ませないための入口の縛り。
 * @param {unknown} commit
 * @returns {commit is string}
 */
function isCommitRef(commit) {
  return typeof commit === "string" && (commit === "HEAD" || /^[0-9a-f]{4,64}$/i.test(commit));
}

/**
 * 記憶のフォルダの準備と引数の確かめ(commitMemoryChanges と同じ入口・git を呼ぶ前に止める)。
 * @param {unknown} dir
 * @param {unknown} commit
 * @returns {string | null}  止める理由(無ければ null)。
 */
function checkCommitTarget(dir, commit) {
  if (typeof dir !== "string" || dir.length === 0) return "dir is required (a role's memory folder)";
  if (!isCommitRef(commit)) return "commit must be HEAD or a commit hash";
  // `.git` が無いまま git を呼ぶと親リポジトリを触りうる。呼ぶ前に止める。
  if (!existsSync(join(dir, ".git"))) return "memory folder is not prepared (no .git)";
  return null;
}

/**
 * unified diff(-U0)から足された行を取り出す純関数。ファイルの見出し(`diff `・`---`・`+++`・`Binary files`)は
 * 読み飛ばし、`@@` の後ろの `+` 行だけを拾う(本文が `++` で始まる行も見出しと取り違えない)。
 * @param {string} diff
 * @returns {string[]}
 */
export function parseAddedLines(diff) {
  /** @type {string[]} */
  const added = [];
  let inHunk = false;
  for (const line of String(diff).split(/\r?\n/)) {
    if (line.startsWith("diff ")) {
      inHunk = false;
      continue;
    }
    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }
    if (inHunk && line.startsWith("+")) added.push(line.slice(1));
  }
  return added;
}

/**
 * @typedef {{ ok: true; lines: string[] } | { ok: false; error: string }} AddedLinesResult
 */

/**
 * 記憶のフォルダの 1 つのコミットで足された行を返す(書き出し役の書き込みの化けの確かめ・Discord モード Domain L)。
 * **throw しない**。`dir` は省略できない。`commit` は既定 `HEAD`(ハッシュも受ける)。
 *  - `git diff-tree --root`(親の無いルートのコミットでも、空の木との差分として動く)で、色・外部 diff・textconv を切り、
 *    前後の文脈 0 行の差分を取る(ユーザーの global 設定に左右されない)。バイナリのファイルは無視する。
 *  - `.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string; commit?: string } & GitOptions} options
 * @returns {Promise<AddedLinesResult>}
 */
export async function readCommitAddedLines(options) {
  const dir = options?.dir;
  const commit = options?.commit ?? "HEAD";
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkCommitTarget(dir, commit);
  if (stop) return { ok: false, error: stop };

  const diff = await runGit(
    pinnedGitArgs(/** @type {string} */ (dir), [
      "diff-tree",
      "--root",
      "-r",
      "-p",
      "--no-commit-id",
      "--no-color",
      "--no-ext-diff",
      "--no-textconv",
      "--no-renames",
      "--unified=0",
      String(commit),
      "--"
    ]),
    /** @type {string} */ (dir),
    gitOptions
  );
  if (diff.error) return { ok: false, error: describeFailure("git diff-tree", diff) };
  return { ok: true, lines: parseAddedLines(diff.stdout) };
}

/**
 * @typedef {{ ok: true; commit: string } | { ok: false; error: string }} RevertResult
 */

/**
 * 記憶のフォルダの 1 つのコミットを `git revert --no-edit` で取り消す(取り消しのコミットを積む・履歴は書き換えない・
 * Discord モード Domain L)。**throw しない**。`dir` は省略できない。`commit` は既定 `HEAD`(ハッシュも受ける)。
 *  - 親の無いルートのコミットも取り消せる(足したファイルを消すコミットになる)。
 *  - 取り消しのコミットの作者・本文は git のまま(作者は prepareMemoryFolder が入れたローカル設定・本文は
 *    `Revert "<元の本文>"` で、元の本文は役名と日時だけ)。
 *  - 失敗したら途中の状態を残さないよう `git revert --abort` を試みる(best-effort)。
 *  - `.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string; commit?: string } & GitOptions} options
 * @returns {Promise<RevertResult>}
 */
export async function revertMemoryCommit(options) {
  const dir = options?.dir;
  const commit = options?.commit ?? "HEAD";
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkCommitTarget(dir, commit);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const revert = await runGit(pinnedGitArgs(folder, ["revert", "--no-edit", String(commit)]), folder, gitOptions);
  if (revert.error) {
    await runGit(pinnedGitArgs(folder, ["revert", "--abort"]), folder, gitOptions); // best-effort。
    return { ok: false, error: describeFailure("git revert", revert) };
  }

  const head = await runGit(pinnedGitArgs(folder, ["rev-parse", "HEAD"]), folder, gitOptions);
  if (head.error) return { ok: false, error: describeFailure("git rev-parse", head) };
  return { ok: true, commit: head.stdout.trim() };
}

// ── 記憶の整理 Domain A: 変わったファイルの一覧・今の先頭・未コミットの変更を捨てる(organization.md §4・§6)──────────

/**
 * 記憶のフォルダの準備と `dir` の確かめ(コミットを受けない口の入口・git を呼ぶ前に止める)。
 * @param {unknown} dir
 * @returns {string | null}  止める理由(無ければ null)。
 */
function checkMemoryFolder(dir) {
  if (typeof dir !== "string" || dir.length === 0) return "dir is required (a role's memory folder)";
  // `.git` が無いまま git を呼ぶと親リポジトリを触りうる。呼ぶ前に止める。
  if (!existsSync(join(dir, ".git"))) return "memory folder is not prepared (no .git)";
  return null;
}

/**
 * `git diff-tree --name-status -z` の出力を `{ status, path }` の並びにする純関数。`-z` なのでパスは引用符も
 * エスケープも無いそのままの名前(日本語の名前も壊さない)。`--no-renames` で呼ぶので普通は 1 つの状態に 1 つのパスだが、
 * 名前の変更・写し(`R…`・`C…`)が来ても、2 つ目(新しい側)のパスを取って並びを崩さない。
 * @param {string} output
 * @returns {Array<{ status: string; path: string }>}
 */
export function parseNameStatusZ(output) {
  const tokens = String(output).split("\0");
  /** @type {Array<{ status: string; path: string }>} */
  const files = [];
  let i = 0;
  while (i < tokens.length) {
    const status = tokens[i].trim();
    if (status === "") {
      i += 1;
      continue;
    }
    const twoPaths = /^[RC]/.test(status);
    const path = twoPaths ? tokens[i + 2] : tokens[i + 1];
    i += twoPaths ? 3 : 2;
    if (typeof path !== "string" || path === "") break;
    files.push({ status, path });
  }
  return files;
}

/**
 * @typedef {{ ok: true; files: Array<{ status: string; path: string }> } | { ok: false; error: string }} ChangedFilesResult
 */

/**
 * 記憶のフォルダの 1 つのコミットで足された・変わった・消えたファイルの一覧(記憶の整理 Domain A)。**throw しない**。
 * `dir` は省略できない。`commit` は既定 `HEAD`(ハッシュも受ける)。
 *  - `git diff-tree --root -r --name-status -z --no-renames --no-commit-id <commit> --`(親の無いルートのコミットでも、
 *    空の木との差分として動く・名前の変更は消えたと足されたに分ける)。
 *  - パスはフォルダの根からの相対で、区切りは `/`(git のまま)。`status` は git の 1 文字(`A`・`M`・`D`・`T` など)。
 *  - `.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string; commit?: string } & GitOptions} options
 * @returns {Promise<ChangedFilesResult>}
 */
export async function readCommitChangedFiles(options) {
  const dir = options?.dir;
  const commit = options?.commit ?? "HEAD";
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkCommitTarget(dir, commit);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const run = await runGit(
    pinnedGitArgs(folder, [
      "diff-tree",
      "--root",
      "-r",
      "--name-status",
      "-z",
      "--no-renames",
      "--no-commit-id",
      String(commit),
      "--"
    ]),
    folder,
    gitOptions
  );
  if (run.error) return { ok: false, error: describeFailure("git diff-tree", run) };
  return { ok: true, files: parseNameStatusZ(run.stdout) };
}

/**
 * @typedef {{ ok: true; head: string | null } | { ok: false; error: string }} HeadResult
 */

/**
 * 記憶のフォルダの今の先頭(HEAD のコミットのハッシュ)。まだ 1 つもコミットが無い(HEAD が生まれていない)ときは
 * `null`。**throw しない**。`dir` は省略できない。`.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string } & GitOptions} options
 * @returns {Promise<HeadResult>}
 */
export async function readMemoryHead(options) {
  const dir = options?.dir;
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkMemoryFolder(dir);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const run = await runGit(pinnedGitArgs(folder, ["rev-parse", "--verify", "--quiet", "HEAD^{commit}"]), folder, gitOptions);
  if (!run.error) {
    const head = run.stdout.trim();
    if (/^[0-9a-f]{40,64}$/i.test(head)) return { ok: true, head };
    return { ok: false, error: "git rev-parse: unexpected output" };
  }
  // `--verify --quiet` は、HEAD が指すコミットが無いと黙って 1 で終わる。HEAD がまだ生まれていない(ブランチを指す
  // だけでコミットが無い)ことを symbolic-ref で確かめてから null にする(ほかの失敗と取り違えない)。
  if (run.code === 1) {
    const symbolic = await runGit(pinnedGitArgs(folder, ["symbolic-ref", "--quiet", "HEAD"]), folder, gitOptions);
    if (!symbolic.error) return { ok: true, head: null };
  }
  return { ok: false, error: describeFailure("git rev-parse", run) };
}

/**
 * @typedef {{ ok: true } | { ok: false; error: string }} DiscardResult
 */

/**
 * 記憶のフォルダのコミットされていない変更を捨てる(記憶の整理 Domain A・organization.md §6「始める前」)。**throw しない**。
 *  - 追跡済みのファイルは HEAD に戻す(index に足しただけの新しいファイル・index の変更も含む・`reset --hard HEAD`)。
 *  - 追跡外のファイルとフォルダは消す(`clean -f -d`)。`.gitignore` されたものは残す(`-x` は付けない)。
 *  - まだ 1 つもコミットが無い(HEAD が生まれていない)ときは、戻す先が無いので何もせず `{ ok: true }`。
 *  - `dir` は省略できない。`.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string } & GitOptions} options
 * @returns {Promise<DiscardResult>}
 */
export async function discardUncommittedChanges(options) {
  const dir = options?.dir;
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkMemoryFolder(dir);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const head = await readMemoryHead({ dir: folder, ...gitOptions });
  if (!head.ok) return { ok: false, error: head.error };
  if (head.head === null) return { ok: true };

  const reset = await runGit(pinnedGitArgs(folder, ["reset", "--hard", "--quiet", "HEAD"]), folder, gitOptions);
  if (reset.error) return { ok: false, error: describeFailure("git reset", reset) };
  const clean = await runGit(pinnedGitArgs(folder, ["clean", "-f", "-d", "--quiet", "--"]), folder, gitOptions);
  if (clean.error) return { ok: false, error: describeFailure("git clean", clean) };
  return { ok: true };
}

// ── 記憶の整理 Domain B: コミットの並び・空のコミット・控え・中身のハッシュ付きの一覧(organization.md §5・§6)──────────

/**
 * `git log -z --format=%H%x1f%ct%x1f%s` の出力を並びにする純関数。1 つのコミットは NUL で区切られ、その中は
 * ハッシュ・コミットの時刻(秒)・本文の 1 行目が US(`\x1f`)で区切られる。本文の中の US はそのまま本文に残す
 * (最初の 2 つの区切りだけで割る)。形の合わない行は飛ばす。
 * @param {string} output
 * @returns {Array<{ commit: string; committedAtMs: number; subject: string }>}
 */
export function parseMemoryLogZ(output) {
  /** @type {Array<{ commit: string; committedAtMs: number; subject: string }>} */
  const commits = [];
  for (const record of String(output).split("\0")) {
    const entry = record.replace(/^\r?\n/, "");
    if (entry === "") continue;
    const first = entry.indexOf("\x1f");
    const second = first < 0 ? -1 : entry.indexOf("\x1f", first + 1);
    if (second < 0) continue;
    const commit = entry.slice(0, first);
    const seconds = Number(entry.slice(first + 1, second));
    if (!/^[0-9a-f]{40,64}$/i.test(commit) || !Number.isFinite(seconds)) continue;
    commits.push({ commit, committedAtMs: seconds * 1000, subject: entry.slice(second + 1) });
  }
  return commits;
}

/**
 * @typedef {{ ok: true; commits: Array<{ commit: string; committedAtMs: number; subject: string }> } | { ok: false; error: string }} MemoryLogResult
 */

/**
 * 記憶のフォルダのコミットの並び(新しい順・HEAD からたどる)。**throw しない**。`dir` は省略できない。
 *  - 本文は 1 行目(`%s`)だけ。非 ASCII の本文(役名の「整理役」など)を git の `--grep` に頼らず、呼び出し側が JS で絞る。
 *  - まだ 1 つもコミットが無ければ空の並び。
 *  - `.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string } & GitOptions} options
 * @returns {Promise<MemoryLogResult>}
 */
export async function readMemoryLog(options) {
  const dir = options?.dir;
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkMemoryFolder(dir);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const head = await readMemoryHead({ dir: folder, ...gitOptions });
  if (!head.ok) return { ok: false, error: head.error };
  if (head.head === null) return { ok: true, commits: [] };

  const run = await runGit(
    pinnedGitArgs(folder, ["log", "-z", "--no-color", "--format=%H%x1f%ct%x1f%s", "HEAD", "--"]),
    folder,
    gitOptions
  );
  if (run.error) return { ok: false, error: describeFailure("git log", run) };
  return { ok: true, commits: parseMemoryLogZ(run.stdout) };
}

/** 空のコミット(③整理役が何も変えなかった回)の本文の後ろに付ける語(括弧は ASCII)。 */
export const NO_CHANGES_COMMIT_SUFFIX = "(変更なし)";

/**
 * 空のコミットの本文を組む純関数(`<役名> <日本時間>(変更なし)`・organization.md §5)。
 * @param {string} role
 * @param {Date} at
 * @returns {string}
 */
export function buildNoChangesCommitMessage(role, at) {
  return `${buildCommitMessage(role, at)}${NO_CHANGES_COMMIT_SUFFIX}`;
}

/**
 * 記憶のフォルダに空のコミット(`git commit --allow-empty`)を積む(③整理役が何も変えなかった回の印・記憶の整理
 * Domain B)。本文は {@link buildNoChangesCommitMessage}。**throw しない**。`dir` は省略できない。
 *  - コミットされていない変更があれば積まない(失敗で返す。変更を「変更なし」の本文で入れないため)。
 *  - まだ 1 つもコミットが無くても積める(ルートの空のコミット)。
 *  - `.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string; role: string; at?: Date } & GitOptions} options
 * @returns {Promise<{ ok: true; committed: true; commit: string } | { ok: false; error: string }>}
 */
export async function commitMemoryEmpty(options) {
  const dir = options?.dir;
  const role = options?.role;
  const at = options?.at ?? new Date();
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkMemoryFolder(dir);
  if (stop) return { ok: false, error: stop };
  if (typeof role !== "string" || role.trim() === "" || /[\r\n]/.test(role)) {
    return { ok: false, error: "role must be a non-empty single line" };
  }
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) {
    return { ok: false, error: "at must be a valid Date" };
  }
  const folder = /** @type {string} */ (dir);

  const status = await runGit(pinnedGitArgs(folder, ["status", "--porcelain", "--untracked-files=all"]), folder, gitOptions);
  if (status.error) return { ok: false, error: describeFailure("git status", status) };
  if (status.stdout.trim() !== "") return { ok: false, error: "the memory folder has uncommitted changes" };

  const commit = await runGit(
    pinnedGitArgs(folder, ["commit", "--quiet", "--allow-empty", "-m", buildNoChangesCommitMessage(role.trim(), at)]),
    folder,
    gitOptions
  );
  if (commit.error) return { ok: false, error: describeFailure("git commit", commit) };

  const head = await runGit(pinnedGitArgs(folder, ["rev-parse", "HEAD"]), folder, gitOptions);
  if (head.error) return { ok: false, error: describeFailure("git rev-parse", head) };
  return { ok: true, committed: true, commit: head.stdout.trim() };
}

/**
 * 記憶のフォルダの git を丸ごと 1 つのファイルに固める(`git bundle create <file> --all`・③整理役の前の控え・
 * 記憶の整理 Domain B)。**throw しない**。`dir` は省略できない。
 *  - `file` は絶対パス(置き場のフォルダは呼び出し側が作る)。
 *  - まだ 1 つもコミットが無ければ git が断る(失敗で返す)。
 *  - `.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string; file: string } & GitOptions} options
 * @returns {Promise<{ ok: true; file: string } | { ok: false; error: string }>}
 */
export async function createMemoryBundle(options) {
  const dir = options?.dir;
  const file = options?.file;
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkMemoryFolder(dir);
  if (stop) return { ok: false, error: stop };
  if (typeof file !== "string" || file.length === 0 || !isAbsolute(file)) {
    return { ok: false, error: "file must be an absolute path" };
  }
  const folder = /** @type {string} */ (dir);

  const run = await runGit(pinnedGitArgs(folder, ["bundle", "create", "--quiet", file, "--all"]), folder, gitOptions);
  if (run.error) return { ok: false, error: describeFailure("git bundle", run) };
  return { ok: true, file };
}

/**
 * @typedef {{ path: string; mode: string; object: string }} MemoryFileEntry
 * @typedef {{ ok: true; files: MemoryFileEntry[] } | { ok: false; error: string }} MemoryFilesResult
 */

/**
 * `git ls-tree -r -z` の出力(`<mode> SP <type> SP <object> TAB <path>` を NUL で区切ったもの)を並びにする純関数。
 * ファイル(`blob`)だけを取る(`commit` などの入れ子は取らない)。パスは `-z` なのでそのままの名前。
 * @param {string} output
 * @returns {MemoryFileEntry[]}
 */
export function parseLsTreeZ(output) {
  /** @type {MemoryFileEntry[]} */
  const files = [];
  for (const record of String(output).split("\0")) {
    const tab = record.indexOf("\t");
    if (tab < 0) continue;
    const [mode, type, object] = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    if (type !== "blob" || typeof object !== "string" || path === "") continue;
    files.push({ path, mode, object });
  }
  return files;
}

/**
 * `git ls-files -s -z` の出力(`<mode> SP <object> SP <stage> TAB <path>` を NUL で区切ったもの)を並びにする純関数。
 * 段 0(ふつうの index の行)だけを取り、入れ子の git(mode `160000`)は取らない。
 * @param {string} output
 * @returns {MemoryFileEntry[]}
 */
export function parseLsFilesStageZ(output) {
  /** @type {MemoryFileEntry[]} */
  const files = [];
  for (const record of String(output).split("\0")) {
    const tab = record.indexOf("\t");
    if (tab < 0) continue;
    const [mode, object, stage] = record.slice(0, tab).split(" ");
    const path = record.slice(tab + 1);
    if (stage !== "0" || mode === "160000" || typeof object !== "string" || path === "") continue;
    files.push({ path, mode, object });
  }
  return files;
}

/**
 * 記憶のフォルダの 1 つのコミットの木にあるファイルの一覧(パス・mode・中身のハッシュ)。**throw しない**。
 * `dir` は省略できない。`commit` は既定 `HEAD`(ハッシュも受ける)。`.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string; commit?: string } & GitOptions} options
 * @returns {Promise<MemoryFilesResult>}
 */
export async function listMemoryTreeFiles(options) {
  const dir = options?.dir;
  const commit = options?.commit ?? "HEAD";
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkCommitTarget(dir, commit);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const run = await runGit(pinnedGitArgs(folder, ["ls-tree", "-r", "-z", "--full-tree", String(commit)]), folder, gitOptions);
  if (run.error) return { ok: false, error: describeFailure("git ls-tree", run) };
  return { ok: true, files: parseLsTreeZ(run.stdout) };
}

/**
 * 記憶のフォルダの変更をすべて index に載せ(`git add --all`・`.gitignore` されたものは載らない)、index のファイルの
 * 一覧(パス・mode・中身のハッシュ)を返す。コミットはしない。**throw しない**。`dir` は省略できない。
 * 返る一覧は、このあとコミットすれば入るものそのもの(③整理役の見張りが、走る前の木と中身を比べるため)。
 * `.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string } & GitOptions} options
 * @returns {Promise<MemoryFilesResult>}
 */
export async function stageAndListMemoryFiles(options) {
  const dir = options?.dir;
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkMemoryFolder(dir);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const add = await runGit(pinnedGitArgs(folder, ["add", "--all"]), folder, gitOptions);
  if (add.error) return { ok: false, error: describeFailure("git add", add) };
  const run = await runGit(pinnedGitArgs(folder, ["ls-files", "-s", "-z", "--full-name"]), folder, gitOptions);
  if (run.error) return { ok: false, error: describeFailure("git ls-files", run) };
  return { ok: true, files: parseLsFilesStageZ(run.stdout) };
}

/**
 * 記憶のフォルダを 1 つのコミットの状態へ戻す(③整理役の後始末・記憶の整理 Domain B)。**throw しない**。
 *  - `reset --hard <commit>`(今のブランチの先頭をそのコミットへ動かし、index と作業ツリーも合わせる)のあと
 *    `clean -f -d`(追跡外のファイルとフォルダを消す。`.gitignore` されたものは残す・`-x` は付けない)。
 *  - その後ろに積まれていたコミットはブランチから外れる(reflog と、③の前に作った控えには残る)。
 *  - `commit` は `HEAD` か 16 進のハッシュだけを受ける(`-` で始まる値を git のオプションとして読ませない)。
 *  - `dir` は省略できない。`.git` が無ければ git を呼ばずに失敗で返す。
 * @param {{ dir: string; commit: string } & GitOptions} options
 * @returns {Promise<DiscardResult>}
 */
export async function resetMemoryToCommit(options) {
  const dir = options?.dir;
  const commit = options?.commit;
  const gitOptions = { gitPath: options?.gitPath, timeoutMs: options?.timeoutMs };
  const stop = checkCommitTarget(dir, commit);
  if (stop) return { ok: false, error: stop };
  const folder = /** @type {string} */ (dir);

  const reset = await runGit(pinnedGitArgs(folder, ["reset", "--hard", "--quiet", String(commit)]), folder, gitOptions);
  if (reset.error) return { ok: false, error: describeFailure("git reset", reset) };
  const clean = await runGit(pinnedGitArgs(folder, ["clean", "-f", "-d", "--quiet", "--"]), folder, gitOptions);
  if (clean.error) return { ok: false, error: describeFailure("git clean", clean) };
  return { ok: true };
}
