import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  PRODUCT_PREFLIGHT_STATUS_VALUES,
  ProductPreflightEvidenceRefDtoSchema,
  ProductPreflightReportDtoSchema,
  ProductPreflightSummaryDtoSchema,
  ProductPreflightStatusDtoSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ProductPreflightCategoryDto,
  ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  buildProductPreflightReport
} from "./product-preflight-report.js";
import type {
  ProductPreflightCategoryEvidenceRefsInput
} from "./product-preflight-report.js";
import { buildValidationReport } from "./report-builder.js";
import {
  ValidationCheckResultSchema,
  ValidationReportEvidenceSchema
} from "./validation-report.js";

const ProductPreflightCategoryDtoSchema = z.enum(PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS);
const productPreflightCategoryIds = new Set<string>(PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS);
const CategoryEvidenceRefsSchema = z.record(
  z.string(),
  z.array(ProductPreflightEvidenceRefDtoSchema)
).default({}).superRefine((categoryEvidenceRefs, context) => {
  for (const category of Object.keys(categoryEvidenceRefs)) {
    if (!productPreflightCategoryIds.has(category)) {
      context.addIssue({
        code: "custom",
        path: [category],
        message: `Unknown product preflight category evidence key "${category}".`
      });
    }
  }
});

const BuildCaseSchema = z.object({
  caseId: ProductPreflightStatusDtoSchema,
  reportId: z.string(),
  validationReport: z.object({
    reportId: z.string(),
    profile: z.enum(["editorIncremental", "viewer", "strict", "acceptance", "aiDryRun"]),
    relatedScenarios: z.array(z.string()).default([]),
    evidence: ValidationReportEvidenceSchema,
    checks: z.array(ValidationCheckResultSchema).default([])
  }).strict(),
  categoryEvidenceRefs: CategoryEvidenceRefsSchema
}).strict();

const BuildCasesFixtureSchema = z.object({
  schemaVersion: z.literal("wave39-product-preflight-build-cases-v1"),
  fixtureId: z.literal("wave39-product-preflight-report-states"),
  createdAt: z.string().datetime(),
  packageId: z.string(),
  packageRevision: z.number().int().nonnegative(),
  cases: z.array(BuildCaseSchema)
}).strict();

const ExpectedCaseSummarySchema = z.object({
  caseId: ProductPreflightStatusDtoSchema,
  expectedReportStatus: ProductPreflightStatusDtoSchema,
  expectedCategoryStatuses: z.record(
    ProductPreflightCategoryDtoSchema,
    ProductPreflightStatusDtoSchema
  ),
  expectedSummary: ProductPreflightSummaryDtoSchema
}).strict();

const ExpectedSummaryFixtureSchema = z.object({
  schemaVersion: z.literal("wave39-product-preflight-state-summary-v1"),
  fixtureId: z.literal("wave39-product-preflight-report-states"),
  expectedCases: z.array(ExpectedCaseSummarySchema)
}).passthrough();

const ExpectedReportEntrySchema = z.object({
  caseId: ProductPreflightStatusDtoSchema,
  expectedStatus: ProductPreflightStatusDtoSchema,
  report: ProductPreflightReportDtoSchema
}).strict();

const ExpectedReportFixtureSchema = z.object({
  schemaVersion: z.literal("wave39-product-preflight-state-reports-v1"),
  fixtureId: z.literal("wave39-product-preflight-report-states"),
  reports: z.array(ExpectedReportEntrySchema)
}).strict();

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave39-product-preflight-report-states"
);

const readJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const buildCasesFixture = BuildCasesFixtureSchema.parse(
  readJson("request/product-preflight-build-cases.json")
);
const expectedSummaryFixture = ExpectedSummaryFixtureSchema.parse(
  readJson("expected/product-preflight-state-summary.json")
);
const expectedReportFixture = ExpectedReportFixtureSchema.parse(
  readJson("expected/product-preflight-state-reports.json")
);
const expectedSummaryByCase = new Map(
  expectedSummaryFixture.expectedCases.map((entry) => [entry.caseId, entry])
);
const expectedReportByCase = new Map(
  expectedReportFixture.reports.map((entry) => [entry.caseId, entry])
);

describe("Wave39 product preflight report fixture aggregation", () => {
  it("aligns request, summary, and full report cases deterministically", () => {
    const expectedCaseOrder = [...PRODUCT_PREFLIGHT_STATUS_VALUES];

    expect(buildCasesFixture.cases.map((entry) => entry.caseId)).toEqual(expectedCaseOrder);
    expect(expectedSummaryFixture.expectedCases.map((entry) => entry.caseId)).toEqual(
      expectedCaseOrder
    );
    expect(expectedReportFixture.reports.map((entry) => entry.caseId)).toEqual(
      expectedCaseOrder
    );
    expect(expectedReportFixture.reports.map((entry) => entry.expectedStatus)).toEqual(
      expectedCaseOrder
    );
  });

  for (const fixtureCase of buildCasesFixture.cases) {
    it(`builds the ${fixtureCase.caseId} product preflight state from semantic fixtures`, () => {
      const expected = expectedSummaryByCase.get(fixtureCase.caseId);
      expect(expected).toBeDefined();
      if (expected === undefined) {
        throw new Error(`Missing expected summary for ${fixtureCase.caseId}.`);
      }
      const expectedReport = expectedReportByCase.get(fixtureCase.caseId);
      expect(expectedReport).toBeDefined();
      if (expectedReport === undefined) {
        throw new Error(`Missing expected full report for ${fixtureCase.caseId}.`);
      }

      const report = buildReportFromFixtureCase(fixtureCase);

      expect(expectedReport.expectedStatus).toBe(expected.expectedReportStatus);
      expect(report.summary).toEqual(expected.expectedSummary);
      expect(statusesByCategory(report.categories)).toEqual(expected.expectedCategoryStatuses);
      expect(report.summary.status).toBe(expected.expectedReportStatus);
      expect(report).toEqual(expectedReport.report);
    });
  }
});

const buildReportFromFixtureCase = (
  fixtureCase: z.infer<typeof BuildCaseSchema>
): ProductPreflightReportDto => {
  const sourceReport = buildValidationReport({
    reportId: fixtureCase.validationReport.reportId,
    createdAt: buildCasesFixture.createdAt,
    packageId: buildCasesFixture.packageId,
    packageRevision: buildCasesFixture.packageRevision,
    profile: fixtureCase.validationReport.profile,
    relatedScenarios: fixtureCase.validationReport.relatedScenarios,
    checks: fixtureCase.validationReport.checks,
    evidence: fixtureCase.validationReport.evidence
  });

  return buildProductPreflightReport({
    reportId: fixtureCase.reportId,
    createdAt: buildCasesFixture.createdAt,
    validationReports: [sourceReport],
    categoryEvidenceRefs: fixtureCase.categoryEvidenceRefs as ProductPreflightCategoryEvidenceRefsInput
  });
};

const statusesByCategory = (
  categories: readonly { readonly category: ProductPreflightCategoryDto; readonly status: string }[]
) => Object.fromEntries(categories.map((category) => [category.category, category.status]));
