import { SourceAssetIdSchema } from "@private-2d-rigging-lab/contracts";
import type { SourceAssetId } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type {
  ImportPsdSourceAssetPayloadDto,
  PsdAdapterLayerMaterializationEvidenceDto,
  PsdAdapterParserRuntimeDto
} from "./payloads/import-source.js";
import {
  PsdAdapterLayerMaterializationEvidenceSchema,
  PsdAdapterLayerTreeEvidenceSchema,
  PsdAdapterParserEvidenceSchema
} from "./payloads/import-source.js";

export const PsdImportParseOriginSchema = z.enum([
  "browserExplicitFileSelection",
  "nodeFixtureSmoke",
  "parserFreeAdapter"
]);
export type PsdImportParseOriginDto = z.infer<typeof PsdImportParseOriginSchema>;

export const PsdImportByteEvidenceStorageSchema = z.enum([
  "metadataOnly",
  "binaryAssetRef"
]);
export type PsdImportByteEvidenceStorageDto = z.infer<
  typeof PsdImportByteEvidenceStorageSchema
>;

export const PsdImportFeatureSupportSummarySchema = z.object({
  evidenceCount: z.number().int().nonnegative(),
  unsupportedCount: z.number().int().nonnegative(),
  notEvaluatedCount: z.number().int().nonnegative(),
  featureIds: z.array(z.string().min(1))
}).strict();
export type PsdImportFeatureSupportSummaryDto = z.infer<
  typeof PsdImportFeatureSupportSummarySchema
>;

export const PsdImportPersistenceBoundarySchema = z.object({
  parserPrivateShapePolicy: z.literal("parser-private-shape-excluded-v1"),
  rawParserObjectPersistence: z.literal("notPersisted"),
  sourcePsdBytePersistence: z.enum([
    "metadataOnlyNoRawBytes",
    "binaryAssetRefOnlyNoInlineBytes"
  ]),
  materializedLayerBytePersistence: z.enum([
    "summaryOnlyNoRawBytes",
    "binaryAssetRefOnlyNoInlineBytes"
  ]),
  photoshopCompositingClaim: z.literal("none"),
  rendererPixelOracleClaim: z.literal("none"),
  saveLoadSemantics: z.literal("parserEvidencePersistsBytesRequireExistingByteStorageV1")
}).strict();
export type PsdImportPersistenceBoundaryDto = z.infer<
  typeof PsdImportPersistenceBoundarySchema
>;

export const PsdImportLayerMaterializationEvidenceSummarySchema =
  PsdAdapterLayerMaterializationEvidenceSchema.omit({
    binaryAssetRef: true
  }).extend({
    byteStorage: PsdImportByteEvidenceStorageSchema,
    materializedBytePersistence: z.literal("summaryOnlyNoRawBytes")
  }).strict();
export type PsdImportLayerMaterializationEvidenceSummaryDto = z.infer<
  typeof PsdImportLayerMaterializationEvidenceSummarySchema
>;

export const PsdImportOperationEvidenceDtoSchema = z.object({
  schemaVersion: z.literal("psd-import-operation-evidence-v1"),
  operationType: z.literal("importPsdSourceAsset"),
  sourceAssetId: SourceAssetIdSchema,
  sourceProfile: z.literal("layered-character-psd-profile-v1"),
  adapterResultSchemaVersion: z.literal("psd-adapter-result-v1"),
  adapterName: z.string().min(1),
  adapterVersion: z.string().min(1).optional(),
  parseOrigin: PsdImportParseOriginSchema,
  sourceByteStorage: PsdImportByteEvidenceStorageSchema,
  parser: PsdAdapterParserEvidenceSchema.optional(),
  layerTreeEvidence: PsdAdapterLayerTreeEvidenceSchema.optional(),
  featureSupport: PsdImportFeatureSupportSummarySchema,
  materializationEvidence: z.array(PsdImportLayerMaterializationEvidenceSummarySchema).default([]),
  persistenceBoundary: PsdImportPersistenceBoundarySchema
}).strict();
export const PsdImportOperationEvidenceSchema = PsdImportOperationEvidenceDtoSchema;
export type PsdImportOperationEvidenceDto = z.infer<
  typeof PsdImportOperationEvidenceDtoSchema
>;

