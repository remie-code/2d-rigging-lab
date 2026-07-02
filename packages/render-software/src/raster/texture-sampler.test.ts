import { describe, it, expect } from "vitest";

import { prepareTexture, sampleTextureNearest } from "./texture-sampler.js";
import { createFourColorTexture } from "../test-support/scene-fixtures.js";

describe("texture-sampler", () => {
  it("premultiplies straight-alpha sources matching createUploadBytes", () => {
    const source = {
      kind: "rgba8" as const,
      textureId: "t",
      width: 1,
      height: 1,
      // straight: red at half alpha
      bytes: new Uint8Array([255, 0, 0, 128]),
      alphaMode: "straight" as const,
      contentSignature: "t"
    };
    const prepared = prepareTexture(source);
    // premultiplied byte = round(255 * 128 / 255) = 128 -> normalized 128/255.
    const sample = sampleTextureNearest(prepared, 0.5, 0.5);
    expect(sample.r).toBeCloseTo(128 / 255, 12);
    expect(sample.g).toBe(0);
    expect(sample.a).toBeCloseTo(128 / 255, 12);
  });

  it("uses premultiplied sources as-is", () => {
    const source = {
      kind: "rgba8" as const,
      textureId: "t",
      width: 1,
      height: 1,
      bytes: new Uint8Array([64, 0, 0, 128]),
      alphaMode: "premultiplied" as const,
      contentSignature: "t"
    };
    const prepared = prepareTexture(source);
    const sample = sampleTextureNearest(prepared, 0, 0);
    expect(sample.r).toBeCloseTo(64 / 255, 12);
    expect(sample.a).toBeCloseTo(128 / 255, 12);
  });

  it("selects texels by floor(uv * dimension) (NEAREST)", () => {
    const prepared = prepareTexture(createFourColorTexture("four"));
    // 2x2 texture: uv 0.25 -> texel 0, uv 0.75 -> texel 1.
    expect(sampleTextureNearest(prepared, 0.25, 0.25)).toMatchObject({ r: 1, g: 0, b: 0 });
    expect(sampleTextureNearest(prepared, 0.75, 0.25)).toMatchObject({ r: 0, g: 1, b: 0 });
    expect(sampleTextureNearest(prepared, 0.25, 0.75)).toMatchObject({ r: 0, g: 0, b: 1 });
    expect(sampleTextureNearest(prepared, 0.75, 0.75)).toMatchObject({ r: 1, g: 1, b: 1 });
  });

  it("clamps out-of-range UVs to the edge texel (CLAMP_TO_EDGE)", () => {
    const prepared = prepareTexture(createFourColorTexture("four"));
    // uv >= 1 clamps to last texel; uv < 0 clamps to first.
    expect(sampleTextureNearest(prepared, 5, 5)).toMatchObject({ r: 1, g: 1, b: 1 });
    expect(sampleTextureNearest(prepared, -3, -3)).toMatchObject({ r: 1, g: 0, b: 0 });
    // uv exactly 1.0 -> floor(1.0*2)=2 clamps to 1 (last texel).
    expect(sampleTextureNearest(prepared, 1, 0)).toMatchObject({ r: 0, g: 1, b: 0 });
  });
});
