import type { NodeChild } from "@webtoon/psd";
import { describe, expect, it } from "vitest";

import {
  createLayerMaterializationEvidence,
  isPsdNodeHiddenForEditorImport,
  layerTransparentPaddingSourcePixels,
  padLayerRasterWithTransparentBorder
} from "./browser-psd-parser-adapter";
import { createPsdSourceAssetId } from "./browser-psd-parser-adapter";

describe("browser PSD parser adapter hidden-state compatibility", () => {
  it("uses the public Layer isHidden flag when available", () => {
    expect(isPsdNodeHiddenForEditorImport(createPublicHiddenNode(true))).toBe(true);
    expect(isPsdNodeHiddenForEditorImport(createPublicHiddenNode(false))).toBe(false);
  });

  it("reads the @webtoon/psd Group private hidden flag when the public flag is absent", () => {
    expect(isPsdNodeHiddenForEditorImport(createPrivateGroupNode(true))).toBe(true);
    expect(isPsdNodeHiddenForEditorImport(createPrivateGroupNode(false))).toBe(false);
  });

  it("falls back to visible when the private Group shape is absent", () => {
    expect(isPsdNodeHiddenForEditorImport(createGroupNodeWithoutPrivateShape())).toBe(false);
  });
});

describe("padLayerRasterWithTransparentBorder", () => {
  it("wraps content in a fully transparent border and copies content to the inset offset", () => {
    // 2x1 content, each pixel a distinct RGBA, padded by 1px on all sides -> 4x3.
    const content = new Uint8Array([
      10, 20, 30, 40, // (0,0)
      50, 60, 70, 80 // (1,0)
    ]);
    const padded = padLayerRasterWithTransparentBorder(content, 2, 1, 1);

    expect(padded.width).toBe(4);
    expect(padded.height).toBe(3);
    expect(padded.bytes.byteLength).toBe(4 * 3 * 4);
    expect(padded.contentInset).toEqual({ left: 1, top: 1, right: 1, bottom: 1 });

    const pixelAt = (x: number, y: number): number[] => {
      const offset = (y * padded.width + x) * 4;
      return [...padded.bytes.subarray(offset, offset + 4)];
    };

    // Four corners are premultiplied-transparent (all channels zero).
    expect(pixelAt(0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(3, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(0, 2)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(3, 2)).toEqual([0, 0, 0, 0]);
    // Edge samples on the transparent border.
    expect(pixelAt(1, 0)).toEqual([0, 0, 0, 0]); // top edge above content
    expect(pixelAt(0, 1)).toEqual([0, 0, 0, 0]); // left edge beside content
    expect(pixelAt(3, 1)).toEqual([0, 0, 0, 0]); // right edge beside content
    expect(pixelAt(1, 2)).toEqual([0, 0, 0, 0]); // bottom edge below content

    // Content transcribed to inset (1,1).
    expect(pixelAt(1, 1)).toEqual([10, 20, 30, 40]);
    expect(pixelAt(2, 1)).toEqual([50, 60, 70, 80]);
  });

  it("is deterministic: identical input yields byte-identical output", () => {
    const content = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const a = padLayerRasterWithTransparentBorder(content, 3, 1, 2);
    const b = padLayerRasterWithTransparentBorder(content, 3, 1, 2);
    expect([...a.bytes]).toEqual([...b.bytes]);
  });
});

describe("layerTransparentPaddingSourcePixels (Option E: size-dependent padding)", () => {
  it("saturates at the lower bound P=5 for small layers (long edge <= ~333px)", () => {
    // clamp(0.012*longEdge, 4, 16) hits the 4px floor, + 1px soft-mask blur.
    expect(layerTransparentPaddingSourcePixels(3)).toBe(5);
    expect(layerTransparentPaddingSourcePixels(250)).toBe(5);
    expect(layerTransparentPaddingSourcePixels(333)).toBe(5);
  });

  it("scales long-edge-proportionally between the bounds", () => {
    // ceil(0.012*longEdge + 1).
    expect(layerTransparentPaddingSourcePixels(500)).toBe(7); // ceil(6 + 1)
    expect(layerTransparentPaddingSourcePixels(1000)).toBe(13); // ceil(12 + 1)
  });

  it("saturates at the upper bound P=17 for large layers (long edge >= ~1334px)", () => {
    // clamp(0.012*longEdge, 4, 16) hits the 16px ceiling, + 1px soft-mask blur.
    expect(layerTransparentPaddingSourcePixels(1334)).toBe(17);
    expect(layerTransparentPaddingSourcePixels(2048)).toBe(17);
  });
});

describe("createLayerMaterializationEvidence transparent padding (Option E)", () => {
  const buildFakeLayer = (contentWidth: number, contentHeight: number): unknown => {
    const contentRgba = new Uint8Array(contentWidth * contentHeight * 4);
    // Fill content with an opaque, distinctive pattern so we can tell it apart
    // from the transparent border (every 4th byte -> alpha -> forced non-zero).
    for (let i = 0; i < contentRgba.length; i += 1) {
      contentRgba[i] = i % 4 === 3 ? 255 : (i * 7 + 3) % 256;
    }
    return {
      kind: "layer",
      sourceLayerId: "psd:root/layer[0]",
      originalName: "Face",
      normalizedName: "face",
      parentGroupId: "psd:root",
      groupPath: ["Doc", "Head"],
      sourceOrder: 1,
      bounds: { x: 320, y: 240, width: contentWidth, height: contentHeight },
      visibleInSource: true,
      localVisibleInSource: true,
      effectiveVisibleInSource: true,
      opacityInSource: 1,
      layer: {
        composite: async () => contentRgba
      }
    };
  };

  const runEvidence = (contentWidth: number, contentHeight: number) =>
    createLayerMaterializationEvidence({
      fileName: "source.psd",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layer: buildFakeLayer(contentWidth, contentHeight) as any,
      planToken: "plan123",
      sourceAssetId: createPsdSourceAssetId("plan123"),
      sourceDigest: { algorithm: "sha256", hex: "a".repeat(64) },
      sourceByteLength: 1024
    });

  // Representative layer sizes -> baked padding P, spanning the three regimes.
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly contentWidth: number;
    readonly contentHeight: number;
    readonly expectedP: number;
  }> = [
    { label: "lower saturation (P=5)", contentWidth: 3, contentHeight: 2, expectedP: 5 },
    { label: "middle proportional (P=13)", contentWidth: 1000, contentHeight: 2, expectedP: 13 },
    { label: "upper saturation (P=17)", contentWidth: 1500, contentHeight: 2, expectedP: 17 }
  ];

  for (const { label, contentWidth, contentHeight, expectedP } of cases) {
    it(`bakes per-size padding and records padded dims + content inset — ${label}`, async () => {
      const P = layerTransparentPaddingSourcePixels(Math.max(contentWidth, contentHeight));
      expect(P).toBe(expectedP);

      const { evidence } = await runEvidence(contentWidth, contentHeight);
      const paddedWidth = contentWidth + P * 2;
      const paddedHeight = contentHeight + P * 2;

      expect(evidence.width).toBe(paddedWidth);
      expect(evidence.height).toBe(paddedHeight);
      expect(evidence.byteLength).toBe(paddedWidth * paddedHeight * 4);
      // content-inset is the actual baked P on all four sides.
      expect(evidence.contentInset).toEqual({ left: P, top: P, right: P, bottom: P });

      // Content dims are recoverable from padded dims + inset.
      expect(evidence.width! - evidence.contentInset!.left - evidence.contentInset!.right).toBe(
        contentWidth
      );
      expect(evidence.height! - evidence.contentInset!.top - evidence.contentInset!.bottom).toBe(
        contentHeight
      );
    });
  }

  it("keeps evidence, binaryAssetRef, and layerBytes mutually consistent at padded values", async () => {
    const contentWidth = 3;
    const contentHeight = 2;
    const P = layerTransparentPaddingSourcePixels(Math.max(contentWidth, contentHeight));
    const { evidence, layerBytes } = await runEvidence(contentWidth, contentHeight);
    const paddedWidth = contentWidth + P * 2;
    const paddedHeight = contentHeight + P * 2;
    const paddedByteLength = paddedWidth * paddedHeight * 4;

    expect(evidence.byteLength).toBe(paddedByteLength);
    expect(evidence.binaryAssetRef?.byteLength).toBe(paddedByteLength);
    expect(evidence.binaryAssetRef?.digest).toEqual(evidence.digest);

    expect(layerBytes.width).toBe(paddedWidth);
    expect(layerBytes.height).toBe(paddedHeight);
    expect(layerBytes.bytes.byteLength).toBe(paddedByteLength);

    // The outer P rows/cols of the baked bytes are transparent.
    const pixelAt = (x: number, y: number): number[] => {
      const offset = (y * paddedWidth + x) * 4;
      return [...layerBytes.bytes.subarray(offset, offset + 4)];
    };
    expect(pixelAt(0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(paddedWidth - 1, paddedHeight - 1)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(P - 1, P)).toEqual([0, 0, 0, 0]); // just outside content, left
    // Content top-left pixel sits at (P, P) and is opaque (alpha != 0).
    expect(pixelAt(P, P)[3]).not.toBe(0);
  });

  it("bakes the full transparent border on every side at the actual P (upper saturation)", async () => {
    const contentWidth = 1500;
    const contentHeight = 2;
    const P = 17;
    const { layerBytes } = await runEvidence(contentWidth, contentHeight);
    const paddedWidth = contentWidth + P * 2;
    const paddedHeight = contentHeight + P * 2;
    const pixelAt = (x: number, y: number): number[] => {
      const offset = (y * paddedWidth + x) * 4;
      return [...layerBytes.bytes.subarray(offset, offset + 4)];
    };
    // Every one of the P-wide border rings is fully transparent (sample the ring
    // just inside the outer edge on all four sides).
    for (let d = 0; d < P; d += 1) {
      expect(pixelAt(d, P + 1)).toEqual([0, 0, 0, 0]); // left band
      expect(pixelAt(paddedWidth - 1 - d, P + 1)).toEqual([0, 0, 0, 0]); // right band
      expect(pixelAt(P + 1, d)).toEqual([0, 0, 0, 0]); // top band
      expect(pixelAt(P + 1, paddedHeight - 1 - d)).toEqual([0, 0, 0, 0]); // bottom band
    }
    // First content pixel at (P, P) is opaque.
    expect(pixelAt(P, P)[3]).not.toBe(0);
  });

  it("digests the padded bytes, not the tightly-cropped content bytes", async () => {
    const contentWidth = 3;
    const contentHeight = 2;
    const { evidence } = await runEvidence(contentWidth, contentHeight);
    const contentRgba = new Uint8Array(contentWidth * contentHeight * 4);
    for (let i = 0; i < contentRgba.length; i += 1) {
      contentRgba[i] = i % 4 === 3 ? 255 : (i * 7 + 3) % 256;
    }
    const contentDigest = await crypto.subtle.digest("SHA-256", contentRgba);
    const contentHex = [...new Uint8Array(contentDigest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    expect(evidence.digest.hex).not.toBe(contentHex);
  });

  it("is deterministic: identical layer input yields byte-identical padded output", async () => {
    const a = await runEvidence(64, 48);
    const b = await runEvidence(64, 48);
    expect(a.evidence.digest.hex).toBe(b.evidence.digest.hex);
    expect([...a.layerBytes.bytes]).toEqual([...b.layerBytes.bytes]);
  });
});

function createPublicHiddenNode(isHidden: boolean): NodeChild {
  return {
    type: "Layer",
    isHidden
  } as unknown as NodeChild;
}

function createPrivateGroupNode(hidden: boolean): NodeChild {
  return {
    type: "Group",
    layerFrame: {
      layerProperties: {
        hidden
      }
    }
  } as unknown as NodeChild;
}

function createGroupNodeWithoutPrivateShape(): NodeChild {
  return {
    type: "Group"
  } as unknown as NodeChild;
}
