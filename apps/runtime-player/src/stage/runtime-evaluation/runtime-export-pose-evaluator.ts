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
  type RuntimeRenderFrame,
  type RuntimeSnapshotDto,
  type RuntimeSnapshotValidationMode
} from "@private-2d-rigging-lab/runtime-core";

import {
  createRuntimeExportRuntimeGraph,
  type RuntimeExportRuntimeGraphAdapterInput,
  type RuntimeExportRuntimeGraphAdapterResult
} from "./runtime-export-runtime-graph-adapter";
import type {
  RuntimePlayerActiveVariantSelectionState
} from "../../preload/runtime-variant-bridge-contract";
import type {
  RuntimePlayerEffectiveDynamicsTuningProfile
} from "../../preload/dynamics-tuning-bridge-contract";

export interface RuntimeExportPoseEvaluation {
  readonly adapter: RuntimeExportRuntimeGraphAdapterResult;
  readonly initialState: RuntimeStateDto;
  readonly snapshot: RuntimeSnapshotDto;
  readonly nextState: RuntimeStateDto;
  readonly evaluationProfile: RuntimeExportPoseEvaluationProfile;
}

export interface RuntimeExportRenderFrameEvaluation {
  readonly adapter: RuntimeExportRuntimeGraphAdapterResult;
  readonly initialState: RuntimeStateDto;
  readonly renderFrame: RuntimeRenderFrame;
  readonly nextState: RuntimeStateDto;
  readonly evaluationProfile: RuntimeExportPoseEvaluationProfile;
}

export interface RuntimeExportPoseEvaluationProfile {
  readonly runtimeCoreEvaluationDurationMs: number;
  readonly runtimeCoreProfile?: RuntimeCoreEvaluationProfile;
  readonly compiledEvaluatorFrameCount: number;
  readonly compiledRenderFrameCount: number;
  readonly publicSnapshotMaterializationCount: number;
  readonly transientCompileCount: number;
  readonly transientInstanceCount: number;
}

type RuntimeExportRuntimeCoreProfilingMode = "disabled" | "deep";

export type RuntimeExportPoseEvaluationOptions = {
  readonly authoredParameterValues?: Readonly<Record<string, number>>;
  readonly frameIndex?: number;
  readonly deltaTimeMs?: number;
  readonly previousState?: RuntimeStateDto;
  readonly resetReasons?: readonly RuntimeResetReason[];
  readonly activeVariantSelection?: RuntimePlayerActiveVariantSelectionState | null;
  readonly effectiveDynamicsTuning?: RuntimePlayerEffectiveDynamicsTuningProfile | null;
  readonly adapter?: RuntimeExportRuntimeGraphAdapterResult;
  readonly compiledRuntimeModel?: CompiledRuntimeModel;
  readonly runtimeModelInstance?: RuntimeModelInstance;
  readonly snapshotValidation?: RuntimeSnapshotValidationMode;
  readonly runtimeCoreProfiling?: RuntimeExportRuntimeCoreProfilingMode;
};

export function evaluateRuntimeExportPose(
  input: RuntimeExportRuntimeGraphAdapterInput,
  options: RuntimeExportPoseEvaluationOptions = {}
): RuntimeExportPoseEvaluation {
  const runtime = createRuntimeExportPoseEvaluationRuntime(input, options);
  const runtimeCoreStartedAtMs = readCurrentTimeMs();
  const result = runtime.runtimeModelInstance.evaluateFrame(
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: runtime.frameIndex,
      deltaTimeMs: options.deltaTimeMs ?? 0,
      resetReasons: runtime.frameResetReasons,
      authoredParameterValues: runtime.authoredParameterValues,
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
    adapter: runtime.adapter,
    initialState: runtime.initialState,
    snapshot: result.snapshot,
    nextState: result.nextState,
    evaluationProfile: createRuntimeExportPoseEvaluationProfile({
      runtimeCoreEvaluationDurationMs,
      ...(result.profile === undefined
        ? {}
        : { runtimeCoreProfile: result.profile }),
      compiledRenderFrameCount: 0,
      publicSnapshotMaterializationCount: 1,
      transientCompileCount: runtime.transientCompileCount,
      transientInstanceCount: runtime.transientInstanceCount
    })
  };
}

