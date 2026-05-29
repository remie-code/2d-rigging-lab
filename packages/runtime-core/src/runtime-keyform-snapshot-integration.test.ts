import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createStableVertexHash } from "./drawable-geometry.js";
import { createInitialRuntimeState } from "./initial-state.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { compareRuntimeSnapshots } from "./snapshot-comparison.js";
import { defaultRuntimeEvaluationOptions } from "./runtime-options.js";
import { evaluateRuntimeFrame } from "./runtime-core.js";

describe("runtime keyform snapshot integration", () => {
  it("samples and applies mesh keyforms in runtime snapshots", () => {
    const fixture = createMeshKeyformFixture();
    const initialState = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.graph.packageId,
      packageRevision: fixture.graph.packageRevision,
      packageHash: "hash-runtime-keyforms",
      resetReasons: ["packageLoad"]
    });
    const options = {
      ...defaultRuntimeEvaluationOptions(),
      snapshotDetail: "full" as const,
      includeTrace: true
    };

    const before = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [fixture.parameterId]: -1
        }
      },
      initialState,
      options,
      { source: { surface: "preview" } }
    ).snapshot;
    const after = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 2,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [fixture.parameterId]: 1
        }
      },
      initialState,
      options,
      { source: { surface: "preview" } }
    ).snapshot;

    expect(after.keyformSamples).toEqual([
      {
        keyformSetId: fixture.keyformSetId,
        evaluator: "linear-1d-v1",
        sampledCoordinates: {
          [fixture.parameterId]: 1
        },
        target: "mesh:mesh_body.vertices",
        targetMetadata: {
          targetId: fixture.meshId,
          targetKind: "mesh",
          targetProperty: "vertices"
        },
        compositionMode: "replace",
        compositionOrder: 0,
        statePatch: fixture.deformedVertices,
        samplingStatus: "exact"
      }
    ]);
    expect(after.drawables[0]).toMatchObject({
      bounds: { x: -1, y: 1, width: 4, height: 4 },
      vertexCount: 3,
      vertexHash: createStableVertexHash(fixture.deformedVertices),
      vertices: fixture.deformedVertices
    });
    expect(after.diagnostics).toEqual([]);
    expect(after.trace?.phases).toContain("keyform_sampling");

    const comparison = compareRuntimeSnapshots(before, after);
    expect(comparison.equivalent).toBe(false);
    expect(comparison.diff.drawableChanges).toEqual([
      {
        drawableId: fixture.drawableId,
        boundsChanged: true,
        vertexHashBefore: createStableVertexHash(fixture.baseVertices),
        vertexHashAfter: createStableVertexHash(fixture.deformedVertices)
      }
    ]);
  });

  it("preserves keyform-less snapshot behavior", () => {
    const packageId = PackageIdSchema.parse("pkg_keyformless_runtime");
    const drawableId = DrawableIdSchema.parse("draw_keyformless");
    const meshId = MeshIdSchema.parse("mesh_keyformless");
    const graph = createGraph({
      packageId,
      drawables: new Map([
        [
          drawableId,
          {
            drawableId,
            meshId,
            visible: true,
            opacity: 1,
            baseDrawOrder: 7,
            bounds: { x: 0, y: 0, width: 10, height: 10 },
            vertexCount: 4
          }
        ]
      ])
    });
    const state = createInitialRuntimeState(graph, {
      packageId,
      packageRevision: 0,
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0
      },
      state,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "preview" } }
    );

    expect(result.snapshot.keyformSamples).toEqual([]);
    expect(result.snapshot.drawList).toEqual([drawableId]);
    expect(result.snapshot.drawables[0]).toMatchObject({
      drawableId,
      meshId,
      evaluatedDrawOrder: 7,
      vertexHash: "hash_draw_keyformless_4"
    });
  });

  it("accumulates keyform application diagnostics in snapshots", () => {
    const fixture = createMeshKeyformFixture({
      targetProperty: "texture"
    });
    const state = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.graph.packageId,
      packageRevision: fixture.graph.packageRevision,
      packageHash: "hash-runtime-keyforms",
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [fixture.parameterId]: 1
        }
      },
      state,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "validator" }, policy: { strictness: "strict" } }
    );

    expect(result.snapshot.keyformSamples).toHaveLength(1);
    expect(result.snapshot.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "keyformTarget.unsupportedTargetProperty"
    ]);
  });

  it("accumulates keyform sampling diagnostics in snapshots", () => {
    const fixture = createMeshKeyformFixture({
      includeDrawableTarget: false
    });
    const state = createInitialRuntimeState(fixture.graph, {
      packageId: fixture.graph.packageId,
      packageRevision: fixture.graph.packageRevision,
      packageHash: "hash-runtime-keyforms",
      resetReasons: ["packageLoad"]
    });

    const result = evaluateRuntimeFrame(
      fixture.graph,
      {
        schemaVersion: "runtime-evaluation-input-v1",
        frameIndex: 1,
        deltaTimeMs: 0,
        authoredParameterValues: {
          [fixture.parameterId]: 1
        }
      },
      state,
      defaultRuntimeEvaluationOptions(),
      { source: { surface: "validator" }, policy: { strictness: "strict" } }
    );

    expect(result.snapshot.keyformSamples).toEqual([]);
    expect(result.snapshot.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(["keyform.targetMissing"]);
  });
});

