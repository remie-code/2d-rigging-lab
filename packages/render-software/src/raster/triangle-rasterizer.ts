import type { RenderPoint } from "@private-2d-rigging-lab/render-core";

import { blendFragmentOver } from "./blend.js";
import type { SoftwareFramebuffer } from "./framebuffer.js";
import { sampleTextureLinear, type PreparedTexture } from "./texture-sampler.js";

/**
 * Per-vertex data for one triangle: image-pixel-space position (continuous
 * coordinates where pixel index (px, py) has center (px + 0.5, py + 0.5)) and
 * the layer-local UV to interpolate.
 */
export interface RasterVertex {
  readonly pixel: RenderPoint;
  readonly uv: RenderPoint;
}

/**
 * Sampler for per-fragment mask alpha in [0, 1], indexed by pixel (px, py).
 * Returns 1 when there is no mask.
 */
export type MaskAlphaSampler = (px: number, py: number) => number;

const NO_MASK: MaskAlphaSampler = () => 1;

/**
 * Twice the signed area of triangle (a, b, c) in pixel space. Positive for one
 * winding, negative for the other. Zero for a degenerate (collinear) triangle.
 */
function edgeArea2(a: RenderPoint, b: RenderPoint, c: RenderPoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

/**
 * Top-left edge rule test for a directed edge from `from` to `to`, given the
 * edge function value `w` at the sample point (using consistent CCW winding).
 *
 * An edge is a "top" edge if it is horizontal and points left (its area
 * contribution goes right-to-left along the top). An edge is a "left" edge if
 * it goes downward. Fragments exactly on the edge (w == 0) are covered only for
 * top-left edges; on right/bottom edges they are excluded. This makes shared
 * edges between adjacent triangles belong to exactly one triangle, avoiding
 * double-draw and gaps deterministically.
 *
 * Winding is normalized to CCW before this test (see rasterizeTriangle), so the
 * classification is well-defined regardless of input vertex order.
 */
function edgeIsTopLeft(from: RenderPoint, to: RenderPoint): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // With CCW winding in a y-down pixel space, the interior is to the right of
  // each directed edge. A left edge is one going "downward" in image space
  // (dy > 0); a top edge is a horizontal edge going in the -x direction
  // (dy == 0 && dx < 0).
  const isLeft = dy > 0;
  const isTop = dy === 0 && dx < 0;
  return isLeft || isTop;
}

/**
 * Rasterize a single textured triangle into the framebuffer.
 *
 * Coverage is decided by pixel-center sampling with a deterministic top-left
 * rule. UVs are barycentric-interpolated, the texture is sampled LINEAR
 * (bilinear with CLAMP_TO_EDGE), the sampled (premultiplied) colour is scaled by
 * `opacity * maskAlpha` on all channels, and the result is composited with
 * premultiplied "over".
 *
 * Degenerate (zero signed area) triangles are skipped.
 */
export const rasterizeTriangle = (
  framebuffer: SoftwareFramebuffer,
  texture: PreparedTexture,
  vertices: readonly [RasterVertex, RasterVertex, RasterVertex],
  opacity: number,
  maskAlphaSampler: MaskAlphaSampler = NO_MASK
): void => {
  let v0 = vertices[0];
  let v1 = vertices[1];
  let v2 = vertices[2];

  let area2 = edgeArea2(v0.pixel, v1.pixel, v2.pixel);
  if (area2 === 0) {
    return; // Degenerate triangle: zero area, nothing to fill.
  }

  // Normalize to CCW (positive area2) so the top-left rule classification and
  // the interior-sign test are consistent regardless of input winding.
  if (area2 < 0) {
    const swap = v1;
    v1 = v2;
    v2 = swap;
    area2 = -area2;
  }

  const p0 = v0.pixel;
  const p1 = v1.pixel;
  const p2 = v2.pixel;

  // Pixel-index bounding box (inclusive), clamped to the framebuffer.
  const minXf = Math.min(p0.x, p1.x, p2.x);
  const maxXf = Math.max(p0.x, p1.x, p2.x);
  const minYf = Math.min(p0.y, p1.y, p2.y);
  const maxYf = Math.max(p0.y, p1.y, p2.y);

  const startX = Math.max(0, Math.floor(minXf - 0.5));
  const endX = Math.min(framebuffer.width - 1, Math.ceil(maxXf - 0.5));
  const startY = Math.max(0, Math.floor(minYf - 0.5));
  const endY = Math.min(framebuffer.height - 1, Math.ceil(maxYf - 0.5));

  if (startX > endX || startY > endY) {
    return;
  }

  // Per-edge top-left inclusion: an on-edge sample (w == 0) is covered only if
  // that edge is a top or left edge. This makes shared edges belong to exactly
  // one of two adjacent triangles (no double-draw, no gap), deterministically.
  const edge0TopLeft = edgeIsTopLeft(p1, p2);
  const edge1TopLeft = edgeIsTopLeft(p2, p0);
  const edge2TopLeft = edgeIsTopLeft(p0, p1);

  const inverseArea2 = 1 / area2;

  for (let py = startY; py <= endY; py += 1) {
    const sampleY = py + 0.5;
    for (let px = startX; px <= endX; px += 1) {
      const sampleX = px + 0.5;

      // Edge functions (CCW): interior when all >= 0.
      const w0 = edgeArea2(p1, p2, { x: sampleX, y: sampleY });
      const w1 = edgeArea2(p2, p0, { x: sampleX, y: sampleY });
      const w2 = edgeArea2(p0, p1, { x: sampleX, y: sampleY });

      const inside0 = w0 > 0 || (w0 === 0 && edge0TopLeft);
      const inside1 = w1 > 0 || (w1 === 0 && edge1TopLeft);
      const inside2 = w2 > 0 || (w2 === 0 && edge2TopLeft);
      if (!inside0 || !inside1 || !inside2) {
        continue;
      }

      const maskAlpha = maskAlphaSampler(px, py);
      if (maskAlpha <= 0) {
        continue;
      }

      // Barycentric weights.
      const b0 = w0 * inverseArea2;
      const b1 = w1 * inverseArea2;
      const b2 = w2 * inverseArea2;

      const u = b0 * v0.uv.x + b1 * v1.uv.x + b2 * v2.uv.x;
      const vCoord = b0 * v0.uv.y + b1 * v1.uv.y + b2 * v2.uv.y;

      const sample = sampleTextureLinear(texture, u, vCoord);
      const scale = opacity * maskAlpha;
      if (scale <= 0) {
        continue;
      }

      const pixelIndex = py * framebuffer.width + px;
      blendFragmentOver(framebuffer, pixelIndex, {
        r: sample.r * scale,
        g: sample.g * scale,
        b: sample.b * scale,
        a: sample.a * scale
      });
    }
  }
};
