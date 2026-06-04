import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightBlockingReasonDtoSchema,
  ProductPreflightCategoryDtoSchema,
  ProductPreflightDiagnosticRefDtoSchema,
  ProductPreflightEvidenceRefDtoSchema,
  ProductPreflightNotEvaluatedClaimDtoSchema,
  ProductPreflightRecommendedActionDtoSchema,
  ProductPreflightReportDiffSummaryDtoSchema,
  ProductPreflightReportDtoSchema,
  ProductPreflightStatusDtoSchema,
  ProductPreflightUnsupportedClaimDtoSchema,
  SeveritySchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ProductPreflightCategoryDto,
  ProductPreflightCategoryResultDto,
  ProductPreflightReportDto,
  ProductPreflightStatusDto,
  Severity
} from "@private-2d-rigging-lab/contracts";
import { buildProductPreflightReportDiff } from "@private-2d-rigging-lab/validator-core";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  createProductPreflightRerunAffordanceResponse,
  diffProductPreflightReports,
  readProductPreflightReport
} from "./ai-product-preflight-command.js";

const FIXTURE_ID = "wave41-product-preflight-diff-fixtures";
const EXPECTED_CASE_ORDER = [
  "no-change",
  "improvement",
  "regression",
  "unsupported-not-evaluated-change",
  "evidence-diagnostic-ref-change"
] as const;

type FixtureCaseId = typeof EXPECTED_CASE_ORDER[number];

const CategoryOverrideSchema = z.object({
  category: ProductPreflightCategoryDtoSchema,
  status: ProductPreflightStatusDtoSchema,
  severity: SeveritySchema,
  summary: z.string().min(1),
  evidenceRefs: z.array(ProductPreflightEvidenceRefDtoSchema).default([]),
  diagnosticRefs: z.array(ProductPreflightDiagnosticRefDtoSchema).default([]),
  blockingReasons: z.array(ProductPreflightBlockingReasonDtoSchema).default([]),
  unsupportedClaims: z.array(ProductPreflightUnsupportedClaimDtoSchema).default([]),
  notEvaluatedClaims: z.array(ProductPreflightNotEvaluatedClaimDtoSchema).default([]),
  recommendedNextActions: z.array(ProductPreflightRecommendedActionDtoSchema).default([])
}).strict();

const ReportSpecSchema = z.object({
  reportId: z.string().regex(/^preflight_[A-Za-z0-9_-]+$/),
  createdAt: z.string().datetime(),
  packageRevision: z.number().int().nonnegative(),
  categoryOverrides: z.array(CategoryOverrideSchema)
}).strict();

const FixtureCaseSchema = z.object({
  caseId: z.enum(EXPECTED_CASE_ORDER),
  beforeReport: ReportSpecSchema,
  afterReport: ReportSpecSchema
}).passthrough();

const RequestFixtureSchema = z.object({
  schemaVersion: z.literal("wave41-product-preflight-diff-cases-v1"),
  fixtureId: z.literal(FIXTURE_ID),
  packageId: z.string().regex(/^pkg_[A-Za-z0-9_-]+$/),
  validatorVersion: z.string().min(1),
  cases: z.array(FixtureCaseSchema).length(EXPECTED_CASE_ORDER.length)
}).passthrough();

const ExpectedCaseSchema = z.object({
  caseId: z.enum(EXPECTED_CASE_ORDER),
  expectedDiffId: z.string(),
  generatedAt: z.string().datetime(),
  expectedSummary: ProductPreflightReportDiffSummaryDtoSchema
}).passthrough();

const ExpectedFixtureSchema = z.object({
  schemaVersion: z.literal("wave41-product-preflight-diff-case-summary-v1"),
  fixtureId: z.literal(FIXTURE_ID),
  expectedCases: z.array(ExpectedCaseSchema)
}).passthrough();

