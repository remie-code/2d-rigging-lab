import type {
  DrawableId,
  MeshId,
  RectDto,
  RigControlId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  RUNTIME_EXPORT_ATLAS_PATH,
  RUNTIME_EXPORT_MANIFEST_PATH,
  RUNTIME_EXPORT_MODEL_PATH,
  RUNTIME_EXPORT_PIXEL_FORMAT,
  RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION,
  RuntimeExportAtlasSchema,
  RuntimeExportModelSchema,
  assertRuntimeExportV0SinglePageArtifacts,
  type BinaryAssetReferenceDto,
  type MeshDto,
  type RuntimeExportArtifactsDto,
  type RuntimeExportAtlasDto,
  type RuntimeExportDrawableTextureReferenceDto,
  type RuntimeExportKeyformBindingDto,
  type RuntimeExportManifestDto,
  type RuntimeExportModelDto,
  type RuntimeExportParameterDto,
  type RuntimeExportRenderAssumptionsDto,
  type RuntimeExportTexturePageMetadataDto,
  type RuntimeExportTexturePagePathDto,
  type RuntimeExportVariantsDto,
  type TextureAtlasEntryDto,
  type TextureAtlasLayoutSummaryDto,
  type TextureAtlasPageDto,
  type TextureAtlasPlacementDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import type {
  RuntimeExportAssemblyOptions,
  RuntimeExportPreflightBlocker
} from "./runtime-export-assembly.js";
import { toRuntimeGraph } from "./to-runtime-graph.js";
import type { TextureAtlasTargetSelectionResult } from "./texture-atlas-targets.js";
import {
  createVariantVisibilityPredicate,
  resolveDefaultVariantActiveSelections,
  type VariantActiveSelectionEntry
} from "./variant-evaluation.js";

type RuntimeExportKeyformProjection =
  ReturnType<typeof toRuntimeGraph>["keyformBindings"][number];

export interface RuntimeExportAtlasContext {
  readonly layoutSummary: TextureAtlasLayoutSummaryDto;
  readonly page: TextureAtlasPageDto;
  readonly textureEntry: TextureAtlasEntryDto;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly pageBytes: Uint8Array;
  readonly runtimeTexturePagePath: RuntimeExportTexturePagePathDto;
  readonly texturePageMetadata: RuntimeExportTexturePageMetadataDto;
  readonly placementsByDrawableId: ReadonlyMap<DrawableId, TextureAtlasPlacementDto>;
  readonly targetSelection: TextureAtlasTargetSelectionResult;
}

export class RuntimeExportMaterializationError extends Error {
  constructor(
    message: string,
    readonly blocker: RuntimeExportPreflightBlocker
  ) {
    super(message);
    this.name = "RuntimeExportMaterializationError";
  }
}

export const createRuntimeExportArtifacts = (input: {
  readonly session: AuthoringSession;
  readonly atlasContext: RuntimeExportAtlasContext;
  readonly options: RuntimeExportAssemblyOptions;
}): RuntimeExportArtifactsDto => {
  const runtimeGraph = toRuntimeGraph(input.session, {
    ...(input.options.packageHash === undefined
      ? {}
      : { packageHash: input.options.packageHash })
  });
  const includedTargets = input.atlasContext.targetSelection.packableTargets.filter((target) =>
    input.atlasContext.placementsByDrawableId.has(target.drawable.drawableId)
  );
  const includedDrawableIds = new Set(includedTargets.map((target) => target.drawable.drawableId));
  const includedMeshIds = new Set(includedTargets.map((target) => target.mesh.meshId));
  const includedRigControlIds = createIncludedRigControlIdSet(
    input.session,
    includedDrawableIds
  );
  const variantGroups = input.session.graph.variantGroups ?? [];
  const defaultVariantActiveSelections = resolveDefaultVariantActiveSelections(variantGroups);
  const variantVisibilityPredicate = createVariantVisibilityPredicate({
    variantGroups,
    activeSelections: defaultVariantActiveSelections
  });
  const textureRefByDrawableId = new Map<DrawableId, RuntimeExportDrawableTextureReferenceDto>();

  for (const target of includedTargets) {
    const placement = input.atlasContext.placementsByDrawableId.get(target.drawable.drawableId);
    if (placement === undefined) {
      continue;
    }
    textureRefByDrawableId.set(target.drawable.drawableId, {
      pageId: input.atlasContext.page.pageId,
      path: input.atlasContext.runtimeTexturePagePath,
      placementId: placement.placementId
    });
  }

  const renderAssumptions = createRuntimeExportRenderAssumptions();
  const sourcePackage = {
    packageId: input.session.packageIdentity.packageId,
    packageDisplayName: input.session.packageIdentity.packageDisplayName,
    packageRevision: input.session.packageRevision,
    ...(input.options.packageHash === undefined
      ? {}
      : { packageHash: input.options.packageHash })
  };
  const canvas = createRuntimeExportCanvas(input.session);
  const modelBounds = createRuntimeExportModelBounds(includedTargets);
  const texturePages = [input.atlasContext.texturePageMetadata];
  const texturePageRefs = texturePages.map((page) => ({
    pageId: page.pageId,
    path: page.path,
    width: page.width,
    height: page.height,
    pixelFormat: page.pixelFormat
  }));
  const parameters = createRuntimeExportParameters(runtimeGraph.parameters);
  const inputManifest = createRuntimeExportInputManifest(parameters);
  const drawables = includedTargets.map((target) => {
    const normalizedDrawable = runtimeGraph.drawables.get(target.drawable.drawableId);
    const texture = textureRefByDrawableId.get(target.drawable.drawableId);

    if (normalizedDrawable === undefined || texture === undefined) {
      throw new Error(`Missing runtime drawable projection for ${target.drawable.drawableId}.`);
    }

    return {
      drawableId: target.drawable.drawableId,
      displayName: target.drawable.displayName,
      meshId: target.mesh.meshId,
      ...(target.drawable.partId === undefined ? {} : { partId: target.drawable.partId }),
      includeReason: "runtime-target-v1" as const,
      visible: normalizedDrawable.visible &&
        variantVisibilityPredicate(target.drawable.drawableId),
      opacity: normalizedDrawable.opacity,
      baseDrawOrder: normalizedDrawable.baseDrawOrder,
      bounds: structuredClone(normalizedDrawable.bounds),
      texture
    };
  });
  const meshes = includedTargets.map((target) => {
    const placement = input.atlasContext.placementsByDrawableId.get(target.drawable.drawableId);
    const texture = textureRefByDrawableId.get(target.drawable.drawableId);

    if (placement === undefined || texture === undefined) {
      throw new Error(`Missing atlas placement for ${target.drawable.drawableId}.`);
    }

    return {
      meshId: target.mesh.meshId,
      drawableId: target.drawable.drawableId,
      vertices: structuredClone(target.mesh.vertices),
      atlasUvs: target.mesh.uvs.map((uv) => mapSourceUvToAtlasUv(uv, placement)),
      uvSpace: "atlas-normalized-v1" as const,
      triangles: structuredClone(target.mesh.triangles),
      vertexStableIds: structuredClone(target.mesh.vertexStableIds),
      ...(target.mesh.triangleStableIds === undefined
        ? {}
        : { triangleStableIds: structuredClone(target.mesh.triangleStableIds) }),
      ...(target.mesh.topologyRevision === undefined
        ? {}
        : { topologyRevision: target.mesh.topologyRevision }),
      bounds: structuredClone(target.mesh.bounds),
      texture
    };
  });
  const masks = createRuntimeExportMasks(input.session, includedDrawableIds);
  const model = RuntimeExportModelSchema.parse({
    schemaVersion: "runtime-export-model-v0",
    sourcePackage,
    canvas,
    modelBounds,
    texturePages: texturePageRefs,
    parameters,
    inputManifest,
    drawables,
    meshes,
    drawOrder: runtimeGraph.drawOrder
      .filter((entry) => includedDrawableIds.has(entry.drawableId))
      .map((entry, index) => ({
        drawableId: entry.drawableId,
        drawOrder: index
      })),
    masks,
    rigControls: input.session.graph.rigControls
      .filter((rigControl) => includedRigControlIds.has(rigControl.rigControlId))
      .map((rigControl) => materializeRuntimeExportRigControl(
        rigControl,
        includedDrawableIds,
        includedRigControlIds
      )),
    keyforms: runtimeGraph.keyformBindings
      .filter((binding) => isRuntimeExportKeyformIncluded(binding, {
        includedDrawableIds,
        includedMeshIds,
        includedRigControlIds
      }))
      .map(materializeRuntimeExportKeyformBinding),
    dynamicsSolver: renderAssumptions.dynamics,
    dynamicsGroups: [...runtimeGraph.dynamicsGroups.values()].map((group) => structuredClone(group)),
    ...(variantGroups.length === 0
      ? {}
      : {
          variants: createRuntimeExportVariants(
            variantGroups,
            defaultVariantActiveSelections
          )
        }),
    renderAssumptions
  }) satisfies RuntimeExportModelDto;
  const atlas = RuntimeExportAtlasSchema.parse({
    schemaVersion: "runtime-export-atlas-v0",
    sourceSignature: input.atlasContext.layoutSummary.sourceSignature,
    settings: input.atlasContext.layoutSummary.settings,
    pages: texturePages,
    placements: includedTargets.map((target) => {
      const placement = input.atlasContext.placementsByDrawableId.get(target.drawable.drawableId);
      if (placement === undefined) {
        throw new Error(`Missing atlas placement for ${target.drawable.drawableId}.`);
      }

      return {
        ...structuredClone(placement),
        runtimeTexturePagePath: input.atlasContext.runtimeTexturePagePath
      };
    })
  }) satisfies RuntimeExportAtlasDto;
  const manifest = {
    schemaVersion: "runtime-export-manifest-v0",
    exportFormatVersion: "runtime-export-v0",
    sourcePackage,
    createdAt: input.options.createdAt ?? new Date().toISOString(),
    paths: {
      manifest: RUNTIME_EXPORT_MANIFEST_PATH,
      model: RUNTIME_EXPORT_MODEL_PATH,
      atlas: RUNTIME_EXPORT_ATLAS_PATH,
      texturePages: texturePages.map((page) => page.path)
    },
    canvas,
    modelBounds,
    texturePages,
    requiredCapabilities: [
      "directory-runtime-export-v0",
      "raw-rgba8-texture-pages-v1",
      "materialized-atlas-uvs-v1",
      "transparent-background-v1",
      "alpha-mask-clipping-v1",
      "dynamics-pendulum-solver-v1"
    ],
    renderAssumptions
  } satisfies RuntimeExportManifestDto;

  return assertRuntimeExportV0SinglePageArtifacts({
    manifest,
    model,
    atlas
  });
};

const createRuntimeExportParameters = (
  parameters: ReadonlyMap<string, {
    readonly id: string;
    readonly displayName: string;
    readonly semanticRole?: RuntimeExportParameterDto["semanticRole"];
    readonly projectPresetAlias?: string;
    readonly valueSource: RuntimeExportParameterDto["valueSource"];
    readonly min: number;
    readonly max: number;
    readonly default: number;
  }>
): readonly RuntimeExportParameterDto[] =>
  [...parameters.values()].map((parameter) => {
    const runtimeRole = parameter.valueSource === "computedDynamics"
      ? "computed-dynamics-output"
      : parameter.valueSource === "debugOverride"
        ? "hidden-from-direct-controls"
        : "external-input";

    return {
      parameterId: parameter.id as RuntimeExportParameterDto["parameterId"],
      displayName: parameter.displayName,
      ...(parameter.semanticRole === undefined ? {} : { semanticRole: parameter.semanticRole }),
      ...(parameter.projectPresetAlias === undefined
        ? {}
        : { projectPresetAlias: parameter.projectPresetAlias }),
      valueSource: parameter.valueSource,
      runtimeRole,
      externalInput: runtimeRole === "external-input",
      readOnly: runtimeRole !== "external-input",
      min: parameter.min,
      max: parameter.max,
      default: parameter.default
    };
  });

const createRuntimeExportInputManifest = (
  parameters: readonly RuntimeExportParameterDto[]
): RuntimeExportModelDto["inputManifest"] => ({
  externalInputParameterIds: parameters
    .filter((parameter) => parameter.runtimeRole === "external-input")
    .map((parameter) => parameter.parameterId),
  computedDynamicsOutputParameterIds: parameters
    .filter((parameter) => parameter.runtimeRole === "computed-dynamics-output")
    .map((parameter) => parameter.parameterId),
  hiddenDirectControlParameterIds: parameters
    .filter((parameter) => parameter.runtimeRole === "hidden-from-direct-controls")
    .map((parameter) => parameter.parameterId)
});

const createRuntimeExportVariants = (
  variantGroups: RuntimeExportVariantsDto["variantGroups"],
  defaultActiveSelections: readonly VariantActiveSelectionEntry[]
): RuntimeExportVariantsDto => ({
  schemaVersion: RUNTIME_EXPORT_VARIANTS_SCHEMA_VERSION,
  variantGroups: structuredClone(variantGroups),
  defaultActiveSelections: defaultActiveSelections.map((selection) => ({
    variantGroupId: selection.variantGroupId,
    activeSelection: structuredClone(selection.activeSelection)
  }))
});

const createRuntimeExportMasks = (
  session: AuthoringSession,
  includedDrawableIds: ReadonlySet<DrawableId>
): RuntimeExportModelDto["masks"] =>
  session.graph.masks.flatMap((mask) => {
    if (!mask.enabled) {
      return [];
    }

    const includedTargets = mask.targetDrawableIds.filter((drawableId) =>
      includedDrawableIds.has(drawableId)
    );
    if (includedTargets.length === 0) {
      return [];
    }

    const missingSources = mask.maskDrawableIds.filter((drawableId) =>
      !includedDrawableIds.has(drawableId)
    );
    if (missingSources.length > 0) {
      throw new RuntimeExportMaterializationError(
        `Runtime Export does not support mask relation ${mask.maskRelationId} because source drawables are excluded.`,
        createMaterializationBlocker({
          code: "runtimeExport.unsupportedMaskReference",
          targetPath: `/model/masks/${mask.maskRelationId}`,
          message: "Mask relation for an included drawable references excluded source drawables.",
          details: [
            `maskRelationId=${mask.maskRelationId}`,
            `missingSourceDrawableIds=${missingSources.join(",")}`
          ]
        })
      );
    }

    return [{
      maskRelationId: mask.maskRelationId,
      sourceDrawableIds: [...mask.maskDrawableIds],
      targetDrawableIds: includedTargets,
      clippingMode: "alpha-mask-v1" as const,
      coordinateSpace: "canvas-y-down-v1" as const
    }];
  });

const createIncludedRigControlIdSet = (
  session: AuthoringSession,
  includedDrawableIds: ReadonlySet<DrawableId>
): ReadonlySet<RigControlId> => {
  const rigControlsById = new Map(
    session.graph.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );
  const containsCache = new Map<RigControlId, boolean>();
  const visiting = new Set<RigControlId>();
  const containsIncludedDrawable = (rigControlId: RigControlId): boolean => {
    const cached = containsCache.get(rigControlId);
    if (cached !== undefined) {
      return cached;
    }

    if (visiting.has(rigControlId)) {
      return false;
    }

    visiting.add(rigControlId);
    const rigControl = rigControlsById.get(rigControlId);
    const contains = rigControl !== undefined && (
      rigControl.childDrawableIds.some((drawableId) => includedDrawableIds.has(drawableId)) ||
      rigControl.childRigControlIds.some((childId) => containsIncludedDrawable(childId))
    );
    visiting.delete(rigControlId);
    containsCache.set(rigControlId, contains);

    return contains;
  };

  return new Set(
    session.graph.rigControls
      .filter((rigControl) => containsIncludedDrawable(rigControl.rigControlId))
      .map((rigControl) => rigControl.rigControlId)
  );
};

const materializeRuntimeExportRigControl = (
  rigControl: AuthoringSession["graph"]["rigControls"][number],
  includedDrawableIds: ReadonlySet<DrawableId>,
  includedRigControlIds: ReadonlySet<RigControlId>
): RuntimeExportModelDto["rigControls"][number] => {
  const common = {
    rigControlId: rigControl.rigControlId,
    displayName: rigControl.displayName,
    ...(rigControl.parentId === undefined || !includedRigControlIds.has(rigControl.parentId)
      ? {}
      : { parentId: rigControl.parentId }),
    childDrawableIds: rigControl.childDrawableIds.filter((drawableId) =>
      includedDrawableIds.has(drawableId)
    ),
    childRigControlIds: rigControl.childRigControlIds.filter((rigControlId) =>
      includedRigControlIds.has(rigControlId)
    ),
    ...(rigControl.opacityMultiplier === undefined
      ? {}
      : { opacityMultiplier: rigControl.opacityMultiplier }),
    enabled: rigControl.enabled
  };

  if (rigControl.kind === "rotation2d") {
    return {
      kind: "rotation2d",
      ...common,
      pivot: structuredClone(rigControl.pivot),
      restAngleDegrees: rigControl.restAngleDegrees,
      restTranslation: structuredClone(rigControl.restTranslation),
      restScale: structuredClone(rigControl.restScale)
    };
  }

  return {
    kind: "warpLattice2d",
    ...common,
    bindSpace: rigControl.bindSpace,
    domainBounds: structuredClone(rigControl.domainBounds),
    latticeColumns: rigControl.latticeColumns,
    latticeRows: rigControl.latticeRows,
    restControlPoints: structuredClone(rigControl.restControlPoints),
    interpolationMethod: rigControl.interpolationMethod
  };
};

const isRuntimeExportKeyformIncluded = (
  binding: Pick<RuntimeExportKeyformProjection, "targetId" | "targetKind">,
  input: {
    readonly includedDrawableIds: ReadonlySet<DrawableId>;
    readonly includedMeshIds: ReadonlySet<MeshId>;
    readonly includedRigControlIds: ReadonlySet<RigControlId>;
  }
): boolean => {
  if (binding.targetKind === "drawable") {
    return input.includedDrawableIds.has(binding.targetId as DrawableId);
  }

  if (binding.targetKind === "mesh") {
    return input.includedMeshIds.has(binding.targetId as MeshId);
  }

  return input.includedRigControlIds.has(binding.targetId as RigControlId);
};

const materializeRuntimeExportKeyformBinding = (
  binding: RuntimeExportKeyformProjection
): RuntimeExportKeyformBindingDto => {
  if (binding.evaluator === "linear-1d-v1") {
    return {
      evaluator: "linear-1d-v1",
      keyformSetId: binding.keyformSetId,
      targetId: binding.targetId,
      targetKind: binding.targetKind,
      targetProperty: binding.targetProperty,
      parameterId: binding.parameterId,
      keys: binding.keys.map((key) => ({
        value: key.value,
        statePatch: structuredClone(key.statePatch)
      })),
      compositionMode: binding.compositionMode,
      compositionOrder: binding.compositionOrder
    } as RuntimeExportKeyformBindingDto;
  }

  return {
    evaluator: "parameter-grid-2d-v1",
    keyformSetId: binding.keyformSetId,
    targetId: binding.targetId,
    targetKind: binding.targetKind,
    targetProperty: binding.targetProperty,
    parameterX: binding.parameterX,
    parameterY: binding.parameterY,
    interpolation: binding.interpolation,
    clampPolicy: binding.clampPolicy,
    missingKeyPolicy: binding.missingKeyPolicy,
    keys: binding.keys.map((key) => ({
      x: key.x,
      y: key.y,
      statePatch: structuredClone(key.statePatch)
    })),
    compositionMode: binding.compositionMode,
    compositionOrder: binding.compositionOrder
  } as RuntimeExportKeyformBindingDto;
};

const mapSourceUvToAtlasUv = (
  uv: Vec2Dto,
  placement: TextureAtlasPlacementDto
): Vec2Dto => {
  const sourcePixelX = uv.x * placement.sourceTextureSize.width;
  const sourcePixelY = uv.y * placement.sourceTextureSize.height;
  const localX = (
    sourcePixelX - placement.sourceRectPixels.x
  ) / placement.sourceRectPixels.width;
  const localY = (
    sourcePixelY - placement.sourceRectPixels.y
  ) / placement.sourceRectPixels.height;
  const uvWidth = placement.uvRect.bottomRight.x - placement.uvRect.topLeft.x;
  const uvHeight = placement.uvRect.bottomRight.y - placement.uvRect.topLeft.y;

  return {
    x: placement.uvRect.topLeft.x + localX * uvWidth,
    y: placement.uvRect.topLeft.y + localY * uvHeight
  };
};

const createRuntimeExportCanvas = (
  session: AuthoringSession
): RuntimeExportModelDto["canvas"] => ({
  coordinateSystem: "canvas-y-down-v1",
  size: {
    width: session.graph.canvasSize.width,
    height: session.graph.canvasSize.height
  },
  bounds: {
    x: 0,
    y: 0,
    width: session.graph.canvasSize.width,
    height: session.graph.canvasSize.height
  }
});

const createRuntimeExportModelBounds = (
  targets: readonly { readonly mesh: MeshDto }[]
): RectDto => {
  if (targets.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const firstBounds = targets[0]?.mesh.bounds;
  if (firstBounds === undefined) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let left = firstBounds.x;
  let top = firstBounds.y;
  let right = firstBounds.x + firstBounds.width;
  let bottom = firstBounds.y + firstBounds.height;

  for (const target of targets.slice(1)) {
    left = Math.min(left, target.mesh.bounds.x);
    top = Math.min(top, target.mesh.bounds.y);
    right = Math.max(right, target.mesh.bounds.x + target.mesh.bounds.width);
    bottom = Math.max(bottom, target.mesh.bounds.y + target.mesh.bounds.height);
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
};

const createRuntimeExportRenderAssumptions = (): RuntimeExportRenderAssumptionsDto => ({
  transparentBackground: true,
  pixelFormat: RUNTIME_EXPORT_PIXEL_FORMAT,
  alphaMode: "straight-alpha-v1",
  colorSpace: "srgb-v1",
  textureFiltering: "linear-v1",
  blendMode: "source-over-v1",
  masking: {
    clippingMode: "alpha-mask-v1",
    coordinateSpace: "canvas-y-down-v1",
    maskChannels: "alpha-v1"
  },
  dynamics: {
    solverVersion: "runtime-dynamics-pendulum-v1",
    fixedStepMs: 1000 / 60,
    resetPolicy: "reset-to-default-parameters-v1"
  }
});

const createMaterializationBlocker = (
  input: RuntimeExportPreflightBlocker
): RuntimeExportPreflightBlocker => ({
  code: input.code,
  message: input.message,
  targetPath: input.targetPath,
  details: [...input.details]
});
