/**
 * Algorithm-neutral multi-island (connected-component) analysis over a raw
 * alpha mask: component detection, tiny-noise filtering, per-component vertex
 * budget allocation, per-island RGBA isolation, and bounds union.
 *
 * Extracted verbatim from the v6 alpha-islands module. Behaviour is identical;
 * only names are neutralised. The v6-named surface delegates to these.
 */

import type { MeshDensityHint } from "../mesh-generation-contract.js";
import { getFourNeighbors, type PixelBounds } from "./geometry-primitives.js";

export type AlphaIslandPixelBounds = PixelBounds;

export interface AlphaIslandDescriptor {
  readonly componentOrder: number;
  readonly pixelCount: number;
  readonly bounds: AlphaIslandPixelBounds;
  readonly pixelIndices: readonly number[];
}

export interface AlphaIslandNoiseFilterResult {
  readonly keptIslands: readonly AlphaIslandDescriptor[];
  readonly skippedTinyNoiseIslands: readonly AlphaIslandDescriptor[];
  readonly skippedTinyNoisePixelCount: number;
  readonly largestComponentPixelCount: number;
}

export interface AlphaIslandBudgetAllocation {
  readonly componentOrder: number;
  readonly maxBoundaryVertices: number;
  readonly maxInteriorVertices: number;
  readonly budgetWeight: number;
}

export interface AlphaIslandDetectionResult {
  readonly status: "detected" | "invalid-texture";
  readonly width: number;
  readonly height: number;
  readonly opaquePixelCount: number;
  readonly islands: readonly AlphaIslandDescriptor[];
}

export const ALPHA_ISLAND_NOISE_FILTER_CONSTANTS = {
  // Wave95 starts conservatively: obvious dust is removed, slim authorial parts are kept.
  alwaysDropPixelCountMax: 2,
  alwaysDropBoundsWidthMax: 2,
  alwaysDropBoundsHeightMax: 2,
  relativeTinyPixelCountMax: 8,
  relativeTinyAreaRatioMax: 0.005,
  relativeTinyBoundsWidthMax: 4,
  relativeTinyBoundsHeightMax: 4,
  meaningfulDimensionMin: 6
} as const;

const DEFAULT_ALPHA_THRESHOLD = 8;
const MIN_BOUNDARY_VERTEX_BUDGET = 3;
const MIN_INTERIOR_VERTEX_BUDGET = 0;

export const detectRawAlphaIslands = (input: {
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly rgbaBytes: Uint8Array;
  readonly alphaThreshold?: number;
}): AlphaIslandDetectionResult => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  if (width <= 0 || height <= 0 || input.rgbaBytes.byteLength !== width * height * 4) {
    return {
      status: "invalid-texture",
      width,
      height,
      opaquePixelCount: 0,
      islands: []
    };
  }

  const alphaThreshold = input.alphaThreshold ?? DEFAULT_ALPHA_THRESHOLD;
  const rawMask = new Array<boolean>(width * height).fill(false);
  let opaquePixelCount = 0;
  for (let index = 0; index < width * height; index += 1) {
    const alpha = input.rgbaBytes[index * 4 + 3] ?? 0;
    if (alpha <= alphaThreshold) {
      continue;
    }

    rawMask[index] = true;
    opaquePixelCount += 1;
  }

  return {
    status: "detected",
    width,
    height,
    opaquePixelCount,
    islands: findRawAlphaComponents(rawMask, width, height)
  };
};

export const filterAlphaIslands = (
  islands: readonly AlphaIslandDescriptor[]
): AlphaIslandNoiseFilterResult => {
  const largestComponentPixelCount = Math.max(0, ...islands.map((island) => island.pixelCount));
  const keptIslands: AlphaIslandDescriptor[] = [];
  const skippedTinyNoiseIslands: AlphaIslandDescriptor[] = [];

  for (const island of islands) {
    if (isAlphaIslandTinyNoise(island, largestComponentPixelCount)) {
      skippedTinyNoiseIslands.push(island);
      continue;
    }

    keptIslands.push(island);
  }

  return {
    keptIslands,
    skippedTinyNoiseIslands,
    skippedTinyNoisePixelCount: skippedTinyNoiseIslands.reduce(
      (sum, island) => sum + island.pixelCount,
      0
    ),
    largestComponentPixelCount
  };
};

