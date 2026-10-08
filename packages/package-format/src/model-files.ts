import { z } from "zod";

import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  MeshTopologyRevisionDtoSchema,
  MeshTriangleIndicesDtoSchema,
  MeshTriangleStableIdSetDtoSchema,
  MeshVertexStableIdDtoSchema,
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

import { WarpDeformerMetadataSchema } from "./warp-deformer-contract.js";
import {
  ParameterGroupSchema,
  ParameterKindSchema,
  ParameterLockedFieldSchema,
  ParameterSignConventionSchema,
  ParameterTypeSchema
} from "./parameter-metadata.js";

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
  triangles: z.array(MeshTriangleIndicesDtoSchema),
  vertexStableIds: z.array(MeshVertexStableIdDtoSchema),
  triangleStableIds: MeshTriangleStableIdSetDtoSchema.optional(),
  topologyRevision: MeshTopologyRevisionDtoSchema.optional(),
  bounds: RectSchema,
  generationProvenanceId: ProvenanceIdSchema
});
export type MeshDto = z.infer<typeof MeshSchema>;
export const MeshDtoSchema = MeshSchema;

export const ParameterSchema = z.object({
  parameterId: ParameterIdSchema,
  displayName: z.string(),
  kind: ParameterKindSchema.optional(),
  parameterType: ParameterTypeSchema.optional(),
  group: ParameterGroupSchema.optional(),
  semanticRole: z.enum(["eye", "brow", "mouth", "face", "body", "arm", "hair", "dynamics", "custom"]).optional(),
  projectPresetAlias: z.string().optional(),
  presetRole: z.string().min(1).optional(),
  valueSource: z.enum(["authoredInput", "computedDynamics", "debugOverride"]).default("authoredInput"),
  min: z.number().finite(),
  max: z.number().finite(),
  default: z.number().finite(),
  recommendedUiStep: z.number().positive(),
  signConvention: ParameterSignConventionSchema.optional(),
  lockedFields: z.array(ParameterLockedFieldSchema).optional()
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

export const DynamicsAxisKindSchema = z.enum(["angle", "positionX", "positionY"]);
export type DynamicsAxisKindDto = z.infer<typeof DynamicsAxisKindSchema>;

// dynamics-file-v3 (world-frame Verlet chain). See discussion/design/dynamics-world-frame-chain.md §4.
// Input: rest basis is always the parameter default; weight and inversion are unified into the sign
// and magnitude of `scale` (deg/unit for angle, cm/unit for positionX/Y). §3.2 / §4.
export const DynamicsInputSchema = z.object({
  parameterId: ParameterIdSchema,
  kind: DynamicsAxisKindSchema,
  scale: z.number().finite()
});
export type DynamicsInputDto = z.infer<typeof DynamicsInputSchema>;

// Chain (one per group; successor of the old single-element pendulums array). §4.
export const DynamicsChainSchema = z.object({
  rootOffset: Vec2Schema.default({ x: 0, y: 0 }),
  segmentLengths: z.array(z.number().finite().positive()).min(1),
  damping: z.number().finite().nonnegative(),
  gravityScale: z.number().finite().nonnegative()
});
export type DynamicsChainDto = z.infer<typeof DynamicsChainSchema>;

// Output reads the angle of one chain segment (segmentIndex ≥ 1). §3.5 / §4.
export const DynamicsOutputSchema = z.object({
  parameterId: ParameterIdSchema,
  segmentIndex: z.number().int().min(1).default(1),
  scale: z.number().finite(),
  limit: z.number().finite().nonnegative()
});
export type DynamicsOutputDto = z.infer<typeof DynamicsOutputSchema>;

export const DynamicsGroupSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  displayName: z.string(),
  enabled: z.boolean().default(true),
  presetId: z.string().min(1).optional(),
  inputs: z.array(DynamicsInputSchema).min(1),
  chain: DynamicsChainSchema,
  outputs: z.array(DynamicsOutputSchema).min(1)
});
export type DynamicsGroupDto = z.infer<typeof DynamicsGroupSchema>;

const Rotation2dRigControlSchema = z.object({
  kind: z.literal("rotation2d"),
  rigControlId: RigControlIdSchema,
  displayName: z.string(),
  partId: PartIdSchema.optional(),
  parentId: RigControlIdSchema.optional(),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  opacityMultiplier: z.number().finite().min(0).max(1).optional(),
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
  partId: PartIdSchema.optional(),
  parentId: RigControlIdSchema.optional(),
  childDrawableIds: z.array(DrawableIdSchema).default([]),
  childRigControlIds: z.array(RigControlIdSchema).default([]),
  opacityMultiplier: z.number().finite().min(0).max(1).optional(),
  bindSpace: WarpLattice2dBindSpaceSchema,
  domainBounds: WarpLattice2dDomainBoundsSchema,
  latticeColumns: WarpLattice2dLatticeColumnsSchema,
  latticeRows: WarpLattice2dLatticeRowsSchema,
  restControlPoints: z.array(Vec2Schema),
  interpolationMethod: WarpLattice2dInterpolationMethodSchema,
  warpDeformer: WarpDeformerMetadataSchema.optional(),
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

  if (rigControl.warpDeformer === undefined) {
    return;
  }

  if (
    rigControl.warpDeformer.transformGrid.columns !== rigControl.latticeColumns ||
    rigControl.warpDeformer.transformGrid.rows !== rigControl.latticeRows
  ) {
    context.addIssue({
      code: "custom",
      path: ["warpDeformer", "transformGrid"],
      message:
        "warpDeformer transformGrid columns/rows must match latticeColumns/latticeRows storage."
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
  schemaVersion: z.literal("dynamics-file-v3"),
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
