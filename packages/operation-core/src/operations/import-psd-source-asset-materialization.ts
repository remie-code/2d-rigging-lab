import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { SourceAssetIdSchema } from "@private-2d-rigging-lab/contracts";
import type { SourceAssetId } from "@private-2d-rigging-lab/contracts";

import type {
  ImportPsdSourceAssetPayloadDto,
  PsdAdapterResultDto,
  PsdAdapterSourceGroupDto,
  PsdAdapterSourceLayerDto
} from "../payloads/import-source.js";
import { createPsdSourceAssetDiagnostics } from "./import-psd-source-asset-diagnostics.js";
import { resolveBinaryBackedTexturePreviewReference } from "./import-binary-asset-references.js";
import { psdLayerRequestsTextureMaterialization } from "./import-psd-source-asset-texture.js";

export type PsdSourceAsset = AuthoringSession["graph"]["sourceAssets"][number];
type PsdProfile = NonNullable<PsdSourceAsset["psdProfile"]>;
type PsdProfileSourceGroup = PsdProfile["sourceGroups"][number];
type PsdProfileSourceLayer = PsdProfile["sourceLayers"][number];
type PsdSourceLayer = PsdSourceAsset["layers"][number];

export const createPsdSourceAssetFromPayload = (input: {
  readonly payload: ImportPsdSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
  readonly packageRelativePath: string;
  readonly contentHash: string;
}): PsdSourceAsset => {
  const adapterResult = input.payload.adapterResult;
  if (adapterResult === undefined) {
    throw new Error("Expected importPsdSourceAsset preconditions to reject missing adapter result.");
  }

  return {
    sourceAssetId: input.sourceAssetId,
    kind: "psd-source-v1",
    filePath: input.packageRelativePath,
    contentHash: input.contentHash,
    importProfile: "layered-character-psd-profile-v1",
    layers: adapterResult.sourceLayers.map((layer) =>
      createSourceLayerFromAdapterLayer({
        layer,
        payload: input.payload,
        sourceAssetId: input.sourceAssetId
      })
    ),
    diagnostics: createPsdSourceAssetDiagnostics(input.payload, input.sourceAssetId),
    ...(input.payload.fileRef.binaryAssetRef === undefined
      ? {}
      : { binaryAssetRef: structuredClone(input.payload.fileRef.binaryAssetRef) }),
    psdProfile: createPsdProfileFromAdapterResult(adapterResult)
  };
};

export const collectPsdImportTargetIds = (
  payload: ImportPsdSourceAssetPayloadDto,
  sourceAssetId: SourceAssetId
): readonly string[] => {
  const adapterResult = payload.adapterResult;
  if (adapterResult === undefined) {
    return [sourceAssetId];
  }

  return uniqueStrings([
    sourceAssetId,
    ...adapterResult.sourceGroups.map((group) => group.sourceGroupId),
    ...adapterResult.sourceLayers.map((layer) => layer.sourceLayerId),
    ...adapterResult.sourceGroups.flatMap((group) =>
      group.targetPartId === undefined ? [] : [group.targetPartId]
    ),
    ...adapterResult.sourceLayers.flatMap((layer) => {
      const textureTargets = psdLayerRequestsTextureMaterialization(layer) && layer.textureId !== undefined
        ? [layer.textureId]
        : [];
      return [
        ...textureTargets,
        ...(layer.targetPartId === undefined ? [] : [layer.targetPartId])
      ];
    })
  ]);
};

export const collectPsdCheckedPartIds = (adapterResult: PsdAdapterResultDto): readonly string[] =>
  uniqueStrings([
    ...adapterResult.sourceGroups.flatMap((group) =>
      group.targetPartId === undefined ? [] : [group.targetPartId]
    ),
    ...adapterResult.sourceLayers.flatMap((layer) =>
      layer.targetPartId === undefined ? [] : [layer.targetPartId]
    )
  ]);

export const resolvePsdSourceAssetId = (
  payload: ImportPsdSourceAssetPayloadDto
): SourceAssetId =>
  payload.sourceAssetId ?? createSourceAssetIdFromFilePath(payload.fileRef.packageRelativePath);

export const resolvePsdContentHash = (
  payload: ImportPsdSourceAssetPayloadDto,
  sourceAssetId: SourceAssetId
): string => {
  const contentHash = normalizePsdOptionalString(payload.fileRef.contentHash);
  return contentHash ?? `metadata:${sourceAssetId}`;
};

