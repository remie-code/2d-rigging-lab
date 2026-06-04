import { z } from "zod";

import { SeveritySchema } from "./enums.js";
import { PackageIdSchema } from "./ids.js";
import { TargetRefSchema } from "./target-ref.js";
import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightActionIdDtoSchema,
  ProductPreflightBlockingReasonDtoSchema,
  ProductPreflightBlockingReasonIdDtoSchema,
  ProductPreflightCategoryDtoSchema,
  ProductPreflightClaimIdDtoSchema,
  ProductPreflightDiagnosticRefDtoSchema,
  ProductPreflightEvidenceIdDtoSchema,
  ProductPreflightEvidenceRefDtoSchema,
  ProductPreflightNotEvaluatedClaimDtoSchema,
  ProductPreflightRecommendedActionDtoSchema,
  ProductPreflightReportIdDtoSchema,
  ProductPreflightStatusDtoSchema,
  ProductPreflightUnsupportedClaimDtoSchema
} from "./product-preflight-report.js";
import { CheckIdSchema } from "./check-id.js";
import { ValidationReportIdSchema } from "./ids.js";

export const PRODUCT_PREFLIGHT_REPORT_DIFF_SCHEMA_VERSION =
  "product-preflight-report-diff-v0" as const;

export const PRODUCT_PREFLIGHT_RERUN_AFFORDANCE_RESPONSE_SCHEMA_VERSION =
  "product-preflight-rerun-affordance-response-v0" as const;

export const PRODUCT_PREFLIGHT_DIFF_CHANGE_KINDS = [
  "added",
  "removed",
  "changed"
] as const;

export const PRODUCT_PREFLIGHT_RERUN_TRIGGER_MODES = [
  "manual",
  "callerTriggered"
] as const;

const REPORT_DIFF_ID_PATTERN = /^preflightDiff_[A-Za-z0-9_-]+$/;
const RERUN_AFFORDANCE_ID_PATTERN = /^preflightRerun_[A-Za-z0-9_-]+$/;
const MACHINE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export const ProductPreflightReportDiffIdDtoSchema = z.string().regex(
  REPORT_DIFF_ID_PATTERN
);
export type ProductPreflightReportDiffIdDto = z.infer<
  typeof ProductPreflightReportDiffIdDtoSchema
>;

export const ProductPreflightRerunAffordanceIdDtoSchema = z.string().regex(
  RERUN_AFFORDANCE_ID_PATTERN
);
export type ProductPreflightRerunAffordanceIdDto = z.infer<
  typeof ProductPreflightRerunAffordanceIdDtoSchema
>;

export const ProductPreflightReportDiffChangeKindDtoSchema = z.enum(
  PRODUCT_PREFLIGHT_DIFF_CHANGE_KINDS
);
export type ProductPreflightReportDiffChangeKindDto = z.infer<
  typeof ProductPreflightReportDiffChangeKindDtoSchema
>;

export const ProductPreflightReportDiffScopeDtoSchema = z.object({
  scopeKind: z.literal("sessionReportPair"),
  beforeReportId: ProductPreflightReportIdDtoSchema,
  afterReportId: ProductPreflightReportIdDtoSchema,
  packageId: PackageIdSchema,
  beforePackageRevision: z.number().int().nonnegative(),
  afterPackageRevision: z.number().int().nonnegative(),
  beforePackageHash: z.string().regex(MACHINE_TOKEN_PATTERN).optional(),
  afterPackageHash: z.string().regex(MACHINE_TOKEN_PATTERN).optional(),
  sessionGeneratedReportsOnly: z.literal(true),
  persistedArtifactCreated: z.literal(false)
}).strict();
export type ProductPreflightReportDiffScopeDto = z.infer<
  typeof ProductPreflightReportDiffScopeDtoSchema
>;

export const ProductPreflightDiffContainerDtoSchema = z.discriminatedUnion(
  "containerKind",
  [
    z.object({
      containerKind: z.literal("report")
    }).strict(),
    z.object({
      containerKind: z.literal("category"),
      category: ProductPreflightCategoryDtoSchema
    }).strict(),
    z.object({
      containerKind: z.literal("blockingReason"),
      category: ProductPreflightCategoryDtoSchema,
      reasonId: ProductPreflightBlockingReasonIdDtoSchema
    }).strict(),
    z.object({
      containerKind: z.literal("unsupportedClaim"),
      category: ProductPreflightCategoryDtoSchema,
      claimId: ProductPreflightClaimIdDtoSchema
    }).strict(),
    z.object({
      containerKind: z.literal("notEvaluatedClaim"),
      category: ProductPreflightCategoryDtoSchema,
      claimId: ProductPreflightClaimIdDtoSchema
    }).strict()
  ]
);
export type ProductPreflightDiffContainerDto = z.infer<
  typeof ProductPreflightDiffContainerDtoSchema
