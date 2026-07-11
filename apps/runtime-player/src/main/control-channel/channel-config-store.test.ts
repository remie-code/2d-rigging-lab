import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RuntimePlayerBrowserSourceConfigStore } from "../broadcast-source/browser-source-config-store";
import { RuntimePlayerControlChannelConfigStore } from "./channel-config-store";
import { runtimePlayerControlChannelDefaultPort } from "./channel-slot-ports";

const TEST_TOKEN = "stable_control_channel_token_12345678";
const REPLACEMENT_TOKEN = "replacement_control_channel_token_123456";

describe("RuntimePlayerControlChannelConfigStore", () => {
  it("uses the slot userData channel config path and default port", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-control-channel-config-")
    );
    const store = new RuntimePlayerControlChannelConfigStore({
      userDataPath,
      createToken: () => TEST_TOKEN,
      nowIso: () => "2026-07-11T00:00:00.000Z"
    });

    expect(store.getConfigFilePath()).toBe(
      path.join(userDataPath, "channel", "channel-config.json")
    );
    await expect(store.getOrCreateConfig()).resolves.toStrictEqual({
      token: TEST_TOKEN,
      preferredPort: runtimePlayerControlChannelDefaultPort
    });
  });

  it("persists and reuses the channel token across starts", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-control-channel-config-")
    );
    const firstStore = new RuntimePlayerControlChannelConfigStore({
      userDataPath,
      createToken: () => TEST_TOKEN,
      nowIso: () => "2026-07-11T00:00:00.000Z"
    });
    const firstConfig = await firstStore.getOrCreateConfig();

    const written = JSON.parse(
      await readFile(firstStore.getConfigFilePath(), "utf8")
    ) as unknown;
    expect(written).toEqual({
      schemaVersion: "runtime-player-control-channel-config-v1",
      updatedAtIso: "2026-07-11T00:00:00.000Z",
      token: TEST_TOKEN,
      preferredPort: runtimePlayerControlChannelDefaultPort
    });

    const secondStore = new RuntimePlayerControlChannelConfigStore({
      userDataPath,
      createToken: () => REPLACEMENT_TOKEN
    });
    await expect(secondStore.getOrCreateConfig()).resolves.toStrictEqual(
      firstConfig
    );
  });

  it("supports an async createPreferredPort for custom autonomous slots", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-control-channel-config-")
    );
    const store = new RuntimePlayerControlChannelConfigStore({
      userDataPath,
      createToken: () => TEST_TOKEN,
      createPreferredPort: () => Promise.resolve(52000)
    });

    await expect(store.getOrCreateConfig()).resolves.toStrictEqual({
      token: TEST_TOKEN,
      preferredPort: 52000
    });
  });

  it("keeps channel token and file fully independent from Browser Source in the same slot", async () => {
    const slotUserData = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-slot-")
    );

    const browserSourceStore = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath: slotUserData,
      createToken: () => REPLACEMENT_TOKEN,
      createPreferredPort: () => 17309
    });
    const channelStore = new RuntimePlayerControlChannelConfigStore({
      userDataPath: slotUserData,
      createToken: () => TEST_TOKEN,
      createPreferredPort: () => runtimePlayerControlChannelDefaultPort
    });

    const browserSourceConfig = await browserSourceStore.getOrCreateConfig();
    const channelConfig = await channelStore.getOrCreateConfig();

    // Separate files under the same slot userData.
    expect(browserSourceStore.getConfigFilePath()).not.toBe(
      channelStore.getConfigFilePath()
    );
    expect(channelStore.getConfigFilePath()).toContain(
      path.join("channel", "channel-config.json")
    );

    // Independent tokens and ports; neither file contaminates the other.
    expect(channelConfig.token).not.toBe(browserSourceConfig.token);
    expect(channelConfig.preferredPort).not.toBe(
      browserSourceConfig.preferredPort
    );

    const channelFile = await readFile(
      channelStore.getConfigFilePath(),
      "utf8"
    );
    const browserSourceFile = await readFile(
      browserSourceStore.getConfigFilePath(),
      "utf8"
    );
    expect(channelFile).toContain(TEST_TOKEN);
    expect(channelFile).not.toContain(REPLACEMENT_TOKEN);
    expect(browserSourceFile).toContain(REPLACEMENT_TOKEN);
    expect(browserSourceFile).not.toContain(TEST_TOKEN);
  });
});
