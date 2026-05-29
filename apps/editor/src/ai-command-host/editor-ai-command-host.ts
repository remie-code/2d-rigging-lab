import {
  AiCommandExecutor,
  AiCommandRequestSchema,
  InMemoryAiApprovalPolicy,
  appendAiCommandResponseToTranscript,
  executeAiReadCommand,
  type AiApprovalPolicy,
  type AiCommandResponse,
  type AiCommandTranscript,
  type AiOperationCommandHost,
  type AiReadCommandHost
} from "@private-2d-rigging-lab/ai-interface";

import {
  createRejectedEditorAiOperationProvenanceResponse,
  isEditorAiOperationRequest
} from "./editor-ai-operation-provenance.js";

export interface EditorAiCommandHost {
  readonly approvalPolicy: AiApprovalPolicy;
  readonly transcript: AiCommandTranscript;
  execute(input: unknown): Promise<AiCommandResponse>;
}

export interface EditorAiCommandHostOptions {
  readonly operationHost: AiOperationCommandHost;
  readonly readHost: AiReadCommandHost;
  readonly approvalPolicy?: AiApprovalPolicy;
  readonly transcript?: AiCommandTranscript;
}

export const createEditorAiCommandHost = (
  options: EditorAiCommandHostOptions
): EditorAiCommandHost => {
  const approvalPolicy = options.approvalPolicy ?? new InMemoryAiApprovalPolicy();
  const operationExecutor = new AiCommandExecutor({
    host: options.operationHost,
    approvalPolicy,
    ...(options.transcript === undefined ? {} : { transcript: options.transcript })
  });

  return {
    get approvalPolicy() {
      return operationExecutor.approvalPolicy;
    },
    get transcript() {
      return operationExecutor.transcript;
    },
    async execute(input) {
      const request = AiCommandRequestSchema.parse(input);

      if (
        request.command === "getEditorState" ||
        request.command === "inspectModel" ||
        request.command === "inspectTarget" ||
        request.command === "validatePackage" ||
        request.command === "getOperationLog"
      ) {
        return executeAiReadCommand(request, options.readHost, operationExecutor.transcript);
      }

      const operation = request.command === "dryRunOperation" ? request.payload : request.payload.operation;
      if (!isEditorAiOperationRequest(operation)) {
        const response = createRejectedEditorAiOperationProvenanceResponse(request);
        appendAiCommandResponseToTranscript({
          transcript: operationExecutor.transcript,
          request,
          response
        });

        return response;
      }

      return operationExecutor.execute(request);
    }
  };
};
