import { describe, expect, it } from "vitest";
import {
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { BinaryAssetReferenceDto } from "@private-2d-rigging-lab/package-format";

import {
  createImportPsdSourceAssetOperationRequest,
  createImportSplitPngSourceAssetOperationRequest
} from "./source-import-command.js";

describe("editor source import command builders", () => {
  it("preserves split PNG source and texture binary refs as metadata-only payload fields", () => {
    const sourceBinaryAssetRef = createBinaryAssetReference({
      binaryAssetId: "bin_editor_split_manifest",
      packageRelativePath: "assets/sources/editor/split-manifest.json",
      mediaType: "application/octet-stream",
      storageStatus: "missing-package-local-bytes-v1",
      digestHex: "e".repeat(64)
    });
    const textureBinaryAssetRef = createBinaryAssetReference({
      binaryAssetId: "bin_editor_split_texture",
      packageRelativePath: "assets/textures/editor/face.preview.png",
      mediaType: "image/png",
      storageStatus: "storage-unsupported-v1",
      digestHex: "f".repeat(64)
    });

    const request = createImportSplitPngSourceAssetOperationRequest({
      sourceAssetId: SourceAssetIdSchema.parse("src_editor_binary_split"),
      manifestPath: "assets/sources/editor/split-manifest.json",
      contentHash: "sha256:editor-split-manifest",
      binaryAssetRef: sourceBinaryAssetRef,
      defaultPartId: PartIdSchema.parse("part_root"),
      placementPolicy: "use-metadata",
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face.png",
          normalizedName: "face",
          groupPath: ["Head"],
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: [],
          texturePreviewBinaryAssetRef: textureBinaryAssetRef,
          textureId: TextureIdSchema.parse("tex_face"),
          targetPartId: PartIdSchema.parse("part_root")
        }
      ],
      rights: {
        rightsStatus: "needs_review",
        license: "private-review",
        redistributionAllowed: false
      },
      provenance: {
        creator: "Editor Metadata Artist",
        license: "private-review",
        redistributionAllowed: false,
        aiUsed: false,
        transformHistory: ["metadata-only-binary-ref"]
      }
    }, 0);

    expect(request.operationType).toBe("importSplitPngSourceAsset");
    if (request.operationType !== "importSplitPngSourceAsset") {
      throw new Error("Expected split PNG source import request.");
    }
    expect(request.payload.binaryAssetRef).toEqual(sourceBinaryAssetRef);
    expect(request.payload.layers[0]?.texturePreviewBinaryAssetRef).toEqual(textureBinaryAssetRef);
    expect(JSON.stringify(request)).not.toMatch(/FileReader|showOpenFilePicker|readAs|decoded from bytes|archive/i);
  });

  it("preserves PSD source and texture binary refs without adding parser or decode fields", () => {
    const sourceBinaryAssetRef = createBinaryAssetReference({
      binaryAssetId: "bin_editor_psd_source",
      packageRelativePath: "assets/sources/editor/source.psd",
      mediaType: "application/vnd.adobe.photoshop",
      storageStatus: "stored-package-local-v1",
      digestHex: "1".repeat(64)
    });
    const textureBinaryAssetRef = createBinaryAssetReference({
      binaryAssetId: "bin_editor_psd_texture",
      packageRelativePath: "assets/sources/editor/face.preview.png",
      mediaType: "image/png",
      storageStatus: "missing-package-local-bytes-v1",
      digestHex: "2".repeat(64)
    });

    const request = createImportPsdSourceAssetOperationRequest({
      sourceAssetId: SourceAssetIdSchema.parse("src_editor_binary_psd"),
      fileRef: {
        packageRelativePath: "assets/sources/editor/source.psd",
        contentHash: "sha256:editor-psd-source",
        binaryAssetRef: sourceBinaryAssetRef
      },
      adapterResult: {
        schemaVersion: "psd-adapter-result-v1",
        sourceProfile: "layered-character-psd-profile-v1",
        adapterName: "manual-psd-profile-entry",
        canvas: {
          width: 2048,
          height: 3072
        },
        sourceGroups: [],
        sourceLayers: [
          {
            sourceLayerId: "layer_face",
            originalName: "Face",
            normalizedName: "face",
            groupPath: ["Head"],
            sourceOrder: 0,
            bounds: { x: 0, y: 0, width: 64, height: 64 },
            visibleInSource: true,
            opacityInSource: 1,
            role: "editableLayer",
            unsupportedFeatures: [],
            texturePreviewBinaryAssetRef: textureBinaryAssetRef,
            textureId: TextureIdSchema.parse("tex_face"),
            targetPartId: PartIdSchema.parse("part_root")
          }
        ],
        unsupportedFeatures: [],
        diagnostics: []
      },
      rights: {
        creator: "Editor Metadata Artist",
        license: "private-review",
        redistributionAllowed: false,
        aiUsed: false
      }
    }, 0);

    expect(request.operationType).toBe("importPsdSourceAsset");
    if (request.operationType !== "importPsdSourceAsset") {
      throw new Error("Expected PSD source import request.");
    }
    expect(request.payload.fileRef.binaryAssetRef).toEqual(sourceBinaryAssetRef);
    expect(request.payload.adapterResult?.sourceLayers[0]?.texturePreviewBinaryAssetRef).toEqual(
      textureBinaryAssetRef
    );
    expect(JSON.stringify(request)).not.toMatch(/FileReader|showOpenFilePicker|readAs|decoded from bytes|archive/i);
  });
});

const createBinaryAssetReference = (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly mediaType: string;
  readonly storageStatus: BinaryAssetReferenceDto["storageStatus"];
  readonly digestHex: string;
}): BinaryAssetReferenceDto => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: input.binaryAssetId,
  packageRelativePath: input.packageRelativePath,
  digest: {
    algorithm: "sha256",
    hex: input.digestHex
  },
  byteLength: 1024,
  mediaType: input.mediaType,
  storageStatus: input.storageStatus,
  provenanceId: ProvenanceIdSchema.parse("prov_editor_binary_source"),
  rightsAssetId: "src_editor_binary"
});
