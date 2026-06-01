import { describe, expect, it } from "vitest";

import {
  createEmptySourceIntakeDraftState,
  type SourceIntakeDraftState
} from "../editor-state/index.js";
import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("part texture layer workflow", () => {
  it("commits part and texture workflow, projects layer evidence, and restores editor state after load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const imported = first.commitSourceIntakeDraft(createSourceIntakeDraft());
    const createdPart = first.commitCreatePart({
      operationId: "op_workflow_create_part_face",
      displayName: "Face",
      parentPartId: "part_root"
    });
    const updatedPart = first.commitUpdatePart({
      operationId: "op_workflow_update_part_face",
      partId: "part_face",
      displayName: "Face Controls"
    });
    const movedDrawable = first.commitSetDrawablePart({
      operationId: "op_workflow_set_drawable_part_body_face",
      drawableId: "draw_body",
      partId: "part_face"
    });
    const assignedTexture = first.commitSetDrawableTexture({
      operationId: "op_workflow_set_drawable_texture_body_face",
      drawableId: "draw_body",
      textureId: "tex_face"
    });

    first.selectDrawableLayer("draw_body");
    first.toggleDrawableLayerLock("draw_body");
    first.toggleDrawableEditorHidden("draw_body");
    first.openViewerRuntimeSurface();

    const previewDrawable = first.previewProjection?.drawables.find(
      (drawable) => drawable.drawableId === "draw_body"
    );
    const previewPart = first.previewProjection?.parts?.find((part) => part.partId === "part_face");
    const viewerDrawable = first.viewerRuntimeProjection?.previewProjection.drawables.find(
      (drawable) => drawable.drawableId === "draw_body"
    );
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(imported.status).toBe("committed");
    expect(createdPart.status).toBe("committed");
    expect(updatedPart.status).toBe("committed");
    expect(movedDrawable.status).toBe("committed");
    expect(assignedTexture.status).toBe("committed");
    expect(first.state.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        partId: "part_face",
        displayName: "Face Controls",
        parentPartId: "part_root",
        drawableIds: ["draw_body"]
      })
    ]));
    expect(first.state.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_body",
        partId: "part_face",
        textureId: "tex_face"
      })
    ]));
    expect(first.state.layerTreeDraft).toEqual({
      selection: ["draw_body"],
      lockedIds: ["draw_body"],
      editorHiddenIds: ["draw_body"]
    });
    expect(first.viewModel.layerTree.summaryLabel).toContain("1 selected");
    expect(first.viewModel.layerTree.summaryLabel).toContain("1 locked");
    expect(first.viewModel.layerTree.summaryLabel).toContain("1 editor-hidden");
    expect(first.viewModel.layerTree.summaryLabel).toContain("0 missing texture");
    expect(previewDrawable?.layerState).toMatchObject({
      runtimeVisible: true,
      editorHidden: true,
      locked: true,
      selected: true,
      textureBacked: true,
      textureUnresolved: false
    });
    expect(previewPart).toMatchObject({
      partId: "part_face",
      displayName: "Face Controls",
      drawableIds: ["draw_body"],
      depth: 1
    });
    expect(viewerDrawable?.layerState).toMatchObject({
      runtimeVisible: true,
      editorHidden: true,
      locked: true,
      selected: true,
      textureBacked: true
    });
    expect(viewerDrawable?.partId).toBe("part_face");
    expect(saved.snapshot.document.model.editorState).toEqual({
      schemaVersion: "editor-state-v1",
      selection: ["draw_body"],
      lockedIds: ["draw_body"],
      editorHiddenIds: ["draw_body"]
    });
    expect(saved.snapshot.packageFilePaths).toEqual(expect.arrayContaining([
      "model/editor-state.json",
      "model/graph.json",
      "model/drawables.json",
      "assets/textures/texture-atlas.json"
    ]));
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "importSplitPngSourceAsset",
      "createPart",
      "updatePart",
      "setDrawablePart",
      "setDrawableTexture"
    ]);
    expect(loaded.status).toBe("loaded");
    expect(second.state.layerTreeDraft).toEqual(first.state.layerTreeDraft);
    expect(second.state.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        partId: "part_face",
        displayName: "Face Controls",
        drawableIds: ["draw_body"]
      })
    ]));
    expect(second.state.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_body",
        partId: "part_face",
        textureId: "tex_face"
      })
    ]));
  });

  it("uses layer locks as operation preconditions without changing runtime visibility", () => {
    const workflow = createWorkflow(createMemoryStorage());

    workflow.commitCreateDrawablePreset(createDrawablePresetCommand());
    workflow.toggleDrawableLayerLock("draw_body");
    const editorHidden = workflow.toggleDrawableEditorHidden("draw_body");
    const drawOrderBefore = workflow.state.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      visible: drawable.visible,
      baseDrawOrder: drawable.baseDrawOrder,
      orderIndex: drawable.orderIndex
    }));
    const result = workflow.commitSetDrawableTexture({
      operationId: "op_workflow_locked_set_texture",
      drawableId: "draw_body",
      textureId: "tex_missing"
    });
    const setRuntimeVisibility = workflow.setDrawableRuntimeVisibility("draw_body", false);
    const toggledRuntimeVisibility = workflow.toggleDrawableRuntimeVisibility("draw_body");
    const movedLockedDrawable = workflow.moveDrawableLayer("draw_body", "up");
    const movedAcrossLockedDrawable = workflow.moveDrawableLayer("draw_workflow_star", "down");
    const previewDrawable = workflow.previewProjection?.drawables.find(
      (drawable) => drawable.drawableId === "draw_body"
    );

    expect(result.status).toBe("rejected");
    expect(result.result.operationResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.setDrawableTexture.lockedTarget"
      })
    ]));
    expect(editorHidden.status).toBe("updated");
    expect(setRuntimeVisibility).toMatchObject({
      status: "locked",
      drawableId: "draw_body",
      lockedDrawableIds: ["draw_body"]
    });
    expect(toggledRuntimeVisibility).toMatchObject({
      status: "locked",
      drawableId: "draw_body",
      lockedDrawableIds: ["draw_body"]
    });
    expect(movedLockedDrawable).toMatchObject({
      status: "locked",
      drawableId: "draw_body",
      lockedDrawableIds: ["draw_body"]
    });
    expect(movedAcrossLockedDrawable).toMatchObject({
      status: "locked",
      drawableId: "draw_body",
      lockedDrawableIds: ["draw_body"]
    });
    expect(workflow.state.drawables.find((drawable) => drawable.drawableId === "draw_body")).toMatchObject({
      visible: true,
      textureId: "tex_body"
    });
    expect(workflow.state.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      visible: drawable.visible,
      baseDrawOrder: drawable.baseDrawOrder,
      orderIndex: drawable.orderIndex
    }))).toEqual(drawOrderBefore);
    expect(workflow.state.layerTreeDraft.lockedIds).toEqual(["draw_body"]);
    expect(workflow.state.layerTreeDraft.editorHiddenIds).toEqual(["draw_body"]);
    expect(previewDrawable?.layerState).toMatchObject({
      runtimeVisible: true,
      editorHidden: true,
      locked: true
    });
  });
});

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-06-01T00:00:00.000Z")
    }),
    now: () => new Date("2026-06-01T00:00:00.000Z")
  });

