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
import type {
  RuntimeRenderDrawableEvaluationDto,
  RuntimeSnapshotDto,
  RuntimeSnapshotValidationMode
} from "./snapshot.js";
import { createRuntimeSnapshot, evaluateRuntimeRenderDrawables } from "./snapshot.js";
import { createCompatibleRuntimeState } from "./state-compatibility.js";
import type { RuntimeEvaluationInputInput } from "./runtime-input.js";
import { RuntimeEvaluationInputSchema } from "./runtime-input.js";
import type { RuntimeEvaluationOptionsInput } from "./runtime-options.js";
import { RuntimeEvaluationOptionsSchema } from "./runtime-options.js";
import {
  createCompiledRuntimeModel,
  type CompiledRuntimeModel,
  type RuntimeFrameEvaluator,
  type RuntimeModelFrameEvaluationOptions,
  type RuntimeModelInitialStateRequestInput,
  type RuntimeModelInstance,
  type RuntimeModelInstanceOptions,
  type RuntimeModelRenderFrameEvaluationOptions,
  type RuntimeRenderFrame,
  type RuntimeRenderFrameEvaluator,
  type RuntimeRenderFrameDrawable,
  type RuntimeRenderFrameEvaluationResult
} from "./runtime-model.js";
import {
  createRuntimeCoreEvaluationProfiler,
  type RuntimeCoreEvaluationProfile,
  type RuntimeCoreEvaluationProfilingOptions
} from "./runtime-profiling.js";
import type { RigControlTopologyEvaluation } from "./rig-control-hierarchy.js";
import type { RuntimeSnapshotStaticTemplates } from "./snapshot-static-templates.js";

export type {
  CompiledRuntimeModel,
  RuntimeModelFrameEvaluationOptions,
  RuntimeModelInitialStateRequestInput,
  RuntimeModelInstance,
  RuntimeModelInstanceOptions,
  RuntimeModelRenderFrameEvaluationOptions,
  RuntimeRenderFrame,
  RuntimeRenderFrameDrawable,
  RuntimeRenderFrameEvaluationResult
} from "./runtime-model.js";

export type RuntimeEvaluationContextInput = z.input<typeof RuntimeEvaluationContextSchema>;
export type RuntimeSequenceFrameInput = z.input<typeof RuntimeSequenceFrameSchema>;

export interface RuntimeFrameEvaluationResult {
  readonly snapshot: RuntimeSnapshotDto;
  readonly nextState: RuntimeStateDto;
  readonly profile?: RuntimeCoreEvaluationProfile;
}

export interface RuntimeFrameEvaluationControlOptions {
  readonly snapshotValidation?: RuntimeSnapshotValidationMode;
}

export interface RuntimeSequenceEvaluationResult {
  readonly snapshots: readonly RuntimeSnapshotDto[];
  readonly finalState: RuntimeStateDto;
}

export interface RuntimeCore {
  readonly createInitialRuntimeState: typeof createInitialRuntimeState;
  readonly compileRuntimeModel: typeof compileRuntimeModel;
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
  contextValue: RuntimeEvaluationContextInput,
  profilingOptions?: RuntimeCoreEvaluationProfilingOptions,
  controlOptions: RuntimeFrameEvaluationControlOptions = {}
): RuntimeFrameEvaluationResult =>
  evaluateRuntimeFrameInternal({
    graph,
    inputValue,
    previousStateValue,
    optionsValue,
    contextValue,
    ...(profilingOptions === undefined ? {} : { profilingOptions }),
    controlOptions
  });

const evaluateCompiledRuntimeFrame: RuntimeFrameEvaluator = (
  graph,
  inputValue,
  previousStateValue,
  optionsValue,
  contextValue,
  profilingOptions,
  controlOptions = {},
  compiledArtifacts
): RuntimeFrameEvaluationResult =>
  evaluateRuntimeFrameInternal({
    graph,
    inputValue,
    previousStateValue,
    optionsValue,
    contextValue,
    ...(profilingOptions === undefined ? {} : { profilingOptions }),
    controlOptions,
    ...(compiledArtifacts === undefined
      ? {}
      : {
          snapshotStaticTemplates: compiledArtifacts.snapshotStaticTemplates,
          rigControlTopology: compiledArtifacts.rigControlTopology
        })
  });

const evaluateCompiledRuntimeRenderFrame: RuntimeRenderFrameEvaluator = (
  graph,
  inputValue,
  previousStateValue,
  optionsValue,
  contextValue,
  profilingOptions,
  controlOptions = {},
  compiledArtifacts,
  drawableIndexById
): RuntimeRenderFrameEvaluationResult => {
  void controlOptions;

  return evaluateRuntimeRenderFrameInternal({
    graph,
    inputValue,
    previousStateValue,
    optionsValue,
    contextValue,
    ...(profilingOptions === undefined ? {} : { profilingOptions }),
    snapshotStaticTemplates: compiledArtifacts.snapshotStaticTemplates,
    rigControlTopology: compiledArtifacts.rigControlTopology,
    drawableIndexById
  });
};

