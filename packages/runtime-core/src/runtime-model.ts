import type { RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import { RuntimeStateDtoSchema } from "@private-2d-rigging-lab/contracts";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import type {
  RuntimeEvaluationInputInput,
  RuntimeInitialStateRequestInput
} from "./runtime-input.js";
import type { RuntimeEvaluationOptionsInput } from "./runtime-options.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import type { RuntimeCoreEvaluationProfilingOptions } from "./runtime-profiling.js";
import {
  createRigControlTopologyEvaluation,
  type RigControlTopologyEvaluation
} from "./rig-control-hierarchy.js";
import {
  compileRuntimeSnapshotStaticTemplates,
  type RuntimeSnapshotStaticTemplates
} from "./snapshot-static-templates.js";
import type {
  RuntimeEvaluationContextInput,
  RuntimeFrameEvaluationControlOptions,
  RuntimeFrameEvaluationResult
} from "./runtime-core.js";

export interface CompiledRuntimeModel {
  createInstance(options?: RuntimeModelInstanceOptions): RuntimeModelInstance;
}

export interface RuntimeModelInstance {
  evaluateFrame(
    input: RuntimeEvaluationInputInput,
    options?: RuntimeModelFrameEvaluationOptions
  ): RuntimeFrameEvaluationResult;
  getState(): RuntimeStateDto;
  reset(state?: RuntimeStateDto): void;
}

export interface RuntimeModelInstanceOptions {
  readonly initialState?: RuntimeStateDto;
  readonly initialStateRequest?: RuntimeModelInitialStateRequestInput;
}

export type RuntimeModelInitialStateRequestInput =
  Partial<RuntimeInitialStateRequestInput>;

export interface RuntimeModelFrameEvaluationOptions {
  readonly evaluationOptions?: RuntimeEvaluationOptionsInput;
  readonly context?: RuntimeEvaluationContextInput;
  readonly profilingOptions?: RuntimeCoreEvaluationProfilingOptions;
  readonly controlOptions?: RuntimeFrameEvaluationControlOptions;
}

export type RuntimeFrameEvaluator = (
  graph: NormalizedRuntimeGraph,
  input: RuntimeEvaluationInputInput,
  previousState: RuntimeStateDto,
  options: RuntimeEvaluationOptionsInput,
  context: RuntimeEvaluationContextInput,
  profilingOptions?: RuntimeCoreEvaluationProfilingOptions,
  controlOptions?: RuntimeFrameEvaluationControlOptions,
  compiledArtifacts?: RuntimeFrameEvaluatorCompiledArtifacts
) => RuntimeFrameEvaluationResult;

export interface RuntimeFrameEvaluatorCompiledArtifacts {
  readonly snapshotStaticTemplates: RuntimeSnapshotStaticTemplates;
  readonly rigControlTopology: RigControlTopologyEvaluation;
}

export const createCompiledRuntimeModel = (
  graph: NormalizedRuntimeGraph,
  frameEvaluator: RuntimeFrameEvaluator
): CompiledRuntimeModel =>
  Object.freeze(new CompatibleCompiledRuntimeModel(
    graph,
    frameEvaluator,
    compileRuntimeSnapshotStaticTemplates(graph),
    createRigControlTopologyEvaluation(graph)
  ));

const defaultRuntimeEvaluationContext: RuntimeEvaluationContextInput = {
  source: { surface: "preview" }
};

class CompatibleCompiledRuntimeModel implements CompiledRuntimeModel {
  public constructor(
    private readonly graph: NormalizedRuntimeGraph,
    private readonly frameEvaluator: RuntimeFrameEvaluator,
    private readonly snapshotStaticTemplates: RuntimeSnapshotStaticTemplates,
    private readonly rigControlTopology: RigControlTopologyEvaluation
  ) {}

  public createInstance(
    options: RuntimeModelInstanceOptions = {}
  ): RuntimeModelInstance {
    return new CompatibleRuntimeModelInstance(
      this.graph,
      this.frameEvaluator,
      this.snapshotStaticTemplates,
      this.rigControlTopology,
      createRuntimeModelInitialState(this.graph, options)
    );
  }
}

class CompatibleRuntimeModelInstance implements RuntimeModelInstance {
  public constructor(
    private readonly graph: NormalizedRuntimeGraph,
    private readonly frameEvaluator: RuntimeFrameEvaluator,
    private readonly snapshotStaticTemplates: RuntimeSnapshotStaticTemplates,
    private readonly rigControlTopology: RigControlTopologyEvaluation,
    private state: RuntimeStateDto
  ) {}

  public evaluateFrame(
    input: RuntimeEvaluationInputInput,
    options: RuntimeModelFrameEvaluationOptions = {}
  ): RuntimeFrameEvaluationResult {
    const result = this.frameEvaluator(
      this.graph,
      input,
      this.state,
      options.evaluationOptions ?? defaultRuntimeEvaluationOptions(),
      options.context ?? defaultRuntimeEvaluationContext,
      options.profilingOptions,
      options.controlOptions,
      {
        snapshotStaticTemplates: this.snapshotStaticTemplates,
        rigControlTopology: this.rigControlTopology
      }
    );
    this.state = result.nextState;

    return result;
  }

  public getState(): RuntimeStateDto {
    return RuntimeStateDtoSchema.parse(this.state);
  }

  public reset(state?: RuntimeStateDto): void {
    this.state = state === undefined
      ? createDefaultRuntimeModelInitialState(this.graph)
      : RuntimeStateDtoSchema.parse(state);
  }
}

const createRuntimeModelInitialState = (
  graph: NormalizedRuntimeGraph,
  options: RuntimeModelInstanceOptions
): RuntimeStateDto => {
  if (options.initialState !== undefined && options.initialStateRequest !== undefined) {
    throw new TypeError(
      "RuntimeModelInstanceOptions cannot specify both initialState and initialStateRequest."
    );
  }

  if (options.initialState !== undefined) {
    return RuntimeStateDtoSchema.parse(options.initialState);
  }

  return createInitialRuntimeState(
    graph,
    createRuntimeModelInitialStateRequest(graph, options.initialStateRequest)
  );
};

const createDefaultRuntimeModelInitialState = (
  graph: NormalizedRuntimeGraph
): RuntimeStateDto =>
  createInitialRuntimeState(
    graph,
    createRuntimeModelInitialStateRequest(graph)
  );

const createRuntimeModelInitialStateRequest = (
  graph: NormalizedRuntimeGraph,
  request: RuntimeModelInitialStateRequestInput = {}
): RuntimeInitialStateRequestInput => ({
  packageId: graph.packageId,
  packageRevision: graph.packageRevision,
  ...(graph.packageHash === undefined ? {} : { packageHash: graph.packageHash }),
  resetReasons: ["packageLoad"],
  ...request
});