export function evaluateRuntimeExportRenderFrame(
  input: RuntimeExportRuntimeGraphAdapterInput,
  options: RuntimeExportPoseEvaluationOptions = {}
): RuntimeExportRenderFrameEvaluation {
  const runtime = createRuntimeExportPoseEvaluationRuntime(input, options);
  const runtimeCoreStartedAtMs = readCurrentTimeMs();
  const result = runtime.runtimeModelInstance.evaluateRenderFrame(
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: runtime.frameIndex,
      deltaTimeMs: options.deltaTimeMs ?? 0,
      resetReasons: runtime.frameResetReasons,
      authoredParameterValues: runtime.authoredParameterValues,
      targetIds: []
    },
    {
      evaluationOptions: defaultRuntimeEvaluationOptions(),
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
    adapter: runtime.adapter,
    initialState: runtime.initialState,
    renderFrame: result.frame,
    nextState: result.nextState,
    evaluationProfile: createRuntimeExportPoseEvaluationProfile({
      runtimeCoreEvaluationDurationMs,
      ...(result.profile === undefined
        ? {}
        : { runtimeCoreProfile: result.profile }),
      compiledRenderFrameCount: 1,
      publicSnapshotMaterializationCount: 0,
      transientCompileCount: runtime.transientCompileCount,
      transientInstanceCount: runtime.transientInstanceCount
    })
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
  const initialResetReasons: RuntimeResetReason[] = frameResetReasons.length === 0
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

function createRuntimeExportPoseEvaluationRuntime(
  input: RuntimeExportRuntimeGraphAdapterInput,
  options: RuntimeExportPoseEvaluationOptions
): {
  readonly adapter: RuntimeExportRuntimeGraphAdapterResult;
  readonly frameIndex: number;
  readonly frameResetReasons: RuntimeResetReason[];
  readonly authoredParameterValues: Readonly<Record<string, number>>;
  readonly runtimeModelInstance: RuntimeModelInstance;
  readonly initialState: RuntimeStateDto;
  readonly transientCompileCount: number;
  readonly transientInstanceCount: number;
} {
  const adapter = options.adapter ?? createRuntimeExportRuntimeGraph({
    ...input,
    activeVariantSelection: options.activeVariantSelection ?? null,
    effectiveDynamicsTuning: options.effectiveDynamicsTuning ?? null
  });
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

  return {
    adapter,
    frameIndex: options.frameIndex ?? 0,
    frameResetReasons: createRuntimeExportPoseFrameResetReasons(options),
    authoredParameterValues: { ...(options.authoredParameterValues ?? {}) },
    runtimeModelInstance,
    initialState: runtimeModelInstance.getState(),
    transientCompileCount,
    transientInstanceCount
  };
}

function createRuntimeExportPoseEvaluationProfile(input: {
  readonly runtimeCoreEvaluationDurationMs: number;
  readonly runtimeCoreProfile?: RuntimeCoreEvaluationProfile;
  readonly compiledRenderFrameCount: number;
  readonly publicSnapshotMaterializationCount: number;
  readonly transientCompileCount: number;
  readonly transientInstanceCount: number;
}): RuntimeExportPoseEvaluationProfile {
  return {
    runtimeCoreEvaluationDurationMs: input.runtimeCoreEvaluationDurationMs,
    compiledEvaluatorFrameCount: 1,
    compiledRenderFrameCount: input.compiledRenderFrameCount,
    publicSnapshotMaterializationCount:
      input.publicSnapshotMaterializationCount,
    transientCompileCount: input.transientCompileCount,
    transientInstanceCount: input.transientInstanceCount,
    ...(input.runtimeCoreProfile === undefined
      ? {}
      : {
          runtimeCoreProfile: {
            ...input.runtimeCoreProfile,
            runtimeCoreEvaluationDurationMs:
              input.runtimeCoreEvaluationDurationMs
          }
        })
  };
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