type CategoryOverride = z.infer<typeof CategoryOverrideSchema>;
type ReportSpec = z.infer<typeof ReportSpecSchema>;
type ExpectedCase = z.infer<typeof ExpectedCaseSchema>;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave41-product-preflight-diff-fixtures"
);

const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const requestFixture = RequestFixtureSchema.parse(
  readJson("request/product-preflight-diff-cases.json")
);
const expectedFixture = ExpectedFixtureSchema.parse(
  readJson("expected/product-preflight-diff-case-summary.json")
);
const expectedByCase = new Map<FixtureCaseId, ExpectedCase>(
  expectedFixture.expectedCases.map((entry) => [entry.caseId, entry])
);

describe("AI Product Preflight command Wave41 diff fixtures", () => {
  for (const fixtureCase of requestFixture.cases) {
    it(`returns fixture diff summary and approval-safe rerun affordance for ${fixtureCase.caseId}`, async () => {
      const expected = expectedByCase.get(fixtureCase.caseId);
      expect(expected).toBeDefined();
      if (expected === undefined) {
        throw new Error(`Missing expected Product Preflight diff case ${fixtureCase.caseId}.`);
      }

      const beforeReport = buildReportFromSpec(fixtureCase.beforeReport);
      const afterReport = buildReportFromSpec(fixtureCase.afterReport);
      const rerunAffordance = createProductPreflightRerunAffordanceResponse({
        report: afterReport,
        generatedAt: expected.generatedAt
      });
      const diff = await diffProductPreflightReports({
        beforeReport,
        afterReport,
        rerunAffordance,
        diffProvider: buildProductPreflightReportDiff
      });
      const readResult = readProductPreflightReport({
        report: afterReport
      });

      expect(readResult).toMatchObject({
        reportId: afterReport.reportId,
        packageId: requestFixture.packageId,
        packageRevision: afterReport.packageRevision,
        summary: {
          status: expected.expectedSummary.afterStatus
        }
      });
      expect(diff.diffId).toBe(expected.expectedDiffId);
      expect(diff.summary).toEqual(expected.expectedSummary);
      expect(diff.rerunAffordance).toMatchObject({
        sourceReportId: afterReport.reportId,
        packageId: requestFixture.packageId,
        packageRevision: afterReport.packageRevision,
        automaticRerunAllowed: false,
        autoFixAllowed: false,
        automaticCommitAllowed: false,
        responseShape: {
          sessionGeneratedReportOnly: true,
          persistedArtifactCreated: false,
          automaticCommitAllowed: false,
          autoFixAllowed: false
        }
      });
    });
  }
});

const buildReportFromSpec = (spec: ReportSpec): ProductPreflightReportDto => {
  const categoryOverrides = new Map<ProductPreflightCategoryDto, CategoryOverride>(
    spec.categoryOverrides.map((override) => [override.category, override])
  );
  const categories = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) =>
    categoryOverrides.get(category) ?? createPassCategory(category)
  );

  return ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId: spec.reportId,
    createdAt: spec.createdAt,
    packageId: requestFixture.packageId,
    packageRevision: spec.packageRevision,
    validatorVersion: requestFixture.validatorVersion,
    sourceValidationReportIds: [],
    summary: deriveReportSummary(categories),
    categories,
    recommendedNextActions: []
  });
};

const createPassCategory = (
  category: ProductPreflightCategoryDto
): ProductPreflightCategoryResultDto => ({
  category,
  status: "pass",
  severity: "info",
  summary: `${category} passes in Wave41 AI command fixture evidence.`,
  evidenceRefs: [],
  diagnosticRefs: [],
  blockingReasons: [],
  unsupportedClaims: [],
  notEvaluatedClaims: [],
  recommendedNextActions: []
});

