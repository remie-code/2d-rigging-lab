import type { Vec2Dto } from "@private-2d-rigging-lab/contracts";

import type { OneAxisKey } from "./normalized-runtime-graph.js";

export type SampledStatePatch = number | Vec2Dto | readonly Vec2Dto[];

export type StatePatchInterpolationProblemCode =
  | "keyform.unsupportedPatchShape"
  | "keyform.incompatiblePatchShape";

export interface StatePatchInterpolationProblem {
  readonly ok: false;
  readonly code: StatePatchInterpolationProblemCode;
}

export interface StatePatchInterpolationSuccess {
  readonly ok: true;
  readonly statePatch: SampledStatePatch;
}

export type StatePatchInterpolationResult = StatePatchInterpolationSuccess | StatePatchInterpolationProblem;

export type Linear1dInterpolationProblemCode =
  | "keyform.linear1dNoKeys"
  | "keyform.nonFiniteParameterValue"
  | StatePatchInterpolationProblemCode;

export interface Linear1dInterpolationProblem {
  readonly ok: false;
  readonly code: Linear1dInterpolationProblemCode;
  readonly duplicateKeyValues: readonly number[];
}

export interface Linear1dInterpolationSuccess {
  readonly ok: true;
  readonly statePatch: SampledStatePatch;
  readonly sampledValue: number;
  readonly source: "exact" | "clamped-min" | "clamped-max" | "interpolated";
  readonly duplicateKeyValues: readonly number[];
}

export type Linear1dInterpolationResult = Linear1dInterpolationSuccess | Linear1dInterpolationProblem;

export const interpolateLinear1dKeyform = (input: {
  readonly keys: readonly OneAxisKey[];
  readonly parameterValue: number;
}): Linear1dInterpolationResult => {
  const sortedKeys = [...input.keys].sort((left, right) => left.value - right.value);
  const duplicateKeyValues = findDuplicateKeyValues(sortedKeys);
  const uniqueKeys = uniqueFirstKeysByValue(sortedKeys);

  if (uniqueKeys.length === 0) {
    return {
      ok: false,
      code: "keyform.linear1dNoKeys",
      duplicateKeyValues
    };
  }

  if (!Number.isFinite(input.parameterValue)) {
    return {
      ok: false,
      code: "keyform.nonFiniteParameterValue",
      duplicateKeyValues
    };
  }

  const exactKey = uniqueKeys.find((key) => key.value === input.parameterValue);
  if (exactKey !== undefined) {
    return cloneLinearStatePatch(exactKey.statePatch, {
      sampledValue: exactKey.value,
      source: "exact",
      duplicateKeyValues
    });
  }

  const firstKey = uniqueKeys[0];
  const lastKey = uniqueKeys[uniqueKeys.length - 1];
  if (firstKey === undefined || lastKey === undefined) {
    return {
      ok: false,
      code: "keyform.linear1dNoKeys",
      duplicateKeyValues
    };
  }

  if (input.parameterValue <= firstKey.value) {
    return cloneLinearStatePatch(firstKey.statePatch, {
      sampledValue: firstKey.value,
      source: "clamped-min",
      duplicateKeyValues
    });
  }

  if (input.parameterValue >= lastKey.value) {
    return cloneLinearStatePatch(lastKey.statePatch, {
      sampledValue: lastKey.value,
      source: "clamped-max",
      duplicateKeyValues
    });
  }

  for (let index = 0; index < uniqueKeys.length - 1; index += 1) {
    const lowerKey = uniqueKeys[index];
    const upperKey = uniqueKeys[index + 1];
    if (lowerKey === undefined || upperKey === undefined) {
      continue;
    }

    if (input.parameterValue > lowerKey.value && input.parameterValue < upperKey.value) {
      const t = (input.parameterValue - lowerKey.value) / (upperKey.value - lowerKey.value);
      const interpolated = interpolateStatePatches(lowerKey.statePatch, upperKey.statePatch, t);
      if (!interpolated.ok) {
        return {
          ok: false,
          code: interpolated.code,
          duplicateKeyValues
        };
      }

      return {
        ok: true,
        statePatch: interpolated.statePatch,
        sampledValue: input.parameterValue,
        source: "interpolated",
        duplicateKeyValues
      };
    }
  }

  return {
    ok: false,
    code: "keyform.linear1dNoKeys",
    duplicateKeyValues
  };
};

