import type {
  DrawableDto,
  PackageDocumentDto,
  ProvenanceRecordDto,
  RightsRecordDto,
  SourceAssetDto,
  SourceLayerDto,
  TextureAtlasEntryDto,
  TexturePreviewAssetDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const validateTextureAssetReferences = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const textureAtlas = packageDocument.assets.textureAtlas;
  if (textureAtlas === undefined) {
    return [];
  }

  const indexes = createTextureAssetIndexes(packageDocument);
  const checks: ValidationCheckResultDto[] = [];

  textureAtlas.textures.forEach((textureEntry, textureIndex) => {
    checks.push(...validateTextureEntryReference(textureEntry, textureIndex, indexes));
  });

  textureAtlas.previewAssets?.forEach((previewAsset, previewAssetIndex) => {
    checks.push(...validatePreviewAssetReference(previewAsset, previewAssetIndex, indexes));
  });

  packageDocument.model.drawables.drawables.forEach((drawable, drawableIndex) => {
    if (!drawable.runtimeVisibility) {
      return;
    }

    const textureEntry = indexes.textureEntriesById.get(drawable.textureId);
    if (textureEntry === undefined) {
      return;
    }

    const sourceAsset = indexes.sourceAssetsById.get(drawable.sourceAssetId);
    if (sourceAsset === undefined) {
      return;
    }

    const previewAssets = indexes.previewAssetsByTextureId.get(drawable.textureId) ?? [];
    if (previewAssets.length === 0) {
      checks.push(createMissingTexturePreviewCheck(drawable, drawableIndex, textureEntry, sourceAsset, indexes));
      return;
    }

    checks.push(
      ...validateDrawableTextureSourceLayerMapping(
        drawable,
        drawableIndex,
        sourceAsset,
        textureEntry,
        previewAssets[0]
      )
    );
  });

  return checks;
};

interface TextureAtlasEntryWithIndex {
  readonly entry: TextureAtlasEntryDto;
  readonly index: number;
}

interface TexturePreviewAssetWithIndex {
  readonly asset: TexturePreviewAssetDto;
  readonly index: number;
}

interface TextureAssetIndexes {
  readonly sourceAssetsById: ReadonlyMap<string, SourceAssetDto>;
  readonly textureEntriesById: ReadonlyMap<string, TextureAtlasEntryWithIndex>;
  readonly previewAssetsByTextureId: ReadonlyMap<string, readonly TexturePreviewAssetWithIndex[]>;
  readonly provenanceById: ReadonlyMap<string, ProvenanceRecordDto>;
  readonly rightsByAssetId: ReadonlyMap<string, RightsRecordDto>;
}

const createTextureAssetIndexes = (packageDocument: PackageDocumentDto): TextureAssetIndexes => {
  const textureAtlas = packageDocument.assets.textureAtlas;
  const previewAssetsByTextureId = new Map<string, TexturePreviewAssetWithIndex[]>();

  textureAtlas?.previewAssets?.forEach((asset, index) => {
    const existing = previewAssetsByTextureId.get(asset.textureId) ?? [];
    existing.push({ asset, index });
    previewAssetsByTextureId.set(asset.textureId, existing);
  });

  return {
    sourceAssetsById: new Map(
      packageDocument.assets.sourceManifest.sourceAssets.map((sourceAsset) => [
        sourceAsset.sourceAssetId,
        sourceAsset
      ])
    ),
    textureEntriesById: new Map(
      textureAtlas?.textures.map((entry, index) => [
        entry.textureId,
        { entry, index }
      ]) ?? []
    ),
    previewAssetsByTextureId,
    provenanceById: new Map(
      packageDocument.assets.provenance.records.map((record) => [
        record.provenanceId,
        record
      ])
    ),
    rightsByAssetId: new Map(
      packageDocument.assets.rights.records.map((record) => [
        record.assetId,
        record
      ])
    )
  };
};

