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
import { setDrawOrderOperationHandler } from "./set-draw-order.js";

describe("setDrawOrder operation handler", () => {
  it("is registered in the operation registry", () => {
    expect(getOperationHandler("setDrawOrder")).toBe(setDrawOrderOperationHandler);
  });

  it("dry-runs draw order updates on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createSetDrawOrderRequest({
      dryRun: true,
      entries: [{ drawableId: "draw_back", baseDrawOrder: 20 }]
    });

    const outcome = setDrawOrderOperationHandler.dryRun(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.drawables[0]?.baseDrawOrder).toBe(0);
    expect(outcome.candidateSession.graph.drawables[0]?.baseDrawOrder).toBe(1);
    expect(outcome.candidateSession.graph.drawOrder).toEqual([
      { drawableId: "draw_front", baseDrawOrder: 0, stableOrder: 0 },
      { drawableId: "draw_back", baseDrawOrder: 1, stableOrder: 1 }
    ]);
    expect(outcome.candidateSession.graph.parts[0]?.children).toEqual([
      { kind: "drawable", drawableId: "draw_front" },
      { kind: "drawable", drawableId: "draw_back" }
    ]);
    expect(outcome.result.modelDiff?.changed[0]).toMatchObject({
      target: { kind: "package", id: "pkg_set_draw_order_operation_test", path: "/model/drawOrder/entries" }
    });
    expect(toRuntimeGraph(outcome.candidateSession).drawOrder).toEqual([
      { drawableId: "draw_front", drawOrder: 0 },
      { drawableId: "draw_back", drawOrder: 1 }
    ]);
  });

  it("commits draw order updates through operation core", () => {
    const session = createFixtureSession();
    const operationCore = createOperationCore();

    const outcome = operationCore.commitOperation(
      session,
      createSetDrawOrderRequest({
        dryRun: false,
        entries: [{ drawableId: "draw_back", baseDrawOrder: 20 }]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(1);
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.graph.drawables[0]).toMatchObject({
      drawableId: "draw_back",
      baseDrawOrder: 1
    });
    expect(toRuntimeGraph(session).drawOrder).toEqual([
      { drawableId: "draw_front", drawOrder: 0 },
      { drawableId: "draw_back", drawOrder: 1 }
    ]);
  });

  it("rejects missing drawable and duplicate payload entries deterministically", () => {
    const session = createFixtureSession();
    const missingRequest = createSetDrawOrderRequest({
      dryRun: false,
      entries: [{ drawableId: "draw_missing", baseDrawOrder: 1 }]
    });

    const missing = setDrawOrderOperationHandler.commit(
      session,
      missingRequest,
      getRequestOperationId(missingRequest)
    );

    expect(missing.result.status).toBe("rejected");
    expect(missing.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.setDrawOrder.missingDrawable",
      "operation.setDrawOrder.missingDrawOrderEntry"
    ]);

    const duplicateRequest = createSetDrawOrderRequest({
      dryRun: false,
      entries: [
        { drawableId: "draw_back", baseDrawOrder: 1 },
        { drawableId: "draw_back", baseDrawOrder: 2 }
      ]
    });

    const duplicate = setDrawOrderOperationHandler.commit(
      session,
      duplicateRequest,
      getRequestOperationId(duplicateRequest)
    );

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setDrawOrder.duplicateEntry",
      target: { kind: "drawable", id: "draw_back", path: "/payload/entries" }
    });
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects no-op draw order updates", () => {
    const session = createFixtureSession();
    const request = createSetDrawOrderRequest({
      dryRun: false,
      entries: [{ drawableId: "draw_back", baseDrawOrder: 0 }]
    });

    const outcome = setDrawOrderOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setDrawOrder.noOp",
      severity: "warning"
    });
    expect(session.graph.drawOrder[0]).toMatchObject({ baseDrawOrder: 0, stableOrder: 0 });
    expect(session.authoringRevision).toBe(0);
  });

  it("commits when the request repairs a drawable and draw order entry mismatch", () => {
    const session = createFixtureSession();
    session.graph.drawables[0]!.baseDrawOrder = 12;
    const request = createSetDrawOrderRequest({
      dryRun: false,
      entries: [{ drawableId: "draw_back", baseDrawOrder: 0 }]
    });

    const outcome = setDrawOrderOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.drawables[0]).toMatchObject({
      drawableId: "draw_back",
      baseDrawOrder: 0
    });
    expect(session.graph.drawOrder[0]).toMatchObject({
      drawableId: "draw_back",
      baseDrawOrder: 0,
      stableOrder: 0
    });
    expect(outcome.result.modelDiff?.changed).toEqual([
      {
        target: { kind: "package", id: "pkg_set_draw_order_operation_test", path: "/model/drawOrder/entries" },
        fields: [
          {
            path: "/model/drawOrder/entries",
            before: [
              { drawableId: "draw_back", baseDrawOrder: 0, stableOrder: 0 },
              { drawableId: "draw_front", baseDrawOrder: 10, stableOrder: 1 }
            ],
            after: [
              { drawableId: "draw_back", baseDrawOrder: 0, stableOrder: 0 },
              { drawableId: "draw_front", baseDrawOrder: 1, stableOrder: 1 }
            ]
          }
        ]
      },
      {
        target: { kind: "drawable", id: "draw_back" },
        fields: [
          {
            path: "/model/drawables/draw_back/baseDrawOrder",
            before: 12,
            after: 0
          }
        ]
      },
      {
        target: { kind: "drawable", id: "draw_front" },
        fields: [
          {
            path: "/model/drawables/draw_front/baseDrawOrder",
            before: 10,
            after: 1
          }
        ]
      }
    ]);
    expect(session.authoringRevision).toBe(1);
  });

  it("rejects draw-order payloads that cross Part Container block boundaries", () => {
    const session = createMixedContainerFixtureSession();
    const request = createSetDrawOrderRequest({
      dryRun: false,
      entries: [
        { drawableId: "draw_back", baseDrawOrder: 0 },
        { drawableId: "draw_front", baseDrawOrder: 1 },
        { drawableId: "draw_eye", baseDrawOrder: 2 }
      ]
    });

    const outcome = setDrawOrderOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.setDrawOrder.structureConflict"
    });
    expect(session.graph.drawOrder.map((entry) => [entry.drawableId, entry.baseDrawOrder])).toEqual([
      ["draw_front", 0],
      ["draw_eye", 1],
      ["draw_back", 2]
    ]);
    expect(session.authoringRevision).toBe(0);
  });
});