export const cloneSampledStatePatch = (statePatch: unknown): StatePatchInterpolationResult => {
  if (typeof statePatch === "number" && Number.isFinite(statePatch)) {
    return {
      ok: true,
      statePatch
    };
  }

  if (isVec2(statePatch)) {
    return {
      ok: true,
      statePatch: cloneVec2(statePatch)
    };
  }

  if (isVec2Array(statePatch)) {
    return {
      ok: true,
      statePatch: statePatch.map(cloneVec2)
    };
  }

  return {
    ok: false,
    code: "keyform.unsupportedPatchShape"
  };
};

export const interpolateStatePatches = (
  left: unknown,
  right: unknown,
  t: number
): StatePatchInterpolationResult => {
  if (!Number.isFinite(t)) {
    return {
      ok: false,
      code: "keyform.incompatiblePatchShape"
    };
  }

  if (typeof left === "number" && Number.isFinite(left) && typeof right === "number" && Number.isFinite(right)) {
    return {
      ok: true,
      statePatch: interpolateNumber(left, right, t)
    };
  }

  if (isVec2(left) && isVec2(right)) {
    return {
      ok: true,
      statePatch: interpolateVec2(left, right, t)
    };
  }

  if (isVec2Array(left) && isVec2Array(right)) {
    if (left.length !== right.length) {
      return {
        ok: false,
        code: "keyform.incompatiblePatchShape"
      };
    }

    return {
      ok: true,
      statePatch: left.map((leftValue, index) => {
        const rightValue = right[index];
        return rightValue === undefined ? cloneVec2(leftValue) : interpolateVec2(leftValue, rightValue, t);
      })
    };
  }

  if (isSupportedStatePatch(left) && isSupportedStatePatch(right)) {
    return {
      ok: false,
      code: "keyform.incompatiblePatchShape"
    };
  }

  return {
    ok: false,
    code: "keyform.unsupportedPatchShape"
  };
};

const cloneLinearStatePatch = (
  statePatch: unknown,
  resultContext: Omit<Linear1dInterpolationSuccess, "ok" | "statePatch">
): Linear1dInterpolationResult => {
  const cloned = cloneSampledStatePatch(statePatch);
  if (!cloned.ok) {
    return {
      ok: false,
      code: cloned.code,
      duplicateKeyValues: resultContext.duplicateKeyValues
    };
  }

  return {
    ok: true,
    statePatch: cloned.statePatch,
    ...resultContext
  };
};

const isSupportedStatePatch = (statePatch: unknown): statePatch is SampledStatePatch =>
  (typeof statePatch === "number" && Number.isFinite(statePatch)) || isVec2(statePatch) || isVec2Array(statePatch);

const isVec2 = (value: unknown): value is Vec2Dto =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  "x" in value &&
  "y" in value &&
  typeof value.x === "number" &&
  Number.isFinite(value.x) &&
  typeof value.y === "number" &&
  Number.isFinite(value.y);

const isVec2Array = (value: unknown): value is readonly Vec2Dto[] => Array.isArray(value) && value.every(isVec2);

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: value.x,
  y: value.y
});

const interpolateNumber = (left: number, right: number, t: number): number => left + (right - left) * t;

const interpolateVec2 = (left: Vec2Dto, right: Vec2Dto, t: number): Vec2Dto => ({
  x: interpolateNumber(left.x, right.x, t),
  y: interpolateNumber(left.y, right.y, t)
});

const uniqueFirstKeysByValue = (keys: readonly OneAxisKey[]): readonly OneAxisKey[] => {
  const uniqueKeys: OneAxisKey[] = [];
  const seen = new Set<number>();

  for (const key of keys) {
    if (seen.has(key.value)) {
      continue;
    }

    seen.add(key.value);
    uniqueKeys.push(key);
  }

  return uniqueKeys;
};

const findDuplicateKeyValues = (keys: readonly OneAxisKey[]): readonly number[] => {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const key of keys) {
    if (seen.has(key.value)) {
      duplicates.add(key.value);
      continue;
    }

    seen.add(key.value);
  }

  return [...duplicates].sort((left, right) => left - right);
};
