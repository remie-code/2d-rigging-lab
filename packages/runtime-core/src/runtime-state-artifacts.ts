import {
  RuntimeStateArtifactRefSchema,
  RuntimeStateSequenceArtifactRefSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeStateArtifactRef,
  RuntimeStateDto,
  RuntimeStateSequenceArtifactRef
} from "@private-2d-rigging-lab/contracts";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";

export interface RuntimeStateArtifactRefInput {
  readonly graph: NormalizedRuntimeGraph;
  readonly state: RuntimeStateDto;
  readonly label?: string;
}

export interface RuntimeStateSequenceArtifactRefInput {
  readonly graph: NormalizedRuntimeGraph;
  readonly label?: string;
}

export const createRuntimeStateArtifactRef = (
  input: RuntimeStateArtifactRefInput
): RuntimeStateArtifactRef =>
  RuntimeStateArtifactRefSchema.parse(
    `runtime/states/${createArtifactStem(input.graph, input.label ?? "final", input.state.frameIndex)}.runtime-state.json`
  );

export const createRuntimeStateSequenceArtifactRef = (
  input: RuntimeStateSequenceArtifactRefInput
): RuntimeStateSequenceArtifactRef =>
  RuntimeStateSequenceArtifactRefSchema.parse(
    `runtime/state-sequences/${createArtifactStem(input.graph, input.label ?? "candidate")}.runtime-state-sequence.json`
  );

const createArtifactStem = (
  graph: NormalizedRuntimeGraph,
  label: string,
  frameIndex?: number
): string => {
  const frameSuffix = frameIndex === undefined ? "" : `-f${frameIndex}`;
  return sanitizeArtifactSegment(`${graph.packageId}-r${graph.packageRevision}-${label}${frameSuffix}`);
};

const sanitizeArtifactSegment = (value: string): string =>
  value.replace(/[^A-Za-z0-9_.-]+/g, "-").replace(/^-+|-+$/g, "") || "runtime-evidence";
