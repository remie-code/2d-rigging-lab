import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDiffDtoSchema,
  ProductPreflightReportDtoSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ProductPreflightBlockingReasonChangeDto,
  ProductPreflightCategoryResultDto,
  ProductPreflightCategoryStatusTransitionDto,
  ProductPreflightDiagnosticRefChangeDto,
  ProductPreflightEvidenceRefChangeDto,
  ProductPreflightNotEvaluatedClaimChangeDto,
  ProductPreflightRecommendedActionChangeDto,
  ProductPreflightReportDiffDto,
  ProductPreflightReportDiffIdDto,
  ProductPreflightReportDiffSummaryDto,
  ProductPreflightReportDto,
  ProductPreflightRerunAffordanceResponseDto,
  ProductPreflightUnsupportedClaimChangeDto
} from "@private-2d-rigging-lab/contracts";

import {
  diffBlockingReasons,
  diffDiagnosticRefs,
  diffEvidenceRefs,
  diffNotEvaluatedClaims,
  diffRecommendedActions,
  diffUnsupportedClaims,
  getCategory,
  indexCategories
} from "./product-preflight-report-diff-changes.js";

export interface ProductPreflightReportDiffBuildInput {
  readonly beforeReport: ProductPreflightReportDto;
  readonly afterReport: ProductPreflightReportDto;
  readonly diffId?: ProductPreflightReportDiffIdDto | string;
  readonly generatedAt?: string;
  readonly rerunAffordance?: ProductPreflightRerunAffordanceResponseDto;
}

type ProductPreflightReportDiffSide = "before" | "after";

export const buildProductPreflightReportDiff = (
  input: ProductPreflightReportDiffBuildInput
): ProductPreflightReportDiffDto => {
  const beforeReport = ProductPreflightReportDtoSchema.parse(input.beforeReport);
  const afterReport = ProductPreflightReportDtoSchema.parse(input.afterReport);

  assertComparableReportScope(beforeReport, afterReport);

  const beforeCategories = indexCategories(beforeReport.categories);
  const afterCategories = indexCategories(afterReport.categories);
  const categoryStatusTransitions = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map(
    (category) => createCategoryStatusTransition(
      getCategory(beforeCategories, category, "before"),
      getCategory(afterCategories, category, "after")
    )
  );
  const blockingReasonChanges = diffBlockingReasons(beforeCategories, afterCategories);
  const diagnosticRefChanges = diffDiagnosticRefs(beforeCategories, afterCategories);
  const evidenceRefChanges = diffEvidenceRefs(beforeCategories, afterCategories);
  const recommendedActionChanges = diffRecommendedActions(
    beforeReport,
    afterReport,
    beforeCategories,
    afterCategories
  );
  const unsupportedClaimChanges = diffUnsupportedClaims(beforeCategories, afterCategories);
  const notEvaluatedClaimChanges = diffNotEvaluatedClaims(beforeCategories, afterCategories);
  const summary = createDiffSummary({
    categoryStatusTransitions,
    blockingReasonChanges,
    diagnosticRefChanges,
    evidenceRefChanges,
    recommendedActionChanges,
    unsupportedClaimChanges,
    notEvaluatedClaimChanges
  });

  return ProductPreflightReportDiffDtoSchema.parse({
    schemaVersion: "product-preflight-report-diff-v0",
    diffId: input.diffId ?? createProductPreflightReportDiffId(beforeReport, afterReport),
    generatedAt: input.generatedAt ?? afterReport.createdAt,
    scope: {
      scopeKind: "sessionReportPair",
      beforeReportId: beforeReport.reportId,
      afterReportId: afterReport.reportId,
      packageId: beforeReport.packageId,
      beforePackageRevision: beforeReport.packageRevision,
      afterPackageRevision: afterReport.packageRevision,
      ...(beforeReport.packageHash === undefined
        ? {}
        : { beforePackageHash: beforeReport.packageHash }),
      ...(afterReport.packageHash === undefined
        ? {}
        : { afterPackageHash: afterReport.packageHash }),
      sessionGeneratedReportsOnly: true,
      persistedArtifactCreated: false
    },
    summary,
    categoryStatusTransitions,
    blockingReasonChanges,
    diagnosticRefChanges,
    evidenceRefChanges,
    recommendedActionChanges,
    unsupportedClaimChanges,
    notEvaluatedClaimChanges,
    ...(input.rerunAffordance === undefined
      ? {}
      : { rerunAffordance: input.rerunAffordance })
  });
};

const assertComparableReportScope = (
  beforeReport: ProductPreflightReportDto,
  afterReport: ProductPreflightReportDto
): void => {
  if (beforeReport.packageId !== afterReport.packageId) {
    throw new Error([
      "Product Preflight report diff requires reports for the same package id.",
      `Received ${beforeReport.packageId} and ${afterReport.packageId}.`
    ].join(" "));
  }
};

