import type { RenderRgba8TextureSource } from "@private-2d-rigging-lab/render-core";

/**
 * A texture prepared for sampling: normalized, premultiplied RGBA float
 * channels in row-major, top-left-origin layout.
 *
 * The WebGL2 renderer uploads premultiplied bytes (webgl2-textures.ts
 * `createUploadBytes`): "premultiplied" sources are used as-is, "straight"
 * sources have RGB multiplied by A via round(c * a / 255). We reproduce that
 * byte-exact premultiply here, then normalize to [0,1] floats so blending is
 * done in premultiplied float space.
 */
export interface PreparedTexture {
  readonly width: number;
  readonly height: number;
  /** Normalized premultiplied RGBA, length === width * height * 4. */
  readonly data: Float64Array;
}

/**
 * Prepare a texture source for LINEAR sampling. Matches the WebGL2 upload
 * premultiply exactly: for "straight" sources, premultiplied byte value is
 * round(c * a / 255) before normalization.
 */
export const prepareTexture = (
  source: RenderRgba8TextureSource
): PreparedTexture => {
  const width = source.width;
  const height = source.height;
  const pixelCount = width * height;
  const data = new Float64Array(pixelCount * 4);
  const bytes = source.bytes;
  const premultipliedSource = source.alphaMode === "premultiplied";

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const base = pixel * 4;
    const r = bytes[base] ?? 0;
    const g = bytes[base + 1] ?? 0;
    const b = bytes[base + 2] ?? 0;
    const a = bytes[base + 3] ?? 0;
    if (premultipliedSource) {
      data[base] = r / 255;
      data[base + 1] = g / 255;
      data[base + 2] = b / 255;
      data[base + 3] = a / 255;
    } else {
      // Byte-exact premultiply matching createUploadBytes, then normalize.
      data[base] = Math.round((r * a) / 255) / 255;
      data[base + 1] = Math.round((g * a) / 255) / 255;
      data[base + 2] = Math.round((b * a) / 255) / 255;
      data[base + 3] = a / 255;
    }
  }

  return { width, height, data };
};

function clampInt(value: number, maxExclusive: number): number {
  if (value < 0) {
    return 0;
  }
  if (value >= maxExclusive) {
    return maxExclusive - 1;
  }
  return value;
}

/**
 * A premultiplied normalized RGBA sample.
 */
export interface TextureSample {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/**
 * Bilinearly interpolate one channel of the four neighbouring texels in
 * premultiplied normalized float space.
 */
function bilerpChannel(
  data: Float64Array,
  base00: number,
  base10: number,
  base01: number,
  base11: number,
  channel: number,
  fracX: number,
  fracY: number
): number {
  const c00 = data[base00 + channel] ?? 0;
  const c10 = data[base10 + channel] ?? 0;
  const c01 = data[base01 + channel] ?? 0;
  const c11 = data[base11 + channel] ?? 0;
  const top = c00 + (c10 - c00) * fracX;
  const bottom = c01 + (c11 - c01) * fracX;
  return top + (bottom - top) * fracY;
}

/**
 * LINEAR (bilinear) sample with CLAMP_TO_EDGE.
 *
 * Matches GL LINEAR + CLAMP_TO_EDGE for normalized UVs with a top-left UV
 * origin (RenderUvSpace "layer-local-top-left-0-1-v1"):
 *
 *   coord = uv * dimension - 0.5   (texel centres sit at integer indices)
 *   i0    = floor(coord),  i1 = i0 + 1,  frac = coord - i0
 *   i0, i1 are each clamped to [0, dimension - 1] (CLAMP_TO_EDGE)
 *
 * The two axes are combined as a bilinear blend of the four neighbouring
 * texels, weighted by fracX / fracY. Interpolation happens in the prepared
 * premultiplied normalized float space, so the transparent (0,0,0,0) padding
 * around a layer attenuates colour toward transparency without introducing a
 * dark or white fringe at the edge.
 */
export const sampleTextureLinear = (
  texture: PreparedTexture,
  u: number,
  v: number
): TextureSample => {
  const { width, height, data } = texture;
  if (width <= 0 || height <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const coordX = u * width - 0.5;
  const coordY = v * height - 0.5;

  const floorX = Math.floor(coordX);
  const floorY = Math.floor(coordY);
  const fracX = coordX - floorX;
  const fracY = coordY - floorY;

  const x0 = clampInt(floorX, width);
  const x1 = clampInt(floorX + 1, width);
  const y0 = clampInt(floorY, height);
  const y1 = clampInt(floorY + 1, height);

  const base00 = (y0 * width + x0) * 4;
  const base10 = (y0 * width + x1) * 4;
  const base01 = (y1 * width + x0) * 4;
  const base11 = (y1 * width + x1) * 4;

  return {
    r: bilerpChannel(data, base00, base10, base01, base11, 0, fracX, fracY),
    g: bilerpChannel(data, base00, base10, base01, base11, 1, fracX, fracY),
    b: bilerpChannel(data, base00, base10, base01, base11, 2, fracX, fracY),
    a: bilerpChannel(data, base00, base10, base01, base11, 3, fracX, fracY)
  };
};