const createSetDrawOrderRequest = (options: {
  readonly dryRun: boolean;
  readonly entries: readonly { readonly drawableId: string; readonly baseDrawOrder: number }[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_set_draw_order",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "setDrawOrder",
    payload: {
      entries: options.entries
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
    packageId: PackageIdSchema.parse("pkg_set_draw_order_operation_test"),
    packageDisplayName: "Set Draw Order Operation Test",
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
        drawableIds: [DrawableIdSchema.parse("draw_back"), DrawableIdSchema.parse("draw_front")]
      }
    ],
    drawables: [
      createFixtureDrawable("draw_back", "mesh_back", "Back", 0),
      createFixtureDrawable("draw_front", "mesh_front", "Front", 10)
    ],
    meshes: [
      createFixtureMesh("mesh_back", "draw_back"),
      createFixtureMesh("mesh_front", "draw_front")
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [
      { drawableId: DrawableIdSchema.parse("draw_back"), baseDrawOrder: 0, stableOrder: 0 },
      { drawableId: DrawableIdSchema.parse("draw_front"), baseDrawOrder: 10, stableOrder: 1 }
    ],
    rigControlRootIds: [],
    stableOrder: ["draw_back", "draw_front"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createMixedContainerFixtureSession = (): AuthoringSession => ({
  ...createFixtureSession(),
  graph: {
    ...createFixtureSession().graph,
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [PartIdSchema.parse("part_eye")],
        drawableIds: [
          DrawableIdSchema.parse("draw_front"),
          DrawableIdSchema.parse("draw_back")
        ],
        children: [
          { kind: "drawable", drawableId: DrawableIdSchema.parse("draw_front") },
          { kind: "part", partId: PartIdSchema.parse("part_eye") },
          { kind: "drawable", drawableId: DrawableIdSchema.parse("draw_back") }
        ]
      },
      {
        partId: PartIdSchema.parse("part_eye"),
        displayName: "Eye",
        parentPartId: PartIdSchema.parse("part_root"),
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_eye")],
        children: [{ kind: "drawable", drawableId: DrawableIdSchema.parse("draw_eye") }]
      }
    ],
    drawables: [
      createFixtureDrawable("draw_front", "mesh_front", "Front", 0),
      createFixtureDrawable("draw_eye", "mesh_eye", "Eye", 1, "part_eye"),
      createFixtureDrawable("draw_back", "mesh_back", "Back", 2)
    ],
    meshes: [
      createFixtureMesh("mesh_front", "draw_front"),
      createFixtureMesh("mesh_eye", "draw_eye"),
      createFixtureMesh("mesh_back", "draw_back")
    ],
    drawOrder: [
      { drawableId: DrawableIdSchema.parse("draw_front"), baseDrawOrder: 0, stableOrder: 0 },
      { drawableId: DrawableIdSchema.parse("draw_eye"), baseDrawOrder: 1, stableOrder: 1 },
      { drawableId: DrawableIdSchema.parse("draw_back"), baseDrawOrder: 2, stableOrder: 2 }
    ],
    stableOrder: [
      PartIdSchema.parse("part_root"),
      PartIdSchema.parse("part_eye"),
      DrawableIdSchema.parse("draw_front"),
      DrawableIdSchema.parse("draw_eye"),
      DrawableIdSchema.parse("draw_back")
    ]
  }
});

const createFixtureDrawable = (
  drawableId: string,
  meshId: string,
  displayName: string,
  baseDrawOrder: number,
  partId = "part_root"
) => ({
  drawableId: DrawableIdSchema.parse(drawableId),
  displayName,
  partId: PartIdSchema.parse(partId),
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
