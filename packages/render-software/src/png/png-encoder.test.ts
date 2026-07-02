import { describe, it, expect } from "vitest";

import { encodeRgba8ToPng } from "./png-encoder.js";
import { renderSceneToPng } from "../render-scene-to-png.js";
import type { SoftwareRenderView } from "../view/view-transform.js";
import { decodePng } from "../test-support/png-decoder.js";
import {
  createScene,
  createSolidTexture,
  createQuadDrawable,
  createFourColorTexture
} from "../test-support/scene-fixtures.js";

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

describe("png-encoder", () => {
  it("emits a valid PNG signature and IHDR/IEND structure", () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255, 0, 255, 0, 255,
      0, 0, 255, 255, 255, 255, 255, 255
    ]);
    const png = encodeRgba8ToPng(rgba, 2, 2);
    expect(Array.from(png.subarray(0, 8))).toEqual(PNG_SIGNATURE);
    const decoded = decodePng(png);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(Array.from(decoded.rgba8)).toEqual(Array.from(rgba));
  });

  it("is deterministic: identical input yields byte-identical PNG", () => {
    const rgba = new Uint8Array(4 * 4 * 4);
    for (let index = 0; index < rgba.length; index += 1) {
      rgba[index] = (index * 7) % 256;
    }
    const a = encodeRgba8ToPng(rgba, 4, 4);
    const b = encodeRgba8ToPng(rgba, 4, 4);
    expect(Array.from(b)).toEqual(Array.from(a));
  });

  it("rejects buffers whose length does not match the dimensions", () => {
    expect(() => encodeRgba8ToPng(new Uint8Array(3), 2, 2)).toThrow();
  });

  it("round-trips a rendered scene through PNG (decode matches straight buffer)", () => {
    const scene = createScene({
      textureSources: [createFourColorTexture("four")],
      drawables: [
        createQuadDrawable({
          drawableId: "quad",
          textureId: "four",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2
        })
      ]
    });
    const view: SoftwareRenderView = {
      stageViewport: { minX: 0, minY: 0, width: 2, height: 2 },
      outputWidth: 2,
      outputHeight: 2
    };
    const { render, png } = renderSceneToPng(scene, view);
    const decoded = decodePng(png);
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    // PNG carries straight alpha; must match the straight buffer exactly.
    expect(Array.from(decoded.rgba8)).toEqual(Array.from(render.straightRgba8));
  });

  it("round-trips premultiplied compositing through PNG (un-premultiply preserved)", () => {
    const scene = createScene({
      textureSources: [
        createSolidTexture({
          textureId: "red",
          width: 1,
          height: 1,
          rgba: [255, 0, 0, 255]
        })
      ],
      drawables: [
        createQuadDrawable({
          drawableId: "quad",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          opacity: 0.5
        })
      ]
    });
    const view: SoftwareRenderView = {
      stageViewport: { minX: 0, minY: 0, width: 2, height: 2 },
      outputWidth: 2,
      outputHeight: 2
    };
    const { png } = renderSceneToPng(scene, view);
    const decoded = decodePng(png);
    // Straight alpha: full red, alpha 128.
    expect(Array.from(decoded.rgba8)).toEqual([
      255, 0, 0, 128, 255, 0, 0, 128,
      255, 0, 0, 128, 255, 0, 0, 128
    ]);
  });

  it("produces byte-identical PNG across repeated scene renders (end-to-end determinism)", () => {
    const scene = createScene({
      textureSources: [createFourColorTexture("four")],
      drawables: [
        createQuadDrawable({
          drawableId: "quad",
          textureId: "four",
          minX: 0,
          minY: 0,
          maxX: 4,
          maxY: 4
        })
      ]
    });
    const view: SoftwareRenderView = {
      stageViewport: { minX: 0, minY: 0, width: 4, height: 4 },
      outputWidth: 16,
      outputHeight: 16
    };
    const first = renderSceneToPng(scene, view).png;
    const second = renderSceneToPng(scene, view).png;
    expect(Array.from(second)).toEqual(Array.from(first));
  });
});