const validateTextureEntryReference = (
  textureEntry: TextureAtlasEntryDto,
  textureIndex: number,
  indexes: TextureAssetIndexes
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const sourceAsset = textureEntry.sourceAssetId === undefined
    ? undefined
    : indexes.sourceAssetsById.get(textureEntry.sourceAssetId);

  if (
    textureEntry.sourceAssetId !== undefined &&
    textureEntry.sourceLayerId !== undefined &&
    !sourceLayerBelongsToSourceAsset(sourceAsset, textureEntry.sourceLayerId)
  ) {
    checks.push(createTextureSourceLayerMismatchCheck({
      textureId: textureEntry.textureId,
      targetPath: `/assets/textureAtlas/textures/${textureIndex}/sourceLayerId`,
      sourceAssetId: textureEntry.sourceAssetId,
      textureSourceLayerId: textureEntry.sourceLayerId,
      expectedSourceLayerId: findSourceLayerById(sourceAsset, textureEntry.sourceLayerId)?.sourceLayerId,
      reason: sourceAsset === undefined ? "source-asset-missing" : "source-layer-missing"
    }));
  }

  if (textureEntry.provenanceId === undefined) {
    checks.push(createTextureProvenanceMissingCheck({
      textureId: textureEntry.textureId,
      targetPath: `/assets/textureAtlas/textures/${textureIndex}/provenanceId`,
      provenanceId: "missing",
      reason: "texture-entry-provenance-missing"
    }));
    return checks;
  }

  const provenanceRecord = indexes.provenanceById.get(textureEntry.provenanceId);
  if (provenanceRecord === undefined) {
    checks.push(createTextureProvenanceMissingCheck({
      textureId: textureEntry.textureId,
      targetPath: `/assets/textureAtlas/textures/${textureIndex}/provenanceId`,
      provenanceId: textureEntry.provenanceId,
      reason: "provenance-record-missing"
    }));
    return checks;
  }

  const allowedAssetIds: readonly string[] = [
    textureEntry.textureId,
    ...(textureEntry.sourceAssetId === undefined ? [] : [textureEntry.sourceAssetId])
  ];

  if (!allowedAssetIds.includes(provenanceRecord.assetId)) {
    checks.push(createTextureProvenanceMismatchCheck({
      textureId: textureEntry.textureId,
      targetPath: `/assets/textureAtlas/textures/${textureIndex}/provenanceId`,
      provenanceId: textureEntry.provenanceId,
      provenanceAssetId: provenanceRecord.assetId,
      expectedAssetIds: allowedAssetIds,
      rightsAssetId: "n/a",
      reason: "texture-entry-provenance-asset-mismatch"
    }));
  }

  return checks;
};

const validatePreviewAssetReference = (
  previewAsset: TexturePreviewAssetDto,
  previewAssetIndex: number,
  indexes: TextureAssetIndexes
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const textureEntry = indexes.textureEntriesById.get(previewAsset.textureId);
  const sourceAsset = indexes.sourceAssetsById.get(previewAsset.sourceAssetId);

  if (textureEntry !== undefined && (
    (textureEntry.entry.sourceAssetId !== undefined && textureEntry.entry.sourceAssetId !== previewAsset.sourceAssetId) ||
    (textureEntry.entry.sourceLayerId !== undefined && textureEntry.entry.sourceLayerId !== previewAsset.sourceLayerId)
  )) {
    checks.push(createTextureSourceLayerMismatchCheck({
      textureId: previewAsset.textureId,
      previewAssetId: previewAsset.previewAssetId,
      previewAssetIndex,
      targetPath: `/assets/textureAtlas/previewAssets/${previewAssetIndex}/sourceLayerId`,
      sourceAssetId: previewAsset.sourceAssetId,
      textureSourceLayerId: textureEntry.entry.sourceLayerId ?? "missing",
      previewSourceLayerId: previewAsset.sourceLayerId,
      expectedSourceLayerId: textureEntry.entry.sourceLayerId,
      reason: "texture-entry-preview-source-mismatch"
    }));
  }

  if (!sourceLayerBelongsToSourceAsset(sourceAsset, previewAsset.sourceLayerId)) {
    checks.push(createTextureSourceLayerMismatchCheck({
      textureId: previewAsset.textureId,
      previewAssetId: previewAsset.previewAssetId,
      previewAssetIndex,
      targetPath: `/assets/textureAtlas/previewAssets/${previewAssetIndex}/sourceLayerId`,
      sourceAssetId: previewAsset.sourceAssetId,
      textureSourceLayerId: previewAsset.sourceLayerId,
      expectedSourceLayerId: findSourceLayerById(sourceAsset, previewAsset.sourceLayerId)?.sourceLayerId,
      reason: sourceAsset === undefined ? "preview-source-asset-missing" : "preview-source-layer-missing"
    }));
  }

  const provenanceRecord = indexes.provenanceById.get(previewAsset.provenanceId);
  const targetPath = `/assets/textureAtlas/previewAssets/${previewAssetIndex}/provenanceId`;

  if (provenanceRecord === undefined) {
    checks.push(createTextureProvenanceMissingCheck({
      textureId: previewAsset.textureId,
      previewAssetId: previewAsset.previewAssetId,
      targetPath,
      provenanceId: previewAsset.provenanceId,
      reason: "preview-provenance-record-missing"
    }));
    return checks;
  }

  if (provenanceRecord.assetId !== previewAsset.rightsAssetId) {
    checks.push(createTextureProvenanceMismatchCheck({
      textureId: previewAsset.textureId,
      previewAssetId: previewAsset.previewAssetId,
      targetPath,
      provenanceId: previewAsset.provenanceId,
      provenanceAssetId: provenanceRecord.assetId,
      expectedAssetIds: [previewAsset.rightsAssetId],
      rightsAssetId: previewAsset.rightsAssetId,
      reason: "preview-provenance-rights-asset-mismatch"
    }));
  }

  if (!indexes.rightsByAssetId.has(previewAsset.rightsAssetId)) {
    checks.push(createTextureProvenanceMismatchCheck({
      textureId: previewAsset.textureId,
      previewAssetId: previewAsset.previewAssetId,
      targetPath: `/assets/textureAtlas/previewAssets/${previewAssetIndex}/rightsAssetId`,
      provenanceId: previewAsset.provenanceId,
      provenanceAssetId: provenanceRecord.assetId,
      expectedAssetIds: [previewAsset.rightsAssetId],
      rightsAssetId: previewAsset.rightsAssetId,
      reason: "preview-rights-record-missing"
    }));
  }

  return checks;
};

