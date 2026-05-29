export type ParameterValueSource = "authoredInput" | "computedDynamics" | "debugOverride";

export interface ParameterListItemState {
  readonly parameterId: string;
  readonly displayName: string;
  readonly valueSource: ParameterValueSource;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly recommendedUiStep: number;
}

export interface ParameterProjectionInput {
  readonly parameterId: string;
  readonly displayName: string;
  readonly valueSource?: string;
  readonly min: number;
  readonly max: number;
  readonly default: number;
  readonly recommendedUiStep: number;
}

export const projectParameterList = (
  parameters: readonly ParameterProjectionInput[]
): readonly ParameterListItemState[] =>
  parameters.map((parameter) => ({
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    valueSource: toParameterValueSource(parameter.valueSource),
    min: parameter.min,
    max: parameter.max,
    defaultValue: parameter.default,
    recommendedUiStep: parameter.recommendedUiStep
  }));

const toParameterValueSource = (valueSource: string | undefined): ParameterValueSource => {
  if (
    valueSource === "authoredInput" ||
    valueSource === "computedDynamics" ||
    valueSource === "debugOverride"
  ) {
    return valueSource;
  }

  return "authoredInput";
};
