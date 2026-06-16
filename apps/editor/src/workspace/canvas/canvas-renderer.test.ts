import { DrawableIdSchema, PartIdSchema } from "@private-2d-rigging-lab/contracts";
import type { RenderScene, RenderViewport } from "@private-2d-rigging-lab/render-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CanvasRenderableDrawable, CanvasRenderProjection } from "./canvas-projection";
import { createCanvasBitmapCache, renderCanvasProjection } from "./canvas-renderer";

const webglRendererMock = vi.hoisted(() => ({
  constructCount: 0,
  disposeCount: 0,
  renderCalls: [] as {
    readonly scene: RenderScene;
    readonly viewport: RenderViewport;
  }[]
}));

vi.mock("@private-2d-rigging-lab/render-webgl2", () => ({
  WebGl2Renderer: class {
    constructor(readonly gl: unknown) {
      webglRendererMock.constructCount += 1;
    }

    render(scene: RenderScene, viewport: RenderViewport) {
      webglRendererMock.renderCalls.push({ scene, viewport });
    }

    dispose() {
      webglRendererMock.disposeCount += 1;
    }
  }
}));

const DRAW_RENDERER_TEST = DrawableIdSchema.parse("draw_renderer_test");
const PART_RENDERER_TEST = PartIdSchema.parse("part_renderer_test");

type RecordedCall = {
  readonly name: string;
  readonly args: readonly unknown[];
};

class FakeCanvasContext {
  readonly calls: RecordedCall[] = [];
  fillStyle = "";
  globalAlpha = 1;
  globalCompositeOperation = "source-over";
  lineWidth = 1;
  strokeStyle = "";

  setTransform(...args: unknown[]) {
    this.record("setTransform", args);
  }

  clearRect(...args: unknown[]) {
    this.record("clearRect", args);
  }

  fillRect(...args: unknown[]) {
    this.record("fillRect", args);
  }

  save(...args: unknown[]) {
    this.record("save", args);
  }

  translate(...args: unknown[]) {
    this.record("translate", args);
  }

  scale(...args: unknown[]) {
    this.record("scale", args);
  }

  beginPath(...args: unknown[]) {
    this.record("beginPath", args);
  }

  moveTo(...args: unknown[]) {
    this.record("moveTo", args);
  }

  lineTo(...args: unknown[]) {
    this.record("lineTo", args);
  }

  closePath(...args: unknown[]) {
    this.record("closePath", args);
  }

  clip(...args: unknown[]) {
    this.record("clip", args);
  }

  transform(...args: unknown[]) {
    this.record("transform", args);
  }

  drawImage(...args: unknown[]) {
    this.record("drawImage", args);
  }

  stroke(...args: unknown[]) {
    this.record("stroke", args);
  }

  strokeRect(...args: unknown[]) {
    this.record("strokeRect", args);
  }

  setLineDash(...args: unknown[]) {
    this.record("setLineDash", args);
  }

  arc(...args: unknown[]) {
    this.record("arc", args);
  }

  fill(...args: unknown[]) {
    this.record("fill", args);
  }

  restore(...args: unknown[]) {
    this.record("restore", args);
  }

  putImageData(...args: unknown[]) {
    this.record("putImageData", args);
  }

  private record(name: string, args: readonly unknown[]) {
    this.calls.push({
      name,
      args
    });
  }
}

class FakeCanvas {
  readonly context = new FakeCanvasContext();
  clientHeight = 128;
  clientWidth = 128;
  height = 0;
  width = 0;

  getContext(kind: string): FakeCanvasContext | object | null {
    return kind === "2d" ? this.context : null;
  }
}

class FakeWebGlCanvas extends FakeCanvas {
  getContext(kind: string): FakeCanvasContext | object | null {
    return kind === "webgl2" ? {} : super.getContext(kind);
  }
}

class FakeImageData {
  constructor(
    readonly data: Uint8ClampedArray,
    readonly width: number,
    readonly height: number
  ) {}
}

