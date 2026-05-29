import type {
  RuntimeDiffDto,
  RuntimeSnapshotId,
  RuntimeStateArtifactRef,
  RuntimeStateDto,
  RuntimeStateSequenceArtifactRef
} from "@private-2d-rigging-lab/contracts";

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
import type { RuntimeEvaluationOptionsInput } from "./runtime-options.js";
import {
  evaluateRuntimeFrame,
  evaluateRuntimeSequence
} from "./runtime-core.js";
import type {
  RuntimeSequenceEvaluationResult,
  RuntimeSequenceFrameInput
} from "./runtime-core.js";
import {
  createRuntimeStateArtifactRef,
  createRuntimeStateSequenceArtifactRef
} from "./runtime-state-artifacts.js";
import type { RuntimeComparisonResult, SnapshotComparisonPolicyInput } from "./snapshot-comparison.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";

export interface RuntimeEvidenceEvaluationInput {
  readonly initialState?: RuntimeStateDto;
  readonly initialStateRequest?: Partial<RuntimeInitialStateRequestInput>;
  readonly frame?: Partial<RuntimeEvaluationInputInput>;
  readonly frames?: readonly RuntimeSequenceFrameInput[];
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
  readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly generatedRuntimeStateRefs: readonly RuntimeStateArtifactRef[];
  readonly generatedRuntimeStateSequenceRefs: readonly RuntimeStateSequenceArtifactRef[];
}

export const buildRuntimeEvidence = (
  input: RuntimeEvidenceBuildInput
): RuntimeEvidenceResult => {
  const options = createDefaultRuntimeEvidenceOptions(input.options);
  const context = createDefaultRuntimeEvidenceContext(input.context);
  const baseline = evaluateEvidenceInput({
    graph: input.baselineGraph,
    evaluation: input.baseline,
    defaultFrameIndex: 0,
    options,
    context
  });
  const candidate = evaluateEvidenceInput({
    graph: input.candidateGraph,
    evaluation: input.candidate,
    defaultFrameIndex: 1,
    options,
    context
  });
  const runtimeComparison = buildRuntimeDiffComparison({
    baselineSnapshot: baseline.snapshot,
    candidateSnapshot: candidate.snapshot,
    comparisonPolicy: input.comparisonPolicy
  });
  const artifactLabel = input.artifactLabel ?? "candidate";
  const finalRuntimeStateRef = createRuntimeStateArtifactRef({
    graph: input.candidateGraph,
    state: candidate.finalState,
    label: `${artifactLabel}-final`
  });
  const sequenceRef = createRuntimeStateSequenceArtifactRef({
    graph: input.candidateGraph,
    label: artifactLabel
  });

  return {
    baselineSnapshot: baseline.snapshot,
    candidateSnapshot: candidate.snapshot,
    baselineSnapshots: baseline.snapshots,
    candidateSnapshots: candidate.snapshots,
    finalRuntimeState: candidate.finalState,
    finalRuntimeStateRef,
    runtimeComparison,
    runtimeDiff: runtimeComparison.diff,
    generatedRuntimeSnapshotIds: uniqueSnapshotIds([
      ...baseline.snapshots.map((snapshot) => snapshot.snapshotId),
      ...candidate.snapshots.map((snapshot) => snapshot.snapshotId)
    ]),
    generatedRuntimeStateRefs: [finalRuntimeStateRef],
    generatedRuntimeStateSequenceRefs: [sequenceRef]
  };
};

interface EvaluateEvidenceInput {
  readonly graph: NormalizedRuntimeGraph;
  readonly evaluation: RuntimeEvidenceEvaluationInput | undefined;
  readonly defaultFrameIndex: number;
  readonly options: ReturnType<typeof createDefaultRuntimeEvidenceOptions>;
  readonly context: RuntimeEvidenceContextDto;
}

interface EvaluatedEvidenceInput {
  readonly snapshot: RuntimeSnapshotDto;
  readonly snapshots: readonly RuntimeSnapshotDto[];
  readonly finalState: RuntimeStateDto;
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
  const result = evaluateRuntimeFrame(
    input.graph,
    frame,
    initialState,
    input.options,
    input.context
  );

  return {
    snapshot: result.snapshot,
    snapshots: [result.snapshot],
    finalState: result.nextState
  };
};

const evaluateEvidenceSequence = (
  input: EvaluateEvidenceInput
): EvaluatedEvidenceInput => {
  const frames = input.evaluation?.frames ?? [];
  const firstFrameAuthoredValues = frames[0]?.authoredParameterValues ?? {};
  const initialState = createEvidenceInitialState(input.graph, input.evaluation, firstFrameAuthoredValues);
  const result = evaluateRuntimeSequence(
    input.graph,
    frames,
    initialState,
    input.options,
    input.context
  );
  const snapshot = lastSnapshot(result);

  return {
    snapshot,
    snapshots: result.snapshots,
    finalState: result.finalState
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

const lastSnapshot = (
  result: RuntimeSequenceEvaluationResult
): RuntimeSnapshotDto => {
  const snapshot = result.snapshots.at(-1);
  if (snapshot === undefined) {
    throw new Error("Runtime evidence sequence evaluation requires at least one snapshot.");
  }

  return snapshot;
};

const uniqueSnapshotIds = (
  snapshotIds: readonly RuntimeSnapshotId[]
): readonly RuntimeSnapshotId[] => [...new Set(snapshotIds)];
