import type { DrawableId } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";

export interface ViewerAtlasRuntimeSourceCache {
  entry?: ViewerAtlasRuntimeSourceCacheEntry;
}

interface ViewerAtlasRuntimeSourceCacheEntry {
  readonly key: string;
  readonly value: unknown;
}

export const createViewerAtlasRuntimeSourceCache = (): ViewerAtlasRuntimeSourceCache => ({});

export const readViewerAtlasRuntimeSourceCache = <T>(
  cache: ViewerAtlasRuntimeSourceCache | undefined,
  key: string
): T | undefined => cache?.entry?.key === key ? cache.entry.value as T : undefined;

export const writeViewerAtlasRuntimeSourceCache = <T>(
  cache: ViewerAtlasRuntimeSourceCache | undefined,
  key: string,
  value: T
): void => {
  if (cache === undefined) {
    return;
  }

  cache.entry = { key, value };
};

export const createViewerAtlasRuntimeSourceCacheKey = (
  session: AuthoringSession
): string => JSON.stringify({
  version: "viewer-atlas-runtime-source-cache-key-v1",
  packageIdentity: {
    packageId: session.packageIdentity.packageId,
    formatVersion: session.packageIdentity.formatVersion
  },
  packageRevision: session.packageRevision,
  authoringRevision: session.authoringRevision,
  atlas: createAtlasCacheKey(session),
  sourceGraph: createSourceGraphCacheKey(session)
});

const createAtlasCacheKey = (session: AuthoringSession) => {
  const textureAtlas = session.graph.textureAtlas;
  const layoutSummary = textureAtlas?.layoutSummary;
  const page = layoutSummary?.pages[0];
  const atlasTextureEntry = layoutSummary === undefined
    ? undefined
    : textureAtlas?.textures.find(
        (entry) =>
          entry.textureId === layoutSummary.atlasTextureId &&
          entry.textureId === page?.textureId
      );
  const atlasBinaryRef = atlasTextureEntry?.binaryAssetRef;
  const atlasBinaryEntry = atlasBinaryRef === undefined
    ? undefined
    : session.binaryAssets?.fileEntries.find(
        (entry) =>
          entry.path === atlasBinaryRef.packageRelativePath &&
          entry.binaryAssetId === atlasBinaryRef.binaryAssetId
      );

  return {
    textures: (textureAtlas?.textures ?? [])
      .map(createTextureEntryCacheKey)
      .sort((left, right) => left.textureId.localeCompare(right.textureId)),
    layout: layoutSummary === undefined
      ? null
      : {
          layoutId: layoutSummary.layoutId,
          atlasTextureId: layoutSummary.atlasTextureId,
          sourceTexturePolicy: layoutSummary.sourceTexturePolicy,
          generatedByOperationId: layoutSummary.generatedByOperationId ?? null,
          settings: layoutSummary.settings,
          sourceSignature: layoutSummary.sourceSignature ?? null,
          pages: layoutSummary.pages.map((candidatePage) => ({
            pageId: candidatePage.pageId,
            textureId: candidatePage.textureId,
            width: candidatePage.width,
            height: candidatePage.height,
            pixelFormat: candidatePage.pixelFormat,
            placements: candidatePage.placements.map((placement) => ({
              placementId: placement.placementId,
              pageId: placement.pageId,
              drawableId: placement.drawableId,
              meshId: placement.meshId,
              originalTextureId: placement.originalTextureId,
              atlasTextureId: placement.atlasTextureId,
              sourceTextureSize: placement.sourceTextureSize,
              sourceRectPixels: placement.sourceRectPixels,
              contentRectPixels: placement.contentRectPixels,
              paddedRectPixels: placement.paddedRectPixels,
              uvRect: placement.uvRect,
              hiddenAtApply: placement.hiddenAtApply,
              hiddenReasons: placement.hiddenReasons
            }))
          })),
          atlasTextureEntry: atlasTextureEntry === undefined
            ? null
            : createTextureEntryCacheKey(atlasTextureEntry),
          atlasBinaryEntry: atlasBinaryEntry === undefined
            ? null
            : createBinaryEntryCacheKey(atlasBinaryEntry)
        }
  };
};

