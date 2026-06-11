import { describe, expect, it } from "vitest";

import { ProvenanceIdSchema, SourceAssetIdSchema } from "@private-2d-rigging-lab/contracts";
import type { PsdAdapterResultDto } from "@private-2d-rigging-lab/operation-core";

import type { BrowserPsdMaterializedLayerBytes } from "../../../editor-workflow/browser-psd-parser-adapter";
import {
  createPsdImportPreviewLayerDescriptors,
  resolvePsdPreviewCanvasBounds
} from "./psd-import-preview";

describe("PSD import preview projection", () => {
  it("uses effective visibility while preserving parent-hidden/local-visible distinction", () => {
    const adapterResult = createAdapterResult();
    const descriptors = createPsdImportPreviewLayerDescriptors({
      adapterResult,
      materializedLayerBytes: [
        createLayerBytes("layer_parent_hidden"),
        createLayerBytes("layer_local_hidden"),
        createLayerBytes("layer_back"),
        createLayerBytes("layer_front")
      ]
    });

    expect(descriptors.map((descriptor) => descriptor.sourceLayerId)).toEqual([
      "layer_back",
      "layer_front"
    ]);
    expect(descriptors[0]?.opacity).toBeCloseTo(0.4);
    expect(adapterResult.sourceLayers.find((layer) => layer.sourceLayerId === "layer_parent_hidden"))
      .toMatchObject({
        visibleInSource: false,
        localVisibleInSource: true
      });
  });

  it("resolves PSD canvas bounds independently from existing workspace canvas state", () => {
    expect(resolvePsdPreviewCanvasBounds(createAdapterResult()).width).toBe(256);
    expect(resolvePsdPreviewCanvasBounds({
      ...createAdapterResult(),
      canvas: {
        width: 512,
        height: 512
      }
    })).toEqual({
      x: 0,
      y: 0,
      width: 512,
      height: 512
    });
  });
});

function createAdapterResult(): PsdAdapterResultDto {
  return {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "preview-test-adapter",
    canvas: {
      width: 256,
      height: 128,
      bounds: { x: 0, y: 0, width: 256, height: 128 }
    },
    sourceGroups: [
      {
        sourceGroupId: "group_hidden",
        originalName: "Hidden Group",
        normalizedName: "hidden group",
        groupPath: ["Hidden Group"],
        sourceOrder: 0,
        visibleInSource: false,
        localVisibleInSource: false,
        opacityInSource: 1,
        unsupportedFeatures: []
      },
      {
        sourceGroupId: "group_visible",
        originalName: "Visible Group",
        normalizedName: "visible group",
        groupPath: ["Visible Group"],
        sourceOrder: 1,
        visibleInSource: true,
        localVisibleInSource: true,
        opacityInSource: 0.5,
        unsupportedFeatures: []
      }
    ],
    sourceLayers: [
      {
        sourceLayerId: "layer_parent_hidden",
        originalName: "Parent Hidden",
        normalizedName: "parent hidden",
        parentGroupId: "group_hidden",
        groupPath: ["Hidden Group"],
        sourceOrder: 3,
        bounds: { x: 0, y: 0, width: 8, height: 8 },
        visibleInSource: false,
        localVisibleInSource: true,
        opacityInSource: 1,
        role: "editableLayer",
        unsupportedFeatures: []
      },
      {
        sourceLayerId: "layer_local_hidden",
        originalName: "Local Hidden",
        normalizedName: "local hidden",
        groupPath: [],
        sourceOrder: 2,
        bounds: { x: 0, y: 0, width: 8, height: 8 },
        visibleInSource: false,
        localVisibleInSource: false,
        opacityInSource: 1,
        role: "editableLayer",
        unsupportedFeatures: []
      },
      {
        sourceLayerId: "layer_back",
        originalName: "Back",
        normalizedName: "back",
        parentGroupId: "group_visible",
        groupPath: ["Visible Group"],
        sourceOrder: 4,
        bounds: { x: 0, y: 0, width: 8, height: 8 },
        visibleInSource: true,
        localVisibleInSource: true,
        opacityInSource: 0.8,
        role: "editableLayer",
        unsupportedFeatures: []
      },
      {
        sourceLayerId: "layer_front",
        originalName: "Front",
        normalizedName: "front",
        groupPath: [],
        sourceOrder: 1,
        bounds: { x: 4, y: 4, width: 8, height: 8 },
        visibleInSource: true,
        localVisibleInSource: true,
        opacityInSource: 1,
        role: "editableLayer",
        unsupportedFeatures: []
      }
    ],
    unsupportedFeatures: [],
    diagnostics: []
  };
}

function createLayerBytes(sourceLayerId: string): BrowserPsdMaterializedLayerBytes {
  return {
    sourceLayerId,
    materializationId: `mat_${sourceLayerId}`,
    binaryAssetRef: {
      referenceKind: "package-binary-asset-ref-v1",
      binaryAssetId: `bin_${sourceLayerId}`,
      packageRelativePath: `assets/textures/${sourceLayerId}.raw-rgba`,
      digest: {
        algorithm: "sha256",
        hex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      },
      byteLength: 4,
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      storageStatus: "stored-package-local-v1",
      provenanceId: ProvenanceIdSchema.parse("prov_preview"),
      rightsAssetId: SourceAssetIdSchema.parse("src_preview")
    },
    width: 1,
    height: 1,
    bytes: new Uint8Array([255, 255, 255, 255])
  };
}
