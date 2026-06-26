import type {
  RuntimeResetReason,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import {
  compileRuntimeModel,
  defaultRuntimeEvaluationOptions,
  type CompiledRuntimeModel,
  type RuntimeCoreEvaluationProfile,
  type RuntimeModelInitialStateRequestInput,
  type RuntimeModelInstance,
  type RuntimeSnapshotDto,
  type RuntimeSnapshotValidationMode
} from "@private-2d-rigging-lab/runtime-core";

import {
  createRuntimeExportRuntimeGraph,
  type RuntimeExportRuntimeGraphAdapterInput,
  type RuntimeExportRuntimeGraphAdapterResult
} from "./runtime-export-runtime-graph-adapter";
import type {
  RuntimePlayerRuntimeCoreProfilingMode
} from "../../preload/performance-diagnostics-contract";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";

export interface RuntimeExportPoseEvaluation {
  readonly adapter: RuntimeExportRuntimeGraphAdapterResult;
  readonly initialState: RuntimeStateDto;
  readonly snapshot: RuntimeSnapshotDto;
  readonly nextState: RuntimeStateDto;
  readonly evaluationProfile: RuntimeExportPoseEvaluationProfile;
}

export interface RuntimeExportPoseEvaluationProfile {
  readonly runtimeCoreEvaluationDurationMs: number;
  readonly runtimeCoreProfile?: RuntimeCoreEvaluationProfile;
  readonly compiledEvaluatorFrameCount: number;
  readonly transientCompileCount: number;
  readonly transientInstanceCount: number;
}

export type RuntimeExportPoseEvaluationOptions = {
  readonly authoredParameterValues?: Readonly<Record<string, number>>;
  readonly frameIndex?: number;
  readonly deltaTimeMs?: number;
  readonly previousState?: RuntimeStateDto;
  readonly resetReasons?: readonly RuntimeResetReason[];
  readonly activeVariantSelection?: RuntimePlayerActiveVariantSelectionState | null;
  readonly adapter?: RuntimeExportRuntimeGraphAdapterResult;
  readonly compiledRuntimeModel?: CompiledRuntimeModel;
  readonly runtimeModelInstance?: RuntimeModelInstance;
  readonly snapshotValidation?: RuntimeSnapshotValidationMode;
  readonly runtimeCoreProfiling?: RuntimePlayerRuntimeCoreProfilingMode;
};

export function evaluateRuntimeExportPose(
  input: RuntimeExportRuntimeGraphAdapterInput,
  options: RuntimeExportPoseEvaluationOptions = {}
): RuntimeExportPoseEvaluation {
  const adapter = options.adapter ?? createRuntimeExportRuntimeGraph({
    ...input,
    activeVariantSelection: options.activeVariantSelection ?? null
  });
  const frameIndex = options.frameIndex ?? 0;
  const frameResetReasons = createRuntimeExportPoseFrameResetReasons(options);
  const authoredParameterValues = { ...(options.authoredParameterValues ?? {}) };
  const transientCompileCount =
    options.runtimeModelInstance === undefined &&
      options.compiledRuntimeModel === undefined
      ? 1
      : 0;
  const transientInstanceCount =
    options.runtimeModelInstance === undefined ? 1 : 0;
  const runtimeModelInstance = options.runtimeModelInstance ??
    createRuntimeModelInstance({
      compiledRuntimeModel: options.compiledRuntimeModel ??
        compileRuntimeModel(adapter.graph),
      ...(options.previousState === undefined
        ? {}
        : { previousState: options.previousState }),
      initialStateRequest: createRuntimeExportRuntimeModelInitialStateRequest(
        input,
        options
      )
    });
  const initialState = runtimeModelInstance.getState();
  const runtimeCoreStartedAtMs = readCurrentTimeMs();
  const result = runtimeModelInstance.evaluateFrame(
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex,
      deltaTimeMs: options.deltaTimeMs ?? 0,
      resetReasons: frameResetReasons,
      authoredParameterValues,
      targetIds: []
    },
    {
      evaluationOptions: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full"
      },
      context: {
        source: {
          surface: "viewer"
        },
        policy: {
          strictness: "interactive"
        }
      },
      ...(options.runtimeCoreProfiling === "deep"
        ? { profilingOptions: { enabled: true } }
        : {}),
      controlOptions: {
        snapshotValidation: options.snapshotValidation ?? "skip"
      }
    }
  );
  const runtimeCoreEvaluationDurationMs = Math.max(
    0,
    readCurrentTimeMs() - runtimeCoreStartedAtMs
  );

  return {
    adapter,
    initialState,
    snapshot: result.snapshot,
    nextState: result.nextState,
    evaluationProfile: {
      runtimeCoreEvaluationDurationMs,
      compiledEvaluatorFrameCount: 1,
      transientCompileCount,
      transientInstanceCount,
      ...(result.profile === undefined
        ? {}
        : {
            runtimeCoreProfile: {
              ...result.profile,
              runtimeCoreEvaluationDurationMs
            }
          })
    }
  };
}

export function createRuntimeExportRuntimeModelInitialStateRequest(
  input: RuntimeExportRuntimeGraphAdapterInput,
  options: Pick<
    RuntimeExportPoseEvaluationOptions,
    "authoredParameterValues" | "frameIndex" | "resetReasons"
  > = {}
): RuntimeModelInitialStateRequestInput {
  const frameResetReasons = createRuntimeExportPoseFrameResetReasons(options);
  const initialResetReasons = frameResetReasons.length === 0
    ? ["packageLoad"]
    : frameResetReasons;

  return {
    frameIndex: options.frameIndex ?? 0,
    fixedStepMs: input.model.dynamicsSolver.fixedStepMs,
    authoredParameterValues: { ...(options.authoredParameterValues ?? {}) },
    resetReasons: initialResetReasons
  };
}

function createRuntimeModelInstance(input: {
  readonly compiledRuntimeModel: CompiledRuntimeModel;
  readonly previousState?: RuntimeStateDto;
  readonly initialStateRequest: RuntimeModelInitialStateRequestInput;
}): RuntimeModelInstance {
  if (input.previousState !== undefined) {
    return input.compiledRuntimeModel.createInstance({
      initialState: input.previousState
    });
  }

  return input.compiledRuntimeModel.createInstance({
    initialStateRequest: input.initialStateRequest
  });
}

function createRuntimeExportPoseFrameResetReasons(
  options: Pick<RuntimeExportPoseEvaluationOptions, "resetReasons">
): RuntimeResetReason[] {
  return options.resetReasons === undefined
    ? ["packageLoad"]
    : [...options.resetReasons];
}

function readCurrentTimeMs(): number {
  return typeof performance === "undefined"
    ? Date.now()
    : performance.now();
}
