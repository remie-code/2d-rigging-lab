import type { ExplicitPsdImportStatus, ExplicitPsdImportState } from "./explicit-psd-import-state.js";

export type ExplicitPsdImportTaskObservationSchemaVersion =
  "explicit-psd-import-task-observation-v1";

export type ExplicitPsdImportTaskPreviewStatus = "none" | "ready" | "blocked";

export type ExplicitPsdImportTaskApprovalStatus =
  | "none"
  | "notApproved"
  | "approved"
  | "blocked";

export type ExplicitPsdImportTaskStructuralScaffoldApprovalStatus =
  | "none"
  | "approved"
  | "structuralPlanStale"
  | "approvalSelectionMismatch"
  | "preflightBlocked"
  | "structuralExpansionCapExceeded";

export interface ExplicitPsdImportTaskSelectedScopeObservation {
  readonly selectedLayerNodeRefs: readonly string[];
  readonly importPlanScopeRef: string | null;
  readonly structuralScaffoldScopeRef: string | null;
}

export interface ExplicitPsdImportTaskImportPlanObservation {
  readonly previewStatus: ExplicitPsdImportTaskPreviewStatus;
  readonly approvalStatus: ExplicitPsdImportTaskApprovalStatus;
  readonly candidateCount: number;
  readonly eligibleCandidateCount: number;
  readonly approvedCount: number;
  readonly readyToSubmitApprovedBatch: boolean;
  readonly warningCount: number;
}

export interface ExplicitPsdImportTaskStructuralScaffoldObservation {
  readonly previewStatus: ExplicitPsdImportTaskPreviewStatus;
  readonly approvalStatus: ExplicitPsdImportTaskStructuralScaffoldApprovalStatus;
  readonly approvedGroupCount: number;
  readonly approvedLeafCount: number;
  readonly runtimeHiddenDrawableCount: number;
  readonly readyToCommitStructuralScaffold: boolean;
  readonly warningCount: number;
}

export interface ExplicitPsdImportTaskHumanSummaryObservation {
  readonly text: string;
  readonly warningCount: number;
  readonly detailSurface: "diagnosticsEvidenceView";
}

export interface ExplicitPsdImportTaskEvidenceBoundaryObservation {
  readonly detailSurface: "diagnosticsEvidenceView";
  readonly detailStatus: "empty" | "available";
  readonly parserDiagnosticCount: number;
  readonly importPlanDiagnosticCount: number;
  readonly structuralScaffoldDiagnosticCount: number;
  readonly materializationSummaryCount: number;
  readonly importPlanCandidateDetailCount: number;
  readonly structuralScaffoldNodeDetailCount: number;
  readonly selectedLayerBatchResultEntryCount: number;
  readonly structuralScaffoldResultEntryCount: number;
  readonly rawDetailRefsIncluded: false;
  readonly summary: string;
}

export interface ExplicitPsdImportTaskObservationState {
  readonly schemaVersion: ExplicitPsdImportTaskObservationSchemaVersion;
  readonly sourceLoaded: boolean;
  readonly parseStatus: ExplicitPsdImportStatus;
  readonly selectedScope: ExplicitPsdImportTaskSelectedScopeObservation;
  readonly importPlan: ExplicitPsdImportTaskImportPlanObservation;
  readonly structuralScaffold: ExplicitPsdImportTaskStructuralScaffoldObservation;
  readonly humanSummary: ExplicitPsdImportTaskHumanSummaryObservation;
  readonly evidenceBoundary: ExplicitPsdImportTaskEvidenceBoundaryObservation;
}