>;

export const ProductPreflightCategoryStatusTransitionDtoSchema = z.object({
  category: ProductPreflightCategoryDtoSchema,
  beforeStatus: ProductPreflightStatusDtoSchema,
  afterStatus: ProductPreflightStatusDtoSchema,
  beforeSeverity: SeveritySchema,
  afterSeverity: SeveritySchema,
  statusChanged: z.boolean(),
  severityChanged: z.boolean()
}).strict().superRefine((transition, context) => {
  if (transition.statusChanged !== (transition.beforeStatus !== transition.afterStatus)) {
    context.addIssue({
      code: "custom",
      path: ["statusChanged"],
      message: "Product preflight statusChanged must match before/after status."
    });
  }

  if (
    transition.severityChanged !==
      (transition.beforeSeverity !== transition.afterSeverity)
  ) {
    context.addIssue({
      code: "custom",
      path: ["severityChanged"],
      message: "Product preflight severityChanged must match before/after severity."
    });
  }
});
export type ProductPreflightCategoryStatusTransitionDto = z.infer<
  typeof ProductPreflightCategoryStatusTransitionDtoSchema
>;

const ProductPreflightBlockingReasonAddedChangeDtoSchema = z.object({
  changeKind: z.literal("added"),
  category: ProductPreflightCategoryDtoSchema,
  reasonId: ProductPreflightBlockingReasonIdDtoSchema,
  after: ProductPreflightBlockingReasonDtoSchema
}).strict();

const ProductPreflightBlockingReasonRemovedChangeDtoSchema = z.object({
  changeKind: z.literal("removed"),
  category: ProductPreflightCategoryDtoSchema,
  reasonId: ProductPreflightBlockingReasonIdDtoSchema,
  before: ProductPreflightBlockingReasonDtoSchema
}).strict();

const ProductPreflightBlockingReasonChangedChangeDtoSchema = z.object({
  changeKind: z.literal("changed"),
  category: ProductPreflightCategoryDtoSchema,
  reasonId: ProductPreflightBlockingReasonIdDtoSchema,
  before: ProductPreflightBlockingReasonDtoSchema,
  after: ProductPreflightBlockingReasonDtoSchema
}).strict();

export const ProductPreflightBlockingReasonChangeDtoSchema = z.discriminatedUnion(
  "changeKind",
  [
    ProductPreflightBlockingReasonAddedChangeDtoSchema,
    ProductPreflightBlockingReasonRemovedChangeDtoSchema,
    ProductPreflightBlockingReasonChangedChangeDtoSchema
  ]
).superRefine((change, context) => {
  if ("before" in change) {
    assertBlockingReasonId(
      context,
      ["before", "reasonId"],
      change.reasonId,
      change.before.reasonId
    );
  }

  if ("after" in change) {
    assertBlockingReasonId(
      context,
      ["after", "reasonId"],
      change.reasonId,
      change.after.reasonId
    );
  }
});
export type ProductPreflightBlockingReasonChangeDto = z.infer<
  typeof ProductPreflightBlockingReasonChangeDtoSchema
>;

export const ProductPreflightDiagnosticRefKeyDtoSchema = z.object({
  checkId: CheckIdSchema,
  reportId: ValidationReportIdSchema.optional(),
  diagnosticIndex: z.number().int().nonnegative().optional(),
  target: TargetRefSchema.optional()
}).strict();
export type ProductPreflightDiagnosticRefKeyDto = z.infer<
  typeof ProductPreflightDiagnosticRefKeyDtoSchema
>;

const ProductPreflightDiagnosticRefAddedChangeDtoSchema = z.object({
  changeKind: z.literal("added"),
  container: ProductPreflightDiffContainerDtoSchema,
  diagnosticRefKey: ProductPreflightDiagnosticRefKeyDtoSchema,
  after: ProductPreflightDiagnosticRefDtoSchema
}).strict();

const ProductPreflightDiagnosticRefRemovedChangeDtoSchema = z.object({
  changeKind: z.literal("removed"),
  container: ProductPreflightDiffContainerDtoSchema,
  diagnosticRefKey: ProductPreflightDiagnosticRefKeyDtoSchema,
  before: ProductPreflightDiagnosticRefDtoSchema
}).strict();

