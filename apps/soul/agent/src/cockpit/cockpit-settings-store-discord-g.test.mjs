// @ts-check
/**
 * Discord モード Domain G: Discord の場の見る窓（目）の置き場（cockpit-settings.local.json のキー discordVisionTarget）。
 * 配信の見る窓（visionTarget）とも Discord の準備（discordGuildId など）とも別に持つ。設定ファイルは OS の一時フォルダだけ。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createFileSettingsStore } from "./cockpit-settings-store.mjs";

test("getDiscordVisionTarget / setDiscordVisionTarget: 未記憶は null・記憶して読み直せる・null / \"\" で消す・配信の見る窓と準備は替えない", () => {
  const dir = mkdtempSync(join(tmpdir(), "discord-g-settings-"));
  try {
    const path = join(dir, "cockpit-settings.local.json");
    const store = createFileSettingsStore({ path });
    assert.equal(store.getDiscordVisionTarget(), null);
    store.setVisionTarget("配信の窓");
    store.setDiscordPrep({ guildId: "guild-fake-s", channelId: "channel-fake-s", sttEngine: "parakeet" });
    store.setDiscordVisionTarget("Discord の窓");
    const again = createFileSettingsStore({ path });
    assert.equal(again.getDiscordVisionTarget(), "Discord の窓");
    assert.equal(again.getVisionTarget(), "配信の窓");
    assert.deepEqual(again.getDiscordPrep(), { guildId: "guild-fake-s", channelId: "channel-fake-s", sttEngine: "parakeet" }, "準備の形は D のまま");
    assert.equal(JSON.parse(readFileSync(path, "utf8")).discordVisionTarget, "Discord の窓");
    again.setDiscordVisionTarget(null);
    assert.equal(createFileSettingsStore({ path }).getDiscordVisionTarget(), null);
    again.setDiscordVisionTarget("");
    assert.equal(createFileSettingsStore({ path }).getDiscordVisionTarget(), null);
    assert.equal(createFileSettingsStore({ path }).getVisionTarget(), "配信の窓");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
