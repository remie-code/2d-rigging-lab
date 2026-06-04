import {
  CodexProposalApprovalEvidenceResponseDtoSchema,
  CodexProposalApprovalRequestIdDtoSchema,
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalEvidenceRefDtoSchema,
  CodexProposalRerunValidationResultDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  OperationIdSchema,
  type CodexProposalApprovalEvidenceResponseDto,
  type CodexProposalApprovalRequestIdDto,
  type CodexProposalDiffPreviewResultDto,
  type CodexProposalEvidenceRefDto,
  type CodexProposalRerunValidationResultDto,
  type CodexProposalValidationResultDto,
  type CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import {
  OperationRequestSchema,
  OperationResultSchema,
  type OperationRequestDto,
  type OperationResultDto
} from "@private-2d-rigging-lab/operation-core";

import type { AiApprovalPolicy } from "./ai-approval-policy.js";
import type { AiCommandBasis, AiCommandSession } from "./ai-command-request.js";
import { AiCommandBasisSchema, AiCommandSessionSchema } from "./ai-command-request.js";
import type { AiCommandStatus } from "./ai-command-response.js";
import { appendAiApprovalToTranscript, type AiCommandTranscript } from "./ai-command-transcript.js";
import type { AiOperationCommandHost } from "./ai-command-host.js";

export interface RequestCodexProposalApprovalLifecycleInput {
  readonly commandId: string;
  readonly session: AiCommandSession;
  readonly basis: AiCommandBasis;
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly diffPreview: CodexProposalDiffPreviewResultDto;
  readonly rerunValidationResult?: CodexProposalRerunValidationResultDto | undefined;
  readonly approvalPolicy: AiApprovalPolicy;
  readonly transcript: AiCommandTranscript;
  readonly generatedAt?: string;
}

export interface ApproveCodexProposalLifecycleInput {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly approvalRequestId: CodexProposalApprovalRequestIdDto | string;
  readonly approvalPolicy: AiApprovalPolicy;
  readonly transcript: AiCommandTranscript;
  readonly generatedAt?: string;
}

export interface CommitApprovedCodexProposalLifecycleInput {
  readonly commandId: string;
  readonly session: AiCommandSession;
  readonly basis: AiCommandBasis;
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly diffPreview: CodexProposalDiffPreviewResultDto;
  readonly rerunValidationResult?: CodexProposalRerunValidationResultDto | undefined;
  readonly approvalRequestId: CodexProposalApprovalRequestIdDto | string;
  readonly approvalPolicy: AiApprovalPolicy;
  readonly transcript: AiCommandTranscript;
  readonly host: AiOperationCommandHost;
  readonly generatedAt?: string;
}

export interface CodexProposalCommitOperationSummary {
  readonly request: OperationRequestDto;
  readonly result: OperationResultDto;
}

export interface CommitApprovedCodexProposalLifecycleResult {
  readonly response: CodexProposalApprovalEvidenceResponseDto;
  readonly operationResults: readonly CodexProposalCommitOperationSummary[];
}

export const requestCodexProposalApproval = (
  input: RequestCodexProposalApprovalLifecycleInput
): CodexProposalApprovalEvidenceResponseDto => {
  const parsed = parseApprovalLifecycleInput(input);
  const approvalRequestId = createApprovalRequestId(parsed.proposal);
  const readiness = evaluateApprovalReadiness({
    proposal: parsed.proposal,
    validationResult: parsed.validationResult,
    diffPreview: parsed.diffPreview,
    ...(parsed.rerunValidationResult === undefined
      ? {}
      : { rerunValidationResult: parsed.rerunValidationResult })
  });
  const evidenceRefs = collectApprovalRequestEvidenceRefs({
    proposal: parsed.proposal,
    validationResult: parsed.validationResult,
    diffPreview: parsed.diffPreview,
    ...(parsed.rerunValidationResult === undefined
      ? {}
      : { rerunValidationResult: parsed.rerunValidationResult })
  });
  const capabilityReasons = evaluateApprovalRequestCapabilities(parsed.session);
  const canRequestApproval = readiness.ready && capabilityReasons.length === 0;

  appendProposalLifecycleCommandToTranscript({
    transcript: parsed.transcript,
    commandId: input.commandId,
    session: parsed.session,
    basis: parsed.basis,
    command: "dryRunOperation",
    status: canRequestApproval ? "ok" : capabilityReasons.length > 0 ? "permission_denied" : "rejected",
    evidenceRefs
  });

  if (canRequestApproval) {
    parsed.approvalPolicy.recordDryRun({
      dryRunCommandId: approvalRequestId,
      agentId: parsed.session.agentId
    });
  }

  return CodexProposalApprovalEvidenceResponseDtoSchema.parse({
    schemaVersion: "codex-proposal-approval-evidence-response-v0",
    proposalId: parsed.proposal.proposalId,
    approvalRequestId,
    generatedAt: input.generatedAt ?? parsed.proposal.createdAt,
    approvalStatus: canRequestApproval ? "requested" : "not_requested",
    commitStatus: canRequestApproval ? "needs_approval" : "blocked",
    requiresUserApproval: true,
    automaticCommitAllowed: false,
    summary: canRequestApproval
      ? `Codex proposal ${parsed.proposal.proposalId} is ready for user approval; no commit has occurred.`
      : `Codex proposal ${parsed.proposal.proposalId} is blocked before approval: ${[
          ...readiness.reasons,
          ...capabilityReasons
        ].join(" ")}`,
    evidenceRefs
  });
};

export const approveCodexProposal = (
  input: ApproveCodexProposalLifecycleInput
): CodexProposalApprovalEvidenceResponseDto => {
  const proposal = CodexRiggingEditProposalDtoSchema.parse(input.proposal);
  const approvalRequestId = CodexProposalApprovalRequestIdDtoSchema.parse(input.approvalRequestId);
  const expectedApprovalRequestId = createApprovalRequestId(proposal);
  const approvalDecisionEvidence = createApprovalDecisionEvidenceRef({
    proposal,
    approvalRequestId
  });
  if (approvalRequestId !== expectedApprovalRequestId) {
    return CodexProposalApprovalEvidenceResponseDtoSchema.parse({
      schemaVersion: "codex-proposal-approval-evidence-response-v0",
      proposalId: proposal.proposalId,
      approvalRequestId,
      generatedAt: input.generatedAt ?? proposal.createdAt,
      approvalStatus: "rejected",
      commitStatus: "blocked",
      requiresUserApproval: true,
      automaticCommitAllowed: false,
      summary:
        `Approval request ${approvalRequestId} does not match expected request ${expectedApprovalRequestId} for proposal ${proposal.proposalId}.`,
      evidenceRefs: [approvalDecisionEvidence]
    });
  }

  const record = input.approvalPolicy.approveDryRunCommand({
    dryRunCommandId: approvalRequestId
  });

  appendAiApprovalToTranscript({
    transcript: input.transcript,
    record,
    evidenceRefs: [approvalDecisionEvidence.evidenceId]
  });

  return CodexProposalApprovalEvidenceResponseDtoSchema.parse({
    schemaVersion: "codex-proposal-approval-evidence-response-v0",
    proposalId: proposal.proposalId,
    approvalRequestId,
    generatedAt: input.generatedAt ?? proposal.createdAt,
    approvalStatus: "approved",
    commitStatus: "approved_not_committed",
    requiresUserApproval: true,
    automaticCommitAllowed: false,
    summary: `User approval was recorded for Codex proposal ${proposal.proposalId}; no commit has occurred.`,
    evidenceRefs: [approvalDecisionEvidence]
  });
};

export const commitApprovedCodexProposal = async (
  input: CommitApprovedCodexProposalLifecycleInput
): Promise<CommitApprovedCodexProposalLifecycleResult> => {
  const parsed = parseApprovalLifecycleInput(input);
  const approvalRequestId = CodexProposalApprovalRequestIdDtoSchema.parse(input.approvalRequestId);
  const expectedApprovalRequestId = createApprovalRequestId(parsed.proposal);
  const approvalDecisionEvidence = createApprovalDecisionEvidenceRef({
    proposal: parsed.proposal,
    approvalRequestId
  });
  const commitResultEvidence = createCommitResultEvidenceRef({
    proposal: parsed.proposal,
    approvalRequestId,
    commitStatus: "needs_approval"
  });
  const readiness = evaluateApprovalReadiness({
    proposal: parsed.proposal,
    validationResult: parsed.validationResult,
    diffPreview: parsed.diffPreview,
    ...(parsed.rerunValidationResult === undefined
      ? {}
      : { rerunValidationResult: parsed.rerunValidationResult })
  });

  if (!readiness.ready) {
    const response = createCommitResponse({
      proposal: parsed.proposal,
      approvalRequestId,
      generatedAt: input.generatedAt,
      approvalStatus: "requested",
      commitStatus: "blocked",
      summary: `Codex proposal ${parsed.proposal.proposalId} is blocked before commit: ${readiness.reasons.join(" ")}`,
      evidenceRefs: [
        ...collectApprovalRequestEvidenceRefs({
          proposal: parsed.proposal,
          validationResult: parsed.validationResult,
          diffPreview: parsed.diffPreview,
          ...(parsed.rerunValidationResult === undefined
            ? {}
            : { rerunValidationResult: parsed.rerunValidationResult })
        }),
        createCommitResultEvidenceRef({
          proposal: parsed.proposal,
          approvalRequestId,
          commitStatus: "blocked"
        })
      ]
    });
    appendProposalLifecycleCommandToTranscript({
      transcript: parsed.transcript,
      commandId: input.commandId,
      session: parsed.session,
      basis: parsed.basis,
      command: "commitOperation",
      status: "rejected",
      evidenceRefs: response.evidenceRefs
    });
    return {
      response,
      operationResults: []
    };
  }

  if (approvalRequestId !== expectedApprovalRequestId) {
    const response = createCommitResponse({
      proposal: parsed.proposal,
      approvalRequestId,
      generatedAt: input.generatedAt,
      approvalStatus: "rejected",
      commitStatus: "blocked",
      summary:
        `Approval request ${approvalRequestId} does not match expected request ${expectedApprovalRequestId} for proposal ${parsed.proposal.proposalId}.`,
      evidenceRefs: [
        createCommitResultEvidenceRef({
          proposal: parsed.proposal,
          approvalRequestId,
          commitStatus: "blocked"
        })
      ]
    });
    appendProposalLifecycleCommandToTranscript({
      transcript: parsed.transcript,
      commandId: input.commandId,
      session: parsed.session,
      basis: parsed.basis,
      command: "commitOperation",
      status: "rejected",
      evidenceRefs: response.evidenceRefs
    });
    return {
      response,
      operationResults: []
    };
  }

  const approvalCheck = parsed.approvalPolicy.checkCommitApproval({
    approvedDryRunCommandId: approvalRequestId,
    agentId: parsed.session.agentId
  });

  if (approvalCheck.status !== "approved") {
    const response = createCommitResponse({
      proposal: parsed.proposal,
      approvalRequestId,
      generatedAt: input.generatedAt,
      approvalStatus: approvalCheck.status === "needs_approval" ? "requested" : "rejected",
      commitStatus: approvalCheck.status,
      summary: approvalCheck.reason ?? "Codex proposal commit requires approval.",
      evidenceRefs: [commitResultEvidence]
    });
    appendProposalLifecycleCommandToTranscript({
      transcript: parsed.transcript,
      commandId: input.commandId,
      session: parsed.session,
      basis: parsed.basis,
      command: "commitOperation",
      status: approvalCheck.status,
      evidenceRefs: response.evidenceRefs
    });
    return {
      response,
      operationResults: []
    };
  }

  if (!parsed.session.capabilities.includes("commitWithApproval")) {
    const response = createCommitResponse({
      proposal: parsed.proposal,
      approvalRequestId,
      generatedAt: input.generatedAt,
      approvalStatus: "approved",
      commitStatus: "blocked",
      summary: "Codex proposal commit requires the commitWithApproval capability.",
      evidenceRefs: [
        createCommitResultEvidenceRef({
          proposal: parsed.proposal,
          approvalRequestId,
          commitStatus: "blocked"
        })
      ]
    });
    appendProposalLifecycleCommandToTranscript({
      transcript: parsed.transcript,
      commandId: input.commandId,
      session: parsed.session,
      basis: parsed.basis,
      command: "commitOperation",
      status: "permission_denied",
      evidenceRefs: response.evidenceRefs
    });
    return {
      response,
      operationResults: []
    };
  }

  const operationResults: CodexProposalCommitOperationSummary[] = [];
  let nextBasePackageRevision = parsed.proposal.packageContext.basePackageRevision;

  for (const proposalOperation of parsed.proposal.operations) {
    const request = createCommitOperationRequest({
      proposal: parsed.proposal,
      operation: proposalOperation,
      basePackageRevision: nextBasePackageRevision
    });
    const result = OperationResultSchema.parse(await input.host.commitOperation(request));
    operationResults.push({ request, result });

    if (result.status !== "committed") {
      const rejectedEvidence = createCommitResultEvidenceRef({
        proposal: parsed.proposal,
        approvalRequestId,
        commitStatus: "rejected"
      });
      const response = createCommitResponse({
        proposal: parsed.proposal,
        approvalRequestId,
        generatedAt: input.generatedAt,
        approvalStatus: "approved",
        commitStatus: "rejected",
        summary: `Codex proposal ${parsed.proposal.proposalId} commit stopped after rejected operation ${result.operationId}.`,
        evidenceRefs: [approvalDecisionEvidence, rejectedEvidence]
      });
      appendProposalLifecycleCommandToTranscript({
        transcript: parsed.transcript,
        commandId: input.commandId,
        session: parsed.session,
        basis: parsed.basis,
        command: "commitOperation",
        status: "rejected",
        evidenceRefs: response.evidenceRefs,
        ...(operationResults.length === 1 ? { operationId: result.operationId } : {})
      });
      return {
        response,
        operationResults
      };
    }

    nextBasePackageRevision += 1;
  }

  const operationLogEvidenceRefs = operationResults.map((operationResult) =>
    createOperationLogEvidenceRef({
      proposal: parsed.proposal,
      operationId: operationResult.result.operationId
    })
  );
  const committedEvidence = createCommitResultEvidenceRef({
    proposal: parsed.proposal,
    approvalRequestId,
    commitStatus: "committed"
  });
  const response = createCommitResponse({
    proposal: parsed.proposal,
    approvalRequestId,
    generatedAt: input.generatedAt,
    approvalStatus: "approved",
    commitStatus: "committed",
    summary: `Codex proposal ${parsed.proposal.proposalId} committed ${operationResults.length} approved operation(s).`,
    evidenceRefs: [
      approvalDecisionEvidence,
      committedEvidence,
      ...operationLogEvidenceRefs
    ]
  });

  appendProposalLifecycleCommandToTranscript({
    transcript: parsed.transcript,
    commandId: input.commandId,
    session: parsed.session,
    basis: parsed.basis,
    command: "commitOperation",
    status: "ok",
    evidenceRefs: response.evidenceRefs,
    ...(operationResults.length === 1 && operationResults[0] !== undefined
      ? { operationId: operationResults[0].result.operationId }
      : {})
  });

  return {
    response,
    operationResults
  };
};

const parseApprovalLifecycleInput = (
  input: RequestCodexProposalApprovalLifecycleInput | CommitApprovedCodexProposalLifecycleInput
) => ({
  commandId: input.commandId,
  session: AiCommandSessionSchema.parse(input.session),
  basis: AiCommandBasisSchema.parse(input.basis),
  proposal: CodexRiggingEditProposalDtoSchema.parse(input.proposal),
  validationResult: CodexProposalValidationResultDtoSchema.parse(input.validationResult),
  diffPreview: CodexProposalDiffPreviewResultDtoSchema.parse(input.diffPreview),
  ...(input.rerunValidationResult === undefined
    ? {}
    : {
        rerunValidationResult: CodexProposalRerunValidationResultDtoSchema.parse(
          input.rerunValidationResult
        )
      }),
  approvalPolicy: input.approvalPolicy,
  transcript: input.transcript,
  ...("host" in input ? { host: input.host } : {})
});

const evaluateApprovalReadiness = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly diffPreview: CodexProposalDiffPreviewResultDto;
  readonly rerunValidationResult?: CodexProposalRerunValidationResultDto | undefined;
}): { readonly ready: true; readonly reasons: readonly [] } | {
  readonly ready: false;
  readonly reasons: readonly string[];
} => {
  const reasons: string[] = [];

  if (input.proposal.approvalPolicy.requiresUserApproval !== true) {
    reasons.push("Proposal approval policy must require user approval.");
  }
  if (input.proposal.approvalPolicy.allowAutomaticCommit !== false) {
    reasons.push("Proposal approval policy must disallow automatic commit.");
  }

  if (input.validationResult.proposalId !== input.proposal.proposalId) {
    reasons.push("Proposal validation result does not match the proposal id.");
  }
  if (
    input.validationResult.status !== "valid" ||
    !input.validationResult.canRequestApproval ||
    !input.validationResult.approvalGate.approvalReady
  ) {
    reasons.push("Proposal validation is not approval-ready.");
  }

  if (input.diffPreview.proposalId !== input.proposal.proposalId) {
    reasons.push("Diff preview does not match the proposal id.");
  }
  if (
    input.diffPreview.status !== "ready" ||
    input.diffPreview.previewOnly !== true ||
    input.diffPreview.committed !== false ||
    input.diffPreview.sourceValidationStatus !== "valid"
  ) {
    reasons.push("Diff preview is not ready for approval-gated commit.");
  }

  if (
    input.diffPreview.basePackageRevision !== input.proposal.packageContext.basePackageRevision
  ) {
    reasons.push("Diff preview base package revision does not match the proposal base package revision.");
  }

  if (
    input.diffPreview.previewPackageRevision !== undefined &&
    input.diffPreview.previewPackageRevision !==
      input.proposal.packageContext.basePackageRevision + input.proposal.operations.length
  ) {
    reasons.push("Diff preview package revision does not match the proposal operation sequence.");
  }

  if (input.rerunValidationResult === undefined) {
    reasons.push("Rerun validation result is required before approval.");
  } else {
    if (input.rerunValidationResult.proposalId !== input.proposal.proposalId) {
      reasons.push("Rerun validation result does not match the proposal id.");
    }
    if (
      input.rerunValidationResult.stateScope !== "preview" ||
      input.rerunValidationResult.previewId !== input.diffPreview.previewId
    ) {
      reasons.push("Rerun validation result must be bound to the diff preview.");
    }
    if (input.rerunValidationResult.status !== "pass") {
      reasons.push("Rerun validation must pass before approval.");
    }
  }

  return reasons.length === 0 ? { ready: true, reasons: [] } : { ready: false, reasons };
};

