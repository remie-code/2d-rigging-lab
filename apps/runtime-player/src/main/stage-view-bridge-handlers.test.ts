import { beforeEach, describe, expect, it, vi } from "vitest";

const electronMocks = vi.hoisted(() => ({
  ipcMainHandle: vi.fn()
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: electronMocks.ipcMainHandle
  }
}));

import type {
  RuntimePlayerStageStateSnapshot,
  RuntimePlayerStageViewActionResult,
  RuntimePlayerStageViewTransform,
  RuntimePlayerWindowBounds
} from "../preload/runtime-player-bridge-contract";
import { stageViewBridgeChannels } from "../preload/stage-view-bridge-channels";
import { registerStageViewBridgeHandlers } from "./stage-view-bridge-handlers";
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
      }
    });
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
  };
} = {}): {
  readonly controlWindow: ReturnType<typeof createFakeWindow>;
  readonly stageWindow: ReturnType<typeof createFakeWindow>;
  readonly windowState: ReturnType<typeof createFakeWindowState>;
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
    options.windowState?.transform ?? createResetRuntimePlayerStageViewTransform()
  );
  const windows: RuntimePlayerWindowSet = {
    controlWindow:
      controlWindow as unknown as RuntimePlayerWindowSet["controlWindow"],
    stageWindow: stageWindow as unknown as RuntimePlayerWindowSet["stageWindow"]
  };

  registerStageViewBridgeHandlers({
    windows,
    windowState: windowState.controller
  });

  return {
    controlWindow,
    stageWindow,
    windowState
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
    destroy: () => {
      destroyed = true;
    }
  };
}

function createFakeWindowState(
  initialTransform: RuntimePlayerStageViewTransform
) {
  let transform = initialTransform;
  const listeners = new Set<() => void>();
  const getStageViewTransform = vi.fn(() => transform);
  const updateStageViewTransform = vi.fn((value: unknown) => {
    transform = normalizeRuntimePlayerStageViewTransform(value);
    for (const listener of listeners) {
      listener();
    }
    return transform;
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
      updateStageViewTransform,
      getPersistenceSnapshot,
      subscribe
    } as unknown as RuntimePlayerWindowStateController,
    getStageViewTransform,
    updateStageViewTransform,
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
