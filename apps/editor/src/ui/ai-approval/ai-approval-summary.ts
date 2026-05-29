import type {
  AiApprovalWorkflowViewModel,
  AiTranscriptSummaryEntryState
} from "../../editor-state/index.js";
import { aiApprovalTestIds } from "./ai-approval-test-ids.js";

export const createAiApprovalSummary = (
  aiApproval: AiApprovalWorkflowViewModel
): HTMLElement => {
  const summary = document.createElement("section");
  summary.className = "ai-approval-panel__summary";
  summary.dataset.testid = aiApprovalTestIds.resultSummary;
  summary.setAttribute("aria-labelledby", "ai-approval-result-heading");

  const heading = document.createElement("h3");
  heading.id = "ai-approval-result-heading";
  heading.textContent = "Dry-run result";

  const facts = document.createElement("dl");
  facts.className = "ai-approval-panel__facts";
  appendFact(facts, "Result", aiApproval.latestDryRunResultLabel);
  appendFact(facts, "Command ID", aiApproval.latestDryRunCommandId ?? "None");
  appendFact(facts, "Operation ID", aiApproval.latestDryRunOperationId ?? "None");

  summary.append(heading, facts, createLatestTranscriptEntry(aiApproval.transcriptEntries));

  return summary;
};

export const createAiApprovalStatus = (
  aiApproval: AiApprovalWorkflowViewModel
): HTMLElement => {
  const status = document.createElement("div");
  const statusToken = toStatusClassToken(aiApproval.status);
  status.className = `ai-approval-panel__status ai-approval-panel__status--${statusToken}`;
  status.dataset.testid = aiApprovalTestIds.status;
  status.setAttribute("role", "status");

  const label = document.createElement("p");
  label.className = "ai-approval-panel__status-label";
  label.textContent = formatAiApprovalStatus(aiApproval.status);

  const detail = document.createElement("p");
  detail.className = "ai-approval-panel__status-detail";
  detail.textContent = createStatusDetail(aiApproval);

  status.append(label, detail);
  return status;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  list.append(term, description);
};

const createLatestTranscriptEntry = (
  entries: readonly AiTranscriptSummaryEntryState[]
): HTMLElement => {
  const container = document.createElement("article");
  container.className = "ai-approval-panel__latest";
  container.dataset.testid = aiApprovalTestIds.latestTranscriptEntry;

  const heading = document.createElement("h4");
  heading.textContent = "Latest AI event";
  container.append(heading);

  const entry = entries.at(-1);
  if (entry === undefined) {
    const empty = document.createElement("p");
    empty.className = "ai-approval-panel__empty";
    empty.textContent = "No AI command events yet.";
    container.append(empty);
    return container;
  }

  const label = document.createElement("p");
  label.className = "ai-approval-panel__latest-label";
  label.textContent = entry.label;

  const meta = document.createElement("p");
  meta.className = "ai-approval-panel__latest-meta";
  meta.textContent = formatTranscriptEntryMeta(entry);

  container.append(label, meta);
  return container;
};

const formatAiApprovalStatus = (
  status: AiApprovalWorkflowViewModel["status"]
): string => {
  switch (status) {
    case "idle":
      return "Idle";
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
  }
};

const createStatusDetail = (aiApproval: AiApprovalWorkflowViewModel): string => {
  if (aiApproval.status === "idle") {
    return aiApproval.latestDryRunResultLabel;
  }

  if (aiApproval.status === "pending_approval") {
    return `Review ${aiApproval.latestDryRunOperationId ?? "the latest operation"} before commit.`;
  }

  return `Ready to commit ${aiApproval.latestDryRunOperationId ?? "the approved operation"}.`;
};

const formatTranscriptEntryMeta = (entry: AiTranscriptSummaryEntryState): string => {
  const operationId = entry.operationId ?? "no operation";

  if (entry.entryType === "approval") {
    return `approval ${entry.approvalStatus} | ${operationId} | ${entry.evidenceCount} evidence`;
  }

  return `${entry.command} ${entry.status} | ${operationId} | ${entry.evidenceCount} evidence`;
};

const toStatusClassToken = (status: AiApprovalWorkflowViewModel["status"]): string =>
  status.replaceAll("_", "-");
