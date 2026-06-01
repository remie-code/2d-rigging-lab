import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("runtime rig control keyform evidence", () => {
  it("records deterministic rotation2d angle keyform output across samples, transforms, drawable evidence, and diff", () => {
    const graph = createRotation2dKeyformGraph();
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
    expect(first.snapshot.keyformSamples).toEqual([
      expect.objectContaining({
        keyformSetId: "keyset_parent_angle",
        target: "rigControl:rig_parent.angleDegrees",
        targetMetadata: {
          targetId: "rig_parent",
          targetKind: "rigControl",
          targetProperty: "angleDegrees"
        },
        sampledCoordinates: { param_rig_angle: 1 },
        statePatch: 90,
        samplingStatus: "exact"
      })
    ]);

    const baselineParent = expectRigControl(first.baselineSnapshot.rigControls, "rig_parent");
    const candidateParent = expectRigControl(first.snapshot.rigControls, "rig_parent");
    const candidateChild = expectRigControl(first.snapshot.rigControls, "rig_child");
    expect(baselineParent.localTransform?.angleDegrees).toBe(0);
    expect(candidateParent.localTransform?.angleDegrees).toBe(90);
    expect(candidateParent.worldTransform?.angleDegrees).toBe(90);
    expect(candidateParent.affectedDrawableIds).toEqual(["draw_child"]);
    expect(candidateChild.worldTransform?.angleDegrees).toBe(90);
    expect(candidateChild.affectedDrawableIds).toEqual(["draw_child"]);

    const drawable = expectDrawable(first.snapshot.drawables, "draw_child");
    expect(drawable.bounds).toEqual({ x: -2, y: 10, width: 2, height: 2 });
    expect(drawable.vertices).toEqual([
      { x: 0, y: 10 },
      { x: 0, y: 12 },
      { x: -2, y: 12 },
      { x: -2, y: 10 }
    ]);
    expect(first.runtimeDiff.parameterChanges).toEqual(
      expect.arrayContaining([
        {
          path: "/rigControls/rig_parent/localTransform/angleDegrees",
          before: 0,
          after: 90
        },
        {
          path: "/rigControls/rig_parent/worldTransform/angleDegrees",
          before: 0,
          after: 90
        },
        {
          path: "/rigControls/rig_child/worldTransform/angleDegrees",
          before: 0,
          after: 90
        }
      ])
    );
    expect(first.runtimeDiff.drawableChanges).toEqual([
      expect.objectContaining({
        drawableId: "draw_child",
        boundsChanged: true
      })
    ]);
    expect(first.evidence.runtimeDiffEquivalent).toBe(false);
  });

  it("emits deterministic diagnostics for invalid and unsupported rotation2d keyform patches", () => {
    const graph = createRotation2dKeyformGraph([
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_bad_angle_shape"),
        targetId: "rig_parent",
        targetKind: "rigControl",
        targetProperty: "angleDegrees",
        parameterId: ParameterIdSchema.parse("param_rig_angle"),
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          { value: 0, statePatch: 0 },
          { value: 1, statePatch: { x: 1, y: 2 } }
        ]
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_bad_angle_mode"),
        targetId: "rig_parent",
        targetKind: "rigControl",
        targetProperty: "angleDegrees",
        parameterId: ParameterIdSchema.parse("param_rig_angle"),
        compositionMode: "multiplyOpacity",
        compositionOrder: 1,
        keys: [
          { value: 0, statePatch: 0 },
          { value: 1, statePatch: 45 }
        ]
      },
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_bad_rig_property"),
        targetId: "rig_parent",
        targetKind: "rigControl",
        targetProperty: "skewDegrees",
        parameterId: ParameterIdSchema.parse("param_rig_angle"),
        compositionMode: "replace",
        compositionOrder: 2,
        keys: [
          { value: 0, statePatch: 0 },
          { value: 1, statePatch: 5 }
        ]
      }
    ]);
    const request = {
      baselineParameterOverrides: { param_rig_angle: 0 },
      parameterOverrides: { param_rig_angle: 1 },
      targetIds: ["rig_parent", "draw_child"],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full" as const
      }
    };

    const first = evaluateViewerRuntimeSnapshot(graph, request);
    const second = evaluateViewerRuntimeSnapshot(graph, request);

    expect(first.snapshot.diagnostics).toEqual(second.snapshot.diagnostics);
    expect(first.runtimeDiff.diagnosticDelta).toEqual(second.runtimeDiff.diagnosticDelta);
    expect(first.snapshot.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "rigControl.invalidPatchShape",
      "rigControl.unsupportedCompositionMode",
      "rigControl.unsupportedTargetProperty"
    ]);
    expect(first.snapshot.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "rigControl.invalidPatchShape",
        severity: "error",
        phase: "rigControl_evaluation",
        target: { kind: "rigControl", id: "rig_parent" },
        evidence: expect.arrayContaining([
          "keyformSetId=keyset_bad_angle_shape",
          "targetProperty=angleDegrees",
          "expected=finiteNumber"
        ])
      }),
      expect.objectContaining({
        checkId: "rigControl.unsupportedCompositionMode",
        severity: "error",
        phase: "rigControl_evaluation",
        target: { kind: "rigControl", id: "rig_parent" },
        evidence: expect.arrayContaining([
          "keyformSetId=keyset_bad_angle_mode",
          "compositionMode=multiplyOpacity",
          "targetProperty=angleDegrees"
        ])
      }),
      expect.objectContaining({
        checkId: "rigControl.unsupportedTargetProperty",
        severity: "error",
        phase: "rigControl_evaluation",
        target: { kind: "rigControl", id: "rig_parent" },
        evidence: expect.arrayContaining([
          "keyformSetId=keyset_bad_rig_property",
          "targetProperty=skewDegrees"
        ])
      })
    ]);
    expect(expectRigControl(first.snapshot.rigControls, "rig_parent").localTransform?.angleDegrees).toBe(0);
    expect(expectDrawable(first.snapshot.drawables, "draw_child").bounds).toEqual({
      x: 10,
      y: 0,
      width: 2,
      height: 2
    });
  });

  it("keeps warpLattice2d keyform samples as unsupported no-op evidence without deforming drawables", () => {
    const graph = createWarpLatticeKeyformGraph();
    const request = {
      baselineParameterOverrides: { param_rig_angle: 0 },
      parameterOverrides: { param_rig_angle: 1 },
      targetIds: ["rig_warp_future", "draw_child"],
      options: {
        ...defaultRuntimeEvaluationOptions(),
        snapshotDetail: "full" as const
      }
    };

    const first = evaluateViewerRuntimeSnapshot(graph, request);
    const second = evaluateViewerRuntimeSnapshot(graph, request);

    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.runtimeDiff).toEqual(second.runtimeDiff);
    expect(first.snapshot.rigControls).toEqual([
      expect.objectContaining({
        rigControlId: "rig_warp_future",
        kind: "warpLattice2d",
        evaluationStatus: "unsupported",
        unsupportedReason: "warpLattice2dEvaluatorFutureScope",
        affectedDrawableIds: ["draw_child"]
      })
    ]);
    expect(first.snapshot.keyformSamples).toEqual([
      expect.objectContaining({
        keyformSetId: "keyset_warp_future",
        target: "rigControl:rig_warp_future.angleDegrees",
        targetMetadata: {
          targetId: "rig_warp_future",
          targetKind: "rigControl",
          targetProperty: "angleDegrees"
        },
        statePatch: 45
      })
    ]);
    expect(first.snapshot.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "rigControl.warpLatticeUnsupported",
        severity: "warning",
        phase: "rigControl_evaluation",
        target: { kind: "rigControl", id: "rig_warp_future" },
        evidence: ["keyformSetId=keyset_warp_future"]
      })
    ]);
    expect(expectDrawable(first.snapshot.drawables, "draw_child")).toMatchObject({
      bounds: { x: 10, y: 0, width: 2, height: 2 },
      vertices: [
        { x: 10, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 2 },
        { x: 10, y: 2 }
      ]
    });
    expect(first.runtimeDiff.drawableChanges).toEqual([]);
  });
});

