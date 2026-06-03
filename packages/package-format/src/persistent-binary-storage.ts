import { PackageIdSchema, type PackageId } from "@private-2d-rigging-lab/contracts";

import {
  BinaryAssetReferenceSchema,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto
} from "./binary-asset.js";
import { PackageBinaryPackageRevisionSchema } from "./byte-availability-contract.js";
import {
  PackageBinaryPersistentByteAvailabilityIssueSchema,
  PackageBinaryPersistentByteAvailabilityReportSchema,
  PackageBinaryPersistentByteRecordSchema,
  PackageBinaryPersistentStorageBackendSchema,
  PackageBinaryPersistentStorageBackendStateSchema,
  type PackageBinaryPersistentByteAvailabilityDto,
  type PackageBinaryPersistentByteAvailabilityIssueCodeDto,
  type PackageBinaryPersistentByteAvailabilityIssueDto,
  type PackageBinaryPersistentByteAvailabilityIssueSourceDto,
  type PackageBinaryPersistentByteAvailabilityReportDto,
  type PackageBinaryPersistentByteAvailabilityReportStatusDto,
  type PackageBinaryPersistentByteRecordDto,
  type PackageBinaryPersistentRecordStatusDto,
  type PackageBinaryPersistentStorageBackendDto,
  type PackageBinaryPersistentStorageBackendStateDto,
  type PackageBinaryPersistentVerificationStatusDto
} from "./persistent-binary-storage-contract.js";
import type {
  PackageBinaryAssetVerificationIssue,
  PackageBinaryAssetVerificationReport
} from "./package-binary-file-set.js";

export interface CreatePackageBinaryPersistentByteRecordInput {
  readonly packageId: PackageId | string;
  readonly packageRevision: number;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly storageBackend?: PackageBinaryPersistentStorageBackendDto;
  readonly storedAt: string;
  readonly verifiedAt?: string;
}

export interface EvaluatePackageBinaryPersistentByteAvailabilityInput {
  readonly packageId: PackageId | string;
  readonly packageRevision: number;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly storageBackend?: PackageBinaryPersistentStorageBackendDto;
  readonly storageBackendState?: PackageBinaryPersistentStorageBackendStateDto;
  readonly storedRecord?: PackageBinaryPersistentByteRecordDto;
  readonly persistentVerificationReport?: PackageBinaryAssetVerificationReport;
}

export function createPackageBinaryPersistentByteRecord(
  input: CreatePackageBinaryPersistentByteRecordInput
): PackageBinaryPersistentByteRecordDto {
  const packageId = PackageIdSchema.parse(input.packageId);
  const packageRevision = PackageBinaryPackageRevisionSchema.parse(input.packageRevision);
  const binaryAssetRef = BinaryAssetReferenceSchema.parse(input.binaryAssetRef);
  const storageBackend = PackageBinaryPersistentStorageBackendSchema.parse(
    input.storageBackend ?? "indexeddb-same-origin-browser-local-v1"
  );

  return PackageBinaryPersistentByteRecordSchema.parse({
    schemaVersion: "package-binary-persistent-byte-record-v1",
    packageId,
    packageRevision,
    binaryAssetId: binaryAssetRef.binaryAssetId,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    digest: binaryAssetRef.digest,
    byteLength: binaryAssetRef.byteLength,
    mediaType: binaryAssetRef.mediaType,
    storageBackend,
    storedAt: input.storedAt,
    ...(input.verifiedAt === undefined ? {} : { verifiedAt: input.verifiedAt })
  });
}

