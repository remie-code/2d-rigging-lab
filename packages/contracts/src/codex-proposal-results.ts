import { z } from "zod";

import { DiagnosticSchema } from "./diagnostics.js";
import { ModelDiffSchema } from "./model-diff.js";
import {
  ProductPreflightDiagnosticRefDtoSchema,
  ProductPreflightReportDtoSchema,
  ProductPreflightStatusDtoSchema
} from "./product-preflight-report.js";
import { RuntimeDiffSchema } from "./runtime-diff.js";
import { TargetRefSchema } from "./target-ref.js";
import { ValidationDiffSchema } from "./validation-diff.js";
import {
  CodexProposalApprovalRequestIdDtoSchema,
  CodexProposalEvidenceRefDtoSchema,
  CodexProposalIdDtoSchema,
  CodexProposalIssueIdDtoSchema,
  CodexProposalOperationTypeDtoSchema,
  CodexProposalPreviewIdDtoSchema,
  CodexProposalStepIdDtoSchema
} from "./codex-proposal.js";
import type { CodexProposalEvidenceRefDto } from "./codex-proposal.js";

export const CodexProposalValidationStatusDtoSchema = z.enum([
  "valid",
  "invalid",
  "not_evaluated",
  "requires_user_decision"
]);
export type CodexProposalValidationStatusDto = z.infer<
  typeof CodexProposalValidationStatusDtoSchema
>;

export const CodexProposalOperationValidationStatusDtoSchema = z.enum([
  "valid",
  "invalid",
  "unsupported",
  "not_evaluated",
  "requires_user_decision"
]);
export type CodexProposalOperationValidationStatusDto = z.infer<
  typeof CodexProposalOperationValidationStatusDtoSchema
>;

export const CodexProposalValidationIssueCodeDtoSchema = z.enum([
  "schemaInvalid",
  "operationCatalogMissing",
  "operationCatalogMismatch",
  "unsupportedOperation",
  "unsupportedBoundary",
  "targetRefInvalid",
  "preflightContextMissing",
  "preflightBlocking",
  "stalePackageRevision",
  "requiresUserDecision",
  "approvalRequired",
  "notEvaluated"
]);
export type CodexProposalValidationIssueCodeDto = z.infer<
  typeof CodexProposalValidationIssueCodeDtoSchema
>;

export const CodexProposalValidationIssueDtoSchema = z.object({
  issueId: CodexProposalIssueIdDtoSchema,
  code: CodexProposalValidationIssueCodeDtoSchema,
  severity: z.enum(["warning", "error", "blocking"]),
  message: z.string().min(1),
  stepId: CodexProposalStepIdDtoSchema.optional(),
  target: TargetRefSchema.optional(),
  diagnosticRefs: z.array(ProductPreflightDiagnosticRefDtoSchema).default([]),
  evidenceRefs: z.array(CodexProposalEvidenceRefDtoSchema).default([])
}).strict();
export type CodexProposalValidationIssueDto = z.infer<
  typeof CodexProposalValidationIssueDtoSchema
>;

export const CodexProposalOperationValidationResultDtoSchema = z.object({
  stepId: CodexProposalStepIdDtoSchema,
  operationType: CodexProposalOperationTypeDtoSchema,
  status: CodexProposalOperationValidationStatusDtoSchema,
  issueIds: z.array(CodexProposalIssueIdDtoSchema).default([]),
  diagnosticRefs: z.array(ProductPreflightDiagnosticRefDtoSchema).default([]),
  checkedTargetRefs: z.array(TargetRefSchema).default([])
}).strict().superRefine((operationResult, context) => {
  if (operationResult.status !== "valid" && operationResult.issueIds.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["issueIds"],
      message: "Non-valid Codex proposal operation validation results need issue ids."
    });
  }
});
export type CodexProposalOperationValidationResultDto = z.infer<
  typeof CodexProposalOperationValidationResultDtoSchema
>;

export const CodexProposalApprovalGateDtoSchema = z.object({
  requiresUserApproval: z.literal(true),
  automaticCommitAllowed: z.literal(false),
  approvalReady: z.boolean()
}).strict();
export type CodexProposalApprovalGateDto = z.infer<
  typeof CodexProposalApprovalGateDtoSchema
