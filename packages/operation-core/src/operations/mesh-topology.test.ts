import {
  createAuthoringSessionFromPackageDocument,
  createInitialAuthoringRevision,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import {
  addMeshTriangleOperationHandler,
  addMeshVertexOperationHandler,
  moveMeshUvPointOperationHandler,
  removeMeshTriangleOperationHandler,
  removeMeshVertexOperationHandler
} from "./mesh-topology.js";

describe("mesh topology and UV operation handlers", () => {
  it("registers the bounded topology and UV operation handlers", () => {
    expect(getOperationHandler("addMeshVertex")).toBe(addMeshVertexOperationHandler);
    expect(getOperationHandler("removeMeshVertex")).toBe(removeMeshVertexOperationHandler);
    expect(getOperationHandler("addMeshTriangle")).toBe(addMeshTriangleOperationHandler);
    expect(getOperationHandler("removeMeshTriangle")).toBe(removeMeshTriangleOperationHandler);
    expect(getOperationHandler("moveMeshUvPoint")).toBe(moveMeshUvPointOperationHandler);
  });

  it("commits topology and UV edits through package save/load and runtime graph evidence", () => {
    const session = createFixtureSession();
    const baseDocument = createBaseDocument(session);
    const operationCore = createOperationCore({
      now: () => new Date("2026-06-03T00:00:00.000Z")
    });

    const addVertexOutcome = operationCore.commitOperation(
      session,
      createAddMeshVertexRequest({ basePackageRevision: 0, expectedTopologyRevision: 0 })
    );
    const addTriangleOutcome = operationCore.commitOperation(
      session,
      createAddMeshTriangleRequest({ basePackageRevision: 1, expectedTopologyRevision: 1 })
    );
    const moveUvOutcome = operationCore.commitOperation(
      session,
      createMoveMeshUvPointRequest({ basePackageRevision: 2, expectedTopologyRevision: 2 })
    );

    expect(addVertexOutcome.result.status).toBe("committed");
    expect(addTriangleOutcome.result.status).toBe("committed");
    expect(moveUvOutcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(3);
    expect(session.authoringRevision).toBe(3);
    expect(operationCore.operationLog.entries.map((entry) => entry.operationType)).toEqual([
      "addMeshVertex",
      "addMeshTriangle",
      "moveMeshUvPoint"
    ]);

    expect(addVertexOutcome.result.meshTopologyEvidence).toEqual([
      {
        schemaVersion: "mesh-topology-operation-evidence-v1",
        operationType: "addMeshVertex",
        meshId: "mesh_body",
        topologyRevisionBefore: 0,
        topologyRevisionAfter: 1,
        vertexCountBefore: 3,
        vertexCountAfter: 4,
        triangleCountBefore: 1,
        triangleCountAfter: 1,
        changes: [
          {
            kind: "vertexAdded",
            vertexId: "vtx_body_3",
            vertexIndex: 3,
            position: { x: 2, y: 1 },
            uv: { x: 1, y: 1 }
          }
        ],
        rendererCorrectnessClaim: "none",
        textureSamplingCorrectnessClaim: "none"
      }
    ]);
    expect(addTriangleOutcome.result.meshTopologyEvidence?.[0]).toMatchObject({
      operationType: "addMeshTriangle",
      topologyRevisionBefore: 1,
      topologyRevisionAfter: 2,
      changes: [
        {
          kind: "triangleAdded",
          triangleId: "tri_body_1",
          triangleIndex: 1,
          vertexIds: ["vtx_body_1", "vtx_body_3", "vtx_body_2"]
        }
      ]
    });
    expect(moveUvOutcome.result.meshTopologyEvidence?.[0]).toMatchObject({
      operationType: "moveMeshUvPoint",
      topologyRevisionBefore: 2,
      topologyRevisionAfter: 3,
      changes: [
        {
          kind: "uvMoved",
          vertexId: "vtx_body_3",
          vertexIndex: 3,
          before: { x: 1, y: 1 },
          after: { x: 0.75, y: 0.5 }
        }
      ]
    });

    const materialized = toPackageDocument(session, baseDocument);
    const reloaded = createAuthoringSessionFromPackageDocument(materialized);
    const reloadedMesh = reloaded.graph.meshes[0];
    expect(materialized.manifest.packageRevision).toBe(3);
    expect(reloadedMesh).toMatchObject({
      topologyRevision: 3,
      vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2", "vtx_body_3"],
      triangleStableIds: ["tri_body_0", "tri_body_1"],
      triangles: [
        [0, 1, 2],
        [1, 3, 2]
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0.75, y: 0.5 }
      ]
    });

    expect(toRuntimeGraph(reloaded).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      topologyRevision: 3,
      vertexStableIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2", "vtx_body_3"],
      triangleStableIds: ["tri_body_0", "tri_body_1"],
      triangles: [
        [0, 1, 2],
        [1, 3, 2]
      ],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 0.75, y: 0.5 }
      ]
    });
  });

  it("rejects stale or invalid topology edits deterministically without corrupting mesh state", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore();
    const meshBefore = structuredClone(session.graph.meshes[0]);

    const stale = operationCore.commitOperation(
      session,
      createMoveMeshUvPointRequest({ basePackageRevision: 0, expectedTopologyRevision: 99 })
    );
    expect(stale.result.status).toBe("rejected");
    expect(stale.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.moveMeshUvPoint.topologyRevisionMismatch"
    ]);
    expect(operationCore.operationLog.entries).toHaveLength(0);
    expect(session.graph.meshes[0]).toEqual(meshBefore);

    const referencedVertex = operationCore.commitOperation(
      session,
      createRemoveMeshVertexRequest({ basePackageRevision: 0, expectedTopologyRevision: 0 })
    );
    expect(referencedVertex.result.status).toBe("rejected");
    expect(referencedVertex.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.removeMeshVertex.referencedVertex"
    ]);
    expect(operationCore.operationLog.entries).toHaveLength(0);
    expect(session.graph.meshes[0]).toEqual(meshBefore);
    expect(session.authoringRevision).toBe(0);
  });
});

