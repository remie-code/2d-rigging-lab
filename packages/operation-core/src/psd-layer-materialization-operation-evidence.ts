import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import {
  PsdAdapterLayerMaterializationEvidenceSchema,
  PsdAdapterSourceLayerReferenceSchema
} from "./payloads/import-source.js";

export const PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8" as const;

export const PsdLayerMaterializationByteStorageStatusSchema = z.enum([
  "packageLocalBinaryAssetRef",
  "missingMaterializedBytes",
  "requiresReupload",
  "metadataOnlyNoBytes",
  "identityMismatchRejected"
]);
export type PsdLayerMaterializationByteStorageStatusDto = z.infer<
  typeof PsdLayerMaterializationByteStorageStatusSchema
>;

export const PsdLayerMaterializationOperationEvidenceDtoSchema = z.object({
  schemaVersion: z.literal("psd-layer-materialization-operation-evidence-v1"),
  operationType: z.literal("importPsdLayerMaterialization"),
  sourceAssetId: SourceAssetIdSchema,
  materializationId: z.string().regex(/^mat_[A-Za-z0-9_-]+$/),
  sourceLayerRef: PsdAdapterSourceLayerReferenceSchema,
  sourcePsd: z.object({
    sourceFilePath: z.string().min(1),
    digest: z.object({
      algorithm: z.literal("sha256"),
      hex: z.string().regex(/^[a-f0-9]{64}$/)
    }).strict(),
    byteLength: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    mediaType: z.string().min(1).optional()
  }).strict(),
  materializedAsset: PsdAdapterLayerMaterializationEvidenceSchema,
  materializedByteStorage: PsdLayerMaterializationByteStorageStatusSchema,
  destination: z.object({
    destinationKind: z.enum(["existingPart", "newPart"]),
    partId: PartIdSchema,
    textureId: TextureIdSchema,
    drawableId: DrawableIdSchema,
    meshId: MeshIdSchema
  }).strict(),
  mapping: z.object({
    sourceLayerId: z.string().min(1),
    textureId: TextureIdSchema,
    drawableId: DrawableIdSchema,
    partId: PartIdSchema
  }).strict(),
  provenanceBoundary: z.object({
    privacyLabel: z.enum(["packageLocalAsset", "privateLocalFixture"]),
    publicDistribution: z.literal("notPublicDistributable"),
    publicDemoAsset: z.literal(false)
  }).strict(),
  persistenceBoundary: z.object({
    rawParserObjectPersistence: z.literal("notPersisted"),
    sourcePsdBytePersistence: z.literal("metadataOnlyNoRawBytes"),
    materializedLayerBytePersistence: z.literal("binaryAssetRefOnlyNoInlineBytes"),
    photoshopCompositingClaim: z.literal("none"),
    rendererPixelOracleClaim: z.literal("none"),
    saveLoadSemantics: z.literal("materializedBytesRequireExistingByteStorageV1")
  }).strict()
}).strict();
export type PsdLayerMaterializationOperationEvidenceDto = z.infer<
  typeof PsdLayerMaterializationOperationEvidenceDtoSchema
>;

export const createPsdLayerMaterializationOperationEvidence = (input: {
  readonly sourceAssetId: z.infer<typeof SourceAssetIdSchema>;
  readonly materialization: z.infer<typeof PsdAdapterLayerMaterializationEvidenceSchema>;
  readonly sourceLayerRef: z.infer<typeof PsdAdapterSourceLayerReferenceSchema>;
  readonly destinationKind: "existingPart" | "newPart";
  readonly partId: z.infer<typeof PartIdSchema>;
  readonly textureId: z.infer<typeof TextureIdSchema>;
  readonly drawableId: z.infer<typeof DrawableIdSchema>;
  readonly meshId: z.infer<typeof MeshIdSchema>;
  readonly materializedByteStorage: PsdLayerMaterializationByteStorageStatusDto;
}): PsdLayerMaterializationOperationEvidenceDto =>
  PsdLayerMaterializationOperationEvidenceDtoSchema.parse({
    schemaVersion: "psd-layer-materialization-operation-evidence-v1",
    operationType: "importPsdLayerMaterialization",
    sourceAssetId: input.sourceAssetId,
    materializationId: input.materialization.materializationId,
    sourceLayerRef: input.sourceLayerRef,
    sourcePsd: {
      sourceFilePath: input.materialization.provenance.sourceFilePath,
      digest: input.materialization.provenance.sourceDigest,
      byteLength: input.materialization.provenance.sourceByteLength,
      ...(input.materialization.provenance.sourceMediaType === undefined
        ? {}
        : { mediaType: input.materialization.provenance.sourceMediaType })
    },
    materializedAsset: input.materialization,
    materializedByteStorage: input.materializedByteStorage,
    destination: {
      destinationKind: input.destinationKind,
      partId: input.partId,
      textureId: input.textureId,
      drawableId: input.drawableId,
      meshId: input.meshId
    },
    mapping: {
      sourceLayerId: input.materialization.sourceLayerRef.sourceLayerId,
      textureId: input.textureId,
      drawableId: input.drawableId,
      partId: input.partId
    },
    provenanceBoundary: {
      privacyLabel: input.materialization.provenance.privacyLabel,
      publicDistribution: input.materialization.provenance.publicDistribution,
      publicDemoAsset: input.materialization.provenance.publicDemoAsset ?? false
    },
    persistenceBoundary: {
      rawParserObjectPersistence: "notPersisted",
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
      materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
      photoshopCompositingClaim: "none",
      rendererPixelOracleClaim: "none",
      saveLoadSemantics: "materializedBytesRequireExistingByteStorageV1"
    }
  });
