import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("viewer runtime evaluation", () => {
  it("returns the same viewer snapshot for the same package and parameter override", () => {
    const fixture = createViewerEvaluationFixture();
    const request = {
      parameterOverrides: {
        [fixture.faceYawParameterId]: 0.75
      },
      targetIds: [fixture.drawableId]
    };

    const first = evaluateViewerRuntimeSnapshot(fixture.graph, request);
    const second = evaluateViewerRuntimeSnapshot(fixture.graph, request);

    expect(first.snapshot).toEqual(second.snapshot);
    expect(first.nextState).toEqual(second.nextState);
    expect(first.runtimeDiff).toEqual(second.runtimeDiff);
    expect(first.snapshot.context.source.surface).toBe("viewer");
    expect(first.evidence).toMatchObject({
      schemaVersion: "viewer-runtime-evaluation-evidence-v1",
      surface: "viewer",
      runtimeEvaluationContext: {
        source: {
          surface: "viewer"
        }
      }
    });
  });

  it("changes viewer snapshot and runtime diff deterministically for a parameter override", () => {
    const fixture = createViewerEvaluationFixture();

    const defaultResult = evaluateViewerRuntimeSnapshot(fixture.graph);
    const overrideResult = evaluateViewerRuntimeSnapshot(fixture.graph, {
      parameterOverrides: {
        [fixture.faceYawParameterId]: 1
      },
      targetIds: [fixture.drawableId]
    });
    const repeatOverrideResult = evaluateViewerRuntimeSnapshot(fixture.graph, {
      parameterOverrides: {
        [fixture.faceYawParameterId]: 1
      },
      targetIds: [fixture.drawableId]
    });

    expect(overrideResult.snapshot.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: fixture.faceYawParameterId,
        authoredValue: 1,
        effectiveValue: 1,
        source: "viewerOverride"
      })
    );
    expect(overrideResult.snapshot.drawables[0]?.vertexHash).not.toBe(
      defaultResult.snapshot.drawables[0]?.vertexHash
    );
    expect(overrideResult.runtimeDiff).toEqual(repeatOverrideResult.runtimeDiff);
    expect(overrideResult.runtimeDiff.parameterChanges).toEqual([
      {
        path: `/parameters/${fixture.faceYawParameterId}/effectiveValue`,
        before: 0,
        after: 1
      }
    ]);
    expect(overrideResult.runtimeDiff.drawableChanges).toEqual([
      expect.objectContaining({
        drawableId: fixture.drawableId
      })
    ]);
    expect(overrideResult.evidence.parameterOverrides).toEqual([
      {
        parameterId: fixture.faceYawParameterId,
        value: 1
      }
    ]);
    expect(overrideResult.evidence.runtimeDiffEquivalent).toBe(false);
  });

  it("evaluates additive dynamics output in viewer context as project-defined dynamics", () => {
    const fixture = createViewerEvaluationFixture({ includeDynamics: true });

    const result = evaluateViewerRuntimeSnapshot(fixture.graph, {
      parameterOverrides: {
        [fixture.faceYawParameterId]: 1
      },
      targetIds: [fixture.drawableId, fixture.hairSwayParameterId]
    });

    expect(result.snapshot.context.source.surface).toBe("viewer");
    expect(result.snapshot.dynamics).toEqual([
      expect.objectContaining({
        dynamicsGroupId: fixture.dynamicsGroupId,
        inputValues: {
          [fixture.faceYawParameterId]: 1
        },
        outputParameterId: fixture.hairSwayParameterId,
        outputOffset: 1,
        effectiveOutputValue: 1,
        stateSummary: expect.objectContaining({
          angle: 1,
          angularVelocity: 0
        })
      })
    ]);
    expect(result.snapshot.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: fixture.hairSwayParameterId,
        valueSource: "computedDynamics",
        baseValue: 0,
        dynamicsOffset: 1,
        effectiveValue: 1,
        source: "dynamicsAdditive"
      })
    );
    expect(result.runtimeDiff.dynamicsChanges).toEqual([
      expect.objectContaining({
        dynamicsGroupId: fixture.dynamicsGroupId,
        outputParameterId: fixture.hairSwayParameterId,
        outputChanged: true
      })
    ]);
    expect(result.snapshot.disabledFutureLayers).toEqual([]);
    expect(result.snapshot.diagnostics).toEqual([]);
  });

  it("exposes semantic mask relations and drawable opacity as viewer evidence basis", () => {
    const fixture = createViewerCompositionEvidenceFixture();

    const result = evaluateViewerRuntimeSnapshot(fixture.graph, {
      parameterOverrides: {
        [fixture.opacityParameterId]: 1
      },
      targetIds: [fixture.targetDrawableId]
    });
    const targetDrawable = result.snapshot.drawables.find(
      (drawable) => drawable.drawableId === fixture.targetDrawableId
    );

    expect(result.snapshot.masks).toEqual([
      {
        maskRelationId: fixture.maskRelationId,
        sourceDrawableIds: [fixture.maskDrawableId],
        targetDrawableIds: [fixture.targetDrawableId],
        enabled: true,
        clippingIntent: "semanticClipping",
        resolved: true
      }
    ]);
    expect(targetDrawable).toMatchObject({
      drawableId: fixture.targetDrawableId,
      opacity: 0.25,
      visible: true
    });
    expect(result.runtimeDiff.drawableRuntimeStateChanges).toEqual([
      {
        drawableId: fixture.targetDrawableId,
        opacityBefore: 1,
        opacityAfter: 0.25,
        visibleBefore: true,
        visibleAfter: true,
        baseDrawOrderBefore: 1,
        baseDrawOrderAfter: 1,
        evaluatedDrawOrderBefore: 1,
        evaluatedDrawOrderAfter: 1
      }
    ]);
    expect(result.evidence.maskRelationEvidence).toEqual(result.snapshot.masks);
    expect(result.evidence.drawableOpacityEvidence).toContainEqual({
      drawableId: fixture.targetDrawableId,
      opacity: 0.25,
      visible: true
    });
    expect(result.evidence.drawableRuntimeStateChanges).toEqual(result.runtimeDiff.drawableRuntimeStateChanges);
  });
});

