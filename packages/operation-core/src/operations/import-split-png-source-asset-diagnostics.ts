import type {
  DiagnosticDto,
  SourceAssetId
} from "@private-2d-rigging-lab/contracts";

import type {
  SplitPngSourceAssetPayloadDto
} from "../payloads/import-source.js";
import {
  createPendingBinaryAssetReferenceDiagnostics,
  resolveBinaryBackedTexturePreviewReference
} from "./import-binary-asset-references.js";

export const createSplitPngSourceAssetDiagnostics = (
  payload: SplitPngSourceAssetPayloadDto
): string[] => {
  const diagnostics = ["split-png-fallback-v1"];

  if (payload.placementPolicy === "origin-with-warning") {
    diagnostics.push("splitPng.originPlacementFallback");
  }

  if (payload.binaryAssetRef !== undefined) {
    diagnostics.push(
      `splitPng.binaryAssetRef:${toBinaryAssetReferenceDiagnostic(payload.binaryAssetRef)}`
    );
  }

  for (const layer of payload.layers) {
    if (layer.imagePath !== undefined) {
      diagnostics.push(`splitPng.layerImage:${layer.sourceLayerId}:${layer.imagePath}`);
    }

    if (layer.textureId !== undefined) {
      diagnostics.push(`splitPng.layerTexture:${layer.sourceLayerId}:${layer.textureId}`);
    }

    if (layer.targetPartId !== undefined) {
      diagnostics.push(`splitPng.layerTargetPart:${layer.sourceLayerId}:${layer.targetPartId}`);
    }

    const texturePreviewReference = resolveBinaryBackedTexturePreviewReference({
      texturePreviewReference: layer.texturePreviewReference,
      texturePreviewBinaryAssetRef: layer.texturePreviewBinaryAssetRef
    });

    if (texturePreviewReference !== undefined) {
      diagnostics.push(
        `splitPng.layerTexturePreview:${layer.sourceLayerId}:${texturePreviewReference}`
      );
    }

    if (layer.texturePreviewBinaryAssetRef !== undefined) {
      diagnostics.push(
        `splitPng.layerTextureBinaryAssetRef:${layer.sourceLayerId}:${toBinaryAssetReferenceDiagnostic(layer.texturePreviewBinaryAssetRef)}`
      );
    }
  }

  return uniqueStrings(diagnostics);
};

export const createSplitPngBinaryAssetReferenceOperationDiagnostics = (input: {
  readonly payload: SplitPngSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  const references = [
    ...(input.payload.binaryAssetRef === undefined
      ? []
      : [
          {
            binaryAssetRef: input.payload.binaryAssetRef,
            targetPath: "/payload/binaryAssetRef",
            label: "Split PNG source"
          }
        ]),
    ...input.payload.layers.flatMap((layer) =>
      layer.texturePreviewBinaryAssetRef === undefined
        ? []
        : [
            {
              binaryAssetRef: layer.texturePreviewBinaryAssetRef,
              targetPath: `/payload/layers/${layer.sourceLayerId}/texturePreviewBinaryAssetRef`,
              label: `Split PNG texture preview for ${layer.sourceLayerId}`
            }
          ]
    )
  ];

  return createPendingBinaryAssetReferenceDiagnostics({
    checkId: "operation.importSplitPngSourceAsset.binaryPayloadPending",
    sourceAssetId: input.sourceAssetId,
    references
  });
};

const toBinaryAssetReferenceDiagnostic = (
  binaryAssetRef: NonNullable<SplitPngSourceAssetPayloadDto["binaryAssetRef"]>
): string =>
  JSON.stringify({
    binaryAssetId: binaryAssetRef.binaryAssetId,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    storageStatus: binaryAssetRef.storageStatus,
    mediaType: binaryAssetRef.mediaType,
    byteLength: binaryAssetRef.byteLength
  });

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};
