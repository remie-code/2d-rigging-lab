import type {
  BinaryAssetEntryDto,
  BinaryAssetIndexFileDto,
  BinaryAssetReferenceDto,
  PackageBinaryAssetVerificationIssue,
  PackageBinaryAssetVerificationReport,
  PackageDocumentDto,
  PackageInMemoryFileSet,
  ProvenanceRecordDto,
  RightsRecordDto,
  SourceAssetDto,
  TextureAtlasEntryDto
} from "@private-2d-rigging-lab/package-format";
import { verifyPackageBinaryAssetBytes } from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export interface BinaryAssetReferenceValidationInput {
  readonly packageDocument: PackageDocumentDto;
  readonly binaryFileSet?: PackageInMemoryFileSet;
  readonly binaryAssetIndex?: BinaryAssetIndexFileDto;
}

type BinaryAssetValidationAsset = BinaryAssetReferenceDto | BinaryAssetEntryDto;

interface BinaryAssetIndexes {
  readonly sourceAssetsById: ReadonlyMap<string, SourceAssetDto>;
  readonly textureEntriesById: ReadonlyMap<string, TextureAtlasEntryWithIndex>;
  readonly provenanceById: ReadonlyMap<string, ProvenanceRecordDto>;
  readonly rightsByAssetId: ReadonlyMap<string, RightsRecordDto>;
}

interface TextureAtlasEntryWithIndex {
  readonly entry: TextureAtlasEntryDto;
  readonly index: number;
}

interface BinaryAssetValidationTarget {
  readonly asset: BinaryAssetValidationAsset;
  readonly referenceSource: string;
  readonly targetKind: "package" | "sourceAsset" | "texture";
  readonly targetId: string;
  readonly targetPath: string;
  readonly ownerEvidence: readonly string[];
  readonly sourceAsset?: SourceAssetDto;
  readonly textureEntry?: TextureAtlasEntryDto;
}

interface BinaryAssetReferenceMismatchInput {
  readonly target: BinaryAssetValidationTarget;
  readonly reason: string;
  readonly expected: string;
  readonly actual: string;
}

export const validatePackageBinaryAssets = async (
  input: BinaryAssetReferenceValidationInput
): Promise<readonly ValidationCheckResultDto[]> => {
  const indexes = createBinaryAssetIndexes(input.packageDocument);
  const fileSet = input.binaryFileSet ?? [];
  const targets = collectBinaryAssetTargets(input.packageDocument, input.binaryAssetIndex);
  const checks: ValidationCheckResultDto[] = [];

  for (const target of targets) {
    checks.push(...validateBinaryAssetRightsAndProvenance(target, indexes));
    checks.push(...validateBinaryAssetOwnerConsistency(target, indexes));

    if (target.asset.storageStatus !== "stored-package-local-v1") {
      checks.push(createStorageStatusMissingBytesCheck(target));
      continue;
    }

    const verificationReport = await verifyPackageBinaryAssetBytes(fileSet, target.asset);
    checks.push(...verificationReport.issues.map((issue) =>
      createVerificationIssueCheck(target, verificationReport, issue)
    ));
  }

  return checks;
};

const createBinaryAssetIndexes = (packageDocument: PackageDocumentDto): BinaryAssetIndexes => ({
  sourceAssetsById: new Map(
    packageDocument.assets.sourceManifest.sourceAssets.map((sourceAsset) => [
      sourceAsset.sourceAssetId,
      sourceAsset
    ])
  ),
  textureEntriesById: new Map(
    packageDocument.assets.textureAtlas?.textures.map((entry, index) => [
      entry.textureId,
      { entry, index }
    ]) ?? []
  ),
  provenanceById: new Map(
    packageDocument.assets.provenance.records.map((record) => [
      record.provenanceId,
      record
    ])
  ),
  rightsByAssetId: new Map(
    packageDocument.assets.rights.records.map((record) => [
      record.assetId,
      record
    ])
  )
});

const collectBinaryAssetTargets = (
  packageDocument: PackageDocumentDto,
  binaryAssetIndex: BinaryAssetIndexFileDto | undefined
): readonly BinaryAssetValidationTarget[] => [
  ...collectSourceBinaryAssetTargets(packageDocument),
  ...collectTextureBinaryAssetTargets(packageDocument),
  ...collectBinaryAssetIndexTargets(binaryAssetIndex)
];

