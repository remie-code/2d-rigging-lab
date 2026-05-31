import type {
  RuntimeEvaluationContextDto,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import {
  RuntimeEvaluationContextSchema,
  RuntimeSequenceFrameSchema,
  RuntimeStateDtoSchema
} from "@private-2d-rigging-lab/contracts";
import type { z } from "zod";

import { advanceDynamicsGroupState } from "./dynamics-evaluation.js";
import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import type { RuntimeComparisonResult, SnapshotComparisonPolicyInput } from "./snapshot-comparison.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";
import { createRuntimeSnapshot } from "./snapshot.js";
import { createCompatibleRuntimeState } from "./state-compatibility.js";
import type { RuntimeEvaluationInputInput } from "./runtime-input.js";
import { RuntimeEvaluationInputSchema } from "./runtime-input.js";
import type { RuntimeEvaluationOptionsInput } from "./runtime-options.js";
import { RuntimeEvaluationOptionsSchema } from "./runtime-options.js";

export type RuntimeEvaluationContextInput = z.input<typeof RuntimeEvaluationContextSchema>;
export type RuntimeSequenceFrameInput = z.input<typeof RuntimeSequenceFrameSchema>;

export interface RuntimeFrameEvaluationResult {
  readonly snapshot: RuntimeSnapshotDto;
  readonly nextState: RuntimeStateDto;
}

export interface RuntimeSequenceEvaluationResult {
  readonly snapshots: readonly RuntimeSnapshotDto[];
  readonly finalState: RuntimeStateDto;
}

export interface RuntimeCore {
  readonly createInitialRuntimeState: typeof createInitialRuntimeState;
  readonly evaluateRuntimeFrame: typeof evaluateRuntimeFrame;
  readonly evaluateRuntimeSequence: typeof evaluateRuntimeSequence;
  readonly compareRuntimeSnapshots: (
    before: RuntimeSnapshotDto,
    after: RuntimeSnapshotDto,
    policy?: SnapshotComparisonPolicyInput
  ) => RuntimeComparisonResult;
}

export const evaluateRuntimeFrame = (
  graph: NormalizedRuntimeGraph,
  inputValue: RuntimeEvaluationInputInput,
  previousStateValue: RuntimeStateDto,
  optionsValue: RuntimeEvaluationOptionsInput,
  contextValue: RuntimeEvaluationContextInput
): RuntimeFrameEvaluationResult => {
  const input = RuntimeEvaluationInputSchema.parse(inputValue);
  const previousState = RuntimeStateDtoSchema.parse(previousStateValue);
  const options = RuntimeEvaluationOptionsSchema.parse(optionsValue);
  const context = RuntimeEvaluationContextSchema.parse(contextValue);
  const compatibility = createCompatibleRuntimeState(graph, previousState, input);
  const nextState = advanceRuntimeState(graph, compatibility.state, input, options.maxSubSteps);
  const snapshot = createRuntimeSnapshot({
    graph,
    evaluationInput: input,
    state: nextState,
    options,
    context,
    diagnostics: compatibility.diagnostics
  });

  return {
    snapshot,
    nextState
  };
};

export const evaluateRuntimeSequence = (
  graph: NormalizedRuntimeGraph,
  frames: readonly RuntimeSequenceFrameInput[],
  initialStateValue: RuntimeStateDto,
  optionsValue: RuntimeEvaluationOptionsInput,
  contextValue: RuntimeEvaluationContextInput
): RuntimeSequenceEvaluationResult => {
  let currentState = RuntimeStateDtoSchema.parse(initialStateValue);
  const snapshots: RuntimeSnapshotDto[] = [];

  for (const frame of frames) {
    const sequenceFrame = RuntimeSequenceFrameSchema.parse(frame);
    const result = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: sequenceFrame.frameIndex,
        deltaTimeMs: sequenceFrame.deltaTimeMs,
        resetReasons: sequenceFrame.resetReasons,
        authoredParameterValues: sequenceFrame.authoredParameterValues,
        targetIds: sequenceFrame.targetIds
      },
      currentState,
      optionsValue,
      contextValue
    );
    snapshots.push(result.snapshot);
    currentState = result.nextState;
  }

  return {
    snapshots,
    finalState: currentState
  };
};

export const runtimeCore: RuntimeCore = {
  createInitialRuntimeState,
  evaluateRuntimeFrame,
  evaluateRuntimeSequence,
  compareRuntimeSnapshots
};

const advanceRuntimeState = (
  graph: NormalizedRuntimeGraph,
  previousState: RuntimeStateDto,
  input: ReturnType<typeof RuntimeEvaluationInputSchema.parse>,
  maxSubSteps: number
): RuntimeStateDto => {
  const accumulator = previousState.accumulatorMs + input.deltaTimeMs;
  const requestedSubSteps = Math.floor(accumulator / previousState.fixedStepMs);
  const actualSubSteps = Math.min(requestedSubSteps, maxSubSteps);
  const nextDynamicsGroups: RuntimeStateDto["dynamicsGroups"] = {};

  for (const group of graph.dynamicsGroups.values()) {
    if (!group.enabled) {
      continue;
    }

    const resetApplied = input.resetReasons.length > 0;
    const advanced = advanceDynamicsGroupState({
      graph,
      group,
      previousState: previousState.dynamicsGroups[group.dynamicsGroupId],
      authoredParameterValues: input.authoredParameterValues,
      fixedStepMs: previousState.fixedStepMs,
      subSteps: actualSubSteps,
      resetApplied
    });
    nextDynamicsGroups[group.dynamicsGroupId] = advanced.state;
  }

  return RuntimeStateDtoSchema.parse({
    ...previousState,
    frameIndex: input.frameIndex,
    accumulatorMs: accumulator - actualSubSteps * previousState.fixedStepMs,
    dynamicsGroups: nextDynamicsGroups
  });
};