const createCategoryStatusTransition = (
  beforeCategory: ProductPreflightCategoryResultDto,
  afterCategory: ProductPreflightCategoryResultDto
): ProductPreflightCategoryStatusTransitionDto => ({
  category: beforeCategory.category,
  beforeStatus: beforeCategory.status,
  afterStatus: afterCategory.status,
  beforeSeverity: beforeCategory.severity,
  afterSeverity: afterCategory.severity,
  statusChanged: beforeCategory.status !== afterCategory.status,
  severityChanged: beforeCategory.severity !== afterCategory.severity
});

const createDiffSummary = (input: {
  readonly categoryStatusTransitions: readonly ProductPreflightCategoryStatusTransitionDto[];
  readonly blockingReasonChanges: readonly ProductPreflightBlockingReasonChangeDto[];
  readonly diagnosticRefChanges: readonly ProductPreflightDiagnosticRefChangeDto[];
  readonly evidenceRefChanges: readonly ProductPreflightEvidenceRefChangeDto[];
  readonly recommendedActionChanges: readonly ProductPreflightRecommendedActionChangeDto[];
  readonly unsupportedClaimChanges: readonly ProductPreflightUnsupportedClaimChangeDto[];
  readonly notEvaluatedClaimChanges: readonly ProductPreflightNotEvaluatedClaimChangeDto[];
}): ProductPreflightReportDiffSummaryDto => {
  const changedCategoryStatusCount = input.categoryStatusTransitions.filter(
    (transition) => transition.statusChanged
  ).length;
  const changedCategorySeverityCount = input.categoryStatusTransitions.filter(
    (transition) => transition.severityChanged
  ).length;
  const changedCategoryTransitionCount = input.categoryStatusTransitions.filter(
    (transition) => transition.statusChanged || transition.severityChanged
  ).length;

  return {
    beforeStatus: deriveReportStatus(input.categoryStatusTransitions, "before"),
    afterStatus: deriveReportStatus(input.categoryStatusTransitions, "after"),
    statusChanged: deriveReportStatus(input.categoryStatusTransitions, "before") !==
      deriveReportStatus(input.categoryStatusTransitions, "after"),
    beforeHighestSeverity: deriveHighestSeverity(input.categoryStatusTransitions, "before"),
    afterHighestSeverity: deriveHighestSeverity(input.categoryStatusTransitions, "after"),
    severityChanged: deriveHighestSeverity(input.categoryStatusTransitions, "before") !==
      deriveHighestSeverity(input.categoryStatusTransitions, "after"),
    categoryStatusTransitionCount: input.categoryStatusTransitions.length,
    changedCategoryStatusCount,
    changedCategorySeverityCount,
    changedCategoryTransitionCount,
    blockingReasonChangeCount: input.blockingReasonChanges.length,
    diagnosticRefChangeCount: input.diagnosticRefChanges.length,
    evidenceRefChangeCount: input.evidenceRefChanges.length,
    recommendedActionChangeCount: input.recommendedActionChanges.length,
    unsupportedClaimChangeCount: input.unsupportedClaimChanges.length,
    notEvaluatedClaimChangeCount: input.notEvaluatedClaimChanges.length,
    totalChangeCount:
      changedCategoryTransitionCount +
      input.blockingReasonChanges.length +
      input.diagnosticRefChanges.length +
      input.evidenceRefChanges.length +
      input.recommendedActionChanges.length +
      input.unsupportedClaimChanges.length +
      input.notEvaluatedClaimChanges.length
  };
};

const deriveReportStatus = (
  transitions: readonly ProductPreflightCategoryStatusTransitionDto[],
  side: ProductPreflightReportDiffSide
) => {
  const statuses = transitions.map((transition) =>
    side === "before" ? transition.beforeStatus : transition.afterStatus
  );
  if (statuses.includes("fail")) {
    return "fail";
  }
  if (statuses.includes("not_supported")) {
    return "not_supported";
  }
  if (statuses.includes("not_evaluated")) {
    return "not_evaluated";
  }
  if (statuses.includes("warn")) {
    return "warn";
  }

  return "pass";
};

const SEVERITY_RANK = {
  info: 0,
  warning: 1,
  error: 2,
  blocking: 3
} as const;

const deriveHighestSeverity = (
  transitions: readonly ProductPreflightCategoryStatusTransitionDto[],
  side: ProductPreflightReportDiffSide
) =>
  transitions.reduce((highest, transition) => {
    const severity = side === "before" ? transition.beforeSeverity : transition.afterSeverity;
    return SEVERITY_RANK[severity] > SEVERITY_RANK[highest] ? severity : highest;
  }, "info" as ProductPreflightCategoryStatusTransitionDto["beforeSeverity"]);

const createProductPreflightReportDiffId = (
  beforeReport: ProductPreflightReportDto,
  afterReport: ProductPreflightReportDto
): ProductPreflightReportDiffIdDto =>
  `preflightDiff_${sanitizeToken(beforeReport.reportId)}_${sanitizeToken(afterReport.reportId)}`;

const sanitizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "report";