const collectSourceBinaryAssetTargets = (
  packageDocument: PackageDocumentDto
): readonly BinaryAssetValidationTarget[] =>
  packageDocument.assets.sourceManifest.sourceAssets.flatMap((sourceAsset, sourceAssetIndex) => {
    if (sourceAsset.binaryAssetRef === undefined) {
      return [];
    }

    const targetPath = `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}/binaryAssetRef`;

    return [{
      asset: sourceAsset.binaryAssetRef,
      referenceSource: "sourceAsset.binaryAssetRef",
      targetKind: "sourceAsset",
      targetId: sourceAsset.sourceAssetId,
      targetPath,
      sourceAsset,
      ownerEvidence: [
        `sourceAssetId=${sourceAsset.sourceAssetId}`,
        `sourceKind=${sourceAsset.kind}`,
        `sourceFilePath=${sourceAsset.filePath}`
      ]
    }];
  });

const collectTextureBinaryAssetTargets = (
  packageDocument: PackageDocumentDto
): readonly BinaryAssetValidationTarget[] =>
  packageDocument.assets.textureAtlas?.textures.flatMap((textureEntry, textureIndex) => {
    if (textureEntry.binaryAssetRef === undefined) {
      return [];
    }

    const targetPath = `/assets/textureAtlas/textures/${textureIndex}/binaryAssetRef`;

    return [{
      asset: textureEntry.binaryAssetRef,
      referenceSource: "textureAtlas.textures.binaryAssetRef",
      targetKind: "texture",
      targetId: textureEntry.textureId,
      targetPath,
      textureEntry,
      ownerEvidence: [
        `textureId=${textureEntry.textureId}`,
        `textureFilePath=${textureEntry.filePath}`,
        `textureProvenanceId=${textureEntry.provenanceId ?? "missing"}`
      ]
    }];
  }) ?? [];

const collectBinaryAssetIndexTargets = (
  binaryAssetIndex: BinaryAssetIndexFileDto | undefined
): readonly BinaryAssetValidationTarget[] =>
  binaryAssetIndex?.assets.map((entry, entryIndex) => ({
    asset: entry,
    referenceSource: "binaryAssetIndex.assets",
    targetKind: entry.textureId === undefined
      ? entry.sourceAssetId === undefined ? "package" : "sourceAsset"
      : "texture",
    targetId: entry.textureId ?? entry.sourceAssetId ?? entry.binaryAssetId,
    targetPath: `/assets/binaryAssetIndex/assets/${entryIndex}`,
    ownerEvidence: [
      `binaryAssetEntryIndex=${entryIndex}`,
      `binaryAssetRole=${entry.role}`,
      `sourceAssetId=${entry.sourceAssetId ?? "missing"}`,
      `textureId=${entry.textureId ?? "missing"}`
    ]
  })) ?? [];

const validateBinaryAssetRightsAndProvenance = (
  target: BinaryAssetValidationTarget,
  indexes: BinaryAssetIndexes
): readonly ValidationCheckResultDto[] => {
  const provenanceRecord = indexes.provenanceById.get(target.asset.provenanceId);
  const rightsRecord = indexes.rightsByAssetId.get(target.asset.rightsAssetId);
  const checks: ValidationCheckResultDto[] = [];

  if (provenanceRecord === undefined) {
    checks.push(createBinaryProvenanceMissingCheck(target));
  }

  if (rightsRecord === undefined) {
    checks.push(createBinaryRightsMissingCheck(target));
  }

  if (
    provenanceRecord !== undefined &&
    rightsRecord !== undefined &&
    provenanceRecord.assetId !== target.asset.rightsAssetId
  ) {
    checks.push(createBinaryProvenanceMismatchCheck(target, provenanceRecord));
  }

  return checks;
};

const validateBinaryAssetOwnerConsistency = (
  target: BinaryAssetValidationTarget,
  indexes: BinaryAssetIndexes
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  if (target.sourceAsset !== undefined) {
    pushMismatchIfDifferent(checks, {
      target,
      reason: "source-binary-path-mismatch",
      expected: target.sourceAsset.filePath,
      actual: target.asset.packageRelativePath
    });
  }

  if (target.textureEntry !== undefined) {
    checks.push(...validateTextureEntryBinaryAssetConsistency(target));
  }

  if (!("referenceKind" in target.asset)) {
    checks.push(...validateBinaryAssetEntryOwnerConsistency(target, indexes));
  }

  return checks;
};

