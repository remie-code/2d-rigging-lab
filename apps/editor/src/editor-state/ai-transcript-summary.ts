import type {
  AiCommandName,
  AiCommandStatus,
  AiCommandTranscriptEntry
} from "@private-2d-rigging-lab/ai-interface";

export interface AiCommandTranscriptSummaryEntryState {
  readonly entryType: "command";
  readonly commandId: string;
  readonly command: AiCommandName;
  readonly status: AiCommandStatus;
  readonly operationId: string | null;
  readonly evidenceCount: number;
  readonly label: string;
}

export interface AiApprovalTranscriptSummaryEntryState {
  readonly entryType: "approval";
  readonly dryRunCommandId: string;
  readonly approvalStatus: "approved";
  readonly operationId: string | null;
  readonly evidenceCount: number;
  readonly label: string;
}

export type AiTranscriptSummaryEntryState =
  | AiCommandTranscriptSummaryEntryState
  | AiApprovalTranscriptSummaryEntryState;

export const projectAiTranscriptSummaryEntries = (
  entries: readonly AiCommandTranscriptEntry[]
): readonly AiTranscriptSummaryEntryState[] => entries.map(projectAiTranscriptSummaryEntry);

const projectAiTranscriptSummaryEntry = (
  entry: AiCommandTranscriptEntry
): AiTranscriptSummaryEntryState => {
  if (entry.entryType === "approval") {
    return {
      entryType: "approval",
      dryRunCommandId: entry.dryRunCommandId,
      approvalStatus: entry.approvalStatus,
      operationId: entry.operationId ?? null,
      evidenceCount: entry.evidenceRefs.length,
      label: `approved ${entry.operationId ?? entry.dryRunCommandId}`
    };
  }

  return {
    entryType: "command",
    commandId: entry.commandId,
    command: entry.command,
    status: entry.status,
    operationId: entry.operationId ?? null,
    evidenceCount: entry.evidenceRefs.length,
    label: `${entry.command} ${entry.status}`
  };
};
