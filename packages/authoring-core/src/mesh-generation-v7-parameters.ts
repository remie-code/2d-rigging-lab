/**
 * v7 "commercial-like" mesh generation parameters.
 *
 * The v7 pipeline (see concept-design.md §2) is driven by three parameters that
 * derive from one another, so the three target output characteristics (a
 * margin-padded simplified outline, sparse vertices, and coarse wrapping of fine
 * detail) fall out of a single knob the user controls: the vertex spacing L.
 *
 * All numbers below are ENGINEERING STARTING POINTS. concept-design.md §2.5
 * states that the initial values are a starting point to be tuned in the
 * evaluation phase (world-visual gate); they are named constants with rationale
 * here specifically so that tuning is a single-site edit and never a magic
 * number hunt. Do not inline these values elsewhere.
 */

import { clamp } from "./mesh-geometry/geometry-primitives.js";
import type { MeshDensityHint } from "./mesh-generation-contract.js";

/**
 * Dilation radius r, expressed as a fraction of the larger texture dimension.
 *
 * The whole v7 design rests on first fattening the silhouette by r so that the
 * outline sits OUTSIDE the artwork by r (constructive coverage guarantee, §3).
 * 0.012 of the long edge gives a visually small but non-trivial margin that
 * merges neighbouring hair strands and fills micro-notches (feature 3) without
 * ballooning small parts. Clamped to a pixel floor/ceiling so tiny textures
 * still get a usable margin and huge textures do not get an absurd one.
 */
export const V7_MARGIN_RADIUS_TEXTURE_FRACTION = 0.012;
export const V7_MARGIN_RADIUS_MIN_PIXELS = 4;
export const V7_MARGIN_RADIUS_MAX_PIXELS = 16;

/**
 * Douglas-Peucker tolerance ε as a fraction of r.
 *
 * §3 "ε < r coupling rule": simplification may cut the outline inward by at
 * most ε, but the outline is r outside the artwork, so as long as ε < r the
 * coverage guarantee is preserved. 0.8 keeps a safety band (0.2·r) between the
 * simplified outline and the true silhouette. ε and the margin are therefore
 * NOT independent knobs — one guarantees the other's safety.
 */
export const V7_SIMPLIFY_EPSILON_RADIUS_FRACTION = 0.8;

/**
 * Vertex spacing L (== interior spacing R) per preset, in pixels.
 *
 * This is the ONLY parameter the three user presets move (§2.5). "Large motion"
 * wants smooth bending under large deformation, so it is the densest (smallest
 * L, "moves a lot"); "low motion" spends no vertices on parts that barely move
 * (largest L, "barely moves").
 *
 * Values 28 / 42 / 64 px were confirmed by the user in the world-visual
 * evaluation gate, round-trip 1 (2026-07-07): the previous 12 / 18 / 28 px
 * output read as too dense (the old "low" density looked appropriate for the
 * new "high"), so the whole band was shifted one step coarser. See
 * evaluation-log.md round-trip 1 and concept-design.md §2.5. The high < medium <
 * low monotonicity (denser preset => smaller L) is preserved; r and ε are
 * unchanged (r = clamp(0.012·longEdge, 4, 16), ε = 0.8·r).
 */
export const V7_VERTEX_SPACING_PIXELS: Readonly<Record<MeshDensityHint, number>> = {
  high: 28,
  medium: 42,
  low: 64
} as const;

/**
 * Interior points are not placed within R/2 of the boundary (§3 exclusion rule
 * (a)) to avoid squashed triangles. Expressed as a fraction of R.
 */
export const V7_INTERIOR_BOUNDARY_CLEARANCE_SPACING_FRACTION = 0.5;

/**
 * A local region whose width is below R is "thin" (§3 exclusion rule (b)): no
 * interior point is placed there, so hair tips / thin strands are covered by a
 * few long thin triangles between boundary vertices only. The local width is
 * measured deterministically by a chamfer distance transform (twice the
 * distance-to-background at a candidate pixel is its local width).
 */
export const V7_THIN_REGION_WIDTH_SPACING_FRACTION = 1;

/**
 * Upper bounds on vertex counts. These are safety caps to keep the CDT bounded
 * on pathological inputs, not the primary density control (L is). Generous
 * relative to the intended sparse output.
 */
export const V7_MAX_BOUNDARY_VERTICES = 512;
export const V7_MAX_INTERIOR_VERTICES = 2048;

/**
 * Lloyd relaxation of interior points only (boundary fixed), re-triangulating
 * each pass. §2.4 asks for 2-3 passes; 2 is a deterministic, cheap choice that
 * noticeably regularises interior spacing without materially changing counts.
 */
export const V7_LLOYD_RELAXATION_PASSES = 2;