const validateTextureEntryBinaryAssetConsistency = (
  target: BinaryAssetValidationTarget
): readonly ValidationCheckResultDto[] => {
  const textureEntry = target.textureEntry;
  if (textureEntry === undefined) {
    return [];
  }

  const checks: ValidationCheckResultDto[] = [];

  pushMismatchIfDifferent(checks, {
    target,
    reason: "texture-binary-path-mismatch",
    expected: textureEntry.filePath,
    actual: target.asset.packageRelativePath
  });

  if (textureEntry.provenanceId !== undefined) {
    pushMismatchIfDifferent(checks, {
      target,
      reason: "texture-binary-provenance-mismatch",
      expected: textureEntry.provenanceId,
      actual: target.asset.provenanceId
    });
  }

  return checks;
};

const validateBinaryAssetEntryOwnerConsistency = (
  target: BinaryAssetValidationTarget,
  indexes: BinaryAssetIndexes
): readonly ValidationCheckResultDto[] => {
  const entry = target.asset;
  const checks: ValidationCheckResultDto[] = [];

  if ("referenceKind" in entry) {
    return checks;
  }

  if (entry.sourceAssetId !== undefined) {
    const sourceAsset = indexes.sourceAssetsById.get(entry.sourceAssetId);

    if (sourceAsset === undefined) {
      checks.push(createReferenceMismatchCheck({
        target,
        reason: "binary-index-source-asset-missing",
        expected: entry.sourceAssetId,
        actual: "missing"
      }));
    } else if (entry.textureId === undefined) {
      pushMismatchIfDifferent(checks, {
        target,
        reason: "binary-index-source-path-mismatch",
        expected: sourceAsset.filePath,
        actual: entry.packageRelativePath
      });

      if (sourceAsset.binaryAssetRef !== undefined) {
        pushMismatchIfDifferent(checks, {
          target,
          reason: "binary-index-source-ref-id-mismatch",
          expected: sourceAsset.binaryAssetRef.binaryAssetId,
          actual: entry.binaryAssetId
        });
      }
    }
  }

  if (entry.textureId !== undefined) {
    const textureEntry = indexes.textureEntriesById.get(entry.textureId)?.entry;

    if (textureEntry === undefined) {
      checks.push(createReferenceMismatchCheck({
        target,
        reason: "binary-index-texture-missing",
        expected: entry.textureId,
        actual: "missing"
      }));
    } else {
      pushMismatchIfDifferent(checks, {
        target,
        reason: "binary-index-texture-path-mismatch",
        expected: textureEntry.filePath,
        actual: entry.packageRelativePath
      });

      if (textureEntry.binaryAssetRef !== undefined) {
        pushMismatchIfDifferent(checks, {
          target,
          reason: "binary-index-texture-ref-id-mismatch",
          expected: textureEntry.binaryAssetRef.binaryAssetId,
          actual: entry.binaryAssetId
        });
      }
    }
  }

  return checks;
};

const pushMismatchIfDifferent = (
  checks: ValidationCheckResultDto[],
  input: BinaryAssetReferenceMismatchInput
): void => {
  if (input.expected !== input.actual) {
    checks.push(createReferenceMismatchCheck(input));
  }
};

const createStorageStatusMissingBytesCheck = (
  target: BinaryAssetValidationTarget
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "binary.bytesMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Binary asset ${target.asset.binaryAssetId} has no available package-local bytes.`,
    evidence: [
      ...createBinaryAssetEvidence(target),
      "bytesAvailability=missing",
      `reason=storageStatus:${target.asset.storageStatus}`,
      "fileSetVerification=skipped"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "The package records binary asset metadata, but validator cannot verify local bytes, digest, length, or declared media type."
  });

