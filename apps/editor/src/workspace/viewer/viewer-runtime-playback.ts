import {
  toRuntimeGraph,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  ParameterId,
  RuntimeResetReason,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import {
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame,
  type NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";

import type { ParameterValueMap } from "../../features/editor-session/model/parameter-keyform-state";

export const VIEWER_RUNTIME_FIXED_STEP_MS = 16.6666667;
export const VIEWER_RUNTIME_MAX_ELAPSED_MS = 100;
const VIEWER_RUNTIME_MAX_SUB_STEPS = 6;

export interface ViewerRuntimePlaybackModel {
  readonly graph: NormalizedRuntimeGraph;
  readonly dynamicsOutputParameterIds: ReadonlySet<ParameterId>;
  readonly enabledDynamicsGroupCount: number;
  readonly stateIdentityKey: string;
}

export interface ViewerRuntimePlaybackFrameInput {
  readonly authoredParameterValues: ParameterValueMap;
  readonly deltaTimeMs: number;
  readonly frameIndex?: number;
  readonly model: ViewerRuntimePlaybackModel;
  readonly previousState?: RuntimeStateDto;
}

export interface ViewerRuntimePlaybackFrameResult {
  readonly nextState: RuntimeStateDto;
  readonly parameterValues: ParameterValueMap;
}

export const createViewerRuntimePlaybackModel = (
  session: AuthoringSession
): ViewerRuntimePlaybackModel => {
  const graph = toRuntimeGraph(session);

  return {
    graph,
    dynamicsOutputParameterIds: createDynamicsOutputParameterIdSet(graph),
    enabledDynamicsGroupCount: [...graph.dynamicsGroups.values()].filter(
      (group) =>
        group.enabled &&
        group.inputs.length > 0 &&
        group.pendulums.length > 0 &&
        group.outputs.length > 0
    ).length,
    stateIdentityKey: createRuntimeStateIdentityKey(graph)
  };
};

export const createViewerRuntimeInitialState = (
  model: ViewerRuntimePlaybackModel,
  authoredParameterValues: ParameterValueMap,
  resetReason: RuntimeResetReason = "packageLoad"
): RuntimeStateDto =>
  createInitialRuntimeState(model.graph, {
    packageId: model.graph.packageId,
    packageRevision: model.graph.packageRevision,
    ...(model.graph.packageHash === undefined ? {} : { packageHash: model.graph.packageHash }),
    authoredParameterValues,
    fixedStepMs: VIEWER_RUNTIME_FIXED_STEP_MS,
    resetReasons: [resetReason]
  });

export const evaluateViewerRuntimePlaybackFrame = (
  input: ViewerRuntimePlaybackFrameInput
): ViewerRuntimePlaybackFrameResult => {
  const compatiblePreviousState =
    input.previousState === undefined ||
    !isViewerRuntimePlaybackStateCompatible(input.model, input.previousState)
      ? undefined
      : input.previousState;
  const previousState =
    compatiblePreviousState ??
    createViewerRuntimeInitialState(input.model, input.authoredParameterValues);
  const frameIndex = input.frameIndex ?? previousState.frameIndex + 1;
  const result = evaluateRuntimeFrame(
    input.model.graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex,
      deltaTimeMs: clamp(input.deltaTimeMs, 0, VIEWER_RUNTIME_MAX_ELAPSED_MS),
      authoredParameterValues: input.authoredParameterValues,
      resetReasons: [],
      targetIds: []
    },
    previousState,
    {
      ...defaultRuntimeEvaluationOptions(),
      maxSubSteps: VIEWER_RUNTIME_MAX_SUB_STEPS
    },
    {
      source: {
        surface: "viewer"
      },
      policy: {
        strictness: "interactive"
      }
    }
  );

  return {
    nextState: result.nextState,
    parameterValues: createEffectiveRuntimeParameterValueMap(
      input.authoredParameterValues,
      result.snapshot.parameters
    )
  };
};

export const isViewerRuntimePlaybackStateCompatible = (
  model: ViewerRuntimePlaybackModel,
  state: RuntimeStateDto
): boolean =>
  state.packageId === model.graph.packageId &&
  state.packageRevision === model.graph.packageRevision &&
  state.packageHash === model.graph.packageHash;

export const resolveViewerRuntimeParameterValues = (input: {
  readonly authoredParameterValues: ParameterValueMap;
  readonly model: ViewerRuntimePlaybackModel;
  readonly state?: RuntimeStateDto;
}): ParameterValueMap => {
  if (input.model.enabledDynamicsGroupCount === 0) {
    return input.authoredParameterValues;
  }

  return evaluateViewerRuntimePlaybackFrame({
    authoredParameterValues: input.authoredParameterValues,
    deltaTimeMs: 0,
    frameIndex: input.state?.frameIndex ?? 0,
    model: input.model,
    ...(input.state === undefined ? {} : { previousState: input.state })
  }).parameterValues;
};

const createDynamicsOutputParameterIdSet = (
  graph: NormalizedRuntimeGraph
): ReadonlySet<ParameterId> =>
  new Set(
    [...graph.dynamicsGroups.values()].flatMap((group) =>
      group.outputs.map((output) => output.parameterId)
    )
  );

const createRuntimeStateIdentityKey = (graph: NormalizedRuntimeGraph): string =>
  `${graph.packageId}:${graph.packageRevision}:${graph.packageHash ?? ""}`;

const createEffectiveRuntimeParameterValueMap = (
  baseParameterValues: ParameterValueMap,
  parameters: readonly {
    readonly effectiveValue: number;
    readonly parameterId: ParameterId;
  }[]
): ParameterValueMap => {
  const parameterValues: Record<string, number> = {
    ...baseParameterValues
  };

  for (const parameter of parameters) {
    parameterValues[parameter.parameterId] = parameter.effectiveValue;
  }

  return parameterValues;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