const deriveReportSummary = (
  categories: readonly ProductPreflightCategoryResultDto[]
) => {
  const categoryCounts: Record<ProductPreflightStatusDto, number> = {
    pass: 0,
    warn: 0,
    fail: 0,
    not_supported: 0,
    not_evaluated: 0
  };

  for (const category of categories) {
    categoryCounts[category.status] += 1;
  }

  return {
    status: deriveReportStatus(categories),
    highestSeverity: deriveHighestSeverity(categories.flatMap(collectCategorySeverities)),
    categoryCounts,
    blockingReasonCount: categories.reduce(
      (total, category) => total + category.blockingReasons.length,
      0
    ),
    unsupportedClaimCount: categories.reduce(
      (total, category) => total + category.unsupportedClaims.length,
      0
    ),
    notEvaluatedClaimCount: categories.reduce(
      (total, category) => total + category.notEvaluatedClaims.length,
      0
    ),
    evidenceRefCount: categories.reduce((total, category) =>
      total +
      category.evidenceRefs.length +
      category.blockingReasons.reduce(
        (reasonTotal, reason) => reasonTotal + reason.evidenceRefs.length,
        0
      ) +
      category.unsupportedClaims.reduce(
        (claimTotal, claim) => claimTotal + claim.evidenceRefs.length,
        0
      ) +
      category.notEvaluatedClaims.reduce(
        (claimTotal, claim) => claimTotal + claim.evidenceRefs.length,
        0
      ), 0),
    diagnosticRefCount: categories.reduce((total, category) =>
      total +
      category.diagnosticRefs.length +
      category.blockingReasons.reduce(
        (reasonTotal, reason) => reasonTotal + reason.diagnosticRefs.length,
        0
      ) +
      category.unsupportedClaims.reduce(
        (claimTotal, claim) => claimTotal + claim.diagnosticRefs.length,
        0
      ) +
      category.notEvaluatedClaims.reduce(
        (claimTotal, claim) => claimTotal + claim.diagnosticRefs.length,
        0
      ), 0)
  };
};

const deriveReportStatus = (
  categories: readonly ProductPreflightCategoryResultDto[]
): ProductPreflightStatusDto => {
  if (categories.some((category) => category.status === "fail")) {
    return "fail";
  }
  if (categories.some((category) => category.status === "not_supported")) {
    return "not_supported";
  }
  if (categories.some((category) => category.status === "not_evaluated")) {
    return "not_evaluated";
  }
  if (categories.some((category) => category.status === "warn")) {
    return "warn";
  }

  return "pass";
};

const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  info: 0,
  warning: 1,
  error: 2,
  blocking: 3
};

const deriveHighestSeverity = (severities: readonly Severity[]): Severity =>
  severities.reduce<Severity>((highest, severity) =>
    SEVERITY_RANK[severity] > SEVERITY_RANK[highest] ? severity : highest, "info");

const collectCategorySeverities = (
  category: ProductPreflightCategoryResultDto
): Severity[] => [
  category.severity,
  ...category.diagnosticRefs.flatMap((diagnosticRef) =>
    diagnosticRef.severity === undefined ? [] : [diagnosticRef.severity]
  ),
  ...category.blockingReasons.map((reason) => reason.severity),
  ...category.blockingReasons.flatMap((reason) =>
    reason.diagnosticRefs.flatMap((diagnosticRef) =>
      diagnosticRef.severity === undefined ? [] : [diagnosticRef.severity]
    )
  ),
  ...category.unsupportedClaims.map((claim) => claim.severity),
  ...category.unsupportedClaims.flatMap((claim) =>
    claim.diagnosticRefs.flatMap((diagnosticRef) =>
      diagnosticRef.severity === undefined ? [] : [diagnosticRef.severity]
    )
  ),
  ...category.notEvaluatedClaims.map((claim) => claim.severity),
  ...category.notEvaluatedClaims.flatMap((claim) =>
    claim.diagnosticRefs.flatMap((diagnosticRef) =>
      diagnosticRef.severity === undefined ? [] : [diagnosticRef.severity]
    )
  )
];