export const createPsdImportOperationEvidence = (input: {
  readonly payload: ImportPsdSourceAssetPayloadDto;
  readonly sourceAssetId: SourceAssetId;
}): PsdImportOperationEvidenceDto => {
  const adapterResult = input.payload.adapterResult;
  if (adapterResult === undefined) {
    throw new Error("PSD import operation evidence requires an adapter result.");
  }

  const materializationEvidence =
    adapterResult.materializationEvidence?.map(toMaterializationEvidenceSummary) ?? [];

  return PsdImportOperationEvidenceDtoSchema.parse({
    schemaVersion: "psd-import-operation-evidence-v1",
    operationType: "importPsdSourceAsset",
    sourceAssetId: input.sourceAssetId,
    sourceProfile: adapterResult.sourceProfile,
    adapterResultSchemaVersion: adapterResult.schemaVersion,
    adapterName: adapterResult.adapterName,
    ...(adapterResult.adapterVersion === undefined
      ? {}
      : { adapterVersion: adapterResult.adapterVersion }),
    parseOrigin: resolveParseOrigin(adapterResult.parser?.runtime),
    sourceByteStorage:
      input.payload.fileRef.binaryAssetRef === undefined ? "metadataOnly" : "binaryAssetRef",
    ...(adapterResult.parser === undefined
      ? {}
      : { parser: structuredClone(adapterResult.parser) }),
    ...(adapterResult.layerTreeEvidence === undefined
      ? {}
      : { layerTreeEvidence: structuredClone(adapterResult.layerTreeEvidence) }),
    featureSupport: summarizeFeatureSupportEvidence(input.payload),
    materializationEvidence,
    persistenceBoundary: createPsdImportPersistenceBoundary({
      sourceByteStorage:
        input.payload.fileRef.binaryAssetRef === undefined ? "metadataOnly" : "binaryAssetRef",
      materializationEvidence
    })
  });
};

const resolveParseOrigin = (
  runtime: PsdAdapterParserRuntimeDto | undefined
): PsdImportParseOriginDto => {
  switch (runtime) {
    case "browser":
      return "browserExplicitFileSelection";
    case "node":
      return "nodeFixtureSmoke";
    default:
      return "parserFreeAdapter";
  }
};

const toMaterializationEvidenceSummary = (
  evidence: PsdAdapterLayerMaterializationEvidenceDto
): PsdImportLayerMaterializationEvidenceSummaryDto =>
  PsdImportLayerMaterializationEvidenceSummarySchema.parse({
    evidenceKind: evidence.evidenceKind,
    materializationId: evidence.materializationId,
    sourceLayerRef: structuredClone(evidence.sourceLayerRef),
    mediaType: evidence.mediaType,
    byteLength: evidence.byteLength,
    digest: structuredClone(evidence.digest),
    ...(evidence.width === undefined ? {} : { width: evidence.width }),
    ...(evidence.height === undefined ? {} : { height: evidence.height }),
    ...(evidence.textureId === undefined ? {} : { textureId: evidence.textureId }),
    provenance: structuredClone(evidence.provenance),
    ...(evidence.parser === undefined ? {} : { parser: structuredClone(evidence.parser) }),
    ...(evidence.extraction === undefined
      ? {}
      : { extraction: structuredClone(evidence.extraction) }),
    byteStorage: evidence.binaryAssetRef === undefined ? "metadataOnly" : "binaryAssetRef",
    materializedBytePersistence: "summaryOnlyNoRawBytes"
  });

const summarizeFeatureSupportEvidence = (
  payload: ImportPsdSourceAssetPayloadDto
): PsdImportFeatureSupportSummaryDto => {
  const adapterResult = payload.adapterResult;
  if (adapterResult === undefined) {
    return PsdImportFeatureSupportSummarySchema.parse({
      evidenceCount: 0,
      unsupportedCount: 0,
      notEvaluatedCount: 0,
      featureIds: []
    });
  }

  const evidence = [
    ...(adapterResult.featureSupportEvidence ?? []),
    ...adapterResult.sourceGroups.flatMap((group) => group.featureSupportEvidence ?? []),
    ...adapterResult.sourceLayers.flatMap((layer) => layer.featureSupportEvidence ?? [])
  ];

  return PsdImportFeatureSupportSummarySchema.parse({
    evidenceCount: evidence.length,
    unsupportedCount: evidence.filter((entry) => entry.status === "unsupported").length,
    notEvaluatedCount: evidence.filter((entry) => entry.status === "notEvaluated").length,
    featureIds: uniqueStrings(evidence.map((entry) => entry.featureId))
  });
};

const createPsdImportPersistenceBoundary = (input: {
  readonly sourceByteStorage: PsdImportByteEvidenceStorageDto;
  readonly materializationEvidence: readonly PsdImportLayerMaterializationEvidenceSummaryDto[];
}): PsdImportPersistenceBoundaryDto =>
  PsdImportPersistenceBoundarySchema.parse({
    parserPrivateShapePolicy: "parser-private-shape-excluded-v1",
    rawParserObjectPersistence: "notPersisted",
    sourcePsdBytePersistence: input.sourceByteStorage === "binaryAssetRef"
      ? "binaryAssetRefOnlyNoInlineBytes"
      : "metadataOnlyNoRawBytes",
    materializedLayerBytePersistence: input.materializationEvidence.some(
      (evidence) => evidence.byteStorage === "binaryAssetRef"
    )
      ? "binaryAssetRefOnlyNoInlineBytes"
      : "summaryOnlyNoRawBytes",
    photoshopCompositingClaim: "none",
    rendererPixelOracleClaim: "none",
    saveLoadSemantics: "parserEvidencePersistsBytesRequireExistingByteStorageV1"
  });

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)];
