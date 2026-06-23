import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  RuntimePlayerStageViewTransform,
  RuntimePlayerWindowBounds
} from "../../preload/runtime-player-bridge-contract";
import { RuntimePlayerWindowStateController } from "./window-state-controller";
import {
  createEmptyRuntimePlayerWindowStateDocument,
  type RuntimePlayerWindowStateDocument
} from "./window-state-document";
import { runtimePlayerDefaultStageMotionSettings } from "./window-state-stage-motion-settings";
import type {
  RuntimePlayerWindowStateStore,
  RuntimePlayerWindowStateStoreSnapshot
} from "./window-state-store";

describe("RuntimePlayerWindowStateController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses repeated updates into one debounced save with the latest state", async () => {
    vi.useFakeTimers();
    const { controller, saveDocument } = createController({
      debounceMs: 100,
      nowIso: createSequentialNowIso([
        "2026-06-23T00:00:01.000Z",
        "2026-06-23T00:00:02.000Z",
        "2026-06-23T00:00:03.000Z"
      ])
    });
    const latestTransform = createTransform({
      zoomScale: 1.5,
      pan: { x: -40, y: 72 }
    });

    controller.updateWindowBounds("control", {
      x: 10.2,
      y: 20.6,
      width: 1040.4,
      height: 760.7
    });
    controller.updateWindowBounds("stage", {
      x: 1200,
      y: 80,
      width: 720,
      height: 900
    });
    controller.updateStageViewTransform(latestTransform);

    await vi.advanceTimersByTimeAsync(99);
    expect(saveDocument).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);

    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(saveDocument.mock.calls[0]?.[0]).toMatchObject({
      updatedAtIso: "2026-06-23T00:00:03.000Z",
      windows: {
        control: {
          bounds: {
            x: 10,
            y: 21,
            width: 1040,
            height: 761
          }
        },
        stage: {
          bounds: {
            x: 1200,
            y: 80,
            width: 720,
            height: 900
          }
        }
      },
      stageView: {
        transform: latestTransform
      },
      stageEnvironment: {
        alwaysOnTop: false
      }
    });
    expect(controller.getPersistenceSnapshot()).toMatchObject({
      status: "saved",
      warningMessages: []
    });
  });

  it("flush cancels a pending debounce and writes the latest state immediately", async () => {
    vi.useFakeTimers();
    const { controller, saveDocument } = createController({
      debounceMs: 500,
      nowIso: createSequentialNowIso([
        "2026-06-23T00:01:01.000Z",
        "2026-06-23T00:01:02.000Z"
      ])
    });
    const latestBounds: RuntimePlayerWindowBounds = {
      x: 60,
      y: 70,
      width: 1080,
      height: 780
    };
    const latestTransform = createTransform({
      zoomScale: 2,
      pan: { x: 12, y: -18 }
    });

    controller.updateWindowBounds("control", latestBounds);
    controller.updateStageViewTransform(latestTransform);

    await controller.flush();

    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(saveDocument.mock.calls[0]?.[0]).toMatchObject({
      updatedAtIso: "2026-06-23T00:01:02.000Z",
      windows: {
        control: {
          bounds: latestBounds
        }
      },
      stageView: {
        transform: latestTransform
      }
    });

    await vi.advanceTimersByTimeAsync(500);
    expect(saveDocument).toHaveBeenCalledTimes(1);
  });

  it("reports save failures through persistence snapshot warnings and listeners", async () => {
    vi.useFakeTimers();
    const saveDocument = vi.fn(async () => {
      throw new Error("disk full");
    });
    const { controller } = createController({
      debounceMs: 50,
      saveDocument
    });
    const observedStatuses: string[] = [];
    const observedWarnings: (readonly string[])[] = [];

    controller.subscribe(() => {
      const snapshot = controller.getPersistenceSnapshot();
      observedStatuses.push(snapshot.status);
      observedWarnings.push(snapshot.warningMessages);
    });

    controller.updateWindowBounds("stage", {
      x: 1,
      y: 2,
      width: 300,
      height: 400
    });

    await vi.advanceTimersByTimeAsync(50);

    expect(saveDocument).toHaveBeenCalledTimes(1);
    expect(controller.getPersistenceSnapshot()).toMatchObject({
      status: "save-failed",
      statusLabel: "Save failed",
      warningMessages: [
        "Window state file could not be saved: disk full"
      ]
    });
    expect(observedStatuses).toContain("saving");
    expect(observedStatuses.at(-1)).toBe("save-failed");
    expect(observedWarnings.at(-1)?.[0]).toContain("disk full");
  });

  it("updates Stage always-on-top as persisted window environment state", async () => {
    vi.useFakeTimers();
    const { controller, saveDocument } = createController({
      debounceMs: 25,
      nowIso: createSequentialNowIso([
        "2026-06-23T00:02:01.000Z"
      ])
    });

    expect(controller.getStageAlwaysOnTop()).toBe(false);
    expect(controller.updateStageAlwaysOnTop(true)).toBe(true);
    expect(controller.getStageAlwaysOnTop()).toBe(true);

    await vi.advanceTimersByTimeAsync(25);

    expect(saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAtIso: "2026-06-23T00:02:01.000Z",
        stageEnvironment: {
          alwaysOnTop: true
        }
      })
    );
  });

  it("updates Stage Motion settings as persisted window state only", async () => {
    vi.useFakeTimers();
    const { controller, saveDocument } = createController({
      debounceMs: 25,
      nowIso: createSequentialNowIso([
        "2026-06-23T00:03:01.000Z"
      ])
    });

    expect(controller.getStageMotionSettings()).toEqual(
      runtimePlayerDefaultStageMotionSettings
    );

    const settings = controller.updateStageMotionSettings({
      enabled: true,
      horizontal: {
        strengthPx: 96
      },
      scale: {
        invert: true
      }
    });

    expect(settings).toEqual({
      ...runtimePlayerDefaultStageMotionSettings,
      enabled: true,
      horizontal: {
        ...runtimePlayerDefaultStageMotionSettings.horizontal,
        strengthPx: 96
      },
      scale: {
        ...runtimePlayerDefaultStageMotionSettings.scale,
        invert: true
      }
    });

    await vi.advanceTimersByTimeAsync(25);

    expect(saveDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedAtIso: "2026-06-23T00:03:01.000Z",
        stageMotion: {
          settings
        }
      })
    );
    expect(saveDocument.mock.calls[0]?.[0]).not.toHaveProperty(
      "stageMotion.liveOffset"
    );
  });
});

