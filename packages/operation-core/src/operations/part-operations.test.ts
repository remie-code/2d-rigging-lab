import {
  createInitialAuthoringRevision,
  getPartById,
  toPackageDocument
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { createPartOperationHandler } from "./create-part.js";
import { deletePartOperationHandler } from "./delete-part.js";
import { updatePartOperationHandler } from "./update-part.js";

describe("part operation handlers", () => {
  it("registers createPart, updatePart, and deletePart", () => {
    expect(getOperationHandler("createPart")).toBe(createPartOperationHandler);
    expect(getOperationHandler("updatePart")).toBe(updatePartOperationHandler);
    expect(getOperationHandler("deletePart")).toBe(deletePartOperationHandler);
  });

  it("dry-runs part creation on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createCreatePartRequest({
      dryRun: true,
      partId: "part_face",
      displayName: "Face",
      parentPartId: "part_head"
    });

    const outcome = createPartOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toBeUndefined();
    expect(getPartById(outcome.candidateSession.graph, PartIdSchema.parse("part_face"))).toMatchObject({
      displayName: "Face",
      parentPartId: "part_head"
    });
    expect(outcome.result.modelDiff?.added).toEqual([{ kind: "part", id: "part_face" }]);
    expect(outcome.result.precondition.checkedTargetRefs).toEqual([
      { kind: "part", id: "part_face" },
      { kind: "part", id: "part_head" }
    ]);
  });

  it("dry-runs empty leaf part deletion on a cloned candidate session", () => {
    const session = createSessionWithEmptyLeafPart();
    const request = createDeletePartRequest({
      dryRun: true,
      partId: "part_empty"
    });

    const outcome = deletePartOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getPartById(session.graph, PartIdSchema.parse("part_empty"))).toMatchObject({
      displayName: "Empty"
    });
    expect(getPartById(outcome.candidateSession.graph, PartIdSchema.parse("part_empty"))).toBeUndefined();
    expect(session.graph.parts[0]?.childPartIds).toEqual(["part_head", "part_empty"]);
    expect(outcome.candidateSession.graph.parts[0]?.childPartIds).toEqual(["part_head"]);
    expect(outcome.result.modelDiff?.removed).toEqual([{ kind: "part", id: "part_empty" }]);
    expect(outcome.result.precondition.checkedTargetRefs).toEqual([
      { kind: "part", id: "part_empty" },
      { kind: "part", id: "part_root" }
    ]);
  });

  it("dry-runs part rename and reparent without mutating the original session", () => {
    const session = createPartReparentFixtureSession();
    const request = createUpdatePartRequest({
      dryRun: true,
      partId: "part_face",
      displayName: "Face Controls",
      parentPartId: "part_head"
    });

    const outcome = updatePartOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toMatchObject({
      displayName: "Face",
      parentPartId: "part_root"
    });
    expect(getPartById(outcome.candidateSession.graph, PartIdSchema.parse("part_face"))).toMatchObject({
      displayName: "Face Controls",
      parentPartId: "part_head"
    });
    expect(session.graph.parts[0]?.childPartIds).toEqual(["part_head", "part_face"]);
    expect(outcome.candidateSession.graph.parts[0]?.childPartIds).toEqual(["part_head"]);
    expect(outcome.candidateSession.graph.parts[1]?.childPartIds).toEqual(["part_face"]);
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual([
      { kind: "part", id: "part_face" },
      { kind: "part", id: "part_root" },
      { kind: "part", id: "part_head" }
    ]);
  });

  it("commits part update and materializes the package graph", () => {
    const session = createPartReparentFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-01T00:00:00.000Z")
    });
    const baseDocument = createBaseDocument(session);

    const outcome = core.commitOperation(
      session,
      createUpdatePartRequest({
        dryRun: false,
        partId: "part_face",
        displayName: "Face Controls",
        parentPartId: "part_head"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(outcome.logEntry?.operationType).toBe("updatePart");
    expect(outcome.logEntry?.targetIds).toEqual(["part_face", "part_root", "part_head"]);
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual([
      { kind: "part", id: "part_face" },
      { kind: "part", id: "part_root" },
      { kind: "part", id: "part_head" }
    ]);

    const materialized = toPackageDocument(session, baseDocument);
    expect(materialized.manifest.packageRevision).toBe(1);
    expect(materialized.model.graph.parts.find((part) => part.partId === "part_face")).toMatchObject({
      displayName: "Face Controls",
      parentPartId: "part_head"
    });
    expect(materialized.model.graph.parts.find((part) => part.partId === "part_head")?.childPartIds).toEqual([
      "part_face"
    ]);
  });

  it("commits empty leaf part deletion with operation log, model diff, and package materialization", () => {
    const session = createSessionWithEmptyLeafPart();
    const core = createOperationCore({
      now: () => new Date("2026-06-01T00:00:00.000Z")
    });
    const baseDocument = createBaseDocument(session);

    const outcome = core.commitOperation(
      session,
      createDeletePartRequest({
        dryRun: false,
        partId: "part_empty"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(outcome.operationLogLength).toBe(1);
    expect(outcome.logEntry?.operationType).toBe("deletePart");
    expect(outcome.logEntry?.targetIds).toEqual(["part_empty", "part_root"]);
    expect(outcome.logEntry?.precondition.checkedTargetRefs).toEqual([
      { kind: "part", id: "part_empty" },
      { kind: "part", id: "part_root" }
    ]);
    expect(outcome.result.modelDiff?.removed).toEqual([{ kind: "part", id: "part_empty" }]);
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual([
      { kind: "package", id: "pkg_part_operation_test" },
      { kind: "part", id: "part_empty" },
      { kind: "part", id: "part_root" }
    ]);
    expect(outcome.result.modelDiff?.changed.flatMap((change) => change.fields.map((field) => field.path))).toEqual([
      "/model/graph/parts",
      "/model/graph/stableOrder",
      "/model/graph/parts/part_empty",
      "/model/graph/parts/part_root/childPartIds"
    ]);

    const materialized = toPackageDocument(session, baseDocument);
    expect(materialized.manifest.packageRevision).toBe(1);
    expect(materialized.model.graph.parts.find((part) => part.partId === "part_empty")).toBeUndefined();
    expect(materialized.model.graph.parts.find((part) => part.partId === "part_root")?.childPartIds).toEqual([
      "part_head"
    ]);
    expect(materialized.model.graph.stableOrder).toEqual(["part_root", "part_head", "draw_eye"]);
  });

  it("rejects invalid part targets deterministically", () => {
    const session = createFixtureSession();
    const missingParentRequest = createCreatePartRequest({
      dryRun: false,
      partId: "part_face",
      displayName: "Face",
      parentPartId: "part_missing"
    });

    const missingParent = createPartOperationHandler.commit(
      session,
      missingParentRequest,
      getRequestOperationId(missingParentRequest)
    );
    expect(missingParent.result.status).toBe("rejected");
    expect(missingParent.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.createPart.missingParentPart"
    ]);

    session.graph.parts[1]!.childPartIds = [PartIdSchema.parse("part_eye")];
    session.graph.parts.push({
      partId: PartIdSchema.parse("part_eye"),
      displayName: "Eye",
      parentPartId: PartIdSchema.parse("part_head"),
      childPartIds: [],
      drawableIds: []
    });
    const cycleRequest = createUpdatePartRequest({
      dryRun: false,
      partId: "part_head",
      parentPartId: "part_eye"
    });
    const cycle = updatePartOperationHandler.commit(session, cycleRequest, getRequestOperationId(cycleRequest));
    expect(cycle.result.diagnostics[0]).toMatchObject({
      checkId: "operation.updatePart.partCycle",
      target: { kind: "part", id: "part_eye" }
    });

    session.graph.parts[1]!.childPartIds = [
      PartIdSchema.parse("part_eye"),
      PartIdSchema.parse("part_eye")
    ];
    const duplicateChildRequest = createUpdatePartRequest({
      dryRun: false,
      partId: "part_eye",
      displayName: "Eye Controls"
    });
    const duplicateChild = updatePartOperationHandler.commit(
      session,
      duplicateChildRequest,
      getRequestOperationId(duplicateChildRequest)
    );
    expect(duplicateChild.result.diagnostics[0]?.checkId).toBe("operation.updatePart.duplicateChildPart");

    const lockedRequest = createUpdatePartRequest({
      dryRun: false,
      partId: "part_eye",
      displayName: "Locked Eye",
      lockedTargetIds: ["part_eye"]
    });
    const locked = updatePartOperationHandler.commit(session, lockedRequest, getRequestOperationId(lockedRequest));
    expect(locked.result.diagnostics[0]).toMatchObject({
      checkId: "operation.updatePart.lockedTarget",
      target: { kind: "part", id: "part_eye" }
    });
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects non-empty delete targets deterministically", () => {
    const childSession = createFixtureSession();
    const childRequest = createDeletePartRequest({
      dryRun: false,
      partId: "part_root"
    });
    const childRejected = deletePartOperationHandler.commit(
      childSession,
      childRequest,
      getRequestOperationId(childRequest)
    );
    expect(childRejected.result.status).toBe("rejected");
    expect(childRejected.result.diagnostics[0]).toMatchObject({
      checkId: "operation.deletePart.partHasChildParts",
      target: { kind: "part", id: "part_root", path: "/model/graph/parts/part_root/childPartIds" }
    });

    const drawableSession = createFixtureSession();
    const drawableRequest = createDeletePartRequest({
      dryRun: false,
      partId: "part_head"
    });
    const drawableRejected = deletePartOperationHandler.commit(
      drawableSession,
      drawableRequest,
      getRequestOperationId(drawableRequest)
    );
    expect(drawableRejected.result.status).toBe("rejected");
    expect(drawableRejected.result.diagnostics[0]).toMatchObject({
      checkId: "operation.deletePart.partHasDrawables",
      target: { kind: "part", id: "part_head", path: "/model/graph/parts/part_head/drawableIds" }
    });

    const rigSession = createSessionWithEmptyLeafPart({
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RigControlIdSchema.parse("rig_empty_rotation"),
          displayName: "Empty Rotation",
          partId: PartIdSchema.parse("part_empty"),
          childDrawableIds: [],
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    });
    const rigRequest = createDeletePartRequest({
      dryRun: false,
      partId: "part_empty"
    });
    const rigAccepted = deletePartOperationHandler.commit(
      rigSession,
      rigRequest,
      getRequestOperationId(rigRequest)
    );
    expect(rigAccepted.result.status).toBe("committed");
    expect(rigSession.graph.parts.find((part) => part.partId === "part_empty")).toBeUndefined();
    expect(rigSession.graph.rigControls).toHaveLength(1);
    expect(rigSession.graph.rigControls[0]).toHaveProperty("partId", "part_empty");
    expect(childSession.authoringRevision).toBe(0);
    expect(drawableSession.authoringRevision).toBe(0);
    expect(rigSession.authoringRevision).toBe(1);
  });
});

const createCreatePartRequest = (options: {
  readonly dryRun: boolean;
  readonly partId: string;
  readonly displayName: string;
  readonly parentPartId?: string;
  readonly lockedTargetIds?: readonly string[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_create_part",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "createPart",
    payload: {
      partId: options.partId,
      displayName: options.displayName,
      ...(options.parentPartId === undefined ? {} : { parentPartId: options.parentPartId }),
      ...(options.lockedTargetIds === undefined ? {} : { lockedTargetIds: options.lockedTargetIds })
    }
  });

const createUpdatePartRequest = (options: {
  readonly dryRun: boolean;
  readonly partId: string;
  readonly displayName?: string;
  readonly parentPartId?: string | null;
  readonly lockedTargetIds?: readonly string[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_update_part",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "updatePart",
    payload: {
      partId: options.partId,
      ...(options.displayName === undefined ? {} : { displayName: options.displayName }),
      ...(Object.prototype.hasOwnProperty.call(options, "parentPartId")
        ? { parentPartId: options.parentPartId }
        : {}),
      ...(options.lockedTargetIds === undefined ? {} : { lockedTargetIds: options.lockedTargetIds })
    }
  });

const createDeletePartRequest = (options: {
  readonly dryRun: boolean;
  readonly partId: string;
  readonly lockedTargetIds?: readonly string[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_delete_part",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "deletePart",
    payload: {
      partId: options.partId,
      ...(options.lockedTargetIds === undefined ? {} : { lockedTargetIds: options.lockedTargetIds })
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};

const createFixtureSession = (options: {
  readonly parts?: AuthoringSession["graph"]["parts"];
  readonly rigControls?: AuthoringSession["graph"]["rigControls"];
  readonly stableOrder?: AuthoringSession["graph"]["stableOrder"];
} = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_part_operation_test"),
    packageDisplayName: "Part Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts:
      options.parts ?? [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [PartIdSchema.parse("part_head")],
          drawableIds: []
        },
        {
          partId: PartIdSchema.parse("part_head"),
          displayName: "Head",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: [DrawableIdSchema.parse("draw_eye")]
        }
      ],
    drawables: [createFixtureDrawable()],
    meshes: [createFixtureMesh()],
    parameters: [],
    keyformSets: [],
    rigControls: options.rigControls ?? [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [{ drawableId: DrawableIdSchema.parse("draw_eye"), baseDrawOrder: 0, stableOrder: 0 }],
    rigControlRootIds: [],
    stableOrder: options.stableOrder ?? ["part_root", "part_head", "draw_eye"],
    sourceAssets: [],
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: [{ textureId: TextureIdSchema.parse("tex_eye"), filePath: "assets/textures/eye.png" }]
    },
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createSessionWithEmptyLeafPart = (options: {
  readonly rigControls?: AuthoringSession["graph"]["rigControls"];
} = {}): AuthoringSession =>
  createFixtureSession({
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [PartIdSchema.parse("part_head"), PartIdSchema.parse("part_empty")],
        drawableIds: []
      },
      {
        partId: PartIdSchema.parse("part_head"),
        displayName: "Head",
        parentPartId: PartIdSchema.parse("part_root"),
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_eye")]
      },
      {
        partId: PartIdSchema.parse("part_empty"),
        displayName: "Empty",
        parentPartId: PartIdSchema.parse("part_root"),
        childPartIds: [],
        drawableIds: []
      }
    ],
    stableOrder: ["part_root", "part_head", "part_empty", "draw_eye"],
    ...(options.rigControls === undefined ? {} : { rigControls: options.rigControls })
  });

const createPartReparentFixtureSession = (): AuthoringSession =>
  createFixtureSession({
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [PartIdSchema.parse("part_head"), PartIdSchema.parse("part_face")],
        drawableIds: []
      },
      {
        partId: PartIdSchema.parse("part_head"),
        displayName: "Head",
        parentPartId: PartIdSchema.parse("part_root"),
        childPartIds: [],
        drawableIds: []
      },
      {
        partId: PartIdSchema.parse("part_face"),
        displayName: "Face",
        parentPartId: PartIdSchema.parse("part_root"),
        childPartIds: [],
        drawableIds: []
      }
    ]
  });

const createFixtureDrawable = () => ({
  drawableId: DrawableIdSchema.parse("draw_eye"),
  displayName: "Eye",
  partId: PartIdSchema.parse("part_head"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse("tex_eye"),
  meshId: MeshIdSchema.parse("mesh_eye"),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: 0,
  sourceProvenanceId: ProvenanceIdSchema.parse("prov_eye")
});

const createFixtureMesh = () => ({
  meshId: MeshIdSchema.parse("mesh_eye"),
  drawableId: DrawableIdSchema.parse("draw_eye"),
  vertices: [],
  uvs: [],
  triangles: [],
  vertexStableIds: [],
  bounds: { x: 0, y: 0, width: 16, height: 16 },
  generationProvenanceId: ProvenanceIdSchema.parse("prov_eye")
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
      ...(session.graph.textureAtlas === undefined ? {} : { textureAtlas: session.graph.textureAtlas }),
      provenance: { schemaVersion: "provenance-file-v1", records: session.graph.provenanceRecords },
      rights: { schemaVersion: "rights-file-v1", records: session.graph.rightsRecords }
    }
  }) as Parameters<typeof toPackageDocument>[1];
