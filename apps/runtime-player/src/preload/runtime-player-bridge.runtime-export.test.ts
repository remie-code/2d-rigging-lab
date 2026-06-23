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
import { runtimeExportBridgeChannels } from "./runtime-export-bridge-channels";
import type { RuntimeExportStatus } from "./runtime-export-bridge-contract";

describe("installRuntimePlayerBridge runtimeExport", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("maps Runtime Export invocations to the Runtime Export IPC channels", () => {
    const api = installAndReadRuntimePlayerApi();

    api.runtimeExport.getStatus();
    api.runtimeExport.openDirectory();
    api.runtimeExport.restoreLastDirectory({ reason: "retry" });
    api.runtimeExport.getLoadedPayload();

    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      runtimeExportBridgeChannels.getStatus
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      2,
      runtimeExportBridgeChannels.openDirectory
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      3,
      runtimeExportBridgeChannels.restoreLastDirectory,
      { reason: "retry" }
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      4,
      runtimeExportBridgeChannels.getLoadedPayload
    );
  });

  it("delivers Runtime Export statusChanged payloads and cleans up subscriptions", () => {
    const api = installAndReadRuntimePlayerApi();
    const callback = vi.fn();
    const payload = {
      status: "loading",
      loaded: false,
      statusLabel: "Restoring Runtime Export",
      directoryPath: "C:/exports/saved.runtime-export",
      operation: "startup-restore"
    } satisfies RuntimeExportStatus;

    const unsubscribe = api.runtimeExport.onStatusChanged(callback);

    expect(electronMocks.on).toHaveBeenCalledWith(
      runtimeExportBridgeChannels.statusChanged,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimeExportStatus) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, payload);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(payload);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      runtimeExportBridgeChannels.statusChanged,
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
