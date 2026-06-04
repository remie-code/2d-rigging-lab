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
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { buildProductPreflightReportDiff } from "./product-preflight-report-diff.js";

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
  description: z.string().min(1),
  beforeReport: ReportSpecSchema,
  afterReport: ReportSpecSchema
}).strict();

const RequestFixtureSchema = z.object({
  schemaVersion: z.literal("wave41-product-preflight-diff-cases-v1"),
  fixtureId: z.literal(FIXTURE_ID),
  packageId: z.string().regex(/^pkg_[A-Za-z0-9_-]+$/),
  validatorVersion: z.string().min(1),
  cases: z.array(FixtureCaseSchema).length(EXPECTED_CASE_ORDER.length)
}).passthrough();

const ChangeSelectorSchema = z.record(z.string(), z.unknown());

const ExpectedCaseSchema = z.object({
  caseId: z.enum(EXPECTED_CASE_ORDER),
  expectedDiffId: z.string(),
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
  expectedCaseOrder: z.array(z.enum(EXPECTED_CASE_ORDER)),
  expectedCases: z.array(ExpectedCaseSchema)
}).strict();

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

describe("Wave41 Product Preflight report diff fixtures", () => {
  it("keeps request and expected fixture case order aligned", () => {
    expect(requestFixture.cases.map((fixtureCase) => fixtureCase.caseId)).toEqual([
      ...EXPECTED_CASE_ORDER
    ]);
    expect(expectedFixture.expectedCaseOrder).toEqual([...EXPECTED_CASE_ORDER]);
    expect(expectedFixture.expectedCases.map((fixtureCase) => fixtureCase.caseId)).toEqual([
      ...EXPECTED_CASE_ORDER
    ]);
  });

  for (const fixtureCase of requestFixture.cases) {
    it(`builds expected diff selectors for ${fixtureCase.caseId}`, () => {
      const expected = expectedByCase.get(fixtureCase.caseId);
      expect(expected).toBeDefined();
      if (expected === undefined) {
        throw new Error(`Missing expected Product Preflight diff case ${fixtureCase.caseId}.`);
      }

      const beforeReport = buildReportFromSpec(fixtureCase.beforeReport);
      const afterReport = buildReportFromSpec(fixtureCase.afterReport);
      const diff = buildProductPreflightReportDiff({
        beforeReport,
        afterReport
      });

      expect(diff.diffId).toBe(expected.expectedDiffId);
      expect(diff.generatedAt).toBe(expected.generatedAt);
      expect(diff.scope).toMatchObject({
        scopeKind: "sessionReportPair",
        beforeReportId: beforeReport.reportId,
        afterReportId: afterReport.reportId,
        packageId: requestFixture.packageId,
        beforePackageRevision: beforeReport.packageRevision,
        afterPackageRevision: afterReport.packageRevision,
        sessionGeneratedReportsOnly: true,
        persistedArtifactCreated: false
      });
      expect(diff.summary).toEqual(expected.expectedSummary);
      expect(selectChangedTransitions(diff.categoryStatusTransitions)).toEqual(
        expected.expectedChangedTransitions
      );
      expect(selectBlockingReasonChanges(diff.blockingReasonChanges)).toEqual(
        expected.expectedChanges.blockingReasonChanges
      );
      expect(selectDiagnosticRefChanges(diff.diagnosticRefChanges)).toEqual(
        expected.expectedChanges.diagnosticRefChanges
      );
      expect(selectEvidenceRefChanges(diff.evidenceRefChanges)).toEqual(
        expected.expectedChanges.evidenceRefChanges
      );
      expect(selectRecommendedActionChanges(diff.recommendedActionChanges)).toEqual(
        expected.expectedChanges.recommendedActionChanges
      );
      expect(selectUnsupportedClaimChanges(diff.unsupportedClaimChanges)).toEqual(
        expected.expectedChanges.unsupportedClaimChanges
      );
      expect(selectNotEvaluatedClaimChanges(diff.notEvaluatedClaimChanges)).toEqual(
        expected.expectedChanges.notEvaluatedClaimChanges
      );
      expect(diff.rerunAffordance).toBeUndefined();
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
  summary: `${category} passes in Wave41 diff fixture evidence.`,
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

const selectChangedTransitions = (
  transitions: readonly {
    readonly category: ProductPreflightCategoryDto;
    readonly beforeStatus: ProductPreflightStatusDto;
    readonly afterStatus: ProductPreflightStatusDto;
    readonly beforeSeverity: Severity;
    readonly afterSeverity: Severity;
    readonly statusChanged: boolean;
    readonly severityChanged: boolean;
  }[]
) =>
  transitions
    .filter((transition) => transition.statusChanged || transition.severityChanged)
    .map((transition) => ({
      category: transition.category,
      beforeStatus: transition.beforeStatus,
      afterStatus: transition.afterStatus,
      beforeSeverity: transition.beforeSeverity,
      afterSeverity: transition.afterSeverity
    }));

const selectBlockingReasonChanges = (
  changes: ReturnType<typeof buildProductPreflightReportDiff>["blockingReasonChanges"]
) =>
  changes.map((change) => {
    const item = "before" in change ? change.before : change.after;

    return {
      changeKind: change.changeKind,
      category: change.category,
      reasonId: change.reasonId,
      reasonCode: item.reasonCode
    };
  });

const selectDiagnosticRefChanges = (
  changes: ReturnType<typeof buildProductPreflightReportDiff>["diagnosticRefChanges"]
) =>
  changes.map((change) => {
    const before = "before" in change ? change.before : undefined;
    const after = "after" in change ? change.after : undefined;

    return compactRecord({
      changeKind: change.changeKind,
      ...selectContainer(change.container),
      checkId: change.diagnosticRefKey.checkId,
      beforeMessage: before?.message,
      afterMessage: after?.message
    });
  });

const selectEvidenceRefChanges = (
  changes: ReturnType<typeof buildProductPreflightReportDiff>["evidenceRefChanges"]
) =>
  changes.map((change) => {
    const before = "before" in change ? change.before : undefined;
    const after = "after" in change ? change.after : undefined;

    return compactRecord({
      changeKind: change.changeKind,
      ...selectContainer(change.container),
      evidenceId: change.evidenceId,
      beforePath: before?.artifactRef.path,
      afterPath: after?.artifactRef.path
    });
  });

const selectRecommendedActionChanges = (
  changes: ReturnType<typeof buildProductPreflightReportDiff>["recommendedActionChanges"]
) =>
  changes.map((change) => {
    const action = "before" in change ? change.before : change.after;

    return {
      changeKind: change.changeKind,
      ...selectContainer(change.container),
      actionId: change.actionId,
      actionKind: action.actionKind
    };
  });

const selectUnsupportedClaimChanges = (
  changes: ReturnType<typeof buildProductPreflightReportDiff>["unsupportedClaimChanges"]
) =>
  changes.map((change) => {
    const claim = "before" in change ? change.before : change.after;

    return {
      changeKind: change.changeKind,
      category: change.category,
      claimId: change.claimId,
      claimKind: claim.claimKind
    };
  });

const selectNotEvaluatedClaimChanges = (
  changes: ReturnType<typeof buildProductPreflightReportDiff>["notEvaluatedClaimChanges"]
) =>
  changes.map((change) => {
    const claim = "before" in change ? change.before : change.after;

    return {
      changeKind: change.changeKind,
      category: change.category,
      claimId: change.claimId,
      evidenceKind: claim.evidenceKind
    };
  });

const selectContainer = (container: {
  readonly containerKind: string;
  readonly category?: ProductPreflightCategoryDto;
  readonly reasonId?: string;
  readonly claimId?: string;
}) => compactRecord({
  containerKind: container.containerKind,
  category: container.category,
  reasonId: container.reasonId,
  claimId: container.claimId
});

const compactRecord = (record: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
