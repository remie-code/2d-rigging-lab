import type {
  TextureAtlasEntryDto,
  TextureAtlasFileDto,
  TexturePreviewAssetDto
} from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getSourceAssetById } from "./drawable-selectors.js";

export interface UpsertTexturePreviewAssetMetadataMutationResult {
  readonly session: AuthoringSession;
  readonly textureEntry: TextureAtlasEntryDto;
  readonly previewAsset: TexturePreviewAssetDto;
  readonly textureAtlas: TextureAtlasFileDto;
  readonly authoringRevision: AuthoringRevision;
}

export const upsertTexturePreviewAssetMetadata = (
  session: AuthoringSession,
  input: {
    readonly textureEntry: TextureAtlasEntryDto;
    readonly previewAsset: TexturePreviewAssetDto;
  }
): UpsertTexturePreviewAssetMetadataMutationResult => {
  const previewAsset = structuredClone(input.previewAsset);
  const textureEntry = normalizeTextureEntry(input.textureEntry, previewAsset);
  assertCanUpsertTexturePreviewAssetMetadata(session, textureEntry, previewAsset);

  const textureAtlas = ensureTextureAtlas(session);
  upsertTextureEntry(textureAtlas, textureEntry);
  upsertPreviewAsset(textureAtlas, previewAsset);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    textureEntry,
    previewAsset,
    textureAtlas: structuredClone(textureAtlas),
    authoringRevision: session.authoringRevision
  };
};

const normalizeTextureEntry = (
  textureEntry: TextureAtlasEntryDto,
  previewAsset: TexturePreviewAssetDto
): TextureAtlasEntryDto => ({
  ...structuredClone(textureEntry),
  sourceAssetId: textureEntry.sourceAssetId ?? previewAsset.sourceAssetId,
  sourceLayerId: textureEntry.sourceLayerId ?? previewAsset.sourceLayerId,
  provenanceId: textureEntry.provenanceId ?? previewAsset.provenanceId
});

const assertCanUpsertTexturePreviewAssetMetadata = (
  session: AuthoringSession,
  textureEntry: TextureAtlasEntryDto,
  previewAsset: TexturePreviewAssetDto
): void => {
  if (textureEntry.textureId !== previewAsset.textureId) {
    throw new AuthoringMutationError(
      "texture_preview_texture_mismatch",
      `Texture preview ${previewAsset.previewAssetId} does not target texture ${textureEntry.textureId}.`
    );
  }

  if (textureEntry.sourceAssetId !== previewAsset.sourceAssetId) {
    throw new AuthoringMutationError(
      "texture_preview_source_asset_mismatch",
      `Texture preview ${previewAsset.previewAssetId} does not belong to source asset ${textureEntry.sourceAssetId}.`
    );
  }

  if (textureEntry.sourceLayerId !== previewAsset.sourceLayerId) {
    throw new AuthoringMutationError(
      "texture_preview_source_layer_mismatch",
      `Texture preview ${previewAsset.previewAssetId} does not belong to source layer ${textureEntry.sourceLayerId}.`
    );
  }

  if (textureEntry.provenanceId !== previewAsset.provenanceId) {
    throw new AuthoringMutationError(
      "texture_preview_provenance_mismatch",
      `Texture preview ${previewAsset.previewAssetId} does not use provenance ${textureEntry.provenanceId}.`
    );
  }

  const sourceAsset = getSourceAssetById(session.graph, previewAsset.sourceAssetId);
  if (sourceAsset === undefined) {
    throw new AuthoringMutationError(
      "missing_source_asset",
      `Source asset does not exist: ${previewAsset.sourceAssetId}.`
    );
  }

  const sourceLayer = sourceAsset.layers.find(
    (layer) => layer.sourceLayerId === previewAsset.sourceLayerId
  );
  if (sourceLayer === undefined) {
    throw new AuthoringMutationError(
      "missing_source_layer",
      `Source layer does not exist: ${previewAsset.sourceLayerId}.`
    );
  }

  if (sourceLayer.sourceAssetId !== previewAsset.sourceAssetId) {
    throw new AuthoringMutationError(
      "source_layer_asset_mismatch",
      `Source layer ${sourceLayer.sourceLayerId} does not belong to source asset ${previewAsset.sourceAssetId}.`
    );
  }

  const provenanceRecord = session.graph.provenanceRecords.find(
    (record) => record.provenanceId === previewAsset.provenanceId
  );
  if (provenanceRecord === undefined) {
    throw new AuthoringMutationError(
      "missing_provenance_record",
      `Texture preview provenance does not exist: ${previewAsset.provenanceId}.`
    );
  }

  if (provenanceRecord.assetId !== previewAsset.rightsAssetId) {
    throw new AuthoringMutationError(
      "texture_preview_provenance_mismatch",
      `Texture preview provenance asset ${provenanceRecord.assetId} does not match rights asset ${previewAsset.rightsAssetId}.`
    );
  }

  const rightsRecord = session.graph.rightsRecords.find(
    (record) => record.assetId === previewAsset.rightsAssetId
  );
  if (rightsRecord === undefined) {
    throw new AuthoringMutationError(
      "missing_rights_record",
      `Texture preview rights record does not exist: ${previewAsset.rightsAssetId}.`
    );
  }

  if (rightsRecord.rightsStatus === "blocked") {
    throw new AuthoringMutationError(
      "blocked_rights",
      `Blocked rights cannot be applied to texture preview ${previewAsset.previewAssetId}.`
    );
  }
};

const ensureTextureAtlas = (session: AuthoringSession): TextureAtlasFileDto => {
  if (session.graph.textureAtlas === undefined) {
    session.graph.textureAtlas = {
      schemaVersion: "texture-atlas-v1",
      textures: [],
      previewAssets: []
    };
  }

  if (session.graph.textureAtlas.previewAssets === undefined) {
    session.graph.textureAtlas.previewAssets = [];
  }

  return session.graph.textureAtlas;
};

const upsertTextureEntry = (
  textureAtlas: TextureAtlasFileDto,
  textureEntry: TextureAtlasEntryDto
): void => {
  const storedEntry = structuredClone(textureEntry);
  const existingIndex = textureAtlas.textures.findIndex(
    (entry) => entry.textureId === storedEntry.textureId
  );

  if (existingIndex === -1) {
    textureAtlas.textures.push(storedEntry);
    return;
  }

  textureAtlas.textures.splice(existingIndex, 1, storedEntry);
};

const upsertPreviewAsset = (
  textureAtlas: TextureAtlasFileDto,
  previewAsset: TexturePreviewAssetDto
): void => {
  const storedPreviewAsset = structuredClone(previewAsset);
  const previewAssets = textureAtlas.previewAssets ?? [];
  const existingIndex = previewAssets.findIndex(
    (asset) => asset.previewAssetId === storedPreviewAsset.previewAssetId
  );

  if (existingIndex === -1) {
    previewAssets.push(storedPreviewAsset);
  } else {
    previewAssets.splice(existingIndex, 1, storedPreviewAsset);
  }

  textureAtlas.previewAssets = previewAssets;
};
