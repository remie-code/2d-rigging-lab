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
import { stagePngCaptureBridgeChannels } from "./stage-png-capture-bridge-channels";

describe("installRuntimePlayerBridge stagePngCapture", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("maps Capture PNG and Open Folder to their IPC channels", () => {
    const api = installAndReadRuntimePlayerApi();

    api.stagePngCapture.capturePng();
    api.stagePngCapture.openFolder();

    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      stagePngCaptureBridgeChannels.capturePng
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      2,
      stagePngCaptureBridgeChannels.openFolder
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
