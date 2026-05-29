import type { Grid2dKey } from "./normalized-runtime-graph.js";
import {
  cloneSampledStatePatch,
  interpolateStatePatches
} from "./keyform-linear1d-interpolation.js";
import type {
  SampledStatePatch,
  StatePatchInterpolationProblemCode
} from "./keyform-linear1d-interpolation.js";

export interface Grid2dCoordinate {
  readonly x: number;
  readonly y: number;
}

export type Grid2dInterpolationProblemCode =
  | "keyform.grid2dNoKeys"
  | "keyform.nonFiniteParameterValue"
  | "keyform.grid2dMissingKey"
  | StatePatchInterpolationProblemCode;

export interface Grid2dInterpolationProblem {
  readonly ok: false;
  readonly code: Grid2dInterpolationProblemCode;
  readonly sampledCoordinates?: Grid2dCoordinate;
  readonly missingCoordinates: readonly Grid2dCoordinate[];
  readonly duplicateCoordinates: readonly Grid2dCoordinate[];
  readonly clampedToKeyRange: boolean;
}

export interface Grid2dInterpolationSuccess {
  readonly ok: true;
  readonly statePatch: SampledStatePatch;
  readonly sampledCoordinates: Grid2dCoordinate;
  readonly source: "exact" | "interpolated" | "clamped-key-range";
  readonly missingCoordinates: readonly Grid2dCoordinate[];
  readonly duplicateCoordinates: readonly Grid2dCoordinate[];
  readonly clampedToKeyRange: boolean;
}

export type Grid2dInterpolationResult = Grid2dInterpolationSuccess | Grid2dInterpolationProblem;

