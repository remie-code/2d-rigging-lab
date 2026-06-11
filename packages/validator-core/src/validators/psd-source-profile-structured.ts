import type {
  LayeredCharacterPsdProfileDto,
  PsdProfileAdapterDiagnosticDto,
  PsdProfileSourceGroupDto,
  PsdProfileSourceLayerDto,
  PsdProfileSourceRefDto,
  PsdProfileUnsupportedFeatureDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";
import type {
  CheckStatus,
  Severity
} from "@private-2d-rigging-lab/contracts";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import { validatePsdSourceEvidenceDiagnostics } from "./psd-source-evidence-diagnostics.js";

export const hasFlattenedPsdProfileEvidence = (sourceAsset: SourceAssetDto): boolean =>
  sourceAsset.diagnostics.some((diagnostic) => /^psd[.:]/.test(diagnostic)) ||
  sourceAsset.layers.some((sourceLayer) => sourceLayer.unsupportedFeatures.length > 0);

export const validateStructuredPsdProfile = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  profile.unsupportedFeatures.forEach((unsupportedFeature, unsupportedFeatureIndex) => {
    checks.push(createStructuredUnsupportedFeatureCheck({
      sourceAsset,
      sourceAssetIndex,
      profile,
      unsupportedFeature,
      unsupportedFeatureIndex,
      targetPath:
        `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
        `/psdProfile/unsupportedFeatures/${unsupportedFeatureIndex}`,
      sourceEvidence: ["profileEntry=document"]
    }));
  });

  profile.sourceGroups.forEach((sourceGroup, sourceGroupIndex) => {
    sourceGroup.unsupportedFeatures.forEach((unsupportedFeature, unsupportedFeatureIndex) => {
      checks.push(createStructuredUnsupportedFeatureCheck({
        sourceAsset,
        sourceAssetIndex,
        profile,
        unsupportedFeature,
        unsupportedFeatureIndex,
        targetPath:
          `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
          `/psdProfile/sourceGroups/${sourceGroupIndex}/unsupportedFeatures/${unsupportedFeatureIndex}`,
        sourceEvidence: createSourceGroupEvidence(sourceGroup)
      }));
    });
  });

  profile.sourceLayers.forEach((sourceLayer, sourceLayerIndex) => {
    sourceLayer.unsupportedFeatures.forEach((unsupportedFeature, unsupportedFeatureIndex) => {
      checks.push(createStructuredUnsupportedFeatureCheck({
        sourceAsset,
        sourceAssetIndex,
        profile,
        unsupportedFeature,
        unsupportedFeatureIndex,
        targetPath:
          `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
          `/psdProfile/sourceLayers/${sourceLayerIndex}/unsupportedFeatures/${unsupportedFeatureIndex}`,
        sourceEvidence: createSourceLayerEvidence(sourceLayer)
      }));
    });
  });

  profile.diagnostics.forEach((diagnostic, diagnosticIndex) => {
    checks.push(createAdapterDiagnosticCheck({
      sourceAsset,
      sourceAssetIndex,
      profile,
      diagnostic,
      diagnosticIndex
    }));
  });

  checks.push(...validatePsdSourceEvidenceDiagnostics(sourceAsset, sourceAssetIndex, profile));
  checks.push(...validateStructuredFallbackCompatibility(sourceAsset, sourceAssetIndex, profile));
  return checks;
};

export const createStructuredProfileMissingCheck = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/psdProfile`;
  const flattenedUnsupportedFeatureCount = sourceAsset.layers.reduce(
    (count, layer) => count + layer.unsupportedFeatures.length,
    0
  );

  return ValidationCheckResultSchema.parse({
    checkId: "asset.psd.structuredProfileMissing",
    status: "pass",
    severity: "info",
    phase: "source_import",
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message: `PSD source asset ${sourceAsset.sourceAssetId} has no structured psdProfile; using flattened compatibility fields.`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`,
      `importProfile=${sourceAsset.importProfile}`,
      "structuredProfile=missing",
      "fallbackCompatibility=sourceAsset.diagnostics-summary-fallback-v1",
      "flattenedUnsupportedFeaturesFallback=sourceLayer.unsupportedFeatures-feature-id-fallback-v1",
      `flattenedLayerCount=${sourceAsset.layers.length}`,
      `flattenedDiagnosticCount=${sourceAsset.diagnostics.length}`,
      `flattenedUnsupportedFeatureCount=${flattenedUnsupportedFeatureCount}`
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-IN-003"],
    impact: "The validator kept Wave20 flattened PSD source metadata compatible, but structured adapter/group/layer detail is unavailable."
  });
};

export const createStructuredProfileMismatchCheck = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/psdProfile`;

  return ValidationCheckResultSchema.parse({
    checkId: "asset.psd.structuredProfileMismatch",
    status: "fail",
    severity: "error",
    phase: "source_import",
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message: `Source asset ${sourceAsset.sourceAssetId} carries a PSD structured profile but is not a PSD source asset.`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`,
      `importProfile=${sourceAsset.importProfile}`,
      "structuredProfile=present",
      "expectedKind=psd-source-v1",
      "expectedImportProfile=layered-character-psd-profile-v1",
      "reason=psd-profile-on-non-psd-source"
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The source manifest mixes split/generated source semantics with PSD-only adapter evidence."
  });
};

const validateStructuredFallbackCompatibility = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  profile: LayeredCharacterPsdProfileDto
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const flattenedLayersById = new Map(
    sourceAsset.layers.map((sourceLayer, sourceLayerIndex) => [
      sourceLayer.sourceLayerId,
      { sourceLayer, sourceLayerIndex }
    ])
  );
  const structuredLayersById = new Map(
    profile.sourceLayers.map((sourceLayer, sourceLayerIndex) => [
      sourceLayer.sourceLayerId,
      { sourceLayer, sourceLayerIndex }
    ])
  );

  profile.sourceLayers.forEach((structuredLayer, structuredLayerIndex) => {
    const flattenedLayer = flattenedLayersById.get(structuredLayer.sourceLayerId);
    if (flattenedLayer === undefined && structuredLayer.unsupportedFeatures.length > 0) {
      checks.push(createFlattenedFallbackMismatchCheck({
        sourceAsset,
        sourceAssetIndex,
        targetPath:
          `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
          `/psdProfile/sourceLayers/${structuredLayerIndex}/unsupportedFeatures`,
        sourceLayerId: structuredLayer.sourceLayerId,
        structuredFeatureIds: structuredLayer.unsupportedFeatures.map((feature) => feature.featureId),
        flattenedFeatureIds: [],
        reason: "structured-layer-missing-from-flattened-layers"
      }));
    }
  });

  sourceAsset.layers.forEach((flattenedLayer, flattenedLayerIndex) => {
    const structuredLayer = structuredLayersById.get(flattenedLayer.sourceLayerId);
    const structuredFeatureIds = structuredLayer?.sourceLayer.unsupportedFeatures.map(
      (feature) => feature.featureId
    ) ?? [];
    const flattenedFeatureIds = flattenedLayer.unsupportedFeatures;

    if (hasSameValues(structuredFeatureIds, flattenedFeatureIds)) {
      return;
    }

    checks.push(createFlattenedFallbackMismatchCheck({
      sourceAsset,
      sourceAssetIndex,
      targetPath:
        `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}` +
        `/layers/${flattenedLayerIndex}/unsupportedFeatures`,
      sourceLayerId: flattenedLayer.sourceLayerId,
      structuredFeatureIds,
      flattenedFeatureIds,
      reason: structuredLayer === undefined
        ? "flattened-layer-missing-from-structured-profile"
        : "unsupported-feature-fallback-mismatch"
    }));
  });

  return checks;
};

const createStructuredUnsupportedFeatureCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly unsupportedFeature: PsdProfileUnsupportedFeatureDto;
  readonly unsupportedFeatureIndex: number;
  readonly targetPath: string;
  readonly sourceEvidence: readonly string[];
}): ValidationCheckResultDto => {
  const status = statusForPsdSeverity(input.unsupportedFeature.severity);

  return ValidationCheckResultSchema.parse({
    checkId: "asset.psd.unsupportedFeature",
    status,
    severity: input.unsupportedFeature.severity,
    phase: "source_import",
    target: {
      kind: "sourceAsset",
      id: input.sourceAsset.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message:
      `PSD structured profile records unsupported feature ${input.unsupportedFeature.featureId}` +
      ` (${input.unsupportedFeature.scope}): ${input.unsupportedFeature.message}`,
    evidence: [
      `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
      `sourceKind=${input.sourceAsset.kind}`,
      `importProfile=${input.sourceAsset.importProfile}`,
      ...createAdapterEvidence(input.profile),
      ...input.sourceEvidence,
      `unsupportedFeature=${input.unsupportedFeature.featureId}`,
      `unsupportedFeatureScope=${input.unsupportedFeature.scope}`,
      `unsupportedFeatureSeverity=${input.unsupportedFeature.severity}`,
      `unsupportedFeatureIndex=${input.unsupportedFeatureIndex}`,
      `rasterizeCandidate=${input.unsupportedFeature.rasterizeCandidate}`,
      `manualConfirmationRequired=${input.unsupportedFeature.manualConfirmationRequired}`,
      ...createSourceRefEvidence("unsupportedFeatureSource", input.unsupportedFeature.source),
      "structuredProfile=psdProfile",
      `compatibility=${input.profile.compatibility.structuredProfilePrecedence}`,
      `flattenedFallback=${input.profile.compatibility.flattenedUnsupportedFeaturesFallback}`
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-003"],
    impact: status === "fail"
      ? "The PSD adapter reported source structure that cannot be accepted without manual repair or a future adapter path."
      : "The PSD source profile is structurally readable, but this retained feature needs review or a future adapter/rasterization path before final acceptance."
  });
};

const createAdapterDiagnosticCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly profile: LayeredCharacterPsdProfileDto;
  readonly diagnostic: PsdProfileAdapterDiagnosticDto;
  readonly diagnosticIndex: number;
}): ValidationCheckResultDto => {
  const targetPath =
    `/assets/sourceManifest/sourceAssets/${input.sourceAssetIndex}` +
    `/psdProfile/diagnostics/${input.diagnosticIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "asset.psd.adapterDiagnostic",
    status: statusForPsdSeverity(input.diagnostic.severity),
    severity: input.diagnostic.severity,
    phase: "source_import",
    target: {
      kind: "sourceAsset",
      id: input.sourceAsset.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message:
      `PSD adapter ${input.profile.adapter.adapterName} reported ${input.diagnostic.checkId}: ` +
      input.diagnostic.message,
    evidence: [
      `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
      `sourceKind=${input.sourceAsset.kind}`,
      `importProfile=${input.sourceAsset.importProfile}`,
      ...createAdapterEvidence(input.profile),
      `adapterDiagnosticCheckId=${input.diagnostic.checkId}`,
      `adapterDiagnosticSeverity=${input.diagnostic.severity}`,
      `adapterDiagnosticIndex=${input.diagnosticIndex}`,
      ...createSourceRefEvidence("adapterDiagnosticSource", input.diagnostic.source),
      ...input.diagnostic.evidence.map((evidence, evidenceIndex) =>
        `adapterEvidence[${evidenceIndex}]=${evidence}`
      ),
      "structuredProfile=psdProfile",
      `compatibility=${input.profile.compatibility.structuredProfilePrecedence}`
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-003"],
    impact: "The trusted PSD adapter supplied a structured diagnostic that should remain visible to AI and review consumers."
  });
};

const createFlattenedFallbackMismatchCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly targetPath: string;
  readonly sourceLayerId: string;
  readonly structuredFeatureIds: readonly string[];
  readonly flattenedFeatureIds: readonly string[];
  readonly reason: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "asset.psd.flattenedFallbackMismatch",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    target: {
      kind: "sourceAsset",
      id: input.sourceAsset.sourceAssetId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message:
      `PSD source layer ${input.sourceLayerId} structured unsupported features do not match ` +
      "flattened compatibility unsupportedFeatures.",
    evidence: [
      `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
      `sourceKind=${input.sourceAsset.kind}`,
      `importProfile=${input.sourceAsset.importProfile}`,
      `sourceLayerId=${input.sourceLayerId}`,
      `structuredUnsupportedFeatures=${input.structuredFeatureIds.join(",") || "none"}`,
      `flattenedUnsupportedFeatures=${input.flattenedFeatureIds.join(",") || "none"}`,
      "structuredProfile=psdProfile",
      "compatibility=structured-profile-preferred-v1",
      "flattenedFallback=sourceLayer.unsupportedFeatures-feature-id-fallback-v1",
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-003"],
    impact: "Structured PSD metadata remains authoritative, but flattened fallback consumers would see different unsupported feature IDs."
  });

const statusForPsdSeverity = (severity: Exclude<Severity, "blocking">): CheckStatus =>
  severity === "error" ? "fail" : severity === "warning" ? "needs_review" : "pass";

const createAdapterEvidence = (profile: LayeredCharacterPsdProfileDto): readonly string[] => [
  `adapterName=${profile.adapter.adapterName}`,
  `adapterResultSchemaVersion=${profile.adapter.adapterResultSchemaVersion}`,
  `sourceProfile=${profile.adapter.sourceProfile}`,
  `adapterEvidenceKind=${profile.adapter.evidenceKind}`,
  `canvas=${profile.canvas.width}x${profile.canvas.height}`
];

const createSourceGroupEvidence = (sourceGroup: PsdProfileSourceGroupDto): readonly string[] => [
  "profileEntry=sourceGroup",
  `sourceGroupId=${sourceGroup.sourceGroupId}`,
  `sourceGroupOrder=${sourceGroup.sourceOrder}`,
  `groupPath=${sourceGroup.groupPath.join("/") || "root"}`,
  `visibleInSource=${sourceGroup.visibleInSource}`,
  `localVisibleInSource=${sourceGroup.localVisibleInSource ?? sourceGroup.visibleInSource}`,
  `opacityInSource=${sourceGroup.opacityInSource}`,
  `targetPartId=${sourceGroup.targetPartId ?? "missing"}`
];

const createSourceLayerEvidence = (sourceLayer: PsdProfileSourceLayerDto): readonly string[] => [
  "profileEntry=sourceLayer",
  `sourceLayerId=${sourceLayer.sourceLayerId}`,
  `sourceLayerOrder=${sourceLayer.sourceOrder}`,
  `groupPath=${sourceLayer.groupPath.join("/") || "root"}`,
  `sourceLayerRole=${sourceLayer.role}`,
  `visibleInSource=${sourceLayer.visibleInSource}`,
  `localVisibleInSource=${sourceLayer.localVisibleInSource ?? sourceLayer.visibleInSource}`,
  `opacityInSource=${sourceLayer.opacityInSource}`,
  `targetPartId=${sourceLayer.targetPartId ?? "missing"}`,
  `textureId=${sourceLayer.textureId ?? "missing"}`,
  `texturePreviewReference=${sourceLayer.texturePreviewReference ?? "missing"}`
];

const createSourceRefEvidence = (
  prefix: string,
  source: PsdProfileSourceRefDto | undefined
): readonly string[] =>
  source === undefined
    ? [`${prefix}=missing`]
    : [
      `${prefix}Kind=${source.kind}`,
      `${prefix}Id=${source.id ?? "missing"}`,
      `${prefix}Path=${source.path ?? "missing"}`
    ];

const hasSameValues = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);