const ProductPreflightDiagnosticRefChangedChangeDtoSchema = z.object({
  changeKind: z.literal("changed"),
  container: ProductPreflightDiffContainerDtoSchema,
  diagnosticRefKey: ProductPreflightDiagnosticRefKeyDtoSchema,
  before: ProductPreflightDiagnosticRefDtoSchema,
  after: ProductPreflightDiagnosticRefDtoSchema
}).strict();

export const ProductPreflightDiagnosticRefChangeDtoSchema = z.discriminatedUnion(
  "changeKind",
  [
    ProductPreflightDiagnosticRefAddedChangeDtoSchema,
    ProductPreflightDiagnosticRefRemovedChangeDtoSchema,
    ProductPreflightDiagnosticRefChangedChangeDtoSchema
  ]
).superRefine((change, context) => {
  if ("before" in change) {
    assertDiagnosticRefKey(
      context,
      ["before"],
      change.diagnosticRefKey,
      change.before
    );
  }

  if ("after" in change) {
    assertDiagnosticRefKey(
      context,
      ["after"],
      change.diagnosticRefKey,
      change.after
    );
  }
});
export type ProductPreflightDiagnosticRefChangeDto = z.infer<
  typeof ProductPreflightDiagnosticRefChangeDtoSchema
>;

const ProductPreflightEvidenceRefAddedChangeDtoSchema = z.object({
  changeKind: z.literal("added"),
  container: ProductPreflightDiffContainerDtoSchema,
  evidenceId: ProductPreflightEvidenceIdDtoSchema,
  after: ProductPreflightEvidenceRefDtoSchema
}).strict();

const ProductPreflightEvidenceRefRemovedChangeDtoSchema = z.object({
  changeKind: z.literal("removed"),
  container: ProductPreflightDiffContainerDtoSchema,
  evidenceId: ProductPreflightEvidenceIdDtoSchema,
  before: ProductPreflightEvidenceRefDtoSchema
}).strict();

const ProductPreflightEvidenceRefChangedChangeDtoSchema = z.object({
  changeKind: z.literal("changed"),
  container: ProductPreflightDiffContainerDtoSchema,
  evidenceId: ProductPreflightEvidenceIdDtoSchema,
  before: ProductPreflightEvidenceRefDtoSchema,
  after: ProductPreflightEvidenceRefDtoSchema
}).strict();

export const ProductPreflightEvidenceRefChangeDtoSchema = z.discriminatedUnion(
  "changeKind",
  [
    ProductPreflightEvidenceRefAddedChangeDtoSchema,
    ProductPreflightEvidenceRefRemovedChangeDtoSchema,
    ProductPreflightEvidenceRefChangedChangeDtoSchema
  ]
).superRefine((change, context) => {
  if ("before" in change) {
    assertEvidenceId(
      context,
      ["before", "evidenceId"],
      change.evidenceId,
      change.before.evidenceId
    );
  }

  if ("after" in change) {
    assertEvidenceId(
      context,
      ["after", "evidenceId"],
      change.evidenceId,
      change.after.evidenceId
    );
  }
});
export type ProductPreflightEvidenceRefChangeDto = z.infer<
  typeof ProductPreflightEvidenceRefChangeDtoSchema
>;

const ProductPreflightRecommendedActionAddedChangeDtoSchema = z.object({
  changeKind: z.literal("added"),
  container: ProductPreflightDiffContainerDtoSchema,
  actionId: ProductPreflightActionIdDtoSchema,
  after: ProductPreflightRecommendedActionDtoSchema
}).strict();

const ProductPreflightRecommendedActionRemovedChangeDtoSchema = z.object({
  changeKind: z.literal("removed"),
  container: ProductPreflightDiffContainerDtoSchema,
  actionId: ProductPreflightActionIdDtoSchema,
  before: ProductPreflightRecommendedActionDtoSchema
}).strict();

const ProductPreflightRecommendedActionChangedChangeDtoSchema = z.object({
  changeKind: z.literal("changed"),
  container: ProductPreflightDiffContainerDtoSchema,
  actionId: ProductPreflightActionIdDtoSchema,
  before: ProductPreflightRecommendedActionDtoSchema,
  after: ProductPreflightRecommendedActionDtoSchema
}).strict();

