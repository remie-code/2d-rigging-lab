import { z } from "zod";

import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RectSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  Vec2Schema,
  WarpLattice2dBindSpaceSchema,
  WarpLattice2dControlPointOffsetsSchema,
  WarpLattice2dDomainBoundsSchema,
  WarpLattice2dInterpolationMethodSchema,
  WarpLattice2dLatticeColumnsSchema,
  WarpLattice2dLatticeRowsSchema,
  getWarpLattice2dControlPointCount,
  hasWarpLattice2dControlPointCardinality,
  isWarpLattice2dControlPointOffsetsTarget
} from "@private-2d-rigging-lab/contracts";

export const DrawableSchema = z.object({
  drawableId: DrawableIdSchema,
  displayName: z.string(),
  partId: PartIdSchema,
  sourceAssetId: SourceAssetIdSchema,
  textureId: TextureIdSchema,
  meshId: MeshIdSchema,
  defaultOpacity: z.number().min(0).max(1),
  runtimeVisibility: z.boolean(),
  baseDrawOrder: z.number().int(),
  sourceProvenanceId: ProvenanceIdSchema
});
export type DrawableDto = z.infer<typeof DrawableSchema>;

export const MeshSchema = z.object({
  meshId: MeshIdSchema,
  drawableId: DrawableIdSchema,
  vertices: z.array(Vec2Schema),
  uvs: z.array(Vec2Schema),
  triangles: z.array(z.tuple([
    z.number().int().nonnegative(),
    z.number().int().nonnegative(),
    z.number().int().nonnegative()
  ])),
  vertexStableIds: z.array(z.string()),
  bounds: RectSchema,
  generationProvenanceId: ProvenanceIdSchema
});
export type MeshDto = z.infer<typeof MeshSchema>;

export const ParameterSchema = z.object({
  parameterId: ParameterIdSchema,
  displayName: z.string(),
  semanticRole: z.enum(["eye", "brow", "mouth", "face", "body", "arm", "hair", "dynamics", "custom"]).optional(),
  projectPresetAlias: z.string().optional(),
  valueSource: z.enum(["authoredInput", "computedDynamics", "debugOverride"]).default("authoredInput"),
  min: z.number().finite(),
  max: z.number().finite(),
  default: z.number().finite(),
  recommendedUiStep: z.number().positive()
});
export type ParameterDto = z.infer<typeof ParameterSchema>;

export const PackageStatePatchValueSchema = z.union([
  z.number().finite(),
  z.boolean(),
  z.string(),
  Vec2Schema,
  RectSchema,
  z.array(Vec2Schema),
  z.record(z.string(), z.number().finite())
]);
export type PackageStatePatchValueDto = z.infer<typeof PackageStatePatchValueSchema>;

export const KeyformTargetSchema = z.object({
  kind: z.enum(["mesh", "rigControl", "drawable", "opacity", "visibility", "drawOrder"]),
  id: z.string(),
  property: z.string()
});
export type KeyformTargetDto = z.infer<typeof KeyformTargetSchema>;

export const Linear1dKeyformSetSchema = z.object({
  keyformSetId: KeyformSetIdSchema,
  target: KeyformTargetSchema,
  parameterId: ParameterIdSchema,
  evaluator: z.literal("linear-1d-v1"),
  interpolation: z.literal("linear-1d-v1"),
  compositionMode: z.enum(["replace", "additiveDelta", "multiplyOpacity"]),
  compositionOrder: z.number().int(),
  keys: z.array(z.object({
    value: z.number().finite(),
    statePatch: PackageStatePatchValueSchema
  }))
});
export type Linear1dKeyformSetDto = z.infer<typeof Linear1dKeyformSetSchema>;

export const ParameterGrid2dKeyformSetSchema = z.object({
  keyformSetId: KeyformSetIdSchema,
  target: KeyformTargetSchema,
  parameterX: ParameterIdSchema,
  parameterY: ParameterIdSchema,
  evaluator: z.literal("parameter-grid-2d-v1"),
  interpolation: z.literal("bilinear-grid-v1"),
  clampPolicy: z.literal("clamp-to-parameter-range"),
  missingKeyPolicy: z.literal("diagnostic-error"),
  compositionMode: z.enum(["replace", "additiveDelta"]),
  compositionOrder: z.number().int(),
  keys: z.array(z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    statePatch: PackageStatePatchValueSchema
  }))
});
export type ParameterGrid2dKeyformSetDto = z.infer<typeof ParameterGrid2dKeyformSetSchema>;

