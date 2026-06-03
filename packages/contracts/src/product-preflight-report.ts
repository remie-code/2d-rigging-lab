import { z } from "zod";

import { CheckIdSchema } from "./check-id.js";
import { CheckStatusSchema, SeveritySchema } from "./enums.js";
import {
  PackageIdSchema,
  RuntimeSnapshotIdSchema,
  ValidationReportIdSchema
} from "./ids.js";
import {
  RuntimeStateArtifactRefDtoSchema,
  RuntimeStateSequenceArtifactRefDtoSchema
} from "./runtime-artifact-refs.js";
import { TargetRefSchema } from "./target-ref.js";

export const PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS = [
  "modelStructure",
  "authoringWorkflowEvidence",
  "runtimeViewerEvidence",
  "meshTopologyUv",
  "composition",
  "rigControlDynamics",
  "assetBytes",
  "persistenceTransport",
  "tutorialDemoReadiness",
  "unsupportedClaims"
] as const;

export const PRODUCT_PREFLIGHT_STATUS_VALUES = [
  "pass",
  "warn",
  "fail",
  "not_supported",
  "not_evaluated"
] as const;

const MACHINE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const REPORT_ID_PATTERN = /^preflight_[A-Za-z0-9_-]+$/;
const EVIDENCE_ID_PATTERN = /^evidence_[A-Za-z0-9_-]+$/;
const CLAIM_ID_PATTERN = /^claim_[A-Za-z0-9_-]+$/;
const BLOCKING_REASON_ID_PATTERN = /^block_[A-Za-z0-9_-]+$/;
const ACTION_ID_PATTERN = /^action_[A-Za-z0-9_-]+$/;

export const ProductPreflightReportIdDtoSchema = z.string().regex(REPORT_ID_PATTERN);
export type ProductPreflightReportIdDto = z.infer<
  typeof ProductPreflightReportIdDtoSchema
>;

export const ProductPreflightEvidenceIdDtoSchema = z.string().regex(EVIDENCE_ID_PATTERN);
export type ProductPreflightEvidenceIdDto = z.infer<
  typeof ProductPreflightEvidenceIdDtoSchema
>;

export const ProductPreflightClaimIdDtoSchema = z.string().regex(CLAIM_ID_PATTERN);
export type ProductPreflightClaimIdDto = z.infer<typeof ProductPreflightClaimIdDtoSchema>;

export const ProductPreflightBlockingReasonIdDtoSchema = z.string().regex(
  BLOCKING_REASON_ID_PATTERN
);
export type ProductPreflightBlockingReasonIdDto = z.infer<
  typeof ProductPreflightBlockingReasonIdDtoSchema
>;

export const ProductPreflightActionIdDtoSchema = z.string().regex(ACTION_ID_PATTERN);
export type ProductPreflightActionIdDto = z.infer<
  typeof ProductPreflightActionIdDtoSchema
>;

export const ProductPreflightStatusDtoSchema = z.enum(PRODUCT_PREFLIGHT_STATUS_VALUES);
export type ProductPreflightStatusDto = z.infer<typeof ProductPreflightStatusDtoSchema>;

export const ProductPreflightCategoryDtoSchema = z.enum(
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS
);
export type ProductPreflightCategoryDto = z.infer<typeof ProductPreflightCategoryDtoSchema>;

export const ProductPreflightStatusCountsDtoSchema = z.object({
  pass: z.number().int().nonnegative(),
  warn: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  not_supported: z.number().int().nonnegative(),
  not_evaluated: z.number().int().nonnegative()
}).strict();
export type ProductPreflightStatusCountsDto = z.infer<
  typeof ProductPreflightStatusCountsDtoSchema
>;

export const ProductPreflightArtifactKindDtoSchema = z.enum([
  "packageManifest",
  "modelGraph",
  "modelFile",
  "sourceManifest",
  "rightsProvenance",
  "operationLog",
  "validationReport",
  "runtimeSnapshot",
  "runtimeState",
  "runtimeStateSequence",
  "guiEvidence",
  "aiTranscript",
  "byteAvailability",
  "persistentByteStorage",
  "portableBundle",
  "transportCapability",
  "demoSafePreflight",
  "tutorialReadiness"
]);
export type ProductPreflightArtifactKindDto = z.infer<
  typeof ProductPreflightArtifactKindDtoSchema
