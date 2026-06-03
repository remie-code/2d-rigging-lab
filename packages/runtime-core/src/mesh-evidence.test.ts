import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  TriangleIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createStableVertexHash } from "./drawable-geometry.js";
import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";
import { buildRuntimeEvidence } from "./runtime-evidence.js";
import { evaluateViewerRuntimeSnapshot } from "./viewer-evaluation.js";

describe("runtime mesh edit evidence", () => {
  it("projects deterministic mesh vertices, topology, bounds, hash, and moved vertex refs", () => {
    const fixture = createMeshEditFixture();

    const evidence = buildRuntimeEvidence({
      baselineGraph: fixture.baselineGraph,
      candidateGraph: fixture.candidateGraph,
      options: {
        schemaVersion: "runtime-evaluation-options-v1",
        snapshotDetail: "full"
      },
      artifactLabel: "wave29-mesh-edit"
    });
    const candidateDrawable = evidence.candidateSnapshot.drawables[0];

    expect(candidateDrawable?.mesh).toMatchObject({
      drawableId: fixture.drawableId,
      meshId: fixture.meshId,
      bounds: { x: 0, y: -2, width: 14, height: 12 },
      vertexHash: createStableVertexHash(fixture.candidateVertices),
      topology: {
        vertexCount: 3,
        stableVertexIdCount: 3,
        uvCount: 3,
        triangleCount: 1,
        triangleIndexCount: 3,
        stableTriangleIdCount: 1,
        topologyRevision: 7,
        hasStableVertexIds: true,
        hasStableTriangleIds: true,
        hasUvProjection: true,
        hasTriangles: true
      },
      vertices: [
        {
          vertexIndex: 0,
          vertexStableId: "vtx_body_0",
          vertexRef: `${fixture.meshId}.vtx_body_0`,
          position: { x: 0, y: 0 }
        },
        {
          vertexIndex: 1,
          vertexStableId: "vtx_body_1",
          vertexRef: `${fixture.meshId}.vtx_body_1`,
          position: { x: 14, y: -2 }
        },
        {
          vertexIndex: 2,
          vertexStableId: "vtx_body_2",
          vertexRef: `${fixture.meshId}.vtx_body_2`,
          position: { x: 0, y: 10 }
        }
      ]
    });
    expect(candidateDrawable?.mesh?.uvs).toEqual([
      {
        vertexIndex: 0,
        vertexStableId: "vtx_body_0",
        vertexRef: `${fixture.meshId}.vtx_body_0`,
        uv: { x: 0, y: 0 }
      },
      {
        vertexIndex: 1,
        vertexStableId: "vtx_body_1",
        vertexRef: `${fixture.meshId}.vtx_body_1`,
        uv: { x: 1, y: 0 }
      },
      {
        vertexIndex: 2,
        vertexStableId: "vtx_body_2",
        vertexRef: `${fixture.meshId}.vtx_body_2`,
        uv: { x: 0, y: 1 }
      }
    ]);
    expect(candidateDrawable?.mesh?.triangles).toEqual([
      {
        triangleIndex: 0,
        triangleStableId: "tri_body_0",
        triangleRef: `${fixture.meshId}.tri_body_0`,
        vertexIndices: [0, 1, 2],
        vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
        vertexRefs: [
          `${fixture.meshId}.vtx_body_0`,
          `${fixture.meshId}.vtx_body_1`,
          `${fixture.meshId}.vtx_body_2`
        ]
      }
    ]);
    expect(evidence.meshEditEvidence.drawables).toEqual([
      {
        drawableId: fixture.drawableId,
        meshId: fixture.meshId,
        boundsBefore: { x: 0, y: 0, width: 10, height: 10 },
        boundsAfter: { x: 0, y: -2, width: 14, height: 12 },
        vertexHashBefore: createStableVertexHash(fixture.baseVertices),
        vertexHashAfter: createStableVertexHash(fixture.candidateVertices),
        boundsChanged: true,
        vertexHashChanged: true,
        topology: candidateDrawable?.mesh?.topology,
        vertices: candidateDrawable?.mesh?.vertices,
        uvs: candidateDrawable?.mesh?.uvs,
        triangles: candidateDrawable?.mesh?.triangles,
        movedVertexRefs: [
          {
            drawableId: fixture.drawableId,
            meshId: fixture.meshId,
            vertexIndex: 1,
            vertexStableId: "vtx_body_1",
            vertexRef: `${fixture.meshId}.vtx_body_1`,
            before: { x: 10, y: 0 },
            after: { x: 14, y: -2 },
            delta: { x: 4, y: -2 }
          }
        ]
      }
    ]);
  });

  it("exposes viewer-facing mesh moved vertex evidence from full-detail snapshots", () => {
    const fixture = createMeshEditFixture({ includeKeyform: true });

    const result = evaluateViewerRuntimeSnapshot(fixture.baselineGraph, {
      parameterOverrides: {
        [fixture.parameterId]: 1
      },
      targetIds: [fixture.drawableId, fixture.meshId],
      options: {
        schemaVersion: "runtime-evaluation-options-v1",
        snapshotDetail: "full"
      }
    });

    expect(result.evidence.meshEditEvidence?.drawables[0]).toMatchObject({
      drawableId: fixture.drawableId,
      meshId: fixture.meshId,
      boundsChanged: true,
      vertexHashChanged: true,
      topology: {
        vertexCount: 3,
        stableVertexIdCount: 3,
        triangleCount: 1,
        stableTriangleIdCount: 1,
        topologyRevision: 7
      },
      uvs: [
        {
          vertexIndex: 0,
          vertexStableId: "vtx_body_0",
          vertexRef: `${fixture.meshId}.vtx_body_0`,
          uv: { x: 0, y: 0 }
        },
        {
          vertexIndex: 1,
          vertexStableId: "vtx_body_1",
          vertexRef: `${fixture.meshId}.vtx_body_1`,
          uv: { x: 1, y: 0 }
        },
        {
          vertexIndex: 2,
          vertexStableId: "vtx_body_2",
          vertexRef: `${fixture.meshId}.vtx_body_2`,
          uv: { x: 0, y: 1 }
        }
      ],
      triangles: [
        {
          triangleIndex: 0,
          triangleStableId: "tri_body_0",
          triangleRef: `${fixture.meshId}.tri_body_0`
        }
      ],
      movedVertexRefs: [
        {
          vertexIndex: 1,
          vertexStableId: "vtx_body_1",
          vertexRef: `${fixture.meshId}.vtx_body_1`,
          before: { x: 10, y: 0 },
          after: { x: 14, y: -2 },
          delta: { x: 4, y: -2 }
        }
      ]
    });
  });
});

