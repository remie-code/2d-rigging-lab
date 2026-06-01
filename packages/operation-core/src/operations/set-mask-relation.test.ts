import {
  createInitialAuthoringRevision,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MaskRelationIdSchema,
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
import { setMaskRelationOperationHandler } from "./set-mask-relation.js";

describe("setMaskRelation operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("setMaskRelation")).toBe(setMaskRelationOperationHandler);
  });

  it("dry-runs mask relation creation on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createSetMaskRelationRequest({
      dryRun: true,
      maskDrawableIds: ["draw_mask"],
      targetDrawableIds: ["draw_body"],
      enabled: true
    });

    const outcome = setMaskRelationOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.masks).toEqual([]);
    expect(outcome.candidateSession.graph.masks).toEqual([
      {
        maskRelationId: "maskrel_mask_mask_target_body",
        maskDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"],
        enabled: true
      }
    ]);
    expect(outcome.result.modelDiff).toMatchObject({
      operationIds: ["op_set_mask_relation"],
      added: [
        {
          kind: "maskRelation",
          id: "maskrel_mask_mask_target_body",
          path: "/model/masks/maskrel_mask_mask_target_body"
        }
      ],
      changed: [
        {
          target: {
            kind: "maskRelation",
            id: "maskrel_mask_mask_target_body",
            path: "/model/masks/maskrel_mask_mask_target_body"
          },
          fields: [
            {
              path: "/model/masks/maskrel_mask_mask_target_body",
              before: null,
              after: {
                maskRelationId: "maskrel_mask_mask_target_body",
                maskDrawableIds: ["draw_mask"],
                targetDrawableIds: ["draw_body"],
                enabled: true
              }
            }
          ]
        }
      ]
    });
    expect(toRuntimeGraph(outcome.candidateSession).masks).toEqual([
      {
        maskRelationId: "maskrel_mask_mask_target_body",
        sourceDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"]
      }
    ]);
  });

  it("commits mask relation creation through operation core and appends operation log evidence", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore({
      now: () => new Date("2026-06-01T00:00:00.000Z")
    });

    const outcome = operationCore.commitOperation(
      session,
      createSetMaskRelationRequest({
        dryRun: false,
        maskRelationId: "maskrel_body_clip",
        maskDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"],
        enabled: true
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(1);
    expect(outcome.logEntry).toMatchObject({
      operationId: "op_set_mask_relation",
      operationType: "setMaskRelation",
      targetIds: ["maskrel_body_clip", "draw_mask", "draw_body"],
      precondition: {
        ok: true,
        checkedTargetRefs: [
          {
            kind: "maskRelation",
            id: "maskrel_body_clip",
            path: "/model/masks/maskrel_body_clip"
          },
          { kind: "drawable", id: "draw_mask" },
          { kind: "drawable", id: "draw_body" }
        ]
      }
    });
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.graph.masks).toEqual([
      {
        maskRelationId: "maskrel_body_clip",
        maskDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"],
        enabled: true
      }
    ]);
  });

  it("updates an existing relation to disabled and preserves maskGroupHint", () => {
    const session = createFixtureSession();
    session.graph.masks.push({
      maskRelationId: MaskRelationIdSchema.parse("maskrel_body_clip"),
      maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
      targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
      maskGroupHint: "body-group",
      enabled: true
    });

    const request = createSetMaskRelationRequest({
      dryRun: false,
      maskRelationId: "maskrel_body_clip",
      maskDrawableIds: ["draw_mask"],
      targetDrawableIds: ["draw_body"],
      enabled: false
    });
    const outcome = setMaskRelationOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.masks[0]).toEqual({
      maskRelationId: "maskrel_body_clip",
      maskDrawableIds: ["draw_mask"],
      targetDrawableIds: ["draw_body"],
      maskGroupHint: "body-group",
      enabled: false
    });
    expect(outcome.result.modelDiff?.added).toEqual([]);
    expect(outcome.result.modelDiff?.changed[0]?.fields).toEqual([
      {
        path: "/model/masks/maskrel_body_clip/enabled",
        before: true,
        after: false
      }
    ]);
    expect(toRuntimeGraph(session).masks).toEqual([]);
  });

  it("materializes disabled relation creation when it changes the model", () => {
    const session = createFixtureSession();
    const request = createSetMaskRelationRequest({
      dryRun: false,
      maskRelationId: "maskrel_disabled_body_clip",
      maskDrawableIds: ["draw_mask"],
      targetDrawableIds: ["draw_body"],
      enabled: false
    });

    const outcome = setMaskRelationOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.masks).toEqual([
      {
        maskRelationId: "maskrel_disabled_body_clip",
        maskDrawableIds: ["draw_mask"],
        targetDrawableIds: ["draw_body"],
        enabled: false
      }
    ]);
    expect(toRuntimeGraph(session).masks).toEqual([]);
  });

  it("rejects missing, duplicate, self-mask, empty, and unchanged disabled relation diagnostics deterministically", () => {
    const session = createFixtureSession();

    const missingRequest = createSetMaskRelationRequest({
      dryRun: false,
      maskDrawableIds: ["draw_missing_mask"],
      targetDrawableIds: ["draw_missing_target"],
      enabled: true
    });
    const missing = setMaskRelationOperationHandler.commit(
      session,
      missingRequest,
      getRequestOperationId(missingRequest)
    );
    expect(missing.result.status).toBe("rejected");
    expect(missing.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.setMaskRelation.missingMaskDrawable",
      "operation.setMaskRelation.missingTargetDrawable"
    ]);

    const duplicateAndSelfRequest = createSetMaskRelationRequest({
      dryRun: false,
      maskDrawableIds: ["draw_mask", "draw_mask", "draw_body"],
      targetDrawableIds: ["draw_body", "draw_body"],
      enabled: true
    });
    const duplicateAndSelf = setMaskRelationOperationHandler.commit(
      session,
      duplicateAndSelfRequest,
      getRequestOperationId(duplicateAndSelfRequest)
    );
    expect(duplicateAndSelf.result.status).toBe("rejected");
    expect(duplicateAndSelf.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.setMaskRelation.duplicateMaskDrawable",
      "operation.setMaskRelation.duplicateTargetDrawable",
      "operation.setMaskRelation.selfMask"
    ]);

    const emptyRequest = createSetMaskRelationRequest({
      dryRun: false,
      maskDrawableIds: [],
      targetDrawableIds: ["draw_body"],
      enabled: true
    });
    const empty = setMaskRelationOperationHandler.commit(
      session,
      emptyRequest,
      getRequestOperationId(emptyRequest)
    );
    expect(empty.result.status).toBe("rejected");
    expect(empty.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setMaskRelation.emptyRelation",
      target: { kind: "maskRelation", id: "maskrel_unresolved", path: "/payload" }
    });

    session.graph.masks.push({
      maskRelationId: MaskRelationIdSchema.parse("maskrel_no_op_disabled"),
      maskDrawableIds: [DrawableIdSchema.parse("draw_mask")],
      targetDrawableIds: [DrawableIdSchema.parse("draw_body")],
      enabled: false
    });
    const noOpRequest = createSetMaskRelationRequest({
      dryRun: false,
      maskRelationId: "maskrel_no_op_disabled",
      maskDrawableIds: ["draw_mask"],
      targetDrawableIds: ["draw_body"],
      enabled: false
    });
    const noOp = setMaskRelationOperationHandler.commit(session, noOpRequest, getRequestOperationId(noOpRequest));
    expect(noOp.result.status).toBe("rejected");
    expect(noOp.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setMaskRelation.noOp",
      severity: "warning"
    });
    expect(session.authoringRevision).toBe(0);
  });
});