const createRotation2dKeyformGraph = (
  keyformBindings: NormalizedRuntimeGraph["keyformBindings"] = [
    {
      evaluator: "linear-1d-v1",
      keyformSetId: KeyformSetIdSchema.parse("keyset_parent_angle"),
      targetId: "rig_parent",
      targetKind: "rigControl",
      targetProperty: "angleDegrees",
      parameterId: ParameterIdSchema.parse("param_rig_angle"),
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        { value: 0, statePatch: 0 },
        { value: 1, statePatch: 90 }
      ]
    }
  ]
): NormalizedRuntimeGraph => {
  const parameterId = ParameterIdSchema.parse("param_rig_angle");
  const parentRigId = RigControlIdSchema.parse("rig_parent");
  const childRigId = RigControlIdSchema.parse("rig_child");
  const drawableId = DrawableIdSchema.parse("draw_child");
  const meshId = MeshIdSchema.parse("mesh_child");

  return {
    packageId: "pkg_runtime_rig_control_keyform_test",
    packageRevision: 1,
    packageHash: "sha256:runtime-rig-control-keyform-test",
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
    keyformBindings,
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };
};

const createWarpLatticeKeyformGraph = (): NormalizedRuntimeGraph => {
  const graph = createRotation2dKeyformGraph();
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
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: KeyformSetIdSchema.parse("keyset_warp_future"),
        targetId: warpRigId,
        targetKind: "rigControl",
        targetProperty: "angleDegrees",
        parameterId: ParameterIdSchema.parse("param_rig_angle"),
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          { value: 0, statePatch: 0 },
          { value: 1, statePatch: 45 }
        ]
      }
    ]
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

const expectDrawable = (
  drawables: readonly ReturnType<typeof evaluateViewerRuntimeSnapshot>["snapshot"]["drawables"][number][],
  drawableId: string
) => {
  const drawable = drawables.find((candidate) => candidate.drawableId === drawableId);
  expect(drawable).toBeDefined();
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId}`);
  }

  return drawable;
};