export function evaluatePackageBinaryPersistentByteAvailability(
  input: EvaluatePackageBinaryPersistentByteAvailabilityInput
): PackageBinaryPersistentByteAvailabilityReportDto {
  const packageId = PackageIdSchema.parse(input.packageId);
  const packageRevision = PackageBinaryPackageRevisionSchema.parse(input.packageRevision);
  const binaryAssetRef = BinaryAssetReferenceSchema.parse(input.binaryAssetRef);
  const storedRecord = input.storedRecord === undefined
    ? undefined
    : PackageBinaryPersistentByteRecordSchema.parse(input.storedRecord);
  const storageBackend = PackageBinaryPersistentStorageBackendSchema.parse(
    input.storageBackend ?? storedRecord?.storageBackend ?? "indexeddb-same-origin-browser-local-v1"
  );
  const storageBackendState = PackageBinaryPersistentStorageBackendStateSchema.parse(
    input.storageBackendState ?? "available-v1"
  );
  const issues = [
    ...createBackendIssues({ storageBackendState }),
    ...createStoredRecordIssues({
      packageId,
      packageRevision,
      binaryAssetRef,
      storageBackend,
      storedRecord
    }),
    ...createPersistentVerificationIssues({
      binaryAssetRef,
      storedRecord,
      persistentVerificationReport: input.persistentVerificationReport
    })
  ];
  const recordStatus = getRecordStatus(storedRecord, issues);
  const persistentVerificationStatus = getPersistentVerificationStatus(
    input.persistentVerificationReport
  );
  const availability = derivePersistentByteAvailability({
    storedRecord,
    recordStatus,
    storageBackendState,
    issues
  });

  return PackageBinaryPersistentByteAvailabilityReportSchema.parse({
    schemaVersion: "package-binary-persistent-byte-availability-report-v1",
    packageId,
    packageRevision,
    binaryAssetId: binaryAssetRef.binaryAssetId,
    packageRelativePath: binaryAssetRef.packageRelativePath,
    expectedDigest: binaryAssetRef.digest,
    expectedByteLength: binaryAssetRef.byteLength,
    expectedMediaType: binaryAssetRef.mediaType,
    storageBackend,
    storageBackendState,
    recordStatus,
    persistentVerificationStatus,
    availability,
    requiresReupload: getRequiresReupload(availability),
    status: getReportStatus(issues),
    ...(storedRecord?.storedAt === undefined ? {} : { storedAt: storedRecord.storedAt }),
    ...(storedRecord?.verifiedAt === undefined ? {} : { verifiedAt: storedRecord.verifiedAt }),
    ...(input.persistentVerificationReport?.actualDigest === undefined
      ? {}
      : { actualDigest: input.persistentVerificationReport.actualDigest }),
    ...(input.persistentVerificationReport?.actualByteLength === undefined
      ? {}
      : { actualByteLength: input.persistentVerificationReport.actualByteLength }),
    ...(input.persistentVerificationReport?.actualMediaType === undefined
      ? {}
      : { actualMediaType: input.persistentVerificationReport.actualMediaType }),
    issues
  });
}

function createBackendIssues(input: {
  readonly storageBackendState: PackageBinaryPersistentStorageBackendStateDto;
}): readonly PackageBinaryPersistentByteAvailabilityIssueDto[] {
  if (input.storageBackendState === "available-v1") {
    return [];
  }

  return [createIssue({
    code: "persistentByteStorage.backend.unavailable",
    source: "storage-backend-state-v1",
    targetPath: "/storageBackendState",
    expected: "available-v1",
    actual: input.storageBackendState,
    message: "Browser-local persistent byte storage is not available for this package."
  })];
}

