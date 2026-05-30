import type {
  ParameterProjectionInput,
  ParameterValueSource
} from "./parameter-list-state.js";

export interface PreviewParameterValueState {
  readonly parameterId: string;
  readonly displayName: string;
  readonly valueSource: ParameterValueSource;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly currentValue: number;
  readonly recommendedUiStep: number;
}

export interface PreviewParameterSetResult {
  readonly status: "updated" | "not_found" | "disabled" | "invalid_value";
  readonly parameterId: string;
  readonly requestedValue: number;
  readonly currentValue?: number;
}

export interface PreviewParameterSetProjection {
  readonly parameters: readonly PreviewParameterValueState[];
  readonly result: PreviewParameterSetResult;
}

export const projectPreviewParameterValues = (
  parameters: readonly ParameterProjectionInput[]
): readonly PreviewParameterValueState[] =>
  parameters.map((parameter) => ({
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    valueSource: toPreviewParameterValueSource(parameter.valueSource),
    min: parameter.min,
    max: parameter.max,
    defaultValue: parameter.default,
    currentValue: clampPreviewValue(parameter.default, parameter.min, parameter.max),
    recommendedUiStep: parameter.recommendedUiStep
  }));

export const applyPreviewParameterValue = (
  parameters: readonly PreviewParameterValueState[],
  input: {
    readonly parameterId: string;
    readonly value: number;
  }
): PreviewParameterSetProjection => {
  if (!Number.isFinite(input.value)) {
    return {
      parameters,
      result: {
        status: "invalid_value",
        parameterId: input.parameterId,
        requestedValue: input.value
      }
    };
  }

  const target = parameters.find((parameter) => parameter.parameterId === input.parameterId);

  if (target === undefined) {
    return {
      parameters,
      result: {
        status: "not_found",
        parameterId: input.parameterId,
        requestedValue: input.value
      }
    };
  }

  if (isPreviewParameterDisabled(target)) {
    return {
      parameters,
      result: {
        status: "disabled",
        parameterId: input.parameterId,
        requestedValue: input.value,
        currentValue: target.currentValue
      }
    };
  }

  const currentValue = clampPreviewValue(input.value, target.min, target.max);

  return {
    parameters: parameters.map((parameter) =>
      parameter.parameterId === input.parameterId
        ? {
            ...parameter,
            currentValue
          }
        : parameter
    ),
    result: {
      status: "updated",
      parameterId: input.parameterId,
      requestedValue: input.value,
      currentValue
    }
  };
};

export const resetPreviewParameterValues = (
  parameters: readonly PreviewParameterValueState[]
): readonly PreviewParameterValueState[] =>
  parameters.map((parameter) => ({
    ...parameter,
    currentValue: clampPreviewValue(parameter.defaultValue, parameter.min, parameter.max)
  }));

export const projectPreviewAuthoredParameterValues = (
  parameters: readonly PreviewParameterValueState[]
): Readonly<Record<string, number>> =>
  Object.fromEntries(
    parameters
      .filter((parameter) => !isPreviewParameterDisabled(parameter))
      .map((parameter) => [parameter.parameterId, parameter.currentValue])
  );

export const isPreviewParameterDisabled = (
  parameter: PreviewParameterValueState
): boolean => parameter.valueSource !== "authoredInput";

const clampPreviewValue = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const toPreviewParameterValueSource = (
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
