import type { DiagnosticDto } from "@private-2d-rigging-lab/contracts";
import {
  DiagnosticSchema,
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PartIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import {
  OperationResultSchema,
  PsdImportPlanCandidateStatusSchema,
  PsdImportPlanIssueSchema,
  PsdLayerMaterializationBatchAggregateStatusSchema,
  PsdLayerMaterializationBatchEntryStatusSchema,
  PsdStructuralScaffoldApprovalStatusSchema,
  PsdStructuralScaffoldIssueSchema,
  PsdStructuralScaffoldNodeStatusSchema,
  PsdStructuralScaffoldOperationAggregateStatusSchema
} from "@private-2d-rigging-lab/operation-core";
import { z } from "zod";

const Sha256DigestRefSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);

export const AiPsdImportPlanExpectedContextSchema = z.object({
  planId: z.string().regex(/^plan_[A-Za-z0-9_-]+$/),
  candidatePlanDigest: Sha256DigestRefSchema,
  sourceDigest: Sha256DigestRefSchema.optional(),
  sourceFileName: z.string().min(1).optional(),
  sourceByteLength: z.number().int().nonnegative().optional(),
  scopeRef: z.string().min(1),
  destinationParentPartId: PartIdSchema.nullable().optional()
}).strict();
export type AiPsdImportPlanExpectedContext = z.infer<
  typeof AiPsdImportPlanExpectedContextSchema
>;

export const GetPsdImportPlanStatePayloadSchema = z.object({
  detail: z.enum(["summary", "candidates", "full"]).default("summary")
}).strict();
export type GetPsdImportPlanStatePayload = z.infer<
  typeof GetPsdImportPlanStatePayloadSchema
>;

export const SetPsdImportPlanApprovalPayloadSchema = z.object({
  scopeRef: z.string().min(1).optional(),
  approvedLayerNodeRefs: z.array(z.string().min(1)).default([]),
  destinationParentPartId: PartIdSchema,
  expectedPlan: AiPsdImportPlanExpectedContextSchema.optional()
}).strict();
export type SetPsdImportPlanApprovalPayload = z.infer<
  typeof SetPsdImportPlanApprovalPayloadSchema
>;

export const PreflightPsdImportPlanIntakePayloadSchema = z.object({
  approvedLayerNodeRefs: z.array(z.string().min(1)).min(1),
  destinationParentPartId: PartIdSchema,
  expectedPlan: AiPsdImportPlanExpectedContextSchema
}).strict();
export type PreflightPsdImportPlanIntakePayload = z.infer<
  typeof PreflightPsdImportPlanIntakePayloadSchema
>;

export const ExecutePsdImportPlanIntakePayloadSchema =
  PreflightPsdImportPlanIntakePayloadSchema.extend({
    approvedPreflightCommandId: z.string().min(1),
    expectedOperationId: OperationIdSchema
  }).strict();
export type ExecutePsdImportPlanIntakePayload = z.infer<
  typeof ExecutePsdImportPlanIntakePayloadSchema
>;

export const AiPsdImportPlanApprovalContextDigestSchema = Sha256DigestRefSchema;
export type AiPsdImportPlanApprovalContextDigest = z.infer<
  typeof AiPsdImportPlanApprovalContextDigestSchema
>;

export const createAiPsdImportPlanApprovalContextDigest = async (input: {
  readonly payload: PreflightPsdImportPlanIntakePayload | ExecutePsdImportPlanIntakePayload;
  readonly operationId: string;
}): Promise<AiPsdImportPlanApprovalContextDigest> => {
  const canonical = JSON.stringify({
    schemaVersion: "ai-psd-import-plan-approval-context-v0",
    operationId: input.operationId,
    approvedLayerNodeRefs: [...input.payload.approvedLayerNodeRefs],
    destinationParentPartId: input.payload.destinationParentPartId,
    expectedPlan: normalizeExpectedContext(input.payload.expectedPlan)
  });
  const digest = await sha256Hex(canonical);

  return AiPsdImportPlanApprovalContextDigestSchema.parse(`sha256:${digest}`);
};

export const AiPsdImportPlanDiagnosticSchema = z.object({
  checkId: z.string().min(1),
  severity: z.enum(["info", "warning", "error", "blocking"]),
  message: z.string().min(1)
}).strict();
export type AiPsdImportPlanDiagnostic = z.infer<
  typeof AiPsdImportPlanDiagnosticSchema
>;

export const AiPsdImportPlanGeneratedRefsSchema = z.object({
  partId: z.string().min(1),
  drawableId: z.string().min(1),
  textureId: z.string().min(1),
  meshId: z.string().min(1)
}).strict();
export type AiPsdImportPlanGeneratedRefs = z.infer<
  typeof AiPsdImportPlanGeneratedRefsSchema
