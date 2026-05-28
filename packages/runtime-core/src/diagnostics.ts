import type { DiagnosticDto, Severity, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import { DiagnosticSchema } from "@private-2d-rigging-lab/contracts";

export const createRuntimeDiagnostic = (input: {
  readonly checkId: string;
  readonly severity: Severity;
  readonly phase: string;
  readonly target: TargetRefDto;
  readonly message: string;
  readonly evidence?: readonly string[];
}): DiagnosticDto =>
  DiagnosticSchema.parse({
    checkId: input.checkId,
    status: input.severity === "info" ? "needs_review" : "warning",
    severity: input.severity,
    phase: input.phase,
    target: input.target,
    message: input.message,
    evidence: [...(input.evidence ?? [])]
  });
