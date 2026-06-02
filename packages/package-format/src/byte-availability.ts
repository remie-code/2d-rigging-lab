import { PackageIdSchema, type PackageId } from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetReferenceSchema,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto
} from "./binary-asset.js";
import {
  type PackageBinaryByteIntakeSummaryDto
} from "./byte-intake.js";
import {
  PackageBinaryByteAvailabilityIssueSchema,
  PackageBinaryByteAvailabilityReportSchema,
  PackageBinaryByteVerifiedSummarySnapshotSchema,
  PackageBinaryPackageRevisionSchema,
  type PackageBinaryByteAvailabilityIssueCodeDto,
  type PackageBinaryByteAvailabilityIssueDto,
  type PackageBinaryByteAvailabilityIssueSourceDto,
  type PackageBinaryByteAvailabilityReportDto,
  type PackageBinaryByteAvailabilityReportStatusDto,
  type PackageBinaryByteVerifiedSummarySnapshotDto,
  type PackageBinaryCurrentSessionBytesStateDto,
  type PackageBinaryCurrentSessionVerificationStatusDto,
  type PackageBinaryDirectCallByteAvailabilityDto,
  type PackageBinaryVerifiedSummaryStatusDto
} from "./byte-availability-contract.js";
import type {
  PackageBinaryAssetVerificationIssue,
  PackageBinaryAssetVerificationReport
} from "./package-binary-file-set.js";

export interface EvaluatePackageBinaryCurrentSessionByteAvailabilityInput {
  readonly packageId: PackageId | string;
  readonly packageRevision: number;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly currentSessionVerificationReport?: PackageBinaryAssetVerificationReport;
  readonly verifiedSummary?: PackageBinaryByteVerifiedSummarySnapshotDto;
  readonly requiresReupload?: boolean;
}

export function evaluatePackageBinaryCurrentSessionByteAvailability(
  input: EvaluatePackageBinaryCurrentSessionByteAvailabilityInput
): PackageBinaryByteAvailabilityReportDto {
  const packageId = PackageIdSchema.parse(input.packageId);
  const packageRevision = PackageBinaryPackageRevisionSchema.parse(input.packageRevision);
  const binaryAssetRef = BinaryAssetReferenceSchema.parse(input.binaryAssetRef);
  const verifiedSummary = input.verifiedSummary === undefined
    ? undefined
    : PackageBinaryByteVerifiedSummarySnapshotSchema.parse(input.verifiedSummary);
  const currentSessionBytes = getCurrentSessionBytesState(input.currentSessionVerificationReport);
  const requiresReupload = getRequiresReuploadState({
    binaryAssetRef,
    currentSessionBytes,
    currentSessionVerificationReport: input.currentSessionVerificationReport,
    callerRequiresReupload: input.requiresReupload
  });
  const issues = [
    ...createCurrentSessionIssues({
      binaryAssetRef,
      currentSessionBytes,
      currentSessionVerificationReport: input.currentSessionVerificationReport,
      requiresReupload
    }),
    ...createVerifiedSummaryIssues({
      packageId,
      packageRevision,
      binaryAssetRef,
      currentSessionVerificationReport: input.currentSessionVerificationReport,
      verifiedSummary
    })
  ];

  return PackageBinaryByteAvailabilityReportSchema.parse({
    schemaVersion: "package-binary-byte-availability-report-v1",
    packageId,
    packageRevision,
    binaryAssetId: binaryAssetRef.binaryAssetId,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    expectedDigest: binaryAssetRef.digest,
    expectedByteLength: binaryAssetRef.byteLength,
    currentSessionBytes,
    availability: deriveDirectCallByteAvailability({
      currentSessionBytes,
      requiresReupload,
      verifiedSummaryStatus: getVerifiedSummaryStatus(verifiedSummary, issues),
      issues
    }),
    requiresReupload,
    verifiedSummaryStatus: getVerifiedSummaryStatus(verifiedSummary, issues),
    currentSessionVerificationStatus: getCurrentSessionVerificationStatus(
      input.currentSessionVerificationReport
    ),
    status: getReportStatus(issues),
    ...(input.currentSessionVerificationReport?.actualDigest === undefined
      ? {}
      : { actualDigest: input.currentSessionVerificationReport.actualDigest }),
    ...(input.currentSessionVerificationReport?.actualByteLength === undefined
      ? {}
      : { actualByteLength: input.currentSessionVerificationReport.actualByteLength }),
    issues
  });
}

