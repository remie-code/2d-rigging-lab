import { createAiApprovalActions } from "./ai-approval-actions.js";
import type { AiApprovalPanelOptions } from "./ai-approval-panel-options.js";
import { createAiApprovalStatus, createAiApprovalSummary } from "./ai-approval-summary.js";
import { aiApprovalTestIds } from "./ai-approval-test-ids.js";

export const createAiApprovalPanel = (options: AiApprovalPanelOptions): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "ai-approval-panel";
  panel.dataset.testid = aiApprovalTestIds.panel;
  panel.setAttribute("aria-labelledby", "ai-approval-heading");

  const heading = document.createElement("h2");
  heading.id = "ai-approval-heading";
  heading.textContent = "AI Approval";

  panel.append(
    heading,
    createAiApprovalStatus(options.viewModel.aiApproval),
    createAiApprovalActions(options),
    createAiApprovalSummary(options.viewModel.aiApproval)
  );

  return panel;
};
