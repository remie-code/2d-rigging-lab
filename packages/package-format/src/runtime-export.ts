import { z } from "zod";

import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  MeshTopologyRevisionDtoSchema,
  MeshTriangleIndicesDtoSchema,
  MeshTriangleStableIdSetDtoSchema,
  MeshVertexStableIdDtoSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  RectSchema,
  RigControlIdSchema,
  TextureIdSchema,
  Vec2Schema,
  WarpLattice2dBindSpaceSchema,
  WarpLattice2dDomainBoundsSchema,
  WarpLattice2dInterpolationMethodSchema,
  WarpLattice2dLatticeColumnsSchema,
  WarpLattice2dLatticeRowsSchema,
  getWarpLattice2dControlPointCount,
  hasWarpLattice2dControlPointCardinality
} from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetByteLengthSchema,
  BinaryAssetDigestSchema,
  BinaryAssetIdSchema
} from "./binary-asset.js";
import {
  DynamicsGroupSchema,
  PackageStatePatchValueSchema
} from "./model-files.js";
import { PackageRevisionDtoSchema } from "./package-manifest.js";
import { isPackageRelativePath } from "./package-file-paths.js";
import { toPackageParseResult, type PackageParseResult } from "./parse-result.js";
import {
  TextureAtlasLayoutSettingsSchema,
  TextureAtlasPlacementSchema,
  TextureAtlasSourceSignatureSchema
} from "./texture-atlas.js";
import {
  VariantDefaultActiveSelectionSchema,
  VariantGroupIdSchema,
  VariantGroupSchema,
  type VariantDefaultActiveSelectionDto,
  type VariantGroupDto
} from "./model-variants.js";

export const RUNTIME_EXPORT_MANIFEST_PATH = "runtime-export.json";
export const RUNTIME_EXPORT_MODEL_PATH = "runtime/model.json";
export const RUNTIME_EXPORT_ATLAS_PATH = "runtime/atlas.json";
export const RUNTIME_EXPORT_TEXTURE_PAGE_PATH_PREFIX = "assets/textures/";
export const RUNTIME_EXPORT_TEXTURE_PAGE_EXTENSION = ".raw-rgba";
export const RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
export const RUNTIME_EXPORT_PIXEL_FORMAT = "rgba8";
export const RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION = "runtime-export-variants-v0";

export class RuntimeExportContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeExportContractError";
  }
}

export const RuntimeExportTextArtifactPathSchema = z.enum([
  RUNTIME_EXPORT_MANIFEST_PATH,
  RUNTIME_EXPORT_MODEL_PATH,
  RUNTIME_EXPORT_ATLAS_PATH
]);
export type RuntimeExportTextArtifactPathDto = z.infer<
  typeof RuntimeExportTextArtifactPathSchema
>;

export const RuntimeExportTexturePagePathSchema = z.string().refine(
  isRuntimeExportTexturePagePath,
  "Runtime Export texture page paths must stay under assets/textures and end in .raw-rgba."
);
export type RuntimeExportTexturePagePathDto = z.infer<
  typeof RuntimeExportTexturePagePathSchema
>;

export const RuntimeExportFilePathSchema = z.union([
  RuntimeExportTextArtifactPathSchema,
  RuntimeExportTexturePagePathSchema
]);
export type RuntimeExportFilePathDto = z.infer<typeof RuntimeExportFilePathSchema>;

export const RuntimeExportPageIdSchema = z.string().regex(/^atlas_page_[A-Za-z0-9_-]+$/);
export type RuntimeExportPageIdDto = z.infer<typeof RuntimeExportPageIdSchema>;

export const RuntimeExportAtlasPlacementIdSchema = z.string()
  .regex(/^atlas_place_[A-Za-z0-9_-]+$/);
export type RuntimeExportAtlasPlacementIdDto = z.infer<
  typeof RuntimeExportAtlasPlacementIdSchema
>;

export const RuntimeExportRawRgbaMediaTypeSchema = z.literal(
  RUNTIME_EXPORT_RAW_RGBA_MEDIA_TYPE
);
export type RuntimeExportRawRgbaMediaTypeDto = z.infer<
  typeof RuntimeExportRawRgbaMediaTypeSchema
>;

export const RuntimeExportSourcePackageSchema = z.object({
  packageId: PackageIdSchema,
  packageDisplayName: z.string().min(1),
  packageRevision: PackageRevisionDtoSchema,
  packageHash: z.string().min(1).optional()
}).strict();
export type RuntimeExportSourcePackageDto = z.infer<
  typeof RuntimeExportSourcePackageSchema
>;

export const RuntimeExportCanvasMetadataSchema = z.object({
  coordinateSystem: z.literal("canvas-y-down-v1"),
  size: z.object({
    width: z.number().positive(),
    height: z.number().positive()
  }).strict(),
  bounds: RectSchema
}).strict();
export type RuntimeExportCanvasMetadataDto = z.infer<
  typeof RuntimeExportCanvasMetadataSchema
