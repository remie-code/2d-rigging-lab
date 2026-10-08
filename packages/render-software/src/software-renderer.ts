import {
  orderRenderDrawablesBackToFront,
  type RenderDrawable,
  type RenderRgba8TextureSource,
  type RenderScene
} from "@private-2d-rigging-lab/render-core";

import { rasterizeDrawable } from "./raster/drawable-rasterizer.js";
import {
  createSoftwareFramebuffer,
  readFramebufferPremultipliedRgba8,
  readFramebufferStraightRgba8,
  type SoftwareFramebuffer
} from "./raster/framebuffer.js";
import { buildMaskAlphaSampler } from "./raster/mask.js";
import { prepareTexture, type PreparedTexture } from "./raster/texture-sampler.js";
import {
  resolveSoftwareRenderView,
  type ResolvedSoftwareRenderView,
  type SoftwareRenderView
} from "./view/view-transform.js";

/**
 * Result of a software render: the resolved view (for px <-> stage mapping) and
 * accessors for the composited pixels in either premultiplied or straight
 * alpha form.
 */
export interface SoftwareRenderResult {
  readonly width: number;
  readonly height: number;
  readonly view: ResolvedSoftwareRenderView;
  /**
   * RGBA8, row-major, top-left origin, premultiplied alpha. This is the direct
   * form the compositor works in (matches the WebGL2 framebuffer contents when
   * premultipliedAlpha is true).
   */
  readonly premultipliedRgba8: Uint8Array;
  /**
   * RGBA8, row-major, top-left origin, straight (non-premultiplied) alpha.
   * Un-premultiplied deterministically from the composited buffer. This is the
   * form written to PNG (standard PNG expects straight alpha).
   */
  readonly straightRgba8: Uint8Array;
}

function isDrawableRenderable(drawable: RenderDrawable): boolean {
  return drawable.visible && drawable.opacity > 0;
}

/**
 * Composite a RenderScene into a software framebuffer using the given view.
 *
 * Semantics deliberately mirror the WebGL2 renderer:
 *  - draw order via render-core's orderRenderDrawablesBackToFront
 *  - renderable = visible && opacity > 0 && texture source present
 *  - mesh validity per webgl2-mesh (vertexCount = min(vertices, uvs); triangles
 *    fully in range)
 *  - LINEAR (bilinear) + CLAMP_TO_EDGE texture sampling
 *  - premultiplied "over" blend, transparent (0,0,0,0) clear
 *  - drawable-alpha mask via a separate viewport-sized mask pass
 */
function compositeScene(
  scene: RenderScene,
  view: ResolvedSoftwareRenderView
): SoftwareFramebuffer {
  const framebuffer = createSoftwareFramebuffer(view.outputWidth, view.outputHeight);

  const textureSourcesById = new Map<string, RenderRgba8TextureSource>(
    scene.textureSources
      .filter(
        (source): source is RenderRgba8TextureSource => source.kind === "rgba8"
      )
      .map((source) => [source.textureId, source])
  );

  // Prepare (premultiply + normalize) each texture once and cache it.
  const preparedTexturesByTextureId = new Map<string, PreparedTexture>();
  const getPreparedTexture = (textureId: string): PreparedTexture | undefined => {
    const cached = preparedTexturesByTextureId.get(textureId);
    if (cached !== undefined) {
      return cached;
    }
    const source = textureSourcesById.get(textureId);
    if (source === undefined) {
      return undefined;
    }
    const prepared = prepareTexture(source);
    preparedTexturesByTextureId.set(textureId, prepared);
    return prepared;
  };

  const orderedDrawables = orderRenderDrawablesBackToFront(scene.drawables);
  const drawableById = new Map<string, RenderDrawable>(
    orderedDrawables.map((drawable) => [drawable.drawableId, drawable])
  );

  for (const drawable of orderedDrawables) {
    const source = textureSourcesById.get(drawable.textureRef.textureId);
    if (!isDrawableRenderable(drawable) || source === undefined) {
      continue;
    }
    const texture = getPreparedTexture(drawable.textureRef.textureId);
    if (texture === undefined) {
      continue;
    }

    const clipping = drawable.clipping;
    if (clipping === undefined || clipping.maskDrawableIds.length === 0) {
      rasterizeDrawable(framebuffer, drawable, texture, view);
      continue;
    }

    const maskDrawables = clipping.maskDrawableIds
      .map((drawableId) => drawableById.get(drawableId))
      .filter(
        (mask): mask is RenderDrawable =>
          mask !== undefined &&
          isDrawableRenderable(mask) &&
          textureSourcesById.has(mask.textureRef.textureId)
      );
    // Empty mask set means the target drawable is skipped entirely, matching
    // the WebGL2 renderer (maskDrawables.length === 0 -> continue).
    if (maskDrawables.length === 0) {
      continue;
    }

    // Ensure each mask drawable's texture is prepared before building the mask.
    for (const mask of maskDrawables) {
      getPreparedTexture(mask.textureRef.textureId);
    }

    const maskAlphaSampler = buildMaskAlphaSampler(
      maskDrawables,
      preparedTexturesByTextureId,
      textureSourcesById,
      view
    );
    rasterizeDrawable(framebuffer, drawable, texture, view, maskAlphaSampler);
  }

  return framebuffer;
}

/**
 * Render a RenderScene to RGBA8 pixel buffers using an explicit view.
 *
 * Pure and fully deterministic: identical `scene` + `view` yield byte-identical
 * output on any platform and any number of runs.
 */
export const renderSceneToRgba8 = (
  scene: RenderScene,
  view: SoftwareRenderView
): SoftwareRenderResult => {
  const resolvedView = resolveSoftwareRenderView(view);
  const framebuffer = compositeScene(scene, resolvedView);
  return {
    width: resolvedView.outputWidth,
    height: resolvedView.outputHeight,
    view: resolvedView,
    premultipliedRgba8: readFramebufferPremultipliedRgba8(framebuffer),
    straightRgba8: readFramebufferStraightRgba8(framebuffer)
  };
};
