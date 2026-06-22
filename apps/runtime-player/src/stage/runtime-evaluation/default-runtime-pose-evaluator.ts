import type { RuntimeStateDto } from "@private-2d-rigging-lab/contracts";
import {
  createInitialRuntimeState,
  defaultRuntimeEvaluationOptions,
  evaluateRuntimeFrame,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import {
  createRuntimeExportRuntimeGraph,
  type RuntimeExportRuntimeGraphAdapterInput,
  type RuntimeExportRuntimeGraphAdapterResult
} from "./runtime-export-runtime-graph-adapter";

export interface RuntimeExportDefaultPoseEvaluation {
  readonly adapter: RuntimeExportRuntimeGraphAdapterResult;
  readonly initialState: RuntimeStateDto;
  readonly snapshot: RuntimeSnapshotDto;
  readonly nextState: RuntimeStateDto;
}

export function evaluateRuntimeExportDefaultPose(
  input: RuntimeExportRuntimeGraphAdapterInput
): RuntimeExportDefaultPoseEvaluation {
  const adapter = createRuntimeExportRuntimeGraph(input);
  const initialState = createInitialRuntimeState(adapter.graph, {
    packageId: adapter.graph.packageId,
    packageRevision: adapter.graph.packageRevision,
    ...(adapter.graph.packageHash === undefined ? {} : { packageHash: adapter.graph.packageHash }),
    frameIndex: 0,
    fixedStepMs: input.model.dynamicsSolver.fixedStepMs,
    authoredParameterValues: {},
    resetReasons: ["packageLoad"]
  });
  const result = evaluateRuntimeFrame(
    adapter.graph,
    {
      schemaVersion: "runtime-evaluation-input-v1",
      frameIndex: 0,
      deltaTimeMs: 0,
      resetReasons: ["packageLoad"],
      authoredParameterValues: {},
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
    }
  );

  return {
    adapter,
    initialState,
    snapshot: result.snapshot,
    nextState: result.nextState
  };
}
