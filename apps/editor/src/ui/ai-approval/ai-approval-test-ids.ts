export const aiApprovalTestIds = {
  panel: "aiApproval.panel",
  status: "aiApproval.status",
  resultSummary: "aiApproval.resultSummary",
  latestTranscriptEntry: "aiApproval.latestTranscriptEntry",
  dryRunAction: "aiApproval.dryRun",
  approveAction: "aiApproval.approve",
  rejectAction: "aiApproval.reject",
  commitAction: "aiApproval.commit"
} as const;

export const fixedAiApprovalTestIds = Object.values(aiApprovalTestIds);
