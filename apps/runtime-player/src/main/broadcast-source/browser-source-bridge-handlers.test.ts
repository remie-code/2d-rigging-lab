import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import { browserSourceBridgeChannels } from "../../preload/browser-source-bridge-channels";
import type {
  RuntimePlayerBrowserSourceStatus
} from "../../preload/browser-source-status-contract";
import type { RuntimePlayerWindowSet } from "../window-management/runtime-player-windows";
import { registerBrowserSourceBridgeHandlers } from "./browser-source-bridge-handlers";

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

describe("registerBrowserSourceBridgeHandlers", () => {
  it("exposes narrow Browser Source status and statusChanged events to Control", () => {
    const windows = createFakeWindows();
    const listeners = new Set<(status: RuntimePlayerBrowserSourceStatus) => void>();
    const runningStatus = createStatus({
      state: "running",
      port: 49200,
      browserSourceUrl: "http://127.0.0.1:49200/stage?token=token_fixture"
    });

    const registration = registerBrowserSourceBridgeHandlers({
      windows,
      statusProvider: {
        getStatus: () => runningStatus,
        onStatusChanged: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        }
      }
    });

    expect(invokeHandler(browserSourceBridgeChannels.getStatus)).toBe(
      runningStatus
    );

    const changedStatus = createStatus({
      connectedClientCount: 1,
      lastClientHeartbeatAtIso: "2026-06-23T01:00:00.000Z"
    });
    for (const listener of listeners) {
      listener(changedStatus);
    }

    expect(windows.controlWindow.webContents.send).toHaveBeenCalledWith(
      browserSourceBridgeChannels.statusChanged,
      changedStatus
    );

    registration.dispose();
    expect(listeners.size).toBe(0);
  });
});

function invokeHandler(channel: string): unknown {
  const handler = handlers.get(channel);
  expect(handler).toBeTypeOf("function");
  return handler?.({});
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
