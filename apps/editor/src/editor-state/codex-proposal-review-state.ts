import type {
  CodexProposalApprovalEvidenceResponseDto,
  CodexProposalDiffPreviewResultDto,
  CodexProposalRerunValidationResultDto,
  CodexProposalValidationIssueDto,
  CodexProposalValidationResultDto,
  CodexRiggingEditProposalDto,
  DiagnosticDto,
  ModelDiffDto,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

export type CodexProposalReviewRunState = "not_loaded" | "input_error" | "reviewed";

export interface CodexProposalReviewProposalState {
  readonly proposalId: string;
  readonly title: string;
  readonly summary: string;
  readonly sourceLabel: string;
  readonly createdAt: string;
  readonly packageContextLabel: string;
  readonly preflightContextLabel: string;
  readonly approvalPolicyLabel: string;
  readonly rationale: string;
  readonly operationCount: number;
  readonly operations: readonly CodexProposalReviewOperationState[];
}

export interface CodexProposalReviewOperationState {
  readonly stepId: string;
  readonly operationType: string;
  readonly operationIdLabel: string;
  readonly targetLabel: string;
  readonly expectedPreconditionLabel: string;
  readonly expectedOutcomeLabel: string;
}

export interface CodexProposalReviewValidationState {
  readonly status: CodexProposalValidationResultDto["status"];
  readonly statusLabel: string;
  readonly summary: string;
  readonly checkedAt: string;
  readonly catalogLabel: string;
  readonly previewLabel: string;
  readonly approvalLabel: string;
  readonly operationResults: readonly CodexProposalReviewOperationValidationState[];
  readonly issues: readonly CodexProposalReviewIssueState[];
  readonly evidenceRefCount: number;
}

export interface CodexProposalReviewOperationValidationState {
  readonly stepId: string;
  readonly operationType: string;
  readonly status: string;
  readonly issueLabel: string;
  readonly targetLabel: string;
}

export interface CodexProposalReviewIssueState {
  readonly issueId: string;
  readonly title: string;
  readonly message: string;
  readonly targetLabel: string;
  readonly diagnosticLabel: string;
}

export interface CodexProposalReviewDiffState {
  readonly status: CodexProposalDiffPreviewResultDto["status"];
  readonly statusLabel: string;
  readonly summary: string;
  readonly previewId: string;
  readonly generatedAt: string;
  readonly revisionLabel: string;
  readonly previewSafetyLabel: string;
  readonly modelDiffLabel: string;
  readonly runtimeDiffLabel: string;
  readonly validationDiffLabel: string;
  readonly diagnostics: readonly CodexProposalReviewDiagnosticState[];
  readonly evidenceRefCount: number;
}

export interface CodexProposalReviewRerunValidationState {
  readonly status: CodexProposalRerunValidationResultDto["status"];
  readonly statusLabel: string;
  readonly summary: string;
  readonly generatedAt: string;
  readonly scopeLabel: string;
  readonly productPreflightLabel: string;
  readonly validationDiffLabel: string;
  readonly diagnostics: readonly CodexProposalReviewDiagnosticState[];
  readonly evidenceRefCount: number;
}

export interface CodexProposalReviewApprovalState {
  readonly approvalStatus: CodexProposalApprovalEvidenceResponseDto["approvalStatus"] | "not_requested";
  readonly commitStatus: CodexProposalApprovalEvidenceResponseDto["commitStatus"] | "not_requested";
  readonly approvalRequestId: string;
  readonly generatedAt: string;
  readonly summary: string;
  readonly requirementLabel: string;
  readonly automaticCommitLabel: string;
  readonly evidenceRefCount: number;
}

export interface CodexProposalReviewDiagnosticState {
  readonly checkId: string;
  readonly title: string;
  readonly message: string;
  readonly targetLabel: string;
}

export interface CodexProposalReviewState {
  readonly inputText: string;
  readonly status: CodexProposalReviewRunState;
  readonly statusLabel: string;
  readonly statusDetail: string;
  readonly errorMessage: string | null;
  readonly proposal: CodexProposalReviewProposalState | null;
  readonly validation: CodexProposalReviewValidationState | null;
  readonly diffPreview: CodexProposalReviewDiffState | null;
  readonly rerunValidation: CodexProposalReviewRerunValidationState | null;
  readonly approval: CodexProposalReviewApprovalState;
  readonly proposalDto: CodexRiggingEditProposalDto | null;
  readonly validationResultDto: CodexProposalValidationResultDto | null;
  readonly diffPreviewResultDto: CodexProposalDiffPreviewResultDto | null;
  readonly rerunValidationResultDto: CodexProposalRerunValidationResultDto | null;
  readonly approvalResponseDto: CodexProposalApprovalEvidenceResponseDto | null;
  readonly canRequestApproval: boolean;
  readonly canRecordApproval: boolean;
  readonly canCommitApprovedProposal: boolean;
  readonly commitSafetyLabel: string;
}

export interface ProjectCodexProposalReviewStateInput {
  readonly inputText: string;
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly diffPreviewResult?: CodexProposalDiffPreviewResultDto;
  readonly rerunValidationResult?: CodexProposalRerunValidationResultDto;
  readonly approvalResponse?: CodexProposalApprovalEvidenceResponseDto;
}

export const createEmptyCodexProposalReviewState = (): CodexProposalReviewState => ({
  inputText: "",
  status: "not_loaded",
  statusLabel: "No Codex proposal loaded",
  statusDetail: "No proposal has been submitted to the review surface in this editor session.",
  errorMessage: null,
  proposal: null,
  validation: null,
  diffPreview: null,
  rerunValidation: null,
  approval: createEmptyApprovalState(),
  proposalDto: null,
  validationResultDto: null,
  diffPreviewResultDto: null,
  rerunValidationResultDto: null,
  approvalResponseDto: null,
  canRequestApproval: false,
  canRecordApproval: false,
  canCommitApprovedProposal: false,
  commitSafetyLabel: "No Codex proposal is ready for a manual commit path."
});

export const createCodexProposalReviewInputErrorState = (input: {
  readonly inputText: string;
  readonly message: string;
}): CodexProposalReviewState => ({
  ...createEmptyCodexProposalReviewState(),
  inputText: input.inputText,
  status: "input_error",
  statusLabel: "Proposal input error",
  statusDetail: input.message,
  errorMessage: input.message
});

export const projectCodexProposalReviewState = (
  input: ProjectCodexProposalReviewStateInput
): CodexProposalReviewState => {
  const diffPreviewResult = input.diffPreviewResult ?? null;
  const rerunValidationResult = input.rerunValidationResult ?? null;
  const approvalResponse = input.approvalResponse ?? null;
  const approval = projectApprovalState(approvalResponse);
  const canRequestApproval = canRequestCodexProposalApproval({
    proposal: input.proposal,
    validationResult: input.validationResult,
    diffPreviewResult,
    rerunValidationResult,
    approvalResponse
  });
  const canRecordApproval =
    approvalResponse?.approvalStatus === "requested" &&
    approvalResponse.commitStatus === "needs_approval";
  const canCommitApprovedProposal =
    approvalResponse?.approvalStatus === "approved" &&
    approvalResponse.commitStatus === "approved_not_committed";

  return {
    inputText: input.inputText,
    status: "reviewed",
    statusLabel: `${input.proposal.proposalId} / ${input.validationResult.status}`,
    statusDetail: createReviewStatusDetail({
      validationResult: input.validationResult,
      diffPreviewResult,
      rerunValidationResult,
      approvalResponse
    }),
    errorMessage: null,
    proposal: projectProposalState(input.proposal),
    validation: projectValidationState(input.validationResult),
    diffPreview: diffPreviewResult === null ? null : projectDiffState(diffPreviewResult),
    rerunValidation:
      rerunValidationResult === null ? null : projectRerunValidationState(rerunValidationResult),
    approval,
    proposalDto: input.proposal,
    validationResultDto: input.validationResult,
    diffPreviewResultDto: diffPreviewResult,
    rerunValidationResultDto: rerunValidationResult,
    approvalResponseDto: approvalResponse,
    canRequestApproval,
    canRecordApproval,
    canCommitApprovedProposal,
    commitSafetyLabel: createCommitSafetyLabel({
      canRequestApproval,
      canRecordApproval,
      canCommitApprovedProposal,
      approval
    })
  };
};

const projectProposalState = (
  proposal: CodexRiggingEditProposalDto
): CodexProposalReviewProposalState => ({
  proposalId: proposal.proposalId,
  title: proposal.metadata.title,
  summary: proposal.metadata.summary,
  sourceLabel: `${proposal.source.surface} / ${proposal.source.submittedBy} / ${proposal.source.agentId}`,
  createdAt: proposal.createdAt,
  packageContextLabel: [
    proposal.packageContext.packageId ?? "package id not supplied",
    `base r${proposal.packageContext.basePackageRevision}`,
    proposal.packageContext.packageHash ?? "hash not supplied"
  ].join(" / "),
  preflightContextLabel: [
    proposal.packageContext.productPreflightReportId ?? "preflight report not supplied",
    proposal.packageContext.productPreflightStatus ?? "preflight status not supplied",
    `${proposal.packageContext.validationReportIds.length} validation report refs`
  ].join(" / "),
  approvalPolicyLabel: "User approval required / automatic commit disabled",
  rationale: proposal.metadata.userVisibleRationale ?? "No user-visible rationale supplied.",
  operationCount: proposal.operations.length,
  operations: proposal.operations.map((operation) => ({
    stepId: operation.stepId,
    operationType: operation.operationType,
    operationIdLabel: operation.operationId ?? "operation id not supplied",
    targetLabel: formatTargetRefs(operation.targetRefs),
    expectedPreconditionLabel:
      operation.expectedPreconditions.length === 0
        ? "No expected preconditions supplied"
        : operation.expectedPreconditions.map((precondition) =>
            `${precondition.preconditionKind}: ${precondition.summary}`
          ).join(" / "),
    expectedOutcomeLabel: operation.expectedOutcome?.summary ?? "No expected outcome supplied"
  }))
});

const projectValidationState = (
  validation: CodexProposalValidationResultDto
): CodexProposalReviewValidationState => ({
  status: validation.status,
  statusLabel: `${validation.status} / preview ${formatBoolean(validation.canPreview)} / approval ${formatBoolean(validation.canRequestApproval)}`,
  summary: validation.summary,
  checkedAt: validation.checkedAt,
  catalogLabel: validation.catalogId ?? "catalog not supplied",
  previewLabel: validation.canPreview ? "Preview available" : "Preview unavailable",
  approvalLabel: validation.canRequestApproval
    ? "Approval request available after preview and rerun validation"
    : "Approval request unavailable",
  operationResults: validation.operationResults.map((operationResult) => ({
    stepId: operationResult.stepId,
    operationType: operationResult.operationType,
    status: operationResult.status,
    issueLabel:
      operationResult.issueIds.length === 0
        ? "No validation issues"
        : operationResult.issueIds.join(", "),
    targetLabel: formatTargetRefs(operationResult.checkedTargetRefs)
  })),
  issues: validation.issues.map(projectIssueState),
  evidenceRefCount: validation.evidenceRefs.length
});

const projectIssueState = (
  issue: CodexProposalValidationIssueDto
): CodexProposalReviewIssueState => ({
  issueId: issue.issueId,
  title: `${issue.code} / ${issue.severity}${issue.stepId === undefined ? "" : ` / ${issue.stepId}`}`,
  message: issue.message,
  targetLabel: issue.target === undefined ? "No target ref" : formatTargetRef(issue.target),
  diagnosticLabel:
    issue.diagnosticRefs.length === 0
      ? "No diagnostic refs"
      : issue.diagnosticRefs.map((ref) =>
          ref.reportId === undefined ? ref.checkId : `${ref.reportId}:${ref.checkId}`
        ).join(", ")
});

const projectDiffState = (
  diff: CodexProposalDiffPreviewResultDto
): CodexProposalReviewDiffState => ({
  status: diff.status,
  statusLabel: `${diff.status} / ${diff.previewId}`,
  summary: diff.summary,
  previewId: diff.previewId,
  generatedAt: diff.generatedAt,
  revisionLabel:
    diff.previewPackageRevision === undefined
      ? `base r${diff.basePackageRevision}; preview revision not available`
      : `base r${diff.basePackageRevision}; preview r${diff.previewPackageRevision}`,
  previewSafetyLabel: diff.previewOnly && !diff.committed
    ? "Preview only / not committed"
    : "Preview state is not approval-safe",
  modelDiffLabel: formatModelDiff(diff.modelDiff),
  runtimeDiffLabel:
    diff.runtimeDiff === undefined
      ? "No runtime diff"
      : `${diff.runtimeDiff.parameterChanges.length} parameter / ${diff.runtimeDiff.drawableChanges.length} drawable changes`,
  validationDiffLabel:
    diff.validationDiff === undefined
      ? "No validation diff"
      : `${diff.validationDiff.newFailures.length} new / ${diff.validationDiff.resolvedFailures.length} resolved failures`,
  diagnostics: diff.diagnostics.map(projectDiagnosticState),
  evidenceRefCount: diff.evidenceRefs.length
});

const projectRerunValidationState = (
  rerun: CodexProposalRerunValidationResultDto
): CodexProposalReviewRerunValidationState => ({
  status: rerun.status,
  statusLabel: `${rerun.status} / ${rerun.stateScope}`,
  summary: rerun.summary,
  generatedAt: rerun.generatedAt,
  scopeLabel:
    rerun.previewId === undefined
      ? rerun.stateScope
      : `${rerun.stateScope} / ${rerun.previewId}`,
  productPreflightLabel:
    rerun.productPreflightReport === undefined
      ? "No Product Preflight report embedded"
      : [
          rerun.productPreflightReport.reportId,
          rerun.productPreflightReport.summary.status,
          `${rerun.productPreflightReport.packageId} r${rerun.productPreflightReport.packageRevision}`
        ].join(" / "),
  validationDiffLabel:
    rerun.validationDiff === undefined
      ? "No validation diff"
      : `${rerun.validationDiff.newFailures.length} new / ${rerun.validationDiff.resolvedFailures.length} resolved failures`,
  diagnostics: rerun.diagnostics.map(projectDiagnosticState),
  evidenceRefCount: rerun.evidenceRefs.length
});

const projectApprovalState = (
  approval: CodexProposalApprovalEvidenceResponseDto | null
): CodexProposalReviewApprovalState => {
  if (approval === null) {
    return createEmptyApprovalState();
  }

  return {
    approvalStatus: approval.approvalStatus,
    commitStatus: approval.commitStatus,
    approvalRequestId: approval.approvalRequestId,
    generatedAt: approval.generatedAt,
    summary: approval.summary,
    requirementLabel: approval.requiresUserApproval
      ? "User approval required"
      : "User approval not required",
    automaticCommitLabel: "Automatic commit disabled",
    evidenceRefCount: approval.evidenceRefs.length
  };
};

const createEmptyApprovalState = (): CodexProposalReviewApprovalState => ({
  approvalStatus: "not_requested",
  commitStatus: "not_requested",
  approvalRequestId: "not requested",
  generatedAt: "not generated",
  summary: "Approval has not been requested for a Codex proposal.",
  requirementLabel: "User approval required",
  automaticCommitLabel: "Automatic commit disabled",
  evidenceRefCount: 0
});

const projectDiagnosticState = (
  diagnostic: DiagnosticDto
): CodexProposalReviewDiagnosticState => ({
  checkId: diagnostic.checkId,
  title: `${diagnostic.status} / ${diagnostic.severity}`,
  message: diagnostic.message,
  targetLabel: diagnostic.target === undefined ? "No target ref" : formatTargetRef(diagnostic.target)
});

const canRequestCodexProposalApproval = (input: {
  readonly proposal: CodexRiggingEditProposalDto;
  readonly validationResult: CodexProposalValidationResultDto;
  readonly diffPreviewResult: CodexProposalDiffPreviewResultDto | null;
  readonly rerunValidationResult: CodexProposalRerunValidationResultDto | null;
  readonly approvalResponse: CodexProposalApprovalEvidenceResponseDto | null;
}): boolean =>
  input.proposal.approvalPolicy.requiresUserApproval &&
  !input.proposal.approvalPolicy.allowAutomaticCommit &&
  input.validationResult.status === "valid" &&
  input.validationResult.canRequestApproval &&
  input.validationResult.approvalGate.approvalReady &&
  input.diffPreviewResult?.status === "ready" &&
  input.diffPreviewResult.previewOnly &&
  !input.diffPreviewResult.committed &&
  input.rerunValidationResult?.status === "pass" &&
  input.approvalResponse === null;

const createReviewStatusDetail = (input: {
  readonly validationResult: CodexProposalValidationResultDto;
  readonly diffPreviewResult: CodexProposalDiffPreviewResultDto | null;
  readonly rerunValidationResult: CodexProposalRerunValidationResultDto | null;
  readonly approvalResponse: CodexProposalApprovalEvidenceResponseDto | null;
}): string => [
  `validation ${input.validationResult.status}`,
  `diff ${input.diffPreviewResult?.status ?? "not_evaluated"}`,
  `rerun ${input.rerunValidationResult?.status ?? "not_evaluated"}`,
  `approval ${input.approvalResponse?.approvalStatus ?? "not_requested"}`,
  `commit ${input.approvalResponse?.commitStatus ?? "not_requested"}`
].join(" / ");

const createCommitSafetyLabel = (input: {
  readonly canRequestApproval: boolean;
  readonly canRecordApproval: boolean;
  readonly canCommitApprovedProposal: boolean;
  readonly approval: CodexProposalReviewApprovalState;
}): string => {
  if (input.canCommitApprovedProposal) {
    return "Manual commit is available only after the recorded user approval.";
  }

  if (input.canRecordApproval) {
    return "User approval can be recorded; no commit has occurred.";
  }

  if (input.canRequestApproval) {
    return "Approval can be requested; automatic commit remains disabled.";
  }

  return `${input.approval.requirementLabel} / ${input.approval.automaticCommitLabel}.`;
};

const formatModelDiff = (modelDiff: ModelDiffDto | undefined): string => {
  if (modelDiff === undefined) {
    return "No model diff";
  }

  return [
    `${modelDiff.added.length} added`,
    `${modelDiff.removed.length} removed`,
    `${modelDiff.changed.length} changed`,
    `${modelDiff.operationIds.length} operation ids`
  ].join(" / ");
};

const formatTargetRefs = (targetRefs: readonly TargetRefDto[]): string =>
  targetRefs.length === 0
    ? "No target refs"
    : targetRefs.map(formatTargetRef).join(", ");

const formatTargetRef = (targetRef: TargetRefDto): string =>
  `${targetRef.kind}:${targetRef.id}${targetRef.path === undefined ? "" : ` ${targetRef.path}`}`;

const formatBoolean = (value: boolean): string => value ? "yes" : "no";
