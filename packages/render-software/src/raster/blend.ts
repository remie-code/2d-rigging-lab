import type { SoftwareFramebuffer } from "./framebuffer.js";

/**
 * A source fragment in premultiplied normalized RGBA. By the time a fragment
 * reaches blending it has already had (opacity * maskAlpha) multiplied into all
 * four channels, mirroring the WebGL2 fragment shader:
 *   outColor = color * (u_opacity * maskAlpha)
 * where `color` is a premultiplied texel. RGB and A are all scaled, which keeps
 * the value premultiplied.
 */
export interface PremultipliedFragment {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Premultiplied "over" blend of a source fragment onto a framebuffer pixel,
 * matching blendFunc(ONE, ONE_MINUS_SRC_ALPHA):
 *   dst_rgb = src_rgb + dst_rgb * (1 - src_a)
 *   dst_a   = src_a   + dst_a   * (1 - src_a)
 * All arithmetic is in premultiplied normalized float space; quantization to
 * bytes happens only at framebuffer read-out.
 */
export const blendFragmentOver = (
  framebuffer: SoftwareFramebuffer,
  pixelIndex: number,
  fragment: PremultipliedFragment
): void => {
  const base = pixelIndex * 4;
  const data = framebuffer.data;
  const inverseSourceAlpha = 1 - fragment.a;
  data[base] = fragment.r + (data[base] ?? 0) * inverseSourceAlpha;
  data[base + 1] = fragment.g + (data[base + 1] ?? 0) * inverseSourceAlpha;
  data[base + 2] = fragment.b + (data[base + 2] ?? 0) * inverseSourceAlpha;
  data[base + 3] = fragment.a + (data[base + 3] ?? 0) * inverseSourceAlpha;
};
