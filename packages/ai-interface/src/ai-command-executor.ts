import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import { CheckIdSchema, OperationIdSchema } from "@private-2d-rigging-lab/contracts";
import type { OperationRequestDto, OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import { OperationResultSchema } from "@private-2d-rigging-lab/operation-core";

import type { AiCapability } from "./ai-capability.js";
import { InMemoryAiApprovalPolicy } from "./ai-approval-policy.js";
import type { AiApprovalPolicy } from "./ai-approval-policy.js";
import { AiCommandRequestSchema } from "./ai-command-request.js";
import type { AiCommandRequest } from "./ai-command-request.js";
import { AiCommandResponseSchema } from "./ai-command-response.js";
import type { AiCommandResponse, AiCommandStatus } from "./ai-command-response.js";
import {
  InMemoryAiCommandTranscript,
  appendAiApprovalToTranscript,
  appendAiCommandResponseToTranscript
} from "./ai-command-transcript.js";
import type { AiCommandTranscript } from "./ai-command-transcript.js";
import type { AiOperationCommandHost } from "./ai-command-host.js";

type DryRunCommandRequest = Extract<AiCommandRequest, { command: "dryRunOperation" }>;
type CommitCommandRequest = Extract<AiCommandRequest, { command: "commitOperation" }>;

export interface AiCommandExecutorOptions {
  readonly host: AiOperationCommandHost;
  readonly approvalPolicy?: AiApprovalPolicy;
  readonly transcript?: AiCommandTranscript;
}

export class AiCommandExecutor {
  readonly #host: AiOperationCommandHost;
  readonly #approvalPolicy: AiApprovalPolicy;
  readonly #transcript: AiCommandTranscript;

  constructor(options: AiCommandExecutorOptions) {
    this.#host = options.host;
    this.#transcript = options.transcript ?? new InMemoryAiCommandTranscript();
    this.#approvalPolicy = new TranscriptingAiApprovalPolicy(
      options.approvalPolicy ?? new InMemoryAiApprovalPolicy(),
      this.#transcript
    );
  }

  get approvalPolicy(): AiApprovalPolicy {
    return this.#approvalPolicy;
  }

  get transcript(): AiCommandTranscript {
    return this.#transcript;
  }

  async execute(input: unknown): Promise<AiCommandResponse> {
    const request = AiCommandRequestSchema.parse(input);

    switch (request.command) {
      case "dryRunOperation":
        return this.#executeDryRun(request);
      case "commitOperation":
        return this.#executeCommit(request);
      case "getEditorState":
      case "getOperationLog":
        return this.#unsupportedReadCommand(request);
    }
  }

  async #executeDryRun(request: DryRunCommandRequest): Promise<AiCommandResponse> {
    if (!hasCapability(request, "dryRunEdit")) {
      return this.#operationResponse({
        request,
        status: "permission_denied",
        operationResult: createRejectedOperationResult({
          request,
          operation: request.payload,
          checkId: "ai.permissionDenied",
          message: "dryRunOperation requires the dryRunEdit capability."
        })
      });
    }

    const operationResult = OperationResultSchema.parse(await this.#host.dryRunOperation(request.payload));
    this.#approvalPolicy.recordDryRun({
      dryRunCommandId: request.commandId,
      agentId: request.session.agentId,
      operationId: operationResult.operationId
    });

    return this.#operationResponse({
      request,
      status: operationResult.status === "rejected" ? "rejected" : "ok",
      operationResult
    });
  }

  async #executeCommit(request: CommitCommandRequest): Promise<AiCommandResponse> {
    if (!hasCapability(request, "commitWithApproval")) {
      return this.#operationResponse({
        request,
        status: "permission_denied",
        operationResult: createRejectedOperationResult({
          request,
          operation: request.payload.operation,
          checkId: "ai.permissionDenied",
          message: "commitOperation requires the commitWithApproval capability."
        })
      });
    }

    const approvalCheck = this.#approvalPolicy.checkCommitApproval({
      approvedDryRunCommandId: request.payload.approvedDryRunCommandId,
      agentId: request.session.agentId,
      ...(request.payload.operation.operationId === undefined
        ? {}
        : { operationId: request.payload.operation.operationId })
    });
    if (approvalCheck.status !== "approved") {
      return this.#operationResponse({
        request,
        status: approvalCheck.status,
        operationResult: createRejectedOperationResult({
          request,
          operation: request.payload.operation,
          checkId: approvalCheck.status === "needs_approval" ? "ai.approvalRequired" : "ai.approvalRejected",
          message: approvalCheck.reason ?? "Commit operation is not approved."
        })
      });
    }

    const operationResult = OperationResultSchema.parse(await this.#host.commitOperation(request.payload.operation));

    return this.#operationResponse({
      request,
      status: operationResult.status === "rejected" ? "rejected" : "ok",
      operationResult,
      includeOperationLogRef: operationResult.status === "committed"
    });
  }

  #unsupportedReadCommand(request: Extract<AiCommandRequest, { command: "getEditorState" | "getOperationLog" }>): AiCommandResponse {
    const response = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: request.commandId,
      status: "not_implemented",
      evidenceRefs: [],
      command: request.command,
      payload:
        request.command === "getEditorState"
          ? { editorState: { schemaVersion: "editor-semantic-state-v1" } }
          : { entries: [] }
    });

    appendAiCommandResponseToTranscript({
      transcript: this.#transcript,
      request,
      response
    });

    return response;
  }

  #operationResponse(input: {
    readonly request: DryRunCommandRequest | CommitCommandRequest;
    readonly status: AiCommandStatus;
    readonly operationResult: OperationResultDto;
    readonly includeOperationLogRef?: boolean;
  }): AiCommandResponse {
    const evidenceRefs = collectOperationEvidenceRefs(input.operationResult, input.includeOperationLogRef === true);
    const response = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: input.request.commandId,
      status: input.status,
      diagnostics: input.operationResult.diagnostics,
      modelDiff: input.operationResult.modelDiff,
      runtimeDiff: input.operationResult.runtimeDiff,
      validationDiff: input.operationResult.validationDiff,
      operationResult: input.operationResult,
      evidenceRefs,
      command: input.request.command,
      payload: {
        operationResult: input.operationResult
      }
    });

    appendAiCommandResponseToTranscript({
      transcript: this.#transcript,
      request: input.request,
      response,
      operationId: input.operationResult.operationId
    });

    return response;
  }
}

