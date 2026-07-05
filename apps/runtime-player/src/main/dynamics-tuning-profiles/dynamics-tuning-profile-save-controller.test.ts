import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  RuntimeExportDynamicsGroupDto,
  RuntimeExportManifestDto,
  RuntimeExportModelDto,
  RuntimeExportParameterDto
} from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { DynamicsTuningProfileSaveController } from "./dynamics-tuning-profile-save-controller";
import { DynamicsTuningProfileStore } from "./dynamics-tuning-profile-store";
import { RuntimePlayerDynamicsTuningState } from "./dynamics-tuning-state";

describe("DynamicsTuningProfileSaveController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists scheduled updates and reset clears through flush", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-dynamics-tuning-save-")
    );
    const payload = createPayload();
    const store = new DynamicsTuningProfileStore({ userDataPath });
    const state = new RuntimePlayerDynamicsTuningState({
      nowMs: () => Date.parse("2026-06-30T01:00:00.000Z")
    });
    const nowIsoValues = [
      "2026-06-30T01:00:00.000Z",
      "2026-06-30T01:01:00.000Z"
    ];
    const controller = new DynamicsTuningProfileSaveController({
      tuningState: state,
      store,
      debounceMs: 60_000,
      nowIso: () => nowIsoValues.shift() ?? "2026-06-30T01:02:00.000Z"
    });

    state.setRuntimeExportPayload(payload);
    state.updateGroup({
      groupId: "dyn_hair_sway",
      enabled: false,
      outputScale: 0.35,
      damping: 12
    });
    controller.scheduleSave();

    await expect(controller.flush()).resolves.toMatchObject({
      result: "saved"
    });

    const savedUpdate = await store.loadProfile(payload);
    expect(savedUpdate.state).toBe("loaded");
    expect(savedUpdate.profile?.groups).toEqual({
      dyn_hair_sway: {
        enabled: false,
        outputScale: 0.35,
        damping: 12
      }
    });
    expect(savedUpdate.profile?.createdAtIso).toBe(
      "2026-06-30T01:00:00.000Z"
    );

    state.resetGroup({ groupId: "dyn_hair_sway" });
    controller.scheduleSave();

    await expect(controller.flush()).resolves.toMatchObject({
      result: "saved"
    });

    const savedReset = await store.loadProfile(payload);
    expect(savedReset.state).toBe("loaded");
    expect(savedReset.profile?.groups).toEqual({});
    expect(savedReset.profile?.createdAtIso).toBe(
      "2026-06-30T01:00:00.000Z"
    );
    expect(savedReset.profile?.updatedAtIso).toBe(
      "2026-06-30T01:01:00.000Z"
    );
  });

  it("persists scheduled updates after the debounce delay without flush", async () => {
    vi.useFakeTimers();

    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-dynamics-tuning-save-")
    );
    const payload = createPayload();
    const store = new CountingDynamicsTuningProfileStore({ userDataPath });
    const state = new RuntimePlayerDynamicsTuningState({
      nowMs: () => Date.parse("2026-06-30T02:00:00.000Z")
    });
    const controller = new DynamicsTuningProfileSaveController({
      tuningState: state,
      store,
      debounceMs: 1_000,
      nowIso: () => "2026-06-30T02:00:00.000Z"
    });

    state.setRuntimeExportPayload(payload);
    state.updateGroup({
      groupId: "dyn_hair_sway",
      outputScale: 0.42,
      gravityScale: 0.6
    });
    controller.scheduleSave();

    await vi.advanceTimersByTimeAsync(999);
    await expect(store.loadProfile(payload)).resolves.toMatchObject({
      state: "missing",
      profile: null
    });

    await vi.advanceTimersByTimeAsync(1);
    await store.waitForSaveCount(1);

    const savedUpdate = await store.loadProfile(payload);
    expect(savedUpdate.state).toBe("loaded");
    expect(savedUpdate.profile?.groups).toEqual({
      dyn_hair_sway: {
        outputScale: 0.42,
        gravityScale: 0.6
      }
    });
    expect(savedUpdate.profile?.createdAtIso).toBe(
      "2026-06-30T02:00:00.000Z"
    );
    expect(state.getStatus().profileStatus.kind).toBe("saved");
  });
});