>;

export const AiPsdImportPlanCandidateSchema = z.object({
  layerRef: z.string().min(1),
  displayName: z.string().min(1),
  fullPathLabel: z.string().min(1),
  sourceOrder: z.number().int().nonnegative(),
  visibleInSource: z.boolean(),
  rawRgbaByteEstimate: z.number().int().nonnegative(),
  statuses: z.array(PsdImportPlanCandidateStatusSchema).min(1),
  statusReasons: z.array(z.string().min(1)).default([]),
  requestedApproval: z.boolean(),
  approved: z.boolean(),
  approvedOrder: z.number().int().nonnegative().nullable(),
  approvalBlockedReasons: z.array(z.string().min(1)).default([]),
  generatedRefs: AiPsdImportPlanGeneratedRefsSchema
}).strict();
export type AiPsdImportPlanCandidate = z.infer<
  typeof AiPsdImportPlanCandidateSchema
>;

export const AiPsdImportPlanStateSchema = z.object({
  status: z.enum(["ready", "blocked"]),
  planId: z.string().regex(/^plan_[A-Za-z0-9_-]+$/),
  candidatePlanDigest: Sha256DigestRefSchema,
  sourceFileName: z.string().min(1),
  sourceByteLength: z.number().int().nonnegative(),
  sourceDigest: Sha256DigestRefSchema.nullable(),
  scopeRef: z.string().min(1),
  destinationParentPartId: PartIdSchema.nullable(),
  candidateCount: z.number().int().nonnegative(),
  eligibleCandidateCount: z.number().int().nonnegative(),
  approvedCount: z.number().int().nonnegative(),
  notApprovedCount: z.number().int().nonnegative(),
  hiddenCount: z.number().int().nonnegative(),
  unsupportedCount: z.number().int().nonnegative(),
  collisionCount: z.number().int().nonnegative(),
  byteCapBlockedCount: z.number().int().nonnegative(),
  totalRawRgbaByteEstimate: z.number().int().nonnegative(),
  approvedRawRgbaByteEstimate: z.number().int().nonnegative(),
  approvedLayerNodeRefs: z.array(z.string().min(1)).default([]),
  candidates: z.array(AiPsdImportPlanCandidateSchema).default([]),
  diagnostics: z.array(AiPsdImportPlanDiagnosticSchema).default([])
}).strict();
export type AiPsdImportPlanState = z.infer<typeof AiPsdImportPlanStateSchema>;

export const AiPsdStructuralScaffoldGroupPartRefSchema = z.object({
  sourceGroupId: z.string().min(1),
  sourceGroupPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  visibleInSource: z.boolean(),
  opacityInSource: z.number().min(0).max(1),
  generatedParentPartId: PartIdSchema,
  generatedPartId: PartIdSchema.nullable(),
  status: PsdStructuralScaffoldNodeStatusSchema,
  statusReasons: z.array(z.string().min(1)).default([])
}).strict();
export type AiPsdStructuralScaffoldGroupPartRef = z.infer<
  typeof AiPsdStructuralScaffoldGroupPartRefSchema
>;

export const AiPsdStructuralScaffoldLeafDrawableRefSchema = z.object({
  sourceLayerId: z.string().min(1),
  sourceLayerPath: z.array(z.string().min(1)).default([]),
  sourceOrder: z.number().int().nonnegative(),
  visibleInSource: z.boolean(),
  opacityInSource: z.number().min(0).max(1),
  generatedParentPartId: PartIdSchema,
  generatedDrawableId: DrawableIdSchema.nullable(),
  generatedTextureId: TextureIdSchema.nullable(),
  generatedMeshId: MeshIdSchema.nullable(),
  initialRuntimeVisibility: z.boolean().nullable(),
  status: PsdStructuralScaffoldNodeStatusSchema,
  statusReasons: z.array(z.string().min(1)).default([])
}).strict();
export type AiPsdStructuralScaffoldLeafDrawableRef = z.infer<
  typeof AiPsdStructuralScaffoldLeafDrawableRefSchema
>;

