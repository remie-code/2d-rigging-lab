import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DiagnosticDto, OperationId, TargetRefDto } from "@private-2d-rigging-lab/contracts";

import type { OperationPreconditionResultDto } from "./operation-precondition.js";
import { OperationRequestSchema } from "./operation-request.js";
import type { OperationRequestDto } from "./operation-request.js";
import { OperationResultSchema } from "./operation-result.js";
import type { OperationResultDto } from "./operation-result.js";
import { resolveOperationId } from "./operation-ids.js";

export interface PreparedOperationRequest {
  readonly request: OperationRequestDto;
  readonly operationId: OperationId;
}

export const prepareOperationRequest = (
  session: AuthoringSession,
  requestInput: unknown,
  expectedDryRun: boolean
): PreparedOperationRequest | OperationResultDto => {
  const parsed = OperationRequestSchema.safeParse(requestInput);

  if (!parsed.success) {
    return createRejectedOperationResult({
      operationId: "op_rejected_invalid_request" as OperationId,
      diagnostics: [
        createOperationDiagnostic({
          checkId: "operation.request.invalid",
          message: parsed.error.issues.map((issue) => issue.message).join("; "),
          target: { kind: "operation", id: "op_rejected_invalid_request" }
        })
      ]
    });
  }

  const request = parsed.data;
  const operationId = resolveOperationId(request);
  const diagnostics: DiagnosticDto[] = [];

  if (request.dryRun !== expectedDryRun) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.request.lifecycleMode",
        message: expectedDryRun
          ? "dryRunOperation requires request.dryRun=true"
          : "commitOperation requires request.dryRun=false",
        target: { kind: "operation", id: operationId }
      })
    );
  }

  if (request.basePackageRevision !== session.packageRevision) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.request.baseRevision",
        message: `Base package revision ${request.basePackageRevision} does not match session package revision ${session.packageRevision}.`,
        target: { kind: "package", id: session.packageIdentity.packageId }
      })
    );
  }

  if (diagnostics.length > 0) {
    return createRejectedOperationResult({ operationId, diagnostics });
  }

  return { request, operationId };
};

export const createPreconditionResult = (
  diagnostics: readonly DiagnosticDto[],
  checkedTargetRefs: readonly TargetRefDto[] = []
): OperationPreconditionResultDto => ({
  ok: diagnostics.length === 0,
  diagnostics: [...diagnostics],
  checkedTargetRefs: [...checkedTargetRefs]
});

export const createRejectedOperationResult = (input: {
  readonly operationId: OperationId;
  readonly diagnostics: readonly DiagnosticDto[];
}): OperationResultDto =>
  OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: "rejected",
    precondition: {
      ok: false,
      diagnostics: input.diagnostics
    },
    diagnostics: input.diagnostics,
    reversible: false
  });

export const createOperationDiagnostic = (input: {
  readonly checkId: string;
  readonly message: string;
  readonly target: TargetRefDto;
  readonly severity?: DiagnosticDto["severity"];
  readonly evidence?: readonly string[];
}): DiagnosticDto => ({
  checkId: input.checkId as DiagnosticDto["checkId"],
  status: "fail",
  severity: input.severity ?? "error",
  phase: "operation.precondition",
  target: input.target,
  message: input.message,
  evidence: [...(input.evidence ?? [])],
  relatedAC: [],
  relatedScenarios: [],
  repairCandidateIds: []
});
