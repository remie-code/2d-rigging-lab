// @ts-check
/**
 * 起動時の引っ越し(記憶の分)— 今の `memories/` の中身を `.git` ごと `memories/chappy/` へ移す(配信の組み直し Domain B・新設)。
 *
 * 上位文書: [stream-restructure.md](../../../../../discussion/ai-cohost/architecture/stream-restructure.md) §2.3・§2.4、
 * scope.md §20(新しい版を最初に起動したときに自動で移す・前に丸ごと写す・何が起きたかを 1 回だけ出す)。
 * 設定の分(roles/ を作る)は src/roles/role-migration.mjs。2 つは role-migration.mjs の runStartupMigration で 1 つの
 * 流れになるが、**動く条件は混ぜない**(roles/ の有無とは関係なく、記憶の置き場の形だけで決める)。
 *
 * ── いつ動くか ───────────────────────────────────────────────────────────
 *  `memories/` の直下に記録があって、`memories/chappy/` が無いときだけ。
 *  - 「直下に記録がある」: 直下に `.git` のフォルダか、`.md` のファイル(`_conventions.md`・`_map.md`・古いダイジェストなど)
 *    がある。OS が置く小さなファイル(desktop.ini など)は数えない。
 *    前の形(記憶のフォルダ = `memories/`)は起動のたびに `.git` と `_conventions.md` を置いていたので、これで見分けられる。
 *    新しい形の根にはロールのフォルダ(それぞれ `.git` を持つフォルダ)しか並ばないので、引っ越しのあとは動かない。
 *  - 前の形の直下にロールのフォルダ(ロールの id の名前で `.git` を持つフォルダ)が混ざっていたら、どちらの記憶か
 *    決められないので移さずに失敗で返す(手で直す)。
 *
 * ── どう移すか(自分の子へ親は rename できない) ───────────────────────────
 *  1. 移す前に `memories/` 全体(`.git` ごと)を写しのフォルダの `memories/` へ写す。写せなければ移さない。
 *  2. `memories/` を隣の作業用の名前 `memories.migrating-<pid>/` へ rename する(中身は 1 回の rename で丸ごと動く)。
 *  3. `memories/` を作り直す。
 *  4. 作業用を `memories/chappy/` へ rename する。
 *  3・4 で失敗したら、その場で 2 の前の形へ戻す(作り直した空の `memories/` を消して作業用を戻す)。
 *  戻すこともできずに止まった(プロセスが落ちたなど)ときは、作業用の `memories.migrating-*` が残る。次の起動で
 *  `memories/chappy/` が無く作業用が 1 つだけ残っていれば、写しを取ってから 3・4 の続きをする。2 つ以上残っている・
 *  `memories/chappy/` もある・`memories/` の直下にも記録がある、のどれかなら決められないので失敗で返す(手で直す)。
 *  作業用の名前は apps/soul/agent/.gitignore の `memories.migrating-*`(直下だけ)の行で git に入らない。
 *
 * ── 投げない・中身は出さない ─────────────────────────────────────────────
 *  結果で返す。表示({@link formatMemoryMigrationReport})に出すのは件数と置き場だけ(記録の名前・中身は出さない)。
 */

import { cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { isRoleId } from "../mind/model-identity.mjs";

/** 前の形の記憶を引き継ぐロール(設計 §2.4「今の memories/ の中身を .git ごと memories/chappy/ へ移す」)。 */
export const LEGACY_MEMORY_ROLE_ID = "chappy";

/** 写しのフォルダの中で、記憶の写しを置く名前。 */
export const MEMORY_BACKUP_NAME = "memories";

/** 作業用のフォルダの名前の接頭(`<根の名前>.migrating-<pid>`・根の隣)。 */
const STAGING_INFIX = ".migrating-";

/**
 * @param {string} dir
 * @returns {import("node:fs").Dirent[]}
 */
function entriesOf(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * ロールの記憶のフォルダか(ロールの id の名前で、自分の `.git` を持つフォルダ)。
 * @param {string} root
 * @param {import("node:fs").Dirent} entry
 */
function isRoleMemoryFolder(root, entry) {
  return entry.isDirectory() && isRoleId(entry.name) && existsSync(join(root, entry.name, ".git"));
}

/**
 * 記憶の根の直下を見て、前の形の記録があるかを返す(読むだけ)。
 * @param {string} root  記憶の根(本番は memory-store.mjs の DEFAULT_MEMORY_DIR)。
 * @returns {{ legacy: boolean; roleFolders: string[] }}
 *   legacy: 直下に `.git` のフォルダか `.md` のファイルがある。roleFolders: 直下のロールの記憶のフォルダの名前。
 */
export function inspectMemoryRoot(root) {
  const entries = entriesOf(root);
  const legacy = entries.some(
    (entry) => (entry.isDirectory() && entry.name === ".git") || (entry.isFile() && entry.name.endsWith(".md"))
  );
  const roleFolders = entries.filter((entry) => isRoleMemoryFolder(root, entry)).map((entry) => entry.name).sort();
  return { legacy, roleFolders };
}

/**
 * 移す記録の件数を数える(読むだけ)。記録 = `.md` のファイルのうち名前が `_` で始まらないもの
 * (回ごとの本体・古いダイジェスト。`_conventions.md`・`_map.md` は数えない)。`.` で始まるフォルダ(`.git`)は見ない。
 * @param {string} dir
 * @returns {number}
 */
export function countMemoryRecords(dir) {
  let count = 0;
  for (const entry of entriesOf(dir)) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      count += countMemoryRecords(join(dir, entry.name));
    } else if (entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_")) {
      count += 1;
    }
  }
  return count;
}