function createController(options: {
  readonly debounceMs?: number;
  readonly initialDocument?: RuntimePlayerWindowStateDocument;
  readonly nowIso?: () => string;
  readonly saveDocument?: ReturnType<typeof vi.fn>;
} = {}): {
  readonly controller: RuntimePlayerWindowStateController;
  readonly saveDocument: ReturnType<typeof vi.fn>;
} {
  const initialDocument =
    options.initialDocument ??
    createEmptyRuntimePlayerWindowStateDocument(
      "2026-06-23T00:00:00.000Z"
    );
  const snapshot: RuntimePlayerWindowStateStoreSnapshot = {
    document: initialDocument,
    state: "loaded",
    warningMessages: []
  };
  const saveDocument =
    options.saveDocument ??
    vi.fn(async (document: RuntimePlayerWindowStateDocument) => ({
      document,
      state: "loaded" as const,
      warningMessages: []
    }));
  const store = {
    saveDocument
  } as unknown as RuntimePlayerWindowStateStore;

  const controllerOptions = {
    store,
    snapshot,
    ...(options.debounceMs !== undefined
      ? { debounceMs: options.debounceMs }
      : {}),
    ...(options.nowIso !== undefined ? { nowIso: options.nowIso } : {})
  };

  return {
    controller: new RuntimePlayerWindowStateController(controllerOptions),
    saveDocument
  };
}

function createSequentialNowIso(values: readonly string[]): () => string {
  let index = 0;

  return () => {
    const value = values[Math.min(index, values.length - 1)] ??
      "2026-06-23T00:00:00.000Z";
    index += 1;
    return value;
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
