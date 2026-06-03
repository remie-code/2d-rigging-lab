import {
  describe,
  expect,
  it
} from "vitest";

import {
  BinaryAssetReferenceSchema,
  computePackageBinarySha256Digest,
  createPackageBinaryFileEntry,
  createPackageBinaryPersistentByteRecord,
  createPackageInMemoryFileSet,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto,
  type PackageBinaryAssetVerificationReport,
  type PackageBinaryBytes,
  type PackageBinaryPersistentByteRecordDto,
  type PackageBinaryPersistentStorageBackendStateDto
} from "@private-2d-rigging-lab/package-format";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationCheckResultDto } from "./validation-report.js";
import { validateByteIntakePreflight } from "./validators/byte-intake-preflight.js";

const PACKAGE_ID = "pkg_persistentByteValidator";
const PACKAGE_REVISION = 35;
const STORED_AT = "2026-06-03T00:00:00.000Z";
const VERIFIED_AT = "2026-06-03T00:00:01.000Z";
const SOURCE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const CORRUPT_BYTES = new Uint8Array([0x64, 0x65, 0x66, 0x67]);

describe("persistent byte availability diagnostics", () => {
  it("registers persistent byte storage diagnostics in the check catalog", () => {
    expect(defaultCheckCatalog.has("persistentByteStorage.backend.unavailable")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.backend.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.record.missing")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.record.unverified")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.verification.missing")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.packageId.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.packageRevision.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.binaryAssetRef.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.digest.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.byteLength.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.mediaType.mismatch")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.bytes.missing")).toBe(true);
    expect(defaultCheckCatalog.has("persistentByteStorage.digest.unsupported")).toBe(true);
  });

  it("accepts verified browser-local persistent bytes without current-session bytes", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_persistentBytes_valid",
      packageRelativePath: "assets/sources/persistent-valid.bin",
      bytes: SOURCE_BYTES
    });
    const storedRecord = createStoredRecord(binaryAssetRef);
    const persistentVerificationReport = await createVerificationReport(
      binaryAssetRef,
      SOURCE_BYTES
    );

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef,
        persistentStoredRecord: storedRecord,
        persistentVerificationReport,
        targetKind: "sourceAsset",
        targetId: "src_persistentByteValidator"
      }]
    });

    expect(checks).toEqual([]);
  });

  it("reports a missing persistent byte record when browser-local storage is expected", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_persistentBytes_missingRecord",
      packageRelativePath: "assets/sources/persistent-missing-record.bin",
      bytes: SOURCE_BYTES
    });

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef,
        persistentStorageExpected: true,
        targetKind: "sourceAsset",
        targetId: "src_persistentByteValidator"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "persistentByteStorage.record.missing"
    ]);
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.record.missing",
      persistentIssueTargetPath: "/storedRecord",
      evidence: [
        "persistentAvailability=unavailable-browser-local-persistent-bytes-v1",
        "persistentAvailabilityStatus=fail-v1",
        "persistentStorageBackend=indexeddb-same-origin-browser-local-v1",
        "persistentStorageBackendState=available-v1",
        "persistentRecordStatus=not-supplied-v1",
        "persistentVerificationStatus=not-supplied-v1",
        "persistentRequiresReupload=true",
        "persistentIssueSource=persistent-storage-record-v1",
        "expected=package-binary-persistent-byte-record-v1",
        "actual=missing"
      ]
    });
  });

  it("reports missing stored bytes when a persistent record cannot be re-read", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_persistentBytes_missingStoredBytes",
      packageRelativePath: "assets/sources/persistent-missing-stored-bytes.bin",
      bytes: SOURCE_BYTES
    });
    const storedRecord = createStoredRecord(binaryAssetRef);
    const missingBytesReport = await verifyPackageBinaryAssetBytes(
      createPackageInMemoryFileSet([]),
      binaryAssetRef
    );

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef,
        persistentStoredRecord: storedRecord,
        persistentVerificationReport: missingBytesReport,
        targetKind: "sourceAsset",
        targetId: "src_persistentByteValidator"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "persistentByteStorage.bytes.missing"
    ]);
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.bytes.missing",
      persistentIssueTargetPath: "/persistentVerificationReport/issues/bytes",
      evidence: [
        "persistentAvailability=unavailable-browser-local-persistent-bytes-v1",
        "persistentVerificationStatus=fail-v1",
        "persistentIssueSource=persistent-storage-verification-report-v1",
        "expected=assets/sources/persistent-missing-stored-bytes.bin",
        "actual=missing",
        "actualByteLength=missing"
      ]
    });
  });

  it("reports corrupt browser-local persistent bytes without parser or decode claims", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_persistentBytes_corrupt",
      packageRelativePath: "assets/sources/persistent-corrupt.bin",
      bytes: SOURCE_BYTES
    });
    const storedRecord = createStoredRecord(binaryAssetRef);
    const corruptVerificationReport = await createVerificationReport(
      binaryAssetRef,
      CORRUPT_BYTES,
      false
    );

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef,
        persistentStoredRecord: storedRecord,
        persistentVerificationReport: corruptVerificationReport,
        targetKind: "sourceAsset",
        targetId: "src_persistentByteValidator"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "persistentByteStorage.byteLength.mismatch",
      "persistentByteStorage.digest.mismatch"
    ]);
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.byteLength.mismatch",
      persistentIssueTargetPath: "/persistentVerificationReport/issues/byteLength",
      evidence: [
        "persistentAvailability=corrupt-browser-local-persistent-bytes-v1",
        "persistentVerificationStatus=fail-v1",
        "expected=3",
        "actual=4",
        "actualByteLength=4"
      ]
    });
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.digest.mismatch",
      persistentIssueTargetPath: "/persistentVerificationReport/issues/digest",
      evidence: [
        "persistentAvailability=corrupt-browser-local-persistent-bytes-v1",
        "persistentIssueSource=persistent-storage-verification-report-v1"
      ]
    });
    for (const check of checks) {
      expect(check.message).not.toMatch(/parser|archive|decode|raster/i);
      expect(check.impact).not.toMatch(/parser|archive|decode|raster/i);
    }
  });

  it("reports stale package revision and binary metadata mismatches", async () => {
    const expectedRef = await createBinaryAssetReference({
      binaryAssetId: "bin_persistentBytes_expected",
      packageRelativePath: "assets/sources/persistent-expected.bin",
      bytes: SOURCE_BYTES
    });
    const staleRef = await createBinaryAssetReference({
      binaryAssetId: "bin_persistentBytes_previous",
      packageRelativePath: "assets/sources/persistent-previous.bin",
      bytes: CORRUPT_BYTES
    });
    const staleRecord = createStoredRecord(staleRef, {
      packageRevision: PACKAGE_REVISION - 1
    });

    const checks = await validateByteIntakePreflight({
      packageId: PACKAGE_ID,
      packageRevision: PACKAGE_REVISION,
      assets: [{
        binaryAssetRef: expectedRef,
        persistentStoredRecord: staleRecord,
        targetKind: "sourceAsset",
        targetId: "src_persistentByteValidator"
      }]
    });

    expect(checks.map((check) => check.checkId)).toEqual([
      "persistentByteStorage.packageRevision.mismatch",
      "persistentByteStorage.binaryAssetRef.mismatch",
      "persistentByteStorage.digest.mismatch",
      "persistentByteStorage.byteLength.mismatch",
      "persistentByteStorage.verification.missing"
    ]);
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.packageRevision.mismatch",
      persistentIssueTargetPath: "/storedRecord/packageRevision",
      evidence: [
        "persistentAvailability=stale-browser-local-persistent-record-v1",
        "persistentRecordStatus=stale-v1",
        `expected=${PACKAGE_REVISION}`,
        `actual=${PACKAGE_REVISION - 1}`
      ]
    });
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.binaryAssetRef.mismatch",
      persistentIssueTargetPath: "/storedRecord/binaryAssetRef"
    });
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.digest.mismatch",
      persistentIssueTargetPath: "/storedRecord/digest"
    });
    expectPersistentByteAvailabilityCheck(checks, {
      checkId: "persistentByteStorage.byteLength.mismatch",
      persistentIssueTargetPath: "/storedRecord/byteLength"
    });
  });

  it("reports unavailable and unsupported persistent storage backend states when supplied", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_persistentBytes_backend",
      packageRelativePath: "assets/sources/persistent-backend.bin",
      bytes: SOURCE_BYTES
    });
    const backendStates: readonly PackageBinaryPersistentStorageBackendStateDto[] = [
      "unavailable-v1",
      "unsupported-v1"
    ];

    for (const backendState of backendStates) {
      const checks = await validateByteIntakePreflight({
        packageId: PACKAGE_ID,
        packageRevision: PACKAGE_REVISION,
        assets: [{
          binaryAssetRef,
          persistentStorageBackendState: backendState,
          targetKind: "sourceAsset",
          targetId: "src_persistentByteValidator"
        }]
      });

      expect(checks.map((check) => check.checkId)).toEqual([
        "persistentByteStorage.backend.unavailable",
        "persistentByteStorage.record.missing"
      ]);
      expectPersistentByteAvailabilityCheck(checks, {
        checkId: "persistentByteStorage.backend.unavailable",
        persistentIssueTargetPath: "/storageBackendState",
        evidence: [
          "persistentAvailability=unavailable-browser-local-persistent-bytes-v1",
          `persistentStorageBackendState=${backendState}`,
          "expected=available-v1",
          `actual=${backendState}`
        ]
      });
    }
  });
});

