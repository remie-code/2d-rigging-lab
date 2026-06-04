import { z } from "zod";

import {
  OperationIdSchema,
  PackageIdSchema,
  ValidationReportIdSchema
} from "./ids.js";
import { JsonValueSchema } from "./json-value.js";
import {
  ProductPreflightEvidenceRefDtoSchema,
  ProductPreflightReportIdDtoSchema,
  ProductPreflightStatusDtoSchema
} from "./product-preflight-report.js";
import { TargetRefSchema } from "./target-ref.js";

const MACHINE_OPERATION_NAME_PATTERN = /^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/;
const MACHINE_TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;
const GENERATED_PROPOSAL_PATH_TOKEN_PATTERN = "[A-Za-z0-9_.-]+";

const CodexProposalJsonObjectDtoSchema = z.record(z.string(), JsonValueSchema);

export const CodexProposalIdDtoSchema = z.string().regex(/^proposal_[A-Za-z0-9_-]+$/);
export type CodexProposalIdDto = z.infer<typeof CodexProposalIdDtoSchema>;

export const CodexProposalStepIdDtoSchema = z.string().regex(/^step_[A-Za-z0-9_-]+$/);
export type CodexProposalStepIdDto = z.infer<typeof CodexProposalStepIdDtoSchema>;

export const CodexProposalPreviewIdDtoSchema = z.string().regex(/^preview_[A-Za-z0-9_-]+$/);
export type CodexProposalPreviewIdDto = z.infer<typeof CodexProposalPreviewIdDtoSchema>;

export const CodexProposalApprovalRequestIdDtoSchema = z.string().regex(
  /^approval_[A-Za-z0-9_-]+$/
);
export type CodexProposalApprovalRequestIdDto = z.infer<
  typeof CodexProposalApprovalRequestIdDtoSchema
>;

export const CodexProposalEvidenceIdDtoSchema = z.string().regex(/^evidence_[A-Za-z0-9_-]+$/);
export type CodexProposalEvidenceIdDto = z.infer<typeof CodexProposalEvidenceIdDtoSchema>;

export const CodexProposalIssueIdDtoSchema = z.string().regex(/^issue_[A-Za-z0-9_-]+$/);
export type CodexProposalIssueIdDto = z.infer<typeof CodexProposalIssueIdDtoSchema>;

export const CodexProposalOperationTypeDtoSchema = z.string().regex(
  MACHINE_OPERATION_NAME_PATTERN
);
export type CodexProposalOperationTypeDto = z.infer<
  typeof CodexProposalOperationTypeDtoSchema
>;

export const CodexProposalSourceDtoSchema = z.object({
  surface: z.literal("codex"),
  agentId: z.string().min(1),
  submittedBy: z.enum(["codex", "humanReviewedCodex"]).default("codex")
}).strict();
export type CodexProposalSourceDto = z.infer<typeof CodexProposalSourceDtoSchema>;

export const CodexProposalPackageContextDtoSchema = z.object({
  packageId: PackageIdSchema.optional(),
  basePackageRevision: z.number().int().nonnegative(),
  packageHash: z.string().regex(MACHINE_TOKEN_PATTERN).optional(),
  productPreflightReportId: ProductPreflightReportIdDtoSchema.optional(),
  productPreflightStatus: ProductPreflightStatusDtoSchema.optional(),
  validationReportIds: z.array(ValidationReportIdSchema).default([])
}).strict();
export type CodexProposalPackageContextDto = z.infer<
  typeof CodexProposalPackageContextDtoSchema
>;

export const CodexProposalMetadataDtoSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  relatedAC: z.array(z.string().min(1)).default([]),
  relatedScenarios: z.array(z.string().min(1)).default([]),
  userVisibleRationale: z.string().min(1).optional()
}).strict();
export type CodexProposalMetadataDto = z.infer<typeof CodexProposalMetadataDtoSchema>;

export const CodexProposalOperationExpectedPreconditionDtoSchema = z.object({
  preconditionKind: z.enum([
    "targetExists",
    "targetEditable",
    "packageRevisionMatches",
    "preflightAllowsPreview",
    "validationReportAvailable",
    "userDecisionRequired"
  ]),
  target: TargetRefSchema.optional(),
  summary: z.string().min(1)
}).strict();
export type CodexProposalOperationExpectedPreconditionDto = z.infer<
  typeof CodexProposalOperationExpectedPreconditionDtoSchema
>;

export const CodexProposalOperationExpectedOutcomeDtoSchema = z.object({
  summary: z.string().min(1),
  touchedTargetRefs: z.array(TargetRefSchema).default([]),
  expectedEvidenceRefs: z.array(CodexProposalEvidenceIdDtoSchema).default([])
}).strict();
export type CodexProposalOperationExpectedOutcomeDto = z.infer<
  typeof CodexProposalOperationExpectedOutcomeDtoSchema
>;

export const CodexProposalOperationDtoSchema = z.object({
  stepId: CodexProposalStepIdDtoSchema,
  operationType: CodexProposalOperationTypeDtoSchema,
  operationId: OperationIdSchema.optional(),
  targetRefs: z.array(TargetRefSchema).default([]),
  payload: CodexProposalJsonObjectDtoSchema.default({}),
  expectedPreconditions: z
    .array(CodexProposalOperationExpectedPreconditionDtoSchema)
    .default([]),
  expectedOutcome: CodexProposalOperationExpectedOutcomeDtoSchema.optional()
}).strict();
export type CodexProposalOperationDto = z.infer<typeof CodexProposalOperationDtoSchema>;

