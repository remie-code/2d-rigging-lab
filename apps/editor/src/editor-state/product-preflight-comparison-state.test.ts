import { createProductPreflightRerunAffordanceResponse } from "@private-2d-rigging-lab/ai-interface";
import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  type ProductPreflightCategoryDto,
  type ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import { buildProductPreflightReportDiff } from "@private-2d-rigging-lab/validator-core";
import { describe, expect, it } from "vitest";

import { projectProductPreflightComparisonState } from "./product-preflight-comparison-state.js";

describe("Product Preflight comparison state", () => {
  it("projects deterministic report diff summaries and evidence refs for the editor", () => {
    const previousReport = createProductPreflightReport({
      reportId: "preflight_previousComparison",
      packageRevision: 7
    });
    const currentReport = createProductPreflightReport({
      reportId: "preflight_currentComparison",
      packageRevision: 8,
      warnCategory: "meshTopologyUv"
    });
    const proposalPreviewReport = createProductPreflightReport({
      reportId: "preflight_proposalPreviewComparison",
      packageRevision: 9
    });
    const generatedAt = "2026-06-05T00:00:00.000Z";
    const currentRerunAffordance = createProductPreflightRerunAffordanceResponse({
      report: currentReport,
      generatedAt
    });
    const proposalRerunAffordance = createProductPreflightRerunAffordanceResponse({
      report: proposalPreviewReport,
      generatedAt
    });

    const state = projectProductPreflightComparisonState({
      generatedAt,
      currentReport,
      currentRerunAffordance,
      previousReport,
      proposalPreviewReport,
      proposalPreviewRerunAffordance: proposalRerunAffordance,
      comparisons: [
        {
          comparisonKind: "previousToCurrent",
          diff: buildProductPreflightReportDiff({
            beforeReport: previousReport,
            afterReport: currentReport,
            rerunAffordance: currentRerunAffordance
          })
        },
        {
          comparisonKind: "currentToProposalPreview",
          diff: buildProductPreflightReportDiff({
            beforeReport: currentReport,
            afterReport: proposalPreviewReport,
            rerunAffordance: proposalRerunAffordance
          })
        }
      ],
      safety: {
        sessionGeneratedReportsOnly: true,
        automaticRerunAllowed: false,
        autoFixAllowed: false,
        automaticCommitAllowed: false
      }
    });

    expect(state.status).toBe("ready");
    expect(state.summaryLabel).toContain("2 deterministic report comparisons");
    expect(state.reportSlots.map((slot) => slot.reportIdLabel)).toContain(
      "preflight_proposalPreviewComparison"
    );
    expect(state.comparisons[0]?.statusTransitionLabel).toBe("pass -> warn");
    expect(state.comparisons[0]?.categoryTransitions).toContainEqual(
      expect.objectContaining({
        category: "meshTopologyUv",
        statusLabel: "pass -> warn",
        changedLabel: "changed"
      })
    );
    expect(state.comparisons[0]?.evidenceRefChanges[0]?.meta).toContain(
      "validationReport"
    );
    expect(state.comparisons[0]?.diagnosticRefChanges[0]?.detail).toContain(
      "mesh.topology.needsReview"
    );
    expect(state.rerunAffordances[0]?.triggerLabel).toContain("manual request available");
    expect(state.rerunAffordances[0]?.safetyLabel).toContain("Automatic rerun disabled");
    expect(JSON.stringify(state).toLowerCase()).not.toContain("auto-fix");
  });
});

const createProductPreflightReport = (input: {
  readonly reportId: string;
  readonly packageRevision: number;
  readonly warnCategory?: ProductPreflightCategoryDto;
}): ProductPreflightReportDto => {
  const categories = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) =>
    category === input.warnCategory
      ? createWarningCategory(category)
      : {
          category,
          status: "pass",
          severity: "info",
          summary: `${category} passes.`
        }
  );
  const warnCount = input.warnCategory === undefined ? 0 : 1;

  return ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId: input.reportId,
    createdAt: "2026-06-05T00:00:00.000Z",
    packageId: "pkg_preflightComparison",
    packageRevision: input.packageRevision,
    validatorVersion: "validator-test",
    sourceValidationReportIds: warnCount === 0 ? [] : ["val_preflightComparison"],
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
      evidenceRefCount: warnCount,
      diagnosticRefCount: warnCount
    },
    categories
  });
};

const createWarningCategory = (category: ProductPreflightCategoryDto) => ({
  category,
  status: "warn",
  severity: "warning",
  summary: `${category} needs deterministic evidence review.`,
  evidenceRefs: [{
    evidenceId: "evidence_preflightComparison",
    artifactRef: {
      artifactKind: "validationReport",
      path: "validation/reports/val_preflightComparison.validation.json",
      reportId: "val_preflightComparison"
    },
    target: {
      kind: "mesh",
      id: "mesh_preflightComparison"
    },
    summary: "Validation report evidence is available for deterministic comparison.",
    producer: "validatorCore"
  }],
  diagnosticRefs: [{
    checkId: "mesh.topology.needsReview",
    reportId: "val_preflightComparison",
    diagnosticIndex: 0,
    status: "needs_review",
    severity: "warning",
    target: {
      kind: "mesh",
      id: "mesh_preflightComparison"
    },
    message: "Mesh topology evidence needs review."
  }],
  recommendedNextActions: [{
    actionId: "action_preflightComparison_rerun",
    actionKind: "rerunPreflight",
    summary: "Run Product Preflight again after evidence changes.",
    targetCategory: category
  }]
});
