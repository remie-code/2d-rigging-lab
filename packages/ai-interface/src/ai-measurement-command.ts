import {
  DrawableIdSchema,
  ParameterIdSchema,
  RectDtoSchema,
  RigControlIdSchema,
  Vec2DtoSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

/**
 * Zod schemas for the `inspectEvaluatedGeometry` measurement command (Wave104
 * Domain C, §3.3).
 *
 * This is a pure-zod contract module: it declares only the request payload and
 * the response result. It imports NO renderer / runtime-core / filesystem
 * dependency. The concrete measurement (session evaluation via the shared
 * perception adapter + evaluated-bounds helpers) lives in the authoring-host,
 * exactly like `renderView`/`validatePackage`, so ai-interface never gains a
 * renderer or evaluation dependency.
 *
 * Purpose: return the NUMBERS a spatial judgement needs (evaluated bounding
 * boxes, optionally evaluated vertices, and — for warp rig controls — evaluated
 * lattice control-point coordinates) so image-space observation never has to
 * substitute for a measurement (§3.2 Forbidden: "視覚判定に必要な数値を画像目測
 * で代替させる設計").
 */

/**
 * A single measurement target: either a drawable or a rig control, referenced by
 * its id. `kind` discriminates the two so the result can be matched back
 * unambiguously.
 */
export const InspectGeometryTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("drawable"),
    drawableId: DrawableIdSchema
  }),
  z.object({
    kind: z.literal("rigControl"),
    rigControlId: RigControlIdSchema
  })
]);
export type InspectGeometryTarget = z.infer<typeof InspectGeometryTargetSchema>;

export const InspectEvaluatedGeometryPayloadSchema = z.object({
  /** The drawables / rig controls to measure. Must be non-empty. */
  targets: z.array(InspectGeometryTargetSchema).min(1),
  /** Pose to evaluate at. Empty (default) evaluates the rest pose. */
  parameterOverrides: z.record(ParameterIdSchema, z.number().finite()).default({}),
  /**
   * When true, drawable results also carry their evaluated per-vertex
   * coordinates (from the `full`-detail snapshot). Off by default because the
   * vertex arrays can be large.
   */
  includeVertices: z.boolean().default(false)
});
export type InspectEvaluatedGeometryPayload = z.infer<
  typeof InspectEvaluatedGeometryPayloadSchema
>;

/**
 * Result for a single drawable target.
 *  - `found=false`: no such drawable in the evaluated snapshot (bounds omitted).
 *  - `found=true`: `bounds` is the evaluated stage-space bounding box; `vertices`
 *    is present only when `includeVertices` was requested and the snapshot
 *    carried full-detail vertices.
 */
export const InspectDrawableGeometryResultSchema = z.object({
  kind: z.literal("drawable"),
  drawableId: DrawableIdSchema,
  found: z.boolean(),
  bounds: RectDtoSchema.optional(),
  vertices: z.array(Vec2DtoSchema).optional()
});
export type InspectDrawableGeometryResult = z.infer<
  typeof InspectDrawableGeometryResultSchema
>;

/**
 * Result for a single rig-control target.
 *  - `found=false`: no such rig control in the evaluated snapshot.
 *  - `found=true`: `bounds` is the evaluated region (for warp controls this is
 *    the domain bounds; for rotation controls the evaluated transform region),
 *    when the control evaluated to a finite region. `evaluatedControlPoints` is
 *    present only for `kind === "warpLattice2d"` controls and carries the
 *    ABSOLUTE evaluated lattice control-point coordinates
 *    (`restControlPoints[i] + evaluated offset[i]`), in `restControlPoints`
 *    order. At rest the offsets are zero so these equal the rest control points;
 *    keyform-driven offsets move them off rest.
 */
export const InspectRigControlGeometryResultSchema = z.object({
  kind: z.literal("rigControl"),
  rigControlId: RigControlIdSchema,
  found: z.boolean(),
  rigControlKind: z.enum(["rotation2d", "warpLattice2d"]).optional(),
  evaluationStatus: z
    .enum(["evaluated", "disabled", "unsupported", "blocked"])
    .optional(),
  bounds: RectDtoSchema.optional(),
  evaluatedControlPoints: z.array(Vec2DtoSchema).optional()
});
export type InspectRigControlGeometryResult = z.infer<
  typeof InspectRigControlGeometryResultSchema
>;

export const InspectGeometryTargetResultSchema = z.discriminatedUnion("kind", [
  InspectDrawableGeometryResultSchema,
  InspectRigControlGeometryResultSchema
]);
export type InspectGeometryTargetResult = z.infer<
  typeof InspectGeometryTargetResultSchema
>;

export const InspectEvaluatedGeometryResultSchema = z.object({
  schemaVersion: z.literal("inspect-evaluated-geometry-result-v1"),
  packageRevision: z.number().int().nonnegative(),
  /** Echo of the resolved parameter overrides used, sorted by parameterId. */
  parameterOverrides: z.array(
    z.object({
      parameterId: ParameterIdSchema,
      value: z.number().finite()
    })
  ),
  /** One result per requested target, in request order. */
  results: z.array(InspectGeometryTargetResultSchema)
});
export type InspectEvaluatedGeometryResult = z.infer<
  typeof InspectEvaluatedGeometryResultSchema
>;