>;

export const CodexProposalValidationResultDtoSchema = z.object({
  schemaVersion: z.literal("codex-proposal-validation-result-v0"),
  proposalId: CodexProposalIdDtoSchema,
  checkedAt: z.string().datetime(),
  status: CodexProposalValidationStatusDtoSchema,
  summary: z.string().min(1),
  catalogId: z.string().regex(/^catalog_[A-Za-z0-9_-]+$/).optional(),
  canPreview: z.boolean(),
  canRequestApproval: z.boolean(),
  approvalGate: CodexProposalApprovalGateDtoSchema,
  operationResults: z.array(CodexProposalOperationValidationResultDtoSchema).default([]),
  issues: z.array(CodexProposalValidationIssueDtoSchema).default([]),
  evidenceRefs: z.array(CodexProposalEvidenceRefDtoSchema).default([])
}).strict().superRefine((result, context) => {
  if (result.status === "valid") {
    if (result.issues.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["issues"],
        message: "Valid Codex proposal validation results cannot carry validation issues."
      });
    }

    if (!result.canPreview) {
      context.addIssue({
        code: "custom",
        path: ["canPreview"],
        message: "Valid Codex proposal validation results must be previewable."
      });
    }
  }

  if (result.status !== "valid" && result.canRequestApproval) {
    context.addIssue({
      code: "custom",
      path: ["canRequestApproval"],
      message: "Only valid Codex proposals can request approval."
    });
  }

  if (result.canRequestApproval && !result.approvalGate.approvalReady) {
    context.addIssue({
      code: "custom",
      path: ["approvalGate", "approvalReady"],
      message: "Approval requests require an approval-ready gate."
    });
  }
});
export type CodexProposalValidationResultDto = z.infer<
  typeof CodexProposalValidationResultDtoSchema
>;

export const CodexProposalDiffPreviewStatusDtoSchema = z.enum([
  "ready",
  "blocked",
  "not_evaluated"
]);
export type CodexProposalDiffPreviewStatusDto = z.infer<
  typeof CodexProposalDiffPreviewStatusDtoSchema
>;

export const CodexProposalDiffPreviewResultDtoSchema = z.object({
  schemaVersion: z.literal("codex-proposal-diff-preview-result-v0"),
  proposalId: CodexProposalIdDtoSchema,
  previewId: CodexProposalPreviewIdDtoSchema,
  generatedAt: z.string().datetime(),
  status: CodexProposalDiffPreviewStatusDtoSchema,
  summary: z.string().min(1),
  previewOnly: z.literal(true),
  committed: z.literal(false),
  basePackageRevision: z.number().int().nonnegative(),
  previewPackageRevision: z.number().int().nonnegative().optional(),
  sourceValidationStatus: CodexProposalValidationStatusDtoSchema,
  modelDiff: ModelDiffSchema.optional(),
  runtimeDiff: RuntimeDiffSchema.optional(),
  validationDiff: ValidationDiffSchema.optional(),
  diagnostics: z.array(DiagnosticSchema).default([]),
  evidenceRefs: z.array(CodexProposalEvidenceRefDtoSchema).default([])
}).strict().superRefine((preview, context) => {
  if (preview.status === "ready" && preview.sourceValidationStatus !== "valid") {
    context.addIssue({
      code: "custom",
      path: ["sourceValidationStatus"],
      message: "Ready Codex proposal previews require a valid proposal validation result."
    });
  }

  if (preview.status === "ready" && preview.previewPackageRevision === undefined) {
    context.addIssue({
      code: "custom",
      path: ["previewPackageRevision"],
      message: "Ready Codex proposal previews need a preview package revision."
    });
  }
});
export type CodexProposalDiffPreviewResultDto = z.infer<
  typeof CodexProposalDiffPreviewResultDtoSchema
>;

export const CodexProposalRerunValidationStateScopeDtoSchema = z.enum([
  "preview",
  "postCommit"
]);
export type CodexProposalRerunValidationStateScopeDto = z.infer<
  typeof CodexProposalRerunValidationStateScopeDtoSchema
>;

