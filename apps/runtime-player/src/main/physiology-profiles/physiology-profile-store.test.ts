import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createPhysiologyRuntimeExportIdentity
} from "./physiology-export-identity";
import {
  physiologyProfileSchemaVersion,
  type PhysiologyProfileDocument
} from "./physiology-profile-document";
import { PhysiologyProfileStore } from "./physiology-profile-store";

describe("PhysiologyProfileStore", () => {
  it("uses the slot-scoped fingerprint profile path and reports missing", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-profiles-")
    );
    const payload = createPayload({ packageId: "pkg:physiology/test" });
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const store = new PhysiologyProfileStore({ userDataPath });

    expect(store.getProfileFilePath(identity)).toBe(
      path.join(
        userDataPath,
        "physiology-profiles",
        identity.safePackageId,
        `${identity.fingerprint}.json`
      )
    );

    await expect(store.loadProfile(payload)).resolves.toMatchObject({
      state: "missing",
      profile: null
    });
  });

  it("persists and reloads quality-word tone overrides", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-profiles-")
    );
    const payload = createPayload();
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const store = new PhysiologyProfileStore({ userDataPath });
    const profile = createProfileDocument(identity.fingerprint, {
      gaze: { cameraFocus: 0.8, dwell: 0.2 },
      stagePresence: { enabled: true, strength: 0.6 }
    });

    await store.saveProfile({ identity, profile });
    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("loaded");
    expect(loaded.profile?.overrides).toEqual({
      gaze: { cameraFocus: 0.8, dwell: 0.2 },
      stagePresence: { enabled: true, strength: 0.6 }
    });
  });

  it("rejects a profile authored under an unsupported schema version (裁定4 stale)", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-profiles-")
    );
    const payload = createPayload();
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const store = new PhysiologyProfileStore({ userDataPath });
    const profileFilePath = store.getProfileFilePath(identity);
    await mkdir(path.dirname(profileFilePath), { recursive: true });

    const legacyProfile = {
      schemaVersion: "runtime-player-physiology-profile-v0",
      createdAtIso: "2026-07-01T00:00:00.000Z",
      updatedAtIso: "2026-07-01T00:01:00.000Z",
      exportIdentity: {
        packageId: identity.packageId,
        packageRevision: identity.packageRevision,
        fingerprint: identity.fingerprint
      },
      overrides: { gaze: { dwell: 0.9 } }
    };
    await writeFile(
      profileFilePath,
      `${JSON.stringify(legacyProfile, null, 2)}\n`,
      "utf8"
    );

    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("read-failed");
    expect(loaded.profile).toBeNull();
    expect(loaded.warningMessages.join(" ")).toContain("schema version");
  });

  it("rejects a profile whose fingerprint identity does not match", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-profiles-")
    );
    const payload = createPayload();
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const store = new PhysiologyProfileStore({ userDataPath });
    // A document that lives at the right path but claims a different export.
    const mismatched = createProfileDocument("package-hash-somethingelse", {
      gaze: { dwell: 0.9 }
    });
    await store.saveProfile({ identity, profile: mismatched });

    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("read-failed");
    expect(loaded.profile).toBeNull();
    expect(loaded.warningMessages.join(" ")).toContain("does not match");
  });

  it("keeps two Runtime Exports independent by fingerprint path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-profiles-")
    );
    const store = new PhysiologyProfileStore({ userDataPath });
    const payloadA = createPayload({ packageHash: "sha256:export-a" });
    const payloadB = createPayload({ packageHash: "sha256:export-b" });
    const identityA = createPhysiologyRuntimeExportIdentity(payloadA);

    await store.saveProfile({
      identity: identityA,
      profile: createProfileDocument(identityA.fingerprint, {
        head: { sway: 0.9 }
      })
    });

    // Export A is loaded; export B (never saved) is untouched — no interference.
    expect((await store.loadProfile(payloadA)).state).toBe("loaded");
    expect((await store.loadProfile(payloadB)).state).toBe("missing");
    expect(identityA.fingerprint).not.toBe(
      createPhysiologyRuntimeExportIdentity(payloadB).fingerprint
    );
  });

  it("keeps two slots independent by userData root", async () => {
    const slotA = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-slot-a-")
    );
    const slotB = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-slot-b-")
    );
    const payload = createPayload();
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const storeA = new PhysiologyProfileStore({ userDataPath: slotA });
    const storeB = new PhysiologyProfileStore({ userDataPath: slotB });

    await storeA.saveProfile({
      identity,
      profile: createProfileDocument(identity.fingerprint, {
        posture: { drift: 0.7 }
      })
    });

    // The same export in slot B has no profile — the slot userData root separates them.
    expect((await storeA.loadProfile(payload)).state).toBe("loaded");
    expect((await storeB.loadProfile(payload)).state).toBe("missing");
  });

  it("falls back safely when the profile file contains corrupt JSON", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-physiology-profiles-")
    );
    const payload = createPayload();
    const identity = createPhysiologyRuntimeExportIdentity(payload);
    const store = new PhysiologyProfileStore({ userDataPath });
    const profileFilePath = store.getProfileFilePath(identity);
    await mkdir(path.dirname(profileFilePath), { recursive: true });
    await writeFile(profileFilePath, "{not-json", "utf8");

    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("read-failed");
    expect(loaded.profile).toBeNull();
    expect(loaded.warningMessages[0]).toContain("invalid JSON");
  });
});

function createProfileDocument(
  fingerprint: string,
  overrides: PhysiologyProfileDocument["overrides"]
): PhysiologyProfileDocument {
  return {
    schemaVersion: physiologyProfileSchemaVersion,
    createdAtIso: "2026-07-01T00:00:00.000Z",
    updatedAtIso: "2026-07-01T00:01:00.000Z",
    exportIdentity: {
      packageId: "pkg_physiology_test",
      packageRevision: 1,
      fingerprint
    },
    overrides
  };
}

function createPayload(
  input: {
    readonly packageId?: string;
    readonly packageHash?: string;
  } = {}
): RuntimeExportLoadedPayload {
  const sourcePackage = {
    packageId: input.packageId ?? "pkg_physiology_test",
    packageDisplayName: "Physiology Test",
    packageRevision: 1,
    packageHash: input.packageHash ?? "sha256:physiology-test"
  };

  return {
    artifacts: {
      manifest: {
        sourcePackage,
        texturePages: []
      },
      model: { sourcePackage, parameters: [] },
      atlas: {}
    },
    summary: {
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      modelDisplayName: sourcePackage.packageDisplayName
    },
    loadedAtIso: "2026-07-01T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}