function getCurrentSessionBytesState(
  report: PackageBinaryAssetVerificationReport | undefined
): PackageBinaryCurrentSessionBytesStateDto {
  if (
    report === undefined ||
    report.issues.some((issue) => issue.code === "binary.bytes.missing")
  ) {
    return "missing-current-session-bytes-v1";
  }

  return "available-current-session-bytes-v1";
}

function getRequiresReuploadState(input: {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly currentSessionBytes: PackageBinaryCurrentSessionBytesStateDto;
  readonly currentSessionVerificationReport: PackageBinaryAssetVerificationReport | undefined;
  readonly callerRequiresReupload: boolean | undefined;
}): boolean {
  if (input.currentSessionBytes === "available-current-session-bytes-v1") {
    return false;
  }

  return input.callerRequiresReupload === true ||
    input.binaryAssetRef.storageStatus === "storage-unsupported-v1" ||
    input.currentSessionVerificationReport?.issues.some(
      (issue) => issue.code === "binary.bytes.missing"
    ) === true;
}

function createCurrentSessionIssues(input: {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly currentSessionBytes: PackageBinaryCurrentSessionBytesStateDto;
  readonly currentSessionVerificationReport: PackageBinaryAssetVerificationReport | undefined;
  readonly requiresReupload: boolean;
}): readonly PackageBinaryByteAvailabilityIssueDto[] {
  const issues: PackageBinaryByteAvailabilityIssueDto[] = [];

  if (input.currentSessionVerificationReport === undefined) {
    issues.push(createIssue({
      code: "byteAvailability.currentSessionBytes.missing",
      source: "current-session-verification-report-v1",
      targetPath: "/currentSessionVerificationReport",
      expected: "current-session-verification-report",
      actual: "missing",
      message: "Current-session bytes are not available without a byte verification report."
    }));
  } else {
    issues.push(
      ...createVerificationReportIdentityIssues(input.binaryAssetRef, input.currentSessionVerificationReport),
      ...input.currentSessionVerificationReport.issues.map(mapVerificationIssue)
    );
  }

  if (input.requiresReupload) {
    issues.push(createIssue({
      code: "byteAvailability.requiresReupload",
      source: "caller-reupload-state-v1",
      targetPath: "/requiresReupload",
      expected: "current-session-bytes",
      actual: "requires-reupload",
      message: "The caller must reupload the binary bytes before validation can treat them as available."
    }));
  }

  return issues;
}

function createVerificationReportIdentityIssues(
  binaryAssetRef: BinaryAssetReferenceDto,
  report: PackageBinaryAssetVerificationReport
): readonly PackageBinaryByteAvailabilityIssueDto[] {
  const issues: PackageBinaryByteAvailabilityIssueDto[] = [];

  if (
    report.binaryAssetId !== binaryAssetRef.binaryAssetId ||
    report.packageRelativePath !== binaryAssetRef.packageRelativePath
  ) {
    issues.push(createIssue({
      code: "byteAvailability.binaryAssetRef.mismatch",
      source: "current-session-verification-report-v1",
      targetPath: "/currentSessionVerificationReport/binaryAssetRef",
      expected: `${binaryAssetRef.binaryAssetId}@${binaryAssetRef.packageRelativePath}`,
      actual: `${report.binaryAssetId}@${report.packageRelativePath}`,
      message: "Current-session verification report does not target the requested binary ref."
    }));
  }

  if (
    report.expectedDigest.algorithm !== binaryAssetRef.digest.algorithm ||
    report.expectedDigest.hex !== binaryAssetRef.digest.hex
  ) {
    issues.push(createIssue({
      code: "byteAvailability.digest.mismatch",
      source: "current-session-verification-report-v1",
      targetPath: "/currentSessionVerificationReport/expectedDigest",
      expected: formatDigest(binaryAssetRef.digest),
      actual: formatDigest(report.expectedDigest),
      message: "Current-session verification report expected digest does not match the binary ref."
    }));
  }

  if (report.expectedByteLength !== binaryAssetRef.byteLength) {
    issues.push(createIssue({
      code: "byteAvailability.byteLength.mismatch",
      source: "current-session-verification-report-v1",
      targetPath: "/currentSessionVerificationReport/expectedByteLength",
      expected: String(binaryAssetRef.byteLength),
      actual: String(report.expectedByteLength),
      message: "Current-session verification report expected byte length does not match the binary ref."
    }));
  }

  if (report.expectedMediaType !== binaryAssetRef.mediaType) {
    issues.push(createIssue({
      code: "byteAvailability.mediaType.mismatch",
      source: "current-session-verification-report-v1",
      targetPath: "/currentSessionVerificationReport/expectedMediaType",
      expected: binaryAssetRef.mediaType,
      actual: report.expectedMediaType,
      message: "Current-session verification report expected media type does not match the binary ref."
    }));
  }

  return issues;
}