/**
 * The mask-expansion ceiling passed to the neutral expandMask helper. v7
 * deliberately lifts the v6 8px clamp (§2) so the full computed r can be
 * applied; the value here is the widest r we ever request (max pixel ceiling).
 */
export const V7_MAX_MASK_EXPANSION_PIXELS = V7_MARGIN_RADIUS_MAX_PIXELS;

/**
 * Extra soft-mask growth, in pixels, that the binarisation stage can add BEYOND
 * the dilation radius r before the pad ceiling is computed.
 *
 * The working space is padded all around by pad = ⌈r + softMaskGrowth⌉ (§2.1,
 * "the dilation/smoothing must not clamp at the canvas edge"). r accounts for
 * the explicit dilation, but createSoftAlphaMask (alpha-mask.ts) can already
 * push the opaque region a little further outward before dilation: its 3×3
 * weighted blur (blurAlphaAt, kernel radius 1) can turn on a background pixel
 * one step out via the soft alpha threshold, and closeSinglePixelCracks (3×3,
 * radius 1) can fill one more. Two pixels of growth is a safe upper bound for
 * that pre-dilation spread, so the padded canvas never runs out of room for the
 * expanded mask to grow into and the outline never abuts the pad edge.
 */
export const V7_SOFT_MASK_GROWTH_PIXELS = 2;

/**
 * The all-around virtual padding (in pixels) applied to the working canvas so
 * mask expansion never clamps at the original texture edge (§2.1 / §3
 * "non-clamped dilation", evaluation-log.md round-trip 1). pad = ⌈r +
 * softMaskGrowth⌉. r is already an integer here (rounded in deriveV7Parameters),
 * so ⌈⌉ is a no-op, but Math.ceil is kept for intent and robustness. Vertices
 * that land in the pad region map to stage coordinates OUTSIDE the original
 * drawable bounds (that is the whole point) and their UVs clamp to [0,1].
 */
export const deriveV7VirtualPaddingPixels = (marginRadiusPixels: number): number =>
  Math.ceil(marginRadiusPixels + V7_SOFT_MASK_GROWTH_PIXELS);

export interface V7DerivedParameters {
  /** Dilation radius r in pixels (rounded to an integer number of dilations). */
  readonly marginRadiusPixels: number;
  /** Douglas-Peucker tolerance ε in pixels. */
  readonly simplifyEpsilon: number;
  /** Boundary vertex spacing L in pixels. */
  readonly vertexSpacing: number;
  /** Interior point spacing R in pixels (== L). */
  readonly interiorSpacing: number;
  /** Interior clearance from boundary (R/2) in pixels. */
  readonly interiorBoundaryClearance: number;
  /** Minimum local width to place an interior point (== R) in pixels. */
  readonly thinRegionWidthThreshold: number;
  readonly maxBoundaryVertices: number;
  readonly maxInteriorVertices: number;
  readonly lloydRelaxationPasses: number;
}

const resolveDensityHint = (densityHint: MeshDensityHint | undefined): MeshDensityHint =>
  densityHint ?? "medium";

/**
 * Derive the concrete v7 pipeline parameters from a density preset and texture
 * size. Fully deterministic: identical inputs yield identical outputs.
 */
export const deriveV7Parameters = (input: {
  readonly densityHint?: MeshDensityHint;
  readonly textureWidth: number;
  readonly textureHeight: number;
}): V7DerivedParameters => {
  const densityHint = resolveDensityHint(input.densityHint);
  const longEdge = Math.max(Math.round(input.textureWidth), Math.round(input.textureHeight));
  const marginRadiusPixels = Math.round(
    clamp(
      V7_MARGIN_RADIUS_TEXTURE_FRACTION * longEdge,
      V7_MARGIN_RADIUS_MIN_PIXELS,
      V7_MARGIN_RADIUS_MAX_PIXELS
    )
  );
  const simplifyEpsilon = V7_SIMPLIFY_EPSILON_RADIUS_FRACTION * marginRadiusPixels;
  const vertexSpacing = V7_VERTEX_SPACING_PIXELS[densityHint];
  const interiorSpacing = vertexSpacing;

  return {
    marginRadiusPixels,
    simplifyEpsilon,
    vertexSpacing,
    interiorSpacing,
    interiorBoundaryClearance: interiorSpacing * V7_INTERIOR_BOUNDARY_CLEARANCE_SPACING_FRACTION,
    thinRegionWidthThreshold: interiorSpacing * V7_THIN_REGION_WIDTH_SPACING_FRACTION,
    maxBoundaryVertices: V7_MAX_BOUNDARY_VERTICES,
    maxInteriorVertices: V7_MAX_INTERIOR_VERTICES,
    lloydRelaxationPasses: V7_LLOYD_RELAXATION_PASSES
  };
};
