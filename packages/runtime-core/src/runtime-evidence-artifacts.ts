import {
  RuntimeStateArtifactRefSchema,
  RuntimeStateSequenceArtifactRefSchema
} from "@private-2d-rigging-lab/contracts";

import type {
  RuntimeEvidenceBuildInput,
  RuntimeEvidenceResult
} from "./runtime-evidence.js";
import {
  buildRuntimeEvidence
} from "./runtime-evidence.js";
import {
  createRuntimeSnapshotArtifactPath,
  materializeRuntimeSnapshotArtifacts
} from "./runtime-snapshot-artifacts.js";
import type {
  RuntimeSnapshotArtifact
} from "./runtime-snapshot-artifacts.js";
import {
  materializeRuntimeStateSequenceArtifact
} from "./runtime-state-sequence-artifacts.js";
import type {
  RuntimeStateSequenceMaterializedArtifact
} from "./runtime-state-sequence-artifacts.js";
import {
  materializeRuntimeStateArtifact
} from "./runtime-state-artifacts.js";
import type {
  RuntimeStateArtifact
} from "./runtime-state-artifacts.js";

export type RuntimeEvidenceArtifact =
  | RuntimeSnapshotArtifact
  | RuntimeStateArtifact
  | RuntimeStateSequenceMaterializedArtifact;

export interface RuntimeEvidenceArtifactsResult {
  readonly evidence: RuntimeEvidenceResult;
  readonly artifacts: readonly RuntimeEvidenceArtifact[];
}

export const buildRuntimeEvidenceArtifacts = (
  input: RuntimeEvidenceBuildInput
): RuntimeEvidenceArtifactsResult => materializeRuntimeEvidenceArtifacts(buildRuntimeEvidence(input));

export const materializeRuntimeEvidenceArtifacts = (
  evidence: RuntimeEvidenceResult
): RuntimeEvidenceArtifactsResult => {
  const snapshotArtifacts = materializeRuntimeSnapshotArtifacts([
    ...evidence.baselineSnapshots,
    ...evidence.candidateSnapshots
  ]);
  const finalStatePath = RuntimeStateArtifactRefSchema.parse(evidence.finalRuntimeStateRef);
  const finalStateArtifact = materializeRuntimeStateArtifact({
    path: finalStatePath,
    state: evidence.finalRuntimeState
  });
  const sequenceArtifacts = materializeRuntimeEvidenceSequenceArtifacts(evidence);
  const artifacts = [
    ...snapshotArtifacts,
    finalStateArtifact,
    ...sequenceArtifacts
  ];

  assertRuntimeEvidenceArtifactAlignment(evidence, artifacts);

  return {
    evidence,
    artifacts
  };
};

const materializeRuntimeEvidenceSequenceArtifacts = (
  evidence: RuntimeEvidenceResult
): readonly RuntimeStateSequenceMaterializedArtifact[] => {
  if (evidence.runtimeStateSequenceArtifact === undefined) {
    return [];
  }

  const sequenceRef = evidence.generatedRuntimeStateSequenceRefs[0];
  if (sequenceRef === undefined) {
    throw new Error("Runtime evidence has a sequence artifact but no generated sequence ref.");
  }

  return [
    materializeRuntimeStateSequenceArtifact({
      path: RuntimeStateSequenceArtifactRefSchema.parse(sequenceRef),
      artifact: evidence.runtimeStateSequenceArtifact
    })
  ];
};

const assertRuntimeEvidenceArtifactAlignment = (
  evidence: RuntimeEvidenceResult,
  artifacts: readonly RuntimeEvidenceArtifact[]
): void => {
  const artifactPaths = new Set(artifacts.map((artifact) => artifact.path));
  const expectedSnapshotPaths = evidence.generatedRuntimeSnapshotIds.map(createRuntimeSnapshotArtifactPath);

  for (const expectedPath of expectedSnapshotPaths) {
    if (!artifactPaths.has(expectedPath)) {
      throw new Error(`Runtime snapshot artifact path is missing for generated snapshot ID: ${expectedPath}`);
    }
  }

  for (const expectedPath of evidence.generatedRuntimeStateRefs) {
    if (!artifactPaths.has(expectedPath)) {
      throw new Error(`Runtime state artifact path is missing for generated state ref: ${expectedPath}`);
    }
  }

  for (const expectedPath of evidence.generatedRuntimeStateSequenceRefs) {
    if (!artifactPaths.has(expectedPath)) {
      throw new Error(`Runtime state sequence artifact path is missing for generated sequence ref: ${expectedPath}`);
    }
  }
};
