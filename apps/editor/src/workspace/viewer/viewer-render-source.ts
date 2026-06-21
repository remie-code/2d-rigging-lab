import {
  createTextureAtlasSourceSignature,
  sameTextureAtlasSourceSignature,
  selectTextureAtlasTargets,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, RectDto } from "@private-2d-rigging-lab/contracts";

import {
  isRenderableDrawable,
  type CanvasRenderableDrawable,
  type CanvasRenderProjection
} from "../canvas/canvas-projection";
import {
  createViewerAtlasRuntimeSourceCacheKey,
  readViewerAtlasRuntimeSourceCache,
  writeViewerAtlasRuntimeSourceCache,
  type ViewerAtlasRuntimeSourceCache
} from "./viewer-atlas-runtime-source-cache";

export {
  createViewerAtlasRuntimeSourceCache,
  type ViewerAtlasRuntimeSourceCache
} from "./viewer-atlas-runtime-source-cache";

export type ViewerRenderSourceMode = "original" | "atlasRuntime";

export const VIEWER_RENDER_SOURCE_LABELS = {
  original: "Original",
  atlasRuntime: "Atlas Runtime"
} as const satisfies Record<ViewerRenderSourceMode, string>;

export type ViewerAtlasRuntimeUnavailableCode =
  | "missingLayout"
  | "missingPage"
  | "missingTextureEntry"
  | "missingBinaryRef"
  | "missingBytes"
  | "invalidDimensions"
  | "invalidByteLength"
  | "missingSourceSignature"
  | "staleSourceSignature"
  | "invalidPlacement"
  | "missingPlacement";

export type ViewerAtlasRuntimeAvailability =
  | {
      readonly status: "available";
    }
  | {
      readonly status: "unavailable";
      readonly code: ViewerAtlasRuntimeUnavailableCode;
      readonly disabledReason: string;
      readonly details: readonly string[];
    };

export interface ViewerRenderSourceProjectionResult {
  readonly requestedMode: ViewerRenderSourceMode;
  readonly effectiveMode: ViewerRenderSourceMode;
  readonly projection: CanvasRenderProjection;
  readonly atlasRuntimeAvailability: ViewerAtlasRuntimeAvailability;
}

export interface ViewerRenderSourceProjectionHooks {
  readonly createTextureAtlasSourceSignature?: typeof createTextureAtlasSourceSignature;
  readonly sameTextureAtlasSourceSignature?: typeof sameTextureAtlasSourceSignature;
  readonly selectTextureAtlasTargets?: typeof selectTextureAtlasTargets;
}

type TextureAtlasFile = NonNullable<AuthoringSession["graph"]["textureAtlas"]>;
type TextureAtlasLayoutSummary = NonNullable<TextureAtlasFile["layoutSummary"]>;
type TextureAtlasSourceSignature = NonNullable<TextureAtlasLayoutSummary["sourceSignature"]>;
type TextureAtlasPage = TextureAtlasLayoutSummary["pages"][number];
type TextureAtlasPlacement = TextureAtlasPage["placements"][number];
type TextureAtlasEntry = TextureAtlasFile["textures"][number];
type BinaryAssetReference = NonNullable<TextureAtlasEntry["binaryAssetRef"]>;

interface ResolvedViewerRenderSourceProjectionHooks {
  readonly createTextureAtlasSourceSignature: typeof createTextureAtlasSourceSignature;
  readonly sameTextureAtlasSourceSignature: typeof sameTextureAtlasSourceSignature;
  readonly selectTextureAtlasTargets: typeof selectTextureAtlasTargets;
}

interface ViewerAtlasRuntimeStaticSource {
  readonly textureId: TextureAtlasEntry["textureId"];
  readonly binaryAssetId: BinaryAssetReference["binaryAssetId"];
  readonly binaryAssetPath: BinaryAssetReference["packageRelativePath"];
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly placementsByDrawableId: ReadonlyMap<DrawableId, TextureAtlasPlacement>;
  readonly contentKey: string;
}

interface ViewerAtlasRuntimeSource extends ViewerAtlasRuntimeStaticSource {
  readonly runtimeDrawableIds: ReadonlySet<DrawableId>;
}

type ViewerAtlasRuntimeSourceResult =
  | {
      readonly status: "available";
      readonly source: ViewerAtlasRuntimeSource;
    }
  | Extract<ViewerAtlasRuntimeAvailability, { readonly status: "unavailable" }>;

