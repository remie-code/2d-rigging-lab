import type { RectDto } from "@private-2d-rigging-lab/contracts";

export const sourceIntakeDraftSchemaVersion = "source-intake-draft-v1";
export const splitPngSourceIntakeImportProfile = "split-png-fallback-v1";

export const sourceIntakePlacementPolicies = [
  "use-metadata",
  "origin-with-warning"
] as const;
export type SourceIntakePlacementPolicy = (typeof sourceIntakePlacementPolicies)[number];

export const sourceIntakeRightsStatuses = [
  "cleared",
  "needs_review",
  "blocked"
] as const;
export type SourceIntakeRightsStatus = (typeof sourceIntakeRightsStatuses)[number];

export const sourceIntakeLayerRoles = [
  "editableLayer",
  "guideImage",
  "referenceOnly",
  "unsupported"
] as const;
export type SourceIntakeLayerRole = (typeof sourceIntakeLayerRoles)[number];

export type SourceIntakeDraftStatus = "idle" | "confirmed";

export interface SourceIntakeLayerDraftState {
  readonly sourceLayerId: string;
  readonly originalName: string;
  readonly normalizedName: string;
  readonly groupPath: readonly string[];
  readonly bounds: RectDto;
  readonly visibleInSource: boolean;
  readonly opacityInSource: number;
  readonly role: SourceIntakeLayerRole;
  readonly unsupportedFeatures: readonly string[];
}

export interface SourceIntakeRightsDraftState {
  readonly rightsStatus: SourceIntakeRightsStatus;
  readonly creator: string;
  readonly license: string;
  readonly redistributionAllowed: boolean;
  readonly aiUsed: boolean;
  readonly sourceUrl: string;
  readonly notes: string;
}

export interface SourceIntakeDraftState {
  readonly schemaVersion: typeof sourceIntakeDraftSchemaVersion;
  readonly status: SourceIntakeDraftStatus;
  readonly sourceAssetId: string;
  readonly manifestPath: string;
  readonly contentHash: string;
  readonly importProfile: typeof splitPngSourceIntakeImportProfile;
  readonly defaultPartId: string;
  readonly placementPolicy: SourceIntakePlacementPolicy;
  readonly layers: readonly SourceIntakeLayerDraftState[];
  readonly rights: SourceIntakeRightsDraftState;
  readonly diagnostics: readonly string[];
}

export interface SourceIntakeDraftDefaultsInput {
  readonly defaultPartId?: string;
}

export interface SourceIntakeDraftInput {
  readonly sourceAssetId: string;
  readonly manifestPath: string;
  readonly contentHash: string;
  readonly defaultPartId: string;
  readonly placementPolicy: SourceIntakePlacementPolicy;
  readonly layers: readonly SourceIntakeLayerDraftState[];
  readonly rights: SourceIntakeRightsDraftState;
}

export const createDefaultSourceIntakeLayerDraft = (
  index: number
): SourceIntakeLayerDraftState => ({
  sourceLayerId: index === 0 ? "layer_body" : `layer_${index + 1}`,
  originalName: index === 0 ? "Body" : `Layer ${index + 1}`,
  normalizedName: index === 0 ? "body" : `layer_${index + 1}`,
  groupPath: index === 0 ? ["Root"] : [],
  bounds: { x: 0, y: 0, width: 64, height: 64 },
  visibleInSource: true,
  opacityInSource: 1,
  role: "editableLayer",
  unsupportedFeatures: []
});

export const createEmptySourceIntakeDraftState = (
  input: SourceIntakeDraftDefaultsInput = {}
): SourceIntakeDraftState => ({
  schemaVersion: sourceIntakeDraftSchemaVersion,
  status: "idle",
  sourceAssetId: "src_split_png_draft",
  manifestPath: "",
  contentHash: "",
  importProfile: splitPngSourceIntakeImportProfile,
  defaultPartId: input.defaultPartId ?? "",
  placementPolicy: "use-metadata",
  layers: [createDefaultSourceIntakeLayerDraft(0)],
  rights: {
    rightsStatus: "needs_review",
    creator: "",
    license: "",
    redistributionAllowed: false,
    aiUsed: false,
    sourceUrl: "",
    notes: ""
  },
  diagnostics: []
});

export const confirmSourceIntakeDraft = (
  input: SourceIntakeDraftInput
): SourceIntakeDraftState => {
  const draft = normalizeSourceIntakeDraft(input);
  const diagnostics = validateSourceIntakeDraft(draft);

  return {
    ...draft,
    status: diagnostics.length === 0 ? "confirmed" : "idle",
    diagnostics
  };
};