const KeyformSetBaseSchema = z.discriminatedUnion("evaluator", [
  Linear1dKeyformSetSchema,
  ParameterGrid2dKeyformSetSchema
]);

export const KeyformSetSchema = KeyformSetBaseSchema.superRefine((keyformSet, context) => {
  if (!isWarpLattice2dControlPointOffsetsTarget(keyformSet.target)) {
    return;
  }

  if (keyformSet.compositionMode !== "replace" && keyformSet.compositionMode !== "additiveDelta") {
    context.addIssue({
      code: "custom",
      path: ["compositionMode"],
      message: "warpLattice2d controlPointOffsets keyforms allow only replace or additiveDelta composition."
    });
  }

  keyformSet.keys.forEach((key, index) => {
    if (!WarpLattice2dControlPointOffsetsSchema.safeParse(key.statePatch).success) {
      context.addIssue({
        code: "custom",
        path: ["keys", index, "statePatch"],
        message:
          "warpLattice2d controlPointOffsets statePatch must be a control-point-ordered Vec2[] with at least four entries."
      });
    }
  });
});
export type KeyformSetDto = z.infer<typeof KeyformSetSchema>;

export const DynamicsDriverSchema = z.object({
  driverId: z.string(),
  sourceParameterId: ParameterIdSchema,
  inputScale: z.number().finite().default(1),
  inputOffset: z.number().finite().default(0),
  invert: z.boolean().default(false)
});
export type DynamicsDriverDto = z.infer<typeof DynamicsDriverSchema>;

export const DynamicsOutputSchema = z.object({
  outputId: z.string(),
  targetParameterId: ParameterIdSchema,
  outputScale: z.number().finite().default(1),
  outputOffset: z.number().finite().default(0),
  min: z.number().finite(),
  max: z.number().finite(),
  clampPolicy: z.literal("clamp-to-output-range")
});
export type DynamicsOutputDto = z.infer<typeof DynamicsOutputSchema>;

export const ScalarDampedFollowSettingsV1Schema = z.object({
  stiffness: z.number().finite().nonnegative(),
  damping: z.number().finite().nonnegative(),
  maxVelocity: z.number().finite().positive().optional(),
  maxAmplitude: z.number().finite().positive().optional()
});
export type ScalarDampedFollowSettingsV1Dto = z.infer<typeof ScalarDampedFollowSettingsV1Schema>;

export const DynamicsGroupSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  displayName: z.string(),
  enabled: z.boolean().default(true),
  solverKind: z.literal("scalarDampedFollowV1"),
  drivers: z.array(DynamicsDriverSchema).min(1),
  output: DynamicsOutputSchema,
  settings: ScalarDampedFollowSettingsV1Schema,
  resetPolicy: z.enum(["reset-on-load", "reset-on-manual-command", "reset-on-large-input-jump"])
});
export type DynamicsGroupDto = z.infer<typeof DynamicsGroupSchema>;

const Rotation2dRigControlSchema = z.object({
  kind: z.literal("rotation2d"),
  rigControlId: RigControlIdSchema,
  displayName: z.string(),
  partId: PartIdSchema,
  parentId: RigControlIdSchema.optional(),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  pivot: Vec2Schema,
  restAngleDegrees: z.number().finite(),
  restTranslation: Vec2Schema,
  restScale: Vec2Schema,
  enabled: z.boolean()
});

const WarpLattice2dRigControlSchema = z.object({
  kind: z.literal("warpLattice2d"),
  rigControlId: RigControlIdSchema,
  displayName: z.string(),
  partId: PartIdSchema,
  parentId: RigControlIdSchema.optional(),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  bindSpace: WarpLattice2dBindSpaceSchema,
  domainBounds: WarpLattice2dDomainBoundsSchema,
  latticeColumns: WarpLattice2dLatticeColumnsSchema,
  latticeRows: WarpLattice2dLatticeRowsSchema,
  restControlPoints: z.array(Vec2Schema),
  interpolationMethod: WarpLattice2dInterpolationMethodSchema,
  enabled: z.boolean()
});