export const projectExplicitPsdImportTaskObservation = (
  state: ExplicitPsdImportState
): ExplicitPsdImportTaskObservationState => {
  const importPlan = projectImportPlanObservation(state);
  const structuralScaffold = projectStructuralScaffoldObservation(state);
  const evidenceBoundary = projectEvidenceBoundaryObservation(state);
  const humanWarningCount =
    countWarnings(state.diagnostics) +
    importPlan.warningCount +
    structuralScaffold.warningCount +
    countWarnings(state.selectedLayerBatchIntake.diagnostics) +
    countWarnings(state.structuralScaffoldIntake.diagnostics);

  return {
    schemaVersion: "explicit-psd-import-task-observation-v1",
    sourceLoaded: state.source !== null,
    parseStatus: state.status,
    selectedScope: {
      selectedLayerNodeRefs: [...state.selectedLayerNodeRefs],
      importPlanScopeRef: state.importPlan?.scopeRef ?? null,
      structuralScaffoldScopeRef: state.structuralScaffoldPlan?.scopeRef ?? null
    },
    importPlan,
    structuralScaffold,
    humanSummary: {
      text: projectHumanSummaryText({
        parseStatus: state.status,
        sourceLoaded: state.source !== null,
        importPlan,
        structuralScaffold,
        warningCount: humanWarningCount
      }),
      warningCount: humanWarningCount,
      detailSurface: "diagnosticsEvidenceView"
    },
    evidenceBoundary
  };
};

const projectImportPlanObservation = (
  state: ExplicitPsdImportState
): ExplicitPsdImportTaskImportPlanObservation => {
  const plan = state.importPlan;
  if (plan === null) {
    return {
      previewStatus: "none",
      approvalStatus: "none",
      candidateCount: 0,
      eligibleCandidateCount: 0,
      approvedCount: 0,
      readyToSubmitApprovedBatch: false,
      warningCount: 0
    };
  }

  return {
    previewStatus: plan.status,
    approvalStatus: projectImportPlanApprovalStatus(plan),
    candidateCount: plan.candidateCount,
    eligibleCandidateCount: plan.eligibleCandidateCount,
    approvedCount: plan.approvedCount,
    readyToSubmitApprovedBatch: plan.status === "ready" && plan.approvedCount > 0,
    warningCount: countWarnings(plan.diagnostics)
  };
};

const projectStructuralScaffoldObservation = (
  state: ExplicitPsdImportState
): ExplicitPsdImportTaskStructuralScaffoldObservation => {
  const plan = state.structuralScaffoldPlan;
  if (plan === null) {
    return {
      previewStatus: "none",
      approvalStatus: "none",
      approvedGroupCount: 0,
      approvedLeafCount: 0,
      runtimeHiddenDrawableCount: 0,
      readyToCommitStructuralScaffold: false,
      warningCount: 0
    };
  }

  return {
    previewStatus: plan.status,
    approvalStatus: projectStructuralScaffoldApprovalStatus(plan.approvalStatus),
    approvedGroupCount: plan.approvedGroupCount,
    approvedLeafCount: plan.approvedLeafCount,
    runtimeHiddenDrawableCount: plan.runtimeHiddenDrawableCount,
    readyToCommitStructuralScaffold:
      plan.status === "ready" &&
      plan.approvalStatus === "approved" &&
      plan.approvedLeafCount > 0,
    warningCount: countWarnings(plan.diagnostics)
  };
};

const projectEvidenceBoundaryObservation = (
  state: ExplicitPsdImportState
): ExplicitPsdImportTaskEvidenceBoundaryObservation => {
  const parserDiagnosticCount = state.diagnostics.length;
  const importPlanDiagnosticCount = state.importPlan?.diagnostics.length ?? 0;
  const structuralScaffoldDiagnosticCount =
    state.structuralScaffoldPlan?.diagnostics.length ?? 0;
  const materializationSummaryCount = state.materialization.length;
  const importPlanCandidateDetailCount = state.importPlan?.candidates.length ?? 0;
  const structuralScaffoldNodeDetailCount =
    state.structuralScaffoldPlan?.nodes.length ?? 0;
  const selectedLayerBatchResultEntryCount =
    state.selectedLayerBatchIntake.entryLabels.length;
  const structuralScaffoldResultEntryCount =
    state.structuralScaffoldIntake.entryLabels.length;
  const detailCount =
    parserDiagnosticCount +
    importPlanDiagnosticCount +
    structuralScaffoldDiagnosticCount +
    materializationSummaryCount +
    importPlanCandidateDetailCount +
    structuralScaffoldNodeDetailCount +
    selectedLayerBatchResultEntryCount +
    structuralScaffoldResultEntryCount;

  return {
    detailSurface: "diagnosticsEvidenceView",
    detailStatus: detailCount === 0 ? "empty" : "available",
    parserDiagnosticCount,
    importPlanDiagnosticCount,
    structuralScaffoldDiagnosticCount,
    materializationSummaryCount,
    importPlanCandidateDetailCount,
    structuralScaffoldNodeDetailCount,
    selectedLayerBatchResultEntryCount,
    structuralScaffoldResultEntryCount,
    rawDetailRefsIncluded: false,
    summary: detailCount === 0
      ? "No PSD import evidence details are available yet; detailed refs route to diagnosticsEvidenceView."
      : `${detailCount} PSD import evidence detail groups are available through diagnosticsEvidenceView.`
  };
};