export const AiPsdStructuralScaffoldStateSchema = z.object({
  status: z.enum(["ready", "blocked"]),
  structuralPlanId: z.string().regex(/^plan_[A-Za-z0-9_-]+$/),
  structuralPlanDigest: Sha256DigestRefSchema,
  approvalId: z.string().regex(/^approval_[A-Za-z0-9_-]+$/),
  approvalSelectionDigest: Sha256DigestRefSchema,
  approvalStatus: PsdStructuralScaffoldApprovalStatusSchema,
  sourceFilePath: z.string().min(1),
  sourceByteLength: z.number().int().nonnegative(),
  sourceDigest: Sha256DigestRefSchema,
  scopeLabel: z.string().min(1),
  scopeRef: z.string().min(1),
  destinationParentPartId: PartIdSchema.nullable(),
  sourceGroupCount: z.number().int().nonnegative(),
  sourceLayerCount: z.number().int().nonnegative(),
  approvedGroupCount: z.number().int().nonnegative(),
  approvedLeafCount: z.number().int().nonnegative(),
  hiddenLeafCount: z.number().int().nonnegative(),
  runtimeHiddenDrawableCount: z.number().int().nonnegative(),
  generatedGroupPartCount: z.number().int().nonnegative(),
  generatedDrawableCount: z.number().int().nonnegative(),
  totalByteEstimate: z.number().int().nonnegative().nullable(),
  approvedNodeRefs: z.array(z.string().min(1)).default([]),
  groupPartRefs: z.array(AiPsdStructuralScaffoldGroupPartRefSchema).default([]),
  leafDrawableRefs: z.array(AiPsdStructuralScaffoldLeafDrawableRefSchema).default([]),
  diagnostics: z.array(AiPsdImportPlanDiagnosticSchema).default([])
}).strict();
export type AiPsdStructuralScaffoldState = z.infer<
  typeof AiPsdStructuralScaffoldStateSchema
>;

export const AiPsdImportPlanGeneratedResultRefSchema = z.object({
  selectedIndex: z.number().int().nonnegative(),
  sourceLayerId: z.string().min(1),
  sourceLayerPath: z.array(z.string().min(1)).default([]),
  status: PsdLayerMaterializationBatchEntryStatusSchema,
  approvalOrder: z.number().int().nonnegative().optional(),
  operationId: OperationIdSchema.optional(),
  batchEvidenceId: z.string().min(1).optional(),
  materializationEvidenceId: z.string().min(1).optional(),
  materializationId: z.string().min(1),
  partId: z.string().min(1),
  drawableId: z.string().min(1),
  textureId: z.string().min(1),
  meshId: z.string().min(1),
  issues: z.array(PsdImportPlanIssueSchema).default([])
}).strict();
export type AiPsdImportPlanGeneratedResultRef = z.infer<
  typeof AiPsdImportPlanGeneratedResultRefSchema
>;

export const AiPsdStructuralScaffoldLatestBatchSchema = z.object({
  status: z.enum([
    "none",
    "preflightReady",
    "preflightBlocked",
    "committed",
    "rejected",
    "failed"
  ]),
  operationStatus: OperationResultSchema.shape.status.optional(),
  operationId: OperationIdSchema.optional(),
  batchId: z.string().min(1).optional(),
  evidenceId: z.string().min(1).optional(),
  aggregateStatus: PsdStructuralScaffoldOperationAggregateStatusSchema.optional(),
  sourceAssetId: z.string().min(1).optional(),
  destinationParentPartId: PartIdSchema.nullable().optional(),
  approvedNodeRefs: z.array(z.string().min(1)).default([]),
  generatedGroupPartRefs: z.array(AiPsdStructuralScaffoldGroupPartRefSchema).default([]),
  generatedLeafDrawableRefs: z.array(AiPsdStructuralScaffoldLeafDrawableRefSchema).default([]),
  operationIds: z.array(OperationIdSchema).default([]),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  issues: z.array(PsdStructuralScaffoldIssueSchema).default([]),
  diagnostics: z.array(AiPsdImportPlanDiagnosticSchema).default([])
}).strict();
export type AiPsdStructuralScaffoldLatestBatch = z.infer<
  typeof AiPsdStructuralScaffoldLatestBatchSchema
>;

export const AiPsdImportPlanLatestBatchSchema = z.object({
  status: z.enum([
    "none",
    "preflightReady",
    "preflightBlocked",
    "committed",
    "rejected",
    "failed"
  ]),
  stage: z.enum(["currentSource", "materialization", "sourceImport", "operationCommit"]).optional(),
  operationStatus: OperationResultSchema.shape.status.optional(),
  operationId: OperationIdSchema.optional(),
  batchId: z.string().min(1).optional(),
  batchEvidenceId: z.string().min(1).optional(),
  aggregateStatus: PsdLayerMaterializationBatchAggregateStatusSchema.optional(),
  selectedLayerNodeRefs: z.array(z.string().min(1)).default([]),
  approvedLayerNodeRefs: z.array(z.string().min(1)).default([]),
  generatedResultRefs: z.array(AiPsdImportPlanGeneratedResultRefSchema).default([]),
  operationIds: z.array(OperationIdSchema).default([]),
  evidenceRefs: z.array(z.string().min(1)).default([]),
  issues: z.array(PsdImportPlanIssueSchema).default([]),
  diagnostics: z.array(AiPsdImportPlanDiagnosticSchema).default([])
}).strict();
export type AiPsdImportPlanLatestBatch = z.infer<
  typeof AiPsdImportPlanLatestBatchSchema
