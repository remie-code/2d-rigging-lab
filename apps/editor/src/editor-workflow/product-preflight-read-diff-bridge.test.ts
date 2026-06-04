import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  CodexProposalRerunValidationResultDtoSchema,
  ProductPreflightReportDiffDtoSchema,
  ProductPreflightReportDtoSchema,
  type CodexProposalRerunValidationResultDto,
  type ProductPreflightCategoryDto,
  type ProductPreflightReportDiffDto,
  type ProductPreflightReportDto,
  type ProductPreflightRerunAffordanceResponseDto,
  type ProductPreflightStatusDto,
  type Severity
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEditorProductPreflightReadDiffBridge } from "./product-preflight-read-diff-bridge.js";

describe("editor Product Preflight read/diff bridge", () => {
  it("compares previous, current, and proposal preview reports through an injected diff provider", async () => {
    const previousReport = createProductPreflightReport("preflight_previous", 6);
    const currentReport = createProductPreflightReport("preflight_current", 7, "composition");
    const proposalPreviewReport = createProductPreflightReport("preflight_preview", 8);
    const proposalPreviewRerunResult =
      createProposalPreviewRerunValidationResult(proposalPreviewReport);
    const providerCalls: {
      readonly beforeReportId: string;
      readonly afterReportId: string;
      readonly rerunAffordanceReportId: string | null;
    }[] = [];

    const result = await createEditorProductPreflightReadDiffBridge({
      previousReport,
      currentReport,
      proposalPreviewRerunResult,
      generatedAt: "2026-06-05T00:00:00.000Z",
      diffProvider: (providerInput) => {
        providerCalls.push({
          beforeReportId: providerInput.beforeReport.reportId,
          afterReportId: providerInput.afterReport.reportId,
          rerunAffordanceReportId: providerInput.rerunAffordance?.sourceReportId ?? null
        });

        return createProductPreflightReportDiff({
          beforeReport: providerInput.beforeReport,
          afterReport: providerInput.afterReport,
          ...(providerInput.rerunAffordance === undefined
            ? {}
            : { rerunAffordance: providerInput.rerunAffordance })
        });
      }
    });

    expect(result).toMatchObject({
      schemaVersion: "editor-product-preflight-read-diff-bridge-v0",
      current: {
        observation: {
          reportId: "preflight_current"
        },
        rerunAffordance: {
          sourceReportId: "preflight_current",
          automaticRerunAllowed: false,
          autoFixAllowed: false,
          automaticCommitAllowed: false
        }
      },
      previous: {
        observation: {
          reportId: "preflight_previous"
        }
      },
      proposalPreview: {
        rerunValidationResult: {
          proposalId: "proposal_preflightBridge",
          stateScope: "preview"
        },
        observation: {
          reportId: "preflight_preview"
        },
        rerunAffordance: {
          sourceReportId: "preflight_preview",
          automaticRerunAllowed: false,
          autoFixAllowed: false,
          automaticCommitAllowed: false
        }
      },
      safety: {
        sessionGeneratedReportsOnly: true,
        persistedArtifactCreated: false,
        automaticRerunAllowed: false,
        autoFixAllowed: false,
        automaticCommitAllowed: false
      }
    });
    expect(providerCalls).toEqual([
      {
        beforeReportId: "preflight_previous",
        afterReportId: "preflight_current",
        rerunAffordanceReportId: "preflight_current"
      },
      {
        beforeReportId: "preflight_current",
        afterReportId: "preflight_preview",
        rerunAffordanceReportId: "preflight_preview"
      }
    ]);
    expect(result.comparisons.map((comparison) => comparison.comparisonKind)).toEqual([
      "previousToCurrent",
      "currentToProposalPreview"
    ]);
    expect(result.comparisons.every((comparison) =>
      comparison.diff.scope.sessionGeneratedReportsOnly &&
      comparison.diff.scope.persistedArtifactCreated === false &&
      comparison.diff.rerunAffordance?.automaticCommitAllowed === false
    )).toBe(true);
  });
});

const createProductPreflightReport = (
  reportId: string,
  packageRevision: number,
  warnCategory?: ProductPreflightCategoryDto
): ProductPreflightReportDto => {
  const warnCount = warnCategory === undefined ? 0 : 1;

  return ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId,
    createdAt: "2026-06-05T00:00:00.000Z",
    packageId: "pkg_preflightBridge",
    packageRevision,
    validatorVersion: "validator-test",
    summary: {
      status: warnCount === 0 ? "pass" : "warn",
      highestSeverity: warnCount === 0 ? "info" : "warning",
      categoryCounts: {
        pass: PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.length - warnCount,
        warn: warnCount,
        fail: 0,
        not_supported: 0,
        not_evaluated: 0
      },
      blockingReasonCount: 0,
      unsupportedClaimCount: 0,
      notEvaluatedClaimCount: 0,
      evidenceRefCount: 0,
      diagnosticRefCount: 0
    },
    categories: PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) => ({
      category,
      status: category === warnCategory ? "warn" : "pass",
      severity: category === warnCategory ? "warning" : "info",
      summary: `${category} ${category === warnCategory ? "has a warning" : "passes"}.`
    }))
  });
};

