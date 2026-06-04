import {
  approveCodexProposal,
  commitApprovedCodexProposal,
  requestCodexProposalApproval,
  type AiCommandBasis,
  type AiCommandSession
} from "@private-2d-rigging-lab/ai-interface";
import {
  CodexRiggingEditProposalDtoSchema,
  type CodexProposalApprovalEvidenceResponseDto,
  type CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import {
  previewCodexProposalDiff
} from "@private-2d-rigging-lab/operation-core";
import {
  createCodexProposalRerunValidationResult
} from "@private-2d-rigging-lab/validator-core";
import {
  validateCodexProposal
} from "@private-2d-rigging-lab/ai-interface";

import type { EditorAiCommandHost } from "../ai-command-host/index.js";
import type {
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import {
  createCodexProposalReviewInputErrorState,
  projectCodexProposalReviewState,
  projectProductPreflightState,
  syncAiApprovalTranscriptSummary,
  type EditorSemanticState
} from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";
import {
  runEditorProductPreflightWorkflow,
  type EditorProductPreflightWorkflowResult
} from "./product-preflight-workflow.js";
import { runCodexProposalPreviewProductPreflightWorkflow } from "./codex-proposal-preview-preflight.js";

export interface EditorWorkflowCodexProposalReviewCompletedResult {
  readonly status: "reviewed";
  readonly proposalId: string;
  readonly productPreflight: EditorProductPreflightWorkflowResult;
}

export interface EditorWorkflowCodexProposalReviewFailedResult {
  readonly status: "failed";
  readonly message: string;
}

export type EditorWorkflowCodexProposalReviewResult =
  | EditorWorkflowCodexProposalReviewCompletedResult
  | EditorWorkflowCodexProposalReviewFailedResult;

export interface EditorWorkflowCodexProposalApprovalResult {
  readonly status: "requested" | "approved" | "committed" | "blocked" | "no_review";
  readonly response?: CodexProposalApprovalEvidenceResponseDto;
  readonly latestSessionPersistenceResult?: EditorSessionPersistenceResult;
}

export const reviewCodexProposalText = async (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly proposalText: string;
  readonly now?: () => Date;
}): Promise<{
  readonly state: EditorSemanticState;
  readonly result: EditorWorkflowCodexProposalReviewResult;
}> => {
  const proposalText = input.proposalText.trim();
  if (proposalText.length === 0) {
    return createReviewError(input.state, {
      inputText: input.proposalText,
      message: "Codex proposal JSON is empty."
    });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(proposalText);
  } catch (error) {
    return createReviewError(input.state, {
      inputText: input.proposalText,
      message: error instanceof Error ? error.message : "Codex proposal JSON could not be parsed."
    });
  }

  const proposalParse = CodexRiggingEditProposalDtoSchema.safeParse(parsedJson);
  if (!proposalParse.success) {
    return createReviewError(input.state, {
      inputText: input.proposalText,
      message: proposalParse.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ")
    });
  }

  try {
    const checkedAt = (input.now?.() ?? new Date()).toISOString();
    const productPreflight = await runEditorProductPreflightWorkflow({
      adapter: input.adapter,
      state: input.state,
      ...(input.now === undefined ? {} : { now: input.now })
    });
    const validationResult = validateCodexProposal({
      proposal: proposalParse.data,
      productPreflightReport: productPreflight.report,
      checkedAt
    });
    const preview = previewCodexProposalDiff({
      session: input.adapter.authoringSession,
      proposal: proposalParse.data,
      validationResult,
      generatedAt: checkedAt
    });
    const previewProductPreflight =
      preview.diffPreview.status === "ready" && preview.previewSession !== undefined
        ? await runCodexProposalPreviewProductPreflightWorkflow({
            adapter: input.adapter,
            state: input.state,
            previewSession: preview.previewSession,
            ...(input.now === undefined ? {} : { now: input.now })
          })
        : null;
    const rerunValidationResult =
      previewProductPreflight !== null
        ? createCodexProposalRerunValidationResult({
            proposal: proposalParse.data,
            validationResult,
            stateBinding: {
              stateScope: "preview",
              diffPreview: preview.diffPreview
            },
            rerunValidationReports: [previewProductPreflight.validationReport],
            productPreflightReport: previewProductPreflight.report,
            generatedAt: checkedAt
          })
        : null;

    return {
      state: {
        ...input.state,
        productPreflight: projectProductPreflightState(productPreflight.report),
        codexProposalReview: projectCodexProposalReviewState({
          inputText: input.proposalText,
          proposal: proposalParse.data,
          validationResult,
          diffPreviewResult: preview.diffPreview,
          ...(rerunValidationResult === null ? {} : { rerunValidationResult })
        })
      },
      result: {
        status: "reviewed",
        proposalId: proposalParse.data.proposalId,
        productPreflight
      }
    };
  } catch (error) {
    return createReviewError(input.state, {
      inputText: input.proposalText,
      message: error instanceof Error ? error.message : "Codex proposal review failed."
    });
  }
};

export const requestCodexProposalReviewApproval = (input: {
  readonly state: EditorSemanticState;
  readonly aiCommandHost: EditorAiCommandHost;
  readonly now?: () => Date;
}): {
  readonly state: EditorSemanticState;
  readonly result: EditorWorkflowCodexProposalApprovalResult;
} => {
  const review = input.state.codexProposalReview;
  const proposal = review.proposalDto;
  const validationResult = review.validationResultDto;
  const diffPreview = review.diffPreviewResultDto;
  const rerunValidationResult = review.rerunValidationResultDto;

  if (proposal === null || validationResult === null || diffPreview === null) {
    return {
      state: syncReviewTranscript(input.state, input.aiCommandHost),
      result: { status: "no_review" }
    };
  }

  const response = requestCodexProposalApproval({
    commandId: createProposalCommandId("requestApproval", proposal),
    session: createProposalSession(proposal),
    basis: createProposalBasis(proposal),
    proposal,
    validationResult,
    diffPreview,
    ...(rerunValidationResult === null ? {} : { rerunValidationResult }),
    approvalPolicy: input.aiCommandHost.approvalPolicy,
    transcript: input.aiCommandHost.transcript,
    generatedAt: (input.now?.() ?? new Date()).toISOString()
  });
  const nextState = updateReviewApprovalResponse(input.state, response);

  return {
    state: syncReviewTranscript(nextState, input.aiCommandHost),
    result: {
      status: response.approvalStatus === "requested" ? "requested" : "blocked",
      response
    }
  };
};

export const approveCodexProposalReview = (input: {
  readonly state: EditorSemanticState;
  readonly aiCommandHost: EditorAiCommandHost;
  readonly now?: () => Date;
}): {
  readonly state: EditorSemanticState;
  readonly result: EditorWorkflowCodexProposalApprovalResult;
} => {
  const review = input.state.codexProposalReview;
  const proposal = review.proposalDto;
  const approvalRequestId = review.approvalResponseDto?.approvalRequestId;
  if (proposal === null || approvalRequestId === undefined) {
    return {
      state: syncReviewTranscript(input.state, input.aiCommandHost),
      result: { status: "no_review" }
    };
  }

  const response = approveCodexProposal({
    proposal,
    approvalRequestId,
    approvalPolicy: input.aiCommandHost.approvalPolicy,
    transcript: input.aiCommandHost.transcript,
    generatedAt: (input.now?.() ?? new Date()).toISOString()
  });
  const nextState = updateReviewApprovalResponse(input.state, response);

  return {
    state: syncReviewTranscript(nextState, input.aiCommandHost),
    result: {
      status: response.approvalStatus === "approved" ? "approved" : "blocked",
      response
    }
  };
};

export const commitApprovedCodexProposalReview = async (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly aiCommandHost: EditorAiCommandHost;
  readonly now?: () => Date;
}): Promise<{
  readonly state: EditorSemanticState;
  readonly result: EditorWorkflowCodexProposalApprovalResult;
}> => {
  const review = input.state.codexProposalReview;
  const proposal = review.proposalDto;
  const validationResult = review.validationResultDto;
  const diffPreview = review.diffPreviewResultDto;
  const rerunValidationResult = review.rerunValidationResultDto;
  const approvalRequestId = review.approvalResponseDto?.approvalRequestId;
  if (
    proposal === null ||
    validationResult === null ||
    diffPreview === null ||
    rerunValidationResult === null ||
    approvalRequestId === undefined
  ) {
    return {
      state: syncReviewTranscript(input.state, input.aiCommandHost),
      result: { status: "no_review" }
    };
  }

  const reviewBeforeCommit = review;
  let nextState = input.state;
  let latestSessionPersistenceResult: EditorSessionPersistenceResult | undefined;
  const commitResult = await commitApprovedCodexProposal({
    commandId: createProposalCommandId("commitApproved", proposal),
    session: createProposalSession(proposal),
    basis: createProposalBasis(proposal),
    proposal,
    validationResult,
    diffPreview,
    rerunValidationResult,
    approvalRequestId,
    approvalPolicy: input.aiCommandHost.approvalPolicy,
    transcript: input.aiCommandHost.transcript,
    host: {
      dryRunOperation(request) {
        return input.adapter.dryRunOperation(request);
      },
      commitOperation(request) {
        const persistenceResult = input.adapter.commitOperation(request);
        latestSessionPersistenceResult = persistenceResult;
        if (persistenceResult.operationResult.status === "committed") {
          nextState = applyEditorWorkflowCommitResult(nextState, input.adapter, persistenceResult);
        }
        return persistenceResult.operationResult;
      }
    },
    generatedAt: (input.now?.() ?? new Date()).toISOString()
  });
  nextState = updateReviewApprovalResponse(nextState, commitResult.response, reviewBeforeCommit);

  return {
    state: syncReviewTranscript(nextState, input.aiCommandHost),
    result: {
      status: commitResult.response.commitStatus === "committed" ? "committed" : "blocked",
      response: commitResult.response,
      ...(latestSessionPersistenceResult === undefined ? {} : { latestSessionPersistenceResult })
    }
  };
};

