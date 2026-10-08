import {
  OperationIdSchema,
  ProvenanceIdSchema,
  type OperationId,
  type ProvenanceId,
  type TextureId,
  type Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import {
  TextureAtlasLayoutSummarySchema,
  type DrawableDto,
  type BinaryAssetReferenceDto,
  type MeshDto,
  type ProvenanceRecordDto,
  type RightsRecordDto,
  type TextureAtlasEntryDto,
  type TextureAtlasFileDto,
  type TextureAtlasLayoutSettingsDto,
  type TextureAtlasLayoutSummaryDto,
  type TextureAtlasPlacementDto
} from "@private-2d-rigging-lab/package-format";

import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { registerAuthoringSessionBinaryBytes } from "./binary-byte-registration.js";
import { getDrawableById, getMeshById } from "./drawable-selectors.js";
import {
  createTextureAtlasSourceSignature,
  sameTextureAtlasSourceSignature
} from "./texture-atlas-source-signature.js";
import {
  createTextureAtlasBinaryAssetReference,
  createTextureAtlasPageRgbaBytes
} from "./texture-atlas-binary.js";
import type { TextureAtlasPreview } from "./texture-atlas-packing.js";
import {
  selectTextureAtlasTargets,
  type TextureAtlasWarning
} from "./texture-atlas-targets.js";

export interface TextureAtlasDrawableChange {
  readonly drawableId: DrawableDto["drawableId"];
  readonly before: DrawableDto;
  readonly after: DrawableDto;
}

export interface TextureAtlasMeshUvChange {
  readonly meshId: MeshDto["meshId"];
  readonly before: MeshDto;
  readonly after: MeshDto;
}

export type ApplyTextureAtlasPreviewResult =
  | {
      readonly status: "applied";
      readonly session: AuthoringSession;
      readonly textureAtlas: TextureAtlasFileDto;
      readonly textureEntry: TextureAtlasEntryDto;
      readonly layoutSummary: TextureAtlasLayoutSummaryDto;
      readonly atlasBytes: Uint8Array;
      readonly drawableChanges: readonly TextureAtlasDrawableChange[];
      readonly meshUvChanges: readonly TextureAtlasMeshUvChange[];
      readonly warnings: readonly TextureAtlasWarning[];
      readonly authoringRevision: AuthoringRevision;
    }
  | {
      readonly status: "failed";
      readonly session: AuthoringSession;
      readonly warnings: readonly TextureAtlasWarning[];
    };

export interface ApplyTextureAtlasPreviewInput {
  readonly preview: TextureAtlasPreview;
  readonly operationId?: OperationId;
  readonly freshnessValidation?: TextureAtlasPreviewFreshnessValidation;
}

export interface TextureAtlasPreviewFreshnessValidation {
  readonly status: "validated-current-session";
  readonly layoutSummary: TextureAtlasLayoutSummaryDto;
}

export const applyTextureAtlasPreview = async (
  session: AuthoringSession,
  input: ApplyTextureAtlasPreviewInput
): Promise<ApplyTextureAtlasPreviewResult> => {
  const guardWarnings = createApplyGuardWarnings(
    session,
    input.preview,
    input.freshnessValidation
  );
  if (guardWarnings.length > 0 || input.preview.status !== "ready") {
    return {
      status: "failed",
      session,
      warnings: [
        ...(input.preview.status === "ready"
          ? []
          : [createPreviewNotReadyWarning(input.preview)]),
        ...input.preview.warnings,
        ...guardWarnings
      ]
    };
  }

  const preview = input.preview;
  const page = preview.layoutSummary.pages[0];
  if (page === undefined) {
    return {
      status: "failed",
      session,
      warnings: [createPreviewNotReadyWarning(preview)]
    };
  }

  const atlasBytes = createTextureAtlasPageRgbaBytes(preview);
  const provenanceId = createGeneratedAtlasProvenanceId(preview.atlasTextureId);
  const rightsAssetId = preview.atlasTextureId;
  let binaryAssetRef: BinaryAssetReferenceDto;

  try {
    binaryAssetRef = await createTextureAtlasBinaryAssetReference({
      atlasTextureId: preview.atlasTextureId,
      bytes: atlasBytes,
      provenanceId,
      rightsAssetId
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      status: "failed",
      session,
      warnings: [{
        code: "atlas.apply.generatedBinaryDigestUnavailable",
        severity: "error",
        targetPath: "/assets/textureAtlas/textures",
        message,
        textureId: preview.atlasTextureId,
        details: [`atlasTextureId=${preview.atlasTextureId}`]
      }]
    };
  }

  const layoutSummary = TextureAtlasLayoutSummarySchema.parse({
    ...preview.layoutSummary,
    ...(input.operationId === undefined ? {} : { generatedByOperationId: input.operationId })
  });
  const textureEntry: TextureAtlasEntryDto = {
    textureId: preview.atlasTextureId,
    filePath: binaryAssetRef.packageRelativePath,
    contentHash: `sha256:${binaryAssetRef.digest.hex}`,
    dimensions: {
      width: page.width,
      height: page.height,
      pixelFormat: "rgba8"
    },
    provenanceId,
    binaryAssetRef
  };
  const textureAtlas = ensureTextureAtlas(session);

  upsertTextureEntry(textureAtlas, textureEntry);
  textureAtlas.layoutSummary = layoutSummary;
  upsertGeneratedAtlasProvenanceRecord(session, {
    provenanceId,
    textureId: preview.atlasTextureId,
    filePath: binaryAssetRef.packageRelativePath,
    contentHash: textureEntry.contentHash,
    algorithmId: preview.settings.algorithmId,
    operationId: input.operationId
  });
  upsertGeneratedAtlasRightsRecord(session, {
    textureId: preview.atlasTextureId
  });
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes: atlasBytes,
    role: "texture-raster-v1",
    textureId: preview.atlasTextureId,
    ...(input.operationId === undefined ? {} : { createdByOperationId: input.operationId })
  });

  const drawableChanges: TextureAtlasDrawableChange[] = [];
  const meshUvChanges: TextureAtlasMeshUvChange[] = [];

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    status: "applied",
    session,
    textureAtlas: structuredClone(textureAtlas),
    textureEntry: structuredClone(textureEntry),
    layoutSummary: structuredClone(layoutSummary),
    atlasBytes,
    drawableChanges,
    meshUvChanges,
    warnings: [],
    authoringRevision: session.authoringRevision
  };
};