export const interpolateGrid2dKeyform = (input: {
  readonly keys: readonly Grid2dKey[];
  readonly x: number;
  readonly y: number;
}): Grid2dInterpolationResult => {
  const sortedKeys = [...input.keys].sort((left, right) => left.x - right.x || left.y - right.y);
  const duplicateCoordinates = findDuplicateCoordinates(sortedKeys);
  const uniqueKeys = uniqueFirstKeysByCoordinate(sortedKeys);

  if (uniqueKeys.length === 0) {
    return createProblem({
      code: "keyform.grid2dNoKeys",
      duplicateCoordinates,
      clampedToKeyRange: false
    });
  }

  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) {
    return createProblem({
      code: "keyform.nonFiniteParameterValue",
      duplicateCoordinates,
      clampedToKeyRange: false
    });
  }

  const xValues = uniqueSortedNumbers(uniqueKeys.map((key) => key.x));
  const yValues = uniqueSortedNumbers(uniqueKeys.map((key) => key.y));
  const xRange = createRange(xValues);
  const yRange = createRange(yValues);

  if (xRange === undefined || yRange === undefined) {
    return createProblem({
      code: "keyform.grid2dNoKeys",
      duplicateCoordinates,
      clampedToKeyRange: false
    });
  }

  const sampledX = clamp(input.x, xRange.min, xRange.max);
  const sampledY = clamp(input.y, yRange.min, yRange.max);
  const clampedToKeyRange = sampledX !== input.x || sampledY !== input.y;
  const sampledCoordinates = { x: sampledX, y: sampledY };
  const xBracket = findBracket(xValues, sampledX);
  const yBracket = findBracket(yValues, sampledY);

  if (xBracket === undefined || yBracket === undefined) {
    return createProblem({
      code: "keyform.grid2dNoKeys",
      sampledCoordinates,
      duplicateCoordinates,
      clampedToKeyRange
    });
  }

  const keysByCoordinate = new Map(uniqueKeys.map((key) => [coordinateKey(key), key]));
  const lowerX = xBracket.lower;
  const upperX = xBracket.upper;
  const lowerY = yBracket.lower;
  const upperY = yBracket.upper;

  if (lowerX === upperX && lowerY === upperY) {
    const exactKey = keysByCoordinate.get(coordinateKey({ x: lowerX, y: lowerY }));
    if (exactKey === undefined) {
      return createMissingKeyProblem({
        sampledCoordinates,
        missingCoordinates: [{ x: lowerX, y: lowerY }],
        duplicateCoordinates,
        clampedToKeyRange
      });
    }

    const cloned = cloneSampledStatePatch(exactKey.statePatch);
    if (!cloned.ok) {
      return createProblem({
        code: cloned.code,
        sampledCoordinates,
        duplicateCoordinates,
        clampedToKeyRange
      });
    }

    return {
      ok: true,
      statePatch: cloned.statePatch,
      sampledCoordinates,
      source: "exact",
      missingCoordinates: [],
      duplicateCoordinates,
      clampedToKeyRange
    };
  }

  if (lowerX === upperX) {
    return interpolateLine({
      lower: { x: lowerX, y: lowerY },
      upper: { x: lowerX, y: upperY },
      t: interpolationRatio(sampledY, lowerY, upperY),
      sampledCoordinates,
      duplicateCoordinates,
      clampedToKeyRange,
      keysByCoordinate
    });
  }

  if (lowerY === upperY) {
    return interpolateLine({
      lower: { x: lowerX, y: lowerY },
      upper: { x: upperX, y: lowerY },
      t: interpolationRatio(sampledX, lowerX, upperX),
      sampledCoordinates,
      duplicateCoordinates,
      clampedToKeyRange,
      keysByCoordinate
    });
  }

  const lowerLeft = keysByCoordinate.get(coordinateKey({ x: lowerX, y: lowerY }));
  const lowerRight = keysByCoordinate.get(coordinateKey({ x: upperX, y: lowerY }));
  const upperLeft = keysByCoordinate.get(coordinateKey({ x: lowerX, y: upperY }));
  const upperRight = keysByCoordinate.get(coordinateKey({ x: upperX, y: upperY }));
  const missingCoordinates = [
    ...(lowerLeft === undefined ? [{ x: lowerX, y: lowerY }] : []),
    ...(lowerRight === undefined ? [{ x: upperX, y: lowerY }] : []),
    ...(upperLeft === undefined ? [{ x: lowerX, y: upperY }] : []),
    ...(upperRight === undefined ? [{ x: upperX, y: upperY }] : [])
  ];

  if (
    lowerLeft === undefined ||
    lowerRight === undefined ||
    upperLeft === undefined ||
    upperRight === undefined ||
    missingCoordinates.length > 0
  ) {
    return createMissingKeyProblem({
      sampledCoordinates,
      missingCoordinates,
      duplicateCoordinates,
      clampedToKeyRange
    });
  }

  const tx = interpolationRatio(sampledX, lowerX, upperX);
  const ty = interpolationRatio(sampledY, lowerY, upperY);
  const lowerBlend = interpolateStatePatches(lowerLeft.statePatch, lowerRight.statePatch, tx);
  if (!lowerBlend.ok) {
    return createProblem({
      code: lowerBlend.code,
      sampledCoordinates,
      duplicateCoordinates,
      clampedToKeyRange
    });
  }

  const upperBlend = interpolateStatePatches(upperLeft.statePatch, upperRight.statePatch, tx);
  if (!upperBlend.ok) {
    return createProblem({
      code: upperBlend.code,
      sampledCoordinates,
      duplicateCoordinates,
      clampedToKeyRange
    });
  }

  const bilinearBlend = interpolateStatePatches(lowerBlend.statePatch, upperBlend.statePatch, ty);
  if (!bilinearBlend.ok) {
    return createProblem({
      code: bilinearBlend.code,
      sampledCoordinates,
      duplicateCoordinates,
      clampedToKeyRange
    });
  }

  return {
    ok: true,
    statePatch: bilinearBlend.statePatch,
    sampledCoordinates,
    source: clampedToKeyRange ? "clamped-key-range" : "interpolated",
    missingCoordinates: [],
    duplicateCoordinates,
    clampedToKeyRange
  };
};

const interpolateLine = (input: {
  readonly lower: Grid2dCoordinate;
  readonly upper: Grid2dCoordinate;
  readonly t: number;
  readonly sampledCoordinates: Grid2dCoordinate;
  readonly duplicateCoordinates: readonly Grid2dCoordinate[];
  readonly clampedToKeyRange: boolean;
  readonly keysByCoordinate: ReadonlyMap<string, Grid2dKey>;
}): Grid2dInterpolationResult => {
  const lowerKey = input.keysByCoordinate.get(coordinateKey(input.lower));
  const upperKey = input.keysByCoordinate.get(coordinateKey(input.upper));
  const missingCoordinates = [
    ...(lowerKey === undefined ? [input.lower] : []),
    ...(upperKey === undefined ? [input.upper] : [])
  ];

  if (lowerKey === undefined || upperKey === undefined || missingCoordinates.length > 0) {
    return createMissingKeyProblem({
      sampledCoordinates: input.sampledCoordinates,
      missingCoordinates,
      duplicateCoordinates: input.duplicateCoordinates,
      clampedToKeyRange: input.clampedToKeyRange
    });
  }

  const interpolated = interpolateStatePatches(lowerKey.statePatch, upperKey.statePatch, input.t);
  if (!interpolated.ok) {
    return createProblem({
      code: interpolated.code,
      sampledCoordinates: input.sampledCoordinates,
      duplicateCoordinates: input.duplicateCoordinates,
      clampedToKeyRange: input.clampedToKeyRange
    });
  }

  return {
    ok: true,
    statePatch: interpolated.statePatch,
    sampledCoordinates: input.sampledCoordinates,
    source: input.clampedToKeyRange ? "clamped-key-range" : "interpolated",
    missingCoordinates: [],
    duplicateCoordinates: input.duplicateCoordinates,
    clampedToKeyRange: input.clampedToKeyRange
  };
};

