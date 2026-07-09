import { describe, it, expect } from "vitest";

import {
  prepareTexture,
  sampleTextureLinear,
  type PreparedTexture
} from "./texture-sampler.js";
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
    const sample = sampleTextureLinear(prepared, 0.5, 0.5);
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
    // Single-texel textures collapse to that texel for any UV under LINEAR +
    // CLAMP_TO_EDGE (all four neighbours clamp to index 0).
    const sample = sampleTextureLinear(prepared, 0, 0);
    expect(sample.r).toBeCloseTo(64 / 255, 12);
    expect(sample.a).toBeCloseTo(128 / 255, 12);
  });

  it("returns exact texel values at texel centres (LINEAR reduces to the texel)", () => {
    const prepared = prepareTexture(createFourColorTexture("four"));
    // 2x2 texture: uv 0.25 -> coord 0 (texel centre 0), uv 0.75 -> coord 1
    // (texel centre 1). At texel centres the fractional part is 0, so LINEAR
    // returns the exact texel colour.
    expect(sampleTextureLinear(prepared, 0.25, 0.25)).toMatchObject({ r: 1, g: 0, b: 0 });
    expect(sampleTextureLinear(prepared, 0.75, 0.25)).toMatchObject({ r: 0, g: 1, b: 0 });
    expect(sampleTextureLinear(prepared, 0.25, 0.75)).toMatchObject({ r: 0, g: 0, b: 1 });
    expect(sampleTextureLinear(prepared, 0.75, 0.75)).toMatchObject({ r: 1, g: 1, b: 1 });
  });

  it("interpolates the midpoint between two texels (fractional bilinear blend)", () => {
    const prepared = prepareTexture(createFourColorTexture("four"));
    // Horizontal midpoint between texel (0,0)=red and (1,0)=green, at v aligned
    // to the top texel row (v=0.25). coordX = 0.5*2 - 0.5 = 0.5 -> fracX 0.5.
    const horizontal = sampleTextureLinear(prepared, 0.5, 0.25);
    expect(horizontal.r).toBeCloseTo(0.5, 12);
    expect(horizontal.g).toBeCloseTo(0.5, 12);
    expect(horizontal.b).toBeCloseTo(0, 12);
    expect(horizontal.a).toBeCloseTo(1, 12);

    // Centre of the 2x2 texture: average of all four texels
    // red(1,0,0) green(0,1,0) blue(0,0,1) white(1,1,1) -> (0.5,0.5,0.5).
    const centre = sampleTextureLinear(prepared, 0.5, 0.5);
    expect(centre.r).toBeCloseTo(0.5, 12);
    expect(centre.g).toBeCloseTo(0.5, 12);
    expect(centre.b).toBeCloseTo(0.5, 12);
    expect(centre.a).toBeCloseTo(1, 12);
  });

  it("clamps out-of-range UVs to the edge texel (CLAMP_TO_EDGE)", () => {
    const prepared = prepareTexture(createFourColorTexture("four"));
    // uv far >= 1 clamps both neighbours to the last texel; uv far < 0 clamps to
    // the first. uv exactly 1.0 sits half a texel past the last centre, so both
    // neighbours clamp to the last texel too (no wrap-around bleed).
    expect(sampleTextureLinear(prepared, 5, 5)).toMatchObject({ r: 1, g: 1, b: 1 });
    expect(sampleTextureLinear(prepared, -3, -3)).toMatchObject({ r: 1, g: 0, b: 0 });
    expect(sampleTextureLinear(prepared, 1, 0)).toMatchObject({ r: 0, g: 1, b: 0 });
  });

  it("returns transparent for a zero-dimension texture", () => {
    const empty: PreparedTexture = { width: 0, height: 0, data: new Float64Array(0) };
    expect(sampleTextureLinear(empty, 0.5, 0.5)).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("does not produce a dark/white fringe across a transparent premultiplied edge", () => {
    // 2x1 texture: opaque red on the left, fully transparent padding on the
    // right. In premultiplied space the transparent texel is (0,0,0,0), so its
    // straight colour is undefined but must never contaminate the blend.
    const source = {
      kind: "rgba8" as const,
      textureId: "edge",
      width: 2,
      height: 1,
      bytes: new Uint8Array([
        255, 0, 0, 255, // opaque red
        0, 0, 0, 0 // transparent padding
      ]),
      alphaMode: "straight" as const,
      contentSignature: "edge"
    };
    const prepared = prepareTexture(source);

    // Midpoint between the opaque red texel and the transparent texel:
    // coordX = 0.5*2 - 0.5 = 0.5 -> fracX 0.5.
    const mid = sampleTextureLinear(prepared, 0.5, 0.5);
    // Alpha halves toward transparency.
    expect(mid.a).toBeCloseTo(0.5, 12);
    // Premultiplied red also halves in lock-step with alpha: the un-premultiplied
    // colour stays pure red (r/a == 1), with NO dark fringe (r would fall below
    // a if black leaked in) and NO white fringe (r would exceed a).
    expect(mid.r).toBeCloseTo(0.5, 12);
    expect(mid.g).toBeCloseTo(0, 12);
    expect(mid.b).toBeCloseTo(0, 12);
    expect(mid.r / mid.a).toBeCloseTo(1, 12);
  });
});