const createAddMeshVertexRequest = (input: {
  readonly basePackageRevision: number;
  readonly expectedTopologyRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_add_mesh_vertex",
    actor: "test",
    surface: "testFixture",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    operationType: "addMeshVertex",
    payload: {
      meshId: "mesh_body",
      vertexId: "vtx_body_3",
      position: { x: 2, y: 1 },
      uv: { x: 1, y: 1 },
      expectedTopologyRevision: input.expectedTopologyRevision,
      intent: "add bounded unreferenced mesh vertex"
    }
  });

const createAddMeshTriangleRequest = (input: {
  readonly basePackageRevision: number;
  readonly expectedTopologyRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_add_mesh_triangle",
    actor: "test",
    surface: "testFixture",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    operationType: "addMeshTriangle",
    payload: {
      meshId: "mesh_body",
      triangleId: "tri_body_1",
      vertexIds: ["vtx_body_1", "vtx_body_3", "vtx_body_2"],
      windingPolicy: "preserveVertexOrder",
      expectedTopologyRevision: input.expectedTopologyRevision,
      intent: "add bounded triangle by existing stable vertex IDs"
    }
  });

const createMoveMeshUvPointRequest = (input: {
  readonly basePackageRevision: number;
  readonly expectedTopologyRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_move_mesh_uv",
    actor: "test",
    surface: "testFixture",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    operationType: "moveMeshUvPoint",
    payload: {
      meshId: "mesh_body",
      uvDeltas: [
        {
          vertexId: "vtx_body_3",
          delta: { x: -0.25, y: -0.5 }
        }
      ],
      expectedTopologyRevision: input.expectedTopologyRevision,
      intent: "move semantic UV point"
    }
  });

const createRemoveMeshVertexRequest = (input: {
  readonly basePackageRevision: number;
  readonly expectedTopologyRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_remove_referenced_vertex",
    actor: "test",
    surface: "testFixture",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    operationType: "removeMeshVertex",
    payload: {
      meshId: "mesh_body",
      vertexId: "vtx_body_1",
      removalPolicy: "unreferenced-only",
      expectedTopologyRevision: input.expectedTopologyRevision,
      intent: "reject referenced vertex removal"
    }
  });

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_mesh_topology_operation_test"),
    packageDisplayName: "Mesh Topology Operation Test",
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
        triangleStableIds: [TriangleIdSchema.parse("tri_body_0")],
        topologyRevision: 0,
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

const createBaseDocument = (session: AuthoringSession): Parameters<typeof toPackageDocument>[1] =>
  ({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: session.packageIdentity.packageId,
      packageDisplayName: session.packageIdentity.packageDisplayName,
      formatVersion: session.packageIdentity.formatVersion,
      packageRevision: 0,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z",
      schemaVersions: { manifest: "open-model-package-manifest-v1" },
      evaluatorVersions: {},
      modelFiles: {
        graph: "model/graph.json",
        drawables: "model/drawables.json",
        meshes: "model/meshes.json",
        parameters: "model/parameters.json",
        keyforms: "model/keyforms.json",
        rigControls: "model/rig-controls.json",
        dynamics: "model/dynamics.json",
        masks: "model/masks.json",
        drawOrder: "model/draw-order.json"
      },
      assetIndex: "assets/sources/source-manifest.json",
      operationLog: "operations/log.jsonl",
      rightsSummary: { status: "cleared" },
      provenanceSummary: { sourceAssetCount: 0 },
      packageStableOrderVersion: "stable-order-v1"
    },
    model: {
      graph: {
        schemaVersion: "model-graph-v1",
        coordinateSystem: session.graph.coordinateSystem,
        canvasSize: session.graph.canvasSize,
        parts: session.graph.parts,
        rigControlRootIds: session.graph.rigControlRootIds,
        stableOrder: session.graph.stableOrder
      },
      drawables: { schemaVersion: "drawables-file-v1", drawables: session.graph.drawables },
      meshes: { schemaVersion: "meshes-file-v1", meshes: session.graph.meshes },
      parameters: { schemaVersion: "parameters-file-v1", parameters: session.graph.parameters },
      keyforms: { schemaVersion: "keyforms-file-v1", keyformSets: session.graph.keyformSets },
      rigControls: { schemaVersion: "rig-controls-file-v1", rigControls: session.graph.rigControls },
      dynamics: { schemaVersion: "dynamics-file-v3", dynamicsGroups: session.graph.dynamicsGroups },
      masks: { schemaVersion: "masks-file-v1", masks: session.graph.masks },
      drawOrder: { schemaVersion: "draw-order-file-v1", entries: session.graph.drawOrder }
    },
    assets: {
      sourceManifest: { schemaVersion: "source-manifest-v1", sourceAssets: [] },
      provenance: { schemaVersion: "provenance-file-v1", records: session.graph.provenanceRecords },
      rights: { schemaVersion: "rights-file-v1", records: session.graph.rightsRecords }
    }
  }) as Parameters<typeof toPackageDocument>[1];
