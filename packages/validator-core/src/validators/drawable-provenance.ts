import type {
  DrawableDto,
  PackageDocumentDto,
  ProvenanceRecordDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const validateDrawableProvenanceReferences = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const provenanceById = new Map(
    packageDocument.assets.provenance.records.map((record) => [
      record.provenanceId,
      record
    ])
  );
  const checks: ValidationCheckResultDto[] = [];

  packageDocument.model.drawables.drawables.forEach((drawable, drawableIndex) => {
    const provenanceRecord = provenanceById.get(drawable.sourceProvenanceId);

    if (provenanceRecord === undefined) {
      checks.push(createMissingDrawableProvenanceCheck(drawable, drawableIndex));
      return;
    }

    if (provenanceRecord.assetId !== drawable.sourceAssetId) {
      checks.push(createMismatchedDrawableProvenanceCheck(drawable, drawableIndex, provenanceRecord));
    }
  });

  return checks;
};

const createMissingDrawableProvenanceCheck = (
  drawable: DrawableDto,
  drawableIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/drawables/drawables/${drawableIndex}/sourceProvenanceId`;

  return ValidationCheckResultSchema.parse({
    checkId: "rights.drawableProvenanceMissing",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: {
      kind: "drawable",
      id: drawable.drawableId,
      path: targetPath
    },
    targetPath,
    message: `Drawable ${drawable.drawableId} references missing source provenance ${drawable.sourceProvenanceId}.`,
    evidence: [
      `drawableId=${drawable.drawableId}`,
      `sourceAssetId=${drawable.sourceAssetId}`,
      `sourceProvenanceId=${drawable.sourceProvenanceId}`,
      "provenanceIdMatch=missing"
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "The drawable cannot be traced to the provenance record that justifies its source asset use."
  });
};

const createMismatchedDrawableProvenanceCheck = (
  drawable: DrawableDto,
  drawableIndex: number,
  provenanceRecord: ProvenanceRecordDto
): ValidationCheckResultDto => {
  const targetPath = `/model/drawables/drawables/${drawableIndex}/sourceProvenanceId`;

  return ValidationCheckResultSchema.parse({
    checkId: "rights.drawableProvenanceMismatch",
    status: "fail",
    severity: "error",
    phase: "rights",
    target: {
      kind: "drawable",
      id: drawable.drawableId,
      path: targetPath
    },
    targetPath,
    message: `Drawable ${drawable.drawableId} source provenance does not belong to ${drawable.sourceAssetId}.`,
    evidence: [
      `drawableId=${drawable.drawableId}`,
      `sourceAssetId=${drawable.sourceAssetId}`,
      `sourceProvenanceId=${drawable.sourceProvenanceId}`,
      `provenanceAssetId=${provenanceRecord.assetId}`,
      `provenanceAssetKind=${provenanceRecord.assetKind}`
    ],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002", "SC-RIGHTS-002"],
    impact: "The drawable points at a provenance record for a different asset, so source attribution is ambiguous."
  });
};
