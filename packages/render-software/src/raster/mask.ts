import {
  orderRenderDrawablesBackToFront,
  type RenderDrawable,
  type RenderRgba8TextureSource
} from "@private-2d-rigging-lab/render-core";

import { rasterizeDrawable } from "./drawable-rasterizer.js";
import {
  createSoftwareFramebuffer,
  type SoftwareFramebuffer
} from "./framebuffer.js";
import type { PreparedTexture } from "./texture-sampler.js";
import type { MaskAlphaSampler } from "./triangle-rasterizer.js";
import type { ResolvedSoftwareRenderView } from "../view/view-transform.js";

/**
 * Render a set of mask drawables into a dedicated full-viewport framebuffer and
 * return a sampler over its alpha channel.
 *
 * This reproduces the WebGL2 mask pass (webgl2-renderer.ts renderMaskTexture):
 * a separate viewport-sized target is cleared to transparent, the mask
 * drawables are composited back-to-front with the same premultiplied "over"
 * blend (each mask applying its own opacity, no nested clipping), and the
 * target drawable then reads maskAlpha = mask.alpha at the matching screen
 * pixel (shaders.ts: maskAlpha = texture(maskTex, fragCoord/viewportSize).a).
 *
 * Because the mask target is the same resolution and coordinate space as the
 * main framebuffer, the per-pixel correspondence is 1:1 (index equality), so no
 * resampling is needed.
 */
export const buildMaskAlphaSampler = (
  maskDrawables: readonly RenderDrawable[],
  preparedTexturesByTextureId: ReadonlyMap<string, PreparedTexture>,
  textureSourcesById: ReadonlyMap<string, RenderRgba8TextureSource>,
  view: ResolvedSoftwareRenderView
): MaskAlphaSampler => {
  const maskFramebuffer: SoftwareFramebuffer = createSoftwareFramebuffer(
    view.outputWidth,
    view.outputHeight
  );

  for (const drawable of orderRenderDrawablesBackToFront(maskDrawables)) {
    const source = textureSourcesById.get(drawable.textureRef.textureId);
    if (source === undefined) {
      continue;
    }
    const texture = preparedTexturesByTextureId.get(drawable.textureRef.textureId);
    if (texture === undefined) {
      continue;
    }
    // Mask drawables are drawn with their own opacity and without clipping,
    // matching drawDrawable(..., maskTexture = undefined) in the mask pass.
    rasterizeDrawable(maskFramebuffer, drawable, texture, view);
  }

  const data = maskFramebuffer.data;
  const width = maskFramebuffer.width;
  const height = maskFramebuffer.height;
  return (px: number, py: number): number => {
    if (px < 0 || py < 0 || px >= width || py >= height) {
      return 0;
    }
    return data[(py * width + px) * 4 + 3] ?? 0;
  };
};
