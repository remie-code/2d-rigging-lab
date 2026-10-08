import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  type RectDto,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { createPackageBinaryFileEntry } from "@private-2d-rigging-lab/package-format";
import type { MeshDto } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { createGeneratedMeshForDrawable } from "./mesh-generation.js";
import {
  V7_MESH_GENERATION_METHOD_IDS,
  isV7MeshGenerationMethod,
  getV7MeshGenerationCandidate
} from "./mesh-generation-contract.js";
import {
  mapPixelPointToStagePoint,
  mapPixelPointToUv
} from "./mesh-generation-v7-margin-contour.js";
import {
  deriveV7Parameters,
  V7_MARGIN_RADIUS_MAX_PIXELS,
  V7_MARGIN_RADIUS_MIN_PIXELS,
  V7_SOFT_MASK_GROWTH_PIXELS,
  V7_VERTEX_SPACING_PIXELS
} from "./mesh-generation-v7-parameters.js";
import {
  probeV7MarginContourPipelineForTest,
  type V7PipelineResult
} from "./mesh-generation-v7-pipeline.js";

const DRAWABLE_ID = DrawableIdSchema.parse("draw_body");
const MESH_ID = MeshIdSchema.parse("mesh_body");
const PROVENANCE_ID = ProvenanceIdSchema.parse("prov_generate_body");

// ---------------------------------------------------------------------------
// Contract wiring
// ---------------------------------------------------------------------------

describe("v7 margin-contour contract wiring", () => {
  it("registers the v7 method id and guard", () => {
    expect(V7_MESH_GENERATION_METHOD_IDS).toEqual(["auto-outline-v7-margin-contour"]);
    expect(isV7MeshGenerationMethod("auto-outline-v7-margin-contour")).toBe(true);
    expect(isV7MeshGenerationMethod("auto-outline-v6d-adaptive-contour-constrainautor")).toBe(false);
    const candidate = getV7MeshGenerationCandidate("auto-outline-v7-margin-contour");
    expect(candidate.sourceId).toBe("outline-v7-margin-contour-rgba");
    expect(candidate.backendId).toBe("v7-margin-contour");
    expect([...candidate.dependencyPackageIds].sort()).toEqual([
      "@kninnug/constrainautor",
      "delaunator"
    ]);
  });
});

// ---------------------------------------------------------------------------
// Parameters: ε < r and preset monotonicity
// ---------------------------------------------------------------------------

describe("v7 parameter derivation", () => {
  const presets = ["high", "medium", "low"] as const;

  it("holds ε < r for every preset over a range of texture sizes", () => {
    for (const textureLongEdge of [16, 64, 256, 1024, 4096]) {
      for (const densityHint of presets) {
        const parameters = deriveV7Parameters({
          densityHint,
          textureWidth: textureLongEdge,
          textureHeight: Math.floor(textureLongEdge / 2)
        });
        expect(parameters.simplifyEpsilon).toBeLessThan(parameters.marginRadiusPixels);
      }
    }
  });

  it("moves only L across presets: high (moves a lot) < medium < low (barely moves)", () => {
    const high = deriveV7Parameters({ densityHint: "high", textureWidth: 256, textureHeight: 256 });
    const medium = deriveV7Parameters({ densityHint: "medium", textureWidth: 256, textureHeight: 256 });
    const low = deriveV7Parameters({ densityHint: "low", textureWidth: 256, textureHeight: 256 });

    expect(high.vertexSpacing).toBeLessThan(medium.vertexSpacing);
    expect(medium.vertexSpacing).toBeLessThan(low.vertexSpacing);
    // r and ε are preset-invariant (only L moves).
    expect(high.marginRadiusPixels).toBe(medium.marginRadiusPixels);
    expect(medium.marginRadiusPixels).toBe(low.marginRadiusPixels);
    expect(high.simplifyEpsilon).toBe(low.simplifyEpsilon);
    // L = 28/42/64px confirmed by the user in evaluation round-trip 1 (2026-07-07).
    expect(V7_VERTEX_SPACING_PIXELS).toEqual({ high: 28, medium: 42, low: 64 });
  });

  it("leaves the margin radius r at its natural long-edge-proportional value (Option E, Wave108 D-gen)", () => {
    // Option E does NOT bind r to any coverage constant: r stays on the natural
    // band r = clamp(0.012·longEdge, 4, 16). Tiny textures pin to the 4px floor,
    // huge textures to the 16px ceiling, and mid textures scale with the edge.
    // A large part (longEdge 1000 → 0.012·1000 = 12) must therefore exceed 4.
    const rSmall = deriveV7Parameters({ textureWidth: 100, textureHeight: 100 }).marginRadiusPixels;
    expect(rSmall).toBe(V7_MARGIN_RADIUS_MIN_PIXELS); // 0.012·100 = 1.2 → floor 4.

    const rLarge = deriveV7Parameters({ textureWidth: 1000, textureHeight: 500 }).marginRadiusPixels;
    expect(rLarge).toBeGreaterThan(V7_MARGIN_RADIUS_MIN_PIXELS); // 0.012·1000 = 12 > 4.
    expect(rLarge).toBe(12);

    const rHuge = deriveV7Parameters({ textureWidth: 4096, textureHeight: 4096 }).marginRadiusPixels;
    expect(rHuge).toBe(V7_MARGIN_RADIUS_MAX_PIXELS); // 0.012·4096 = 49 → ceiling 16.

    for (const size of [16, 100, 512, 1000, 2000, 4096]) {
      const r = deriveV7Parameters({ textureWidth: size, textureHeight: size }).marginRadiusPixels;
      expect(r).toBeGreaterThanOrEqual(V7_MARGIN_RADIUS_MIN_PIXELS);
      expect(r).toBeLessThanOrEqual(V7_MARGIN_RADIUS_MAX_PIXELS);
    }
  });
});

