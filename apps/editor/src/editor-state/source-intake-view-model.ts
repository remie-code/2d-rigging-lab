import {
  validateSourceIntakeDraft,
  type SourceIntakeDraftState,
  type SourceIntakeLayerDraftState
} from "./source-intake-draft-state.js";
import { formatBoundsLabel, formatPreviewNumber } from "./view-model-format.js";
import type {
  LayeredCharacterPsdProfileDto,
  PsdProfileAdapterDiagnosticDto,
  PsdProfileBlendModeDto,
  PsdProfileUnsupportedFeatureDto,
  SourceAssetDto,
  SourceLayerDto
} from "@private-2d-rigging-lab/package-format";

export interface SourceIntakeLayerDraftViewModel {
  readonly sourceLayerId: string;
  readonly rowLabel: string;
  readonly sourceNameLabel: string;
  readonly groupPathLabel: string;
  readonly boundsLabel: string;
  readonly visibilityLabel: string;
  readonly opacityLabel: string;
  readonly roleLabel: string;
  readonly unsupportedFeaturesLabel: string;
  readonly texturePreviewReferenceLabel: string;
  readonly textureIdLabel: string;
  readonly targetPartLabel: string;
  readonly textureMappingStatusLabel: string;
}

export interface SourceIntakeDraftViewModel {
  readonly sourceModeLabel: string;
  readonly importProfileLabel: string;
  readonly manifestPathLabel: string;
  readonly sourceReferenceLabel: string;
  readonly psdAdapterNameLabel: string;
  readonly psdCanvasLabel: string;
  readonly sourceAssetLabel: string;
  readonly contentHashLabel: string;
  readonly defaultPartLabel: string;
  readonly placementPolicyLabel: string;
  readonly rightsStatusLabel: string;
  readonly rightsSummaryLabel: string;
  readonly provenanceSummaryLabel: string;
  readonly layerCountLabel: string;
  readonly statusLabel: string;
  readonly canConfirmDraft: boolean;
  readonly diagnostics: readonly string[];
  readonly layerRows: readonly SourceIntakeLayerDraftViewModel[];
  readonly importedAssets: readonly ImportedSourceAssetViewModel[];
  readonly importedAssetCountLabel: string;
}

export interface ImportedSourceLayerViewModel {
  readonly sourceLayerId: string;
  readonly layerLabel: string;
  readonly groupPathLabel: string;
  readonly boundsLabel: string;
  readonly visibilityLabel: string;
  readonly opacityLabel: string;
  readonly roleLabel: string;
  readonly unsupportedFeaturesLabel: string;
  readonly textureMappingLabel: string;
  readonly blendModeLabel: string;
  readonly mappedDrawableCountLabel: string;
}

export interface ImportedSourceAssetViewModel {
  readonly sourceAssetId: string;
  readonly assetLabel: string;
  readonly filePathLabel: string;
  readonly importProfileLabel: string;
  readonly profileEvidenceLabel: string;
  readonly layerCountLabel: string;
  readonly diagnosticsLabel: string;
  readonly psdProfile?: ImportedPsdProfileViewModel;
  readonly layers: readonly ImportedSourceLayerViewModel[];
}

export interface ImportedPsdProfileViewModel {
  readonly adapterLabel: string;
  readonly canvasLabel: string;
  readonly sourceGroupCountLabel: string;
  readonly structuredLayerCountLabel: string;
  readonly unsupportedFeatureCountLabel: string;
  readonly adapterDiagnosticCountLabel: string;
  readonly compatibilityLabel: string;
  readonly groupLabels: readonly string[];
  readonly unsupportedFeatureLabels: readonly string[];
  readonly adapterDiagnosticLabels: readonly string[];
}

