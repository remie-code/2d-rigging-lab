import type {
  DynamicsGroupId,
  ParameterId,
  RuntimeDynamicsGroupState
} from "@private-2d-rigging-lab/contracts";

import type {
  NormalizedDynamicsGroup,
  NormalizedDynamicsInput,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";

const nominalFrameStepMs = 16.6666667;
const maxStableStepMs = 100;

export interface DynamicsSourceSample {
  readonly inputValues: Readonly<Record<ParameterId, number>>;
  readonly rawSource: number;
  readonly source: number;
}

export interface DynamicsOutputOffset {
  readonly outputParameterId: ParameterId;
  readonly rawOffset: number;
  readonly offset: number;
  readonly outputClamped: boolean;
}

export interface StepDynamicsInput {
  readonly definition: NormalizedDynamicsGroup;
  readonly previousState: RuntimeDynamicsGroupState | undefined;
  readonly inputValues: Readonly<Record<ParameterId, number>>;
  readonly dtMs: number;
  readonly resetApplied: boolean;
}

export interface StepDynamicsResult {
  readonly state: RuntimeDynamicsGroupState;
  readonly source: DynamicsSourceSample;
  readonly outputOffsets: readonly DynamicsOutputOffset[];
}

export interface AdvanceDynamicsGroupStateInput {
  readonly graph: NormalizedRuntimeGraph;
  readonly group: NormalizedDynamicsGroup;
  readonly previousState: RuntimeDynamicsGroupState | undefined;
  readonly authoredParameterValues: Readonly<Record<string, number>>;
  readonly fixedStepMs: number;
  readonly subSteps: number;
  readonly resetApplied: boolean;
}

export interface AdvancedDynamicsGroupState {
  readonly dynamicsGroupId: DynamicsGroupId;
  readonly state: RuntimeDynamicsGroupState;
  readonly source: DynamicsSourceSample;
  readonly outputOffsets: readonly DynamicsOutputOffset[];
}

export const computeDynamicsSourceSample = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): DynamicsSourceSample => {
  const inputValues = createDynamicsInputValues(graph, group, authoredParameterValues);
  return computeDynamicsSourceFromInputValues(group, inputValues);
};

export const computeDynamicsSource = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): number => computeDynamicsSourceSample(graph, group, authoredParameterValues).source;

export const stepDynamics = (input: StepDynamicsInput): StepDynamicsResult => {
  const source = computeDynamicsSourceFromInputValues(input.definition, input.inputValues);
  const previousState = input.resetApplied || input.previousState === undefined
    ? createResetDynamicsState(source.source, input.previousState?.resetCounter ?? 0, input.resetApplied)
    : input.previousState;
  const dtSeconds = clamp(input.dtMs, 0, maxStableStepMs) / 1000;

  if (dtSeconds === 0 || input.resetApplied) {
    return {
      state: previousState,
      source,
      outputOffsets: computeDynamicsOutputOffsets(input.definition, previousState)
    };
  }

  const pendulum = input.definition.pendulums[0];
  if (pendulum === undefined) {
    return {
      state: previousState,
      source,
      outputOffsets: computeDynamicsOutputOffsets(input.definition, previousState)
    };
  }

  const length = Math.max(pendulum.length, 0.0001);
  const sourceVelocity = (source.source - previousState.previousSource) / dtSeconds;
  const sourceAcceleration = (sourceVelocity - previousState.previousSourceVelocity) / dtSeconds;
  const angularAcceleration =
    ((source.source - previousState.angle) * pendulum.reactionSpeed) / length +
    sourceAcceleration * pendulum.sway -
    previousState.angularVelocity * pendulum.convergenceSpeed;
  const angularVelocity = previousState.angularVelocity + angularAcceleration * dtSeconds;
  const angle = previousState.angle + angularVelocity * dtSeconds;
  const state: RuntimeDynamicsGroupState = {
    angle,
    angularVelocity,
    previousSource: source.source,
    previousSourceVelocity: sourceVelocity,
    tick: previousState.tick + 1,
    resetCounter: previousState.resetCounter
  };

  return {
    state,
    source,
    outputOffsets: computeDynamicsOutputOffsets(input.definition, state)
  };
};