// ---------------------------------------------------------------------------
// UV mapping: non-clamp + stage/UV symmetry (Wave108 D-gen)
// ---------------------------------------------------------------------------

describe("v7 pixel-to-UV mapping (non-clamp)", () => {
  // Frozen-case shape (mouth_u): boundary vertices sit OUTSIDE the texture, so
  // their pixel coords fall outside [0, textureSize] and the UV must spill past
  // [0,1] rather than pin to the edge.
  const textureWidth = 17;
  const textureHeight = 16;
  const bounds: RectDto = { x: 992, y: 519, width: 17, height: 16 };

  it("does NOT clamp UV to [0,1] for out-of-texture (overshoot) pixels", () => {
    // Pixels below 0 and above textureSize (covering-margin overshoot).
    const overshoot = [
      { x: -3, y: -2 },
      { x: 20, y: 19 }
    ] as const;
    for (const point of overshoot) {
      const uv = mapPixelPointToUv(point, textureWidth, textureHeight);
      // Straight pixel/size, no clamp: values fall outside [0,1].
      expect(uv.x).toBeCloseTo(point.x / textureWidth, 6);
      expect(uv.y).toBeCloseTo(point.y / textureHeight, 6);
      expect(uv.x < 0 || uv.x > 1 || uv.y < 0 || uv.y > 1).toBe(true);
    }
  });

  it("maps stage and UV on the SAME pixel/size basis (stage = origin + size*ratio, uv = ratio)", () => {
    const points = [
      { x: -3, y: -2 },
      { x: 20, y: 19 },
      { x: 8, y: 8 }
    ] as const;
    for (const point of points) {
      const ratioX = point.x / textureWidth;
      const ratioY = point.y / textureHeight;
      const uv = mapPixelPointToUv(point, textureWidth, textureHeight);
      const stage = mapPixelPointToStagePoint(point, bounds, textureWidth, textureHeight);
      // UV is the bare ratio.
      expect(uv.x).toBeCloseTo(ratioX, 6);
      expect(uv.y).toBeCloseTo(ratioY, 6);
      // Stage is bounds.origin + bounds.size * (same ratio).
      expect(stage.x).toBeCloseTo(bounds.x + bounds.width * ratioX, 6);
      expect(stage.y).toBeCloseTo(bounds.y + bounds.height * ratioY, 6);
    }
  });

  it("keeps stage vertices unclamped: out-of-texture pixels extend outside bounds", () => {
    const stageBelow = mapPixelPointToStagePoint({ x: -3, y: -2 }, bounds, textureWidth, textureHeight);
    const stageAbove = mapPixelPointToStagePoint({ x: 20, y: 19 }, bounds, textureWidth, textureHeight);
    // Negative pixel -> stage left/above the bounds origin.
    expect(stageBelow.x).toBeLessThan(bounds.x);
    expect(stageBelow.y).toBeLessThan(bounds.y);
    // Over-size pixel -> stage beyond the far edge.
    expect(stageAbove.x).toBeGreaterThan(bounds.x + bounds.width);
    expect(stageAbove.y).toBeGreaterThan(bounds.y + bounds.height);
  });

  it("leaves matching (in-texture) UV inside [0,1] — no regression when there is no overshoot", () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: 8, y: 8 },
      { x: 17, y: 16 }
    ] as const) {
      const uv = mapPixelPointToUv(point, textureWidth, textureHeight);
      expect(uv.x).toBeGreaterThanOrEqual(0);
      expect(uv.x).toBeLessThanOrEqual(1);
      expect(uv.y).toBeGreaterThanOrEqual(0);
      expect(uv.y).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Pipeline: coverage guarantee (the core of this wave)
// ---------------------------------------------------------------------------

describe("v7 coverage guarantee", () => {
  it("covers EVERY opaque pixel of a filled blob (full scan, not sampled)", () => {
    const width = 40;
    const height = 36;
    const isOpaque = (x: number, y: number): boolean => {
      const dx = x - 19;
      const dy = y - 17;
      return dx * dx + dy * dy <= 12 * 12;
    };
    const result = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    assertEveryOpaquePixelCovered(result, width, height, isOpaque);
  });

  it("covers every opaque pixel of a thin hair-tip shape", () => {
    const width = 30;
    const height = 40;
    // A body blob with a long thin tail (a "hair tip").
    const isOpaque = (x: number, y: number): boolean => {
      const inBody = x >= 8 && x <= 20 && y >= 6 && y <= 18;
      const inTail = x >= 13 && x <= 15 && y >= 18 && y <= 36;
      return inBody || inTail;
    };
    const result = runPipeline({ width, height, isOpaque, densityHint: "high" });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    assertEveryOpaquePixelCovered(result, width, height, isOpaque);
  });
});

// ---------------------------------------------------------------------------
// Boundary non-clamp (the core of this wave: evaluation round-trip 1, defect 1)
// ---------------------------------------------------------------------------

describe("v7 boundary non-clamp", () => {
  // A large full-bleed rectangle: opaque out to every canvas edge. Under the old
  // clamped pipeline the dilated mask could not grow past the texture edge, so
  // the outline traced the four canvas-border lines and a WALL of collinear
  // boundary vertices stuck to x=0 / x=width / y=0 / y=height. With the virtual
  // padding, the whole outline is pushed OUTSIDE the original bounds by ~r px.
  const width = 200;
  const height = 160;
  const isOpaque = (x: number, y: number): boolean =>
    x >= 0 && x <= width - 1 && y >= 0 && y <= height - 1;

  it("(a) pushes outline vertices OUTSIDE the original bounds (margin extends past the edge)", () => {
    const result = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    const outside = result.boundaryPoints.filter(
      (point) => point.x < 0 || point.y < 0 || point.x > width || point.y > height
    );
    // Every boundary vertex of a full-bleed shape is pushed out; assert a strong
    // majority to stay robust. Under clamping this count is necessarily ZERO
    // (the outline is confined to [0,width]×[0,height]).
    expect(outside.length).toBeGreaterThan(result.boundaryPoints.length / 2);

    // The bounding box of the outline strictly exceeds the canvas on all sides —
    // impossible under the old clamped regime.
    const minX = Math.min(...result.boundaryPoints.map((p) => p.x));
    const minY = Math.min(...result.boundaryPoints.map((p) => p.y));
    const maxX = Math.max(...result.boundaryPoints.map((p) => p.x));
    const maxY = Math.max(...result.boundaryPoints.map((p) => p.y));
    expect(minX).toBeLessThan(0);
    expect(minY).toBeLessThan(0);
    expect(maxX).toBeGreaterThan(width);
    expect(maxY).toBeGreaterThan(height);
  });

  it("(b) removes the border-line vertex wall (no straight run stuck to a canvas edge)", () => {
    const result = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    // Under clamping, a full side of length S hosts ceil(S / L) collinear wall
    // vertices exactly on the edge line (here ~5 on the 200px sides, ~4 on the
    // 160px sides for L=42). With padding at most the isolated points where the
    // rounded outline crosses an axis remain (<= 2). Assert every original edge
    // line holds fewer than the smallest clamped wall — a clean discriminator.
    const onLine = (coord: (p: { x: number; y: number }) => number, line: number): number =>
      result.boundaryPoints.filter((point) => Math.abs(coord(point) - line) < 0.5).length;
    const wallThreshold = 3;
    expect(onLine((p) => p.x, 0)).toBeLessThan(wallThreshold);
    expect(onLine((p) => p.x, width)).toBeLessThan(wallThreshold);
    expect(onLine((p) => p.y, 0)).toBeLessThan(wallThreshold);
    expect(onLine((p) => p.y, height)).toBeLessThan(wallThreshold);
  });

  it("(c) still covers every opaque pixel of the edge-touching shape (coverage preserved)", () => {
    const result = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    assertEveryOpaquePixelCovered(result, width, height, isOpaque);
  });

  it("runs under pad = ceil(r + soft-mask growth) and unpads output to the texture frame", () => {
    const result = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    // pad = ceil(r + 2). r for a 200px long edge clamps to the 4px floor.
    const r = result.parameters.marginRadiusPixels;
    expect(result.diagnostics.virtualPaddingPixels).toBe(Math.ceil(r + V7_SOFT_MASK_GROWTH_PIXELS));
    // The pad must genuinely exceed r so the dilated mask has room to grow into
    // real background instead of clamping at the pad edge.
    expect(result.diagnostics.virtualPaddingPixels).toBeGreaterThan(r);
  });
});

// ---------------------------------------------------------------------------
// Bounds expansion (assembled MeshDto bounds enclose out-of-texture vertices)
// ---------------------------------------------------------------------------

describe("v7 bounds expansion", () => {
  it("expands the MeshDto alpha bounds outside the original drawable bounds and encloses every vertex", () => {
    const width = 120;
    const height = 100;
    const meshBounds: RectDto = { x: 30, y: 40, width: 120, height: 100 };
    // Full-bleed opaque so the outline is pushed outside on every side.
    const generated = createGeneratedMeshForDrawable({
      session: createV7FixtureSession({
        textureSize: { width, height },
        meshBounds,
        opaquePixels: pixelsFromPredicate(width, height, () => true)
      }),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v7-margin-contour-rgba");
    const mesh = generated?.mesh;
    const alphaBounds = generated?.alphaBounds;
    expect(mesh).toBeDefined();
    expect(alphaBounds).toBeDefined();
    if (mesh === undefined || alphaBounds === undefined) {
      return;
    }

    // At least one vertex lies OUTSIDE the original drawable bounds rectangle
    // (the coverage margin extends past the texture edge into stage space).
    const outsideOriginal = mesh.vertices.some(
      (v) =>
        v.x < meshBounds.x ||
        v.y < meshBounds.y ||
        v.x > meshBounds.x + meshBounds.width ||
        v.y > meshBounds.y + meshBounds.height
    );
    expect(outsideOriginal).toBe(true);

    // The reported alpha bounds are expanded outside the original drawable
    // bounds (NOT clamped back to it — the decisive difference from v6d).
    const eps = 1e-6;
    const expandedOutside =
      alphaBounds.x < meshBounds.x - eps ||
      alphaBounds.y < meshBounds.y - eps ||
      alphaBounds.x + alphaBounds.width > meshBounds.x + meshBounds.width + eps ||
      alphaBounds.y + alphaBounds.height > meshBounds.y + meshBounds.height + eps;
    expect(expandedOutside).toBe(true);

    // Every vertex is enclosed by the expanded alpha bounds (pad-offset mapping
    // is internally consistent).
    for (const v of mesh.vertices) {
      expect(v.x).toBeGreaterThanOrEqual(alphaBounds.x - eps);
      expect(v.y).toBeGreaterThanOrEqual(alphaBounds.y - eps);
      expect(v.x).toBeLessThanOrEqual(alphaBounds.x + alphaBounds.width + eps);
      expect(v.y).toBeLessThanOrEqual(alphaBounds.y + alphaBounds.height + eps);
    }
  });

  it("leaves UVs UNclamped for vertices pushed outside the texture, bounded by the covering margin (Wave108 D-gen)", () => {
    const width = 120;
    const height = 100;
    const generated = createGeneratedMeshForDrawable({
      session: createV7FixtureSession({
        textureSize: { width, height },
        meshBounds: { x: 0, y: 0, width, height },
        opaquePixels: pixelsFromPredicate(width, height, () => true)
      }),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    const mesh = generated?.mesh;
    expect(mesh).toBeDefined();
    if (mesh === undefined) {
      return;
    }

    // Full-bleed => the outline is pushed outside the texture on every side.
    // With the clamp removed, UVs spill PAST [0,1] instead of pinning to 0/1.
    expect(mesh.uvs.some((uv) => uv.x < 0)).toBe(true);
    expect(mesh.uvs.some((uv) => uv.x > 1)).toBe(true);
    expect(mesh.uvs.some((uv) => uv.y < 0)).toBe(true);
    expect(mesh.uvs.some((uv) => uv.y > 1)).toBe(true);

    // The overshoot is BOUNDED by the covering margin (r plus the soft-mask growth
    // the dilation can add stays within the per-layer padding P =
    // maxCoverageMarginSourcePixels(size), i.e. r + soft-mask blur <= P), never a
    // wild value. +1px for rounding.
    const params = deriveV7Parameters({ textureWidth: width, textureHeight: height });
    const marginX = (params.marginRadiusPixels + V7_SOFT_MASK_GROWTH_PIXELS + 1) / width;
    const marginY = (params.marginRadiusPixels + V7_SOFT_MASK_GROWTH_PIXELS + 1) / height;
    for (const uv of mesh.uvs) {
      expect(uv.x).toBeGreaterThanOrEqual(-marginX);
      expect(uv.x).toBeLessThanOrEqual(1 + marginX);
      expect(uv.y).toBeGreaterThanOrEqual(-marginY);
      expect(uv.y).toBeLessThanOrEqual(1 + marginY);
    }
  });
});

// ---------------------------------------------------------------------------
// Density interval matches the new L (28/42/64) and stays monotone
// ---------------------------------------------------------------------------

describe("v7 boundary spacing tracks L", () => {
  it("has a median boundary spacing near each preset L, monotone across presets", () => {
    const width = 200;
    const height = 200;
    const isOpaque = (x: number, y: number): boolean => {
      const dx = x - 100;
      const dy = y - 100;
      return dx * dx + dy * dy <= 80 * 80;
    };

    const medianSpacing = (densityHint: "low" | "medium" | "high"): number => {
      const result = runPipeline({ width, height, isOpaque, densityHint });
      expect(result.status).toBe("generated");
      if (result.status !== "generated") {
        return Number.NaN;
      }

      const bp = result.boundaryPoints;
      const dists = bp
        .map((point, index) => {
          const next = bp[(index + 1) % bp.length]!;
          return Math.hypot(point.x - next.x, point.y - next.y);
        })
        .sort((a, b) => a - b);
      return dists[Math.floor(dists.length / 2)]!;
    };

    const high = medianSpacing("high");
    const medium = medianSpacing("medium");
    const low = medianSpacing("low");

    // Median spacing tracks L (=28/42/64) within a tolerance band. Resampling at
    // spacing L on a simplified loop gives spacings clustered around L (high
    // curvature adds a few slightly shorter segments), so assert each median is
    // in a generous [~0.5·L, ~1.2·L] window keyed to the new constants.
    expect(high).toBeGreaterThan(V7_VERTEX_SPACING_PIXELS.high * 0.5);
    expect(high).toBeLessThan(V7_VERTEX_SPACING_PIXELS.high * 1.2);
    expect(medium).toBeGreaterThan(V7_VERTEX_SPACING_PIXELS.medium * 0.5);
    expect(medium).toBeLessThan(V7_VERTEX_SPACING_PIXELS.medium * 1.2);
    expect(low).toBeGreaterThan(V7_VERTEX_SPACING_PIXELS.low * 0.5);
    expect(low).toBeLessThan(V7_VERTEX_SPACING_PIXELS.low * 1.2);

    // Monotone: denser preset => tighter spacing.
    expect(high).toBeLessThan(medium);
    expect(medium).toBeLessThan(low);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("v7 determinism", () => {
  it("produces identical vertices, triangles, and stableIds for identical input", () => {
    const session = () =>
      createV7FixtureSession({
        textureSize: { width: 40, height: 36 },
        meshBounds: { x: 10, y: 20, width: 40, height: 36 },
        opaquePixels: pixelsFromPredicate(40, 36, (x, y) => {
          const dx = x - 19;
          const dy = y - 17;
          return dx * dx + dy * dy <= 12 * 12;
        })
      });

    const first = createGeneratedMeshForDrawable({
      session: session(),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });
    const second = createGeneratedMeshForDrawable({
      session: session(),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    expect(first?.source).toBe("outline-v7-margin-contour-rgba");
    expect(first?.mesh.vertices).toEqual(second?.mesh.vertices);
    expect(first?.mesh.uvs).toEqual(second?.mesh.uvs);
    expect(first?.mesh.triangles).toEqual(second?.mesh.triangles);
    expect(first?.mesh.vertexStableIds).toEqual(second?.mesh.vertexStableIds);
    expect(first?.mesh.triangleStableIds).toEqual(second?.mesh.triangleStableIds);
  });
});

// ---------------------------------------------------------------------------
// Thin-region interior suppression
// ---------------------------------------------------------------------------

describe("v7 thin-region interior suppression", () => {
  it("places zero interior points in a strand thinner than R", () => {
    const width = 60;
    const height = 24;
    // A long horizontal strand 6px tall, kept away from the canvas edges so the
    // margin dilation (r=4px) leaves background above and below it. Even after
    // dilation the local width (~14px) stays below R (medium L=18px).
    const result = runPipeline({
      width,
      height,
      isOpaque: (x, y) => x >= 6 && x <= 53 && y >= 9 && y <= 14,
      densityHint: "medium"
    });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    expect(result.interiorPoints.length).toBe(0);
    expect(result.points.every((point) => point.role === "boundary")).toBe(true);
  });

  it("places interior points in a thick region wider than R", () => {
    const width = 60;
    const height = 60;
    const result = runPipeline({
      width,
      height,
      isOpaque: (x, y) => x >= 5 && x <= 54 && y >= 5 && y <= 54,
      densityHint: "high"
    });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    expect(result.interiorPoints.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Preset monotonicity of output (denser preset => more vertices)
// ---------------------------------------------------------------------------

describe("v7 preset output monotonicity", () => {
  it("gives more vertices for high than medium than low on the same blob", () => {
    const width = 64;
    const height = 64;
    const isOpaque = (x: number, y: number): boolean => {
      const dx = x - 31;
      const dy = y - 31;
      return dx * dx + dy * dy <= 26 * 26;
    };
    const high = runPipeline({ width, height, isOpaque, densityHint: "high" });
    const medium = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    const low = runPipeline({ width, height, isOpaque, densityHint: "low" });

    expect(high.status).toBe("generated");
    expect(medium.status).toBe("generated");
    expect(low.status).toBe("generated");
    if (high.status !== "generated" || medium.status !== "generated" || low.status !== "generated") {
      return;
    }

    expect(high.points.length).toBeGreaterThan(medium.points.length);
    expect(medium.points.length).toBeGreaterThan(low.points.length);
  });
});

// ---------------------------------------------------------------------------
// UV range and non-zero-area triangles
// ---------------------------------------------------------------------------

describe("v7 mesh validity", () => {
  it("keeps all UVs within the covering margin of [0,1] and every triangle non-zero-area", () => {
    const generated = createGeneratedMeshForDrawable({
      session: createV7FixtureSession({
        textureSize: { width: 48, height: 44 },
        meshBounds: { x: 4, y: 8, width: 48, height: 44 },
        opaquePixels: pixelsFromPredicate(48, 44, (x, y) => {
          const dx = x - 23;
          const dy = y - 21;
          return dx * dx + dy * dy <= 18 * 18;
        })
      }),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v7-margin-contour-rgba");
    const mesh = generated?.mesh;
    expect(mesh).toBeDefined();
    if (mesh === undefined) {
      return;
    }

    // Non-clamp (Wave108 D-gen): UVs may spill past [0,1] where the outline is
    // pushed outside the texture, but only by the covering margin (r plus
    // soft-mask growth stays within the per-layer padding P =
    // maxCoverageMarginSourcePixels(size), i.e. r + soft-mask blur <= P, +1px
    // rounding).
    const params = deriveV7Parameters({ textureWidth: 48, textureHeight: 44 });
    const marginX = (params.marginRadiusPixels + V7_SOFT_MASK_GROWTH_PIXELS + 1) / 48;
    const marginY = (params.marginRadiusPixels + V7_SOFT_MASK_GROWTH_PIXELS + 1) / 44;
    for (const uv of mesh.uvs) {
      expect(uv.x).toBeGreaterThanOrEqual(-marginX);
      expect(uv.x).toBeLessThanOrEqual(1 + marginX);
      expect(uv.y).toBeGreaterThanOrEqual(-marginY);
      expect(uv.y).toBeLessThanOrEqual(1 + marginY);
    }

    expect(mesh.vertices).toHaveLength(mesh.uvs.length);
    expect(mesh.vertices).toHaveLength(mesh.vertexStableIds.length);
    expect(mesh.triangleStableIds).toHaveLength(mesh.triangles.length);

    for (const [a, b, c] of mesh.triangles) {
      const pa = mesh.vertices[a]!;
      const pb = mesh.vertices[b]!;
      const pc = mesh.vertices[c]!;
      const signedArea = ((pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x)) / 2;
      expect(signedArea).not.toBe(0);
      expect(Math.abs(signedArea)).toBeGreaterThan(0);
    }
  });

  it("uses v7 stableId tokens", () => {
    const generated = createGeneratedMeshForDrawable({
      session: createV7FixtureSession({
        textureSize: { width: 40, height: 36 },
        meshBounds: { x: 0, y: 0, width: 40, height: 36 },
        opaquePixels: pixelsFromPredicate(40, 36, (x, y) => {
          const dx = x - 19;
          const dy = y - 17;
          return dx * dx + dy * dy <= 12 * 12;
        })
      }),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    const stableIds = generated?.mesh.vertexStableIds ?? [];
    expect(stableIds.some((id) => /^vtx_body_v7_boundary_\d+$/.test(id))).toBe(true);
    expect((generated?.mesh.triangleStableIds ?? []).every((id) => /^tri_body_v7_\d+$/.test(id))).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// Multi-island
// ---------------------------------------------------------------------------

describe("v7 multi-island", () => {
  it("meshes every valid island into one MeshDto with island-scoped stableIds", () => {
    const width = 60;
    const height = 30;
    // Two separate square islands.
    const isOpaque = (x: number, y: number): boolean =>
      (x >= 5 && x <= 20 && y >= 8 && y <= 22) || (x >= 38 && x <= 53 && y >= 8 && y <= 22);
    const generated = createGeneratedMeshForDrawable({
      session: createV7FixtureSession({
        textureSize: { width, height },
        meshBounds: { x: 0, y: 0, width, height },
        opaquePixels: pixelsFromPredicate(width, height, isOpaque)
      }),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    expect(generated?.source).toBe("outline-v7-margin-contour-rgba");
    const stableIds = generated?.mesh.vertexStableIds ?? [];
    const islandOrders = new Set(
      stableIds
        .map((id) => /_island_(\d+)_/.exec(id)?.[1])
        .filter((order): order is string => order !== undefined)
    );
    expect(islandOrders.size).toBeGreaterThanOrEqual(2);

    // Coverage of both islands: every opaque pixel is inside some triangle.
    const result = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    // Multi-island coverage is asserted end-to-end via the assembled mesh below.
    expect(result.status).toBe("generated");
    assertEveryOpaquePixelCoveredInStageMesh(generated?.mesh, {
      width,
      height,
      bounds: { x: 0, y: 0, width, height },
      isOpaque
    });
  });
});

// ---------------------------------------------------------------------------
// Hole filling
// ---------------------------------------------------------------------------

describe("v7 hole filling", () => {
  it("fills an interior hole (donut) so hole pixels are covered by the mesh", () => {
    const width = 44;
    const height = 44;
    const isOpaque = (x: number, y: number): boolean => {
      const dx = x - 21;
      const dy = y - 21;
      const r2 = dx * dx + dy * dy;
      return r2 <= 18 * 18 && r2 >= 7 * 7;
    };
    const result = runPipeline({ width, height, isOpaque, densityHint: "medium" });
    expect(result.status).toBe("generated");
    if (result.status !== "generated") {
      return;
    }

    // A hole pixel (centre of the donut) must be covered because holes are filled.
    const holeCovered = isPixelCoveredByPixelMesh(result, 21, 21);
    expect(holeCovered).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fallback chain
// ---------------------------------------------------------------------------

describe("v7 fallback", () => {
  it("falls back to the v6d-adaptive chain when the texture is empty, recording a v7 step", () => {
    const generated = createGeneratedMeshForDrawable({
      session: createV7FixtureSession({
        textureSize: { width: 16, height: 16 },
        meshBounds: { x: 0, y: 0, width: 16, height: 16 },
        opaquePixels: []
      }),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    expect(generated).toBeDefined();
    expect(generated?.source).not.toBe("outline-v7-margin-contour-rgba");
    expect(generated?.fallbackSteps?.[0]?.method).toBe("auto-outline-v7-margin-contour");
    expect(generated?.fallbackReason).toBe("v7-margin-contour-alpha-empty");
  });

  it("falls back when texture bytes are unavailable", () => {
    const generated = createGeneratedMeshForDrawable({
      session: createV7FixtureSession({
        textureSize: { width: 16, height: 16 },
        meshBounds: { x: 0, y: 0, width: 16, height: 16 },
        opaquePixels: pixelsFromPredicate(16, 16, (x, y) => x >= 4 && x <= 11 && y >= 4 && y <= 11),
        includeBytes: false
      }),
      drawableId: DRAWABLE_ID,
      provenanceId: PROVENANCE_ID,
      method: "auto-outline-v7-margin-contour",
      densityHint: "medium"
    });

    expect(generated).toBeDefined();
    expect(generated?.fallbackSteps?.[0]?.method).toBe("auto-outline-v7-margin-contour");
    expect(generated?.fallbackReason).toBe("texture-bytes-unavailable");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const runPipeline = (input: {
  readonly width: number;
  readonly height: number;
  readonly isOpaque: (x: number, y: number) => boolean;
  readonly densityHint: "low" | "medium" | "high";
}): V7PipelineResult =>
  probeV7MarginContourPipelineForTest({
    textureWidth: input.width,
    textureHeight: input.height,
    rgbaBytes: rgbaFromPredicate(input.width, input.height, input.isOpaque),
    densityHint: input.densityHint
  });

/**
 * Full-scan coverage assertion: EVERY opaque pixel centre must be inside some
 * triangle of the pixel-space mesh. Not sampled.
 */
function assertEveryOpaquePixelCovered(
  result: Extract<V7PipelineResult, { status: "generated" }>,
  width: number,
  height: number,
  isOpaque: (x: number, y: number) => boolean
): void {
  let uncovered = 0;
  let firstUncovered: { x: number; y: number } | undefined;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpaque(x, y)) {
        continue;
      }

      if (!isPixelCoveredByPixelMesh(result, x + 0.5, y + 0.5)) {
        uncovered += 1;
        firstUncovered ??= { x, y };
      }
    }
  }

  expect({ uncovered, firstUncovered }).toEqual({ uncovered: 0, firstUncovered: undefined });
}

function isPixelCoveredByPixelMesh(
  result: Extract<V7PipelineResult, { status: "generated" }>,
  px: number,
  py: number
): boolean {
  for (const triangle of result.triangles) {
    const a = result.points[triangle[0]]!;
    const b = result.points[triangle[1]]!;
    const c = result.points[triangle[2]]!;
    if (pointInTriangle({ x: px, y: py }, a, b, c)) {
      return true;
    }
  }

  return false;
}

function assertEveryOpaquePixelCoveredInStageMesh(
  mesh: MeshDto | undefined,
  input: {
    readonly width: number;
    readonly height: number;
    readonly bounds: RectDto;
    readonly isOpaque: (x: number, y: number) => boolean;
  }
): void {
  expect(mesh).toBeDefined();
  if (mesh === undefined) {
    return;
  }

  const toStage = (px: number, py: number): { x: number; y: number } => ({
    x: input.bounds.x + input.bounds.width * (px / input.width),
    y: input.bounds.y + input.bounds.height * (py / input.height)
  });

  let uncovered = 0;
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      if (!input.isOpaque(x, y)) {
        continue;
      }

      const stagePoint = toStage(x + 0.5, y + 0.5);
      const covered = mesh.triangles.some((triangle) => {
        const a = mesh.vertices[triangle[0]]!;
        const b = mesh.vertices[triangle[1]]!;
        const c = mesh.vertices[triangle[2]]!;
        return pointInTriangle(stagePoint, a, b, c);
      });
      if (!covered) {
        uncovered += 1;
      }
    }
  }

  expect(uncovered).toBe(0);
}

function pointInTriangle(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
): boolean {
  const d1 = sign(point, a, b);
  const d2 = sign(point, b, c);
  const d3 = sign(point, c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function sign(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function rgbaFromPredicate(
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (predicate(x, y)) {
        const index = (y * width + x) * 4;
        bytes[index] = 255;
        bytes[index + 1] = 255;
        bytes[index + 2] = 255;
        bytes[index + 3] = 255;
      }
    }
  }

  return bytes;
}

function pixelsFromPredicate(
  width: number,
  height: number,
  predicate: (x: number, y: number) => boolean
): readonly (readonly [number, number])[] {
  const pixels: [number, number][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (predicate(x, y)) {
        pixels.push([x, y]);
      }
    }
  }

  return pixels;
}

function createV7FixtureSession(input: {
  readonly textureSize: { readonly width: number; readonly height: number };
  readonly meshBounds: RectDto;
  readonly opaquePixels: readonly (readonly [number, number])[];
  readonly includeBytes?: boolean;
}): AuthoringSession {
  const includeBytes = input.includeBytes ?? true;
  const bytes = rgbaFromPredicate(input.textureSize.width, input.textureSize.height, (x, y) =>
    input.opaquePixels.some(([ox, oy]) => ox === x && oy === y)
  );

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_mesh_v7_test"),
      packageDisplayName: "Mesh v7 Test",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 128, height: 128 },
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DRAWABLE_ID]
        }
      ],
      drawables: [
        {
          drawableId: DRAWABLE_ID,
          displayName: "Body",
          partId: PartIdSchema.parse("part_root"),
          sourceAssetId: SourceAssetIdSchema.parse("src_body"),
          textureId: TextureIdSchema.parse("tex_body"),
          meshId: MESH_ID,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ],
      meshes: [
        {
          meshId: MESH_ID,
          drawableId: DRAWABLE_ID,
          vertices: [],
          uvs: [],
          triangles: [],
          vertexStableIds: [],
          triangleStableIds: [],
          topologyRevision: 0,
          bounds: input.meshBounds,
          generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        {
          drawableId: DRAWABLE_ID,
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      rigControlRootIds: [],
      stableOrder: ["draw_body"],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_body"),
            filePath: "assets/textures/body.raw-rgba",
            sourceAssetId: SourceAssetIdSchema.parse("src_body"),
            binaryAssetRef: {
              referenceKind: "package-binary-asset-ref-v1",
              binaryAssetId: "bin_body_rgba",
              packageRelativePath: "assets/textures/body.raw-rgba",
              digest: { algorithm: "sha256", hex: "0".repeat(64) },
              byteLength: bytes.byteLength,
              mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
              storageStatus: "stored-package-local-v1",
              provenanceId: ProvenanceIdSchema.parse("prov_body"),
              rightsAssetId: "rights_body"
            }
          }
        ]
      }
    },
    ...(includeBytes
      ? {
          binaryAssets: {
            fileEntries: [
              createPackageBinaryFileEntry({
                path: "assets/textures/body.raw-rgba",
                bytes,
                mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
                binaryAssetId: "bin_body_rgba"
              })
            ],
            binaryAssetIndex: {
              schemaVersion: "binary-asset-index-v1",
              assets: []
            },
            byteIntakeSummaries: []
          }
        }
      : {})
  };
}
