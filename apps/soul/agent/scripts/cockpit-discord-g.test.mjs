// @ts-check
/**
 * Discord モード Domain G: cockpit.mjs の結線（discord-mode.md §9・§4.3 の 7、E の追認 (1)(4)）。
 *  - createVenueVisionTarget: 発火が撮る見る窓は開いている場の体験で選ぶ（Discord の場は Discord の準備の見る窓・選んでいなければ
 *    null = 画像なしの発火）。配信の場・閉じている間は今まで通り配信の見る窓。
 *  - createDiscordVenueExperience: 一覧の読み込みも今のロールの鍵のファイル名の形が合わなければ断る口（currentKeyFileRefused）を渡す・
 *    Discord の場の見る窓の置き場（settings の getDiscordVisionTarget / setDiscordVisionTarget）を渡す。
 *  - createRoleHooks: 形の合わない discordBotKeyFile のロールを画面で編集・写し・口数などの書き戻しをしても、元の値が role.json に残る。
 *  - main() の結線（ソースの並び）: 発火の getVisionTarget は venueVisionTarget・Discord の体験の口に currentKeyFileRefused。
 * 置き場は OS の一時フォルダだけ。実データ・本物の Discord には触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { createDiscordVenueExperience, createRoleHooks, createVenueVisionTarget } from "./cockpit.mjs";
import { createFileSettingsStore } from "../src/cockpit/cockpit-settings-store.mjs";
import { createFakeDiscord } from "../src/test-support/fake-discord.mjs";
import { DISCORD_REASONS } from "../src/discord/discord-experience.mjs";
import { readRole, roleDiscordBotKeyFileRefused } from "../src/roles/role-store.mjs";

const FAKE_TOKEN = "fake.discord-token_cockpit-g";

test("createVenueVisionTarget: Discord の場は Discord の見る窓（無ければ null）・配信 / 閉じている間は配信の見る窓", () => {
  /** @type {string | null} */
  let kind = null;
  /** @type {string | null} */
  let discordTitle = null;
  const pick = createVenueVisionTarget({
    stream: () => "配信の窓",
    discord: () => discordTitle,
    experience: () => kind
  });
  assert.equal(pick(), "配信の窓", "閉じている間は配信の見る窓");
  kind = "stream";
  assert.equal(pick(), "配信の窓");
  kind = "discord";
  assert.equal(pick(), null, "Discord で選んでいなければ画像なし（配信の窓を撮らない）");
  discordTitle = "Discord の窓";
  assert.equal(pick(), "Discord の窓");
  discordTitle = "";
  assert.equal(pick(), null);
  const throwing = createVenueVisionTarget({
    stream: () => "配信の窓",
    discord: () => {
      throw new Error("x");
    },
    experience: () => "discord"
  });
  assert.equal(throwing(), null, "読めなければ撮らない");
  const unknownKind = createVenueVisionTarget({
    stream: () => "配信の窓",
    discord: () => "Discord の窓",
    experience: () => {
      throw new Error("x");
    }
  });
  assert.equal(unknownKind(), "配信の窓", "体験が読めなければ今まで通り");
});

