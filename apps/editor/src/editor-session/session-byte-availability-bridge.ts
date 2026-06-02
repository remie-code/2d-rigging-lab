import {
  BinaryAssetReferenceSchema,
  evaluatePackageBinaryCurrentSessionByteAvailability,
  PackageBinaryByteVerifiedSummarySnapshotSchema,
  type BinaryAssetIndexFileDto,
  type BinaryAssetReferenceDto,
  type PackageBinaryAssetVerificationIssue,
  type PackageBinaryAssetVerificationReport,
  type PackageBinaryByteAvailabilityReportDto,
  type PackageBinaryByteIntakeSummaryDto,
  type PackageBinaryFileEntry,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { ByteIntakeAssetPreflightInput } from "@private-2d-rigging-lab/validator-core";

import {
  createSourceByteIntakePreflightAsset,
  createUnsupportedByteIntakeClaims
} from "./binary-byte-registration-command.js";

export const createEditorSessionByteIntakePreflightAssets = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly binaryAssetIndex: BinaryAssetIndexFileDto;
  readonly byteIntakeSummaries: readonly PackageBinaryByteIntakeSummaryDto[];
  readonly binaryFileEntries: readonly PackageBinaryFileEntry[];
}): readonly ByteIntakeAssetPreflightInput[] => {
  const binaryFileEntryByPath = new Map(
    input.binaryFileEntries.map((entry) => [entry.path, entry])
  );
  const packageLocalBinaryFilePaths = input.binaryFileEntries.map((entry) => entry.path);
  const summarizedBinaryAssetKeys = new Set(
    input.byteIntakeSummaries.map((summary) =>
      createBinaryAssetRefKey(summary.binaryAssetId, summary.packageRelativePath)
    )
  );

  return [
    ...input.byteIntakeSummaries.map((summary) =>
      createByteIntakePreflightAssetForSummary({
        summary,
        binaryAssetIndex: input.binaryAssetIndex,
        packageDocument: input.packageDocument,
        binaryFileEntry: binaryFileEntryByPath.get(summary.packageRelativePath)
      })
    ),
    ...createByteIntakePreflightAssetsForDocumentRefs({
      packageDocument: input.packageDocument,
      packageLocalBinaryFilePaths,
      summarizedBinaryAssetKeys
    })
  ];
};

const createByteIntakePreflightAssetsForDocumentRefs = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly packageLocalBinaryFilePaths: readonly string[];
  readonly summarizedBinaryAssetKeys: ReadonlySet<string>;
}): readonly ByteIntakeAssetPreflightInput[] => {
  const packageLocalBinaryFilePathSet = new Set(input.packageLocalBinaryFilePaths);

  return [
    ...input.packageDocument.assets.sourceManifest.sourceAssets.flatMap((sourceAsset, sourceAssetIndex) => {
      const binaryAssetRef = sourceAsset.binaryAssetRef;
      if (
        binaryAssetRef === undefined ||
        input.summarizedBinaryAssetKeys.has(
          createBinaryAssetRefKey(binaryAssetRef.binaryAssetId, binaryAssetRef.packageRelativePath)
        )
      ) {
        return [];
      }

      return [{
        binaryAssetId: binaryAssetRef.binaryAssetId,
        packageRelativePath: binaryAssetRef.packageRelativePath,
        digest: binaryAssetRef.digest,
        byteLength: binaryAssetRef.byteLength,
        mediaType: binaryAssetRef.mediaType,
        fileMediaType: binaryAssetRef.mediaType,
        provenanceId: binaryAssetRef.provenanceId,
        rightsAssetId: binaryAssetRef.rightsAssetId,
        sourceFilename: sourceAsset.filePath.split("/").at(-1) ?? sourceAsset.filePath,
        bytesAvailability: packageLocalBinaryFilePathSet.has(binaryAssetRef.packageRelativePath)
          ? "available"
          : binaryAssetRef.storageStatus === "stored-package-local-v1"
            ? "requiresReupload"
            : "missing",
        targetKind: "sourceAsset",
        targetId: sourceAsset.sourceAssetId,
        targetPath: `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/binaryAssetRef`,
        unsupportedClaims: createUnsupportedByteIntakeClaims()
      } satisfies ByteIntakeAssetPreflightInput];
    }),
    ...(input.packageDocument.assets.textureAtlas?.textures.flatMap((texture, textureIndex) => {
      const binaryAssetRef = texture.binaryAssetRef;
      if (
        binaryAssetRef === undefined ||
        input.summarizedBinaryAssetKeys.has(
          createBinaryAssetRefKey(binaryAssetRef.binaryAssetId, binaryAssetRef.packageRelativePath)
        )
      ) {
        return [];
      }

      return [{
        binaryAssetId: binaryAssetRef.binaryAssetId,
        packageRelativePath: binaryAssetRef.packageRelativePath,
        digest: binaryAssetRef.digest,
        byteLength: binaryAssetRef.byteLength,
        mediaType: binaryAssetRef.mediaType,
        fileMediaType: binaryAssetRef.mediaType,
        provenanceId: binaryAssetRef.provenanceId,
        rightsAssetId: binaryAssetRef.rightsAssetId,
        bytesAvailability: packageLocalBinaryFilePathSet.has(binaryAssetRef.packageRelativePath)
          ? "available"
          : binaryAssetRef.storageStatus === "storage-unsupported-v1"
            ? "missing"
            : "requiresReupload",
        targetKind: "texture",
        targetId: texture.textureId,
        targetPath: `/assets/textureAtlas/textures/${textureIndex}/binaryAssetRef`,
        unsupportedClaims: createUnsupportedByteIntakeClaims()
      } satisfies ByteIntakeAssetPreflightInput];
    }) ?? [])
  ];
};