const RigControlBaseSchema = z.discriminatedUnion("kind", [
  Rotation2dRigControlSchema,
  WarpLattice2dRigControlSchema
]);

export const RigControlSchema = RigControlBaseSchema.superRefine((rigControl, context) => {
  if (rigControl.kind !== "warpLattice2d") {
    return;
  }

  if (
    !hasWarpLattice2dControlPointCardinality(
      rigControl,
      rigControl.restControlPoints.length
    )
  ) {
    context.addIssue({
      code: "custom",
      path: ["restControlPoints"],
      message: `warpLattice2d restControlPoints length must equal latticeColumns * latticeRows (${getWarpLattice2dControlPointCount(rigControl)}).`
    });
  }
});

export type RigControlDto = z.infer<typeof RigControlSchema>;

export const MaskRelationSchema = z.object({
  maskRelationId: MaskRelationIdSchema,
  maskDrawableIds: z.array(DrawableIdSchema).min(1),
  targetDrawableIds: z.array(DrawableIdSchema).min(1),
  maskGroupHint: z.string().optional(),
  enabled: z.boolean()
});
export type MaskRelationDto = z.infer<typeof MaskRelationSchema>;

export const DrawOrderEntrySchema = z.object({
  drawableId: DrawableIdSchema,
  baseDrawOrder: z.number().int(),
  stableOrder: z.number().int().nonnegative(),
  keyformSetId: KeyformSetIdSchema.optional()
});
export type DrawOrderEntryDto = z.infer<typeof DrawOrderEntrySchema>;

export const EditorStateFileSchema = z.object({
  schemaVersion: z.literal("editor-state-v1"),
  selection: z.array(z.string()).default([]),
  lockedIds: z.array(z.string()).default([]),
  editorHiddenIds: z.array(z.string()).default([]),
  activeTool: z.string().optional(),
  canvas: z.object({
    zoom: z.number().positive(),
    pan: Vec2Schema
  }).optional()
});
export type EditorStateFileDto = z.infer<typeof EditorStateFileSchema>;

export const DrawablesFileSchema = z.object({
  schemaVersion: z.literal("drawables-file-v1"),
  drawables: z.array(DrawableSchema)
});
export type DrawablesFileDto = z.infer<typeof DrawablesFileSchema>;

export const MeshesFileSchema = z.object({
  schemaVersion: z.literal("meshes-file-v1"),
  meshes: z.array(MeshSchema)
});
export type MeshesFileDto = z.infer<typeof MeshesFileSchema>;

export const ParametersFileSchema = z.object({
  schemaVersion: z.literal("parameters-file-v1"),
  parameters: z.array(ParameterSchema)
});
export type ParametersFileDto = z.infer<typeof ParametersFileSchema>;

export const KeyformsFileSchema = z.object({
  schemaVersion: z.literal("keyforms-file-v1"),
  keyformSets: z.array(KeyformSetSchema)
});
export type KeyformsFileDto = z.infer<typeof KeyformsFileSchema>;

export const RigControlsFileSchema = z.object({
  schemaVersion: z.literal("rig-controls-file-v1"),
  rigControls: z.array(RigControlSchema)
});
export type RigControlsFileDto = z.infer<typeof RigControlsFileSchema>;

export const DynamicsFileSchema = z.object({
  schemaVersion: z.literal("dynamics-file-v1"),
  dynamicsGroups: z.array(DynamicsGroupSchema)
});
export type DynamicsFileDto = z.infer<typeof DynamicsFileSchema>;

export const MasksFileSchema = z.object({
  schemaVersion: z.literal("masks-file-v1"),
  masks: z.array(MaskRelationSchema)
});
export type MasksFileDto = z.infer<typeof MasksFileSchema>;

export const DrawOrderFileSchema = z.object({
  schemaVersion: z.literal("draw-order-file-v1"),
  entries: z.array(DrawOrderEntrySchema)
});
export type DrawOrderFileDto = z.infer<typeof DrawOrderFileSchema>;