const createViewerEvaluationFixture = (
  options: { readonly includeDynamics?: boolean } = {}
) => {
  const packageId = PackageIdSchema.parse("pkg_viewer_eval");
  const faceYawParameterId = ParameterIdSchema.parse("param_face_yaw");
  const hairSwayParameterId = ParameterIdSchema.parse("param_hair_sway");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const keyformSetId = KeyformSetIdSchema.parse("keyset_viewer_vertices");
  const dynamicsGroupId = DynamicsGroupIdSchema.parse("dyn_hair_sway");
  const runtimeDriverParameterId = faceYawParameterId;
  const runtimeKeyformParameterId = options.includeDynamics ? hairSwayParameterId : faceYawParameterId;
  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 7,
    packageHash: "sha256:viewer-eval",
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        faceYawParameterId,
        {
          id: faceYawParameterId,
          displayName: "Face Yaw",
          semanticRole: "face",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ],
      ...(options.includeDynamics
        ? [
            [
              hairSwayParameterId,
              {
                id: hairSwayParameterId,
                displayName: "Hair Sway",
                semanticRole: "dynamics" as const,
                valueSource: "computedDynamics" as const,
                min: -1,
                max: 1,
                default: 0
              }
            ] as const
          ]
        : [])
    ]),
    dynamicsGroups: new Map(
      options.includeDynamics
        ? [
            [
              dynamicsGroupId,
              {
                dynamicsGroupId,
                displayName: "Hair Sway",
                enabled: true,
                inputs: [
                  {
                    parameterId: runtimeDriverParameterId,
                    kind: "angle",
                    influencePercent: 100,
                    invert: false,
                    normalization: {
                      min: -1,
                      center: 0,
                      max: 1
                    }
                  }
                ],
                pendulums: [
                  {
                    length: 1,
                    sway: 0.35,
                    reactionSpeed: 8,
                    convergenceSpeed: 4
                  }
                ],
                outputs: [
                  {
                    parameterId: hairSwayParameterId,
                    kind: "angle",
                    strength: 1,
                    invert: false,
                    limit: 1
                  }
                ]
              }
            ]
          ]
        : []
    ),
    drawables: new Map([
      [
        drawableId,
        {
          drawableId,
          meshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 12, height: 12 },
          vertices: [
            { x: 0, y: 0 },
            { x: 12, y: 0 },
            { x: 6, y: 12 }
          ],
          vertexCount: 3
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId,
        targetId: meshId,
        targetKind: "mesh",
        targetProperty: "vertices",
        parameterId: runtimeKeyformParameterId,
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          {
            value: 0,
            statePatch: [
              { x: 0, y: 0 },
              { x: 12, y: 0 },
              { x: 6, y: 12 }
            ]
          },
          {
            value: 1,
            statePatch: [
              { x: 2, y: 0 },
              { x: 14, y: 2 },
              { x: 8, y: 10 }
            ]
          }
        ]
      }
    ],
    masks: [],
    drawOrder: [{ drawableId, drawOrder: 0 }],
    disabledFutureLayers: []
  };

  return {
    graph,
    faceYawParameterId,
    hairSwayParameterId,
    drawableId,
    dynamicsGroupId
  };
};

