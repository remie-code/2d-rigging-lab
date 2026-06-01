import { toRuntimeGraph } from "@private-2d-rigging-lab/authoring-core";
import type { RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import {
  buildRuntimeDiff,
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame,
  evaluateRuntimeSequence
} from "@private-2d-rigging-lab/runtime-core";
import {
  validatePackageRuntime,
  type ValidationReportDto
} from "@private-2d-rigging-lab/validator-core";

import type { EditorPreviewProjectionDto } from "../editor-preview/preview-dto.js";
import { projectEditorPreview } from "../editor-preview/preview-projection.js";
import type { EditorSessionAdapter } from "../editor-session/index.js";
import {
  createEmptyDynamicsPreviewState,
  projectDynamicsPreviewState,
  projectPreviewAuthoredParameterValues,
  type EditorSemanticState
} from "../editor-state/index.js";

export interface EditorWorkflowDynamicsPreviewResult {
  readonly status: "reset" | "ran" | "no_dynamics_group";
  readonly frameCount: number;
  readonly runtimeState: RuntimeStateDto | null;
  readonly validationReport: ValidationReportDto | null;
}

export interface EditorWorkflowDynamicsPreviewStateResult {
  readonly result: EditorWorkflowDynamicsPreviewResult;
  readonly state: EditorSemanticState;
}

export interface WorkflowDynamicsPreviewRunner {
  clear(state: EditorSemanticState): EditorSemanticState;
  reset(input: {
    readonly adapter: EditorSessionAdapter;
    readonly state: EditorSemanticState;
  }): EditorWorkflowDynamicsPreviewStateResult;
  run(input: {
    readonly adapter: EditorSessionAdapter;
    readonly state: EditorSemanticState;
    readonly frameCount: number;
  }): EditorWorkflowDynamicsPreviewStateResult;
  projectPreviewProjection(input: {
    readonly adapter: EditorSessionAdapter;
    readonly state: EditorSemanticState;
  }): EditorPreviewProjectionDto | null;
}

export const createWorkflowDynamicsPreviewRunner = (options: {
  readonly now?: () => Date;
} = {}): WorkflowDynamicsPreviewRunner => {
  let runtimeState: RuntimeStateDto | null = null;

  const clear = (state: EditorSemanticState): EditorSemanticState => {
    runtimeState = null;
    return {
      ...state,
      dynamicsPreview: createEmptyDynamicsPreviewState()
    };
  };

  return {
    clear,
    reset(input) {
      const evaluation = evaluateWorkflowDynamicsPreview({
        ...input,
        previousRuntimeState: null,
        frameCount: 0,
        status: "reset",
        ...(options.now === undefined ? {} : { now: options.now })
      });

      if (evaluation.status === "no_dynamics_group") {
        return {
          result: evaluation,
          state: input.state
        };
      }

      runtimeState = evaluation.runtimeState;
      return {
        state: {
          ...input.state,
          dynamicsPreview: evaluation.previewState
        },
        result: {
          status: "reset",
          frameCount: 0,
          runtimeState,
          validationReport: evaluation.validationReport
        }
      };
    },
    run(input) {
      const requestedFrameCount = Number.isFinite(input.frameCount)
        ? Math.trunc(input.frameCount)
        : 1;
      const normalizedFrameCount = Math.max(1, Math.min(120, requestedFrameCount));
      const evaluation = evaluateWorkflowDynamicsPreview({
        adapter: input.adapter,
        state: input.state,
        previousRuntimeState: runtimeState,
        frameCount: normalizedFrameCount,
        status: "ran",
        ...(options.now === undefined ? {} : { now: options.now })
      });

      if (evaluation.status === "no_dynamics_group") {
        return {
          result: evaluation,
          state: input.state
        };
      }

      runtimeState = evaluation.runtimeState;
      return {
        state: {
          ...input.state,
          dynamicsPreview: evaluation.previewState
        },
        result: {
          status: "ran",
          frameCount: normalizedFrameCount,
          runtimeState,
          validationReport: evaluation.validationReport
        }
      };
    },
    projectPreviewProjection(input) {
      return projectWorkflowPreviewProjection(input.adapter, input.state, runtimeState);
    }
  };
};

interface WorkflowDynamicsPreviewEvaluation {
  readonly status: "evaluated";
  readonly runtimeState: RuntimeStateDto;
  readonly previewState: ReturnType<typeof projectDynamicsPreviewState>;
  readonly validationReport: ValidationReportDto;
}

interface WorkflowDynamicsPreviewNoGroupEvaluation {
  readonly status: "no_dynamics_group";
  readonly frameCount: number;
  readonly runtimeState: null;
  readonly validationReport: null;
}

const evaluateWorkflowDynamicsPreview = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly previousRuntimeState: RuntimeStateDto | null;
  readonly frameCount: number;
  readonly status: "reset" | "ran";
  readonly now?: () => Date;
}):
  | WorkflowDynamicsPreviewEvaluation
  | WorkflowDynamicsPreviewNoGroupEvaluation => {
  if (!input.state.dynamicsGroups.some((group) => group.enabled)) {
    return {
      status: "no_dynamics_group",
      frameCount: input.frameCount,
      runtimeState: null,
      validationReport: null
    };
  }

  const graph = toRuntimeGraph(input.adapter.authoringSession);
  const options = createPreviewRuntimeOptions();
  const context = createPreviewRuntimeContext();
  const authoredParameterValues = projectPreviewAuthoredParameterValues(input.state.previewParameters);
  const targetIds = collectDynamicsPreviewTargetIds(input.state);
  const reusableState = isReusableRuntimeState(input.previousRuntimeState, graph.packageId, graph.packageRevision)
    ? input.previousRuntimeState
    : null;
  const initialState = reusableState ?? createInitialRuntimeState(graph, {
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    authoredParameterValues,
    resetReasons: ["previewRestart"]
  });
  const beforeFrameIndex = initialState.frameIndex;
  const before = evaluateRuntimeFrame(
    graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: beforeFrameIndex,
      deltaTimeMs: 0,
      resetReasons: [],
      authoredParameterValues,
      targetIds: [...targetIds]
    },
    initialState,
    options,
    context
  );
  const evaluated =
    input.status === "reset"
      ? (() => {
          const result = evaluateRuntimeFrame(
            graph,
            {
              schemaVersion: "runtime-evaluation-input-v1",
              frameIndex: 0,
              deltaTimeMs: 0,
              resetReasons: ["manualCommand"],
              authoredParameterValues,
              targetIds: [...targetIds]
            },
            createInitialRuntimeState(graph, {
              packageId: graph.packageId,
              packageRevision: graph.packageRevision,
              authoredParameterValues,
              resetReasons: ["manualCommand"]
            }),
            options,
            context
          );

          return {
            snapshot: result.snapshot,
            runtimeState: result.nextState
          };
        })()
      : (() => {
          const result = evaluateRuntimeSequence(
            graph,
            Array.from({ length: input.frameCount }, (_, index) => ({
              frameIndex: beforeFrameIndex + index + 1,
              deltaTimeMs: before.nextState.fixedStepMs,
              resetReasons: [],
              authoredParameterValues,
              targetIds: [...targetIds]
            })),
            before.nextState,
            options,
            context
          );

          return {
            snapshot: result.snapshots.at(-1) ?? before.snapshot,
            runtimeState: result.finalState
          };
        })();
  const runtimeDiff = buildRuntimeDiff({
    baselineSnapshot: before.snapshot,
    candidateSnapshot: evaluated.snapshot
  });
  const validationReport = validatePackageRuntime({
    packageDocument: input.adapter.createPersistenceSnapshot().document,
    runtimeSnapshot: evaluated.snapshot,
    profile: "editorIncremental",
    ...(input.now === undefined ? {} : { createdAt: input.now().toISOString() })
  });

  return {
    status: "evaluated",
    runtimeState: evaluated.runtimeState,
    validationReport,
    previewState: projectDynamicsPreviewState({
      status: input.status,
      snapshot: evaluated.snapshot,
      runtimeDiff,
      validationReport,
      frameIndex: evaluated.runtimeState.frameIndex,
      frameCount: input.frameCount
    })
  };
};

