import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  createPackageBinaryByteIntakeSummary,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  evaluatePackageBinaryCurrentSessionByteAvailability,
  PackageBinaryByteVerifiedSummarySnapshotSchema,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto,
  type PackageBinaryByteIntakeSummaryDto,
  type PackageBinaryByteVerifiedSummarySnapshotDto
} from "./index.js";

const PACKAGE_ID = "pkg_byteAvailability";
const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("direct-call package binary byte availability", () => {
  it("marks only current-session verified bytes as available", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const verificationReport = await verifyPackageBinaryAssetBytes(
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
    const availabilityReport = evaluatePackageBinaryCurrentSessionByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 7,
      binaryAssetRef,
      currentSessionVerificationReport: verificationReport
    });

    expect(availabilityReport).toMatchObject({
      schemaVersion: "package-binary-byte-availability-report-v1",
      packageId: PACKAGE_ID,
      packageRevision: 7,
      binaryAssetId: "bin_sample_model_psd",
      currentSessionBytes: "available-current-session-bytes-v1",
      availability: "available-current-session-bytes-v1",
      requiresReupload: false,
      verifiedSummaryStatus: "not-supplied-v1",
      currentSessionVerificationStatus: "pass-v1",
      status: "pass-v1",
      expectedByteLength: 3,
      actualByteLength: 3,
      issues: []
    });
    expect(availabilityReport.expectedDigest.hex).toBe(TEST_BYTES_SHA256_HEX);
    expect(availabilityReport.actualDigest?.hex).toBe(TEST_BYTES_SHA256_HEX);
  });

  it("distinguishes missing current-session bytes from reupload-required state", () => {
    const storedRef = createBinaryAssetReference();
    const missingReport = evaluatePackageBinaryCurrentSessionByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 1,
      binaryAssetRef: storedRef
    });
    const reuploadRef = createBinaryAssetReference({
      storageStatus: "storage-unsupported-v1"
    });
    const reuploadReport = evaluatePackageBinaryCurrentSessionByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 1,
      binaryAssetRef: reuploadRef
    });

    expect(missingReport).toMatchObject({
      currentSessionBytes: "missing-current-session-bytes-v1",
      availability: "missing-current-session-bytes-v1",
      requiresReupload: false,
      status: "fail-v1"
    });
    expect(missingReport.issues.map((issue) => issue.code)).toEqual([
      "byteAvailability.currentSessionBytes.missing"
    ]);

    expect(reuploadReport).toMatchObject({
      currentSessionBytes: "missing-current-session-bytes-v1",
      availability: "requires-reupload-v1",
      requiresReupload: true,
      status: "fail-v1"
    });
    expect(reuploadReport.issues.map((issue) => issue.code)).toEqual([
      "byteAvailability.currentSessionBytes.missing",
      "byteAvailability.requiresReupload"
    ]);
  });

  it("does not let a verified-pass summary stand in for current-session bytes", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const verifiedSummary = await createVerifiedSummarySnapshot(binaryAssetRef, 3);
    const availabilityReport = evaluatePackageBinaryCurrentSessionByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 3,
      binaryAssetRef,
      verifiedSummary
    });

    expect(availabilityReport).toMatchObject({
      currentSessionBytes: "missing-current-session-bytes-v1",
      availability: "stale-verified-summary-v1",
      verifiedSummaryStatus: "stale-v1",
      status: "fail-v1"
    });
    expect(availabilityReport.issues.map((issue) => issue.code)).toEqual([
      "byteAvailability.currentSessionBytes.missing",
      "byteAvailability.verifiedSummary.stale"
    ]);
  });

  it("expresses stale summary package revision, binary ref, digest, and byte length mismatches", async () => {
    const originalRef = createBinaryAssetReference();
    const verifiedSummary = await createVerifiedSummarySnapshot(originalRef, 4);
    const currentRef = createBinaryAssetReference({
      binaryAssetId: "bin_other_model_psd",
      packageRelativePath: "assets/sources/uploads/other_model.psd",
      digest: {
        algorithm: "sha256",
        hex: "0".repeat(64)
      },
      byteLength: 4
    });
    const availabilityReport = evaluatePackageBinaryCurrentSessionByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 5,
      binaryAssetRef: currentRef,
      verifiedSummary
    });
    const issueCodes = availabilityReport.issues.map((issue) => issue.code);

    expect(availabilityReport).toMatchObject({
      availability: "stale-verified-summary-v1",
      verifiedSummaryStatus: "stale-v1",
      status: "fail-v1"
    });
    expect(issueCodes).toEqual(expect.arrayContaining([
      "byteAvailability.packageRevision.mismatch",
      "byteAvailability.binaryAssetRef.mismatch",
      "byteAvailability.digest.mismatch",
      "byteAvailability.byteLength.mismatch",
      "byteAvailability.verifiedSummary.stale"
    ]));
  });

  it("expresses current-session digest and byte length mismatches without parser or decode claims", async () => {
    const binaryAssetRef = createBinaryAssetReference({
      digest: {
        algorithm: "sha256",
        hex: "0".repeat(64)
      },
      byteLength: 4
    });
    const verificationReport = await verifyPackageBinaryAssetBytes(
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
    const availabilityReport = evaluatePackageBinaryCurrentSessionByteAvailability({
      packageId: PACKAGE_ID,
      packageRevision: 1,
      binaryAssetRef,
      currentSessionVerificationReport: verificationReport
    });
    const issueCodes = availabilityReport.issues.map((issue) => issue.code);

    expect(availabilityReport).toMatchObject({
      currentSessionBytes: "available-current-session-bytes-v1",
      availability: "available-current-session-metadata-mismatch-v1",
      currentSessionVerificationStatus: "fail-v1",
      status: "fail-v1",
      expectedByteLength: 4,
      actualByteLength: 3
    });
    expect(issueCodes).toEqual(expect.arrayContaining([
      "byteAvailability.byteLength.mismatch",
      "byteAvailability.digest.mismatch"
    ]));
    expect(availabilityReport.actualDigest?.hex).toBe(TEST_BYTES_SHA256_HEX);
    expect("decodedImageSize" in availabilityReport).toBe(false);
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

const createVerifiedSummarySnapshot = async (
  binaryAssetRef: BinaryAssetReferenceDto,
  packageRevision: number
): Promise<PackageBinaryByteVerifiedSummarySnapshotDto> => {
  const verificationReport = await verifyPackageBinaryAssetBytes(
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
  const summary: PackageBinaryByteIntakeSummaryDto = createPackageBinaryByteIntakeSummary({
    filename: "sample_model.psd",
    binaryAssetRef,
    verificationReport
  });

  return PackageBinaryByteVerifiedSummarySnapshotSchema.parse({
    schemaVersion: "package-binary-byte-verified-summary-snapshot-v1" as const,
    packageId: PACKAGE_ID,
    packageRevision,
    summary
  });
};
