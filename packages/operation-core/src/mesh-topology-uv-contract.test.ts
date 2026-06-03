import { describe, expect, it } from "vitest";

import {
  MeshTopologyOperationEvidenceDtoSchema,
  OperationEvidenceResultSchema,
  OperationPayloadSchema,
  OperationRequestSchema,
  OperationResultSchema
} from "./index.js";

const payloadCases = [
  {
    operationType: "addMeshVertex",
    payload: {
      meshId: "mesh_body",
      vertexId: "vtx_body_3",
      position: { x: 20, y: 20 },
      uv: { x: 0.5, y: 0.5 },
      insertIndex: 3,
      expectedTopologyRevision: 1,
      intent: "add one explicit vertex without triangulation"
    }
  },
  {
    operationType: "removeMeshVertex",
    payload: {
      meshId: "mesh_body",
      vertexId: "vtx_body_3",
      removalPolicy: "unreferenced-only",
      expectedTopologyRevision: 2,
      intent: "remove only if the vertex is not referenced by triangles"
    }
  },
  {
    operationType: "addMeshTriangle",
    payload: {
      meshId: "mesh_body",
      triangleId: "tri_body_1",
      vertexIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"],
      windingPolicy: "preserveVertexOrder",
      expectedTopologyRevision: 3,
      intent: "add a triangle by stable existing vertex IDs"
    }
  },
  {
    operationType: "removeMeshTriangle",
    payload: {
      meshId: "mesh_body",
      triangleId: "tri_body_1",
      removalPolicy: "remove-triangle-only",
      expectedTopologyRevision: 4,
      intent: "remove one explicit triangle without deleting vertices"
    }
  },
  {
    operationType: "moveMeshUvPoint",
    payload: {
      meshId: "mesh_body",
      uvDeltas: [
        {
          vertexId: "vtx_body_0",
          delta: { x: 0.05, y: -0.02 }
        }
      ],
      expectedTopologyRevision: 4,
      intent: "move a semantic UV point without claiming texture sampling correctness"
    }
  }
] as const;

describe("mesh topology and UV operation contracts", () => {
  it("parses the bounded topology and UV operation payload subset", () => {
    const parsed = payloadCases.map((payload) => OperationPayloadSchema.parse(payload));

    expect(parsed.map((payload) => payload.operationType)).toEqual([
      "addMeshVertex",
      "removeMeshVertex",
      "addMeshTriangle",
      "removeMeshTriangle",
      "moveMeshUvPoint"
    ]);
  });

  it("parses bounded mesh topology requests through the operation request boundary", () => {
    const request = OperationRequestSchema.parse({
      schemaVersion: "operation-request-v1",
      operationId: "op_add_mesh_triangle",
      actor: "test",
      surface: "testFixture",
      dryRun: true,
      basePackageRevision: 7,
      ...payloadCases[2]
    });

    expect(request.operationType).toBe("addMeshTriangle");
    if (request.operationType !== "addMeshTriangle") {
      throw new Error(`Expected addMeshTriangle request, got ${request.operationType}.`);
    }
    expect(request.payload.triangleId).toBe("tri_body_1");
  });

  it("rejects unsafe IDs and unbounded UV edits at schema level", () => {
    expect(OperationPayloadSchema.safeParse({
      ...payloadCases[2],
      payload: {
        ...payloadCases[2].payload,
        triangleId: "triangle_body_1"
      }
    }).success).toBe(false);
    expect(OperationPayloadSchema.safeParse({
      ...payloadCases[4],
      payload: {
        ...payloadCases[4].payload,
        uvDeltas: []
      }
    }).success).toBe(false);
  });

  it("parses operation evidence without renderer or texture sampling correctness claims", () => {
    const meshTopologyEvidence = MeshTopologyOperationEvidenceDtoSchema.parse({
      schemaVersion: "mesh-topology-operation-evidence-v1",
      operationType: "addMeshTriangle",
      meshId: "mesh_body",
      topologyRevisionBefore: 3,
      topologyRevisionAfter: 4,
      vertexCountBefore: 3,
      vertexCountAfter: 3,
      triangleCountBefore: 0,
      triangleCountAfter: 1,
      changes: [
        {
          kind: "triangleAdded",
          triangleId: "tri_body_1",
          triangleIndex: 0,
          vertexIds: ["vtx_body_0", "vtx_body_1", "vtx_body_2"]
        }
      ],
      rendererCorrectnessClaim: "none",
      textureSamplingCorrectnessClaim: "none"
    });

    const evidenceResult = OperationEvidenceResultSchema.parse({
      meshTopologyEvidence: [meshTopologyEvidence]
    });
    const operationResult = OperationResultSchema.parse({
      schemaVersion: "operation-result-v1",
      operationId: "op_add_mesh_triangle",
      status: "dry_run",
      precondition: {
        ok: true,
        diagnostics: []
      },
      meshTopologyEvidence: [meshTopologyEvidence],
      reversible: true
    });

    expect(evidenceResult.meshTopologyEvidence?.[0]?.textureSamplingCorrectnessClaim).toBe("none");
    expect(operationResult.meshTopologyEvidence?.[0]?.rendererCorrectnessClaim).toBe("none");
  });
});
