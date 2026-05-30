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

const textureIdPattern = /^tex_[A-Za-z0-9_-]+$/;
const partIdPattern = /^part_[A-Za-z0-9_-]+$/;
const packageLocalTextureReferencePrefixes = [
  "assets/textures/",
  "assets/thumbnails/"
] as const;
const generatedTextureReferencePrefix = "generated://texture-preview/";
const deterministicImageDataUrlPattern =
  /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

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
  readonly texturePreviewReference?: string;
  readonly textureId?: string;
  readonly targetPartId?: string;
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
  index: number,
  input: SourceIntakeDraftDefaultsInput = {}
): SourceIntakeLayerDraftState => ({
  sourceLayerId: index === 0 ? "layer_body" : `layer_${index + 1}`,
  originalName: index === 0 ? "Body" : `Layer ${index + 1}`,
  normalizedName: index === 0 ? "body" : `layer_${index + 1}`,
  groupPath: index === 0 ? ["Root"] : [],
  bounds: { x: 0, y: 0, width: 64, height: 64 },
  visibleInSource: true,
  opacityInSource: 1,
  role: "editableLayer",
  unsupportedFeatures: [],
  texturePreviewReference:
    index === 0
      ? "assets/textures/layer_body.preview.png"
      : `assets/textures/layer_${index + 1}.preview.png`,
  textureId: index === 0 ? "tex_body" : `tex_layer_${index + 1}`,
  targetPartId: input.defaultPartId ?? ""
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
  layers: [createDefaultSourceIntakeLayerDraft(0, input)],
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
    "sourceAssetId" | "manifestPath" | "defaultPartId" | "placementPolicy" | "layers" | "rights"
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

    const texturePreviewReference = getLayerTexturePreviewReference(layer);
    const textureId = getLayerTextureId(layer);
    const targetPartId = getLayerTargetPartId(layer);
    const effectivePartId = targetPartId.length > 0 ? targetPartId : draft.defaultPartId.trim();

    if (texturePreviewReference.length === 0) {
      diagnostics.push(`${label} texture preview reference is required.`);
    } else {
      const texturePreviewReferenceDiagnostic = getTexturePreviewReferenceDiagnostic(
        label,
        texturePreviewReference
      );
      if (texturePreviewReferenceDiagnostic !== undefined) {
        diagnostics.push(texturePreviewReferenceDiagnostic);
      }
    }

    if (textureId.length === 0) {
      diagnostics.push(`${label} texture ID is required.`);
    } else if (!textureIdPattern.test(textureId)) {
      diagnostics.push(`${label} texture ID must start with tex_.`);
    }

    if (effectivePartId.length === 0) {
      diagnostics.push(`${label} target part ID is required.`);
    } else if (!partIdPattern.test(effectivePartId)) {
      diagnostics.push(`${label} target part ID must start with part_.`);
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
    .filter((feature) => feature.length > 0),
  texturePreviewReference: getLayerTexturePreviewReference(layer),
  textureId: getLayerTextureId(layer),
  targetPartId: getLayerTargetPartId(layer)
});

const isFiniteBounds = (bounds: RectDto): boolean =>
  Number.isFinite(bounds.x) &&
  Number.isFinite(bounds.y) &&
  Number.isFinite(bounds.width) &&
  Number.isFinite(bounds.height);

const getLayerTexturePreviewReference = (
  layer: SourceIntakeLayerDraftState
): string => layer.texturePreviewReference?.trim() ?? "";

const getLayerTextureId = (
  layer: SourceIntakeLayerDraftState
): string => layer.textureId?.trim() ?? "";

const getLayerTargetPartId = (
  layer: SourceIntakeLayerDraftState
): string => layer.targetPartId?.trim() ?? "";

const isSupportedTexturePreviewReference = (reference: string): boolean => {
  if (isDeterministicImageDataUrl(reference)) {
    return true;
  }

  if (
    reference.length === 0 ||
    reference.includes("\\") ||
    reference.startsWith("/") ||
    reference.endsWith("/") ||
    reference.split("/").some((part) => part.length === 0 || part === "." || part === "..") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(reference)
  ) {
    return false;
  }

  return packageLocalTextureReferencePrefixes.some((prefix) => reference.startsWith(prefix));
};

const getTexturePreviewReferenceDiagnostic = (
  label: string,
  reference: string
): string | undefined => {
  if (isSupportedTexturePreviewReference(reference)) {
    return undefined;
  }

  if (reference.startsWith(generatedTextureReferencePrefix)) {
    return `${label} generated://texture-preview/ references are not supported by Source Intake commits; use assets/textures/, assets/thumbnails/, or deterministic data:image/(png|jpeg|webp);base64,... references.`;
  }

  return `${label} texture preview reference is invalid; use assets/textures/, assets/thumbnails/, or deterministic data:image/(png|jpeg|webp);base64,... references.`;
};

const isDeterministicImageDataUrl = (reference: string): boolean =>
  deterministicImageDataUrlPattern.test(reference);