const projectWorkflowPreviewProjection = (
  adapter: EditorSessionAdapter,
  state: EditorSemanticState,
  runtimeState: RuntimeStateDto | null
): EditorPreviewProjectionDto | null => {
  if (state.loadedPackage === null) {
    return null;
  }

  const graph = toRuntimeGraph(adapter.authoringSession);
  const options = createPreviewRuntimeOptions();
  const context = createPreviewRuntimeContext();
  const defaultParameterValues = Object.fromEntries(
    state.previewParameters
      .filter((parameter) => parameter.valueSource === "authoredInput")
      .map((parameter) => [parameter.parameterId, parameter.defaultValue])
  );
  const currentParameterValues = projectPreviewAuthoredParameterValues(state.previewParameters);
  const targetIds = collectDynamicsPreviewTargetIds(state);
  const baselineState = createInitialRuntimeState(graph, {
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    authoredParameterValues: defaultParameterValues,
    resetReasons: ["previewRestart"]
  });
  const baseline = evaluateRuntimeFrame(
    graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: 0,
      deltaTimeMs: 0,
      resetReasons: ["previewRestart"],
      authoredParameterValues: defaultParameterValues,
      targetIds: [...targetIds]
    },
    baselineState,
    options,
    context
  );
  const currentState = isReusableRuntimeState(
    runtimeState,
    graph.packageId,
    graph.packageRevision
  )
    ? runtimeState
    : createInitialRuntimeState(graph, {
        packageId: graph.packageId,
        packageRevision: graph.packageRevision,
        authoredParameterValues: currentParameterValues,
        resetReasons: ["previewRestart"]
      });
  const current = evaluateRuntimeFrame(
    graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: Math.max(1, currentState.frameIndex),
      deltaTimeMs: 0,
      resetReasons: runtimeState === null ? ["previewRestart"] : [],
      authoredParameterValues: currentParameterValues,
      targetIds: [...targetIds]
    },
    currentState,
    options,
    context
  );

  return projectEditorPreview({
    snapshot: current.snapshot,
    runtimeDiff: buildRuntimeDiff({
      baselineSnapshot: baseline.snapshot,
      candidateSnapshot: current.snapshot
    }),
    canvasSize: adapter.authoringSession.graph.canvasSize,
    drawableNames: Object.fromEntries(
      adapter.authoringSession.graph.drawables.map((drawable) => [
        drawable.drawableId,
        drawable.displayName
      ])
    )
  });
};

const createPreviewRuntimeOptions = () => ({
  ...defaultRuntimeEvaluationOptions(),
  snapshotDetail: "full" as const
});

const createPreviewRuntimeContext = () => ({
  source: {
    surface: "preview" as const
  },
  policy: {
    strictness: "interactive" as const
  }
});

const collectDynamicsPreviewTargetIds = (
  state: EditorSemanticState
): readonly string[] =>
  uniqueStrings([
    ...state.dynamicsGroups.map((group) => group.dynamicsGroupId),
    ...state.dynamicsGroups.flatMap((group) => group.driverParameterIds),
    ...state.dynamicsGroups.map((group) => group.outputParameterId),
    ...state.rigControls.map((rigControl) => rigControl.rigControlId),
    ...state.rigControls.flatMap((rigControl) => rigControl.childDrawableIds),
    ...state.rigControls.flatMap((rigControl) => rigControl.childRigControlIds)
  ]);

const isReusableRuntimeState = (
  runtimeState: RuntimeStateDto | null,
  packageId: string,
  packageRevision: number
): runtimeState is RuntimeStateDto =>
  runtimeState !== null &&
  runtimeState.packageId === packageId &&
  runtimeState.packageRevision === packageRevision;

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};