describe("canvas renderer evaluated mesh drawing", () => {
  afterEach(() => {
    webglRendererMock.constructCount = 0;
    webglRendererMock.disposeCount = 0;
    webglRendererMock.renderCalls.length = 0;
    vi.unstubAllGlobals();
  });

  it("draws non-fallback evaluated mesh triangles through clip and transform", () => {
    const { canvas, context } = renderDrawable(createDrawable({
      evaluatedMesh: {
        source: "committed",
        sourceMeshId: "mesh_face",
        bounds: { x: 10, y: 20, width: 30, height: 40 },
        vertices: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 10, y: 60 }
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        triangles: [[0, 1, 2]]
      },
      bounds: { x: 10, y: 20, width: 30, height: 40 }
    }));

    const triangleDraws = context.calls.filter(
      (call) =>
        call.name === "drawImage" &&
        call.args[0] !== canvas &&
        call.args[1] === 0 &&
        call.args[2] === 0 &&
        call.args.length === 3
    );

    expect(context.calls.some((call) => call.name === "clip")).toBe(true);
    expect(context.calls.some((call) => call.name === "transform")).toBe(true);
    expect(triangleDraws).toHaveLength(1);
    expect(
      context.calls.some(
        (call) =>
          call.name === "drawImage" &&
          call.args[1] === 10 &&
          call.args[2] === 20 &&
          call.args[3] === 30 &&
          call.args[4] === 40
      )
    ).toBe(false);
  });

  it("falls back to rectangular drawImage for rectFallback meshes", () => {
    const { canvas, context } = renderDrawable(createDrawable({
      evaluatedMesh: {
        source: "rectFallback",
        bounds: { x: 10, y: 20, width: 30, height: 40 },
        vertices: [
          { x: 10, y: 20 },
          { x: 40, y: 20 },
          { x: 40, y: 60 },
          { x: 10, y: 60 }
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ],
        triangles: [
          [0, 1, 2],
          [0, 2, 3]
        ]
      },
      bounds: { x: 10, y: 20, width: 30, height: 40 }
    }));

    expect(context.calls.some((call) => call.name === "clip")).toBe(false);
    expect(context.calls.some((call) => call.name === "transform")).toBe(false);
    expect(
      context.calls.some(
        (call) =>
          call.name === "drawImage" &&
          call.args[0] !== canvas &&
          call.args[1] === 10 &&
          call.args[2] === 20 &&
          call.args[3] === 30 &&
          call.args[4] === 40
      )
    ).toBe(true);
  });

  it("falls back to rectangular drawImage when all mesh triangles are degenerate", () => {
    const { canvas, context } = renderDrawable(createDrawable({
      evaluatedMesh: {
        source: "committed",
        sourceMeshId: "mesh_face",
        bounds: { x: 10, y: 20, width: 30, height: 40 },
        vertices: [
          { x: 10, y: 20 },
          { x: 10, y: 20 },
          { x: 40, y: 60 }
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        triangles: [[0, 1, 2]]
      },
      bounds: { x: 10, y: 20, width: 30, height: 40 }
    }));

    expect(context.calls.some((call) => call.name === "clip")).toBe(false);
    expect(context.calls.some((call) => call.name === "transform")).toBe(false);
    expect(
      context.calls.some(
        (call) =>
          call.name === "drawImage" &&
          call.args[0] !== canvas &&
          call.args[1] === 10 &&
          call.args[2] === 20 &&
          call.args[3] === 30 &&
          call.args[4] === 40
      )
    ).toBe(true);
  });

  it("uses WebGL2 for the primary drawable stack when available without Canvas2D triangle clip", () => {
    const canvas = new FakeCanvas();
    const context = canvas.context;
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        if (tagName !== "canvas") {
          throw new Error(`Unexpected element: ${tagName}`);
        }

        return new FakeWebGlCanvas();
      }
    });

    renderCanvasProjection({
      canvas: canvas as unknown as HTMLCanvasElement,
      projection: createProjection(createDrawable({
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_face",
          bounds: { x: 10, y: 20, width: 30, height: 40 },
          vertices: [
            { x: 10, y: 20 },
            { x: 40, y: 20 },
            { x: 10, y: 60 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          triangles: [[0, 1, 2]]
        },
        bounds: { x: 10, y: 20, width: 30, height: 40 }
      })),
      view: { zoom: 2, pan: { x: 4, y: 8 } },
      overlays: {
        grid: false,
        canvasBounds: false,
        selectionBounds: false,
        mesh: false,
        deformer: false,
        isolateSelected: false
      },
      cache: createCanvasBitmapCache()
    });

    expect(webglRendererMock.constructCount).toBe(1);
    expect(webglRendererMock.renderCalls).toHaveLength(1);
    expect(webglRendererMock.renderCalls[0]?.scene.drawables.map((drawable) => drawable.drawableId)).toEqual([
      DRAW_RENDERER_TEST
    ]);
    expect(webglRendererMock.renderCalls[0]?.viewport).toEqual({
      width: 128,
      height: 128,
      stageToViewport: {
        scale: 2,
        translate: { x: 4, y: 8 }
      }
    });
    expect(context.calls.some((call) => call.name === "clip")).toBe(false);
    expect(context.calls.some((call) => call.name === "transform")).toBe(false);
    expect(
      context.calls.some(
        (call) =>
          call.name === "drawImage" &&
          call.args[0] instanceof FakeWebGlCanvas &&
          call.args[1] === 0 &&
          call.args[2] === 0 &&
          call.args[3] === 128 &&
          call.args[4] === 128
      )
    ).toBe(true);
  });

  it("passes a bounds quad to WebGL2 for empty committed meshes", () => {
    const canvas = new FakeCanvas();
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        if (tagName !== "canvas") {
          throw new Error(`Unexpected element: ${tagName}`);
        }

        return new FakeWebGlCanvas();
      }
    });

    renderCanvasProjection({
      canvas: canvas as unknown as HTMLCanvasElement,
      projection: createProjection(createDrawable({
        evaluatedMesh: {
          source: "committed",
          sourceMeshId: "mesh_empty",
          bounds: { x: 10, y: 20, width: 30, height: 40 },
          vertices: [],
          uvs: [],
          triangles: []
        },
        bounds: { x: 10, y: 20, width: 30, height: 40 }
      })),
      view: { zoom: 1, pan: { x: 0, y: 0 } },
      overlays: {
        grid: false,
        canvasBounds: false,
        selectionBounds: false,
        mesh: false,
        deformer: false,
        isolateSelected: false
      },
      cache: createCanvasBitmapCache()
    });

    expect(webglRendererMock.renderCalls).toHaveLength(1);
    expect(webglRendererMock.renderCalls[0]?.scene.drawables[0]?.mesh).toMatchObject({
      vertices: [
        { x: 10, y: 20 },
        { x: 40, y: 20 },
        { x: 40, y: 60 },
        { x: 10, y: 60 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ],
      triangles: [
        [0, 1, 2],
        [0, 2, 3]
      ]
    });
  });

  it("draws every projected mesh overlay", () => {
    const canvas = new FakeCanvas();
    const context = canvas.context;
    vi.stubGlobal("window", { devicePixelRatio: 1 });
    vi.stubGlobal("document", {
      createElement: (tagName: string) => {
        if (tagName !== "canvas") {
          throw new Error(`Unexpected element: ${tagName}`);
        }

        return new FakeCanvas();
      }
    });

    renderCanvasProjection({
      canvas: canvas as unknown as HTMLCanvasElement,
      projection: {
        canvasBounds: { x: 0, y: 0, width: 128, height: 128 },
        selectedDrawableIds: new Set(),
        drawables: [],
        maskRelations: [],
        meshOverlays: [
          createMeshOverlay("draw_renderer_test_a"),
          createMeshOverlay("draw_renderer_test_b")
        ],
        hasRenderableArtwork: false,
        contentKey: "renderer-mesh-overlays-test"
      },
      view: { zoom: 1, pan: { x: 0, y: 0 } },
      overlays: {
        grid: false,
        canvasBounds: false,
        selectionBounds: false,
        mesh: true,
        deformer: false,
        isolateSelected: false
      },
      cache: createCanvasBitmapCache()
    });

    expect(
      context.calls.filter(
        (call) =>
          call.name === "setLineDash" &&
          Array.isArray(call.args[0]) &&
          call.args[0][0] === 7
      )
    ).toHaveLength(2);
    expect(context.calls.filter((call) => call.name === "arc")).toHaveLength(6);
  });
});

