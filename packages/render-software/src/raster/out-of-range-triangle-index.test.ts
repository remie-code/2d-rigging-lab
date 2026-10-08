import { describe, it, expect } from "vitest";

import type { RenderDrawable, RenderTriangle } from "@private-2d-rigging-lab/render-core";

import { renderSceneToRgba8 } from "../software-renderer.js";
import type { SoftwareRenderView } from "../view/view-transform.js";
import {
  createScene,
  createSolidTexture
} from "../test-support/scene-fixtures.js";

/**
 * Wave104 B-1: dedicated coverage for the out-of-range triangle index skip in
 * `rasterizeDrawable`. A triangle is only rasterized when all three of its vertex
 * indices are in `[0, vertexCount)`; triangles referencing indices outside that range
 * are skipped and contribute nothing. Prior tests only covered this behavior
 * indirectly.
 */

const view4x4: SoftwareRenderView = {
  stageViewport: { minX: 0, minY: 0, width: 4, height: 4 },
  outputWidth: 4,
  outputHeight: 4
};

const redTexture = createSolidTexture({
  textureId: "red",
  width: 1,
  height: 1,
  rgba: [255, 0, 0, 255]
});

// The three vertices / uvs shared by every drawable in this file: a right triangle
// covering the bottom-left half of a 4x4 canvas (the same shape as the golden
// single-triangle test), so a valid [0,1,2] triangle produces a known coverage.
const vertices = [
  { x: 0, y: 0 },
  { x: 0, y: 4 },
  { x: 4, y: 4 }
];
const uvs = [
  { x: 0, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 }
];

const createTriangleDrawable = (triangles: readonly RenderTriangle[]): RenderDrawable => ({
  drawableId: "tri",
  textureRef: { textureId: "red" },
  mesh: {
    coordinateSpace: "stage",
    uvSpace: "layer-local-top-left-0-1-v1",
    vertices,
    uvs,
    triangles
  },
  opacity: 1,
  drawOrder: 0,
  stableIndex: 0,
  visible: true,
  blendMode: "normal-premultiplied-alpha-v0"
});

const renderTriangles = (triangles: readonly RenderTriangle[]): Uint8Array =>
  renderSceneToRgba8(
    createScene({ textureSources: [redTexture], drawables: [createTriangleDrawable(triangles)] }),
    view4x4
  ).premultipliedRgba8;

const emptyCanvas = (): number[] => new Array(4 * 4 * 4).fill(0);

describe("rasterizeDrawable out-of-range triangle index handling (Wave104 B-1)", () => {
  it("skips a triangle whose index is >= vertexCount, drawing nothing", () => {
    // vertexCount is 3 (min of vertices.length=3 and uvs.length=3). Index 3 is the first
    // out-of-range index; the single triangle referencing it must be skipped entirely.
    const result = renderTriangles([[0, 1, 3]]);

    expect(Array.from(result)).toEqual(emptyCanvas());
  });

  it("skips a triangle with a negative index, drawing nothing", () => {
    const result = renderTriangles([[0, -1, 2]]);

    expect(Array.from(result)).toEqual(emptyCanvas());
  });

  it("skips a triangle whose every index is out of range, drawing nothing", () => {
    const result = renderTriangles([[5, 6, 7]]);

    expect(Array.from(result)).toEqual(emptyCanvas());
  });

  it("renders only the valid triangle when a valid and an out-of-range triangle coexist", () => {
    // A valid [0,1,2] triangle plus a trailing out-of-range triangle must produce the
    // exact same bytes as the valid triangle alone: the invalid one contributes nothing.
    const validOnly = renderTriangles([[0, 1, 2]]);
    const validPlusOutOfRange = renderTriangles([
      [0, 1, 2],
      [0, 1, 4]
    ]);

    // Sanity: the valid triangle actually draws something (otherwise the equality below
    // would be vacuously satisfied by two empty canvases).
    expect(Array.from(validOnly)).not.toEqual(emptyCanvas());
    expect(Array.from(validPlusOutOfRange)).toEqual(Array.from(validOnly));
  });
});
