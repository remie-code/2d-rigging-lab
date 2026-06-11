import { createInitialAuthoringRevision } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
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
import { moveStructureChildOperationHandler } from "./move-structure-child.js";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const PART_EYE = PartIdSchema.parse("part_eye");
const PART_MOUTH = PartIdSchema.parse("part_mouth");
const DRAW_FRONT = DrawableIdSchema.parse("draw_front");
const DRAW_BACK = DrawableIdSchema.parse("draw_back");
const DRAW_EYE = DrawableIdSchema.parse("draw_eye");
const DRAW_MOUTH = DrawableIdSchema.parse("draw_mouth");

describe("moveStructureChild operation handler", () => {
  it("registers the mixed structure move operation", () => {
    expect(getOperationHandler("moveStructureChild")).toBe(moveStructureChildOperationHandler);
  });

  it("commits drawable before part container moves and reports structure/draw order diffs", () => {
    const session = createFixtureSession();
    const request = createMoveStructureChildRequest({
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "before", target: { kind: "part", partId: PART_EYE } }
    });

    const outcome = moveStructureChildOperationHandler.commit(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.parts.find((part) => part.partId === PART_FACE)?.children).toEqual([
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_EYE },
      { kind: "part", partId: PART_MOUTH }
    ]);
    expect(session.graph.drawOrder.map((entry) => [entry.drawableId, entry.baseDrawOrder])).toEqual([
      [DRAW_FRONT, 0],
      [DRAW_BACK, 1],
      [DRAW_EYE, 2],
      [DRAW_MOUTH, 3]
    ]);
    expect(outcome.result.precondition.checkedTargetRefs).toEqual([
      { kind: "drawable", id: DRAW_BACK },
      { kind: "part", id: PART_EYE },
      { kind: "part", id: PART_FACE }
    ]);
    expect(outcome.result.modelDiff?.changed.map((change) => change.target)).toEqual([
      { kind: "drawable", id: DRAW_BACK },
      { kind: "part", id: PART_FACE },
      { kind: "package", id: "pkg_move_structure_child_fixture" }
    ]);
    expect(outcome.result.modelDiff?.changed[1]?.fields.map((field) => field.path)).toEqual([
      `/model/graph/parts/${PART_FACE}/children`
    ]);
  });

  it("dry-runs part after drawable moves on a cloned candidate session", () => {
    const session = createFixtureSession();
    const request = createMoveStructureChildRequest({
      dryRun: true,
      moved: { kind: "part", partId: PART_EYE },
      drop: { placement: "after", target: { kind: "drawable", drawableId: DRAW_BACK } }
    });

    const outcome = moveStructureChildOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(session.graph.parts.find((part) => part.partId === PART_FACE)?.children).toEqual([
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "part", partId: PART_EYE },
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_MOUTH }
    ]);
    expect(outcome.candidateSession.graph.parts.find((part) => part.partId === PART_FACE)?.children).toEqual([
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_EYE },
      { kind: "part", partId: PART_MOUTH }
    ]);
  });

  it("commits representative mixed item drop combinations through the operation contract", () => {
    const partInsideSession = createFixtureSession();
    const partInsideRequest = createMoveStructureChildRequest({
      moved: { kind: "part", partId: PART_MOUTH },
      drop: { placement: "inside", parentPartId: PART_EYE }
    });

    const partInsideOutcome = moveStructureChildOperationHandler.commit(
      partInsideSession,
      partInsideRequest,
      getRequestOperationId(partInsideRequest)
    );

    expect(partInsideOutcome.result.status).toBe("committed");
    expect(partInsideSession.graph.parts.find((part) => part.partId === PART_FACE)?.children).toEqual([
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "part", partId: PART_EYE },
      { kind: "drawable", drawableId: DRAW_BACK }
    ]);
    expect(partInsideSession.graph.parts.find((part) => part.partId === PART_EYE)?.children).toEqual([
      { kind: "part", partId: PART_MOUTH },
      { kind: "drawable", drawableId: DRAW_EYE }
    ]);
    expect(partInsideSession.graph.drawOrder.map((entry) => entry.drawableId)).toEqual([
      DRAW_FRONT,
      DRAW_MOUTH,
      DRAW_EYE,
      DRAW_BACK
    ]);

    const drawableAfterPartSession = createFixtureSession();
    const drawableAfterPartRequest = createMoveStructureChildRequest({
      moved: { kind: "drawable", drawableId: DRAW_FRONT },
      drop: { placement: "after", target: { kind: "part", partId: PART_EYE } }
    });

    const drawableAfterPartOutcome = moveStructureChildOperationHandler.commit(
      drawableAfterPartSession,
      drawableAfterPartRequest,
      getRequestOperationId(drawableAfterPartRequest)
    );

    expect(drawableAfterPartOutcome.result.status).toBe("committed");
    expect(drawableAfterPartSession.graph.parts.find((part) => part.partId === PART_FACE)?.children).toEqual([
      { kind: "part", partId: PART_EYE },
      { kind: "drawable", drawableId: DRAW_FRONT },
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_MOUTH }
    ]);
    expect(drawableAfterPartSession.graph.drawOrder.map((entry) => entry.drawableId)).toEqual([
      DRAW_EYE,
      DRAW_FRONT,
      DRAW_BACK,
      DRAW_MOUTH
    ]);
  });

  it("rejects cyclic part nesting and drawable no-op moves before revision changes", () => {
    const cycleSession = createFixtureSession();
    const cycleRequest = createMoveStructureChildRequest({
      moved: { kind: "part", partId: PART_FACE },
      drop: { placement: "inside", parentPartId: PART_EYE }
    });

    const cycleOutcome = moveStructureChildOperationHandler.commit(
      cycleSession,
      cycleRequest,
      getRequestOperationId(cycleRequest)
    );
    expect(cycleOutcome.result.status).toBe("rejected");
    expect(cycleOutcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.moveStructureChild.partCycle",
      target: { kind: "part", id: PART_EYE }
    });
    expect(cycleSession.authoringRevision).toBe(0);

    const noOpDrawableSession = createFixtureSession();
    const noOpDrawableRequest = createMoveStructureChildRequest({
      moved: { kind: "drawable", drawableId: DRAW_FRONT },
      drop: { placement: "before", target: { kind: "part", partId: PART_EYE } }
    });

    const noOpDrawableOutcome = moveStructureChildOperationHandler.commit(
      noOpDrawableSession,
      noOpDrawableRequest,
      getRequestOperationId(noOpDrawableRequest)
    );
    expect(noOpDrawableOutcome.result.status).toBe("rejected");
    expect(noOpDrawableOutcome.result.diagnostics[0]).toMatchObject({
      checkId: "operation.moveStructureChild.noOp",
      severity: "warning"
    });
    expect(noOpDrawableSession.authoringRevision).toBe(0);
  });

  it("allows drawable moves into the root ModelPart", () => {
    const session = createFixtureSession();
    const request = createMoveStructureChildRequest({
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "inside", parentPartId: PART_ROOT }
    });

    const outcome = moveStructureChildOperationHandler.commit(session, request, getRequestOperationId(request));

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.parts.find((part) => part.partId === PART_ROOT)?.children).toEqual([
      { kind: "drawable", drawableId: DRAW_BACK },
      { kind: "part", partId: PART_FACE }
    ]);
    expect(session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_BACK)).toMatchObject({
      partId: PART_ROOT,
      baseDrawOrder: 0
    });
  });
});

