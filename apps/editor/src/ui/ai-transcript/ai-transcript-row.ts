import type { AiTranscriptSummaryEntryState } from "../../editor-state/index.js";
import { createAiTranscriptEventRowTestId } from "./ai-transcript-test-ids.js";

export const createAiTranscriptRow = (
  entry: AiTranscriptSummaryEntryState,
  index: number
): HTMLElement => {
  const item = document.createElement("li");
  item.className = `ai-transcript-panel__event ai-transcript-panel__event--${entry.entryType}`;
  item.dataset.testid = createAiTranscriptEventRowTestId(index);

  const heading = document.createElement("div");
  heading.className = "ai-transcript-panel__event-heading";

  const type = document.createElement("span");
  type.className = "ai-transcript-panel__event-type";
  type.textContent = entry.entryType === "command" ? "Command" : "Approval";

  const title = document.createElement("span");
  title.className = "ai-transcript-panel__event-title";
  title.textContent = entry.label;

  heading.append(type, title);

  const facts = document.createElement("dl");
  facts.className = "ai-transcript-panel__facts";
  appendFact(facts, "Status", formatStatus(entry));
  appendFact(facts, "Operation ID", entry.operationId ?? "None");
  appendFact(facts, "Evidence", String(entry.evidenceCount));
  appendFact(facts, "Command ID", getCommandId(entry));

  item.append(heading, facts);

  if (entry.operationId !== null) {
    const operationLogLink = document.createElement("p");
    operationLogLink.className = "ai-transcript-panel__operation-link";
    operationLogLink.textContent = `Operation log: ${entry.operationId}`;
    item.append(operationLogLink);
  }

  return item;
};

const formatStatus = (entry: AiTranscriptSummaryEntryState): string => {
  if (entry.entryType === "approval") {
    return entry.approvalStatus;
  }

  return entry.status;
};

const getCommandId = (entry: AiTranscriptSummaryEntryState): string => {
  if (entry.entryType === "approval") {
    return entry.dryRunCommandId;
  }

  return entry.commandId;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;

  list.append(term, description);
};
