import {
  RuntimeEvaluationContextSchema,
  RuntimeSequenceFrameSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactRefSchema,
  RuntimeStateSequenceArtifactSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeStateDto,
  RuntimeStateSequenceArtifact,
  RuntimeStateSequenceArtifactRef
} from "@private-2d-rigging-lab/contracts";
import type { z } from "zod";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import {
  runtimeArtifactJsonMediaType,
  stringifyRuntimeArtifactJson
} from "./runtime-artifact-json.js";
import {
  evaluateRuntimeFrame
} from "./runtime-core.js";
import {
  RuntimeEvaluationOptionsSchema
} from "./runtime-options.js";
import type { RuntimeEvaluationOptionsInput } from "./runtime-options.js";
import {
  createRuntimeStateSequenceArtifactRef
} from "./runtime-state-artifacts.js";
import type { RuntimeSnapshotDto } from "./snapshot.js";

export type RuntimeStateSequenceFrameInput = z.input<typeof RuntimeSequenceFrameSchema>;
export type RuntimeStateSequenceEvaluationContextInput = z.input<typeof RuntimeEvaluationContextSchema>;

export interface RuntimeStateSequenceArtifactEvaluationInput {
  readonly graph: NormalizedRuntimeGraph;
  readonly frames: readonly RuntimeStateSequenceFrameInput[];
  readonly initialState: RuntimeStateDto;
  readonly options: RuntimeEvaluationOptionsInput;
  readonly context: RuntimeStateSequenceEvaluationContextInput;
  readonly label?: string;
  readonly inputFramesHash?: string;
}

export interface RuntimeStateSequenceArtifactEvaluation {
  readonly ref: RuntimeStateSequenceArtifactRef;
  readonly artifact: RuntimeStateSequenceArtifact;
  readonly snapshots: readonly RuntimeSnapshotDto[];
  readonly finalState: RuntimeStateDto;
}

export interface RuntimeStateSequenceArtifactInput {
  readonly artifact: RuntimeStateSequenceArtifact;
  readonly path: RuntimeStateSequenceArtifactRef;
}

export interface RuntimeStateSequenceMaterializedArtifact {
  readonly kind: "runtimeStateSequence";
  readonly path: RuntimeStateSequenceArtifactRef;
  readonly mediaType: typeof runtimeArtifactJsonMediaType;
  readonly content: string;
  readonly artifact: RuntimeStateSequenceArtifact;
}

export const evaluateRuntimeStateSequenceArtifact = (
  input: RuntimeStateSequenceArtifactEvaluationInput
): RuntimeStateSequenceArtifactEvaluation => {
  const frames = input.frames.map((frame) => RuntimeSequenceFrameSchema.parse(frame));
  const options = RuntimeEvaluationOptionsSchema.parse(input.options);
  const context = RuntimeEvaluationContextSchema.parse(input.context);
  const initialState = RuntimeStateDtoSchema.parse(input.initialState);
  const states: RuntimeStateDto[] = [initialState];
  const snapshots: RuntimeSnapshotDto[] = [];
  let currentState = initialState;

  for (const frame of frames) {
    const result = evaluateRuntimeFrame(
      input.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: frame.frameIndex,
        deltaTimeMs: frame.deltaTimeMs,
        resetReasons: frame.resetReasons,
        authoredParameterValues: frame.authoredParameterValues,
        targetIds: frame.targetIds
      },
      currentState,
      options,
      context
    );
    snapshots.push(result.snapshot);
    currentState = result.nextState;
    states.push(currentState);
  }

  const artifact = RuntimeStateSequenceArtifactSchema.parse({
    schemaVersion: "runtime-state-sequence-v1",
    packageId: input.graph.packageId,
    packageRevision: input.graph.packageRevision,
    ...(input.graph.packageHash === undefined ? {} : { packageHash: input.graph.packageHash }),
    fixedStepMs: initialState.fixedStepMs,
    frameCount: frames.length,
    ...(input.inputFramesHash === undefined ? {} : { inputFramesHash: input.inputFramesHash }),
    runtimeEvaluationContext: context,
    evaluatorVersionSummary: options.evaluatorVersions,
    states
  });
  assertRuntimeStateSequenceLength(artifact);

  return {
    ref: createRuntimeStateSequenceArtifactRef(
      input.label === undefined
        ? { graph: input.graph }
        : {
            graph: input.graph,
            label: input.label
          }
    ),
    artifact,
    snapshots,
    finalState: currentState
  };
};

export const materializeRuntimeStateSequenceArtifact = (
  input: RuntimeStateSequenceArtifactInput
): RuntimeStateSequenceMaterializedArtifact => {
  const artifact = RuntimeStateSequenceArtifactSchema.parse(input.artifact);
  assertRuntimeStateSequenceLength(artifact);
  const path = RuntimeStateSequenceArtifactRefSchema.parse(input.path);

  return {
    kind: "runtimeStateSequence",
    path,
    mediaType: runtimeArtifactJsonMediaType,
    content: stringifyRuntimeArtifactJson(artifact),
    artifact
  };
};

const assertRuntimeStateSequenceLength = (
  artifact: RuntimeStateSequenceArtifact
): void => {
  if (artifact.states.length !== artifact.frameCount + 1) {
    throw new Error(
      `Runtime state sequence artifact requires states.length to equal frameCount + 1; got ${artifact.states.length} states for ${artifact.frameCount} frames.`
    );
  }
};
