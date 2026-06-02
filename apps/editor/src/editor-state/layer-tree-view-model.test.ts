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
  draftLayerTreeDrawablePartAssignment,
  draftLayerTreeDrawableTextureAssignment,
  draftLayerTreeEmptyLeafPartDelete,
  draftLayerTreePartRename,
  draftLayerTreePartReparent,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "./index.js";

describe("layer tree view model", () => {
  it("groups drawables by part and keeps texture/runtime/editor-only state separate", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_layer_tree",
        packageDisplayName: "Layer Tree Package",
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
          childPartIds: [PartIdSchema.parse("part_face")],
          drawableIds: [DrawableIdSchema.parse("draw_body")]
        },
        {
          partId: PartIdSchema.parse("part_face"),
          displayName: "Face",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: [DrawableIdSchema.parse("draw_eye")]
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
        },
        {
          drawableId: DrawableIdSchema.parse("draw_eye"),
          displayName: "Eye",
          partId: PartIdSchema.parse("part_face"),
          sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
          textureId: TextureIdSchema.parse("tex_missing"),
          meshId: MeshIdSchema.parse("mesh_eye"),
          defaultOpacity: 1,
          runtimeVisibility: false,
          baseDrawOrder: 1,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_eye")
        },
        {
          drawableId: DrawableIdSchema.parse("draw_orphan"),
          displayName: "Orphan",
          partId: PartIdSchema.parse("part_unknown"),
          sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
          textureId: TextureIdSchema.parse("tex_orphan"),
          meshId: MeshIdSchema.parse("mesh_orphan"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 2,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_orphan")
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_body"),
            filePath: "assets/textures/body.png",
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            sourceLayerId: "layer_body",
            provenanceId: ProvenanceIdSchema.parse("prov_body")
          }
        ]
      },
      editorState: {
        schemaVersion: "editor-state-v1",
        selection: ["draw_eye"],
        lockedIds: ["draw_body"],
        editorHiddenIds: ["draw_eye"]
      }
    });

    const layerTree = projectEditorWorkflowViewModel(state).layerTree;

    expect(layerTree.summaryLabel).toBe(
      "3 part groups / 3 drawables / 1 selected / 1 locked / 1 editor-hidden / 2 missing textures"
    );
    expect(layerTree.selectedDrawableIds).toEqual(["draw_eye"]);
    expect(layerTree.lockedDrawableIds).toEqual(["draw_body"]);
    expect(layerTree.editorHiddenDrawableIds).toEqual(["draw_eye"]);
    expect(layerTree.missingTextureDrawableIds).toEqual(["draw_eye", "draw_orphan"]);
    expect(layerTree.partGroups.map((group) => [group.partId, group.depth, group.partStatus])).toEqual([
      ["part_root", 0, "resolved"],
      ["part_face", 1, "resolved"],
      ["part_unknown", 0, "missing"]
    ]);

    expect(layerTree.partGroups[0]?.drawables[0]).toMatchObject({
      drawableId: "draw_body",
      textureStatus: "resolved",
      textureLabel: "tex_body / assets/textures/body.png",
      runtimeVisible: true,
      editorHidden: false,
      locked: true,
      selected: false,
      stateLabel: "Texture resolved / Runtime visible / Editor visible / Locked / Not selected"
    });
    expect(layerTree.partGroups[1]?.drawables[0]).toMatchObject({
      drawableId: "draw_eye",
      textureStatus: "missing",
      textureLabel: "Missing texture tex_missing",
      runtimeVisible: false,
      editorHidden: true,
      locked: false,
      selected: true,
      stateLabel: "Texture missing / Runtime hidden / Editor hidden / Unlocked / Selected"
    });
  });

  it("projects row-level direct manipulation drafts without changing selection, lock, or editor-hide projection", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_layer_tree_direct_draft",
        packageDisplayName: "Layer Tree Direct Draft",
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
          childPartIds: [PartIdSchema.parse("part_face"), PartIdSchema.parse("part_empty")],
          drawableIds: [DrawableIdSchema.parse("draw_body")]
        },
        {
          partId: PartIdSchema.parse("part_face"),
          displayName: "Face",
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
        },
        {
          drawableId: DrawableIdSchema.parse("draw_eye"),
          displayName: "Eye",
          partId: PartIdSchema.parse("part_face"),
          sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
          textureId: TextureIdSchema.parse("tex_eye"),
          meshId: MeshIdSchema.parse("mesh_eye"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 1,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_eye")
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_body"),
            filePath: "assets/textures/body.png",
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            sourceLayerId: "layer_body",
            provenanceId: ProvenanceIdSchema.parse("prov_body")
          },
          {
            textureId: TextureIdSchema.parse("tex_eye"),
            filePath: "assets/textures/eye.png",
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            sourceLayerId: "layer_eye",
            provenanceId: ProvenanceIdSchema.parse("prov_eye")
          }
        ]
      },
      editorState: {
        schemaVersion: "editor-state-v1",
        selection: ["draw_eye"],
        lockedIds: ["draw_body"],
        editorHiddenIds: ["draw_eye"]
      }
    });
    const directDraft = draftLayerTreeDrawableTextureAssignment(
      draftLayerTreeDrawablePartAssignment(
        draftLayerTreeEmptyLeafPartDelete(
          draftLayerTreePartReparent(
            draftLayerTreePartRename(state.layerTreeDraft, {
              partId: "part_face",
              displayName: "Face Draft"
            }),
            {
              partId: "part_face",
              parentPartId: null
            }
          ),
          {
            partId: "part_empty"
          }
        ),
        {
          drawableId: "draw_eye",
          partId: "part_root"
        }
      ),
      {
        drawableId: "draw_eye",
        textureId: "tex_body"
      }
    );
    const layerTree = projectEditorWorkflowViewModel({
      ...state,
      layerTreeDraft: directDraft
    }).layerTree;
    const rootGroup = layerTree.partGroups.find((group) => group.partId === "part_root");
    const faceGroup = layerTree.partGroups.find((group) => group.partId === "part_face");
    const emptyGroup = layerTree.partGroups.find((group) => group.partId === "part_empty");
    const eyeDrawable = faceGroup?.drawables.find((drawable) => drawable.drawableId === "draw_eye");
    const emptyParentOption = faceGroup?.directManipulation.parentOptions.find(
      (option) => option.partId === "part_empty"
    );
    const emptyDrawablePartOption = eyeDrawable?.directManipulation.partOptions.find(
      (option) => option.partId === "part_empty"
    );

    expect(layerTree.directManipulationDraftCount).toBe(5);
    expect(layerTree.directManipulationSummaryLabel).toBe("5 direct drafts");
    expect(layerTree.selectedDrawableIds).toEqual(["draw_eye"]);
    expect(layerTree.lockedDrawableIds).toEqual(["draw_body"]);
    expect(layerTree.editorHiddenDrawableIds).toEqual(["draw_eye"]);
    expect(rootGroup?.directManipulation.parentOptions.map((option) => option.partId)).not.toContain(
      "part_face"
    );
    expect(emptyParentOption).toMatchObject({
      partId: "part_empty",
      disabled: true
    });
    expect(emptyDrawablePartOption).toMatchObject({
      partId: "part_empty",
      disabled: true
    });
    expect(faceGroup?.directManipulation).toMatchObject({
      renameValue: "Face Draft",
      renameDrafted: true,
      parentPartId: null,
      reparentDrafted: true,
      canDraftEmptyLeafDelete: false,
      emptyLeafDeleteDisabledMessage: "Part has drawables",
      statusLabel: "Rename draft: Face Draft / Parent draft: No parent"
    });
    expect(emptyGroup?.directManipulation).toMatchObject({
      emptyLeafDeleteDrafted: true,
      canDraftEmptyLeafDelete: true,
      statusLabel: "Empty-leaf delete draft pending"
    });
    expect(eyeDrawable).toMatchObject({
      selected: true,
      editorHidden: true,
      locked: false,
      directManipulation: {
        partId: "part_root",
        partAssignmentDrafted: true,
        textureId: "tex_body",
        textureAssignmentDrafted: true,
        statusLabel:
          "Part draft: Root / part_root / Texture draft: tex_body / assets/textures/body.png"
      }
    });
  });
});
