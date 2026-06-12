import {
  DrawableIdSchema,
  PartIdSchema,
  RectSchema,
  RigControlIdSchema,
  TargetRefSchema,
  Vec2Schema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const CreateRotation2dRigControlPayloadSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string().min(1),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  pivot: Vec2Schema,
  restAngleDegrees: z.number().finite()
});
export type CreateRotation2dRigControlPayloadDto = z.infer<
  typeof CreateRotation2dRigControlPayloadSchema
>;

export const CreateWarpLattice2dRigControlPayloadSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string().min(1),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
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
  domainBounds: RectSchema,
  transformColumns: z.number().int().min(2),
  transformRows: z.number().int().min(2),
  bezierColumns: z.number().int().min(2),
  bezierRows: z.number().int().min(2),
  bezierEditType: z.literal("cubicBezierSurfaceV1").default("cubicBezierSurfaceV1")
});
export type CreateWarpDeformerPayloadDto = z.infer<typeof CreateWarpDeformerPayloadSchema>;

export const BindRigControlChildPayloadSchema = z.object({
  parentRigControlId: RigControlIdSchema,
  child: TargetRefSchema
});
export type BindRigControlChildPayloadDto = z.infer<typeof BindRigControlChildPayloadSchema>;