const evaluateRuntimeFrameInternal = (request: {
  readonly graph: NormalizedRuntimeGraph;
  readonly inputValue: RuntimeEvaluationInputInput;
  readonly previousStateValue: RuntimeStateDto;
  readonly optionsValue: RuntimeEvaluationOptionsInput;
  readonly contextValue: RuntimeEvaluationContextInput;
  readonly profilingOptions?: RuntimeCoreEvaluationProfilingOptions;
  readonly controlOptions: RuntimeFrameEvaluationControlOptions;
  readonly snapshotStaticTemplates?: RuntimeSnapshotStaticTemplates;
  readonly rigControlTopology?: RigControlTopologyEvaluation;
}): RuntimeFrameEvaluationResult => {
  const profiler = createRuntimeCoreEvaluationProfiler(request.profilingOptions);
  const {
    input,
    previousState,
    options,
    context
  } = profiler.measure("inputValidationDurationMs", () => ({
    input: RuntimeEvaluationInputSchema.parse(request.inputValue),
    previousState: RuntimeStateDtoSchema.parse(request.previousStateValue),
    options: RuntimeEvaluationOptionsSchema.parse(request.optionsValue),
    context: RuntimeEvaluationContextSchema.parse(request.contextValue)
  }));
  const compatibility = profiler.measure(
    "stateCompatibilityDurationMs",
    () => createCompatibleRuntimeState(request.graph, previousState, input)
  );
  const nextState = profiler.measure(
    "dynamicsEvaluationDurationMs",
    () => advanceRuntimeState(
      request.graph,
      compatibility.state,
      input,
      options.maxSubSteps
    )
  );
  const snapshot = profiler.measure("runtimeSnapshotCreationDurationMs", () =>
    createRuntimeSnapshot({
      graph: request.graph,
      evaluationInput: input,
      state: nextState,
      options,
      context,
      diagnostics: compatibility.diagnostics,
      ...(request.snapshotStaticTemplates === undefined
        ? {}
        : { snapshotStaticTemplates: request.snapshotStaticTemplates }),
      ...(request.rigControlTopology === undefined
        ? {}
        : { rigControlTopology: request.rigControlTopology }),
      profiling: profiler,
      snapshotValidationMode: request.controlOptions.snapshotValidation ?? "schema"
    }));
  const profile = profiler.finish();

  return {
    snapshot,
    nextState,
    ...(profile === undefined ? {} : { profile })
  };
};

const evaluateRuntimeRenderFrameInternal = (request: {
  readonly graph: NormalizedRuntimeGraph;
  readonly inputValue: RuntimeEvaluationInputInput;
  readonly previousStateValue: RuntimeStateDto;
  readonly optionsValue: RuntimeEvaluationOptionsInput;
  readonly contextValue: RuntimeEvaluationContextInput;
  readonly profilingOptions?: RuntimeCoreEvaluationProfilingOptions;
  readonly snapshotStaticTemplates: RuntimeSnapshotStaticTemplates;
  readonly rigControlTopology: RigControlTopologyEvaluation;
  readonly drawableIndexById: ReadonlyMap<string, number>;
}): RuntimeRenderFrameEvaluationResult => {
  const profiler = createRuntimeCoreEvaluationProfiler(request.profilingOptions);
  const {
    input,
    previousState,
    options
  } = profiler.measure("inputValidationDurationMs", () => ({
    input: RuntimeEvaluationInputSchema.parse(request.inputValue),
    previousState: RuntimeStateDtoSchema.parse(request.previousStateValue),
    options: RuntimeEvaluationOptionsSchema.parse(request.optionsValue),
    context: RuntimeEvaluationContextSchema.parse(request.contextValue)
  }));
  const compatibility = profiler.measure(
    "stateCompatibilityDurationMs",
    () => createCompatibleRuntimeState(request.graph, previousState, input)
  );
  const nextState = profiler.measure(
    "dynamicsEvaluationDurationMs",
    () => advanceRuntimeState(
      request.graph,
      compatibility.state,
      input,
      options.maxSubSteps
    )
  );
  const frame = profiler.measure("runtimeCoreRenderFrameOutputDurationMs", () =>
    createRuntimeRenderFrame({
      drawables: evaluateRuntimeRenderDrawables({
        graph: request.graph,
        evaluationInput: input,
        state: nextState,
        options,
        snapshotStaticTemplates: request.snapshotStaticTemplates,
        rigControlTopology: request.rigControlTopology,
        profiling: profiler
      }),
      drawableIndexById: request.drawableIndexById
    }));
  const profile = profiler.finish();

  return {
    frame,
    nextState,
    ...(profile === undefined ? {} : { profile })
  };
};

export const compileRuntimeModel = (
  graph: NormalizedRuntimeGraph
): CompiledRuntimeModel =>
  createCompiledRuntimeModel(
    graph,
    evaluateCompiledRuntimeFrame,
    evaluateCompiledRuntimeRenderFrame
  );

const createRuntimeRenderFrame = (input: {
  readonly drawables: readonly RuntimeRenderDrawableEvaluationDto[];
  readonly drawableIndexById: ReadonlyMap<string, number>;
}): RuntimeRenderFrame => ({
  drawables: input.drawables.map((drawable, fallbackIndex) => ({
    drawableId: drawable.drawableId,
    index: input.drawableIndexById.get(drawable.drawableId) ?? fallbackIndex,
    vertices: cloneRuntimeRenderVertices(drawable.vertices),
    opacity: drawable.opacity,
    drawOrder: drawable.evaluatedDrawOrder,
    visible: drawable.visible
  }))
});

const cloneRuntimeRenderVertices = (
  vertices: readonly { readonly x: number; readonly y: number }[] | undefined
): { readonly x: number; readonly y: number }[] =>
  vertices?.map((vertex) => ({
    x: vertex.x,
    y: vertex.y
  })) ?? [];

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
  compileRuntimeModel,
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
