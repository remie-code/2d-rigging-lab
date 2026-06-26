import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  clipboardWriteText: vi.fn(),
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  clipboard: {
    writeText: electronMocks.clipboardWriteText
  },
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import type {
  RuntimePlayerStageRenderMetricsSnapshot
} from "../preload/performance-diagnostics-contract";
import type {
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerStageViewActionResult,
  RuntimePlayerStageViewTransform,
  RuntimePlayerWindowBounds
} from "../preload/runtime-player-bridge-contract";
import { stageViewBridgeChannels } from "../preload/stage-view-bridge-channels";
import { registerStageViewBridgeHandlers } from "./stage-view-bridge-handlers";
import { runtimePlayerDefaultStageMotionSettings } from "./window-state/window-state-stage-motion-settings";
import type { RuntimePlayerWindowSet } from "./window-management/runtime-player-windows";
import type { RuntimePlayerWindowStateController } from "./window-state/window-state-controller";
import {
  createResetRuntimePlayerStageViewTransform,
  normalizeRuntimePlayerStageViewTransform
} from "./window-state/window-state-document";

type IpcHandler = (event?: unknown, ...args: unknown[]) => unknown;

let handlers: Map<string, IpcHandler>;

beforeEach(() => {
  handlers = new Map();
  electronMocks.clipboardWriteText.mockReset();
  electronMocks.ipcMainHandle.mockReset();
  electronMocks.ipcMainHandle.mockImplementation(
    (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    }
  );
});