export const normalizePsdPackageRelativePath = (
  path: string | undefined
): string | undefined => {
  const trimmed = path?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const createSourceLayerFromAdapterLayer = (input: {
  readonly layer: PsdAdapterSourceLayerDto;
  readonly payload: ImportPsdSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
}): PsdSourceLayer => ({
  sourceLayerId: input.layer.sourceLayerId,
  sourceAssetId: input.sourceAssetId,
  originalName: input.layer.originalName,
  normalizedName: input.layer.normalizedName,
  groupPath: [...input.layer.groupPath],
  bounds: structuredClone(input.layer.bounds),
  visibleInSource: input.layer.visibleInSource,
  ...(input.layer.localVisibleInSource === undefined
    ? {}
    : { localVisibleInSource: input.layer.localVisibleInSource }),
  ...(input.layer.effectiveVisibleInSource === undefined
    ? {}
    : { effectiveVisibleInSource: input.layer.effectiveVisibleInSource }),
  opacityInSource: input.layer.opacityInSource,
  role: input.payload.requestedLayerRoles[input.layer.sourceLayerId] ?? input.layer.role,
  unsupportedFeatures: input.layer.unsupportedFeatures.map((feature) => feature.featureId),
  mappedDrawableIds: []
});

const createPsdProfileFromAdapterResult = (
  adapterResult: PsdAdapterResultDto
): PsdProfile => ({
  schemaVersion: "layered-character-psd-profile-v1",
  adapter: {
    adapterName: adapterResult.adapterName,
    ...(adapterResult.adapterVersion === undefined
      ? {}
      : { adapterVersion: adapterResult.adapterVersion }),
    adapterResultSchemaVersion: adapterResult.schemaVersion,
    sourceProfile: adapterResult.sourceProfile,
    evidenceKind: adapterResult.intakeKind === "realPsdParseResult"
      ? "real-psd-parse-result-v1"
      : "adapter-supplied-metadata-v1",
    ...(adapterResult.intakeKind === undefined ? {} : { intakeKind: adapterResult.intakeKind }),
    ...(adapterResult.parser === undefined ? {} : { parser: structuredClone(adapterResult.parser) })
  },
  canvas: structuredClone(adapterResult.canvas),
  sourceGroups: adapterResult.sourceGroups.map(createPsdProfileSourceGroup),
  sourceLayers: adapterResult.sourceLayers.map(createPsdProfileSourceLayer),
  unsupportedFeatures: structuredClone(adapterResult.unsupportedFeatures),
  ...(adapterResult.featureSupportEvidence === undefined
    ? {}
    : { featureSupportEvidence: structuredClone(adapterResult.featureSupportEvidence) }),
  ...(adapterResult.layerTreeEvidence === undefined
    ? {}
    : { layerTreeEvidence: structuredClone(adapterResult.layerTreeEvidence) }),
  ...(adapterResult.materializationEvidence === undefined
    ? {}
    : { materializationEvidence: structuredClone(adapterResult.materializationEvidence) }),
  diagnostics: structuredClone(adapterResult.diagnostics),
  compatibility: PSD_PROFILE_COMPATIBILITY_POLICY
});

const createPsdProfileSourceGroup = (
  group: PsdAdapterSourceGroupDto
): PsdProfileSourceGroup => ({
  sourceGroupId: group.sourceGroupId,
  originalName: group.originalName,
  normalizedName: group.normalizedName,
  ...(group.parentGroupId === undefined ? {} : { parentGroupId: group.parentGroupId }),
  groupPath: [...group.groupPath],
  sourceOrder: group.sourceOrder,
  visibleInSource: group.visibleInSource,
  ...(group.localVisibleInSource === undefined
    ? {}
    : { localVisibleInSource: group.localVisibleInSource }),
  ...(group.effectiveVisibleInSource === undefined
    ? {}
    : { effectiveVisibleInSource: group.effectiveVisibleInSource }),
  opacityInSource: group.opacityInSource,
  ...(group.bounds === undefined ? {} : { bounds: structuredClone(group.bounds) }),
  ...(group.blendMode === undefined ? {} : { blendMode: structuredClone(group.blendMode) }),
  ...(group.targetPartId === undefined ? {} : { targetPartId: group.targetPartId }),
  unsupportedFeatures: structuredClone(group.unsupportedFeatures),
  ...(group.featureSupportEvidence === undefined
    ? {}
    : { featureSupportEvidence: structuredClone(group.featureSupportEvidence) })
});

const createPsdProfileSourceLayer = (
  layer: PsdAdapterSourceLayerDto
): PsdProfileSourceLayer => ({
  sourceLayerId: layer.sourceLayerId,
  originalName: layer.originalName,
  normalizedName: layer.normalizedName,
  ...(layer.parentGroupId === undefined ? {} : { parentGroupId: layer.parentGroupId }),
  groupPath: [...layer.groupPath],
  sourceOrder: layer.sourceOrder,
  bounds: structuredClone(layer.bounds),
  visibleInSource: layer.visibleInSource,
  ...(layer.localVisibleInSource === undefined
    ? {}
    : { localVisibleInSource: layer.localVisibleInSource }),
  ...(layer.effectiveVisibleInSource === undefined
    ? {}
    : { effectiveVisibleInSource: layer.effectiveVisibleInSource }),
  opacityInSource: layer.opacityInSource,
  role: layer.role,
  ...(layer.blendMode === undefined ? {} : { blendMode: structuredClone(layer.blendMode) }),
  unsupportedFeatures: structuredClone(layer.unsupportedFeatures),
  ...(resolvePsdTexturePreviewReference(layer) === undefined
    ? {}
    : { texturePreviewReference: resolvePsdTexturePreviewReference(layer) }),
  ...(layer.textureId === undefined ? {} : { textureId: layer.textureId }),
  ...(layer.targetPartId === undefined ? {} : { targetPartId: layer.targetPartId }),
  ...(layer.featureSupportEvidence === undefined
    ? {}
    : { featureSupportEvidence: structuredClone(layer.featureSupportEvidence) })
});

const resolvePsdTexturePreviewReference = (
  layer: PsdAdapterSourceLayerDto
): string | undefined =>
  resolveBinaryBackedTexturePreviewReference({
    texturePreviewReference: layer.texturePreviewReference,
    texturePreviewBinaryAssetRef: layer.texturePreviewBinaryAssetRef
  });

const createSourceAssetIdFromFilePath = (filePath: string): SourceAssetId =>
  SourceAssetIdSchema.parse(`src_${sanitizeIdToken(filePath.replace(/\.[^.\\/]+$/, ""))}`);

const normalizePsdOptionalString = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const uniqueStrings = <TValue extends string>(values: readonly TValue[]): readonly TValue[] => {
  const seen = new Set<TValue>();
  const unique: TValue[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};

const PSD_PROFILE_COMPATIBILITY_POLICY: PsdProfile["compatibility"] = {
  structuredProfilePrecedence: "structured-profile-preferred-v1",
  flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
  flattenedUnsupportedFeaturesFallback:
    "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
};