export const projectSourceIntakeDraftViewModel = (
  draft: SourceIntakeDraftState,
  input: {
    readonly sourceAssets?: readonly SourceAssetDto[];
  } = {}
): SourceIntakeDraftViewModel => {
  const diagnostics = validateSourceIntakeDraft(draft);
  const importedAssets = (input.sourceAssets ?? [])
    .filter((sourceAsset) => sourceAsset.kind !== "generated-fixture-v1")
    .map(projectImportedSourceAssetViewModel);

  return {
    sourceModeLabel: formatSourceIntakeMode(draft.intakeMode),
    importProfileLabel: draft.importProfile,
    manifestPathLabel: draft.manifestPath.length > 0 ? draft.manifestPath : "No manifest path",
    sourceReferenceLabel:
      draft.manifestPath.length > 0
        ? draft.manifestPath
        : draft.intakeMode === "psdAdapterProfile"
          ? "No PSD source reference"
          : "No split PNG manifest path",
    psdAdapterNameLabel:
      draft.psdProfile.adapterName.length > 0
        ? draft.psdProfile.adapterName
        : "No PSD adapter/profile name",
    psdCanvasLabel:
      draft.intakeMode === "psdAdapterProfile"
        ? `${formatPreviewNumber(draft.psdProfile.canvasWidth)} x ${formatPreviewNumber(draft.psdProfile.canvasHeight)}`
        : "Not used for split PNG",
    sourceAssetLabel: draft.sourceAssetId.length > 0 ? draft.sourceAssetId : "No source asset ID",
    contentHashLabel: draft.contentHash.length > 0 ? draft.contentHash : "No content hash",
    defaultPartLabel: draft.defaultPartId.length > 0 ? draft.defaultPartId : "No default part",
    placementPolicyLabel: formatPlacementPolicy(draft.placementPolicy),
    rightsStatusLabel: formatRightsStatus(draft.rights.rightsStatus),
    rightsSummaryLabel: `${formatRightsStatus(draft.rights.rightsStatus)} / ${draft.rights.license || "No license"}`,
    provenanceSummaryLabel: `${draft.rights.creator || "No creator"} / ${draft.rights.aiUsed ? "AI used" : "No AI use"}`,
    layerCountLabel: `${draft.layers.length} layer row${draft.layers.length === 1 ? "" : "s"}`,
    statusLabel: projectSourceIntakeStatusLabel(draft, diagnostics),
    canConfirmDraft: diagnostics.length === 0,
    diagnostics,
    layerRows: draft.layers.map((layer, index) =>
      projectSourceIntakeLayerViewModel(layer, index, draft.defaultPartId)
    ),
    importedAssets,
    importedAssetCountLabel: `${importedAssets.length} imported source asset${importedAssets.length === 1 ? "" : "s"}`
  };
};

const projectSourceIntakeLayerViewModel = (
  layer: SourceIntakeLayerDraftState,
  index: number,
  defaultPartId: string
): SourceIntakeLayerDraftViewModel => ({
  sourceLayerId: layer.sourceLayerId,
  rowLabel: `Layer ${index + 1}`,
  sourceNameLabel:
    layer.originalName === layer.normalizedName
      ? layer.originalName || "Unnamed layer"
      : `${layer.originalName || "Unnamed layer"} -> ${layer.normalizedName || "unnamed"}`,
  groupPathLabel: layer.groupPath.length === 0 ? "No group path" : layer.groupPath.join(" / "),
  boundsLabel: formatBoundsLabel(layer.bounds),
  visibilityLabel: layer.visibleInSource ? "Visible in source" : "Hidden in source",
  opacityLabel: `Opacity ${formatPreviewNumber(layer.opacityInSource)}`,
  roleLabel: layer.role,
  unsupportedFeaturesLabel:
    layer.unsupportedFeatures.length === 0
      ? "No unsupported features"
      : layer.unsupportedFeatures.join(", "),
  texturePreviewReferenceLabel:
    getLayerTexturePreviewReference(layer).length === 0
      ? "No texture preview reference"
      : getLayerTexturePreviewReference(layer),
  textureIdLabel: getLayerTextureId(layer).length === 0 ? "No texture ID" : getLayerTextureId(layer),
  targetPartLabel: projectLayerTargetPartLabel(layer, defaultPartId),
  textureMappingStatusLabel: projectLayerTextureMappingStatusLabel(layer, defaultPartId)
});

