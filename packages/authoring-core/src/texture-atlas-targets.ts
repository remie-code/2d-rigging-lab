import type {
  DrawableId,
  PartId,
  RectDto,
  TextureId
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  MeshDto,
  TextureAtlasEntryDto
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getMeshById } from "./drawable-selectors.js";
import { getTextureAtlasEntryById } from "./texture-asset-selectors.js";

export type TextureAtlasWarningCode =
  | "atlas.target.alreadyAtlasApplied"
  | "atlas.target.emptyMeshUvs"
  | "atlas.target.invalidMeshUvCardinality"
  | "atlas.target.invalidRgbaByteLength"
  | "atlas.target.invalidTextureBounds"
  | "atlas.target.missingMesh"
  | "atlas.target.missingTextureBinaryRef"
  | "atlas.target.missingTextureBytes"
  | "atlas.target.missingTextureEntry"
  | "atlas.pack.cannotFit"
  | "atlas.apply.generatedBinaryDigestUnavailable"
  | "atlas.apply.previewNotReady"
  | "atlas.apply.stalePreview";

export type TextureAtlasWarningSeverity = "warning" | "error";

export interface TextureAtlasWarning {
  readonly code: TextureAtlasWarningCode;
  readonly severity: TextureAtlasWarningSeverity;
  readonly targetPath: string;
  readonly message: string;
  readonly drawableId?: DrawableId;
  readonly meshId?: string;
  readonly textureId?: TextureId;
  readonly details: readonly string[];
}

export type TextureAtlasExcludedReason = "unboundDrawablePool";

export interface TextureAtlasExcludedTarget {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly reason: TextureAtlasExcludedReason;
  readonly targetPath: string;
}

export type TextureAtlasHiddenReason =
  | "runtime-visibility-off"
  | "editor-part-hidden";

export interface TextureAtlasIncludedTargetSummary {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly textureId: TextureId;
  readonly meshId: string;
  readonly currentlyHidden: boolean;
  readonly hiddenReasons: readonly TextureAtlasHiddenReason[];
  readonly packable: boolean;
}

export interface TextureAtlasPackableTarget {
  readonly drawable: DrawableDto;
  readonly mesh: MeshDto;
  readonly textureEntry: TextureAtlasEntryDto;
  readonly textureBytes: Uint8Array;
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly currentlyHidden: boolean;
  readonly hiddenReasons: readonly TextureAtlasHiddenReason[];
}

export interface TextureAtlasTargetSelectionOptions {
  readonly editorHiddenPartIds?: Iterable<PartId>;
}

export interface TextureAtlasTargetSelectionResult {
  readonly included: readonly TextureAtlasIncludedTargetSummary[];
  readonly excluded: readonly TextureAtlasExcludedTarget[];
  readonly warnings: readonly TextureAtlasWarning[];
  readonly packableTargets: readonly TextureAtlasPackableTarget[];
  readonly boundDrawableIds: readonly DrawableId[];
}

export const selectTextureAtlasTargets = (
  session: AuthoringSession,
  options: TextureAtlasTargetSelectionOptions = {}
): TextureAtlasTargetSelectionResult => {
  const boundDrawableIds = createBoundDrawableIdSet(session);
  const sortedDrawables = sortDrawablesForAtlas(session);
  const hiddenPartIds = new Set(options.editorHiddenPartIds ?? []);
  const warnings: TextureAtlasWarning[] = [];
  const included: TextureAtlasIncludedTargetSummary[] = [];
  const excluded: TextureAtlasExcludedTarget[] = [];
  const packableTargets: TextureAtlasPackableTarget[] = [];

  for (const drawable of sortedDrawables) {
    if (!boundDrawableIds.has(drawable.drawableId)) {
      excluded.push({
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        reason: "unboundDrawablePool",
        targetPath: `/model/drawables/${drawable.drawableId}`
      });
      continue;
    }

    const hiddenReasons = getDrawableHiddenReasons(session, drawable, hiddenPartIds);
    const targetWarnings = validatePackableDrawableTarget(session, drawable);

    warnings.push(...targetWarnings);
    included.push({
      drawableId: drawable.drawableId,
      displayName: drawable.displayName,
      textureId: drawable.textureId,
      meshId: drawable.meshId,
      currentlyHidden: hiddenReasons.length > 0,
      hiddenReasons,
      packable: targetWarnings.length === 0
    });

    const packableTarget = createPackableTarget(session, drawable, hiddenReasons);
    if (targetWarnings.length === 0 && packableTarget !== undefined) {
      packableTargets.push(packableTarget);
    }
  }

  return {
    included,
    excluded,
    warnings,
    packableTargets,
    boundDrawableIds: [...boundDrawableIds] as DrawableId[]
  };
};

