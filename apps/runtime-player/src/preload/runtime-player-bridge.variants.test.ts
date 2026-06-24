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

import type { RuntimePlayerApi } from "./runtime-player-bridge-contract";
import { installRuntimePlayerBridge } from "./runtime-player-bridge";
import { runtimeVariantBridgeChannels } from "./runtime-variant-bridge-channels";
import type {
  RuntimePlayerVariantControllerStatus
} from "./runtime-variant-bridge-contract";

describe("installRuntimePlayerBridge variants", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("maps Control Variant actions and subscriptions to IPC channels", () => {
    const api = installAndReadRuntimePlayerApi();
    const callback = vi.fn();
    const status = createVariantStatus();
    const singleRequest = {
      variantGroupId: "vgrp_expression",
      variantId: "var_smile"
    };
    const multiRequest = {
      variantGroupId: "vgrp_accessory",
      variantId: "var_glasses",
      active: false
    };

    api.variants.getStatus();
    api.variants.selectSingle(singleRequest);
    api.variants.toggleMulti(multiRequest);
    api.variants.resetToDefault();
    const unsubscribe = api.variants.onStatusChanged(callback);

    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      runtimeVariantBridgeChannels.getStatus
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      2,
      runtimeVariantBridgeChannels.selectSingle,
      singleRequest
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      3,
      runtimeVariantBridgeChannels.toggleMulti,
      multiRequest
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      4,
      runtimeVariantBridgeChannels.resetToDefault
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

function installAndReadRuntimePlayerApi(): RuntimePlayerApi {
  installRuntimePlayerBridge();
  expect(electronMocks.exposeInMainWorld).toHaveBeenCalledWith(
    "runtimePlayer",
    expect.any(Object)
  );
  return electronMocks.exposeInMainWorld.mock.calls[0]?.[1] as RuntimePlayerApi;
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
