import type { RenderDrawable, RenderPoint } from "@private-2d-rigging-lab/render-core";

import type { SoftwareFramebuffer } from "./framebuffer.js";
import type { PreparedTexture } from "./texture-sampler.js";
import {
  rasterizeTriangle,
  type MaskAlphaSampler,
  type RasterVertex
} from "./triangle-rasterizer.js";
import {
  stagePointToImagePixel,
  type ResolvedSoftwareRenderView
} from "../view/view-transform.js";

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Rasterize one drawable's mesh into the framebuffer.
 *
 * Mesh validity mirrors webgl2-mesh's createWebGl2MeshUpload:
 *   vertexCount = min(vertices.length, uvs.length)
 *   a triangle is valid only if all three indices are in [0, vertexCount)
 * Invalid or out-of-range triangles are skipped. If no valid triangle remains,
 * the drawable contributes nothing.
 *
 * Vertices are transformed from stage space to image pixel space via the
 * resolved view. `opacity` is applied per fragment (already clamped by caller
 * intent; clamped here defensively to match the WebGL2 clamp01(opacity)).
 */
export const rasterizeDrawable = (
  framebuffer: SoftwareFramebuffer,
  drawable: RenderDrawable,
  texture: PreparedTexture,
  view: ResolvedSoftwareRenderView,
  maskAlphaSampler?: MaskAlphaSampler
): void => {
  const mesh = drawable.mesh;
  const vertexCount = Math.min(mesh.vertices.length, mesh.uvs.length);
  if (vertexCount === 0 || mesh.triangles.length === 0) {
    return;
  }

  // Precompute pixel-space positions and UVs for each usable vertex.
  const pixelPositions: RenderPoint[] = new Array(vertexCount);
  const uvs: RenderPoint[] = new Array(vertexCount);
  for (let index = 0; index < vertexCount; index += 1) {
    const position = mesh.vertices[index];
    const uv = mesh.uvs[index];
    if (position === undefined || uv === undefined) {
      return;
    }
    pixelPositions[index] = stagePointToImagePixel(view, position);
    uvs[index] = uv;
  }

  const opacity = clamp01(drawable.opacity);

  for (const triangle of mesh.triangles) {
    const [i0, i1, i2] = triangle;
    if (
      i0 < 0 ||
      i1 < 0 ||
      i2 < 0 ||
      i0 >= vertexCount ||
      i1 >= vertexCount ||
      i2 >= vertexCount
    ) {
      continue;
    }

    const p0 = pixelPositions[i0];
    const p1 = pixelPositions[i1];
    const p2 = pixelPositions[i2];
    const uv0 = uvs[i0];
    const uv1 = uvs[i1];
    const uv2 = uvs[i2];
    if (
      p0 === undefined ||
      p1 === undefined ||
      p2 === undefined ||
      uv0 === undefined ||
      uv1 === undefined ||
      uv2 === undefined
    ) {
      continue;
    }

    const rasterVertices: [RasterVertex, RasterVertex, RasterVertex] = [
      { pixel: p0, uv: uv0 },
      { pixel: p1, uv: uv1 },
      { pixel: p2, uv: uv2 }
    ];
    rasterizeTriangle(framebuffer, texture, rasterVertices, opacity, maskAlphaSampler);
  }
};
