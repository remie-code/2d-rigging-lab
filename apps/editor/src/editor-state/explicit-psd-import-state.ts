import type {
  PsdAdapterDiagnosticDto,
  PsdAdapterFeatureSupportEvidenceDto,
  PsdAdapterLayerMaterializationEvidenceDto,
  PsdAdapterResultDto,
  PsdAdapterSourceLayerDto,
  PsdAdapterUnsupportedFeatureDto
} from "@private-2d-rigging-lab/operation-core";

export const explicitPsdImportDefaultSelectedLayerNodeRef = "psd:root/layer[0]";

export type ExplicitPsdImportStatus = "idle" | "parsed" | "rejected" | "failed";

export interface ExplicitPsdImportRectState {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ExplicitPsdImportSourceState {
  readonly fileName: string;
  readonly declaredMediaType: string | null;
  readonly byteLength: number;
  readonly sizeCapBytes: number;
  readonly intakeKind: "explicitFile" | "explicitArrayBuffer";
  readonly rawBytesPersistence: "notPersistedByParserBridge";
  readonly publicDistribution: "notPublicDistributable";
}

export interface ExplicitPsdImportDocumentState {
  readonly sourceProfile: "layered-character-psd-profile-v1";
  readonly adapterName: string;
  readonly adapterVersion: string | null;
  readonly parserLabel: string;
  readonly parserRuntime: string;
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly bounds: ExplicitPsdImportRectState | null;
  };
}

export interface ExplicitPsdImportTreeSummaryState {
  readonly groupCount: number;
  readonly layerCount: number;
  readonly visibleLayerCount: number;
  readonly hiddenLayerCount: number;
  readonly rasterCandidateLayerCount: number;
  readonly maxDepth: number;
}

export interface ExplicitPsdImportTreeRowState {
  readonly nodeRef: string;
  readonly kind: "group" | "layer";
  readonly depth: number;
  readonly name: string;
  readonly normalizedName: string;
  readonly groupPath: readonly string[];
  readonly sourceOrder: number;
  readonly visibleInSource: boolean;
  readonly opacityInSource: number;
  readonly bounds: ExplicitPsdImportRectState | null;
  readonly role: string | null;
  readonly blendModeLabel: string | null;
  readonly unsupportedFeatureIds: readonly string[];
}

export interface ExplicitPsdImportFeatureSupportSummaryState {
  readonly evidenceCount: number;
  readonly unsupportedCount: number;
  readonly notEvaluatedCount: number;
  readonly unsupportedFeatureIds: readonly string[];
  readonly notEvaluatedFeatureIds: readonly string[];
}

export interface ExplicitPsdImportMaterializationState {
  readonly materializationId: string;
  readonly sourceLayerId: string;
  readonly sourceLayerPath: readonly string[];
  readonly mediaType: string;
  readonly byteLength: number;
  readonly digest: {
    readonly algorithm: "sha256";
    readonly hex: string;
  };
  readonly bytePersistence: "summaryOnlyNoRawBytes";
}

export interface ExplicitPsdImportDiagnosticState {
  readonly checkId: string;
  readonly severity: "info" | "warning" | "error";
  readonly message: string;
}

export interface ExplicitPsdImportFactState {
  readonly label: string;
  readonly value: string;
}

export interface ExplicitPsdLayerIntakeState {
  readonly status: "idle" | "committed" | "rejected" | "failed";
  readonly summaryFacts: readonly ExplicitPsdImportFactState[];
  readonly diagnostics: readonly ExplicitPsdImportDiagnosticState[];
}

export interface ExplicitPsdImportPersistenceBoundaryState {
  readonly parserPrivateShapePolicy: "parser-private-shape-excluded-v1";
  readonly rawParserObjectPersistence: "notPersisted";
  readonly sourcePsdBytePersistence: "sessionReadOnlyNoRawBytesPersistedByParser";
  readonly materializedLayerBytePersistence: "summaryOnlyNoRawBytes";
  readonly saveLoadSemantics: "sessionEvidenceClearedOnProjectLoadReparseRequiredV1";
  readonly photoshopCompositingClaim: "none";
  readonly rendererPixelOracleClaim: "none";
}

