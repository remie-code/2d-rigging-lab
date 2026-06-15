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
  createInitialCollapsedPartIds,
  mergeNewPartInitialCollapsedPartIds
} from "./part-tree-collapse-state";
import { createStructureTreeRows } from "./session-tree";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const PART_EYE = PartIdSchema.parse("part_eye");
const PART_IMPORTED_CONTAINER = PartIdSchema.parse("part_imported_container");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const DRAW_EYE = DrawableIdSchema.parse("draw_eye");
const DRAW_IMPORTED = DrawableIdSchema.parse("draw_imported");

describe("part tree collapse state", () => {
  it("initializes non-root Part Containers with children as collapsed", () => {
    const session = createFixtureSession();
    const collapsedPartIds = createInitialCollapsedPartIds(session);
    const rows = createStructureTreeRows(session, null, { collapsedPartIds });

    expect(collapsedPartIds).toEqual(new Set([PART_FACE, PART_EYE]));
    expect(rows.map((row) => [row.kind, row.id])).toEqual([
      ["part", PART_ROOT],
      ["part", PART_FACE]
    ]);
  });

  it("expands a deterministic newly focused Part path while keeping descendants collapsed", () => {
    const session = createFixtureSession();
    const collapsedPartIds = createInitialCollapsedPartIds(session, {
      expandPartIds: [PART_FACE]
    });
    const rows = createStructureTreeRows(session, null, { collapsedPartIds });

    expect(collapsedPartIds).toEqual(new Set([PART_EYE]));
    expect(rows.map((row) => [row.kind, row.id])).toEqual([
      ["part", PART_ROOT],
      ["part", PART_FACE],
      ["drawable", DRAW_FACE],
      ["part", PART_EYE]
    ]);
  });

  it("merges defaults only for newly added Part Containers and preserves manual session state", () => {
    const previousSession = createFixtureSession({ includeImportedPart: false });
    const nextSession = createFixtureSession({ includeImportedPart: true });
    const collapsedPartIds = mergeNewPartInitialCollapsedPartIds(
      new Set([PART_EYE]),
      previousSession,
      nextSession,
      { expandPartIds: [PART_FACE] }
    );

    expect(collapsedPartIds.has(PART_EYE)).toBe(true);
    expect(collapsedPartIds.has(PART_IMPORTED_CONTAINER)).toBe(true);
    expect(collapsedPartIds.has(PART_FACE)).toBe(false);
  });
});

function createFixtureSession(options: {
  readonly includeImportedPart?: boolean;
} = {}): AuthoringSession {
  const includeImportedPart = options.includeImportedPart ?? false;

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_part_tree_collapse"),
      packageDisplayName: "Part Tree Collapse",
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
          childPartIds: [PART_FACE, ...(includeImportedPart ? [PART_IMPORTED_CONTAINER] : [])],
          drawableIds: [],
          children: [
            { kind: "part", partId: PART_FACE },
            ...(includeImportedPart
              ? [{ kind: "part" as const, partId: PART_IMPORTED_CONTAINER }]
              : [])
          ]
        },
        {
          partId: PART_FACE,
          displayName: "Face",
          parentPartId: PART_ROOT,
          childPartIds: [PART_EYE],
          drawableIds: [DRAW_FACE],
          children: [
            { kind: "drawable", drawableId: DRAW_FACE },
            { kind: "part", partId: PART_EYE }
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
        ...(includeImportedPart
          ? [
              {
                partId: PART_IMPORTED_CONTAINER,
                displayName: "Imported Container",
                parentPartId: PART_ROOT,
                childPartIds: [],
                drawableIds: [DRAW_IMPORTED],
                children: [
                  {
                    kind: "drawable" as const,
                    drawableId: DRAW_IMPORTED
                  }
                ]
              }
            ]
          : [])
      ],
      drawables: [
        createDrawable(DRAW_FACE, PART_FACE),
        createDrawable(DRAW_EYE, PART_EYE),
        ...(includeImportedPart
          ? [
              createDrawable(DRAW_IMPORTED, PART_IMPORTED_CONTAINER)
            ]
          : [])
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [],
      rigControlRootIds: [],
      stableOrder: [
        PART_ROOT,
        PART_FACE,
        PART_EYE,
        DRAW_FACE,
        DRAW_EYE,
        ...(includeImportedPart ? [PART_IMPORTED_CONTAINER, DRAW_IMPORTED] : [])
      ],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  partId: ReturnType<typeof PartIdSchema.parse>
) {
  const token = drawableId.replace(/^draw_/, "");

  return {
    drawableId,
    displayName: token,
    partId,
    sourceAssetId: SourceAssetIdSchema.parse(`src_${token}`),
    textureId: TextureIdSchema.parse(`tex_${token}`),
    meshId: MeshIdSchema.parse(`mesh_${token}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${token}`)
  };
}