const createProblem = (input: {
  readonly code: Grid2dInterpolationProblemCode;
  readonly sampledCoordinates?: Grid2dCoordinate;
  readonly missingCoordinates?: readonly Grid2dCoordinate[];
  readonly duplicateCoordinates: readonly Grid2dCoordinate[];
  readonly clampedToKeyRange: boolean;
}): Grid2dInterpolationProblem => ({
  ok: false,
  code: input.code,
  ...(input.sampledCoordinates === undefined ? {} : { sampledCoordinates: input.sampledCoordinates }),
  missingCoordinates: input.missingCoordinates ?? [],
  duplicateCoordinates: input.duplicateCoordinates,
  clampedToKeyRange: input.clampedToKeyRange
});

const createMissingKeyProblem = (input: {
  readonly sampledCoordinates: Grid2dCoordinate;
  readonly missingCoordinates: readonly Grid2dCoordinate[];
  readonly duplicateCoordinates: readonly Grid2dCoordinate[];
  readonly clampedToKeyRange: boolean;
}): Grid2dInterpolationProblem =>
  createProblem({
    code: "keyform.grid2dMissingKey",
    sampledCoordinates: input.sampledCoordinates,
    missingCoordinates: input.missingCoordinates,
    duplicateCoordinates: input.duplicateCoordinates,
    clampedToKeyRange: input.clampedToKeyRange
  });

const uniqueFirstKeysByCoordinate = (keys: readonly Grid2dKey[]): readonly Grid2dKey[] => {
  const uniqueKeys: Grid2dKey[] = [];
  const seen = new Set<string>();

  for (const key of keys) {
    const currentKey = coordinateKey(key);
    if (seen.has(currentKey)) {
      continue;
    }

    seen.add(currentKey);
    uniqueKeys.push(key);
  }

  return uniqueKeys;
};

const findDuplicateCoordinates = (keys: readonly Grid2dKey[]): readonly Grid2dCoordinate[] => {
  const seen = new Set<string>();
  const duplicates = new Map<string, Grid2dCoordinate>();

  for (const key of keys) {
    const currentKey = coordinateKey(key);
    if (seen.has(currentKey)) {
      duplicates.set(currentKey, { x: key.x, y: key.y });
      continue;
    }

    seen.add(currentKey);
  }

  return [...duplicates.values()].sort((left, right) => left.x - right.x || left.y - right.y);
};

const coordinateKey = (coordinate: Grid2dCoordinate): string => `${coordinate.x}\u0000${coordinate.y}`;

const uniqueSortedNumbers = (values: readonly number[]): readonly number[] =>
  [...new Set(values)].sort((left, right) => left - right);

const createRange = (values: readonly number[]): { readonly min: number; readonly max: number } | undefined => {
  const min = values[0];
  const max = values[values.length - 1];

  return min === undefined || max === undefined ? undefined : { min, max };
};

const findBracket = (
  sortedValues: readonly number[],
  value: number
): { readonly lower: number; readonly upper: number } | undefined => {
  for (const candidate of sortedValues) {
    if (candidate === value) {
      return { lower: candidate, upper: candidate };
    }
  }

  for (let index = 0; index < sortedValues.length - 1; index += 1) {
    const lower = sortedValues[index];
    const upper = sortedValues[index + 1];
    if (lower === undefined || upper === undefined) {
      continue;
    }

    if (value > lower && value < upper) {
      return { lower, upper };
    }
  }

  const first = sortedValues[0];
  const last = sortedValues[sortedValues.length - 1];
  if (first === undefined || last === undefined) {
    return undefined;
  }

  if (value <= first) {
    return { lower: first, upper: first };
  }

  return { lower: last, upper: last };
};

const interpolationRatio = (value: number, lower: number, upper: number): number =>
  lower === upper ? 0 : (value - lower) / (upper - lower);

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
