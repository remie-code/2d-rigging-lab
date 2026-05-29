import type { EditorWorkflowViewModel } from "../../editor-state/index.js";
import { aiApprovalTestIds } from "./ai-approval-test-ids.js";
import type { AiApprovalPanelCallback } from "./ai-approval-panel-options.js";

export interface AiApprovalActionsOptions {
  readonly viewModel: EditorWorkflowViewModel;
  readonly onDryRunCreateParameter: AiApprovalPanelCallback;
  readonly onApproveLatestDryRun: AiApprovalPanelCallback;
  readonly onRejectPendingDryRun: AiApprovalPanelCallback;
  readonly onCommitApprovedOperation: AiApprovalPanelCallback;
}

export const createAiApprovalActions = (options: AiApprovalActionsOptions): HTMLElement => {
  const actions = document.createElement("div");
  actions.className = "ai-approval-panel__actions";
  actions.append(
    createActionButton({
      label: "Dry run",
      testId: aiApprovalTestIds.dryRunAction,
      disabled:
        !options.viewModel.isPackageLoaded || options.viewModel.aiApproval.status !== "idle",
      onClick: options.onDryRunCreateParameter
    }),
    createActionButton({
      label: "Approve",
      testId: aiApprovalTestIds.approveAction,
      disabled: !options.viewModel.aiApproval.canApproveLatestDryRun,
      onClick: options.onApproveLatestDryRun
    }),
    createActionButton({
      label: "Reject / clear",
      testId: aiApprovalTestIds.rejectAction,
      disabled: !options.viewModel.aiApproval.canRejectPendingDryRun,
      onClick: options.onRejectPendingDryRun
    }),
    createActionButton({
      label: "Commit",
      testId: aiApprovalTestIds.commitAction,
      disabled: !options.viewModel.aiApproval.canCommitApprovedOperation,
      onClick: options.onCommitApprovedOperation
    })
  );

  return actions;
};

interface ActionButtonOptions {
  readonly label: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly onClick: AiApprovalPanelCallback;
}

const createActionButton = (options: ActionButtonOptions): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button ai-approval-panel__button";
  button.dataset.testid = options.testId;
  button.disabled = options.disabled;
  button.textContent = options.label;
  button.addEventListener("click", () => {
    void options.onClick();
  });

  return button;
};
