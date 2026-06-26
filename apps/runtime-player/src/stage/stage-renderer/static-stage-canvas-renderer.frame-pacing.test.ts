import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rendererMocks = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  createWebGl2RendererFromCanvas: vi.fn(),
  createRenderScene: vi.fn((scene: unknown) => scene),
  createEvaluatedRuntimeExportStageRenderInput: vi.fn()
}));

vi.mock("@private-2d-rigging-lab/render-webgl2", () => ({
  createWebGl2RendererFromCanvas:
    rendererMocks.createWebGl2RendererFromCanvas
}));

vi.mock("@private-2d-rigging-lab/render-core", () => ({
  createRenderScene: rendererMocks.createRenderScene
}));

vi.mock("./evaluated-runtime-export-stage-scene", () => ({
  createEvaluatedRuntimeExportStageRenderInput:
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput
}));

vi.mock("./stage-live-parameter-frame-match", () => ({
  canApplyLiveParameterFrame: () => true
}));

import type { RuntimePlayerLiveParameterFrame } from "../../preload/live-parameter-bridge-contract";
import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createStaticStageCanvasRenderer
} from "./static-stage-canvas-renderer";

describe("StaticStageCanvasRenderer frame pacing", () => {
  beforeEach(() => {
    rendererMocks.render.mockReset();
    rendererMocks.dispose.mockReset();
    rendererMocks.createWebGl2RendererFromCanvas.mockReset();
    rendererMocks.createWebGl2RendererFromCanvas.mockReturnValue({
      render: rendererMocks.render,
      dispose: rendererMocks.dispose
    });
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput.mockReset();
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput.mockImplementation(
      (_payload: RuntimeExportLoadedPayload, liveInput?: { frameIndex?: number }) =>
        createRenderInput(liveInput?.frameIndex ?? 0)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("coalesces multiple live frames before RAF into one render", () => {
    const windowStub = installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    rendererMocks.render.mockClear();

    renderer.setLiveParameterFrame(createLiveParameterFrame(1));
    renderer.setLiveParameterFrame(createLiveParameterFrame(2));

    expect(rendererMocks.render).not.toHaveBeenCalled();
    expect(windowStub.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(renderer.getRenderMetricsSnapshot().coalescedLiveFrameCount).toBe(1);

    windowStub.runAnimationFrame(1, 100);

    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
    expect(readLatestSceneFrameIndex()).toBe(2);
    expect(renderer.getRenderMetricsSnapshot()).toMatchObject({
      scheduledRenderCount: 1,
      immediateRenderCount: 2
    });
  });

  it("renders one final frame for a live frame plus view transform before RAF", () => {
    const windowStub = installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    rendererMocks.render.mockClear();

    renderer.setLiveParameterFrame(createLiveParameterFrame(3));
    renderer.setViewTransform({
      zoomScale: 2,
      pan: { x: 50, y: 0 }
    }, {
      notify: false
    });

    expect(rendererMocks.render).not.toHaveBeenCalled();
    expect(windowStub.requestAnimationFrame).toHaveBeenCalledTimes(1);

    windowStub.runAnimationFrame(1, 100);

    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
    expect(readLatestSceneFrameIndex()).toBe(3);
    expect(readLatestViewportScale()).toBeCloseTo(1.68, 2);
  });

  it("skips duplicate base and display transform updates without rendering", () => {
    const windowStub = installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    rendererMocks.render.mockClear();

    renderer.setViewTransform({
      zoomScale: 1,
      pan: { x: 0, y: 0 }
    });
    renderer.setDisplayViewTransform(null);

    expect(rendererMocks.render).not.toHaveBeenCalled();
    expect(windowStub.requestAnimationFrame).not.toHaveBeenCalled();
    expect(renderer.getRenderMetricsSnapshot()).toMatchObject({
      duplicateTransformSkipCount: 2,
      scheduledRenderCount: 0
    });
  });

  it("represents a display transform update in the next scheduled render", () => {
    const windowStub = installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    rendererMocks.render.mockClear();

    renderer.setDisplayViewTransform({
      zoomScale: 1,
      pan: { x: 40, y: 0 }
    });

    expect(rendererMocks.render).not.toHaveBeenCalled();

    windowStub.runAnimationFrame(1, 100);

    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
    expect(readLatestViewportTranslateX()).toBeCloseTo(91.2, 1);
  });

  it("reports manual wheel view changes synchronously and renders on RAF", () => {
    const windowStub = installStageGlobals();
    const onViewTransformChanged = vi.fn();
    const canvas = createCanvasStub();
    const renderer = createStaticStageCanvasRenderer(
      canvas as unknown as HTMLCanvasElement,
      { onViewTransformChanged }
    );
    renderer.setPayload(createPayload());
    rendererMocks.render.mockClear();
    const preventDefault = vi.fn();

    canvas.dispatch("wheel", {
      deltaMode: 0,
      deltaY: -120,
      clientX: 320,
      clientY: 180,
      preventDefault
    });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onViewTransformChanged).toHaveBeenCalledOnce();
    expect(rendererMocks.render).not.toHaveBeenCalled();

    windowStub.runAnimationFrame(1, 100);

    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
    expect(readLatestViewportScale()).toBeGreaterThan(0.84);
  });

  it("reports manual pointer pan changes synchronously and renders on RAF", () => {
    const windowStub = installStageGlobals();
    const onViewTransformChanged = vi.fn();
    const canvas = createCanvasStub();
    const renderer = createStaticStageCanvasRenderer(
      canvas as unknown as HTMLCanvasElement,
      { onViewTransformChanged }
    );
    renderer.setPayload(createPayload());
    rendererMocks.render.mockClear();

    canvas.dispatch("pointerdown", {
      button: 0,
      pointerId: 7,
      clientX: 320,
      clientY: 180,
      preventDefault: vi.fn()
    });
    canvas.dispatch("pointermove", {
      buttons: 1,
      pointerId: 7,
      clientX: 350,
      clientY: 170,
      preventDefault: vi.fn()
    });

    expect(canvas.setPointerCapture).toHaveBeenCalledWith(7);
    expect(onViewTransformChanged).toHaveBeenCalledWith({
      zoomScale: 1,
      pan: { x: 30, y: -10 }
    });
    expect(renderer.getViewTransform()).toEqual({
      zoomScale: 1,
      pan: { x: 30, y: -10 }
    });
    expect(rendererMocks.render).not.toHaveBeenCalled();
    expect(windowStub.requestAnimationFrame).toHaveBeenCalledTimes(1);

    canvas.dispatch("pointermove", {
      buttons: 1,
      pointerId: 7,
      clientX: 370,
      clientY: 165,
      preventDefault: vi.fn()
    });

    expect(onViewTransformChanged).toHaveBeenLastCalledWith({
      zoomScale: 1,
      pan: { x: 50, y: -15 }
    });
    expect(rendererMocks.render).not.toHaveBeenCalled();
    expect(windowStub.requestAnimationFrame).toHaveBeenCalledTimes(1);

    windowStub.runAnimationFrame(1, 100);

    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
    expect(readLatestViewportTranslate()).toMatchObject({
      x: expect.closeTo(101.2, 1),
      y: expect.closeTo(28.8 - 15, 1)
    });
  });

  it("reports render metrics callbacks with deterministic render durations", () => {
    const windowStub = installStageGlobals();
    installPerformanceNowSequence([0, 4, 10, 17, 30, 42, 54]);
    const metricSnapshots: Array<{
      readonly renderCount: number;
      readonly scheduledRenderCount: number;
      readonly immediateRenderCount: number;
      readonly lastRenderDurationMs: number | null;
      readonly renderDurationSampleCount: number;
      readonly lastLiveRenderInputEvaluationDurationMs?: number | null;
      readonly liveRenderInputEvaluationDurationSampleCount?: number;
      readonly lastScheduledFrameDurationMs?: number | null;
      readonly scheduledFrameDurationSampleCount?: number;
    }> = [];
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement,
      {
        onRenderMetricsChanged: (snapshot) => {
          metricSnapshots.push(snapshot);
        }
      }
    );

    expect(metricSnapshots).toHaveLength(1);
    expect(metricSnapshots.at(-1)).toMatchObject({
      renderCount: 1,
      immediateRenderCount: 1,
      scheduledRenderCount: 0,
      lastRenderDurationMs: 4,
      renderDurationSampleCount: 1,
      lastLiveRenderInputEvaluationDurationMs: null,
      liveRenderInputEvaluationDurationSampleCount: 0,
      lastScheduledFrameDurationMs: null,
      scheduledFrameDurationSampleCount: 0
    });

    renderer.setPayload(createPayload());

    expect(metricSnapshots).toHaveLength(2);
    expect(metricSnapshots.at(-1)).toMatchObject({
      renderCount: 2,
      immediateRenderCount: 2,
      scheduledRenderCount: 0,
      lastRenderDurationMs: 7,
      renderDurationSampleCount: 2,
      lastLiveRenderInputEvaluationDurationMs: null,
      liveRenderInputEvaluationDurationSampleCount: 0,
      lastScheduledFrameDurationMs: null,
      scheduledFrameDurationSampleCount: 0
    });

    renderer.setViewTransform({
      zoomScale: 1,
      pan: { x: 20, y: 0 }
    }, {
      notify: false
    });

    expect(metricSnapshots).toHaveLength(2);

    windowStub.runAnimationFrame(1, 100);

    expect(metricSnapshots).toHaveLength(3);
    expect(metricSnapshots.at(-1)).toMatchObject({
      renderCount: 3,
      immediateRenderCount: 2,
      scheduledRenderCount: 1,
      lastRenderDurationMs: 12,
      renderDurationSampleCount: 3,
      lastLiveRenderInputEvaluationDurationMs: null,
      liveRenderInputEvaluationDurationSampleCount: 0,
      lastScheduledFrameDurationMs: 24,
      scheduledFrameDurationSampleCount: 1
    });
    expect(renderer.getRenderMetricsSnapshot()).toMatchObject(
      metricSnapshots.at(-1) ?? {}
    );
  });

  it("reports live render-input evaluation and scheduled frame durations separately", () => {
    const windowStub = installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());

    installPerformanceNowSequence([100, 105, 108, 120, 132]);
    renderer.setLiveParameterFrame(createLiveParameterFrame(1));

    windowStub.runAnimationFrame(1, 100);

    const snapshot = renderer.getRenderMetricsSnapshot();

    expect(snapshot).toMatchObject({
      lastLiveRenderInputEvaluationDurationMs: 3,
      liveRenderInputEvaluationDurationSampleCount: 1,
      compiledRenderFrameCount: 1,
      publicSnapshotMaterializationCount: 0,
      lastPoseEvaluationDurationMs: 3,
      poseEvaluationDurationSampleCount: 1,
      lastSnapshotToRenderDrawableDurationMs: 4,
      snapshotToRenderDrawableDurationSampleCount: 1,
      lastRenderInputSceneBuildDurationMs: 5,
      renderInputSceneBuildDurationSampleCount: 1,
      lastRenderInputScaffoldBuildDurationMs: 0,
      renderInputScaffoldBuildDurationSampleCount: 1,
      lastRenderInputClippingBuildDurationMs: 0,
      renderInputClippingBuildDurationSampleCount: 1,
      lastRenderDurationMs: 12,
      renderDurationSampleCount: 3,
      lastScheduledFrameDurationMs: 32,
      scheduledFrameDurationSampleCount: 1
    });
    expect(snapshot).not.toHaveProperty(
      "lastRuntimeCoreParameterResolutionDurationMs"
    );
    expect(readLatestRuntimeCoreProfiling()).toBeUndefined();
  });

  it("counts public snapshot materialization from the cheap render-input profile", () => {
    const windowStub = installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput
      .mockImplementationOnce(
        (_payload: RuntimeExportLoadedPayload, liveInput?: { frameIndex?: number }) =>
          createRenderInput(liveInput?.frameIndex ?? 0, {
            compiledRenderFrameCount: 0,
            publicSnapshotMaterializationCount: 1,
            runtimeCoreProfile: undefined
          })
      );

    renderer.setLiveParameterFrame(createLiveParameterFrame(1));
    windowStub.runAnimationFrame(1, 100);

    expect(renderer.getRenderMetricsSnapshot()).toMatchObject({
      compiledRenderFrameCount: 0,
      publicSnapshotMaterializationCount: 1,
      transientCompileCount: 0,
      transientInstanceCount: 0
    });
    expect(renderer.getRenderMetricsSnapshot()).not.toHaveProperty(
      "lastRuntimeCoreParameterResolutionDurationMs"
    );
    expect(renderer.getRenderMetricsSnapshot()).not.toHaveProperty(
      "lastRuntimeCoreRenderFrameOutputDurationMs"
    );
  });

  it("schedules renders for center and reset operations", () => {
    const windowStub = installStageGlobals();
    const onViewTransformChanged = vi.fn();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement,
      { onViewTransformChanged }
    );
    renderer.setPayload(createPayload());
    renderer.setViewTransform({
      zoomScale: 2,
      pan: { x: 50, y: -20 }
    }, {
      notify: false
    });
    windowStub.runAnimationFrame(1, 100);
    rendererMocks.render.mockClear();
    onViewTransformChanged.mockClear();

    renderer.centerModel();

    expect(onViewTransformChanged).toHaveBeenCalledWith({
      zoomScale: 2,
      pan: { x: 0, y: 0 }
    });
    expect(rendererMocks.render).not.toHaveBeenCalled();

    windowStub.runAnimationFrame(2, 116);

    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
    expect(readLatestViewportScale()).toBeCloseTo(1.68, 2);

    renderer.setViewTransform({
      zoomScale: 2,
      pan: { x: 50, y: -20 }
    }, {
      notify: false
    });
    windowStub.runAnimationFrame(3, 132);
    rendererMocks.render.mockClear();

    renderer.resetView();

    expect(rendererMocks.render).not.toHaveBeenCalled();

    windowStub.runAnimationFrame(4, 148);

    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
    expect(readLatestViewportScale()).toBeCloseTo(0.84, 2);
    expect(renderer.getRenderMetricsSnapshot()).toMatchObject({
      scheduledRenderCount: 4,
      rafDeltaSampleCount: 3,
      lastRafDeltaMs: 16
    });
  });

  it("does not rebuild evaluated runtime input for view transform changes", () => {
    const windowStub = installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput.mockClear();
    rendererMocks.render.mockClear();

    renderer.setViewTransform({
      zoomScale: 1,
      pan: { x: 20, y: 0 }
    }, {
      notify: false
    });
    renderer.setDisplayViewTransform({
      zoomScale: 1,
      pan: { x: 60, y: 0 }
    });

    expect(rendererMocks.createEvaluatedRuntimeExportStageRenderInput)
      .not.toHaveBeenCalled();

    windowStub.runAnimationFrame(1, 100);

    expect(rendererMocks.createEvaluatedRuntimeExportStageRenderInput)
      .not.toHaveBeenCalled();
    expect(rendererMocks.render).toHaveBeenCalledTimes(1);
  });

  it("clears renderer-owned evaluation cache on clear, reload, and dispose", () => {
    installStageGlobals();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    const cache = readLatestEvaluationCache();
    const clearSpy = vi.spyOn(cache, "clear");

    renderer.clear();
    renderer.setPayload(createPayload());
    renderer.dispose();

    expect(clearSpy).toHaveBeenCalledTimes(3);
  });
});