>;

export const RuntimeExportDynamicsSolverContractSchema = z.object({
  solverVersion: z.literal("runtime-dynamics-pendulum-v1"),
  fixedStepMs: z.number().positive(),
  resetPolicy: z.literal("reset-to-default-parameters-v1")
}).strict();
export type RuntimeExportDynamicsSolverContractDto = z.infer<
  typeof RuntimeExportDynamicsSolverContractSchema
>;

export const RuntimeExportRenderAssumptionsSchema = z.object({
  transparentBackground: z.literal(true),
  pixelFormat: z.literal(RUNTIME_EXPORT_PIXEL_FORMAT),
  alphaMode: z.enum([
    "straight-alpha-v1",
    "premultiplied-alpha-v1",
    "unknown-alpha-v1"
  ]),
  colorSpace: z.enum(["srgb-v1", "unknown-color-space-v1"]),
  textureFiltering: z.enum(["linear-v1", "nearest-v1"]),
  blendMode: z.literal("source-over-v1"),
  masking: z.object({
    clippingMode: z.literal("alpha-mask-v1"),
    coordinateSpace: z.literal("canvas-y-down-v1"),
    maskChannels: z.literal("alpha-v1")
  }).strict(),
  dynamics: RuntimeExportDynamicsSolverContractSchema
}).strict();
export type RuntimeExportRenderAssumptionsDto = z.infer<
  typeof RuntimeExportRenderAssumptionsSchema
>;

export const RuntimeExportRequiredCapabilitySchema = z.enum([
  "directory-runtime-export-v0",
  "raw-rgba8-texture-pages-v1",
  "materialized-atlas-uvs-v1",
  "transparent-background-v1",
  "alpha-mask-clipping-v1",
  "dynamics-pendulum-solver-v1"
]);
export type RuntimeExportRequiredCapabilityDto = z.infer<
  typeof RuntimeExportRequiredCapabilitySchema
>;

export const RuntimeExportTexturePageMetadataSchema = z.object({
  pageId: RuntimeExportPageIdSchema,
  path: RuntimeExportTexturePagePathSchema,
  textureId: TextureIdSchema.optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pixelFormat: z.literal(RUNTIME_EXPORT_PIXEL_FORMAT),
  mediaType: RuntimeExportRawRgbaMediaTypeSchema,
  byteLength: BinaryAssetByteLengthSchema,
  digest: BinaryAssetDigestSchema,
  binaryAssetId: BinaryAssetIdSchema.optional()
}).strict().superRefine((page, context) => {
  addRawRgbaByteLengthIssue({
    width: page.width,
    height: page.height,
    byteLength: page.byteLength,
    path: ["byteLength"],
    context
  });
});
export type RuntimeExportTexturePageMetadataDto = z.infer<
  typeof RuntimeExportTexturePageMetadataSchema
>;

export const RuntimeExportTexturePageReferenceSchema = z.object({
  pageId: RuntimeExportPageIdSchema,
  path: RuntimeExportTexturePagePathSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  pixelFormat: z.literal(RUNTIME_EXPORT_PIXEL_FORMAT)
}).strict();
export type RuntimeExportTexturePageReferenceDto = z.infer<
  typeof RuntimeExportTexturePageReferenceSchema
>;

export const RuntimeExportManifestSchema = z.object({
  schemaVersion: z.literal("runtime-export-manifest-v0"),
  exportFormatVersion: z.literal("runtime-export-v0"),
  sourcePackage: RuntimeExportSourcePackageSchema,
  createdAt: z.string().datetime(),
  paths: z.object({
    manifest: z.literal(RUNTIME_EXPORT_MANIFEST_PATH),
    model: z.literal(RUNTIME_EXPORT_MODEL_PATH),
    atlas: z.literal(RUNTIME_EXPORT_ATLAS_PATH),
    texturePages: z.array(RuntimeExportTexturePagePathSchema).min(1)
  }).strict(),
  canvas: RuntimeExportCanvasMetadataSchema,
  modelBounds: RectSchema,
  texturePages: z.array(RuntimeExportTexturePageMetadataSchema).min(1),
  requiredCapabilities: z.array(RuntimeExportRequiredCapabilitySchema).min(1),
  renderAssumptions: RuntimeExportRenderAssumptionsSchema
}).strict().superRefine((manifest, context) => {
  addDuplicateFieldIssue({
    values: manifest.paths.texturePages,
    context,
    pathPrefix: ["paths", "texturePages"],
    label: "texture page path"
  });
  addDuplicateFieldIssue({
    values: manifest.texturePages.map((page) => page.pageId),
    context,
    pathPrefix: ["texturePages"],
    label: "texture page id"
  });
  addDuplicateFieldIssue({
    values: manifest.texturePages.map((page) => page.path),
    context,
    pathPrefix: ["texturePages"],
    label: "texture page path"
  });

  const metadataPaths = new Set(manifest.texturePages.map((page) => page.path));
  manifest.paths.texturePages.forEach((path, index) => {
    if (!metadataPaths.has(path)) {
      context.addIssue({
        code: "custom",
        path: ["paths", "texturePages", index],
        message: `Texture page path "${path}" is not described in manifest.texturePages.`
      });
    }
  });
});
export type RuntimeExportManifestDto = z.infer<typeof RuntimeExportManifestSchema>;

