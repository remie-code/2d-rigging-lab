import { describe, expect, it } from "vitest";

import {
  readPackageBinaryFileEntry
} from "@private-2d-rigging-lab/package-format";
import type { PsdAdapterResultDto } from "@private-2d-rigging-lab/operation-core";
import { validatePackageRuntimeWithBinaryAssets } from "@private-2d-rigging-lab/validator-core";

import { createEditorSessionAdapter } from "./session-adapter.js";

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
      check.checkId.startsWith("byteIntake.")
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