function installStageGlobals(): ReturnType<typeof createWindowStub> {
  const windowStub = createWindowStub();
  vi.stubGlobal("window", windowStub);
  vi.stubGlobal("ResizeObserver", undefined);
  vi.stubGlobal("WheelEvent", {
    DOM_DELTA_LINE: 1,
    DOM_DELTA_PAGE: 2
  });

  return windowStub;
}

function installPerformanceNowSequence(values: readonly number[]): void {
  let index = 0;
  const now = vi.fn(() => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  });

  vi.stubGlobal("performance", { now });
}

function createWindowStub(): {
  readonly devicePixelRatio: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly addEventListener: ReturnType<typeof vi.fn>;
  readonly removeEventListener: ReturnType<typeof vi.fn>;
  readonly requestAnimationFrame: ReturnType<typeof vi.fn>;
  readonly cancelAnimationFrame: ReturnType<typeof vi.fn>;
  readonly runAnimationFrame: (handle: number, timestampMs?: number) => void;
} {
  const callbacks = new Map<number, (timestampMs: number) => void>();
  let nextHandle = 1;

  return {
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestAnimationFrame: vi.fn((callback: (timestampMs: number) => void) => {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    }),
    cancelAnimationFrame: vi.fn((handle: number) => {
      callbacks.delete(handle);
    }),
    runAnimationFrame: (handle: number, timestampMs = handle * 16) => {
      const callback = callbacks.get(handle);
      callbacks.delete(handle);
      callback?.(timestampMs);
    }
  };
}

