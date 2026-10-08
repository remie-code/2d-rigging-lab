/**
 * Algorithm-neutral alpha-mask operations: binarisation + soft blur,
 * single-pixel crack closing, isolated-noise removal, and iterative dilation
 * (mask expansion).
 *
 * Extracted verbatim from the v6 contour pipeline. The numeric behaviour is
 * identical; the only additive change is that the mask-expansion clamp upper
 * bound is now a parameter (`maxExpansionPixels`) instead of a hard-coded
 * constant, so callers can widen the ceiling. v6 passes the existing bound so
 * its behaviour is byte-identical.
 */

import { clampInt, getFourNeighbors } from "./geometry-primitives.js";

export interface SoftAlphaMask {
  readonly width: number;
  readonly height: number;
  readonly mask: readonly boolean[];
  readonly inputOpaquePixelCount: number;
  readonly softMaskOpaquePixelCount: number;
}

export interface PaddedRgba {
  readonly rgbaBytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly paddingPixels: number;
}

/**
 * Build an all-around zero-padded (fully transparent border) copy of an RGBA
 * buffer, enlarging the canvas by `paddingPixels` on every side. The original
 * pixels are copied row-by-row into the centre; the new border is left at the
 * zero-fill default (rgba = 0,0,0,0 => transparent background).
 *
 * Algorithm-neutral: this only reshapes a buffer. Callers that need mask
 * expansion to grow past the original texture edge run their whole pixel-space
 * pipeline on this padded canvas and unpad the resulting coordinates afterwards.
 * If padding is 0 or the input dimensions are invalid, the original buffer is
 * returned unchanged (paddingPixels reported as 0).
 */
export const createPaddedRgba = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  paddingPixels: number
): PaddedRgba => {
  const pad = Math.max(0, Math.trunc(paddingPixels));
  if (pad === 0 || width <= 0 || height <= 0 || rgbaBytes.byteLength !== width * height * 4) {
    return { rgbaBytes, width, height, paddingPixels: 0 };
  }

  const paddedWidth = width + pad * 2;
  const paddedHeight = height + pad * 2;
  const padded = new Uint8Array(paddedWidth * paddedHeight * 4);
  const sourceRowBytes = width * 4;
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * sourceRowBytes;
    const targetOffset = ((y + pad) * paddedWidth + pad) * 4;
    padded.set(rgbaBytes.subarray(sourceOffset, sourceOffset + sourceRowBytes), targetOffset);
  }

  return { rgbaBytes: padded, width: paddedWidth, height: paddedHeight, paddingPixels: pad };
};

/**
 * The v6 default upper bound on iterative mask expansion. Preserved here as the
 * neutral default so the v6 path stays unchanged while future callers may pass
 * a larger ceiling explicitly.
 */
export const DEFAULT_MAX_MASK_EXPANSION_PIXELS = 8;

const DEFAULT_SOFT_ALPHA_THRESHOLD = 0.18;

export const createSoftAlphaMask = (
  rgbaBytes: Uint8Array,
  width: number,
  height: number,
  alphaThreshold: number,
  softAlphaThreshold: number = DEFAULT_SOFT_ALPHA_THRESHOLD
): SoftAlphaMask => {
  const originalAlpha: number[] = [];
  let inputOpaquePixelCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = (rgbaBytes[(y * width + x) * 4 + 3] ?? 0) / 255;
      originalAlpha.push(alpha);
      if (alpha * 255 > alphaThreshold) {
        inputOpaquePixelCount += 1;
      }
    }
  }

  const blurredMask = originalAlpha.map((_alpha, index) => {
    const x = index % width;
    const y = Math.floor(index / width);
    const blurred = blurAlphaAt(originalAlpha, width, height, x, y);
    return blurred >= softAlphaThreshold || originalAlpha[index]! * 255 > alphaThreshold;
  });
  const mask = removeIsolatedAlphaNoise(
    closeSinglePixelCracks(blurredMask, width, height),
    originalAlpha,
    width,
    height
  );

  return {
    width,
    height,
    mask,
    inputOpaquePixelCount,
    softMaskOpaquePixelCount: mask.reduce((count, isOpaque) => count + (isOpaque ? 1 : 0), 0)
  };
};

const blurAlphaAt = (
  alpha: readonly number[],
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  let weightedSum = 0;
  let weightTotal = 0;

  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const sampleX = clampInt(x + dx, 0, width - 1);
      const sampleY = clampInt(y + dy, 0, height - 1);
      const weight = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
      weightedSum += (alpha[sampleY * width + sampleX] ?? 0) * weight;
      weightTotal += weight;
    }
  }

  return weightTotal === 0 ? 0 : weightedSum / weightTotal;
};

const closeSinglePixelCracks = (
  mask: readonly boolean[],
  width: number,
  height: number
): readonly boolean[] =>
  mask.map((isOpaque, index) => {
    if (isOpaque) {
      return true;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    return countOpaqueNeighbors(mask, width, height, x, y) >= 5;
  });

const removeIsolatedAlphaNoise = (
  mask: readonly boolean[],
  originalAlpha: readonly number[],
  width: number,
  height: number
): readonly boolean[] =>
  mask.map((isOpaque, index) => {
    if (!isOpaque || (originalAlpha[index] ?? 0) >= 0.5) {
      return isOpaque;
    }

    const x = index % width;
    const y = Math.floor(index / width);
    return countOpaqueNeighbors(mask, width, height, x, y) > 1;
  });

const countOpaqueNeighbors = (
  mask: readonly boolean[],
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  let count = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) {
        continue;
      }

      const sampleX = x + dx;
      const sampleY = y + dy;
      if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
        continue;
      }

      if (mask[sampleY * width + sampleX] === true) {
        count += 1;
      }
    }
  }

  return count;
};

/**
 * Clamp a requested expansion amount into [0, maxExpansionPixels].
 *
 * `maxExpansionPixels` defaults to the v6 ceiling so the v6 path is unchanged.
 * Future callers can raise (or take responsibility for) the ceiling by passing
 * a different value.
 */
export const resolveMaskExpansionPixels = (
  value: number | undefined,
  maxExpansionPixels: number = DEFAULT_MAX_MASK_EXPANSION_PIXELS
): number =>
  value === undefined || !Number.isFinite(value)
    ? 0
    : clampInt(Math.round(value), 0, maxExpansionPixels);

/**
 * Iterative 4-neighbour dilation of a boolean mask. The number of iterations is
 * exactly `expansionPixels`; the caller is responsible for clamping (see
 * `resolveMaskExpansionPixels`).
 */
export const expandMask = (
  mask: readonly boolean[],
  width: number,
  height: number,
  expansionPixels: number
): readonly boolean[] => {
  let expanded = [...mask];

  for (let iteration = 0; iteration < expansionPixels; iteration += 1) {
    const next = [...expanded];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (expanded[y * width + x] === true) {
          continue;
        }

        if (
          getFourNeighbors(x, y, width, height).some(
            (neighbor) => expanded[neighbor.y * width + neighbor.x] === true
          )
        ) {
          next[y * width + x] = true;
        }
      }
    }

    expanded = next;
  }

  return expanded;
};
