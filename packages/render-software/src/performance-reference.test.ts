import { describe, it, expect } from "vitest";

import {
  DEFAULT_RENDER_BLEND_MODE,
  DEFAULT_RENDER_MESH_COORDINATE_SPACE,
  DEFAULT_RENDER_UV_SPACE,
  type RenderDrawable,
  type RenderPoint,
  type RenderTriangle
} from "@private-2d-rigging-lab/render-core";

import { renderSceneToPng } from "./render-scene-to-png.js";
import type { SoftwareRenderView } from "./view/view-transform.js";
import { createScene, createFourColorTexture } from "./test-support/scene-fixtures.js";

/**
 * Reference performance measurement. This is informational only and must never
 * fail on timing (no wall-clock assertion). It builds a typical mid-size scene
 * (several drawables, a grid mesh each) at 512x512 and records the render time
 * via console for the domain report.
 */

function createGridDrawable(
  drawableId: string,
  textureId: string,
  originX: number,
  originY: number,
  size: number,
  cells: number,
  drawOrder: number
): RenderDrawable {
  const vertices: RenderPoint[] = [];
  const uvs: RenderPoint[] = [];
  const step = size / cells;
  for (let row = 0; row <= cells; row += 1) {
    for (let col = 0; col <= cells; col += 1) {
      vertices.push({ x: originX + col * step, y: originY + row * step });
      uvs.push({ x: col / cells, y: row / cells });
    }
  }
  const triangles: RenderTriangle[] = [];
  const stride = cells + 1;
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const topLeft = row * stride + col;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + stride;
      const bottomRight = bottomLeft + 1;
      triangles.push([topLeft, bottomLeft, bottomRight]);
      triangles.push([topLeft, bottomRight, topRight]);
    }
  }
  return {
    drawableId,
    textureRef: { textureId },
    mesh: {
      coordinateSpace: DEFAULT_RENDER_MESH_COORDINATE_SPACE,
      uvSpace: DEFAULT_RENDER_UV_SPACE,
      vertices,
      uvs,
      triangles
    },
    opacity: 1,
    drawOrder,
    stableIndex: drawOrder,
    visible: true,
    blendMode: DEFAULT_RENDER_BLEND_MODE
  };
}

describe("performance reference (informational)", () => {
  it("renders a typical mid-size scene at 512x512 and records timing", () => {
    const texture = createFourColorTexture("perf");
    const drawables: RenderDrawable[] = [];
    const count = 8;
    for (let index = 0; index < count; index += 1) {
      const offset = index * 0.4;
      drawables.push(
        createGridDrawable(
          `drawable_${index}`,
          "perf",
          -3 + offset,
          -3 + offset,
          6,
          16,
          count - index
        )
      );
    }
    const scene = createScene({ textureSources: [texture], drawables });
    const view: SoftwareRenderView = {
      stageViewport: { minX: -4, minY: -4, width: 8, height: 8 },
      outputWidth: 512,
      outputHeight: 512
    };

    // Warm up once, then measure.
    renderSceneToPng(scene, view);
    const start = performance.now();
    const result = renderSceneToPng(scene, view);
    const elapsedMs = performance.now() - start;
    console.log(
      `[render-software perf] 512x512, ${count} drawables x ${16 * 16 * 2} tris: ${elapsedMs.toFixed(2)} ms, png ${result.png.length} bytes`
    );

    expect(result.png.length).toBeGreaterThan(0);
    expect(result.render.width).toBe(512);
    expect(result.render.height).toBe(512);
  });
});
