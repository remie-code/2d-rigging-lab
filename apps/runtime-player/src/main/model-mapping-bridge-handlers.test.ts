import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import { modelMappingBridgeChannels } from "../preload/model-mapping-bridge-channels";
import type {
  RuntimePlayerMappingActionResult
} from "../preload/model-mapping-bridge-contract";
import { RuntimePlayerBodyFollowState } from "./live-mapping/body-follow-state";
import { RuntimePlayerLiveMappingState } from "./live-mapping/live-mapping-state";
import { createModelMappingRuntimeExportIdentity } from "./model-mapping-profiles/model-mapping-export-identity";
import type { ModelMappingProfileDocument } from "./model-mapping-profiles/model-mapping-profile-document";
import { ModelMappingProfileStore } from "./model-mapping-profiles/model-mapping-profile-store";
import { createModelMappingProfileTestPayload } from "./model-mapping-profiles/model-mapping-profile-test-fixtures.test-support";
import { registerModelMappingBridgeHandlers } from "./model-mapping-bridge-handlers";
import type { RuntimePlayerInputSessionState } from "./input-session-state";
import type { RuntimePlayerLiveParameterBridgeRegistration } from "./live-parameter-bridge-handlers";
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

describe("registerModelMappingBridgeHandlers", () => {
  it("resetToAutoMap regenerates mapping, resets Body Follow, and saves defaults immediately", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-model-mapping-bridge-")
    );
    const payload = createModelMappingProfileTestPayload();
    const mappingState = new RuntimePlayerLiveMappingState();
    const bodyFollowState = new CountingBodyFollowState();
    const profileStore = new ModelMappingProfileStore({ userDataPath });
    const registration = registerModelMappingBridgeHandlers({
      windows: createFakeWindows(),
      inputState: createFakeInputState(),
      mappingState,
      bodyFollowState,
      profileStore,
      liveParameters: createFakeLiveParameters(),
      getActiveInputProfile: async () => null
    });
    await registration.setRuntimeExportPayload(payload);
    mappingState.updateSlot({
      slotId: "body-z",
      bodyRotationStrength: 1.2,
      bodyPositionStrength: 0.1,
      smoothing: 0.2
    });
    bodyFollowState.apply({
      slotId: "body-z",
      targetValue: 7,
      smoothing: 0.75
    });

    const result = await invokeHandler<Promise<RuntimePlayerMappingActionResult>>(
      modelMappingBridgeChannels.resetToAutoMap
    );

    const identity = createModelMappingRuntimeExportIdentity(payload);
    const savedProfile = JSON.parse(
      await readFile(profileStore.getProfileFilePath(identity), "utf8")
    ) as ModelMappingProfileDocument;
    const savedBodyZ = savedProfile.slots.find((slot) =>
      slot.slotId === "body-z"
    );

    expect(result).toMatchObject({
      result: "ok",
      message: "Reset to Auto Map saved.",
      status: {
        profileStatus: {
          kind: "saved"
        }
      }
    });
    expect(bodyFollowState.resetCalls).toBe(1);
    expect(savedBodyZ).toMatchObject({
      bodyRotationStrength: 0.25,
      bodyPositionStrength: 0.4,
      smoothing: 0.75
    });
  });
});

class CountingBodyFollowState extends RuntimePlayerBodyFollowState {
  resetCalls = 0;

  override reset(): void {
    this.resetCalls += 1;
    super.reset();
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

function createFakeInputState(): RuntimePlayerInputSessionState {
  return {
    getLatestTrackingFrame: vi.fn(() => null),
    getSessionNeutral: vi.fn(() => null)
  } as unknown as RuntimePlayerInputSessionState;
}

function createFakeLiveParameters(): RuntimePlayerLiveParameterBridgeRegistration {
  return {
    publishFrame: vi.fn(),
    clear: vi.fn(),
    getLatestFrame: vi.fn(() => null)
  } as unknown as RuntimePlayerLiveParameterBridgeRegistration;
}
