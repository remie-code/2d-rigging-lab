import { describe, it, expect } from "vitest";

import { renderSceneToRgba8 } from "../software-renderer.js";
import type { SoftwareRenderView } from "../view/view-transform.js";
import {
  createScene,
  createSolidTexture,
  createQuadDrawable
} from "../test-support/scene-fixtures.js";

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

const whiteTexture = createSolidTexture({
  textureId: "white",
  width: 1,
  height: 1,
  rgba: [255, 255, 255, 255]
});

describe("mask (drawable-alpha clipping)", () => {
  it("clips the target to the opaque region of the mask drawable", () => {
    // Target red quad over whole canvas, masked by a white quad covering only
    // the left column (stage x in [0,1]). Mask is opaque there (alpha 1) and
    // absent (alpha 0) on the right column, so the target shows only on the
    // left column.
    const scene = createScene({
      textureSources: [redTexture, whiteTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "maskLeft",
          textureId: "white",
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 2,
          drawOrder: 5
        }),
        createQuadDrawable({
          drawableId: "target",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 0,
          maskDrawableIds: ["maskLeft"]
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    // Left column red, right column transparent.
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      255, 0, 0, 255, 0, 0, 0, 0,
      255, 0, 0, 255, 0, 0, 0, 0
    ]);
  });

  it("scales the target by the mask alpha (semi-transparent mask)", () => {
    // A mask drawable is a normal scene drawable: it is composited onto the main
    // framebuffer AND used as the alpha source for its target (matching the
    // WebGL2 renderer, where mask ids resolve to scene drawables that are also
    // drawn in the main pass). Here the white mask covers the whole canvas at
    // opacity 0.5, so:
    //   - the main buffer first receives white premultiplied*0.5 =
    //     (128,128,128,128) normalized ~ (0.502,0.502,0.502,0.502);
    //   - maskAlpha = 0.502 everywhere;
    //   - the red target fragment = red_premul(1,0,0,1) * maskAlpha(0.502) =
    //     (0.502,0,0,0.502), composited over the white with premultiplied over:
    //       R = 0.502 + 0.502*(1-0.502) = 0.752 -> 191
    //       G = 0     + 0.502*0.498     = 0.25  -> 64
    //       B = 0     + 0.502*0.498     = 0.25  -> 64
    //       A = 0.502 + 0.502*0.498     = 0.752 -> 191
    const scene = createScene({
      textureSources: [redTexture, whiteTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "mask",
          textureId: "white",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          opacity: 0.5,
          drawOrder: 5
        }),
        createQuadDrawable({
          drawableId: "target",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 0,
          maskDrawableIds: ["mask"]
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      191, 64, 64, 191, 191, 64, 64, 191,
      191, 64, 64, 191, 191, 64, 64, 191
    ]);
  });

  it("clips the target to the mask alpha in isolation (mask outside target region)", () => {
    // To observe the pure clipping effect without the mask's own color, place
    // the mask so it only overlaps part of the target. Mask = opaque white on
    // the left column only; target = red over the whole canvas. On the left the
    // target is drawn (over white) with maskAlpha=1; on the right maskAlpha=0 so
    // the target contributes nothing and there is no mask color either.
    const scene = createScene({
      textureSources: [redTexture, whiteTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "maskLeft",
          textureId: "white",
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 2,
          drawOrder: 5
        }),
        createQuadDrawable({
          drawableId: "target",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 0,
          maskDrawableIds: ["maskLeft"]
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    // Left column: red over opaque white with maskAlpha 1 -> opaque red.
    // Right column: fully transparent.
    expect(Array.from(result.premultipliedRgba8)).toEqual([
      255, 0, 0, 255, 0, 0, 0, 0,
      255, 0, 0, 255, 0, 0, 0, 0
    ]);
  });

  it("skips the target entirely when no mask drawable is renderable", () => {
    // Mask references a drawable id that is invisible -> mask set empty ->
    // target skipped (matches WebGL2 renderer behavior).
    const scene = createScene({
      textureSources: [redTexture, whiteTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "invisibleMask",
          textureId: "white",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          visible: false,
          drawOrder: 5
        }),
        createQuadDrawable({
          drawableId: "target",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 0,
          maskDrawableIds: ["invisibleMask"]
        })
      ]
    });
    const result = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(result.premultipliedRgba8)).toEqual(new Array(16).fill(0));
  });

  it("is deterministic across repeated masked renders", () => {
    const scene = createScene({
      textureSources: [redTexture, whiteTexture],
      drawables: [
        createQuadDrawable({
          drawableId: "maskLeft",
          textureId: "white",
          minX: 0,
          minY: 0,
          maxX: 1,
          maxY: 2,
          drawOrder: 5
        }),
        createQuadDrawable({
          drawableId: "target",
          textureId: "red",
          minX: 0,
          minY: 0,
          maxX: 2,
          maxY: 2,
          drawOrder: 0,
          maskDrawableIds: ["maskLeft"]
        })
      ]
    });
    const first = renderSceneToRgba8(scene, view2x2);
    const second = renderSceneToRgba8(scene, view2x2);
    expect(Array.from(second.premultipliedRgba8)).toEqual(
      Array.from(first.premultipliedRgba8)
    );
  });
});
