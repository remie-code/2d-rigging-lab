import type {
  ProductPreflightCategoryDto,
  ProductPreflightReportDto,
  ProductPreflightStatusCountsDto,
  ProductPreflightStatusDto,
  Severity
} from "@private-2d-rigging-lab/contracts";

export type ProductPreflightRunState = "not_run" | "ready" | "failed";

export interface ProductPreflightCategorySummaryState {
  readonly category: ProductPreflightCategoryDto;
  readonly status: ProductPreflightStatusDto;
  readonly severity: Severity;
  readonly summary: string;
  readonly evidenceRefCount: number;
  readonly diagnosticRefCount: number;
  readonly blockingReasonCount: number;
  readonly unsupportedClaimCount: number;
  readonly notEvaluatedClaimCount: number;
}

export interface ProductPreflightBlockingIssueState {
  readonly reasonId: string;
  readonly category: ProductPreflightCategoryDto;
  readonly severity: "error" | "blocking";
  readonly reasonCode: string;
  readonly message: string;
  readonly diagnosticLabel: string;
}

export interface ProductPreflightWarningState {
  readonly id: string;
  readonly category: ProductPreflightCategoryDto;
  readonly severity: Severity;
  readonly status: string;
  readonly message: string;
  readonly diagnosticLabel: string;
}

export interface ProductPreflightUnsupportedClaimState {
  readonly claimId: string;
  readonly category: ProductPreflightCategoryDto;
  readonly severity: Severity;
  readonly claimKind: string;
  readonly capabilityLabel: string;
  readonly explanation: string;
}

export interface ProductPreflightNotEvaluatedClaimState {
  readonly claimId: string;
  readonly category: ProductPreflightCategoryDto;
  readonly severity: Severity;
  readonly evidenceKind: string;
  readonly reason: string;
  readonly requiredEvidenceLabel: string;
}

export interface ProductPreflightState {
  readonly status: ProductPreflightRunState;
  readonly reportId: string | null;
  readonly createdAt: string | null;
  readonly packageId: string | null;
  readonly packageRevision: number | null;
  readonly overallStatus: ProductPreflightStatusDto | "not_run" | "failed";
  readonly highestSeverity: Severity | null;
  readonly categoryCounts: ProductPreflightStatusCountsDto;
  readonly blockingReasonCount: number;
  readonly unsupportedClaimCount: number;
  readonly notEvaluatedClaimCount: number;
  readonly evidenceRefCount: number;
  readonly diagnosticRefCount: number;
  readonly categories: readonly ProductPreflightCategorySummaryState[];
  readonly blockingIssues: readonly ProductPreflightBlockingIssueState[];
  readonly warnings: readonly ProductPreflightWarningState[];
  readonly unsupportedClaims: readonly ProductPreflightUnsupportedClaimState[];
  readonly notEvaluatedClaims: readonly ProductPreflightNotEvaluatedClaimState[];
  readonly errorMessage: string | null;
}

export const createEmptyProductPreflightState = (): ProductPreflightState => ({
  status: "not_run",
  reportId: null,
  createdAt: null,
  packageId: null,
  packageRevision: null,
  overallStatus: "not_run",
  highestSeverity: null,
  categoryCounts: createEmptyStatusCounts(),
  blockingReasonCount: 0,
  unsupportedClaimCount: 0,
  notEvaluatedClaimCount: 0,
  evidenceRefCount: 0,
  diagnosticRefCount: 0,
  categories: [],
  blockingIssues: [],
  warnings: [],
  unsupportedClaims: [],
  notEvaluatedClaims: [],
  errorMessage: null
});

export const createFailedProductPreflightState = (message: string): ProductPreflightState => ({
  ...createEmptyProductPreflightState(),
  status: "failed",
  overallStatus: "failed",
  errorMessage: message
});

