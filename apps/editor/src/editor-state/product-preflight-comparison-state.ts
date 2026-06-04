import type {
  ProductPreflightDiagnosticRefDto,
  ProductPreflightDiagnosticRefChangeDto,
  ProductPreflightDiffContainerDto,
  ProductPreflightEvidenceRefChangeDto,
  ProductPreflightReportDiffDto,
  ProductPreflightReportDto,
  ProductPreflightRerunAffordanceResponseDto,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

export type ProductPreflightComparisonRunState = "not_available" | "ready" | "failed";

export type ProductPreflightComparisonReportSlotKind =
  | "current"
  | "previous"
  | "proposalPreview";

export interface ProductPreflightComparisonReportSlotState {
  readonly slotKind: ProductPreflightComparisonReportSlotKind;
  readonly label: string;
  readonly available: boolean;
  readonly reportIdLabel: string;
  readonly statusLabel: string;
  readonly packageLabel: string;
  readonly refCountLabel: string;
}

export interface ProductPreflightComparisonRerunAffordanceState {
  readonly label: string;
  readonly sourceReportId: string;
  readonly statusLabel: string;
  readonly triggerLabel: string;
  readonly safetyLabel: string;
}

export interface ProductPreflightComparisonTransitionState {
  readonly category: string;
  readonly statusLabel: string;
  readonly severityLabel: string;
  readonly changedLabel: string;
}

export interface ProductPreflightComparisonRefChangeState {
  readonly title: string;
  readonly detail: string;
  readonly meta: string;
}

export type ProductPreflightComparisonKind =
  | "previousToCurrent"
  | "currentToProposalPreview";

export interface ProductPreflightComparisonDiffState {
  readonly comparisonKind: ProductPreflightComparisonKind;
  readonly title: string;
  readonly reportLabel: string;
  readonly statusTransitionLabel: string;
  readonly severityTransitionLabel: string;
  readonly changeCountLabel: string;
  readonly categoryTransitions: readonly ProductPreflightComparisonTransitionState[];
  readonly evidenceRefChanges: readonly ProductPreflightComparisonRefChangeState[];
  readonly diagnosticRefChanges: readonly ProductPreflightComparisonRefChangeState[];
}

export interface ProductPreflightComparisonState {
  readonly status: ProductPreflightComparisonRunState;
  readonly generatedAt: string | null;
  readonly summaryLabel: string;
  readonly safetyLabel: string;
  readonly reportSlots: readonly ProductPreflightComparisonReportSlotState[];
  readonly rerunAffordances: readonly ProductPreflightComparisonRerunAffordanceState[];
  readonly comparisons: readonly ProductPreflightComparisonDiffState[];
  readonly errorMessage: string | null;
}

export interface ProductPreflightComparisonProjectionInput {
  readonly generatedAt: string;
  readonly currentReport: ProductPreflightReportDto;
  readonly currentRerunAffordance: ProductPreflightRerunAffordanceResponseDto;
  readonly previousReport?: ProductPreflightReportDto | null;
  readonly proposalPreviewReport?: ProductPreflightReportDto | null;
  readonly proposalPreviewRerunAffordance?: ProductPreflightRerunAffordanceResponseDto | null;
  readonly comparisons: readonly {
    readonly comparisonKind: ProductPreflightComparisonKind;
    readonly diff: ProductPreflightReportDiffDto;
  }[];
  readonly safety: {
    readonly sessionGeneratedReportsOnly: true;
    readonly automaticRerunAllowed: false;
    readonly autoFixAllowed: false;
    readonly automaticCommitAllowed: false;
  };
}

export const createEmptyProductPreflightComparisonState =
  (): ProductPreflightComparisonState => ({
    status: "not_available",
    generatedAt: null,
    summaryLabel: "Run Product Preflight to create a deterministic report comparison.",
    safetyLabel: "No Product Preflight reports are available for comparison.",
    reportSlots: [
      createMissingReportSlot("current"),
      createMissingReportSlot("previous"),
      createMissingReportSlot("proposalPreview")
    ],
    rerunAffordances: [],
    comparisons: [],
    errorMessage: null
  });

export const createFailedProductPreflightComparisonState = (
  message: string
): ProductPreflightComparisonState => ({
  ...createEmptyProductPreflightComparisonState(),
  status: "failed",
  summaryLabel: "Product Preflight deterministic report comparison failed.",
  safetyLabel: "Comparison output was not updated.",
  errorMessage: message
});

export const projectProductPreflightComparisonState = (
  input: ProductPreflightComparisonProjectionInput
): ProductPreflightComparisonState => {
  const previousReport = input.previousReport ?? null;
  const proposalPreviewReport = input.proposalPreviewReport ?? null;
  const proposalPreviewRerunAffordance = input.proposalPreviewRerunAffordance ?? null;
  const totalChangeCount = input.comparisons.reduce(
    (total, comparison) => total + comparison.diff.summary.totalChangeCount,
    0
  );
  const comparisons = input.comparisons.map(projectComparisonDiffState);

  return {
    status: "ready",
    generatedAt: input.generatedAt,
    summaryLabel: [
      `${comparisons.length} deterministic report comparison${comparisons.length === 1 ? "" : "s"}`,
      `${totalChangeCount} structural change${totalChangeCount === 1 ? "" : "s"}`
    ].join(" / "),
    safetyLabel: input.safety.sessionGeneratedReportsOnly &&
      !input.safety.automaticRerunAllowed &&
      !input.safety.autoFixAllowed &&
      !input.safety.automaticCommitAllowed
      ? "Session-generated reports; manual rerun only; automatic commit disabled."
      : "Comparison safety flags require review.",
    reportSlots: [
      projectReportSlot("current", input.currentReport),
      previousReport === null
        ? createMissingReportSlot("previous")
        : projectReportSlot("previous", previousReport),
      proposalPreviewReport === null
        ? createMissingReportSlot("proposalPreview")
        : projectReportSlot("proposalPreview", proposalPreviewReport)
    ],
    rerunAffordances: [
      projectRerunAffordance("Current report rerun", input.currentRerunAffordance),
      ...(proposalPreviewRerunAffordance === null
        ? []
        : [projectRerunAffordance("Proposal-preview rerun", proposalPreviewRerunAffordance)])
    ],
    comparisons,
    errorMessage: null
  };
};

const projectComparisonDiffState = (
  input: ProductPreflightComparisonProjectionInput["comparisons"][number]
): ProductPreflightComparisonDiffState => {
  const diff = input.diff;
  const title = comparisonTitle(input.comparisonKind);

  return {
    comparisonKind: input.comparisonKind,
    title,
    reportLabel: `${diff.scope.beforeReportId} -> ${diff.scope.afterReportId}`,
    statusTransitionLabel: `${diff.summary.beforeStatus} -> ${diff.summary.afterStatus}`,
    severityTransitionLabel:
      `${diff.summary.beforeHighestSeverity} -> ${diff.summary.afterHighestSeverity}`,
    changeCountLabel: [
      `${diff.summary.totalChangeCount} total`,
      `${diff.summary.changedCategoryTransitionCount} category`,
      `${diff.summary.evidenceRefChangeCount} evidence ref`,
      `${diff.summary.diagnosticRefChangeCount} diagnostic ref`,
      `${diff.summary.recommendedActionChangeCount} action`,
      `${diff.summary.unsupportedClaimChangeCount} unsupported`,
      `${diff.summary.notEvaluatedClaimChangeCount} not_evaluated`
    ].join(" / "),
    categoryTransitions: diff.categoryStatusTransitions.map((transition) => ({
      category: transition.category,
      statusLabel: `${transition.beforeStatus} -> ${transition.afterStatus}`,
      severityLabel: `${transition.beforeSeverity} -> ${transition.afterSeverity}`,
      changedLabel:
        transition.statusChanged || transition.severityChanged
          ? "changed"
          : "unchanged"
    })),
    evidenceRefChanges: diff.evidenceRefChanges.map(projectEvidenceRefChangeState),
    diagnosticRefChanges: diff.diagnosticRefChanges.map(projectDiagnosticRefChangeState)
  };
};

const projectReportSlot = (
  slotKind: ProductPreflightComparisonReportSlotKind,
  report: ProductPreflightReportDto
): ProductPreflightComparisonReportSlotState => ({
  slotKind,
  label: reportSlotLabel(slotKind),
  available: true,
  reportIdLabel: report.reportId,
  statusLabel: `${report.summary.status} / ${report.summary.highestSeverity}`,
  packageLabel: `${report.packageId} r${report.packageRevision}; created ${report.createdAt}`,
  refCountLabel: `${report.summary.evidenceRefCount} evidence refs / ${report.summary.diagnosticRefCount} diagnostic refs`
});

const createMissingReportSlot = (
  slotKind: ProductPreflightComparisonReportSlotKind
): ProductPreflightComparisonReportSlotState => ({
  slotKind,
  label: reportSlotLabel(slotKind),
  available: false,
  reportIdLabel: "not available",
  statusLabel: "not available",
  packageLabel: "not available",
  refCountLabel: "0 evidence refs / 0 diagnostic refs"
});

const projectRerunAffordance = (
  label: string,
  affordance: ProductPreflightRerunAffordanceResponseDto
): ProductPreflightComparisonRerunAffordanceState => ({
  label,
  sourceReportId: affordance.sourceReportId,
  statusLabel: affordance.canRequestRerun
    ? `${affordance.status} / Product Preflight rerun can be requested manually.`
    : `${affordance.status} / Product Preflight rerun is blocked.`,
  triggerLabel: affordance.canRequestRerun
    ? `manual request available: ${affordance.allowedTriggerModes.join(", ")}`
    : `manual request blocked: ${affordance.blockingReasons.map((reason) =>
        reason.message
      ).join(" / ") || "no blocker detail"}`,
  safetyLabel:
    !affordance.automaticRerunAllowed && !affordance.automaticCommitAllowed
      ? "Automatic rerun disabled / automatic commit disabled"
      : "Automatic behavior flags require review"
});

const projectEvidenceRefChangeState = (
  change: ProductPreflightEvidenceRefChangeDto
): ProductPreflightComparisonRefChangeState => {
  const selectedRef = change.changeKind === "removed" ? change.before : change.after;

  return {
    title: `${change.changeKind} evidence ref ${change.evidenceId}`,
    detail: change.changeKind === "changed"
      ? `${change.before.summary} -> ${change.after.summary}`
      : selectedRef.summary,
    meta: [
      formatContainer(change.container),
      formatArtifactRef(selectedRef.artifactRef),
      selectedRef.target === undefined ? "no target ref" : formatTargetRef(selectedRef.target)
    ].join(" / ")
  };
};

const projectDiagnosticRefChangeState = (
  change: ProductPreflightDiagnosticRefChangeDto
): ProductPreflightComparisonRefChangeState => {
  const selectedRef = change.changeKind === "removed" ? change.before : change.after;

  return {
    title: `${change.changeKind} diagnostic ref ${change.diagnosticRefKey.checkId}`,
    detail: change.changeKind === "changed"
      ? `${formatDiagnosticRef(change.before)} -> ${formatDiagnosticRef(change.after)}`
      : formatDiagnosticRef(selectedRef),
    meta: [
      formatContainer(change.container),
      change.diagnosticRefKey.reportId ?? "no validation report id",
      selectedRef.target === undefined ? "no target ref" : formatTargetRef(selectedRef.target)
    ].join(" / ")
  };
};

const reportSlotLabel = (slotKind: ProductPreflightComparisonReportSlotKind): string => {
  switch (slotKind) {
    case "current":
      return "Current report";
    case "previous":
      return "Previous report";
    case "proposalPreview":
      return "Proposal-preview report";
  }
};

const comparisonTitle = (comparisonKind: ProductPreflightComparisonKind): string => {
  switch (comparisonKind) {
    case "previousToCurrent":
      return "Previous -> current";
    case "currentToProposalPreview":
      return "Current -> proposal preview";
  }
};

const formatContainer = (container: ProductPreflightDiffContainerDto): string => {
  switch (container.containerKind) {
    case "report":
      return "report";
    case "category":
      return `category:${container.category}`;
    case "blockingReason":
      return `blockingReason:${container.category}:${container.reasonId}`;
    case "unsupportedClaim":
      return `unsupportedClaim:${container.category}:${container.claimId}`;
    case "notEvaluatedClaim":
      return `notEvaluatedClaim:${container.category}:${container.claimId}`;
  }
};

const formatArtifactRef = (
  artifactRef: ProductPreflightReportDto["categories"][number]["evidenceRefs"][number]["artifactRef"]
): string => {
  return `${artifactRef.artifactKind}:${artifactRef.path}`;
};

const formatDiagnosticRef = (
  diagnosticRef: ProductPreflightDiagnosticRefDto
): string => [
  diagnosticRef.reportId ?? "no validation report id",
  diagnosticRef.checkId,
  diagnosticRef.status ?? "status not supplied",
  diagnosticRef.severity ?? "severity not supplied",
  diagnosticRef.message ?? "message not supplied"
].join(" / ");

const formatTargetRef = (targetRef: TargetRefDto): string =>
  `${targetRef.kind}:${targetRef.id}${targetRef.path === undefined ? "" : ` ${targetRef.path}`}`;