const createVerificationIssueCheck = (
  target: BinaryAssetValidationTarget,
  report: PackageBinaryAssetVerificationReport,
  issue: PackageBinaryAssetVerificationIssue
): ValidationCheckResultDto => {
  const checkId = mapVerificationIssueCheckId(issue);
  const digestUnsupported = issue.code === "binary.digest.unsupported";

  return ValidationCheckResultSchema.parse({
    checkId,
    status: digestUnsupported ? "needs_review" : "fail",
    severity: digestUnsupported ? "warning" : "error",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: issue.message,
    evidence: [
      ...createBinaryAssetEvidence(target),
      `verificationIssueCode=${issue.code}`,
      `expected=${issue.expected}`,
      `actual=${issue.actual}`,
      `expectedByteLength=${report.expectedByteLength}`,
      `actualByteLength=${report.actualByteLength ?? "missing"}`,
      `expectedMediaType=${report.expectedMediaType}`,
      `actualMediaType=${report.actualMediaType ?? "missing"}`,
      `expectedDigest=${report.expectedDigest.algorithm}:${report.expectedDigest.hex}`,
      `actualDigest=${report.actualDigest === undefined ? "missing" : `${report.actualDigest.algorithm}:${report.actualDigest.hex}`}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: digestUnsupported
      ? "The validator could not verify the binary digest in this environment, so byte integrity remains unproven."
      : "The package-local bytes do not match the binary asset metadata recorded in the package."
  });
};

const createBinaryProvenanceMissingCheck = (
  target: BinaryAssetValidationTarget
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.binaryProvenanceMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Binary asset ${target.asset.binaryAssetId} references missing provenance ${target.asset.provenanceId}.`,
    evidence: [
      ...createBinaryAssetEvidence(target),
      `provenanceId=${target.asset.provenanceId}`,
      "provenanceIdMatch=missing"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "The validator cannot trace creator, license, AI use, or transform history for this binary asset."
  });

const createBinaryRightsMissingCheck = (
  target: BinaryAssetValidationTarget
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.binaryRightsMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Binary asset ${target.asset.binaryAssetId} references missing rights asset ${target.asset.rightsAssetId}.`,
    evidence: [
      ...createBinaryAssetEvidence(target),
      `rightsAssetId=${target.asset.rightsAssetId}`,
      "rightsAssetMatch=missing"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "The package cannot prove whether this binary asset is cleared, needs review, or blocked."
  });

const createBinaryProvenanceMismatchCheck = (
  target: BinaryAssetValidationTarget,
  provenanceRecord: ProvenanceRecordDto
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.binaryProvenanceMismatch",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: `Binary asset ${target.asset.binaryAssetId} provenance does not match its rights asset metadata.`,
    evidence: [
      ...createBinaryAssetEvidence(target),
      `provenanceId=${target.asset.provenanceId}`,
      `provenanceAssetId=${provenanceRecord.assetId}`,
      `rightsAssetId=${target.asset.rightsAssetId}`,
      "reason=provenance-rights-asset-mismatch"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "Binary asset rights and provenance cannot be trusted because the metadata points at different assets."
  });

const createReferenceMismatchCheck = (
  input: BinaryAssetReferenceMismatchInput
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "binary.referenceMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: createTarget(input.target),
    targetPath: input.target.targetPath,
    message: `Binary asset ${input.target.asset.binaryAssetId} reference metadata is inconsistent with its package owner.`,
    evidence: [
      ...createBinaryAssetEvidence(input.target),
      `expected=${input.expected}`,
      `actual=${input.actual}`,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "The binary asset cannot be traced deterministically to the source manifest, texture atlas, or binary asset index owner."
  });

const mapVerificationIssueCheckId = (
  issue: PackageBinaryAssetVerificationIssue
): string => {
  switch (issue.code) {
    case "binary.assetId.mismatch":
      return "binary.assetIdMismatch";
    case "binary.byteLength.mismatch":
      return "binary.byteLengthMismatch";
    case "binary.bytes.missing":
      return "binary.bytesMissing";
    case "binary.digest.mismatch":
      return "binary.digestMismatch";
    case "binary.digest.unsupported":
      return "binary.digestUnsupported";
    case "binary.mediaType.mismatch":
      return "binary.mediaTypeMismatch";
  }
};

const createTarget = (target: BinaryAssetValidationTarget) => ({
  kind: target.targetKind,
  id: target.targetId,
  path: target.targetPath
});

const createBinaryAssetEvidence = (
  target: BinaryAssetValidationTarget
): readonly string[] => [
  `binaryAssetId=${target.asset.binaryAssetId}`,
  `packageRelativePath=${target.asset.packageRelativePath}`,
  `storageStatus=${target.asset.storageStatus}`,
  `byteLength=${target.asset.byteLength}`,
  `mediaType=${target.asset.mediaType}`,
  `digest=${target.asset.digest.algorithm}:${target.asset.digest.hex}`,
  `provenanceId=${target.asset.provenanceId}`,
  `rightsAssetId=${target.asset.rightsAssetId}`,
  `referenceSource=${target.referenceSource}`,
  ...target.ownerEvidence
];
