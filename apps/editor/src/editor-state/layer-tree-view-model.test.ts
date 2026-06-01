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
});
