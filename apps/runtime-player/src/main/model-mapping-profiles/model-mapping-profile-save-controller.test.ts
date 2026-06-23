import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { RuntimePlayerLiveMappingState } from "../live-mapping/live-mapping-state";
import { ModelMappingProfileSaveController } from "./model-mapping-profile-save-controller";
import type { ModelMappingProfileDocument } from "./model-mapping-profile-document";
import { ModelMappingProfileStore } from "./model-mapping-profile-store";
import { createModelMappingProfileTestPayload } from "./model-mapping-profile-test-fixtures.test-support";

describe("ModelMappingProfileSaveController", () => {
  it("saves reset-to-auto-map state over edited Body Follow controls", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const payload = createModelMappingProfileTestPayload();
    const store = new ModelMappingProfileStore({ userDataPath });
    const profileLoad = await store.loadProfile(payload);
    const mappingState = new RuntimePlayerLiveMappingState();
    mappingState.setRuntimeExportPayload(payload, profileLoad);
    mappingState.updateSlot({
      slotId: "body-z",
      bodyRotationStrength: 1.2,
      bodyPositionStrength: 0.1,
      smoothing: 0.2
    });
    mappingState.regenerateAutoMapping();
    mappingState.markMappingProfileUnsaved();
    const controller = new ModelMappingProfileSaveController({
      mappingState,
      store,
      debounceMs: 1,
      nowIso: () => "2026-06-23T00:02:00.000Z"
    });

    await expect(controller.saveNow()).resolves.toMatchObject({
      result: "saved"
    });

    const written = JSON.parse(
      await readFile(profileLoad.profileFilePath, "utf8")
    ) as {
      readonly slots: readonly {
        readonly slotId: string;
        readonly bodyRotationStrength?: number;
        readonly bodyPositionStrength?: number;
        readonly smoothing?: number;
      }[];
    };
    const bodyZ = written.slots.find((slot) => slot.slotId === "body-z");

    expect(bodyZ).toMatchObject({
      bodyRotationStrength: 0.25,
      bodyPositionStrength: 0.4,
      smoothing: 0.75
    });
  });

  it("flushes debounced changes immediately", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-profiles-")
    );
    const payload = createModelMappingProfileTestPayload();
    const store = new ModelMappingProfileStore({ userDataPath });
    const profileLoad = await store.loadProfile(payload);
    const mappingState = new RuntimePlayerLiveMappingState();
    mappingState.setRuntimeExportPayload(payload, profileLoad);
    const controller = new ModelMappingProfileSaveController({
      mappingState,
      store,
      debounceMs: 60_000,
      nowIso: () => "2026-06-23T00:03:00.000Z"
    });

    mappingState.updateSlot({
      slotId: "body-z",
      bodyRotationStrength: 0.8
    });
    controller.scheduleSave();

    await expect(controller.flush()).resolves.toMatchObject({
      result: "saved"
    });

    const written = JSON.parse(
      await readFile(profileLoad.profileFilePath, "utf8")
    ) as {
      readonly slots: readonly {
        readonly slotId: string;
        readonly bodyRotationStrength?: number;
      }[];
    };

    expect(written.slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      bodyRotationStrength: 0.8
    });
  });

  it("waits for edits made during an in-flight save before flush resolves", async () => {
    const payload = createModelMappingProfileTestPayload();
    const mappingState = new RuntimePlayerLiveMappingState();
    mappingState.setRuntimeExportPayload(payload);
    mappingState.updateSlot({
      slotId: "body-z",
      bodyRotationStrength: 0.6
    });
    mappingState.markMappingProfileUnsaved();
    const savedProfiles: ModelMappingProfileDocument[] = [];
    const firstSave = createDeferred<void>();
    let saveCount = 0;
    const store = {
      saveProfile: async (input: {
        readonly profile: ModelMappingProfileDocument;
      }): Promise<string> => {
        saveCount += 1;
        savedProfiles.push(input.profile);

        if (saveCount === 1) {
          await firstSave.promise;
        }

        return "profile.json";
      }
    } as unknown as ModelMappingProfileStore;
    const controller = new ModelMappingProfileSaveController({
      mappingState,
      store,
      debounceMs: 60_000,
      nowIso: () => `2026-06-23T00:04:0${saveCount}.000Z`
    });
    const firstSavePromise = controller.saveNow();
    const flushPromise = controller.flush();

    mappingState.updateSlot({
      slotId: "body-z",
      bodyRotationStrength: 1.4
    });
    controller.scheduleSave();
    firstSave.resolve(undefined);

    await expect(firstSavePromise).resolves.toMatchObject({
      result: "saved"
    });
    await expect(flushPromise).resolves.toMatchObject({
      result: "saved"
    });

    expect(savedProfiles).toHaveLength(2);
    expect(findBodyZ(savedProfiles[0])).toMatchObject({
      bodyRotationStrength: 0.6
    });
    expect(findBodyZ(savedProfiles[1])).toMatchObject({
      bodyRotationStrength: 1.4
    });
    expect(mappingState.getStatus().profileStatus.kind).toBe("saved");
  });
});

function findBodyZ(profile: ModelMappingProfileDocument | undefined): {
  readonly bodyRotationStrength?: number;
} | undefined {
  return profile?.slots.find((slot) => slot.slotId === "body-z");
}

function createDeferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T | PromiseLike<T>) => void;
} {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}
