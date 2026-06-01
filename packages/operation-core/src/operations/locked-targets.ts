import type { DiagnosticDto, TargetRefDto } from "@private-2d-rigging-lab/contracts";

import { createOperationDiagnostic } from "../preconditions.js";

export const createLockedTargetDiagnostics = (input: {
  readonly operationType: string;
  readonly lockedTargetIds: readonly string[];
  readonly targets: readonly TargetRefDto[];
}): DiagnosticDto[] => {
  if (input.lockedTargetIds.length === 0) {
    return [];
  }

  const lockedIds = new Set(input.lockedTargetIds);
  return input.targets
    .filter((target) => lockedIds.has(target.id))
    .map((target) =>
      createOperationDiagnostic({
        checkId: `operation.${input.operationType}.lockedTarget`,
        message: `Target is locked and cannot be edited by ${input.operationType}: ${target.kind}:${target.id}.`,
        target
      })
    );
};