const createMoveStructureChildRequest = (options: {
  readonly dryRun?: boolean;
  readonly moved:
    | { readonly kind: "part"; readonly partId: string }
    | { readonly kind: "drawable"; readonly drawableId: string };
  readonly drop:
    | {
        readonly placement: "inside";
        readonly parentPartId: string;
      }
    | {
        readonly placement: "before" | "after";
        readonly target:
          | { readonly kind: "part"; readonly partId: string }
          | { readonly kind: "drawable"; readonly drawableId: string };
      };
  readonly lockedTargetIds?: readonly string[];
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_move_structure_child",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun ?? false,
    basePackageRevision: 0,
    trace: {
      relatedAC: ["AC-MVP-013"],
      relatedScenarios: ["SC-PART-001"]
    },
    operationType: "moveStructureChild",
    payload: {
      moved: options.moved,
      drop: options.drop,
      lockedTargetIds: options.lockedTargetIds ?? []
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId =>
  request.operationId ?? OperationIdSchema.parse("op_move_structure_child");

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_move_structure_child_fixture"),
      packageDisplayName: "Move Structure Child Fixture",
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
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_FACE],
          drawableIds: [],
          children: [{ kind: "part", partId: PART_FACE }]
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [PART_EYE, PART_MOUTH],
          drawableIds: [DRAW_FRONT, DRAW_BACK],
          children: [
            { kind: "drawable", drawableId: DRAW_FRONT },
            { kind: "part", partId: PART_EYE },
            { kind: "drawable", drawableId: DRAW_BACK },
            { kind: "part", partId: PART_MOUTH }
          ]
        },
        {
          partId: PART_EYE,
          displayName: "Eye",
          parentPartId: PART_FACE,
          childPartIds: [],
          drawableIds: [DRAW_EYE],
          children: [{ kind: "drawable", drawableId: DRAW_EYE }]
        },
        {
          partId: PART_MOUTH,
          displayName: "Mouth",
          parentPartId: PART_FACE,
          childPartIds: [],
          drawableIds: [DRAW_MOUTH],
          children: [{ kind: "drawable", drawableId: DRAW_MOUTH }]
        }
      ],
      drawables: [
        createDrawable(DRAW_FRONT, PART_FACE, 0),
        createDrawable(DRAW_BACK, PART_FACE, 2),
        createDrawable(DRAW_EYE, PART_EYE, 1),
        createDrawable(DRAW_MOUTH, PART_MOUTH, 3)
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_FRONT, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_EYE, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_BACK, baseDrawOrder: 2, stableOrder: 2 },
        { drawableId: DRAW_MOUTH, baseDrawOrder: 3, stableOrder: 3 }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, PART_EYE, PART_MOUTH, DRAW_FRONT, DRAW_EYE, DRAW_BACK, DRAW_MOUTH],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  partId: ReturnType<typeof PartIdSchema.parse>,
  baseDrawOrder: number
) {
  const suffix = drawableId.replace(/^draw_/, "");

  return {
    drawableId,
    displayName: suffix,
    partId,
    sourceAssetId: SourceAssetIdSchema.parse("src_move_structure_child_fixture"),
    textureId: TextureIdSchema.parse(`tex_${suffix}`),
    meshId: MeshIdSchema.parse(`mesh_${suffix}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder,
    sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${suffix}`)
  };
}