export const ProductPreflightRecommendedActionChangeDtoSchema = z.discriminatedUnion(
  "changeKind",
  [
    ProductPreflightRecommendedActionAddedChangeDtoSchema,
    ProductPreflightRecommendedActionRemovedChangeDtoSchema,
    ProductPreflightRecommendedActionChangedChangeDtoSchema
  ]
).superRefine((change, context) => {
  if ("before" in change) {
    assertActionId(
      context,
      ["before", "actionId"],
      change.actionId,
      change.before.actionId
    );
  }

  if ("after" in change) {
    assertActionId(
      context,
      ["after", "actionId"],
      change.actionId,
      change.after.actionId
    );
  }
});
export type ProductPreflightRecommendedActionChangeDto = z.infer<
  typeof ProductPreflightRecommendedActionChangeDtoSchema
>;

const ProductPreflightUnsupportedClaimAddedChangeDtoSchema = z.object({
  changeKind: z.literal("added"),
  category: ProductPreflightCategoryDtoSchema,
  claimId: ProductPreflightClaimIdDtoSchema,
  after: ProductPreflightUnsupportedClaimDtoSchema
}).strict();

const ProductPreflightUnsupportedClaimRemovedChangeDtoSchema = z.object({
  changeKind: z.literal("removed"),
  category: ProductPreflightCategoryDtoSchema,
  claimId: ProductPreflightClaimIdDtoSchema,
  before: ProductPreflightUnsupportedClaimDtoSchema
}).strict();

const ProductPreflightUnsupportedClaimChangedChangeDtoSchema = z.object({
  changeKind: z.literal("changed"),
  category: ProductPreflightCategoryDtoSchema,
  claimId: ProductPreflightClaimIdDtoSchema,
  before: ProductPreflightUnsupportedClaimDtoSchema,
  after: ProductPreflightUnsupportedClaimDtoSchema
}).strict();

export const ProductPreflightUnsupportedClaimChangeDtoSchema = z.discriminatedUnion(
  "changeKind",
  [
    ProductPreflightUnsupportedClaimAddedChangeDtoSchema,
    ProductPreflightUnsupportedClaimRemovedChangeDtoSchema,
    ProductPreflightUnsupportedClaimChangedChangeDtoSchema
  ]
).superRefine((change, context) => {
  if ("before" in change) {
    assertClaimId(
      context,
      ["before", "claimId"],
      change.claimId,
      change.before.claimId
    );
  }

  if ("after" in change) {
    assertClaimId(
      context,
      ["after", "claimId"],
      change.claimId,
      change.after.claimId
    );
  }
});
export type ProductPreflightUnsupportedClaimChangeDto = z.infer<
  typeof ProductPreflightUnsupportedClaimChangeDtoSchema
>;

const ProductPreflightNotEvaluatedClaimAddedChangeDtoSchema = z.object({
  changeKind: z.literal("added"),
  category: ProductPreflightCategoryDtoSchema,
  claimId: ProductPreflightClaimIdDtoSchema,
  after: ProductPreflightNotEvaluatedClaimDtoSchema
}).strict();

const ProductPreflightNotEvaluatedClaimRemovedChangeDtoSchema = z.object({
  changeKind: z.literal("removed"),
  category: ProductPreflightCategoryDtoSchema,
  claimId: ProductPreflightClaimIdDtoSchema,
  before: ProductPreflightNotEvaluatedClaimDtoSchema
}).strict();

const ProductPreflightNotEvaluatedClaimChangedChangeDtoSchema = z.object({
  changeKind: z.literal("changed"),
  category: ProductPreflightCategoryDtoSchema,
  claimId: ProductPreflightClaimIdDtoSchema,
  before: ProductPreflightNotEvaluatedClaimDtoSchema,
  after: ProductPreflightNotEvaluatedClaimDtoSchema
}).strict();

export const ProductPreflightNotEvaluatedClaimChangeDtoSchema = z.discriminatedUnion(
  "changeKind",
  [
    ProductPreflightNotEvaluatedClaimAddedChangeDtoSchema,
    ProductPreflightNotEvaluatedClaimRemovedChangeDtoSchema,
    ProductPreflightNotEvaluatedClaimChangedChangeDtoSchema
  ]
).superRefine((change, context) => {
  if ("before" in change) {
    assertClaimId(
      context,
      ["before", "claimId"],
      change.claimId,
      change.before.claimId
    );
  }

  if ("after" in change) {
    assertClaimId(
      context,
      ["after", "claimId"],
      change.claimId,
      change.after.claimId
    );
  }
});
export type ProductPreflightNotEvaluatedClaimChangeDto = z.infer<
  typeof ProductPreflightNotEvaluatedClaimChangeDtoSchema
