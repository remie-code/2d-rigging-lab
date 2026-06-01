import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  RigControlIdSchema,
  RuntimeEvaluationContextSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { buildRuntimeEvidence } from "./runtime-evidence.js";
import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";
import { RuntimeEvaluationInputSchema } from "./runtime-input.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("runtime rig control hierarchy evidence", () => {
  it("evaluates rotation2d hierarchy parent-before-child deterministically", () => {
    const graph = createRotationRigControlGraph();
    const request = {
      baselineParameterOverrides: { param_rig_angle: 0 },
      parameterOverrides: { param_rig_angle: 1 },
      targetIds: ["rig_parent", "rig_child", "draw_child"],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full" as const,
        includeTrace: true
      }
    };

    const first = evaluateViewerRuntimeSnapshot(graph, request);
    const second = evaluateViewerRuntimeSnapshot(graph, request);

    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.runtimeDiff).toEqual(second.runtimeDiff);
    expect(first.snapshot.trace?.phases).toContain("rigControl_evaluation");
    expect(first.snapshot.rigControls.map((rigControl) => rigControl.rigControlId)).toEqual([
      "rig_parent",
      "rig_child"
    ]);
    expect(first.snapshot.rigControls.map((rigControl) => rigControl.hierarchyIndex)).toEqual([0, 1]);

    const parent = expectRigControl(first.snapshot.rigControls, "rig_parent");
    expect(parent).toMatchObject({
      kind: "rotation2d",
      evaluationStatus: "evaluated",
      childRigControlIds: ["rig_child"],
      affectedDrawableIds: ["draw_child"],
      affectedRigControlIds: ["rig_child"]
    });
    expect(parent.localTransform?.angleDegrees).toBe(90);
    expect(parent.worldTransform?.matrix).toEqual({
      a: 0,
      b: 1,
      c: -1,
      d: 0,
      e: 0,
      f: 0
    });

    const child = expectRigControl(first.snapshot.rigControls, "rig_child");
    expect(child.parentId).toBe("rig_parent");
    expect(child.affectedDrawableIds).toEqual(["draw_child"]);
    expect(child.worldTransform?.matrix).toEqual(parent.worldTransform?.matrix);

    const drawable = first.snapshot.drawables.find((candidate) => candidate.drawableId === "draw_child");
    expect(drawable?.bounds).toEqual({ x: -2, y: 10, width: 2, height: 2 });
    expect(drawable?.vertices).toEqual([
      { x: 0, y: 10 },
      { x: 0, y: 12 },
      { x: -2, y: 12 },
      { x: -2, y: 10 }
    ]);
  });

  it("exposes rig control transform changes and affected drawable targets through runtime diff/evidence", () => {
    const graph = createRotationRigControlGraph();
    const baseline = evaluateSingleFrame(graph, 0, 0);
    const candidate = evaluateSingleFrame(graph, 1, 1);
    const comparison = compareRuntimeSnapshots(baseline.snapshot, candidate.snapshot);

    expect(comparison.equivalent).toBe(false);
    expect(comparison.diff.drawableChanges).toEqual([
      {
        drawableId: "draw_child",
        boundsChanged: true,
        vertexHashBefore: baseline.snapshot.drawables[0]?.vertexHash,
        vertexHashAfter: candidate.snapshot.drawables[0]?.vertexHash
      }
    ]);
    expect(comparison.diff.parameterChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/rigControls/rig_parent/localTransform/angleDegrees",
          before: 0,
          after: 90
        }),
        expect.objectContaining({
          path: "/rigControls/rig_child/worldTransform/matrix"
        })
      ])
    );

    const evidence = buildRuntimeEvidence({
      baselineGraph: graph,
      candidateGraph: graph,
      baseline: {
        frame: {
          frameIndex: 0,
          authoredParameterValues: { param_rig_angle: 0 },
          targetIds: ["rig_parent", "draw_child"]
        }
      },
      candidate: {
        frame: {
          frameIndex: 1,
          authoredParameterValues: { param_rig_angle: 1 },
          targetIds: ["rig_parent", "draw_child"]
        }
      },
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "targeted"
      },
      artifactLabel: "rig-control-hierarchy"
    });

    expect(evidence.runtimeDiff).toEqual(comparison.diff);
    expect(evidence.candidateSnapshot.rigControls[0]).toMatchObject({
      rigControlId: "rig_parent",
      affectedDrawableIds: ["draw_child"]
    });
    expect(evidence.generatedRuntimeSnapshotIds).toEqual([
      "snap_runtime_rig_control_test_0",
      "snap_runtime_rig_control_test_1"
    ]);
  });

  it("blocks cycle hierarchy evidence without applying drawable transforms", () => {
    const result = evaluateSingleFrame(createCycleRigControlGraph(), 0, 0);

    expect(result.snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "rigControl.cycle",
          severity: "blocking"
        })
      ])
    );
    expect(expectRigControl(result.snapshot.rigControls, "rig_parent").evaluationStatus).toBe("blocked");
    expect(expectRigControl(result.snapshot.rigControls, "rig_child").evaluationStatus).toBe("blocked");
    expectDrawChildUntransformed(result.snapshot.drawables);
  });

  it("blocks missing parent hierarchy evidence without applying drawable transforms", () => {
    const result = evaluateSingleFrame(createMissingParentRigControlGraph(), 0, 0);

    expect(result.snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "rigControl.parentMissing",
          severity: "blocking"
        })
      ])
    );
    expect(expectRigControl(result.snapshot.rigControls, "rig_child").evaluationStatus).toBe("blocked");
    expectDrawChildUntransformed(result.snapshot.drawables);
  });

  it("blocks missing child rig-control references without applying drawable transforms", () => {
    const result = evaluateSingleFrame(createMissingChildRigControlReferenceGraph(), 0, 0);

    expect(result.snapshot.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "rigControl.childMissing",
          severity: "blocking"
        })
      ])
    );
    expect(expectRigControl(result.snapshot.rigControls, "rig_parent").evaluationStatus).toBe("blocked");
    expectDrawChildUntransformed(result.snapshot.drawables);
  });

  it("keeps warpLattice2d as unsupported no-op evidence without applying lattice deformation", () => {
    const graph = createWarpNoOpGraph();
    const result = evaluateSingleFrame(graph, 0, 0);

    expect(result.snapshot.rigControls).toEqual([
      expect.objectContaining({
        rigControlId: "rig_warp_future",
        kind: "warpLattice2d",
        evaluationStatus: "unsupported",
        unsupportedReason: "warpLattice2dEvaluatorFutureScope",
        affectedDrawableIds: ["draw_child"]
      })
    ]);
    expect(result.snapshot.drawables[0]?.bounds).toEqual({ x: 10, y: 0, width: 2, height: 2 });
    expect(result.snapshot.diagnostics.filter((diagnostic) => diagnostic.phase === "rigControl_evaluation")).toEqual([]);
  });
});

