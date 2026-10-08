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
import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "./performance-diagnostics-contract";
import type {
  RuntimePlayerStageArrangeState,
  RuntimePlayerStageViewTransform
} from "./runtime-player-bridge-contract";
import { stageViewBridgeChannels } from "./stage-view-bridge-channels";

describe("installRuntimePlayerStageBridge stageView", () => {
  beforeEach(() => {
    electronMocks.exposeInMainWorld.mockReset();
    electronMocks.invoke.mockReset();
    electronMocks.on.mockReset();
    electronMocks.removeListener.mockReset();
  });

  it("maps Stage view reporter invocations to the Stage view IPC channels", () => {
    const api = installAndReadRuntimePlayerStageApi();
    const transform = createTransform({
      zoomScale: 1.75,
      pan: { x: 12, y: -24 }
    });
    const status = {
      status: "ready" as const,
      statusLabel: "Stage ready",
      message: "Rendered.",
      details: []
    };
    const metrics = createRenderMetrics();

    api.stageView.getViewTransform();
    api.stageView.getArrangeState();
    api.stageView.reportStatus(status);
    api.stageView.reportViewTransform(transform);
    api.stageView.reportRenderMetrics(metrics);

    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      1,
      stageViewBridgeChannels.getViewTransform
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      2,
      stageViewBridgeChannels.getArrangeState
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      3,
      stageViewBridgeChannels.reportStatus,
      status
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      4,
      stageViewBridgeChannels.reportViewTransform,
      transform
    );
    expect(electronMocks.invoke).toHaveBeenNthCalledWith(
      5,
      stageViewBridgeChannels.reportRenderMetrics,
      metrics
    );
  });

  it("delivers applyViewTransformRequested payloads and cleans up subscriptions", () => {
    const api = installAndReadRuntimePlayerStageApi();
    const callback = vi.fn();
    const transform = createTransform({
      zoomScale: 2,
      pan: { x: -10, y: 15 }
    });

    const unsubscribe = api.stageView.onApplyViewTransformRequested(callback);

    expect(electronMocks.on).toHaveBeenCalledWith(
      stageViewBridgeChannels.applyViewTransformRequested,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerStageViewTransform) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, transform);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(transform);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      stageViewBridgeChannels.applyViewTransformRequested,
      listener
    );
  });

  it("delivers display transform payloads and clears them with null", () => {
    const api = installAndReadRuntimePlayerStageApi();
    const callback = vi.fn();
    const transform = createTransform({
      zoomScale: 1.2,
      pan: { x: 18, y: 0 }
    });

    const unsubscribe =
      api.stageView.onApplyDisplayViewTransformRequested(callback);

    expect(electronMocks.on).toHaveBeenCalledWith(
      stageViewBridgeChannels.applyDisplayViewTransformRequested,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerStageViewTransform | null) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, transform);
    listener?.({}, null);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(transform);
    expect(callback).toHaveBeenCalledWith(null);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      stageViewBridgeChannels.applyDisplayViewTransformRequested,
      listener
    );
  });

  it("delivers arrangeStateChanged payloads and cleans up subscriptions", () => {
    const api = installAndReadRuntimePlayerStageApi();
    const callback = vi.fn();
    const state: RuntimePlayerStageArrangeState = {
      arrangeModeEnabled: true
    };

    const unsubscribe = api.stageView.onArrangeStateChanged(callback);

    expect(electronMocks.on).toHaveBeenCalledWith(
      stageViewBridgeChannels.arrangeStateChanged,
      expect.any(Function)
    );
    const listener = electronMocks.on.mock.calls[0]?.[1] as
      | ((event: unknown, payload: RuntimePlayerStageArrangeState) => void)
      | undefined;
    expect(listener).toBeTypeOf("function");

    listener?.({}, state);
    unsubscribe();

    expect(callback).toHaveBeenCalledWith(state);
    expect(electronMocks.removeListener).toHaveBeenCalledWith(
      stageViewBridgeChannels.arrangeStateChanged,
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
    renderCount: 4,
    scheduledRenderCount: 3,
    immediateRenderCount: 1,
    liveFrameMessageCount: 5,
    stageViewTransformMessageCount: 2,
    stageDisplayTransformMessageCount: 1,
    duplicateTransformSkipCount: 0,
    coalescedLiveFrameCount: 1,
    lastRafDeltaMs: 16,
    rafDeltaSampleCount: 3,
    lastRenderDurationMs: 5,
    renderDurationSampleCount: 4,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1
  };
}
