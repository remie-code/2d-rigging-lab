import {
  editorTestIds,
  type CodexProposalReviewApprovalState,
  type CodexProposalReviewOperationState,
  type CodexProposalReviewState
} from "../../editor-state/index.js";

export type CodexProposalReviewPanelCallback = () => void | Promise<void>;

export interface CodexProposalReviewPanelOptions {
  readonly state: CodexProposalReviewState;
  readonly isPackageLoaded: boolean;
  readonly onReviewProposalText?: (proposalText: string) => void | Promise<void>;
  readonly onClearReview?: CodexProposalReviewPanelCallback;
  readonly onRequestApproval?: CodexProposalReviewPanelCallback;
  readonly onRecordApproval?: CodexProposalReviewPanelCallback;
  readonly onCommitApprovedProposal?: CodexProposalReviewPanelCallback;
}

export const createCodexProposalReviewPanel = (
  options: CodexProposalReviewPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "product-preflight-panel codex-proposal-review-panel";
  panel.dataset.testid = editorTestIds.codexProposalReviewPanel;
  panel.setAttribute("aria-labelledby", "codex-proposal-review-heading");

  const heading = document.createElement("h2");
  heading.id = "codex-proposal-review-heading";
  heading.textContent = "Codex Proposal Review";

  panel.append(
    heading,
    createProposalReviewForm(options),
    createStatus(options.state)
  );

  if (options.state.proposal !== null) {
    panel.append(
      createProposalSection(options.state),
      createOperationsSection(options.state.proposal.operations),
      createValidationSection(options.state),
      createDiffSection(options.state),
      createRerunValidationSection(options.state),
      createApprovalSection(options)
    );
  }

  return panel;
};

const createProposalReviewForm = (
  options: CodexProposalReviewPanelOptions
): HTMLElement => {
  const form = document.createElement("form");
  form.className = "source-intake-form";
  form.dataset.testid = editorTestIds.codexProposalReviewForm;
  form.setAttribute("aria-label", "Review pasted Codex proposal JSON");

  const field = document.createElement("label");
  field.className = "editor-field editor-field--wide";
  field.textContent = "Codex proposal JSON";

  const textarea = document.createElement("textarea");
  textarea.name = "proposalText";
  textarea.dataset.testid = editorTestIds.codexProposalReviewInput;
  textarea.value = options.state.inputText;
  textarea.rows = 8;
  textarea.disabled = !options.isPackageLoaded || options.onReviewProposalText === undefined;
  textarea.setAttribute("spellcheck", "false");
  textarea.setAttribute("autocomplete", "off");
  field.append(textarea);

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.codexProposalReviewSubmit;
  submit.disabled = textarea.disabled;
  submit.textContent = "Review pasted proposal";

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "editor-button source-intake-form__secondary-action";
  clear.dataset.testid = editorTestIds.codexProposalReviewClear;
  clear.disabled = options.onClearReview === undefined || options.state.status === "not_loaded";
  clear.textContent = "Clear proposal review";
  clear.addEventListener("click", () => {
    if (clear.disabled) {
      return;
    }
    void options.onClearReview?.();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submit.disabled) {
      return;
    }
    const formData = new FormData(form);
    void options.onReviewProposalText?.(String(formData.get("proposalText") ?? ""));
  });

  form.append(field, submit, clear);
  return form;
};

const createStatus = (state: CodexProposalReviewState): HTMLElement => {
  const status = document.createElement("div");
  status.className = `product-preflight-panel__status product-preflight-panel__status--${statusClass(state.status)}`;
  status.dataset.testid = editorTestIds.codexProposalReviewStatus;
  status.setAttribute("role", "status");

  const label = document.createElement("p");
  label.className = "product-preflight-panel__status-label";
  label.textContent = state.statusLabel;

  const detail = document.createElement("p");
  detail.className = "product-preflight-panel__status-detail";
  detail.textContent = state.statusDetail;

  status.append(label, detail);
  return status;
};

const createProposalSection = (state: CodexProposalReviewState): HTMLElement => {
  const proposal = state.proposal;
  const section = createReportSection("Proposal", editorTestIds.codexProposalReviewProposal);
  if (proposal === null) {
    section.append(createEmptyMessage("No Codex proposal loaded."));
    return section;
  }

  const facts = createFacts([
    ["proposal", proposal.proposalId],
    ["title", proposal.title],
    ["source", proposal.sourceLabel],
    ["created", proposal.createdAt],
    ["package", proposal.packageContextLabel],
    ["preflight", proposal.preflightContextLabel],
    ["policy", proposal.approvalPolicyLabel],
    ["operations", String(proposal.operationCount)]
  ]);
  const summary = document.createElement("p");
  summary.className = "product-preflight-panel__item-detail";
  summary.textContent = proposal.summary;

  const rationale = document.createElement("p");
  rationale.className = "product-preflight-panel__item-meta";
  rationale.textContent = proposal.rationale;

  section.append(facts, summary, rationale);
  return section;
};

