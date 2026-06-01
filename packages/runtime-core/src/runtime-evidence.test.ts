import {
  DrawableIdSchema,
  MaskRelationIdSchema,
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

  it("builds evidence with deterministic semantic mask relation snapshots and diff paths", () => {
    const packageId = PackageIdSchema.parse("pkg_mask_evidence");
    const parameterId = ParameterIdSchema.parse("param_mask_unused");
    const maskFrontId = DrawableIdSchema.parse("draw_maskFront");
    const maskBackId = DrawableIdSchema.parse("draw_maskBack");
    const bodyId = DrawableIdSchema.parse("draw_body");
    const shadowId = DrawableIdSchema.parse("draw_shadow");
    const disabledAuthoringRelationId = MaskRelationIdSchema.parse("maskrel_disabledClip");
    const baselineGraph = createMaskGraph(packageId, parameterId, []);
    const candidateGraph = createMaskGraph(packageId, parameterId, [
      {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_zClip"),
        sourceDrawableIds: [maskFrontId],
        targetDrawableIds: [bodyId]
      },
      {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_aClip"),
        sourceDrawableIds: [maskBackId],
        targetDrawableIds: [shadowId, bodyId]
      }
    ]);

    const evidence = buildRuntimeEvidence({
      baselineGraph,
      candidateGraph,
      artifactLabel: "composition"
    });

    expect(evidence.candidateSnapshot.masks).toEqual([
      {
        maskRelationId: "maskrel_aClip",
        sourceDrawableIds: [maskBackId],
        targetDrawableIds: [shadowId, bodyId],
        enabled: true,
        clippingIntent: "semanticClipping",
        resolved: true
      },
      {
        maskRelationId: "maskrel_zClip",
        sourceDrawableIds: [maskFrontId],
        targetDrawableIds: [bodyId],
        enabled: true,
        clippingIntent: "semanticClipping",
        resolved: true
      }
    ]);
    expect(evidence.candidateSnapshot.masks.map((mask) => mask.maskRelationId)).not.toContain(
      disabledAuthoringRelationId
    );
    expect(evidence.runtimeDiff.parameterChanges).toEqual([
      {
        path: "/masks/maskrel_aClip",
        before: null,
        after: {
          maskRelationId: "maskrel_aClip",
          sourceDrawableIds: [maskBackId],
          targetDrawableIds: [shadowId, bodyId],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: true
        }
      },
      {
        path: "/masks/maskrel_zClip",
        before: null,
        after: {
          maskRelationId: "maskrel_zClip",
          sourceDrawableIds: [maskFrontId],
          targetDrawableIds: [bodyId],
          enabled: true,
          clippingIntent: "semanticClipping",
          resolved: true
        }
      }
    ]);
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

const createMaskGraph = (
  packageId: string,
  parameterId: ReturnType<typeof ParameterIdSchema.parse>,
  masks: NormalizedRuntimeGraph["masks"]
): NormalizedRuntimeGraph => {
  const drawableSpecs = [
    {
      drawableId: DrawableIdSchema.parse("draw_maskFront"),
      meshId: MeshIdSchema.parse("mesh_maskFront"),
      drawOrder: 0
    },
    {
      drawableId: DrawableIdSchema.parse("draw_maskBack"),
      meshId: MeshIdSchema.parse("mesh_maskBack"),
      drawOrder: 1
    },
    {
      drawableId: DrawableIdSchema.parse("draw_body"),
      meshId: MeshIdSchema.parse("mesh_body"),
      drawOrder: 2
    },
    {
      drawableId: DrawableIdSchema.parse("draw_shadow"),
      meshId: MeshIdSchema.parse("mesh_shadow"),
      drawOrder: 3
    }
  ];

  return {
    packageId,
    packageRevision: 0,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Unused",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    dynamicsGroups: new Map(),
    drawables: new Map(
      drawableSpecs.map((drawable) => [
        drawable.drawableId,
        {
          drawableId: drawable.drawableId,
          meshId: drawable.meshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: drawable.drawOrder,
          bounds: { x: 0, y: 0, width: 16, height: 16 },
          vertexCount: 4
        }
      ])
    ),
    rigControls: new Map(),
    keyformBindings: [],
    masks,
    drawOrder: drawableSpecs.map((drawable) => ({
      drawableId: drawable.drawableId,
      drawOrder: drawable.drawOrder
    })),
    disabledFutureLayers: []
  };
};
