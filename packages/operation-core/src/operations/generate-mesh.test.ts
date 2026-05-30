import {
  createInitialAuthoringRevision,
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
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { generateMeshOperationHandler } from "./generate-mesh.js";

describe("generateMesh operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("generateMesh")).toBe(generateMeshOperationHandler);
  });

  it("dry-runs auto-grid-v1 on a cloned session with deterministic vertices and triangles", () => {
    const session = createFixtureSession();
    const request = createGenerateMeshRequest({ dryRun: true, densityHint: "medium" });

    const outcome = generateMeshOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.meshes[0]?.vertices).toEqual([]);
    expect(outcome.candidateSession.graph.meshes[0]).toMatchObject({
      meshId: "mesh_body",
      drawableId: "draw_body",
      vertices: [
        { x: 4, y: 8 },
        { x: 24, y: 8 },
        { x: 44, y: 8 },
        { x: 4, y: 18 },
        { x: 24, y: 18 },
        { x: 44, y: 18 },
        { x: 4, y: 28 },
        { x: 24, y: 28 },
        { x: 44, y: 28 }
      ],
      triangles: [
        [0, 1, 3],
        [1, 4, 3],
        [1, 2, 4],
        [2, 5, 4],
        [3, 4, 6],
        [4, 7, 6],
        [4, 5, 7],
        [5, 8, 7]
      ]
    });
    expect(outcome.result.modelDiff?.changed[0]?.target).toEqual({
      kind: "mesh",
      id: "mesh_body"
    });
    expect(() => toRuntimeGraph(outcome.candidateSession)).not.toThrow();
  });

  it("commits manual-empty while preserving runtime-safe graph conversion", () => {
    const session = createFixtureSessionWithGeneratedMesh();
    const request = createGenerateMeshRequest({ dryRun: false, method: "manual-empty" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.meshes[0]).toMatchObject({
      vertices: [],
      uvs: [],
      triangles: [],
      bounds: { x: 4, y: 8, width: 40, height: 20 },
      generationProvenanceId: "prov_generate_body_mesh"
    });
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      vertexCount: 0
    });
    expect(session.authoringRevision).toBe(1);
  });

  it("rejects missing drawable and missing mesh preconditions", () => {
    const missingDrawableSession = createFixtureSession();
    missingDrawableSession.graph.drawables = [];
    missingDrawableSession.graph.meshes = [];
    const missingDrawableRequest = createGenerateMeshRequest({ dryRun: false });

    const missingDrawable = generateMeshOperationHandler.commit(
      missingDrawableSession,
      missingDrawableRequest,
      getRequestOperationId(missingDrawableRequest)
    );

    expect(missingDrawable.result.status).toBe("rejected");
    expect(missingDrawable.result.diagnostics[0]).toMatchObject({
      checkId: "operation.generateMesh.missingDrawable",
      target: { kind: "drawable", id: "draw_body" }
    });

    const missingMeshSession = createFixtureSession();
    missingMeshSession.graph.meshes = [];
    const missingMeshRequest = createGenerateMeshRequest({ dryRun: false });

    const missingMesh = generateMeshOperationHandler.commit(
      missingMeshSession,
      missingMeshRequest,
      getRequestOperationId(missingMeshRequest)
    );

    expect(missingMesh.result.status).toBe("rejected");
    expect(missingMesh.result.diagnostics[0]).toMatchObject({
      checkId: "operation.generateMesh.missingMesh",
      target: { kind: "drawable", id: "draw_body", path: "/meshId" }
    });
  });

  it("rejects auto-outline-v1 until an outline extraction pipeline exists", () => {
    const session = createFixtureSession();
    const request = createGenerateMeshRequest({ dryRun: false, method: "auto-outline-v1" });

    const outcome = generateMeshOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.generateMesh.unsupportedMethod",
      target: { kind: "drawable", id: "draw_body", path: "/payload/method" }
    });
    expect(session.graph.meshes[0]?.vertices).toEqual([]);
    expect(session.authoringRevision).toBe(0);
  });
});

const createGenerateMeshRequest = (options: {
  readonly dryRun: boolean;
  readonly method?: "manual-empty" | "auto-grid-v1" | "auto-outline-v1";
  readonly densityHint?: "low" | "medium" | "high";
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_generate_body_mesh",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "generateMesh",
    payload: {
      drawableId: "draw_body",
      method: options.method ?? "auto-grid-v1",
      ...(options.densityHint === undefined ? {} : { densityHint: options.densityHint })
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};

const createFixtureSessionWithGeneratedMesh = (): AuthoringSession => {
  const session = createFixtureSession();
  session.graph.meshes[0] = {
    ...session.graph.meshes[0]!,
    vertices: [
      { x: 4, y: 8 },
      { x: 44, y: 8 },
      { x: 4, y: 28 },
      { x: 44, y: 28 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }
    ],
    triangles: [
      [0, 1, 2],
      [1, 3, 2]
    ],
    vertexStableIds: ["vtx_body_0_0", "vtx_body_0_1", "vtx_body_1_0", "vtx_body_1_1"]
  };
  return session;
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_generate_mesh_operation_test"),
    packageDisplayName: "Generate Mesh Operation Test",
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
        sourceProvenanceId: ProvenanceIdSchema.parse("prov_create_body")
      }
    ],
    meshes: [
      {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
        vertices: [],
        uvs: [],
        triangles: [],
        vertexStableIds: [],
        bounds: { x: 4, y: 8, width: 40, height: 20 },
        generationProvenanceId: ProvenanceIdSchema.parse("prov_create_body")
      }
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [
      {
        drawableId: DrawableIdSchema.parse("draw_body"),
        baseDrawOrder: 0,
        stableOrder: 0
      }
    ],
    rigControlRootIds: [],
    stableOrder: ["draw_body"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
