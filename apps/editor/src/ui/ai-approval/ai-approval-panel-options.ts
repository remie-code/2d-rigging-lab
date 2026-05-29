import type { EditorWorkflowViewModel } from "../../editor-state/index.js";

export type AiApprovalPanelCallback = () => void | Promise<void>;

export interface AiApprovalPanelOptions {
  readonly viewModel: EditorWorkflowViewModel;
  readonly onDryRunCreateParameter: AiApprovalPanelCallback;
  readonly onApproveLatestDryRun: AiApprovalPanelCallback;
  readonly onRejectPendingDryRun: AiApprovalPanelCallback;
  readonly onCommitApprovedOperation: AiApprovalPanelCallback;
}
