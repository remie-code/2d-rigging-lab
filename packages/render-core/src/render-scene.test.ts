import { describe, expect, it } from "vitest";

import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  createRenderScene,
  createRenderTextureCacheKey,
  createRgba8TextureContentSignature,
  orderRenderDrawablesBackToFront,
  type RenderDrawable,
  type RenderRgba8TextureSource
} from "./index.js";

describe("render-core scene contract", () => {
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
