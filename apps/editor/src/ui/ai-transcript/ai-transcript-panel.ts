import type { AiTranscriptSummaryEntryState } from "../../editor-state/index.js";
import { createAiTranscriptRow } from "./ai-transcript-row.js";
import { aiTranscriptTestIds } from "./ai-transcript-test-ids.js";

export interface AiTranscriptPanelInput {
  readonly entries: readonly AiTranscriptSummaryEntryState[];
}

export const createAiTranscriptPanel = (input: AiTranscriptPanelInput): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "ai-transcript-panel";
  panel.dataset.testid = aiTranscriptTestIds.panel;
  panel.setAttribute("aria-labelledby", "ai-transcript-panel-title");

  const title = document.createElement("h2");
  title.id = "ai-transcript-panel-title";
  title.textContent = "AI transcript";

  panel.append(title);

  if (input.entries.length === 0) {
    panel.append(createEmptyState());
    return panel;
  }

  const list = document.createElement("ol");
  list.className = "ai-transcript-panel__events";
  list.dataset.testid = aiTranscriptTestIds.eventList;

  input.entries.forEach((entry, index) => {
    list.append(createAiTranscriptRow(entry, index));
  });

  panel.append(list);
  return panel;
};

const createEmptyState = (): HTMLElement => {
  const empty = document.createElement("p");
  empty.className = "ai-transcript-panel__empty";
  empty.dataset.testid = aiTranscriptTestIds.empty;
  empty.textContent = "No AI command transcript entries yet.";

  return empty;
};
