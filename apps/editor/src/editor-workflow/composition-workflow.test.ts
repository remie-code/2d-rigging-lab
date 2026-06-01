import { describe, expect, it } from "vitest";

import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("composition workflow", () => {
  it("commits mask relation and drawable opacity evidence through preview, viewer, save, and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const drawable = first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const maskRelation = first.commitSetMaskRelation({
      maskRelationId: "maskrel_body_masks_star",
      maskDrawableIds: ["draw_body"],
      targetDrawableIds: ["draw_workflow_star"],
      enabled: true
    });
    const opacity = first.commitAddDrawableOpacityKeyform({
      parameterId: "param_preview_body_yaw",
      drawableId: "draw_workflow_star",
      keyValue: 1,
      opacity: 0.4
    });

    first.setPreviewParameterValue("param_preview_body_yaw", 1);
    first.openViewerRuntimeSurface();
    first.setViewerParameterValue("param_preview_body_yaw", 1);
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();
    second.openViewerRuntimeSurface();
    second.setViewerParameterValue("param_preview_body_yaw", 1);

    expect(drawable.status).toBe("committed");
    expect(maskRelation.status).toBe("committed");
    expect(opacity.status).toBe("committed");
    expect(first.state.maskRelations).toContainEqual(expect.objectContaining({
      maskRelationId: "maskrel_body_masks_star",
      maskDrawableIds: ["draw_body"],
      targetDrawableIds: ["draw_workflow_star"],
      enabled: true
    }));
    expect(first.state.drawableOpacityKeyforms).toContainEqual(expect.objectContaining({
      drawableId: "draw_workflow_star",
      parameterId: "param_preview_body_yaw",
      keyValue: 1,
      opacity: 0.4
    }));
    expect(first.previewProjection?.drawables).toContainEqual(expect.objectContaining({
      drawableId: "draw_workflow_star",
      opacity: 0.4
    }));
    expect(first.viewerRuntimeProjection?.snapshotSummary).toMatchObject({
      maskRelationCount: 1,
      maskRelations: [
        expect.objectContaining({
          maskRelationId: "maskrel_body_masks_star",
          sourceDrawableLabel: "draw_body",
          targetDrawableLabel: "draw_workflow_star",
          clippingIntent: "semanticClipping"
        })
      ],
      drawableOpacityEvidence: expect.arrayContaining([
        expect.objectContaining({
          drawableId: "draw_workflow_star",
          opacity: 0.4
        })
      ])
    });
    expect(saved.snapshot.document.model.masks.masks).toContainEqual(expect.objectContaining({
      maskRelationId: "maskrel_body_masks_star",
      maskDrawableIds: ["draw_body"],
      targetDrawableIds: ["draw_workflow_star"]
    }));
    expect(saved.snapshot.document.model.keyforms.keyformSets).toContainEqual(expect.objectContaining({
      target: {
        kind: "drawable",
        id: "draw_workflow_star",
        property: "opacity"
      },
      parameterId: "param_preview_body_yaw"
    }));
    expect(loaded.status).toBe("loaded");
    expect(second.state.maskRelations).toContainEqual(expect.objectContaining({
      maskRelationId: "maskrel_body_masks_star",
      maskDrawableIds: ["draw_body"],
      targetDrawableIds: ["draw_workflow_star"]
    }));
    expect(second.state.drawableOpacityKeyforms).toContainEqual(expect.objectContaining({
      drawableId: "draw_workflow_star",
      parameterId: "param_preview_body_yaw",
      opacity: 0.4
    }));
    expect(second.viewerRuntimeProjection?.snapshotSummary.maskRelations).toContainEqual(
      expect.objectContaining({
        maskRelationId: "maskrel_body_masks_star",
        sourceDrawableLabel: "draw_body",
        targetDrawableLabel: "draw_workflow_star"
      })
    );
    expect(second.viewerRuntimeProjection?.snapshotSummary.drawableOpacityEvidence).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_workflow_star",
        opacity: 0.4
      })
    );
  });

  it("rejects invalid mask relation input without mutating composition state", () => {
    const workflow = createWorkflow(createMemoryStorage());

    const rejected = workflow.commitSetMaskRelation({
      maskDrawableIds: ["draw_body"],
      targetDrawableIds: ["draw_body"],
      enabled: true
    });

    expect(rejected.status).toBe("rejected");
    expect(workflow.state.maskRelations).toEqual([]);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.composition.lastCompositionDiagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.setMaskRelation.selfMask",
        severity: "error"
      })
    ]));
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

const createDrawablePresetCommand = (name: "star") => ({
  createOperationId: `op_workflow_create_drawable_${name}`,
  generateOperationId: `op_workflow_generate_mesh_${name}`,
  displayName: `Workflow ${capitalize(name)}`,
  sourceAssetId: "src_generated",
  sourceLayerId: "layer_body",
  partId: "part_root",
  initialBounds: { x: 16, y: 24, width: 24, height: 24 },
  meshMethod: "auto-grid-v1",
  densityHint: "low"
} as const);

const capitalize = (text: string): string =>
  `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;

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
