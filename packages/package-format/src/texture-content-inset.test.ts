import { describe, expect, it } from "vitest";

import {
  TextureAtlasEntrySchema,
  TextureContentInsetSchema
} from "./texture-atlas.js";
import { PsdLayerMaterializationEvidenceSchema } from "./psd-source-evidence.js";

describe("TextureContentInsetSchema", () => {
  it("accepts non-negative integer insets on all four sides", () => {
    const parsed = TextureContentInsetSchema.parse({ left: 4, top: 4, right: 4, bottom: 4 });
    expect(parsed).toEqual({ left: 4, top: 4, right: 4, bottom: 4 });
  });

  it("rejects negative or fractional insets", () => {
    expect(() => TextureContentInsetSchema.parse({ left: -1, top: 0, right: 0, bottom: 0 })).toThrow();
    expect(() => TextureContentInsetSchema.parse({ left: 0.5, top: 0, right: 0, bottom: 0 })).toThrow();
  });
});

describe("TextureAtlasEntrySchema padded raster fields", () => {
  it("carries padded dimensions and content inset that reconstruct content dims", () => {
    const entry = TextureAtlasEntrySchema.parse({
      textureId: "tex_face_rgba",
      filePath: "assets/textures/psd/face.raw-rgba",
      dimensions: { width: 10, height: 10, pixelFormat: "rgba8" },
      contentInset: { left: 4, top: 4, right: 4, bottom: 4 }
    });

    expect(entry.dimensions).toEqual({ width: 10, height: 10, pixelFormat: "rgba8" });
    expect(entry.contentInset).toEqual({ left: 4, top: 4, right: 4, bottom: 4 });

    // Content region reconstructs from padded dims minus the inset on each axis.
    const contentWidth =
      entry.dimensions!.width - entry.contentInset!.left - entry.contentInset!.right;
    const contentHeight =
      entry.dimensions!.height - entry.contentInset!.top - entry.contentInset!.bottom;
    expect({ contentWidth, contentHeight }).toEqual({ contentWidth: 2, contentHeight: 2 });
  });

  it("remains valid without the optional padded fields (backward compatible)", () => {
    const entry = TextureAtlasEntrySchema.parse({
      textureId: "tex_face_rgba",
      filePath: "assets/textures/psd/face.raw-rgba"
    });
    expect(entry.dimensions).toBeUndefined();
    expect(entry.contentInset).toBeUndefined();
  });
});

describe("PsdLayerMaterializationEvidenceSchema content inset", () => {
  it("accepts padded width/height with a content inset", () => {
    const evidence = PsdLayerMaterializationEvidenceSchema.parse({
      evidenceKind: "psd-layer-materialization-evidence-v1",
      materializationId: "mat_plan_face",
      sourceLayerRef: {
        sourceAssetId: "src_plan",
        sourceLayerId: "psd:root/layer[0]"
      },
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      byteLength: 400,
      digest: { algorithm: "sha256", hex: "a".repeat(64) },
      width: 10,
      height: 10,
      contentInset: { left: 4, top: 4, right: 4, bottom: 4 },
      provenance: {
        sourceFilePath: "source.psd",
        privacyLabel: "packageLocalAsset",
        publicDistribution: "notPublicDistributable"
      }
    });
    expect(evidence.contentInset).toEqual({ left: 4, top: 4, right: 4, bottom: 4 });
    expect(evidence.width).toBe(10);
  });
});
