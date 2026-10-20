import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";

import { buildValidationReport } from "./report-builder.js";
import type { ValidationReportBuildInput } from "./report-builder.js";
import type { ValidationReportDto } from "./validation-report.js";
import { ValidationReportEvidenceSchema } from "./validation-report.js";
import { validateRuntimeSnapshotEvidence } from "./validators/runtime-evidence.js";

export interface RuntimeEvidenceReportInput
  extends Omit<ValidationReportBuildInput, "evidence"> {
  readonly runtimeSnapshotIds?: readonly (RuntimeSnapshotId | string)[];
  readonly supplementalGuiEvidenceRefs?: readonly string[];
}

export const buildRuntimeEvidenceReport = (
  input: RuntimeEvidenceReportInput
): ValidationReportDto => {
  const runtimeEvidence = validateRuntimeSnapshotEvidence(
    input.runtimeSnapshotIds === undefined
      ? {}
      : { runtimeSnapshotIds: input.runtimeSnapshotIds }
  );
  const evidence = ValidationReportEvidenceSchema.parse({
    runtimeSnapshotIds: runtimeEvidence.runtimeSnapshotIds,
    supplementalGuiEvidenceRefs: input.supplementalGuiEvidenceRefs ?? []
  });

  return buildValidationReport({
    ...input,
    evidence
  });
};
