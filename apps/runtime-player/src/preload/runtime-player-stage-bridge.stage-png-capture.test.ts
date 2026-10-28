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
import { stagePngCaptureBridgeChannels } from "./stage-png-capture-bridge-channels";
import type {
  RuntimePlayerStagePngCaptureRequest
} from "./stage-png-capture-bridge-contract";

describe("installRuntimePlayerStageBridge stagePngCapture", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("subscribes to capture requests and answers them with an invoke", () => {
    const api = installAndReadRuntimePlayerStageApi();
    const callback = vi.fn();
    const request: RuntimePlayerStagePngCaptureRequest = {
      requestId: "capture_fixture"
    };
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

    const unsubscribe = api.stagePngCapture.onCaptureRequested(callback);

    expect(electronMocks.on).toHaveBeenCalledWith(
      stagePngCaptureBridgeChannels.captureRequested,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerStagePngCaptureRequest) => void)
      | undefined;
    listener?.({}, request);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(request);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      stagePngCaptureBridgeChannels.captureRequested,
      listener
    );

    api.stagePngCapture.reportCapture({
      requestId: request.requestId,
      result: "ok",
      pngBytes
    });

    expect(electronMocks.invoke).toHaveBeenCalledWith(
      stagePngCaptureBridgeChannels.reportCapture,
      {
        requestId: request.requestId,
        result: "ok",
        pngBytes
      }
    );
  });
});

function installAndReadRuntimePlayerStageApi(): RuntimePlayerStageApi {
  installRuntimePlayerStageBridge();
  expect(electronMocks.exposeInMainWorld).toHaveBeenCalledWith(
    "runtimePlayerStage",
    expect.any(Object)
  );
  return electronMocks.exposeInMainWorld.mock.calls[0]?.[1] as RuntimePlayerStageApi;
}
