import {
  DiagnosticSchema,
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import { PsdAdapterSourceLayerReferenceSchema } from "./payloads/import-source.js";
import { PsdImportPlanApprovalBridgeEvidenceSchema } from "./psd-import-plan-approval-evidence.js";

const PSD_BATCH_ID_PATTERN = /^batch_[A-Za-z0-9_-]+$/;

export const PSD_BATCH_SELECTED_LAYER_LIMIT = 4;
export const PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT = 32 * 1024 * 1024;

export const PsdLayerMaterializationBatchAggregateStatusSchema = z.enum([
  "success",
  "preflightBlocked",
  "partialFailure",
  "failure"
]);
export type PsdLayerMaterializationBatchAggregateStatusDto = z.infer<
  typeof PsdLayerMaterializationBatchAggregateStatusSchema
>;

export const PsdLayerMaterializationBatchEntryStatusSchema = z.enum([
  "success",
  "preflightReady",
  "preflightBlocked"
]);
export type PsdLayerMaterializationBatchEntryStatusDto = z.infer<
  typeof PsdLayerMaterializationBatchEntryStatusSchema
>;

export const PsdLayerMaterializationBatchGeneratedTargetsSchema = z.object({
  partId: PartIdSchema,
  partDisplayName: z.string().min(1),
  drawableId: DrawableIdSchema,
  drawableDisplayName: z.string().min(1),
  textureId: TextureIdSchema,
  meshId: MeshIdSchema
}).strict();
export type PsdLayerMaterializationBatchGeneratedTargetsDto = z.infer<
  typeof PsdLayerMaterializationBatchGeneratedTargetsSchema
>;

export const PsdLayerMaterializationBatchEntryResultSchema = z.object({
  selectedIndex: z.number().int().nonnegative(),
  sourceLayerRef: PsdAdapterSourceLayerReferenceSchema,
  materializationId: z.string().regex(/^mat_[A-Za-z0-9_-]+$/),
  materializedByteLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  status: PsdLayerMaterializationBatchEntryStatusSchema,
  generated: PsdLayerMaterializationBatchGeneratedTargetsSchema,
  operationId: OperationIdSchema.optional(),
  diagnostics: z.array(DiagnosticSchema).default([])
}).strict();
export type PsdLayerMaterializationBatchEntryResultDto = z.infer<
  typeof PsdLayerMaterializationBatchEntryResultSchema
>;

export const PsdLayerMaterializationBatchOperationEvidenceDtoSchema = z.object({
  schemaVersion: z.literal("psd-layer-materialization-batch-operation-evidence-v1"),
  operationType: z.literal("importPsdLayerMaterializationBatch"),
  batchId: z.string().regex(PSD_BATCH_ID_PATTERN),
  sourceAssetId: SourceAssetIdSchema,
  destination: z.object({
    destinationKind: z.literal("generatedPartScaffold"),
    parentPartId: PartIdSchema
  }).strict(),
  importPlanBridge: PsdImportPlanApprovalBridgeEvidenceSchema.optional(),
  aggregateStatus: PsdLayerMaterializationBatchAggregateStatusSchema,
  selectedLayerCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  failureCount: z.number().int().nonnegative(),
  totalMaterializedByteLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  entries: z.array(PsdLayerMaterializationBatchEntryResultSchema),
  perLayerOperationIds: z.array(OperationIdSchema).default([]),
  preflightPolicy: z.object({
    selectedLayerLimit: z.literal(PSD_BATCH_SELECTED_LAYER_LIMIT),
    totalRawRgbaByteLimit: z.literal(PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT),
    mutationPolicy: z.literal("preflightBlocksOnAnyFailure"),
    silentPartialSuccess: z.literal("forbidden")
  }).strict(),
  persistenceBoundary: z.object({
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    materializedLayerBytePersistence: z.literal("binaryAssetRefOnlyNoInlineBytes"),
    photoshopCompositingClaim: z.literal("none"),
    rendererPixelOracleClaim: z.literal("none")
  }).strict()
}).strict();
export type PsdLayerMaterializationBatchOperationEvidenceDto = z.infer<
  typeof PsdLayerMaterializationBatchOperationEvidenceDtoSchema
>;

type PsdLayerMaterializationBatchOperationEvidenceInput = Omit<
  z.input<typeof PsdLayerMaterializationBatchOperationEvidenceDtoSchema>,
  "preflightPolicy" | "persistenceBoundary"
>;

export const createPsdLayerMaterializationBatchOperationEvidence = (
  input: PsdLayerMaterializationBatchOperationEvidenceInput
): PsdLayerMaterializationBatchOperationEvidenceDto =>
  PsdLayerMaterializationBatchOperationEvidenceDtoSchema.parse({
    ...input,
    preflightPolicy: {
      selectedLayerLimit: PSD_BATCH_SELECTED_LAYER_LIMIT,
      totalRawRgbaByteLimit: PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT,
      mutationPolicy: "preflightBlocksOnAnyFailure",
      silentPartialSuccess: "forbidden"
    },
    persistenceBoundary: {
      rawParserObjectPersistence: "notPersisted",
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
      materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
      photoshopCompositingClaim: "none",
      rendererPixelOracleClaim: "none"
    }
  });