function createCanvasStub(): {
  width: number;
  height: number;
  readonly clientWidth: number;
  readonly clientHeight: number;
  readonly getBoundingClientRect: () => {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  };
  readonly addEventListener: ReturnType<typeof vi.fn>;
  readonly removeEventListener: ReturnType<typeof vi.fn>;
  readonly dispatch: (type: string, event: Record<string, unknown>) => void;
  readonly setPointerCapture: ReturnType<typeof vi.fn>;
  readonly releasePointerCapture: ReturnType<typeof vi.fn>;
  readonly hasPointerCapture: ReturnType<typeof vi.fn>;
} {
  const listeners = new Map<string, Set<(event: Record<string, unknown>) => void>>();

  return {
    width: 0,
    height: 0,
    clientWidth: 640,
    clientHeight: 360,
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 640,
      height: 360
    }),
    addEventListener: vi.fn((
      type: string,
      listener: (event: Record<string, unknown>) => void
    ) => {
      const listenersForType = listeners.get(type) ?? new Set();
      listenersForType.add(listener);
      listeners.set(type, listenersForType);
    }),
    removeEventListener: vi.fn((
      type: string,
      listener: (event: Record<string, unknown>) => void
    ) => {
      listeners.get(type)?.delete(listener);
    }),
    dispatch: (type, event) => {
      for (const listener of listeners.get(type) ?? []) {
        listener(event);
      }
    },
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false)
  };
}