const createBoundDrawableIdSet = (session: AuthoringSession): Set<DrawableId> => {
  const ids = new Set<DrawableId>();

  for (const rigControl of session.graph.rigControls) {
    for (const drawableId of rigControl.childDrawableIds) {
      if (getDrawableById(session.graph, drawableId) !== undefined) {
        ids.add(drawableId);
      }
    }
  }

  return ids;
};

const sortDrawablesForAtlas = (session: AuthoringSession): readonly DrawableDto[] => {
  const drawOrderByDrawableId = new Map(
    session.graph.drawOrder.map((entry) => [entry.drawableId, entry])
  );
  const stableOrderIndexById = new Map(
    session.graph.stableOrder.map((id, index) => [id, index])
  );
  const graphIndexByDrawableId = new Map(
    session.graph.drawables.map((drawable, index) => [drawable.drawableId, index])
  );

  return [...session.graph.drawables].sort((left, right) => {
    const leftDrawOrder = drawOrderByDrawableId.get(left.drawableId);
    const rightDrawOrder = drawOrderByDrawableId.get(right.drawableId);
    const leftStableOrder = leftDrawOrder?.stableOrder ??
      stableOrderIndexById.get(left.drawableId) ??
      graphIndexByDrawableId.get(left.drawableId) ??
      Number.MAX_SAFE_INTEGER;
    const rightStableOrder = rightDrawOrder?.stableOrder ??
      stableOrderIndexById.get(right.drawableId) ??
      graphIndexByDrawableId.get(right.drawableId) ??
      Number.MAX_SAFE_INTEGER;

    if (leftStableOrder !== rightStableOrder) {
      return leftStableOrder - rightStableOrder;
    }

    const leftBaseOrder = leftDrawOrder?.baseDrawOrder ?? left.baseDrawOrder;
    const rightBaseOrder = rightDrawOrder?.baseDrawOrder ?? right.baseDrawOrder;
    if (leftBaseOrder !== rightBaseOrder) {
      return leftBaseOrder - rightBaseOrder;
    }

    return left.drawableId.localeCompare(right.drawableId);
  });
};

const getDrawableHiddenReasons = (
  session: AuthoringSession,
  drawable: DrawableDto,
  editorHiddenPartIds: ReadonlySet<PartId>
): readonly TextureAtlasHiddenReason[] => {
  const reasons: TextureAtlasHiddenReason[] = [];

  if (!drawable.runtimeVisibility) {
    reasons.push("runtime-visibility-off");
  }

  if (isDrawableInHiddenPart(session, drawable, editorHiddenPartIds)) {
    reasons.push("editor-part-hidden");
  }

  return reasons;
};

const isDrawableInHiddenPart = (
  session: AuthoringSession,
  drawable: DrawableDto,
  editorHiddenPartIds: ReadonlySet<PartId>
): boolean => {
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  let currentPartId: PartId | undefined = drawable.partId;

  while (currentPartId !== undefined) {
    if (editorHiddenPartIds.has(currentPartId)) {
      return true;
    }

    currentPartId = partsById.get(currentPartId)?.parentPartId;
  }

  return false;
};

