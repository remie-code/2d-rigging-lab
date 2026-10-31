// @ts-check
/**
 * 起動時の引っ越し(設定の分)— 今の設定ファイルからロール `chappy` と `cody` を作る(配信の組み直し Domain A・新設)。
 *
 * 上位文書: [stream-restructure.md](../../../../../discussion/ai-cohost/architecture/stream-restructure.md) §2.4、
 * scope.md §20(新しい版を最初に起動したときに自動で移す・前に丸ごと写す・何が起きたかを 1 回だけ出す)。
 *
 * ── いつ動くか ───────────────────────────────────────────────────────────
 *  ロールの置き場(`roles/`)が無いときだけ。あれば何もしない(2 回目以降の起動・手で作った置き場を触らない)。
 *  - 設定ファイルがあるとき(引っ越し): 移す前に設定ファイルを写しの置き場へ写し、設定の値から 2 つのロールを作る。
 *    写しが取れなければロールを作らずに失敗で返す(写しの無い引っ越しはしない)。
 *  - 設定ファイルも無いとき(まっさらな起動): 写すものが無いので写しは取らず、既定の値で 2 つのロールを作る。
 *  古い設定のキーは消さない・書き換えない(設定ファイルは読むだけ)。読むのはロールのほうだけになる。
 *
 * ── 何を移すか(設計 §2.4) ──────────────────────────────────────────────
 *  - チャッピー(`chappy`): 指示は GPT-6.1 Sol の上書き → ほかの GPT 系の上書き → 既定。モデルは今の `brainChoice` が
 *    GPT 系ならそれ、そうでなければ GPT-6.1 Sol。
 *  - こーでぃー(`cody`): 指示は Claude (Opus 5.5) の上書き → Claude (Opus 4.8) → 既定。モデルは Claude (Opus 5.5)。
 *  - 両方: 声の方式(`ttsEngine`)・口数(`verbosityMode`)・話し始め(`speakStartMode`)・hotwords(`localSttHotwords`)は
 *    今の設定の値(無ければ今の既定)を写す。AivisSpeech の話者と ElevenLabs の声の id は設定に無い(起動引数か
 *    コードの既定)ので「コードの既定」(null)にする。体は両方「使う」。名前と名前の手がかりは model-identity.mjs の表。
 *
 * ── 記憶の分と 1 つの流れにする(配信の組み直し Domain B) ─────────────────
 *  起動時は runStartupMigration が設定の分 → 記憶の分(src/memory/memory-migration.mjs)の順に呼ぶ。写しのフォルダは
 *  共有し、動く条件はそれぞれ独立に判定する。表示は formatStartupMigrationReport(記憶の分は件数を足す)。
 *
 * ── 途中で止まっても半端な置き場を残さない ─────────────────────────────
 *  ロールはいったん隣の作業用フォルダに書き、全部書けてから `roles/` へ名前を変える。途中で失敗したら作業用の
 *  フォルダを消して失敗で返す(`roles/` が無いままなので、次の起動でもう一度引っ越しが走る)。
 */

import { copyFileSync, constants as fsConstants, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFileSettingsStore } from "../cockpit/cockpit-settings-store.mjs";
import { BRAIN_IDS } from "../mind/brains.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import { LOCAL_STT_DEFAULTS } from "../ears/local-stt/local-stt-engines.mjs";
import { roleFromIdentity, writeRole, writeRoleInstructions } from "./role-store.mjs";
import { formatMemoryMigrationReport, migrateMemoriesToRole } from "../memory/memory-migration.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 写しの置き場の根(`apps/soul/agent/tmp/restructure-backups/`)。`tmp/` はリポジトリの根の .gitignore(`tmp/`)で
 * 無視される。1 回の引っ越しで 1 つのフォルダ({@link migrationBackupDir})を作る(記憶の分・Domain B も同じ所へ写す)。
 */
export const DEFAULT_MIGRATION_BACKUP_ROOT = join(here, "..", "..", "tmp", "restructure-backups");

/** チャッピーの指示の第 1 候補・既定のモデル。 */
export const CHAPPY_PREFERRED_BRAIN = "codex-61-sol";
/** こーでぃーの指示の候補(この順)・モデル。 */
export const CODY_INSTRUCTION_BRAINS = Object.freeze(["claude-opus-55", "claude"]);
export const CODY_BRAIN = "claude-opus-55";

/** GPT 系(Codex の頭)か。 @param {unknown} id */
export function isGptBrainId(id) {
  return typeof id === "string" && BRAIN_IDS.includes(id) && (id === "codex" || id.startsWith("codex-"));
}

/**
 * 1 回の引っ越しの写しのフォルダ(`<root>/restructure-<YYYYMMDD-HHMMSS>`・手元の時刻)。
 * @param {string} root
 * @param {number} nowMs
 */
export function migrationBackupDir(root, nowMs) {
  const d = new Date(nowMs);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return join(root, `restructure-${stamp}`);
}

