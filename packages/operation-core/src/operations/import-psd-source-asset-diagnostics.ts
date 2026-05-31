import type {
  CheckStatus,
  DiagnosticDto,
  SourceAssetId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import type {
  ImportPsdSourceAssetPayloadDto,
  PsdAdapterDiagnosticDto,
  PsdAdapterResultDto,
  PsdAdapterSourceGroupDto,
  PsdAdapterSeverityDto,
  PsdAdapterUnsupportedFeatureDto
} from "../payloads/import-source.js";
import {
  createPendingBinaryAssetReferenceDiagnostics,
  resolveBinaryBackedTexturePreviewReference
} from "./import-binary-asset-references.js";
import { createLayerPayloadPath } from "./import-psd-source-asset-texture.js";

export const createPsdSourceAssetDiagnostics = (
  payload: ImportPsdSourceAssetPayloadDto,
  sourceAssetId: SourceAssetId
): string[] => {
  const adapterResult = payload.adapterResult;
  if (adapterResult === undefined) {
    return ["psd.missingAdapterResult"];
  }

  const diagnostics = [
    "layered-character-psd-profile-v1",
    adapterResult.schemaVersion,
    `psd.adapterName:${adapterResult.adapterName}`,
    `psd.canvas:${adapterResult.canvas.width}x${adapterResult.canvas.height}`
  ];

  if (payload.fileRef.binaryAssetRef !== undefined) {
    diagnostics.push(
      `psd.binaryAssetRef:${toBinaryAssetReferenceDiagnostic(payload.fileRef.binaryAssetRef)}`
    );
  }

  if (adapterResult.canvas.bounds !== undefined) {
    diagnostics.push(`psd.canvasBounds:${stableStringify(adapterResult.canvas.bounds)}`);
  }

  for (const group of adapterResult.sourceGroups) {
    diagnostics.push(`psd.sourceGroup:${stableStringify(toSourceGroupDiagnostic(group))}`);

    if (group.targetPartId !== undefined) {
      diagnostics.push(`psd.groupTargetPart:${group.sourceGroupId}:${group.targetPartId}`);
    }

    for (const feature of group.unsupportedFeatures) {
      diagnostics.push(`psd.groupUnsupportedFeature:${group.sourceGroupId}:${stableStringify(toUnsupportedFeatureDiagnostic(feature))}`);
    }
  }

  for (const layer of adapterResult.sourceLayers) {
    diagnostics.push(`psd.layerSourceOrder:${layer.sourceLayerId}:${layer.sourceOrder}`);

    if (payload.requestedLayerRoles[layer.sourceLayerId] !== undefined) {
      diagnostics.push(`psd.requestedLayerRole:${layer.sourceLayerId}:${payload.requestedLayerRoles[layer.sourceLayerId]}`);
    }

    if (layer.parentGroupId !== undefined) {
      diagnostics.push(`psd.layerParentGroup:${layer.sourceLayerId}:${layer.parentGroupId}`);
    }

    if (layer.targetPartId !== undefined) {
      diagnostics.push(`psd.layerTargetPart:${layer.sourceLayerId}:${layer.targetPartId}`);
    }

    if (layer.textureId !== undefined) {
      diagnostics.push(`psd.layerTexture:${layer.sourceLayerId}:${layer.textureId}`);
    }

    const texturePreviewReference = resolveBinaryBackedTexturePreviewReference({
      texturePreviewReference: layer.texturePreviewReference,
      texturePreviewBinaryAssetRef: layer.texturePreviewBinaryAssetRef
    });

    if (texturePreviewReference !== undefined) {
      diagnostics.push(`psd.layerTexturePreview:${layer.sourceLayerId}:${texturePreviewReference}`);
    }

    if (layer.texturePreviewBinaryAssetRef !== undefined) {
      diagnostics.push(
        `psd.layerTextureBinaryAssetRef:${layer.sourceLayerId}:${toBinaryAssetReferenceDiagnostic(layer.texturePreviewBinaryAssetRef)}`
      );
    }

    for (const feature of layer.unsupportedFeatures) {
      diagnostics.push(`psd.layerUnsupportedFeature:${layer.sourceLayerId}:${stableStringify(toUnsupportedFeatureDiagnostic(feature))}`);
    }
  }

  for (const feature of adapterResult.unsupportedFeatures) {
    diagnostics.push(`psd.unsupportedFeature:${stableStringify(toUnsupportedFeatureDiagnostic(feature))}`);
  }

  for (const diagnostic of adapterResult.diagnostics) {
    diagnostics.push(`psd.adapterDiagnostic:${stableStringify(toAdapterDiagnostic(diagnostic))}`);
  }

  diagnostics.push(`psd.sourceAsset:${sourceAssetId}`);
  return diagnostics;
};

export const createPsdAdapterResultOperationDiagnostics = (input: {
  readonly adapterResult: PsdAdapterResultDto;
  readonly sourceAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  for (const feature of input.adapterResult.unsupportedFeatures) {
    diagnostics.push(createUnsupportedFeatureOperationDiagnostic(input.sourceAssetId, feature));
  }

  for (const group of input.adapterResult.sourceGroups) {
    for (const feature of group.unsupportedFeatures) {
      diagnostics.push(
        createUnsupportedFeatureOperationDiagnostic(input.sourceAssetId, feature, {
          path: `${createGroupPayloadPath(group.sourceGroupId)}/unsupportedFeatures/${feature.featureId}`
        })
      );
    }
  }

  for (const layer of input.adapterResult.sourceLayers) {
    for (const feature of layer.unsupportedFeatures) {
      diagnostics.push(
        createUnsupportedFeatureOperationDiagnostic(input.sourceAssetId, feature, {
          path: `${createLayerPayloadPath(layer.sourceLayerId)}/unsupportedFeatures/${feature.featureId}`
        })
      );
    }
  }

  for (const diagnostic of input.adapterResult.diagnostics) {
    diagnostics.push(createAdapterOperationDiagnostic(input.sourceAssetId, diagnostic));
  }

  return diagnostics;
};

export const createPsdBinaryAssetReferenceOperationDiagnostics = (input: {
  readonly payload: ImportPsdSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
}): DiagnosticDto[] => {
  const references = [
    ...(input.payload.fileRef.binaryAssetRef === undefined
      ? []
      : [
          {
            binaryAssetRef: input.payload.fileRef.binaryAssetRef,
            targetPath: "/payload/fileRef/binaryAssetRef",
            label: "PSD source"
          }
        ]),
    ...(input.payload.adapterResult?.sourceLayers.flatMap((layer) =>
      layer.texturePreviewBinaryAssetRef === undefined
        ? []
        : [
            {
              binaryAssetRef: layer.texturePreviewBinaryAssetRef,
              targetPath: `${createLayerPayloadPath(layer.sourceLayerId)}/texturePreviewBinaryAssetRef`,
              label: `PSD texture preview for ${layer.sourceLayerId}`
            }
          ]
    ) ?? [])
  ];

  return createPendingBinaryAssetReferenceDiagnostics({
    checkId: "operation.importPsdSourceAsset.binaryPayloadPending",
    sourceAssetId: input.sourceAssetId,
    references
  });
};

export const createGroupPayloadPath = (sourceGroupId: string): string =>
  `/payload/adapterResult/sourceGroups/${sourceGroupId}`;

const createUnsupportedFeatureOperationDiagnostic = (
  sourceAssetId: SourceAssetId,
  feature: PsdAdapterUnsupportedFeatureDto,
  targetOverride: { readonly path?: string } = {}
): DiagnosticDto => {
  const severity = mapAdapterSeverity(feature.severity);
  const status = mapAdapterStatus(feature.severity, feature.manualConfirmationRequired);

  return createResultDiagnostic({
    checkId: "operation.importPsdSourceAsset.unsupportedFeature",
    status,
    severity,
    phase: "operation.import.adapterResult",
    target: {
      kind: "sourceAsset",
      id: sourceAssetId,
      path: targetOverride.path ?? createSourceRefPath(feature.source, `/unsupportedFeatures/${feature.featureId}`)
    },
    message: feature.message,
    evidence: [
      `featureId:${feature.featureId}`,
      `scope:${feature.scope}`,
      `rasterizeCandidate:${feature.rasterizeCandidate}`,
      `manualConfirmationRequired:${feature.manualConfirmationRequired}`
    ]
  });
};

const createAdapterOperationDiagnostic = (
  sourceAssetId: SourceAssetId,
  diagnostic: PsdAdapterDiagnosticDto
): DiagnosticDto => {
  const severity = mapAdapterSeverity(diagnostic.severity);

  return createResultDiagnostic({
    checkId: "operation.importPsdSourceAsset.adapterDiagnostic",
    status: mapAdapterStatus(diagnostic.severity, false),
    severity,
    phase: "operation.import.adapterResult",
    target: {
      kind: "sourceAsset",
      id: sourceAssetId,
      path: createSourceRefPath(diagnostic.source, "/adapterResult/diagnostics")
    },
    message: diagnostic.message,
    evidence: [`adapterCheckId:${diagnostic.checkId}`, ...diagnostic.evidence]
  });
};

const createResultDiagnostic = (input: {
  readonly checkId: string;
  readonly status: CheckStatus;
  readonly severity: DiagnosticDto["severity"];
  readonly phase: string;
  readonly target: TargetRefDto;
  readonly message: string;
  readonly evidence: readonly string[];
}): DiagnosticDto => ({
  checkId: input.checkId as DiagnosticDto["checkId"],
  status: input.status,
  severity: input.severity,
  phase: input.phase,
  target: input.target,
  message: input.message,
  evidence: [...input.evidence],
  relatedAC: [],
  relatedScenarios: [],
  repairCandidateIds: []
});

const mapAdapterSeverity = (
  severity: PsdAdapterSeverityDto
): DiagnosticDto["severity"] => {
  switch (severity) {
    case "info":
      return "info";
    case "warning":
      return "warning";
    case "error":
      return "error";
  }
};

const mapAdapterStatus = (
  severity: PsdAdapterSeverityDto,
  manualConfirmationRequired: boolean
): CheckStatus => {
  if (severity === "error") {
    return "fail";
  }

  if (manualConfirmationRequired) {
    return "needs_review";
  }

  return severity === "warning" ? "warning" : "pass";
};

const createSourceRefPath = (
  source: PsdAdapterDiagnosticDto["source"] | PsdAdapterUnsupportedFeatureDto["source"],
  fallbackPath: string
): string => {
  if (source?.path !== undefined) {
    return source.path.startsWith("/") ? source.path : `/${source.path}`;
  }

  if (source?.id !== undefined) {
    return `/${source.kind}s/${source.id}`;
  }

  return fallbackPath;
};

const toSourceGroupDiagnostic = (group: PsdAdapterSourceGroupDto): unknown => ({
  sourceGroupId: group.sourceGroupId,
  originalName: group.originalName,
  normalizedName: group.normalizedName,
  ...(group.parentGroupId === undefined ? {} : { parentGroupId: group.parentGroupId }),
  groupPath: group.groupPath,
  sourceOrder: group.sourceOrder,
  visibleInSource: group.visibleInSource,
  opacityInSource: group.opacityInSource,
  ...(group.bounds === undefined ? {} : { bounds: group.bounds }),
  ...(group.targetPartId === undefined ? {} : { targetPartId: group.targetPartId })
});

const toUnsupportedFeatureDiagnostic = (feature: PsdAdapterUnsupportedFeatureDto): unknown => ({
  featureId: feature.featureId,
  scope: feature.scope,
  severity: feature.severity,
  message: feature.message,
  ...(feature.source === undefined ? {} : { source: feature.source }),
  rasterizeCandidate: feature.rasterizeCandidate,
  manualConfirmationRequired: feature.manualConfirmationRequired
});

const toAdapterDiagnostic = (diagnostic: PsdAdapterDiagnosticDto): unknown => ({
  checkId: diagnostic.checkId,
  severity: diagnostic.severity,
  message: diagnostic.message,
  ...(diagnostic.source === undefined ? {} : { source: diagnostic.source }),
  evidence: diagnostic.evidence
});

const toBinaryAssetReferenceDiagnostic = (
  binaryAssetRef: NonNullable<ImportPsdSourceAssetPayloadDto["fileRef"]["binaryAssetRef"]>
): string =>
  stableStringify({
    binaryAssetId: binaryAssetRef.binaryAssetId,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    storageStatus: binaryAssetRef.storageStatus,
    mediaType: binaryAssetRef.mediaType,
    byteLength: binaryAssetRef.byteLength
  });

const stableStringify = (value: unknown): string => JSON.stringify(value);
