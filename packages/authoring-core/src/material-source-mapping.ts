import type { MaterialPlacement, RectDto } from "@private-2d-rigging-lab/contracts";
import { SourceAssetSchema, ProvenanceRecordSchema, RightsRecordSchema } from "@private-2d-rigging-lab/package-format";
import type { AuthoringSession } from "./authoring-session.js";
import { importSourceAssetMetadata } from "./source-asset-mutations.js";
import { upsertTexturePreviewAssetMetadata } from "./texture-asset-mutations.js";
import type { MaterialImageAssetPlan, MaterialImageSubject } from "./material-image-assets.js";
import { MaterialRejection } from "./material-validation.js";

/** Graph-side asset identifiers and file paths; binary entries are checked separately. */
export const materialGraphAssetIds = (session: AuthoringSession): Set<string> => new Set<string>([
  ...session.graph.sourceAssets.flatMap((item) => [item.sourceAssetId, item.filePath, ...item.layers.map((layer) => layer.sourceLayerId)]),
  ...(session.graph.textureAtlas?.textures ?? []).flatMap((item) => [item.textureId, item.filePath]),
  ...(session.graph.textureAtlas?.previewAssets ?? []).map((item) => item.previewAssetId),
  ...session.graph.meshes.map((item) => item.meshId),
  ...session.graph.provenanceRecords.map((item) => item.provenanceId),
  ...session.graph.rightsRecords.map((item) => item.assetId)
]);

export interface MaterialSourceMappingInput {
  readonly plan: MaterialImageAssetPlan;
  readonly image: MaterialImageSubject;
  readonly placement: MaterialPlacement;
  readonly provenanceNote: string;
  readonly sourceLayerName: string;
}

/**
 * Adds source, provenance, rights and texture entries for already registered bytes.
 * Never overwrites an existing asset: every planned graph ID must be new.
 */
export const createMaterialSourceMapping = (session: AuthoringSession, input: MaterialSourceMappingInput) => {
  const { plan, image, placement } = input;
  const existing = materialGraphAssetIds(session);
  const collisions = [plan.sourceAssetId, plan.textureId, plan.provenanceId, plan.meshId, plan.sourceLayerId, plan.previewAssetId, plan.filePath]
    .filter((id) => existing.has(id));
  if (collisions.length > 0) {
    throw new MaterialRejection("idCollision", `Material IDs from seed ${plan.idSeed} already exist: ${collisions.join(", ")}`);
  }
  const { sourceAssetId, sourceLayerId, textureId, provenanceId, meshId, filePath, binaryAssetRef } = plan;
  const { width, height, contentInset: inset, rgbaSha256 } = image;
  const { scale, translation } = placement;
  const bounds: RectDto = { x: translation.x + scale * inset.left, y: translation.y + scale * inset.top,
    width: scale * (width - inset.left - inset.right), height: scale * (height - inset.top - inset.bottom) };
  if (Object.values(bounds).some((value) => !Number.isFinite(value)) || bounds.width <= 0 || bounds.height <= 0) {
    throw new MaterialRejection("placementInvalid", "Material placement produces invalid stage bounds.");
  }
  importSourceAssetMetadata(session, {
    sourceAsset: SourceAssetSchema.parse({ sourceAssetId, kind: "split-png-set-v1", filePath,
      contentHash: rgbaSha256, importProfile: "split-png-fallback-v1", binaryAssetRef,
      layers: [{ sourceLayerId, sourceAssetId, originalName: input.sourceLayerName, normalizedName: input.sourceLayerName,
        groupPath: [], bounds, visibleInSource: true, opacityInSource: 1, role: "editableLayer", mappedDrawableIds: [] }] }),
    provenanceRecord: ProvenanceRecordSchema.parse({ provenanceId, assetId: sourceAssetId, assetKind: "aiEdit", filePath,
      contentHash: rgbaSha256, creator: "generated-material", license: "unspecified", redistributionAllowed: false, aiUsed: true,
      transformHistory: [input.provenanceNote,
        ...(image.originalFileSha256 === undefined ? [] : [`originalFileSha256=${image.originalFileSha256}`]),
        `normalizedRgbaSha256=${rgbaSha256}`, `placement=${JSON.stringify(placement)}`, "Material geometry rebuilt; no keyform migration."] }),
    rightsRecord: RightsRecordSchema.parse({ assetId: sourceAssetId, rightsStatus: "needs_review", license: "unspecified",
      redistributionAllowed: false, notes: "Material contract carries no license grant." })
  });
  upsertTexturePreviewAssetMetadata(session, { textureEntry: { textureId, filePath, contentHash: rgbaSha256,
    sourceAssetId, sourceLayerId, provenanceId, binaryAssetRef, dimensions: { width, height, pixelFormat: "rgba8" }, contentInset: { ...inset } },
    previewAsset: { previewAssetId: plan.previewAssetId, textureId, reference: { referenceKind: "package-local-file-v1", filePath },
      contentHash: rgbaSha256, sourceAssetId, sourceLayerId, provenanceId, rightsAssetId: sourceAssetId } });
  return { sourceAssetId, sourceLayerId, textureId, provenanceId, meshId, bounds };
};
export type MaterialSourceMapping = ReturnType<typeof createMaterialSourceMapping>;
