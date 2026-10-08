import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import {
  createPerceptionFixture,
  registerTextureBytesWithoutDimensions,
  registerTextureWithDimensions
} from "../test-support/perception-fixtures.js";
import { evaluatePerceptionSnapshot } from "./evaluation-adapter.js";
import { createPerceptionRenderScene } from "./render-scene-adapter.js";

/**
 * Mesh Wave 1.3 Domain G — perception (AI eye) content-inset UV remap.
 *
 * The perception software render samples the padded per-texture raster directly,
 * so content-space UV 0..1 must be remapped onto the content sub-rect of the
 * padded raster or every part's artwork appears inset toward its own bounds
 * centre by the padding P (`import-position-mismatch-investigation.md` H1). This
 * is the sister fix to editor Wave 1.2 F
 * (`apps/editor/src/workspace/canvas/canvas-render-scene-adapter.test.ts`); the
 * remap form is identical, but the perception adapter reads
 * `contentInset` + padded `dimensions` from the texture atlas ENTRY (via the
 * drawable's textureId) rather than from a projection drawable.
 *
 * These tests exercise the real `createPerceptionRenderScene` path over the
 * shared perception fixture: they register the eye texture with (or without)
 * padded dimensions, stamp a `contentInset` onto its atlas entry, then replace
 * the eye drawable's runtime-graph UVs with a known set so the remapped output is
 * numerically checkable. Everything is synthetic and rights-clean (no `ref/`).
 */

interface Vec2 {
  readonly x: number;
  readonly y: number;
}

interface Inset {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const eyeTextureIdOf = (session: AuthoringSession, drawableId: string): string => {
  const drawable = session.graph.drawables.find((entry) => entry.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`fixture drawable ${drawableId} missing`);
  }
  return drawable.textureId;
};

const setContentInset = (
  session: AuthoringSession,
  textureId: string,
  inset: Inset
): void => {
  const entry = session.graph.textureAtlas?.textures.find(
    (candidate) => candidate.textureId === textureId
  );
  if (entry === undefined) {
    throw new Error(`fixture texture entry ${textureId} missing`);
  }
  entry.contentInset = { ...inset };
};

const meshBoundsFor = (
  session: AuthoringSession,
  drawableId: string
): { readonly width: number; readonly height: number } => {
  const drawable = session.graph.drawables.find((entry) => entry.drawableId === drawableId);
  if (drawable === undefined) {
    throw new Error(`fixture drawable ${drawableId} missing`);
  }
  const mesh = session.graph.meshes.find((entry) => entry.meshId === drawable.meshId);
  if (mesh === undefined) {
    throw new Error(`fixture mesh for ${drawableId} missing`);
  }
  return { width: mesh.bounds.width, height: mesh.bounds.height };
};

const withReplacedUvs = (
  graph: NormalizedRuntimeGraph,
  drawableId: DrawableId,
  uvs: readonly Vec2[]
): NormalizedRuntimeGraph => {
  const drawables = new Map(graph.drawables);
  const original = drawables.get(drawableId);
  if (original === undefined) {
    throw new Error(`runtime graph drawable ${drawableId} missing`);
  }
  drawables.set(drawableId, {
    ...original,
    uvs: uvs.map((uv) => ({ x: uv.x, y: uv.y }))
  });
  return { ...graph, drawables };
};

interface RemapEyeUvsOptions {
  readonly uvs: readonly Vec2[];
  readonly contentInset?: Inset;
  readonly paddedDimensions?: { readonly width: number; readonly height: number };
  /** Register the eye texture WITHOUT declared dimensions (derived-verified rung). */
  readonly withoutDimensions?: boolean;
}

/**
 * Runs the real perception scene adapter for the eye drawable and returns its
 * remapped `mesh.uvs`. The eye texture is (re)registered so texture resolution
 * succeeds, `contentInset` is stamped onto its atlas entry when supplied, and the
 * eye drawable's runtime-graph UVs are replaced with `options.uvs`.
 */
