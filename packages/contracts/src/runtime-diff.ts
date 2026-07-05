import { z } from "zod";

import { DiagnosticSchema } from "./diagnostics.js";
import { FieldChangeSchema } from "./field-change.js";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  ParameterIdSchema,
  RigControlIdSchema,
  RuntimeSnapshotIdSchema
} from "./ids.js";
import {
  WarpLattice2dBindSpaceSchema,
  WarpLattice2dControlPointOrderSchema,
  WarpLattice2dDomainBoundsSchema,
  WarpLattice2dInterpolationMethodSchema,
  WarpLattice2dOutsideDomainPolicySchema
} from "./warp-lattice2d.js";

const DrawableRuntimeStateChangeSchema = z.object({
  drawableId: DrawableIdSchema,
  opacityBefore: z.number().min(0).max(1),
  opacityAfter: z.number().min(0).max(1),
  visibleBefore: z.boolean(),
  visibleAfter: z.boolean(),
  baseDrawOrderBefore: z.number().int(),
  baseDrawOrderAfter: z.number().int(),
  evaluatedDrawOrderBefore: z.number().int(),
  evaluatedDrawOrderAfter: z.number().int()
});

const DrawListPositionChangeSchema = z.object({
  drawableId: DrawableIdSchema,
  beforeIndex: z.number().int().nonnegative().optional(),
  afterIndex: z.number().int().nonnegative().optional()
});

const DrawListChangeSchema = z.object({
  before: z.array(DrawableIdSchema),
  after: z.array(DrawableIdSchema),
  membershipChanged: z.boolean(),
  orderChanged: z.boolean(),
  positionChanges: z.array(DrawListPositionChangeSchema).default([])
});

const WarpLattice2dRuntimeChangeSchema = z.object({
  kind: z.literal("warpLattice2d"),
  rigControlId: RigControlIdSchema,
  evaluationStatus: z.enum(["evaluated", "disabled", "blocked", "unsupported"]),
  bindSpace: WarpLattice2dBindSpaceSchema,
  domainBounds: WarpLattice2dDomainBoundsSchema,
  interpolationMethod: WarpLattice2dInterpolationMethodSchema,
  controlPointOrder: WarpLattice2dControlPointOrderSchema,
  controlPointOffsetCount: z.number().int().min(4),
  outsideDomainPolicy: WarpLattice2dOutsideDomainPolicySchema,
  affectedDrawableIds: z.array(DrawableIdSchema).default([]),
  boundsChanged: z.boolean(),
  vertexHashBefore: z.string().optional(),
  vertexHashAfter: z.string().optional(),
  fullVertexDeltaRef: z.string().optional()
});

const RigControlRuntimeChangeSchema = z.discriminatedUnion("kind", [
  WarpLattice2dRuntimeChangeSchema
]);

export const RuntimeDiffSchema = z.object({
  schemaVersion: z.literal("runtime-diff-v1"),
  beforeSnapshotId: RuntimeSnapshotIdSchema,
  afterSnapshotId: RuntimeSnapshotIdSchema,
  parameterChanges: z.array(FieldChangeSchema).default([]),
  dynamicsChanges: z
    .array(
      z.object({
        dynamicsGroupId: DynamicsGroupIdSchema,
        outputParameterId: ParameterIdSchema.optional(),
        stateChanged: z.boolean(),
        outputChanged: z.boolean(),
        // World-frame chain state summary (design §5): particle count, max particle
        // speed [cm/s], and the tip segment's local angle [deg].
        particleCountBefore: z.number().int().nonnegative().optional(),
        particleCountAfter: z.number().int().nonnegative().optional(),
        maxParticleSpeedBefore: z.number().finite().optional(),
        maxParticleSpeedAfter: z.number().finite().optional(),
        tipAngleLocalDegBefore: z.number().finite().optional(),
        tipAngleLocalDegAfter: z.number().finite().optional(),
        outputOffsetBefore: z.number().finite().optional(),
        outputOffsetAfter: z.number().finite().optional(),
        effectiveOutputValueBefore: z.number().finite().optional(),
        effectiveOutputValueAfter: z.number().finite().optional(),
        tickBefore: z.number().int().nonnegative().optional(),
        tickAfter: z.number().int().nonnegative().optional(),
        resetCounterBefore: z.number().int().nonnegative().optional(),
        resetCounterAfter: z.number().int().nonnegative().optional()
      })
    )
    .default([]),
  rigControlChanges: z.array(RigControlRuntimeChangeSchema).optional(),
  drawableChanges: z
    .array(
      z.object({
        drawableId: DrawableIdSchema,
        boundsChanged: z.boolean(),
        vertexHashBefore: z.string().optional(),
        vertexHashAfter: z.string().optional(),
        fullVertexDeltaRef: z.string().optional()
      })
    )
    .default([]),
  drawableRuntimeStateChanges: z.array(DrawableRuntimeStateChangeSchema).default([]),
  drawListChanges: z.array(DrawListChangeSchema).default([]),
  diagnosticDelta: z.array(DiagnosticSchema).default([])
});
export type RuntimeDiffDto = z.infer<typeof RuntimeDiffSchema>;
export const RuntimeDiffDtoSchema = RuntimeDiffSchema;