describe("registerStageViewBridgeHandlers", () => {
  it("focusStage restores, shows, and focuses the Stage window before returning current state", () => {
    const initialTransform = createTransform({
      zoomScale: 1.25,
      pan: { x: 10, y: -12 }
    });
    const { stageWindow } = createHarness({
      stageWindow: {
        minimized: true
      },
      windowState: {
        transform: initialTransform
      }
    });

    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.focusStage
    );

    expect(stageWindow.restore).toHaveBeenCalledTimes(1);
    expect(stageWindow.show).toHaveBeenCalledTimes(1);
    expect(stageWindow.focus).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      result: "ok",
      message: "Stage Window focused.",
      status: {
        stageWindow: {
          windowState: "created",
          bounds: defaultStageBounds
        },
        stageView: {
          transform: initialTransform
        },
        persistence: {
          status: "saved",
          statusLabel: "Saved"
        }
      }
    });
  });

  it("getState and getViewTransform return the controller snapshot and transform", () => {
    const transform = createTransform({
      zoomScale: 1.8,
      pan: { x: -32, y: 44 }
    });

    createHarness({
      windowState: {
        transform
      }
    });

    expect(
      invokeHandler<RuntimePlayerStageViewTransform>(
        stageViewBridgeChannels.getViewTransform
      )
    ).toEqual(transform);
    expect(
      invokeHandler<RuntimePlayerStageStateSnapshot>(
        stageViewBridgeChannels.getState
      )
    ).toMatchObject({
      stageWindow: {
        windowState: "created",
        bounds: defaultStageBounds
      },
      stageView: {
        transform
      },
      persistence: {
        status: "saved"
      },
      capture: {
        arrangeModeEnabled: false,
        clickThroughEnabled: false,
        alwaysOnTopEnabled: false,
        windowTitle: "Runtime Player Stage",
        background: "transparent",
        stageUi: "hidden"
      }
    });
  });

  it("stores Stage render metrics snapshots and publishes them to Control", () => {
    const { controlWindow } = createHarness();
    const metrics = createRenderMetrics();

    expect(
      invokeHandler<RuntimePlayerStageRenderMetricsSnapshot | null>(
        stageViewBridgeChannels.getRenderMetrics
      )
    ).toBeNull();

    expect(
      invokeHandler<RuntimePlayerStageRenderMetricsSnapshot>(
        stageViewBridgeChannels.reportRenderMetrics,
        metrics
      )
    ).toEqual(metrics);
    expect(
      invokeHandler<RuntimePlayerStageRenderMetricsSnapshot | null>(
        stageViewBridgeChannels.getRenderMetrics
      )
    ).toEqual(metrics);
    expect(controlWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.renderMetricsChanged,
      metrics
    );
  });

  it("stores runtime-core profiling mode and publishes it to the Stage window", () => {
    const { stageWindow } = createHarness();

    expect(
      invokeHandler(stageViewBridgeChannels.getRuntimeCoreProfiling)
    ).toBe("disabled");
    expect(
      invokeHandler(stageViewBridgeChannels.setRuntimeCoreProfiling, "deep")
    ).toBe("deep");
    expect(
      invokeHandler(stageViewBridgeChannels.getRuntimeCoreProfiling)
    ).toBe("deep");
    expect(stageWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.runtimeCoreProfilingChanged,
      "deep"
    );
    expect(() =>
      invokeHandler(stageViewBridgeChannels.setRuntimeCoreProfiling, "full")
    ).toThrow("profiling mode");
  });

  it.each([
    ["negative count", { ...createRenderMetrics(), renderCount: -1 }],
    ["non-integer count", { ...createRenderMetrics(), renderCount: 1.5 }],
    ["NaN rAF delta", { ...createRenderMetrics(), lastRafDeltaMs: Number.NaN }],
    [
      "Infinity render duration",
      { ...createRenderMetrics(), lastRenderDurationMs: Infinity }
    ],
    ["invalid canvas size", { ...createRenderMetrics(), canvasWidth: -1 }],
    ["non-integer canvas size", { ...createRenderMetrics(), canvasHeight: 720.5 }],
    [
      "invalid device pixel ratio",
      { ...createRenderMetrics(), devicePixelRatio: 0 }
    ],
    ["malformed nested renderMetrics", { renderMetrics: createRenderMetrics() }]
  ])("rejects malformed Stage render metrics IPC payloads: %s", (_label, payload) => {
    const { controlWindow } = createHarness();

    expect(() =>
      invokeHandler<RuntimePlayerStageRenderMetricsSnapshot>(
        stageViewBridgeChannels.reportRenderMetrics,
        payload
      )
    ).toThrow("Stage render metrics");
    expect(
      invokeHandler<RuntimePlayerStageRenderMetricsSnapshot | null>(
        stageViewBridgeChannels.getRenderMetrics
      )
    ).toBeNull();
    expect(controlWindow.webContents.send).not.toHaveBeenCalledWith(
      stageViewBridgeChannels.renderMetricsChanged,
      expect.anything()
    );
  });

  it("starts click-through off and applies persisted always-on-top to the Stage window", () => {
    const { stageWindow } = createHarness({
      windowState: {
        alwaysOnTop: true
      }
    });

    expect(stageWindow.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
    expect(stageWindow.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(
      invokeHandler<RuntimePlayerStageStateSnapshot>(
        stageViewBridgeChannels.getState
      ).capture
    ).toMatchObject({
      clickThroughEnabled: false,
      alwaysOnTopEnabled: true
    });
  });

  it("setArrangeMode publishes Control state and Stage arrange state", () => {
    const { controlWindow, stageWindow } = createHarness();

    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.setArrangeMode,
      true
    );

    expect(result.status.capture).toMatchObject({
      arrangeModeEnabled: true,
      clickThroughEnabled: false,
      stageUi: "arrange-overlay-visible"
    });
    expect(controlWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.stateChanged,
      expect.objectContaining({
        capture: expect.objectContaining({
          arrangeModeEnabled: true
        })
      })
    );
    expect(stageWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.arrangeStateChanged,
      {
        arrangeModeEnabled: true
      }
    );
  });

  it("setClickThrough applies BrowserWindow mouse passthrough and disables arrange mode", () => {
    const { stageWindow, onCaptureStateChanged } = createHarness();

    invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.setArrangeMode,
      true
    );
    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.setClickThrough,
      true
    );

    expect(stageWindow.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true);
    expect(result.status.capture).toMatchObject({
      arrangeModeEnabled: false,
      clickThroughEnabled: true,
      stageUi: "hidden"
    });
    expect(stageWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.arrangeStateChanged,
      {
        arrangeModeEnabled: false
      }
    );
    expect(onCaptureStateChanged).toHaveBeenCalled();
  });

  it("bridge registration disables click-through for tray/menu recovery", () => {
    const { stageWindow, registration } = createHarness();

    invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.setClickThrough,
      true
    );

    expect(registration.getCaptureState().clickThroughEnabled).toBe(true);
    expect(registration.disableClickThrough()).toBe(true);
    expect(registration.getCaptureState().clickThroughEnabled).toBe(false);
    expect(stageWindow.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
    expect(registration.disableClickThrough()).toBe(false);
  });

  it("setAlwaysOnTop updates the Stage window and persisted window state", () => {
    const { stageWindow, windowState } = createHarness();

    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.setAlwaysOnTop,
      true
    );

    expect(stageWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
    expect(windowState.updateStageAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(result.status.capture.alwaysOnTopEnabled).toBe(true);
  });

  it("updateStageMotionSettings persists settings and publishes Control state", () => {
    const { controlWindow, windowState, onStageMotionSettingsChanged } =
      createHarness();

    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.updateStageMotionSettings,
      {
        enabled: true,
        horizontal: {
          strengthPx: 96
        }
      }
    );

    expect(windowState.updateStageMotionSettings).toHaveBeenCalledWith({
      enabled: true,
      horizontal: {
        strengthPx: 96
      }
    });
    expect(onStageMotionSettingsChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        horizontal: expect.objectContaining({
          strengthPx: 96
        })
      })
    );
    expect(controlWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.stateChanged,
      expect.objectContaining({
        stageMotion: expect.objectContaining({
          settings: expect.objectContaining({
            enabled: true
          })
        })
      })
    );
    expect(result.status.stageMotion.settings.enabled).toBe(true);
  });

  it("publishes display transforms to the Stage window without saving base view", () => {
    const { stageWindow, windowState, registration } = createHarness();
    const transform = createTransform({
      zoomScale: 1.2,
      pan: { x: 14, y: -2 }
    });

    registration.publishDisplayViewTransform(transform);

    expect(windowState.updateStageViewTransform).not.toHaveBeenCalled();
    expect(stageWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.applyDisplayViewTransformRequested,
      transform
    );
  });

  it("copyWindowTitle writes the stable Stage title to the clipboard", () => {
    createHarness();

    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.copyWindowTitle
    );

    expect(electronMocks.clipboardWriteText).toHaveBeenCalledWith(
      "Runtime Player Stage"
    );
    expect(result.message).toContain("Runtime Player Stage");
  });

  it("resetView stores the reset transform and asks the Stage window to apply it", () => {
    const { stageWindow, windowState } = createHarness({
      windowState: {
        transform: createTransform({
          zoomScale: 1.8,
          pan: { x: 22, y: -33 }
        })
      }
    });
    const resetTransform = createResetRuntimePlayerStageViewTransform();

    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.resetView
    );

    expect(windowState.updateStageViewTransform).toHaveBeenCalledWith(
      resetTransform
    );
    expect(stageWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.applyViewTransformRequested,
      resetTransform
    );
    expect(result).toMatchObject({
      result: "ok",
      message: "Stage view reset.",
      status: {
        stageView: {
          transform: resetTransform
        }
      }
    });
  });

  it("centerModel preserves zoom, clears pan, and asks the Stage window to apply it", () => {
    const { stageWindow, windowState } = createHarness({
      windowState: {
        transform: createTransform({
          zoomScale: 2.25,
          pan: { x: 88, y: -64 }
        })
      }
    });
    const centeredTransform = createTransform({
      zoomScale: 2.25,
      pan: { x: 0, y: 0 }
    });

    const result = invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.centerModel
    );

    expect(windowState.updateStageViewTransform).toHaveBeenCalledWith(
      centeredTransform
    );
    expect(stageWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.applyViewTransformRequested,
      centeredTransform
    );
    expect(result.status.stageView.transform).toEqual(centeredTransform);
  });

  it("reportViewTransform stores the transform and publishes stateChanged to Control", () => {
    const { controlWindow, windowState } = createHarness();
    const transform = createTransform({
      zoomScale: 1.4,
      pan: { x: -10, y: 20 }
    });

    const state = invokeHandler<RuntimePlayerStageStateSnapshot>(
      stageViewBridgeChannels.reportViewTransform,
      transform
    );

    expect(windowState.updateStageViewTransform).toHaveBeenCalledWith(
      transform
    );
    expect(controlWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.stateChanged,
      expect.objectContaining({
        stageView: expect.objectContaining({
          transform
        })
      })
    );
    expect(state.stageView.transform).toEqual(transform);
  });
});