export const CodexProposalRerunValidationResultDtoSchema = z.object({
  schemaVersion: z.literal("codex-proposal-rerun-validation-result-v0"),
  proposalId: CodexProposalIdDtoSchema,
  previewId: CodexProposalPreviewIdDtoSchema.optional(),
  generatedAt: z.string().datetime(),
  stateScope: CodexProposalRerunValidationStateScopeDtoSchema,
  status: ProductPreflightStatusDtoSchema,
  summary: z.string().min(1),
  validationDiff: ValidationDiffSchema.optional(),
  productPreflightReport: ProductPreflightReportDtoSchema.optional(),
  diagnostics: z.array(DiagnosticSchema).default([]),
  evidenceRefs: z.array(CodexProposalEvidenceRefDtoSchema).default([])
}).strict().superRefine((result, context) => {
  if (result.stateScope === "preview" && result.previewId === undefined) {
    context.addIssue({
      code: "custom",
      path: ["previewId"],
      message: "Preview-scoped rerun validation results need a preview id."
    });
  }

  if (result.status === "pass" && result.productPreflightReport === undefined) {
    context.addIssue({
      code: "custom",
      path: ["productPreflightReport"],
      message: "Passing rerun validation results need a Product Preflight report."
    });
  }

  if (
    result.productPreflightReport !== undefined &&
    result.status !== result.productPreflightReport.summary.status
  ) {
    context.addIssue({
      code: "custom",
      path: ["status"],
      message: "Rerun validation status must match the embedded Product Preflight report summary status."
    });
  }
});
export type CodexProposalRerunValidationResultDto = z.infer<
  typeof CodexProposalRerunValidationResultDtoSchema
>;

export const CodexProposalApprovalStatusDtoSchema = z.enum([
  "not_requested",
  "requested",
  "approved",
  "rejected",
  "expired"
]);
export type CodexProposalApprovalStatusDto = z.infer<
  typeof CodexProposalApprovalStatusDtoSchema
>;

export const CodexProposalCommitStatusDtoSchema = z.enum([
  "not_requested",
  "blocked",
  "needs_approval",
  "approved_not_committed",
  "committed",
  "rejected"
]);
export type CodexProposalCommitStatusDto = z.infer<typeof CodexProposalCommitStatusDtoSchema>;

export const CodexProposalApprovalEvidenceResponseDtoSchema = z.object({
  schemaVersion: z.literal("codex-proposal-approval-evidence-response-v0"),
  proposalId: CodexProposalIdDtoSchema,
  approvalRequestId: CodexProposalApprovalRequestIdDtoSchema,
  generatedAt: z.string().datetime(),
  approvalStatus: CodexProposalApprovalStatusDtoSchema,
  commitStatus: CodexProposalCommitStatusDtoSchema,
  requiresUserApproval: z.literal(true),
  automaticCommitAllowed: z.literal(false),
  summary: z.string().min(1),
  evidenceRefs: z.array(CodexProposalEvidenceRefDtoSchema).default([])
}).strict().superRefine((response, context) => {
  if (response.commitStatus === "committed" && response.approvalStatus !== "approved") {
    context.addIssue({
      code: "custom",
      path: ["approvalStatus"],
      message: "Committed Codex proposal responses require approved user approval status."
    });
  }

  if (response.commitStatus === "committed") {
    const evidenceKinds = new Set(response.evidenceRefs.map((ref) => ref.evidenceKind));
    assertEvidenceKind(
      context,
      evidenceKinds,
      "approvalDecision",
      "Committed Codex proposal responses need approval decision evidence."
    );
    assertEvidenceKind(
      context,
      evidenceKinds,
      "commitResult",
      "Committed Codex proposal responses need commit result evidence."
    );
  }
});
export type CodexProposalApprovalEvidenceResponseDto = z.infer<
  typeof CodexProposalApprovalEvidenceResponseDtoSchema
>;

function assertEvidenceKind(
  context: z.RefinementCtx,
  evidenceKinds: ReadonlySet<CodexProposalEvidenceRefDto["evidenceKind"]>,
  evidenceKind: CodexProposalEvidenceRefDto["evidenceKind"],
  message: string
): void {
  if (!evidenceKinds.has(evidenceKind)) {
    context.addIssue({
      code: "custom",
      path: ["evidenceRefs"],
      message
    });
  }
}