const createSetMaskRelationRequest = (options: {
  readonly dryRun: boolean;
  readonly maskRelationId?: string;
  readonly maskDrawableIds: readonly string[];
  readonly targetDrawableIds: readonly string[];
  readonly enabled: boolean;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_set_mask_relation",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "setMaskRelation",
    payload: {
      ...(options.maskRelationId === undefined ? {} : { maskRelationId: options.maskRelationId }),
      maskDrawableIds: options.maskDrawableIds,
      targetDrawableIds: options.targetDrawableIds,
      enabled: options.enabled
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
    packageId: PackageIdSchema.parse("pkg_set_mask_relation_operation_test"),
    packageDisplayName: "Set Mask Relation Operation Test",
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
        drawableIds: [DrawableIdSchema.parse("draw_mask"), DrawableIdSchema.parse("draw_body")]
      }
    ],
    drawables: [
      createFixtureDrawable("draw_mask", "mesh_mask", "Mask", 0),
      createFixtureDrawable("draw_body", "mesh_body", "Body", 10)
    ],
    meshes: [
      createFixtureMesh("mesh_mask", "draw_mask"),
      createFixtureMesh("mesh_body", "draw_body")
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [
      { drawableId: DrawableIdSchema.parse("draw_mask"), baseDrawOrder: 0, stableOrder: 0 },
      { drawableId: DrawableIdSchema.parse("draw_body"), baseDrawOrder: 10, stableOrder: 1 }
    ],
    rigControlRootIds: [],
    stableOrder: ["draw_mask", "draw_body"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createFixtureDrawable = (
  drawableId: string,
  meshId: string,
  displayName: string,
  baseDrawOrder: number
) => ({
  drawableId: DrawableIdSchema.parse(drawableId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse(`tex_${drawableId.replace(/^draw_/, "")}`),
  meshId: MeshIdSchema.parse(meshId),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder,
  sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});

const createFixtureMesh = (meshId: string, drawableId: string) => ({
  meshId: MeshIdSchema.parse(meshId),
  drawableId: DrawableIdSchema.parse(drawableId),
  vertices: [],
  uvs: [],
  triangles: [],
  vertexStableIds: [],
  bounds: { x: 0, y: 0, width: 16, height: 16 },
  generationProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});