type ViewerAtlasRuntimeStaticSourceResult =
  | {
      readonly status: "available";
      readonly layoutSummary: TextureAtlasLayoutSummary;
      readonly page: TextureAtlasPage;
      readonly sourceSignature: TextureAtlasSourceSignature;
      readonly source: ViewerAtlasRuntimeStaticSource;
    }
  | Extract<ViewerAtlasRuntimeAvailability, { readonly status: "unavailable" }>;

const UNAVAILABLE_REASONS = {
  missingLayout: "Apply a texture atlas first.",
  missingPage: "Atlas page is missing.",
  missingTextureEntry: "Atlas texture entry is missing.",
  missingBinaryRef: "Atlas binary reference is missing.",
  missingBytes: "Atlas bytes are not loaded.",
  invalidDimensions: "Atlas dimensions are invalid.",
  invalidByteLength: "Atlas byte length is invalid.",
  missingSourceSignature: "Atlas source signature is missing.",
  staleSourceSignature: "Atlas source changed; regenerate the atlas.",
  invalidPlacement: "Atlas placement is invalid.",
  missingPlacement: "Atlas placement is missing."
} as const satisfies Record<ViewerAtlasRuntimeUnavailableCode, string>;

export function resolveViewerAtlasRuntimeAvailability(input: {
  readonly session: AuthoringSession;
  readonly originalProjection: CanvasRenderProjection;
  readonly atlasRuntimeSourceCache?: ViewerAtlasRuntimeSourceCache;
  readonly hooks?: ViewerRenderSourceProjectionHooks;
}): ViewerAtlasRuntimeAvailability {
  const result = resolveViewerAtlasRuntimeSource({
    session: input.session,
    atlasRuntimeSourceCache: input.atlasRuntimeSourceCache,
    hooks: resolveViewerRenderSourceProjectionHooks(input.hooks)
  });

  return result.status === "available" ? { status: "available" } : result;
}

export function createViewerRenderSourceProjection(input: {
  readonly session: AuthoringSession;
  readonly originalProjection: CanvasRenderProjection;
  readonly requestedMode?: ViewerRenderSourceMode;
  readonly atlasRuntimeSourceCache?: ViewerAtlasRuntimeSourceCache;
  readonly hooks?: ViewerRenderSourceProjectionHooks;
}): ViewerRenderSourceProjectionResult {
  const requestedMode = input.requestedMode ?? "original";

  if (requestedMode === "atlasRuntime") {
    const atlasRuntime = resolveViewerAtlasRuntimeSource({
      session: input.session,
      atlasRuntimeSourceCache: input.atlasRuntimeSourceCache,
      hooks: resolveViewerRenderSourceProjectionHooks(input.hooks)
    });
    const atlasRuntimeAvailability: ViewerAtlasRuntimeAvailability =
      atlasRuntime.status === "available" ? { status: "available" } : atlasRuntime;

    if (atlasRuntime.status === "available") {
      return {
        requestedMode,
        effectiveMode: "atlasRuntime",
        atlasRuntimeAvailability,
        projection: remapProjectionToAtlasRuntime(input.originalProjection, atlasRuntime.source)
      };
    }

    return {
      requestedMode,
      effectiveMode: "original",
      projection: input.originalProjection,
      atlasRuntimeAvailability
    };
  }

  const atlasRuntime = resolveViewerAtlasRuntimeStaticSource({
    session: input.session
  });
  const atlasRuntimeAvailability: ViewerAtlasRuntimeAvailability =
    atlasRuntime.status === "available" ? { status: "available" } : atlasRuntime;

  return {
    requestedMode,
    effectiveMode: "original",
    projection: input.originalProjection,
    atlasRuntimeAvailability
  };
}

const resolveViewerAtlasRuntimeSource = (input: {
  readonly session: AuthoringSession;
  readonly atlasRuntimeSourceCache?: ViewerAtlasRuntimeSourceCache;
  readonly hooks: ResolvedViewerRenderSourceProjectionHooks;
}): ViewerAtlasRuntimeSourceResult => {
  if (input.atlasRuntimeSourceCache === undefined) {
    return resolveViewerAtlasRuntimeSourceUncached(input);
  }

  const cacheKey = createViewerAtlasRuntimeSourceCacheKey(input.session);
  const cached = readViewerAtlasRuntimeSourceCache<ViewerAtlasRuntimeSourceResult>(
    input.atlasRuntimeSourceCache,
    cacheKey
  );
  if (cached !== undefined) {
    return cached;
  }

  const result = resolveViewerAtlasRuntimeSourceUncached(input);
  writeViewerAtlasRuntimeSourceCache(input.atlasRuntimeSourceCache, cacheKey, result);

  return result;
};