const createMeshKeyformFixture = (
  options: {
    readonly includeDrawableTarget?: boolean;
    readonly targetProperty?: string;
  } = {}
) => {
  const packageId = PackageIdSchema.parse("pkg_runtime_keyforms");
  const parameterId = ParameterIdSchema.parse("param_face_yaw");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const keyformSetId = KeyformSetIdSchema.parse("keyset_body_vertices");
  const baseVertices = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 2 }
  ];
  const deformedVertices = [
    { x: -1, y: 1 },
    { x: 3, y: 1 },
    { x: -1, y: 5 }
  ];
  const includeDrawableTarget = options.includeDrawableTarget ?? true;
  const graph = createGraph({
    packageId,
    packageHash: "hash-runtime-keyforms",
    parameters: new Map([
      [
        parameterId,
        {
          id: parameterId,
          displayName: "Face Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0
        }
      ]
    ]),
    drawables: includeDrawableTarget
      ? new Map([
          [
            drawableId,
            {
              drawableId,
              meshId,
              visible: true,
              opacity: 1,
              baseDrawOrder: 0,
              bounds: { x: 0, y: 0, width: 2, height: 2 },
              vertexCount: baseVertices.length,
              vertices: baseVertices
            }
          ]
        ])
      : new Map(),
    keyformBindings: [
      {
        evaluator: "linear-1d-v1",
        keyformSetId,
        targetId: meshId,
        targetKind: "mesh",
        targetProperty: options.targetProperty ?? "vertices",
        parameterId,
        keys: [
          { value: -1, statePatch: baseVertices },
          { value: 1, statePatch: deformedVertices }
        ],
        compositionMode: "replace",
        compositionOrder: 0
      }
    ]
  });

  return {
    graph,
    parameterId,
    drawableId,
    meshId,
    keyformSetId,
    baseVertices,
    deformedVertices
  };
};

const createGraph = (
  overrides: Pick<NormalizedRuntimeGraph, "packageId"> & Partial<NormalizedRuntimeGraph>
): NormalizedRuntimeGraph => ({
  packageId: overrides.packageId,
  packageRevision: overrides.packageRevision ?? 0,
  ...(overrides.packageHash === undefined ? {} : { packageHash: overrides.packageHash }),
  coordinateSystem: "canvas-y-down-v1",
  parameters: overrides.parameters ?? new Map(),
  dynamicsGroups: overrides.dynamicsGroups ?? new Map(),
  drawables: overrides.drawables ?? new Map(),
  rigControls: overrides.rigControls ?? new Map(),
  keyformBindings: overrides.keyformBindings ?? [],
  masks: overrides.masks ?? [],
  drawOrder: overrides.drawOrder ?? [],
  disabledFutureLayers: overrides.disabledFutureLayers ?? []
});