const createViewerCompositionEvidenceFixture = () => {
  const packageId = PackageIdSchema.parse("pkg_viewer_composition");
  const opacityParameterId = ParameterIdSchema.parse("param_opacity");
  const maskDrawableId = DrawableIdSchema.parse("draw_mask");
  const targetDrawableId = DrawableIdSchema.parse("draw_target");
  const maskMeshId = MeshIdSchema.parse("mesh_mask");
  const targetMeshId = MeshIdSchema.parse("mesh_target");
  const maskRelationId = MaskRelationIdSchema.parse("maskrel_viewerClip");
  const opacityKeyformSetId = KeyformSetIdSchema.parse("keyset_viewerOpacity");
  const graph: NormalizedRuntimeGraph = {
    packageId,
    packageRevision: 3,
    packageHash: "sha256:viewer-composition",
    coordinateSystem: "canvas-y-down-v1",
    parameters: new Map([
      [
        opacityParameterId,
        {
          id: opacityParameterId,
          displayName: "Opacity",
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
        maskDrawableId,
        {
          drawableId: maskDrawableId,
          meshId: maskMeshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: 0,
          bounds: { x: 0, y: 0, width: 8, height: 8 },
          vertexCount: 4
        }
      ],
      [
        targetDrawableId,
        {
          drawableId: targetDrawableId,
          meshId: targetMeshId,
          visible: true,
          opacity: 1,
          baseDrawOrder: 1,
          bounds: { x: 0, y: 0, width: 12, height: 12 },
          vertexCount: 4
        }
      ]
    ]),
    rigControls: new Map(),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId: opacityKeyformSetId,
        targetId: targetDrawableId,
        targetKind: "drawable",
        targetProperty: "opacity",
        parameterId: opacityParameterId,
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          { value: 0, statePatch: 1 },
          { value: 1, statePatch: 0.25 }
        ]
      }
    ],
    masks: [
      {
        maskRelationId,
        sourceDrawableIds: [maskDrawableId],
        targetDrawableIds: [targetDrawableId]
      }
    ],
    drawOrder: [
      { drawableId: maskDrawableId, drawOrder: 0 },
      { drawableId: targetDrawableId, drawOrder: 1 }
    ],
    disabledFutureLayers: []
  };

  return {
    graph,
    opacityParameterId,
    maskDrawableId,
    targetDrawableId,
    maskRelationId
  };
};
