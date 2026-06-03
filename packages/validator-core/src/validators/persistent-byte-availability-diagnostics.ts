import {
  BinaryAssetReferenceSchema,
  evaluatePackageBinaryPersistentByteAvailability,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto,
  type BinaryAssetStorageStatusDto,
  type PackageBinaryAssetVerificationReport,
  type PackageBinaryPersistentByteAvailabilityIssueDto,
  type PackageBinaryPersistentByteAvailabilityReportDto,
  type PackageBinaryPersistentByteRecordDto,
  type PackageBinaryPersistentStorageBackendDto,
  type PackageBinaryPersistentStorageBackendStateDto
} from "@private-2d-rigging-lab/package-format";
import type { TargetKind } from "@private-2d-rigging-lab/contracts";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import type { ByteIntakeAssetPreflightInput } from "./byte-intake-preflight.js";

export interface PersistentByteAvailabilityTarget {
  readonly asset: ByteIntakeAssetPreflightInput;
  readonly assetIndex: number;
  readonly packageId?: string;
  readonly packageRevision?: number;
  readonly targetKind: Extract<TargetKind, "package" | "sourceAsset" | "texture">;
  readonly targetId: string;
  readonly targetPath: string;
}

export interface PersistentByteAvailabilityValidationResult {
  readonly report: PackageBinaryPersistentByteAvailabilityReportDto;
  readonly checks: readonly ValidationCheckResultDto[];
}

export const createPersistentByteAvailabilityValidationResult = (
  target: PersistentByteAvailabilityTarget
): PersistentByteAvailabilityValidationResult | undefined => {
  const report = createPersistentByteAvailabilityReport(target);

  if (report === undefined) {
    return undefined;
  }

  return {
    report,
    checks: report.issues.map((issue) =>
      createPersistentByteAvailabilityIssueCheck(target, report, issue)
    )
  };
};

const createPersistentByteAvailabilityReport = (
  target: PersistentByteAvailabilityTarget
): PackageBinaryPersistentByteAvailabilityReportDto | undefined => {
  if (
    !hasPersistentStorageEvidence(target.asset) ||
    target.packageId === undefined ||
    target.packageRevision === undefined
  ) {
    return undefined;
  }

  const binaryAssetRef = getBinaryAssetRef(target.asset);
  if (binaryAssetRef === undefined) {
    return undefined;
  }

  return evaluatePackageBinaryPersistentByteAvailability({
    packageId: target.packageId,
    packageRevision: target.packageRevision,
    binaryAssetRef,
    ...(target.asset.persistentStorageBackend === undefined
      ? {}
      : { storageBackend: target.asset.persistentStorageBackend }),
    ...(target.asset.persistentStorageBackendState === undefined
      ? {}
      : { storageBackendState: target.asset.persistentStorageBackendState }),
    ...(target.asset.persistentStoredRecord === undefined
      ? {}
      : { storedRecord: target.asset.persistentStoredRecord }),
    ...(target.asset.persistentVerificationReport === undefined
      ? {}
      : { persistentVerificationReport: target.asset.persistentVerificationReport })
  });
};

const hasPersistentStorageEvidence = (
  asset: ByteIntakeAssetPreflightInput
): boolean =>
  asset.persistentStorageExpected === true ||
  asset.persistentStorageBackend !== undefined ||
  asset.persistentStorageBackendState !== undefined ||
  asset.persistentStoredRecord !== undefined ||
  asset.persistentVerificationReport !== undefined;

