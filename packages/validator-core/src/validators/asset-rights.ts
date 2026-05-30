import type {
  PackageDocumentDto,
  RightsRecordDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const validateSourceAssetRightsAndProvenance = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const provenanceByAssetId = indexRecordsByAssetId(packageDocument.assets.provenance.records);
  const rightsByAssetId = indexSingleRecordByAssetId(packageDocument.assets.rights.records);
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.assets.sourceManifest.sourceAssets.forEach((sourceAsset, sourceAssetIndex) => {
    const sourceAssetPath = `/assets/sourceManifest/sourceAssets/${sourceAssetIndex}`;
    const provenanceRecords = provenanceByAssetId.get(sourceAsset.sourceAssetId) ?? [];
    const rightsRecord = rightsByAssetId.get(sourceAsset.sourceAssetId);
    const rightsRecordIndex = rightsRecord === undefined
      ? -1
      : packageDocument.assets.rights.records.indexOf(rightsRecord);

    if (provenanceRecords.length === 0) {
      checks.push(createMissingProvenanceCheck(sourceAsset, sourceAssetPath));
    }

    if (rightsRecord === undefined) {
      checks.push(createMissingRightsCheck(sourceAsset, sourceAssetPath));
      return;
    }

    if (rightsRecord.rightsStatus === "needs_review") {
      checks.push(createNeedsReviewRightsCheck(sourceAsset, rightsRecord, rightsRecordIndex));
    }

    if (rightsRecord.rightsStatus === "blocked") {
      checks.push(createBlockedRightsCheck(sourceAsset, rightsRecord, rightsRecordIndex));
    }
  });

  return checks;
};

const createMissingProvenanceCheck = (
  sourceAsset: SourceAssetDto,
  sourceAssetPath: string
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.provenanceMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: sourceAssetPath
    },
    targetPath: sourceAssetPath,
    message: `Source asset ${sourceAsset.sourceAssetId} has no provenance record.`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`,
      `filePath=${sourceAsset.filePath}`,
      "provenanceRecords=0"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "The validator cannot trace creator, license, AI use, or transform history for this source asset."
  });

const createMissingRightsCheck = (
  sourceAsset: SourceAssetDto,
  sourceAssetPath: string
): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "rights.recordMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: sourceAssetPath
    },
    targetPath: sourceAssetPath,
    message: `Source asset ${sourceAsset.sourceAssetId} has no rights record.`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`,
      `filePath=${sourceAsset.filePath}`,
      "rightsRecords=0"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "The package cannot prove whether this source asset is cleared, needs review, or blocked."
  });

const createNeedsReviewRightsCheck = (
  sourceAsset: SourceAssetDto,
  rightsRecord: RightsRecordDto,
  rightsRecordIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/assets/rights/records/${rightsRecordIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "rights.statusNeedsReview",
    status: "needs_review",
    severity: "warning",
    phase: "rights",
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message: `Source asset ${sourceAsset.sourceAssetId} rights status needs review.`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`,
      `rightsStatus=${rightsRecord.rightsStatus}`,
      `license=${rightsRecord.license}`,
      `redistributionAllowed=${rightsRecord.redistributionAllowed}`
    ],
    relatedAC: ["AC-MVP-002"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "The package is structurally readable, but final MVP acceptance needs a human rights decision."
  });
};

const createBlockedRightsCheck = (
  sourceAsset: SourceAssetDto,
  rightsRecord: RightsRecordDto,
  rightsRecordIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/assets/rights/records/${rightsRecordIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "rights.statusBlocked",
    status: "fail",
    severity: "blocking",
    phase: "rights",
    target: {
      kind: "sourceAsset",
      id: sourceAsset.sourceAssetId,
      path: targetPath
    },
    targetPath,
    message: `Source asset ${sourceAsset.sourceAssetId} rights status is blocked.`,
    evidence: [
      `sourceAssetId=${sourceAsset.sourceAssetId}`,
      `sourceKind=${sourceAsset.kind}`,
      `rightsStatus=${rightsRecord.rightsStatus}`,
      `license=${rightsRecord.license}`,
      `redistributionAllowed=${rightsRecord.redistributionAllowed}`
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-013"],
    relatedScenarios: ["SC-RIGHTS-002"],
    impact: "Blocked rights make the source asset unusable for an MVP package candidate."
  });
};

const indexRecordsByAssetId = <TRecord extends { readonly assetId: string }>(
  records: readonly TRecord[]
): ReadonlyMap<string, readonly TRecord[]> => {
  const index = new Map<string, TRecord[]>();

  for (const record of records) {
    const existing = index.get(record.assetId) ?? [];
    existing.push(record);
    index.set(record.assetId, existing);
  }

  return index;
};

const indexSingleRecordByAssetId = <TRecord extends { readonly assetId: string }>(
  records: readonly TRecord[]
): ReadonlyMap<string, TRecord> => new Map(records.map((record) => [record.assetId, record]));