export const CodexProposalApprovalPolicyDtoSchema = z.object({
  requiresUserApproval: z.literal(true),
  allowAutomaticCommit: z.literal(false)
}).strict();
export type CodexProposalApprovalPolicyDto = z.infer<
  typeof CodexProposalApprovalPolicyDtoSchema
>;

export const CodexRiggingEditProposalDtoSchema = z.object({
  schemaVersion: z.literal("codex-rigging-edit-proposal-v0"),
  proposalId: CodexProposalIdDtoSchema,
  createdAt: z.string().datetime(),
  source: CodexProposalSourceDtoSchema,
  packageContext: CodexProposalPackageContextDtoSchema,
  metadata: CodexProposalMetadataDtoSchema,
  operations: z.array(CodexProposalOperationDtoSchema).min(1),
  approvalPolicy: CodexProposalApprovalPolicyDtoSchema.default({
    requiresUserApproval: true,
    allowAutomaticCommit: false
  }),
  evidenceRefs: z.array(ProductPreflightEvidenceRefDtoSchema).default([])
}).strict().superRefine((proposal, context) => {
  const seenStepIds = new Set<CodexProposalStepIdDto>();
  const seenOperationIds = new Set<string>();

  proposal.operations.forEach((operation, index) => {
    if (seenStepIds.has(operation.stepId)) {
      context.addIssue({
        code: "custom",
        path: ["operations", index, "stepId"],
        message: `Duplicate Codex proposal step id "${operation.stepId}".`
      });
    }
    seenStepIds.add(operation.stepId);

    if (operation.operationId !== undefined) {
      if (seenOperationIds.has(operation.operationId)) {
        context.addIssue({
          code: "custom",
          path: ["operations", index, "operationId"],
          message: `Duplicate Codex proposal operation id "${operation.operationId}".`
        });
      }
      seenOperationIds.add(operation.operationId);
    }
  });
});
export type CodexRiggingEditProposalDto = z.infer<
  typeof CodexRiggingEditProposalDtoSchema
>;

const GeneratedCodexProposalArtifactPathDtoSchema = (
  suffix: string
): z.ZodString =>
  z.string().regex(
    new RegExp(`^generated/codex-proposals/${GENERATED_PROPOSAL_PATH_TOKEN_PATTERN}\\.${suffix}\\.json$`)
  );

export const CodexProposalArtifactRefDtoSchema = z.discriminatedUnion("artifactKind", [
  z.object({
    artifactKind: z.literal("proposalReceipt"),
    path: GeneratedCodexProposalArtifactPathDtoSchema("proposal")
  }).strict(),
  z.object({
    artifactKind: z.literal("operationCatalog"),
    path: GeneratedCodexProposalArtifactPathDtoSchema("operation-catalog")
  }).strict(),
  z.object({
    artifactKind: z.literal("proposalValidation"),
    path: GeneratedCodexProposalArtifactPathDtoSchema("proposal-validation")
  }).strict(),
  z.object({
    artifactKind: z.literal("diffPreview"),
    path: GeneratedCodexProposalArtifactPathDtoSchema("diff-preview")
  }).strict(),
  z.object({
    artifactKind: z.literal("rerunValidation"),
    path: GeneratedCodexProposalArtifactPathDtoSchema("rerun-validation")
  }).strict(),
  z.object({
    artifactKind: z.literal("approvalEvidence"),
    path: GeneratedCodexProposalArtifactPathDtoSchema("approval-evidence")
  }).strict(),
  z.object({
    artifactKind: z.literal("productPreflightReport"),
    path: z.string().regex(
      /^generated\/product-preflight\/[A-Za-z0-9_.-]+\.product-preflight\.json$/
    )
  }).strict(),
  z.object({
    artifactKind: z.literal("validationReport"),
    path: z.string().regex(
      /^validation\/reports\/[A-Za-z0-9_.-]+\.validation\.json$/
    ),
    reportId: ValidationReportIdSchema.optional()
  }).strict(),
  z.object({
    artifactKind: z.literal("aiTranscript"),
    path: z.string().regex(/^generated\/ai-transcripts\/[A-Za-z0-9_.-]+\.json$/)
  }).strict(),
  z.object({
    artifactKind: z.literal("operationLog"),
    path: z.literal("operations/log.jsonl"),
    operationId: OperationIdSchema.optional()
  }).strict()
]);
export type CodexProposalArtifactRefDto = z.infer<
  typeof CodexProposalArtifactRefDtoSchema
>;

export const CodexProposalEvidenceKindDtoSchema = z.enum([
  "proposalReceipt",
  "operationCatalog",
  "proposalValidation",
  "dryRunDiffPreview",
  "rerunValidation",
  "productPreflight",
  "approvalDecision",
  "commitResult",
  "operationLog",
  "aiTranscript"
]);
export type CodexProposalEvidenceKindDto = z.infer<
  typeof CodexProposalEvidenceKindDtoSchema
>;

export const CodexProposalEvidenceProducerDtoSchema = z.enum([
  "codex",
  "aiInterface",
  "operationCore",
  "validatorCore",
  "editor",
  "human"
]);
export type CodexProposalEvidenceProducerDto = z.infer<
  typeof CodexProposalEvidenceProducerDtoSchema
>;

export const CodexProposalEvidenceRefDtoSchema = z.object({
  evidenceId: CodexProposalEvidenceIdDtoSchema,
  evidenceKind: CodexProposalEvidenceKindDtoSchema,
  artifactRef: CodexProposalArtifactRefDtoSchema,
  target: TargetRefSchema.optional(),
  summary: z.string().min(1),
  producer: CodexProposalEvidenceProducerDtoSchema
}).strict();
export type CodexProposalEvidenceRefDto = z.infer<
  typeof CodexProposalEvidenceRefDtoSchema
>;