const validateDrawableTextureSourceLayerMapping = (
  drawable: DrawableDto,
  drawableIndex: number,
  sourceAsset: SourceAssetDto,
  textureEntry: TextureAtlasEntryWithIndex,
  previewAsset: TexturePreviewAssetWithIndex | undefined
): readonly ValidationCheckResultDto[] => {
  const expectedLayer = findMappedSourceLayerForDrawable(sourceAsset, drawable);
  if (expectedLayer === undefined) {
    return [
      createTextureSourceLayerMismatchCheck({
        textureId: drawable.textureId,
        drawable,
        drawableIndex,
        targetPath: `/model/drawables/drawables/${drawableIndex}/textureId`,
        sourceAssetId: drawable.sourceAssetId,
        textureSourceLayerId: textureEntry.entry.sourceLayerId ?? "missing",
        previewSourceLayerId: previewAsset?.asset.sourceLayerId,
        expectedSourceLayerId: "missing",
        reason: "drawable-source-layer-mapping-missing"
      })
    ];
  }

  const textureLayerMatches = textureEntry.entry.sourceAssetId === drawable.sourceAssetId &&
    textureEntry.entry.sourceLayerId === expectedLayer.sourceLayerId;
  const previewLayerMatches = previewAsset === undefined ||
    (previewAsset.asset.sourceAssetId === drawable.sourceAssetId &&
      previewAsset.asset.sourceLayerId === expectedLayer.sourceLayerId);

  if (textureLayerMatches && previewLayerMatches) {
    return [];
  }

  return [
    createTextureSourceLayerMismatchCheck({
      textureId: drawable.textureId,
      drawable,
      drawableIndex,
      targetPath: `/model/drawables/drawables/${drawableIndex}/textureId`,
      sourceAssetId: drawable.sourceAssetId,
      textureSourceLayerId: textureEntry.entry.sourceLayerId ?? "missing",
      previewSourceLayerId: previewAsset?.asset.sourceLayerId,
      expectedSourceLayerId: expectedLayer.sourceLayerId,
      reason: "drawable-texture-source-layer-mismatch"
    })
  ];
};

