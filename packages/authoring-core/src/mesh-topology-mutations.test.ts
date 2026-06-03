import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { TriangleId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import {
  addMeshTriangle,
  addMeshVertex,
  moveMeshUvPoints,
  removeMeshTriangle,
  removeMeshVertex
} from "./mesh-topology-mutations.js";
import { toRuntimeGraph } from "./to-runtime-graph.js";

describe("mesh topology and UV authoring mutations", () => {
  it("adds and removes an unreferenced vertex while preserving triangle identity and revision evidence", () => {
    const session = createFixtureSession({ topologyRevision: 3 });

    const added = addMeshVertex(session, {
      meshId: MeshIdSchema.parse("mesh_body"),
      vertexId: VertexIdSchema.parse("vtx_body_inserted"),
      position: { x: 1, y: 1 },
      uv: { x: 0.5, y: 0.5 },
      insertIndex: 1,
      expectedTopologyRevision: 3
    });

    expect(added.vertexIndex).toBe(1);
    expect(added.meshAfter.vertexStableIds).toEqual([
      "vtx_body_0",
      "vtx_body_inserted",
      "vtx_body_1",
      "vtx_body_2"
    ]);
    expect(added.meshAfter.triangles).toEqual([[0, 2, 3]]);
    expect(added.meshAfter.topologyRevision).toBe(4);
    expect(session.authoringRevision).toBe(1);

    const removed = removeMeshVertex(session, {
      meshId: MeshIdSchema.parse("mesh_body"),
      vertexId: VertexIdSchema.parse("vtx_body_inserted"),
      expectedTopologyRevision: 4
    });

    expect(removed.meshAfter.vertexStableIds).toEqual(["vtx_body_0", "vtx_body_1", "vtx_body_2"]);
    expect(removed.meshAfter.triangles).toEqual([[0, 1, 2]]);
    expect(removed.meshAfter.topologyRevision).toBe(5);
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      topologyRevision: 5,
      vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
      triangleStableIds: ["tri_body_0"]
    });
  });

  it("adds and removes triangles with deterministic materialized stable IDs on legacy meshes", () => {
    const session = createFixtureSession({
      vertexCount: 4,
      triangleStableIds: undefined,
      topologyRevision: undefined
    });

    const added = addMeshTriangle(session, {
      meshId: MeshIdSchema.parse("mesh_body"),
      triangleId: TriangleIdSchema.parse("tri_body_new"),
      vertexIds: [
        VertexIdSchema.parse("vtx_body_1"),
        VertexIdSchema.parse("vtx_body_3"),
        VertexIdSchema.parse("vtx_body_2")
      ],
      insertIndex: 1,
      expectedTopologyRevision: 0
    });

    expect(added.meshAfter.triangles).toEqual([
      [0, 1, 2],
      [1, 3, 2]
    ]);
    expect(added.meshAfter.triangleStableIds).toEqual(["tri_body_existing_0", "tri_body_new"]);
    expect(added.meshAfter.topologyRevision).toBe(1);

    const removed = removeMeshTriangle(session, {
      meshId: MeshIdSchema.parse("mesh_body"),
      triangleId: TriangleIdSchema.parse("tri_body_existing_0"),
      expectedTopologyRevision: 1
    });

    expect(removed.meshAfter.triangles).toEqual([[1, 3, 2]]);
    expect(removed.meshAfter.triangleStableIds).toEqual(["tri_body_new"]);
    expect(removed.meshAfter.topologyRevision).toBe(2);
  });

  it("moves UV points and rejects stale or invalid edits without mutating mesh state", () => {
    const session = createFixtureSession({ topologyRevision: 3 });

    const moved = moveMeshUvPoints(session, {
      meshId: MeshIdSchema.parse("mesh_body"),
      uvDeltas: [
        {
          vertexId: VertexIdSchema.parse("vtx_body_1"),
          delta: { x: -0.25, y: 0.5 }
        }
      ],
      expectedTopologyRevision: 3
    });

    expect(moved.uvChanges).toEqual([
      {
        vertexId: "vtx_body_1",
        vertexIndex: 1,
        before: { x: 1, y: 0 },
        after: { x: 0.75, y: 0.5 },
        delta: { x: -0.25, y: 0.5 }
      }
    ]);
    expect(moved.meshAfter.topologyRevision).toBe(4);

    expect(() =>
      moveMeshUvPoints(session, {
        meshId: MeshIdSchema.parse("mesh_body"),
        uvDeltas: [
          {
            vertexId: VertexIdSchema.parse("vtx_body_2"),
            delta: { x: 0.1, y: 0 }
          }
        ],
        expectedTopologyRevision: 3
      })
    ).toThrow(expect.objectContaining({ code: "topology_revision_mismatch" }) as AuthoringMutationError);
    expect(session.graph.meshes[0]?.uvs[2]).toEqual({ x: 0, y: 1 });
    expect(session.graph.meshes[0]?.topologyRevision).toBe(4);

    expect(() =>
      removeMeshVertex(session, {
        meshId: MeshIdSchema.parse("mesh_body"),
        vertexId: VertexIdSchema.parse("vtx_body_1"),
        expectedTopologyRevision: 4
      })
    ).toThrow(expect.objectContaining({ code: "referenced_vertex" }) as AuthoringMutationError);
    expect(session.graph.meshes[0]?.vertexStableIds).toEqual(["vtx_body_0", "vtx_body_1", "vtx_body_2"]);
  });

  it("rejects invalid addMeshVertex insertIndex values without mutating mesh state", () => {
    for (const insertIndex of invalidInsertIndexes) {
      const session = createFixtureSession({ topologyRevision: 3 });
      const meshBefore = structuredClone(session.graph.meshes[0]);

      expect(() =>
        addMeshVertex(session, {
          meshId: MeshIdSchema.parse("mesh_body"),
          vertexId: VertexIdSchema.parse("vtx_body_inserted"),
          position: { x: 1, y: 1 },
          uv: { x: 0.5, y: 0.5 },
          insertIndex,
          expectedTopologyRevision: 3
        })
      ).toThrow(expect.objectContaining({ code: "invalid_vertex_insert_index" }) as AuthoringMutationError);
      expect(session.graph.meshes[0]).toEqual(meshBefore);
      expect(session.authoringRevision).toBe(0);
      expect(session.dirty).toBe(false);
    }
  });

  it("rejects invalid addMeshTriangle insertIndex values without mutating mesh state", () => {
    for (const insertIndex of invalidInsertIndexes) {
      const session = createFixtureSession({ vertexCount: 4, topologyRevision: 3 });
      const meshBefore = structuredClone(session.graph.meshes[0]);

      expect(() =>
        addMeshTriangle(session, {
          meshId: MeshIdSchema.parse("mesh_body"),
          triangleId: TriangleIdSchema.parse("tri_body_inserted"),
          vertexIds: [
            VertexIdSchema.parse("vtx_body_1"),
            VertexIdSchema.parse("vtx_body_3"),
            VertexIdSchema.parse("vtx_body_2")
          ],
          insertIndex,
          expectedTopologyRevision: 3
        })
      ).toThrow(expect.objectContaining({ code: "invalid_triangle_insert_index" }) as AuthoringMutationError);
      expect(session.graph.meshes[0]).toEqual(meshBefore);
      expect(session.authoringRevision).toBe(0);
      expect(session.dirty).toBe(false);
    }
  });
});