/**
 * 根の隣に残っている作業用のフォルダ(前の引っ越しが途中で止まった残り)。
 * @param {string} root
 * @returns {string[]}
 */
export function findMemoryMigrationLeftovers(root) {
  const prefix = `${basename(root)}${STAGING_INFIX}`;
  return entriesOf(dirname(root))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => join(dirname(root), entry.name))
    .sort();
}

/**
 * @param {unknown} error
 * @returns {string}
 */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @typedef {{ status: "skipped"; legacyLeft: boolean; leftovers: string[] }
 *   | { status: "migrated"; target: string; records: number; backupPath: string; resumed: boolean }
 *   | { status: "failed"; error: string; backupPath: string | null; leftovers: string[] }} MemoryMigrationResult
 *   skipped の legacyLeft: `memories/chappy/` があるので移さなかったが、直下に前の形の記録が残っている。
 *   skipped の leftovers: `memories/chappy/` があるので続きをしなかった作業用の残り(手で確かめる)。
 */

/**
 * 記憶の根の前の形の中身を、`.git` ごとロールのフォルダへ移す(本文は冒頭)。投げない。
 *
 * @param {object} options
 * @param {string} options.memoriesDir  記憶の根(本番は DEFAULT_MEMORY_DIR)。
 * @param {string} options.backupDir  この引っ越しの写しのフォルダ(無ければ作る・設定の分と同じフォルダ)。
 * @param {string} [options.roleId=LEGACY_MEMORY_ROLE_ID]  移す先のロール。
 * @returns {MemoryMigrationResult}
 */
export function migrateMemoriesToRole({ memoriesDir, backupDir, roleId = LEGACY_MEMORY_ROLE_ID }) {
  const target = join(memoriesDir, roleId);
  const leftovers = findMemoryMigrationLeftovers(memoriesDir);
  const targetExists = existsSync(target);
  const inspected = inspectMemoryRoot(memoriesDir);

  if (targetExists) {
    // 移す先がもうある(引っ越し済み・手で作った)。前の形の記録が残っていても触らない(知らせるだけ)。
    return { status: "skipped", legacyLeft: inspected.legacy, leftovers };
  }

  if (leftovers.length > 0) {
    if (leftovers.length > 1 || inspected.legacy) {
      return {
        status: "failed",
        error:
          leftovers.length > 1
            ? "前の記憶の引っ越しの残り(作業用のフォルダ)が 2 つ以上ある"
            : "前の記憶の引っ越しの残り(作業用のフォルダ)と、記憶の置き場の直下の記録の両方がある",
        backupPath: null,
        leftovers
      };
    }
    // 前の引っ越しが 2 のあとで止まった。写しを取ってから 3・4 の続きをする。
    return finishMove({ staging: leftovers[0], memoriesDir, target, backupDir, resumed: true });
  }

  if (!inspected.legacy) return { status: "skipped", legacyLeft: false, leftovers: [] };
  if (inspected.roleFolders.length > 0) {
    return {
      status: "failed",
      error: `記憶の置き場の直下に、前の形の記録とロールのフォルダ(${inspected.roleFolders.join(", ")})が混ざっている`,
      backupPath: null,
      leftovers: []
    };
  }

  const backupPath = backupMemories(memoriesDir, backupDir);
  if (!backupPath.ok) return { status: "failed", error: backupPath.error, backupPath: null, leftovers: [] };

  const staging = `${memoriesDir}${STAGING_INFIX}${process.pid}`;
  try {
    renameSync(memoriesDir, staging);
  } catch (error) {
    // まだ何も動いていない(元の形のまま)。次の起動でもう一度引っ越す。
    return {
      status: "failed",
      error: `記憶の置き場を作業用の名前へ移せない（${messageOf(error)}）`,
      backupPath: backupPath.path,
      leftovers: []
    };
  }
  return finishMove({ staging, memoriesDir, target, backupDir, resumed: false, backupPath: backupPath.path });
}

