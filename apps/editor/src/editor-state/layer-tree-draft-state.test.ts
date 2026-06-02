import { describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  clearLayerTreeDirectManipulationDraft,
  createEditorStateFileFromLayerTreeDraft,
  createEmptyLayerTreeDraftState,
  draftLayerTreeDrawablePartAssignment,
  draftLayerTreeDrawableTextureAssignment,
  draftLayerTreeEmptyLeafPartDelete,
  draftLayerTreePartRename,
  draftLayerTreePartReparent,
  projectLoadedPackageState,
  selectDrawableLayerInEditorState,
  setDrawableEditorHiddenInEditorState,
  toggleDrawableEditorHiddenInEditorState,
  toggleDrawableLayerLockInEditorState
} from "./index.js";

describe("layer tree draft state", () => {
  it("normalizes editor-only selection, locked, and hidden ids deterministically", () => {
    expect(
      createEmptyLayerTreeDraftState({
        selection: [" draw_body ", "draw_body", ""],
        lockedIds: ["draw_z", " draw_a ", "draw_z"],
        editorHiddenIds: ["draw_hidden", "", "draw_hidden"]
      })
    ).toEqual({
      selection: ["draw_body"],
      lockedIds: ["draw_a", "draw_z"],
      editorHiddenIds: ["draw_hidden"]
    });
  });

  it("keeps mesh-edit vertex selection out of layer tree selection", () => {
    expect(
      createEmptyLayerTreeDraftState({
        selection: ["vtx_body_0", "vtx_body_2"],
        lockedIds: ["draw_body"],
        editorHiddenIds: [],
        activeTool: "meshEdit"
      })
    ).toEqual({
      selection: [],
      lockedIds: ["draw_body"],
      editorHiddenIds: []
    });
  });

  it("updates drawable selection, lock, and editor-only hidden state without changing runtime visibility", () => {
    const loaded = projectLoadedPackageState({
      identity: {
        packageId: "pkg_layer_tree_draft",
        packageDisplayName: "Layer Tree Draft",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
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
      ]
    });

    const selected = selectDrawableLayerInEditorState(loaded, "draw_body");
    const locked = toggleDrawableLayerLockInEditorState(selected, "draw_body");
    const editorHidden = toggleDrawableEditorHiddenInEditorState(locked, "draw_body");
    const editorVisible = setDrawableEditorHiddenInEditorState(editorHidden, "draw_body", false);

    expect(selected.layerTreeDraft.selection).toEqual(["draw_body"]);
    expect(locked.layerTreeDraft.lockedIds).toEqual(["draw_body"]);
    expect(editorHidden.layerTreeDraft.editorHiddenIds).toEqual(["draw_body"]);
    expect(editorVisible.layerTreeDraft.editorHiddenIds).toEqual([]);
    expect(editorHidden.drawables[0]?.visible).toBe(true);
    expect(editorHidden.drawables[0]?.drawableId).toBe("draw_body");
  });

  it("records row-level direct manipulation drafts without changing selection, lock, or editor-hide state", () => {
    const base = createEmptyLayerTreeDraftState({
      selection: ["draw_eye"],
      lockedIds: ["draw_body"],
      editorHiddenIds: ["draw_eye"]
    });
    const renamed = draftLayerTreePartRename(base, {
      partId: " part_face ",
      displayName: " Face Draft "
    });
    const reparented = draftLayerTreePartReparent(renamed, {
      partId: "part_face",
      parentPartId: " part_root "
    });
    const deleteRequested = draftLayerTreeEmptyLeafPartDelete(reparented, {
      partId: " part_empty "
    });
    const drawableReassigned = draftLayerTreeDrawablePartAssignment(deleteRequested, {
      drawableId: " draw_eye ",
      partId: " part_face "
    });
    const textureAssigned = draftLayerTreeDrawableTextureAssignment(drawableReassigned, {
      drawableId: "draw_eye",
      textureId: " tex_eye "
    });

    expect(textureAssigned).toEqual({
      selection: ["draw_eye"],
      lockedIds: ["draw_body"],
      editorHiddenIds: ["draw_eye"],
      directManipulation: {
        partRenames: [
          {
            draftKind: "partRename",
            partId: "part_face",
            displayName: "Face Draft"
          }
        ],
        partReparents: [
          {
            draftKind: "partReparent",
            partId: "part_face",
            parentPartId: "part_root"
          }
        ],
        emptyLeafPartDeletes: [
          {
            draftKind: "emptyLeafPartDelete",
            partId: "part_empty"
          }
        ],
        drawablePartAssignments: [
          {
            draftKind: "drawablePartAssignment",
            drawableId: "draw_eye",
            partId: "part_face"
          }
        ],
        drawableTextureAssignments: [
          {
            draftKind: "drawableTextureAssignment",
            drawableId: "draw_eye",
            textureId: "tex_eye"
          }
        ]
      }
    });
    expect(createEditorStateFileFromLayerTreeDraft(textureAssigned)).toEqual({
      schemaVersion: "editor-state-v1",
      selection: ["draw_eye"],
      lockedIds: ["draw_body"],
      editorHiddenIds: ["draw_eye"]
    });
    expect(clearLayerTreeDirectManipulationDraft(textureAssigned)).toEqual(base);
  });
});
