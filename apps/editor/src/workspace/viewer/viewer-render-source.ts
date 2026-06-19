import {
  createTextureAtlasSourceSignature,
  sameTextureAtlasSourceSignature,
  selectTextureAtlasTargets,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId } from "@private-2d-rigging-lab/contracts";

import {
  isRenderableDrawable,
  type CanvasRenderableDrawable,
  type CanvasRenderProjection
} from "../canvas/canvas-projection";

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

type TextureAtlasFile = NonNullable<AuthoringSession["graph"]["textureAtlas"]>;
type TextureAtlasLayoutSummary = NonNullable<TextureAtlasFile["layoutSummary"]>;
type TextureAtlasPage = TextureAtlasLayoutSummary["pages"][number];
type TextureAtlasPlacement = TextureAtlasPage["placements"][number];
type TextureAtlasEntry = TextureAtlasFile["textures"][number];
type BinaryAssetReference = NonNullable<TextureAtlasEntry["binaryAssetRef"]>;

interface ViewerAtlasRuntimeSource {
  readonly textureId: TextureAtlasEntry["textureId"];
  readonly binaryAssetId: BinaryAssetReference["binaryAssetId"];
  readonly binaryAssetPath: BinaryAssetReference["packageRelativePath"];
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly placementsByDrawableId: ReadonlyMap<DrawableId, TextureAtlasPlacement>;
  readonly contentKey: string;
}

type ViewerAtlasRuntimeSourceResult =
  | {
      readonly status: "available";
      readonly source: ViewerAtlasRuntimeSource;
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
}): ViewerAtlasRuntimeAvailability {
  const result = resolveViewerAtlasRuntimeSource(input);

  return result.status === "available" ? { status: "available" } : result;
}

export function createViewerRenderSourceProjection(input: {
  readonly session: AuthoringSession;
  readonly originalProjection: CanvasRenderProjection;
  readonly requestedMode?: ViewerRenderSourceMode;
}): ViewerRenderSourceProjectionResult {
  const requestedMode = input.requestedMode ?? "original";
  const atlasRuntime = resolveViewerAtlasRuntimeSource({
    session: input.session,
    originalProjection: input.originalProjection
  });
  const atlasRuntimeAvailability: ViewerAtlasRuntimeAvailability =
    atlasRuntime.status === "available" ? { status: "available" } : atlasRuntime;

  if (requestedMode === "atlasRuntime" && atlasRuntime.status === "available") {
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

const resolveViewerAtlasRuntimeSource = (input: {
  readonly session: AuthoringSession;
  readonly originalProjection: CanvasRenderProjection;
}): ViewerAtlasRuntimeSourceResult => {
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

  if (layoutSummary.sourceSignature === undefined) {
    return unavailable(
      "missingSourceSignature",
      "/assets/textureAtlas/layoutSummary/sourceSignature"
    );
  }

  const currentTargetSelection = selectTextureAtlasTargets(input.session);
  const currentSourceSignature = createTextureAtlasSourceSignature({
    settings: layoutSummary.settings,
    targetSelection: currentTargetSelection,
    packableTargets: currentTargetSelection.packableTargets
  });

  if (!sameTextureAtlasSourceSignature(layoutSummary.sourceSignature, currentSourceSignature)) {
    return unavailable("staleSourceSignature", "/assets/textureAtlas/layoutSummary/sourceSignature", [
      `expectedDigest=${layoutSummary.sourceSignature.digest}`,
      `currentDigest=${currentSourceSignature.digest}`
    ]);
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

  for (const target of currentTargetSelection.packableTargets) {
    const placement = placementsByDrawableId.get(target.drawable.drawableId);
    if (placement === undefined) {
      return unavailable(
        "missingPlacement",
        `/assets/textureAtlas/layoutSummary/pages/${page.pageId}/placements/${target.drawable.drawableId}`
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

  for (const drawable of input.originalProjection.drawables) {
    if (!isRenderableDrawable(drawable)) {
      continue;
    }

    if (!placementsByDrawableId.has(drawable.drawableId)) {
      return unavailable("missingPlacement", `/model/drawables/${drawable.drawableId}`);
    }
  }

  return {
    status: "available",
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
        layoutSummary.sourceSignature.digest
      ].join(":")
    }
  };
};

const remapProjectionToAtlasRuntime = (
  projection: CanvasRenderProjection,
  source: ViewerAtlasRuntimeSource
): CanvasRenderProjection => ({
  ...projection,
  drawables: projection.drawables.map((drawable) =>
    remapDrawableToAtlasRuntime(drawable, source)
  ),
  contentKey: `${projection.contentKey}|${source.contentKey}`
});

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
