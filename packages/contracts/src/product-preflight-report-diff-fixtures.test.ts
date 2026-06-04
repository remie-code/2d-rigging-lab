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
  ProductPreflightStatusDtoSchema,
  ProductPreflightUnsupportedClaimDtoSchema,
  SeveritySchema
} from "./index.js";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const FIXTURE_ID = "wave41-product-preflight-diff-fixtures";
const EXPECTED_CASE_ORDER = [
  "no-change",
  "improvement",
  "regression",
  "unsupported-not-evaluated-change",
  "evidence-diagnostic-ref-change"
] as const;

const RightsCleanSchema = z.object({
  source: z.string().min(1),
  realAssetBytes: z.literal(false),
  imageDecode: z.literal(false),
  externalDependency: z.literal(false),
  parserOracle: z.literal(false),
  rendererOracle: z.literal(false),
  pixelOracle: z.literal(false),
  archiveFilesystem: z.literal(false),
  cubismCompatibility: z.literal(false)
}).strict();

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
}).strict().superRefine((reportSpec, context) => {
  const categories = new Set<string>();

  reportSpec.categoryOverrides.forEach((override, index) => {
    if (categories.has(override.category)) {
      context.addIssue({
        code: "custom",
        path: ["categoryOverrides", index, "category"],
        message: `Duplicate category override ${override.category}.`
      });
    }

    categories.add(override.category);
  });
});

const FixtureCaseSchema = z.object({
  caseId: z.enum(EXPECTED_CASE_ORDER),
  description: z.string().min(1),
  beforeReport: ReportSpecSchema,
  afterReport: ReportSpecSchema
}).strict();

const RequestFixtureSchema = z.object({
  schemaVersion: z.literal("wave41-product-preflight-diff-cases-v1"),
  fixtureId: z.literal(FIXTURE_ID),
  packageId: z.string().regex(/^pkg_[A-Za-z0-9_-]+$/),
  validatorVersion: z.string().min(1),
  rightsClean: RightsCleanSchema,
  cases: z.array(FixtureCaseSchema).length(EXPECTED_CASE_ORDER.length)
}).strict();

const ChangeSelectorSchema = z.record(z.string(), z.unknown());

const ExpectedCaseSchema = z.object({
  caseId: z.enum(EXPECTED_CASE_ORDER),
  expectedDiffId: z.string().regex(/^preflightDiff_[A-Za-z0-9_-]+$/),
  generatedAt: z.string().datetime(),
  expectedSummary: ProductPreflightReportDiffSummaryDtoSchema,
  expectedChangedTransitions: z.array(z.object({
    category: ProductPreflightCategoryDtoSchema,
    beforeStatus: ProductPreflightStatusDtoSchema,
    afterStatus: ProductPreflightStatusDtoSchema,
    beforeSeverity: SeveritySchema,
    afterSeverity: SeveritySchema
  }).strict()),
  expectedChanges: z.object({
    blockingReasonChanges: z.array(ChangeSelectorSchema),
    diagnosticRefChanges: z.array(ChangeSelectorSchema),
    evidenceRefChanges: z.array(ChangeSelectorSchema),
    recommendedActionChanges: z.array(ChangeSelectorSchema),
    unsupportedClaimChanges: z.array(ChangeSelectorSchema),
    notEvaluatedClaimChanges: z.array(ChangeSelectorSchema)
  }).strict()
}).strict();

const ExpectedFixtureSchema = z.object({
  schemaVersion: z.literal("wave41-product-preflight-diff-case-summary-v1"),
  fixtureId: z.literal(FIXTURE_ID),
  expectedCaseOrder: z.array(z.enum(EXPECTED_CASE_ORDER)).length(EXPECTED_CASE_ORDER.length),
  expectedCases: z.array(ExpectedCaseSchema).length(EXPECTED_CASE_ORDER.length)
}).strict();

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

describe("Wave41 Product Preflight diff contract fixtures", () => {
  it("registers the representative case order and required category vocabulary", () => {
    expect(requestFixture.cases.map((fixtureCase) => fixtureCase.caseId)).toEqual([
      ...EXPECTED_CASE_ORDER
    ]);
    expect(expectedFixture.expectedCaseOrder).toEqual([...EXPECTED_CASE_ORDER]);
    expect(expectedFixture.expectedCases.map((fixtureCase) => fixtureCase.caseId)).toEqual([
      ...EXPECTED_CASE_ORDER
    ]);
    expect(PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS).toHaveLength(10);
  });

  it("keeps fixture provenance rights-clean and boundary-scoped", () => {
    expect(requestFixture.rightsClean).toMatchObject({
      realAssetBytes: false,
      imageDecode: false,
      externalDependency: false,
      parserOracle: false,
      rendererOracle: false,
      pixelOracle: false,
      archiveFilesystem: false,
      cubismCompatibility: false
    });
  });

  it("keeps expected summary totals aligned with expected selector counts", () => {
    for (const expectedCase of expectedFixture.expectedCases) {
      const expectedChangeCount =
        expectedCase.expectedSummary.changedCategoryTransitionCount +
        expectedCase.expectedChanges.blockingReasonChanges.length +
        expectedCase.expectedChanges.diagnosticRefChanges.length +
        expectedCase.expectedChanges.evidenceRefChanges.length +
        expectedCase.expectedChanges.recommendedActionChanges.length +
        expectedCase.expectedChanges.unsupportedClaimChanges.length +
        expectedCase.expectedChanges.notEvaluatedClaimChanges.length;

      expect(expectedCase.expectedSummary.categoryStatusTransitionCount).toBe(
        PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.length
      );
      expect(expectedCase.expectedSummary.totalChangeCount).toBe(expectedChangeCount);
    }
  });
});
