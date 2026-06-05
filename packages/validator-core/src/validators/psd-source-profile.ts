import type {
  DrawableDto,
  PackageDocumentDto,
  ProvenanceRecordDto,
  SourceAssetDto,
  SourceLayerDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import { validatePsdMaterializedAssetDiagnostics } from "./psd-materialized-asset-diagnostics.js";
import {
  createStructuredProfileMismatchCheck,
  createStructuredProfileMissingCheck,
  hasFlattenedPsdProfileEvidence,
  validateStructuredPsdProfile
} from "./psd-source-profile-structured.js";

export const validatePsdSourceProfiles = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const indexes = createPsdSourceProfileIndexes(packageDocument);
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.assets.sourceManifest.sourceAssets.forEach((sourceAsset, sourceAssetIndex) => {
    if (sourceAsset.psdProfile !== undefined && !isPsdSourceProfile(sourceAsset)) {
      checks.push(createStructuredProfileMismatchCheck(sourceAsset, sourceAssetIndex));
      return;
    }

    if (!isPsdSourceProfile(sourceAsset)) {
      return;
    }

    if (sourceAsset.psdProfile === undefined) {
      if (hasFlattenedPsdProfileEvidence(sourceAsset)) {
        checks.push(createStructuredProfileMissingCheck(sourceAsset, sourceAssetIndex));
      }
    } else {
      checks.push(...validateStructuredPsdProfile(sourceAsset, sourceAssetIndex, sourceAsset.psdProfile));
    }

    sourceAsset.layers.forEach((sourceLayer, sourceLayerIndex) => {
      checks.push(
        ...(sourceAsset.psdProfile === undefined
          ? validateUnsupportedLayerFeatures(sourceAsset, sourceAssetIndex, sourceLayer, sourceLayerIndex)
          : []),
        ...validateMappedLayerProvenance(sourceAsset, sourceAssetIndex, sourceLayer, sourceLayerIndex, indexes)
      );
    });
  });

  return [
    ...checks,
    ...validatePsdMaterializedAssetDiagnostics(packageDocument)
  ];
};

interface PsdSourceProfileIndexes {
  readonly drawablesById: ReadonlyMap<string, DrawableDto>;
  readonly provenanceById: ReadonlyMap<string, ProvenanceRecordDto>;
}

const createPsdSourceProfileIndexes = (packageDocument: PackageDocumentDto): PsdSourceProfileIndexes => ({
  drawablesById: new Map(
    packageDocument.model.drawables.drawables.map((drawable) => [
      drawable.drawableId,
      drawable
    ])
  ),
  provenanceById: new Map(
    packageDocument.assets.provenance.records.map((record) => [
      record.provenanceId,
      record
    ])
  )
});

const isPsdSourceProfile = (sourceAsset: SourceAssetDto): boolean =>
  sourceAsset.kind === "psd-source-v1" ||
  sourceAsset.importProfile === "layered-character-psd-profile-v1";

const validateUnsupportedLayerFeatures = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  sourceLayer: SourceLayerDto,
  sourceLayerIndex: number
): readonly ValidationCheckResultDto[] =>
  sourceLayer.unsupportedFeatures.map((unsupportedFeature, unsupportedFeatureIndex) =>
    createUnsupportedFeatureCheck({
      sourceAsset,
      sourceAssetIndex,
      sourceLayer,
      sourceLayerIndex,
      unsupportedFeature,
      unsupportedFeatureIndex
    })
  );

const validateMappedLayerProvenance = (
  sourceAsset: SourceAssetDto,
  sourceAssetIndex: number,
  sourceLayer: SourceLayerDto,
  sourceLayerIndex: number,
  indexes: PsdSourceProfileIndexes
): readonly ValidationCheckResultDto[] => {
  if (sourceLayer.mappedDrawableIds.length === 0) {
    return [];
  }

  return sourceLayer.mappedDrawableIds.flatMap((mappedDrawableId, mappedDrawableIndex) => {
    const drawable = indexes.drawablesById.get(mappedDrawableId);

    if (drawable === undefined) {
      return [
        createMissingLayerProvenanceCheck({
          sourceAsset,
          sourceAssetIndex,
          sourceLayer,
          sourceLayerIndex,
          mappedDrawableId,
          mappedDrawableIndex,
          sourceProvenanceId: "missing",
          provenanceAssetId: "missing",
          provenanceAssetKind: "missing",
          reason: "mapped-drawable-missing"
        })
      ];
    }

    const provenanceRecord = indexes.provenanceById.get(drawable.sourceProvenanceId);
    if (
      provenanceRecord !== undefined &&
      provenanceRecord.assetId === sourceAsset.sourceAssetId &&
      (provenanceRecord.assetKind === "source" ||
        isPrivateLocalMaterializedLayerProvenance(sourceAsset, sourceLayer, drawable.sourceProvenanceId))
    ) {
      return [];
    }

    return [
      createMissingLayerProvenanceCheck({
        sourceAsset,
        sourceAssetIndex,
        sourceLayer,
        sourceLayerIndex,
        mappedDrawableId,
        mappedDrawableIndex,
        sourceProvenanceId: drawable.sourceProvenanceId,
        provenanceAssetId: provenanceRecord?.assetId ?? "missing",
        provenanceAssetKind: provenanceRecord?.assetKind ?? "missing",
        reason: provenanceRecord === undefined
          ? "drawable-source-provenance-missing"
          : "drawable-source-provenance-asset-mismatch"
      })
    ];
  });
};

