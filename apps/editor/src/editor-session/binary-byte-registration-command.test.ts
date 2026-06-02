import { describe, expect, it } from "vitest";

import {
  BinaryAssetIndexFileSchema,
  BinaryAssetReferenceSchema,
  PackageBinaryByteIntakeSummarySchema,
  SourceAssetSchema,
  readPackageBinaryFileEntry,
  type BinaryAssetReferenceDto,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { PsdAdapterResultDto } from "@private-2d-rigging-lab/operation-core";
import {
  validatePackageRuntimeWithBinaryAssets,
  type ValidationCheckResultDto
} from "@private-2d-rigging-lab/validator-core";

import { createBrowserSamplePackageDocument } from "./browser-sample-package.js";
import { createEditorSessionAdapter } from "./session-adapter.js";
import { createEditorSessionByteIntakePreflightAssets } from "./session-byte-availability-bridge.js";

describe("editor session binary byte registration", () => {
  it("commits PSD source bytes through operation log and package-local binary evidence", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-02T01:00:00.000Z")
    });

    const result = await adapter.commitImportPsdSourceAssetWithBinaryBytes({
      operationId: "op_editor_import_psd_binary_session",
      sourceAssetId: "src_editor_binary_psd_session",
      fileRef: {
        packageRelativePath: "assets/sources/editor/session-source.psd"
      },
      selectedFile: {
        fileName: "session-source.psd",
        bytes: new Uint8Array([0x41, 0x42, 0x43]),
        declaredMediaType: "application/octet-stream"
      },
      adapterResult: createParserFreePsdAdapterResult(),
      rights: {
        creator: "Editor Session Artist",
        license: "private-session-test",
        redistributionAllowed: false,
        aiUsed: false
      }
    });

    const sourceAsset = result.reloadedDocument.assets.sourceManifest.sourceAssets.find(
      (candidate) => candidate.sourceAssetId === "src_editor_binary_psd_session"
    );
    const binaryEntry = readPackageBinaryFileEntry(
      result.packageInMemoryFileSet,
      "assets/sources/editor/session-source.psd"
    );

    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("importPsdSourceAsset");
    expect(result.operationLogEntries).toHaveLength(1);
    expect(result.operationLogJsonl).toContain("importPsdSourceAsset");
    expect(result.operationLogJsonl).toContain("binaryAssetRef");
    expect(result.operationLogJsonl).not.toContain("selectedFile");
    expect(result.operationLogJsonl).not.toContain("\"0\":65");
    expect(sourceAsset?.binaryAssetRef).toMatchObject({
      binaryAssetId: "bin_editor_binary_psd_session_source",
      packageRelativePath: "assets/sources/editor/session-source.psd",
      byteLength: 3,
      mediaType: "application/octet-stream",
      storageStatus: "stored-package-local-v1",
      provenanceId: "prov_editor_import_psd_binary_session",
      rightsAssetId: "src_editor_binary_psd_session"
    });
    expect(binaryEntry?.bytes).toEqual(new Uint8Array([0x41, 0x42, 0x43]));
    expect(result.packageFilePaths).not.toContain("assets/sources/editor/session-source.psd");
    expect(result.packageInMemoryFilePaths).toContain("assets/sources/editor/session-source.psd");
    expect(result.binaryByteEvidence.packageLocalBinaryFilePaths).toEqual([
      "assets/sources/editor/session-source.psd"
    ]);
    expect(result.binaryByteEvidence.binaryAssetIndex.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_editor_binary_psd_session_source",
        role: "source-original-v1",
        sourceAssetId: "src_editor_binary_psd_session",
        createdByOperationId: "op_editor_import_psd_binary_session"
      })
    ]);
    expect(result.binaryByteEvidence.byteIntakeSummaries).toEqual([
      expect.objectContaining({
        filename: "session-source.psd",
        availability: "available-package-local-bytes-v1",
        verificationStatus: "verified-pass-v1",
        binaryAssetId: "bin_editor_binary_psd_session_source"
      })
    ]);
    expect(result.binaryByteEvidence.byteIntakePreflight.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_editor_binary_psd_session_source",
        packageRelativePath: "assets/sources/editor/session-source.psd",
        bytesAvailability: "available",
        currentSessionVerificationReport: expect.objectContaining({
          status: "pass",
          binaryAssetId: "bin_editor_binary_psd_session_source",
          packageRelativePath: "assets/sources/editor/session-source.psd",
          actualByteLength: 3,
          issues: []
        }),
        bytes: new Uint8Array([0x41, 0x42, 0x43])
      })
    ]);
    expect(result.binaryByteEvidence.browserStorage).toMatchObject({
      packageLocalStorageScope: "current-editor-session-memory-v1",
      metadataSnapshotPersistence: "bytes-not-persisted-by-browser-metadata-snapshot-v1",
      reloadPolicy: "requires-browser-file-reupload-after-metadata-only-reload-v1",
      parserSupport: "not-claimed-v1",
      imageDecodeSupport: "not-claimed-v1",
      archiveSupport: "not-claimed-v1"
    });

    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: result.reloadedDocument,
      binaryFileSet: result.packageInMemoryFileSet,
      binaryAssetIndex: result.binaryByteEvidence.binaryAssetIndex,
      byteIntakePreflight: result.binaryByteEvidence.byteIntakePreflight,
      createdAt: "2026-06-02T01:00:00.000Z"
    });
    const binaryRelatedChecks = report.checks.filter((check) =>
      check.checkId.startsWith("binary.") ||
      check.checkId.startsWith("rights.binary") ||
      check.checkId.startsWith("byteIntake.") ||
      check.checkId.startsWith("byteAvailability.")
    );

    expect(binaryRelatedChecks.filter((check) => check.status === "fail")).toEqual([]);
    expect(binaryRelatedChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "byteIntake.unsupportedClaim",
          status: "not_applicable",
          phase: "source_import"
        })
      ])
    );
  });

  it("does not let a retained verified summary satisfy direct validation without current-session bytes", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-02T01:05:00.000Z")
    });

    await adapter.commitImportPsdSourceAssetWithBinaryBytes({
      operationId: "op_editor_import_psd_binary_stale_summary",
      sourceAssetId: "src_editor_binary_psd_stale_summary",
      fileRef: {
        packageRelativePath: "assets/sources/editor/stale-summary.psd"
      },
      selectedFile: {
        fileName: "stale-summary.psd",
        bytes: new Uint8Array([0x50, 0x53, 0x44]),
        declaredMediaType: "application/octet-stream"
      },
      adapterResult: createParserFreePsdAdapterResult(),
      rights: {
        creator: "Editor Session Artist",
        license: "private-session-test",
        redistributionAllowed: false,
        aiUsed: false
      }
    });

    const binaryAssets = adapter.authoringSession.binaryAssets;
    if (binaryAssets === undefined) {
      throw new Error("Expected registered binary byte evidence.");
    }
    binaryAssets.fileEntries.splice(0);

    const snapshot = adapter.createPersistenceSnapshot();
    const preflightAsset = snapshot.binaryByteEvidence.byteIntakePreflight.assets?.[0];
    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: snapshot.document,
      binaryFileSet: snapshot.packageInMemoryFileSet,
      binaryAssetIndex: snapshot.binaryByteEvidence.binaryAssetIndex,
      byteIntakePreflight: snapshot.binaryByteEvidence.byteIntakePreflight,
      createdAt: "2026-06-02T01:05:00.000Z"
    });

    expect(snapshot.binaryByteEvidence.packageLocalBinaryFilePaths).toEqual([]);
    expect(snapshot.packageInMemoryFilePaths).not.toContain("assets/sources/editor/stale-summary.psd");
    expect(preflightAsset).toMatchObject({
      binaryAssetId: "bin_editor_binary_psd_stale_summary_source",
      packageRelativePath: "assets/sources/editor/stale-summary.psd",
      bytesAvailability: "requiresReupload",
      intakeSummary: expect.objectContaining({
        availability: "available-package-local-bytes-v1",
        verificationStatus: "verified-pass-v1"
      })
    });
    expect(preflightAsset).not.toHaveProperty("bytes");
    expectStaleByteIntakeRejectedByIntegratedValidation(report.checks, {
      binaryAssetId: "bin_editor_binary_psd_stale_summary_source",
      packageRelativePath: "assets/sources/editor/stale-summary.psd"
    });
  });

  it("does not hide a current document ref behind a stale same-id summary at a different path", () => {
    const staleSummaryRef = createBinaryAssetReference({
      packageRelativePath: "assets/sources/editor/path-dedup-old.psd"
    });
    const currentDocumentRef = createBinaryAssetReference({
      packageRelativePath: "assets/sources/editor/path-dedup-current.psd"
    });

    const assets = createEditorSessionByteIntakePreflightAssets({
      packageDocument: createPackageDocumentWithBinaryRef(currentDocumentRef),
      binaryAssetIndex: BinaryAssetIndexFileSchema.parse({
        schemaVersion: "binary-asset-index-v1",
        assets: [{
          binaryAssetId: currentDocumentRef.binaryAssetId,
          role: "source-original-v1",
          packageRelativePath: currentDocumentRef.packageRelativePath,
          digest: currentDocumentRef.digest,
          byteLength: currentDocumentRef.byteLength,
          mediaType: currentDocumentRef.mediaType,
          storageStatus: currentDocumentRef.storageStatus,
          provenanceId: currentDocumentRef.provenanceId,
          rightsAssetId: currentDocumentRef.rightsAssetId,
          sourceAssetId: "src_editor_binary_path_dedup",
          createdByOperationId: "op_editor_binary_path_dedup"
        }]
      }),
      byteIntakeSummaries: [createVerifiedSummary(staleSummaryRef)],
      binaryFileEntries: []
    });

    expect(assets.map((asset) =>
      `${asset.binaryAssetId}@${asset.packageRelativePath}`
    ).sort()).toEqual([
      "bin_editor_binary_path_dedup_source@assets/sources/editor/path-dedup-current.psd",
      "bin_editor_binary_path_dedup_source@assets/sources/editor/path-dedup-old.psd"
    ]);
    expect(assets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        binaryAssetId: "bin_editor_binary_path_dedup_source",
        packageRelativePath: "assets/sources/editor/path-dedup-old.psd",
        bytesAvailability: "requiresReupload",
        intakeSummary: expect.objectContaining({
          packageRelativePath: "assets/sources/editor/path-dedup-old.psd",
          verificationStatus: "verified-pass-v1"
        })
      }),
      expect.objectContaining({
        binaryAssetId: "bin_editor_binary_path_dedup_source",
        packageRelativePath: "assets/sources/editor/path-dedup-current.psd",
        bytesAvailability: "requiresReupload"
      })
    ]));
  });
});