const evaluateApprovalRequestCapabilities = (
  session: AiCommandSession
): readonly string[] => {
  const reasons: string[] = [];
  if (!session.capabilities.includes("dryRunEdit")) {
    reasons.push("Approval requests require the dryRunEdit capability.");
  }
  if (!session.capabilities.includes("commitWithApproval")) {
    reasons.push("Approval requests require the commitWithApproval capability.");
  }
  return reasons;
};

const collectApprovalRequestEvidenceRefs = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly diffPreview: CodexProposalDiffPreviewResultDto;
  readonly rerunValidationResult?: CodexProposalRerunValidationResultDto | undefined;
}): readonly CodexProposalEvidenceRefDto[] =>
  sortAndDedupeEvidenceRefs([
    createProposalReceiptEvidenceRef(input.proposal),
    createProposalValidationEvidenceRef(input.proposal),
    ...input.validationResult.evidenceRefs,
    ...ensureDiffPreviewEvidenceRefs(input.proposal, input.diffPreview),
    ...(input.rerunValidationResult === undefined
      ? []
      : ensureRerunValidationEvidenceRefs(input.proposal, input.rerunValidationResult))
  ]);

const ensureDiffPreviewEvidenceRefs = (
  proposal: CodexRiggingEditProposalDto,
  diffPreview: CodexProposalDiffPreviewResultDto
): readonly CodexProposalEvidenceRefDto[] => {
  if (diffPreview.evidenceRefs.some((evidenceRef) => evidenceRef.evidenceKind === "dryRunDiffPreview")) {
    return diffPreview.evidenceRefs;
  }

  return [
    CodexProposalEvidenceRefDtoSchema.parse({
      evidenceId: `evidence_${sanitizeToken(proposal.proposalId)}_${sanitizeToken(diffPreview.previewId)}_diffPreview`,
      evidenceKind: "dryRunDiffPreview",
      artifactRef: {
        artifactKind: "diffPreview",
        path: `generated/codex-proposals/${sanitizePathStem(proposal.proposalId)}.${sanitizePathStem(diffPreview.previewId)}.diff-preview.json`
      },
      target: createPackageTarget(proposal),
      summary: `Dry-run diff preview evidence for proposal ${proposal.proposalId}.`,
      producer: "aiInterface"
    })
  ];
};

