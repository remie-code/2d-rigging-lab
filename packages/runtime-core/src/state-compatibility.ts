import type { DiagnosticDto, RuntimeStateDto } from "@private-2d-rigging-lab/contracts";

import { createRuntimeDiagnostic } from "./diagnostics.js";
import { createResetDynamicsStateFromGraph } from "./dynamics-evaluation.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import type { RuntimeEvaluationInputDto } from "./runtime-input.js";

export interface CompatibleRuntimeStateResult {
  readonly state: RuntimeStateDto;
  readonly diagnostics: readonly DiagnosticDto[];
}

export const createCompatibleRuntimeState = (
  graph: NormalizedRuntimeGraph,
  previousState: RuntimeStateDto,
  input: RuntimeEvaluationInputDto
): CompatibleRuntimeStateResult => {
  const diagnostics: DiagnosticDto[] = [];
  const dynamicsGroups: RuntimeStateDto["dynamicsGroups"] = {};

  if (graph.packageHash !== undefined && previousState.packageHash !== undefined) {
    if (graph.packageHash !== previousState.packageHash) {
      diagnostics.push(createStatePackageMismatchDiagnostic(graph.packageId));
    }
  } else if (graph.packageId !== previousState.packageId || graph.packageRevision !== previousState.packageRevision) {
    diagnostics.push(createStatePackageMismatchDiagnostic(graph.packageId));
  } else {
    diagnostics.push(
      createRuntimeDiagnostic({
        checkId: "runtime.statePackageHashUnavailable",
        severity: "info",
        phase: "runtime_state_compatibility",
        target: { kind: "package", id: graph.packageId },
        message: "Package hash is unavailable; runtime state compatibility used packageId and packageRevision.",
        evidence: [`packageId=${graph.packageId}`, `packageRevision=${graph.packageRevision}`]
      })
    );
  }

  for (const group of graph.dynamicsGroups.values()) {
    if (!group.enabled) {
      continue;
    }

    const existing = previousState.dynamicsGroups[group.dynamicsGroupId];
    if (existing === undefined) {
      diagnostics.push(
        createRuntimeDiagnostic({
          checkId: "runtime.stateMissingDynamicsGroup",
          severity: "warning",
          phase: "runtime_state_compatibility",
          target: { kind: "dynamicsGroup", id: group.dynamicsGroupId },
          message: "Previous runtime state is missing an active dynamics group; initialized the group for this frame."
        })
      );
      // §3.4: initialize the missing group's chain straight below the current anchor pin.
      dynamicsGroups[group.dynamicsGroupId] = createResetDynamicsStateFromGraph(
        graph,
        group,
        input.authoredParameterValues,
        0,
        true
      );
      continue;
    }

    dynamicsGroups[group.dynamicsGroupId] = existing;
  }

  for (const dynamicsGroupId of Object.keys(previousState.dynamicsGroups)) {
    if (!graph.dynamicsGroups.has(dynamicsGroupId as never)) {
      diagnostics.push(
        createRuntimeDiagnostic({
          checkId: "runtime.stateUnknownDynamicsGroup",
          severity: "warning",
          phase: "runtime_state_compatibility",
          target: { kind: "dynamicsGroup", id: dynamicsGroupId },
          message: "Previous runtime state contains a dynamics group that is not present in the graph; ignored it."
        })
      );
    }
  }

  return {
    state: {
      ...previousState,
      dynamicsGroups
    },
    diagnostics
  };
};

const createStatePackageMismatchDiagnostic = (packageId: string): DiagnosticDto =>
  createRuntimeDiagnostic({
    checkId: "runtime.statePackageMismatch",
    severity: "error",
    phase: "runtime_state_compatibility",
    target: { kind: "package", id: packageId },
    message: "Runtime state package identity does not match the normalized runtime graph."
  });