>;

export const ProductPreflightRerunTriggerModeDtoSchema = z.enum(
  PRODUCT_PREFLIGHT_RERUN_TRIGGER_MODES
);
export type ProductPreflightRerunTriggerModeDto = z.infer<
  typeof ProductPreflightRerunTriggerModeDtoSchema
>;

export const ProductPreflightRerunAffordanceStatusDtoSchema = z.enum([
  "available",
  "blocked",
  "not_evaluated"
]);
export type ProductPreflightRerunAffordanceStatusDto = z.infer<
  typeof ProductPreflightRerunAffordanceStatusDtoSchema
>;

export const ProductPreflightRerunRequiredInputDtoSchema = z.enum([
  "currentPackageState",
  "validatorEvidenceContext",
  "manualTrigger",
  "callerTriggeredRequest"
]);
export type ProductPreflightRerunRequiredInputDto = z.infer<
  typeof ProductPreflightRerunRequiredInputDtoSchema
>;

export const ProductPreflightRerunAffordanceBlockerDtoSchema = z.object({
  reasonCode: z.enum([
    "missingPackageState",
    "missingValidatorContext",
    "staleReport",
    "callerNotAllowed",
    "notEvaluated"
  ]),
  message: z.string().min(1)
}).strict();
export type ProductPreflightRerunAffordanceBlockerDto = z.infer<
  typeof ProductPreflightRerunAffordanceBlockerDtoSchema
>;

export const ProductPreflightRerunAffordanceResponseShapeDtoSchema = z.object({
  responseKind: z.literal("productPreflightReport"),
  reportSchemaVersion: z.literal("product-preflight-report-v0"),
  sessionGeneratedReportOnly: z.literal(true),
  persistedArtifactCreated: z.literal(false),
  automaticCommitAllowed: z.literal(false),
  autoFixAllowed: z.literal(false)
}).strict();
export type ProductPreflightRerunAffordanceResponseShapeDto = z.infer<
  typeof ProductPreflightRerunAffordanceResponseShapeDtoSchema
>;

export const ProductPreflightRerunAffordanceResponseDtoSchema = z.object({
  schemaVersion: z.literal(PRODUCT_PREFLIGHT_RERUN_AFFORDANCE_RESPONSE_SCHEMA_VERSION),
  affordanceId: ProductPreflightRerunAffordanceIdDtoSchema,
  generatedAt: z.string().datetime(),
  sourceReportId: ProductPreflightReportIdDtoSchema,
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  status: ProductPreflightRerunAffordanceStatusDtoSchema,
  summary: z.string().min(1),
  canRequestRerun: z.boolean(),
  allowedTriggerModes: z.array(ProductPreflightRerunTriggerModeDtoSchema).min(1),
  automaticRerunAllowed: z.literal(false),
  autoFixAllowed: z.literal(false),
  automaticCommitAllowed: z.literal(false),
  requiredInputs: z.array(ProductPreflightRerunRequiredInputDtoSchema).default([]),
  blockingReasons: z.array(ProductPreflightRerunAffordanceBlockerDtoSchema).default([]),
  responseShape: ProductPreflightRerunAffordanceResponseShapeDtoSchema
}).strict().superRefine((affordance, context) => {
  assertUniqueStrings(
    context,
    ["allowedTriggerModes"],
    affordance.allowedTriggerModes,
    "rerun trigger mode"
  );

  if (affordance.status === "available") {
    if (!affordance.canRequestRerun) {
      context.addIssue({
        code: "custom",
        path: ["canRequestRerun"],
        message: "Available Product Preflight rerun affordances must be requestable."
      });
    }

    if (affordance.blockingReasons.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["blockingReasons"],
        message: "Available Product Preflight rerun affordances cannot carry blockers."
      });
    }
  }

  if (affordance.status !== "available" && affordance.canRequestRerun) {
    context.addIssue({
      code: "custom",
      path: ["canRequestRerun"],
      message: "Blocked or not-evaluated rerun affordances must not be requestable."
    });
  }
});
export type ProductPreflightRerunAffordanceResponseDto = z.infer<
  typeof ProductPreflightRerunAffordanceResponseDtoSchema
>;