const validatePackableDrawableTarget = (
  session: AuthoringSession,
  drawable: DrawableDto
): readonly TextureAtlasWarning[] => {
  const warnings: TextureAtlasWarning[] = [];
  const mesh = getMeshById(session.graph, drawable.meshId);

  if (mesh === undefined) {
    warnings.push(createDrawableWarning({
      code: "atlas.target.missingMesh",
      drawable,
      meshId: drawable.meshId,
      targetPath: `/model/meshes/${drawable.meshId}`,
      message: `Bound drawable ${drawable.drawableId} references a missing mesh.`,
      details: [`meshId=${drawable.meshId}`]
    }));
  } else {
    warnings.push(...validateMeshForAtlas(drawable, mesh));
  }

  const textureEntry = getTextureAtlasEntryById(session.graph, drawable.textureId);
  if (textureEntry === undefined) {
    warnings.push(createDrawableWarning({
      code: "atlas.target.missingTextureEntry",
      drawable,
      textureId: drawable.textureId,
      targetPath: `/assets/textureAtlas/textures/${drawable.textureId}`,
      message: `Bound drawable ${drawable.drawableId} references a missing texture entry.`,
      details: [`textureId=${drawable.textureId}`]
    }));
  } else if (mesh !== undefined) {
    warnings.push(...validateTextureBytesForAtlas(session, drawable, mesh, textureEntry));
  }

  return warnings;
};

const validateMeshForAtlas = (
  drawable: DrawableDto,
  mesh: MeshDto
): readonly TextureAtlasWarning[] => {
  const warnings: TextureAtlasWarning[] = [];

  if (mesh.uvs.length === 0) {
    warnings.push(createDrawableWarning({
      code: "atlas.target.emptyMeshUvs",
      drawable,
      meshId: mesh.meshId,
      targetPath: `/model/meshes/${mesh.meshId}/uvs`,
      message: `Bound drawable ${drawable.drawableId} has no mesh UVs to rewrite.`,
      details: [`uvCount=${mesh.uvs.length}`]
    }));
  }

  if (mesh.vertices.length !== mesh.uvs.length) {
    warnings.push(createDrawableWarning({
      code: "atlas.target.invalidMeshUvCardinality",
      drawable,
      meshId: mesh.meshId,
      targetPath: `/model/meshes/${mesh.meshId}/uvs`,
      message: `Bound drawable ${drawable.drawableId} mesh vertices and UVs are not aligned.`,
      details: [
        `vertexCount=${mesh.vertices.length}`,
        `uvCount=${mesh.uvs.length}`
      ]
    }));
  }

  if (!hasValidTextureBounds(mesh.bounds)) {
    warnings.push(createDrawableWarning({
      code: "atlas.target.invalidTextureBounds",
      drawable,
      meshId: mesh.meshId,
      targetPath: `/model/meshes/${mesh.meshId}/bounds`,
      message: `Bound drawable ${drawable.drawableId} has invalid texture bounds for RGBA atlas input.`,
      details: [
        `bounds=${formatBounds(mesh.bounds)}`,
        `roundedWidth=${Math.round(mesh.bounds.width)}`,
        `roundedHeight=${Math.round(mesh.bounds.height)}`
      ]
    }));
  }

  return warnings;
};

