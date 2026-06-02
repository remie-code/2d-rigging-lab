import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageBinaryByteIntakeSummarySchema,
  SourceAssetSchema,
  type PackageBinaryByteIntakeSummaryDto,
  type SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import { projectEditorBinaryByteIntakeState } from "./binary-byte-intake-state.js";

const BINARY_ASSET_REF = BinaryAssetReferenceSchema.parse({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_editor_state_psd_source",
  packageRelativePath: "assets/sources/editor/state-source.psd",
  digest: {
    algorithm: "sha256",
    hex: "a".repeat(64)
  },
  byteLength: 3,
  mediaType: "application/octet-stream",
  storageStatus: "stored-package-local-v1",
  provenanceId: "prov_editor_state_psd_source",
  rightsAssetId: "src_editor_state_psd"
});

describe("editor binary byte intake state", () => {
  it("does not treat a verified summary as current-session bytes after browser-local reload", () => {
    const state = projectEditorBinaryByteIntakeState({
      sourceAssets: [createSourceAsset()],
      byteIntakeSummaries: [createVerifiedSummary()],
      packageLocalBinaryFilePaths: [],
      reloadSource: "browserLocalLoad"
    });

    expect(state.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_editor_state_psd_source",
        availabilityStatus: "requires-reupload-after-browser-local-load-v1",
        validatorBytesAvailability: "requiresReupload",
        sourceFilename: "state-source.psd",
        verificationStatus: "verified-pass-v1"
      })
    ]);
    expect(state.statusLabel).toBe("0 available / 1 reupload required / 0 missing binary byte asset");
  });

  it("only reports current-session availability when a package-local byte path is present", () => {
    const state = projectEditorBinaryByteIntakeState({
      sourceAssets: [createSourceAsset()],
      byteIntakeSummaries: [createVerifiedSummary()],
      packageLocalBinaryFilePaths: ["assets/sources/editor/state-source.psd"],
      reloadSource: "operationCommit"
    });

    expect(state.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_editor_state_psd_source",
        availabilityStatus: "available-current-editor-session-v1",
        validatorBytesAvailability: "available"
      })
    ]);
    expect(state.statusLabel).toBe("1 available / 0 reupload required / 0 missing binary byte asset");
  });

  it("does not project same-id summary metadata from a different package path", () => {
    const state = projectEditorBinaryByteIntakeState({
      sourceAssets: [createSourceAsset()],
      byteIntakeSummaries: [
        createVerifiedSummary({
          filename: "stale-old-path.psd",
          packageRelativePath: "assets/sources/editor/stale-old-path.psd",
          availability: "requires-reupload-v1"
        })
      ],
      packageLocalBinaryFilePaths: [],
      reloadSource: "operationCommit"
    });

    expect(state.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_editor_state_psd_source",
        packageRelativePath: "assets/sources/editor/state-source.psd",
        availabilityStatus: "missing-package-local-bytes-v1",
        validatorBytesAvailability: "missing",
        sourceFilename: null,
        verificationStatus: null
      })
    ]);
    expect(state.statusLabel).toBe("0 available / 0 reupload required / 1 missing binary byte asset");
  });
});

const createSourceAsset = (): SourceAssetDto => SourceAssetSchema.parse({
  sourceAssetId: "src_editor_state_psd",
  kind: "psd-source-v1",
  filePath: "assets/sources/editor/state-source.psd",
  contentHash: "sha256:editor-state-psd",
  importProfile: "layered-character-psd-profile-v1",
  layers: [],
  diagnostics: [],
  binaryAssetRef: BINARY_ASSET_REF
});

const createVerifiedSummary = (
  overrides: Partial<PackageBinaryByteIntakeSummaryDto> = {}
): PackageBinaryByteIntakeSummaryDto =>
  PackageBinaryByteIntakeSummarySchema.parse({
    schemaVersion: "package-binary-byte-intake-summary-v1",
    intakeKind: "browser-file-input-v1",
    filename: "state-source.psd",
    binaryAssetId: BINARY_ASSET_REF.binaryAssetId,
    packageRelativePath: BINARY_ASSET_REF.packageRelativePath,
    digest: BINARY_ASSET_REF.digest,
    byteLength: BINARY_ASSET_REF.byteLength,
    mediaType: BINARY_ASSET_REF.mediaType,
    storageStatus: BINARY_ASSET_REF.storageStatus,
    availability: "available-package-local-bytes-v1",
    provenanceId: BINARY_ASSET_REF.provenanceId,
    rightsAssetId: BINARY_ASSET_REF.rightsAssetId,
    verificationStatus: "verified-pass-v1",
    ...overrides
  });
