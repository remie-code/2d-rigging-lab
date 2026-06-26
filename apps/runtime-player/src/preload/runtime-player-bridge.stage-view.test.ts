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
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "./performance-diagnostics-contract";
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
    api.stageView.getRenderMetrics();
    api.stageView.setRuntimeCoreProfiling("deep");
    api.stageView.reportViewTransform(transform);
    api.stageView.focusStage();
    api.stageView.resetView();
    api.stageView.centerModel();
    api.stageView.setArrangeMode(true);
    api.stageView.setClickThrough(true);
    api.stageView.setAlwaysOnTop(true);
    api.stageView.updateStageMotionSettings({ enabled: true });
    api.stageView.copyWindowTitle();
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
      stageViewBridgeChannels.getRenderMetrics
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      4,
      stageViewBridgeChannels.setRuntimeCoreProfiling,
      "deep"
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      5,
      stageViewBridgeChannels.reportViewTransform,
      transform
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      6,
      stageViewBridgeChannels.focusStage
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      7,
      stageViewBridgeChannels.resetView
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      8,
      stageViewBridgeChannels.centerModel
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      9,
      stageViewBridgeChannels.setArrangeMode,
      true
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      10,
      stageViewBridgeChannels.setClickThrough,
      true
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      11,
      stageViewBridgeChannels.setAlwaysOnTop,
      true
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      12,
      stageViewBridgeChannels.updateStageMotionSettings,
      { enabled: true }
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      13,
      stageViewBridgeChannels.copyWindowTitle
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      14,
      stageViewBridgeChannels.focusStage
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      15,
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

  it("delivers stageView renderMetricsChanged payloads and cleans up subscriptions", () => {
    const api = installAndReadRuntimePlayerApi();
    const callback = vi.fn();
    const payload = createRenderMetrics();

    const unsubscribe = api.stageView.onRenderMetricsChanged(callback);

    expect(electronMocks.on).toHaveBeenCalledWith(
      stageViewBridgeChannels.renderMetricsChanged,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerStageRenderMetricsSnapshot) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, payload);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(payload);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      stageViewBridgeChannels.renderMetricsChanged,
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

function createRenderMetrics(): RuntimePlayerStageRenderMetricsSnapshot {
  return {
    renderCount: 10,
    scheduledRenderCount: 8,
    immediateRenderCount: 2,
    liveFrameMessageCount: 12,
    stageViewTransformMessageCount: 3,
    stageDisplayTransformMessageCount: 4,
    duplicateTransformSkipCount: 1,
    coalescedLiveFrameCount: 2,
    lastRafDeltaMs: 16,
    rafDeltaSampleCount: 7,
    lastRenderDurationMs: 4,
    renderDurationSampleCount: 10,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1
  };
}
