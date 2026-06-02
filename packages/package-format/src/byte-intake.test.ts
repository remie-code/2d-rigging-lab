import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageBinaryByteIntakeSummarySchema,
  createPackageBinaryByteIntakeSummary,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto
} from "./index.js";

const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("package binary byte intake summary", () => {
  it("summarizes browser file bytes with package-local binary evidence", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const fileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: binaryAssetRef.packageRelativePath,
        bytes: TEST_BYTES,
        mediaType: binaryAssetRef.mediaType,
        binaryAssetId: binaryAssetRef.binaryAssetId
      })
    ]);
    const verificationReport = await verifyPackageBinaryAssetBytes(fileSet, binaryAssetRef);
    const summary = createPackageBinaryByteIntakeSummary({
      filename: "sample_model.psd",
      binaryAssetRef,
      verificationReport
    });

    expect(summary).toMatchObject({
      schemaVersion: "package-binary-byte-intake-summary-v1",
      intakeKind: "browser-file-input-v1",
      filename: "sample_model.psd",
      binaryAssetId: "bin_sample_model_psd",
      packageRelativePath: "assets/sources/uploads/sample_model.psd",
      byteLength: 3,
      mediaType: "image/vnd.adobe.photoshop",
      storageStatus: "stored-package-local-v1",
      availability: "available-package-local-bytes-v1",
      provenanceId: "prov_sample_model_psd",
      rightsAssetId: "src_sample_model_psd",
      verificationStatus: "verified-pass-v1"
    });
    expect(summary.digest).toEqual({ algorithm: "sha256", hex: TEST_BYTES_SHA256_HEX });
  });

  it("keeps storage status separate from ephemeral and reupload availability", async () => {
    const binaryAssetRef = createBinaryAssetReference({
      storageStatus: "storage-unsupported-v1"
    });
    const availableFileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: binaryAssetRef.packageRelativePath,
        bytes: TEST_BYTES,
        mediaType: binaryAssetRef.mediaType,
        binaryAssetId: binaryAssetRef.binaryAssetId
      })
    ]);
    const availableReport = await verifyPackageBinaryAssetBytes(availableFileSet, binaryAssetRef);
    const availableSummary = createPackageBinaryByteIntakeSummary({
      filename: "sample_model.psd",
      binaryAssetRef,
      verificationReport: availableReport
    });
    const missingReport = await verifyPackageBinaryAssetBytes(
      createPackageInMemoryFileSet([]),
      binaryAssetRef
    );
    const missingSummary = createPackageBinaryByteIntakeSummary({
      filename: "sample_model.psd",
      binaryAssetRef,
      verificationReport: missingReport
    });

    expect(availableSummary).toMatchObject({
      storageStatus: "storage-unsupported-v1",
      availability: "ephemeral-browser-file-v1",
      verificationStatus: "verified-pass-v1"
    });
    expect(missingSummary).toMatchObject({
      storageStatus: "storage-unsupported-v1",
      availability: "requires-reupload-v1",
      verificationStatus: "verified-fail-v1"
    });
  });

  it("represents available bytes with mismatched metadata without decode claims", async () => {
    const binaryAssetRef = createBinaryAssetReference({
      byteLength: 4,
      mediaType: "application/octet-stream"
    });
    const fileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: binaryAssetRef.packageRelativePath,
        bytes: TEST_BYTES,
        mediaType: "image/vnd.adobe.photoshop",
        binaryAssetId: binaryAssetRef.binaryAssetId
      })
    ]);
    const verificationReport = await verifyPackageBinaryAssetBytes(fileSet, binaryAssetRef);
    const summary = createPackageBinaryByteIntakeSummary({
      filename: "sample_model.psd",
      binaryAssetRef,
      verificationReport
    });

    expect(verificationReport.status).toBe("fail");
    expect(summary).toMatchObject({
      availability: "available-metadata-mismatch-v1",
      verificationStatus: "verified-fail-v1"
    });
    expect(PackageBinaryByteIntakeSummarySchema.safeParse({
      ...summary,
      bytesBase64: "AAAA",
      decodedImageSize: { width: 1, height: 1 }
    }).success).toBe(false);
  });

  it("rejects availability overrides that contradict missing-byte verification", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const missingReport = await verifyPackageBinaryAssetBytes(
      createPackageInMemoryFileSet([]),
      binaryAssetRef
    );

    expect(() => createPackageBinaryByteIntakeSummary({
      filename: "sample_model.psd",
      binaryAssetRef,
      verificationReport: missingReport,
      availability: "available-package-local-bytes-v1"
    })).toThrow(/does not match derived availability "missing-package-local-bytes-v1"/);
  });

  it("rejects stale verification reports with mismatched expected metadata", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const fileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: binaryAssetRef.packageRelativePath,
        bytes: TEST_BYTES,
        mediaType: binaryAssetRef.mediaType,
        binaryAssetId: binaryAssetRef.binaryAssetId
      })
    ]);
    const verificationReport = await verifyPackageBinaryAssetBytes(fileSet, binaryAssetRef);
    const staleReport = {
      ...verificationReport,
      expectedByteLength: 4,
      expectedDigest: {
        algorithm: "sha256" as const,
        hex: "0".repeat(64)
      },
      expectedMediaType: "application/octet-stream"
    };

    expect(staleReport.binaryAssetId).toBe(binaryAssetRef.binaryAssetId);
    expect(staleReport.packageRelativePath).toBe(binaryAssetRef.packageRelativePath);
    expect(() => createPackageBinaryByteIntakeSummary({
      filename: "sample_model.psd",
      binaryAssetRef,
      verificationReport: staleReport
    })).toThrow(/Verification report does not match binary asset "bin_sample_model_psd"/);
  });

  it("rejects path-like filenames and invalid availability values", () => {
    const validSummary = createPackageBinaryByteIntakeSummary({
      filename: "sample_model.psd",
      binaryAssetRef: createBinaryAssetReference()
    });

    for (const filename of ["assets/sources/source.psd", "C:\\source.psd", ""]) {
      expect(PackageBinaryByteIntakeSummarySchema.safeParse({
        ...validSummary,
        filename
      }).success).toBe(false);
    }

    expect(PackageBinaryByteIntakeSummarySchema.safeParse({
      ...validSummary,
      availability: "available"
    }).success).toBe(false);
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
