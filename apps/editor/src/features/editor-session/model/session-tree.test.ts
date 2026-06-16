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
  createStructureMoveDrop,
  createStructureTreeRows
} from "./session-tree";
import { resolveDrawableSelectionTransition } from "./editor-selection";

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
      ["drawable", "Front", true],
      ["part", "Eye", true],
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

  it("resolves Drawable-only normal, Ctrl, and Shift selection transitions", () => {
    const visibleDrawableIds = [DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN];

    const replaced = resolveDrawableSelectionTransition({
      currentSelection: { kind: "part", id: PART_FACE },
      anchorDrawableId: null,
      clickedDrawableId: DRAW_FRONT,
      visibleDrawableIds,
      mode: "replace"
    });
    expect(replaced).toEqual({
      selection: { kind: "drawable", id: DRAW_FRONT },
      anchorDrawableId: DRAW_FRONT
    });

    const toggled = resolveDrawableSelectionTransition({
      currentSelection: replaced.selection,
      anchorDrawableId: replaced.anchorDrawableId,
      clickedDrawableId: DRAW_HIDDEN,
      visibleDrawableIds,
      mode: "toggle"
    });
    expect(toggled).toEqual({
      selection: {
        kind: "drawableSet",
        ids: [DRAW_FRONT, DRAW_HIDDEN]
      },
      anchorDrawableId: DRAW_HIDDEN
    });

    const toggledOff = resolveDrawableSelectionTransition({
      currentSelection: toggled.selection,
      anchorDrawableId: toggled.anchorDrawableId,
      clickedDrawableId: DRAW_FRONT,
      visibleDrawableIds,
      mode: "toggle"
    });
    expect(toggledOff).toEqual({
      selection: { kind: "drawable", id: DRAW_HIDDEN },
      anchorDrawableId: DRAW_FRONT
    });
    expect(
      resolveDrawableSelectionTransition({
        currentSelection: toggledOff.selection,
        anchorDrawableId: toggledOff.anchorDrawableId,
        clickedDrawableId: DRAW_HIDDEN,
        visibleDrawableIds,
        mode: "range"
      })
    ).toEqual({
      selection: {
        kind: "drawableSet",
        ids: [DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN]
      },
      anchorDrawableId: DRAW_FRONT
    });

    expect(
      resolveDrawableSelectionTransition({
        currentSelection: { kind: "drawable", id: DRAW_FRONT },
        anchorDrawableId: DRAW_FRONT,
        clickedDrawableId: DRAW_FRONT,
        visibleDrawableIds,
        mode: "toggle"
      })
    ).toEqual({
      selection: null,
      anchorDrawableId: DRAW_FRONT
    });

    const ranged = resolveDrawableSelectionTransition({
      currentSelection: toggled.selection,
      anchorDrawableId: DRAW_FRONT,
      clickedDrawableId: DRAW_HIDDEN,
      visibleDrawableIds,
      mode: "range"
    });
    expect(ranged).toEqual({
      selection: {
        kind: "drawableSet",
        ids: [DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN]
      },
      anchorDrawableId: DRAW_FRONT
    });
  });

  it("falls back to clicked Drawable when Shift anchor is absent, hidden, or selection is a Part Container", () => {
    const visibleDrawableIds = [DRAW_FRONT, DRAW_BACK];

    expect(
      resolveDrawableSelectionTransition({
        currentSelection: { kind: "drawable", id: DRAW_FRONT },
        anchorDrawableId: null,
        clickedDrawableId: DRAW_BACK,
        visibleDrawableIds,
        mode: "range"
      })
    ).toEqual({
      selection: { kind: "drawable", id: DRAW_BACK },
      anchorDrawableId: DRAW_BACK
    });

    expect(
      resolveDrawableSelectionTransition({
        currentSelection: { kind: "drawable", id: DRAW_FRONT },
        anchorDrawableId: DRAW_HIDDEN,
        clickedDrawableId: DRAW_BACK,
        visibleDrawableIds,
        mode: "range"
      })
    ).toEqual({
      selection: { kind: "drawable", id: DRAW_BACK },
      anchorDrawableId: DRAW_BACK
    });

    expect(
      resolveDrawableSelectionTransition({
        currentSelection: { kind: "part", id: PART_FACE },
        anchorDrawableId: DRAW_FRONT,
        clickedDrawableId: DRAW_BACK,
        visibleDrawableIds,
        mode: "range"
      })
    ).toEqual({
      selection: { kind: "drawable", id: DRAW_BACK },
      anchorDrawableId: DRAW_BACK
    });

    expect(
      resolveDrawableSelectionTransition({
        currentSelection: { kind: "part", id: PART_FACE },
        anchorDrawableId: DRAW_FRONT,
        clickedDrawableId: DRAW_BACK,
        visibleDrawableIds,
        mode: "toggle"
      })
    ).toEqual({
      selection: { kind: "drawable", id: DRAW_BACK },
      anchorDrawableId: DRAW_BACK
    });
  });

  it("clears Drawable multi-selection on normal replacement clicks", () => {
    const visibleDrawableIds = [DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN];

    expect(
      resolveDrawableSelectionTransition({
        currentSelection: {
          kind: "drawableSet",
          ids: [DRAW_FRONT, DRAW_HIDDEN]
        },
        anchorDrawableId: DRAW_HIDDEN,
        clickedDrawableId: DRAW_BACK,
        visibleDrawableIds,
        mode: "replace"
      })
    ).toEqual({
      selection: { kind: "drawable", id: DRAW_BACK },
      anchorDrawableId: DRAW_BACK
    });
  });

  it("marks only Drawable members selected for Drawable set selections", () => {
    const session = createFixtureSession();
    const rows = createStructureTreeRows(session, {
      kind: "drawableSet",
      ids: [DRAW_FRONT, DRAW_HIDDEN]
    });

    expect(rows.map((row) => [row.kind, row.name, row.selected])).toEqual([
      ["part", "Root", false],
      ["part", "Face", false],
      ["drawable", "Front", true],
      ["part", "Eye", false],
      ["drawable", "Back", false],
      ["drawable", "Hidden", true]
    ]);
  });

  it("projects a minimal Select Inspector Drawable name list for Drawable set selections", () => {
    const session = createFixtureSession();
    const inspector = createInspectorProjection(session, {
      kind: "drawableSet",
      ids: [DRAW_FRONT, DRAW_HIDDEN]
    });

    expect(inspector).toEqual({
      title: "2 Drawables selected",
      kind: "Drawable Selection",
      drawableIds: [DRAW_FRONT, DRAW_HIDDEN],
      drawables: [
        { drawableId: DRAW_FRONT, displayName: "Front" },
        { drawableId: DRAW_HIDDEN, displayName: "Hidden" }
      ]
    });
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

  it("derives legacy mixed row order from drawOrder when stored children are absent", () => {
    const session = createFixtureSession();
    const facePart = session.graph.parts.find((part) => part.partId === PART_FACE)!;
    const eyePart = session.graph.parts.find((part) => part.partId === PART_EYE)!;
    const hiddenDrawable = session.graph.drawables.find((drawable) => drawable.drawableId === DRAW_HIDDEN)!;

    facePart.children = undefined;
    facePart.childPartIds = [PART_EYE];
    facePart.drawableIds = [DRAW_FRONT, DRAW_BACK];
    eyePart.children = undefined;
    eyePart.drawableIds = [DRAW_HIDDEN];
    hiddenDrawable.partId = PART_EYE;
    session.graph.drawOrder = [
      { drawableId: DRAW_FRONT, baseDrawOrder: 0, stableOrder: 0 },
      { drawableId: DRAW_HIDDEN, baseDrawOrder: 1, stableOrder: 1 },
      { drawableId: DRAW_BACK, baseDrawOrder: 2, stableOrder: 2 }
    ];

    const rows = createStructureTreeRows(session, null);

    expect(rows.map((row) => [row.kind, row.name])).toEqual([
      ["part", "Root"],
      ["part", "Face"],
      ["drawable", "Front"],
      ["part", "Eye"],
      ["drawable", "Hidden"],
      ["drawable", "Back"]
    ]);
  });

  it("rejects part reparent cycles for DnD boundary checks", () => {
    const session = createFixtureSession();

    expect(canReparentPart(session, PART_FACE, PART_EYE)).toBe(false);
    expect(canReparentPart(session, PART_EYE, PART_ROOT)).toBe(true);
    expect(canReparentPart(session, PART_ROOT, PART_EYE)).toBe(false);
  });

  it("resolves structure DnD before, after, and inside intent for mixed rows", () => {
    const session = createFixtureSession();
    const rows = createStructureTreeRows(session, null);
    const faceRow = rows.find((row) => row.kind === "part" && row.id === PART_FACE);
    const eyeRow = rows.find((row) => row.kind === "part" && row.id === PART_EYE);
    const frontRow = rows.find((row) => row.kind === "drawable" && row.id === DRAW_FRONT);

    expect(faceRow).toBeDefined();
    expect(eyeRow).toBeDefined();
    expect(frontRow).toBeDefined();

    expect(
      createStructureMoveDrop(
        session,
        { kind: "drawable", drawableId: DRAW_BACK },
        eyeRow!,
        "before"
      )
    ).toEqual({
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "before", target: { kind: "part", partId: PART_EYE } }
    });
    expect(
      createStructureMoveDrop(
        session,
        { kind: "part", partId: PART_EYE },
        frontRow!,
        "after"
      )
    ).toEqual({
      moved: { kind: "part", partId: PART_EYE },
      drop: { placement: "after", target: { kind: "drawable", drawableId: DRAW_FRONT } }
    });
    expect(
      createStructureMoveDrop(
        session,
        { kind: "drawable", drawableId: DRAW_BACK },
        eyeRow!,
        "inside"
      )
    ).toEqual({
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "inside", parentPartId: PART_EYE }
    });
    expect(
      createStructureMoveDrop(
        session,
        { kind: "drawable", drawableId: DRAW_BACK },
        rows[0]!,
        "inside"
      )
    ).toEqual({
      moved: { kind: "drawable", drawableId: DRAW_BACK },
      drop: { placement: "inside", parentPartId: PART_ROOT }
    });
    expect(
      createStructureMoveDrop(
        session,
        { kind: "part", partId: PART_FACE },
        eyeRow!,
        "inside"
      )
    ).toBeUndefined();
    expect(
      createStructureMoveDrop(
        session,
        { kind: "part", partId: PART_ROOT },
        faceRow!,
        "after"
      )
    ).toBeUndefined();
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
          drawableIds: [],
          children: [
            {
              kind: "part",
              partId: PART_FACE
            }
          ]
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [PART_EYE],
          drawableIds: [DRAW_FRONT, DRAW_BACK, DRAW_HIDDEN],
          children: [
            {
              kind: "drawable",
              drawableId: DRAW_FRONT
            },
            {
              kind: "part",
              partId: PART_EYE
            },
            {
              kind: "drawable",
              drawableId: DRAW_BACK
            },
            {
              kind: "drawable",
              drawableId: DRAW_HIDDEN
            }
          ]
        },
        {
          partId: PART_EYE,
          displayName: "Eye",
          parentPartId: PART_FACE,
          childPartIds: [],
          drawableIds: [],
          children: []
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
