import type { AiCommandTranscriptEntry } from "@private-2d-rigging-lab/ai-interface";

import {
  projectAiTranscriptSummaryEntries,
  type AiTranscriptSummaryEntryState
} from "./ai-transcript-summary.js";
import {
  projectOperationResultSummary,
  type OperationResultSummaryInput,
  type OperationResultSummaryState
} from "./operation-result-summary.js";

export type AiApprovalWorkflowStatus = "idle" | "pending_approval" | "approved";

export interface AiApprovalState {
  readonly status: AiApprovalWorkflowStatus;
  readonly latestDryRunCommandId: string | null;
  readonly latestDryRunOperationId: string | null;
  readonly latestDryRunResult: OperationResultSummaryState | null;
  readonly canApproveLatestDryRun: boolean;
  readonly canCommitApprovedOperation: boolean;
  readonly canRejectPendingDryRun: boolean;
  readonly transcriptEntries: readonly AiTranscriptSummaryEntryState[];
}

export const createEmptyAiApprovalState = (): AiApprovalState => ({
  status: "idle",
  latestDryRunCommandId: null,
  latestDryRunOperationId: null,
  latestDryRunResult: null,
  canApproveLatestDryRun: false,
  canCommitApprovedOperation: false,
  canRejectPendingDryRun: false,
  transcriptEntries: []
});

export const projectPendingAiApprovalState = (input: {
  readonly dryRunCommandId: string;
  readonly dryRunResult: OperationResultSummaryInput;
  readonly transcriptEntries: readonly AiCommandTranscriptEntry[];
}): AiApprovalState =>
  withAiApprovalActionAvailability({
    ...createEmptyAiApprovalState(),
    status: "pending_approval",
    latestDryRunCommandId: input.dryRunCommandId,
    latestDryRunOperationId: input.dryRunResult.operationId,
    latestDryRunResult: projectOperationResultSummary(input.dryRunResult),
    transcriptEntries: projectAiTranscriptSummaryEntries(input.transcriptEntries)
  });

export const projectApprovedAiApprovalState = (
  state: AiApprovalState,
  transcriptEntries: readonly AiCommandTranscriptEntry[]
): AiApprovalState =>
  withAiApprovalActionAvailability({
    ...state,
    status: "approved",
    transcriptEntries: projectAiTranscriptSummaryEntries(transcriptEntries)
  });

export const clearPendingAiApprovalState = (
  transcriptEntries: readonly AiCommandTranscriptEntry[]
): AiApprovalState => ({
  ...createEmptyAiApprovalState(),
  transcriptEntries: projectAiTranscriptSummaryEntries(transcriptEntries)
});

export const syncAiApprovalTranscriptSummary = (
  state: AiApprovalState,
  transcriptEntries: readonly AiCommandTranscriptEntry[]
): AiApprovalState => ({
  ...state,
  transcriptEntries: projectAiTranscriptSummaryEntries(transcriptEntries)
});

const withAiApprovalActionAvailability = (state: AiApprovalState): AiApprovalState => ({
  ...state,
  canApproveLatestDryRun: state.status === "pending_approval",
  canCommitApprovedOperation: state.status === "approved",
  canRejectPendingDryRun: state.status === "pending_approval" || state.status === "approved"
});
