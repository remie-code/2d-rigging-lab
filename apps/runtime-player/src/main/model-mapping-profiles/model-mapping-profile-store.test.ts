import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createModelMappingRuntimeExportIdentity } from "./model-mapping-export-identity";
import { modelMappingProfileSchemaVersion } from "./model-mapping-profile-document";
import { createModelMappingProfileDocument } from "./model-mapping-profile-slots";
import { ModelMappingProfileStore } from "./model-mapping-profile-store";
import {
  createModelMappingProfileTestParameter,
  createModelMappingProfileTestPayload
} from "./model-mapping-profile-test-fixtures.test-support";
import { createAutoMappingSlots } from "../live-mapping/runtime-export-auto-mapping";

describe("ModelMappingProfileStore", () => {
  it("uses the Runtime Player userData model mapping profile path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const payload = createModelMappingProfileTestPayload({
      packageId: "pkg:mapping/test"
    });
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const store = new ModelMappingProfileStore({ userDataPath });

    expect(store.getProfileFilePath(identity)).toBe(
      path.join(
        userDataPath,
        "model-mapping-profiles",
        identity.safePackageId,
        `${identity.fingerprint}.json`
      )
    );

    await expect(store.loadProfile(payload)).resolves.toMatchObject({
      state: "missing",
      profile: null
    });
  });

  it("persists and reloads profile JSON", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const payload = createModelMappingProfileTestPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const slots = createAutoMappingSlots(payload);
    const store = new ModelMappingProfileStore({ userDataPath });
    const profile = createModelMappingProfileDocument({
      identity,
      slots,
      createdAtIso: "2026-06-23T00:00:00.000Z",
      updatedAtIso: "2026-06-23T00:01:00.000Z"
    });

    await store.saveProfile({ identity, profile });

    const written = JSON.parse(
      await readFile(store.getProfileFilePath(identity), "utf8")
    ) as unknown;
    const loaded = await store.loadProfile(payload);

    expect(written).toMatchObject({
      schemaVersion: modelMappingProfileSchemaVersion,
      exportIdentity: {
        packageId: "pkg_mapping_profile_test",
        packageRevision: 1
      }
    });
    expect(loaded.state).toBe("loaded");
    expect(loaded.profile?.slots.find((slot) =>
      slot.slotId === "body-z"
    )).toMatchObject({
      target: {
        parameterId: "param_body_angle_z"
      },
      bodyRotationStrength: 0.25,
      bodyPositionStrength: 0.4,
      smoothing: 0.75
    });
  });

  it("persists and reloads the vowel lipsync toggle when set", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const payload = createModelMappingProfileTestPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const store = new ModelMappingProfileStore({ userDataPath });
    const profile = createModelMappingProfileDocument({
      identity,
      slots: createAutoMappingSlots(payload),
      createdAtIso: "2026-06-23T00:00:00.000Z",
      updatedAtIso: "2026-06-23T00:01:00.000Z",
      vowelLipsyncEnabled: false
    });

    await store.saveProfile({ identity, profile });
    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("loaded");
    expect(loaded.profile?.vowelLipsyncEnabled).toBe(false);
  });

  it("loads legacy profiles that omit the vowel lipsync toggle", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const payload = createModelMappingProfileTestPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const store = new ModelMappingProfileStore({ userDataPath });
    const profile = createModelMappingProfileDocument({
      identity,
      slots: createAutoMappingSlots(payload),
      createdAtIso: "2026-06-23T00:00:00.000Z",
      updatedAtIso: "2026-06-23T00:01:00.000Z"
    });

    await store.saveProfile({ identity, profile });
    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("loaded");
    // Missing field resolves to undefined (state layer defaults it to ON).
    expect(loaded.profile?.vowelLipsyncEnabled).toBeUndefined();
  });

  it("treats matching packageHash as authoritative across revision and signature changes", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const oldPayload = createModelMappingProfileTestPayload({
      packageHash: "sha256:stable-package",
      packageRevision: 1,
      parameters: [
        createModelMappingProfileTestParameter(
          "old_body_angle_z",
          "Body Angle Z",
          "body.angle.z",
          {
            semanticRole: "body",
            min: -10,
            max: 10
          }
        )
      ]
    });
    const newPayload = createModelMappingProfileTestPayload({
      packageHash: "sha256:stable-package",
      packageRevision: 999,
      parameters: [
        createModelMappingProfileTestParameter(
          "param_body_angle_z",
          "Body Angle Z",
          "body.angle.z",
          {
            semanticRole: "body",
            min: -20,
            max: 20
          }
        )
      ]
    });
    const oldIdentity = createModelMappingRuntimeExportIdentity(oldPayload);
    const store = new ModelMappingProfileStore({ userDataPath });

    await store.saveProfile({
      identity: oldIdentity,
      profile: createModelMappingProfileDocument({
        identity: oldIdentity,
        slots: createAutoMappingSlots(oldPayload),
        createdAtIso: "2026-06-23T00:00:00.000Z",
        updatedAtIso: "2026-06-23T00:01:00.000Z"
      })
    });

    const loaded = await store.loadProfile(newPayload);

    expect(loaded.state).toBe("loaded");
    expect(loaded.profile?.exportIdentity).toMatchObject({
      packageHash: "sha256:stable-package",
      packageRevision: 1
    });
    expect(loaded.identity.packageRevision).toBe(999);
    expect(loaded.profile?.exportIdentity.parameterSignatureHash).not.toBe(
      loaded.identity.parameterSignatureHash
    );
  });

  it("requires packageId, revision, and parameter signature when packageHash is absent", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const oldPayload = createModelMappingProfileTestPayload({
      packageRevision: 1,
      parameters: [
        createModelMappingProfileTestParameter(
          "old_body_angle_z",
          "Body Angle Z",
          "body.angle.z",
          {
            semanticRole: "body",
            min: -10,
            max: 10
          }
        )
      ]
    });
    const newPayload = createModelMappingProfileTestPayload({
      packageRevision: 1,
      parameters: [
        createModelMappingProfileTestParameter(
          "param_body_angle_z",
          "Body Angle Z",
          "body.angle.z",
          {
            semanticRole: "body",
            min: -20,
            max: 20
          }
        )
      ]
    });
    const oldIdentity = createModelMappingRuntimeExportIdentity(oldPayload);
    const newIdentity = createModelMappingRuntimeExportIdentity(newPayload);
    const store = new ModelMappingProfileStore({ userDataPath });
    await store.saveProfile({
      identity: newIdentity,
      profile: createModelMappingProfileDocument({
        identity: oldIdentity,
        slots: createAutoMappingSlots(oldPayload),
        createdAtIso: "2026-06-23T00:00:00.000Z",
        updatedAtIso: "2026-06-23T00:01:00.000Z"
      })
    });

    const loaded = await store.loadProfile(newPayload);

    expect(loaded.state).toBe("read-failed");
    expect(loaded.profile).toBeNull();
    expect(loaded.warningMessages).toEqual([
      "Model mapping profile identity does not match the selected Runtime Export."
    ]);
  });

  it("falls back safely when the profile file contains corrupt JSON", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const payload = createModelMappingProfileTestPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const store = new ModelMappingProfileStore({ userDataPath });
    const profileFilePath = store.getProfileFilePath(identity);
    await mkdir(path.dirname(profileFilePath), { recursive: true });
    await writeFile(profileFilePath, "{not-json", "utf8");

    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("read-failed");
    expect(loaded.profile).toBeNull();
    expect(loaded.warningMessages[0]).toContain("invalid JSON");
  });
});