const createMeshEditFixture = (
  options: { readonly includeKeyform?: boolean } = {}
) => {
  const packageId = PackageIdSchema.parse("pkg_wave29_mesh_evidence");
  const parameterId = ParameterIdSchema.parse("param_mesh_preview");
  const drawableId = DrawableIdSchema.parse("draw_body");
  const meshId = MeshIdSchema.parse("mesh_body");
  const keyformSetId = KeyformSetIdSchema.parse("keyset_body_mesh_edit");
  const baseVertices = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 10 }
  ];
  const candidateVertices = [
    { x: 0, y: 0 },
    { x: 14, y: -2 },
    { x: 0, y: 10 }
  ];
  const baselineGraph = createGraph({
    packageId,
    parameterId,
    drawableId,
    meshId,
    vertices: baseVertices,
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    keyformBindings:
      options.includeKeyform === true
        ? [
            {
              evaluator: "linear-1d-v1",
              keyformSetId,
              targetId: meshId,
              targetKind: "mesh",
              targetProperty: "vertices",
              parameterId,
              compositionMode: "replace",
              compositionOrder: 0,
              keys: [
                { value: 0, statePatch: baseVertices },
                { value: 1, statePatch: candidateVertices }
              ]
            }
          ]
        : []
  });
  const candidateGraph = createGraph({
    packageId,
    parameterId,
    drawableId,
    meshId,
    vertices: candidateVertices,
    bounds: { x: 0, y: -2, width: 14, height: 12 }
  });

  return {
    baselineGraph,
    candidateGraph,
    parameterId,
    drawableId,
    meshId,
    baseVertices,
    candidateVertices
  };
};

const createGraph = (input: {
  readonly packageId: ReturnType<typeof PackageIdSchema.parse>;
  readonly parameterId: ReturnType<typeof ParameterIdSchema.parse>;
  readonly drawableId: ReturnType<typeof DrawableIdSchema.parse>;
  readonly meshId: ReturnType<typeof MeshIdSchema.parse>;
  readonly vertices: readonly { readonly x: number; readonly y: number }[];
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly keyformBindings?: NormalizedRuntimeGraph["keyformBindings"];
}): NormalizedRuntimeGraph => ({
  packageId: input.packageId,
  packageRevision: 0,
  coordinateSystem: "canvas-y-down-v1",
  parameters: new Map([
    [
      input.parameterId,
      {
        id: input.parameterId,
        displayName: "Mesh Preview",
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
      input.drawableId,
      {
        drawableId: input.drawableId,
        meshId: input.meshId,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: input.bounds,
        vertices: input.vertices,
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        triangles: [[0, 1, 2]],
        triangleStableIds: [TriangleIdSchema.parse("tri_body_0")],
        topologyRevision: 7,
        vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
        vertexCount: input.vertices.length,
        vertexHash: createStableVertexHash(input.vertices)
      }
    ]
  ]),
  rigControls: new Map(),
  keyformBindings: input.keyformBindings ?? [],
  masks: [],
  drawOrder: [{ drawableId: input.drawableId, drawOrder: 0 }],
  disabledFutureLayers: []
});
