import type {
  DrawableId,
  RuntimeStateDto,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import { RuntimeStateDtoSchema } from "@private-2d-rigging-lab/contracts";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import type {
  RuntimeEvaluationInputInput,
  RuntimeInitialStateRequestInput
} from "./runtime-input.js";
import type { RuntimeEvaluationOptionsInput } from "./runtime-options.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import type {
  RuntimeCoreEvaluationProfile,
  RuntimeCoreEvaluationProfilingOptions
} from "./runtime-profiling.js";
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
  evaluateRenderFrame(
    input: RuntimeEvaluationInputInput,
    options?: RuntimeModelRenderFrameEvaluationOptions
  ): RuntimeRenderFrameEvaluationResult;
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

export type RuntimeModelRenderFrameEvaluationOptions =
  RuntimeModelFrameEvaluationOptions;

export interface RuntimeRenderFrameEvaluationResult {
  readonly frame: RuntimeRenderFrame;
  readonly nextState: RuntimeStateDto;
  readonly profile?: RuntimeCoreEvaluationProfile;
}

export interface RuntimeRenderFrame {
  readonly drawables: readonly RuntimeRenderFrameDrawable[];
}

export interface RuntimeRenderFrameDrawable {
  readonly drawableId: DrawableId;
  readonly index: number;
  readonly vertices: readonly Vec2Dto[];
  readonly opacity: number;
  readonly drawOrder: number;
  readonly visible: boolean;
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

export type RuntimeRenderFrameEvaluator = (
  graph: NormalizedRuntimeGraph,
  input: RuntimeEvaluationInputInput,
  previousState: RuntimeStateDto,
  options: RuntimeEvaluationOptionsInput,
  context: RuntimeEvaluationContextInput,
  profilingOptions: RuntimeCoreEvaluationProfilingOptions | undefined,
  controlOptions: RuntimeFrameEvaluationControlOptions | undefined,
  compiledArtifacts: RuntimeFrameEvaluatorCompiledArtifacts,
  drawableIndexById: ReadonlyMap<DrawableId, number>
) => RuntimeRenderFrameEvaluationResult;

export interface RuntimeFrameEvaluatorCompiledArtifacts {
  readonly snapshotStaticTemplates: RuntimeSnapshotStaticTemplates;
  readonly rigControlTopology: RigControlTopologyEvaluation;
}

export const createCompiledRuntimeModel = (
  graph: NormalizedRuntimeGraph,
  frameEvaluator: RuntimeFrameEvaluator,
  renderFrameEvaluator: RuntimeRenderFrameEvaluator
): CompiledRuntimeModel =>
  Object.freeze(new CompatibleCompiledRuntimeModel(
    graph,
    frameEvaluator,
    renderFrameEvaluator,
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
    private readonly renderFrameEvaluator: RuntimeRenderFrameEvaluator,
    private readonly snapshotStaticTemplates: RuntimeSnapshotStaticTemplates,
    private readonly rigControlTopology: RigControlTopologyEvaluation
  ) {}

  public createInstance(
    options: RuntimeModelInstanceOptions = {}
  ): RuntimeModelInstance {
    return new CompatibleRuntimeModelInstance(
      this.graph,
      this.frameEvaluator,
      this.renderFrameEvaluator,
      this.snapshotStaticTemplates,
      this.rigControlTopology,
      createRuntimeRenderDrawableIndex(this.snapshotStaticTemplates),
      createRuntimeModelInitialState(this.graph, options)
    );
  }
}

class CompatibleRuntimeModelInstance implements RuntimeModelInstance {
  public constructor(
    private readonly graph: NormalizedRuntimeGraph,
    private readonly frameEvaluator: RuntimeFrameEvaluator,
    private readonly renderFrameEvaluator: RuntimeRenderFrameEvaluator,
    private readonly snapshotStaticTemplates: RuntimeSnapshotStaticTemplates,
    private readonly rigControlTopology: RigControlTopologyEvaluation,
    private readonly renderDrawableIndexById: ReadonlyMap<DrawableId, number>,
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

  public evaluateRenderFrame(
    input: RuntimeEvaluationInputInput,
    options: RuntimeModelRenderFrameEvaluationOptions = {}
  ): RuntimeRenderFrameEvaluationResult {
    const result = this.renderFrameEvaluator(
      this.graph,
      input,
      this.state,
      {
        ...defaultRuntimeEvaluationOptions(),
        ...options.evaluationOptions
      },
      options.context ?? defaultRuntimeEvaluationContext,
      options.profilingOptions,
      options.controlOptions,
      {
        snapshotStaticTemplates: this.snapshotStaticTemplates,
        rigControlTopology: this.rigControlTopology
      },
      this.renderDrawableIndexById
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

const createRuntimeRenderDrawableIndex = (
  templates: RuntimeSnapshotStaticTemplates
): ReadonlyMap<DrawableId, number> =>
  new Map(
    templates.drawables.map((drawable, index) => [
      drawable.drawableId,
      index
    ] as const)
  );