export const ProductPreflightReportDiffSummaryDtoSchema = z.object({
  beforeStatus: ProductPreflightStatusDtoSchema,
  afterStatus: ProductPreflightStatusDtoSchema,
  statusChanged: z.boolean(),
  beforeHighestSeverity: SeveritySchema,
  afterHighestSeverity: SeveritySchema,
  severityChanged: z.boolean(),
  categoryStatusTransitionCount: z.number().int().nonnegative(),
  changedCategoryStatusCount: z.number().int().nonnegative(),
  changedCategorySeverityCount: z.number().int().nonnegative(),
  changedCategoryTransitionCount: z.number().int().nonnegative(),
  blockingReasonChangeCount: z.number().int().nonnegative(),
  diagnosticRefChangeCount: z.number().int().nonnegative(),
  evidenceRefChangeCount: z.number().int().nonnegative(),
  recommendedActionChangeCount: z.number().int().nonnegative(),
  unsupportedClaimChangeCount: z.number().int().nonnegative(),
  notEvaluatedClaimChangeCount: z.number().int().nonnegative(),
  totalChangeCount: z.number().int().nonnegative()
}).strict();
export type ProductPreflightReportDiffSummaryDto = z.infer<
  typeof ProductPreflightReportDiffSummaryDtoSchema
>;