export interface ExplicitPsdImportState {
  readonly status: ExplicitPsdImportStatus;
  readonly selectedLayerNodeRef: string;
  readonly source: ExplicitPsdImportSourceState | null;
  readonly document: ExplicitPsdImportDocumentState | null;
  readonly treeSummary: ExplicitPsdImportTreeSummaryState | null;
  readonly treeRows: readonly ExplicitPsdImportTreeRowState[];
  readonly featureSupport: ExplicitPsdImportFeatureSupportSummaryState;
  readonly unsupportedFeatureLabels: readonly string[];
  readonly notEvaluatedFeatureLabels: readonly string[];
  readonly materialization: readonly ExplicitPsdImportMaterializationState[];
  readonly selectedLayerIntake: ExplicitPsdLayerIntakeState;
  readonly diagnostics: readonly ExplicitPsdImportDiagnosticState[];
  readonly persistenceBoundary: ExplicitPsdImportPersistenceBoundaryState;
}

export interface ExplicitPsdImportBridgeResultInput {
  readonly status: "parsed" | "rejected" | "failed";
  readonly source: {
    readonly fileName: string;
    readonly declaredMediaType?: string;
    readonly byteLength: number;
    readonly sizeCapBytes: number;
    readonly intakeKind: "explicitFile" | "explicitArrayBuffer";
    readonly privacy: {
      readonly publicDistribution: "notPublicDistributable";
      readonly rawBytesPersistence: "notPersistedByParserBridge";
    };
  };
  readonly treeSummary?: ExplicitPsdImportTreeSummaryState;
  readonly adapterResult?: PsdAdapterResultDto;
  readonly diagnostics: readonly PsdAdapterDiagnosticDto[];
  readonly errorEvidence: readonly {
    readonly errorId: string;
    readonly severity: "warning" | "error";
    readonly message: string;
  }[];
}

export const createEmptyExplicitPsdImportState = (): ExplicitPsdImportState => ({
  status: "idle",
  selectedLayerNodeRef: explicitPsdImportDefaultSelectedLayerNodeRef,
  source: null,
  document: null,
  treeSummary: null,
  treeRows: [],
  featureSupport: createEmptyFeatureSupportSummary(),
  unsupportedFeatureLabels: [],
  notEvaluatedFeatureLabels: [],
  materialization: [],
  selectedLayerIntake: createEmptyExplicitPsdLayerIntakeState(),
  diagnostics: [],
  persistenceBoundary: createExplicitPsdImportPersistenceBoundary()
});

export const createEmptyExplicitPsdLayerIntakeState =
  (): ExplicitPsdLayerIntakeState => ({
    status: "idle",
    summaryFacts: [],
    diagnostics: []
  });

export const projectExplicitPsdImportStateFromBridgeResult = (
  input: ExplicitPsdImportBridgeResultInput,
  options: {
    readonly selectedLayerNodeRef?: string;
  } = {}
): ExplicitPsdImportState => {
  const adapterResult = input.status === "parsed" ? input.adapterResult : undefined;
  const featureEvidence =
    adapterResult === undefined ? [] : collectFeatureSupportEvidence(adapterResult);
  const unsupportedFeatures =
    adapterResult === undefined ? [] : collectUnsupportedFeatures(adapterResult);
  const notEvaluatedFeatures = featureEvidence.filter((evidence) => evidence.status === "notEvaluated");
  const unsupportedFeatureEvidence = featureEvidence.filter((evidence) => evidence.status === "unsupported");

  return {
    status: input.status,
    selectedLayerNodeRef:
      options.selectedLayerNodeRef?.trim() || explicitPsdImportDefaultSelectedLayerNodeRef,
    source: projectSourceState(input.source),
    document: adapterResult === undefined ? null : projectDocumentState(adapterResult),
    treeSummary: input.treeSummary ?? projectTreeSummaryState(adapterResult),
    treeRows: adapterResult === undefined ? [] : projectTreeRows(adapterResult),
    featureSupport: {
      evidenceCount: featureEvidence.length,
      unsupportedCount: unsupportedFeatures.length + unsupportedFeatureEvidence.length,
      notEvaluatedCount: notEvaluatedFeatures.length,
      unsupportedFeatureIds: uniqueStrings([
        ...unsupportedFeatures.map((feature) => feature.featureId),
        ...unsupportedFeatureEvidence.map((feature) => feature.featureId)
      ]),
      notEvaluatedFeatureIds: uniqueStrings(notEvaluatedFeatures.map((feature) => feature.featureId))
    },
    unsupportedFeatureLabels: [
      ...unsupportedFeatures.map(formatUnsupportedFeatureLabel),
      ...unsupportedFeatureEvidence.map(formatFeatureSupportEvidenceLabel)
    ],
    notEvaluatedFeatureLabels: notEvaluatedFeatures.map(formatFeatureSupportEvidenceLabel),
    materialization:
      adapterResult?.materializationEvidence?.map(projectMaterializationState) ?? [],
    selectedLayerIntake: createEmptyExplicitPsdLayerIntakeState(),
    diagnostics: [
      ...input.diagnostics.map(projectDiagnosticState),
      ...input.errorEvidence.map((evidence) => ({
        checkId: evidence.errorId,
        severity: evidence.severity,
        message: evidence.message
      }))
    ],
    persistenceBoundary: createExplicitPsdImportPersistenceBoundary()
  };
};