export const projectProductPreflightState = (
  report: ProductPreflightReportDto
): ProductPreflightState => ({
  status: "ready",
  reportId: report.reportId,
  createdAt: report.createdAt,
  packageId: report.packageId,
  packageRevision: report.packageRevision,
  overallStatus: report.summary.status,
  highestSeverity: report.summary.highestSeverity,
  categoryCounts: report.summary.categoryCounts,
  blockingReasonCount: report.summary.blockingReasonCount,
  unsupportedClaimCount: report.summary.unsupportedClaimCount,
  notEvaluatedClaimCount: report.summary.notEvaluatedClaimCount,
  evidenceRefCount: report.summary.evidenceRefCount,
  diagnosticRefCount: report.summary.diagnosticRefCount,
  categories: report.categories.map(projectCategorySummary),
  blockingIssues: report.categories.flatMap((category) =>
    category.blockingReasons.map((reason) => ({
      reasonId: reason.reasonId,
      category: category.category,
      severity: reason.severity,
      reasonCode: reason.reasonCode,
      message: reason.message,
      diagnosticLabel: formatDiagnosticRefs(reason.diagnosticRefs)
    }))
  ),
  warnings: report.categories.flatMap(projectWarningStates),
  unsupportedClaims: report.categories.flatMap((category) =>
    category.unsupportedClaims.map((claim) => ({
      claimId: claim.claimId,
      category: category.category,
      severity: claim.severity,
      claimKind: claim.claimKind,
      capabilityLabel: claim.capabilityLabel,
      explanation: claim.explanation
    }))
  ),
  notEvaluatedClaims: report.categories.flatMap((category) =>
    category.notEvaluatedClaims.map((claim) => ({
      claimId: claim.claimId,
      category: category.category,
      severity: claim.severity,
      evidenceKind: claim.evidenceKind,
      reason: claim.reason,
      requiredEvidenceLabel: claim.requiredEvidenceKinds.join(" / ")
    }))
  ),
  errorMessage: null
});

const projectCategorySummary = (
  category: ProductPreflightReportDto["categories"][number]
): ProductPreflightCategorySummaryState => ({
  category: category.category,
  status: category.status,
  severity: category.severity,
  summary: category.summary,
  evidenceRefCount: category.evidenceRefs.length,
  diagnosticRefCount: category.diagnosticRefs.length,
  blockingReasonCount: category.blockingReasons.length,
  unsupportedClaimCount: category.unsupportedClaims.length,
  notEvaluatedClaimCount: category.notEvaluatedClaims.length
});

const projectWarningStates = (
  category: ProductPreflightReportDto["categories"][number]
): readonly ProductPreflightWarningState[] => {
  const warningDiagnosticRefs = category.diagnosticRefs.filter(isWarningDiagnosticRef);

  if (warningDiagnosticRefs.length > 0) {
    return warningDiagnosticRefs.map((diagnosticRef, index) => ({
      id: `${category.category}:${diagnosticRef.checkId}:${index}`,
      category: category.category,
      severity: diagnosticRef.severity ?? category.severity,
      status: diagnosticRef.status ?? category.status,
      message: diagnosticRef.message ?? category.summary,
      diagnosticLabel: formatDiagnosticRefs([diagnosticRef])
    }));
  }

  if (category.status === "warn") {
    return [{
      id: `${category.category}:summary`,
      category: category.category,
      severity: category.severity,
      status: category.status,
      message: category.summary,
      diagnosticLabel: "category summary"
    }];
  }

  return [];
};

const isWarningDiagnosticRef = (
  diagnosticRef: ProductPreflightReportDto["categories"][number]["diagnosticRefs"][number]
): boolean =>
  diagnosticRef.severity === "warning" ||
  diagnosticRef.status === "warning" ||
  diagnosticRef.status === "needs_review";

const createEmptyStatusCounts = (): ProductPreflightStatusCountsDto => ({
  pass: 0,
  warn: 0,
  fail: 0,
  not_supported: 0,
  not_evaluated: 0
});

const formatDiagnosticRefs = (
  diagnosticRefs: readonly ProductPreflightReportDto["categories"][number]["diagnosticRefs"][number][]
): string =>
  diagnosticRefs.length === 0
    ? "no diagnostic ref"
    : diagnosticRefs.map((ref) =>
        ref.reportId === undefined ? ref.checkId : `${ref.reportId}:${ref.checkId}`
      ).join(", ");