const createOperationsSection = (
  operations: readonly CodexProposalReviewOperationState[]
): HTMLElement => {
  const section = createReportSection("Proposal operations", editorTestIds.codexProposalReviewOperations);
  if (operations.length === 0) {
    section.append(createEmptyMessage("No proposal operations supplied."));
    return section;
  }

  section.append(createIssueList(operations.map((operation) => ({
    title: `${operation.stepId}: ${operation.operationType}`,
    detail: operation.expectedOutcomeLabel,
    meta: [
      operation.operationIdLabel,
      operation.targetLabel,
      operation.expectedPreconditionLabel
    ].join(" / ")
  }))));
  return section;
};

const createValidationSection = (state: CodexProposalReviewState): HTMLElement => {
  const section = createReportSection("Proposal validation", editorTestIds.codexProposalReviewValidation);
  const validation = state.validation;
  if (validation === null) {
    section.append(createEmptyMessage("No proposal validation result available."));
    return section;
  }

  section.append(createFacts([
    ["status", validation.statusLabel],
    ["checked", validation.checkedAt],
    ["catalog", validation.catalogLabel],
    ["preview", validation.previewLabel],
    ["approval", validation.approvalLabel],
    ["evidence refs", String(validation.evidenceRefCount)]
  ]));

  const summary = document.createElement("p");
  summary.className = "product-preflight-panel__item-detail";
  summary.textContent = validation.summary;
  section.append(summary);

  if (validation.operationResults.length > 0) {
    section.append(createIssueList(validation.operationResults.map((operation) => ({
      title: `${operation.stepId}: ${operation.status}`,
      detail: operation.operationType,
      meta: `${operation.issueLabel} / ${operation.targetLabel}`
    }))));
  }

  const issues = createReportSection("Validation issues", editorTestIds.codexProposalReviewValidationIssues);
  if (validation.issues.length === 0) {
    issues.append(createEmptyMessage("No proposal validation issues."));
  } else {
    issues.append(createIssueList(validation.issues.map((issue) => ({
      title: issue.title,
      detail: issue.message,
      meta: `${issue.issueId} / ${issue.targetLabel} / ${issue.diagnosticLabel}`
    }))));
  }
  section.append(issues);

  return section;
};

const createDiffSection = (state: CodexProposalReviewState): HTMLElement => {
  const section = createReportSection("Diff preview", editorTestIds.codexProposalReviewDiff);
  const diff = state.diffPreview;
  if (diff === null) {
    section.append(createEmptyMessage("No diff preview result available."));
    return section;
  }

  section.append(
    createFacts([
      ["status", diff.statusLabel],
      ["generated", diff.generatedAt],
      ["revision", diff.revisionLabel],
      ["preview", diff.previewSafetyLabel],
      ["model", diff.modelDiffLabel],
      ["runtime", diff.runtimeDiffLabel],
      ["validation", diff.validationDiffLabel],
      ["evidence refs", String(diff.evidenceRefCount)]
    ]),
    createDetail(diff.summary)
  );
  appendDiagnostics(section, diff.diagnostics, "No diff preview diagnostics.");
  return section;
};

const createRerunValidationSection = (state: CodexProposalReviewState): HTMLElement => {
  const section = createReportSection(
    "Rerun validation / Product Preflight",
    editorTestIds.codexProposalReviewRerunValidation
  );
  const rerun = state.rerunValidation;
  if (rerun === null) {
    section.append(createEmptyMessage("No rerun validation result available."));
    return section;
  }

  section.append(
    createFacts([
      ["status", rerun.statusLabel],
      ["generated", rerun.generatedAt],
      ["scope", rerun.scopeLabel],
      ["Product Preflight", rerun.productPreflightLabel],
      ["validation diff", rerun.validationDiffLabel],
      ["evidence refs", String(rerun.evidenceRefCount)]
    ]),
    createDetail(rerun.summary)
  );
  appendDiagnostics(section, rerun.diagnostics, "No rerun validation diagnostics.");
  return section;
};