export const validateSourceIntakeDraft = (
  draft: Pick<
    SourceIntakeDraftState,
    "sourceAssetId" | "manifestPath" | "placementPolicy" | "layers" | "rights"
  >
): readonly string[] => {
  const diagnostics: string[] = [];

  if (draft.sourceAssetId.trim().length === 0) {
    diagnostics.push("Source asset ID is required.");
  }

  if (draft.manifestPath.trim().length === 0) {
    diagnostics.push("Split PNG manifest path is required.");
  }

  if (!sourceIntakePlacementPolicies.includes(draft.placementPolicy)) {
    diagnostics.push("Placement policy is not supported.");
  }

  if (draft.layers.length === 0) {
    diagnostics.push("At least one source layer row is required.");
  }

  draft.layers.forEach((layer, index) => {
    const label = `Layer ${index + 1}`;

    if (layer.sourceLayerId.trim().length === 0) {
      diagnostics.push(`${label} source layer ID is required.`);
    }

    if (layer.originalName.trim().length === 0) {
      diagnostics.push(`${label} original name is required.`);
    }

    if (layer.normalizedName.trim().length === 0) {
      diagnostics.push(`${label} normalized name is required.`);
    }

    if (!isFiniteBounds(layer.bounds)) {
      diagnostics.push(`${label} bounds must contain finite values.`);
    } else if (layer.bounds.width <= 0 || layer.bounds.height <= 0) {
      diagnostics.push(`${label} bounds width and height must be greater than zero.`);
    }

    if (!Number.isFinite(layer.opacityInSource) || layer.opacityInSource < 0 || layer.opacityInSource > 1) {
      diagnostics.push(`${label} opacity must be between 0 and 1.`);
    }

    if (!sourceIntakeLayerRoles.includes(layer.role)) {
      diagnostics.push(`${label} role is not supported.`);
    }
  });

  if (!sourceIntakeRightsStatuses.includes(draft.rights.rightsStatus)) {
    diagnostics.push("Rights status is not supported.");
  }

  if (draft.rights.creator.trim().length === 0) {
    diagnostics.push("Creator is required for source provenance.");
  }

  if (draft.rights.license.trim().length === 0) {
    diagnostics.push("License is required for rights metadata.");
  }

  return diagnostics;
};

const normalizeSourceIntakeDraft = (
  input: SourceIntakeDraftInput
): Omit<SourceIntakeDraftState, "status" | "diagnostics"> => ({
  schemaVersion: sourceIntakeDraftSchemaVersion,
  sourceAssetId: input.sourceAssetId.trim(),
  manifestPath: input.manifestPath.trim(),
  contentHash: input.contentHash.trim(),
  importProfile: splitPngSourceIntakeImportProfile,
  defaultPartId: input.defaultPartId.trim(),
  placementPolicy: input.placementPolicy,
  layers: input.layers.map(normalizeSourceIntakeLayer),
  rights: {
    rightsStatus: input.rights.rightsStatus,
    creator: input.rights.creator.trim(),
    license: input.rights.license.trim(),
    redistributionAllowed: input.rights.redistributionAllowed,
    aiUsed: input.rights.aiUsed,
    sourceUrl: input.rights.sourceUrl.trim(),
    notes: input.rights.notes.trim()
  }
});

const normalizeSourceIntakeLayer = (
  layer: SourceIntakeLayerDraftState
): SourceIntakeLayerDraftState => ({
  sourceLayerId: layer.sourceLayerId.trim(),
  originalName: layer.originalName.trim(),
  normalizedName: layer.normalizedName.trim(),
  groupPath: layer.groupPath.map((part) => part.trim()).filter((part) => part.length > 0),
  bounds: {
    x: layer.bounds.x,
    y: layer.bounds.y,
    width: layer.bounds.width,
    height: layer.bounds.height
  },
  visibleInSource: layer.visibleInSource,
  opacityInSource: layer.opacityInSource,
  role: layer.role,
  unsupportedFeatures: layer.unsupportedFeatures
    .map((feature) => feature.trim())
    .filter((feature) => feature.length > 0)
});

const isFiniteBounds = (bounds: RectDto): boolean =>
  Number.isFinite(bounds.x) &&
  Number.isFinite(bounds.y) &&
  Number.isFinite(bounds.width) &&
  Number.isFinite(bounds.height);