const remapEyeUvs = (options: RemapEyeUvsOptions): readonly Vec2[] => {
  const { session, ids } = createPerceptionFixture();
  const eyeTextureId = eyeTextureIdOf(session, ids.eyeDrawableId);

  if (options.withoutDimensions === true) {
    const bounds = meshBoundsFor(session, ids.eyeDrawableId);
    registerTextureBytesWithoutDimensions(
      session,
      eyeTextureId,
      bounds.width * bounds.height * 4
    );
  } else if (options.paddedDimensions !== undefined) {
    registerTextureWithDimensions(session, eyeTextureId, options.paddedDimensions);
  }

  if (options.contentInset !== undefined) {
    setContentInset(session, eyeTextureId, options.contentInset);
  }

  const { graph, snapshot } = evaluatePerceptionSnapshot(session);
  const patchedGraph = withReplacedUvs(graph, ids.eyeDrawableId as DrawableId, options.uvs);
  const scene = createPerceptionRenderScene({ session, graph: patchedGraph, snapshot });

  const eye = scene.drawables.find((drawable) => drawable.drawableId === ids.eyeDrawableId);
  if (eye === undefined) {
    throw new Error("eye drawable missing from render scene");
  }
  return eye.mesh.uvs;
};

describe("perception render scene adapter — content-inset UV remap (Mesh Wave 1.3 G)", () => {
  it("remaps content-space UV onto the padded raster content sub-rect for a triangle mesh", () => {
    const PADDED = 28;
    const PADDING = 4;
    const uvs = remapEyeUvs({
      paddedDimensions: { width: PADDED, height: PADDED },
      contentInset: { left: PADDING, top: PADDING, right: PADDING, bottom: PADDING },
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    });

    // u' = (P + u·(PADDED − 2P)) / PADDED = (4 + u·20) / 28
    const low = PADDING / PADDED; // 4/28
    const high = (PADDED - PADDING) / PADDED; // 24/28
    expect(uvs[0]?.x).toBeCloseTo(low, 12);
    expect(uvs[0]?.y).toBeCloseTo(low, 12);
    expect(uvs[1]?.x).toBeCloseTo(high, 12);
    expect(uvs[1]?.y).toBeCloseTo(low, 12);
    expect(uvs[2]?.x).toBeCloseTo(low, 12);
    expect(uvs[2]?.y).toBeCloseTo(high, 12);
  });

  it("applies each inset side independently under the atlas contentUvRect formula (asymmetric inset, non-square raster)", () => {
    const inset = { left: 3, top: 5, right: 7, bottom: 9 };
    const raster = { width: 40, height: 60 };
    const uvs = remapEyeUvs({
      paddedDimensions: raster,
      contentInset: inset,
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 }
      ]
    });

    const contentW = raster.width - inset.left - inset.right; // 30
    const contentH = raster.height - inset.top - inset.bottom; // 46
    const remapX = (u: number): number => (inset.left + u * contentW) / raster.width;
    const remapY = (v: number): number => (inset.top + v * contentH) / raster.height;
    expect(uvs[0]?.x).toBeCloseTo(remapX(0), 12); // 3/40
    expect(uvs[0]?.y).toBeCloseTo(remapY(0), 12); // 5/60
    expect(uvs[1]?.x).toBeCloseTo(remapX(1), 12); // 33/40
    expect(uvs[1]?.y).toBeCloseTo(remapY(0), 12);
    expect(uvs[2]?.x).toBeCloseTo(remapX(1), 12);
    expect(uvs[2]?.y).toBeCloseTo(remapY(1), 12); // 51/60
  });

  it("does not clamp content UV outside [0,1] — covering-margin overshoot maps linearly", () => {
    const PADDED = 28;
    const PADDING = 4;
    const uvs = remapEyeUvs({
      paddedDimensions: { width: PADDED, height: PADDED },
      contentInset: { left: PADDING, top: PADDING, right: PADDING, bottom: PADDING },
      // Covering-margin overshoot: content UVs below 0 and above 1.
      uvs: [
        { x: -0.3, y: -0.3 },
        { x: 1.3, y: -0.3 },
        { x: 1.3, y: 1.3 }
      ]
    });

    const contentW = PADDED - PADDING * 2; // 20
    const remap = (t: number): number => (PADDING + t * contentW) / PADDED;
    // u=-0.3 → (4 + (−0.3)·20)/28 = −2/28 ≈ −0.0714 — stays negative, NOT clamped to 0.
    expect(uvs[0]?.x).toBeCloseTo(remap(-0.3), 12);
    expect(uvs[0]?.x).toBeLessThan(0);
    expect(uvs[0]?.y).toBeCloseTo(remap(-0.3), 12);
    expect(uvs[0]?.y).toBeLessThan(0);
    // u=1.3 → (4 + 1.3·20)/28 = 30/28 ≈ 1.0714 — stays above 1, NOT clamped.
    expect(uvs[1]?.x).toBeCloseTo(remap(1.3), 12);
    expect(uvs[1]?.x).toBeGreaterThan(1);
    expect(uvs[2]?.y).toBeCloseTo(remap(1.3), 12);
    expect(uvs[2]?.y).toBeGreaterThan(1);
  });

  it("places the content sub-rect so it fills the content dimension exactly (position semantics — H1 corrected)", () => {
    // Position semantics via an independent invariant (NOT a copy of the remap
    // formula): a bounds quad (content edges at UV 0 and 1 pre-remap) must sample
    // exactly the content sub-rect [inset, PADDED−inset] of the padded raster, so
    // the remapped content span in raster pixels equals the CONTENT dimension —
    // the artwork fills its content bounds with no residual padding offset.
    const PADDED = 34;
    const PADDING = 7; // larger P, like the topwear/hair layers in the investigation
    const CONTENT = PADDED - PADDING * 2; // 20
    const uvs = remapEyeUvs({
      paddedDimensions: { width: PADDED, height: PADDED },
      contentInset: { left: PADDING, top: PADDING, right: PADDING, bottom: PADDING },
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ]
    });

    // Independent invariant: the min/max of the remapped bounds-quad UVs span
    // exactly the content sub-rect, and that span measured in raster pixels equals
    // the content dimension (= paddedW − insetLeft − insetRight). Were the remap
    // absent (H1), the span would be the full padded raster (PADDED px), not
    // CONTENT.
    const xs = uvs.map((uv) => uv.x);
    const ys = uvs.map((uv) => uv.y);
    const spanX = (Math.max(...xs) - Math.min(...xs)) * PADDED;
    const spanY = (Math.max(...ys) - Math.min(...ys)) * PADDED;
    expect(spanX).toBeCloseTo(CONTENT, 12);
    expect(spanY).toBeCloseTo(CONTENT, 12);
    // The content sub-rect is centred inside the padded raster (equal inset both
    // sides): its left edge sits P px in, not at the raster origin.
    expect(Math.min(...xs) * PADDED).toBeCloseTo(PADDING, 12);
    expect(Math.max(...xs) * PADDED).toBeCloseTo(PADDED - PADDING, 12);
  });

  it("leaves content UV unchanged when contentInset is absent (legacy back-compat)", () => {
    const uvs = remapEyeUvs({
      // No contentInset: legacy per-texture entry (raster ≡ content). Keep the
      // fixture's default declared dimensions.
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    });

    expect(uvs).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]);
  });

  it("leaves content UV unchanged when contentInset is all-zero (back-compat)", () => {
    const uvs = remapEyeUvs({
      paddedDimensions: { width: 20, height: 20 },
      contentInset: { left: 0, top: 0, right: 0, bottom: 0 },
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    });

    expect(uvs).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]);
  });

  it("leaves content UV unchanged when the atlas entry declares no dimensions (back-compat)", () => {
    // Dimensions are resolved via the derived-verified rung, but the atlas ENTRY
    // carries no `dimensions`, so the remap has no padded raster to map onto and
    // must keep the content UVs untouched.
    const uvs = remapEyeUvs({
      withoutDimensions: true,
      contentInset: { left: 4, top: 4, right: 4, bottom: 4 },
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    });

    expect(uvs).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]);
  });

  it("leaves content UV unchanged when the inset is malformed (content span ≤ 0 — defensive)", () => {
    // insetLeft + insetRight ≥ paddedWidth → contentWidth ≤ 0: the guard keeps the
    // legacy content UVs rather than producing a negative / NaN sub-rect.
    const uvs = remapEyeUvs({
      paddedDimensions: { width: 28, height: 28 },
      contentInset: { left: 20, top: 2, right: 20, bottom: 2 },
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 }
      ]
    });

    expect(uvs).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ]);
  });
});
