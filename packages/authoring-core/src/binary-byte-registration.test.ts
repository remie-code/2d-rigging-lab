import { describe, expect, it } from "vitest";

import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";
import {
  BinaryAssetReferenceSchema,
  createPackageBinaryByteIntakeSummary,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  computePackageBinarySha256Digest,
  getPackageBinaryByteLength,
  verifyPackageBinaryAssetBytes
} from "@private-2d-rigging-lab/package-format";

import type { AuthoringSession } from "./authoring-session.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import {
  getAuthoringSessionBinaryAssetIndex,
  getAuthoringSessionBinaryFileEntries,
  getAuthoringSessionByteIntakeSummaries,
  registerAuthoringSessionBinaryBytes
} from "./binary-byte-registration.js";

describe("authoring session binary byte registration", () => {
  it("registers actual package-local bytes with binary index and byte-intake evidence", async () => {
    const session = createFixtureSession();
    const bytes = new Uint8Array([0x52, 0x49, 0x47]);
    const binaryAssetRef = await createBinaryAssetReference(bytes);
    const verificationReport = await verifyPackageBinaryAssetBytes(
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
    const byteIntakeSummary = createPackageBinaryByteIntakeSummary({
      filename: "source.psd",
      binaryAssetRef,
      verificationReport
    });

    const result = registerAuthoringSessionBinaryBytes(session, {
      binaryAssetRef,
      bytes,
      role: "source-original-v1",
      sourceAssetId: "src_authoring_binary",
      createdByOperationId: "op_authoring_register_binary",
      byteIntakeSummary
    });

    expect(result.fileEntry).toMatchObject({
      path: "assets/sources/authoring/source.psd",
      mediaType: "application/octet-stream",
      binaryAssetId: "bin_authoring_source"
    });
    expect(result.fileEntry.bytes).toEqual(bytes);
    expect(result.fileEntry.bytes).not.toBe(bytes);
    expect(result.binaryAssetEntry).toMatchObject({
      binaryAssetId: "bin_authoring_source",
      role: "source-original-v1",
      sourceAssetId: "src_authoring_binary",
      createdByOperationId: "op_authoring_register_binary",
      storageStatus: "stored-package-local-v1"
    });
    expect(result.byteIntakeSummary).toMatchObject({
      filename: "source.psd",
      availability: "available-package-local-bytes-v1",
      verificationStatus: "verified-pass-v1"
    });

    const fileEntries = getAuthoringSessionBinaryFileEntries(session);
    const binaryAssetIndex = getAuthoringSessionBinaryAssetIndex(session);
    const byteIntakeSummaries = getAuthoringSessionByteIntakeSummaries(session);

    expect(fileEntries).toHaveLength(1);
    expect(fileEntries[0]?.bytes).toEqual(bytes);
    expect(binaryAssetIndex.assets).toEqual([result.binaryAssetEntry]);
    expect(byteIntakeSummaries).toEqual([byteIntakeSummary]);

    result.fileEntry.bytes[0] = 0xff;
    expect(getAuthoringSessionBinaryFileEntries(session)[0]?.bytes[0]).toBe(0x52);
  });
});

const createBinaryAssetReference = async (bytes: Uint8Array) => {
  const digestResult = await computePackageBinarySha256Digest(bytes);
  if (digestResult.status !== "computed") {
    throw new Error("SHA-256 digest support is required for this test.");
  }

  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_authoring_source",
    packageRelativePath: "assets/sources/authoring/source.psd",
    digest: digestResult.digest,
    byteLength: getPackageBinaryByteLength(bytes),
    mediaType: "application/octet-stream",
    storageStatus: "stored-package-local-v1",
    provenanceId: "prov_authoring_register_binary",
    rightsAssetId: "src_authoring_binary"
  });
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_binary_byte_registration_test"),
    packageDisplayName: "Binary Byte Registration Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