class CountingDynamicsTuningProfileStore extends DynamicsTuningProfileStore {
  private readonly saveWaiters: Array<() => void> = [];
  saveCount = 0;

  override async saveProfile(
    input: Parameters<DynamicsTuningProfileStore["saveProfile"]>[0]
  ): Promise<string> {
    const profileFilePath = await super.saveProfile(input);
    this.saveCount += 1;
    this.saveWaiters.splice(0).forEach((resolve) => resolve());

    return profileFilePath;
  }

  async waitForSaveCount(expectedSaveCount: number): Promise<void> {
    while (this.saveCount < expectedSaveCount) {
      await new Promise<void>((resolve) => {
        this.saveWaiters.push(resolve);
      });
    }
  }
}

function createPayload(input: {
  readonly packageId?: string;
  readonly packageHash?: string;
  readonly dynamicsGroups?: readonly RuntimeExportDynamicsGroupDto[];
} = {}): RuntimeExportLoadedPayload {
  const sourcePackage = {
    packageId: input.packageId ?? "pkg_dynamics_tuning_save_test",
    packageDisplayName: "Dynamics Tuning Save Test",
    packageRevision: 1,
    packageHash: input.packageHash ?? "sha256:dynamics-tuning-save-test"
  };
  const parameters = [
    createParameter("param_face_angle_x", "Face Angle X", "external-input"),
    createParameter(
      "param_hair_sway",
      "Hair Sway",
      "computed-dynamics-output"
    )
  ];

  return {
    artifacts: {
      manifest: {
        sourcePackage,
        texturePages: []
      } as unknown as RuntimeExportManifestDto,
      model: {
        sourcePackage,
        parameters,
        inputManifest: {
          externalInputParameterIds: ["param_face_angle_x"],
          computedDynamicsOutputParameterIds: ["param_hair_sway"],
          hiddenDirectControlParameterIds: ["param_hair_sway"]
        },
        dynamicsSolver: {
          solverVersion: "runtime-dynamics-chain-v1",
          fixedStepMs: 16.6667,
          resetPolicy: "reset-to-default-parameters-v1"
        },
        dynamicsGroups: input.dynamicsGroups ?? [createDynamicsGroup()]
      } as unknown as RuntimeExportModelDto,
      atlas: {}
    },
    texturePage: {
      metadata: {},
      bytes: new Uint8Array()
    },
    summary: {
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      modelDisplayName: sourcePackage.packageDisplayName,
      drawableCount: 0,
      meshCount: 0,
      parameterCount: parameters.length,
      maskCount: 0,
      texturePage: {
        pageId: "page",
        path: "textures/page_0.rgba",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      },
      requiredCapabilities: []
    },
    loadedAtIso: "2026-06-30T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createParameter(
  parameterId: string,
  displayName: string,
  runtimeRole: "external-input" | "computed-dynamics-output"
): RuntimeExportParameterDto {
  return {
    parameterId,
    displayName,
    valueSource: "authoredInput",
    runtimeRole,
    externalInput: runtimeRole === "external-input",
    readOnly: runtimeRole !== "external-input",
    min: -30,
    max: 30,
    default: 0
  } as unknown as RuntimeExportParameterDto;
}

function createDynamicsGroup(): RuntimeExportDynamicsGroupDto {
  return {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: "param_face_angle_x",
        kind: "angle",
        scale: 1
      }
    ],
    chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1
    },
    outputs: [
      {
        parameterId: "param_hair_sway",
        segmentIndex: 1,
        scale: 1,
        limit: 1
      }
    ]
  } as unknown as RuntimeExportDynamicsGroupDto;
}