const createBinaryAssetReference = async (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly bytes: PackageBinaryBytes;
}): Promise<BinaryAssetReferenceDto> =>
  BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: input.binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest: await computeDigest(input.bytes),
    byteLength: input.bytes.byteLength,
    mediaType: "application/octet-stream",
    storageStatus: "stored-package-local-v1",
    provenanceId: "prov_persistentByteValidator",
    rightsAssetId: "src_persistentByteValidator"
  });

const createStoredRecord = (
  binaryAssetRef: BinaryAssetReferenceDto,
  overrides: {
    readonly packageRevision?: number;
  } = {}
): PackageBinaryPersistentByteRecordDto => createPackageBinaryPersistentByteRecord({
  packageId: PACKAGE_ID,
  packageRevision: overrides.packageRevision ?? PACKAGE_REVISION,
  binaryAssetRef,
  storedAt: STORED_AT,
  verifiedAt: VERIFIED_AT
});

const createVerificationReport = async (
  binaryAssetRef: BinaryAssetReferenceDto,
  bytes: PackageBinaryBytes,
  expectPass = true
): Promise<PackageBinaryAssetVerificationReport> => {
  const report = await verifyPackageBinaryAssetBytes(
    createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: binaryAssetRef.packageRelativePath,
        bytes,
        mediaType: binaryAssetRef.mediaType,
        binaryAssetId: binaryAssetRef.binaryAssetId
      })
    ]),
    binaryAssetRef
  );

  if (expectPass) {
    expect(report.status).toBe("pass");
  }
  return report;
};

