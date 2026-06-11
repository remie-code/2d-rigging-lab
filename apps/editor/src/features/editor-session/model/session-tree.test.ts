import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
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
  canReparentPart,
  createDrawableReorderEntries,
  createInspectorProjection,
  createStructureTreeRows
} from "./session-tree";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const PART_EYE = PartIdSchema.parse("part_eye");
const DRAW_FRONT = DrawableIdSchema.parse("draw_front");
const DRAW_BACK = DrawableIdSchema.parse("draw_back");
const DRAW_HIDDEN = DrawableIdSchema.parse("draw_hidden");

describe("editor session tree projection", () => {
  it("projects compact rows in front-to-back tree order with effective hidden state", () => {
    const session = createFixtureSession();
    const rows = createStructureTreeRows(session, { kind: "part", id: PART_FACE }, {
      editorHiddenPartIds: new Set([PART_FACE])
    });

    expect(rows.map((row) => [row.kind, row.name, row.effectiveHidden])).toEqual([
      ["part", "Root", false],
      ["part", "Face", true],
      ["part", "Eye", true],
      ["drawable", "Front", true],
      ["drawable", "Back", true],
      ["drawable", "Hidden", true]
    ]);
    expect(rows.filter((row) => row.kind === "drawable").map((row) => row.name)).toEqual([
      "Front",
      "Back",
      "Hidden"
    ]);

    const inspector = createInspectorProjection(session, { kind: "drawable", id: DRAW_FRONT }, {
      editorHiddenPartIds: new Set([PART_FACE])
    });
    expect(inspector).toMatchObject({
      kind: "Drawable",
      effectiveVisible: false,
      hiddenByPart: true,
      runtimeVisible: true
    });
  });

  it("omits child rows under collapsed parts without changing selection state", () => {
    const session = createFixtureSession();
    const rows = createStructureTreeRows(session, { kind: "drawable", id: DRAW_FRONT }, {
      collapsedPartIds: new Set([PART_FACE])
    });

    expect(rows.map((row) => [row.kind, row.name, row.selected])).toEqual([
      ["part", "Root", false],
      ["part", "Face", false]
    ]);
  });

  it("creates draw-order updates so the dragged drawable becomes top/front in the tree", () => {
    const session = createFixtureSession();
    const entries = createDrawableReorderEntries(session, DRAW_BACK, DRAW_FRONT, "before");

    expect(entries).toEqual([
      { drawableId: DRAW_BACK, baseDrawOrder: 0 },
      { drawableId: DRAW_FRONT, baseDrawOrder: 1 },
      { drawableId: DRAW_HIDDEN, baseDrawOrder: 2 }
    ]);
  });

  it("rejects part reparent cycles for DnD boundary checks", () => {
    const session = createFixtureSession();

    expect(canReparentPart(session, PART_FACE, PART_EYE)).toBe(false);
    expect(canReparentPart(session, PART_EYE, PART_ROOT)).toBe(true);
    expect(canReparentPart(session, PART_ROOT, PART_EYE)).toBe(false);
  });
});

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_session_tree_fixture"),
      packageDisplayName: "Session Tree Fixture",
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
          drawableIds: []
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [PART_EYE],
          drawableIds: [DRAW_BACK, DRAW_FRONT, DRAW_HIDDEN]
        },
        {
          partId: PART_EYE,
          displayName: "Eye",
          parentPartId: PART_FACE,
          childPartIds: [],
          drawableIds: []
        }
      ],
      drawables: [
        createDrawable(DRAW_FRONT, "Front", 0, true),
        createDrawable(DRAW_BACK, "Back", 1, true),
        createDrawable(DRAW_HIDDEN, "Hidden", 2, false)
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_FRONT, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_BACK, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_HIDDEN, baseDrawOrder: 2, stableOrder: 2 }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, PART_EYE, DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  displayName: string,
  baseDrawOrder: number,
  runtimeVisibility: boolean
) {
  const token = drawableId.replace(/^draw_/, "");

  return {
    drawableId,
    displayName,
    partId: PART_FACE,
    sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
    textureId: TextureIdSchema.parse(`tex_${token}`),
    meshId: MeshIdSchema.parse(`mesh_${token}`),
    defaultOpacity: 1,
    runtimeVisibility,
    baseDrawOrder,
    sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${token}`)
  };
}