/**
 * 写しのフォルダの `memories/` へ、記憶を丸ごと写す(`.git` ごと)。すでにあれば写さずに失敗(上書きしない)。
 * @param {string} source
 * @param {string} backupDir
 * @returns {{ ok: true; path: string } | { ok: false; error: string }}
 */
function backupMemories(source, backupDir) {
  const path = join(backupDir, MEMORY_BACKUP_NAME);
  try {
    if (existsSync(path)) throw new Error(`${path} がもうある`);
    mkdirSync(backupDir, { recursive: true });
    cpSync(source, path, { recursive: true, errorOnExist: true, force: false });
    return { ok: true, path };
  } catch (error) {
    return { ok: false, error: `記憶の写しを取れない（${messageOf(error)}）` };
  }
}

/**
 * 3・4: `memories/` を作り直し、作業用を `memories/<role>/` へ移す。失敗したら作業用を `memories/` へ戻す。
 * @param {{ staging: string; memoriesDir: string; target: string; backupDir: string; resumed: boolean; backupPath?: string }} args
 * @returns {MemoryMigrationResult}
 */
function finishMove({ staging, memoriesDir, target, backupDir, resumed, backupPath }) {
  let backup = backupPath ?? null;
  if (backup == null) {
    // 続きのとき: 前の起動の写しの置き場は分からないので、今の写しのフォルダへもう一度写す。
    const copied = backupMemories(staging, backupDir);
    if (!copied.ok) return { status: "failed", error: copied.error, backupPath: null, leftovers: [staging] };
    backup = copied.path;
  }
  const records = countMemoryRecords(staging);
  let createdRoot = false;
  try {
    if (!existsSync(memoriesDir)) {
      mkdirSync(memoriesDir, { recursive: true });
      createdRoot = true;
    }
    renameSync(staging, target);
    return { status: "migrated", target, records, backupPath: backup, resumed };
  } catch (error) {
    const reason = `記憶をロールのフォルダへ移せない（${messageOf(error)}）`;
    // 戻す: 作り直した空の memories/ を消し、作業用を memories/ へ戻す(続きのときは作業用のまま残す)。
    if (!resumed) {
      try {
        if (createdRoot) rmdirSync(memoriesDir);
        renameSync(staging, memoriesDir);
        return { status: "failed", error: reason, backupPath: backup, leftovers: [] };
      } catch (rollbackError) {
        return {
          status: "failed",
          error: `${reason}。元へも戻せない（${messageOf(rollbackError)}）`,
          backupPath: backup,
          leftovers: [staging]
        };
      }
    }
    return { status: "failed", error: reason, backupPath: backup, leftovers: [staging] };
  }
}

/**
 * 記憶の引っ越しの結果を、ターミナルと操縦席のログに 1 回だけ出す行にする(何も無い skipped は空)。
 * 記録の名前・中身は書かない(件数と置き場だけ)。
 * @param {MemoryMigrationResult} result
 * @returns {string[]}
 */
export function formatMemoryMigrationReport(result) {
  if (result.status === "skipped") {
    const lines = [];
    if (result.legacyLeft) {
      lines.push("記憶の置き場の直下に前の形の記録が残っている（memories/chappy/ があるので移していない・手で確かめる）。");
    }
    for (const leftover of result.leftovers) lines.push(`前の記憶の引っ越しの残り（手で確かめる）: ${leftover}`);
    return lines;
  }
  if (result.status === "failed") {
    return [
      `記憶の引っ越しに失敗した: ${result.error}`,
      ...(result.backupPath ? [`記憶の写し: ${result.backupPath}`] : []),
      ...result.leftovers.map((leftover) => `記憶の引っ越しの作業用のフォルダ: ${leftover}`),
      "今回は記憶を読み書きしない（次の起動でもう一度確かめる）。"
    ];
  }
  return [
    `${result.resumed ? "前に途中で止まった記憶の引っ越しを終えた" : "記憶をロールのフォルダへ引っ越した"}` +
      `（記録 ${result.records} 件・履歴ごと）: ${result.target}`,
    `記憶の写し: ${result.backupPath}`
  ];
}