function renderDrawable(drawable: CanvasRenderableDrawable) {
  const canvas = new FakeCanvas();
  const context = canvas.context;
  vi.stubGlobal("window", { devicePixelRatio: 1 });
  vi.stubGlobal("document", {
    createElement: (tagName: string) => {
      if (tagName !== "canvas") {
        throw new Error(`Unexpected element: ${tagName}`);
      }

      return new FakeCanvas();
    }
  });
  vi.stubGlobal("ImageData", FakeImageData);

  renderCanvasProjection({
    canvas: canvas as unknown as HTMLCanvasElement,
    projection: createProjection(drawable),
    view: { zoom: 1, pan: { x: 0, y: 0 } },
    overlays: {
      grid: false,
      canvasBounds: false,
      selectionBounds: false,
      mesh: false,
      deformer: false,
      isolateSelected: false
    },
    cache: createCanvasBitmapCache()
  });

  return { canvas, context };
}

function createProjection(drawable: CanvasRenderableDrawable): CanvasRenderProjection {
  return {
    canvasBounds: { x: 0, y: 0, width: 128, height: 128 },
    artworkBounds: drawable.bounds,
    selectedDrawableIds: new Set(),
    drawables: [drawable],
    maskRelations: [],
    hasRenderableArtwork: true,
    contentKey: "renderer-test"
  };
}

function createDrawable(input: {
  readonly bounds: CanvasRenderableDrawable["bounds"];
  readonly evaluatedMesh: CanvasRenderableDrawable["evaluatedMesh"];
}): CanvasRenderableDrawable {
  const renderWidth = 30;
  const renderHeight = 40;

  return {
    drawableId: DRAW_RENDERER_TEST,
    displayName: "Renderer Test",
    partId: PART_RENDERER_TEST,
    partAncestorIds: [],
    textureId: "tex_renderer_test",
    binaryAssetId: "bin_renderer_test",
    binaryAssetPath: "assets/textures/renderer-test.rgba",
    bounds: input.bounds,
    evaluatedMesh: input.evaluatedMesh,
    frontOrder: 0,
    visible: true,
    opacity: 1,
    selected: false,
    selectedBySubtree: false,
    meshPreview: false,
    renderBytes: new Uint8Array(renderWidth * renderHeight * 4),
    renderWidth,
    renderHeight,
    maskSourceDrawableIds: []
  };
}

function createMeshOverlay(drawableId: string) {
  return {
    drawableId: DrawableIdSchema.parse(drawableId),
    status: "draft" as const,
    mesh: {
      source: "draft" as const,
      sourceMeshId: `mesh_${drawableId}`,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      triangles: [[0, 1, 2]] as [number, number, number][]
    }
  };
}