const ensureRerunValidationEvidenceRefs = (
  proposal: CodexRiggingEditProposalDto,
  rerunValidationResult: CodexProposalRerunValidationResultDto
): readonly CodexProposalEvidenceRefDto[] => {
  if (rerunValidationResult.evidenceRefs.some((evidenceRef) => evidenceRef.evidenceKind === "rerunValidation")) {
    return rerunValidationResult.evidenceRefs;
  }

  const stateToken = rerunValidationResult.previewId ?? rerunValidationResult.stateScope;

  return [
    CodexProposalEvidenceRefDtoSchema.parse({
      evidenceId: `evidence_${sanitizeToken(proposal.proposalId)}_${sanitizeToken(stateToken)}_rerunValidation`,
      evidenceKind: "rerunValidation",
      artifactRef: {
        artifactKind: "rerunValidation",
        path: `generated/codex-proposals/${sanitizePathStem(proposal.proposalId)}.${sanitizePathStem(stateToken)}.rerun-validation.json`
      },
      target: createPackageTarget(proposal),
      summary: `Rerun validation evidence for proposal ${proposal.proposalId}.`,
      producer: "aiInterface"
    })
  ];
};

const createProposalReceiptEvidenceRef = (
  proposal: CodexRiggingEditProposalDto
): CodexProposalEvidenceRefDto =>
  CodexProposalEvidenceRefDtoSchema.parse({
    evidenceId: `evidence_${sanitizeToken(proposal.proposalId)}_proposalReceipt`,
    evidenceKind: "proposalReceipt",
    artifactRef: {
      artifactKind: "proposalReceipt",
      path: `generated/codex-proposals/${sanitizePathStem(proposal.proposalId)}.proposal.json`
    },
    target: createPackageTarget(proposal),
    summary: `Received Codex proposal ${proposal.proposalId}.`,
    producer: "aiInterface"
  });