export const advanceDynamicsGroupState = (
  input: AdvanceDynamicsGroupStateInput
): AdvancedDynamicsGroupState => {
  const inputValues = createDynamicsInputValues(input.graph, input.group, input.authoredParameterValues);
  const initialSource = computeDynamicsSourceFromInputValues(input.group, inputValues);
  let state = input.resetApplied || input.previousState === undefined
    ? createResetDynamicsState(initialSource.source, input.previousState?.resetCounter ?? 0, input.resetApplied)
    : input.previousState;
  let source = initialSource;
  let outputOffsets = computeDynamicsOutputOffsets(input.group, state);

  if (!input.resetApplied && input.subSteps > 0) {
    for (let stepIndex = 0; stepIndex < input.subSteps; stepIndex += 1) {
      const stepped = stepDynamics({
        definition: input.group,
        previousState: state,
        inputValues,
        dtMs: input.fixedStepMs,
        resetApplied: false
      });
      state = stepped.state;
      source = stepped.source;
      outputOffsets = stepped.outputOffsets;
    }
  }

  return {
    dynamicsGroupId: input.group.dynamicsGroupId,
    state,
    source,
    outputOffsets
  };
};

export const computeDynamicsOutputOffsets = (
  group: NormalizedDynamicsGroup,
  state: RuntimeDynamicsGroupState
): readonly DynamicsOutputOffset[] =>
  group.outputs.map((output) => {
    const signedStrength = output.invert ? -output.strength : output.strength;
    const rawOffset = state.angle * signedStrength;
    const limit = Math.abs(output.limit);
    const offset = clamp(rawOffset, -limit, limit);

    return {
      outputParameterId: output.parameterId,
      rawOffset,
      offset,
      outputClamped: offset !== rawOffset
    };
  });

export const getDynamicsOutputOffsetForParameter = (
  group: NormalizedDynamicsGroup,
  state: RuntimeDynamicsGroupState | undefined,
  parameterId: ParameterId
): DynamicsOutputOffset | undefined => {
  if (state === undefined) {
    return undefined;
  }

  return computeDynamicsOutputOffsets(group, state).find(
    (offset) => offset.outputParameterId === parameterId
  );
};

const createResetDynamicsState = (
  source: number,
  previousResetCounter: number,
  resetApplied: boolean
): RuntimeDynamicsGroupState => ({
  angle: source,
  angularVelocity: 0,
  previousSource: source,
  previousSourceVelocity: 0,
  tick: 0,
  resetCounter: previousResetCounter + (resetApplied || previousResetCounter === 0 ? 1 : 0)
});

const createDynamicsInputValues = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): Readonly<Record<ParameterId, number>> =>
  Object.fromEntries(
    group.inputs.map((dynamicsInput) => {
      const parameterDefault = graph.parameters.get(dynamicsInput.parameterId)?.default ?? 0;
      return [dynamicsInput.parameterId, authoredParameterValues[dynamicsInput.parameterId] ?? parameterDefault];
    })
  ) as Readonly<Record<ParameterId, number>>;

const computeDynamicsSourceFromInputValues = (
  group: NormalizedDynamicsGroup,
  inputValues: Readonly<Record<ParameterId, number>>
): DynamicsSourceSample => {
  const rawSource = group.inputs.reduce((sum, dynamicsInput) => {
    const value = inputValues[dynamicsInput.parameterId] ?? dynamicsInput.normalization.center;
    const normalized = normalizeDynamicsInput(value, dynamicsInput);
    const signed = dynamicsInput.invert ? -normalized : normalized;
    return sum + signed * (dynamicsInput.influencePercent / 100);
  }, 0);

  return {
    inputValues,
    rawSource,
    source: rawSource
  };
};

const normalizeDynamicsInput = (value: number, dynamicsInput: NormalizedDynamicsInput): number => {
  const { min, center, max } = dynamicsInput.normalization;
  if (value === center) {
    return 0;
  }

  if (value > center) {
    return clamp((value - center) / (max - center), 0, 1);
  }

  return clamp((value - center) / (center - min), -1, 0);
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