const projectSourceIntakeStatusLabel = (
  draft: SourceIntakeDraftState,
  diagnostics: readonly string[]
): string => {
  if (diagnostics.length > 0) {
    return `${diagnostics.length} draft issue${diagnostics.length === 1 ? "" : "s"}`;
  }

  if (draft.status === "confirmed") {
    return "Draft confirmed";
  }

  return "Draft ready";
};

export const projectImportedSourceAssetViewModel = (
  sourceAsset: SourceAssetDto
): ImportedSourceAssetViewModel => {
  const psdProfile =
    sourceAsset.psdProfile === undefined ? undefined : projectImportedPsdProfileViewModel(sourceAsset.psdProfile);
  const structuredLayersById = new Map(
    sourceAsset.psdProfile?.sourceLayers.map((layer) => [layer.sourceLayerId, layer]) ?? []
  );

  return {
    sourceAssetId: sourceAsset.sourceAssetId,
    assetLabel: sourceAsset.sourceAssetId,
    filePathLabel: sourceAsset.filePath,
    importProfileLabel: sourceAsset.importProfile,
    profileEvidenceLabel: projectImportedSourceProfileEvidenceLabel(sourceAsset),
    layerCountLabel: `${sourceAsset.layers.length} layer${sourceAsset.layers.length === 1 ? "" : "s"}`,
    diagnosticsLabel:
      sourceAsset.diagnostics.length === 0 ? "No source diagnostics" : sourceAsset.diagnostics.join(", "),
    ...(psdProfile === undefined ? {} : { psdProfile }),
    layers: sourceAsset.layers.map((layer) =>
      projectImportedSourceLayerViewModel(layer, structuredLayersById.get(layer.sourceLayerId))
    )
  };
};

const projectImportedSourceLayerViewModel = (
  layer: SourceLayerDto,
  structuredLayer: LayeredCharacterPsdProfileDto["sourceLayers"][number] | undefined
): ImportedSourceLayerViewModel => ({
  sourceLayerId: layer.sourceLayerId,
  layerLabel:
    layer.originalName === layer.normalizedName
      ? `${layer.sourceLayerId} / ${layer.originalName}`
      : `${layer.sourceLayerId} / ${layer.originalName} -> ${layer.normalizedName}`,
  groupPathLabel: layer.groupPath.length === 0 ? "No group path" : layer.groupPath.join(" / "),
  boundsLabel: formatBoundsLabel(layer.bounds),
  visibilityLabel: layer.visibleInSource ? "Visible in source profile" : "Hidden in source profile",
  opacityLabel: `Opacity ${formatPreviewNumber(layer.opacityInSource)}`,
  roleLabel: layer.role,
  unsupportedFeaturesLabel: formatImportedLayerUnsupportedFeatures(layer, structuredLayer),
  textureMappingLabel: formatImportedLayerTextureMapping(structuredLayer),
  blendModeLabel: formatBlendMode(structuredLayer?.blendMode),
  mappedDrawableCountLabel: `${layer.mappedDrawableIds.length} mapped drawable${layer.mappedDrawableIds.length === 1 ? "" : "s"}`
});

const projectImportedSourceProfileEvidenceLabel = (
  sourceAsset: SourceAssetDto
): string => {
  if (sourceAsset.psdProfile !== undefined) {
    return `Structured PSD profile metadata from ${sourceAsset.psdProfile.adapter.adapterName}; editor did not parse PSD bytes.`;
  }

  if (sourceAsset.kind === "psd-source-v1") {
    return "Flattened PSD source summary only; no structured PSD profile metadata.";
  }

  if (sourceAsset.kind === "split-png-set-v1") {
    return "Split PNG source manifest metadata.";
  }

  return "Generated fixture source metadata.";
};

