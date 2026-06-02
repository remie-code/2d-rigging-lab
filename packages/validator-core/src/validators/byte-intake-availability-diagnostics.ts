import {
  BinaryAssetReferenceSchema,
  PackageBinaryByteVerifiedSummarySnapshotSchema,
  evaluatePackageBinaryCurrentSessionByteAvailability,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto,
  type BinaryAssetStorageStatusDto,
  type PackageBinaryByteAvailabilityIssueDto,
  type PackageBinaryByteAvailabilityReportDto,
  type PackageBinaryByteVerifiedSummarySnapshotDto
} from "@private-2d-rigging-lab/package-format";
import type { TargetKind } from "@private-2d-rigging-lab/contracts";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import type { ByteIntakeAssetPreflightInput } from "./byte-intake-preflight.js";

export interface ByteIntakeAvailabilityTarget {
  readonly asset: ByteIntakeAssetPreflightInput;
  readonly assetIndex: number;
  readonly packageId?: string;
  readonly packageRevision?: number;
  readonly targetKind: Extract<TargetKind, "package" | "sourceAsset" | "texture">;
  readonly targetId: string;
  readonly targetPath: string;
}

export interface ByteIntakeAvailabilityValidationResult {
  readonly report: PackageBinaryByteAvailabilityReportDto;
  readonly checks: readonly ValidationCheckResultDto[];
}

export const createByteIntakeAvailabilityValidationResult = (
  target: ByteIntakeAvailabilityTarget
): ByteIntakeAvailabilityValidationResult | undefined => {
  const report = createByteAvailabilityReport(target);

  if (report === undefined) {
    return undefined;
  }

  return {
    report,
    checks: report.issues.map((issue) =>
      createByteAvailabilityIssueCheck(target, report, issue)
    )
  };
};

const createByteAvailabilityReport = (
  target: ByteIntakeAvailabilityTarget
): PackageBinaryByteAvailabilityReportDto | undefined => {
  if (target.packageId === undefined || target.packageRevision === undefined) {
    return undefined;
  }

  const binaryAssetRef = getBinaryAssetRef(target.asset);
  if (binaryAssetRef === undefined) {
    return undefined;
  }

  const verifiedSummary = getVerifiedSummary(target);

  return evaluatePackageBinaryCurrentSessionByteAvailability({
    packageId: target.packageId,
    packageRevision: target.packageRevision,
    binaryAssetRef,
    ...(target.asset.currentSessionVerificationReport === undefined
      ? {}
      : { currentSessionVerificationReport: target.asset.currentSessionVerificationReport }),
    ...(verifiedSummary === undefined ? {} : { verifiedSummary }),
    requiresReupload: target.asset.requiresReupload === true ||
      target.asset.bytesAvailability === "requiresReupload"
  });
};

const createByteAvailabilityIssueCheck = (
  target: ByteIntakeAvailabilityTarget,
  report: PackageBinaryByteAvailabilityReportDto,
  issue: PackageBinaryByteAvailabilityIssueDto
): ValidationCheckResultDto => {
  const digestUnsupported = issue.code === "byteAvailability.digest.unsupported";

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
      `availability=${report.availability}`,
      `availabilityStatus=${report.status}`,
      `currentSessionBytes=${report.currentSessionBytes}`,
      `currentSessionVerificationStatus=${report.currentSessionVerificationStatus}`,
      `requiresReupload=${report.requiresReupload}`,
      `verifiedSummaryStatus=${report.verifiedSummaryStatus}`,
      `availabilityIssueCode=${issue.code}`,
      `availabilityIssueSource=${issue.source}`,
      `availabilityIssueTargetPath=${issue.targetPath}`,
      `expected=${issue.expected}`,
      `actual=${issue.actual}`,
      `packageId=${report.packageId}`,
      `packageRevision=${report.packageRevision}`,
      `expectedDigest=${formatDigest(report.expectedDigest)}`,
      `actualDigest=${formatDigest(report.actualDigest)}`,
      `expectedByteLength=${report.expectedByteLength}`,
      `actualByteLength=${report.actualByteLength ?? "missing"}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: digestUnsupported
      ? "The validator could not prove current-session byte digest truthfulness without SHA-256 support."
      : "The validator cannot treat byte-intake metadata as current-session bytes until the caller supplies matching current-session byte evidence."
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

const getVerifiedSummary = (
  target: ByteIntakeAvailabilityTarget
): PackageBinaryByteVerifiedSummarySnapshotDto | undefined => {
  if (target.asset.verifiedSummary !== undefined) {
    return target.asset.verifiedSummary;
  }

  if (
    target.packageId === undefined ||
    target.packageRevision === undefined ||
    target.asset.intakeSummary === undefined
  ) {
    return undefined;
  }

  return PackageBinaryByteVerifiedSummarySnapshotSchema.parse({
    schemaVersion: "package-binary-byte-verified-summary-snapshot-v1",
    packageId: target.packageId,
    packageRevision: target.packageRevision,
    summary: target.asset.intakeSummary
  });
};

const createTarget = (target: ByteIntakeAvailabilityTarget) => ({
  kind: target.targetKind,
  id: target.targetId,
  path: target.targetPath
});

const createByteIntakeAssetEvidence = (
  target: ByteIntakeAvailabilityTarget
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
  "referenceSource=byteIntake.preflight"
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

const getStorageStatus = (asset: ByteIntakeAssetPreflightInput): BinaryAssetStorageStatusDto | undefined =>
  asset.storageStatus ?? asset.binaryAssetRef?.storageStatus ?? asset.intakeSummary?.storageStatus;

const getProvenanceId = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.provenanceId ?? asset.binaryAssetRef?.provenanceId ?? asset.intakeSummary?.provenanceId;

const getRightsAssetId = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.rightsAssetId ?? asset.binaryAssetRef?.rightsAssetId ?? asset.intakeSummary?.rightsAssetId;

const getSourceFilename = (asset: ByteIntakeAssetPreflightInput): string | undefined =>
  asset.sourceFilename ?? asset.intakeSummary?.filename;

const formatDigest = (digest: BinaryAssetDigestDto | undefined): string =>
  digest === undefined ? "missing" : `${digest.algorithm}:${digest.hex}`;