>;

const ModelFilePathDtoSchema = z.enum([
  "model/graph.json",
  "model/drawables.json",
  "model/meshes.json",
  "model/parameters.json",
  "model/keyforms.json",
  "model/rig-controls.json",
  "model/dynamics.json",
  "model/masks.json",
  "model/draw-order.json",
  "model/editor-state.json"
]);

const ValidationReportArtifactPathDtoSchema = z.string().regex(
  /^validation\/reports\/[A-Za-z0-9_.-]+\.validation\.json$/
);

const RuntimeSnapshotArtifactPathDtoSchema = z.string().regex(
  /^runtime\/snapshots\/[A-Za-z0-9_.-]+\.runtime-snapshot\.json$/
);

const GuiEvidenceArtifactPathDtoSchema = z.string().regex(
  /^generated\/gui-evidence\/[A-Za-z0-9_.-]+\.gui-evidence\.json$/
);

const DemoSafePreflightArtifactPathDtoSchema = z.string().regex(
  /^generated\/demo-safe\/[A-Za-z0-9_.-]+\.demo-safe-preflight\.json$/
);

const GeneratedJsonArtifactPathDtoSchema = (directory: string) =>
  z.string().regex(new RegExp(`^generated/${directory}/[A-Za-z0-9_.-]+\\.json$`));

export const ProductPreflightArtifactRefDtoSchema = z.discriminatedUnion("artifactKind", [
  z.object({
    artifactKind: z.literal("packageManifest"),
    path: z.literal("manifest.json")
  }).strict(),
  z.object({
    artifactKind: z.literal("modelGraph"),
    path: z.literal("model/graph.json")
  }).strict(),
  z.object({
    artifactKind: z.literal("modelFile"),
    path: ModelFilePathDtoSchema
  }).strict(),
  z.object({
    artifactKind: z.literal("sourceManifest"),
    path: z.literal("assets/sources/source-manifest.json")
  }).strict(),
  z.object({
    artifactKind: z.literal("rightsProvenance"),
    path: z.enum(["assets/provenance.json", "assets/rights.json"])
  }).strict(),
  z.object({
    artifactKind: z.literal("operationLog"),
    path: z.literal("operations/log.jsonl")
  }).strict(),
  z.object({
    artifactKind: z.literal("validationReport"),
    path: ValidationReportArtifactPathDtoSchema,
    reportId: ValidationReportIdSchema.optional()
  }).strict(),
  z.object({
    artifactKind: z.literal("runtimeSnapshot"),
    path: RuntimeSnapshotArtifactPathDtoSchema,
    snapshotId: RuntimeSnapshotIdSchema.optional()
  }).strict(),
  z.object({
    artifactKind: z.literal("runtimeState"),
    path: RuntimeStateArtifactRefDtoSchema
  }).strict(),
  z.object({
    artifactKind: z.literal("runtimeStateSequence"),
    path: RuntimeStateSequenceArtifactRefDtoSchema
  }).strict(),
  z.object({
    artifactKind: z.literal("guiEvidence"),
    path: GuiEvidenceArtifactPathDtoSchema
  }).strict(),
  z.object({
    artifactKind: z.literal("aiTranscript"),
    path: GeneratedJsonArtifactPathDtoSchema("ai-transcripts")
  }).strict(),
  z.object({
    artifactKind: z.literal("byteAvailability"),
    path: GeneratedJsonArtifactPathDtoSchema("byte-availability")
  }).strict(),
  z.object({
    artifactKind: z.literal("persistentByteStorage"),
    path: GeneratedJsonArtifactPathDtoSchema("persistent-byte-storage")
  }).strict(),
  z.object({
    artifactKind: z.literal("portableBundle"),
    path: GeneratedJsonArtifactPathDtoSchema("portable-bundles")
  }).strict(),
  z.object({
    artifactKind: z.literal("transportCapability"),
    path: GeneratedJsonArtifactPathDtoSchema("transport-capability")
  }).strict(),
  z.object({
    artifactKind: z.literal("demoSafePreflight"),
    path: DemoSafePreflightArtifactPathDtoSchema
  }).strict(),
  z.object({
    artifactKind: z.literal("tutorialReadiness"),
    path: GeneratedJsonArtifactPathDtoSchema("tutorial-readiness")
  }).strict()
]);
export type ProductPreflightArtifactRefDto = z.infer<
  typeof ProductPreflightArtifactRefDtoSchema
