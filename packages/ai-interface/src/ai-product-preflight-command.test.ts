import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDiffDtoSchema,
  ProductPreflightReportDtoSchema,
  type ProductPreflightCategoryDto,
  type ProductPreflightReportDiffDto,
  type ProductPreflightReportDto,
  type ProductPreflightRerunAffordanceResponseDto,
  type ProductPreflightStatusDto,
  type Severity
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { AiCommandNameSchema } from "./ai-command-name.js";
import {
  AiProductPreflightCommandRequestSchema,
  AiProductPreflightCommandResponseSchema,
  createProductPreflightRerunAffordanceResponse,
  diffProductPreflightReports,
  readProductPreflightReport
} from "./ai-product-preflight-command.js";
import { AiCommandRequestSchema } from "./ai-command-request.js";

describe("AI Product Preflight command contract", () => {
  it("parses read, diff, and rerun affordance command requests", () => {
    const currentReport = createProductPreflightReport("preflight_current", 7);
    const previousReport = createProductPreflightReport("preflight_previous", 6);

    const readRequest = AiProductPreflightCommandRequestSchema.parse({
      ...createCommandBase("cmd_read_product_preflight", ["read"]),
      command: "readProductPreflightReport",
      payload: {
        report: currentReport
      }
    });
    const diffRequest = AiProductPreflightCommandRequestSchema.parse({
      ...createCommandBase("cmd_diff_product_preflight", ["read", "validate"]),
      command: "diffProductPreflightReports",
      payload: {
        beforeReport: previousReport,
        afterReport: currentReport
      }
    });
    const rerunRequest = AiProductPreflightCommandRequestSchema.parse({
      ...createCommandBase("cmd_preflight_rerun_affordance", ["read"]),
      command: "getProductPreflightRerunAffordance",
      payload: {
        report: currentReport,
        generatedAt: "2026-06-05T00:00:00.000Z"
      }
    });

    expect(readRequest.command).toBe("readProductPreflightReport");
    expect(diffRequest.command).toBe("diffProductPreflightReports");
    expect(rerunRequest).toMatchObject({
      command: "getProductPreflightRerunAffordance",
      payload: {
        status: "available",
        allowedTriggerModes: ["manual", "callerTriggered"]
      }
    });
  });

  it("parses read, diff, and rerun affordance command responses", async () => {
    const previousReport = createProductPreflightReport("preflight_previous", 6);
    const currentReport = createProductPreflightReport("preflight_current", 7, "composition");
    const rerunAffordance = createProductPreflightRerunAffordanceResponse({
      report: currentReport,
      generatedAt: "2026-06-05T00:00:00.000Z"
    });
    const diff = await diffProductPreflightReports({
      beforeReport: previousReport,
      afterReport: currentReport,
      rerunAffordance,
      diffProvider: (providerInput) =>
        createProductPreflightReportDiff({
          beforeReport: providerInput.beforeReport,
          afterReport: providerInput.afterReport,
          ...(providerInput.rerunAffordance === undefined
            ? {}
            : { rerunAffordance: providerInput.rerunAffordance })
        })
    });

    const readResponse = AiProductPreflightCommandResponseSchema.parse({
      ...createResponseBase("cmd_read_product_preflight", "readProductPreflightReport"),
      payload: readProductPreflightReport({ report: currentReport })
    });
    const diffResponse = AiProductPreflightCommandResponseSchema.parse({
      ...createResponseBase("cmd_diff_product_preflight", "diffProductPreflightReports"),
      payload: diff
    });
    const rerunResponse = AiProductPreflightCommandResponseSchema.parse({
      ...createResponseBase(
        "cmd_preflight_rerun_affordance",
        "getProductPreflightRerunAffordance"
      ),
      payload: rerunAffordance
    });

    expect(readResponse).toMatchObject({
      payload: {
        reportId: "preflight_current",
        transcriptEvidenceRefs: []
      }
    });
    expect(diffResponse).toMatchObject({
      payload: {
        scope: {
          beforeReportId: "preflight_previous",
          afterReportId: "preflight_current",
          sessionGeneratedReportsOnly: true,
          persistedArtifactCreated: false
        },
        summary: {
          totalChangeCount: 1
        }
      }
    });
    expect(rerunResponse).toMatchObject({
      payload: {
        canRequestRerun: true,
        automaticRerunAllowed: false,
        autoFixAllowed: false,
        automaticCommitAllowed: false,
        responseShape: {
          sessionGeneratedReportOnly: true,
          persistedArtifactCreated: false
        }
      }
    });
  });

  it("uses an injected diff provider and preserves approval-safe rerun flags", async () => {
    const previousReport = createProductPreflightReport("preflight_previous", 6);
    const currentReport = createProductPreflightReport("preflight_current", 7, "composition");
    const rerunAffordance = createProductPreflightRerunAffordanceResponse({
      report: currentReport,
      generatedAt: "2026-06-05T00:00:00.000Z"
    });
    const providerCalls: ProductPreflightReportDiffDto[] = [];
    const diff = await diffProductPreflightReports({
      beforeReport: previousReport,
      afterReport: currentReport,
      rerunAffordance,
      diffProvider: (providerInput) => {
        const providedDiff = createProductPreflightReportDiff({
          beforeReport: providerInput.beforeReport,
          afterReport: providerInput.afterReport,
          ...(providerInput.rerunAffordance === undefined
            ? {}
            : { rerunAffordance: providerInput.rerunAffordance })
        });
        providerCalls.push(providedDiff);

        return providedDiff;
      }
    });

    expect(providerCalls).toHaveLength(1);
    expect(diff.rerunAffordance).toMatchObject({
      sourceReportId: "preflight_current",
      automaticRerunAllowed: false,
      autoFixAllowed: false,
      automaticCommitAllowed: false
    });
  });

  it("keeps Product Preflight commands out of the legacy executable command union", () => {
    expect(AiCommandNameSchema.safeParse("readProductPreflightReport").success).toBe(false);
    expect(
      AiCommandRequestSchema.safeParse({
        ...createLegacyCommandBase("cmd_read_product_preflight", ["read"]),
        command: "readProductPreflightReport",
        payload: {
          report: createProductPreflightReport("preflight_current", 7)
        }
      }).success
    ).toBe(false);
  });
});

