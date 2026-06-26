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

import { browserSourceBridgeChannels } from "./browser-source-bridge-channels";
import type {
  RuntimePlayerBrowserSourceStatus
} from "./browser-source-status-contract";
import type { RuntimePlayerApi } from "./runtime-player-bridge-contract";
import { installRuntimePlayerBridge } from "./runtime-player-bridge";

describe("installRuntimePlayerBridge browserSource", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("maps Browser Source status invocations and subscriptions to IPC", () => {
    const api = installAndReadRuntimePlayerApi();
    const callback = vi.fn();
    const status = createStatus({
      state: "running",
      port: 49200,
      browserSourceUrl: "http://127.0.0.1:49200/stage?token=token_fixture"
    });

    api.browserSource.getStatus();
    const unsubscribe = api.browserSource.onStatusChanged(callback);

    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      browserSourceBridgeChannels.getStatus
    );
    expect(electronMocks.on).toHaveBeenCalledWith(
      browserSourceBridgeChannels.statusChanged,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerBrowserSourceStatus) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, status);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(status);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      browserSourceBridgeChannels.statusChanged,
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

function createStatus(
  patch: Partial<RuntimePlayerBrowserSourceStatus> = {}
): RuntimePlayerBrowserSourceStatus {
  return {
    schemaVersion: "runtime-player-browser-source-status-v1",
    state: "stopped",
    statusLabel: "Browser Source server stopped",
    bindAddress: "127.0.0.1",
    port: null,
    browserSourceUrl: null,
    connectedClientCount: 0,
    runtimeExport: {
      state: "empty",
      loaded: false,
      statusLabel: "No Runtime Export loaded",
      loadedAtIso: null,
      summary: null
    },
    latestFrame: null,
    stageDisplayState: {
      stageWindow: {
        bounds: null
      },
      stageView: {
        transform: null
      },
      updatedAtIso: null
    },
    lastClientConnectedAtIso: null,
    lastClientDisconnectedAtIso: null,
    lastClientHeartbeatAtIso: null,
    lastServerHeartbeatAtIso: null,
    latestRendererDiagnostics: null,
    latestClientDiagnostic: null,
    requestDiagnostics: {
      lastStageRequest: null,
      lastAssetRequest: null,
      lastWsUpgradeRejected: null,
      lastWsConnectedAtIso: null,
      lastWsDisconnectedAtIso: null
    },
    errorMessage: null,
    updatedAtIso: "2026-06-23T00:00:00.000Z",
    ...patch
  };
}