const createDrawablePresetCommand = () => ({
  createOperationId: "op_workflow_create_drawable_star",
  generateOperationId: "op_workflow_generate_mesh_star",
  displayName: "Workflow Star",
  sourceAssetId: "src_generated",
  sourceLayerId: "layer_body",
  partId: "part_root",
  initialBounds: { x: 16, y: 24, width: 24, height: 24 },
  meshMethod: "auto-grid-v1",
  densityHint: "low"
} as const);

const createSourceIntakeDraft = (): SourceIntakeDraftState => ({
  ...createEmptySourceIntakeDraftState({ defaultPartId: "part_root" }),
  status: "confirmed",
  sourceAssetId: "src_workflow_split",
  manifestPath: "assets/sources/workflow/split-manifest.json",
  contentHash: "sha256:workflow-split",
  defaultPartId: "part_root",
  placementPolicy: "use-metadata",
  layers: [
    {
      sourceLayerId: "layer_face",
      originalName: "Face.png",
      normalizedName: "face",
      groupPath: ["Head"],
      bounds: { x: 8, y: 10, width: 96, height: 112 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: [],
      texturePreviewReference: "assets/textures/workflow/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root"
    }
  ],
  rights: {
    rightsStatus: "needs_review",
    creator: "Workflow Artist",
    license: "private-review",
    redistributionAllowed: false,
    aiUsed: false,
    sourceUrl: "https://example.invalid/workflow-source",
    notes: "part texture layer workflow source intake test"
  },
  diagnostics: []
});

const createMemoryStorage = (): StorageLike => {
  const values = new Map<string, string>();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
