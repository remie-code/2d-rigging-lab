import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";

import type {
  RuntimeComparisonResult,
  SnapshotComparisonPolicyInput
} from "./snapshot-comparison.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";

export interface RuntimeDiffBuildInput {
  readonly baselineSnapshot: RuntimeSnapshotDto;
  readonly candidateSnapshot: RuntimeSnapshotDto;
  readonly comparisonPolicy?: SnapshotComparisonPolicyInput | undefined;
}

export const buildRuntimeDiffComparison = (
  input: RuntimeDiffBuildInput
): RuntimeComparisonResult =>
  compareRuntimeSnapshots(
    input.baselineSnapshot,
    input.candidateSnapshot,
    input.comparisonPolicy
  );

export const buildRuntimeDiff = (
  input: RuntimeDiffBuildInput
): RuntimeDiffDto => buildRuntimeDiffComparison(input).diff;