export const executeAiCommand = (input: unknown, options: AiCommandExecutorOptions): Promise<AiCommandResponse> =>
  new AiCommandExecutor(options).execute(input);

const hasCapability = (request: AiCommandRequest, capability: AiCapability): boolean =>
  request.session.capabilities.includes(capability);

class TranscriptingAiApprovalPolicy implements AiApprovalPolicy {
  readonly #policy: AiApprovalPolicy;
  readonly #transcript: AiCommandTranscript;

  constructor(policy: AiApprovalPolicy, transcript: AiCommandTranscript) {
    this.#policy = policy;
    this.#transcript = transcript;
  }

  recordDryRun(input: {
    readonly dryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
  }): void {
    this.#policy.recordDryRun(input);
  }

  approveDryRunCommand(input: {
    readonly dryRunCommandId: string;
    readonly operationId?: string;
  }) {
    const record = this.#policy.approveDryRunCommand(input);
    appendAiApprovalToTranscript({
      transcript: this.#transcript,
      record
    });

    return record;
  }

  checkCommitApproval(input: {
    readonly approvedDryRunCommandId: string;
    readonly agentId: string;
    readonly operationId?: string;
  }) {
    return this.#policy.checkCommitApproval(input);
  }
}

const createRejectedOperationResult = (input: {
  readonly request: DryRunCommandRequest | CommitCommandRequest;
  readonly operation: OperationRequestDto;
  readonly checkId: string;
  readonly message: string;
}): OperationResultDto => {
  const operationId = OperationIdSchema.parse(input.operation.operationId ?? createSyntheticOperationId(input.request.commandId));
  const diagnostic: DiagnosticDto = {
    checkId: CheckIdSchema.parse(input.checkId),
    status: "fail",
    severity: "error",
    phase: "ai-command-executor",
    target: {
      kind: "operation",
      id: operationId
    },
    message: input.message,
    evidence: [],
    relatedAC: input.request.basis.relatedAC,
    relatedScenarios: input.request.basis.relatedScenarios,
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

const createSyntheticOperationId = (commandId: string): string =>
  `op_ai_${commandId.replace(/[^A-Za-z0-9_-]/g, "_")}`;

const collectOperationEvidenceRefs = (
  operationResult: OperationResultDto,
  includeOperationLogRef: boolean
): string[] => {
  const refs = [
    ...operationResult.generatedRuntimeStateRefs,
    ...operationResult.generatedRuntimeStateSequenceRefs,
    ...operationResult.generatedRuntimeSnapshotIds.map(
      (snapshotId) => `runtime/snapshots/${snapshotId}.runtime-snapshot.json`
    ),
    ...operationResult.generatedValidationReportIds.map(
      (reportId) => `validation/reports/${reportId}.validation-report.json`
    )
  ];

  if (includeOperationLogRef) {
    refs.push(`operations/log.jsonl#${operationResult.operationId}`);
  }

  return refs;
};
