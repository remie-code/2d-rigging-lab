import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createModelMappingRuntimeExportIdentity } from "../model-mapping-profiles/model-mapping-export-identity";
import { createModelMappingProfileDocument } from "../model-mapping-profiles/model-mapping-profile-slots";
import { ModelMappingProfileStore } from "../model-mapping-profiles/model-mapping-profile-store";
import {
  createModelMappingProfileTestParameter,
  createModelMappingProfileTestPayload
} from "../model-mapping-profiles/model-mapping-profile-test-fixtures.test-support";
import { RuntimePlayerLiveMappingState } from "./live-mapping-state";
import { createAutoMappingSlots } from "./runtime-export-auto-mapping";

describe("RuntimePlayerLiveMappingState profile restore status", () => {
  it("propagates profile read failures as visible load warnings with Auto Map fallback", () => {
    const payload = createModelMappingProfileTestPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const state = new RuntimePlayerLiveMappingState();

    const status = state.setRuntimeExportPayload(payload, {
      identity,
      profileFilePath: "profile.json",
      profile: null,
      state: "read-failed",
      warningMessages: ["profile contains invalid JSON"]
    });

    expect(status.profileStatus).toMatchObject({
      kind: "load-warning",
      label: "Profile load failed; using Auto Map",
      warningMessages: ["profile contains invalid JSON"]
    });
    expect(status.slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      target: {
        parameterId: "param_body_angle_z"
      },
      bodyRotationStrength: 0.25
    });
  });

  it("restores packageHash-matched profiles and reports stale saved targets", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-live-mapping-profile-")
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
      packageRevision: 2,
      parameters: [
        createModelMappingProfileTestParameter(
          "param_body_angle_z",
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
    const oldIdentity = createModelMappingRuntimeExportIdentity(oldPayload);
    const store = new ModelMappingProfileStore({ userDataPath });
    await store.saveProfile({
      identity: oldIdentity,
      profile: createModelMappingProfileDocument({
        identity: oldIdentity,
        slots: createAutoMappingSlots(oldPayload).map((slot) =>
          slot.slotId === "body-z"
            ? {
                ...slot,
                bodyRotationStrength: 0.95
              }
            : slot
        ),
        createdAtIso: "2026-06-23T00:00:00.000Z",
        updatedAtIso: "2026-06-23T00:01:00.000Z"
      })
    });
    const loadResult = await store.loadProfile(newPayload);
    const state = new RuntimePlayerLiveMappingState();

    const status = state.setRuntimeExportPayload(newPayload, loadResult);

    expect(loadResult.state).toBe("loaded");
    expect(status.profileStatus.kind).toBe("stale");
    expect(status.profileStatus.warningMessages[0]).toContain(
      "old_body_angle_z"
    );
    expect(status.slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      target: {
        parameterId: "param_body_angle_z"
      },
      bodyRotationStrength: 0.25
    });
  });
});

describe("RuntimePlayerLiveMappingState vowel lipsync toggle", () => {
  it("reports unsupported and disabled when the model has no vowel targets", () => {
    const payload = createModelMappingProfileTestPayload();
    const state = new RuntimePlayerLiveMappingState();

    const status = state.setRuntimeExportPayload(payload);

    expect(status.vowelLipsyncSupported).toBe(false);
    expect(status.vowelLipsyncEnabled).toBe(false);
    expect(state.isVowelLipsyncSupported()).toBe(false);
  });

  it("defaults to enabled when the model resolves a vowel target", () => {
    const payload = createVowelPayload();
    const state = new RuntimePlayerLiveMappingState();

    const status = state.setRuntimeExportPayload(payload);

    expect(status.vowelLipsyncSupported).toBe(true);
    expect(status.vowelLipsyncEnabled).toBe(true);
  });

  it("honors an explicit disable override", () => {
    const payload = createVowelPayload();
    const state = new RuntimePlayerLiveMappingState();
    state.setRuntimeExportPayload(payload);

    const status = state.setVowelLipsyncEnabled(false);

    expect(status.vowelLipsyncEnabled).toBe(false);
    expect(state.isVowelLipsyncEnabled()).toBe(false);
  });

  it("restores the persisted toggle from a saved profile", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-live-mapping-vowel-")
    );
    const payload = createVowelPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const store = new ModelMappingProfileStore({ userDataPath });
    await store.saveProfile({
      identity,
      profile: createModelMappingProfileDocument({
        identity,
        slots: createAutoMappingSlots(payload),
        createdAtIso: "2026-06-23T00:00:00.000Z",
        updatedAtIso: "2026-06-23T00:01:00.000Z",
        vowelLipsyncEnabled: false
      })
    });
    const loadResult = await store.loadProfile(payload);
    const state = new RuntimePlayerLiveMappingState();

    const status = state.setRuntimeExportPayload(payload, loadResult);

    expect(status.vowelLipsyncSupported).toBe(true);
    expect(status.vowelLipsyncEnabled).toBe(false);
  });
});

function createVowelPayload() {
  return createModelMappingProfileTestPayload({
    parameters: [
      createModelMappingProfileTestParameter(
        "param_mouth_vowel_a",
        "Mouth Vowel A",
        "mouth.vowel.a",
        { min: 0, max: 1 }
      )
    ]
  });
}
