import { describe, expect, it } from "vitest";

import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("viewer runtime workflow", () => {
  it("opens the viewer runtime surface and projects a viewer snapshot", () => {
    const workflow = createWorkflow();

    expect(workflow.viewerRuntimeProjection).toBeNull();
    workflow.openViewerRuntimeSurface();
    const projection = workflow.viewerRuntimeProjection;

    expect(projection).not.toBeNull();
    expect(projection?.snapshotSummary.surface).toBe("viewer");
    expect(projection?.snapshotSummary.packageId).toBe("pkg_editor_browser_sample");
    expect(projection?.snapshotSummary.parameterCount).toBeGreaterThan(0);
    expect(projection?.validation.reportId).toBe("val_editor_browser_sample_editorIncremental");
  });

  it("updates viewer snapshot summaries from viewer parameter overrides", () => {
    const workflow = createWorkflow();
    workflow.openViewerRuntimeSurface();
    const before = workflow.viewerRuntimeProjection;

    workflow.setViewerParameterValue("param_preview_body_yaw", 1);
    const after = workflow.viewerRuntimeProjection;

    expect(before?.snapshotSummary.overrideCount).toBe(0);
    expect(after?.snapshotSummary.overrideCount).toBe(1);
    expect(after?.snapshotSummary.parameterValues).toContainEqual(
      expect.objectContaining({
        parameterId: "param_preview_body_yaw",
        effectiveValue: 1,
        source: "viewerOverride"
      })
    );
    expect(after?.runtimeDiff.parameterChangeCount).toBeGreaterThan(0);
  });

  it("recomputes viewer projection after browser-local save and load", () => {
    const workflow = createWorkflow();
    workflow.saveProject();
    workflow.loadProject();
    workflow.openViewerRuntimeSurface();
    workflow.setViewerParameterValue("param_preview_body_yaw", -1);

    expect(workflow.viewerRuntimeProjection?.snapshotSummary.parameterValues).toContainEqual(
      expect.objectContaining({
        parameterId: "param_preview_body_yaw",
        effectiveValue: -1,
        source: "viewerOverride"
      })
    );
  });
});

const createWorkflow = () =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage: createMemoryStorage(),
      now: () => new Date("2026-06-01T00:00:00.000Z")
    }),
    now: () => new Date("2026-06-01T00:00:00.000Z")
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
