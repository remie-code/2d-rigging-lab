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

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { updateDrawableOperationHandler } from "./update-drawable.js";

describe("updateDrawable operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("updateDrawable")).toBe(updateDrawableOperationHandler);
  });

  it("dry-runs drawable name and opacity updates on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createUpdateDrawableRequest({
      dryRun: true,
      drawableId: "draw_body",
      displayName: "Body Paint",
      defaultOpacity: 0.5
    });

    const outcome = updateDrawableOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.drawables[0]).toMatchObject({
      displayName: "Body",
      defaultOpacity: 1
    });
    expect(outcome.candidateSession.graph.drawables[0]).toMatchObject({
      displayName: "Body Paint",
      defaultOpacity: 0.5
    });
    expect(outcome.result.modelDiff?.changed[0]).toMatchObject({
      target: { kind: "drawable", id: "draw_body" },
      fields: [
        {
          path: "/model/drawables/draw_body/displayName",
          before: "Body",
          after: "Body Paint"
        },
        {
          path: "/model/drawables/draw_body/defaultOpacity",
          before: 1,
          after: 0.5
        }
      ]
    });
  });

  it("commits drawable opacity through operation core and updates runtime graph opacity", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore();

    const outcome = operationCore.commitOperation(
      session,
      createUpdateDrawableRequest({
        dryRun: false,
        drawableId: "draw_body",
        defaultOpacity: 0.4
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(1);
    expect(outcome.logEntry?.operationType).toBe("updateDrawable");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.graph.drawables[0]).toMatchObject({ defaultOpacity: 0.4 });
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      opacity: 0.4
    });
    expect(outcome.result.runtimeDiff?.drawableRuntimeStateChanges).toEqual([
      {
        drawableId: "draw_body",
        opacityBefore: 1,
        opacityAfter: 0.4,
        visibleBefore: true,
        visibleAfter: true,
        baseDrawOrderBefore: 0,
        baseDrawOrderAfter: 0,
        evaluatedDrawOrderBefore: 0,
        evaluatedDrawOrderAfter: 0
      }
    ]);
    expect(outcome.result.runtimeDiff?.drawListChanges).toEqual([]);
    expect(outcome.result.generatedRuntimeSnapshotIds).toEqual([
      "snap_op_update_drawable_before_runtime",
      "snap_op_update_drawable_committed_runtime"
    ]);
  });

  it("rejects missing, locked, and no-op updates deterministically", () => {
    const session = createFixtureSession();
    const missingRequest = createUpdateDrawableRequest({
      dryRun: false,
      drawableId: "draw_missing",
      displayName: "Missing"
    });
    const missing = updateDrawableOperationHandler.commit(
      session,
      missingRequest,
      getRequestOperationId(missingRequest)
    );
    expect(missing.result.status).toBe("rejected");
    expect(missing.result.diagnostics[0]).toMatchObject({
      checkId: "operation.updateDrawable.missingDrawable",
      target: { kind: "drawable", id: "draw_missing" }
    });

    const lockedRequest = createUpdateDrawableRequest({
      dryRun: false,
      drawableId: "draw_body",
      displayName: "Locked Body",
      lockedTargetIds: ["draw_body"]
    });
    const locked = updateDrawableOperationHandler.commit(
      session,
      lockedRequest,
      getRequestOperationId(lockedRequest)
    );
    expect(locked.result.status).toBe("rejected");
    expect(locked.result.diagnostics[0]).toMatchObject({
      checkId: "operation.updateDrawable.lockedTarget",
      target: { kind: "drawable", id: "draw_body" }
    });

    expect(() =>
      createUpdateDrawableRequest({
        dryRun: false,
        drawableId: "draw_body",
        displayName: "   "
      })
    ).toThrow("displayName must not be blank");

    const noOpRequest = createUpdateDrawableRequest({
      dryRun: false,
      drawableId: "draw_body",
      displayName: "Body",
      defaultOpacity: 1
    });
    const noOp = updateDrawableOperationHandler.commit(
      session,
      noOpRequest,
      getRequestOperationId(noOpRequest)
    );
    expect(noOp.result.status).toBe("rejected");
    expect(noOp.result.diagnostics[0]).toMatchObject({
      checkId: "operation.updateDrawable.noOp",
      severity: "warning"
    });
    expect(session.authoringRevision).toBe(0);
  });
});

const createUpdateDrawableRequest = (options: {
  readonly dryRun: boolean;
  readonly drawableId: string;
  readonly displayName?: string;
  readonly defaultOpacity?: number;
  readonly lockedTargetIds?: readonly string[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_update_drawable",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "updateDrawable",
    payload: {
      drawableId: options.drawableId,
      ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
      ...(options.defaultOpacity === undefined ? {} : { defaultOpacity: options.defaultOpacity }),
      ...(options.lockedTargetIds === undefined
        ? {}
        : { lockedTargetIds: options.lockedTargetIds })
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
    packageId: PackageIdSchema.parse("pkg_update_drawable_operation_test"),
    packageDisplayName: "Update Drawable Operation Test",
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
    stableOrder: ["part_root", "draw_body"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
