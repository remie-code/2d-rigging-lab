import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import type {
  RuntimeExportDynamicsGroupDto,
  RuntimeExportManifestDto,
  RuntimeExportModelDto,
  RuntimeExportParameterDto
} from "@private-2d-rigging-lab/package-format";

import { dynamicsTuningBridgeChannels } from "../preload/dynamics-tuning-bridge-channels";
import type {
  RuntimePlayerDynamicsTuningActionResult
} from "../preload/dynamics-tuning-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../preload/runtime-export-bridge-contract";
import { registerDynamicsTuningBridgeHandlers } from "./dynamics-tuning-bridge-handlers";
import { DynamicsTuningProfileStore } from "./dynamics-tuning-profiles/dynamics-tuning-profile-store";
import { RuntimePlayerDynamicsTuningState } from "./dynamics-tuning-profiles/dynamics-tuning-state";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";

type IpcHandler = (event?: unknown, ...args: unknown[]) => unknown;

let handlers: Map<string, IpcHandler>;

beforeEach(() => {
  handlers = new Map();
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.ipcMainHandle.mockImplementation(
    (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registerDynamicsTuningBridgeHandlers", () => {
  it("update and reset handlers debounce profile persistence after mutating tuning state", async () => {
    vi.useFakeTimers();

    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-dynamics-tuning-bridge-")
    );
    const payload = createPayload();
    const profileStore = new CountingDynamicsTuningProfileStore({
      userDataPath
    });
    const tuningState = new RuntimePlayerDynamicsTuningState({
      nowMs: () => Date.parse("2026-06-30T03:00:00.000Z")
    });
    const registration = registerDynamicsTuningBridgeHandlers({
      windows: createFakeWindows(),
      tuningState,
      profileStore,
      profileSaveDebounceMs: 25
    });

    await registration.setRuntimeExportPayload(payload);

    const updateResult = await invokeHandler<
      Promise<RuntimePlayerDynamicsTuningActionResult>
    >(dynamicsTuningBridgeChannels.updateGroup, {
      groupId: "dyn_hair_sway",
      outputScale: 0.42,
      damping: 12
    });

    expect(updateResult.result).toBe("ok");
    expect(updateResult.status.profileStatus.kind).toBe("unsaved");
    expect(updateResult.status.effectiveProfile?.groups).toEqual({
      dyn_hair_sway: {
        outputScale: 0.42,
        damping: 12
      }
    });

    await vi.advanceTimersByTimeAsync(25);
    await profileStore.waitForSaveCount(1);

    const savedUpdate = await profileStore.loadProfile(payload);
    expect(savedUpdate.state).toBe("loaded");
    expect(savedUpdate.profile?.groups).toEqual({
      dyn_hair_sway: {
        outputScale: 0.42,
        damping: 12
      }
    });

    const resetResult = await invokeHandler<
      Promise<RuntimePlayerDynamicsTuningActionResult>
    >(dynamicsTuningBridgeChannels.resetGroup, {
      groupId: "dyn_hair_sway"
    });

    expect(resetResult.result).toBe("ok");
    expect(resetResult.status.profileStatus.kind).toBe("unsaved");
    expect(resetResult.status.effectiveProfile?.groups).toEqual({});

    await vi.advanceTimersByTimeAsync(25);
    await profileStore.waitForSaveCount(2);

    const savedReset = await profileStore.loadProfile(payload);
    expect(savedReset.state).toBe("loaded");
    expect(savedReset.profile?.groups).toEqual({});
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

function invokeHandler<TResult>(
  channel: string,
  ...args: unknown[]
): TResult {
  const handler = handlers.get(channel);
  expect(handler).toBeTypeOf("function");
  return handler?.({}, ...args) as TResult;
}

function createFakeWindows(): RuntimePlayerWindowSet {
  return {
    controlWindow: createFakeWindow() as unknown as RuntimePlayerWindowSet["controlWindow"],
    stageWindow: createFakeWindow() as unknown as RuntimePlayerWindowSet["stageWindow"]
  };
}

function createFakeWindow() {
  return {
    webContents: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn()
    },
    isDestroyed: vi.fn(() => false)
  };
}

function createPayload(input: {
  readonly packageId?: string;
  readonly packageHash?: string;
  readonly dynamicsGroups?: readonly RuntimeExportDynamicsGroupDto[];
} = {}): RuntimeExportLoadedPayload {
  const sourcePackage = {
    packageId: input.packageId ?? "pkg_dynamics_tuning_bridge_test",
    packageDisplayName: "Dynamics Tuning Bridge Test",
    packageRevision: 1,
    packageHash: input.packageHash ?? "sha256:dynamics-tuning-bridge-test"
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