const createEmptyFeatureSupportSummary = (): ExplicitPsdImportFeatureSupportSummaryState => ({
  evidenceCount: 0,
  unsupportedCount: 0,
  notEvaluatedCount: 0,
  unsupportedFeatureIds: [],
  notEvaluatedFeatureIds: []
});

const createExplicitPsdImportPersistenceBoundary =
  (): ExplicitPsdImportPersistenceBoundaryState => ({
    parserPrivateShapePolicy: "parser-private-shape-excluded-v1",
    rawParserObjectPersistence: "notPersisted",
    sourcePsdBytePersistence: "sessionReadOnlyNoRawBytesPersistedByParser",
    materializedLayerBytePersistence: "summaryOnlyNoRawBytes",
    saveLoadSemantics: "sessionEvidenceClearedOnProjectLoadReparseRequiredV1",
    photoshopCompositingClaim: "none",
    rendererPixelOracleClaim: "none"
  });

const projectSourceState = (
  source: ExplicitPsdImportBridgeResultInput["source"]
): ExplicitPsdImportSourceState => ({
  fileName: source.fileName,
  declaredMediaType: source.declaredMediaType?.trim() || null,
  byteLength: source.byteLength,
  sizeCapBytes: source.sizeCapBytes,
  intakeKind: source.intakeKind,
  rawBytesPersistence: source.privacy.rawBytesPersistence,
  publicDistribution: source.privacy.publicDistribution
});

const projectDocumentState = (
  adapterResult: PsdAdapterResultDto
): ExplicitPsdImportDocumentState => ({
  sourceProfile: adapterResult.sourceProfile,
  adapterName: adapterResult.adapterName,
  adapterVersion: adapterResult.adapterVersion ?? null,
  parserLabel: [
    adapterResult.parser?.parserName ?? "No parser evidence",
    adapterResult.parser?.parserPackageName,
    adapterResult.parser?.parserVersion
  ].filter((value): value is string => value !== undefined && value.length > 0).join(" / "),
  parserRuntime: adapterResult.parser?.runtime ?? "unknown",
  canvas: {
    width: adapterResult.canvas.width,
    height: adapterResult.canvas.height,
    bounds: adapterResult.canvas.bounds ?? null
  }
});

const projectTreeSummaryState = (
  adapterResult: PsdAdapterResultDto | undefined
): ExplicitPsdImportTreeSummaryState | null => {
  if (adapterResult === undefined) {
    return null;
  }

  return {
    groupCount: adapterResult.sourceGroups.length,
    layerCount: adapterResult.sourceLayers.length,
    visibleLayerCount: adapterResult.sourceLayers.filter((layer) => layer.visibleInSource).length,
    hiddenLayerCount: adapterResult.sourceLayers.filter((layer) => !layer.visibleInSource).length,
    rasterCandidateLayerCount: adapterResult.sourceLayers.filter(
      (layer) => layer.visibleInSource && layer.bounds.width > 0 && layer.bounds.height > 0
    ).length,
    maxDepth: Math.max(
      0,
      ...adapterResult.sourceGroups.map((group) => group.groupPath.length),
      ...adapterResult.sourceLayers.map((layer) => layer.groupPath.length + 1)
    )
  };
};

