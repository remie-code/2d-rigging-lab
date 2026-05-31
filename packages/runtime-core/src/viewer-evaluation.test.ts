import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
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

  it("evaluates Wave23-style dynamics output in viewer context as project-defined dynamics", () => {
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
        driverValues: {
          [fixture.faceYawParameterId]: 1
        },
        outputParameterId: fixture.hairSwayParameterId,
        outputValue: 1,
        stateSummary: {
          position: 1,
          velocity: 0
        }
      })
    ]);
    expect(result.snapshot.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: fixture.hairSwayParameterId,
        valueSource: "computedDynamics",
        computedValue: 1,
        effectiveValue: 1,
        source: "dynamicsComputed"
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
                solverKind: "scalarDampedFollowV1",
                drivers: [
                  {
                    driverId: "driver_face_yaw",
                    sourceParameterId: runtimeDriverParameterId,
                    inputScale: 1,
                    inputOffset: 0,
                    invert: false
                  }
                ],
                output: {
                  outputId: "output_hair_sway",
                  targetParameterId: hairSwayParameterId,
                  outputScale: 1,
                  outputOffset: 0,
                  min: -1,
                  max: 1,
                  clampPolicy: "clamp-to-output-range"
                },
                settings: {
                  stiffness: 4,
                  damping: 1
                },
                resetPolicy: "reset-on-load"
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