const resolveViewerAtlasRuntimeSourceUncached = (input: {
  readonly session: AuthoringSession;
  readonly hooks: ResolvedViewerRenderSourceProjectionHooks;
}): ViewerAtlasRuntimeSourceResult => {
  const staticResult = resolveViewerAtlasRuntimeStaticSource({
    session: input.session
  });
  if (staticResult.status === "unavailable") {
    return staticResult;
  }

  const currentTargetSelection = input.hooks.selectTextureAtlasTargets(input.session);
  const currentSourceSignature = input.hooks.createTextureAtlasSourceSignature({
    settings: staticResult.layoutSummary.settings,
    targetSelection: currentTargetSelection,
    packableTargets: currentTargetSelection.packableTargets
  });

  if (
    !input.hooks.sameTextureAtlasSourceSignature(
      staticResult.sourceSignature,
      currentSourceSignature
    )
  ) {
    return unavailable("staleSourceSignature", "/assets/textureAtlas/layoutSummary/sourceSignature", [
      `expectedDigest=${staticResult.sourceSignature.digest}`,
      `currentDigest=${currentSourceSignature.digest}`
    ]);
  }

  const runtimeDrawableIds = new Set<DrawableId>();
  for (const target of currentTargetSelection.packableTargets) {
    runtimeDrawableIds.add(target.drawable.drawableId);
    const placement = staticResult.source.placementsByDrawableId.get(target.drawable.drawableId);
    if (placement === undefined) {
      return unavailable(
        "missingPlacement",
        `/assets/textureAtlas/layoutSummary/pages/${staticResult.page.pageId}/placements/${target.drawable.drawableId}`
      );
    }

    if (
      placement.meshId !== target.mesh.meshId ||
      placement.originalTextureId !== target.drawable.textureId
    ) {
      return unavailable("invalidPlacement", `/model/drawables/${target.drawable.drawableId}`, [
        `placementMeshId=${placement.meshId}`,
        `currentMeshId=${target.mesh.meshId}`,
        `placementOriginalTextureId=${placement.originalTextureId}`,
        `currentTextureId=${target.drawable.textureId}`
      ]);
    }
  }

  return {
    status: "available",
    source: {
      ...staticResult.source,
      runtimeDrawableIds
    }
  };
};

