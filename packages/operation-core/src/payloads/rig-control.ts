import {
  DrawableIdSchema,
  PartIdSchema,
  RectSchema,
  RigControlIdSchema,
  TargetRefSchema,
  Vec2Schema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

const InsertRigControlChildTargetSchema = z.union([
  z.object({
    kind: z.literal("drawable"),
    id: DrawableIdSchema,
    path: z.string().optional()
  }),
  z.object({
    kind: z.literal("rigControl"),
    id: RigControlIdSchema,
    path: z.string().optional()
  })
]);

export const CreateRotation2dRigControlPayloadSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string().min(1),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  opacityMultiplier: z.number().min(0).max(1).default(1),
  pivot: Vec2Schema,
  restAngleDegrees: z.number().finite(),
  parentRigControlId: RigControlIdSchema.optional(),
  insertBeforeChild: InsertRigControlChildTargetSchema.optional()
});
export type CreateRotation2dRigControlPayloadDto = z.infer<
  typeof CreateRotation2dRigControlPayloadSchema
>;

export const CreateWarpLattice2dRigControlPayloadSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string().min(1),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  opacityMultiplier: z.number().min(0).max(1).default(1),
  domainBounds: RectSchema,
  latticeColumns: z.number().int().min(2),
  latticeRows: z.number().int().min(2),
  interpolationMethod: z.literal("bilinear-grid-v1")
});
export type CreateWarpLattice2dRigControlPayloadDto = z.infer<
  typeof CreateWarpLattice2dRigControlPayloadSchema
>;

export const CreateWarpDeformerPayloadSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string().min(1),
  parentRigControlId: RigControlIdSchema.optional(),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  opacityMultiplier: z.number().min(0).max(1).default(1),
  domainBounds: RectSchema,
  transformColumns: z.number().int().min(2),
  transformRows: z.number().int().min(2),
  bezierColumns: z.number().int().min(2),
  bezierRows: z.number().int().min(2),
  bezierEditType: z.literal("cubicBezierSurfaceV1").default("cubicBezierSurfaceV1"),
  insertBeforeChild: InsertRigControlChildTargetSchema.optional()
});
export type CreateWarpDeformerPayloadDto = z.infer<typeof CreateWarpDeformerPayloadSchema>;

export const BindRigControlChildPayloadSchema = z.object({
  parentRigControlId: RigControlIdSchema,
  child: TargetRefSchema
});
export type BindRigControlChildPayloadDto = z.infer<typeof BindRigControlChildPayloadSchema>;

export const MoveDrawableRigControlBindingPayloadSchema = z.object({
  drawableId: DrawableIdSchema,
  targetRigControlId: RigControlIdSchema
});
export type MoveDrawableRigControlBindingPayloadDto = z.infer<
  typeof MoveDrawableRigControlBindingPayloadSchema
>;

export const ReparentRigControlPayloadSchema = z.object({
  childRigControlId: RigControlIdSchema,
  parentRigControlId: RigControlIdSchema.nullable()
});
export type ReparentRigControlPayloadDto = z.infer<typeof ReparentRigControlPayloadSchema>;

export const UpdateRigControlPayloadSchema = z
  .object({
    rigControlId: RigControlIdSchema,
    displayName: z.string().min(1).optional(),
    domainBounds: RectSchema.optional(),
    transformColumns: z.number().int().min(2).optional(),
    transformRows: z.number().int().min(2).optional(),
    bezierColumns: z.number().int().min(2).optional(),
    bezierRows: z.number().int().min(2).optional(),
    opacityMultiplier: z.number().min(0).max(1).optional()
  })
  .refine(
    (payload) =>
      payload.displayName !== undefined ||
      payload.domainBounds !== undefined ||
      payload.transformColumns !== undefined ||
      payload.transformRows !== undefined ||
      payload.bezierColumns !== undefined ||
      payload.bezierRows !== undefined ||
      payload.opacityMultiplier !== undefined,
    { message: "updateRigControl requires at least one editable field" }
  );
export type UpdateRigControlPayloadDto = z.infer<typeof UpdateRigControlPayloadSchema>;