const createApprovalSection = (
  options: CodexProposalReviewPanelOptions
): HTMLElement => {
  const section = createReportSection("Approval and commit path", editorTestIds.codexProposalReviewApproval);
  const approval = options.state.approval;
  section.append(
    createFacts([
      ["approval", approval.approvalStatus],
      ["commit", approval.commitStatus],
      ["request", approval.approvalRequestId],
      ["generated", approval.generatedAt],
      ["requirement", approval.requirementLabel],
      ["automatic commit", approval.automaticCommitLabel],
      ["evidence refs", String(approval.evidenceRefCount)]
    ]),
    createDetail(approval.summary),
    createDetail(options.state.commitSafetyLabel),
    createApprovalActions(options, approval)
  );
  return section;
};

const createApprovalActions = (
  options: CodexProposalReviewPanelOptions,
  _approval: CodexProposalReviewApprovalState
): HTMLElement => {
  const actions = document.createElement("div");
  actions.className = "product-preflight-panel__actions";
  actions.append(
    createActionButton({
      label: "Request approval",
      testId: editorTestIds.codexProposalReviewRequestApproval,
      disabled: !options.state.canRequestApproval || options.onRequestApproval === undefined,
      ...(options.onRequestApproval === undefined ? {} : { onClick: options.onRequestApproval })
    }),
    createActionButton({
      label: "Record approval",
      testId: editorTestIds.codexProposalReviewRecordApproval,
      disabled: !options.state.canRecordApproval || options.onRecordApproval === undefined,
      ...(options.onRecordApproval === undefined ? {} : { onClick: options.onRecordApproval })
    }),
    createActionButton({
      label: "Commit approved proposal",
      testId: editorTestIds.codexProposalReviewCommit,
      disabled:
        !options.state.canCommitApprovedProposal ||
        options.onCommitApprovedProposal === undefined,
      ...(options.onCommitApprovedProposal === undefined
        ? {}
        : { onClick: options.onCommitApprovedProposal })
    })
  );
  return actions;
};

const createActionButton = (options: {
  readonly label: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly onClick?: CodexProposalReviewPanelCallback;
}): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button project-persistence-panel__button";
  button.dataset.testid = options.testId;
  button.disabled = options.disabled;
  button.textContent = options.label;
  button.addEventListener("click", () => {
    if (button.disabled) {
      return;
    }
    void options.onClick?.();
  });
  return button;
};

const createReportSection = (
  titleText: string,
  testId: string
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "product-preflight-panel__section";
  section.dataset.testid = testId;

  const title = document.createElement("h3");
  title.textContent = titleText;

  section.append(title);
  return section;
};

const createFacts = (
  rows: readonly (readonly [string, string])[]
): HTMLDListElement => {
  const facts = document.createElement("dl");
  facts.className = "product-preflight-panel__facts";

  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    facts.append(term, description);
  }

  return facts;
};

const createIssueList = (
  rows: readonly {
    readonly title: string;
    readonly detail: string;
    readonly meta: string;
  }[]
): HTMLElement => {
  const list = document.createElement("ul");
  list.className = "product-preflight-panel__issue-list";

  for (const row of rows) {
    const item = document.createElement("li");
    item.className = "product-preflight-panel__issue";

    const title = document.createElement("p");
    title.className = "product-preflight-panel__item-title";
    title.textContent = row.title;

    const detail = document.createElement("p");
    detail.className = "product-preflight-panel__item-detail";
    detail.textContent = row.detail;

    const meta = document.createElement("p");
    meta.className = "product-preflight-panel__item-meta";
    meta.textContent = row.meta;

    item.append(title, detail, meta);
    list.append(item);
  }

  return list;
};

const appendDiagnostics = (
  section: HTMLElement,
  diagnostics: readonly {
    readonly checkId: string;
    readonly title: string;
    readonly message: string;
    readonly targetLabel: string;
  }[],
  emptyMessage: string
): void => {
  if (diagnostics.length === 0) {
    section.append(createEmptyMessage(emptyMessage));
    return;
  }

  section.append(createIssueList(diagnostics.map((diagnostic) => ({
    title: `${diagnostic.checkId}: ${diagnostic.title}`,
    detail: diagnostic.message,
    meta: diagnostic.targetLabel
  }))));
};

const createDetail = (text: string): HTMLParagraphElement => {
  const detail = document.createElement("p");
  detail.className = "product-preflight-panel__item-detail";
  detail.textContent = text;
  return detail;
};

const createEmptyMessage = (message: string): HTMLParagraphElement => {
  const empty = document.createElement("p");
  empty.className = "product-preflight-panel__empty";
  empty.textContent = message;
  return empty;
};

const statusClass = (status: CodexProposalReviewState["status"]): string => {
  switch (status) {
    case "not_loaded":
      return "not-run";
    case "input_error":
      return "failed";
    case "reviewed":
      return "ready";
  }
};