const invalidInsertIndexes = [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY];

const createFixtureSession = (options: {
  readonly vertexCount?: 3 | 4;
  readonly triangleStableIds?: readonly TriangleId[] | undefined;
  readonly topologyRevision?: number | undefined;
} = {}): AuthoringSession => {
  const vertexCount = options.vertexCount ?? 3;
  const vertices = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 0, y: 1 },
    { x: 2, y: 1 }
  ].slice(0, vertexCount);
  const uvs = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 }
  ].slice(0, vertexCount);
  const vertexStableIds = ["vtx_body_0", "vtx_body_1", "vtx_body_2", "vtx_body_3"].slice(0, vertexCount);
  const triangleStableIds = "triangleStableIds" in options
    ? options.triangleStableIds
    : [TriangleIdSchema.parse("tri_body_0")];

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_mesh_topology_mutation_test"),
      packageDisplayName: "Mesh Topology Mutation Test",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 128, height: 128 },
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DrawableIdSchema.parse("draw_body")]
        }
      ],
      drawables: [
        {
          drawableId: DrawableIdSchema.parse("draw_body"),
          displayName: "Body",
          partId: PartIdSchema.parse("part_root"),
          sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
          textureId: TextureIdSchema.parse("tex_body"),
          meshId: MeshIdSchema.parse("mesh_body"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ],
      meshes: [
        {
          meshId: MeshIdSchema.parse("mesh_body"),
          drawableId: DrawableIdSchema.parse("draw_body"),
          vertices,
          uvs,
          triangles: [[0, 1, 2]],
          vertexStableIds,
          ...(triangleStableIds === undefined ? {} : { triangleStableIds: [...triangleStableIds] }),
          ...(options.topologyRevision === undefined
            ? {}
            : { topologyRevision: options.topologyRevision }),
          bounds: { x: 0, y: 0, width: 2, height: vertexCount === 4 ? 1 : 1 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [{ drawableId: DrawableIdSchema.parse("draw_body"), baseDrawOrder: 0, stableOrder: 0 }],
      rigControlRootIds: [],
      stableOrder: ["draw_body"],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
};
