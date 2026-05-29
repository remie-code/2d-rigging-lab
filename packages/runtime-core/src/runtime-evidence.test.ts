import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  RuntimeDiffDtoSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateSequenceArtifactRefSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { buildRuntimeEvidence } from "./runtime-evidence.js";
import {
  createRuntimeStateArtifactRef,
  createRuntimeStateSequenceArtifactRef
} from "./runtime-state-artifacts.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";

describe("runtime evidence helpers", () => {
  it("builds baseline and candidate snapshots, final state, runtime diff, and evidence refs", () => {
    const packageId = PackageIdSchema.parse("pkg_evidence");
    const parameterId = ParameterIdSchema.parse("param_yaw");
    const drawableId = DrawableIdSchema.parse("draw_body");
    const graph = createGraph(packageId, parameterId, drawableId);

    const evidence = buildRuntimeEvidence({
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

    expect(evidence.baselineSnapshot.parameters[0]).toMatchObject({
      parameterId,
      effectiveValue: 0
    });
    expect(evidence.candidateSnapshot.parameters[0]).toMatchObject({
      parameterId,
      authoredValue: 1,
      effectiveValue: 1
    });
    expect(evidence.finalRuntimeState).toMatchObject({
      schemaVersion: "runtime-state-v1",
      packageId,
      frameIndex: 1
    });
    expect(RuntimeDiffDtoSchema.parse(evidence.runtimeDiff)).toMatchObject({
      schemaVersion: "runtime-diff-v1",
      parameterChanges: [
        {
          path: `/parameters/${parameterId}/effectiveValue`,
          before: 0,
          after: 1
        }
      ]
    });
    expect(evidence.runtimeComparison.equivalent).toBe(false);
    expect(evidence.generatedRuntimeSnapshotIds).toEqual(["snap_evidence_0", "snap_evidence_1"]);
    expect(evidence.generatedRuntimeStateRefs.map((ref) => RuntimeStateArtifactRefSchema.parse(ref))).toEqual([
      "runtime/states/pkg_evidence-r0-operation-dry-run-final-f1.runtime-state.json"
    ]);
    expect(
      evidence.generatedRuntimeStateSequenceRefs.map((ref) => RuntimeStateSequenceArtifactRefSchema.parse(ref))
    ).toEqual(["runtime/state-sequences/pkg_evidence-r0-operation-dry-run.runtime-state-sequence.json"]);
  });

  it("creates schema-valid runtime state and sequence refs without filesystem IO", () => {
    const packageId = PackageIdSchema.parse("pkg_refs");
    const parameterId = ParameterIdSchema.parse("param_yaw");
    const drawableId = DrawableIdSchema.parse("draw_body");
    const graph = createGraph(packageId, parameterId, drawableId);
    const evidence = buildRuntimeEvidence({
      baselineGraph: graph,
      candidateGraph: graph,
      artifactLabel: "refs"
    });

    expect(createRuntimeStateArtifactRef({ graph, state: evidence.finalRuntimeState, label: "manual" })).toBe(
      "runtime/states/pkg_refs-r0-manual-f1.runtime-state.json"
    );
    expect(createRuntimeStateSequenceArtifactRef({ graph, label: "manual" })).toBe(
      "runtime/state-sequences/pkg_refs-r0-manual.runtime-state-sequence.json"
    );
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
