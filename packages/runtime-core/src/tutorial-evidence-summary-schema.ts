import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ParameterIdSchema,
  RigControlIdSchema,
  RuntimeSnapshotIdSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateSequenceArtifactRefSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const TutorialEvidenceSurfaceSchema = z.enum(["runtime", "viewer", "preview"]);
export type TutorialEvidenceSurface = z.infer<typeof TutorialEvidenceSurfaceSchema>;

export const TutorialEvidenceSliceIdSchema = z.enum([
  "parts",
  "layers",
  "drawables",
  "meshes",
  "meshEdits",
  "maskOpacity",
  "rigControls",
  "rigControlKeyforms",
  "dynamics"
]);
export type TutorialEvidenceSliceId = z.infer<typeof TutorialEvidenceSliceIdSchema>;

export const TUTORIAL_REQUIRED_SLICE_IDS: readonly TutorialEvidenceSliceId[] = [
  "parts",
  "layers",
  "drawables",
  "meshes",
  "meshEdits",
  "maskOpacity",
  "rigControls",
  "rigControlKeyforms",
  "dynamics"
];

export const TutorialSliceStatusSchema = z.object({
  sliceId: TutorialEvidenceSliceIdSchema,
  present: z.boolean(),
  evidenceRefs: z.array(z.string())
});
export type TutorialSliceStatusDto = z.infer<typeof TutorialSliceStatusSchema>;

export const TutorialSemanticReadinessSummarySchema = z.object({
  status: z.enum(["ready", "incomplete"]),
  ready: z.boolean(),
  presentSlices: z.array(TutorialEvidenceSliceIdSchema),
  missingSlices: z.array(TutorialEvidenceSliceIdSchema),
  sliceStatus: z.array(TutorialSliceStatusSchema)
});
export type TutorialSemanticReadinessSummaryDto = z.infer<typeof TutorialSemanticReadinessSummarySchema>;

export const TutorialRenderedCorrectnessBoundarySchema = z.object({
  status: z.literal("not_evaluated"),
  fullRenderer: z.literal(false),
  pixelOracle: z.literal(false),
  textureSamplingCorrectness: z.literal(false),
  basis: z.literal("semanticRuntimeEvidenceOnly")
});
export type TutorialRenderedCorrectnessBoundaryDto = z.infer<typeof TutorialRenderedCorrectnessBoundarySchema>;

export const TutorialPackageRefSchema = z.object({
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional()
});
export type TutorialPackageRefDto = z.infer<typeof TutorialPackageRefSchema>;

export const TutorialSnapshotEvidenceRefsSchema = z.object({
  snapshotId: RuntimeSnapshotIdSchema,
  baselineSnapshotId: RuntimeSnapshotIdSchema.optional(),
  candidateSnapshotId: RuntimeSnapshotIdSchema.optional(),
  generatedRuntimeSnapshotIds: z.array(RuntimeSnapshotIdSchema).default([]),
  generatedRuntimeStateRefs: z.array(RuntimeStateArtifactRefSchema).default([]),
  generatedRuntimeStateSequenceRefs: z.array(RuntimeStateSequenceArtifactRefSchema).default([]),
  finalRuntimeStateRef: RuntimeStateArtifactRefSchema.optional(),
  runtimeDiff: z
    .object({
      beforeSnapshotId: RuntimeSnapshotIdSchema,
      afterSnapshotId: RuntimeSnapshotIdSchema,
      parameterChangeCount: z.number().int().nonnegative(),
      dynamicsChangeCount: z.number().int().nonnegative(),
      drawableGeometryChangeCount: z.number().int().nonnegative(),
      drawableRuntimeStateChangeCount: z.number().int().nonnegative(),
      drawListChangeCount: z.number().int().nonnegative(),
      diagnosticDeltaCount: z.number().int().nonnegative()
    })
    .optional()
});
export type TutorialSnapshotEvidenceRefsDto = z.infer<typeof TutorialSnapshotEvidenceRefsSchema>;

export const TutorialPartEvidenceRefSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string(),
  parentPartId: PartIdSchema.optional(),
  childPartIds: z.array(PartIdSchema),
  drawableIds: z.array(DrawableIdSchema),
  hierarchyPath: z.array(PartIdSchema),
  depth: z.number().int().nonnegative(),
  runtimeVisibleDrawableCount: z.number().int().nonnegative()
});
export type TutorialPartEvidenceRefDto = z.infer<typeof TutorialPartEvidenceRefSchema>;

export const TutorialDrawableLayerEvidenceRefSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  partId: PartIdSchema.optional(),
  runtimeVisible: z.boolean(),
  opacity: z.number().min(0).max(1),
  baseDrawOrder: z.number().int(),
  evaluatedDrawOrder: z.number().int(),
  textureStatus: z.enum(["resolved", "missing", "not_materialized"]),
  textureId: TextureIdSchema.optional()
});
export type TutorialDrawableLayerEvidenceRefDto = z.infer<typeof TutorialDrawableLayerEvidenceRefSchema>;

export const TutorialMeshEvidenceRefSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  vertexCount: z.number().int().nonnegative(),
  vertexHash: z.string(),
  topology: z
    .object({
      vertexCount: z.number().int().nonnegative(),
      stableVertexIdCount: z.number().int().nonnegative(),
      uvCount: z.number().int().nonnegative(),
      triangleCount: z.number().int().nonnegative(),
      triangleIndexCount: z.number().int().nonnegative(),
      hasStableVertexIds: z.boolean(),
      hasUvProjection: z.boolean(),
      hasTriangles: z.boolean()
    })
    .optional()
});
export type TutorialMeshEvidenceRefDto = z.infer<typeof TutorialMeshEvidenceRefSchema>;