function invokeHandler<TResult>(
  channel: string,
  ...args: unknown[]
): TResult {
  const handler = handlers.get(channel);
  expect(handler).toBeTypeOf("function");
  return handler?.({}, ...args) as TResult;
}

function createHarness(options: {
  readonly controlWindow?: FakeWindowOptions;
  readonly stageWindow?: FakeWindowOptions;
  readonly windowState?: {
    readonly transform?: RuntimePlayerStageViewTransform;
    readonly alwaysOnTop?: boolean;
  };
} = {}): {
  readonly controlWindow: ReturnType<typeof createFakeWindow>;
  readonly stageWindow: ReturnType<typeof createFakeWindow>;
  readonly windowState: ReturnType<typeof createFakeWindowState>;
  readonly onCaptureStateChanged: ReturnType<typeof vi.fn>;
  readonly onStageMotionSettingsChanged: ReturnType<typeof vi.fn>;
  readonly registration: ReturnType<typeof registerStageViewBridgeHandlers>;
} {
  const controlWindow = createFakeWindow({
    bounds: defaultControlBounds,
    ...options.controlWindow
  });
  const stageWindow = createFakeWindow({
    bounds: defaultStageBounds,
    ...options.stageWindow
  });
  const windowState = createFakeWindowState(
    options.windowState?.transform ?? createResetRuntimePlayerStageViewTransform(),
    options.windowState?.alwaysOnTop ?? false
  );
  const onCaptureStateChanged = vi.fn();
  const onStageMotionSettingsChanged = vi.fn();
  const windows: RuntimePlayerWindowSet = {
    controlWindow:
      controlWindow as unknown as RuntimePlayerWindowSet["controlWindow"],
    stageWindow: stageWindow as unknown as RuntimePlayerWindowSet["stageWindow"]
  };

  const registration = registerStageViewBridgeHandlers({
    windows,
    windowState: windowState.controller,
    onCaptureStateChanged,
    onStageMotionSettingsChanged
  });

  return {
    controlWindow,
    stageWindow,
    windowState,
    onCaptureStateChanged,
    onStageMotionSettingsChanged,
    registration
  };
}