const createPersistentByteAvailabilityIssueCheck = (
  target: PersistentByteAvailabilityTarget,
  report: PackageBinaryPersistentByteAvailabilityReportDto,
  issue: PackageBinaryPersistentByteAvailabilityIssueDto
): ValidationCheckResultDto => {
  const digestUnsupported = issue.code === "persistentByteStorage.digest.unsupported";

  return ValidationCheckResultSchema.parse({
    checkId: issue.code,
    status: digestUnsupported ? "needs_review" : "fail",
    severity: digestUnsupported ? "warning" : "error",
    phase: "reference",
    target: createTarget(target),
    targetPath: target.targetPath,
    message: issue.message,
    evidence: [
      ...createByteIntakeAssetEvidence(target),
      `persistentAvailability=${report.availability}`,
      `persistentAvailabilityStatus=${report.status}`,
      `persistentStorageBackend=${report.storageBackend}`,
      `persistentStorageBackendState=${report.storageBackendState}`,
      `persistentRecordStatus=${report.recordStatus}`,
      `persistentVerificationStatus=${report.persistentVerificationStatus}`,
      `persistentRequiresReupload=${report.requiresReupload}`,
      `persistentIssueCode=${issue.code}`,
      `persistentIssueSource=${issue.source}`,
      `persistentIssueTargetPath=${issue.targetPath}`,
      `expected=${issue.expected}`,
      `actual=${issue.actual}`,
      `packageId=${report.packageId}`,
      `packageRevision=${report.packageRevision}`,
      `expectedDigest=${formatDigest(report.expectedDigest)}`,
      `actualDigest=${formatDigest(report.actualDigest)}`,
      `expectedByteLength=${report.expectedByteLength}`,
      `actualByteLength=${report.actualByteLength ?? "missing"}`,
      `expectedMediaType=${report.expectedMediaType}`,
      `actualMediaType=${report.actualMediaType ?? "missing"}`,
      `storedAt=${report.storedAt ?? "missing"}`,
      `verifiedAt=${report.verifiedAt ?? "missing"}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: digestUnsupported
      ? "The validator could not prove browser-local persistent byte digest truthfulness without SHA-256 support."
      : "The validator cannot treat browser-local persistent bytes as available until stored byte evidence matches package identity, revision, binary reference, digest, length, and media type."
  });
};

const getBinaryAssetRef = (
  asset: ByteIntakeAssetPreflightInput
): BinaryAssetReferenceDto | undefined => {
  if (asset.binaryAssetRef !== undefined) {
    return BinaryAssetReferenceSchema.parse(asset.binaryAssetRef);
  }

  const binaryAssetId = getBinaryAssetId(asset);
  const packageRelativePath = getPackageRelativePath(asset);
  const digest = getExpectedDigest(asset);
  const byteLength = getExpectedByteLength(asset);
  const mediaType = getDeclaredMediaType(asset);
  const storageStatus = getStorageStatus(asset);
  const provenanceId = getProvenanceId(asset);
  const rightsAssetId = getRightsAssetId(asset);

  if (
    binaryAssetId === "byte-intake-asset" ||
    packageRelativePath === "missing" ||
    digest === undefined ||
    byteLength === undefined ||
    mediaType === undefined ||
    storageStatus === undefined ||
    provenanceId === undefined ||
    rightsAssetId === undefined
  ) {
    return undefined;
  }

  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId,
    packageRelativePath,
    digest,
    byteLength,
    mediaType,
    storageStatus,
    provenanceId,
    rightsAssetId
  });
};

const createTarget = (target: PersistentByteAvailabilityTarget) => ({
  kind: target.targetKind,
  id: target.targetId,
  path: target.targetPath
});

const createByteIntakeAssetEvidence = (
  target: PersistentByteAvailabilityTarget
): readonly string[] => [
  `binaryAssetId=${getBinaryAssetId(target.asset)}`,
  `packageRelativePath=${getPackageRelativePath(target.asset)}`,
  `byteIntakeAssetIndex=${target.assetIndex}`,
  `byteLength=${getExpectedByteLength(target.asset) ?? "missing"}`,
  `mediaType=${getDeclaredMediaType(target.asset) ?? "missing"}`,
  `fileMediaType=${target.asset.fileMediaType ?? "missing"}`,
  `digest=${formatDigest(getExpectedDigest(target.asset))}`,
  `provenanceId=${getProvenanceId(target.asset) ?? "missing"}`,
  `rightsAssetId=${getRightsAssetId(target.asset) ?? "missing"}`,
  `sourceFilename=${getSourceFilename(target.asset) ?? "missing"}`,
  `summaryAvailability=${target.asset.intakeSummary?.availability ?? "missing"}`,
  `summaryVerificationStatus=${target.asset.intakeSummary?.verificationStatus ?? "missing"}`,
  "referenceSource=byteIntake.persistentStorage"
];

const getBinaryAssetId = (asset: ByteIntakeAssetPreflightInput): string =>
  asset.binaryAssetId ??
  asset.binaryAssetRef?.binaryAssetId ??
  asset.intakeSummary?.binaryAssetId ??
  "byte-intake-asset";

const getPackageRelativePath = (asset: ByteIntakeAssetPreflightInput): string =>
  asset.packageRelativePath ??
  asset.binaryAssetRef?.packageRelativePath ??
  asset.intakeSummary?.packageRelativePath ??
  "missing";

const getExpectedDigest = (
  asset: ByteIntakeAssetPreflightInput
): BinaryAssetDigestDto | undefined =>
  asset.digest ?? asset.binaryAssetRef?.digest ?? asset.intakeSummary?.digest;

const getExpectedByteLength = (asset: ByteIntakeAssetPreflightInput): number | undefined =>
  asset.byteLength ?? asset.binaryAssetRef?.byteLength ?? asset.intakeSummary?.byteLength;

const getDeclaredMediaType = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.mediaType ?? asset.binaryAssetRef?.mediaType ?? asset.intakeSummary?.mediaType;

const getStorageStatus = (
  asset: ByteIntakeAssetPreflightInput
): BinaryAssetStorageStatusDto | undefined =>
  asset.storageStatus ?? asset.binaryAssetRef?.storageStatus ?? asset.intakeSummary?.storageStatus;

const getProvenanceId = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.provenanceId ?? asset.binaryAssetRef?.provenanceId ?? asset.intakeSummary?.provenanceId;

const getRightsAssetId = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.rightsAssetId ?? asset.binaryAssetRef?.rightsAssetId ?? asset.intakeSummary?.rightsAssetId;

const getSourceFilename = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.sourceFilename ?? asset.intakeSummary?.filename;

const formatDigest = (digest: BinaryAssetDigestDto | undefined): string =>
  digest === undefined ? "missing" : `${digest.algorithm}:${digest.hex}`;

export type PersistentByteAvailabilityPreflightFields = {
  readonly persistentStorageExpected?: boolean;
  readonly persistentStorageBackend?: PackageBinaryPersistentStorageBackendDto;
  readonly persistentStorageBackendState?: PackageBinaryPersistentStorageBackendStateDto;
  readonly persistentStoredRecord?: PackageBinaryPersistentByteRecordDto;
  readonly persistentVerificationReport?: PackageBinaryAssetVerificationReport;
};
