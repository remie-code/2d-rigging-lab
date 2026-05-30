import {
  createInitialAuthoringRevision,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { moveMeshVertexOperationHandler } from "./move-mesh-vertex.js";

describe("moveMeshVertex operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("moveMeshVertex")).toBe(moveMeshVertexOperationHandler);
  });

  it("dry-runs vertex delta updates on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createMoveMeshVertexRequest({
      dryRun: true,
      vertexDeltas: [{ vertexId: "vtx_body_1", delta: { x: 3, y: -1 } }]
    });

    const outcome = moveMeshVertexOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.meshes[0]?.vertices[1]).toEqual({ x: 2, y: 0 });
    expect(outcome.candidateSession.graph.meshes[0]?.vertices[1]).toEqual({ x: 5, y: -1 });
    expect(outcome.candidateSession.graph.meshes[0]?.bounds).toEqual({ x: 0, y: -1, width: 5, height: 2 });
    expect(outcome.result.modelDiff?.changed[0]).toMatchObject({
      target: { kind: "mesh", id: "mesh_body" },
      fields: [
        {
          path: "/model/meshes/mesh_body/vertices"
        },
        {
          path: "/model/meshes/mesh_body/vertices/1",
          before: { x: 2, y: 0 },
          after: { x: 5, y: -1 }
        },
        {
          path: "/model/meshes/mesh_body/bounds",
          before: { x: 0, y: 0, width: 2, height: 1 },
          after: { x: 0, y: -1, width: 5, height: 2 }
        }
      ]
    });
    expect(outcome.result.modelDiff?.changed[1]).toEqual({
      target: {
        kind: "vertex",
        id: "vtx_body_1",
        path: "/model/meshes/mesh_body/vertices/1"
      },
      fields: [
        {
          path: "/model/meshes/mesh_body/vertices/1",
          before: { x: 2, y: 0 },
          after: { x: 5, y: -1 }
        }
      ]
    });
    expect(toRuntimeGraph(outcome.candidateSession).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      bounds: { x: 0, y: -1, width: 5, height: 2 },
      vertices: [
        { x: 0, y: 0 },
        { x: 5, y: -1 },
        { x: 0, y: 1 }
      ]
    });
  });

  it("commits vertex deltas through operation core and logs checked targets", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore({
      now: () => new Date("2026-05-30T00:00:00.000Z")
    });

    const outcome = operationCore.commitOperation(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: [{ vertexId: "vtx_body_2", delta: { x: -1, y: 2 } }]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(1);
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.graph.meshes[0]?.vertices[2]).toEqual({ x: -1, y: 3 });
    expect(outcome.logEntry?.operationType).toBe("moveMeshVertex");
    expect(outcome.logEntry?.targetIds).toEqual(["mesh_body", "vtx_body_2"]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "mesh", id: "mesh_body" },
      { kind: "vertex", id: "vtx_body_2", path: "/model/meshes/mesh_body/vertices" }
    ]);
    expect(outcome.result.modelDiff?.changed[1]?.target).toEqual({
      kind: "vertex",
      id: "vtx_body_2",
      path: "/model/meshes/mesh_body/vertices/2"
    });
  });

  it("rejects missing mesh, missing vertex, duplicate vertex, and empty deltas deterministically", () => {
    const session = createFixtureSession();
    const missingMesh = moveMeshVertexOperationHandler.commit(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        meshId: "mesh_missing",
        vertexDeltas: [{ vertexId: "vtx_body_0", delta: { x: 1, y: 0 } }]
      }),
      "op_move_body_vertex" as OperationId
    );

    expect(missingMesh.result.status).toBe("rejected");
    expect(missingMesh.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.moveMeshVertex.missingMesh"
    ]);

    const missingVertex = moveMeshVertexOperationHandler.commit(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: [{ vertexId: "vtx_missing_0", delta: { x: 1, y: 0 } }]
      }),
      "op_move_body_vertex" as OperationId
    );

    expect(missingVertex.result.status).toBe("rejected");
    expect(missingVertex.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.moveMeshVertex.missingVertex"
    ]);

    const duplicateVertex = moveMeshVertexOperationHandler.commit(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: [
          { vertexId: "vtx_body_0", delta: { x: 1, y: 0 } },
          { vertexId: "vtx_body_0", delta: { x: 0, y: 1 } }
        ]
      }),
      "op_move_body_vertex" as OperationId
    );

    expect(duplicateVertex.result.status).toBe("rejected");
    expect(duplicateVertex.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.moveMeshVertex.duplicateVertexDelta"
    ]);

    const operationCore = createOperationCore();
    const emptyDeltas = operationCore.dryRunOperation(
      session,
      createMoveMeshVertexRequest({
        dryRun: true,
        vertexDeltas: []
      })
    );

    expect(emptyDeltas.status).toBe("rejected");
    expect(emptyDeltas.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.moveMeshVertex.emptyDelta"
    ]);
    expect(operationCore.operationLog.entries).toHaveLength(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects no-op deltas and keyform-scoped payloads in this wave", () => {
    const session = createFixtureSession();
    const noOp = moveMeshVertexOperationHandler.commit(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: [{ vertexId: "vtx_body_1", delta: { x: 0, y: 0 } }]
      }),
      "op_move_body_vertex" as OperationId
    );

    expect(noOp.result.status).toBe("rejected");
    expect(noOp.result.diagnostics[0]).toMatchObject({
      checkId: "operation.moveMeshVertex.noOp",
      severity: "warning"
    });

    const keyformScoped = moveMeshVertexOperationHandler.commit(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: [{ vertexId: "vtx_body_1", delta: { x: 1, y: 0 } }],
        keyformScope: {
          parameterId: "param_face_yaw",
          keyValue: 1
        }
      }),
      "op_move_body_vertex" as OperationId
    );

    expect(keyformScoped.result.status).toBe("rejected");
    expect(keyformScoped.result.diagnostics[0]).toMatchObject({
      checkId: "operation.moveMeshVertex.unsupportedKeyformScope",
      target: { kind: "parameter", id: "param_face_yaw", path: "/payload/keyformScope" }
    });
    expect(session.authoringRevision).toBe(0);
  });
});

const createMoveMeshVertexRequest = (options: {
  readonly dryRun: boolean;
  readonly meshId?: string;
  readonly vertexDeltas: readonly {
    readonly vertexId: string;
    readonly delta: { readonly x: number; readonly y: number };
  }[];
  readonly keyformScope?: {
    readonly parameterId: string;
    readonly keyValue: number;
  };
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_move_body_vertex",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "moveMeshVertex",
    payload: {
      meshId: options.meshId ?? "mesh_body",
      vertexDeltas: options.vertexDeltas,
      ...(options.keyformScope === undefined
        ? {}
        : {
            keyformScope: {
              parameterId: ParameterIdSchema.parse(options.keyformScope.parameterId),
              keyValue: options.keyformScope.keyValue
            }
          }),
      intent: "test vertex delta"
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_move_mesh_vertex_operation_test"),
    packageDisplayName: "Move Mesh Vertex Operation Test",
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
