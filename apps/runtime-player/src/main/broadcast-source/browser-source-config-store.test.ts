import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  RuntimePlayerBrowserSourceConfigStore,
  parseRuntimePlayerBrowserSourceConfigDocument
} from "./browser-source-config-store";
import { runtimePlayerBrowserSourceDefaultPort } from "./browser-source-url";

const TEST_TOKEN = "stable_browser_source_token_123456";
const REPLACEMENT_TOKEN = "replacement_browser_source_token_123456";

describe("RuntimePlayerBrowserSourceConfigStore", () => {
  it("uses the Runtime Player userData Browser Source config path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-browser-source-config-")
    );
    const store = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath,
      createToken: () => TEST_TOKEN,
      nowIso: () => "2026-06-23T00:00:00.000Z"
    });

    expect(store.getConfigFilePath()).toBe(
      path.join(userDataPath, "browser-source", "browser-source-config.json")
    );

    await expect(store.getOrCreateConfig()).resolves.toStrictEqual({
      token: TEST_TOKEN,
      preferredPort: runtimePlayerBrowserSourceDefaultPort
    });
  });

  it("persists and reuses the Browser Source token across starts", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-browser-source-config-")
    );
    const firstStore = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath,
      createToken: () => TEST_TOKEN,
      nowIso: () => "2026-06-23T00:00:00.000Z"
    });

    const firstConfig = await firstStore.getOrCreateConfig();
    const written = JSON.parse(
      await readFile(firstStore.getConfigFilePath(), "utf8")
    ) as unknown;

    expect(written).toEqual({
      schemaVersion: "runtime-player-browser-source-config-v1",
      updatedAtIso: "2026-06-23T00:00:00.000Z",
      token: TEST_TOKEN,
      preferredPort: runtimePlayerBrowserSourceDefaultPort
    });

    const secondStore = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath,
      createToken: () => REPLACEMENT_TOKEN
    });

    await expect(secondStore.getOrCreateConfig()).resolves.toStrictEqual(
      firstConfig
    );
  });

  it("falls back to the fixed default port when persisted port data is invalid", () => {
    expect(parseRuntimePlayerBrowserSourceConfigDocument({
      schemaVersion: "runtime-player-browser-source-config-v1",
      updatedAtIso: "2026-06-23T00:00:00.000Z",
      token: TEST_TOKEN,
      preferredPort: "bad-port"
    })).toStrictEqual({
      schemaVersion: "runtime-player-browser-source-config-v1",
      updatedAtIso: "2026-06-23T00:00:00.000Z",
      token: TEST_TOKEN,
      preferredPort: runtimePlayerBrowserSourceDefaultPort
    });
  });

  it("uses an injected createPreferredPort when creating a fresh config", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-browser-source-config-")
    );
    const store = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath,
      createToken: () => TEST_TOKEN,
      createPreferredPort: () => 17309
    });

    await expect(store.getOrCreateConfig()).resolves.toStrictEqual({
      token: TEST_TOKEN,
      preferredPort: 17309
    });
  });

  it("supports an async createPreferredPort (auto-assigned free port)", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-browser-source-config-")
    );
    const store = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath,
      createToken: () => TEST_TOKEN,
      createPreferredPort: () => Promise.resolve(51000)
    });

    await expect(store.getOrCreateConfig()).resolves.toStrictEqual({
      token: TEST_TOKEN,
      preferredPort: 51000
    });
  });

  it("keeps token and preferred port independent across two slots", async () => {
    const slotsRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-browser-source-slots-")
    );
    const slotAPath = path.join(slotsRoot, "slots", "tracking-default");
    const slotBPath = path.join(slotsRoot, "slots", "autonomous-default");

    const slotAStore = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath: slotAPath,
      createToken: () => TEST_TOKEN,
      createPreferredPort: () => 17308
    });
    const slotBStore = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath: slotBPath,
      createToken: () => REPLACEMENT_TOKEN,
      createPreferredPort: () => 17309
    });

    const slotAConfig = await slotAStore.getOrCreateConfig();
    const slotBConfig = await slotBStore.getOrCreateConfig();

    expect(slotAConfig).toStrictEqual({
      token: TEST_TOKEN,
      preferredPort: 17308
    });
    expect(slotBConfig).toStrictEqual({
      token: REPLACEMENT_TOKEN,
      preferredPort: 17309
    });
    expect(slotAConfig.token).not.toBe(slotBConfig.token);
    expect(slotAConfig.preferredPort).not.toBe(slotBConfig.preferredPort);

    // Each slot persisted to its own file; neither contaminates the other.
    expect(slotAStore.getConfigFilePath()).not.toBe(
      slotBStore.getConfigFilePath()
    );
    const slotAFile = await readFile(slotAStore.getConfigFilePath(), "utf8");
    const slotBFile = await readFile(slotBStore.getConfigFilePath(), "utf8");
    expect(slotAFile).toContain(TEST_TOKEN);
    expect(slotAFile).not.toContain(REPLACEMENT_TOKEN);
    expect(slotBFile).toContain(REPLACEMENT_TOKEN);
    expect(slotBFile).not.toContain(TEST_TOKEN);
  });

  it("replaces corrupt persisted config with a fresh stable token document", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-browser-source-config-")
    );
    const store = new RuntimePlayerBrowserSourceConfigStore({
      userDataPath,
      createToken: () => REPLACEMENT_TOKEN,
      nowIso: () => "2026-06-23T00:01:00.000Z"
    });

    await mkdir(path.dirname(store.getConfigFilePath()), { recursive: true });
    await writeFile(store.getConfigFilePath(), "{not-json", "utf8");

    await expect(store.getOrCreateConfig()).resolves.toStrictEqual({
      token: REPLACEMENT_TOKEN,
      preferredPort: runtimePlayerBrowserSourceDefaultPort
    });

    const written = await readFile(store.getConfigFilePath(), "utf8");
    expect(written).toContain(REPLACEMENT_TOKEN);
    expect(written).not.toContain(TEST_TOKEN);
  });
});
