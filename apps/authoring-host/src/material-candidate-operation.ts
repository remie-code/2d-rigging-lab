import { cloneAuthoringSession, guardMaterialCandidateOperation } from "@private-2d-rigging-lab/authoring-core";
import { createOperationCore, serializeOperationLogEntriesToJsonl, type OperationRequestDto } from "@private-2d-rigging-lab/operation-core";
import type { LoadedMaterialCandidate } from "./material-candidate-store.js";
import { MaterialHostError } from "./material-host-error.js";
export const runMaterialCandidateOperation = (loaded: LoadedMaterialCandidate, request: OperationRequestDto, now: () => Date) => {
  if (!loaded.workingPackage) throw new MaterialHostError("missing-working-package", "Build a working package first.");
  const before = loaded.workingPackage.session, session = cloneAuthoringSession(before);
  const core = createOperationCore({ now, initialOperationLogEntries: loaded.workingPackage.operationLogEntries });
  const result = core.commitOperation(session, request).result;
  if (result.status !== "committed") return { status: "rejected" as const, diagnostics: result.diagnostics };
  const guard = guardMaterialCandidateOperation(before, session, loaded.candidate.intent.drawableId);
  if (!guard.allowed) return { status: "rejected" as const, diagnostics: guard.diagnostics, impact: guard.impact };
  return { status: "completed" as const, session, diagnostics: guard.diagnostics, impact: guard.impact, logText: serializeOperationLogEntriesToJsonl(core.operationLog.entries) };
};