const createCommandBase = (commandId: string, capabilities: readonly string[]) => ({
  schemaVersion: "ai-product-preflight-command-request-v0",
  commandId,
  session: {
    agentId: "agent_codex",
    capabilities
  },
  basis: {
    packageRevision: 7,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  }
} as const);

const createLegacyCommandBase = (commandId: string, capabilities: readonly string[]) => ({
  ...createCommandBase(commandId, capabilities),
  schemaVersion: "ai-command-request-v1"
} as const);

const createResponseBase = (commandId: string, command: string) => ({
  schemaVersion: "ai-product-preflight-command-response-v0",
  commandId,
  status: "ok",
  command
} as const);

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
    packageId: "pkg_preflightCommand",
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

const createProductPreflightReportDiff = (input: {
  readonly beforeReport: ProductPreflightReportDto;
  readonly afterReport: ProductPreflightReportDto;
  readonly rerunAffordance?: ProductPreflightRerunAffordanceResponseDto;
}): ProductPreflightReportDiffDto => {
  const transitions = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) => {
    const beforeCategory = findCategory(input.beforeReport, category);
    const afterCategory = findCategory(input.afterReport, category);

    return {
      category,
      beforeStatus: beforeCategory.status,
      afterStatus: afterCategory.status,
      beforeSeverity: beforeCategory.severity,
      afterSeverity: afterCategory.severity,
      statusChanged: beforeCategory.status !== afterCategory.status,
      severityChanged: beforeCategory.severity !== afterCategory.severity
    };
  });
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

const sanitizeToken = (value: string): string =>
  value.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "report";