/**
 * チャッピーの指示の候補の順: GPT-6.1 Sol → 今の頭(GPT 系なら) → ほかの GPT 系(頭の表の順)。
 * @param {string | null} brainChoice
 * @returns {string[]}
 */
export function chappyInstructionBrains(brainChoice) {
  const order = [CHAPPY_PREFERRED_BRAIN];
  if (isGptBrainId(brainChoice) && !order.includes(/** @type {string} */ (brainChoice))) {
    order.push(/** @type {string} */ (brainChoice));
  }
  for (const id of BRAIN_IDS) {
    if (isGptBrainId(id) && !order.includes(id)) order.push(id);
  }
  return order;
}

/**
 * @param {Record<string, string>} overrides
 * @param {ReadonlyArray<string>} order
 * @returns {{ source: string; text: string | null }}  source は使った頭の id か "default"。
 */
function pickInstruction(overrides, order) {
  for (const id of order) {
    const text = overrides[id];
    if (typeof text === "string" && text.trim().length > 0) return { source: id, text };
  }
  return { source: "default", text: null };
}

/**
 * 設定の値から 2 つのロール(と指示)を決める(書かない・純関数)。
 * @param {{ overrides: Record<string, string>; brainChoice: string | null; ttsEngine: string | null;
 *   verbosityMode: string | null; speakStartMode: string | null; hotwords: ReadonlyArray<string> }} values
 */
export function planRolesFromSettings(values) {
  const shared = {
    voice: { engine: values.ttsEngine ?? undefined, aivisSpeaker: null, elevenLabsVoiceId: null },
    verbosity: values.verbosityMode ?? undefined,
    speakStartMode: values.speakStartMode ?? undefined,
    body: true,
    hotwords: values.hotwords
  };
  const chappyInstruction = pickInstruction(values.overrides, chappyInstructionBrains(values.brainChoice));
  const codyInstruction = pickInstruction(values.overrides, CODY_INSTRUCTION_BRAINS);
  const chappyBrain = isGptBrainId(values.brainChoice) ? /** @type {string} */ (values.brainChoice) : CHAPPY_PREFERRED_BRAIN;
  return [
    {
      role: roleFromIdentity(MODEL_IDENTITIES.chappy, { ...shared, brain: chappyBrain }),
      instruction: chappyInstruction
    },
    {
      role: roleFromIdentity(MODEL_IDENTITIES.cody, { ...shared, brain: CODY_BRAIN }),
      instruction: codyInstruction
    }
  ];
}

/**
 * 設定ファイルを読む(読むだけ・書かない)。無い・壊れたファイルは既定の値になる(設定の部品の読み方のまま)。
 * hotwords は設定に書いてあればその値、無ければ今の既定(LOCAL_STT_DEFAULTS.hotwords)。
 * @param {string} settingsPath
 */
export function readSettingsForMigration(settingsPath) {
  const store = createFileSettingsStore({ path: settingsPath });
  return {
    overrides: store.getConversationInstructionOverrides(),
    brainChoice: store.getBrainChoice(),
    ttsEngine: store.getTtsEngine(),
    verbosityMode: store.getVerbosityMode(),
    speakStartMode: store.getSpeakStartMode(),
    hotwords: store.getLocalStt().hotwords ?? [...LOCAL_STT_DEFAULTS.hotwords]
  };
}

/**
 * @typedef {object} RoleMigrationRoleReport
 * @property {string} id
 * @property {string} brain
 * @property {string} instructionSource  使った指示の元(頭の id か "default")。
 *
 * @typedef {{ status: "skipped" }
 *   | { status: "migrated" | "seeded"; backupDir: string | null; settingsBackupPath: string | null; roles: RoleMigrationRoleReport[] }
 *   | { status: "failed"; error: string; backupDir: string | null; settingsBackupPath: string | null }} RoleMigrationResult
 */

/**
 * ロールの置き場が無いときだけ、設定ファイルからロールを作る(本文は冒頭)。投げない。
 *
 * @param {object} options
 * @param {string} options.rolesDir  ロールの置き場(本番は role-store.mjs の DEFAULT_ROLES_DIR)。
 * @param {string} options.settingsPath  設定ファイル(本番は DEFAULT_SETTINGS_PATH)。
 * @param {string} options.backupDir  この引っ越しの写しのフォルダ(無ければ作る・{@link migrationBackupDir})。
 * @returns {RoleMigrationResult}
 */