const validateTextureBytesForAtlas = (
  session: AuthoringSession,
  drawable: DrawableDto,
  mesh: MeshDto,
  textureEntry: TextureAtlasEntryDto
): readonly TextureAtlasWarning[] => {
  const binaryAssetRef = textureEntry.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    return [createDrawableWarning({
      code: "atlas.target.missingTextureBinaryRef",
      drawable,
      textureId: textureEntry.textureId,
      targetPath: `/assets/textureAtlas/textures/${textureEntry.textureId}/binaryAssetRef`,
      message: `Texture ${textureEntry.textureId} has no package-local binary reference.`,
      details: [`textureId=${textureEntry.textureId}`]
    })];
  }

  const binaryEntry = session.binaryAssets?.fileEntries.find(
    (entry) => entry.path === binaryAssetRef.packageRelativePath
  );
  if (binaryEntry === undefined) {
    return [createDrawableWarning({
      code: "atlas.target.missingTextureBytes",
      drawable,
      textureId: textureEntry.textureId,
      targetPath: `/binaryAssets/${binaryAssetRef.packageRelativePath}`,
      message: `Texture ${textureEntry.textureId} package-local bytes are not loaded in the authoring session.`,
      details: [
        `binaryAssetId=${binaryAssetRef.binaryAssetId}`,
        `packageRelativePath=${binaryAssetRef.packageRelativePath}`
      ]
    })];
  }

  const width = Math.round(mesh.bounds.width);
  const height = Math.round(mesh.bounds.height);
  const expectedByteLength = width * height * 4;
  if (binaryEntry.bytes.byteLength !== expectedByteLength) {
    return [createDrawableWarning({
      code: "atlas.target.invalidRgbaByteLength",
      drawable,
      meshId: mesh.meshId,
      textureId: textureEntry.textureId,
      targetPath: `/binaryAssets/${binaryAssetRef.packageRelativePath}`,
      message: `Texture ${textureEntry.textureId} bytes do not match inferred raw RGBA dimensions.`,
      details: [
        `width=${width}`,
        `height=${height}`,
        `expectedByteLength=${expectedByteLength}`,
        `actualByteLength=${binaryEntry.bytes.byteLength}`
      ]
    })];
  }

  return [];
};

const createPackableTarget = (
  session: AuthoringSession,
  drawable: DrawableDto,
  hiddenReasons: readonly TextureAtlasHiddenReason[]
): TextureAtlasPackableTarget | undefined => {
  const mesh = getMeshById(session.graph, drawable.meshId);
  const textureEntry = getTextureAtlasEntryById(session.graph, drawable.textureId);
  const binaryAssetRef = textureEntry?.binaryAssetRef;
  const binaryEntry = binaryAssetRef === undefined
    ? undefined
    : session.binaryAssets?.fileEntries.find(
        (entry) => entry.path === binaryAssetRef.packageRelativePath
      );

  if (
    mesh === undefined ||
    textureEntry === undefined ||
    binaryEntry === undefined ||
    !hasValidTextureBounds(mesh.bounds) ||
    mesh.uvs.length === 0 ||
    mesh.vertices.length !== mesh.uvs.length
  ) {
    return undefined;
  }

  return {
    drawable: structuredClone(drawable),
    mesh: structuredClone(mesh),
    textureEntry: structuredClone(textureEntry),
    textureBytes: new Uint8Array(binaryEntry.bytes),
    textureSize: {
      width: Math.round(mesh.bounds.width),
      height: Math.round(mesh.bounds.height)
    },
    currentlyHidden: hiddenReasons.length > 0,
    hiddenReasons: [...hiddenReasons]
  };
};

const hasValidTextureBounds = (bounds: RectDto): boolean => {
  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);

  return Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    width > 0 &&
    height > 0;
};

const createDrawableWarning = (input: {
  readonly code: TextureAtlasWarningCode;
  readonly drawable: DrawableDto;
  readonly targetPath: string;
  readonly message: string;
  readonly details: readonly string[];
  readonly meshId?: string;
  readonly textureId?: TextureId;
}): TextureAtlasWarning => ({
  code: input.code,
  severity: "error",
  targetPath: input.targetPath,
  message: input.message,
  drawableId: input.drawable.drawableId,
  ...(input.meshId === undefined ? {} : { meshId: input.meshId }),
  ...(input.textureId === undefined ? {} : { textureId: input.textureId }),
  details: [
    `drawableId=${input.drawable.drawableId}`,
    `displayName=${input.drawable.displayName}`,
    ...input.details
  ]
});

const formatBounds = (bounds: RectDto): string =>
  `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
