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

import type {
  RuntimePlayerApi,
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerStageViewTransform
} from "./runtime-player-bridge-contract";
import { installRuntimePlayerBridge } from "./runtime-player-bridge";
import { stageViewBridgeChannels } from "./stage-view-bridge-channels";

describe("installRuntimePlayerBridge stageView", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("maps Control stageView invocations to the Stage view IPC channels", () => {
    const api = installAndReadRuntimePlayerApi();
    const transform = createTransform({
      zoomScale: 1.5,
      pan: { x: -8, y: 16 }
    });

    api.stageView.getState();
    api.stageView.getViewTransform();
    api.stageView.reportViewTransform(transform);
    api.stageView.focusStage();
    api.stageView.resetView();
    api.stageView.centerModel();
    api.focusStage();
    api.resetStagePosition();

    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      stageViewBridgeChannels.getState
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      2,
      stageViewBridgeChannels.getViewTransform
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      3,
      stageViewBridgeChannels.reportViewTransform,
      transform
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      4,
      stageViewBridgeChannels.focusStage
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      5,
      stageViewBridgeChannels.resetView
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      6,
      stageViewBridgeChannels.centerModel
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      7,
      stageViewBridgeChannels.focusStage
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      8,
      stageViewBridgeChannels.resetView
    );
  });

  it("delivers stageView stateChanged payloads and cleans up subscriptions", () => {
    const api = installAndReadRuntimePlayerApi();
    const callback = vi.fn();
    const payload = {
      stageView: {
        transform: createTransform({
          zoomScale: 1.25,
          pan: { x: 0, y: 0 }
        })
      }
    } as RuntimePlayerStageStateSnapshot;

    const unsubscribe = api.stageView.onStateChanged(callback);

    expect(electronMocks.on).toHaveBeenCalledWith(
      stageViewBridgeChannels.stateChanged,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerStageStateSnapshot) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, payload);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(payload);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      stageViewBridgeChannels.stateChanged,
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

function createTransform(input: {
  readonly zoomScale: number;
  readonly pan: RuntimePlayerStageViewTransform["pan"];
}): RuntimePlayerStageViewTransform {
  return {
    zoomScale: input.zoomScale,
    pan: input.pan,
    coordinateSpace: "stage-viewport-px-v1"
  };
}