function createStoredRecordIssues(input: {
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly storageBackend: PackageBinaryPersistentStorageBackendDto;
  readonly storedRecord: PackageBinaryPersistentByteRecordDto | undefined;
}): readonly PackageBinaryPersistentByteAvailabilityIssueDto[] {
  if (input.storedRecord === undefined) {
    return [createIssue({
      code: "persistentByteStorage.record.missing",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord",
      expected: "package-binary-persistent-byte-record-v1",
      actual: "missing",
      message: "No browser-local persistent byte record is linked to this binary asset."
    })];
  }

  const issues: PackageBinaryPersistentByteAvailabilityIssueDto[] = [];

  if (input.storedRecord.packageId !== input.packageId) {
    issues.push(createIssue({
      code: "persistentByteStorage.packageId.mismatch",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/packageId",
      expected: input.packageId,
      actual: input.storedRecord.packageId,
      message: "Persistent byte record belongs to a different package identity."
    }));
  }

  if (input.storedRecord.packageRevision !== input.packageRevision) {
    issues.push(createIssue({
      code: "persistentByteStorage.packageRevision.mismatch",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/packageRevision",
      expected: String(input.packageRevision),
      actual: String(input.storedRecord.packageRevision),
      message: "Persistent byte record belongs to a different package revision."
    }));
  }

  if (
    input.storedRecord.binaryAssetId !== input.binaryAssetRef.binaryAssetId ||
    input.storedRecord.packageRelativePath !== input.binaryAssetRef.packageRelativePath
  ) {
    issues.push(createIssue({
      code: "persistentByteStorage.binaryAssetRef.mismatch",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/binaryAssetRef",
      expected: `${input.binaryAssetRef.binaryAssetId}@${input.binaryAssetRef.packageRelativePath}`,
      actual: `${input.storedRecord.binaryAssetId}@${input.storedRecord.packageRelativePath}`,
      message: "Persistent byte record targets a different binary asset reference."
    }));
  }

  if (
    input.storedRecord.digest.algorithm !== input.binaryAssetRef.digest.algorithm ||
    input.storedRecord.digest.hex !== input.binaryAssetRef.digest.hex
  ) {
    issues.push(createIssue({
      code: "persistentByteStorage.digest.mismatch",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/digest",
      expected: formatDigest(input.binaryAssetRef.digest),
      actual: formatDigest(input.storedRecord.digest),
      message: "Persistent byte record digest does not match the binary asset reference."
    }));
  }

  if (input.storedRecord.byteLength !== input.binaryAssetRef.byteLength) {
    issues.push(createIssue({
      code: "persistentByteStorage.byteLength.mismatch",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/byteLength",
      expected: String(input.binaryAssetRef.byteLength),
      actual: String(input.storedRecord.byteLength),
      message: "Persistent byte record byte length does not match the binary asset reference."
    }));
  }

  if (input.storedRecord.mediaType !== input.binaryAssetRef.mediaType) {
    issues.push(createIssue({
      code: "persistentByteStorage.mediaType.mismatch",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/mediaType",
      expected: input.binaryAssetRef.mediaType,
      actual: input.storedRecord.mediaType,
      message: "Persistent byte record media type does not match the binary asset reference."
    }));
  }

  if (input.storedRecord.storageBackend !== input.storageBackend) {
    issues.push(createIssue({
      code: "persistentByteStorage.backend.mismatch",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/storageBackend",
      expected: input.storageBackend,
      actual: input.storedRecord.storageBackend,
      message: "Persistent byte record was stored with a different storage backend."
    }));
  }

  if (input.storedRecord.verifiedAt === undefined) {
    issues.push(createIssue({
      code: "persistentByteStorage.record.unverified",
      source: "persistent-storage-record-v1",
      targetPath: "/storedRecord/verifiedAt",
      expected: "verifiedAt timestamp",
      actual: "missing",
      message: "Persistent byte record has not been verified for browser-local availability."
    }));
  }

  return issues;
}

function createPersistentVerificationIssues(input: {
  readonly binaryAssetRef: BinaryAssetReferenceDto;
  readonly storedRecord: PackageBinaryPersistentByteRecordDto | undefined;
  readonly persistentVerificationReport: PackageBinaryAssetVerificationReport | undefined;
}): readonly PackageBinaryPersistentByteAvailabilityIssueDto[] {
  if (input.storedRecord === undefined) {
    return [];
  }

  if (input.persistentVerificationReport === undefined) {
    return [createIssue({
      code: "persistentByteStorage.verification.missing",
      source: "persistent-storage-verification-report-v1",
      targetPath: "/persistentVerificationReport",
      expected: "persistent-byte-verification-report",
      actual: "missing",
      message: "Persistent bytes are not available until the stored bytes are re-read and verified."
    })];
  }

  return [
    ...createVerificationReportIdentityIssues(
      input.binaryAssetRef,
      input.persistentVerificationReport
    ),
    ...input.persistentVerificationReport.issues.map(mapVerificationIssue)
  ];
}

