// @ts-check
/**
 * Discord モード Domain D: Discord の準備（サーバー・ボイスチャンネル・文字起こしの方式）の保存（discord-mode.md §6.3・§9）。
 * cockpit-settings-store.mjs の get / set の流儀。一時フォルダの設定ファイルだけ（実データの cockpit-settings.local.json には
 * 触れない）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileSettingsStore } from "./cockpit-settings-store.mjs";

/** @param {(path: string) => void} fn */
function withTempSettings(fn) {
  const dir = mkdtempSync(join(tmpdir(), "discord-d-settings-"));
  try {
    fn(join(dir, "cockpit-settings.local.json"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("Discord の準備: 未記憶は全部 null・配信の文字起こしの選択とは別のキー", () => {
  withTempSettings((path) => {
    const store = createFileSettingsStore({ path });
    assert.deepEqual(store.getDiscordPrep(), { guildId: null, channelId: null, sttEngine: null });
    store.setSttEngine("whisper");
    store.setDiscordPrep({ sttEngine: "elevenlabs" });
    assert.equal(store.getSttEngine(), "whisper", "配信の選択は替わらない");
    assert.equal(store.getDiscordPrep().sttEngine, "elevenlabs");
  });
});

test("Discord の準備: 渡したキーだけ書く・null で消す・ほかの設定を消さない・再起動（作り直し）で読み戻せる", () => {
  withTempSettings((path) => {
    writeFileSync(path, JSON.stringify({ lastDevice: "Mic (fake)", verbosityMode: "quiet" }), "utf8");
    const store = createFileSettingsStore({ path });
    store.setDiscordPrep({ guildId: "guild-fake-1", channelId: "channel-fake-1" });
    store.setDiscordPrep({ sttEngine: "parakeet" });
    assert.deepEqual(createFileSettingsStore({ path }).getDiscordPrep(), {
      guildId: "guild-fake-1",
      channelId: "channel-fake-1",
      sttEngine: "parakeet"
    });
    store.setDiscordPrep({ channelId: null });
    assert.deepEqual(store.getDiscordPrep(), { guildId: "guild-fake-1", channelId: null, sttEngine: "parakeet" });
    store.setDiscordPrep({});
    const raw = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(raw.lastDevice, "Mic (fake)");
    assert.equal(raw.verbosityMode, "quiet");
    assert.equal(raw.discordGuildId, "guild-fake-1");
    assert.equal(raw.discordChannelId, null);
    assert.equal(raw.discordSttEngine, "parakeet");
  });
});

test("Discord の準備: 壊れた JSON・文字列でない値は null（失敗寛容）", () => {
  withTempSettings((path) => {
    writeFileSync(path, "{ not json", "utf8");
    assert.deepEqual(createFileSettingsStore({ path }).getDiscordPrep(), { guildId: null, channelId: null, sttEngine: null });
    writeFileSync(path, JSON.stringify({ discordGuildId: 123, discordChannelId: "", discordSttEngine: ["x"] }), "utf8");
    assert.deepEqual(createFileSettingsStore({ path }).getDiscordPrep(), { guildId: null, channelId: null, sttEngine: null });
  });
});
