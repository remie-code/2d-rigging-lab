import {
  createInitialAuthoringRevision,
  getDrawableById,
  getMeshById,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { createDrawableOperationHandler } from "./create-drawable.js";

describe("createDrawable operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("createDrawable")).toBe(createDrawableOperationHandler);
  });

  it("dry-runs createDrawable on a cloned runtime-safe candidate session", () => {
    const session = createFixtureSession();
    const request = createCreateDrawableRequest({ dryRun: true });

    const outcome = createDrawableOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_body"))).toBeUndefined();
    expect(getDrawableById(outcome.candidateSession.graph, DrawableIdSchema.parse("draw_body"))).toMatchObject({
      drawableId: "draw_body",
      meshId: "mesh_body",
      textureId: "tex_body",
      baseDrawOrder: 0
    });
    expect(getMeshById(outcome.candidateSession.graph, MeshIdSchema.parse("mesh_body"))).toMatchObject({
      vertices: [],
      triangles: [],
      bounds: { x: 4, y: 8, width: 40, height: 20 }
    });
    expect(() => toRuntimeGraph(outcome.candidateSession)).not.toThrow();
    expect(outcome.result.modelDiff?.added).toEqual([
      { kind: "drawable", id: "draw_body" },
      { kind: "mesh", id: "mesh_body" }
    ]);
    expect(session.authoringRevision).toBe(0);
  });

  it("commits createDrawable through operation core and keeps graph conversion runtime-safe", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore();

    const outcome = operationCore.commitOperation(
      session,
      createCreateDrawableRequest({ dryRun: false })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(1);
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.graph.parts[0]?.drawableIds).toEqual(["draw_body"]);
    expect(session.graph.sourceAssets[0]?.layers[0]?.mappedDrawableIds).toEqual(["draw_body"]);
    expect(session.graph.drawOrder).toEqual([
      {
        drawableId: "draw_body",
        baseDrawOrder: 0,
        stableOrder: 0
      }
    ]);
    expect(session.graph.stableOrder).toEqual(["draw_body"]);
    expect(toRuntimeGraph(session).drawables.get(DrawableIdSchema.parse("draw_body"))).toMatchObject({
      meshId: "mesh_body",
      vertexCount: 0
    });
  });

  it("preserves an explicit texture ID on createDrawable", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore();

    const outcome = operationCore.commitOperation(
      session,
      createCreateDrawableRequest({
        dryRun: false,
        textureId: "tex_imported_body"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_body"))).toMatchObject({
      drawableId: "draw_body",
      textureId: "tex_imported_body",
      partId: "part_root",
      sourceAssetId: "src_generated"
    });
    expect(outcome.logEntry?.payload).toMatchObject({
      operationType: "createDrawable",
      payload: {
        textureId: "tex_imported_body",
        partId: "part_root"
      }
    });
  });

  it("rejects duplicate drawable ids without a second mutation", () => {
    const session = createFixtureSession();
    const request = createCreateDrawableRequest({ dryRun: false });
    createDrawableOperationHandler.commit(session, request, getRequestOperationId(request));
    const revisionAfterFirstCommit = session.authoringRevision;

    const duplicate = createDrawableOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.createDrawable.duplicateDrawable",
        "operation.createDrawable.duplicateMesh"
      ])
    );
    expect(session.graph.drawables).toHaveLength(1);
    expect(session.authoringRevision).toBe(revisionAfterFirstCommit);
  });

  it("rejects missing part, source asset, and source layer as precondition diagnostics", () => {
    const session = createFixtureSession();
    const request = createCreateDrawableRequest({
      dryRun: false,
      partId: "part_missing",
      sourceAssetId: "src_missing",
      sourceLayerId: "layer_missing"
    });

    const outcome = createDrawableOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          checkId: "operation.createDrawable.missingPart",
          target: { kind: "part", id: "part_missing" }
        }),
        expect.objectContaining({
          checkId: "operation.createDrawable.missingSourceAsset",
          target: { kind: "sourceAsset", id: "src_missing" }
        })
      ])
    );
    expect(session.graph.drawables).toHaveLength(0);
  });

  it("rejects a missing layer when the source asset exists", () => {
    const session = createFixtureSession();
    const request = createCreateDrawableRequest({
      dryRun: false,
      sourceLayerId: "layer_missing"
    });

    const outcome = createDrawableOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.createDrawable.missingSourceLayer",
      target: {
        kind: "sourceAsset",
        id: "src_generated",
        path: "/layers/layer_missing"
      }
    });
    expect(session.authoringRevision).toBe(0);
  });
});

const createCreateDrawableRequest = (options: {
  readonly dryRun: boolean;
  readonly partId?: string;
  readonly sourceAssetId?: string;
  readonly sourceLayerId?: string;
  readonly textureId?: string;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_create_drawable_body",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "createDrawable",
    payload: {
      sourceAssetId: options.sourceAssetId ?? "src_generated",
      sourceLayerId: options.sourceLayerId ?? "layer_body",
      ...(options.textureId === undefined ? {} : { textureId: options.textureId }),
      partId: options.partId ?? "part_root",
      displayName: "Body"
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
    packageId: PackageIdSchema.parse("pkg_create_drawable_operation_test"),
    packageDisplayName: "Create Drawable Operation Test",
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
        drawableIds: []
      }
    ],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [
      {
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        kind: "generated-fixture-v1",
        filePath: "assets/sources/generated/body.json",
        contentHash: "sha256:body",
        importProfile: "split-png-fallback-v1",
        layers: [
          {
            sourceLayerId: "layer_body",
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            originalName: "Body",
            normalizedName: "body",
            groupPath: ["Root"],
            bounds: { x: 4, y: 8, width: 40, height: 20 },
            visibleInSource: true,
            opacityInSource: 1,
            role: "editableLayer",
            unsupportedFeatures: [],
            mappedDrawableIds: []
          }
        ],
        diagnostics: []
      }
    ],
    provenanceRecords: [],
    rightsRecords: []
  }
});