export const createAlphaIslandRgbaBytes = (input: {
  readonly sourceRgbaBytes: Uint8Array;
  readonly textureSize: {
    readonly width: number;
    readonly height: number;
  };
  readonly island: AlphaIslandDescriptor;
}): Uint8Array => {
  const width = Math.round(input.textureSize.width);
  const height = Math.round(input.textureSize.height);
  const isolated = new Uint8Array(Math.max(0, width * height * 4));
  if (width <= 0 || height <= 0 || input.sourceRgbaBytes.byteLength !== width * height * 4) {
    return isolated;
  }

  for (const pixelIndex of input.island.pixelIndices) {
    const byteIndex = pixelIndex * 4;
    isolated[byteIndex] = input.sourceRgbaBytes[byteIndex] ?? 0;
    isolated[byteIndex + 1] = input.sourceRgbaBytes[byteIndex + 1] ?? 0;
    isolated[byteIndex + 2] = input.sourceRgbaBytes[byteIndex + 2] ?? 0;
    isolated[byteIndex + 3] = input.sourceRgbaBytes[byteIndex + 3] ?? 0;
  }

  return isolated;
};

export const allocateAlphaIslandBudgets = (input: {
  readonly densityHint: MeshDensityHint;
  readonly islands: readonly AlphaIslandDescriptor[];
  readonly globalMaxBoundaryVertices: number;
  readonly globalMaxInteriorVertices: number;
}): readonly AlphaIslandBudgetAllocation[] => {
  const weighted = input.islands.map((island) => ({
    island,
    weight: calculateIslandBudgetWeight(island)
  }));
  const boundaryBudgets = allocateIntegerBudgets({
    weightedItems: weighted,
    totalBudget: input.globalMaxBoundaryVertices,
    minBudget: MIN_BOUNDARY_VERTEX_BUDGET
  });
  const interiorBudgets = allocateIntegerBudgets({
    weightedItems: weighted,
    totalBudget: input.globalMaxInteriorVertices,
    minBudget: input.densityHint === "low" ? 0 : MIN_INTERIOR_VERTEX_BUDGET
  });

  return weighted.map(({ island, weight }) => ({
    componentOrder: island.componentOrder,
    maxBoundaryVertices: boundaryBudgets.get(island.componentOrder) ?? MIN_BOUNDARY_VERTEX_BUDGET,
    maxInteriorVertices: interiorBudgets.get(island.componentOrder) ?? MIN_INTERIOR_VERTEX_BUDGET,
    budgetWeight: roundMetric(weight)
  }));
};

export const unionAlphaIslandPixelBounds = (
  islands: readonly AlphaIslandDescriptor[]
): AlphaIslandPixelBounds | undefined => {
  if (islands.length === 0) {
    return undefined;
  }

  return {
    left: Math.min(...islands.map((island) => island.bounds.left)),
    top: Math.min(...islands.map((island) => island.bounds.top)),
    right: Math.max(...islands.map((island) => island.bounds.right)),
    bottom: Math.max(...islands.map((island) => island.bounds.bottom))
  };
};

const findRawAlphaComponents = (
  mask: readonly boolean[],
  width: number,
  height: number
): readonly AlphaIslandDescriptor[] => {
  const visited = new Uint8Array(width * height);
  const components: AlphaIslandDescriptor[] = [];

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== true || visited[index] === 1) {
      continue;
    }

    const stack = [index];
    const pixelIndices: number[] = [];
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    visited[index] = 1;

    while (stack.length > 0) {
      const current = stack.pop();
      if (current === undefined) {
        continue;
      }

      const x = current % width;
      const y = Math.floor(current / width);
      pixelIndices.push(current);
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + 1);
      bottom = Math.max(bottom, y + 1);

      for (const neighbor of getFourNeighbors(x, y, width, height)) {
        const neighborIndex = neighbor.y * width + neighbor.x;
        if (mask[neighborIndex] !== true || visited[neighborIndex] === 1) {
          continue;
        }

        visited[neighborIndex] = 1;
        stack.push(neighborIndex);
      }
    }

    components.push({
      componentOrder: components.length,
      pixelCount: pixelIndices.length,
      bounds: { left, top, right, bottom },
      pixelIndices
    });
  }

  return components;
};

