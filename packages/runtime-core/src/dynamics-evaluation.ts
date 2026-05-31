import type {
  DynamicsGroupId,
  ParameterId,
  RuntimeDynamicsGroupState
} from "@private-2d-rigging-lab/contracts";

import type { NormalizedDynamicsGroup, NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";

const nominalFrameStepMs = 16.6666667;

export interface DynamicsTargetSample {
  readonly driverValues: Readonly<Record<ParameterId, number>>;
  readonly rawTarget: number;
  readonly clampedTarget: number;
  readonly outputClamped: boolean;
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
  readonly target: DynamicsTargetSample;
}

interface ScalarDampedFollowStepState {
  readonly position: number;
  readonly velocity: number;
}

export const computeDynamicsTargetSample = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): DynamicsTargetSample => {
  const driverValues = createDynamicsDriverValues(graph, group, authoredParameterValues);
  const targetInput = group.drivers.reduce((sum, driver) => {
    const authoredValue = driverValues[driver.sourceParameterId] ?? 0;
    const signedValue = driver.invert ? -authoredValue : authoredValue;
    return sum + signedValue * driver.inputScale + driver.inputOffset;
  }, 0);
  const rawTarget = targetInput * group.output.outputScale + group.output.outputOffset;
  const amplitudeLimitedTarget = applyAmplitudeLimit(group, rawTarget);
  const clampedTarget = clamp(amplitudeLimitedTarget, group.output.min, group.output.max);

  return {
    driverValues,
    rawTarget,
    clampedTarget,
    outputClamped: clampedTarget !== rawTarget
  };
};

export const computeDynamicsTarget = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): number => computeDynamicsTargetSample(graph, group, authoredParameterValues).clampedTarget;

export const advanceDynamicsGroupState = (
  input: AdvanceDynamicsGroupStateInput
): AdvancedDynamicsGroupState => {
  const target = computeDynamicsTargetSample(input.graph, input.group, input.authoredParameterValues);
  const resetCounter = (input.previousState?.resetCounter ?? 0) + (input.resetApplied ? 1 : 0);
  const initialState: RuntimeDynamicsGroupState = input.resetApplied
    ? {
        position: target.clampedTarget,
        velocity: 0,
        tick: 0,
        resetCounter
      }
    : {
        position: input.previousState?.position ?? target.clampedTarget,
        velocity: input.previousState?.velocity ?? 0,
        tick: input.previousState?.tick ?? 0,
        resetCounter
      };

  if (input.resetApplied || input.subSteps <= 0) {
    return {
      dynamicsGroupId: input.group.dynamicsGroupId,
      state: initialState,
      target
    };
  }

  let position = initialState.position;
  let velocity = initialState.velocity;
  for (let stepIndex = 0; stepIndex < input.subSteps; stepIndex += 1) {
    const advanced = advanceScalarDampedFollowStep(input.group, position, velocity, target.clampedTarget, input.fixedStepMs);
    position = advanced.position;
    velocity = advanced.velocity;
  }

  return {
    dynamicsGroupId: input.group.dynamicsGroupId,
    state: {
      position,
      velocity,
      tick: initialState.tick + input.subSteps,
      resetCounter: initialState.resetCounter
    },
    target
  };
};

const createDynamicsDriverValues = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  authoredParameterValues: Readonly<Record<string, number>>
): Readonly<Record<ParameterId, number>> =>
  Object.fromEntries(
    group.drivers.map((driver) => {
      const parameterDefault = graph.parameters.get(driver.sourceParameterId)?.default ?? 0;
      return [driver.sourceParameterId, authoredParameterValues[driver.sourceParameterId] ?? parameterDefault];
    })
  ) as Readonly<Record<ParameterId, number>>;

const advanceScalarDampedFollowStep = (
  group: NormalizedDynamicsGroup,
  position: number,
  velocity: number,
  target: number,
  fixedStepMs: number
): ScalarDampedFollowStepState => {
  const stepScale = fixedStepMs / nominalFrameStepMs;
  const dampingFactor = 1 / (1 + group.settings.damping * stepScale);
  const unclampedVelocity = (velocity + (target - position) * group.settings.stiffness * stepScale) * dampingFactor;
  const nextVelocity = clampVelocity(group, unclampedVelocity);
  const unclampedPosition = position + nextVelocity * stepScale;
  const nextPosition = clampDynamicsOutputValue(group, unclampedPosition);

  return {
    position: nextPosition,
    velocity: nextPosition === unclampedPosition ? nextVelocity : 0
  };
};

const clampVelocity = (
  group: NormalizedDynamicsGroup,
  velocity: number
): number => {
  if (group.settings.maxVelocity === undefined) {
    return velocity;
  }

  return clamp(velocity, -group.settings.maxVelocity, group.settings.maxVelocity);
};

const clampDynamicsOutputValue = (
  group: NormalizedDynamicsGroup,
  value: number
): number => clamp(applyAmplitudeLimit(group, value), group.output.min, group.output.max);

const applyAmplitudeLimit = (
  group: NormalizedDynamicsGroup,
  value: number
): number => {
  if (group.settings.maxAmplitude === undefined) {
    return value;
  }

  const restOutput = group.output.outputOffset;
  return clamp(value, restOutput - group.settings.maxAmplitude, restOutput + group.settings.maxAmplitude);
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