function createRenderInput(
  frameIndex: number,
  profilePatch: {
    readonly compiledRenderFrameCount?: number;
    readonly publicSnapshotMaterializationCount?: number;
    readonly runtimeCoreProfile?: ReturnType<typeof createRuntimeCoreProfile> | undefined;
  } = {}
) {
  const compiledRenderFrameCount = profilePatch.compiledRenderFrameCount ?? 1;
  const publicSnapshotMaterializationCount =
    profilePatch.publicSnapshotMaterializationCount ?? 0;
  const runtimeCoreProfile = "runtimeCoreProfile" in profilePatch
    ? profilePatch.runtimeCoreProfile
    : createRuntimeCoreProfile();

  return {
    scene: {
      frameIndex,
      textureSources: [],
      drawables: []
    },
    modelBounds: {
      x: 0,
      y: 0,
      width: 640,
      height: 360
    },
    poseEvaluation: {
      nextState: {
        frameIndex
      },
      snapshot: {
        diagnostics: []
      },
      evaluationProfile: {
        runtimeCoreEvaluationDurationMs: 2,
        compiledEvaluatorFrameCount: 1,
        compiledRenderFrameCount,
        publicSnapshotMaterializationCount,
        transientCompileCount: 0,
        transientInstanceCount: 0,
        ...(runtimeCoreProfile === undefined ? {} : { runtimeCoreProfile })
      }
    },
    evaluationProfile: {
      evaluationCacheStatus: frameIndex === 0 ? "miss" : "hit",
      runtimeCoreEvaluationDurationMs: 2,
      ...(runtimeCoreProfile === undefined ? {} : { runtimeCoreProfile }),
      compiledEvaluatorFrameCount: 1,
      compiledRenderFrameCount,
      publicSnapshotMaterializationCount,
      transientCompileCount: 0,
      transientInstanceCount: 0,
      poseEvaluationDurationMs: 3,
      snapshotToRenderDrawableDurationMs: 4,
      renderInputSceneBuildDurationMs: 5,
      renderInputScaffoldBuildDurationMs: 0,
      runtimeModelCompileDurationMs: 0,
      renderInputClippingBuildDurationMs: 0
    }
  };
}