function mapVerificationIssue(
  issue: PackageBinaryAssetVerificationIssue
): PackageBinaryByteAvailabilityIssueDto {
  switch (issue.code) {
    case "binary.assetId.mismatch":
      return createIssue({
        code: "byteAvailability.binaryAssetRef.mismatch",
        source: "current-session-verification-report-v1",
        targetPath: "/currentSessionVerificationReport/issues/binaryAssetRef",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.byteLength.mismatch":
      return createIssue({
        code: "byteAvailability.byteLength.mismatch",
        source: "current-session-verification-report-v1",
        targetPath: "/currentSessionVerificationReport/issues/byteLength",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.bytes.missing":
      return createIssue({
        code: "byteAvailability.currentSessionBytes.missing",
        source: "current-session-verification-report-v1",
        targetPath: "/currentSessionVerificationReport/issues/bytes",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.digest.mismatch":
      return createIssue({
        code: "byteAvailability.digest.mismatch",
        source: "current-session-verification-report-v1",
        targetPath: "/currentSessionVerificationReport/issues/digest",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.digest.unsupported":
      return createIssue({
        code: "byteAvailability.digest.unsupported",
        source: "current-session-verification-report-v1",
        targetPath: "/currentSessionVerificationReport/issues/digest",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.mediaType.mismatch":
      return createIssue({
        code: "byteAvailability.mediaType.mismatch",
        source: "current-session-verification-report-v1",
        targetPath: "/currentSessionVerificationReport/issues/mediaType",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
  }
}

function createVerifiedSummaryIssues(input: {
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly currentSessionVerificationReport: PackageBinaryAssetVerificationReport | undefined;
  readonly verifiedSummary: PackageBinaryByteVerifiedSummarySnapshotDto | undefined;
}): readonly PackageBinaryByteAvailabilityIssueDto[] {
  if (input.verifiedSummary === undefined) {
    return [];
  }

  const issues: PackageBinaryByteAvailabilityIssueDto[] = [];
  const summary = input.verifiedSummary.summary;

  if (input.verifiedSummary.packageId !== input.packageId) {
    issues.push(createIssue({
      code: "byteAvailability.packageId.mismatch",
      source: "verified-summary-v1",
      targetPath: "/verifiedSummary/packageId",
      expected: input.packageId,
      actual: input.verifiedSummary.packageId,
      message: "Verified byte summary belongs to a different package identity."
    }));
  }

  if (input.verifiedSummary.packageRevision !== input.packageRevision) {
    issues.push(createIssue({
      code: "byteAvailability.packageRevision.mismatch",
      source: "verified-summary-v1",
      targetPath: "/verifiedSummary/packageRevision",
      expected: String(input.packageRevision),
      actual: String(input.verifiedSummary.packageRevision),
      message: "Verified byte summary belongs to a different package revision."
    }));
  }

  if (
    summary.binaryAssetId !== input.binaryAssetRef.binaryAssetId ||
    summary.packageRelativePath !== input.binaryAssetRef.packageRelativePath
  ) {
    issues.push(createIssue({
      code: "byteAvailability.binaryAssetRef.mismatch",
      source: "verified-summary-v1",
      targetPath: "/verifiedSummary/summary/binaryAssetRef",
      expected: `${input.binaryAssetRef.binaryAssetId}@${input.binaryAssetRef.packageRelativePath}`,
      actual: `${summary.binaryAssetId}@${summary.packageRelativePath}`,
      message: "Verified byte summary belongs to a different binary ref."
    }));
  }

  if (
    summary.digest.algorithm !== input.binaryAssetRef.digest.algorithm ||
    summary.digest.hex !== input.binaryAssetRef.digest.hex
  ) {
    issues.push(createIssue({
      code: "byteAvailability.digest.mismatch",
      source: "verified-summary-v1",
      targetPath: "/verifiedSummary/summary/digest",
      expected: formatDigest(input.binaryAssetRef.digest),
      actual: formatDigest(summary.digest),
      message: "Verified byte summary digest does not match the binary ref."
    }));
  }

  if (summary.byteLength !== input.binaryAssetRef.byteLength) {
    issues.push(createIssue({
      code: "byteAvailability.byteLength.mismatch",
      source: "verified-summary-v1",
      targetPath: "/verifiedSummary/summary/byteLength",
      expected: String(input.binaryAssetRef.byteLength),
      actual: String(summary.byteLength),
      message: "Verified byte summary byte length does not match the binary ref."
    }));
  }

  if (
    isVerifiedAvailableSummary(summary) &&
    input.currentSessionVerificationReport?.status !== "pass"
  ) {
    issues.push(createIssue({
      code: "byteAvailability.verifiedSummary.stale",
      source: "verified-summary-v1",
      targetPath: "/verifiedSummary/summary",
      expected: "current-session-verified-bytes",
      actual: input.currentSessionVerificationReport === undefined
        ? "missing-current-session-verification-report"
        : input.currentSessionVerificationReport.status,
      message: "Verified byte summary cannot stand in for current-session bytes."
    }));
  }

  return issues;
}

function getVerifiedSummaryStatus(
  verifiedSummary: PackageBinaryByteVerifiedSummarySnapshotDto | undefined,
  issues: readonly PackageBinaryByteAvailabilityIssueDto[]
): PackageBinaryVerifiedSummaryStatusDto {
  if (verifiedSummary === undefined) {
    return "not-supplied-v1";
  }

  return issues.some((issue) => issue.source === "verified-summary-v1")
    ? "stale-v1"
    : "current-v1";
}

function getCurrentSessionVerificationStatus(
  report: PackageBinaryAssetVerificationReport | undefined
): PackageBinaryCurrentSessionVerificationStatusDto {
  if (report === undefined) {
    return "not-supplied-v1";
  }

  switch (report.status) {
    case "pass":
      return "pass-v1";
    case "fail":
      return "fail-v1";
    case "unsupported":
      return "unsupported-v1";
  }
}

function deriveDirectCallByteAvailability(input: {
  readonly currentSessionBytes: PackageBinaryCurrentSessionBytesStateDto;
  readonly requiresReupload: boolean;
  readonly verifiedSummaryStatus: PackageBinaryVerifiedSummaryStatusDto;
  readonly issues: readonly PackageBinaryByteAvailabilityIssueDto[];
}): PackageBinaryDirectCallByteAvailabilityDto {
  if (
    input.currentSessionBytes === "missing-current-session-bytes-v1" &&
    input.requiresReupload
  ) {
    return "requires-reupload-v1";
  }

  if (input.verifiedSummaryStatus === "stale-v1") {
    return "stale-verified-summary-v1";
  }

  if (input.currentSessionBytes === "missing-current-session-bytes-v1") {
    return "missing-current-session-bytes-v1";
  }

  if (input.issues.some((issue) => issue.code === "byteAvailability.digest.unsupported")) {
    return "verification-unsupported-v1";
  }

  if (input.issues.length > 0) {
    return "available-current-session-metadata-mismatch-v1";
  }

  return "available-current-session-bytes-v1";
}

function getReportStatus(
  issues: readonly PackageBinaryByteAvailabilityIssueDto[]
): PackageBinaryByteAvailabilityReportStatusDto {
  const hasFailure = issues.some((issue) => issue.code !== "byteAvailability.digest.unsupported");
  const hasUnsupported = issues.some((issue) => issue.code === "byteAvailability.digest.unsupported");

  return hasFailure
    ? "fail-v1"
    : hasUnsupported
      ? "unsupported-v1"
      : "pass-v1";
}

function isVerifiedAvailableSummary(summary: PackageBinaryByteIntakeSummaryDto): boolean {
  return summary.verificationStatus === "verified-pass-v1" &&
    (
      summary.availability === "available-package-local-bytes-v1" ||
      summary.availability === "ephemeral-browser-file-v1"
    );
}

function createIssue(input: {
  readonly code: PackageBinaryByteAvailabilityIssueCodeDto;
  readonly source: PackageBinaryByteAvailabilityIssueSourceDto;
  readonly targetPath: string;
  readonly expected: string;
  readonly actual: string;
  readonly message: string;
}): PackageBinaryByteAvailabilityIssueDto {
  return PackageBinaryByteAvailabilityIssueSchema.parse(input);
}

function formatDigest(digest: BinaryAssetDigestDto): string {
  return `${digest.algorithm}:${digest.hex}`;
}
