import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { moveMeshVertices } from "./mesh-mutations.js";
import { toRuntimeGraph } from "./to-runtime-graph.js";

describe("mesh vertex authoring mutations", () => {
  it("updates mesh vertices by stable vertex ID and recomputes mesh bounds", () => {
    const session = createFixtureSession();

    const result = moveMeshVertices(session, {
      meshId: MeshIdSchema.parse("mesh_body"),
      vertexDeltas: [
        {
          vertexId: VertexIdSchema.parse("vtx_body_1"),
          delta: { x: 0.5, y: -0.25 }
        },
        {
          vertexId: VertexIdSchema.parse("vtx_body_2"),
          delta: { x: -1, y: 2 }
        }
      ]
    });

    expect(result.meshBefore.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 }
    ]);
    expect(result.meshAfter.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 2.5, y: -0.25 },
      { x: -1, y: 3 }
    ]);
    expect(result.meshAfter.bounds).toEqual({ x: -1, y: -0.25, width: 3.5, height: 3.25 });
    expect(result.vertexChanges.map((change) => [change.vertexId, change.vertexIndex])).toEqual([
      ["vtx_body_1", 1],
      ["vtx_body_2", 2]
    ]);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);

    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      bounds: { x: -1, y: -0.25, width: 3.5, height: 3.25 },
      vertices: [
        { x: 0, y: 0 },
        { x: 2.5, y: -0.25 },
        { x: -1, y: 3 }
      ]
    });
  });

  it("rejects missing mesh and missing vertex without mutating revision", () => {
    const missingMeshSession = createFixtureSession();

    expect(() =>
      moveMeshVertices(missingMeshSession, {
        meshId: MeshIdSchema.parse("mesh_missing"),
        vertexDeltas: [{ vertexId: VertexIdSchema.parse("vtx_body_0"), delta: { x: 1, y: 0 } }]
      })
    ).toThrow(expect.objectContaining({ code: "missing_mesh" }) as AuthoringMutationError);
    expect(missingMeshSession.authoringRevision).toBe(0);

    const missingVertexSession = createFixtureSession();
    expect(() =>
      moveMeshVertices(missingVertexSession, {
        meshId: MeshIdSchema.parse("mesh_body"),
        vertexDeltas: [{ vertexId: VertexIdSchema.parse("vtx_missing_0"), delta: { x: 1, y: 0 } }]
      })
    ).toThrow(expect.objectContaining({ code: "missing_vertex" }) as AuthoringMutationError);
    expect(missingVertexSession.graph.meshes[0]?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 }
    ]);
    expect(missingVertexSession.authoringRevision).toBe(0);
  });

  it("rejects empty, duplicate, and no-op vertex deltas", () => {
    const emptySession = createFixtureSession();
    expect(() =>
      moveMeshVertices(emptySession, {
        meshId: MeshIdSchema.parse("mesh_body"),
        vertexDeltas: []
      })
    ).toThrow(expect.objectContaining({ code: "empty_vertex_delta" }) as AuthoringMutationError);

    const duplicateSession = createFixtureSession();
    expect(() =>
      moveMeshVertices(duplicateSession, {
        meshId: MeshIdSchema.parse("mesh_body"),
        vertexDeltas: [
          { vertexId: VertexIdSchema.parse("vtx_body_0"), delta: { x: 1, y: 0 } },
          { vertexId: VertexIdSchema.parse("vtx_body_0"), delta: { x: 0, y: 1 } }
        ]
      })
    ).toThrow(expect.objectContaining({ code: "duplicate_vertex_delta" }) as AuthoringMutationError);

    const noOpSession = createFixtureSession();
    expect(() =>
      moveMeshVertices(noOpSession, {
        meshId: MeshIdSchema.parse("mesh_body"),
        vertexDeltas: [{ vertexId: VertexIdSchema.parse("vtx_body_1"), delta: { x: 0, y: 0 } }]
      })
    ).toThrow(expect.objectContaining({ code: "no_op_mesh_vertex_update" }) as AuthoringMutationError);
    expect(noOpSession.authoringRevision).toBe(0);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_mesh_vertex_mutation_test"),
    packageDisplayName: "Mesh Vertex Mutation Test",
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
        vertices: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: 1 }
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        triangles: [[0, 1, 2]],
        vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
        bounds: { x: 0, y: 0, width: 2, height: 1 },
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
});