const createMissingTexturePreviewCheck = (
  drawable: DrawableDto,
  drawableIndex: number,
  textureEntry: TextureAtlasEntryWithIndex,
  sourceAsset: SourceAssetDto,
  indexes: TextureAssetIndexes
): ValidationCheckResultDto => {
  const targetPath = "/assets/textureAtlas/previewAssets";

  return ValidationCheckResultSchema.parse({
    checkId: "ref.texturePreviewMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "texture",
      id: drawable.textureId,
      path: targetPath
    },
    targetPath,
    message: `Visible drawable ${drawable.drawableId} texture ${drawable.textureId} has no preview asset payload.`,
    evidence: [
      `drawableId=${drawable.drawableId}`,
      `drawableIndex=${drawableIndex}`,
      `textureId=${drawable.textureId}`,
      `textureAtlasMatch=present`,
      `textureEntryIndex=${textureEntry.index}`,
      `previewAssetsPresent=${indexes.previewAssetsByTextureId.size > 0}`,
      "previewAssetMatch=missing",
      `runtimeVisibility=${drawable.runtimeVisibility}`,
      `sourceAssetId=${drawable.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The validator can resolve the texture atlas entry, but preview evidence cannot prove a texture-backed drawable payload."
  });
};

const createTextureSourceLayerMismatchCheck = (input: {
  readonly textureId: string;
  readonly drawable?: DrawableDto;
  readonly drawableIndex?: number;
  readonly previewAssetId?: string;
  readonly previewAssetIndex?: number;
  readonly targetPath: string;
  readonly sourceAssetId: string;
  readonly textureSourceLayerId: string;
  readonly previewSourceLayerId?: string | undefined;
  readonly expectedSourceLayerId: string | undefined;
  readonly reason: string;
}): ValidationCheckResultDto => {
  return ValidationCheckResultSchema.parse({
    checkId: "ref.textureSourceLayerMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "texture",
      id: input.textureId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Texture ${input.textureId} source layer metadata does not match its source drawable mapping.`,
    evidence: [
      `textureId=${input.textureId}`,
      ...(input.drawable === undefined ? [] : [
        `drawableId=${input.drawable.drawableId}`,
        `drawableSourceAssetId=${input.drawable.sourceAssetId}`
      ]),
      ...(input.previewAssetId === undefined ? [] : [`previewAssetId=${input.previewAssetId}`]),
      `sourceAssetId=${input.sourceAssetId}`,
      `textureSourceLayerId=${input.textureSourceLayerId}`,
      ...(input.previewSourceLayerId === undefined ? [] : [`previewSourceLayerId=${input.previewSourceLayerId}`]),
      `expectedSourceLayerId=${input.expectedSourceLayerId ?? "missing"}`,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"],
    impact: "The texture cannot be traced to the same source layer that produced the visible drawable."
  });
};

const createTextureProvenanceMissingCheck = (input: {
  readonly textureId: string;
  readonly previewAssetId?: string;
  readonly targetPath: string;
  readonly provenanceId: string;
  readonly reason: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.textureProvenanceMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: {
      kind: "texture",
      id: input.textureId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Texture ${input.textureId} has no resolvable provenance record.`,
    evidence: [
      `textureId=${input.textureId}`,
      ...(input.previewAssetId === undefined ? [] : [`previewAssetId=${input.previewAssetId}`]),
      `provenanceId=${input.provenanceId}`,
      "provenanceIdMatch=missing",
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "The validator cannot trace creator, license, AI use, or transform history for this texture asset."
  });

const createTextureProvenanceMismatchCheck = (input: {
  readonly textureId: string;
  readonly previewAssetId?: string;
  readonly targetPath: string;
  readonly provenanceId: string;
  readonly provenanceAssetId: string;
  readonly expectedAssetIds: readonly string[];
  readonly rightsAssetId: string;
  readonly reason: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.textureProvenanceMismatch",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: {
      kind: "texture",
      id: input.textureId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Texture ${input.textureId} provenance does not match its texture or rights asset metadata.`,
    evidence: [
      `textureId=${input.textureId}`,
      ...(input.previewAssetId === undefined ? [] : [`previewAssetId=${input.previewAssetId}`]),
      `provenanceId=${input.provenanceId}`,
      `provenanceAssetId=${input.provenanceAssetId}`,
      `expectedAssetIds=${input.expectedAssetIds.join(",")}`,
      `rightsAssetId=${input.rightsAssetId}`,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "Texture rights and provenance cannot be trusted because the metadata points at different assets."
  });

const sourceLayerBelongsToSourceAsset = (
  sourceAsset: SourceAssetDto | undefined,
  sourceLayerId: string
): boolean =>
  sourceAsset !== undefined &&
  findSourceLayerById(sourceAsset, sourceLayerId)?.sourceAssetId === sourceAsset.sourceAssetId;

const findSourceLayerById = (
  sourceAsset: SourceAssetDto | undefined,
  sourceLayerId: string
): SourceLayerDto | undefined =>
  sourceAsset?.layers.find((layer) => layer.sourceLayerId === sourceLayerId);

const findMappedSourceLayerForDrawable = (
  sourceAsset: SourceAssetDto,
  drawable: DrawableDto
): SourceLayerDto | undefined =>
  sourceAsset.layers.find((layer) =>
    layer.sourceAssetId === drawable.sourceAssetId &&
    layer.mappedDrawableIds.includes(drawable.drawableId)
  );
