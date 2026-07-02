import { describe, it, expect } from "vitest";

import { renderSceneToRgba8 } from "./software-renderer.js";
import type { SoftwareRenderView } from "./view/view-transform.js";
import {
  createScene,
  createSolidTexture,
  createQuadDrawable,
  createFourColorTexture
} from "./test-support/scene-fixtures.js";

const view4x4: SoftwareRenderView = {
  stageViewport: { minX: 0, minY: 0, width: 4, height: 4 },
  outputWidth: 4,
  outputHeight: 4
};

const view2x2: SoftwareRenderView = {
  stageViewport: { minX: 0, minY: 0, width: 2, height: 2 },
  outputWidth: 2,
  outputHeight: 2
};

const redTexture = createSolidTexture({
  textureId: "red",
  width: 1,
  height: 1,
  rgba: [255, 0, 0, 255]
});

const greenTexture = createSolidTexture({
  textureId: "green",
  width: 1,
  height: 1,
  rgba: [0, 255, 0, 255]
});

describe("software-renderer golden output", () => {
  it("fills a single solid triangle deterministically (golden bytes)", () => {
    // A triangle covering the bottom-left half of a 4x4 canvas:
    //   stage (0,0) top-left, (0,4) bottom-left, (4,4) bottom-right.
    const scene = createScene({
      textureSources: [redTexture],
      drawables: [
        {
          drawableId: "tri",
          textureRef: { textureId: "red" },
          mesh: {
            coordinateSpace: "stage",
            uvSpace: "layer-local-top-left-0-1-v1",
            vertices: [
              { x: 0, y: 0 },
              { x: 0, y: 4 },
              { x: 4, y: 4 }
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 0, y: 1 },
              { x: 1, y: 1 }
            ],
            triangles: [[0, 1, 2]]
          },
          opacity: 1,
          drawOrder: 0,
          stableIndex: 0,
          visible: true,
          blendMode: "normal-premultiplied-alpha-v0"
        }
      ]
    });

    const result = renderSceneToRgba8(scene, view4x4);
    // Coverage (pixel-center at (px+0.5,py+0.5), top-left rule) of the triangle
    // (0,0)-(0,4)-(4,4): the hypotenuse is the line x = y, so a pixel center is
    // inside when px + 0.5 <= py + 0.5, i.e. px <= py.
    //   Row 0: col 0. Row 1: cols 0..1. Row 2: cols 0..2. Row 3: cols 0..3.
    const R = [255, 0, 0, 255];
    const O = [0, 0, 0, 0];
    const expected = new Uint8Array([
      ...R, ...O, ...O, ...O,
      ...R, ...R, ...O, ...O,
      ...R, ...R, ...R, ...O,
      ...R, ...R, ...R, ...R
    ]);
    expect(Array.from(result.premultipliedRgba8)).toEqual(Array.from(expected));
  });

  it("maps a four-color texture with NEAREST sampling (golden bytes)", () => {
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
    const result = renderSceneToRgba8(scene, view2x2);
    // top-left origin: (0,0)=red (1,0)=green (0,1)=blue (1,1)=white
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255
    ]);
  });

  it("applies drawable opacity as premultiplied scaling (golden bytes)", () => {
    const scene = createScene({
      textureSources: [redTexture],
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
    const result = renderSceneToRgba8(scene, view2x2);
    // premultiplied: round(255*0.5)=128 for R and A.
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      128, 0, 0, 128,
      128, 0, 0, 128,
      128, 0, 0, 128,
      128, 0, 0, 128
    ]);
    // straight: un-premultiply -> full red at alpha 128.
    expect(Array.from(result.straightRgba8)).toEqual([
      255, 0, 0, 128,
      255, 0, 0, 128,
      255, 0, 0, 128,
      255, 0, 0, 128
    ]);
  });

  it("composites draw order back-to-front with premultiplied over (golden bytes)", () => {
    // Green drawn in front of red over the whole 2x2 canvas: green fully opaque
    // so it fully covers red. drawOrder: back-to-front order = higher drawOrder
    // first (further back). Green has lower drawOrder -> drawn later (front).
    const scene = createScene({
      textureSources: [redTexture, greenTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "back",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 10
        }),
        createQuadDrawable({
          drawableId: "front",
          textureId: "green",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 0
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      0, 255, 0, 255,
      0, 255, 0, 255,
      0, 255, 0, 255,
      0, 255, 0, 255
    ]);
  });

  it("blends a half-opacity front over an opaque back (golden bytes)", () => {
    // Back = opaque red, front = green at opacity 0.5 over the whole canvas.
    // Green premultiplied normalized = (0,1,0,1); scaled by 0.5 -> (0,0.5,0,0.5).
    // Over opaque red (1,0,0,1): dst_rgb = src + dst*(1 - 0.5)
    //   R = 0   + 1*0.5 = 0.5 -> round(0.5*255)=128
    //   G = 0.5 + 0     = 0.5 -> 128
    //   A = 0.5 + 1*0.5 = 1.0 -> 255
    const scene = createScene({
      textureSources: [redTexture, greenTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "back",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 10
        }),
        createQuadDrawable({
          drawableId: "front",
          textureId: "green",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 0,
          opacity: 0.5
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      128, 128, 0, 255,
      128, 128, 0, 255,
      128, 128, 0, 255,
      128, 128, 0, 255
    ]);
  });

  it("is deterministic: two renders of the same scene produce byte-identical output", () => {
    const scene = createScene({
      textureSources: [createFourColorTexture("four"), redTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "a",
          textureId: "four",
          minX: 0,
          minY: 0,
          maxX: 3,
          maxY: 3,
          drawOrder: 5
        }),
        createQuadDrawable({
          drawableId: "b",
          textureId: "red",
          minX: 1,
          minY: 1,
          maxX: 4,
          maxY: 4,
          drawOrder: 2,
          opacity: 0.75
        })
      ]
    });
    const view: SoftwareRenderView = {
      stageViewport: { minX: 0, minY: 0, width: 4, height: 4 },
      outputWidth: 8,
      outputHeight: 8
    };
    const first = renderSceneToRgba8(scene, view);
    const second = renderSceneToRgba8(scene, view);
    const third = renderSceneToRgba8(scene, view);
    expect(Array.from(second.premultipliedRgba8)).toEqual(
      Array.from(first.premultipliedRgba8)
    );
    expect(Array.from(third.premultipliedRgba8)).toEqual(
      Array.from(first.premultipliedRgba8)
    );
    expect(Array.from(second.straightRgba8)).toEqual(
      Array.from(first.straightRgba8)
    );
  });

  it("handles empty scenes deterministically (fully transparent)", () => {
    const scene = createScene({ textureSources: [], drawables: [] });
    const result = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(result.premultipliedRgba8)).toEqual(new Array(16).fill(0));
  });

  it("skips degenerate (zero-area) triangles without crashing", () => {
    const scene = createScene({
      textureSources: [redTexture],
      drawables: [
        {
          drawableId: "degenerate",
          textureRef: { textureId: "red" },
          mesh: {
            coordinateSpace: "stage",
            uvSpace: "layer-local-top-left-0-1-v1",
            vertices: [
              { x: 0, y: 0 },
              { x: 2, y: 2 },
              { x: 1, y: 1 } // collinear -> zero area
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 1 },
              { x: 0.5, y: 0.5 }
            ],
            triangles: [[0, 1, 2]]
          },
          opacity: 1,
          drawOrder: 0,
          stableIndex: 0,
          visible: true,
          blendMode: "normal-premultiplied-alpha-v0"
        }
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(result.premultipliedRgba8)).toEqual(new Array(16).fill(0));
  });

  it("clips geometry that lies partly outside the viewport", () => {
    // Quad spanning stage (-2,-2)..(2,2), viewport shows (0,0)..(2,2).
    // Only the lower-right portion is visible; the rest is clipped.
    const scene = createScene({
      textureSources: [redTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "wide",
          textureId: "red",
          minX: -2,
          minY: -2,
          maxX: 2,
          maxY: 2
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    // The visible quadrant is fully covered.
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255,
      255, 0, 0, 255
    ]);
  });

  it("skips non-renderable drawables (invisible / zero opacity / missing texture)", () => {
    const scene = createScene({
      textureSources: [redTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "invisible",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          visible: false
        }),
        createQuadDrawable({
          drawableId: "zeroOpacity",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          opacity: 0
        }),
        createQuadDrawable({
          drawableId: "missingTexture",
          textureId: "does-not-exist",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(result.premultipliedRgba8)).toEqual(new Array(16).fill(0));
  });
});