const resolveViewerAtlasRuntimeStaticSource = (input: {
  readonly session: AuthoringSession;
}): ViewerAtlasRuntimeStaticSourceResult => {
  const layoutSummary = input.session.graph.textureAtlas?.layoutSummary;
  if (layoutSummary === undefined) {
    return unavailable("missingLayout", "/assets/textureAtlas/layoutSummary");
  }

  const page = layoutSummary.pages[0];
  if (page === undefined) {
    return unavailable("missingPage", "/assets/textureAtlas/layoutSummary/pages/0");
  }

  const textureEntry = input.session.graph.textureAtlas?.textures.find(
    (entry) =>
      entry.textureId === layoutSummary.atlasTextureId &&
      entry.textureId === page.textureId
  );
  if (textureEntry === undefined) {
    return unavailable(
      "missingTextureEntry",
      `/assets/textureAtlas/textures/${layoutSummary.atlasTextureId}`
    );
  }

  const binaryAssetRef = textureEntry.binaryAssetRef;
  if (binaryAssetRef === undefined) {
    return unavailable(
      "missingBinaryRef",
      `/assets/textureAtlas/textures/${textureEntry.textureId}/binaryAssetRef`
    );
  }

  const binaryEntry = input.session.binaryAssets?.fileEntries.find(
    (entry) =>
      entry.path === binaryAssetRef.packageRelativePath &&
      entry.binaryAssetId === binaryAssetRef.binaryAssetId
  );
  if (binaryEntry === undefined) {
    return unavailable("missingBytes", `/binaryAssets/${binaryAssetRef.packageRelativePath}`);
  }

  const dimensions = textureEntry.dimensions;
  if (
    dimensions === undefined ||
    dimensions.pixelFormat !== "rgba8" ||
    dimensions.width !== page.width ||
    dimensions.height !== page.height ||
    !isPositiveSafeInteger(page.width) ||
    !isPositiveSafeInteger(page.height)
  ) {
    return unavailable(
      "invalidDimensions",
      `/assets/textureAtlas/textures/${textureEntry.textureId}/dimensions`,
      [`page=${page.width}x${page.height}`]
    );
  }

  const expectedByteLength = page.width * page.height * 4;
  if (
    !Number.isSafeInteger(expectedByteLength) ||
    binaryEntry.bytes.byteLength !== expectedByteLength ||
    binaryAssetRef.byteLength !== expectedByteLength
  ) {
    return unavailable("invalidByteLength", `/binaryAssets/${binaryAssetRef.packageRelativePath}`, [
      `expectedByteLength=${expectedByteLength}`,
      `actualByteLength=${binaryEntry.bytes.byteLength}`,
      `refByteLength=${binaryAssetRef.byteLength}`
    ]);
  }

  const sourceSignature = layoutSummary.sourceSignature;
  if (sourceSignature === undefined) {
    return unavailable(
      "missingSourceSignature",
      "/assets/textureAtlas/layoutSummary/sourceSignature"
    );
  }

  const placementsByDrawableId = new Map<DrawableId, TextureAtlasPlacement>();
  for (const placement of page.placements) {
    if (
      placementsByDrawableId.has(placement.drawableId) ||
      placement.pageId !== page.pageId ||
      placement.atlasTextureId !== page.textureId ||
      placement.atlasTextureId !== layoutSummary.atlasTextureId ||
      !isValidUvRect(placement)
    ) {
      return unavailable("invalidPlacement", `/assets/textureAtlas/layoutSummary/pages/${page.pageId}`);
    }

    placementsByDrawableId.set(placement.drawableId, placement);
  }

  return {
    status: "available",
    layoutSummary,
    page,
    sourceSignature,
    source: {
      textureId: textureEntry.textureId,
      binaryAssetId: binaryAssetRef.binaryAssetId,
      binaryAssetPath: binaryAssetRef.packageRelativePath,
      bytes: binaryEntry.bytes,
      width: page.width,
      height: page.height,
      placementsByDrawableId,
      contentKey: [
        "viewer-atlas-runtime",
        layoutSummary.layoutId,
        page.pageId,
        textureEntry.textureId,
        binaryAssetRef.binaryAssetId,
        binaryEntry.bytes.byteLength,
        sourceSignature.digest
      ].join(":")
    }
  };
};

const remapProjectionToAtlasRuntime = (
  projection: CanvasRenderProjection,
  source: ViewerAtlasRuntimeSource
): CanvasRenderProjection => {
  const {
    artworkBounds: _previousArtworkBounds,
    selectionBounds: _previousSelectionBounds,
    meshOverlay: previousMeshOverlay,
    meshOverlays: previousMeshOverlays,
    deformerOverlay: previousDeformerOverlay,
    ...projectionBase
  } = projection;
  void _previousArtworkBounds;
  void _previousSelectionBounds;
  const drawables = projection.drawables
    .filter((drawable) => source.runtimeDrawableIds.has(drawable.drawableId))
    .map((drawable) => remapDrawableToAtlasRuntime(drawable, source));
  const renderableDrawables = drawables.filter(
    (drawable) => drawable.visible && isRenderableDrawable(drawable)
  );
  const selectedDrawableIds = new Set(
    [...projection.selectedDrawableIds].filter((drawableId) =>
      source.runtimeDrawableIds.has(drawableId)
    )
  );
  const selectedVisibleDrawables = drawables.filter(
    (drawable) => drawable.visible && selectedDrawableIds.has(drawable.drawableId)
  );
  const artworkBounds = unionDrawableBounds(renderableDrawables);
  const selectionBounds = unionDrawableBounds(selectedVisibleDrawables);
  const maskRelations = projection.maskRelations
    .map((relation) => ({
      ...relation,
      sourceDrawableIds: relation.sourceDrawableIds.filter((drawableId) =>
        source.runtimeDrawableIds.has(drawableId)
      ),
      targetDrawableIds: relation.targetDrawableIds.filter((drawableId) =>
        source.runtimeDrawableIds.has(drawableId)
      )
    }))
    .filter(
      (relation) =>
        relation.sourceDrawableIds.length > 0 &&
        relation.targetDrawableIds.length > 0
    );
  const meshOverlays = previousMeshOverlays?.filter((overlay) =>
    source.runtimeDrawableIds.has(overlay.drawableId)
  );
  const meshOverlay =
    previousMeshOverlay === undefined ||
    !source.runtimeDrawableIds.has(previousMeshOverlay.drawableId)
      ? undefined
      : previousMeshOverlay;
  const deformerOverlay =
    previousDeformerOverlay === undefined
      ? undefined
      : {
          ...previousDeformerOverlay,
          childDrawableIds: previousDeformerOverlay.childDrawableIds.filter((drawableId) =>
            source.runtimeDrawableIds.has(drawableId)
          )
        };

  return {
    ...projectionBase,
    ...(artworkBounds === undefined ? {} : { artworkBounds }),
    ...(selectionBounds === undefined ? {} : { selectionBounds }),
    selectedDrawableIds,
    drawables,
    maskRelations,
    ...(meshOverlays === undefined ? {} : { meshOverlays }),
    ...(meshOverlay === undefined ? {} : { meshOverlay }),
    ...(deformerOverlay === undefined ? {} : { deformerOverlay }),
    hasRenderableArtwork: renderableDrawables.length > 0,
    contentKey: `${projection.contentKey}|${source.contentKey}|runtime:${[
      ...source.runtimeDrawableIds
    ].join(",")}`
  };
};

