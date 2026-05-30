import {
  validateSourceIntakeDraft,
  type SourceIntakeDraftState,
  type SourceIntakeLayerDraftState
} from "./source-intake-draft-state.js";
import { formatBoundsLabel, formatPreviewNumber } from "./view-model-format.js";
import type { SourceAssetDto, SourceLayerDto } from "@private-2d-rigging-lab/package-format";

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
}

export interface SourceIntakeDraftViewModel {
  readonly importProfileLabel: string;
  readonly manifestPathLabel: string;
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
  readonly boundsLabel: string;
  readonly roleLabel: string;
  readonly mappedDrawableCountLabel: string;
}

export interface ImportedSourceAssetViewModel {
  readonly sourceAssetId: string;
  readonly assetLabel: string;
  readonly filePathLabel: string;
  readonly importProfileLabel: string;
  readonly layerCountLabel: string;
  readonly diagnosticsLabel: string;
  readonly layers: readonly ImportedSourceLayerViewModel[];
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
    importProfileLabel: draft.importProfile,
    manifestPathLabel: draft.manifestPath.length > 0 ? draft.manifestPath : "No manifest path",
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
    layerRows: draft.layers.map(projectSourceIntakeLayerViewModel),
    importedAssets,
    importedAssetCountLabel: `${importedAssets.length} imported source asset${importedAssets.length === 1 ? "" : "s"}`
  };
};

const projectSourceIntakeLayerViewModel = (
  layer: SourceIntakeLayerDraftState,
  index: number
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
      : layer.unsupportedFeatures.join(", ")
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

const projectImportedSourceAssetViewModel = (
  sourceAsset: SourceAssetDto
): ImportedSourceAssetViewModel => ({
  sourceAssetId: sourceAsset.sourceAssetId,
  assetLabel: sourceAsset.sourceAssetId,
  filePathLabel: sourceAsset.filePath,
  importProfileLabel: sourceAsset.importProfile,
  layerCountLabel: `${sourceAsset.layers.length} layer${sourceAsset.layers.length === 1 ? "" : "s"}`,
  diagnosticsLabel:
    sourceAsset.diagnostics.length === 0 ? "No source diagnostics" : sourceAsset.diagnostics.join(", "),
  layers: sourceAsset.layers.map(projectImportedSourceLayerViewModel)
});

const projectImportedSourceLayerViewModel = (
  layer: SourceLayerDto
): ImportedSourceLayerViewModel => ({
  sourceLayerId: layer.sourceLayerId,
  layerLabel:
    layer.originalName === layer.normalizedName
      ? `${layer.sourceLayerId} / ${layer.originalName}`
      : `${layer.sourceLayerId} / ${layer.originalName} -> ${layer.normalizedName}`,
  boundsLabel: formatBoundsLabel(layer.bounds),
  roleLabel: layer.role,
  mappedDrawableCountLabel: `${layer.mappedDrawableIds.length} mapped drawable${layer.mappedDrawableIds.length === 1 ? "" : "s"}`
});

const formatPlacementPolicy = (policy: SourceIntakeDraftState["placementPolicy"]): string => {
  switch (policy) {
    case "use-metadata":
      return "Use manifest metadata";
    case "origin-with-warning":
      return "Place at origin with warning";
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