const createApplyGuardWarnings = (
  session: AuthoringSession,
  preview: TextureAtlasPreview,
  freshnessValidation: TextureAtlasPreviewFreshnessValidation | undefined
): readonly TextureAtlasWarning[] => {
  if (preview.status !== "ready") {
    return [];
  }

  if (hasValidatedCurrentSessionFreshness(preview, freshnessValidation)) {
    return [];
  }

  const targetByDrawableId = new Map(
    preview.packableTargets.map((target) => [target.drawable.drawableId, target])
  );
  const warnings: TextureAtlasWarning[] = [];
  const page = preview.layoutSummary.pages[0];

  const currentTargetSelection = selectTextureAtlasTargets(session);
  const currentSourceSignature = createTextureAtlasSourceSignature({
    settings: preview.settings,
    targetSelection: currentTargetSelection,
    packableTargets: currentTargetSelection.packableTargets
  });

  if (
    !sameTextureAtlasSourceSignature(
      currentSourceSignature,
      preview.layoutSummary.sourceSignature
    )
  ) {
    warnings.push(createStalePreviewWarningForSourceSignature(preview, currentSourceSignature.digest));
  }

  for (const placement of page?.placements ?? []) {
    const target = targetByDrawableId.get(placement.drawableId);
    const drawable = getDrawableById(session.graph, placement.drawableId);
    const mesh = getMeshById(session.graph, placement.meshId);

    if (target === undefined || drawable === undefined || mesh === undefined) {
      warnings.push(createStalePreviewWarning(placement, "target-missing"));
      continue;
    }

    if (drawable.textureId !== placement.originalTextureId) {
      warnings.push(createStalePreviewWarning(placement, "drawable-texture-changed"));
      continue;
    }

    if (
      mesh.uvs.length !== target.mesh.uvs.length ||
      !sameVec2Array(mesh.uvs, target.mesh.uvs)
    ) {
      warnings.push(createStalePreviewWarning(placement, "mesh-uvs-changed"));
    }
  }

  return warnings;
};

const hasValidatedCurrentSessionFreshness = (
  preview: Extract<TextureAtlasPreview, { readonly status: "ready" }>,
  freshnessValidation: TextureAtlasPreviewFreshnessValidation | undefined
): boolean =>
  freshnessValidation?.status === "validated-current-session" &&
  sameLayoutSummaryForFreshness(
    freshnessValidation.layoutSummary,
    preview.layoutSummary
  );

const sameLayoutSummaryForFreshness = (
  left: TextureAtlasLayoutSummaryDto,
  right: TextureAtlasLayoutSummaryDto
): boolean =>
  JSON.stringify(normalizeLayoutSummaryForFreshness(left)) ===
  JSON.stringify(normalizeLayoutSummaryForFreshness(right));

const normalizeLayoutSummaryForFreshness = (
  layoutSummary: TextureAtlasLayoutSummaryDto
): TextureAtlasLayoutSummaryDto => {
  const normalized = structuredClone(layoutSummary);
  delete normalized.generatedByOperationId;

  return normalized;
};

const ensureTextureAtlas = (session: AuthoringSession): TextureAtlasFileDto => {
  if (session.graph.textureAtlas === undefined) {
    session.graph.textureAtlas = {
      schemaVersion: "texture-atlas-v1",
      textures: []
    };
  }

  return session.graph.textureAtlas;
};