const createProposalValidationEvidenceRef = (
  proposal: CodexRiggingEditProposalDto
): CodexProposalEvidenceRefDto =>
  CodexProposalEvidenceRefDtoSchema.parse({
    evidenceId: `evidence_${sanitizeToken(proposal.proposalId)}_proposalValidation`,
    evidenceKind: "proposalValidation",
    artifactRef: {
      artifactKind: "proposalValidation",
      path: `generated/codex-proposals/${sanitizePathStem(proposal.proposalId)}.proposal-validation.json`
    },
    target: createPackageTarget(proposal),
    summary: `Proposal validation result for ${proposal.proposalId}.`,
    producer: "aiInterface"
  });

const createApprovalDecisionEvidenceRef = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly approvalRequestId: CodexProposalApprovalRequestIdDto;
}): CodexProposalEvidenceRefDto =>
  CodexProposalEvidenceRefDtoSchema.parse({
    evidenceId:
      `evidence_${sanitizeToken(input.proposal.proposalId)}_${sanitizeToken(input.approvalRequestId)}_approvalDecision`,
    evidenceKind: "approvalDecision",
    artifactRef: {
      artifactKind: "approvalEvidence",
      path:
        `generated/codex-proposals/${sanitizePathStem(input.proposal.proposalId)}.${sanitizePathStem(input.approvalRequestId)}.approval-evidence.json`
    },
    target: createPackageTarget(input.proposal),
    summary: `User approval decision for Codex proposal ${input.proposal.proposalId}.`,
    producer: "human"
  });

