import type {
  ParameterProjectionInput,
  ParameterValueSource
} from "./parameter-list-state.js";

export interface ViewerParameterValueState {
  readonly parameterId: string;
  readonly displayName: string;
  readonly valueSource: ParameterValueSource;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly currentValue: number;
  readonly recommendedUiStep: number;
}

export interface ViewerRuntimeState {
  readonly surface: "closed" | "open";
  readonly parameters: readonly ViewerParameterValueState[];
}

export interface ViewerParameterSetResult {
  readonly status: "updated" | "not_found" | "disabled" | "invalid_value";
  readonly parameterId: string;
  readonly requestedValue: number;
  readonly currentValue?: number;
}

export interface ViewerParameterSetProjection {
  readonly viewerRuntime: ViewerRuntimeState;
  readonly result: ViewerParameterSetResult;
}

export const createEmptyViewerRuntimeState = (): ViewerRuntimeState => ({
  surface: "closed",
  parameters: []
});

export const projectViewerRuntimeState = (
  parameters: readonly ParameterProjectionInput[],
  input: {
    readonly surface?: ViewerRuntimeState["surface"];
  } = {}
): ViewerRuntimeState => ({
  surface: input.surface ?? "closed",
  parameters: projectViewerParameterValues(parameters)
});

export const projectViewerParameterValues = (
  parameters: readonly ParameterProjectionInput[]
): readonly ViewerParameterValueState[] =>
  parameters.map((parameter) => ({
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    valueSource: toViewerParameterValueSource(parameter.valueSource),
    min: parameter.min,
    max: parameter.max,
    defaultValue: parameter.default,
    currentValue: clampViewerValue(parameter.default, parameter.min, parameter.max),
    recommendedUiStep: parameter.recommendedUiStep
  }));

export const openViewerRuntimeSurface = (
  viewerRuntime: ViewerRuntimeState
): ViewerRuntimeState => ({
  ...viewerRuntime,
  surface: "open"
});

export const closeViewerRuntimeSurface = (
  viewerRuntime: ViewerRuntimeState
): ViewerRuntimeState => ({
  ...viewerRuntime,
  surface: "closed"
});

export const applyViewerParameterValue = (
  viewerRuntime: ViewerRuntimeState,
  input: {
    readonly parameterId: string;
    readonly value: number;
  }
): ViewerParameterSetProjection => {
  if (!Number.isFinite(input.value)) {
    return {
      viewerRuntime,
      result: {
        status: "invalid_value",
        parameterId: input.parameterId,
        requestedValue: input.value
      }
    };
  }

  const target = viewerRuntime.parameters.find(
    (parameter) => parameter.parameterId === input.parameterId
  );

  if (target === undefined) {
    return {
      viewerRuntime,
      result: {
        status: "not_found",
        parameterId: input.parameterId,
        requestedValue: input.value
      }
    };
  }

  if (isViewerParameterDisabled(target)) {
    return {
      viewerRuntime,
      result: {
        status: "disabled",
        parameterId: input.parameterId,
        requestedValue: input.value,
        currentValue: target.currentValue
      }
    };
  }

  const currentValue = clampViewerValue(input.value, target.min, target.max);

  return {
    viewerRuntime: {
      ...viewerRuntime,
      parameters: viewerRuntime.parameters.map((parameter) =>
        parameter.parameterId === input.parameterId
          ? {
              ...parameter,
              currentValue
            }
          : parameter
      )
    },
    result: {
      status: "updated",
      parameterId: input.parameterId,
      requestedValue: input.value,
      currentValue
    }
  };
};

export const resetViewerParameterValues = (
  viewerRuntime: ViewerRuntimeState
): ViewerRuntimeState => ({
  ...viewerRuntime,
  parameters: viewerRuntime.parameters.map((parameter) => ({
    ...parameter,
    currentValue: clampViewerValue(parameter.defaultValue, parameter.min, parameter.max)
  }))
});

export const projectViewerParameterOverrides = (
  parameters: readonly ViewerParameterValueState[]
): Readonly<Record<string, number>> =>
  Object.fromEntries(
    parameters
      .filter((parameter) => !isViewerParameterDisabled(parameter))
      .filter((parameter) => parameter.currentValue !== parameter.defaultValue)
      .map((parameter) => [parameter.parameterId, parameter.currentValue])
  );

export const isViewerParameterDisabled = (
  parameter: ViewerParameterValueState
): boolean => parameter.valueSource !== "authoredInput";

const clampViewerValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const toViewerParameterValueSource = (
  valueSource: string | undefined
): ParameterValueSource => {
  if (
    valueSource === "authoredInput" ||
    valueSource === "computedDynamics" ||
    valueSource === "debugOverride"
  ) {
    return valueSource;
  }

  return "authoredInput";
};
