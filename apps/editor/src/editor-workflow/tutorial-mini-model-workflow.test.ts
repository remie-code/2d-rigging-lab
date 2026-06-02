import { TUTORIAL_MINI_MODEL_IDS } from "@private-2d-rigging-lab/authoring-core";
import { describe, expect, it } from "vitest";

import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("editor tutorial mini model workflow", () => {
  it("creates the synthetic tutorial mini model with semantic Preview and Viewer evidence", () => {
    const workflow = createWorkflow();

    const created = workflow.createTutorialMiniModel();
    workflow.openViewerRuntimeSurface();
    const previewTutorialEvidence = workflow.previewProjection?.tutorialEvidenceSummary;
    const viewerTutorialEvidence =
      workflow.viewerRuntimeProjection?.previewProjection.tutorialEvidenceSummary;
    const previewViewerValidatorStep = workflow.state.tutorialGuidedWorkflow.steps.find(
      (step) => step.stepId === "previewViewerValidator"
    );
    const browserLocalSaveLoadStep = workflow.state.tutorialGuidedWorkflow.steps.find(
      (step) => step.stepId === "browserLocalSaveLoad"
    );

    expect(created.status).toBe("created");
    expect(workflow.state.loadedPackage?.packageId).toBe(TUTORIAL_MINI_MODEL_IDS.packageId);
    expect(workflow.state.parts.map((part) => part.partId)).toEqual(
      expect.arrayContaining([
        TUTORIAL_MINI_MODEL_IDS.parts.body,
        TUTORIAL_MINI_MODEL_IDS.parts.head,
        TUTORIAL_MINI_MODEL_IDS.parts.face,
        TUTORIAL_MINI_MODEL_IDS.parts.frontHair,
        TUTORIAL_MINI_MODEL_IDS.parts.arm
      ])
    );
    expect(workflow.state.tutorialGuidedWorkflow.readiness).toMatchObject({
      status: "inProgress",
      readyStepCount: 7,
      missingStepIds: ["browserLocalSaveLoad"]
    });
    expect(browserLocalSaveLoadStep).toMatchObject({
      status: "missingEvidence",
      missingEvidence: ["browser-local save/load reload summary"]
    });
    expect(previewViewerValidatorStep).toMatchObject({
      status: "ready",
      evidenceRefs: expect.arrayContaining([
        expect.objectContaining({
          kind: "tutorialReadinessReport",
          id: "val_tutorial_mini_model_tutorialReadiness"
        })
      ])
    });
    expect(previewTutorialEvidence).toBeDefined();
    if (previewTutorialEvidence === undefined) {
      throw new Error("Expected tutorial preview evidence summary.");
    }
    expect(previewTutorialEvidence.semanticReadiness.presentSlices).toEqual(
      expect.arrayContaining(["layers", "drawables", "meshes", "maskOpacity", "rigControls", "dynamics"])
    );
    expect(previewTutorialEvidence.renderedCorrectness.status).toBe("not_evaluated");
    expect(workflow.viewerRuntimeProjection?.snapshotSummary).toMatchObject({
      packageId: TUTORIAL_MINI_MODEL_IDS.packageId,
      drawableCount: 8,
      rigControlCount: 1,
      dynamicsCount: 1,
      maskRelationCount: 1
    });
    expect(viewerTutorialEvidence).toBeDefined();
    if (viewerTutorialEvidence === undefined) {
      throw new Error("Expected tutorial viewer evidence summary.");
    }
    expect(viewerTutorialEvidence.renderedCorrectness).toMatchObject(
      {
        status: "not_evaluated",
        fullRenderer: false,
        pixelOracle: false
      }
    );
  });

  it("applies a small existing mesh edit and restores tutorial readiness after browser-local save/load", () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);

    workflow.createTutorialMiniModel();
    const edit = workflow.applyTutorialSmallEdit();
    const saved = workflow.saveProject();
    const reloaded = createWorkflow(storage);
    const loaded = reloaded.loadProject();
    const reloadedPreviewTutorialEvidence = reloaded.previewProjection?.tutorialEvidenceSummary;

    expect(edit.status).toBe("committed");
    expect(edit.status === "committed" ? edit.meshId : "").toBe(TUTORIAL_MINI_MODEL_IDS.meshes.frontHair);
    expect(saved.snapshot.document.model.editorState?.selection).toContain(
      TUTORIAL_MINI_MODEL_IDS.drawables.frontHair
    );
    expect(saved.snapshot.operationLogEntries.at(-1)?.operationType).toBe("moveMeshVertex");
    expect(loaded.status).toBe("loaded");
    expect(reloaded.state.loadedPackage?.packageId).toBe(TUTORIAL_MINI_MODEL_IDS.packageId);
    expect(reloaded.state.tutorialGuidedWorkflow.readiness.status).toBe("ready");
    expect(reloaded.state.tutorialGuidedWorkflow.steps.find(
      (step) => step.stepId === "browserLocalSaveLoad"
    )?.status).toBe("ready");
    expect(reloaded.state.tutorialGuidedWorkflow.steps.find(
      (step) => step.stepId === "previewViewerValidator"
    )).toMatchObject({
      status: "ready",
      evidenceRefs: expect.arrayContaining([
        expect.objectContaining({
          kind: "tutorialReadinessReport",
          id: "val_tutorial_mini_model_tutorialReadiness"
        })
      ])
    });
    expect(reloadedPreviewTutorialEvidence).toBeDefined();
    if (reloadedPreviewTutorialEvidence === undefined) {
      throw new Error("Expected reloaded tutorial preview evidence summary.");
    }
    expect(reloadedPreviewTutorialEvidence.semanticReadiness.presentSlices).toEqual(
      expect.arrayContaining(["layers", "drawables", "meshes", "maskOpacity", "rigControls", "dynamics"])
    );
  });
});

const createWorkflow = (storage: StorageLike = createMemoryStorage()) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-06-02T01:00:00.000Z")
    }),
    now: () => new Date("2026-06-02T01:00:00.000Z")
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
