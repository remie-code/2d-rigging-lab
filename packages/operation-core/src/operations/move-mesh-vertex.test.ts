import {
  createInitialAuthoringRevision,
  toPackageDocument,
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

  it("dry-runs multi-vertex delta updates on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createMoveMeshVertexRequest({
      dryRun: true,
      vertexDeltas: [
        { vertexId: "vtx_body_1", delta: { x: 3, y: -1 } },
        { vertexId: "vtx_body_2", delta: { x: 1, y: 2 } }
      ]
    });

    const outcome = moveMeshVertexOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.meshes[0]?.vertices[1]).toEqual({ x: 2, y: 0 });
    expect(session.graph.meshes[0]?.vertices[2]).toEqual({ x: 0, y: 1 });
    expect(outcome.candidateSession.graph.meshes[0]?.vertices[1]).toEqual({ x: 5, y: -1 });
    expect(outcome.candidateSession.graph.meshes[0]?.vertices[2]).toEqual({ x: 1, y: 3 });
    expect(outcome.candidateSession.graph.meshes[0]?.bounds).toEqual({ x: 0, y: -1, width: 5, height: 4 });
    expect(outcome.result.precondition.checkedTargetRefs).toEqual([
      { kind: "mesh", id: "mesh_body" },
      { kind: "drawable", id: "draw_body" },
      { kind: "part", id: "part_root" },
      { kind: "vertex", id: "vtx_body_1", path: "/model/meshes/mesh_body/vertices/1" },
      { kind: "vertex", id: "vtx_body_2", path: "/model/meshes/mesh_body/vertices/2" }
    ]);
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
          path: "/model/meshes/mesh_body/vertices/2",
          before: { x: 0, y: 1 },
          after: { x: 1, y: 3 }
        },
        {
          path: "/model/meshes/mesh_body/bounds",
          before: { x: 0, y: 0, width: 2, height: 1 },
          after: { x: 0, y: -1, width: 5, height: 4 }
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
    expect(outcome.result.modelDiff?.changed[2]).toEqual({
      target: {
        kind: "vertex",
        id: "vtx_body_2",
        path: "/model/meshes/mesh_body/vertices/2"
      },
      fields: [
        {
          path: "/model/meshes/mesh_body/vertices/2",
          before: { x: 0, y: 1 },
          after: { x: 1, y: 3 }
        }
      ]
    });
    expect(toRuntimeGraph(outcome.candidateSession).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      bounds: { x: 0, y: -1, width: 5, height: 4 },
      vertices: [
        { x: 0, y: 0 },
        { x: 5, y: -1 },
        { x: 1, y: 3 }
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
      { kind: "drawable", id: "draw_body" },
      { kind: "part", id: "part_root" },
      { kind: "vertex", id: "vtx_body_2", path: "/model/meshes/mesh_body/vertices/2" }
    ]);
    expect(outcome.result.modelDiff?.changed[1]?.target).toEqual({
      kind: "vertex",
      id: "vtx_body_2",
      path: "/model/meshes/mesh_body/vertices/2"
    });
  });

  it("commits multi-vertex translate and materializes package mesh coordinates", () => {
    const session = createFixtureSession();
    const baseDocument = createBaseDocument(session);
    const operationCore = createOperationCore({
      now: () => new Date("2026-06-01T00:00:00.000Z")
    });

    const outcome = operationCore.commitOperation(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: [
          { vertexId: "vtx_body_1", delta: { x: 1, y: 1 } },
          { vertexId: "vtx_body_2", delta: { x: -1, y: 2 } }
        ]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.logEntry?.targetIds).toEqual(["mesh_body", "vtx_body_1", "vtx_body_2"]);
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual([
      { kind: "mesh", id: "mesh_body" },
      { kind: "vertex", id: "vtx_body_1", path: "/model/meshes/mesh_body/vertices/1" },
      { kind: "vertex", id: "vtx_body_2", path: "/model/meshes/mesh_body/vertices/2" }
    ]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "mesh", id: "mesh_body" },
      { kind: "drawable", id: "draw_body" },
      { kind: "part", id: "part_root" },
      { kind: "vertex", id: "vtx_body_1", path: "/model/meshes/mesh_body/vertices/1" },
      { kind: "vertex", id: "vtx_body_2", path: "/model/meshes/mesh_body/vertices/2" }
    ]);

    const materialized = toPackageDocument(session, baseDocument);
    const mesh = materialized.model.meshes.meshes.find((candidate) => candidate.meshId === "mesh_body");
    expect(materialized.manifest.packageRevision).toBe(1);
    expect(mesh?.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 1 },
      { x: -1, y: 3 }
    ]);
    expect(mesh?.vertexStableIds).toEqual(["vtx_body_0", "vtx_body_1", "vtx_body_2"]);
    expect(mesh?.bounds).toEqual({ x: -1, y: 0, width: 4, height: 3 });
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

  it("rejects caller-supplied locked drawable and part targets without editor-state dependency", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore();

    const locked = operationCore.commitOperation(
      session,
      createMoveMeshVertexRequest({
        dryRun: false,
        vertexDeltas: [{ vertexId: "vtx_body_1", delta: { x: 1, y: 0 } }],
        lockedTargetIds: ["draw_body", "part_root"]
      })
    );

    expect(locked.result.status).toBe("rejected");
    expect(locked.result.diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      target: diagnostic.target
    }))).toEqual([
      {
        checkId: "operation.moveMeshVertex.lockedTarget",
        target: { kind: "drawable", id: "draw_body" }
      },
      {
        checkId: "operation.moveMeshVertex.lockedTarget",
        target: { kind: "part", id: "part_root" }
      }
    ]);
    expect(locked.operationLogLength).toBe(0);
    expect(session.graph.meshes[0]?.vertices[1]).toEqual({ x: 2, y: 0 });
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
  readonly lockedTargetIds?: readonly string[];
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
      ...(options.lockedTargetIds === undefined ? {} : { lockedTargetIds: options.lockedTargetIds }),
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

const createBaseDocument = (session: AuthoringSession): Parameters<typeof toPackageDocument>[1] =>
  ({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: session.packageIdentity.packageId,
      packageDisplayName: session.packageIdentity.packageDisplayName,
      formatVersion: session.packageIdentity.formatVersion,
      packageRevision: 0,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
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
      dynamics: { schemaVersion: "dynamics-file-v1", dynamicsGroups: session.graph.dynamicsGroups },
      masks: { schemaVersion: "masks-file-v1", masks: session.graph.masks },
      drawOrder: { schemaVersion: "draw-order-file-v1", entries: session.graph.drawOrder }
    },
    assets: {
      sourceManifest: { schemaVersion: "source-manifest-v1", sourceAssets: [] },
      provenance: { schemaVersion: "provenance-file-v1", records: session.graph.provenanceRecords },
      rights: { schemaVersion: "rights-file-v1", records: session.graph.rightsRecords }
    }
  }) as Parameters<typeof toPackageDocument>[1];
