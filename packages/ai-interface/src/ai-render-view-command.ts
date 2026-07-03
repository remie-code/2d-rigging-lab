import { ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import {
  ResolvedVariantSelectionEntrySchema,
  VariantSelectionsPayloadSchema
} from "./ai-variant-selection.js";

/**
 * Zod schemas for the `renderView` perception command (Wave104 Domain A).
 *
 * This module is intentionally dependency-clean: it declares only the request
 * payload, the response result, and the machine-readable sidecar shape. It does
 * NOT import render-core / render-software / runtime-core. The concrete render
 * implementation (session evaluation, RenderScene assembly, rasterization, PNG
 * and sidecar file output) lives in the authoring-host, so ai-interface never
 * gains a renderer or filesystem dependency.
 */

/**
 * Explicit stage rectangle to render. Coordinates are in stage (model) space,
 * matching render-software's `StageViewportRect`.
 */
export const RenderViewStageViewportSchema = z.object({
  minX: z.number().finite(),
  minY: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive()
});
export type RenderViewStageViewport = z.infer<typeof RenderViewStageViewportSchema>;

/**
 * The three supported framing modes:
 *  - `modelBounds`: frame the union of every drawable's evaluated bounds.
 *  - `stageViewport`: an explicit stage rectangle.
 *  - `drawableFocus`: frame one drawable's evaluated bbox, expanded by
 *    `marginRatio` on every side.
 */
export const RenderViewSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("modelBounds")
  }),
  z.object({
    kind: z.literal("stageViewport"),
    stageViewport: RenderViewStageViewportSchema
  }),
  z.object({
    kind: z.literal("drawableFocus"),
    drawableId: z.string().min(1),
    marginRatio: z.number().finite().nonnegative().default(0.1)
  })
]);
export type RenderViewSpec = z.infer<typeof RenderViewSpecSchema>;

/** Parameter sweep for contact-sheet generation. */
export const RenderViewSweepSchema = z.object({
  parameterId: ParameterIdSchema,
  steps: z.number().int().min(2).max(64)
});
export type RenderViewSweep = z.infer<typeof RenderViewSweepSchema>;

export const RenderViewPayloadSchema = z.object({
  parameterOverrides: z.record(ParameterIdSchema, z.number().finite()).default({}),
  view: RenderViewSpecSchema.optional(),
  outputWidth: z.number().int().min(1).max(8192).optional(),
  outputHeight: z.number().int().min(1).max(8192).optional(),
  sweep: RenderViewSweepSchema.optional(),
  /**
   * Optional per-group active Variant selection (Wave105 §3.1). Omitted →
   * every Variant Group resolves to its `defaultActive`. Present → the named
   * groups use the given selection while the perception visibility gate is
   * applied at the snapshot level (base visible AND variant predicate). Unknown
   * group / variant references or a mode mismatch are rejected deterministically
   * by the host resolver.
   */
  variantSelections: VariantSelectionsPayloadSchema,
  outDir: z.string().min(1),
  /** Base filename (without extension) for produced artifacts. */
  outputName: z.string().min(1).default("render")
});
export type RenderViewPayload = z.infer<typeof RenderViewPayloadSchema>;

/**
 * Resolved view transform recorded in the sidecar. Mirrors render-software's
 * `ResolvedSoftwareRenderView` so a reader can translate image pixels to stage
 * coordinates without re-deriving the transform.
 */
export const RenderViewResolvedViewSchema = z.object({
  stageViewport: RenderViewStageViewportSchema,
  outputWidth: z.number().int().positive(),
  outputHeight: z.number().int().positive(),
  pixelsPerStageX: z.number().finite().positive(),
  pixelsPerStageY: z.number().finite().positive()
});
export type RenderViewResolvedView = z.infer<typeof RenderViewResolvedViewSchema>;

/** One resolved (parameterId, value) override, sorted by parameterId. */
export const RenderViewResolvedOverrideSchema = z.object({
  parameterId: ParameterIdSchema,
  value: z.number().finite()
});
export type RenderViewResolvedOverride = z.infer<typeof RenderViewResolvedOverrideSchema>;

/** One contact-sheet cell mapping (grid position and swept parameter value). */
export const RenderViewSweepCellSchema = z.object({
  cellIndex: z.number().int().nonnegative(),
  column: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  parameterId: ParameterIdSchema,
  parameterValue: z.number().finite()
});
export type RenderViewSweepCell = z.infer<typeof RenderViewSweepCellSchema>;

export const RenderViewSweepLayoutSchema = z.object({
  parameterId: ParameterIdSchema,
  steps: z.number().int().positive(),
  columns: z.number().int().positive(),
  rows: z.number().int().positive(),
  cellWidth: z.number().int().positive(),
  cellHeight: z.number().int().positive(),
  cells: z.array(RenderViewSweepCellSchema)
});
export type RenderViewSweepLayout = z.infer<typeof RenderViewSweepLayoutSchema>;

/**
 * How a texture's pixel dimensions were established (§3.4 revised 2026-07-03):
 *  - `declared`: the texture entry's explicit `dimensions`.
 *  - `derived-verified`: derived from authoritative package boundary
 *    information (e.g. the referencing drawable's rest mesh bounds) and adopted
 *    only because `byteLength === width*height*4` held exactly.
 * Recorded per texture so a derivation is never silent.
 */
export const RenderViewTextureDimensionSourceSchema = z.object({
  textureId: z.string().min(1),
  dimensionSource: z.enum(["declared", "derived-verified"]),
  width: z.number().int().positive(),
  height: z.number().int().positive()
});
export type RenderViewTextureDimensionSource = z.infer<
  typeof RenderViewTextureDimensionSourceSchema
>;

/**
 * Machine-readable sidecar produced next to every PNG. It records everything a
 * reader needs to (a) confirm the image is not stale (packageRevision) and (b)
 * translate image-space observations into model-space operations.
 */
export const RenderViewSidecarSchema = z.object({
  schemaVersion: z.literal("render-view-sidecar-v1"),
  packagePath: z.string().min(1),
  packageId: z.string().min(1),
  packageRevision: z.number().int().nonnegative(),
  pngPath: z.string().min(1),
  parameterOverrides: z.array(RenderViewResolvedOverrideSchema),
  resolvedView: RenderViewResolvedViewSchema,
  sweep: RenderViewSweepLayoutSchema.optional(),
  /**
   * Per-texture dimension-source records (sorted by textureId). Optional so
   * pre-revision sidecars still parse; producers always emit it.
   */
  textureDimensionSources: z.array(RenderViewTextureDimensionSourceSchema).optional(),
  /**
   * The RESOLVED active Variant selection the visibility gate used, one entry
   * per Variant Group, sorted by `variantGroupId`. This records "which outfit
   * this photo was taken in" (Wave105 §3.1). Empty array when the package has no
   * Variant Groups. Optional so pre-revision sidecars still parse; producers
   * always emit it (empty array included).
   */
  variantSelections: z.array(ResolvedVariantSelectionEntrySchema).optional()
});
export type RenderViewSidecar = z.infer<typeof RenderViewSidecarSchema>;

export const RenderViewResultSchema = z.object({
  schemaVersion: z.literal("render-view-result-v1"),
  packageRevision: z.number().int().nonnegative(),
  pngPath: z.string().min(1),
  sidecarPath: z.string().min(1),
  outputWidth: z.number().int().positive(),
  outputHeight: z.number().int().positive(),
  sidecar: RenderViewSidecarSchema
});
export type RenderViewResult = z.infer<typeof RenderViewResultSchema>;
