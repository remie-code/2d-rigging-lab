import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  adoptRuntimePlayerLegacyDefaults,
  readRuntimePlayerLegacyAdoptionMarker
} from "./legacy-adoption";

async function makeRoot(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "runtime-player-legacy-adoption-"));
}

async function writeFileEnsuringDir(
  filePath: string,
  contents: string
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}

describe("adoptRuntimePlayerLegacyDefaults", () => {
  it("copies known legacy store data into the slot and marks completion", async () => {
    const defaultUserDataPath = await makeRoot();
    const slotUserDataPath = path.join(
      defaultUserDataPath,
      "slots",
      "tracking-default"
    );

    await writeFileEnsuringDir(
      path.join(defaultUserDataPath, "window-state", "runtime-player.json"),
      '{"legacy":true}'
    );
    await writeFileEnsuringDir(
      path.join(
        defaultUserDataPath,
        "browser-source",
        "browser-source-config.json"
      ),
      '{"token":"legacy"}'
    );
    await writeFileEnsuringDir(
      path.join(
        defaultUserDataPath,
        "input-profiles",
        "ifacialmocap",
        "profiles.json"
      ),
      '{"calibration":1}'
    );

    const result = await adoptRuntimePlayerLegacyDefaults({
      defaultUserDataPath,
      slotUserDataPath,
      nowIso: () => "2026-07-10T00:00:00.000Z"
    });

    expect(result.adopted).toBe(true);
    if (result.adopted) {
      expect(result.copiedEntries).toEqual(
        expect.arrayContaining([
          "window-state",
          "browser-source",
          "input-profiles"
        ])
      );
    }

    // Slot now holds copies.
    await expect(
      readFile(
        path.join(slotUserDataPath, "window-state", "runtime-player.json"),
        "utf8"
      )
    ).resolves.toBe('{"legacy":true}');
    await expect(
      readFile(
        path.join(
          slotUserDataPath,
          "input-profiles",
          "ifacialmocap",
          "profiles.json"
        ),
        "utf8"
      )
    ).resolves.toBe('{"calibration":1}');

    // Marker written.
    expect(
      await readRuntimePlayerLegacyAdoptionMarker(slotUserDataPath)
    ).not.toBeNull();
  });

  it("leaves the legacy source data intact (non-destructive)", async () => {
    const defaultUserDataPath = await makeRoot();
    const slotUserDataPath = path.join(
      defaultUserDataPath,
      "slots",
      "tracking-default"
    );
    const legacyFile = path.join(
      defaultUserDataPath,
      "window-state",
      "runtime-player.json"
    );
    await writeFileEnsuringDir(legacyFile, '{"legacy":true}');

    await adoptRuntimePlayerLegacyDefaults({
      defaultUserDataPath,
      slotUserDataPath
    });

    await expect(readFile(legacyFile, "utf8")).resolves.toBe(
      '{"legacy":true}'
    );
  });

  it("is idempotent: a second run does not copy again", async () => {
    const defaultUserDataPath = await makeRoot();
    const slotUserDataPath = path.join(
      defaultUserDataPath,
      "slots",
      "tracking-default"
    );
    const legacyFile = path.join(
      defaultUserDataPath,
      "window-state",
      "runtime-player.json"
    );
    await writeFileEnsuringDir(legacyFile, '{"legacy":"v1"}');

    const first = await adoptRuntimePlayerLegacyDefaults({
      defaultUserDataPath,
      slotUserDataPath
    });
    expect(first.adopted).toBe(true);

    // Change the source after the first adoption; second run must be a no-op.
    await writeFile(legacyFile, '{"legacy":"v2"}', "utf8");

    const second = await adoptRuntimePlayerLegacyDefaults({
      defaultUserDataPath,
      slotUserDataPath
    });

    expect(second).toEqual({ adopted: false, reason: "already-adopted" });
    await expect(
      readFile(
        path.join(slotUserDataPath, "window-state", "runtime-player.json"),
        "utf8"
      )
    ).resolves.toBe('{"legacy":"v1"}');
  });

  it("marks completion even when there is nothing to adopt (fresh install)", async () => {
    const defaultUserDataPath = await makeRoot();
    const slotUserDataPath = path.join(
      defaultUserDataPath,
      "slots",
      "tracking-default"
    );

    const result = await adoptRuntimePlayerLegacyDefaults({
      defaultUserDataPath,
      slotUserDataPath
    });

    expect(result).toMatchObject({ adopted: true, copiedEntries: [] });
    expect(
      await readRuntimePlayerLegacyAdoptionMarker(slotUserDataPath)
    ).not.toBeNull();

    const second = await adoptRuntimePlayerLegacyDefaults({
      defaultUserDataPath,
      slotUserDataPath
    });
    expect(second).toEqual({ adopted: false, reason: "already-adopted" });
  });

  it("does not adopt the slots directory into itself", async () => {
    const defaultUserDataPath = await makeRoot();
    const slotUserDataPath = path.join(
      defaultUserDataPath,
      "slots",
      "tracking-default"
    );
    await writeFileEnsuringDir(
      path.join(defaultUserDataPath, "window-state", "runtime-player.json"),
      "{}"
    );

    await adoptRuntimePlayerLegacyDefaults({
      defaultUserDataPath,
      slotUserDataPath
    });

    // No nested `slots` directory should be copied under the slot.
    await expect(
      readFile(path.join(slotUserDataPath, "slots"), "utf8")
    ).rejects.toThrow();
  });
});
