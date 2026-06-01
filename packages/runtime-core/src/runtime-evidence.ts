import type {
  RuntimeDiffDto,
  RuntimeSnapshotId,
  RuntimeStateArtifactRef,
  RuntimeStateDto,
  RuntimeStateSequenceArtifact,
  RuntimeStateSequenceArtifactRef
} from "@private-2d-rigging-lab/contracts";
import { RuntimeSequenceFrameSchema } from "@private-2d-rigging-lab/contracts";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { buildRuntimeDiffComparison } from "./runtime-diff-builder.js";
import {
  createDefaultRuntimeEvidenceContext,
  createDefaultRuntimeEvidenceFrame,
  createDefaultRuntimeEvidenceInitialStateRequest,
  createDefaultRuntimeEvidenceOptions
} from "./runtime-evidence-defaults.js";
import type {
  RuntimeEvidenceContextDto,
  RuntimeEvidenceContextInput
} from "./runtime-evidence-defaults.js";
import type {
  RuntimeEvaluationInputInput,
  RuntimeInitialStateRequestInput
} from "./runtime-input.js";
import {
  createRuntimeMeshEditEvidence
} from "./mesh-evidence.js";
import type { RuntimeMeshEditEvidenceDto } from "./mesh-evidence.js";
import type { RuntimeEvaluationOptionsInput } from "./runtime-options.js";
import {
  evaluateRuntimeStateSequenceArtifact
} from "./runtime-state-sequence-artifacts.js";
import type { RuntimeStateSequenceFrameInput } from "./runtime-state-sequence-artifacts.js";
import {
  createRuntimeStateArtifactRef
} from "./runtime-state-artifacts.js";
import type { RuntimeComparisonResult, SnapshotComparisonPolicyInput } from "./snapshot-comparison.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";

export interface RuntimeEvidenceEvaluationInput {
  readonly initialState?: RuntimeStateDto;
  readonly initialStateRequest?: Partial<RuntimeInitialStateRequestInput>;
  readonly frame?: Partial<RuntimeEvaluationInputInput>;
  readonly frames?: readonly RuntimeStateSequenceFrameInput[];
}

export interface RuntimeEvidenceBuildInput {
  readonly baselineGraph: NormalizedRuntimeGraph;
  readonly candidateGraph: NormalizedRuntimeGraph;
  readonly baseline?: RuntimeEvidenceEvaluationInput;
  readonly candidate?: RuntimeEvidenceEvaluationInput;
  readonly options?: RuntimeEvaluationOptionsInput;
  readonly context?: RuntimeEvidenceContextInput;
  readonly comparisonPolicy?: SnapshotComparisonPolicyInput;
  readonly artifactLabel?: string;
}

export interface RuntimeEvidenceResult {
  readonly baselineSnapshot: RuntimeSnapshotDto;
  readonly candidateSnapshot: RuntimeSnapshotDto;
  readonly baselineSnapshots: readonly RuntimeSnapshotDto[];
  readonly candidateSnapshots: readonly RuntimeSnapshotDto[];
  readonly finalRuntimeState: RuntimeStateDto;
  readonly finalRuntimeStateRef: RuntimeStateArtifactRef;
  readonly runtimeComparison: RuntimeComparisonResult;
  readonly runtimeDiff: RuntimeDiffDto;
  readonly meshEditEvidence: RuntimeMeshEditEvidenceDto;
  readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly generatedRuntimeStateRefs: readonly RuntimeStateArtifactRef[];
  readonly generatedRuntimeStateSequenceRefs: readonly RuntimeStateSequenceArtifactRef[];
  readonly runtimeStateSequenceArtifact?: RuntimeStateSequenceArtifact;
}

export const buildRuntimeEvidence = (
  input: RuntimeEvidenceBuildInput
): RuntimeEvidenceResult => {
  const options = createDefaultRuntimeEvidenceOptions(input.options);
  const context = createDefaultRuntimeEvidenceContext(input.context);
  const artifactLabel = input.artifactLabel ?? "candidate";
  const baseline = evaluateEvidenceInput({
    graph: input.baselineGraph,
    evaluation: input.baseline,
    defaultFrameIndex: 0,
    sequenceArtifactLabel: `${artifactLabel}-baseline`,
    options,
    context
  });
  const candidate = evaluateEvidenceInput({
    graph: input.candidateGraph,
    evaluation: input.candidate,
    defaultFrameIndex: 1,
    sequenceArtifactLabel: artifactLabel,
    options,
    context
  });
  const runtimeComparison = buildRuntimeDiffComparison({
    baselineSnapshot: baseline.snapshot,
    candidateSnapshot: candidate.snapshot,
    comparisonPolicy: input.comparisonPolicy
  });
  const meshEditEvidence = createRuntimeMeshEditEvidence({
    baselineSnapshot: baseline.snapshot,
    candidateSnapshot: candidate.snapshot,
    comparisonPolicy: input.comparisonPolicy
  });
  const finalRuntimeStateRef = createRuntimeStateArtifactRef({
    graph: input.candidateGraph,
    state: candidate.finalState,
    label: `${artifactLabel}-final`
  });
  const sequenceRef = candidate.stateSequenceArtifactRef;

  return {
    baselineSnapshot: baseline.snapshot,
    candidateSnapshot: candidate.snapshot,
    baselineSnapshots: baseline.snapshots,
    candidateSnapshots: candidate.snapshots,
    finalRuntimeState: candidate.finalState,
    finalRuntimeStateRef,
    runtimeComparison,
    runtimeDiff: runtimeComparison.diff,
    meshEditEvidence,
    generatedRuntimeSnapshotIds: uniqueSnapshotIds([
      ...baseline.snapshots.map((snapshot) => snapshot.snapshotId),
      ...candidate.snapshots.map((snapshot) => snapshot.snapshotId)
    ]),
    generatedRuntimeStateRefs: [finalRuntimeStateRef],
    generatedRuntimeStateSequenceRefs: [sequenceRef],
    runtimeStateSequenceArtifact: candidate.stateSequenceArtifact
  };
};

