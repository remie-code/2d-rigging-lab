import type { ParameterId } from "@private-2d-rigging-lab/contracts";
import { recordLive2dPerformanceCounter } from "@private-2d-rigging-lab/render-core";

import {
  clampParameterValue,
  formatParameterValue,
  type EditorParameter,
  type ParameterValueMap
} from "../../features/editor-session/model/parameter-keyform-state";

const PARAMETER_VALUE_EPSILON = 0.000001;

export type RuntimeParameterOverrides = Readonly<Partial<Record<ParameterId, number>>>;

export interface ViewerRuntimeControlsState {
  readonly parameterOverrides: RuntimeParameterOverrides;
  readonly search: string;
}

export interface RuntimeControlParameterRow {
  readonly parameter: EditorParameter;
  readonly parameterId: ParameterId;
  readonly displayName: string;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly currentValue: number;
  readonly formattedValue: string;
  readonly step: number;
  readonly changed: boolean;
}

export interface RuntimeControlsProjection {
  readonly search: string;
  readonly parameterOverrides: RuntimeParameterOverrides;
  readonly rows: readonly RuntimeControlParameterRow[];
  readonly editableParameterCount: number;
  readonly visibleParameterCount: number;
  readonly changedParameterCount: number;
  readonly hiddenComputedParameterCount: number;
  readonly hasSearch: boolean;
}

export const createInitialRuntimeControlsState = (): ViewerRuntimeControlsState => ({
  parameterOverrides: {},
  search: ""
});

export const setRuntimeControlsSearch = (
  state: ViewerRuntimeControlsState,
  search: string
): ViewerRuntimeControlsState => ({
  ...state,
  search
});

export const isEditableRuntimeParameter = (parameter: EditorParameter): boolean =>
  parameter.valueSource !== "computedDynamics";

export const normalizeRuntimeControlsState = (
  parameters: readonly EditorParameter[],
  state: ViewerRuntimeControlsState
): ViewerRuntimeControlsState => ({
  parameterOverrides: normalizeRuntimeParameterOverrides(parameters, state.parameterOverrides),
  search: state.search
});

export const normalizeRuntimeParameterOverrides = (
  parameters: readonly EditorParameter[],
  parameterOverrides: RuntimeParameterOverrides
): RuntimeParameterOverrides => {
  const normalized: Partial<Record<ParameterId, number>> = {};

  for (const parameter of parameters) {
    if (!isEditableRuntimeParameter(parameter)) {
      continue;
    }

    const rawValue = parameterOverrides[parameter.parameterId];
    if (rawValue === undefined) {
      continue;
    }

    const value = clampParameterValue(parameter, rawValue);
    if (!sameParameterValue(value, getRuntimeParameterDefaultValue(parameter))) {
      normalized[parameter.parameterId] = value;
    }
  }

  return normalized;
};

export const createRuntimeControlsProjection = (
  parameters: readonly EditorParameter[],
  state: ViewerRuntimeControlsState
): RuntimeControlsProjection => {
  const normalizedState = normalizeRuntimeControlsState(parameters, state);
  const editableParameters = parameters.filter(isEditableRuntimeParameter);
  const query = normalizeSearchQuery(normalizedState.search);
  const allRows = editableParameters.map((parameter) =>
    createRuntimeControlParameterRow(parameter, normalizedState.parameterOverrides)
  );
  const rows =
    query.length === 0
      ? allRows
      : allRows.filter((row) => runtimeParameterMatchesSearch(row.parameter, query));
  const changedParameterCount = allRows.filter((row) => row.changed).length;

  return {
    search: normalizedState.search,
    parameterOverrides: normalizedState.parameterOverrides,
    rows,
    editableParameterCount: editableParameters.length,
    visibleParameterCount: rows.length,
    changedParameterCount,
    hiddenComputedParameterCount: parameters.length - editableParameters.length,
    hasSearch: query.length > 0
  };
};

