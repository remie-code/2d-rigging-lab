import { describe, expect, it } from "vitest";

import {
  createSoftAlphaMask,
  DEFAULT_MAX_MASK_EXPANSION_PIXELS,
  expandMask,
  resolveMaskExpansionPixels
} from "./alpha-mask.js";
import {
  detectRawAlphaIslands,
  filterAlphaIslands
} from "./alpha-island-components.js";
import { sampleBoundaryLoop } from "./boundary-resampling.js";
import { selectOuterLoop, traceBoundaryLoops } from "./boundary-tracing.js";
import {
  countHoleLikeRegions,
  createComponentMask,
  findOpaqueComponents,
  selectMainComponent
} from "./connected-components.js";
import {
  distanceToClosedPolyline,
  type GeometryPoint,
  polygonSignedArea,
  roundCoordinate
} from "./geometry-primitives.js";
import { sampleInteriorSteinerPoints } from "./interior-point-sampling.js";
import {
  simplifyContourLoop,
  simplifyOpenPolyline
} from "./polyline-simplification.js";

/**
 * These are minimal smoke tests for the algorithm-neutral mesh-geometry
 * modules. The authoritative behavioural guarantee (coordinate-identical v6
 * output) is enforced by the v6 determinism regressions in
 * `mesh-generation.test.ts`; these tests only confirm each neutral entry point
 * is wired up and self-consistent.
 */

// A 6x6 texture with a solid 4x4 opaque square inset by 1px.
const buildSquareRgba = (size: number, inset: number): Uint8Array => {
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const opaque = x >= inset && x < size - inset && y >= inset && y < size - inset;
      const byteIndex = (y * size + x) * 4;
      bytes[byteIndex] = 255;
      bytes[byteIndex + 1] = 255;
      bytes[byteIndex + 2] = 255;
      bytes[byteIndex + 3] = opaque ? 255 : 0;
    }
  }

  return bytes;
};

describe("geometry-primitives", () => {
  it("rounds -0 to 0 and quantises to 1e-6", () => {
    expect(roundCoordinate(-0)).toBe(0);
    expect(roundCoordinate(1.23456789)).toBe(1.234568);
  });

  it("computes signed polygon area for a unit square", () => {
    const square: GeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 }
    ];
    expect(polygonSignedArea(square)).toBe(1);
  });

  it("measures distance to a closed polyline", () => {
    const square: GeometryPoint[] = [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 0, y: 4 }
    ];
    expect(distanceToClosedPolyline({ x: 2, y: 2 }, square)).toBe(2);
  });
});

describe("alpha-mask", () => {
  it("exposes the v6 default expansion ceiling", () => {
    expect(DEFAULT_MAX_MASK_EXPANSION_PIXELS).toBe(8);
  });

  it("clamps expansion into [0, ceiling] with the v6 default ceiling", () => {
    expect(resolveMaskExpansionPixels(2)).toBe(2);
    expect(resolveMaskExpansionPixels(100)).toBe(8);
    expect(resolveMaskExpansionPixels(-4)).toBe(0);
    expect(resolveMaskExpansionPixels(undefined)).toBe(0);
  });

  it("honours a widened ceiling when a caller passes one", () => {
    expect(resolveMaskExpansionPixels(20, 32)).toBe(20);
    expect(resolveMaskExpansionPixels(100, 32)).toBe(32);
  });

  it("builds a soft mask over an opaque square", () => {
    const size = 6;
    const soft = createSoftAlphaMask(buildSquareRgba(size, 1), size, size, 8);
    expect(soft.inputOpaquePixelCount).toBe(16);
    expect(soft.softMaskOpaquePixelCount).toBeGreaterThanOrEqual(16);
  });

  it("dilates a mask by the requested pixel count", () => {
    const size = 5;
    const mask = new Array<boolean>(size * size).fill(false);
    mask[2 * size + 2] = true;
    const expanded = expandMask(mask, size, size, 1);
    // Center plus its 4 neighbours become opaque.
    expect(expanded.filter(Boolean).length).toBe(5);
  });
});

describe("connected-components + boundary + interior", () => {
  it("traces the outer loop of an opaque square and samples it", () => {
    const size = 6;
    const soft = createSoftAlphaMask(buildSquareRgba(size, 1), size, size, 8);
    const components = findOpaqueComponents(soft.mask, size, size);
    const main = selectMainComponent(components);
    expect(main).toBeDefined();

    const mask = createComponentMask(main!, size, size);
    const loops = traceBoundaryLoops(mask, size, size);
    const outer = selectOuterLoop(loops);
    expect(outer).toBeDefined();
    expect(outer!.length).toBeGreaterThanOrEqual(3);

    const boundaryPoints = sampleBoundaryLoop(outer!, {
      boundarySpacing: 2,
      maxBoundaryVertices: 96
    });
    expect(boundaryPoints.length).toBeGreaterThanOrEqual(3);

    const interior = sampleInteriorSteinerPoints({
      mainMask: mask,
      width: size,
      component: main!,
      boundaryPoints,
      parameters: {
        interiorSpacing: 2,
        maxInteriorVertices: 8,
        interiorBoundaryClearance: 0.5
      }
    });
    expect(Array.isArray(interior)).toBe(true);

    expect(countHoleLikeRegions(mask, size, size, main!.bounds)).toBe(0);
  });
});

describe("alpha-island-components", () => {
  it("detects and keeps a single large island", () => {
    const size = 6;
    const detection = detectRawAlphaIslands({
      textureSize: { width: size, height: size },
      rgbaBytes: buildSquareRgba(size, 1)
    });
    expect(detection.status).toBe("detected");
    expect(detection.islands.length).toBe(1);

    const filtered = filterAlphaIslands(detection.islands);
    expect(filtered.keptIslands.length).toBe(1);
    expect(filtered.skippedTinyNoiseIslands.length).toBe(0);
  });
});

describe("polyline-simplification", () => {
  it("collapses collinear points on an open polyline", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 }
    ];
    expect(simplifyOpenPolyline(line, 0.1)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 }
    ]);
  });

  it("simplifies a near-square contour loop while keeping >=3 vertices", () => {
    const loop = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
      { x: 0, y: 2 },
      { x: 0, y: 1 }
    ];
    const simplified = simplifyContourLoop(loop, {
      simplifyEpsilon: 0.5,
      contourVertexCap: 64
    });
    expect(simplified.length).toBeGreaterThanOrEqual(3);
    expect(simplified.length).toBeLessThan(loop.length);
  });
});
