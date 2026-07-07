/**
 * v6 multi-island (connected-component) surface.
 *
 * The implementation now lives in the algorithm-neutral
 * `mesh-geometry/alpha-island-components` module. This file preserves the
 * v6-named public surface (`V6...` types and functions) by delegating to the
 * neutral module, so v6 backends and the package barrel keep their exact API
 * and numeric behaviour.
 */

import {
  ALPHA_ISLAND_NOISE_FILTER_CONSTANTS,
  type AlphaIslandBudgetAllocation,
  type AlphaIslandDescriptor,
  type AlphaIslandDetectionResult,
  type AlphaIslandNoiseFilterResult,
  type AlphaIslandPixelBounds,
  allocateAlphaIslandBudgets,
  createAlphaIslandRgbaBytes,
  detectRawAlphaIslands,
  filterAlphaIslands,
  unionAlphaIslandPixelBounds
} from "./mesh-geometry/alpha-island-components.js";

export type V6AlphaIslandPixelBounds = AlphaIslandPixelBounds;
export type V6RawAlphaIslandDescriptor = AlphaIslandDescriptor;
export type V6AlphaIslandNoiseFilterResult = AlphaIslandNoiseFilterResult;
export type V6AlphaIslandBudgetAllocation = AlphaIslandBudgetAllocation;
export type V6AlphaIslandDetectionResult = AlphaIslandDetectionResult;

export const V6_ALPHA_ISLAND_NOISE_FILTER_CONSTANTS = ALPHA_ISLAND_NOISE_FILTER_CONSTANTS;

export const detectV6RawAlphaIslands = detectRawAlphaIslands;
export const filterV6AlphaIslands = filterAlphaIslands;
export const createV6AlphaIslandRgbaBytes = createAlphaIslandRgbaBytes;
export const allocateV6AlphaIslandBudgets = allocateAlphaIslandBudgets;
export const unionV6AlphaIslandPixelBounds = unionAlphaIslandPixelBounds;