const upsertTextureEntry = (
  textureAtlas: TextureAtlasFileDto,
  textureEntry: TextureAtlasEntryDto
): void => {
  const existingIndex = textureAtlas.textures.findIndex(
    (entry) => entry.textureId === textureEntry.textureId
  );
  const storedEntry = structuredClone(textureEntry);

  if (existingIndex === -1) {
    textureAtlas.textures.push(storedEntry);
    return;
  }

  textureAtlas.textures.splice(existingIndex, 1, storedEntry);
};

const upsertGeneratedAtlasProvenanceRecord = (
  session: AuthoringSession,
  input: {
    readonly provenanceId: ProvenanceId;
    readonly textureId: TextureId;
    readonly filePath: string;
    readonly contentHash: string | undefined;
    readonly algorithmId: TextureAtlasLayoutSettingsDto["algorithmId"];
    readonly operationId: OperationId | undefined;
  }
): void => {
  const record: ProvenanceRecordDto = {
    provenanceId: input.provenanceId,
    assetId: input.textureId,
    assetKind: "texture",
    filePath: input.filePath,
    ...(input.contentHash === undefined ? {} : { contentHash: input.contentHash }),
    creator: "texture-atlas-v0",
    license: "derived-from-project-source-textures",
    redistributionAllowed: false,
    aiUsed: false,
    transformHistory: [
      `Generated by Texture Atlas v0 ${input.algorithmId} packing from package-local raw RGBA texture bytes.`,
      "Source texture entries were retained."
    ],
    relatedOperationIds: input.operationId === undefined
      ? []
      : [OperationIdSchema.parse(input.operationId)]
  };
  const existingIndex = session.graph.provenanceRecords.findIndex(
    (candidate) => candidate.provenanceId === record.provenanceId
  );

  if (existingIndex === -1) {
    session.graph.provenanceRecords.push(record);
    return;
  }

  session.graph.provenanceRecords.splice(existingIndex, 1, record);
};

const upsertGeneratedAtlasRightsRecord = (
  session: AuthoringSession,
  input: { readonly textureId: TextureId }
): void => {
  const record: RightsRecordDto = {
    assetId: input.textureId,
    rightsStatus: "needs_review",
    license: "derived-from-project-source-textures",
    redistributionAllowed: false,
    notes:
      "Generated atlas page derived from existing project texture bytes; source texture rights remain authoritative."
  };
  const existingIndex = session.graph.rightsRecords.findIndex(
    (candidate) => candidate.assetId === record.assetId
  );

  if (existingIndex === -1) {
    session.graph.rightsRecords.push(record);
    return;
  }

  session.graph.rightsRecords.splice(existingIndex, 1, record);
};

const createGeneratedAtlasProvenanceId = (textureId: TextureId): ProvenanceId =>
  ProvenanceIdSchema.parse(`prov_${stripTexturePrefix(textureId)}_generation`);

const createPreviewNotReadyWarning = (preview: TextureAtlasPreview): TextureAtlasWarning => ({
  code: "atlas.apply.previewNotReady",
  severity: "error",
  targetPath: "/assets/textureAtlas/layoutSummary",
  message: "Texture atlas Apply requires a ready preview.",
  textureId: preview.atlasTextureId,
  details: [
    `previewStatus=${preview.status}`,
    `atlasTextureId=${preview.atlasTextureId}`
  ]
});

const createStalePreviewWarning = (
  placement: TextureAtlasPlacementDto,
  reason: string
): TextureAtlasWarning => ({
  code: "atlas.apply.stalePreview",
  severity: "error",
  targetPath: `/model/drawables/${placement.drawableId}`,
  message: `Texture atlas preview is stale for drawable ${placement.drawableId}.`,
  drawableId: placement.drawableId,
  meshId: placement.meshId,
  textureId: placement.originalTextureId,
  details: [
    `placementId=${placement.placementId}`,
    `reason=${reason}`
  ]
});

const createStalePreviewWarningForSourceSignature = (
  preview: Extract<TextureAtlasPreview, { readonly status: "ready" }>,
  currentDigest: string
): TextureAtlasWarning => ({
  code: "atlas.apply.stalePreview",
  severity: "error",
  targetPath: "/assets/textureAtlas/layoutSummary/sourceSignature",
  message: "Texture atlas preview source signature no longer matches the current atlas source inputs.",
  textureId: preview.atlasTextureId,
  details: [
    `expectedDigest=${preview.layoutSummary.sourceSignature?.digest ?? "missing"}`,
    `currentDigest=${currentDigest}`
  ]
});

const sameVec2Array = (
  left: readonly Vec2Dto[],
  right: readonly Vec2Dto[]
): boolean =>
  left.length === right.length &&
  left.every((value, index) => {
    const rightValue = right[index];

    return rightValue !== undefined &&
      value.x === rightValue.x &&
      value.y === rightValue.y;
  });

const stripTexturePrefix = (textureId: string): string =>
  textureId.startsWith("tex_") ? textureId.slice("tex_".length) : textureId;