const createCommitResultEvidenceRef = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly approvalRequestId: CodexProposalApprovalRequestIdDto;
  readonly commitStatus: CodexProposalApprovalEvidenceResponseDto["commitStatus"];
}): CodexProposalEvidenceRefDto =>
  CodexProposalEvidenceRefDtoSchema.parse({
    evidenceId:
      `evidence_${sanitizeToken(input.proposal.proposalId)}_${sanitizeToken(input.approvalRequestId)}_${input.commitStatus}_commitResult`,
    evidenceKind: "commitResult",
    artifactRef: {
      artifactKind: "approvalEvidence",
      path:
        `generated/codex-proposals/${sanitizePathStem(input.proposal.proposalId)}.${sanitizePathStem(input.approvalRequestId)}.approval-evidence.json`
    },
    target: createPackageTarget(input.proposal),
    summary: `Commit result for Codex proposal ${input.proposal.proposalId}: ${input.commitStatus}.`,
    producer: "aiInterface"
  });

const createOperationLogEvidenceRef = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly operationId: string;
}): CodexProposalEvidenceRefDto =>
  CodexProposalEvidenceRefDtoSchema.parse({
    evidenceId: `evidence_${sanitizeToken(input.proposal.proposalId)}_${sanitizeToken(input.operationId)}_operationLog`,
    evidenceKind: "operationLog",
    artifactRef: {
      artifactKind: "operationLog",
      path: "operations/log.jsonl",
      operationId: input.operationId
    },
    target: {
      kind: "operation",
      id: input.operationId
    },
    summary: `Operation log entry for proposal operation ${input.operationId}.`,
    producer: "operationCore"
  });

