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
import type { OperationId, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { setRuntimeVisibilityOperationHandler } from "./set-runtime-visibility.js";

describe("setRuntimeVisibility operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("setRuntimeVisibility")).toBe(setRuntimeVisibilityOperationHandler);
  });

  it("dry-runs runtime visibility updates on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createSetRuntimeVisibilityRequest({
      dryRun: true,
      target: { kind: "drawable", id: "draw_body" },
      runtimeVisibility: false
    });

    const outcome = setRuntimeVisibilityOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.drawables[0]?.runtimeVisibility).toBe(true);
    expect(outcome.candidateSession.graph.drawables[0]?.runtimeVisibility).toBe(false);
    expect(outcome.result.modelDiff?.changed[0]).toMatchObject({
      target: { kind: "drawable", id: "draw_body" },
      fields: [
        {
          path: "/model/drawables/draw_body/runtimeVisibility",
          before: true,
          after: false
        }
      ]
    });
    expect(toRuntimeGraph(outcome.candidateSession).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      visible: false
    });
  });

  it("commits runtime visibility updates through operation core", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore();

    const outcome = operationCore.commitOperation(
      session,
      createSetRuntimeVisibilityRequest({
        dryRun: false,
        target: { kind: "drawable", id: "draw_body" },
        runtimeVisibility: false
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(1);
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.graph.drawables[0]?.runtimeVisibility).toBe(false);
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      visible: false
    });
  });

  it("rejects invalid target kind and missing drawable preconditions", () => {
    const session = createFixtureSession();
    const invalidTargetRequest = createSetRuntimeVisibilityRequest({
      dryRun: false,
      target: { kind: "mesh", id: "mesh_body" },
      runtimeVisibility: false
    });

    const invalidTarget = setRuntimeVisibilityOperationHandler.commit(
      session,
      invalidTargetRequest,
      getRequestOperationId(invalidTargetRequest)
    );

    expect(invalidTarget.result.status).toBe("rejected");
    expect(invalidTarget.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setRuntimeVisibility.invalidTargetKind",
      target: { kind: "mesh", id: "mesh_body" }
    });

    const missingRequest = createSetRuntimeVisibilityRequest({
      dryRun: false,
      target: { kind: "drawable", id: "draw_missing" },
      runtimeVisibility: false
    });
    const missing = setRuntimeVisibilityOperationHandler.commit(
      session,
      missingRequest,
      getRequestOperationId(missingRequest)
    );

    expect(missing.result.status).toBe("rejected");
    expect(missing.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setRuntimeVisibility.missingDrawable",
      target: { kind: "drawable", id: "draw_missing" }
    });
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects no-op runtime visibility updates", () => {
    const session = createFixtureSession();
    const request = createSetRuntimeVisibilityRequest({
      dryRun: false,
      target: { kind: "drawable", id: "draw_body" },
      runtimeVisibility: true
    });

    const outcome = setRuntimeVisibilityOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setRuntimeVisibility.noOp",
      severity: "warning"
    });
    expect(session.graph.drawables[0]?.runtimeVisibility).toBe(true);
    expect(session.authoringRevision).toBe(0);
  });
});

const createSetRuntimeVisibilityRequest = (options: {
  readonly dryRun: boolean;
  readonly target: TargetRefDto;
  readonly runtimeVisibility: boolean;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_set_runtime_visibility",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "setRuntimeVisibility",
    payload: {
      target: options.target,
      runtimeVisibility: options.runtimeVisibility
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
    packageId: PackageIdSchema.parse("pkg_set_runtime_visibility_operation_test"),
    packageDisplayName: "Set Runtime Visibility Operation Test",
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
        vertices: [],
        uvs: [],
        triangles: [],
        vertexStableIds: [],
        bounds: { x: 0, y: 0, width: 16, height: 16 },
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