export const TutorialMeshEditEvidenceRefSchema = z.object({
  drawableId: DrawableIdSchema,
  meshId: MeshIdSchema,
  boundsChanged: z.boolean(),
  vertexHashChanged: z.boolean(),
  movedVertexRefs: z.array(z.string())
});
export type TutorialMeshEditEvidenceRefDto = z.infer<typeof TutorialMeshEditEvidenceRefSchema>;

export const TutorialMaskRelationEvidenceRefSchema = z.object({
  maskRelationId: MaskRelationIdSchema,
  sourceDrawableIds: z.array(DrawableIdSchema),
  targetDrawableIds: z.array(DrawableIdSchema),
  resolved: z.boolean()
});
export type TutorialMaskRelationEvidenceRefDto = z.infer<typeof TutorialMaskRelationEvidenceRefSchema>;

export const TutorialOpacityEvidenceRefSchema = z.object({
  drawableId: DrawableIdSchema,
  opacity: z.number().min(0).max(1),
  visible: z.boolean()
});
export type TutorialOpacityEvidenceRefDto = z.infer<typeof TutorialOpacityEvidenceRefSchema>;

export const TutorialRigControlEvidenceRefSchema = z.object({
  rigControlId: RigControlIdSchema,
  kind: z.enum(["rotation2d", "warpLattice2d"]),
  enabled: z.boolean(),
  evaluationStatus: z.enum(["evaluated", "disabled", "unsupported", "blocked"]),
  childDrawableIds: z.array(DrawableIdSchema),
  affectedDrawableIds: z.array(DrawableIdSchema)
});
export type TutorialRigControlEvidenceRefDto = z.infer<typeof TutorialRigControlEvidenceRefSchema>;

export const TutorialRigControlKeyformEvidenceRefSchema = z.object({
  keyformSetId: KeyformSetIdSchema,
  evaluator: z.enum(["linear-1d-v1", "parameter-grid-2d-v1"]),
  target: z.string(),
  sampledCoordinates: z.record(ParameterIdSchema, z.number().finite())
});
export type TutorialRigControlKeyformEvidenceRefDto = z.infer<typeof TutorialRigControlKeyformEvidenceRefSchema>;

export const TutorialDynamicsEvidenceRefSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  enabled: z.boolean(),
  solverKind: z.literal("scalarDampedFollowV1"),
  driverParameterIds: z.array(ParameterIdSchema),
  outputParameterId: ParameterIdSchema,
  outputValue: z.number().finite(),
  tick: z.number().int().nonnegative(),
  resetCounter: z.number().int().nonnegative()
});
export type TutorialDynamicsEvidenceRefDto = z.infer<typeof TutorialDynamicsEvidenceRefSchema>;

export const TutorialSnapshotEvidenceSummarySchema = z.object({
  schemaVersion: z.literal("tutorial-snapshot-evidence-summary-v1"),
  source: TutorialEvidenceSurfaceSchema,
  packageRef: TutorialPackageRefSchema,
  evidenceRefs: TutorialSnapshotEvidenceRefsSchema,
  semanticReadiness: TutorialSemanticReadinessSummarySchema,
  renderedCorrectness: TutorialRenderedCorrectnessBoundarySchema,
  parts: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    refs: z.array(TutorialPartEvidenceRefSchema)
  }),
  layers: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    refs: z.array(TutorialDrawableLayerEvidenceRefSchema)
  }),
  drawables: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    visibleCount: z.number().int().nonnegative(),
    refs: z.array(DrawableIdSchema)
  }),
  meshes: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    refs: z.array(TutorialMeshEvidenceRefSchema)
  }),
  meshEdits: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    refs: z.array(TutorialMeshEditEvidenceRefSchema)
  }),
  maskOpacity: z.object({
    present: z.boolean(),
    maskRelationCount: z.number().int().nonnegative(),
    opacityEvidenceCount: z.number().int().nonnegative(),
    nonDefaultOpacityDrawableIds: z.array(DrawableIdSchema),
    maskRelationRefs: z.array(TutorialMaskRelationEvidenceRefSchema),
    opacityRefs: z.array(TutorialOpacityEvidenceRefSchema)
  }),
  rigControls: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    refs: z.array(TutorialRigControlEvidenceRefSchema)
  }),
  rigControlKeyforms: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    refs: z.array(TutorialRigControlKeyformEvidenceRefSchema)
  }),
  dynamics: z.object({
    present: z.boolean(),
    count: z.number().int().nonnegative(),
    refs: z.array(TutorialDynamicsEvidenceRefSchema)
  })
});
export type TutorialSnapshotEvidenceSummaryDto = z.infer<typeof TutorialSnapshotEvidenceSummarySchema>;

export const TutorialRuntimeViewerEvidenceSummarySchema = z.object({
  schemaVersion: z.literal("tutorial-runtime-viewer-evidence-summary-v1"),
  packageRef: TutorialPackageRefSchema,
  runtimeSummary: TutorialSnapshotEvidenceSummarySchema,
  viewerSummary: TutorialSnapshotEvidenceSummarySchema,
  semanticReadiness: TutorialSemanticReadinessSummarySchema,
  renderedCorrectness: TutorialRenderedCorrectnessBoundarySchema
});
export type TutorialRuntimeViewerEvidenceSummaryDto = z.infer<typeof TutorialRuntimeViewerEvidenceSummarySchema>;
