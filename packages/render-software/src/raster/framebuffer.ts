/**
 * A software framebuffer holding premultiplied-alpha color in floating point.
 *
 * Channels are stored as normalized floats in [0, 1] (premultiplied: RGB is
 * already multiplied by A). Keeping intermediate compositing in float and
 * quantizing only at read-out time keeps blending deterministic and avoids
 * accumulating per-step rounding error.
 *
 * Layout is row-major, top-left origin, 4 floats (R, G, B, A) per pixel,
 * matching RGBA8 output layout.
 */
export interface SoftwareFramebuffer {
  readonly width: number;
  readonly height: number;
  /** length === width * height * 4, premultiplied normalized RGBA. */
  readonly data: Float64Array;
}

export const createSoftwareFramebuffer = (
  width: number,
  height: number
): SoftwareFramebuffer => ({
  width,
  height,
  // Float64Array is zero-initialized: transparent (0,0,0,0), matching
  // clearColor(0,0,0,0) in the WebGL2 renderer.
  data: new Float64Array(width * height * 4)
});

function quantizeChannel(value: number): number {
  // Deterministic quantization: clamp to [0,1], scale to [0,255], round half up.
  const clamped = value < 0 ? 0 : value > 1 ? 1 : value;
  return Math.round(clamped * 255);
}

/**
 * Read the framebuffer as a premultiplied-alpha RGBA8 byte buffer.
 * Row-major, top-left origin, 4 bytes per pixel.
 */
export const readFramebufferPremultipliedRgba8 = (
  framebuffer: SoftwareFramebuffer
): Uint8Array => {
  const out = new Uint8Array(framebuffer.width * framebuffer.height * 4);
  const data = framebuffer.data;
  for (let index = 0; index < out.length; index += 1) {
    out[index] = quantizeChannel(data[index] ?? 0);
  }
  return out;
};

/**
 * Read the framebuffer as a straight (non-premultiplied) RGBA8 byte buffer.
 * Un-premultiplies each pixel: for alpha a>0, c_straight = round(c_premul/a);
 * for a==0 the RGB is 0. Standard PNG expects straight alpha, so this is the
 * form written to PNG.
 */
export const readFramebufferStraightRgba8 = (
  framebuffer: SoftwareFramebuffer
): Uint8Array => {
  const width = framebuffer.width;
  const height = framebuffer.height;
  const out = new Uint8Array(width * height * 4);
  const data = framebuffer.data;
  const pixelCount = width * height;
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const base = pixel * 4;
    const alpha = data[base + 3] ?? 0;
    const clampedAlpha = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
    if (clampedAlpha <= 0) {
      out[base] = 0;
      out[base + 1] = 0;
      out[base + 2] = 0;
      out[base + 3] = 0;
      continue;
    }
    out[base] = quantizeChannel((data[base] ?? 0) / clampedAlpha);
    out[base + 1] = quantizeChannel((data[base + 1] ?? 0) / clampedAlpha);
    out[base + 2] = quantizeChannel((data[base + 2] ?? 0) / clampedAlpha);
    out[base + 3] = Math.round(clampedAlpha * 255);
  }
  return out;
};
