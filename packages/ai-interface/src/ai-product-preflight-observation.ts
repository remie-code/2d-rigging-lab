import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  PackageIdSchema,
  ProductPreflightActionIdDtoSchema,
  ProductPreflightCategoryDtoSchema,
  ProductPreflightEvidenceIdDtoSchema,
  ProductPreflightEvidenceRefDtoSchema,
  ProductPreflightReportDtoSchema,
  ProductPreflightReportIdDtoSchema,
  ProductPreflightStatusDtoSchema,
  ProductPreflightSummaryDtoSchema,
  SeveritySchema,
  type ProductPreflightCategoryDto,
  type ProductPreflightCategoryResultDto,
  type ProductPreflightEvidenceRefDto,
  type ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const ObserveProductPreflightReportPayloadSchema = z.object({
  report: ProductPreflightReportDtoSchema
}).strict();
export type ObserveProductPreflightReportPayload = z.infer<
  typeof ObserveProductPreflightReportPayloadSchema
>;

export const ProductPreflightObservationCategorySchema = z.object({
  category: ProductPreflightCategoryDtoSchema,
  status: ProductPreflightStatusDtoSchema,
  severity: SeveritySchema,
  summary: z.string().min(1),
  evidenceRefIds: z.array(ProductPreflightEvidenceIdDtoSchema),
  diagnosticRefCount: z.number().int().nonnegative(),
  blockingReasonCount: z.number().int().nonnegative(),
  unsupportedClaimCount: z.number().int().nonnegative(),
  notEvaluatedClaimCount: z.number().int().nonnegative(),
  recommendedActionIds: z.array(ProductPreflightActionIdDtoSchema)
}).strict();
export type ProductPreflightObservationCategory = z.infer<
  typeof ProductPreflightObservationCategorySchema
>;

export const ObserveProductPreflightReportResultSchema = z.object({
  schemaVersion: z.literal("ai-product-preflight-observation-v1"),
  reportId: ProductPreflightReportIdDtoSchema,
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().optional(),
  sourceValidationReportIds: z.array(z.string().min(1)),
  summary: ProductPreflightSummaryDtoSchema,
  categories: z.array(ProductPreflightObservationCategorySchema),
  evidenceRefs: z.array(ProductPreflightEvidenceRefDtoSchema),
  transcriptEvidenceRefs: z.array(ProductPreflightEvidenceIdDtoSchema)
}).strict();
export type ObserveProductPreflightReportResult = z.infer<
  typeof ObserveProductPreflightReportResultSchema
>;

export const observeProductPreflightReport = (
  input: ObserveProductPreflightReportPayload
): ObserveProductPreflightReportResult => {
  const report = ProductPreflightReportDtoSchema.parse(input.report);
  const evidenceRefs = collectReportEvidenceRefs(report);
  const transcriptEvidenceRefs = evidenceRefs.map((evidenceRef) => evidenceRef.evidenceId);

  return ObserveProductPreflightReportResultSchema.parse({
    schemaVersion: "ai-product-preflight-observation-v1",
    reportId: report.reportId,
    packageId: report.packageId,
    packageRevision: report.packageRevision,
    ...(report.packageHash === undefined ? {} : { packageHash: report.packageHash }),
    sourceValidationReportIds: [...report.sourceValidationReportIds].sort(),
    summary: report.summary,
    categories: PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((categoryId) =>
      observeCategory(findCategory(report, categoryId))
    ),
    evidenceRefs,
    transcriptEvidenceRefs
  });
};