const projectImportedPsdProfileViewModel = (
  profile: LayeredCharacterPsdProfileDto
): ImportedPsdProfileViewModel => {
  const unsupportedFeatures = collectPsdProfileUnsupportedFeatures(profile);

  return {
    adapterLabel: `${profile.adapter.adapterName} / ${profile.adapter.evidenceKind}`,
    canvasLabel: `${formatPreviewNumber(profile.canvas.width)} x ${formatPreviewNumber(profile.canvas.height)}${
      profile.canvas.bounds === undefined ? "" : ` / ${formatBoundsLabel(profile.canvas.bounds)}`
    }`,
    sourceGroupCountLabel: `${profile.sourceGroups.length} source group${profile.sourceGroups.length === 1 ? "" : "s"}`,
    structuredLayerCountLabel: `${profile.sourceLayers.length} structured layer${profile.sourceLayers.length === 1 ? "" : "s"}`,
    unsupportedFeatureCountLabel: `${unsupportedFeatures.length} structured unsupported feature${unsupportedFeatures.length === 1 ? "" : "s"}`,
    adapterDiagnosticCountLabel: `${profile.diagnostics.length} adapter diagnostic${profile.diagnostics.length === 1 ? "" : "s"}`,
    compatibilityLabel: [
      profile.compatibility.structuredProfilePrecedence,
      profile.compatibility.flattenedDiagnosticsFallback,
      profile.compatibility.flattenedUnsupportedFeaturesFallback
    ].join(" / "),
    groupLabels: profile.sourceGroups.map((group) => {
      const pathLabel = group.groupPath.length === 0 ? group.originalName : group.groupPath.join(" / ");
      const targetPartLabel = group.targetPartId === undefined ? "No target part" : group.targetPartId;
      const unsupportedLabel =
        group.unsupportedFeatures.length === 0
          ? "No unsupported features"
          : `${group.unsupportedFeatures.length} unsupported feature${group.unsupportedFeatures.length === 1 ? "" : "s"}`;

      return `${group.sourceGroupId} / ${pathLabel} / ${targetPartLabel} / ${unsupportedLabel}`;
    }),
    unsupportedFeatureLabels:
      unsupportedFeatures.length === 0
        ? ["No structured unsupported features"]
        : unsupportedFeatures.map(formatUnsupportedFeatureProjection),
    adapterDiagnosticLabels:
      profile.diagnostics.length === 0
        ? ["No adapter diagnostics"]
        : profile.diagnostics.map(formatAdapterDiagnosticProjection)
  };
};

const collectPsdProfileUnsupportedFeatures = (
  profile: LayeredCharacterPsdProfileDto
): readonly {
  readonly ownerLabel: string;
  readonly feature: PsdProfileUnsupportedFeatureDto;
}[] => [
  ...profile.unsupportedFeatures.map((feature) => ({
    ownerLabel: "document",
    feature
  })),
  ...profile.sourceGroups.flatMap((group) =>
    group.unsupportedFeatures.map((feature) => ({
      ownerLabel: `group ${group.sourceGroupId}`,
      feature
    }))
  ),
  ...profile.sourceLayers.flatMap((layer) =>
    layer.unsupportedFeatures.map((feature) => ({
      ownerLabel: `layer ${layer.sourceLayerId}`,
      feature
    }))
  )
];

const formatUnsupportedFeatureProjection = (input: {
  readonly ownerLabel: string;
  readonly feature: PsdProfileUnsupportedFeatureDto;
}): string => {
  const handling = [
    input.feature.rasterizeCandidate ? "rasterize candidate metadata" : "no rasterize candidate",
    input.feature.manualConfirmationRequired ? "manual confirmation required" : "no manual confirmation flag"
  ].join(" / ");

  return `${input.ownerLabel} / ${input.feature.featureId} / ${input.feature.scope} / ${input.feature.severity} / ${handling} / ${input.feature.message}`;
};

const formatAdapterDiagnosticProjection = (
  diagnostic: PsdProfileAdapterDiagnosticDto
): string => {
  const evidence = diagnostic.evidence.length === 0 ? "" : ` / evidence: ${diagnostic.evidence.join(", ")}`;

  return `${diagnostic.checkId} / ${diagnostic.severity} / ${diagnostic.message}${evidence}`;
};