>;

export const ProductPreflightEvidenceProducerDtoSchema = z.enum([
  "packageFormat",
  "validatorCore",
  "runtimeCore",
  "viewer",
  "editor",
  "aiInterface",
  "fixture",
  "acceptanceRunner",
  "human"
]);
export type ProductPreflightEvidenceProducerDto = z.infer<
  typeof ProductPreflightEvidenceProducerDtoSchema
>;

export const ProductPreflightEvidenceRefDtoSchema = z.object({
  evidenceId: ProductPreflightEvidenceIdDtoSchema,
  artifactRef: ProductPreflightArtifactRefDtoSchema,
  target: TargetRefSchema.optional(),
  summary: z.string().min(1),
  producer: ProductPreflightEvidenceProducerDtoSchema.optional()
}).strict();
export type ProductPreflightEvidenceRefDto = z.infer<
  typeof ProductPreflightEvidenceRefDtoSchema
>;

export const ProductPreflightDiagnosticRefDtoSchema = z.object({
  checkId: CheckIdSchema,
  reportId: ValidationReportIdSchema.optional(),
  diagnosticIndex: z.number().int().nonnegative().optional(),
  status: CheckStatusSchema.optional(),
  severity: SeveritySchema.optional(),
  target: TargetRefSchema.optional(),
  message: z.string().min(1).optional()
}).strict();
export type ProductPreflightDiagnosticRefDto = z.infer<
  typeof ProductPreflightDiagnosticRefDtoSchema
>;

export const ProductPreflightRecommendedActionKindDtoSchema = z.enum([
  "inspectDiagnostic",
  "provideEvidence",
  "runValidationProfile",
  "manualAuthoringChange",
  "removeUnsupportedClaim",
  "recordUnsupportedBoundary",
  "deferCapabilityDecision",
  "reviewRightsProvenance",
  "rerunPreflight"
]);
export type ProductPreflightRecommendedActionKindDto = z.infer<
  typeof ProductPreflightRecommendedActionKindDtoSchema
>;

export const ProductPreflightRecommendedActionDtoSchema = z.object({
  actionId: ProductPreflightActionIdDtoSchema,
  actionKind: ProductPreflightRecommendedActionKindDtoSchema,
  summary: z.string().min(1),
  targetCategory: ProductPreflightCategoryDtoSchema.optional()
}).strict();
export type ProductPreflightRecommendedActionDto = z.infer<
  typeof ProductPreflightRecommendedActionDtoSchema
>;

export const ProductPreflightBlockingReasonCodeDtoSchema = z.enum([
  "missingRequiredEvidence",
  "failingDiagnostic",
  "unsupportedRequiredCapability",
  "staleEvidence",
  "invalidPackageData",
  "unsafeUnsupportedClaim",
  "schemaInvalid",
  "rightsOrProvenanceBlocked"
]);
export type ProductPreflightBlockingReasonCodeDto = z.infer<
  typeof ProductPreflightBlockingReasonCodeDtoSchema
>;

export const ProductPreflightBlockingReasonDtoSchema = z.object({
  reasonId: ProductPreflightBlockingReasonIdDtoSchema,
  reasonCode: ProductPreflightBlockingReasonCodeDtoSchema,
  severity: z.enum(["error", "blocking"]),
  message: z.string().min(1),
  evidenceRefs: z.array(ProductPreflightEvidenceRefDtoSchema).default([]),
  diagnosticRefs: z.array(ProductPreflightDiagnosticRefDtoSchema).default([]),
  recommendedNextActions: z.array(ProductPreflightRecommendedActionDtoSchema).min(1)
}).strict();
export type ProductPreflightBlockingReasonDto = z.infer<
  typeof ProductPreflightBlockingReasonDtoSchema
