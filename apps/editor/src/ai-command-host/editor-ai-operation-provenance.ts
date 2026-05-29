import {
  AiCommandResponseSchema,
  type AiCommandRequest,
  type AiCommandResponse
} from "@private-2d-rigging-lab/ai-interface";
import { CheckIdSchema, OperationIdSchema, type DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import {
  OperationResultSchema,
  type OperationRequestDto,
  type OperationResultDto
} from "@private-2d-rigging-lab/operation-core";

type EditorAiOperationCommandRequest = Extract<
  AiCommandRequest,
  { readonly command: "dryRunOperation" | "commitOperation" }
>;

export const isEditorAiOperationRequest = (operation: OperationRequestDto): boolean =>
  operation.actor === "ai" && operation.surface === "structuredApi";

export const createRejectedEditorAiOperationProvenanceResponse = (
  request: EditorAiOperationCommandRequest
): AiCommandResponse => {
  const operation = selectOperationRequest(request);
  const operationResult = createRejectedProvenanceOperationResult(request, operation);

  return AiCommandResponseSchema.parse({
    schemaVersion: "ai-command-response-v1",
    commandId: request.commandId,
    status: "rejected",
    diagnostics: operationResult.diagnostics,
    operationResult,
    evidenceRefs: [],
    command: request.command,
    payload: {
      operationResult
    }
  });
};

const selectOperationRequest = (
  request: EditorAiOperationCommandRequest
): OperationRequestDto =>
  request.command === "dryRunOperation" ? request.payload : request.payload.operation;

const createRejectedProvenanceOperationResult = (
  request: EditorAiOperationCommandRequest,
  operation: OperationRequestDto
): OperationResultDto => {
  const operationId = OperationIdSchema.parse(
    operation.operationId ?? `op_ai_rejected_${request.commandId.replace(/[^A-Za-z0-9_-]/g, "_")}`
  );
  const diagnostic: DiagnosticDto = {
    checkId: CheckIdSchema.parse("ai.editor.invalidProvenance"),
    status: "fail",
    severity: "error",
    phase: "editor-ai-command-host",
    target: {
      kind: "operation",
      id: operationId
    },
    message: "Editor AI commands require operation actor=ai and surface=structuredApi.",
    evidence: [],
    relatedAC: request.basis.relatedAC,
    relatedScenarios: request.basis.relatedScenarios,
    repairCandidateIds: []
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId,
    status: "rejected",
    precondition: {
      ok: false,
      diagnostics: [diagnostic]
    },
    diagnostics: [diagnostic],
    reversible: false
  });
};