export const RuntimeExportParameterRoleSchema = z.enum([
  "external-input",
  "computed-dynamics-output",
  "runtime-internal",
  "hidden-from-direct-controls"
]);
export type RuntimeExportParameterRoleDto = z.infer<
  typeof RuntimeExportParameterRoleSchema
>;

export const RuntimeExportParameterSchema = z.object({
  parameterId: ParameterIdSchema,
  displayName: z.string().min(1),
  semanticRole: z.enum([
    "eye",
    "brow",
    "mouth",
    "face",
    "body",
    "arm",
    "hair",
    "dynamics",
    "custom"
  ]).optional(),
  projectPresetAlias: z.string().min(1).optional(),
  valueSource: z.enum(["authoredInput", "computedDynamics", "debugOverride"]),
  runtimeRole: RuntimeExportParameterRoleSchema,
  externalInput: z.boolean(),
  readOnly: z.boolean(),
  min: z.number().finite(),
  max: z.number().finite(),
  default: z.number().finite()
}).strict().superRefine((parameter, context) => {
  if (parameter.min > parameter.max) {
    context.addIssue({
      code: "custom",
      path: ["min"],
      message: "Runtime Export parameter min must be <= max."
    });
  }

  if (parameter.default < parameter.min || parameter.default > parameter.max) {
    context.addIssue({
      code: "custom",
      path: ["default"],
      message: "Runtime Export parameter default must be within min/max."
    });
  }
});
export type RuntimeExportParameterDto = z.infer<
  typeof RuntimeExportParameterSchema
>;

export const RuntimeExportInputManifestSchema = z.object({
  externalInputParameterIds: z.array(ParameterIdSchema),
  computedDynamicsOutputParameterIds: z.array(ParameterIdSchema),
  hiddenDirectControlParameterIds: z.array(ParameterIdSchema)
}).strict();
export type RuntimeExportInputManifestDto = z.infer<
  typeof RuntimeExportInputManifestSchema
>;

export const RuntimeExportDrawableTextureReferenceSchema = z.object({
  pageId: RuntimeExportPageIdSchema,
  path: RuntimeExportTexturePagePathSchema,
  placementId: RuntimeExportAtlasPlacementIdSchema
}).strict();
export type RuntimeExportDrawableTextureReferenceDto = z.infer<
  typeof RuntimeExportDrawableTextureReferenceSchema
>;

export const RuntimeExportDrawableSchema = z.object({
  drawableId: DrawableIdSchema,
  displayName: z.string().min(1),
  meshId: MeshIdSchema,
  partId: PartIdSchema.optional(),
  includeReason: z.enum(["runtime-target-v1", "mask-source-v1"]),
  baseVisible: z.boolean().optional(),
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  baseDrawOrder: z.number().int(),
  bounds: RectSchema,
  texture: RuntimeExportDrawableTextureReferenceSchema
}).strict();
export type RuntimeExportDrawableDto = z.infer<
  typeof RuntimeExportDrawableSchema
>;

export const RuntimeExportMeshSchema = z.object({
  meshId: MeshIdSchema,
  drawableId: DrawableIdSchema,
  vertices: z.array(Vec2Schema).min(1),
  atlasUvs: z.array(Vec2Schema).min(1),
  uvSpace: z.literal("atlas-normalized-v1"),
  triangles: z.array(MeshTriangleIndicesDtoSchema),
  vertexStableIds: z.array(MeshVertexStableIdDtoSchema),
  triangleStableIds: MeshTriangleStableIdSetDtoSchema.optional(),
  topologyRevision: MeshTopologyRevisionDtoSchema.optional(),
  bounds: RectSchema,
  texture: RuntimeExportDrawableTextureReferenceSchema
}).strict().superRefine((mesh, context) => {
  if (mesh.atlasUvs.length !== mesh.vertices.length) {
    context.addIssue({
      code: "custom",
      path: ["atlasUvs"],
      message: "Runtime Export mesh atlasUvs length must match vertices length."
    });
  }

  if (mesh.vertexStableIds.length !== mesh.vertices.length) {
    context.addIssue({
      code: "custom",
      path: ["vertexStableIds"],
      message: "Runtime Export mesh vertexStableIds length must match vertices length."
    });
  }

  mesh.triangles.forEach((triangle, index) => {
    const outOfRange = triangle.some((vertexIndex) => vertexIndex >= mesh.vertices.length);
    if (outOfRange) {
      context.addIssue({
        code: "custom",
        path: ["triangles", index],
        message: "Runtime Export mesh triangle indices must reference existing vertices."
      });
    }
  });
});
export type RuntimeExportMeshDto = z.infer<typeof RuntimeExportMeshSchema>;