function createRuntimeCoreProfile() {
  return {
    runtimeCoreEvaluationDurationMs: 2,
    inputValidationDurationMs: 0.1,
    stateCompatibilityDurationMs: 0.1,
    dynamicsEvaluationDurationMs: 0.1,
    runtimeSnapshotCreationDurationMs: 1.5,
    runtimeCoreRenderFrameOutputDurationMs: 0.6,
    parameterResolutionDurationMs: 0.2,
    keyformSamplingDurationMs: 0.3,
    keyformApplicationDurationMs: 0.4,
    deformerHierarchyEvaluationDurationMs: 0.7,
    warpDeformerVertexTransformDurationMs: 0.8,
    rotationDeformerVertexTransformDurationMs: 0.9,
    drawableSnapshotCreationDurationMs: 0.5,
    visibilityDrawOrderEvaluationDurationMs: 0.1,
    maskEvaluationDurationMs: 0.1,
    snapshotValidationDurationMs: 0.6,
    publicSnapshotMaterializationCount: 0
  };
}

function createPayload(): RuntimeExportLoadedPayload {
  return {
    summary: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      loadedAtIso: "2026-06-23T01:00:00.000Z"
    }
  } as unknown as RuntimeExportLoadedPayload;
}

function createLiveParameterFrame(sequence: number): RuntimePlayerLiveParameterFrame {
  return {
    schemaVersion: "runtime-player-live-parameter-frame-v1",
    runtimeExport: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      loadedAtIso: "2026-06-23T01:00:00.000Z"
    },
    sequence,
    producedAtIso: `2026-06-23T01:00:0${sequence}.000Z`,
    sourceFrameTimestampMs: 1000 + sequence * 16,
    parameterValues: {
      ParamAngleX: sequence
    }
  };
}

