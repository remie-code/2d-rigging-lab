import { afterEach, describe, expect, it } from "vitest";

import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRenderScene,
  createRenderTextureCacheKey,
  createRgba8TextureContentSignature,
  clearRgba8TextureContentSignatureCache,
  getLive2dPerformanceStats,
  orderRenderDrawablesBackToFront,
  resetLive2dPerformanceStats,
  type RenderDrawable,
  type RenderRgba8TextureSource
} from "./index.js";

describe("render-core scene contract", () => {
  afterEach(() => {
    delete (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__;
    clearRgba8TextureContentSignatureCache();
    resetLive2dPerformanceStats();
  });

  it("orders drawables deterministically back-to-front", () => {
    const drawables = [
      createDrawable("draw_b", 0, 2),
      createDrawable("draw_c", 3, 1),
      createDrawable("draw_a", 3, 0)
    ];

    expect(orderRenderDrawablesBackToFront(drawables).map((drawable) => drawable.drawableId)).toEqual([
      "draw_a",
      "draw_c",
      "draw_b"
    ]);
    expect(createRenderScene({ textureSources: [], drawables }).drawables.map((drawable) => drawable.drawableId)).toEqual([
      "draw_a",
      "draw_c",
      "draw_b"
    ]);
  });

  it("creates content signatures that change with texture bytes and dimensions", () => {
    const first = createRgba8TextureContentSignature({
      textureId: "tex",
      width: 1,
      height: 1,
      bytes: new Uint8Array([255, 0, 0, 255])
    });
    const same = createRgba8TextureContentSignature({
      textureId: "tex",
      width: 1,
      height: 1,
      bytes: new Uint8Array([255, 0, 0, 255])
    });
    const changedBytes = createRgba8TextureContentSignature({
      textureId: "tex",
      width: 1,
      height: 1,
      bytes: new Uint8Array([0, 255, 0, 255])
    });
    const changedDimensions = createRgba8TextureContentSignature({
      textureId: "tex",
      width: 2,
      height: 1,
      bytes: new Uint8Array([255, 0, 0, 255])
    });

    expect(first).toBe(same);
    expect(changedBytes).not.toBe(first);
    expect(changedDimensions).not.toBe(first);
  });

  it("memoizes content signatures by byte-array identity", () => {
    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    clearRgba8TextureContentSignatureCache();
    resetLive2dPerformanceStats();
    const bytes = new Uint8Array([255, 0, 0, 255]);

    const first = createRgba8TextureContentSignature({
      textureId: "tex",
      width: 1,
      height: 1,
      bytes
    });
    const sameIdentity = createRgba8TextureContentSignature({
      textureId: "tex",
      width: 1,
      height: 1,
      bytes
    });
    const changedIdentity = createRgba8TextureContentSignature({
      textureId: "tex",
      width: 1,
      height: 1,
      bytes: new Uint8Array([0, 255, 0, 255])
    });

    expect(sameIdentity).toBe(first);
    expect(changedIdentity).not.toBe(first);
    expect(getLive2dPerformanceStats()?.counters).toMatchObject({
      "textureSignature.cacheHits": 1,
      "textureSignature.cacheMisses": 2,
      "textureSignature.bytesHashed": 8
    });
  });

  it("keeps performance instrumentation disabled by default", () => {
    clearRgba8TextureContentSignatureCache();
    resetLive2dPerformanceStats();

    createRgba8TextureContentSignature({
      textureId: "tex",
      width: 1,
      height: 1,
      bytes: new Uint8Array([255, 0, 0, 255])
    });

    expect(getLive2dPerformanceStats()).toBeUndefined();
  });

  it("uses signature, dimensions, id, and alpha mode for texture cache keys", () => {
    const source = createTextureSource("sig:a", "straight");
    expect(createRenderTextureCacheKey(source)).toBe("rgba8:tex:1x1:straight:sig:a");
    expect(createRenderTextureCacheKey(createTextureSource("sig:a", "premultiplied"))).not.toBe(
      createRenderTextureCacheKey(source)
    );
  });
});

function createDrawable(drawableId: string, drawOrder: number, stableIndex: number): RenderDrawable {
  return {
    drawableId,
    textureRef: { textureId: "tex" },
    mesh: {
      coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
      uvSpace: DEFAULT_RENDER_UV_SPACE,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ],
      triangles: [[0, 1, 2]]
    },
    opacity: 1,
    drawOrder,
    stableIndex,
    visible: true,
    blendMode: DEFAULT_RENDER_BLEND_MODE
  };
}

type Live2dPerformanceTestGlobal = typeof globalThis & {
  __LIVE2D_PERF__?: boolean;
};

function createTextureSource(
  contentSignature: string,
  alphaMode: RenderRgba8TextureSource["alphaMode"]
): RenderRgba8TextureSource {
  return {
    kind: "rgba8",
    textureId: "tex",
    width: 1,
    height: 1,
    bytes: new Uint8Array([0, 0, 0, 0]),
    alphaMode,
    contentSignature
  };
}
