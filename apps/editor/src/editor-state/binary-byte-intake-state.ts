import type {
  BinaryAssetReferenceDto,
  PackageBinaryByteIntakeSummaryDto,
  SourceAssetDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";
import type { ReloadSummarySource } from "./reload-summary.js";

export type EditorBinaryByteAvailabilityStatus =
  | "available-current-editor-session-v1"
  | "requires-reupload-after-browser-local-load-v1"
  | "missing-package-local-bytes-v1"
  | "storage-unsupported-v1";

export interface EditorBinaryByteIntakeAssetState {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly ownerKind: "sourceAsset" | "texture";
  readonly ownerId: string;
  readonly byteLength: number;
  readonly mediaType: string;
  readonly digestLabel: string;
  readonly shortDigestLabel: string;
  readonly provenanceId: string;
  readonly rightsAssetId: string;
  readonly storageStatus: BinaryAssetReferenceDto["storageStatus"];
  readonly availabilityStatus: EditorBinaryByteAvailabilityStatus;
  readonly availabilityLabel: string;
  readonly validatorBytesAvailability: "available" | "requiresReupload" | "missing";
  readonly sourceFilename: string | null;
  readonly verificationStatus: PackageBinaryByteIntakeSummaryDto["verificationStatus"] | null;
}

export interface EditorBinaryByteIntakeState {
  readonly assets: readonly EditorBinaryByteIntakeAssetState[];
  readonly packageLocalBinaryFilePaths: readonly string[];
  readonly statusLabel: string;
}

export interface ProjectEditorBinaryByteIntakeStateInput {
  readonly sourceAssets?: readonly SourceAssetDto[];
  readonly textureAtlas?: TextureAtlasFileDto | null;
  readonly byteIntakeSummaries?: readonly PackageBinaryByteIntakeSummaryDto[];
  readonly packageLocalBinaryFilePaths?: readonly string[];
  readonly reloadSource?: ReloadSummarySource | null;
}

interface BinaryByteReferenceOwner {
  readonly ownerKind: "sourceAsset" | "texture";
  readonly ownerId: string;
  readonly ref: BinaryAssetReferenceDto;
}

export const createEmptyEditorBinaryByteIntakeState = (): EditorBinaryByteIntakeState => ({
  assets: [],
  packageLocalBinaryFilePaths: [],
  statusLabel: "No binary byte intake assets"
});

export const projectEditorBinaryByteIntakeState = (
  input: ProjectEditorBinaryByteIntakeStateInput = {}
): EditorBinaryByteIntakeState => {
  const packageLocalBinaryFilePaths = [...(input.packageLocalBinaryFilePaths ?? [])].sort();
  const availablePathSet = new Set(packageLocalBinaryFilePaths);
  const summariesByBinaryAssetRefKey = new Map(
    (input.byteIntakeSummaries ?? []).map((summary) => [
      createBinaryAssetRefKey(summary.binaryAssetId, summary.packageRelativePath),
      summary
    ])
  );
  const assets = collectBinaryByteReferenceOwners(input).map((owner) =>
    projectBinaryByteIntakeAssetState({
      owner,
      summary: summariesByBinaryAssetRefKey.get(
        createBinaryAssetRefKey(owner.ref.binaryAssetId, owner.ref.packageRelativePath)
      ),
      availablePathSet,
      reloadSource: input.reloadSource ?? null
    })
  );

  return {
    assets,
    packageLocalBinaryFilePaths,
    statusLabel: projectBinaryByteIntakeStatusLabel(assets)
  };
};

const collectBinaryByteReferenceOwners = (
  input: ProjectEditorBinaryByteIntakeStateInput
): readonly BinaryByteReferenceOwner[] => [
  ...(input.sourceAssets ?? []).flatMap((sourceAsset) =>
    sourceAsset.binaryAssetRef === undefined
      ? []
      : [{
          ownerKind: "sourceAsset" as const,
          ownerId: sourceAsset.sourceAssetId,
          ref: sourceAsset.binaryAssetRef
        }]
  ),
  ...(input.textureAtlas?.textures ?? []).flatMap((texture) =>
    texture.binaryAssetRef === undefined
      ? []
      : [{
          ownerKind: "texture" as const,
          ownerId: texture.textureId,
          ref: texture.binaryAssetRef
        }]
  )
];

const projectBinaryByteIntakeAssetState = (input: {
  readonly owner: BinaryByteReferenceOwner;
  readonly summary: PackageBinaryByteIntakeSummaryDto | undefined;
  readonly availablePathSet: ReadonlySet<string>;
  readonly reloadSource: ReloadSummarySource | null;
}): EditorBinaryByteIntakeAssetState => {
  const availabilityStatus = projectBinaryByteAvailabilityStatus(input);

  return {
    binaryAssetId: input.owner.ref.binaryAssetId,
    packageRelativePath: input.owner.ref.packageRelativePath,
    ownerKind: input.owner.ownerKind,
    ownerId: input.owner.ownerId,
    byteLength: input.owner.ref.byteLength,
    mediaType: input.owner.ref.mediaType,
    digestLabel: `${input.owner.ref.digest.algorithm}:${input.owner.ref.digest.hex}`,
    shortDigestLabel: `${input.owner.ref.digest.algorithm}:${input.owner.ref.digest.hex.slice(0, 12)}...`,
    provenanceId: input.owner.ref.provenanceId,
    rightsAssetId: input.owner.ref.rightsAssetId,
    storageStatus: input.owner.ref.storageStatus,
    availabilityStatus,
    availabilityLabel: formatBinaryByteAvailability(availabilityStatus),
    validatorBytesAvailability: mapValidatorBytesAvailability(availabilityStatus),
    sourceFilename: input.summary?.filename ?? null,
    verificationStatus: input.summary?.verificationStatus ?? null
  };
};

const projectBinaryByteAvailabilityStatus = (input: {
  readonly owner: BinaryByteReferenceOwner;
  readonly summary: PackageBinaryByteIntakeSummaryDto | undefined;
  readonly availablePathSet: ReadonlySet<string>;
  readonly reloadSource: ReloadSummarySource | null;
}): EditorBinaryByteAvailabilityStatus => {
  if (input.owner.ref.storageStatus === "storage-unsupported-v1") {
    return "storage-unsupported-v1";
  }

  if (input.owner.ref.storageStatus === "missing-package-local-bytes-v1") {
    return "missing-package-local-bytes-v1";
  }

  if (
    input.availablePathSet.has(input.owner.ref.packageRelativePath)
  ) {
    return "available-current-editor-session-v1";
  }

  if (
    input.reloadSource === "browserLocalLoad" ||
    input.summary?.availability === "requires-reupload-v1"
  ) {
    return "requires-reupload-after-browser-local-load-v1";
  }

  return "missing-package-local-bytes-v1";
};

const formatBinaryByteAvailability = (
  availability: EditorBinaryByteAvailabilityStatus
): string => {
  switch (availability) {
    case "available-current-editor-session-v1":
      return "available in current editor session memory; browser-local save/load stores metadata only";
    case "requires-reupload-after-browser-local-load-v1":
      return "metadata reloaded without bytes; reupload required before byte validation can pass";
    case "missing-package-local-bytes-v1":
      return "package-local bytes are missing";
    case "storage-unsupported-v1":
      return "current workflow cannot store package-local bytes for this asset";
  }
};

const mapValidatorBytesAvailability = (
  availability: EditorBinaryByteAvailabilityStatus
): EditorBinaryByteIntakeAssetState["validatorBytesAvailability"] => {
  switch (availability) {
    case "available-current-editor-session-v1":
      return "available";
    case "requires-reupload-after-browser-local-load-v1":
      return "requiresReupload";
    case "missing-package-local-bytes-v1":
    case "storage-unsupported-v1":
      return "missing";
  }
};

const createBinaryAssetRefKey = (
  binaryAssetId: string,
  packageRelativePath: string
): string => `${binaryAssetId}\n${packageRelativePath}`;

const projectBinaryByteIntakeStatusLabel = (
  assets: readonly EditorBinaryByteIntakeAssetState[]
): string => {
  if (assets.length === 0) {
    return "No binary byte intake assets";
  }

  const availableCount = assets.filter(
    (asset) => asset.availabilityStatus === "available-current-editor-session-v1"
  ).length;
  const reuploadCount = assets.filter(
    (asset) => asset.availabilityStatus === "requires-reupload-after-browser-local-load-v1"
  ).length;
  const missingCount = assets.length - availableCount - reuploadCount;

  return `${availableCount} available / ${reuploadCount} reupload required / ${missingCount} missing binary byte asset${assets.length === 1 ? "" : "s"}`;
};