function readLatestSceneFrameIndex(): number {
  const scene = rendererMocks.render.mock.calls.at(-1)?.[0] as
    | { frameIndex?: number }
    | undefined;

  return scene?.frameIndex ?? Number.NaN;
}

function readLatestViewportScale(): number {
  const viewport = rendererMocks.render.mock.calls.at(-1)?.[1] as
    | { stageToViewport?: { scale?: number } }
    | undefined;

  return viewport?.stageToViewport?.scale ?? Number.NaN;
}

function readLatestViewportTranslateX(): number {
  const viewport = rendererMocks.render.mock.calls.at(-1)?.[1] as
    | { stageToViewport?: { translate?: { x?: number } } }
    | undefined;

  return viewport?.stageToViewport?.translate?.x ?? Number.NaN;
}

function readLatestViewportTranslate(): { readonly x: number; readonly y: number } {
  const viewport = rendererMocks.render.mock.calls.at(-1)?.[1] as
    | { stageToViewport?: { translate?: { x?: number; y?: number } } }
    | undefined;

  return {
    x: viewport?.stageToViewport?.translate?.x ?? Number.NaN,
    y: viewport?.stageToViewport?.translate?.y ?? Number.NaN
  };
}

function readLatestEvaluationCache(): { readonly clear: () => void } {
  const options = rendererMocks.createEvaluatedRuntimeExportStageRenderInput
    .mock.calls.at(-1)?.[1] as
      | { readonly evaluationCache?: { readonly clear: () => void } }
      | undefined;
  const cache = options?.evaluationCache;
  if (cache === undefined) {
    throw new Error("Expected renderer evaluation cache option.");
  }

  return cache;
}

function readLatestRuntimeCoreProfiling(): string | undefined {
  const options = rendererMocks.createEvaluatedRuntimeExportStageRenderInput
    .mock.calls.at(-1)?.[1] as
      | { readonly runtimeCoreProfiling?: string }
      | undefined;

  return options?.runtimeCoreProfiling;
}