const createProposalPreviewRerunValidationResult = (
  productPreflightReport: ProductPreflightReportDto
): CodexProposalRerunValidationResultDto =>
  CodexProposalRerunValidationResultDtoSchema.parse({
    schemaVersion: "codex-proposal-rerun-validation-result-v0",
    proposalId: "proposal_preflightBridge",
    previewId: "preview_preflightBridge",
    generatedAt: "2026-06-05T00:00:00.000Z",
    stateScope: "preview",
    status: productPreflightReport.summary.status,
    summary: "Proposal preview Product Preflight was rerun.",
    productPreflightReport
  });

const createProductPreflightReportDiff = (input: {
  readonly beforeReport: ProductPreflightReportDto;
  readonly afterReport: ProductPreflightReportDto;
  readonly rerunAffordance?: ProductPreflightRerunAffordanceResponseDto;
}): ProductPreflightReportDiffDto => {
  const transitions = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) =>
    createTransition(category, input.beforeReport, input.afterReport)
  );
  const beforeStatus = deriveReportStatus(transitions, "before");
  const afterStatus = deriveReportStatus(transitions, "after");
  const beforeHighestSeverity = deriveHighestSeverity(transitions, "before");
  const afterHighestSeverity = deriveHighestSeverity(transitions, "after");
  const changedCategoryStatusCount = transitions.filter((transition) =>
    transition.statusChanged
  ).length;
  const changedCategorySeverityCount = transitions.filter((transition) =>
    transition.severityChanged
  ).length;
  const changedCategoryTransitionCount = transitions.filter((transition) =>
    transition.statusChanged || transition.severityChanged
  ).length;

  return ProductPreflightReportDiffDtoSchema.parse({
    schemaVersion: "product-preflight-report-diff-v0",
    diffId:
      `preflightDiff_${sanitizeToken(input.beforeReport.reportId)}_${sanitizeToken(input.afterReport.reportId)}`,
    generatedAt: "2026-06-05T00:00:00.000Z",
    scope: {
      scopeKind: "sessionReportPair",
      beforeReportId: input.beforeReport.reportId,
      afterReportId: input.afterReport.reportId,
      packageId: input.afterReport.packageId,
      beforePackageRevision: input.beforeReport.packageRevision,
      afterPackageRevision: input.afterReport.packageRevision,
      sessionGeneratedReportsOnly: true,
      persistedArtifactCreated: false
    },
    summary: {
      beforeStatus,
      afterStatus,
      statusChanged: beforeStatus !== afterStatus,
      beforeHighestSeverity,
      afterHighestSeverity,
      severityChanged: beforeHighestSeverity !== afterHighestSeverity,
      categoryStatusTransitionCount: transitions.length,
      changedCategoryStatusCount,
      changedCategorySeverityCount,
      changedCategoryTransitionCount,
      blockingReasonChangeCount: 0,
      diagnosticRefChangeCount: 0,
      evidenceRefChangeCount: 0,
      recommendedActionChangeCount: 0,
      unsupportedClaimChangeCount: 0,
      notEvaluatedClaimChangeCount: 0,
      totalChangeCount: changedCategoryTransitionCount
    },
    categoryStatusTransitions: transitions,
    ...(input.rerunAffordance === undefined
      ? {}
      : { rerunAffordance: input.rerunAffordance })
  });
};

const createTransition = (
  category: ProductPreflightCategoryDto,
  beforeReport: ProductPreflightReportDto,
  afterReport: ProductPreflightReportDto
) => {
  const beforeCategory = findCategory(beforeReport, category);
  const afterCategory = findCategory(afterReport, category);

  return {
    category,
    beforeStatus: beforeCategory.status,
    afterStatus: afterCategory.status,
    beforeSeverity: beforeCategory.severity,
    afterSeverity: afterCategory.severity,
    statusChanged: beforeCategory.status !== afterCategory.status,
    severityChanged: beforeCategory.severity !== afterCategory.severity
  };
};

const findCategory = (
  report: ProductPreflightReportDto,
  category: ProductPreflightCategoryDto
) => {
  const result = report.categories.find((candidate) => candidate.category === category);
  if (result === undefined) {
    throw new Error(`Missing test Product Preflight category ${category}.`);
  }

  return result;
};

const deriveReportStatus = (
  transitions: readonly ReturnType<typeof createTransition>[],
  side: "before" | "after"
): ProductPreflightStatusDto => {
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

const deriveHighestSeverity = (
  transitions: readonly ReturnType<typeof createTransition>[],
  side: "before" | "after"
): Severity => {
  const severityRank: Readonly<Record<Severity, number>> = {
    info: 0,
    warning: 1,
    error: 2,
    blocking: 3
  };

  return transitions.reduce<Severity>((highest, transition) => {
    const severity = side === "before" ? transition.beforeSeverity : transition.afterSeverity;

    return severityRank[severity] > severityRank[highest] ? severity : highest;
  }, "info");
};

const sanitizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "report";