const expectStaleByteIntakeRejectedByIntegratedValidation = (
  checks: readonly ValidationCheckResultDto[],
  expected: {
    readonly binaryAssetId: string;
    readonly packageRelativePath: string;
  }
): void => {
  const targetFailEvidence = checks
    .filter((check) =>
      check.status === "fail" &&
      check.evidence.includes(`binaryAssetId=${expected.binaryAssetId}`) &&
      check.evidence.includes(`packageRelativePath=${expected.packageRelativePath}`)
    )
    .flatMap((check) => check.evidence);

  expect(targetFailEvidence).toEqual(expect.arrayContaining([
    `binaryAssetId=${expected.binaryAssetId}`,
    `packageRelativePath=${expected.packageRelativePath}`,
    "availability=requires-reupload-v1",
    "availabilityStatus=fail-v1",
    "currentSessionBytes=missing-current-session-bytes-v1",
    "currentSessionVerificationStatus=not-supplied-v1",
    "requiresReupload=true",
    "verifiedSummaryStatus=stale-v1"
  ]));
};

const createPackageDocumentWithBinaryRef = (
  binaryAssetRef: BinaryAssetReferenceDto
): PackageDocumentDto => {
  const document = createBrowserSamplePackageDocument();

  return {
    ...document,
    manifest: {
      ...document.manifest,
      packageRevision: 1
    },
    assets: {
      ...document.assets,
      sourceManifest: {
        ...document.assets.sourceManifest,
        sourceAssets: [SourceAssetSchema.parse({
          sourceAssetId: "src_editor_binary_path_dedup",
          kind: "psd-source-v1",
          filePath: binaryAssetRef.packageRelativePath,
          contentHash: `${binaryAssetRef.digest.algorithm}:${binaryAssetRef.digest.hex}`,
          importProfile: "layered-character-psd-profile-v1",
          layers: [],
          diagnostics: [],
          binaryAssetRef
        })]
      }
    }
  };
};

