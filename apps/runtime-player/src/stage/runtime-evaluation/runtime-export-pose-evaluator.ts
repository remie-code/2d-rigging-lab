import type {
  RuntimeResetReason,
  RuntimeStateDto
} from "@private-2d-rigging-lab/contracts";
import {
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame,
  type RuntimeCoreEvaluationProfile,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import {
  createRuntimeExportRuntimeGraph,
  type RuntimeExportRuntimeGraphAdapterInput,
  type RuntimeExportRuntimeGraphAdapterResult
} from "./runtime-export-runtime-graph-adapter";
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
}

export type RuntimeExportPoseEvaluationOptions = {
  readonly authoredParameterValues?: Readonly<Record<string, number>>;
  readonly frameIndex?: number;
  readonly deltaTimeMs?: number;
  readonly previousState?: RuntimeStateDto;
  readonly resetReasons?: readonly RuntimeResetReason[];
  readonly activeVariantSelection?: RuntimePlayerActiveVariantSelectionState | null;
  readonly adapter?: RuntimeExportRuntimeGraphAdapterResult;
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
  const frameResetReasons: RuntimeResetReason[] = options.resetReasons === undefined
    ? ["packageLoad"]
    : [...options.resetReasons];
  const initialResetReasons: RuntimeResetReason[] = frameResetReasons.length === 0
    ? ["packageLoad"]
    : frameResetReasons;
  const authoredParameterValues = { ...(options.authoredParameterValues ?? {}) };
  const initialState = options.previousState ?? createInitialRuntimeState(
    adapter.graph,
    {
      packageId: adapter.graph.packageId,
      packageRevision: adapter.graph.packageRevision,
      ...(adapter.graph.packageHash === undefined ? {} : { packageHash: adapter.graph.packageHash }),
      frameIndex,
      fixedStepMs: input.model.dynamicsSolver.fixedStepMs,
      authoredParameterValues,
      resetReasons: initialResetReasons
    }
  );
  const runtimeCoreStartedAtMs = readCurrentTimeMs();
  const result = evaluateRuntimeFrame(
    adapter.graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex,
      deltaTimeMs: options.deltaTimeMs ?? 0,
      resetReasons: frameResetReasons,
      authoredParameterValues,
      targetIds: []
    },
    initialState,
    {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full"
    },
    {
      source: {
        surface: "viewer"
      },
      policy: {
        strictness: "interactive"
      }
    },
    {
      enabled: true
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

function readCurrentTimeMs(): number {
  return typeof performance === "undefined"
    ? Date.now()
    : performance.now();
}