const computeDigest = async (bytes: PackageBinaryBytes): Promise<BinaryAssetDigestDto> => {
  const result = await computePackageBinarySha256Digest(bytes);

  if (result.status === "unsupported") {
    throw new Error("Test environment does not support SHA-256 digest verification.");
  }

  return result.digest;
};

const expectPersistentByteAvailabilityCheck = (
  checks: readonly ValidationCheckResultDto[],
  expected: {
    readonly checkId: string;
    readonly persistentIssueTargetPath: string;
    readonly targetPath?: string;
    readonly evidence?: readonly string[];
  }
): ValidationCheckResultDto => {
  const targetPath = expected.targetPath ?? "/byteIntake/assets/0";
  const check = checks.find((candidate) =>
    candidate.checkId === expected.checkId &&
    candidate.evidence.includes(`persistentIssueTargetPath=${expected.persistentIssueTargetPath}`)
  );

  if (check === undefined) {
    throw new Error(
      `Expected ${expected.checkId} at ${expected.persistentIssueTargetPath}. Found: ${checks.map((candidate) =>
        `${candidate.checkId}:${candidate.evidence.find((item) =>
          item.startsWith("persistentIssueTargetPath=")
        ) ?? "missing-target-path"}`
      ).join(", ")}`
    );
  }

  expect(check).toMatchObject({
    checkId: expected.checkId,
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "sourceAsset",
      id: "src_persistentByteValidator",
      path: targetPath
    },
    targetPath
  });
  expect(check.evidence).toEqual(expect.arrayContaining([
    `persistentIssueCode=${expected.checkId}`,
    `persistentIssueTargetPath=${expected.persistentIssueTargetPath}`,
    `packageId=${PACKAGE_ID}`,
    `packageRevision=${PACKAGE_REVISION}`,
    ...(expected.evidence ?? [])
  ]));

  return check;
};
