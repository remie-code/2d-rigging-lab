import {
  AiCommandRequestSchema,
  type AiCommandRequest,
  type AiCommandResponse
} from "@private-2d-rigging-lab/ai-interface";
import { OperationRequestSchema, type OperationRequestDto } from "@private-2d-rigging-lab/operation-core";

export const editorAiApprovalAgentId = "agent_editor_visible_ai_approval";

export type AiDryRunOperationCommandRequest = Extract<
  AiCommandRequest,
  { readonly command: "dryRunOperation" }
>;
export type AiCommitOperationCommandRequest = Extract<
  AiCommandRequest,
  { readonly command: "commitOperation" }
>;

export interface PendingAiApprovalOperation {
  readonly dryRunCommandId: string;
  readonly operationId: string;
  readonly dryRunRequest: AiDryRunOperationCommandRequest;
  readonly commitRequest: AiCommitOperationCommandRequest;
  readonly dryRunResponse: AiCommandResponse;
  readonly approved: boolean;
}

export interface DeterministicAiCreateParameterCommandPair {
  readonly dryRunCommandId: string;
  readonly operationId: string;
  readonly dryRunRequest: AiDryRunOperationCommandRequest;
  readonly commitRequest: AiCommitOperationCommandRequest;
}

export const createDeterministicAiCreateParameterCommandPair = (input: {
  readonly basePackageRevision: number;
  readonly sequence: number;
}): DeterministicAiCreateParameterCommandPair => {
  const suffix = `r${input.basePackageRevision}_${input.sequence}`;
  const operationId = `op_editor_ai_create_parameter_${suffix}`;
  const dryRunCommandId = `cmd_editor_ai_dry_run_create_parameter_${suffix}`;
  const operation = createAiCreateParameterOperation({
    suffix,
    operationId,
    dryRun: true,
    basePackageRevision: input.basePackageRevision
  });

  return {
    dryRunCommandId,
    operationId,
    dryRunRequest: createAiDryRunCommandRequest({
      commandId: dryRunCommandId,
      packageRevision: input.basePackageRevision,
      payload: operation
    }),
    commitRequest: createAiCommitCommandRequest({
      commandId: `cmd_editor_ai_commit_create_parameter_${suffix}`,
      packageRevision: input.basePackageRevision,
      payload: {
        approvedDryRunCommandId: dryRunCommandId,
        operation: {
          ...operation,
          dryRun: false
        }
      }
    })
  };
};

export const createPendingAiApprovalOperation = (input: {
  readonly dryRunCommandId: string;
  readonly operationId: string;
  readonly dryRunRequest: AiDryRunOperationCommandRequest;
  readonly commitRequest: AiCommitOperationCommandRequest;
  readonly dryRunResponse: AiCommandResponse;
}): PendingAiApprovalOperation => ({
  ...input,
  approved: false
});

export const markPendingAiApprovalOperationApproved = (
  pending: PendingAiApprovalOperation
): PendingAiApprovalOperation => ({
  ...pending,
  approved: true
});

const createAiDryRunCommandRequest = (input: {
  readonly commandId: string;
  readonly packageRevision: number;
  readonly payload: OperationRequestDto;
}): AiDryRunOperationCommandRequest =>
  AiCommandRequestSchema.parse({
    schemaVersion: "ai-command-request-v1",
    commandId: input.commandId,
    session: {
      agentId: editorAiApprovalAgentId,
      capabilities: ["dryRunEdit"]
    },
    basis: {
      packageRevision: input.packageRevision,
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    command: "dryRunOperation",
    payload: input.payload
  }) as AiDryRunOperationCommandRequest;

const createAiCommitCommandRequest = (input: {
  readonly commandId: string;
  readonly packageRevision: number;
  readonly payload: {
    readonly approvedDryRunCommandId: string;
    readonly operation: OperationRequestDto;
  };
}): AiCommitOperationCommandRequest =>
  AiCommandRequestSchema.parse({
    schemaVersion: "ai-command-request-v1",
    commandId: input.commandId,
    session: {
      agentId: editorAiApprovalAgentId,
      capabilities: ["commitWithApproval"]
    },
    basis: {
      packageRevision: input.packageRevision,
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    command: "commitOperation",
    payload: input.payload
  }) as AiCommitOperationCommandRequest;

const createAiCreateParameterOperation = (input: {
  readonly suffix: string;
  readonly operationId: string;
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: input.operationId,
    actor: "ai",
    surface: "structuredApi",
    dryRun: input.dryRun,
    basePackageRevision: input.basePackageRevision,
    idempotencyKey: `editor-ai-create-parameter-${input.suffix}`,
    trace: {
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operationType: "createParameter",
    payload: {
      parameterId: `param_editor_ai_${input.suffix}`,
      displayName: "AI Approval Smile",
      semanticRole: "mouth",
      projectPresetAlias: "private-editor-ai-approval-smile-control",
      valueSource: "authoredInput",
      min: 0,
      max: 1,
      default: 0,
      recommendedUiStep: 0.01
    }
  });
