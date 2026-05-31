import {
  BinaryAssetReferenceSchema,
  type BinaryAssetReferenceDto,
  type ProvenanceRecordDto,
  type RightsRecordDto,
  type SourceAssetDto,
  type TextureAtlasEntryDto,
  type TexturePreviewAssetDto
} from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";

export { BinaryAssetReferenceSchema };
export type { BinaryAssetReferenceDto };

export const normalizeSourceAssetBinaryAssetReference = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly provenanceRecord: ProvenanceRecordDto;
  readonly rightsRecord: RightsRecordDto;
}): BinaryAssetReferenceDto | undefined => {
  if (input.sourceAsset.binaryAssetRef === undefined) {
    return undefined;
  }

  const binaryAssetRef = cloneBinaryAssetReference(input.sourceAsset.binaryAssetRef);

  if (binaryAssetRef.packageRelativePath !== input.sourceAsset.filePath) {
    throw new AuthoringMutationError(
      "source_binary_ref_path_mismatch",
      `Source binary asset ${binaryAssetRef.binaryAssetId} points to ${binaryAssetRef.packageRelativePath}, not source file ${input.sourceAsset.filePath}.`
    );
  }

  if (binaryAssetRef.provenanceId !== input.provenanceRecord.provenanceId) {
    throw new AuthoringMutationError(
      "source_binary_ref_provenance_mismatch",
      `Source binary asset ${binaryAssetRef.binaryAssetId} uses provenance ${binaryAssetRef.provenanceId}, not ${input.provenanceRecord.provenanceId}.`
    );
  }

  if (binaryAssetRef.rightsAssetId !== input.rightsRecord.assetId) {
    throw new AuthoringMutationError(
      "source_binary_ref_rights_mismatch",
      `Source binary asset ${binaryAssetRef.binaryAssetId} uses rights asset ${binaryAssetRef.rightsAssetId}, not ${input.rightsRecord.assetId}.`
    );
  }

  return binaryAssetRef;
};

export const normalizeTextureEntryBinaryAssetReference = (input: {
  readonly textureEntry: TextureAtlasEntryDto;
  readonly previewAsset: TexturePreviewAssetDto;
}): BinaryAssetReferenceDto | undefined => {
  if (input.textureEntry.binaryAssetRef === undefined) {
    return undefined;
  }

  const binaryAssetRef = cloneBinaryAssetReference(input.textureEntry.binaryAssetRef);

  if (binaryAssetRef.packageRelativePath !== input.textureEntry.filePath) {
    throw new AuthoringMutationError(
      "texture_binary_ref_path_mismatch",
      `Texture binary asset ${binaryAssetRef.binaryAssetId} points to ${binaryAssetRef.packageRelativePath}, not texture file ${input.textureEntry.filePath}.`
    );
  }

  if (input.textureEntry.provenanceId !== binaryAssetRef.provenanceId) {
    throw new AuthoringMutationError(
      "texture_binary_ref_provenance_mismatch",
      `Texture binary asset ${binaryAssetRef.binaryAssetId} uses provenance ${binaryAssetRef.provenanceId}, not ${input.textureEntry.provenanceId}.`
    );
  }

  if (input.previewAsset.rightsAssetId !== binaryAssetRef.rightsAssetId) {
    throw new AuthoringMutationError(
      "texture_binary_ref_rights_mismatch",
      `Texture binary asset ${binaryAssetRef.binaryAssetId} uses rights asset ${binaryAssetRef.rightsAssetId}, not ${input.previewAsset.rightsAssetId}.`
    );
  }

  return binaryAssetRef;
};

const cloneBinaryAssetReference = (
  binaryAssetRef: BinaryAssetReferenceDto
): BinaryAssetReferenceDto =>
  BinaryAssetReferenceSchema.parse(structuredClone(binaryAssetRef));