type FakeWindowOptions = {
  readonly bounds?: RuntimePlayerWindowBounds;
  readonly destroyed?: boolean;
  readonly minimized?: boolean;
  readonly webContentsDestroyed?: boolean;
};

function createFakeWindow(options: FakeWindowOptions = {}) {
  let destroyed = options.destroyed ?? false;
  let minimized = options.minimized ?? false;
  const webContentsDestroyed = options.webContentsDestroyed ?? false;
  const bounds = options.bounds ?? defaultStageBounds;

  return {
    webContents: {
      isDestroyed: vi.fn(() => webContentsDestroyed),
      send: vi.fn()
    },
    isDestroyed: vi.fn(() => destroyed),
    isMinimized: vi.fn(() => minimized),
    restore: vi.fn(() => {
      minimized = false;
    }),
    show: vi.fn(),
    focus: vi.fn(),
    getBounds: vi.fn(() => bounds),
    getTitle: vi.fn(() => "Runtime Player Stage"),
    setIgnoreMouseEvents: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    destroy: () => {
      destroyed = true;
    }
  };
}

function createFakeWindowState(
  initialTransform: RuntimePlayerStageViewTransform,
  initialAlwaysOnTop: boolean
) {
  let transform = initialTransform;
  let alwaysOnTop = initialAlwaysOnTop;
  let stageMotionSettings = runtimePlayerDefaultStageMotionSettings;
  const listeners = new Set<() => void>();
  const getStageViewTransform = vi.fn(() => transform);
  const getStageAlwaysOnTop = vi.fn(() => alwaysOnTop);
  const getStageMotionSettings = vi.fn(() => stageMotionSettings);
  const updateStageViewTransform = vi.fn((value: unknown) => {
    transform = normalizeRuntimePlayerStageViewTransform(value);
    for (const listener of listeners) {
      listener();
    }
    return transform;
  });
  const updateStageAlwaysOnTop = vi.fn((value: unknown) => {
    alwaysOnTop = typeof value === "boolean" ? value : false;
    for (const listener of listeners) {
      listener();
    }
    return alwaysOnTop;
  });
  const updateStageMotionSettings = vi.fn((value: unknown) => {
    if (typeof value === "object" && value !== null && "enabled" in value) {
      stageMotionSettings = {
        ...stageMotionSettings,
        enabled: value.enabled === true
      };
    }
    if (
      typeof value === "object" &&
      value !== null &&
      "horizontal" in value &&
      typeof value.horizontal === "object" &&
      value.horizontal !== null &&
      "strengthPx" in value.horizontal &&
      typeof value.horizontal.strengthPx === "number"
    ) {
      stageMotionSettings = {
        ...stageMotionSettings,
        horizontal: {
          ...stageMotionSettings.horizontal,
          strengthPx: value.horizontal.strengthPx
        }
      };
    }
    for (const listener of listeners) {
      listener();
    }
    return stageMotionSettings;
  });
  const getPersistenceSnapshot = vi.fn(() => ({
    status: "saved" as const,
    statusLabel: "Saved",
    storageLabel: "window-state/runtime-player.json" as const,
    updatedAtIso: "2026-06-23T00:00:00.000Z",
    warningMessages: []
  }));
  const subscribe = vi.fn((listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  });

  return {
    controller: {
      getStageViewTransform,
      getStageAlwaysOnTop,
      getStageMotionSettings,
      updateStageViewTransform,
      updateStageAlwaysOnTop,
      updateStageMotionSettings,
      getPersistenceSnapshot,
      subscribe
    } as unknown as RuntimePlayerWindowStateController,
    getStageViewTransform,
    getStageAlwaysOnTop,
    getStageMotionSettings,
    updateStageViewTransform,
    updateStageAlwaysOnTop,
    updateStageMotionSettings,
    getPersistenceSnapshot,
    subscribe
  };
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
    renderCount: 6,
    scheduledRenderCount: 4,
    immediateRenderCount: 2,
    liveFrameMessageCount: 8,
    stageViewTransformMessageCount: 3,
    stageDisplayTransformMessageCount: 2,
    duplicateTransformSkipCount: 1,
    coalescedLiveFrameCount: 2,
    lastRafDeltaMs: 16,
    rafDeltaSampleCount: 3,
    lastRenderDurationMs: 4,
    renderDurationSampleCount: 6,
    lastLiveRenderInputEvaluationDurationMs: null,
    liveRenderInputEvaluationDurationSampleCount: 0,
    evaluationCacheHitCount: 0,
    evaluationCacheMissCount: 0,
    evaluationCacheInvalidationCount: 0,
    lastRuntimeCoreEvaluationDurationMs: null,
    runtimeCoreEvaluationDurationSampleCount: 0,
    lastRuntimeCoreInputValidationDurationMs: null,
    runtimeCoreInputValidationDurationSampleCount: 0,
    lastRuntimeCoreStateCompatibilityDurationMs: null,
    runtimeCoreStateCompatibilityDurationSampleCount: 0,
    lastRuntimeCoreDynamicsEvaluationDurationMs: null,
    runtimeCoreDynamicsEvaluationDurationSampleCount: 0,
    lastRuntimeCoreSnapshotCreationDurationMs: null,
    runtimeCoreSnapshotCreationDurationSampleCount: 0,
    lastRuntimeCoreParameterResolutionDurationMs: null,
    runtimeCoreParameterResolutionDurationSampleCount: 0,
    lastRuntimeCoreKeyformSamplingDurationMs: null,
    runtimeCoreKeyformSamplingDurationSampleCount: 0,
    lastRuntimeCoreKeyformApplicationDurationMs: null,
    runtimeCoreKeyformApplicationDurationSampleCount: 0,
    lastRuntimeCoreDeformerHierarchyEvaluationDurationMs: null,
    runtimeCoreDeformerHierarchyEvaluationDurationSampleCount: 0,
    lastRuntimeCoreWarpDeformerVertexTransformDurationMs: null,
    runtimeCoreWarpDeformerVertexTransformDurationSampleCount: 0,
    lastRuntimeCoreRotationDeformerVertexTransformDurationMs: null,
    runtimeCoreRotationDeformerVertexTransformDurationSampleCount: 0,
    lastRuntimeCoreDrawableSnapshotCreationDurationMs: null,
    runtimeCoreDrawableSnapshotCreationDurationSampleCount: 0,
    lastRuntimeCoreVisibilityDrawOrderEvaluationDurationMs: null,
    runtimeCoreVisibilityDrawOrderEvaluationDurationSampleCount: 0,
    lastRuntimeCoreMaskEvaluationDurationMs: null,
    runtimeCoreMaskEvaluationDurationSampleCount: 0,
    lastRuntimeCoreSnapshotValidationDurationMs: null,
    runtimeCoreSnapshotValidationDurationSampleCount: 0,
    lastPoseEvaluationDurationMs: null,
    poseEvaluationDurationSampleCount: 0,
    lastSnapshotToRenderDrawableDurationMs: null,
    snapshotToRenderDrawableDurationSampleCount: 0,
    lastRenderInputSceneBuildDurationMs: null,
    renderInputSceneBuildDurationSampleCount: 0,
    lastRenderInputScaffoldBuildDurationMs: null,
    renderInputScaffoldBuildDurationSampleCount: 0,
    lastRenderInputClippingBuildDurationMs: null,
    renderInputClippingBuildDurationSampleCount: 0,
    lastScheduledFrameDurationMs: null,
    scheduledFrameDurationSampleCount: 0,
    canvasWidth: 1280,
    canvasHeight: 720,
    devicePixelRatio: 1
  };
}

const defaultControlBounds: RuntimePlayerWindowBounds = {
  x: 40,
  y: 50,
  width: 1040,
  height: 760
};

const defaultStageBounds: RuntimePlayerWindowBounds = {
  x: 1200,
  y: 80,
  width: 720,
  height: 900
};
