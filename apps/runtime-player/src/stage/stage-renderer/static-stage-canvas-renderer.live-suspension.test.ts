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

describe("StaticStageCanvasRenderer live suspension behavior", () => {
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

  it("cancels pending live-frame RAF on clear and still renders payload/view updates", () => {
    const windowStub = createWindowStub();
    vi.stubGlobal("window", windowStub);
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("WheelEvent", {
      DOM_DELTA_LINE: 1,
      DOM_DELTA_PAGE: 2
    });

    const canvas = createCanvasStub();
    const renderer = createStaticStageCanvasRenderer(
      canvas as unknown as HTMLCanvasElement
    );

    renderer.setPayload(createPayload());
    const renderCountAfterPayload = rendererMocks.render.mock.calls.length;

    renderer.setLiveParameterFrame(createLiveParameterFrame(1));
    expect(windowStub.requestAnimationFrame).toHaveBeenCalledOnce();

    renderer.clearLiveParameterFrame();
    expect(windowStub.cancelAnimationFrame).toHaveBeenCalledWith(1);

    const renderCountAfterClear = rendererMocks.render.mock.calls.length;
    windowStub.runAnimationFrame(1);
    expect(rendererMocks.render).toHaveBeenCalledTimes(renderCountAfterClear);

    renderer.setViewTransform({
      zoomScale: 1.5,
      pan: {
        x: 12,
        y: -8
      }
    }, {
      notify: false
    });
    expect(rendererMocks.render.mock.calls.length)
      .toBe(renderCountAfterClear);
    windowStub.runAnimationFrame(2);
    expect(rendererMocks.render.mock.calls.length)
      .toBe(renderCountAfterClear + 1);

    renderer.setPayload(createPayload());
    expect(rendererMocks.render.mock.calls.length)
      .toBeGreaterThan(renderCountAfterPayload);
  });

  it("uses display view transform without reporting it as saved base view", () => {
    const windowStub = createWindowStub();
    vi.stubGlobal("window", windowStub);
    vi.stubGlobal("ResizeObserver", undefined);
    vi.stubGlobal("WheelEvent", {
      DOM_DELTA_LINE: 1,
      DOM_DELTA_PAGE: 2
    });

    const onViewTransformChanged = vi.fn();
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement,
      { onViewTransformChanged }
    );

    renderer.setPayload(createPayload());
    renderer.setViewTransform({
      zoomScale: 1,
      pan: { x: 5, y: 0 }
    });
    renderer.setDisplayViewTransform({
      zoomScale: 1,
      pan: { x: 40, y: 0 }
    });

    expect(onViewTransformChanged).toHaveBeenCalledTimes(1);
    windowStub.runAnimationFrame(1);
    expect(readLatestViewportTranslateX()).toBeCloseTo(91.2, 1);

    renderer.setDisplayViewTransform(null);
    windowStub.runAnimationFrame(2);

    expect(readLatestViewportTranslateX()).toBeCloseTo(56.2, 1);
  });
});

function createWindowStub(): {
  readonly devicePixelRatio: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly addEventListener: ReturnType<typeof vi.fn>;
  readonly removeEventListener: ReturnType<typeof vi.fn>;
  readonly requestAnimationFrame: ReturnType<typeof vi.fn>;
  readonly cancelAnimationFrame: ReturnType<typeof vi.fn>;
  readonly runAnimationFrame: (handle: number) => void;
} {
  const callbacks = new Map<number, () => void>();
  let nextHandle = 1;

  return {
    devicePixelRatio: 1,
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestAnimationFrame: vi.fn((callback: () => void) => {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    }),
    cancelAnimationFrame: vi.fn((handle: number) => {
      callbacks.delete(handle);
    }),
    runAnimationFrame: (handle: number) => {
      callbacks.get(handle)?.();
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
  readonly setPointerCapture: ReturnType<typeof vi.fn>;
  readonly releasePointerCapture: ReturnType<typeof vi.fn>;
  readonly hasPointerCapture: ReturnType<typeof vi.fn>;
} {
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
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false)
  };
}

function createRenderInput(frameIndex: number) {
  return {
    scene: {
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
      }
    }
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

function readLatestViewportTranslateX(): number {
  const viewport = rendererMocks.render.mock.calls.at(-1)?.[1] as
    | { stageToViewport?: { translate?: { x?: number } } }
    | undefined;

  return viewport?.stageToViewport?.translate?.x ?? Number.NaN;
}