const projectImportPlanApprovalStatus = (
  plan: NonNullable<ExplicitPsdImportState["importPlan"]>
): ExplicitPsdImportTaskApprovalStatus => {
  if (plan.status === "blocked") {
    return "blocked";
  }

  return plan.approvedCount > 0 ? "approved" : "notApproved";
};

const projectStructuralScaffoldApprovalStatus = (
  approvalStatus: NonNullable<ExplicitPsdImportState["structuralScaffoldPlan"]>["approvalStatus"]
): ExplicitPsdImportTaskStructuralScaffoldApprovalStatus => {
  switch (approvalStatus) {
    case "approved":
    case "structuralPlanStale":
    case "approvalSelectionMismatch":
    case "preflightBlocked":
    case "structuralExpansionCapExceeded":
      return approvalStatus;
    default:
      throw new Error(
        `Unsupported PSD structural scaffold approval status for task observation: ${approvalStatus}`
      );
  }
};

const projectHumanSummaryText = (input: {
  readonly parseStatus: ExplicitPsdImportStatus;
  readonly sourceLoaded: boolean;
  readonly importPlan: ExplicitPsdImportTaskImportPlanObservation;
  readonly structuralScaffold: ExplicitPsdImportTaskStructuralScaffoldObservation;
  readonly warningCount: number;
}): string => [
  projectParseSummary(input),
  projectImportPlanSummary(input.importPlan),
  projectStructuralScaffoldSummary(input.structuralScaffold),
  `Warnings: ${input.warningCount}.`,
  "Details: diagnosticsEvidenceView."
].join(" ");

const projectParseSummary = (input: {
  readonly parseStatus: ExplicitPsdImportStatus;
  readonly sourceLoaded: boolean;
}): string => {
  if (!input.sourceLoaded) {
    return "No PSD source loaded.";
  }
  if (input.parseStatus === "parsed") {
    return "PSD source parsed.";
  }
  if (input.parseStatus === "rejected") {
    return "PSD source rejected before parsing.";
  }
  if (input.parseStatus === "failed") {
    return "PSD source parsing failed.";
  }

  return "PSD source loaded.";
};

const projectImportPlanSummary = (
  plan: ExplicitPsdImportTaskImportPlanObservation
): string => {
  if (plan.previewStatus === "none") {
    return "No import-plan preview.";
  }

  return [
    `Import plan ${plan.previewStatus}.`,
    `${plan.approvedCount} approved of ${plan.candidateCount} candidates.`
  ].join(" ");
};

const projectStructuralScaffoldSummary = (
  plan: ExplicitPsdImportTaskStructuralScaffoldObservation
): string => {
  if (plan.previewStatus === "none") {
    return "No structural scaffold preview.";
  }

  return [
    `Structural scaffold ${plan.previewStatus}.`,
    `${plan.approvedGroupCount} approved groups and ${plan.approvedLeafCount} approved leaves.`,
    `${plan.runtimeHiddenDrawableCount} runtime-hidden drawables.`
  ].join(" ");
};

const countWarnings = (
  diagnostics: readonly { readonly severity: string }[]
): number =>
  diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