const createCommitOperationRequest = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly operation: CodexRiggingEditProposalDto["operations"][number];
  readonly basePackageRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    ...(input.operation.operationId === undefined
      ? {}
      : { operationId: input.operation.operationId }),
    actor: "ai",
    surface: "structuredApi",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    trace: {
      relatedAC: input.proposal.metadata.relatedAC,
      relatedScenarios: input.proposal.metadata.relatedScenarios
    },
    operationType: input.operation.operationType,
    payload: input.operation.payload
  });

const createCommitResponse = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly approvalRequestId: CodexProposalApprovalRequestIdDto;
  readonly generatedAt: string | undefined;
  readonly approvalStatus: CodexProposalApprovalEvidenceResponseDto["approvalStatus"];
  readonly commitStatus: CodexProposalApprovalEvidenceResponseDto["commitStatus"];
  readonly summary: string;
  readonly evidenceRefs: readonly CodexProposalEvidenceRefDto[];
}): CodexProposalApprovalEvidenceResponseDto =>
  CodexProposalApprovalEvidenceResponseDtoSchema.parse({
    schemaVersion: "codex-proposal-approval-evidence-response-v0",
    proposalId: input.proposal.proposalId,
    approvalRequestId: input.approvalRequestId,
    generatedAt: input.generatedAt ?? input.proposal.createdAt,
    approvalStatus: input.approvalStatus,
    commitStatus: input.commitStatus,
    requiresUserApproval: true,
    automaticCommitAllowed: false,
    summary: input.summary,
    evidenceRefs: sortAndDedupeEvidenceRefs(input.evidenceRefs)
  });