const remapDrawableToAtlasRuntime = (
  drawable: CanvasRenderableDrawable,
  source: ViewerAtlasRuntimeSource
): CanvasRenderableDrawable => {
  const placement = source.placementsByDrawableId.get(drawable.drawableId);
  if (placement === undefined) {
    return drawable;
  }

  const { sourceLayerId: _sourceLayerId, ...drawableWithoutSourceLayer } = drawable;

  return {
    ...drawableWithoutSourceLayer,
    textureId: source.textureId,
    binaryAssetId: source.binaryAssetId,
    binaryAssetPath: source.binaryAssetPath,
    renderBytes: source.bytes,
    renderWidth: source.width,
    renderHeight: source.height,
    evaluatedMesh: {
      ...drawable.evaluatedMesh,
      uvs: drawable.evaluatedMesh.uvs.map((uv) => remapUvIntoPlacement(uv, placement))
    }
  };
};

const remapUvIntoPlacement = (
  uv: { readonly x: number; readonly y: number },
  placement: TextureAtlasPlacement
): { readonly x: number; readonly y: number } => {
  const left = placement.uvRect.topLeft.x;
  const top = placement.uvRect.topLeft.y;
  const width = placement.uvRect.bottomRight.x - left;
  const height = placement.uvRect.bottomRight.y - top;

  return {
    x: left + uv.x * width,
    y: top + uv.y * height
  };
};

const resolveViewerRenderSourceProjectionHooks = (
  hooks: ViewerRenderSourceProjectionHooks | undefined
): ResolvedViewerRenderSourceProjectionHooks => ({
  createTextureAtlasSourceSignature:
    hooks?.createTextureAtlasSourceSignature ?? createTextureAtlasSourceSignature,
  sameTextureAtlasSourceSignature:
    hooks?.sameTextureAtlasSourceSignature ?? sameTextureAtlasSourceSignature,
  selectTextureAtlasTargets: hooks?.selectTextureAtlasTargets ?? selectTextureAtlasTargets
});

const unavailable = (
  code: ViewerAtlasRuntimeUnavailableCode,
  targetPath: string,
  details: readonly string[] = []
): Extract<ViewerAtlasRuntimeAvailability, { readonly status: "unavailable" }> => ({
  status: "unavailable",
  code,
  disabledReason: UNAVAILABLE_REASONS[code],
  details: [targetPath, ...details]
});

const isPositiveSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const unionDrawableBounds = (
  drawables: readonly CanvasRenderableDrawable[]
): RectDto | undefined => {
  const bounds = drawables
    .map((drawable) => drawable.bounds)
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (bounds.length === 0) {
    return undefined;
  }

  const left = Math.min(...bounds.map((rect) => rect.x));
  const top = Math.min(...bounds.map((rect) => rect.y));
  const right = Math.max(...bounds.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...bounds.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
};

const isValidUvRect = (placement: TextureAtlasPlacement): boolean => {
  const left = placement.uvRect.topLeft.x;
  const top = placement.uvRect.topLeft.y;
  const right = placement.uvRect.bottomRight.x;
  const bottom = placement.uvRect.bottomRight.y;

  return [left, top, right, bottom].every(Number.isFinite) &&
    left >= 0 &&
    top >= 0 &&
    right <= 1 &&
    bottom <= 1 &&
    right > left &&
    bottom > top;
};
