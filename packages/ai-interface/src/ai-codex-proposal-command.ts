import {
  CodexProposalApprovalEvidenceResponseDtoSchema,
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalOperationCatalogDtoSchema,
  CodexProposalRerunValidationResultDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  CodexProposalEvidenceRefDtoSchema,
  ProductPreflightReportDtoSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { AiCommandBasisSchema, AiCommandSessionSchema } from "./ai-command-request.js";
import { AiCommandStatusSchema } from "./ai-command-response.js";

export const AiCodexProposalCommandNameSchema = z.enum([
  "getCodexProposalOperationCatalog",
  "validateCodexProposal",
  "previewCodexProposalDiff",
  "rerunCodexProposalValidation",
  "requestCodexProposalApproval"
]);
export type AiCodexProposalCommandName = z.infer<
  typeof AiCodexProposalCommandNameSchema
>;

export const GetCodexProposalOperationCatalogPayloadSchema = z.object({
  includeUnsupportedBoundaries: z.literal(true).default(true)
}).strict();
export type GetCodexProposalOperationCatalogPayload = z.infer<
  typeof GetCodexProposalOperationCatalogPayloadSchema
>;

export const GetCodexProposalOperationCatalogResultSchema =
  CodexProposalOperationCatalogDtoSchema;
export type GetCodexProposalOperationCatalogResult = z.infer<
  typeof GetCodexProposalOperationCatalogResultSchema
>;

export const ValidateCodexProposalPayloadSchema = z.object({
  proposal: CodexRiggingEditProposalDtoSchema,
  operationCatalog: CodexProposalOperationCatalogDtoSchema.optional(),
  productPreflightReport: ProductPreflightReportDtoSchema.optional()
}).strict();
export type ValidateCodexProposalPayload = z.infer<
  typeof ValidateCodexProposalPayloadSchema
>;

export const ValidateCodexProposalResultSchema = CodexProposalValidationResultDtoSchema;
export type ValidateCodexProposalResult = z.infer<typeof ValidateCodexProposalResultSchema>;

export const PreviewCodexProposalDiffPayloadSchema = z.object({
  proposal: CodexRiggingEditProposalDtoSchema,
  validationResult: CodexProposalValidationResultDtoSchema,
  dryRunOnly: z.literal(true).default(true)
}).strict();
export type PreviewCodexProposalDiffPayload = z.infer<
  typeof PreviewCodexProposalDiffPayloadSchema
>;

export const PreviewCodexProposalDiffResultSchema = CodexProposalDiffPreviewResultDtoSchema;
export type PreviewCodexProposalDiffResult = z.infer<
  typeof PreviewCodexProposalDiffResultSchema
>;

export const RerunCodexProposalValidationPayloadSchema = z.object({
  proposal: CodexRiggingEditProposalDtoSchema,
  preview: CodexProposalDiffPreviewResultDtoSchema,
  productPreflightReport: ProductPreflightReportDtoSchema.optional()
}).strict();
export type RerunCodexProposalValidationPayload = z.infer<
  typeof RerunCodexProposalValidationPayloadSchema
>;

export const RerunCodexProposalValidationResultSchema =
  CodexProposalRerunValidationResultDtoSchema;
export type RerunCodexProposalValidationResult = z.infer<
  typeof RerunCodexProposalValidationResultSchema
>;

export const RequestCodexProposalApprovalPayloadSchema = z.object({
  proposal: CodexRiggingEditProposalDtoSchema,
  validationResult: CodexProposalValidationResultDtoSchema,
  diffPreview: CodexProposalDiffPreviewResultDtoSchema,
  rerunValidationResult: CodexProposalRerunValidationResultDtoSchema.optional()
}).strict();
export type RequestCodexProposalApprovalPayload = z.infer<
  typeof RequestCodexProposalApprovalPayloadSchema
>;

export const RequestCodexProposalApprovalResultSchema =
  CodexProposalApprovalEvidenceResponseDtoSchema;
export type RequestCodexProposalApprovalResult = z.infer<
  typeof RequestCodexProposalApprovalResultSchema
>;

export const AiCodexProposalCommandPayloadSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("getCodexProposalOperationCatalog"),
    payload: GetCodexProposalOperationCatalogPayloadSchema
  }),
  z.object({
    command: z.literal("validateCodexProposal"),
    payload: ValidateCodexProposalPayloadSchema
  }),
  z.object({
    command: z.literal("previewCodexProposalDiff"),
    payload: PreviewCodexProposalDiffPayloadSchema
  }),
  z.object({
    command: z.literal("rerunCodexProposalValidation"),
    payload: RerunCodexProposalValidationPayloadSchema
  }),
  z.object({
    command: z.literal("requestCodexProposalApproval"),
    payload: RequestCodexProposalApprovalPayloadSchema
  })
]);
export type AiCodexProposalCommandPayload = z.infer<
  typeof AiCodexProposalCommandPayloadSchema
>;

export const AiCodexProposalCommandRequestSchema = z.intersection(
  z.object({
    schemaVersion: z.literal("ai-codex-proposal-command-request-v0"),
    commandId: z.string().min(1),
    session: AiCommandSessionSchema,
    basis: AiCommandBasisSchema
  }),
  AiCodexProposalCommandPayloadSchema
);
export type AiCodexProposalCommandRequest = z.infer<
  typeof AiCodexProposalCommandRequestSchema
>;

export const AiCodexProposalCommandResponsePayloadSchema = z.discriminatedUnion("command", [
  z.object({
    command: z.literal("getCodexProposalOperationCatalog"),
    payload: GetCodexProposalOperationCatalogResultSchema
  }),
  z.object({
    command: z.literal("validateCodexProposal"),
    payload: ValidateCodexProposalResultSchema
  }),
  z.object({
    command: z.literal("previewCodexProposalDiff"),
    payload: PreviewCodexProposalDiffResultSchema
  }),
  z.object({
    command: z.literal("rerunCodexProposalValidation"),
    payload: RerunCodexProposalValidationResultSchema
  }),
  z.object({
    command: z.literal("requestCodexProposalApproval"),
    payload: RequestCodexProposalApprovalResultSchema
  })
]);
export type AiCodexProposalCommandResponsePayload = z.infer<
  typeof AiCodexProposalCommandResponsePayloadSchema
>;

export const AiCodexProposalCommandResponseSchema = z.intersection(
  z.object({
    schemaVersion: z.literal("ai-codex-proposal-command-response-v0"),
    commandId: z.string().min(1),
    status: AiCommandStatusSchema,
    evidenceRefs: z.array(CodexProposalEvidenceRefDtoSchema).default([])
  }),
  AiCodexProposalCommandResponsePayloadSchema
);
export type AiCodexProposalCommandResponse = z.infer<
  typeof AiCodexProposalCommandResponseSchema
>;