export const RuntimeExportDrawOrderEntrySchema = z.object({
  drawableId: DrawableIdSchema,
  drawOrder: z.number().int()
}).strict();
export type RuntimeExportDrawOrderEntryDto = z.infer<
  typeof RuntimeExportDrawOrderEntrySchema
>;

export const RuntimeExportMaskRelationSchema = z.object({
  maskRelationId: MaskRelationIdSchema,
  sourceDrawableIds: z.array(DrawableIdSchema).min(1),
  targetDrawableIds: z.array(DrawableIdSchema).min(1),
  clippingMode: z.literal("alpha-mask-v1"),
  coordinateSpace: z.literal("canvas-y-down-v1")
}).strict();
export type RuntimeExportMaskRelationDto = z.infer<
  typeof RuntimeExportMaskRelationSchema
>;

const RuntimeExportRotation2dRigControlSchema = z.object({
  kind: z.literal("rotation2d"),
  rigControlId: RigControlIdSchema,
  displayName: z.string().min(1),
  parentId: RigControlIdSchema.optional(),
  childDrawableIds: z.array(DrawableIdSchema),
  childRigControlIds: z.array(RigControlIdSchema),
  opacityMultiplier: z.number().finite().min(0).max(1).optional(),
  pivot: Vec2Schema,
  restAngleDegrees: z.number().finite(),
  restTranslation: Vec2Schema,
  restScale: Vec2Schema,
  enabled: z.boolean()
}).strict();

const RuntimeExportWarpLattice2dRigControlSchema = z.object({
  kind: z.literal("warpLattice2d"),
  rigControlId: RigControlIdSchema,
  displayName: z.string().min(1),
  parentId: RigControlIdSchema.optional(),
  childDrawableIds: z.array(DrawableIdSchema),
  childRigControlIds: z.array(RigControlIdSchema),
  opacityMultiplier: z.number().finite().min(0).max(1).optional(),
  bindSpace: WarpLattice2dBindSpaceSchema,
  domainBounds: WarpLattice2dDomainBoundsSchema,
  latticeColumns: WarpLattice2dLatticeColumnsSchema,
  latticeRows: WarpLattice2dLatticeRowsSchema,
  restControlPoints: z.array(Vec2Schema),
  interpolationMethod: WarpLattice2dInterpolationMethodSchema,
  enabled: z.boolean()
}).strict();

export const RuntimeExportRigControlSchema = z
  .discriminatedUnion("kind", [
    RuntimeExportRotation2dRigControlSchema,
    RuntimeExportWarpLattice2dRigControlSchema
  ])
  .superRefine((rigControl, context) => {
    if (rigControl.kind !== "warpLattice2d") {
      return;
    }

    if (!hasWarpLattice2dControlPointCardinality(rigControl, rigControl.restControlPoints.length)) {
      context.addIssue({
        code: "custom",
        path: ["restControlPoints"],
        message: `Runtime Export warpLattice2d restControlPoints length must equal latticeColumns * latticeRows (${getWarpLattice2dControlPointCount(rigControl)}).`
      });
    }
  });
export type RuntimeExportRigControlDto = z.infer<
  typeof RuntimeExportRigControlSchema
>;

export const RuntimeExportLinear1dKeyformBindingSchema = z.object({
  evaluator: z.literal("linear-1d-v1"),
  keyformSetId: KeyformSetIdSchema,
  targetId: z.string().min(1),
  targetKind: z.enum(["mesh", "rigControl", "drawable"]),
  targetProperty: z.string().min(1),
  parameterId: ParameterIdSchema,
  keys: z.array(z.object({
    value: z.number().finite(),
    statePatch: PackageStatePatchValueSchema
  }).strict()),
  compositionMode: z.enum(["replace", "additiveDelta", "multiplyOpacity"]),
  compositionOrder: z.number().int()
}).strict();
export type RuntimeExportLinear1dKeyformBindingDto = z.infer<
  typeof RuntimeExportLinear1dKeyformBindingSchema
>;

export const RuntimeExportParameterGrid2dKeyformBindingSchema = z.object({
  evaluator: z.literal("parameter-grid-2d-v1"),
  keyformSetId: KeyformSetIdSchema,
  targetId: z.string().min(1),
  targetKind: z.enum(["mesh", "rigControl", "drawable"]),
  targetProperty: z.string().min(1),
  parameterX: ParameterIdSchema,
  parameterY: ParameterIdSchema,
  interpolation: z.literal("bilinear-grid-v1"),
  clampPolicy: z.literal("clamp-to-parameter-range"),
  missingKeyPolicy: z.literal("diagnostic-error"),
  keys: z.array(z.object({
    x: z.number().finite(),
    y: z.number().finite(),
    statePatch: PackageStatePatchValueSchema
  }).strict()),
  compositionMode: z.enum(["replace", "additiveDelta"]),
  compositionOrder: z.number().int()
}).strict();
export type RuntimeExportParameterGrid2dKeyformBindingDto = z.infer<
  typeof RuntimeExportParameterGrid2dKeyformBindingSchema