>;

export const ProductPreflightUnsupportedClaimKindDtoSchema = z.enum([
  "aiRepair",
  "llmProvider",
  "naturalLanguageRepair",
  "repairCandidateGeneration",
  "parserImageDecode",
  "archiveFilesystem",
  "rendererPixelOracle",
  "cubismCompatibility",
  "publicDemoAssetDistribution",
  "standardArchiveZip",
  "fileSystemAccessApi",
  "dragDropFileIntake",
  "nativeFilesystemPersistence",
  "otherUnsupportedCapability"
]);
export type ProductPreflightUnsupportedClaimKindDto = z.infer<
  typeof ProductPreflightUnsupportedClaimKindDtoSchema
>;

export const ProductPreflightUnsupportedClaimDtoSchema = z.object({
  claimId: ProductPreflightClaimIdDtoSchema,
  status: z.literal("not_supported"),
  claimKind: ProductPreflightUnsupportedClaimKindDtoSchema,
  capabilityLabel: z.string().min(1),
  explanation: z.string().min(1),
  severity: SeveritySchema,
  evidenceRefs: z.array(ProductPreflightEvidenceRefDtoSchema).default([]),
  diagnosticRefs: z.array(ProductPreflightDiagnosticRefDtoSchema).default([]),
  recommendedNextActions: z.array(ProductPreflightRecommendedActionDtoSchema).min(1)
}).strict().superRefine((claim, context) => {
  if (claim.severity === "info") {
    context.addIssue({
      code: "custom",
      path: ["severity"],
      message: "Unsupported product preflight claims must not be informational pass-throughs."
    });
  }
});
export type ProductPreflightUnsupportedClaimDto = z.infer<
  typeof ProductPreflightUnsupportedClaimDtoSchema
>;

export const ProductPreflightNotEvaluatedClaimDtoSchema = z.object({
  claimId: ProductPreflightClaimIdDtoSchema,
  status: z.literal("not_evaluated"),
  category: ProductPreflightCategoryDtoSchema,
  evidenceKind: ProductPreflightArtifactKindDtoSchema,
  reason: z.string().min(1),
  severity: SeveritySchema,
  requiredEvidenceKinds: z.array(ProductPreflightArtifactKindDtoSchema).min(1),
  evidenceRefs: z.array(ProductPreflightEvidenceRefDtoSchema).default([]),
  diagnosticRefs: z.array(ProductPreflightDiagnosticRefDtoSchema).default([]),
  recommendedNextActions: z.array(ProductPreflightRecommendedActionDtoSchema).min(1)
}).strict().superRefine((claim, context) => {
  if (claim.severity === "info") {
    context.addIssue({
      code: "custom",
      path: ["severity"],
      message: "Not-evaluated product preflight claims must explain missing evidence."
    });
  }
});
export type ProductPreflightNotEvaluatedClaimDto = z.infer<
  typeof ProductPreflightNotEvaluatedClaimDtoSchema
>;