const evaluateSingleFrame = (
  graph: NormalizedRuntimeGraph,
  frameIndex: number,
  rigAngle: number
) => {
  const input = RuntimeEvaluationInputSchema.parse({
    schemaVersion: "runtime-evaluation-input-v1",
    frameIndex,
    deltaTimeMs: 0,
    resetReasons: frameIndex === 0 ? ["packageLoad"] : [],
    authoredParameterValues: { param_rig_angle: rigAngle },
    targetIds: ["rig_parent", "draw_child"]
  });
  const state = createInitialRuntimeState(graph, {
    packageId: graph.packageId,
    packageRevision: graph.packageRevision,
    frameIndex,
    authoredParameterValues: input.authoredParameterValues,
    resetReasons: ["packageLoad"]
  });

  return evaluateRuntimeFrame(
    graph,
    input,
    state,
    {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full"
    },
    RuntimeEvaluationContextSchema.parse({
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    })
  );
};

const createRotationRigControlGraph = (): NormalizedRuntimeGraph => {
  const parameterId = ParameterIdSchema.parse("param_rig_angle");
  const parentRigId = RigControlIdSchema.parse("rig_parent");
  const childRigId = RigControlIdSchema.parse("rig_child");
  const drawableId = DrawableIdSchema.parse("draw_child");
  const meshId = MeshIdSchema.parse("mesh_child");

  return {
    packageId: "pkg_runtime_rig_control_test",
    packageRevision: 1,
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Rig Angle",
          valueSource: "authoredInput",
          min: 0,
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
          bounds: { x: 10, y: 0, width: 2, height: 2 },
          vertices: [
            { x: 10, y: 0 },
            { x: 12, y: 0 },
            { x: 12, y: 2 },
            { x: 10, y: 2 }
          ],
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map([
      [
        parentRigId,
        {
          kind: "rotation2d",
          rigControlId: parentRigId,
          childDrawableIds: [],
          childRigControlIds: [childRigId],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ],
      [
        childRigId,
        {
          kind: "rotation2d",
          rigControlId: childRigId,
          parentId: parentRigId,
          childDrawableIds: [drawableId],
          childRigControlIds: [],
          pivot: { x: 10, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    ]),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_parent_rotation"),
        targetId: parentRigId,
        targetKind: "rigControl",
        targetProperty: "angleDegrees",
        parameterId,
        keys: [
          { value: 0, statePatch: 0 },
          { value: 1, statePatch: 90 }
        ],
        compositionMode: "replace",
        compositionOrder: 0
      }
    ],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};

const createCycleRigControlGraph = (): NormalizedRuntimeGraph => {
  const graph = createRotationRigControlGraph();
  const parentRigId = RigControlIdSchema.parse("rig_parent");
  const childRigId = RigControlIdSchema.parse("rig_child");
  const parentRigControl = graph.rigControls.get(parentRigId);
  const childRigControl = graph.rigControls.get(childRigId);

  if (parentRigControl?.kind !== "rotation2d" || childRigControl?.kind !== "rotation2d") {
    throw new Error("Expected rotation2d test rig controls");
  }

  return {
    ...graph,
    rigControls: new Map([
      [
        parentRigId,
        {
          ...parentRigControl,
          parentId: childRigId,
          restAngleDegrees: 90
        }
      ],
      [
        childRigId,
        {
          ...childRigControl,
          childRigControlIds: [parentRigId],
          restAngleDegrees: 45
        }
      ]
    ]),
    keyformBindings: []
  };
};

const createMissingParentRigControlGraph = (): NormalizedRuntimeGraph => {
  const graph = createRotationRigControlGraph();
  const childRigId = RigControlIdSchema.parse("rig_child");
  const missingParentRigId = RigControlIdSchema.parse("rig_missing_parent");
  const childRigControl = graph.rigControls.get(childRigId);

  if (childRigControl?.kind !== "rotation2d") {
    throw new Error("Expected rotation2d child rig control");
  }

  return {
    ...graph,
    rigControls: new Map([
      [
        childRigId,
        {
          ...childRigControl,
          parentId: missingParentRigId,
          restAngleDegrees: 90
        }
      ]
    ]),
    keyformBindings: []
  };
};

const createMissingChildRigControlReferenceGraph = (): NormalizedRuntimeGraph => {
  const graph = createRotationRigControlGraph();
  const parentRigId = RigControlIdSchema.parse("rig_parent");
  const drawableId = DrawableIdSchema.parse("draw_child");
  const missingChildRigId = RigControlIdSchema.parse("rig_missing_child");
  const parentRigControl = graph.rigControls.get(parentRigId);

  if (parentRigControl?.kind !== "rotation2d") {
    throw new Error("Expected rotation2d parent rig control");
  }

  return {
    ...graph,
    rigControls: new Map([
      [
        parentRigId,
        {
          ...parentRigControl,
          childDrawableIds: [drawableId],
          childRigControlIds: [missingChildRigId],
          restAngleDegrees: 90
        }
      ]
    ]),
    keyformBindings: []
  };
};

const createWarpNoOpGraph = (): NormalizedRuntimeGraph => {
  const graph = createRotationRigControlGraph();
  const drawableId = DrawableIdSchema.parse("draw_child");
  const warpRigId = RigControlIdSchema.parse("rig_warp_future");

  return {
    ...graph,
    rigControls: new Map([
      [
        warpRigId,
        {
          kind: "warpLattice2d",
          rigControlId: warpRigId,
          childDrawableIds: [drawableId],
          childRigControlIds: [],
          bindSpace: "rigControlLocalRest",
          domainBounds: { x: 8, y: -2, width: 8, height: 8 },
          latticeColumns: 2,
          latticeRows: 2,
          restControlPoints: [
            { x: 8, y: -2 },
            { x: 16, y: -2 },
            { x: 8, y: 6 },
            { x: 16, y: 6 }
          ],
          interpolationMethod: "bilinear-grid-v1",
          enabled: true
        }
      ]
    ]),
    keyformBindings: []
  };
};

const expectRigControl = (
  rigControls: readonly ReturnType<typeof evaluateViewerRuntimeSnapshot>["snapshot"]["rigControls"][number][],
  rigControlId: string
) => {
  const rigControl = rigControls.find((candidate) => candidate.rigControlId === rigControlId);
  expect(rigControl).toBeDefined();
  if (rigControl === undefined) {
    throw new Error(`Expected rig control ${rigControlId}`);
  }

  return rigControl;
};

const expectDrawChildUntransformed = (
  drawables: readonly {
    readonly drawableId: string;
    readonly bounds?: unknown;
    readonly vertices?: unknown;
  }[]
): void => {
  const drawable = drawables.find((candidate) => candidate.drawableId === "draw_child");
  expect(drawable?.bounds).toEqual({ x: 10, y: 0, width: 2, height: 2 });
  expect(drawable?.vertices).toEqual([
    { x: 10, y: 0 },
    { x: 12, y: 0 },
    { x: 12, y: 2 },
    { x: 10, y: 2 }
  ]);
};