export const ProductPreflightReportDiffDtoSchema = z.object({
  schemaVersion: z.literal(PRODUCT_PREFLIGHT_REPORT_DIFF_SCHEMA_VERSION),
  diffId: ProductPreflightReportDiffIdDtoSchema,
  generatedAt: z.string().datetime(),
  scope: ProductPreflightReportDiffScopeDtoSchema,
  summary: ProductPreflightReportDiffSummaryDtoSchema,
  categoryStatusTransitions: z.array(
    ProductPreflightCategoryStatusTransitionDtoSchema
  ).length(PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.length),
  blockingReasonChanges: z.array(
    ProductPreflightBlockingReasonChangeDtoSchema
  ).default([]),
  diagnosticRefChanges: z.array(
    ProductPreflightDiagnosticRefChangeDtoSchema
  ).default([]),
  evidenceRefChanges: z.array(ProductPreflightEvidenceRefChangeDtoSchema).default([]),
  recommendedActionChanges: z.array(
    ProductPreflightRecommendedActionChangeDtoSchema
  ).default([]),
  unsupportedClaimChanges: z.array(
    ProductPreflightUnsupportedClaimChangeDtoSchema
  ).default([]),
  notEvaluatedClaimChanges: z.array(
    ProductPreflightNotEvaluatedClaimChangeDtoSchema
  ).default([]),
  rerunAffordance: ProductPreflightRerunAffordanceResponseDtoSchema.optional()
}).strict().superRefine((diff, context) => {
  assertRequiredCategoryTransitions(context, diff.categoryStatusTransitions);

  const expectedBeforeStatus = deriveReportStatusFromTransitions(
    diff.categoryStatusTransitions,
    "before"
  );
  const expectedAfterStatus = deriveReportStatusFromTransitions(
    diff.categoryStatusTransitions,
    "after"
  );
  const expectedBeforeHighestSeverity = deriveHighestSeverityFromTransitions(
    diff.categoryStatusTransitions,
    "before"
  );
  const expectedAfterHighestSeverity = deriveHighestSeverityFromTransitions(
    diff.categoryStatusTransitions,
    "after"
  );
  const changedCategoryStatusCount = diff.categoryStatusTransitions.filter(
    (transition) => transition.statusChanged
  ).length;
  const changedCategorySeverityCount = diff.categoryStatusTransitions.filter(
    (transition) => transition.severityChanged
  ).length;
  const changedCategoryTransitionCount = diff.categoryStatusTransitions.filter(
    (transition) => transition.statusChanged || transition.severityChanged
  ).length;

  assertSummaryValue(
    context,
    ["summary", "beforeStatus"],
    diff.summary.beforeStatus,
    expectedBeforeStatus,
    "Product Preflight report diff before status must be derived from category transitions."
  );
  assertSummaryValue(
    context,
    ["summary", "afterStatus"],
    diff.summary.afterStatus,
    expectedAfterStatus,
    "Product Preflight report diff after status must be derived from category transitions."
  );
  assertSummaryValue(
    context,
    ["summary", "beforeHighestSeverity"],
    diff.summary.beforeHighestSeverity,
    expectedBeforeHighestSeverity,
    "Product Preflight report diff before severity must be derived from category transitions."
  );
  assertSummaryValue(
    context,
    ["summary", "afterHighestSeverity"],
    diff.summary.afterHighestSeverity,
    expectedAfterHighestSeverity,
    "Product Preflight report diff after severity must be derived from category transitions."
  );
  assertSummaryBoolean(
    context,
    ["summary", "statusChanged"],
    diff.summary.statusChanged,
    diff.summary.beforeStatus !== diff.summary.afterStatus,
    "Product Preflight report diff statusChanged must match before/after status."
  );
  assertSummaryBoolean(
    context,
    ["summary", "severityChanged"],
    diff.summary.severityChanged,
    diff.summary.beforeHighestSeverity !== diff.summary.afterHighestSeverity,
    "Product Preflight report diff severityChanged must match before/after severity."
  );
  assertSummaryCount(
    context,
    ["summary", "categoryStatusTransitionCount"],
    diff.summary.categoryStatusTransitionCount,
    diff.categoryStatusTransitions.length,
    "category status transition"
  );
  assertSummaryCount(
    context,
    ["summary", "changedCategoryStatusCount"],
    diff.summary.changedCategoryStatusCount,
    changedCategoryStatusCount,
    "changed category status"
  );
  assertSummaryCount(
    context,
    ["summary", "changedCategorySeverityCount"],
    diff.summary.changedCategorySeverityCount,
    changedCategorySeverityCount,
    "changed category severity"
  );
  assertSummaryCount(
    context,
    ["summary", "changedCategoryTransitionCount"],
    diff.summary.changedCategoryTransitionCount,
    changedCategoryTransitionCount,
    "changed category transition"
  );
  assertSummaryCount(
    context,
    ["summary", "blockingReasonChangeCount"],
    diff.summary.blockingReasonChangeCount,
    diff.blockingReasonChanges.length,
    "blocking reason change"
  );
  assertSummaryCount(
    context,
    ["summary", "diagnosticRefChangeCount"],
    diff.summary.diagnosticRefChangeCount,
    diff.diagnosticRefChanges.length,
    "diagnostic ref change"
  );
  assertSummaryCount(
    context,
    ["summary", "evidenceRefChangeCount"],
    diff.summary.evidenceRefChangeCount,
    diff.evidenceRefChanges.length,
    "evidence ref change"
  );
  assertSummaryCount(
    context,
    ["summary", "recommendedActionChangeCount"],
    diff.summary.recommendedActionChangeCount,
    diff.recommendedActionChanges.length,
    "recommended action change"
  );
  assertSummaryCount(
    context,
    ["summary", "unsupportedClaimChangeCount"],
    diff.summary.unsupportedClaimChangeCount,
    diff.unsupportedClaimChanges.length,
    "unsupported claim change"
  );
  assertSummaryCount(
    context,
    ["summary", "notEvaluatedClaimChangeCount"],
    diff.summary.notEvaluatedClaimChangeCount,
    diff.notEvaluatedClaimChanges.length,
    "not-evaluated claim change"
  );

  const expectedTotalChangeCount =
    changedCategoryTransitionCount +
    diff.blockingReasonChanges.length +
    diff.diagnosticRefChanges.length +
    diff.evidenceRefChanges.length +
    diff.recommendedActionChanges.length +
    diff.unsupportedClaimChanges.length +
    diff.notEvaluatedClaimChanges.length;
  assertSummaryCount(
    context,
    ["summary", "totalChangeCount"],
    diff.summary.totalChangeCount,
    expectedTotalChangeCount,
    "total change"
  );

  if (diff.rerunAffordance !== undefined) {
    if (diff.rerunAffordance.sourceReportId !== diff.scope.afterReportId) {
      context.addIssue({
        code: "custom",
        path: ["rerunAffordance", "sourceReportId"],
        message: "Product Preflight diff rerun affordance must target the after report."
      });
    }

    if (diff.rerunAffordance.packageId !== diff.scope.packageId) {
      context.addIssue({
        code: "custom",
        path: ["rerunAffordance", "packageId"],
        message: "Product Preflight diff rerun affordance package id must match scope."
      });
    }

    if (diff.rerunAffordance.packageRevision !== diff.scope.afterPackageRevision) {
      context.addIssue({
        code: "custom",
        path: ["rerunAffordance", "packageRevision"],
        message: "Product Preflight diff rerun affordance must target the after revision."
      });
    }
  }
});
export type ProductPreflightReportDiffDto = z.infer<
  typeof ProductPreflightReportDiffDtoSchema
>;

type ProductPreflightStatusDto = z.infer<typeof ProductPreflightStatusDtoSchema>;
type SeverityDto = z.infer<typeof SeveritySchema>;
type ProductPreflightReportDiffSide = "before" | "after";

const SEVERITY_RANK: Readonly<Record<SeverityDto, number>> = {
  info: 0,
  warning: 1,
  error: 2,
  blocking: 3
};

