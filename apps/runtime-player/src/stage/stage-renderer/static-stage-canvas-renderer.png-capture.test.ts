import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rendererMocks = vi.hoisted(() => ({
  calls: [] as string[],
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

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createStaticStageCanvasRenderer,
  decodePngDataUrl
} from "./static-stage-canvas-renderer";

// "\x89PNG\r\n\x1a\n" followed by two payload bytes.
const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAQ==";

describe("StaticStageCanvasRenderer PNG capture", () => {
  beforeEach(() => {
    rendererMocks.calls.length = 0;
    rendererMocks.render.mockReset();
    rendererMocks.render.mockImplementation(() => {
      rendererMocks.calls.push("render");
    });
    rendererMocks.dispose.mockReset();
    rendererMocks.createWebGl2RendererFromCanvas.mockReset();
    rendererMocks.createWebGl2RendererFromCanvas.mockReturnValue({
      render: rendererMocks.render,
      dispose: rendererMocks.dispose
    });
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput.mockReset();
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput.mockImplementation(
      () => createRenderInput()
    );
    vi.stubGlobal("window", createWindowStub());
    vi.stubGlobal("ResizeObserver", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("redraws and reads the canvas back in the same call", () => {
    const canvas = createCanvasStub();
    const renderer = createStaticStageCanvasRenderer(
      canvas as unknown as HTMLCanvasElement
    );
    renderer.setPayload(createPayload());
    rendererMocks.calls.length = 0;
    rendererMocks.createEvaluatedRuntimeExportStageRenderInput.mockClear();

    const bytes = renderer.capturePngImage();

    expect(rendererMocks.calls).toEqual(["render", "toDataURL:image/png"]);
    expect(Array.from(bytes)).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01
    ]);
    // The held pose is redrawn, not re-evaluated.
    expect(
      rendererMocks.createEvaluatedRuntimeExportStageRenderInput
    ).not.toHaveBeenCalled();
    expect(renderer.getRenderMetricsSnapshot()).toMatchObject({
      canvasWidth: 1280,
      canvasHeight: 720,
      devicePixelRatio: 2
    });
  });

  it("refuses before the model has been drawn, without reading the canvas", () => {
    const canvas = createCanvasStub();
    const renderer = createStaticStageCanvasRenderer(
      canvas as unknown as HTMLCanvasElement
    );

    expect(() => renderer.capturePngImage()).toThrow(
      "Stage has not drawn the model yet."
    );
    renderer.setPayload(createPayload());
    renderer.clear();
    expect(() => renderer.capturePngImage()).toThrow(
      "Stage has not drawn the model yet."
    );
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it("refuses after dispose", () => {
    const renderer = createStaticStageCanvasRenderer(
      createCanvasStub() as unknown as HTMLCanvasElement
    );
    renderer.dispose();

    expect(() => renderer.capturePngImage()).toThrow(
      "Stage renderer is disposed."
    );
  });

  it("rejects a data URL that is not a PNG", () => {
    expect(() => decodePngDataUrl("data:,")).toThrow(
      "Stage canvas could not be encoded as PNG."
    );
  });
});

function createPayload(): RuntimeExportLoadedPayload {
  return {
    summary: {
      packageId: "pkg_fixture",
      packageRevision: 7,
      loadedAtIso: "2026-10-28T06:00:00.000Z"
    }
  } as unknown as RuntimeExportLoadedPayload;
}

function createRenderInput() {
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
      nextState: {},
      snapshot: {
        diagnostics: []
      }
    },
    evaluationProfile: {}
  };
}

function createWindowStub() {
  return {
    devicePixelRatio: 2,
    innerWidth: 640,
    innerHeight: 360,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    requestAnimationFrame: vi.fn(() => 1),
    cancelAnimationFrame: vi.fn()
  };
}

function createCanvasStub() {
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
    toDataURL: vi.fn((type: string) => {
      rendererMocks.calls.push(`toDataURL:${type}`);
      return pngDataUrl;
    })
  };
}
