import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MaterialImageDescriptorSchema, MaterialNormalizedImageSchema } from "./material-image.js";
import { MaterialPlacementSchema, MaterialPixelPointSchema, MaterialStagePointSchema } from "./material-coordinates.js";
import { createMaterialImageFixture } from "./material-contract-fixtures.js";

describe("material image and coordinate contract", () => {
  it.each([0, -1, NaN, Infinity, -Infinity])("rejects invalid scale %s", (scale) => {
    expect(MaterialPlacementSchema.safeParse({ ...createMaterialImageFixture().placement, scale }).success).toBe(false);
  });
  it("distinguishes pixel edges from rest stage points and rejects nonfinite translation", () => {
    expect(MaterialPixelPointSchema.safeParse({ space: "rest-stage-canvas-y-down-v1", x: 0, y: 0 }).success).toBe(false);
    expect(MaterialStagePointSchema.safeParse({ space: "source-image-pixel-edge-v1", x: 0.5, y: 0.5 }).success).toBe(false);
    expect(MaterialPlacementSchema.safeParse({ ...createMaterialImageFixture().placement, translation: { x: NaN, y: 0 } }).success).toBe(false);
  });
  it("different resolution and transparent margins reproduce the same stage square without bbox fitting", () => {
    for (const variant of ["compact", "wide"] as const) {
      const { image, placement, expectedStageContent } = createMaterialImageFixture(variant);
      expect(MaterialNormalizedImageSchema.safeParse(image).success).toBe(true);
      expect(createHash("sha256").update(image.rgbaBytes).digest("hex")).toBe(image.descriptor.rgbaSha256);
      const b = image.descriptor.alpha.bounds!;
      expect({ x: b.x * placement.scale + placement.translation.x, y: b.y * placement.scale + placement.translation.y,
        width: b.width * placement.scale, height: b.height * placement.scale }).toEqual(expectedStageContent);
    }
    const compact = createMaterialImageFixture(), wide = createMaterialImageFixture("wide");
    expect(compact.image.descriptor.width * compact.placement.scale).not.toBe(wide.image.descriptor.width * wide.placement.scale);
    // The compact pixel center is 0.5 stage units right/down from the wide pixel center after scaling.
    expect((1.5 * 2 + 9) - (3.5 + 8)).toBe(0.5);
  });
  it("rejects inconsistent byte length, alpha metadata, bounds and storage inset", () => {
    const image = createMaterialImageFixture().image;
    for (const descriptor of [
      { ...image.descriptor, byteLength: 63 },
      { ...image.descriptor, width: Number.MAX_SAFE_INTEGER },
      { ...image.descriptor, alpha: { ...image.descriptor.alpha, bounds: null } },
      { ...image.descriptor, alpha: { ...image.descriptor.alpha, nonTransparentPixelCount: 17 } },
      { ...image.descriptor, alpha: { ...image.descriptor.alpha, bounds: { ...image.descriptor.alpha.bounds!, x: 3 } } },
      { ...image.descriptor, contentInset: { left: 2, right: 2, top: 0, bottom: 0 } }
    ]) expect(MaterialImageDescriptorSchema.safeParse(descriptor).success).toBe(false);
    expect(MaterialNormalizedImageSchema.safeParse({ ...image, rgbaBytes: image.rgbaBytes.slice(4) }).success).toBe(false);
    image.rgbaBytes[3] = 128;
    expect(MaterialNormalizedImageSchema.safeParse(image).success).toBe(false);
  });
  it("accepts fully transparent image metadata but does not decide intake eligibility", () => {
    const image = createMaterialImageFixture().image;
    image.rgbaBytes.fill(0);
    image.descriptor.alpha = { nonTransparentPixelCount: 0, translucentPixelCount: 0, bounds: null };
    expect(MaterialNormalizedImageSchema.safeParse(image).success).toBe(true);
  });
});