function assertRequiredCategoryTransitions(
  context: z.RefinementCtx,
  transitions: readonly ProductPreflightCategoryStatusTransitionDto[]
): void {
  const seenCategories = new Set<string>();

  transitions.forEach((transition, index) => {
    if (seenCategories.has(transition.category)) {
      context.addIssue({
        code: "custom",
        path: ["categoryStatusTransitions", index, "category"],
        message: `Duplicate product preflight diff category "${transition.category}".`
      });
    }

    seenCategories.add(transition.category);
  });

  for (const requiredCategory of PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS) {
    if (!seenCategories.has(requiredCategory)) {
      context.addIssue({
        code: "custom",
        path: ["categoryStatusTransitions"],
        message: `Missing product preflight diff category "${requiredCategory}".`
      });
    }
  }
}

function deriveReportStatusFromTransitions(
  transitions: readonly ProductPreflightCategoryStatusTransitionDto[],
  side: ProductPreflightReportDiffSide
): ProductPreflightStatusDto {
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
}

function deriveHighestSeverityFromTransitions(
  transitions: readonly ProductPreflightCategoryStatusTransitionDto[],
  side: ProductPreflightReportDiffSide
): SeverityDto {
  return transitions.reduce<SeverityDto>((highest, transition) => {
    const severity = side === "before" ? transition.beforeSeverity : transition.afterSeverity;
    return SEVERITY_RANK[severity] > SEVERITY_RANK[highest] ? severity : highest;
  }, "info");
}

function assertBlockingReasonId(
  context: z.RefinementCtx,
  path: (string | number)[],
  expected: string,
  actual: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message: "Product Preflight blocking reason change id must match the item."
    });
  }
}

function assertDiagnosticRefKey(
  context: z.RefinementCtx,
  path: (string | number)[],
  key: ProductPreflightDiagnosticRefKeyDto,
  diagnosticRef: z.infer<typeof ProductPreflightDiagnosticRefDtoSchema>
): void {
  if (diagnosticRef.checkId !== key.checkId) {
    context.addIssue({
      code: "custom",
      path: [...path, "checkId"],
      message: "Product Preflight diagnostic ref change check id must match the key."
    });
  }

  if (key.reportId !== undefined && diagnosticRef.reportId !== key.reportId) {
    context.addIssue({
      code: "custom",
      path: [...path, "reportId"],
      message: "Product Preflight diagnostic ref change report id must match the key."
    });
  }

  if (
    key.diagnosticIndex !== undefined &&
      diagnosticRef.diagnosticIndex !== key.diagnosticIndex
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "diagnosticIndex"],
      message: "Product Preflight diagnostic ref change index must match the key."
    });
  }

  if (
    key.target !== undefined &&
      JSON.stringify(diagnosticRef.target) !== JSON.stringify(key.target)
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "target"],
      message: "Product Preflight diagnostic ref change target must match the key."
    });
  }
}

function assertEvidenceId(
  context: z.RefinementCtx,
  path: (string | number)[],
  expected: string,
  actual: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message: "Product Preflight evidence ref change id must match the item."
    });
  }
}

function assertActionId(
  context: z.RefinementCtx,
  path: (string | number)[],
  expected: string,
  actual: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message: "Product Preflight recommended action change id must match the item."
    });
  }
}

function assertClaimId(
  context: z.RefinementCtx,
  path: (string | number)[],
  expected: string,
  actual: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message: "Product Preflight claim change id must match the item."
    });
  }
}

function assertUniqueStrings(
  context: z.RefinementCtx,
  path: (string | number)[],
  values: readonly string[],
  label: string
): void {
  const seenValues = new Set<string>();

  values.forEach((value, index) => {
    if (seenValues.has(value)) {
      context.addIssue({
        code: "custom",
        path: [...path, index],
        message: `Duplicate Product Preflight ${label} "${value}".`
      });
    }

    seenValues.add(value);
  });
}

function assertSummaryValue<TValue extends string>(
  context: z.RefinementCtx,
  path: (string | number)[],
  actual: TValue,
  expected: TValue,
  message: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message
    });
  }
}

function assertSummaryBoolean(
  context: z.RefinementCtx,
  path: (string | number)[],
  actual: boolean,
  expected: boolean,
  message: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message
    });
  }
}

function assertSummaryCount(
  context: z.RefinementCtx,
  path: (string | number)[],
  actual: number,
  expected: number,
  label: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message: `Product Preflight report diff ${label} count does not match changes.`
    });
  }
}