interface EvaluateEvidenceInput {
  readonly graph: NormalizedRuntimeGraph;
  readonly evaluation: RuntimeEvidenceEvaluationInput | undefined;
  readonly defaultFrameIndex: number;
  readonly sequenceArtifactLabel: string;
  readonly options: ReturnType<typeof createDefaultRuntimeEvidenceOptions>;
  readonly context: RuntimeEvidenceContextDto;
}

interface EvaluatedEvidenceInput {
  readonly snapshot: RuntimeSnapshotDto;
  readonly snapshots: readonly RuntimeSnapshotDto[];
  readonly finalState: RuntimeStateDto;
  readonly stateSequenceArtifact: RuntimeStateSequenceArtifact;
  readonly stateSequenceArtifactRef: RuntimeStateSequenceArtifactRef;
}

const evaluateEvidenceInput = (
  input: EvaluateEvidenceInput
): EvaluatedEvidenceInput => {
  if (input.evaluation?.frames !== undefined && input.evaluation.frames.length > 0) {
    return evaluateEvidenceSequence(input);
  }

  const frame = createDefaultRuntimeEvidenceFrame({
    frameIndex: input.defaultFrameIndex,
    ...(input.evaluation?.frame ?? {})
  });
  const initialState = createEvidenceInitialState(input.graph, input.evaluation, frame.authoredParameterValues);
  const result = evaluateRuntimeStateSequenceArtifact({
    graph: input.graph,
    frames: [toRuntimeSequenceFrame(frame)],
    initialState,
    options: input.options,
    context: input.context,
    label: input.sequenceArtifactLabel
  });
  const snapshot = lastSnapshot(result.snapshots);

  return {
    snapshot,
    snapshots: result.snapshots,
    finalState: result.finalState,
    stateSequenceArtifact: result.artifact,
    stateSequenceArtifactRef: result.ref
  };
};

const evaluateEvidenceSequence = (
  input: EvaluateEvidenceInput
): EvaluatedEvidenceInput => {
  const frames = input.evaluation?.frames ?? [];
  const firstFrameAuthoredValues = frames[0]?.authoredParameterValues ?? {};
  const initialState = createEvidenceInitialState(input.graph, input.evaluation, firstFrameAuthoredValues);
  const result = evaluateRuntimeStateSequenceArtifact({
    graph: input.graph,
    frames,
    initialState,
    options: input.options,
    context: input.context,
    label: input.sequenceArtifactLabel
  });
  const snapshot = lastSnapshot(result.snapshots);

  return {
    snapshot,
    snapshots: result.snapshots,
    finalState: result.finalState,
    stateSequenceArtifact: result.artifact,
    stateSequenceArtifactRef: result.ref
  };
};

const createEvidenceInitialState = (
  graph: NormalizedRuntimeGraph,
  evaluation: RuntimeEvidenceEvaluationInput | undefined,
  authoredParameterValues: Readonly<Record<string, number>>
): RuntimeStateDto => {
  if (evaluation?.initialState !== undefined) {
    return evaluation.initialState;
  }

  return createInitialRuntimeState(
    graph,
    createDefaultRuntimeEvidenceInitialStateRequest(graph, {
      authoredParameterValues,
      ...(evaluation?.initialStateRequest ?? {})
    })
  );
};

const toRuntimeSequenceFrame = (
  frame: RuntimeEvaluationInputInput
): RuntimeStateSequenceFrameInput =>
  RuntimeSequenceFrameSchema.parse({
    frameIndex: frame.frameIndex,
    deltaTimeMs: frame.deltaTimeMs,
    resetReasons: frame.resetReasons,
    authoredParameterValues: frame.authoredParameterValues,
    targetIds: frame.targetIds
  });

const lastSnapshot = (
  snapshots: readonly RuntimeSnapshotDto[]
): RuntimeSnapshotDto => {
  const snapshot = snapshots.at(-1);
  if (snapshot === undefined) {
    throw new Error("Runtime evidence sequence evaluation requires at least one snapshot.");
  }

  return snapshot;
};

const uniqueSnapshotIds = (
  snapshotIds: readonly RuntimeSnapshotId[]
): readonly RuntimeSnapshotId[] => [...new Set(snapshotIds)];
