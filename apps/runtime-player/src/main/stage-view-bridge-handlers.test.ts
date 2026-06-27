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
  RuntimePlayerStageViewStatus,
  RuntimePlayerStageViewTransform,
  RuntimePlayerWindowBounds
} from "../preload/runtime-player-bridge-contract";
import { stageViewBridgeChannels } from "../preload/stage-view-bridge-channels";
import { registerStageViewBridgeHandlers } from "./stage-view-bridge-handlers";
import { runtimePlayerDefaultStageMotionSettings } from "./window-state/window-state-stage-motion-settings";
import type {
  RuntimePlayerStageWindowLifecycle,
  RuntimePlayerStageWindowLifecycleChangedEvent,
  RuntimePlayerWindowSet
} from "./window-management/runtime-player-windows";
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
  it("focusStage restores, shows, and focuses the Stage window before returning current state", async () => {
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

    const result = await invokeHandler<Promise<RuntimePlayerStageViewActionResult>>(
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

  it("focusStage reopens a destroyed Stage window before focusing it", async () => {
    const reopenedStageWindow = createFakeWindow({
      bounds: reopenedStageBounds,
      minimized: true
    });
    const { stageLifecycle } = createHarness({
      stageWindow: {
        destroyed: true
      },
      stageLifecycle: {
        reopenedWindow: reopenedStageWindow
      },
      windowState: {
        alwaysOnTop: true
      }
    });

    const result = await invokeHandler<Promise<RuntimePlayerStageViewActionResult>>(
      stageViewBridgeChannels.focusStage
    );

    expect(stageLifecycle?.reopenStageWindow).toHaveBeenCalledTimes(1);
    expect(reopenedStageWindow.restore).toHaveBeenCalledTimes(1);
    expect(reopenedStageWindow.show).toHaveBeenCalledTimes(1);
    expect(reopenedStageWindow.focus).toHaveBeenCalledTimes(1);
    expect(reopenedStageWindow.setIgnoreMouseEvents).toHaveBeenLastCalledWith(
      false
    );
    expect(reopenedStageWindow.setAlwaysOnTop).toHaveBeenLastCalledWith(true);
    expect(result).toMatchObject({
      result: "ok",
      message: "Stage Window focused.",
      status: {
        stageWindow: {
          windowState: "created",
          bounds: reopenedStageBounds
        },
        capture: {
          arrangeModeEnabled: false,
          clickThroughEnabled: false,
          alwaysOnTopEnabled: true
        }
      }
    });
  });

  it("focusStage reports an action error when destroyed Stage reopen fails", async () => {
    createHarness({
      stageWindow: {
        destroyed: true
      },
      stageLifecycle: {
        reopenError: new Error("renderer entry failed")
      }
    });

    const result = await invokeHandler<Promise<RuntimePlayerStageViewActionResult>>(
      stageViewBridgeChannels.focusStage
    );

    expect(result).toMatchObject({
      result: "error",
      message: "Stage Window could not be reopened: renderer entry failed",
      status: {
        stageWindow: {
          windowState: "destroyed",
          bounds: null
        }
      }
    });
  });

  it("Stage window close marks Stage unavailable and clears transient capture flags", () => {
    const { controlWindow, stageLifecycle, registration } = createHarness({
      stageLifecycle: {}
    });

    invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.setArrangeMode,
      true
    );
    invokeHandler<RuntimePlayerStageViewActionResult>(
      stageViewBridgeChannels.setClickThrough,
      true
    );
    invokeHandler<RuntimePlayerStageViewStatus>(
      stageViewBridgeChannels.reportStatus,
      {
        status: "ready",
        statusLabel: "Stage ready",
        message: "Stage is rendering the model.",
        details: []
      }
    );
    controlWindow.webContents.send.mockClear();

    stageLifecycle?.emitClosed();

    expect(registration.getCaptureState()).toMatchObject({
      arrangeModeEnabled: false,
      clickThroughEnabled: false
    });
    expect(
      invokeHandler<RuntimePlayerStageStateSnapshot>(
        stageViewBridgeChannels.getState
      )
    ).toMatchObject({
      stageWindow: {
        windowState: "destroyed",
        bounds: null
      },
      stageView: {
        renderStatus: {
          status: "empty",
          statusLabel: "Stage unavailable",
          message: "Stage Window is closed. Use Focus Stage to reopen it."
        }
      },
      capture: {
        arrangeModeEnabled: false,
        clickThroughEnabled: false,
        stageUi: "hidden"
      }
    });
    expect(
      invokeHandler<RuntimePlayerStageViewStatus>(
        stageViewBridgeChannels.getStatus
      )
    ).toMatchObject({
      status: "empty",
      tone: "neutral",
      statusLabel: "Stage unavailable"
    });
    expect(controlWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.statusChanged,
      expect.objectContaining({
        status: "empty",
        statusLabel: "Stage unavailable"
      })
    );
    expect(controlWindow.webContents.send).toHaveBeenCalledWith(
      stageViewBridgeChannels.stateChanged,
      expect.objectContaining({
        stageWindow: {
          windowState: "destroyed",
          bounds: null
        },
        stageView: expect.objectContaining({
          renderStatus: expect.objectContaining({
            status: "empty",
            statusLabel: "Stage unavailable"
          })
        }),
        capture: expect.objectContaining({
          arrangeModeEnabled: false,
          clickThroughEnabled: false
        })
      })
    );
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
  readonly stageLifecycle?: FakeStageLifecycleOptions;
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
  readonly stageLifecycle?: ReturnType<typeof createFakeStageWindowLifecycle>;
} {
  const controlWindow = createFakeWindow({
    bounds: defaultControlBounds,
    ...options.controlWindow
  });
  const stageWindow = createFakeWindow({
    bounds: defaultStageBounds,
    ...options.stageWindow
  });
  const stageLifecycle = options.stageLifecycle === undefined
    ? undefined
    : createFakeStageWindowLifecycle(stageWindow, options.stageLifecycle);
  const windowState = createFakeWindowState(
    options.windowState?.transform ?? createResetRuntimePlayerStageViewTransform(),
    options.windowState?.alwaysOnTop ?? false
  );
  const onCaptureStateChanged = vi.fn();
  const onStageMotionSettingsChanged = vi.fn();
  const windows = {
    controlWindow:
      controlWindow as unknown as RuntimePlayerWindowSet["controlWindow"],
    get stageWindow() {
      return (
        stageLifecycle?.getStageWindow() ??
        stageWindow
      ) as unknown as RuntimePlayerWindowSet["stageWindow"];
    },
    ...(stageLifecycle === undefined
      ? {}
      : {
          stageWindowLifecycle:
            stageLifecycle.lifecycle as RuntimePlayerStageWindowLifecycle
        })
  } as RuntimePlayerWindowSet;

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
    registration,
    ...(stageLifecycle === undefined ? {} : { stageLifecycle })
  };
}

type FakeWindowOptions = {
  readonly bounds?: RuntimePlayerWindowBounds;
  readonly destroyed?: boolean;
  readonly minimized?: boolean;
  readonly webContentsDestroyed?: boolean;
};

type FakeStageLifecycleOptions = {
  readonly reopenedWindow?: ReturnType<typeof createFakeWindow>;
  readonly reopenError?: Error;
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

function createFakeStageWindowLifecycle(
  initialWindow: ReturnType<typeof createFakeWindow>,
  options: FakeStageLifecycleOptions = {}
) {
  let currentWindow = initialWindow;
  const listeners =
    new Set<(event: RuntimePlayerStageWindowLifecycleChangedEvent) => void>();
  const reopenedWindow = options.reopenedWindow ?? createFakeWindow({
    bounds: reopenedStageBounds
  });

  const emit = (
    event: RuntimePlayerStageWindowLifecycleChangedEvent
  ): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };
  const lifecycle: RuntimePlayerStageWindowLifecycle = {
    getStageWindow: () =>
      currentWindow as unknown as RuntimePlayerWindowSet["stageWindow"],
    reopenStageWindow: vi.fn(async () => {
      if (options.reopenError !== undefined) {
        throw options.reopenError;
      }

      currentWindow = reopenedWindow;
      emit({
        reason: "created",
        window:
          currentWindow as unknown as RuntimePlayerWindowSet["stageWindow"]
      });
      return currentWindow as unknown as RuntimePlayerWindowSet["stageWindow"];
    }),
    closeStageWindow: vi.fn(() => {
      currentWindow.destroy();
      emit({
        reason: "closed",
        window:
          currentWindow as unknown as RuntimePlayerWindowSet["stageWindow"]
      });
    }),
    onStageWindowChanged: vi.fn((listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    })
  };

  return {
    lifecycle,
    getStageWindow: lifecycle.getStageWindow,
    reopenStageWindow: lifecycle.reopenStageWindow,
    closeStageWindow: lifecycle.closeStageWindow,
    onStageWindowChanged: lifecycle.onStageWindowChanged,
    emitClosed: () => {
      currentWindow.destroy();
      emit({
        reason: "closed",
        window:
          currentWindow as unknown as RuntimePlayerWindowSet["stageWindow"]
      });
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
    compiledEvaluatorFrameCount: 0,
    compiledRenderFrameCount: 0,
    transientCompileCount: 0,
    transientInstanceCount: 0,
    publicSnapshotMaterializationCount: 0,
    runtimeModelInstanceCacheHitCount: 0,
    runtimeModelInstanceCacheMissCount: 0,
    runtimeModelInstanceCacheInvalidationCount: 0,
    lastRuntimeModelCompileDurationMs: null,
    runtimeModelCompileDurationSampleCount: 0,
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

const reopenedStageBounds: RuntimePlayerWindowBounds = {
  x: 800,
  y: 60,
  width: 960,
  height: 720
};
