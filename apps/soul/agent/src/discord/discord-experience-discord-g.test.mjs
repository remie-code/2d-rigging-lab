// @ts-check
/**
 * Discord モード Domain G: Discord の体験の口の画面まわりの口（discord-mode.md §9・§4.3 の 7、E の追認 (1)）。
 *  - visionTarget = { get, set }（Discord の場の見る窓・配信の見る窓とは別の置き場）と eyesWanted()（選んでいなければ目を起こさない）。
 *  - catalog() は今のロールの鍵のファイル名の形が合わなければ（currentKeyFileRefused）鍵を読まずログインせずに断る。
 * 設定は OS の一時フォルダの設定ファイルだけ。偽の Discord（fake-discord.mjs）。本物の Discord には触れない。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDiscordExperience,
  checkDiscordVisionTarget,
  normalizeDiscordVisionTarget,
  DISCORD_REASONS,
  DISCORD_VISION_TARGET_MAX_CHARS,
  DISCORD_VISION_TARGET_REFUSALS
} from "./discord-experience.mjs";
import { createFileSettingsStore } from "../cockpit/cockpit-settings-store.mjs";
import { createFakeDiscord } from "../test-support/fake-discord.mjs";

const FAKE_TOKEN = "fake.discord-token_domain-g-unit";

/** @param {(dir: string) => Promise<void> | void} fn */
async function withDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), "discord-g-exp-"));
  try {
    await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("見る窓の形: 空白・文字列でない・長すぎる値は選んでいない扱い（normalize）・書き換えは断る（check）", () => {
  assert.equal(normalizeDiscordVisionTarget("  窓  "), "窓");
  for (const v of [null, undefined, "", "   ", 3, {}, "a".repeat(DISCORD_VISION_TARGET_MAX_CHARS + 1)]) {
    assert.equal(normalizeDiscordVisionTarget(v), null, String(v));
  }
  assert.deepEqual(checkDiscordVisionTarget(null), { ok: true, title: null });
  assert.deepEqual(checkDiscordVisionTarget(""), { ok: true, title: null });
  assert.deepEqual(checkDiscordVisionTarget(" 窓 "), { ok: true, title: "窓" });
  assert.deepEqual(checkDiscordVisionTarget(1), { ok: false, reason: DISCORD_VISION_TARGET_REFUSALS.shape });
  assert.deepEqual(checkDiscordVisionTarget("a".repeat(DISCORD_VISION_TARGET_MAX_CHARS + 1)), {
    ok: false,
    reason: DISCORD_VISION_TARGET_REFUSALS.length
  });
});

test("visionTarget / eyesWanted: 配信の見る窓とは別の置き場・選んでいなければ目を起こさない・置き場が無い設定でも投げない", async () => {
  await withDir((dir) => {
    const path = join(dir, "cockpit-settings.local.json");
    const settings = createFileSettingsStore({ path });
    settings.setVisionTarget("配信の窓");
    const exp = createDiscordExperience({ settings, loadToken: () => ({ ok: false, reason: "読まない" }) });
    assert.equal(exp.visionTarget.get(), null);
    assert.equal(exp.eyesWanted(), false, "選んでいなければ起こさない（配信の見る窓は使わない）");
    assert.deepEqual(exp.visionTarget.set("Discord の窓"), { ok: true, title: "Discord の窓" });
    assert.equal(exp.eyesWanted(), true);
    assert.equal(createFileSettingsStore({ path }).getDiscordVisionTarget(), "Discord の窓");
    assert.equal(createFileSettingsStore({ path }).getVisionTarget(), "配信の窓", "配信の見る窓は替えない");
    assert.equal(exp.visionTarget.set(5).ok, false);
    assert.equal(exp.visionTarget.get(), "Discord の窓", "断ったら書かない");
    assert.deepEqual(exp.visionTarget.set(null), { ok: true, title: null });
    assert.equal(exp.eyesWanted(), false);
  });
  // 置き場の口が無い設定（D・F の偽の設定）: いつも選んでいない・保存は断る（投げない）。
  const bare = createDiscordExperience({ settings: { getDiscordPrep: () => ({}), setDiscordPrep() {} } });
  assert.equal(bare.visionTarget.get(), null);
  assert.equal(bare.eyesWanted(), false);
  assert.equal(bare.visionTarget.set("窓").ok, false);
});

test("catalog: 鍵のファイル名の形が合わなければ鍵を読まずログインせずに断る（理由は入口と同じ・値は出さない）・合えば今まで通り", async () => {
  await withDir(async (dir) => {
    const settings = createFileSettingsStore({ path: join(dir, "s.json") });
    const fake = createFakeDiscord({ guilds: [{ id: "guild-fake-x", name: "試し", channels: [{ id: "channel-fake-x", name: "一般" }] }] });
    /** @type {string[]} */
    const read = [];
    /** @type {string[]} */
    const logs = [];
    let refused = true;
    const exp = createDiscordExperience({
      settings,
      currentKeyFile: () => ".env.discord.local",
      currentKeyFileRefused: () => refused,
      loadToken: (fileName) => {
        read.push(fileName);
        return { ok: true, token: FAKE_TOKEN };
      },
      loadLibraries: fake.loadLibraries,
      log: (line) => logs.push(line)
    });
    assert.deepEqual(await exp.catalog(), { ok: false, reason: DISCORD_REASONS.keyFileName });
    assert.deepEqual(read, [], "鍵を読まない");
    assert.equal(fake.record.logins.length, 0, "ログインしない");
    assert.ok(logs.some((l) => /refused/.test(l)));
    refused = false;
    const ok = await exp.catalog();
    assert.equal(ok.ok, true);
    assert.deepEqual(read, [".env.discord.local"]);
    assert.equal(fake.record.logins.length, 1);
  });
});

test("catalog: 断る口が投げたら断る側に倒す（鍵を読まない）・口を渡さなければ今まで通り断らない（D・F の作り方の互換）", async () => {
  const fake = createFakeDiscord({ guilds: [] });
  /** @type {string[]} */
  const read = [];
  const throwing = createDiscordExperience({
    settings: { getDiscordPrep: () => ({}), setDiscordPrep() {} },
    currentKeyFileRefused: () => {
      throw new Error("壊れた");
    },
    loadToken: (fileName) => {
      read.push(fileName);
      return { ok: true, token: FAKE_TOKEN };
    },
    loadLibraries: fake.loadLibraries
  });
  assert.deepEqual(await throwing.catalog(), { ok: false, reason: DISCORD_REASONS.keyFileName });
  assert.deepEqual(read, []);
  const plain = createDiscordExperience({
    settings: { getDiscordPrep: () => ({}), setDiscordPrep() {} },
    loadToken: (fileName) => {
      read.push(fileName);
      return { ok: true, token: FAKE_TOKEN };
    },
    loadLibraries: fake.loadLibraries
  });
  assert.deepEqual(await plain.catalog(), { ok: true, guilds: [] });
  assert.deepEqual(read, [".env.discord.local"]);
});