>;

export const RuntimeExportKeyformBindingSchema = z.discriminatedUnion("evaluator", [
  RuntimeExportLinear1dKeyformBindingSchema,
  RuntimeExportParameterGrid2dKeyformBindingSchema
]);
export type RuntimeExportKeyformBindingDto = z.infer<
  typeof RuntimeExportKeyformBindingSchema
>;

export const RuntimeExportDynamicsGroupSchema = DynamicsGroupSchema;
export type RuntimeExportDynamicsGroupDto = z.infer<
  typeof RuntimeExportDynamicsGroupSchema
>;

export const RuntimeExportVariantDefaultActiveSelectionSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  activeSelection: VariantDefaultActiveSelectionSchema
}).strict();
export type RuntimeExportVariantDefaultActiveSelectionDto = z.infer<
  typeof RuntimeExportVariantDefaultActiveSelectionSchema
>;

export const RuntimeExportVariantsSchema = z.object({
  schemaVersion: z.literal(RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION),
  variantGroups: z.array(VariantGroupSchema),
  defaultActiveSelections: z.array(RuntimeExportVariantDefaultActiveSelectionSchema)
}).strict().superRefine((variants, context) => {
  const groupIds = variants.variantGroups.map((group) => group.variantGroupId);
  const variantIds = variants.variantGroups.flatMap((group) =>
    group.variants.map((variant) => variant.variantId)
  );
  const selectionGroupIds = variants.defaultActiveSelections.map((selection) =>
    selection.variantGroupId
  );

  addDuplicateFieldIssue({
    values: groupIds,
    context,
    pathPrefix: ["variantGroups"],
    label: "variant group id"
  });
  addDuplicateFieldIssue({
    values: variantIds,
    context,
    pathPrefix: ["variantGroups"],
    label: "variant id"
  });
  addDuplicateFieldIssue({
    values: selectionGroupIds,
    context,
    pathPrefix: ["defaultActiveSelections"],
    label: "variant default active selection group id"
  });

  const groupsById = new Map(
    variants.variantGroups.map((group) => [group.variantGroupId, group])
  );
  const selectionsByGroupId = new Map(
    variants.defaultActiveSelections.map((selection) => [
      selection.variantGroupId,
      selection
    ])
  );

  variants.variantGroups.forEach((group, groupIndex) => {
    const selection = selectionsByGroupId.get(group.variantGroupId);
    if (selection === undefined) {
      context.addIssue({
        code: "custom",
        path: ["defaultActiveSelections"],
        message:
          `Runtime Export variants default active selections are missing group "${group.variantGroupId}".`
      });
      return;
    }

    if (!isSameVariantDefaultActiveSelection(selection.activeSelection, group.defaultActive)) {
      context.addIssue({
        code: "custom",
        path: ["variantGroups", groupIndex, "defaultActive"],
        message:
          `Runtime Export variants group defaultActive must match defaultActiveSelections for "${group.variantGroupId}".`
      });
    }
  });

  variants.defaultActiveSelections.forEach((selection, selectionIndex) => {
    const group = groupsById.get(selection.variantGroupId);
    if (group === undefined) {
      context.addIssue({
        code: "custom",
        path: ["defaultActiveSelections", selectionIndex, "variantGroupId"],
        message:
          `Runtime Export variants default active selection references missing group "${selection.variantGroupId}".`
      });
      return;
    }

    addVariantDefaultActiveSelectionIssues({
      group,
      selection: selection.activeSelection,
      context,
      path: ["defaultActiveSelections", selectionIndex, "activeSelection"]
    });
  });
});
export type RuntimeExportVariantsDto = z.infer<typeof RuntimeExportVariantsSchema>;