>;

export const AiPsdImportPlanCommandResultSchema = z.object({
  schemaVersion: z.literal("ai-psd-import-plan-command-result-v0"),
  importPlan: AiPsdImportPlanStateSchema.nullable(),
  structuralScaffold: AiPsdStructuralScaffoldStateSchema.nullable().optional(),
  latestBatch: AiPsdImportPlanLatestBatchSchema,
  latestStructuralScaffold: AiPsdStructuralScaffoldLatestBatchSchema.optional(),
  diagnostics: z.array(AiPsdImportPlanDiagnosticSchema).default([]),
  evidenceRefs: z.array(z.string().min(1)).default([])
}).strict();
export type AiPsdImportPlanCommandResult = z.infer<
  typeof AiPsdImportPlanCommandResultSchema
>;

export interface AiPsdImportPlanCommandHostResult {
  readonly result: AiPsdImportPlanCommandResult;
  readonly operationResult?: OperationResultDto;
  readonly diagnostics?: readonly DiagnosticDto[];
  readonly evidenceRefs?: readonly string[];
}

export interface AiPsdImportPlanCommandHost {
  getPsdImportPlanState(
    payload: GetPsdImportPlanStatePayload
  ): AiPsdImportPlanCommandResult | Promise<AiPsdImportPlanCommandResult>;
  setPsdImportPlanApproval(
    payload: SetPsdImportPlanApprovalPayload
  ): AiPsdImportPlanCommandResult | Promise<AiPsdImportPlanCommandResult>;
  preflightPsdImportPlanIntake(
    payload: PreflightPsdImportPlanIntakePayload
  ): AiPsdImportPlanCommandHostResult | Promise<AiPsdImportPlanCommandHostResult>;
  executePsdImportPlanIntake(
    payload: ExecutePsdImportPlanIntakePayload
  ): AiPsdImportPlanCommandHostResult | Promise<AiPsdImportPlanCommandHostResult>;
}

export const createEmptyAiPsdImportPlanCommandResult = (
  diagnostics: readonly AiPsdImportPlanDiagnostic[] = []
): AiPsdImportPlanCommandResult =>
  AiPsdImportPlanCommandResultSchema.parse({
    schemaVersion: "ai-psd-import-plan-command-result-v0",
    importPlan: null,
    latestBatch: {
      status: "none",
      selectedLayerNodeRefs: [],
      approvedLayerNodeRefs: [],
      generatedResultRefs: [],
      operationIds: [],
      evidenceRefs: [],
      issues: [],
      diagnostics: []
    },
    diagnostics,
    evidenceRefs: []
  });

export const parseAiPsdImportPlanCommandHostResult = (
  input: AiPsdImportPlanCommandResult | AiPsdImportPlanCommandHostResult
): AiPsdImportPlanCommandHostResult => {
  if ("result" in input) {
    return {
      result: AiPsdImportPlanCommandResultSchema.parse(input.result),
      ...(input.operationResult === undefined
        ? {}
        : { operationResult: OperationResultSchema.parse(input.operationResult) }),
      diagnostics: [...(input.diagnostics ?? [])].map((diagnostic) =>
        DiagnosticSchema.parse(diagnostic)
      ),
      evidenceRefs: [...(input.evidenceRefs ?? [])]
    };
  }

  return {
    result: AiPsdImportPlanCommandResultSchema.parse(input)
  };
};

const normalizeExpectedContext = (
  expectedPlan: AiPsdImportPlanExpectedContext
) => ({
  planId: expectedPlan.planId,
  candidatePlanDigest: expectedPlan.candidatePlanDigest,
  sourceDigest: expectedPlan.sourceDigest ?? null,
  sourceFileName: expectedPlan.sourceFileName ?? null,
  sourceByteLength: expectedPlan.sourceByteLength ?? null,
  scopeRef: expectedPlan.scopeRef,
  destinationParentPartId: expectedPlan.destinationParentPartId ?? null
});

const sha256Hex = async (text: string): Promise<string> => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error("Web Crypto SHA-256 is unavailable for PSD import-plan approval context binding.");
  }

  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest("SHA-256", bytes);

  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};