const isPrivateLocalMaterializedLayerProvenance = (
  sourceAsset: SourceAssetDto,
  sourceLayer: SourceLayerDto,
  provenanceId: string
): boolean =>
  sourceAsset.psdProfile?.materializationEvidence?.some((materialization) =>
    materialization.sourceLayerRef.sourceAssetId === sourceAsset.sourceAssetId &&
    materialization.sourceLayerRef.sourceLayerId === sourceLayer.sourceLayerId &&
    materialization.binaryAssetRef?.provenanceId === provenanceId &&
    (
      materialization.provenance.privacyLabel === "packageLocalAsset" ||
      materialization.provenance.privacyLabel === "privateLocalFixture"
    ) &&
    materialization.provenance.publicDistribution === "notPublicDistributable" &&
    materialization.provenance.publicDemoAsset === false
  ) === true;

const createUnsupportedFeatureCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly sourceLayer: SourceLayerDto;
  readonly sourceLayerIndex: number;
  readonly unsupportedFeature: string;
  readonly unsupportedFeatureIndex: number;
}): ValidationCheckResultDto => {
  const targetPath =
    `/assets/sourceManifest/sourceAssets/${input.sourceAssetIndex}` +
    `/layers/${input.sourceLayerIndex}/unsupportedFeatures/${input.unsupportedFeatureIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "asset.psd.unsupportedFeature",
    status: "needs_review",
    severity: "warning",
    phase: "source_import",
    target: {
      kind: "sourceAsset",
      id: input.sourceAsset.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message: `PSD source layer ${input.sourceLayer.sourceLayerId} records unsupported feature ${input.unsupportedFeature}.`,
    evidence: [
      `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
      `sourceKind=${input.sourceAsset.kind}`,
      `importProfile=${input.sourceAsset.importProfile}`,
      `sourceLayerId=${input.sourceLayer.sourceLayerId}`,
      `sourceLayerRole=${input.sourceLayer.role}`,
      `unsupportedFeature=${input.unsupportedFeature}`,
      `unsupportedFeatureIndex=${input.unsupportedFeatureIndex}`,
      "flatteningStrategy=sourceLayer.unsupportedFeatures[]"
    ],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-003"],
    impact: "The PSD source profile is structurally readable, but this layer feature needs manual review or a future adapter/rasterization path before final acceptance."
  });
};

const createMissingLayerProvenanceCheck = (input: {
  readonly sourceAsset: SourceAssetDto;
  readonly sourceAssetIndex: number;
  readonly sourceLayer: SourceLayerDto;
  readonly sourceLayerIndex: number;
  readonly mappedDrawableId: string;
  readonly mappedDrawableIndex: number;
  readonly sourceProvenanceId: string;
  readonly provenanceAssetId: string;
  readonly provenanceAssetKind: string;
  readonly reason: string;
}): ValidationCheckResultDto => {
  const targetPath =
    `/assets/sourceManifest/sourceAssets/${input.sourceAssetIndex}` +
    `/layers/${input.sourceLayerIndex}/mappedDrawableIds/${input.mappedDrawableIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "rights.psdLayerProvenanceMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: {
      kind: "sourceAsset",
      id: input.sourceAsset.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message: `PSD source layer ${input.sourceLayer.sourceLayerId} mapped drawable ${input.mappedDrawableId} has no source provenance link.`,
    evidence: [
      `sourceAssetId=${input.sourceAsset.sourceAssetId}`,
      `sourceKind=${input.sourceAsset.kind}`,
      `importProfile=${input.sourceAsset.importProfile}`,
      `sourceLayerId=${input.sourceLayer.sourceLayerId}`,
      `mappedDrawableId=${input.mappedDrawableId}`,
      `sourceProvenanceId=${input.sourceProvenanceId}`,
      `provenanceAssetId=${input.provenanceAssetId}`,
      `provenanceAssetKind=${input.provenanceAssetKind}`,
      `reason=${input.reason}`,
      "contractSupport=drawable.sourceProvenanceId"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "The validator cannot trace this PSD layer mapping through drawable source provenance to a cleared source asset."
  });
};