export const RuntimeExportModelSchema = z.object({
  schemaVersion: z.literal("runtime-export-model-v0"),
  sourcePackage: RuntimeExportSourcePackageSchema,
  canvas: RuntimeExportCanvasMetadataSchema,
  modelBounds: RectSchema,
  texturePages: z.array(RuntimeExportTexturePageReferenceSchema).min(1),
  parameters: z.array(RuntimeExportParameterSchema),
  inputManifest: RuntimeExportInputManifestSchema,
  drawables: z.array(RuntimeExportDrawableSchema),
  meshes: z.array(RuntimeExportMeshSchema),
  drawOrder: z.array(RuntimeExportDrawOrderEntrySchema),
  masks: z.array(RuntimeExportMaskRelationSchema),
  rigControls: z.array(RuntimeExportRigControlSchema),
  keyforms: z.array(RuntimeExportKeyformBindingSchema),
  dynamicsSolver: RuntimeExportDynamicsSolverContractSchema,
  dynamicsGroups: z.array(RuntimeExportDynamicsGroupSchema),
  variants: RuntimeExportVariantsSchema.optional(),
  renderAssumptions: RuntimeExportRenderAssumptionsSchema
}).strict().superRefine((model, context) => {
  addDuplicateFieldIssue({
    values: model.texturePages.map((page) => page.pageId),
    context,
    pathPrefix: ["texturePages"],
    label: "texture page id"
  });
  addDuplicateFieldIssue({
    values: model.texturePages.map((page) => page.path),
    context,
    pathPrefix: ["texturePages"],
    label: "texture page path"
  });
  addDuplicateFieldIssue({
    values: model.parameters.map((parameter) => parameter.parameterId),
    context,
    pathPrefix: ["parameters"],
    label: "parameter id"
  });
  addDuplicateFieldIssue({
    values: model.drawables.map((drawable) => drawable.drawableId),
    context,
    pathPrefix: ["drawables"],
    label: "drawable id"
  });
  addDuplicateFieldIssue({
    values: model.meshes.map((mesh) => mesh.meshId),
    context,
    pathPrefix: ["meshes"],
    label: "mesh id"
  });

  const parameterIds = new Set(model.parameters.map((parameter) => parameter.parameterId));
  const drawableIds = new Set(model.drawables.map((drawable) => drawable.drawableId));
  const meshIds = new Set(model.meshes.map((mesh) => mesh.meshId));
  const texturePageIds = new Set(model.texturePages.map((page) => page.pageId));

  model.drawables.forEach((drawable, index) => {
    if (!meshIds.has(drawable.meshId)) {
      context.addIssue({
        code: "custom",
        path: ["drawables", index, "meshId"],
        message: `Runtime Export drawable references missing mesh "${drawable.meshId}".`
      });
    }

    if (!texturePageIds.has(drawable.texture.pageId)) {
      context.addIssue({
        code: "custom",
        path: ["drawables", index, "texture", "pageId"],
        message: `Runtime Export drawable references missing texture page "${drawable.texture.pageId}".`
      });
    }
  });

  model.meshes.forEach((mesh, index) => {
    if (!drawableIds.has(mesh.drawableId)) {
      context.addIssue({
        code: "custom",
        path: ["meshes", index, "drawableId"],
        message: `Runtime Export mesh references missing drawable "${mesh.drawableId}".`
      });
    }

    if (!texturePageIds.has(mesh.texture.pageId)) {
      context.addIssue({
        code: "custom",
        path: ["meshes", index, "texture", "pageId"],
        message: `Runtime Export mesh references missing texture page "${mesh.texture.pageId}".`
      });
    }
  });

  model.drawOrder.forEach((entry, index) => {
    if (!drawableIds.has(entry.drawableId)) {
      context.addIssue({
        code: "custom",
        path: ["drawOrder", index, "drawableId"],
        message: `Runtime Export draw order references missing drawable "${entry.drawableId}".`
      });
    }
  });

  model.masks.forEach((mask, maskIndex) => {
    mask.sourceDrawableIds.forEach((drawableId, sourceIndex) => {
      if (!drawableIds.has(drawableId)) {
        context.addIssue({
          code: "custom",
          path: ["masks", maskIndex, "sourceDrawableIds", sourceIndex],
          message: `Runtime Export mask source references missing drawable "${drawableId}".`
        });
      }
    });
    mask.targetDrawableIds.forEach((drawableId, targetIndex) => {
      if (!drawableIds.has(drawableId)) {
        context.addIssue({
          code: "custom",
          path: ["masks", maskIndex, "targetDrawableIds", targetIndex],
          message: `Runtime Export mask target references missing drawable "${drawableId}".`
        });
      }
    });
  });

  model.variants?.variantGroups.forEach((group, groupIndex) => {
    group.targetDrawableIds.forEach((drawableId, targetIndex) => {
      if (!drawableIds.has(drawableId)) {
        context.addIssue({
          code: "custom",
          path: ["variants", "variantGroups", groupIndex, "targetDrawableIds", targetIndex],
          message: `Runtime Export variant target references missing drawable "${drawableId}".`
        });
      }
    });

    group.memberships.forEach((membership, membershipIndex) => {
      if (!drawableIds.has(membership.drawableId)) {
        context.addIssue({
          code: "custom",
          path: ["variants", "variantGroups", groupIndex, "memberships", membershipIndex, "drawableId"],
          message: `Runtime Export variant membership references missing drawable "${membership.drawableId}".`
        });
      }
    });
  });

  for (const [field, ids] of [
    ["externalInputParameterIds", model.inputManifest.externalInputParameterIds],
    ["computedDynamicsOutputParameterIds", model.inputManifest.computedDynamicsOutputParameterIds],
    ["hiddenDirectControlParameterIds", model.inputManifest.hiddenDirectControlParameterIds]
  ] as const) {
    ids.forEach((parameterId, index) => {
      if (!parameterIds.has(parameterId)) {
        context.addIssue({
          code: "custom",
          path: ["inputManifest", field, index],
          message: `Runtime Export input manifest references missing parameter "${parameterId}".`
        });
      }
    });
  }
});
export type RuntimeExportModelDto = z.infer<typeof RuntimeExportModelSchema>;