const projectTreeRows = (
  adapterResult: PsdAdapterResultDto
): readonly ExplicitPsdImportTreeRowState[] =>
  [
    ...adapterResult.sourceGroups.map((group): ExplicitPsdImportTreeRowState => ({
      nodeRef: group.sourceGroupId,
      kind: "group",
      depth: Math.max(1, group.groupPath.length),
      name: group.originalName,
      normalizedName: group.normalizedName,
      groupPath: group.groupPath,
      sourceOrder: group.sourceOrder,
      visibleInSource: group.visibleInSource,
      opacityInSource: group.opacityInSource,
      bounds: group.bounds ?? null,
      role: null,
      blendModeLabel: projectBlendModeLabel(group.blendMode),
      unsupportedFeatureIds: group.unsupportedFeatures.map((feature) => feature.featureId)
    })),
    ...adapterResult.sourceLayers.map((layer): ExplicitPsdImportTreeRowState => ({
      nodeRef: layer.sourceLayerId,
      kind: "layer",
      depth: layer.groupPath.length + 1,
      name: layer.originalName,
      normalizedName: layer.normalizedName,
      groupPath: layer.groupPath,
      sourceOrder: layer.sourceOrder,
      visibleInSource: layer.visibleInSource,
      opacityInSource: layer.opacityInSource,
      bounds: layer.bounds,
      role: layer.role,
      blendModeLabel: projectBlendModeLabel(layer.blendMode),
      unsupportedFeatureIds: layer.unsupportedFeatures.map((feature) => feature.featureId)
    }))
  ].sort((left, right) => left.sourceOrder - right.sourceOrder);

const projectBlendModeLabel = (
  blendMode: PsdAdapterSourceLayerDto["blendMode"]
): string | null => {
  if (blendMode === undefined) {
    return null;
  }

  return [
    blendMode.displayName ?? blendMode.normalizedMode ?? blendMode.modeKey,
    blendMode.modeKey,
    blendMode.supportedByMvp ? "supported metadata" : "unsupported metadata"
  ].join(" / ");
};

const collectFeatureSupportEvidence = (
  adapterResult: PsdAdapterResultDto
): readonly PsdAdapterFeatureSupportEvidenceDto[] => [
  ...(adapterResult.featureSupportEvidence ?? []),
  ...adapterResult.sourceGroups.flatMap((group) => group.featureSupportEvidence ?? []),
  ...adapterResult.sourceLayers.flatMap((layer) => layer.featureSupportEvidence ?? [])
];

const collectUnsupportedFeatures = (
  adapterResult: PsdAdapterResultDto
): readonly PsdAdapterUnsupportedFeatureDto[] => [
  ...adapterResult.unsupportedFeatures,
  ...adapterResult.sourceGroups.flatMap((group) => group.unsupportedFeatures),
  ...adapterResult.sourceLayers.flatMap((layer) => layer.unsupportedFeatures)
];

const formatUnsupportedFeatureLabel = (
  feature: PsdAdapterUnsupportedFeatureDto
): string =>
  [
    feature.featureId,
    feature.scope,
    feature.severity,
    feature.rasterizeCandidate ? "rasterize candidate" : "no rasterize candidate",
    feature.manualConfirmationRequired ? "manual confirmation required" : "no manual confirmation",
    feature.message
  ].join(" / ");

const formatFeatureSupportEvidenceLabel = (
  evidence: PsdAdapterFeatureSupportEvidenceDto
): string =>
  [
    evidence.featureId,
    evidence.status,
    evidence.scope,
    evidence.severity,
    evidence.message
  ].join(" / ");

const projectMaterializationState = (
  evidence: PsdAdapterLayerMaterializationEvidenceDto
): ExplicitPsdImportMaterializationState => ({
  materializationId: evidence.materializationId,
  sourceLayerId: evidence.sourceLayerRef.sourceLayerId,
  sourceLayerPath: evidence.sourceLayerRef.sourceLayerPath ?? [],
  mediaType: evidence.mediaType,
  byteLength: evidence.byteLength,
  digest: evidence.digest,
  bytePersistence: "summaryOnlyNoRawBytes"
});

const projectDiagnosticState = (
  diagnostic: PsdAdapterDiagnosticDto
): ExplicitPsdImportDiagnosticState => ({
  checkId: diagnostic.checkId,
  severity: diagnostic.severity,
  message: diagnostic.message
});

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)];
