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
  recordLive2dPerformanceCounter,
  recordLive2dPerformanceTiming,
  startLive2dPerformanceTiming
} from "@private-2d-rigging-lab/render-core";
import {
  computeDynamicsSource,
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame,
  type NormalizedDynamicsGroup,
  type NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";

import type { ParameterValueMap } from "../../features/editor-session/model/parameter-keyform-state";

export const VIEWER_RUNTIME_FIXED_STEP_MS = 16.6666667;
export const VIEWER_RUNTIME_MAX_ELAPSED_MS = 100;
const VIEWER_RUNTIME_MAX_SUB_STEPS = 6;
// Viewer idle detection favors extra invisible frames over cutting off visible sway.
export const VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES = 36;
// Runtime dynamics source/angle values are normalized; this maps to sub-pixel Viewer motion.
export const VIEWER_RUNTIME_SETTLED_ANGULAR_VELOCITY_EPSILON = 0.01;
export const VIEWER_RUNTIME_SETTLED_SOURCE_VELOCITY_EPSILON = 0.0005;
export const VIEWER_RUNTIME_SETTLED_ANGLE_TO_SOURCE_EPSILON = 0.01;
// Output distance uses authored strength/limit units; 0.1 is at or below visible slider precision.
export const VIEWER_RUNTIME_SETTLED_OUTPUT_TO_TARGET_EPSILON = 0.1;

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

export interface ViewerRuntimeReusableParameterValues {
  readonly model: ViewerRuntimePlaybackModel;
  readonly parameterSignature: string;
  readonly parameterValues: ParameterValueMap;
  readonly state: RuntimeStateDto;
  readonly stateIdentityKey: string;
}

export interface ViewerRuntimePlaybackSettledInput {
  readonly authoredParameterValues: ParameterValueMap;
  readonly evaluatedFrameCount: number;
  readonly model: ViewerRuntimePlaybackModel;
  readonly state: RuntimeStateDto | null | undefined;
}

export const createViewerRuntimePlaybackModel = (
  session: AuthoringSession
): ViewerRuntimePlaybackModel => {
  const graph = toRuntimeGraph(session);

  return {
    graph,
    dynamicsOutputParameterIds: createDynamicsOutputParameterIdSet(graph),
    enabledDynamicsGroupCount: listPlayableDynamicsGroups(graph).length,
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
  const timingStart = startLive2dPerformanceTiming();
  recordLive2dPerformanceCounter("viewer.runtimeFrame.evaluations");

  try {
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
  } finally {
    recordLive2dPerformanceTiming("viewer.runtimeFrame.ms", timingStart);
  }
};

export const createViewerRuntimeReusableParameterValues = ({
  authoredParameterValues,
  model,
  parameterValues,
  state
}: {
  readonly authoredParameterValues: ParameterValueMap;
  readonly model: ViewerRuntimePlaybackModel;
  readonly parameterValues: ParameterValueMap;
  readonly state: RuntimeStateDto;
}): ViewerRuntimeReusableParameterValues => ({
  model,
  parameterSignature: createViewerRuntimeParameterSignature(
    model,
    authoredParameterValues
  ),
  parameterValues,
  state,
  stateIdentityKey: model.stateIdentityKey
});

export const isViewerRuntimePlaybackStateCompatible = (
  model: ViewerRuntimePlaybackModel,
  state: RuntimeStateDto
): boolean =>
  state.packageId === model.graph.packageId &&
  state.packageRevision === model.graph.packageRevision &&
  state.packageHash === model.graph.packageHash;

export const createViewerRuntimeParameterSignature = (
  model: ViewerRuntimePlaybackModel,
  authoredParameterValues: ParameterValueMap
): string => {
  const parameterIds = new Set<ParameterId>(model.graph.parameters.keys());
  for (const group of listPlayableDynamicsGroups(model.graph)) {
    for (const input of group.inputs) {
      parameterIds.add(input.parameterId);
    }
    for (const output of group.outputs) {
      parameterIds.add(output.parameterId);
    }
  }

  return [...parameterIds]
    .sort((left, right) => left.localeCompare(right))
    .map((parameterId) => {
      const value =
        authoredParameterValues[parameterId] ??
        model.graph.parameters.get(parameterId)?.default ??
        0;
      return `${parameterId}:${formatRuntimeSignatureNumber(value)}`;
    })
    .join("|");
};

export const isViewerRuntimePlaybackStateSettled = ({
  authoredParameterValues,
  evaluatedFrameCount,
  model,
  state
}: ViewerRuntimePlaybackSettledInput): boolean => {
  if (model.enabledDynamicsGroupCount === 0) {
    return true;
  }

  if (
    state === null ||
    state === undefined ||
    !isViewerRuntimePlaybackStateCompatible(model, state) ||
    evaluatedFrameCount < VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES
  ) {
    return false;
  }

  return listPlayableDynamicsGroups(model.graph).every((group) => {
    const groupState = state.dynamicsGroups[group.dynamicsGroupId];
    if (groupState === undefined) {
      return false;
    }

    const targetSource = computeDynamicsSource(model.graph, group, authoredParameterValues);
    const angleToSource = Math.abs(groupState.angle - targetSource);
    const maxOutputDistance = Math.max(
      ...group.outputs.map((output) => {
        const rawDistance = Math.abs(angleToSource * output.strength);
        return Math.min(rawDistance, Math.abs(output.limit));
      }),
      0
    );

    return (
      Math.abs(groupState.angularVelocity) <=
        VIEWER_RUNTIME_SETTLED_ANGULAR_VELOCITY_EPSILON &&
      Math.abs(groupState.previousSourceVelocity) <=
        VIEWER_RUNTIME_SETTLED_SOURCE_VELOCITY_EPSILON &&
      angleToSource <= VIEWER_RUNTIME_SETTLED_ANGLE_TO_SOURCE_EPSILON &&
      maxOutputDistance <= VIEWER_RUNTIME_SETTLED_OUTPUT_TO_TARGET_EPSILON
    );
  });
};

export const resolveViewerRuntimeParameterValues = (input: {
  readonly authoredParameterValues: ParameterValueMap;
  readonly model: ViewerRuntimePlaybackModel;
  readonly reusableParameterValues?: ViewerRuntimeReusableParameterValues | null;
  readonly state?: RuntimeStateDto;
}): ParameterValueMap => {
  if (input.model.enabledDynamicsGroupCount === 0) {
    return input.authoredParameterValues;
  }

  if (
    input.state !== undefined &&
    input.reusableParameterValues !== undefined &&
    input.reusableParameterValues !== null &&
    input.state === input.reusableParameterValues.state &&
    isViewerRuntimeReusableParameterValuesCompatible({
      authoredParameterValues: input.authoredParameterValues,
      model: input.model,
      reusableParameterValues: input.reusableParameterValues
    })
  ) {
    recordLive2dPerformanceCounter("viewer.runtimeFrame.deltaZeroReevaluationSkipped");
    return input.reusableParameterValues.parameterValues;
  }

  recordLive2dPerformanceCounter("viewer.runtimeFrame.deltaZeroReevaluationFallback");
  return evaluateViewerRuntimePlaybackFrame({
    authoredParameterValues: input.authoredParameterValues,
    deltaTimeMs: 0,
    frameIndex: input.state?.frameIndex ?? 0,
    model: input.model,
    ...(input.state === undefined ? {} : { previousState: input.state })
  }).parameterValues;
};

export const isViewerRuntimeReusableParameterValuesCompatible = ({
  authoredParameterValues,
  model,
  reusableParameterValues
}: {
  readonly authoredParameterValues: ParameterValueMap;
  readonly model: ViewerRuntimePlaybackModel;
  readonly reusableParameterValues: ViewerRuntimeReusableParameterValues;
}): boolean =>
  reusableParameterValues.model === model &&
  reusableParameterValues.stateIdentityKey === model.stateIdentityKey &&
  isViewerRuntimePlaybackStateCompatible(model, reusableParameterValues.state) &&
  reusableParameterValues.parameterSignature ===
    createViewerRuntimeParameterSignature(model, authoredParameterValues);

const createDynamicsOutputParameterIdSet = (
  graph: NormalizedRuntimeGraph
): ReadonlySet<ParameterId> =>
  new Set(
    [...graph.dynamicsGroups.values()].flatMap((group) =>
      group.outputs.map((output) => output.parameterId)
    )
  );

const listPlayableDynamicsGroups = (
  graph: NormalizedRuntimeGraph
): readonly NormalizedDynamicsGroup[] =>
  [...graph.dynamicsGroups.values()].filter(
    (group) =>
      group.enabled &&
      group.inputs.length > 0 &&
      group.pendulums.length > 0 &&
      group.outputs.length > 0
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

const formatRuntimeSignatureNumber = (value: number): string =>
  Number.isFinite(value) ? String(Object.is(value, -0) ? 0 : value) : "non-finite";