export const createEmptyProductPreflightObservation = (
  reportInput: ProductPreflightReportDto
): ObserveProductPreflightReportResult => {
  const report = ProductPreflightReportDtoSchema.parse(reportInput);

  return ObserveProductPreflightReportResultSchema.parse({
    schemaVersion: "ai-product-preflight-observation-v1",
    reportId: report.reportId,
    packageId: report.packageId,
    packageRevision: report.packageRevision,
    ...(report.packageHash === undefined ? {} : { packageHash: report.packageHash }),
    sourceValidationReportIds: [],
    summary: {
      status: "not_evaluated",
      highestSeverity: "warning",
      categoryCounts: {
        pass: 0,
        warn: 0,
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
    categories: [],
    evidenceRefs: [],
    transcriptEvidenceRefs: []
  });
};

const observeCategory = (
  category: ProductPreflightCategoryResultDto
): ProductPreflightObservationCategory => {
  const evidenceRefIds = collectCategoryEvidenceRefs(category)
    .map((evidenceRef) => evidenceRef.evidenceId)
    .sort();

  return ProductPreflightObservationCategorySchema.parse({
    category: category.category,
    status: category.status,
    severity: category.severity,
    summary: category.summary,
    evidenceRefIds,
    diagnosticRefCount: countCategoryDiagnosticRefs(category),
    blockingReasonCount: category.blockingReasons.length,
    unsupportedClaimCount: category.unsupportedClaims.length,
    notEvaluatedClaimCount: category.notEvaluatedClaims.length,
    recommendedActionIds: category.recommendedNextActions
      .map((action) => action.actionId)
      .sort()
  });
};

const findCategory = (
  report: ProductPreflightReportDto,
  categoryId: ProductPreflightCategoryDto
): ProductPreflightCategoryResultDto => {
  const category = report.categories.find((candidate) => candidate.category === categoryId);
  if (category === undefined) {
    throw new Error(`Product preflight report is missing category ${categoryId}.`);
  }

  return category;
};

const collectReportEvidenceRefs = (
  report: ProductPreflightReportDto
): readonly ProductPreflightEvidenceRefDto[] =>
  sortAndDedupeEvidenceRefs(report.categories.flatMap(collectCategoryEvidenceRefs));

const collectCategoryEvidenceRefs = (
  category: ProductPreflightCategoryResultDto
): readonly ProductPreflightEvidenceRefDto[] => [
  ...category.evidenceRefs,
  ...category.blockingReasons.flatMap((reason) => reason.evidenceRefs),
  ...category.unsupportedClaims.flatMap((claim) => claim.evidenceRefs),
  ...category.notEvaluatedClaims.flatMap((claim) => claim.evidenceRefs)
];

const sortAndDedupeEvidenceRefs = (
  evidenceRefs: readonly ProductPreflightEvidenceRefDto[]
): readonly ProductPreflightEvidenceRefDto[] => {
  const sortedRefs = [...evidenceRefs]
    .map((evidenceRef) => ProductPreflightEvidenceRefDtoSchema.parse(evidenceRef))
    .sort(compareEvidenceRefs);
  const byEvidenceId = new Map<string, ProductPreflightEvidenceRefDto>();

  for (const evidenceRef of sortedRefs) {
    if (!byEvidenceId.has(evidenceRef.evidenceId)) {
      byEvidenceId.set(evidenceRef.evidenceId, evidenceRef);
    }
  }

  return [...byEvidenceId.values()];
};

const compareEvidenceRefs = (
  left: ProductPreflightEvidenceRefDto,
  right: ProductPreflightEvidenceRefDto
): number =>
  left.evidenceId.localeCompare(right.evidenceId) ||
  formatArtifactRefSortKey(left).localeCompare(formatArtifactRefSortKey(right));

const formatArtifactRefSortKey = (evidenceRef: ProductPreflightEvidenceRefDto): string =>
  `${evidenceRef.artifactRef.artifactKind}:${JSON.stringify(evidenceRef.artifactRef)}`;

const countCategoryDiagnosticRefs = (
  category: ProductPreflightCategoryResultDto
): number =>
  category.diagnosticRefs.length +
  category.blockingReasons.reduce(
    (total, reason) => total + reason.diagnosticRefs.length,
    0
  ) +
  category.unsupportedClaims.reduce(
    (total, claim) => total + claim.diagnosticRefs.length,
    0
  ) +
  category.notEvaluatedClaims.reduce(
    (total, claim) => total + claim.diagnosticRefs.length,
    0
  );