export const ProductPreflightCategoryResultDtoSchema = z.object({
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
}).strict().superRefine((category, context) => {
  if (category.status === "pass") {
    if (category.severity !== "info") {
      context.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Passing product preflight categories must use info severity."
      });
    }

    if (hasAnyOutcomeExplanation(category)) {
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Passing product preflight categories cannot carry blocking, unsupported, or not-evaluated outcomes."
      });
    }
  }

  if (category.status === "warn" && category.severity !== "warning") {
    context.addIssue({
      code: "custom",
      path: ["severity"],
      message: "Warning product preflight categories must use warning severity."
    });
  }

  if (category.status === "fail") {
    if (category.severity !== "error" && category.severity !== "blocking") {
      context.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Failing product preflight categories must use error or blocking severity."
      });
    }

    if (category.blockingReasons.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["blockingReasons"],
        message: "Failing product preflight categories need at least one blocking reason."
      });
    }
  }

  if (category.status === "not_supported" && category.unsupportedClaims.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["unsupportedClaims"],
      message: "Not-supported product preflight categories need at least one unsupported claim."
    });
  }

  if (category.status === "not_evaluated" && category.notEvaluatedClaims.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["notEvaluatedClaims"],
      message: "Not-evaluated product preflight categories need at least one not-evaluated claim."
    });
  }

  if (category.unsupportedClaims.length > 0 && category.status !== "not_supported") {
    context.addIssue({
      code: "custom",
      path: ["unsupportedClaims"],
      message: "Unsupported claims must not be reported under pass, warn, fail, or not-evaluated categories."
    });
  }

  if (category.notEvaluatedClaims.length > 0 && category.status !== "not_evaluated") {
    context.addIssue({
      code: "custom",
      path: ["notEvaluatedClaims"],
      message: "Not-evaluated claims must not be reported under pass, warn, fail, or not-supported categories."
    });
  }

  if (category.blockingReasons.length > 0 && category.status !== "fail") {
    context.addIssue({
      code: "custom",
      path: ["blockingReasons"],
      message: "Blocking reasons must be reported under a failing category."
    });
  }

  const expectedSeverity = deriveHighestSeverity(collectCategorySeverities(category));
  if (category.severity !== expectedSeverity) {
    context.addIssue({
      code: "custom",
      path: ["severity"],
      message: "Product preflight category severity must reflect nested diagnostics, blocking reasons, and claims."
    });
  }
});
export type ProductPreflightCategoryResultDto = z.infer<
  typeof ProductPreflightCategoryResultDtoSchema
>;

export const ProductPreflightSummaryDtoSchema = z.object({
  status: ProductPreflightStatusDtoSchema,
  highestSeverity: SeveritySchema,
  categoryCounts: ProductPreflightStatusCountsDtoSchema,
  blockingReasonCount: z.number().int().nonnegative(),
  unsupportedClaimCount: z.number().int().nonnegative(),
  notEvaluatedClaimCount: z.number().int().nonnegative(),
  evidenceRefCount: z.number().int().nonnegative(),
  diagnosticRefCount: z.number().int().nonnegative()
}).strict();
export type ProductPreflightSummaryDto = z.infer<typeof ProductPreflightSummaryDtoSchema>;

export const ProductPreflightReportDtoSchema = z.object({
  schemaVersion: z.literal("product-preflight-report-v0"),
  reportId: ProductPreflightReportIdDtoSchema,
  createdAt: z.string().datetime(),
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  packageHash: z.string().regex(MACHINE_TOKEN_PATTERN).optional(),
  validatorVersion: z.string().min(1),
  sourceValidationReportIds: z.array(ValidationReportIdSchema).default([]),
  summary: ProductPreflightSummaryDtoSchema,
  categories: z.array(ProductPreflightCategoryResultDtoSchema).min(
    PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.length
  ),
  recommendedNextActions: z.array(ProductPreflightRecommendedActionDtoSchema).default([])
}).strict().superRefine((report, context) => {
  const seenCategories = new Set<ProductPreflightCategoryDto>();

  report.categories.forEach((category, index) => {
    if (seenCategories.has(category.category)) {
      context.addIssue({
        code: "custom",
        path: ["categories", index, "category"],
        message: `Duplicate product preflight category "${category.category}".`
      });
    }

    seenCategories.add(category.category);
  });

  for (const requiredCategory of PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS) {
    if (!seenCategories.has(requiredCategory)) {
      context.addIssue({
        code: "custom",
        path: ["categories"],
        message: `Missing required product preflight category "${requiredCategory}".`
      });
    }
  }

  const expectedCounts = countCategoryStatuses(report.categories);
  for (const status of PRODUCT_PREFLIGHT_STATUS_VALUES) {
    if (report.summary.categoryCounts[status] !== expectedCounts[status]) {
      context.addIssue({
        code: "custom",
        path: ["summary", "categoryCounts", status],
        message: `Product preflight summary ${status} count does not match categories.`
      });
    }
  }

  const expectedStatus = deriveReportStatus(report.categories);
  if (report.summary.status !== expectedStatus) {
    context.addIssue({
      code: "custom",
      path: ["summary", "status"],
      message: "Product preflight summary status must be derived from category statuses."
    });
  }

  const expectedHighestSeverity = deriveHighestSeverity(
    report.categories.flatMap((category) => collectCategorySeverities(category))
  );
  if (report.summary.highestSeverity !== expectedHighestSeverity) {
    context.addIssue({
      code: "custom",
      path: ["summary", "highestSeverity"],
      message: "Product preflight summary severity must reflect category evidence."
    });
  }

  assertSummaryCount(
    context,
    ["summary", "blockingReasonCount"],
    report.summary.blockingReasonCount,
    countBlockingReasons(report.categories),
    "blocking reason"
  );
  assertSummaryCount(
    context,
    ["summary", "unsupportedClaimCount"],
    report.summary.unsupportedClaimCount,
    countUnsupportedClaims(report.categories),
    "unsupported claim"
  );
  assertSummaryCount(
    context,
    ["summary", "notEvaluatedClaimCount"],
    report.summary.notEvaluatedClaimCount,
    countNotEvaluatedClaims(report.categories),
    "not-evaluated claim"
  );
  assertSummaryCount(
    context,
    ["summary", "evidenceRefCount"],
    report.summary.evidenceRefCount,
    countEvidenceRefs(report.categories),
    "evidence ref"
  );
  assertSummaryCount(
    context,
    ["summary", "diagnosticRefCount"],
    report.summary.diagnosticRefCount,
    countDiagnosticRefs(report.categories),
    "diagnostic ref"
  );
});
export type ProductPreflightReportDto = z.infer<typeof ProductPreflightReportDtoSchema>;

