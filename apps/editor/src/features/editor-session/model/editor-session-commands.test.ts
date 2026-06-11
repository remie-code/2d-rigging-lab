import {
  createInitialAuthoringRevision,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  commitDrawableReorder,
  commitDrawableReparent,
  commitPartReparent
} from "./editor-session-commands";
import { createStructureTreeRows, type StructureTreeRow } from "./session-tree";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_A = PartIdSchema.parse("part_a");
const PART_B = PartIdSchema.parse("part_b");
const PART_C = PartIdSchema.parse("part_c");
const DRAW_A = DrawableIdSchema.parse("draw_a");
const DRAW_B = DrawableIdSchema.parse("draw_b");
const DRAW_C = DrawableIdSchema.parse("draw_c");

describe("editor session commands", () => {
  it("reparents a drawable and resyncs Canvas draw order to projected tree order", () => {
    const session = createFixtureSession([DRAW_C, DRAW_A, DRAW_B]);
    const result = commitDrawableReparent(session, DRAW_B, PART_A);

    expect(result.committed).toBe(true);
    expect(findDrawablePart(result.session, DRAW_B)).toBe(PART_A);
    expect(projectedDrawableOrder(result.session)).toEqual([DRAW_A, DRAW_B, DRAW_C]);
    expect(globalDrawableOrder(result.session)).toEqual(projectedDrawableOrder(result.session));
    expect(findDrawablePart(session, DRAW_B)).toBe(PART_B);
  });

  it("reparents a cross-part drawable reorder drop and preserves top-row-is-front draw order", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B, DRAW_C]);
    const result = commitDrawableReorder(session, DRAW_C, DRAW_A, "before");

    expect(result.committed).toBe(true);
    expect(findDrawablePart(result.session, DRAW_C)).toBe(PART_A);
    expect(projectedDrawableOrder(result.session)).toEqual([DRAW_C, DRAW_A, DRAW_B]);
    expect(globalDrawableOrder(result.session)).toEqual(projectedDrawableOrder(result.session));
  });

  it("reparents a part and resyncs Canvas draw order to the new subtree row order", () => {
    const session = createFixtureSession([DRAW_A, DRAW_B, DRAW_C]);
    const result = commitPartReparent(session, PART_B, PART_A);

    expect(result.committed).toBe(true);
    expect(result.session.graph.parts.find((part) => part.partId === PART_B)?.parentPartId).toBe(PART_A);
    expect(projectedDrawableOrder(result.session)).toEqual([DRAW_B, DRAW_A, DRAW_C]);
    expect(globalDrawableOrder(result.session)).toEqual(projectedDrawableOrder(result.session));
  });
});

function projectedDrawableOrder(session: AuthoringSession) {
  return createStructureTreeRows(session, null)
    .filter(
      (row): row is Extract<StructureTreeRow, { readonly kind: "drawable" }> =>
        row.kind === "drawable"
    )
    .map((row) => row.id);
}

function globalDrawableOrder(session: AuthoringSession) {
  return [...session.graph.drawOrder]
    .sort((left, right) => left.stableOrder - right.stableOrder)
    .map((entry) => entry.drawableId);
}

function findDrawablePart(session: AuthoringSession, drawableId: typeof DRAW_A) {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId)?.partId;
}

function createFixtureSession(drawableOrder: readonly (typeof DRAW_A)[]): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_editor_session_commands_fixture"),
      packageDisplayName: "Editor Session Commands Fixture",
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
          childPartIds: [PART_A, PART_B, PART_C],
          drawableIds: []
        },
        {
          partId: PART_A,
          displayName: "Part A",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_A]
        },
        {
          partId: PART_B,
          displayName: "Part B",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_B]
        },
        {
          partId: PART_C,
          displayName: "Part C",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_C]
        }
      ],
      drawables: [
        createDrawable(DRAW_A, PART_A),
        createDrawable(DRAW_B, PART_B),
        createDrawable(DRAW_C, PART_C)
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: drawableOrder.map((drawableId, stableOrder) => ({
        drawableId,
        baseDrawOrder: stableOrder,
        stableOrder
      })),
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_A, PART_B, PART_C, DRAW_A, DRAW_B, DRAW_C],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDrawable(drawableId: typeof DRAW_A, partId: typeof PART_A) {
  const token = drawableId.replace(/^draw_/, "");

  return {
    drawableId,
    displayName: `Drawable ${token.toUpperCase()}`,
    partId,
    sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
    textureId: TextureIdSchema.parse(`tex_${token}`),
    meshId: MeshIdSchema.parse(`mesh_${token}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${token}`)
  };
}