const appendProposalLifecycleCommandToTranscript = (input: {
  readonly transcript: AiCommandTranscript;
  readonly commandId: string;
  readonly session: AiCommandSession;
  readonly basis: AiCommandBasis;
  readonly command: "dryRunOperation" | "commitOperation";
  readonly status: AiCommandStatus;
  readonly evidenceRefs: readonly CodexProposalEvidenceRefDto[];
  readonly operationId?: string | undefined;
}): void => {
  input.transcript.append({
    schemaVersion: "ai-command-transcript-entry-v1",
    entryType: "command",
    commandId: input.commandId,
    agentId: input.session.agentId,
    command: input.command,
    capabilities: input.session.capabilities,
    basis: input.basis,
    status: input.status,
    evidenceRefs: [...collectTranscriptEvidenceIds(input.evidenceRefs)],
    ...(input.operationId === undefined ? {} : { operationId: OperationIdSchema.parse(input.operationId) })
  });
};

const collectTranscriptEvidenceIds = (
  evidenceRefs: readonly CodexProposalEvidenceRefDto[]
): readonly string[] => sortAndDedupeEvidenceRefs(evidenceRefs).map((evidenceRef) => evidenceRef.evidenceId);

const sortAndDedupeEvidenceRefs = (
  evidenceRefs: readonly CodexProposalEvidenceRefDto[]
): readonly CodexProposalEvidenceRefDto[] => [
  ...new Map(
    evidenceRefs
      .map((evidenceRef) => CodexProposalEvidenceRefDtoSchema.parse(evidenceRef))
      .sort(compareEvidenceRefs)
      .map((evidenceRef) => [evidenceRef.evidenceId, evidenceRef])
  ).values()
];

const compareEvidenceRefs = (
  left: CodexProposalEvidenceRefDto,
  right: CodexProposalEvidenceRefDto
): number =>
  left.evidenceId.localeCompare(right.evidenceId) ||
  left.evidenceKind.localeCompare(right.evidenceKind) ||
  JSON.stringify(left.artifactRef).localeCompare(JSON.stringify(right.artifactRef));

const createApprovalRequestId = (
  proposal: CodexRiggingEditProposalDto
): CodexProposalApprovalRequestIdDto =>
  CodexProposalApprovalRequestIdDtoSchema.parse(
    `approval_${sanitizeToken(proposal.proposalId.replace(/^proposal_/, ""))}`
  );

const createPackageTarget = (proposal: CodexRiggingEditProposalDto) => ({
  kind: "package" as const,
  id: proposal.packageContext.packageId ?? "pkg_codexProposal"
});

const sanitizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "proposal";

const sanitizePathStem = (value: string): string =>
  value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "proposal";
