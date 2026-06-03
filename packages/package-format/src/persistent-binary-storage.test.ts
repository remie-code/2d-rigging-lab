import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageBinaryPersistentByteAvailabilityReportSchema,
  PackageBinaryPersistentByteRecordSchema,
  createPackageBinaryFileEntry,
  createPackageBinaryPersistentByteRecord,
  createPackageInMemoryFileSet,
  evaluatePackageBinaryPersistentByteAvailability,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto,
  type PackageBinaryPersistentByteRecordDto
} from "./index.js";

const PACKAGE_ID = "pkg_persistentBytes";
const STORED_AT = "2026-06-03T00:00:00.000Z";
const VERIFIED_AT = "2026-06-03T00:00:01.000Z";
const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const CORRUPT_TEST_BYTES = new Uint8Array([0x64, 0x65, 0x66, 0x67]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("browser-local persistent binary byte storage contract", () => {
  it("records same-origin IndexedDB linkage without portable archive or raw-byte payload claims", () => {
    const binaryAssetRef = createBinaryAssetReference();
    const record = createStoredRecord(binaryAssetRef, {
      packageRevision: 11,
      verifiedAt: VERIFIED_AT
    });

    expect(record).toMatchObject({
      schemaVersion: "package-binary-persistent-byte-record-v1",
      packageId: PACKAGE_ID,
      packageRevision: 11,
      binaryAssetId: "bin_sample_model_psd",
      packageRelativePath: "assets/sources/uploads/sample_model.psd",
      byteLength: 3,
      mediaType: "image/vnd.adobe.photoshop",
      storageBackend: "indexeddb-same-origin-browser-local-v1",
      storedAt: STORED_AT,
      verifiedAt: VERIFIED_AT
    });
    expect(record.digest).toEqual({ algorithm: "sha256", hex: TEST_BYTES_SHA256_HEX });

    expect(PackageBinaryPersistentByteRecordSchema.safeParse({
      ...record,
      bytesBase64: "AAAA"
    }).success).toBe(false);
    expect(PackageBinaryPersistentByteRecordSchema.safeParse({
      ...record,
      archivePath: "package.zip",
      fileSystemHandleName: "sample_model.psd"
    }).success).toBe(false);
    expect(PackageBinaryPersistentByteRecordSchema.safeParse({
      ...record,
      storageBackend: "local-storage-browser-local-v1"
    }).success).toBe(false);
  });

  it("marks only re-read and verified same-origin IndexedDB bytes as available", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const storedRecord = createStoredRecord(binaryAssetRef, {
      packageRevision: 12,
      verifiedAt: VERIFIED_AT
    });
    const persistentVerificationReport = await verifyPackageBinaryAssetBytes(
      createPackageInMemoryFileSet([
        createPackageBinaryFileEntry({
          path: binaryAssetRef.packageRelativePath,
          bytes: TEST_BYTES,
          mediaType: binaryAssetRef.mediaType,
          binaryAssetId: binaryAssetRef.binaryAssetId
        })
      ]),
      binaryAssetRef
    );
    const availabilityReport = evaluatePackageBinaryPersistentByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 12,
      binaryAssetRef,
      storedRecord,
      persistentVerificationReport
    });

    expect(availabilityReport).toMatchObject({
      schemaVersion: "package-binary-persistent-byte-availability-report-v1",
      packageId: PACKAGE_ID,
      packageRevision: 12,
      binaryAssetId: "bin_sample_model_psd",
      packageRelativePath: "assets/sources/uploads/sample_model.psd",
      expectedByteLength: 3,
      expectedMediaType: "image/vnd.adobe.photoshop",
      storageBackend: "indexeddb-same-origin-browser-local-v1",
      storageBackendState: "available-v1",
      recordStatus: "current-v1",
      persistentVerificationStatus: "pass-v1",
      availability: "available-browser-local-persistent-bytes-v1",
      requiresReupload: false,
      status: "pass-v1",
      storedAt: STORED_AT,
      verifiedAt: VERIFIED_AT,
      actualByteLength: 3,
      actualMediaType: "image/vnd.adobe.photoshop",
      issues: []
    });
    expect(availabilityReport.expectedDigest.hex).toBe(TEST_BYTES_SHA256_HEX);
    expect(availabilityReport.actualDigest?.hex).toBe(TEST_BYTES_SHA256_HEX);
    expect(PackageBinaryPersistentByteAvailabilityReportSchema.safeParse({
      ...availabilityReport,
      portableArchiveAvailable: true
    }).success).toBe(false);
  });

  it("distinguishes missing records and unavailable browser storage from stale package revisions", () => {
    const binaryAssetRef = createBinaryAssetReference();
    const missingRecordReport = evaluatePackageBinaryPersistentByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 13,
      binaryAssetRef
    });
    const backendUnavailableReport = evaluatePackageBinaryPersistentByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 13,
      binaryAssetRef,
      storageBackendState: "unsupported-v1"
    });
    const staleRecord = createStoredRecord(binaryAssetRef, {
      packageRevision: 12,
      verifiedAt: VERIFIED_AT
    });
    const staleRecordReport = evaluatePackageBinaryPersistentByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 13,
      binaryAssetRef,
      storedRecord: staleRecord
    });

    expect(missingRecordReport).toMatchObject({
      availability: "unavailable-browser-local-persistent-bytes-v1",
      recordStatus: "not-supplied-v1",
      requiresReupload: true,
      status: "fail-v1"
    });
    expect(missingRecordReport.issues.map((issue) => issue.code)).toEqual([
      "persistentByteStorage.record.missing"
    ]);

    expect(backendUnavailableReport).toMatchObject({
      availability: "unavailable-browser-local-persistent-bytes-v1",
      storageBackendState: "unsupported-v1",
      requiresReupload: true,
      status: "fail-v1"
    });
    expect(backendUnavailableReport.issues.map((issue) => issue.code)).toEqual([
      "persistentByteStorage.backend.unavailable",
      "persistentByteStorage.record.missing"
    ]);

    expect(staleRecordReport).toMatchObject({
      availability: "stale-browser-local-persistent-record-v1",
      recordStatus: "stale-v1",
      persistentVerificationStatus: "not-supplied-v1",
      requiresReupload: true,
      status: "fail-v1"
    });
    expect(staleRecordReport.issues.map((issue) => issue.code)).toEqual([
      "persistentByteStorage.packageRevision.mismatch",
      "persistentByteStorage.verification.missing"
    ]);
  });

  it("requires reupload for stored records that have not been re-read and verified", () => {
    const binaryAssetRef = createBinaryAssetReference();
    const currentStoredRecord = createStoredRecord(binaryAssetRef, {
      packageRevision: 15,
      verifiedAt: VERIFIED_AT
    });
    const currentRecordWithoutRereadReport = evaluatePackageBinaryPersistentByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 15,
      binaryAssetRef,
      storedRecord: currentStoredRecord
    });
    const unverifiedStoredRecord = createStoredRecord(binaryAssetRef, {
      packageRevision: 15
    });
    const unverifiedRecordReport = evaluatePackageBinaryPersistentByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 15,
      binaryAssetRef,
      storedRecord: unverifiedStoredRecord
    });

    expect(currentRecordWithoutRereadReport).toMatchObject({
      availability: "unavailable-browser-local-persistent-bytes-v1",
      recordStatus: "current-v1",
      persistentVerificationStatus: "not-supplied-v1",
      requiresReupload: true,
      status: "fail-v1",
      storedAt: STORED_AT,
      verifiedAt: VERIFIED_AT
    });
    expect(currentRecordWithoutRereadReport.issues.map((issue) => issue.code)).toEqual([
      "persistentByteStorage.verification.missing"
    ]);

    expect(unverifiedRecordReport).toMatchObject({
      availability: "unavailable-browser-local-persistent-bytes-v1",
      recordStatus: "unverified-v1",
      persistentVerificationStatus: "not-supplied-v1",
      requiresReupload: true,
      status: "fail-v1",
      storedAt: STORED_AT
    });
    expect(unverifiedRecordReport).not.toHaveProperty("verifiedAt");
    expect(unverifiedRecordReport.issues.map((issue) => issue.code)).toEqual([
      "persistentByteStorage.record.unverified",
      "persistentByteStorage.verification.missing"
    ]);
  });

  it("marks mismatched stored-record metadata as stale before treating bytes as available", () => {
    const binaryAssetRef = createBinaryAssetReference();
    const staleCases: readonly {
      readonly storedRecord: PackageBinaryPersistentByteRecordDto;
      readonly issueCode:
        | "persistentByteStorage.packageId.mismatch"
        | "persistentByteStorage.binaryAssetRef.mismatch"
        | "persistentByteStorage.digest.mismatch"
        | "persistentByteStorage.byteLength.mismatch"
        | "persistentByteStorage.mediaType.mismatch";
    }[] = [
      {
        storedRecord: createStoredRecord(binaryAssetRef, {
          packageId: "pkg_otherPersistentBytes",
          packageRevision: 16,
          verifiedAt: VERIFIED_AT
        }),
        issueCode: "persistentByteStorage.packageId.mismatch"
      },
      {
        storedRecord: createStoredRecord(
          createBinaryAssetReference({
            binaryAssetId: "bin_other_model_psd",
            packageRelativePath: "assets/sources/uploads/other_model.psd"
          }),
          {
            packageRevision: 16,
            verifiedAt: VERIFIED_AT
          }
        ),
        issueCode: "persistentByteStorage.binaryAssetRef.mismatch"
      },
      {
        storedRecord: createStoredRecord(
          createBinaryAssetReference({
            digest: {
              algorithm: "sha256",
              hex: "0000000000000000000000000000000000000000000000000000000000000000"
            }
          }),
          {
            packageRevision: 16,
            verifiedAt: VERIFIED_AT
          }
        ),
        issueCode: "persistentByteStorage.digest.mismatch"
      },
      {
        storedRecord: createStoredRecord(
          createBinaryAssetReference({
            byteLength: 4
          }),
          {
            packageRevision: 16,
            verifiedAt: VERIFIED_AT
          }
        ),
        issueCode: "persistentByteStorage.byteLength.mismatch"
      },
      {
        storedRecord: createStoredRecord(
          createBinaryAssetReference({
            mediaType: "image/png"
          }),
          {
            packageRevision: 16,
            verifiedAt: VERIFIED_AT
          }
        ),
        issueCode: "persistentByteStorage.mediaType.mismatch"
      }
    ];

    for (const staleCase of staleCases) {
      const availabilityReport = evaluatePackageBinaryPersistentByteAvailability({
        packageId: PACKAGE_ID,
        packageRevision: 16,
        binaryAssetRef,
        storedRecord: staleCase.storedRecord
      });

      expect(availabilityReport).toMatchObject({
        availability: "stale-browser-local-persistent-record-v1",
        recordStatus: "stale-v1",
        persistentVerificationStatus: "not-supplied-v1",
        requiresReupload: true,
        status: "fail-v1"
      });
      expect(availabilityReport.issues.map((issue) => issue.code)).toEqual([
        staleCase.issueCode,
        "persistentByteStorage.verification.missing"
      ]);
    }
  });

  it("distinguishes corrupt stored bytes from stale metadata", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const storedRecord = createStoredRecord(binaryAssetRef, {
      packageRevision: 14,
      verifiedAt: VERIFIED_AT
    });
    const corruptVerificationReport = await verifyPackageBinaryAssetBytes(
      createPackageInMemoryFileSet([
        createPackageBinaryFileEntry({
          path: binaryAssetRef.packageRelativePath,
          bytes: CORRUPT_TEST_BYTES,
          mediaType: binaryAssetRef.mediaType,
          binaryAssetId: binaryAssetRef.binaryAssetId
        })
      ]),
      binaryAssetRef
    );
    const availabilityReport = evaluatePackageBinaryPersistentByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 14,
      binaryAssetRef,
      storedRecord,
      persistentVerificationReport: corruptVerificationReport
    });
    const issueCodes = availabilityReport.issues.map((issue) => issue.code);

    expect(corruptVerificationReport.status).toBe("fail");
    expect(availabilityReport).toMatchObject({
      availability: "corrupt-browser-local-persistent-bytes-v1",
      recordStatus: "current-v1",
      persistentVerificationStatus: "fail-v1",
      requiresReupload: true,
      status: "fail-v1",
      actualByteLength: 4
    });
    expect(issueCodes).toEqual(expect.arrayContaining([
      "persistentByteStorage.byteLength.mismatch",
      "persistentByteStorage.digest.mismatch"
    ]));
    expect(availabilityReport.actualDigest?.hex).not.toBe(TEST_BYTES_SHA256_HEX);
  });
});

const createBinaryAssetReference = (
  overrides: Readonly<Record<string, unknown>> = {}
): BinaryAssetReferenceDto => BinaryAssetReferenceSchema.parse({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_sample_model_psd",
  packageRelativePath: "assets/sources/uploads/sample_model.psd",
  digest: {
    algorithm: "sha256",
    hex: TEST_BYTES_SHA256_HEX
  },
  byteLength: 3,
  mediaType: "image/vnd.adobe.photoshop",
  storageStatus: "stored-package-local-v1",
  provenanceId: "prov_sample_model_psd",
  rightsAssetId: "src_sample_model_psd",
  ...overrides
});

const createStoredRecord = (
  binaryAssetRef: BinaryAssetReferenceDto,
  overrides: {
    readonly packageId?: string;
    readonly packageRevision?: number;
    readonly verifiedAt?: string;
  } = {}
): PackageBinaryPersistentByteRecordDto => createPackageBinaryPersistentByteRecord({
  packageId: overrides.packageId ?? PACKAGE_ID,
  packageRevision: overrides.packageRevision ?? 1,
  binaryAssetRef,
  storedAt: STORED_AT,
  ...(overrides.verifiedAt === undefined ? {} : { verifiedAt: overrides.verifiedAt })
});
