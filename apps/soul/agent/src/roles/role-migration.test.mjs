// @ts-check
// 起動時の引っ越し(設定の分)の機械テスト(配信の組み直し Domain A)。全て OS temp のフォルダに古い設定を置いて
// 走らせる。本物の設定ファイル・apps/soul/agent/roles/ には触れない。
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DEFAULT_MIGRATION_BACKUP_ROOT,
  chappyInstructionBrains,
  formatRoleMigrationReport,
  migrateSettingsToRoles,
  migrationBackupDir
} from "./role-migration.mjs";
import { listRoles, readRole, readRoleInstructions } from "./role-store.mjs";
import { MODEL_IDENTITIES } from "../mind/model-identity.mjs";
import { DEFAULT_CONVERSATION_INSTRUCTION_BODY } from "../mind/fire-orchestrator.mjs";

function setup(t, settings) {
  const root = mkdtempSync(join(tmpdir(), "role-migration-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const settingsPath = join(root, "cockpit-settings.local.json");
  if (settings !== undefined) {
    writeFileSync(settingsPath, typeof settings === "string" ? settings : `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  }
  return {
    root,
    settingsPath,
    rolesDir: join(root, "roles"),
    backupDir: join(root, "tmp", "restructure-backups", "restructure-test")
  };
}

/** @param {any} paths */
const run = (paths) =>
  migrateSettingsToRoles({ rolesDir: paths.rolesDir, settingsPath: paths.settingsPath, backupDir: paths.backupDir });

/** @param {string} rolesDir @param {string} id */
const role = (rolesDir, id) => /** @type {any} */ (readRole({ dir: rolesDir, id })).role;

const OLD_SETTINGS = Object.freeze({
  lastDevice: "Mic",
  brainChoice: "codex-astra",
  verbosityMode: "chatty",
  speakStartMode: "classic",
  ttsEngine: "elevenlabs",
  localSttHotwords: ["チャッピー", "ゲーム名"],
  conversationInstructions: {
    version: 1,
    overrides: {
      "codex-61-sol": "61 Sol の指示",
      "codex-astra": "Astra の指示",
      "claude-opus-55": "Opus 5.5 の指示",
      claude: "Opus 4.8 の指示"
    }
  }
});

test("引っ越し: 古い設定から chappy と cody ができる(名前・モデル・声・口数・話し始め・体・hotwords)", (t) => {
  const paths = setup(t, OLD_SETTINGS);
  const result = run(paths);
  assert.equal(result.status, "migrated");
  assert.deepEqual(listRoles({ dir: paths.rolesDir }).roles.map((r) => r.id), ["chappy", "cody"]);
  const chappy = role(paths.rolesDir, "chappy");
  const cody = role(paths.rolesDir, "cody");
  assert.equal(chappy.name.canonical, MODEL_IDENTITIES.chappy.canonicalName);
  assert.deepEqual([...chappy.nameHints.commentCallVariants], [...MODEL_IDENTITIES.chappy.commentCallVariants]);
  assert.equal(cody.name.display, MODEL_IDENTITIES.cody.displayName);
  assert.equal(cody.nameHints.whisperPrompt, MODEL_IDENTITIES.cody.whisperPrompt);
  // モデル: 今の brainChoice が GPT 系(Astra)なのでチャッピーはそれ。こーでぃーは Opus 5.5。
  assert.equal(chappy.brain, "codex-astra");
  assert.equal(cody.brain, "claude-opus-55");
  // 声・口数・話し始め・hotwords は両方に同じ値を写す。体は両方「使う」。
  for (const r of [chappy, cody]) {
    assert.deepEqual({ ...r.voice }, { engine: "elevenlabs", aivisSpeaker: null, elevenLabsVoiceId: null });
    assert.equal(r.verbosity, "chatty");
    assert.equal(r.speakStartMode, "classic");
    assert.equal(r.body, true);
    assert.deepEqual([...r.nameHints.hotwords], ["チャッピー", "ゲーム名"]);
  }
});

test("引っ越し: 指示の優先順(チャッピー: 61 Sol → ほかの GPT 系 → 既定・こーでぃー: Opus 5.5 → Opus 4.8 → 既定)", (t) => {
  const cases = [
    {
      overrides: { "codex-61-sol": "61", "codex-astra": "astra", "claude-opus-55": "o55", claude: "o48" },
      chappy: ["61", "codex-61-sol"],
      cody: ["o55", "claude-opus-55"]
    },
    {
      overrides: { "codex-56-sol": "56", codex: "terra", claude: "o48" },
      brainChoice: "codex",
      chappy: ["terra", "codex"], // 今の頭(GPT 系)を、ほかの GPT 系より先に見る。
      cody: ["o48", "claude"]
    },
    {
      overrides: { "codex-56-sol": "56", codex: "terra" },
      brainChoice: "claude",
      chappy: ["terra", "codex"], // 今の頭が GPT 系でなければ頭の表の順。
      cody: [null, "default"]
    },
    { overrides: {}, chappy: [null, "default"], cody: [null, "default"] }
  ];
  for (const c of cases) {
    const paths = setup(t, { brainChoice: c.brainChoice, conversationInstructions: { version: 1, overrides: c.overrides } });
    const result = /** @type {any} */ (run(paths));
    const report = Object.fromEntries(result.roles.map((r) => [r.id, r.instructionSource]));
    for (const id of ["chappy", "cody"]) {
      const [text, source] = c[id];
      assert.equal(report[id], source, `${id} ${JSON.stringify(c.overrides)}`);
      const read = readRoleInstructions({ dir: paths.rolesDir, id });
      assert.equal(read.override, text);
      assert.equal(read.body, text ?? DEFAULT_CONVERSATION_INSTRUCTION_BODY);
    }
  }
  assert.deepEqual(chappyInstructionBrains("codex-56-sol"), ["codex-61-sol", "codex-56-sol", "codex", "codex-astra"]);
  assert.deepEqual(chappyInstructionBrains(null), ["codex-61-sol", "codex", "codex-56-sol", "codex-astra"]);
});

test("引っ越し: モデルの決め方(今の頭が GPT 系ならそれ・そうでなければ GPT-6.1 Sol・こーでぃーはいつも Opus 5.5)", (t) => {
  for (const [brainChoice, chappyBrain] of [
    ["codex-56-sol", "codex-56-sol"],
    ["codex-61-sol", "codex-61-sol"],
    ["claude", "codex-61-sol"],
    ["claude-opus-55", "codex-61-sol"],
    ["codex-55", "codex-61-sol"], // 削除済みの頭は GPT 系として扱わない。
    [undefined, "codex-61-sol"]
  ]) {
    const paths = setup(t, { brainChoice });
    run(paths);
    assert.equal(role(paths.rolesDir, "chappy").brain, chappyBrain, String(brainChoice));
    assert.equal(role(paths.rolesDir, "cody").brain, "claude-opus-55");
  }
});

test("引っ越し: 移す前に設定ファイルの写しを取り、古いキーは消さず設定ファイルも書き換えない", (t) => {
  const paths = setup(t, OLD_SETTINGS);
  const before = readFileSync(paths.settingsPath, "utf8");
  const result = /** @type {any} */ (run(paths));
  assert.equal(result.backupDir, paths.backupDir);
  assert.equal(result.settingsBackupPath, join(paths.backupDir, "cockpit-settings.local.json"));
  assert.equal(readFileSync(result.settingsBackupPath, "utf8"), before, "写しは元と同じ中身");
  assert.equal(readFileSync(paths.settingsPath, "utf8"), before, "設定ファイルは書き換えない(古いキーが残る)");
  const kept = JSON.parse(readFileSync(paths.settingsPath, "utf8"));
  assert.equal(kept.brainChoice, "codex-astra");
  assert.equal(kept.conversationInstructions.overrides["codex-61-sol"], "61 Sol の指示");
  // 作業用のフォルダは残らない。
  assert.deepEqual(readdirSync(paths.root).filter((name) => name.startsWith("roles.")), []);
});

test("引っ越し: roles/ があれば 2 回目は何もしない(写しも取らない・手で直したロールを触らない)", (t) => {
  const paths = setup(t, OLD_SETTINGS);
  run(paths);
  writeFileSync(join(paths.rolesDir, "chappy", "instructions.md"), "手で直した指示", "utf8");
  rmSync(paths.backupDir, { recursive: true, force: true });
  assert.deepEqual(run(paths), { status: "skipped" });
  assert.equal(readRoleInstructions({ dir: paths.rolesDir, id: "chappy" }).body, "手で直した指示");
  assert.equal(existsSync(paths.backupDir), false);
  // 空の roles/ でも、あれば引っ越さない。
  const empty = setup(t, OLD_SETTINGS);
  mkdirSync(empty.rolesDir);
  assert.deepEqual(run(empty), { status: "skipped" });
  assert.deepEqual(readdirSync(empty.rolesDir), []);
});

test("引っ越し: 設定ファイルも無いまっさらな起動は、写しを取らずに既定の値で 2 つのロールを作る", (t) => {
  const paths = setup(t, undefined);
  const result = /** @type {any} */ (run(paths));
  assert.equal(result.status, "seeded");
  assert.equal(result.backupDir, null);
  assert.equal(result.settingsBackupPath, null);
  assert.equal(existsSync(paths.backupDir), false);
  const chappy = role(paths.rolesDir, "chappy");
  assert.equal(chappy.brain, "codex-61-sol");
  assert.equal(chappy.verbosity, "normal");
  assert.equal(chappy.speakStartMode, "speak-now");
  assert.equal(chappy.voice.engine, "aivis");
  assert.deepEqual([...chappy.nameHints.hotwords], ["チャッピー", "コーディ"], "今の既定の hotwords");
  assert.equal(existsSync(paths.settingsPath), false, "設定ファイルは作らない");
});

test("引っ越し: 壊れた設定ファイルは写してから既定の値で作る", (t) => {
  const paths = setup(t, "{ broken json");
  const result = /** @type {any} */ (run(paths));
  assert.equal(result.status, "migrated");
  assert.equal(readFileSync(result.settingsBackupPath, "utf8"), "{ broken json");
  assert.equal(role(paths.rolesDir, "cody").verbosity, "normal");
});

test("引っ越し: 写しが取れなければロールを作らずに失敗で返す(次の起動でもう一度)", (t) => {
  const paths = setup(t, OLD_SETTINGS);
  // 写しの置き場にファイルを置いてフォルダを作れなくする。
  mkdirSync(join(paths.root, "tmp"), { recursive: true });
  writeFileSync(join(paths.root, "tmp", "restructure-backups"), "not a folder", "utf8");
  const result = /** @type {any} */ (run(paths));
  assert.equal(result.status, "failed");
  assert.match(result.error, /写しを取れない/);
  assert.equal(existsSync(paths.rolesDir), false);
});

test("引っ越し: 結果の表示は 1 回分の行(使った指示・モデル・写しの置き場)で、指示の本文は出さない", (t) => {
  const paths = setup(t, OLD_SETTINGS);
  const result = run(paths);
  const lines = formatRoleMigrationReport(result);
  assert.equal(lines[0], "今の設定をロールへ引っ越した（古い設定のキーは残してある）。");
  assert.ok(lines.includes("ロール chappy: 指示 = codex-61-sol の会話指示、モデル = codex-astra"));
  assert.ok(lines.includes("ロール cody: 指示 = claude-opus-55 の会話指示、モデル = claude-opus-55"));
  assert.ok(lines.includes(`設定ファイルの写し: ${join(paths.backupDir, "cockpit-settings.local.json")}`));
  assert.equal(lines.join("\n").includes("61 Sol の指示"), false);
  assert.deepEqual(formatRoleMigrationReport({ status: "skipped" }), []);
  const seeded = formatRoleMigrationReport({ status: "seeded", backupDir: null, settingsBackupPath: null, roles: [] });
  assert.deepEqual(seeded, ["設定ファイルが無いので、既定の値でロールを作った。"]);
});

test("引っ越し: 写しの置き場は apps/soul/agent/tmp/restructure-backups/restructure-<日時>", () => {
  assert.ok(DEFAULT_MIGRATION_BACKUP_ROOT.replace(/\\/g, "/").endsWith("apps/soul/agent/tmp/restructure-backups"));
  const dir = migrationBackupDir("/root", new Date(2026, 9, 31, 9, 5, 7).getTime());
  assert.equal(dir.replace(/\\/g, "/"), "/root/restructure-20261031-090507");
});