function createVerificationReportIdentityIssues(
  binaryAssetRef: BinaryAssetReferenceDto,
  report: PackageBinaryAssetVerificationReport
): readonly PackageBinaryPersistentByteAvailabilityIssueDto[] {
  const issues: PackageBinaryPersistentByteAvailabilityIssueDto[] = [];

  if (
    report.binaryAssetId !== binaryAssetRef.binaryAssetId ||
    report.packageRelativePath !== binaryAssetRef.packageRelativePath
  ) {
    issues.push(createIssue({
      code: "persistentByteStorage.binaryAssetRef.mismatch",
      source: "persistent-storage-verification-report-v1",
      targetPath: "/persistentVerificationReport/binaryAssetRef",
      expected: `${binaryAssetRef.binaryAssetId}@${binaryAssetRef.packageRelativePath}`,
      actual: `${report.binaryAssetId}@${report.packageRelativePath}`,
      message: "Persistent byte verification report does not target the requested binary ref."
    }));
  }

  if (
    report.expectedDigest.algorithm !== binaryAssetRef.digest.algorithm ||
    report.expectedDigest.hex !== binaryAssetRef.digest.hex
  ) {
    issues.push(createIssue({
      code: "persistentByteStorage.digest.mismatch",
      source: "persistent-storage-verification-report-v1",
      targetPath: "/persistentVerificationReport/expectedDigest",
      expected: formatDigest(binaryAssetRef.digest),
      actual: formatDigest(report.expectedDigest),
      message: "Persistent byte verification report expected digest does not match the binary ref."
    }));
  }

  if (report.expectedByteLength !== binaryAssetRef.byteLength) {
    issues.push(createIssue({
      code: "persistentByteStorage.byteLength.mismatch",
      source: "persistent-storage-verification-report-v1",
      targetPath: "/persistentVerificationReport/expectedByteLength",
      expected: String(binaryAssetRef.byteLength),
      actual: String(report.expectedByteLength),
      message: "Persistent byte verification report expected byte length does not match the binary ref."
    }));
  }

  if (report.expectedMediaType !== binaryAssetRef.mediaType) {
    issues.push(createIssue({
      code: "persistentByteStorage.mediaType.mismatch",
      source: "persistent-storage-verification-report-v1",
      targetPath: "/persistentVerificationReport/expectedMediaType",
      expected: binaryAssetRef.mediaType,
      actual: report.expectedMediaType,
      message: "Persistent byte verification report expected media type does not match the binary ref."
    }));
  }

  return issues;
}