test("createDiscordVenueExperience: 一覧の読み込みは今のロールの鍵のファイル名の形が合わなければ断る（鍵を読まない）・見る窓の置き場を渡す", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-g-cockpit-"));
  try {
    const settingsPath = path.join(dir, "cockpit-settings.local.json");
    const settings = createFileSettingsStore({ path: settingsPath });
    const fake = createFakeDiscord({ guilds: [] });
    /** @type {string[]} */
    const keyFiles = [];
    /** @type {string[]} */
    const lines = [];
    let refused = true;
    const discord = createDiscordVenueExperience({
      settings,
      currentKeyFile: () => ".env.discord.local",
      currentKeyFileRefused: () => refused,
      write: (line) => lines.push(line),
      loadLibraries: fake.loadLibraries,
      loadToken: (fileName) => {
        keyFiles.push(fileName);
        return { ok: true, token: FAKE_TOKEN };
      }
    });
    assert.deepEqual(await discord.catalog(), { ok: false, reason: DISCORD_REASONS.keyFileName });
    assert.deepEqual(keyFiles, []);
    assert.equal(fake.record.logins.length, 0);
    refused = false;
    assert.equal((await discord.catalog()).ok, true);
    assert.deepEqual(keyFiles, [".env.discord.local"]);
    for (const line of lines) assert.match(line, /^\[cockpit\] discord: .+\n$/);
    // 見る窓の置き場（配信の見る窓とは別のキー）。
    assert.equal(discord.eyesWanted(), false);
    assert.deepEqual(discord.visionTarget.set("Discord の窓"), { ok: true, title: "Discord の窓" });
    assert.equal(createFileSettingsStore({ path: settingsPath }).getDiscordVisionTarget(), "Discord の窓");
    assert.equal(createFileSettingsStore({ path: settingsPath }).getVisionTarget(), null);
    assert.equal(discord.eyesWanted(), true);
    assert.equal(readFileSync(settingsPath, "utf8").includes(FAKE_TOKEN), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createRoleHooks: 形の合わない discordBotKeyFile のロールを画面で編集・口数の書き戻し・写しをしても元の値が残り、断るまま", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "discord-g-roles-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const original = "../keys/.env.discord.local";
  mkdirSync(path.join(dir, "chappy"), { recursive: true });
  writeFileSync(
    path.join(dir, "chappy", "role.json"),
    JSON.stringify({ version: 1, name: { canonical: "チャッピー" }, discordBotKeyFile: original }),
    "utf8"
  );
  let roleChoice = "chappy";
  const hooks = createRoleHooks({
    rolesDir: dir,
    settings: {
      getRoleChoice: () => roleChoice,
      setRoleChoice: (/** @type {string | null} */ id) => {
        roleChoice = id ?? "chappy";
      },
      getBrainChoice: () => null
    }
  });
  assert.equal(roleDiscordBotKeyFileRefused(hooks.current()), true);
  const onDisk = () => JSON.parse(readFileSync(path.join(dir, "chappy", "role.json"), "utf8")).discordBotKeyFile;
  assert.equal(hooks.edit({ body: false }).ok, true, "画面の編集");
  assert.equal(onDisk(), original, "編集しても元の値のまま（\"\" にしない）");
  hooks.update({ verbosity: "quiet" });
  assert.equal(onDisk(), original, "口数などの書き戻しでも元の値のまま");
  assert.equal(roleDiscordBotKeyFileRefused(hooks.current()), true, "断るまま");
  const created = hooks.create({ id: "mio", name: "ミオ" });
  assert.equal(created.ok, true, "写し");
  assert.equal(JSON.parse(readFileSync(path.join(dir, "mio", "role.json"), "utf8")).discordBotKeyFile, original);
  const back = readRole({ dir, id: "mio" });
  assert.equal(back.ok && roleDiscordBotKeyFileRefused(back.role), true, "写しも読み直しても断る");
});

test("場の結線（main・Domain G）: 発火の見る窓は venueVisionTarget（Discord の場は Discord の見る窓）・一覧の読み込みにも鍵のファイル名の断り", () => {
  const source = readFileSync(new URL("./cockpit.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const main = source.slice(source.indexOf("async function main()"));
  assert.match(
    main,
    /const venueVisionTarget = createVenueVisionTarget\(\{\n\s+stream: visionTargetHooks\.getVisionTarget,\n\s+discord: \(\) => settings\.getDiscordVisionTarget\(\),\n\s+experience: \(\) => server\?\.venueContext\(\)\?\.experience \?\? null\n\s+\}\);/
  );
  assert.match(main, /getVisionTarget: venueVisionTarget,/);
  assert.doesNotMatch(main, /getVisionTarget: visionTargetHooks\.getVisionTarget,/, "発火は場の体験で選ぶ口を通る");
  assert.match(main, /currentKeyFileRefused: \(\) => roleDiscordBotKeyFileRefused\(roleHooks\.current\(\)\),/);
  // 配信の見る窓の口（POST /api/vision-target・snapshot の visionTarget）は今まで通り。
  assert.match(main, /onSetVisionTarget: visionTargetHooks\.onSetVisionTarget,/);
  assert.match(main, /visionTargetStatus: visionTargetHooks\.visionTargetStatus,/);
});