export const RuntimeExportAtlasPageSchema = RuntimeExportTexturePageMetadataSchema.safeExtend({
  textureId: TextureIdSchema
});
export type RuntimeExportAtlasPageDto = z.infer<typeof RuntimeExportAtlasPageSchema>;

export const RuntimeExportAtlasPlacementSchema = TextureAtlasPlacementSchema.extend({
  runtimeTexturePagePath: RuntimeExportTexturePagePathSchema
}).strict();
export type RuntimeExportAtlasPlacementDto = z.infer<
  typeof RuntimeExportAtlasPlacementSchema
>;

export const RuntimeExportAtlasSchema = z.object({
  schemaVersion: z.literal("runtime-export-atlas-v0"),
  sourceSignature: TextureAtlasSourceSignatureSchema,
  settings: TextureAtlasLayoutSettingsSchema,
  pages: z.array(RuntimeExportAtlasPageSchema).min(1),
  placements: z.array(RuntimeExportAtlasPlacementSchema)
}).strict().superRefine((atlas, context) => {
  addDuplicateFieldIssue({
    values: atlas.pages.map((page) => page.pageId),
    context,
    pathPrefix: ["pages"],
    label: "atlas page id"
  });
  addDuplicateFieldIssue({
    values: atlas.pages.map((page) => page.path),
    context,
    pathPrefix: ["pages"],
    label: "atlas page path"
  });
  addDuplicateFieldIssue({
    values: atlas.placements.map((placement) => placement.placementId),
    context,
    pathPrefix: ["placements"],
    label: "atlas placement id"
  });

  const pageIds = new Set(atlas.pages.map((page) => page.pageId));
  atlas.placements.forEach((placement, index) => {
    if (!pageIds.has(placement.pageId)) {
      context.addIssue({
        code: "custom",
        path: ["placements", index, "pageId"],
        message: `Runtime Export atlas placement references missing page "${placement.pageId}".`
      });
    }
  });
});
export type RuntimeExportAtlasDto = z.infer<typeof RuntimeExportAtlasSchema>;

export const RuntimeExportArtifactsSchema = z.object({
  manifest: RuntimeExportManifestSchema,
  model: RuntimeExportModelSchema,
  atlas: RuntimeExportAtlasSchema
}).strict();
export type RuntimeExportArtifactsDto = z.infer<typeof RuntimeExportArtifactsSchema>;

export function isRuntimeExportTexturePagePath(path: string): boolean {
  const fileName = path.slice(RUNTIME_EXPORT_TEXTURE_PAGE_PATH_PREFIX.length);

  return isPackageRelativePath(path) &&
    path.startsWith(RUNTIME_EXPORT_TEXTURE_PAGE_PATH_PREFIX) &&
    path.endsWith(RUNTIME_EXPORT_TEXTURE_PAGE_EXTENSION) &&
    fileName.length > RUNTIME_EXPORT_TEXTURE_PAGE_EXTENSION.length &&
    !fileName.includes("/");
}

export function isRuntimeExportFilePath(path: string): boolean {
  return RuntimeExportFilePathSchema.safeParse(path).success;
}

export function parseRuntimeExportManifest(
  input: unknown
): PackageParseResult<RuntimeExportManifestDto> {
  return toPackageParseResult(RuntimeExportManifestSchema.safeParse(input));
}

export function parseRuntimeExportModel(
  input: unknown
): PackageParseResult<RuntimeExportModelDto> {
  return toPackageParseResult(RuntimeExportModelSchema.safeParse(input));
}

export function parseRuntimeExportAtlas(
  input: unknown
): PackageParseResult<RuntimeExportAtlasDto> {
  return toPackageParseResult(RuntimeExportAtlasSchema.safeParse(input));
}

export function parseRuntimeExportArtifacts(
  input: unknown
): PackageParseResult<RuntimeExportArtifactsDto> {
  return toPackageParseResult(RuntimeExportArtifactsSchema.safeParse(input));
}

