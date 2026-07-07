/**
 * Algorithm-neutral connected-component analysis over a boolean opacity mask:
 * 4-neighbour flood fill into components, deterministic main-component
 * selection, per-component mask rasterisation, and hole-like region counting.
 *
 * Extracted verbatim from the v6 contour pipeline. Behaviour is identical.
 */

import { getFourNeighbors, type GeometryPoint, type PixelBounds } from "./geometry-primitives.js";

export interface OpaqueComponent {
  readonly pixelIndices: readonly number[];
  readonly bounds: PixelBounds;
}

export const findOpaqueComponents = (
  mask: readonly boolean[],
  width: number,
  height: number
): readonly OpaqueComponent[] => {
  const visited = new Uint8Array(width * height);
  const components: OpaqueComponent[] = [];

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
      pixelIndices,
      bounds: { left, top, right, bottom }
    });
  }

  return components;
};

export const selectMainComponent = (
  components: readonly OpaqueComponent[]
): OpaqueComponent | undefined =>
  [...components].sort((left, right) => {
    const areaDelta = right.pixelIndices.length - left.pixelIndices.length;
    if (areaDelta !== 0) {
      return areaDelta;
    }

    return (
      left.bounds.top - right.bounds.top ||
      left.bounds.left - right.bounds.left ||
      left.bounds.bottom - right.bounds.bottom ||
      left.bounds.right - right.bounds.right
    );
  })[0];

export const createComponentMask = (
  component: OpaqueComponent,
  width: number,
  height: number
): readonly boolean[] => {
  const mask = new Array<boolean>(width * height).fill(false);
  for (const index of component.pixelIndices) {
    mask[index] = true;
  }

  return mask;
};

export const countHoleLikeRegions = (
  mainMask: readonly boolean[],
  width: number,
  height: number,
  bounds: PixelBounds
): number => {
  const visited = new Uint8Array(width * height);
  let count = 0;

  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const index = y * width + x;
      if (mainMask[index] === true || visited[index] === 1) {
        continue;
      }

      const stack: GeometryPoint[] = [{ x, y }];
      let touchesBounds = false;
      visited[index] = 1;

      while (stack.length > 0) {
        const current = stack.pop();
        if (current === undefined) {
          continue;
        }

        if (
          current.x === bounds.left ||
          current.x === bounds.right - 1 ||
          current.y === bounds.top ||
          current.y === bounds.bottom - 1
        ) {
          touchesBounds = true;
        }

        for (const neighbor of getFourNeighbors(current.x, current.y, width, height)) {
          if (
            neighbor.x < bounds.left ||
            neighbor.x >= bounds.right ||
            neighbor.y < bounds.top ||
            neighbor.y >= bounds.bottom
          ) {
            continue;
          }

          const neighborIndex = neighbor.y * width + neighbor.x;
          if (mainMask[neighborIndex] === true || visited[neighborIndex] === 1) {
            continue;
          }

          visited[neighborIndex] = 1;
          stack.push(neighbor);
        }
      }

      if (!touchesBounds) {
        count += 1;
      }
    }
  }

  return count;
};
