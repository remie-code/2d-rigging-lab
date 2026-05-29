import { describe, expect, it } from "vitest";

import { createBrowserProjectStore } from "../project-persistence/index.js";
import type { StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("editor workflow controller", () => {
  it("restores parameter and reload summary after commit, save, and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateParameter(createParameterCommand("smile"));
    const saved = first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(saved.status).toBe("saved");
    expect(loaded.status).toBe("loaded");
    expect(second.state.parameters).toEqual([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        displayName: "Workflow Smile"
      })
    ]);
    expect(second.state.reload).toMatchObject({
      status: "reloaded",
      packageRevision: 1,
      parameterCount: 1,
      parameterIds: ["param_workflow_smile"]
    });
    expect(second.state.operationLog.entryCount).toBe(1);
    expect(second.state.generatedEvidence.validationReportArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_workflow_create_parameter_smile_baseline.validation.json",
        "validation/reports/val_editor_workflow_create_parameter_smile_candidate.validation.json"
      ])
    );
  });

  it("appends operation log entries after loading a persisted project", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    first.commitCreateParameter(createParameterCommand("smile"));
    first.saveProject();

    const second = createWorkflow(storage);
    second.loadProject();
    const commit = second.commitCreateParameter(createParameterCommand("brow"));

    expect(commit.operationLogEntries.map((entry) => entry.operationId)).toEqual([
      "op_workflow_create_parameter_smile",
      "op_workflow_create_parameter_brow"
    ]);
    expect(commit.operationLogJsonl.trim().split("\n")).toHaveLength(2);
    expect(second.state.operationLog.entryCount).toBe(2);
    expect(second.state.parameters.map((parameter) => parameter.parameterId)).toEqual([
      "param_workflow_smile",
      "param_workflow_brow"
    ]);
  });

  it("clears persisted state and returns to the sample package on reset", () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);
    workflow.commitCreateParameter(createParameterCommand("smile"));
    workflow.saveProject();

    const reset = workflow.resetToSamplePackage();

    expect(reset.status).toBe("reset");
    expect(workflow.state.loadedPackage?.packageId).toBe("pkg_editor_browser_sample");
    expect(workflow.state.revision.packageRevision).toBe(0);
    expect(workflow.state.parameters).toEqual([]);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.state.reload.status).toBe("not_reloaded");
    expect(storage.getItem(reset.clearResult.storageKey)).toBeNull();
  });
});

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T04:00:00.000Z")
    }),
    now: () => new Date("2026-05-29T04:00:00.000Z")
  });

const createParameterCommand = (name: "smile" | "brow") => ({
  operationId: `op_workflow_create_parameter_${name}`,
  parameterId: `param_workflow_${name}`,
  displayName: `Workflow ${capitalize(name)}`,
  semanticRole: name === "smile" ? "mouth" : "brow",
  projectPresetAlias: `private-workflow-${name}-control`,
  min: 0,
  max: 1,
  defaultValue: 0,
  recommendedUiStep: 0.01
} as const);

const capitalize = (text: string): string =>
  `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;

const createMemoryStorage = (
  entries: readonly (readonly [string, string])[] = []
): StorageLike => {
  const values = new Map(entries);

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