const isAlphaIslandTinyNoise = (
  island: AlphaIslandDescriptor,
  largestComponentPixelCount: number
): boolean => {
  const width = island.bounds.right - island.bounds.left;
  const height = island.bounds.bottom - island.bounds.top;
  const maxDimension = Math.max(width, height);
  const ratio =
    largestComponentPixelCount <= 0 ? 1 : island.pixelCount / largestComponentPixelCount;

  if (island.pixelCount <= ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.alwaysDropPixelCountMax) {
    return true;
  }

  if (
    width <= ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.alwaysDropBoundsWidthMax &&
    height <= ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.alwaysDropBoundsHeightMax
  ) {
    return true;
  }

  return (
    island.pixelCount <= ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.relativeTinyPixelCountMax &&
    ratio <= ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.relativeTinyAreaRatioMax &&
    width <= ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.relativeTinyBoundsWidthMax &&
    height <= ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.relativeTinyBoundsHeightMax &&
    maxDimension < ALPHA_ISLAND_NOISE_FILTER_CONSTANTS.meaningfulDimensionMin
  );
};

const calculateIslandBudgetWeight = (island: AlphaIslandDescriptor): number => {
  const width = Math.max(1, island.bounds.right - island.bounds.left);
  const height = Math.max(1, island.bounds.bottom - island.bounds.top);
  const boundingPerimeter = (width + height) * 2;
  return Math.max(1, island.pixelCount + Math.sqrt(island.pixelCount) * boundingPerimeter);
};

const allocateIntegerBudgets = (input: {
  readonly weightedItems: readonly {
    readonly island: AlphaIslandDescriptor;
    readonly weight: number;
  }[];
  readonly totalBudget: number;
  readonly minBudget: number;
}): ReadonlyMap<number, number> => {
  if (input.weightedItems.length === 0) {
    return new Map();
  }

  const minTotal = input.minBudget * input.weightedItems.length;
  const effectiveTotalBudget = Math.max(Math.trunc(input.totalBudget), minTotal);
  const remainderBudget = Math.max(0, effectiveTotalBudget - minTotal);
  const totalWeight = input.weightedItems.reduce((sum, item) => sum + item.weight, 0);
  const allocations = new Map<number, number>();
  const fractionalRemainders: {
    readonly componentOrder: number;
    readonly fraction: number;
    readonly weight: number;
  }[] = [];
  let assigned = 0;

  for (const item of input.weightedItems) {
    const exactExtra = totalWeight <= 0 ? 0 : (remainderBudget * item.weight) / totalWeight;
    const integerExtra = Math.floor(exactExtra);
    const value = input.minBudget + integerExtra;
    allocations.set(item.island.componentOrder, value);
    fractionalRemainders.push({
      componentOrder: item.island.componentOrder,
      fraction: exactExtra - integerExtra,
      weight: item.weight
    });
    assigned += value;
  }

  let remaining = Math.max(0, effectiveTotalBudget - assigned);
  for (const item of fractionalRemainders.sort(
    (left, right) =>
      right.fraction - left.fraction ||
      right.weight - left.weight ||
      left.componentOrder - right.componentOrder
  )) {
    if (remaining <= 0) {
      break;
    }

    allocations.set(item.componentOrder, (allocations.get(item.componentOrder) ?? input.minBudget) + 1);
    remaining -= 1;
  }

  return allocations;
};

const roundMetric = (value: number): number => {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
};
