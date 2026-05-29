import type { AiCommandTranscript } from "@private-2d-rigging-lab/ai-interface";

import type { EditorAiCommandHost } from "../ai-command-host/index.js";
import {
  clearPendingAiApprovalState,
  projectApprovedAiApprovalState,
  projectPendingAiApprovalState,
  syncAiApprovalTranscriptSummary,
  type EditorSemanticState
} from "../editor-state/index.js";
import {
  createDeterministicAiCreateParameterCommandPair,
  createPendingAiApprovalOperation,
  markPendingAiApprovalOperationApproved,
  type PendingAiApprovalOperation
} from "./ai-approval-workflow.js";

export interface EditorWorkflowAiDryRunResult {
  readonly status: "pending_approval" | "rejected";
  readonly response: Awaited<ReturnType<EditorAiCommandHost["execute"]>>;
}

export interface EditorWorkflowAiApprovalDecisionResult {
  readonly status: "approved" | "cleared" | "no_pending_dry_run";
}

export interface EditorWorkflowAiCommitResult {
  readonly status: "committed" | "rejected" | "no_approved_operation";
  readonly response?: Awaited<ReturnType<EditorAiCommandHost["execute"]>>;
}

export interface WorkflowAiApprovalActions {
  dryRunAiCreateParameterCommand(): Promise<EditorWorkflowAiDryRunResult>;
  approveLatestAiDryRun(): EditorWorkflowAiApprovalDecisionResult;
  rejectLatestAiDryRun(): EditorWorkflowAiApprovalDecisionResult;
  commitApprovedAiOperation(): Promise<EditorWorkflowAiCommitResult>;
  reset(input?: WorkflowAiApprovalResetInput): void;
}

export interface WorkflowAiApprovalResetInput {
  readonly transcript?: AiCommandTranscript;
}

export const createWorkflowAiApprovalActions = (options: {
  readonly getState: () => EditorSemanticState;
  readonly setState: (state: EditorSemanticState) => void;
  readonly getAiCommandHost: () => EditorAiCommandHost;
  readonly setAiCommandHost: (host: EditorAiCommandHost) => void;
  readonly createAiCommandHost: (input?: WorkflowAiApprovalResetInput) => EditorAiCommandHost;
}): WorkflowAiApprovalActions => {
  let pendingAiApprovalOperation: PendingAiApprovalOperation | null = null;
  let aiCommandSequence = 0;

  const syncAiTranscriptToState = (): void => {
    const state = options.getState();
    options.setState({
      ...state,
      aiApproval: syncAiApprovalTranscriptSummary(
        state.aiApproval,
        options.getAiCommandHost().transcript.entries
      )
    });
  };

  const clearAiApprovalState = (): void => {
    options.setState({
      ...options.getState(),
      aiApproval: clearPendingAiApprovalState(options.getAiCommandHost().transcript.entries)
    });
  };

  return {
    async dryRunAiCreateParameterCommand() {
      aiCommandSequence += 1;
      const commandPair = createDeterministicAiCreateParameterCommandPair({
        basePackageRevision: options.getState().revision.packageRevision,
        sequence: aiCommandSequence
      });
      const response = await options.getAiCommandHost().execute(commandPair.dryRunRequest);

      if (response.status !== "ok" || response.operationResult?.status !== "dry_run") {
        pendingAiApprovalOperation = null;
        clearAiApprovalState();
        return {
          status: "rejected",
          response
        };
      }

      pendingAiApprovalOperation = createPendingAiApprovalOperation({
        dryRunCommandId: commandPair.dryRunCommandId,
        operationId: commandPair.operationId,
        dryRunRequest: commandPair.dryRunRequest,
        commitRequest: commandPair.commitRequest,
        dryRunResponse: response
      });
      options.setState({
        ...options.getState(),
        aiApproval: projectPendingAiApprovalState({
          dryRunCommandId: commandPair.dryRunCommandId,
          dryRunResult: {
            ...response.operationResult,
            operationType: commandPair.dryRunRequest.payload.operationType
          },
          transcriptEntries: options.getAiCommandHost().transcript.entries
        })
      });

      return {
        status: "pending_approval",
        response
      };
    },
    approveLatestAiDryRun() {
      if (pendingAiApprovalOperation === null) {
        syncAiTranscriptToState();
        return { status: "no_pending_dry_run" };
      }

      options.getAiCommandHost().approvalPolicy.approveDryRunCommand({
        dryRunCommandId: pendingAiApprovalOperation.dryRunCommandId,
        operationId: pendingAiApprovalOperation.operationId
      });
      pendingAiApprovalOperation = markPendingAiApprovalOperationApproved(
        pendingAiApprovalOperation
      );
      options.setState({
        ...options.getState(),
        aiApproval: projectApprovedAiApprovalState(
          options.getState().aiApproval,
          options.getAiCommandHost().transcript.entries
        )
      });

      return { status: "approved" };
    },
    rejectLatestAiDryRun() {
      if (pendingAiApprovalOperation === null) {
        syncAiTranscriptToState();
        return { status: "no_pending_dry_run" };
      }

      pendingAiApprovalOperation = null;
      clearAiApprovalState();

      return { status: "cleared" };
    },
    async commitApprovedAiOperation() {
      if (pendingAiApprovalOperation?.approved !== true) {
        syncAiTranscriptToState();
        return { status: "no_approved_operation" };
      }

      const response = await options
        .getAiCommandHost()
        .execute(pendingAiApprovalOperation.commitRequest);
      syncAiTranscriptToState();

      if (response.status === "ok" && response.operationResult?.status === "committed") {
        pendingAiApprovalOperation = null;
        clearAiApprovalState();
        return {
          status: "committed",
          response
        };
      }

      return {
        status: "rejected",
        response
      };
    },
    reset(input = {}) {
      pendingAiApprovalOperation = null;
      aiCommandSequence = 0;
      options.setAiCommandHost(options.createAiCommandHost(input));
      clearAiApprovalState();
    }
  };
};
