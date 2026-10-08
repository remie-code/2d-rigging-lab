import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn()
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: electronMocks.exposeInMainWorld
  },
  ipcRenderer: {
    invoke: electronMocks.invoke,
    on: electronMocks.on,
    removeListener: electronMocks.removeListener
  }
}));

import type { RuntimePlayerStageApi } from "./runtime-player-stage-bridge-contract";
import { installRuntimePlayerStageBridge } from "./runtime-player-stage-bridge";
import { runtimeVariantBridgeChannels } from "./runtime-variant-bridge-channels";
import type {
  RuntimePlayerVariantControllerStatus
} from "./runtime-variant-bridge-contract";

describe("installRuntimePlayerStageBridge variants", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("maps Stage Variant status reads and subscriptions to IPC channels", () => {
    const api = installAndReadRuntimePlayerStageApi();
    const callback = vi.fn();
    const status = createVariantStatus();

    api.variants.getStatus();
    const unsubscribe = api.variants.onStatusChanged(callback);

    expect(electronMocks.invoke).toHaveBeenCalledWith(
      runtimeVariantBridgeChannels.getStatus
    );
    expect(electronMocks.on).toHaveBeenCalledWith(
      runtimeVariantBridgeChannels.statusChanged,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerVariantControllerStatus) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, status);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(status);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      runtimeVariantBridgeChannels.statusChanged,
      listener
    );
  });
});

function installAndReadRuntimePlayerStageApi(): RuntimePlayerStageApi {
  installRuntimePlayerStageBridge();
  expect(electronMocks.exposeInMainWorld).toHaveBeenCalledWith(
    "runtimePlayerStage",
    expect.any(Object)
  );
  return electronMocks.exposeInMainWorld.mock.calls[0]?.[1] as
    RuntimePlayerStageApi;
}

function createVariantStatus(): RuntimePlayerVariantControllerStatus {
  return {
    schemaVersion: "runtime-player-variant-controller-status-v1",
    state: "ready",
    statusLabel: "Variant switching ready",
    guidance: null,
    controlsEnabled: true,
    groups: [],
    activeVariantSelection: {
      schemaVersion: "runtime-player-active-variant-selection-v1",
      state: "ready",
      activeSelections: [],
      updatedAtIso: "2026-06-24T00:00:00.000Z"
    },
    defaultActiveSelections: [],
    updatedAtIso: "2026-06-24T00:00:00.000Z"
  };
}