function mapVerificationIssue(
  issue: PackageBinaryAssetVerificationIssue
): PackageBinaryPersistentByteAvailabilityIssueDto {
  switch (issue.code) {
    case "binary.assetId.mismatch":
      return createIssue({
        code: "persistentByteStorage.binaryAssetRef.mismatch",
        source: "persistent-storage-verification-report-v1",
        targetPath: "/persistentVerificationReport/issues/binaryAssetRef",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.byteLength.mismatch":
      return createIssue({
        code: "persistentByteStorage.byteLength.mismatch",
        source: "persistent-storage-verification-report-v1",
        targetPath: "/persistentVerificationReport/issues/byteLength",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.bytes.missing":
      return createIssue({
        code: "persistentByteStorage.bytes.missing",
        source: "persistent-storage-verification-report-v1",
        targetPath: "/persistentVerificationReport/issues/bytes",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.digest.mismatch":
      return createIssue({
        code: "persistentByteStorage.digest.mismatch",
        source: "persistent-storage-verification-report-v1",
        targetPath: "/persistentVerificationReport/issues/digest",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.digest.unsupported":
      return createIssue({
        code: "persistentByteStorage.digest.unsupported",
        source: "persistent-storage-verification-report-v1",
        targetPath: "/persistentVerificationReport/issues/digest",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
    case "binary.mediaType.mismatch":
      return createIssue({
        code: "persistentByteStorage.mediaType.mismatch",
        source: "persistent-storage-verification-report-v1",
        targetPath: "/persistentVerificationReport/issues/mediaType",
        expected: issue.expected,
        actual: issue.actual,
        message: issue.message
      });
  }
}

function getRecordStatus(
  storedRecord: PackageBinaryPersistentByteRecordDto | undefined,
  issues: readonly PackageBinaryPersistentByteAvailabilityIssueDto[]
): PackageBinaryPersistentRecordStatusDto {
  if (storedRecord === undefined) {
    return "not-supplied-v1";
  }

  if (hasStoredRecordStaleIssue(issues)) {
    return "stale-v1";
  }

  return storedRecord.verifiedAt === undefined
    ? "unverified-v1"
    : "current-v1";
}

function getPersistentVerificationStatus(
  report: PackageBinaryAssetVerificationReport | undefined
): PackageBinaryPersistentVerificationStatusDto {
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

function derivePersistentByteAvailability(input: {
  readonly storedRecord: PackageBinaryPersistentByteRecordDto | undefined;
  readonly recordStatus: PackageBinaryPersistentRecordStatusDto;
  readonly storageBackendState: PackageBinaryPersistentStorageBackendStateDto;
  readonly issues: readonly PackageBinaryPersistentByteAvailabilityIssueDto[];
}): PackageBinaryPersistentByteAvailabilityDto {
  if (input.storageBackendState !== "available-v1" || input.storedRecord === undefined) {
    return "unavailable-browser-local-persistent-bytes-v1";
  }

  if (input.recordStatus === "stale-v1" || hasStoredRecordStaleIssue(input.issues)) {
    return "stale-browser-local-persistent-record-v1";
  }

  if (
    input.recordStatus === "unverified-v1" ||
    input.issues.some((issue) =>
      issue.code === "persistentByteStorage.verification.missing" ||
      issue.code === "persistentByteStorage.bytes.missing"
    )
  ) {
    return "unavailable-browser-local-persistent-bytes-v1";
  }

  if (input.issues.some((issue) => issue.code === "persistentByteStorage.digest.unsupported")) {
    return "verification-unsupported-v1";
  }

  if (input.issues.length > 0) {
    return "corrupt-browser-local-persistent-bytes-v1";
  }

  return "available-browser-local-persistent-bytes-v1";
}

function getRequiresReupload(
  availability: PackageBinaryPersistentByteAvailabilityDto
): boolean {
  return availability !== "available-browser-local-persistent-bytes-v1" &&
    availability !== "verification-unsupported-v1";
}

function getReportStatus(
  issues: readonly PackageBinaryPersistentByteAvailabilityIssueDto[]
): PackageBinaryPersistentByteAvailabilityReportStatusDto {
  const hasFailure = issues.some((issue) =>
    issue.code !== "persistentByteStorage.digest.unsupported"
  );
  const hasUnsupported = issues.some((issue) =>
    issue.code === "persistentByteStorage.digest.unsupported"
  );

  return hasFailure
    ? "fail-v1"
    : hasUnsupported
      ? "unsupported-v1"
      : "pass-v1";
}

function hasStoredRecordStaleIssue(
  issues: readonly PackageBinaryPersistentByteAvailabilityIssueDto[]
): boolean {
  return issues.some((issue) =>
    issue.source === "persistent-storage-record-v1" &&
    (
      issue.code === "persistentByteStorage.backend.mismatch" ||
      issue.code === "persistentByteStorage.packageId.mismatch" ||
      issue.code === "persistentByteStorage.packageRevision.mismatch" ||
      issue.code === "persistentByteStorage.binaryAssetRef.mismatch" ||
      issue.code === "persistentByteStorage.digest.mismatch" ||
      issue.code === "persistentByteStorage.byteLength.mismatch" ||
      issue.code === "persistentByteStorage.mediaType.mismatch"
    )
  );
}

function createIssue(input: {
  readonly code: PackageBinaryPersistentByteAvailabilityIssueCodeDto;
  readonly source: PackageBinaryPersistentByteAvailabilityIssueSourceDto;
  readonly targetPath: string;
  readonly expected: string;
  readonly actual: string;
  readonly message: string;
}): PackageBinaryPersistentByteAvailabilityIssueDto {
  return PackageBinaryPersistentByteAvailabilityIssueSchema.parse(input);
}

function formatDigest(digest: BinaryAssetDigestDto): string {
  return `${digest.algorithm}:${digest.hex}`;
}