const createByteIntakePreflightAssetForSummary = (
  input: {
    readonly summary: PackageBinaryByteIntakeSummaryDto;
    readonly binaryAssetIndex: BinaryAssetIndexFileDto;
    readonly packageDocument: PackageDocumentDto;
    readonly binaryFileEntry: PackageBinaryFileEntry | undefined;
  }
): ByteIntakeAssetPreflightInput => {
  const binaryAssetEntry = input.binaryAssetIndex.assets.find(
    (entry) => entry.binaryAssetId === input.summary.binaryAssetId
  );
  const binaryAssetRef =
    findDocumentBinaryAssetRef(input.packageDocument, input.summary) ??
    createBinaryAssetReferenceFromSummary(input.summary);
  const currentSessionVerificationReport =
    input.binaryFileEntry === undefined
      ? undefined
      : createCurrentSessionVerificationReport({
        binaryAssetRef,
        binaryFileEntry: input.binaryFileEntry
      });
  const availabilityReport = evaluatePackageBinaryCurrentSessionByteAvailability({
    packageId: input.packageDocument.manifest.packageId,
    packageRevision: input.packageDocument.manifest.packageRevision,
    binaryAssetRef,
    ...(currentSessionVerificationReport === undefined
      ? {}
      : { currentSessionVerificationReport }),
    verifiedSummary: PackageBinaryByteVerifiedSummarySnapshotSchema.parse({
      schemaVersion: "package-binary-byte-verified-summary-snapshot-v1",
      packageId: input.packageDocument.manifest.packageId,
      packageRevision: input.packageDocument.manifest.packageRevision,
      summary: input.summary
    }),
    requiresReupload:
      input.binaryFileEntry === undefined &&
      binaryAssetRef.storageStatus === "stored-package-local-v1"
  });
  const asset = createByteIntakePreflightAssetForSummaryTarget({
    summary: input.summary,
    binaryAssetEntry
  });
  const bytesAvailability = mapAvailabilityReportToByteIntakeBytesAvailability(availabilityReport);

  return {
    ...asset,
    binaryAssetId: binaryAssetRef.binaryAssetId,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    digest: binaryAssetRef.digest,
    byteLength: binaryAssetRef.byteLength,
    mediaType: binaryAssetRef.mediaType,
    provenanceId: binaryAssetRef.provenanceId,
    rightsAssetId: binaryAssetRef.rightsAssetId,
    bytesAvailability,
    ...(currentSessionVerificationReport === undefined
      ? {}
      : { currentSessionVerificationReport }),
    ...(input.binaryFileEntry === undefined ? {} : { bytes: input.binaryFileEntry.bytes })
  };
};

const createCurrentSessionVerificationReport = (input: {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly binaryFileEntry: PackageBinaryFileEntry;
}): PackageBinaryAssetVerificationReport => {
  const issues: PackageBinaryAssetVerificationIssue[] = [];
  const actualByteLength = input.binaryFileEntry.bytes.byteLength;

  if (
    input.binaryFileEntry.binaryAssetId !== undefined &&
    input.binaryFileEntry.binaryAssetId !== input.binaryAssetRef.binaryAssetId
  ) {
    issues.push(createCurrentSessionVerificationIssue({
      code: "binary.assetId.mismatch",
      binaryAssetRef: input.binaryAssetRef,
      expected: input.binaryAssetRef.binaryAssetId,
      actual: input.binaryFileEntry.binaryAssetId,
      message: `Binary asset id mismatch for "${input.binaryAssetRef.packageRelativePath}"`
    }));
  }

  if (actualByteLength !== input.binaryAssetRef.byteLength) {
    issues.push(createCurrentSessionVerificationIssue({
      code: "binary.byteLength.mismatch",
      binaryAssetRef: input.binaryAssetRef,
      expected: String(input.binaryAssetRef.byteLength),
      actual: String(actualByteLength),
      message: `Binary byte length mismatch for "${input.binaryAssetRef.packageRelativePath}"`
    }));
  }

  if (input.binaryFileEntry.mediaType !== input.binaryAssetRef.mediaType) {
    issues.push(createCurrentSessionVerificationIssue({
      code: "binary.mediaType.mismatch",
      binaryAssetRef: input.binaryAssetRef,
      expected: input.binaryAssetRef.mediaType,
      actual: input.binaryFileEntry.mediaType,
      message: `Binary media type mismatch for "${input.binaryAssetRef.packageRelativePath}"`
    }));
  }

  return {
    status: issues.length === 0 ? "pass" : "fail",
    binaryAssetId: input.binaryAssetRef.binaryAssetId,
    packageRelativePath: input.binaryAssetRef.packageRelativePath,
    expectedByteLength: input.binaryAssetRef.byteLength,
    expectedDigest: input.binaryAssetRef.digest,
    expectedMediaType: input.binaryAssetRef.mediaType,
    actualByteLength,
    actualDigest: input.binaryAssetRef.digest,
    actualMediaType: input.binaryFileEntry.mediaType,
    issues
  };
};

