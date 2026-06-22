import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createTemporaryDefaultInputProfile } from "./input-profile-defaults";
import { InputProfileStore } from "./input-profile-store";

describe("InputProfileStore", () => {
  it("uses the Runtime Player userData input profile path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-input-profiles-")
    );
    const store = new InputProfileStore({ userDataPath });

    expect(store.getProfileFilePath()).toBe(
      path.join(
        userDataPath,
        "input-profiles",
        "ifacialmocap",
        "profiles.json"
      )
    );

    await expect(store.getSnapshot()).resolves.toMatchObject({
      state: "missing",
      document: {
        profiles: []
      }
    });
  });

  it("persists a saved profile and activeProfileId", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-input-profiles-")
    );
    const store = new InputProfileStore({ userDataPath });
    const profile = {
      ...createTemporaryDefaultInputProfile("2026-06-22T00:00:00.000Z"),
      profileId: "profile_remie_desk",
      displayName: "Remie / desk"
    };

    await store.saveProfile(profile);

    const written = JSON.parse(
      await readFile(store.getProfileFilePath(), "utf8")
    ) as unknown;

    expect(written).toMatchObject({
      schemaVersion: "runtime-player-input-profiles-v1",
      activeProfileId: "profile_remie_desk",
      profiles: [
        {
          profileId: "profile_remie_desk",
          displayName: "Remie / desk"
        }
      ]
    });
  });

  it("falls back safely when the profile file contains corrupt JSON", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-input-profiles-")
    );
    const profileFilePath = path.join(tempRoot, "profiles.json");
    await mkdir(path.dirname(profileFilePath), { recursive: true });
    await writeFile(profileFilePath, "{not-json", "utf8");
    const store = new InputProfileStore({ profileFilePath });

    const snapshot = await store.getSnapshot();

    expect(snapshot.state).toBe("read-failed");
    expect(snapshot.document.profiles).toEqual([]);
    expect(snapshot.warningMessages[0]).toContain("invalid JSON");
  });

  it("skips invalid profiles without throwing", async () => {
    const tempRoot = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-input-profiles-")
    );
    const profileFilePath = path.join(tempRoot, "profiles.json");
    await mkdir(path.dirname(profileFilePath), { recursive: true });
    await writeFile(
      profileFilePath,
      JSON.stringify({
        schemaVersion: "runtime-player-input-profiles-v1",
        activeProfileId: "missing",
        profiles: [
          {
            profileId: "bad",
            displayName: "Bad",
            source: "ifacialmocap",
            transport: "udp",
            createdAtIso: "2026-06-22T00:00:00.000Z",
            updatedAtIso: "2026-06-22T00:00:00.000Z",
            calibration: {}
          }
        ]
      }),
      "utf8"
    );
    const store = new InputProfileStore({ profileFilePath });

    const snapshot = await store.getSnapshot();

    expect(snapshot.state).toBe("loaded");
    expect(snapshot.document.profiles).toEqual([]);
    expect(snapshot.warningMessages).toEqual([
      "Input profile bad has invalid calibration data and was skipped.",
      "Active input profile missing was not found and was ignored."
    ]);
  });
});
