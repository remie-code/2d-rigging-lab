import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import {
  buildRuntimeEvidenceArtifacts
} from "./runtime-evidence-artifacts.js";
import {
  createDefaultRuntimeEvidenceContext,
  createDefaultRuntimeEvidenceOptions
} from "./runtime-evidence-defaults.js";
import {
  createRuntimeSnapshotArtifactPath
} from "./runtime-snapshot-artifacts.js";
import {
  evaluateRuntimeStateSequenceArtifact,
  materializeRuntimeStateSequenceArtifact
} from "./runtime-state-sequence-artifacts.js";

describe("runtime evidence artifact materializers", () => {
  it("materializes snapshot artifacts and final state artifact with paths matching generated refs", () => {
    const packageId = PackageIdSchema.parse("pkg_artifacts");
    const parameterId = ParameterIdSchema.parse("param_yaw");
    const drawableId = DrawableIdSchema.parse("draw_body");
    const graph = createGraph(packageId, parameterId, drawableId);
    const result = buildRuntimeEvidenceArtifacts({
      baselineGraph: graph,
      candidateGraph: graph,
      candidate: {
        frame: {
          authoredParameterValues: {
            [parameterId]: 1
          },
          targetIds: [drawableId]
        }
      },
      artifactLabel: "operation-dry-run"
    });

    const artifactPaths = result.artifacts.map((artifact) => artifact.path);
    expect(artifactPaths.filter((path) => path.startsWith("runtime/snapshots/"))).toEqual(
      result.evidence.generatedRuntimeSnapshotIds.map(createRuntimeSnapshotArtifactPath)
    );
    expect(artifactPaths).toContain(result.evidence.finalRuntimeStateRef);
    expect(artifactPaths).toContain(result.evidence.generatedRuntimeStateSequenceRefs[0]);

    const finalStateArtifact = result.artifacts.find((artifact) => artifact.kind === "runtimeState");
    expect(finalStateArtifact?.path).toBe(result.evidence.finalRuntimeStateRef);
    expect(RuntimeStateDtoSchema.parse(JSON.parse(finalStateArtifact?.content ?? "{}"))).toEqual(
      result.evidence.finalRuntimeState
    );

    const sequenceArtifact = result.artifacts.find((artifact) => artifact.kind === "runtimeStateSequence");
    expect(sequenceArtifact?.path).toBe(result.evidence.generatedRuntimeStateSequenceRefs[0]);
    expect(RuntimeStateSequenceArtifactSchema.parse(JSON.parse(sequenceArtifact?.content ?? "{}")).states).toEqual([
      expect.objectContaining({ frameIndex: 0 }),
      expect.objectContaining({ frameIndex: 1 })
    ]);
  });

  it("materializes sequence evidence with states[0] initial and states[i + 1] post-frame", () => {
    const packageId = PackageIdSchema.parse("pkg_sequence");
    const parameterId = ParameterIdSchema.parse("param_yaw");
    const drawableId = DrawableIdSchema.parse("draw_body");
    const graph = createGraph(packageId, parameterId, drawableId);
    const initialState = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      frameIndex: 0,
      fixedStepMs: 16.6666667,
      authoredParameterValues: {},
      resetReasons: ["validationRunStart"]
    });
    const sequence = evaluateRuntimeStateSequenceArtifact({
      graph,
      initialState,
      frames: [
        {
          frameIndex: 4,
          deltaTimeMs: 16.6666667,
          resetReasons: [],
          authoredParameterValues: { [parameterId]: 0.25 },
          targetIds: [drawableId]
        },
        {
          frameIndex: 5,
          deltaTimeMs: 16.6666667,
          resetReasons: [],
          authoredParameterValues: { [parameterId]: 0.5 },
          targetIds: [drawableId]
        }
      ],
      options: createDefaultRuntimeEvidenceOptions(),
      context: createDefaultRuntimeEvidenceContext(),
      label: "manual-sequence"
    });
    const materialized = materializeRuntimeStateSequenceArtifact({
      path: sequence.ref,
      artifact: sequence.artifact
    });
    const parsedArtifact = RuntimeStateSequenceArtifactSchema.parse(JSON.parse(materialized.content));

    expect(sequence.ref).toBe("runtime/state-sequences/pkg_sequence-r0-manual-sequence.runtime-state-sequence.json");
    expect(parsedArtifact.frameCount).toBe(2);
    expect(parsedArtifact.states.map((state) => state.frameIndex)).toEqual([0, 4, 5]);
    expect(sequence.finalState).toEqual(parsedArtifact.states.at(-1));
  });
});

const createGraph = (
  packageId: string,
  parameterId: ReturnType<typeof ParameterIdSchema.parse>,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>
): NormalizedRuntimeGraph => {
  const meshId = MeshIdSchema.parse("mesh_body");

  return {
    packageId,
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map(),
    drawables: new Map([
      [
        drawableId,
        {
          drawableId,
          meshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 16, height: 16 },
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: [],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};