const createCurrentSessionVerificationIssue = (input: {
  readonly code: PackageBinaryAssetVerificationIssue["code"];
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly expected: string;
  readonly actual: string;
  readonly message: string;
}): PackageBinaryAssetVerificationIssue => ({
  code: input.code,
  binaryAssetId: input.binaryAssetRef.binaryAssetId,
  path: input.binaryAssetRef.packageRelativePath,
  expected: input.expected,
  actual: input.actual,
  message: input.message
});

const createByteIntakePreflightAssetForSummaryTarget = (input: {
  readonly summary: PackageBinaryByteIntakeSummaryDto;
  readonly binaryAssetEntry: BinaryAssetIndexFileDto["assets"][number] | undefined;
}): ByteIntakeAssetPreflightInput => {
  if (input.binaryAssetEntry?.sourceAssetId !== undefined) {
    return createSourceByteIntakePreflightAsset({
      sourceAssetId: input.binaryAssetEntry.sourceAssetId,
      byteIntakeSummary: input.summary,
      fileMediaType: input.summary.mediaType
    });
  }

  return {
    intakeSummary: input.summary,
    fileMediaType: input.summary.mediaType,
    targetKind: input.binaryAssetEntry?.textureId === undefined ? "package" : "texture",
    targetId: input.binaryAssetEntry?.textureId ?? input.summary.binaryAssetId,
    targetPath: `/assets/binaryAssetIndex/assets/${input.summary.binaryAssetId}`,
    unsupportedClaims: createUnsupportedByteIntakeClaims()
  };
};

const findDocumentBinaryAssetRef = (
  packageDocument: PackageDocumentDto,
  summary: PackageBinaryByteIntakeSummaryDto
): BinaryAssetReferenceDto | undefined => {
  for (const sourceAsset of packageDocument.assets.sourceManifest.sourceAssets) {
    if (isSummaryTargetRef(sourceAsset.binaryAssetRef, summary)) {
      return sourceAsset.binaryAssetRef;
    }
  }

  for (const texture of packageDocument.assets.textureAtlas?.textures ?? []) {
    if (isSummaryTargetRef(texture.binaryAssetRef, summary)) {
      return texture.binaryAssetRef;
    }
  }

  return undefined;
};

const isSummaryTargetRef = (
  ref: BinaryAssetReferenceDto | undefined,
  summary: PackageBinaryByteIntakeSummaryDto
): ref is BinaryAssetReferenceDto =>
  ref !== undefined &&
  ref.binaryAssetId === summary.binaryAssetId &&
  ref.packageRelativePath === summary.packageRelativePath;

const createBinaryAssetReferenceFromSummary = (
  summary: PackageBinaryByteIntakeSummaryDto
): BinaryAssetReferenceDto => BinaryAssetReferenceSchema.parse({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: summary.binaryAssetId,
  packageRelativePath: summary.packageRelativePath,
  digest: summary.digest,
  byteLength: summary.byteLength,
  mediaType: summary.mediaType,
  storageStatus: summary.storageStatus,
  provenanceId: summary.provenanceId,
  rightsAssetId: summary.rightsAssetId
});

const mapAvailabilityReportToByteIntakeBytesAvailability = (
  report: PackageBinaryByteAvailabilityReportDto
): NonNullable<ByteIntakeAssetPreflightInput["bytesAvailability"]> => {
  switch (report.availability) {
    case "available-current-session-bytes-v1":
    case "available-current-session-metadata-mismatch-v1":
    case "verification-unsupported-v1":
      return "available";
    case "requires-reupload-v1":
    case "stale-verified-summary-v1":
      return "requiresReupload";
    case "missing-current-session-bytes-v1":
      return "missing";
  }
};

const createBinaryAssetRefKey = (
  binaryAssetId: string,
  packageRelativePath: string
): string => `${binaryAssetId}\n${packageRelativePath}`;