const createReviewError = (
  state: EditorSemanticState,
  input: {
    readonly inputText: string;
    readonly message: string;
  }
) => ({
  state: {
    ...state,
    codexProposalReview: createCodexProposalReviewInputErrorState(input)
  },
  result: {
    status: "failed" as const,
    message: input.message
  }
});

const updateReviewApprovalResponse = (
  state: EditorSemanticState,
  approvalResponse: CodexProposalApprovalEvidenceResponseDto,
  reviewSnapshot = state.codexProposalReview
): EditorSemanticState => {
  const review = reviewSnapshot;
  if (review.proposalDto === null || review.validationResultDto === null) {
    return state;
  }

  return {
    ...state,
    codexProposalReview: projectCodexProposalReviewState({
      inputText: review.inputText,
      proposal: review.proposalDto,
      validationResult: review.validationResultDto,
      ...(review.diffPreviewResultDto === null ? {} : { diffPreviewResult: review.diffPreviewResultDto }),
      ...(review.rerunValidationResultDto === null ? {} : { rerunValidationResult: review.rerunValidationResultDto }),
      approvalResponse
    })
  };
};

const syncReviewTranscript = (
  state: EditorSemanticState,
  aiCommandHost: EditorAiCommandHost
): EditorSemanticState => ({
  ...state,
  aiApproval: syncAiApprovalTranscriptSummary(
    state.aiApproval,
    aiCommandHost.transcript.entries
  )
});

const createProposalSession = (
  proposal: CodexRiggingEditProposalDto
): AiCommandSession => ({
  agentId: proposal.source.agentId,
  capabilities: ["dryRunEdit", "commitWithApproval"]
});

const createProposalBasis = (
  proposal: CodexRiggingEditProposalDto
): AiCommandBasis => ({
  packageRevision: proposal.packageContext.basePackageRevision,
  relatedAC: proposal.metadata.relatedAC,
  relatedScenarios: proposal.metadata.relatedScenarios
});

const createProposalCommandId = (
  action: "requestApproval" | "commitApproved",
  proposal: CodexRiggingEditProposalDto
): string =>
  `cmd_editor_codexProposal_${action}_${sanitizeCommandToken(proposal.proposalId)}`;

const sanitizeCommandToken = (value: string): string =>
  value.replace(/^proposal_/, "").replace(/[^A-Za-z0-9_-]+/g, "_");
