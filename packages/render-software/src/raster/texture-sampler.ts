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
 * Prepare a texture source for NEAREST sampling. Matches the WebGL2 upload
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
 * NEAREST sample with CLAMP_TO_EDGE.
 *
 * Texel selection rule (matches GL NEAREST for normalized UVs, top-left UV
 * origin as declared by RenderUvSpace "layer-local-top-left-0-1-v1"):
 * texelIndex = floor(uv * dimension), then clamped to [0, dimension - 1].
 * UVs outside [0,1) map to the nearest edge texel (CLAMP_TO_EDGE).
 */
export const sampleTextureNearest = (
  texture: PreparedTexture,
  u: number,
  v: number
): TextureSample => {
  if (texture.width <= 0 || texture.height <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const texelX = clampInt(Math.floor(u * texture.width), texture.width);
  const texelY = clampInt(Math.floor(v * texture.height), texture.height);
  const base = (texelY * texture.width + texelX) * 4;
  const data = texture.data;
  return {
    r: data[base] ?? 0,
    g: data[base + 1] ?? 0,
    b: data[base + 2] ?? 0,
    a: data[base + 3] ?? 0
  };
};