export function migrateSettingsToRoles({ rolesDir, settingsPath, backupDir }) {
  if (existsSync(rolesDir)) return { status: "skipped" };
  const hasSettings = existsSync(settingsPath);
  /** @type {string | null} */
  let settingsBackupPath = null;
  if (hasSettings) {
    try {
      mkdirSync(backupDir, { recursive: true });
      const target = join(backupDir, basename(settingsPath));
      copyFileSync(settingsPath, target, fsConstants.COPYFILE_EXCL);
      settingsBackupPath = target;
    } catch (error) {
      return {
        status: "failed",
        error: `設定ファイルの写しを取れない（${error instanceof Error ? error.message : String(error)}）`,
        backupDir: null,
        settingsBackupPath: null
      };
    }
  }
  const staging = `${rolesDir}.migrating-${process.pid}`;
  try {
    rmSync(staging, { recursive: true, force: true });
    const plan = planRolesFromSettings(readSettingsForMigration(settingsPath));
    for (const { role, instruction } of plan) {
      writeRole({ dir: staging, role });
      if (instruction.text != null) writeRoleInstructions({ dir: staging, id: role.id, text: instruction.text });
    }
    renameSync(staging, rolesDir);
    return {
      status: hasSettings ? "migrated" : "seeded",
      backupDir: hasSettings ? backupDir : null,
      settingsBackupPath,
      roles: plan.map(({ role, instruction }) => ({ id: role.id, brain: role.brain, instructionSource: instruction.source }))
    };
  } catch (error) {
    try {
      rmSync(staging, { recursive: true, force: true });
    } catch {
      // best-effort（作業用のフォルダは次の引っ越しの前にも消す）。
    }
    return {
      status: "failed",
      error: `ロールを作れない（${error instanceof Error ? error.message : String(error)}）`,
      backupDir: hasSettings ? backupDir : null,
      settingsBackupPath
    };
  }
}

/**
 * 引っ越しの結果を、ターミナルと操縦席のログに 1 回だけ出す行にする(skipped は出さない = 空)。
 * 指示の本文・設定の中身は書かない(どの頭の上書きを使ったか・置き場だけ)。
 * @param {RoleMigrationResult} result
 * @returns {string[]}
 */
export function formatRoleMigrationReport(result) {
  if (result.status === "skipped") return [];
  if (result.status === "failed") {
    return [
      `ロールへの引っ越しに失敗した: ${result.error}`,
      ...(result.settingsBackupPath ? [`設定ファイルの写し: ${result.settingsBackupPath}`] : []),
      "ロールの置き場は作っていない（次の起動でもう一度引っ越す）。今回は既定のロールで動く。"
    ];
  }
  const head =
    result.status === "migrated"
      ? "今の設定をロールへ引っ越した（古い設定のキーは残してある）。"
      : "設定ファイルが無いので、既定の値でロールを作った。";
  const lines = [head];
  for (const role of result.roles) {
    const source = role.instructionSource === "default" ? "既定の指示" : `${role.instructionSource} の会話指示`;
    lines.push(`ロール ${role.id}: 指示 = ${source}、モデル = ${role.brain}`);
  }
  if (result.settingsBackupPath) lines.push(`設定ファイルの写し: ${result.settingsBackupPath}`);
  return lines;
}

/**
 * @typedef {{ roles: RoleMigrationResult; memories: import("../memory/memory-migration.mjs").MemoryMigrationResult }} StartupMigrationResult
 */

/**
 * 起動時の引っ越しの 1 つの流れ(設定の分 → 記憶の分・配信の組み直し Domain B)。写しのフォルダは 2 つで共有する
 * (1 回の起動で 1 つ)。**動く条件は混ぜない**: 設定の分は `roles/` の有無、記憶の分は `memories/` の直下の記録と
 * `memories/chappy/` の有無だけで決める(`roles/` がすでにある起動でも、まっさらで seeded の起動でも記憶の分は
 * それだけで判定する)。どちらも投げない。
 *
 * @param {object} options
 * @param {string} options.rolesDir  ロールの置き場(本番は DEFAULT_ROLES_DIR)。
 * @param {string} options.settingsPath  設定ファイル(本番は DEFAULT_SETTINGS_PATH)。
 * @param {string} options.memoriesDir  記憶の根(本番は memory-store.mjs の DEFAULT_MEMORY_DIR)。
 * @param {string} options.backupDir  この起動の写しのフォルダ({@link migrationBackupDir})。
 * @returns {StartupMigrationResult}
 */
export function runStartupMigration({ rolesDir, settingsPath, memoriesDir, backupDir }) {
  const roles = migrateSettingsToRoles({ rolesDir, settingsPath, backupDir });
  const memories = migrateMemoriesToRole({ memoriesDir, backupDir });
  return { roles, memories };
}

/**
 * 起動時の引っ越しの結果を、ターミナルと操縦席のログに 1 回だけ出す行にする(設定の分の行 + 記憶の分の行・
 * 記憶の分は移した記録の件数と写しの置き場)。何も起きなければ空。
 * @param {StartupMigrationResult} result
 * @returns {string[]}
 */
export function formatStartupMigrationReport(result) {
  return [...formatRoleMigrationReport(result.roles), ...formatMemoryMigrationReport(result.memories)];
}