const createBinaryAssetReference = (input: {
  readonly packageRelativePath: string;
}): BinaryAssetReferenceDto => BinaryAssetReferenceSchema.parse({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_editor_binary_path_dedup_source",
  packageRelativePath: input.packageRelativePath,
  digest: {
    algorithm: "sha256",
    hex: "b".repeat(64)
  },
  byteLength: 3,
  mediaType: "application/octet-stream",
  storageStatus: "stored-package-local-v1",
  provenanceId: "prov_editor_binary_path_dedup",
  rightsAssetId: "src_editor_binary_path_dedup"
});

const createVerifiedSummary = (
  binaryAssetRef: BinaryAssetReferenceDto
) => PackageBinaryByteIntakeSummarySchema.parse({
  schemaVersion: "package-binary-byte-intake-summary-v1",
  intakeKind: "browser-file-input-v1",
  filename: binaryAssetRef.packageRelativePath.split("/").at(-1) ?? "path-dedup.psd",
  binaryAssetId: binaryAssetRef.binaryAssetId,
  packageRelativePath: binaryAssetRef.packageRelativePath,
  digest: binaryAssetRef.digest,
  byteLength: binaryAssetRef.byteLength,
  mediaType: binaryAssetRef.mediaType,
  storageStatus: binaryAssetRef.storageStatus,
  availability: "available-package-local-bytes-v1",
  provenanceId: binaryAssetRef.provenanceId,
  rightsAssetId: binaryAssetRef.rightsAssetId,
  verificationStatus: "verified-pass-v1"
});

const createParserFreePsdAdapterResult = (): PsdAdapterResultDto => ({
  schemaVersion: "psd-adapter-result-v1",
  sourceProfile: "layered-character-psd-profile-v1",
  adapterName: "manual-byte-registration-profile",
  canvas: {
    width: 64,
    height: 64
  },
  sourceGroups: [],
  sourceLayers: [
    {
      sourceLayerId: "layer_byte_reference",
      originalName: "Byte Reference",
      normalizedName: "byte_reference",
      groupPath: [],
      sourceOrder: 0,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "referenceOnly",
      unsupportedFeatures: []
    }
  ],
  unsupportedFeatures: [],
  diagnostics: []
});