export const setRuntimeParameterOverride = (
  state: ViewerRuntimeControlsState,
  parameter: EditorParameter,
  value: number
): ViewerRuntimeControlsState => {
  const nextOverrides: Partial<Record<ParameterId, number>> = {
    ...state.parameterOverrides
  };

  if (!isEditableRuntimeParameter(parameter)) {
    if (nextOverrides[parameter.parameterId] === undefined) {
      recordLive2dPerformanceCounter("runtimeControls.skippedNoOpUpdates");
      return state;
    }

    delete nextOverrides[parameter.parameterId];
    recordLive2dPerformanceCounter("runtimeControls.appliedUpdates");
    return {
      ...state,
      parameterOverrides: nextOverrides
    };
  }

  const clampedValue = clampParameterValue(parameter, value);
  if (sameParameterValue(clampedValue, getRuntimeParameterDefaultValue(parameter))) {
    if (nextOverrides[parameter.parameterId] === undefined) {
      recordLive2dPerformanceCounter("runtimeControls.skippedNoOpUpdates");
      return state;
    }

    delete nextOverrides[parameter.parameterId];
    recordLive2dPerformanceCounter("runtimeControls.appliedUpdates");
  } else {
    if (sameParameterValue(nextOverrides[parameter.parameterId] ?? Number.NaN, clampedValue)) {
      recordLive2dPerformanceCounter("runtimeControls.skippedNoOpUpdates");
      return state;
    }

    nextOverrides[parameter.parameterId] = clampedValue;
    recordLive2dPerformanceCounter("runtimeControls.appliedUpdates");
  }

  return {
    ...state,
    parameterOverrides: nextOverrides
  };
};

export const resetRuntimeParameterOverride = (
  state: ViewerRuntimeControlsState,
  parameterId: ParameterId
): ViewerRuntimeControlsState => {
  if (state.parameterOverrides[parameterId] === undefined) {
    return state;
  }

  const nextOverrides: Partial<Record<ParameterId, number>> = {
    ...state.parameterOverrides
  };
  delete nextOverrides[parameterId];

  return {
    ...state,
    parameterOverrides: nextOverrides
  };
};

export const resetAllRuntimeParameterOverrides = (
  state: ViewerRuntimeControlsState
): ViewerRuntimeControlsState =>
  Object.keys(state.parameterOverrides).length === 0
    ? state
    : {
        ...state,
        parameterOverrides: {}
      };

export const createRuntimeParameterValueMap = (
  parameters: readonly EditorParameter[],
  state: ViewerRuntimeControlsState
): ParameterValueMap => {
  const normalizedOverrides = normalizeRuntimeParameterOverrides(
    parameters,
    state.parameterOverrides
  );
  const runtimeValues: Record<string, number> = {};

  for (const [parameterId, value] of Object.entries(normalizedOverrides)) {
    if (value !== undefined) {
      runtimeValues[parameterId] = value;
    }
  }

  return runtimeValues;
};

function createRuntimeControlParameterRow(
  parameter: EditorParameter,
  parameterOverrides: RuntimeParameterOverrides
): RuntimeControlParameterRow {
  const defaultValue = getRuntimeParameterDefaultValue(parameter);
  const rawCurrentValue = parameterOverrides[parameter.parameterId] ?? defaultValue;
  const currentValue = clampParameterValue(parameter, rawCurrentValue);

  return {
    parameter,
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    min: parameter.min,
    max: parameter.max,
    defaultValue,
    currentValue,
    formattedValue: formatParameterValue(currentValue),
    step: parameter.recommendedUiStep,
    changed: !sameParameterValue(currentValue, defaultValue)
  };
}

function getRuntimeParameterDefaultValue(parameter: EditorParameter): number {
  return clampParameterValue(parameter, parameter.default);
}

function runtimeParameterMatchesSearch(
  parameter: EditorParameter,
  normalizedSearch: string
): boolean {
  const haystack = `${parameter.displayName} ${parameter.parameterId}`.toLowerCase();
  return normalizedSearch
    .split(" ")
    .filter((token) => token.length > 0)
    .every((token) => haystack.includes(token));
}

function normalizeSearchQuery(search: string): string {
  return search.trim().toLowerCase().replace(/\s+/g, " ");
}

function sameParameterValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= PARAMETER_VALUE_EPSILON;
}
