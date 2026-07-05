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
  computeDynamicsOutputOffsetsFromGraph,
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame,
  type NormalizedDynamicsGroup,
  type NormalizedRuntimeGraph
} from "@private-2d-rigging-lab/runtime-core";
import type { RuntimeDynamicsGroupState } from "@private-2d-rigging-lab/contracts";

import type { ParameterValueMap } from "../../features/editor-session/model/parameter-keyform-state";

export const VIEWER_RUNTIME_FIXED_STEP_MS = 16.6666667;
export const VIEWER_RUNTIME_MAX_ELAPSED_MS = 100;
const VIEWER_RUNTIME_MAX_SUB_STEPS = 6;
// Viewer idle detection favors extra invisible frames over cutting off visible sway.
export const VIEWER_RUNTIME_SETTLED_MIN_EVALUATED_FRAMES = 36;
// §3.7 world-frame chain settled thresholds. The dynamics state is now a Verlet particle chain
// (cm, y-down); the old angle/source-velocity epsilons no longer have meaning.
// Max particle speed = max_i |x_i − x̂_i| / dt (cm/s). At the fixed step this is a per-frame
// displacement of ~0.017 cm — sub-pixel motion in the virtual dynamics space.
export const VIEWER_RUNTIME_SETTLED_PARTICLE_SPEED_EPSILON = 1.0;
// Per-frame change of the effective output offset (parameter units). At or below visible slider
// precision, so a still-moving output keeps the RAF loop alive but sub-precision drift is idle.
export const VIEWER_RUNTIME_SETTLED_OUTPUT_OFFSET_DELTA_EPSILON = 0.001;

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

  const dtSeconds = VIEWER_RUNTIME_FIXED_STEP_MS / 1000;

  return listPlayableDynamicsGroups(model.graph).every((group) => {
    const groupState = state.dynamicsGroups[group.dynamicsGroupId];
    if (groupState === undefined || groupState.particles.length === 0) {
      return false;
    }

    // §3.7: max_i |x_i − x̂_i| / dt (cm/s). px,py hold the previous-step position.
    const maxParticleSpeed = Math.max(
      ...groupState.particles.map((particle) =>
        Math.hypot(particle.x - particle.px, particle.y - particle.py)
      ),
      0
    ) / dtSeconds;

    // §3.7: change of the effective output offset per frame. Reconstruct the previous frame's
    // segment angles from the stored px,py so the offset delta needs no extra state.
    const maxOutputOffsetDelta = computeMaxOutputOffsetDelta(
      model.graph,
      group,
      groupState,
      authoredParameterValues
    );

    return (
      maxParticleSpeed <= VIEWER_RUNTIME_SETTLED_PARTICLE_SPEED_EPSILON &&
      maxOutputOffsetDelta <= VIEWER_RUNTIME_SETTLED_OUTPUT_OFFSET_DELTA_EPSILON
    );
  });
};

// §3.7 output-offset settled term: |offset(current particles) − offset(previous particles)| taken
// over every output, using the anchor from the current authored inputs (θ_local = θ_world − φ).
const computeMaxOutputOffsetDelta = (
  graph: NormalizedRuntimeGraph,
  group: NormalizedDynamicsGroup,
  groupState: RuntimeDynamicsGroupState,
  authoredParameterValues: ParameterValueMap
): number => {
  const previousState: RuntimeDynamicsGroupState = {
    ...groupState,
    particles: groupState.particles.map((particle) => ({
      x: particle.px,
      y: particle.py,
      px: particle.px,
      py: particle.py
    }))
  };

  const currentOffsets = computeDynamicsOutputOffsetsFromGraph(
    graph,
    group,
    groupState,
    authoredParameterValues
  );
  const previousOffsets = computeDynamicsOutputOffsetsFromGraph(
    graph,
    group,
    previousState,
    authoredParameterValues
  );

  return Math.max(
    ...currentOffsets.map((current, index) =>
      Math.abs(current.offset - (previousOffsets[index]?.offset ?? current.offset))
    ),
    0
  );
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
      group.chain.segmentLengths.length > 0 &&
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