type SeverityDto = z.infer<typeof SeveritySchema>;

const SEVERITY_RANK: Readonly<Record<SeverityDto, number>> = {
  info: 0,
  warning: 1,
  error: 2,
  blocking: 3
};

function hasAnyOutcomeExplanation(category: ProductPreflightCategoryResultDto): boolean {
  return category.blockingReasons.length > 0 ||
    category.unsupportedClaims.length > 0 ||
    category.notEvaluatedClaims.length > 0;
}

function collectCategorySeverities(
  category: ProductPreflightCategoryResultDto
): readonly SeverityDto[] {
  return [
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
}

function deriveHighestSeverity(severities: readonly SeverityDto[]): SeverityDto {
  return severities.reduce<SeverityDto>((highest, severity) =>
    SEVERITY_RANK[severity] > SEVERITY_RANK[highest] ? severity : highest, "info");
}

function countCategoryStatuses(
  categories: readonly ProductPreflightCategoryResultDto[]
): ProductPreflightStatusCountsDto {
  const counts: ProductPreflightStatusCountsDto = {
    pass: 0,
    warn: 0,
    fail: 0,
    not_supported: 0,
    not_evaluated: 0
  };

  for (const category of categories) {
    counts[category.status] += 1;
  }

  return counts;
}

function deriveReportStatus(
  categories: readonly ProductPreflightCategoryResultDto[]
): ProductPreflightStatusDto {
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
}

function countBlockingReasons(
  categories: readonly ProductPreflightCategoryResultDto[]
): number {
  return categories.reduce((total, category) => total + category.blockingReasons.length, 0);
}

function countUnsupportedClaims(
  categories: readonly ProductPreflightCategoryResultDto[]
): number {
  return categories.reduce((total, category) => total + category.unsupportedClaims.length, 0);
}

function countNotEvaluatedClaims(
  categories: readonly ProductPreflightCategoryResultDto[]
): number {
  return categories.reduce((total, category) => total + category.notEvaluatedClaims.length, 0);
}

function countEvidenceRefs(categories: readonly ProductPreflightCategoryResultDto[]): number {
  return categories.reduce((total, category) =>
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
      ), 0);
}

function countDiagnosticRefs(categories: readonly ProductPreflightCategoryResultDto[]): number {
  return categories.reduce((total, category) =>
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
      ), 0);
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
      message: `Product preflight summary ${label} count does not match categories.`
    });
  }
}
