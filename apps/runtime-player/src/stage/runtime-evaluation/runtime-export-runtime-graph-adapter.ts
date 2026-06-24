import type {
  DrawableId,
  DynamicsGroupId,
  MeshId,
  ParameterId,
  RectDto,
  RigControlId,
  TextureId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeExportAtlasDto,
  RuntimeExportAtlasPageDto,
  RuntimeExportDrawableTextureReferenceDto,
  RuntimeExportInputManifestDto,
  RuntimeExportMeshDto,
  RuntimeExportModelDto,
  RuntimeExportTexturePageMetadataDto,
  RuntimeExportTexturePageReferenceDto
} from "@private-2d-rigging-lab/package-format";
import type {
  KeyformBinding,
  NormalizedDrawable,
  NormalizedDrawableTextureReference,
  NormalizedDynamicsGroup,
  NormalizedMeshTriangle,
  NormalizedParameter,
  NormalizedRigControlNode,
  NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import {
  resolveRuntimeVariantDrawableVisible
} from "../../shared/runtime-export-variant-selection";

export interface RuntimeExportRuntimeGraphAdapterInput {
  readonly model: RuntimeExportModelDto;
  readonly atlas?: RuntimeExportAtlasDto;
  readonly texturePages?: readonly RuntimeExportTexturePageMetadataDto[];
  readonly activeVariantSelection?: RuntimePlayerActiveVariantSelectionState | null;
}

export interface RuntimeExportDrawableRenderResource {
  readonly drawableId: DrawableId;
  readonly meshId: MeshId;
  readonly texture: RuntimeExportDrawableTextureReferenceDto;
  readonly restVertices: readonly Vec2Dto[];
  readonly atlasUvs: readonly Vec2Dto[];
  readonly triangles: readonly NormalizedMeshTriangle[];
}

export interface RuntimeExportTextureRenderResource {
  readonly pageId: string;
  readonly path: string;
  readonly textureId?: TextureId;
  readonly width: number;
  readonly height: number;
  readonly pixelFormat: "rgba8";
}

export interface RuntimeExportRuntimeGraphRenderResources {
  readonly texturePages: readonly RuntimeExportTextureRenderResource[];
  readonly drawableRenderResources: ReadonlyMap<DrawableId, RuntimeExportDrawableRenderResource>;
  readonly inputManifest: RuntimeExportInputManifestDto;
}

export interface RuntimeExportRuntimeGraphAdapterResult {
  readonly graph: NormalizedRuntimeGraph;
  readonly renderResources: RuntimeExportRuntimeGraphRenderResources;
}

export function createRuntimeExportRuntimeGraph(
  input: RuntimeExportRuntimeGraphAdapterInput
): RuntimeExportRuntimeGraphAdapterResult {
  const meshesById = new Map(input.model.meshes.map((mesh) => [mesh.meshId, mesh]));
  const textureLookup = createTextureLookup(input);
  const graph: NormalizedRuntimeGraph = {
    packageId: input.model.sourcePackage.packageId,
    packageRevision: input.model.sourcePackage.packageRevision,
    ...(input.model.sourcePackage.packageHash === undefined
      ? {}
      : { packageHash: input.model.sourcePackage.packageHash }),
    coordinateSystem: input.model.canvas.coordinateSystem,
    parameters: createParameterMap(input.model),
    dynamicsGroups: createDynamicsGroupMap(input.model),
    drawables: createDrawableMap({
      model: input.model,
      meshesById,
      textureLookup,
      activeVariantSelection: input.activeVariantSelection ?? null
    }),
    rigControls: createRigControlMap(input.model),
    keyformBindings: input.model.keyforms.map(cloneKeyformBinding),
    masks: input.model.masks.map((mask) => ({
      maskRelationId: mask.maskRelationId,
      sourceDrawableIds: [...mask.sourceDrawableIds],
      targetDrawableIds: [...mask.targetDrawableIds]
    })),
    drawOrder: input.model.drawOrder.map((entry) => ({
      drawableId: entry.drawableId,
      drawOrder: entry.drawOrder
    })),
    disabledFutureLayers: []
  };

  return {
    graph,
    renderResources: {
      texturePages: createTextureRenderResources(input, textureLookup),
      drawableRenderResources: createDrawableRenderResourceMap(input.model, meshesById),
      inputManifest: {
        externalInputParameterIds: [...input.model.inputManifest.externalInputParameterIds],
        computedDynamicsOutputParameterIds: [...input.model.inputManifest.computedDynamicsOutputParameterIds],
        hiddenDirectControlParameterIds: [...input.model.inputManifest.hiddenDirectControlParameterIds]
      }
    }
  };
}

function createParameterMap(
  model: RuntimeExportModelDto
): ReadonlyMap<ParameterId, NormalizedParameter> {
  return new Map(
    model.parameters.map((parameter) => [
      parameter.parameterId,
      {
        id: parameter.parameterId,
        displayName: parameter.displayName,
        ...(parameter.semanticRole === undefined ? {} : { semanticRole: parameter.semanticRole }),
        ...(parameter.projectPresetAlias === undefined
          ? {}
          : { projectPresetAlias: parameter.projectPresetAlias }),
        valueSource: parameter.valueSource,
        min: parameter.min,
        max: parameter.max,
        default: parameter.default
      }
    ])
  );
}

function createDynamicsGroupMap(
  model: RuntimeExportModelDto
): ReadonlyMap<DynamicsGroupId, NormalizedDynamicsGroup> {
  return new Map(
    model.dynamicsGroups.map((group) => [
      group.dynamicsGroupId,
      {
        dynamicsGroupId: group.dynamicsGroupId,
        displayName: group.displayName,
        enabled: group.enabled,
        ...(group.presetId === undefined ? {} : { presetId: group.presetId }),
        inputs: group.inputs.map((input) => ({
          parameterId: input.parameterId,
          kind: input.kind,
          influencePercent: input.influencePercent,
          invert: input.invert,
          normalization: { ...input.normalization }
        })),
        pendulums: group.pendulums.map((pendulum) => ({ ...pendulum })),
        outputs: group.outputs.map((output) => ({ ...output }))
      }
    ])
  );
}

function createDrawableMap(input: {
  readonly model: RuntimeExportModelDto;
  readonly meshesById: ReadonlyMap<MeshId, RuntimeExportMeshDto>;
  readonly textureLookup: TextureLookup;
  readonly activeVariantSelection: RuntimePlayerActiveVariantSelectionState | null;
}
): ReadonlyMap<DrawableId, NormalizedDrawable> {
  return new Map(
    input.model.drawables.map((drawable) => {
      const mesh = input.meshesById.get(drawable.meshId);
      if (mesh === undefined) {
        throw new Error(`runtime export drawable "${drawable.drawableId}" is missing mesh "${drawable.meshId}".`);
      }

      return [
        drawable.drawableId,
        {
          drawableId: drawable.drawableId,
          meshId: drawable.meshId,
          ...(drawable.partId === undefined ? {} : { partId: drawable.partId }),
          texture: createDrawableTextureReference(drawable.texture, mesh, input.textureLookup),
          visible: resolveRuntimeVariantDrawableVisible({
            model: input.model,
            drawable,
            activeVariantSelection: input.activeVariantSelection
          }),
          opacity: drawable.opacity,
          baseDrawOrder: drawable.baseDrawOrder,
          bounds: cloneRect(drawable.bounds),
          vertices: cloneVec2Array(mesh.vertices),
          uvs: cloneVec2Array(mesh.atlasUvs),
          triangles: cloneTriangles(mesh.triangles),
          vertexStableIds: [...mesh.vertexStableIds],
          ...(mesh.triangleStableIds === undefined
            ? {}
            : { triangleStableIds: [...mesh.triangleStableIds] }),
          ...(mesh.topologyRevision === undefined
            ? {}
            : { topologyRevision: mesh.topologyRevision }),
          vertexCount: mesh.vertices.length
        }
      ];
    })
  );
}

function createRigControlMap(
  model: RuntimeExportModelDto
): ReadonlyMap<RigControlId, NormalizedRigControlNode> {
  const rigControls = model.rigControls.map((rigControl): readonly [RigControlId, NormalizedRigControlNode] => {
    if (rigControl.kind === "rotation2d") {
      return [
        rigControl.rigControlId,
        {
          kind: rigControl.kind,
          rigControlId: rigControl.rigControlId,
          ...(rigControl.parentId === undefined ? {} : { parentId: rigControl.parentId }),
          childDrawableIds: [...rigControl.childDrawableIds],
          childRigControlIds: [...rigControl.childRigControlIds],
          ...(rigControl.opacityMultiplier === undefined
            ? {}
            : { opacityMultiplier: rigControl.opacityMultiplier }),
          pivot: cloneVec2(rigControl.pivot),
          restAngleDegrees: rigControl.restAngleDegrees,
          restTranslation: cloneVec2(rigControl.restTranslation),
          restScale: cloneVec2(rigControl.restScale),
          enabled: rigControl.enabled
        }
      ];
    }

    return [
      rigControl.rigControlId,
      {
        kind: rigControl.kind,
        rigControlId: rigControl.rigControlId,
        ...(rigControl.parentId === undefined ? {} : { parentId: rigControl.parentId }),
        childDrawableIds: [...rigControl.childDrawableIds],
        childRigControlIds: [...rigControl.childRigControlIds],
        ...(rigControl.opacityMultiplier === undefined
          ? {}
          : { opacityMultiplier: rigControl.opacityMultiplier }),
        bindSpace: rigControl.bindSpace,
        domainBounds: cloneRect(rigControl.domainBounds),
        latticeColumns: rigControl.latticeColumns,
        latticeRows: rigControl.latticeRows,
        restControlPoints: cloneVec2Array(rigControl.restControlPoints),
        interpolationMethod: rigControl.interpolationMethod,
        enabled: rigControl.enabled
      }
    ];
  });

  return new Map(rigControls);
}

function createDrawableRenderResourceMap(
  model: RuntimeExportModelDto,
  meshesById: ReadonlyMap<MeshId, RuntimeExportMeshDto>
): ReadonlyMap<DrawableId, RuntimeExportDrawableRenderResource> {
  return new Map(
    model.drawables.map((drawable) => {
      const mesh = meshesById.get(drawable.meshId);
      if (mesh === undefined) {
        throw new Error(`runtime export drawable "${drawable.drawableId}" is missing mesh "${drawable.meshId}".`);
      }

      return [
        drawable.drawableId,
        {
          drawableId: drawable.drawableId,
          meshId: drawable.meshId,
          texture: { ...drawable.texture },
          restVertices: cloneVec2Array(mesh.vertices),
          atlasUvs: cloneVec2Array(mesh.atlasUvs),
          triangles: cloneTriangles(mesh.triangles)
        }
      ];
    })
  );
}

function createTextureRenderResources(
  input: RuntimeExportRuntimeGraphAdapterInput,
  textureLookup: TextureLookup
): readonly RuntimeExportTextureRenderResource[] {
  return input.model.texturePages.map((page) => {
    const textureInfo = textureLookup.get(page.pageId);
    return {
      pageId: page.pageId,
      path: page.path,
      ...(textureInfo?.textureId === undefined ? {} : { textureId: textureInfo.textureId }),
      width: page.width,
      height: page.height,
      pixelFormat: page.pixelFormat
    };
  });
}

function createDrawableTextureReference(
  texture: RuntimeExportDrawableTextureReferenceDto,
  mesh: RuntimeExportMeshDto,
  textureLookup: TextureLookup
): NormalizedDrawableTextureReference {
  const textureInfo = textureLookup.get(texture.pageId);
  return {
    status: textureInfo?.textureId === undefined ? "not_materialized" : "resolved",
    ...(textureInfo?.textureId === undefined ? {} : { textureId: textureInfo.textureId }),
    projection: {
      kind: "uv",
      uvs: cloneVec2Array(mesh.atlasUvs)
    }
  };
}

type TextureLookup = ReadonlyMap<string, RuntimeExportTextureRenderResource>;

function createTextureLookup(
  input: RuntimeExportRuntimeGraphAdapterInput
): TextureLookup {
  const atlasPages = new Map(
    (input.atlas?.pages ?? []).map((page) => [page.pageId, page])
  );
  const metadataPages = new Map(
    (input.texturePages ?? []).map((page) => [page.pageId, page])
  );

  return new Map(
    input.model.texturePages.map((page) => {
      const atlasPage = atlasPages.get(page.pageId);
      const metadataPage = metadataPages.get(page.pageId);
      return [
        page.pageId,
        createTextureRenderResource(page, atlasPage, metadataPage)
      ];
    })
  );
}

function createTextureRenderResource(
  page: RuntimeExportTexturePageReferenceDto,
  atlasPage: RuntimeExportAtlasPageDto | undefined,
  metadataPage: RuntimeExportTexturePageMetadataDto | undefined
): RuntimeExportTextureRenderResource {
  const textureId = atlasPage?.textureId ?? metadataPage?.textureId;
  return {
    pageId: page.pageId,
    path: page.path,
    ...(textureId === undefined ? {} : { textureId }),
    width: page.width,
    height: page.height,
    pixelFormat: page.pixelFormat
  };
}

function cloneKeyformBinding(binding: RuntimeExportModelDto["keyforms"][number]): KeyformBinding {
  if (binding.evaluator === "linear-1d-v1") {
    return {
      evaluator: binding.evaluator,
      keyformSetId: binding.keyformSetId,
      targetId: binding.targetId,
      targetKind: binding.targetKind,
      targetProperty: binding.targetProperty,
      parameterId: binding.parameterId,
      keys: binding.keys.map((key) => ({
        value: key.value,
        statePatch: cloneStatePatchValue(key.statePatch)
      })),
      compositionMode: binding.compositionMode,
      compositionOrder: binding.compositionOrder
    };
  }

  return {
    evaluator: binding.evaluator,
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
      statePatch: cloneStatePatchValue(key.statePatch)
    })),
    compositionMode: binding.compositionMode,
    compositionOrder: binding.compositionOrder
  };
}

function cloneStatePatchValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneStatePatchValue(entry));
  }

  if (typeof value === "object" && value !== null) {
    return { ...value };
  }

  return value;
}

function cloneTriangles(
  triangles: readonly (readonly [number, number, number])[]
): NormalizedMeshTriangle[] {
  return triangles.map((triangle) => [triangle[0], triangle[1], triangle[2]]);
}

function cloneRect(rect: RectDto): RectDto {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height
  };
}

function cloneVec2Array(values: readonly Vec2Dto[]): Vec2Dto[] {
  return values.map(cloneVec2);
}

function cloneVec2(value: Vec2Dto): Vec2Dto {
  return {
    x: value.x,
    y: value.y
  };
}
