import {
  DrawableIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RectSchema,
  SourceAssetIdSchema,
  TargetRefSchema,
  TextureIdSchema,
  Vec2Schema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const StatePatchValueSchema = z.union([
  z.number().finite(),
  z.boolean(),
  z.string(),
  Vec2Schema,
  RectSchema,
  z.array(Vec2Schema),
  z.record(z.string(), z.number().finite())
]);
export type StatePatchValueDto = z.infer<typeof StatePatchValueSchema>;

export const CreateDrawablePayloadSchema = z.object({
  sourceAssetId: SourceAssetIdSchema,
  sourceLayerId: z.string().optional(),
  textureId: z.string().optional(),
  partId: PartIdSchema,
  displayName: z.string().min(1),
  initialBounds: RectSchema.optional()
});
export type CreateDrawablePayloadDto = z.infer<typeof CreateDrawablePayloadSchema>;

const LockedTargetIdsSchema = z.array(z.string().min(1)).default([]);

export const CreatePartPayloadSchema = z.object({
  partId: PartIdSchema.optional(),
  displayName: z.string().min(1),
  parentPartId: PartIdSchema.optional(),
  lockedTargetIds: LockedTargetIdsSchema
});
export type CreatePartPayloadDto = z.infer<typeof CreatePartPayloadSchema>;

export const UpdatePartPayloadSchema = z
  .object({
    partId: PartIdSchema,
    displayName: z.string().min(1).optional(),
    parentPartId: PartIdSchema.nullable().optional(),
    lockedTargetIds: LockedTargetIdsSchema
  })
  .refine(
    (payload) =>
      payload.displayName !== undefined ||
      Object.prototype.hasOwnProperty.call(payload, "parentPartId"),
    {
      message: "updatePart requires displayName or parentPartId",
      path: ["displayName"]
    }
  );
export type UpdatePartPayloadDto = z.infer<typeof UpdatePartPayloadSchema>;

export const SetDrawablePartPayloadSchema = z.object({
  drawableId: DrawableIdSchema,
  partId: PartIdSchema,
  lockedTargetIds: LockedTargetIdsSchema
});
export type SetDrawablePartPayloadDto = z.infer<typeof SetDrawablePartPayloadSchema>;

export const SetDrawableTexturePayloadSchema = z.object({
  drawableId: DrawableIdSchema,
  textureId: TextureIdSchema,
  lockedTargetIds: LockedTargetIdsSchema
});
export type SetDrawableTexturePayloadDto = z.infer<typeof SetDrawableTexturePayloadSchema>;

export const GenerateMeshPayloadSchema = z.object({
  drawableId: DrawableIdSchema,
  method: z.enum(["manual-empty", "auto-grid-v1", "auto-outline-v1"]),
  densityHint: z.enum(["low", "medium", "high"]).optional()
});
export type GenerateMeshPayloadDto = z.infer<typeof GenerateMeshPayloadSchema>;

export const MoveMeshVertexPayloadSchema = z.object({
  meshId: MeshIdSchema,
  vertexDeltas: z
    .array(
      z.object({
        vertexId: VertexIdSchema,
        delta: Vec2Schema
      })
    ),
  keyformScope: z
    .object({
      parameterId: ParameterIdSchema,
      keyValue: z.number().finite()
    })
    .optional(),
  intent: z.string().max(500)
});
export type MoveMeshVertexPayloadDto = z.infer<typeof MoveMeshVertexPayloadSchema>;

export const CreateParameterPayloadSchema = z
  .object({
    parameterId: ParameterIdSchema.optional(),
    displayName: z.string().min(1),
    semanticRole: z
      .enum(["eye", "brow", "mouth", "face", "body", "arm", "hair", "dynamics", "custom"])
      .optional(),
    projectPresetAlias: z.string().optional(),
    valueSource: z.enum(["authoredInput", "computedDynamics", "debugOverride"]).default("authoredInput"),
    min: z.number().finite(),
    max: z.number().finite(),
    default: z.number().finite(),
    recommendedUiStep: z.number().positive()
  })
  .refine((payload) => payload.min <= payload.max, {
    message: "min must be less than or equal to max",
    path: ["min"]
  })
  .refine((payload) => payload.default >= payload.min && payload.default <= payload.max, {
    message: "default must be inside the parameter range",
    path: ["default"]
  });
export type CreateParameterPayloadDto = z.infer<typeof CreateParameterPayloadSchema>;

export const KeyformStatePatchSchema = z.object({
  propertyPath: z.string().min(1),
  value: StatePatchValueSchema,
  valueSchemaHint: z.string().optional()
});
export type KeyformStatePatchDto = z.infer<typeof KeyformStatePatchSchema>;

export const AddKeyformPayloadSchema = z.object({
  target: TargetRefSchema,
  targetProperty: z.string().min(1),
  parameterId: ParameterIdSchema,
  keyValue: z.number().finite(),
  interpolation: z.literal("linear-1d-v1"),
  statePatch: KeyformStatePatchSchema
});
export type AddKeyformPayloadDto = z.infer<typeof AddKeyformPayloadSchema>;

export const AddKeyformGrid2dPayloadSchema = z.object({
  target: TargetRefSchema,
  targetProperty: z.string().min(1),
  parameterX: ParameterIdSchema,
  parameterY: ParameterIdSchema,
  evaluator: z.literal("parameter-grid-2d-v1"),
  interpolation: z.literal("bilinear-grid-v1"),
  clampPolicy: z.literal("clamp-to-parameter-range"),
  keys: z
    .array(
      z.object({
        x: z.number().finite(),
        y: z.number().finite(),
        statePatch: StatePatchValueSchema
      })
    )
    .min(1)
});
export type AddKeyformGrid2dPayloadDto = z.infer<typeof AddKeyformGrid2dPayloadSchema>;

export const SetMaskRelationPayloadSchema = z.object({
  maskRelationId: MaskRelationIdSchema.optional(),
  maskDrawableIds: z.array(DrawableIdSchema),
  targetDrawableIds: z.array(DrawableIdSchema),
  enabled: z.boolean()
});
export type SetMaskRelationPayloadDto = z.infer<typeof SetMaskRelationPayloadSchema>;

export const SetDrawOrderPayloadSchema = z.object({
  entries: z
    .array(
      z.object({
        drawableId: DrawableIdSchema,
        baseDrawOrder: z.number().int()
      })
    )
    .min(1)
});
export type SetDrawOrderPayloadDto = z.infer<typeof SetDrawOrderPayloadSchema>;

export const SetRuntimeVisibilityPayloadSchema = z.object({
  target: TargetRefSchema,
  runtimeVisibility: z.boolean()
});
export type SetRuntimeVisibilityPayloadDto = z.infer<typeof SetRuntimeVisibilityPayloadSchema>;

export const SetRightsMetadataPayloadSchema = z.object({
  assetId: z.string().min(1),
  rightsStatus: z.enum(["cleared", "needs_review", "blocked"]),
  license: z.string().min(1),
  redistributionAllowed: z.boolean(),
  provenanceId: ProvenanceIdSchema.optional()
});
export type SetRightsMetadataPayloadDto = z.infer<typeof SetRightsMetadataPayloadSchema>;