const createSourceGraphCacheKey = (session: AuthoringSession) => {
  const drawablesById = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const meshesById = new Map(session.graph.meshes.map((mesh) => [mesh.meshId, mesh]));
  const texturesById = new Map(
    (session.graph.textureAtlas?.textures ?? []).map((texture) => [
      texture.textureId,
      texture
    ])
  );
  const boundDrawableIds = new Set<DrawableId>();

  for (const rigControl of session.graph.rigControls) {
    for (const drawableId of rigControl.childDrawableIds) {
      if (drawablesById.has(drawableId)) {
        boundDrawableIds.add(drawableId);
      }
    }
  }

  return {
    rigDrawableBindings: session.graph.rigControls
      .map((rigControl) => ({
        rigControlId: rigControl.rigControlId,
        childDrawableIds: rigControl.childDrawableIds
      }))
      .sort((left, right) => left.rigControlId.localeCompare(right.rigControlId)),
    drawOrder: session.graph.drawOrder.map((entry) => ({
      drawableId: entry.drawableId,
      baseDrawOrder: entry.baseDrawOrder,
      stableOrder: entry.stableOrder
    })),
    stableOrder: session.graph.stableOrder,
    boundSources: [...boundDrawableIds].sort().map((drawableId) => {
      const drawable = drawablesById.get(drawableId);
      const mesh = drawable === undefined ? undefined : meshesById.get(drawable.meshId);
      const textureEntry = drawable === undefined
        ? undefined
        : texturesById.get(drawable.textureId);
      const binaryAssetRef = textureEntry?.binaryAssetRef;
      const binaryEntry = binaryAssetRef === undefined
        ? undefined
        : session.binaryAssets?.fileEntries.find(
            (entry) => entry.path === binaryAssetRef.packageRelativePath
          );

      return {
        drawableId,
        drawable: drawable === undefined
          ? null
          : {
              drawableId: drawable.drawableId,
              meshId: drawable.meshId,
              textureId: drawable.textureId,
              sourceAssetId: drawable.sourceAssetId,
              sourceProvenanceId: drawable.sourceProvenanceId
            },
        mesh: mesh === undefined
          ? null
          : {
              meshId: mesh.meshId,
              drawableId: mesh.drawableId,
              topologyRevision: mesh.topologyRevision ?? null,
              bounds: mesh.bounds,
              vertices: mesh.vertices,
              uvs: mesh.uvs,
              triangles: mesh.triangles,
              vertexStableIds: mesh.vertexStableIds ?? [],
              triangleStableIds: mesh.triangleStableIds ?? []
            },
        textureEntry: textureEntry === undefined
          ? null
          : createTextureEntryCacheKey(textureEntry),
        textureBytes: binaryEntry === undefined
          ? null
          : createBinaryEntryCacheKey(binaryEntry)
      };
    })
  };
};

const createTextureEntryCacheKey = (
  textureEntry: NonNullable<AuthoringSession["graph"]["textureAtlas"]>["textures"][number]
) => ({
  textureId: textureEntry.textureId,
  filePath: textureEntry.filePath,
  contentHash: textureEntry.contentHash ?? null,
  dimensions: textureEntry.dimensions ?? null,
  sourceAssetId: textureEntry.sourceAssetId ?? null,
  sourceLayerId: textureEntry.sourceLayerId ?? null,
  provenanceId: textureEntry.provenanceId ?? null,
  binaryAssetRef: textureEntry.binaryAssetRef ?? null
});

const createBinaryEntryCacheKey = (
  binaryEntry: NonNullable<AuthoringSession["binaryAssets"]>["fileEntries"][number]
) => ({
  path: binaryEntry.path,
  binaryAssetId: binaryEntry.binaryAssetId ?? null,
  mediaType: binaryEntry.mediaType,
  byteLength: binaryEntry.bytes.byteLength,
  bytesIdentity: getBytesIdentity(binaryEntry.bytes)
});

const byteIdentities = new WeakMap<Uint8Array, number>();
let nextByteIdentity = 1;

const getBytesIdentity = (bytes: Uint8Array): number => {
  const existing = byteIdentities.get(bytes);
  if (existing !== undefined) {
    return existing;
  }

  const identity = nextByteIdentity;
  nextByteIdentity += 1;
  byteIdentities.set(bytes, identity);

  return identity;
};
