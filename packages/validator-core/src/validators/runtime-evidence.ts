import { RuntimeSnapshotIdSchema } from "@private-2d-rigging-lab/contracts";
import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";

export interface RuntimeSnapshotEvidenceInput {
  readonly runtimeSnapshotIds?: readonly (RuntimeSnapshotId | string)[];
}

export interface RuntimeSnapshotEvidenceDto {
  readonly runtimeSnapshotIds: readonly RuntimeSnapshotId[];
}

export const validateRuntimeSnapshotEvidence = (
  input: RuntimeSnapshotEvidenceInput = {}
): RuntimeSnapshotEvidenceDto => ({
  runtimeSnapshotIds: (input.runtimeSnapshotIds ?? []).map((snapshotId) =>
    RuntimeSnapshotIdSchema.parse(snapshotId)
  )
});