const formatImportedLayerUnsupportedFeatures = (
  layer: SourceLayerDto,
  structuredLayer: LayeredCharacterPsdProfileDto["sourceLayers"][number] | undefined
): string => {
  if (structuredLayer !== undefined && structuredLayer.unsupportedFeatures.length > 0) {
    return structuredLayer.unsupportedFeatures
      .map((feature) => `${feature.featureId} (${feature.severity})`)
      .join(", ");
  }

  return layer.unsupportedFeatures.length === 0
    ? "No unsupported features"
    : `${layer.unsupportedFeatures.join(", ")} (flattened fallback)`;
};

const formatImportedLayerTextureMapping = (
  structuredLayer: LayeredCharacterPsdProfileDto["sourceLayers"][number] | undefined
): string => {
  if (structuredLayer === undefined) {
    return "No structured texture relation";
  }

  const preview = structuredLayer.texturePreviewReference ?? "No texture preview reference";
  const textureId = structuredLayer.textureId ?? "No texture ID";
  const targetPart = structuredLayer.targetPartId ?? "No target part";

  return `${preview} / ${textureId} / ${targetPart}`;
};

const formatBlendMode = (
  blendMode: PsdProfileBlendModeDto | undefined
): string => {
  if (blendMode === undefined) {
    return "No structured blend mode";
  }

  const displayName = blendMode.displayName ?? blendMode.normalizedMode ?? blendMode.modeKey;
  const supportLabel = blendMode.supportedByMvp ? "MVP-supported metadata" : "unsupported metadata";

  return `${displayName} (${blendMode.modeKey}) / ${supportLabel}`;
};

const formatPlacementPolicy = (policy: SourceIntakeDraftState["placementPolicy"]): string => {
  switch (policy) {
    case "use-metadata":
      return "Use manifest metadata";
    case "origin-with-warning":
      return "Place at origin with warning";
  }
};

const formatSourceIntakeMode = (mode: SourceIntakeDraftState["intakeMode"]): string => {
  switch (mode) {
    case "splitPng":
      return "Split PNG manifest metadata";
    case "psdAdapterProfile":
      return "PSD adapter/profile metadata (manual)";
  }
};

const formatRightsStatus = (status: SourceIntakeDraftState["rights"]["rightsStatus"]): string => {
  switch (status) {
    case "cleared":
      return "Cleared";
    case "needs_review":
      return "Needs review";
    case "blocked":
      return "Blocked";
  }
};

const getLayerTexturePreviewReference = (
  layer: SourceIntakeLayerDraftState
): string => layer.texturePreviewReference?.trim() ?? "";

const getLayerTextureId = (
  layer: SourceIntakeLayerDraftState
): string => layer.textureId?.trim() ?? "";

const getLayerTargetPartId = (
  layer: SourceIntakeLayerDraftState
): string => layer.targetPartId?.trim() ?? "";

const projectLayerTargetPartLabel = (
  layer: SourceIntakeLayerDraftState,
  defaultPartId: string
): string => {
  const targetPartId = getLayerTargetPartId(layer);
  if (targetPartId.length > 0) {
    return targetPartId;
  }

  return defaultPartId.trim().length === 0
    ? "No target part"
    : `Default part ${defaultPartId.trim()}`;
};

const projectLayerTextureMappingStatusLabel = (
  layer: SourceIntakeLayerDraftState,
  defaultPartId: string
): string => {
  const missing: string[] = [];

  if (getLayerTexturePreviewReference(layer).length === 0) {
    missing.push("texture preview reference");
  }

  if (getLayerTextureId(layer).length === 0) {
    missing.push("texture ID");
  }

  if (getLayerTargetPartId(layer).length === 0 && defaultPartId.trim().length === 0) {
    missing.push("target part");
  }

  if (missing.length > 0) {
    return `Missing ${missing.join(" / ")}`;
  }

  return `${getLayerTextureId(layer)} / ${projectLayerTargetPartLabel(layer, defaultPartId)}`;
};