export function assertRuntimeExportV0SinglePageArtifacts(
  input: unknown
): RuntimeExportArtifactsDto {
  const artifacts = RuntimeExportArtifactsSchema.parse(input);

  assertSinglePage("manifest.paths.texturePages", artifacts.manifest.paths.texturePages);
  assertSinglePage("manifest.texturePages", artifacts.manifest.texturePages);
  assertSinglePage("model.texturePages", artifacts.model.texturePages);
  assertSinglePage("atlas.pages", artifacts.atlas.pages);

  const manifestPage = artifacts.manifest.texturePages[0];
  const modelPage = artifacts.model.texturePages[0];
  const atlasPage = artifacts.atlas.pages[0];

  if (manifestPage === undefined || modelPage === undefined || atlasPage === undefined) {
    throw new RuntimeExportContractError("Runtime Export v0 requires one texture page.");
  }

  assertPageIdentityConsistency("model.texturePages[0]", manifestPage, modelPage);
  assertPageIdentityConsistency("atlas.pages[0]", manifestPage, atlasPage);

  if (artifacts.manifest.paths.texturePages[0] !== manifestPage.path) {
    throw new RuntimeExportContractError(
      "Runtime Export v0 manifest texture page path must match texture page metadata."
    );
  }

  return artifacts;
}

function assertSinglePage(label: string, values: readonly unknown[]): void {
  if (values.length !== 1) {
    throw new RuntimeExportContractError(
      `Runtime Export v0 requires exactly one texture page in ${label}.`
    );
  }
}

function assertPageIdentityConsistency(
  label: string,
  expected: RuntimeExportTexturePageMetadataDto,
  actual: Pick<RuntimeExportTexturePageMetadataDto, "pageId" | "path" | "width" | "height" | "pixelFormat">
): void {
  if (
    actual.pageId !== expected.pageId ||
    actual.path !== expected.path ||
    actual.width !== expected.width ||
    actual.height !== expected.height ||
    actual.pixelFormat !== expected.pixelFormat
  ) {
    throw new RuntimeExportContractError(
      `Runtime Export v0 ${label} page identity must match manifest.texturePages[0].`
    );
  }
}

function addRawRgbaByteLengthIssue(input: {
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly path: readonly (string | number)[];
  readonly context: z.RefinementCtx;
}): void {
  const expectedByteLength = input.width * input.height * 4;

  if (!Number.isSafeInteger(expectedByteLength)) {
    input.context.addIssue({
      code: "custom",
      path: [...input.path],
      message: "Runtime Export raw RGBA dimensions exceed safe byte length range."
    });
    return;
  }

  if (input.byteLength !== expectedByteLength) {
    input.context.addIssue({
      code: "custom",
      path: [...input.path],
      message: `Runtime Export raw RGBA byteLength must equal width * height * 4 (${expectedByteLength}).`
    });
  }
}

function addVariantDefaultActiveSelectionIssues(input: {
  readonly group: VariantGroupDto;
  readonly selection: VariantDefaultActiveSelectionDto;
  readonly context: z.RefinementCtx;
  readonly path: readonly (string | number)[];
}): void {
  if (input.selection.kind !== input.group.mode) {
    input.context.addIssue({
      code: "custom",
      path: [...input.path, "kind"],
      message:
        `Runtime Export variant default active selection kind must match group mode "${input.group.mode}".`
    });
    return;
  }

  const variantIds = new Set(input.group.variants.map((variant) => variant.variantId));

  if (input.selection.kind === "singleSelect") {
    if (!variantIds.has(input.selection.variantId)) {
      input.context.addIssue({
        code: "custom",
        path: [...input.path, "variantId"],
        message:
          `Runtime Export variant default active selection references missing Variant "${input.selection.variantId}".`
      });
    }
    return;
  }

  input.selection.variantIds.forEach((variantId, index) => {
    if (!variantIds.has(variantId)) {
      input.context.addIssue({
        code: "custom",
        path: [...input.path, "variantIds", index],
        message:
          `Runtime Export variant default active selection references missing Variant "${variantId}".`
      });
    }
  });
}

function isSameVariantDefaultActiveSelection(
  left: VariantDefaultActiveSelectionDto,
  right: VariantDefaultActiveSelectionDto
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "singleSelect" && right.kind === "singleSelect") {
    return left.variantId === right.variantId;
  }

  if (left.kind === "multiToggle" && right.kind === "multiToggle") {
    return (
      left.variantIds.length === right.variantIds.length &&
      left.variantIds.every((variantId, index) => right.variantIds[index] === variantId)
    );
  }

  return false;
}

function addDuplicateFieldIssue(input: {
  readonly values: readonly string[];
  readonly context: z.RefinementCtx;
  readonly pathPrefix: readonly (string | number)[];
  readonly label: string;
}): void {
  const seen = new Map<string, number>();

  input.values.forEach((value, index) => {
    const firstIndex = seen.get(value);
    if (firstIndex !== undefined) {
      input.context.addIssue({
        code: "custom",
        path: [...input.pathPrefix, index],
        message:
          `Duplicate Runtime Export ${input.label} "${value}" also appears at index ${firstIndex}.`
      });
      return;
    }

    seen.set(value, index);
  });
}
