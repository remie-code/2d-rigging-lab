import { describe, expect, it } from "vitest";

import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("editor product preflight workflow", () => {
  it("runs product preflight and can rerun after browser-local save/load", async () => {
    const workflow = createEditorWorkflowController({
      projectStore: createBrowserProjectStore({
        storage: createMemoryStorage(),
        now: () => new Date("2026-06-04T00:00:00.000Z")
      }),
      now: () => new Date("2026-06-04T00:00:00.000Z")
    });

    const first = await workflow.runProductPreflight();
    if (first.status !== "completed") {
      throw new Error(first.message);
    }
    const firstStatuses = statusByCategory(workflow.state.productPreflight.categories);

    expect(workflow.state.productPreflight.status).toBe("ready");
    expect(workflow.state.productPreflight.reportId).toBe("preflight_editor_browser_sample");
    expect(firstStatuses.get("runtimeViewerEvidence")).not.toBe("not_evaluated");
    expect(workflow.state.productPreflight.categoryCounts.not_evaluated).toBeGreaterThan(0);

    workflow.saveProject();
    workflow.loadProject();
    expect(workflow.state.productPreflight.status).toBe("not_run");

    const second = await workflow.runProductPreflight();
    if (second.status !== "completed") {
      throw new Error(second.message);
    }

    expect(statusByCategory(workflow.state.productPreflight.categories)).toEqual(firstStatuses);
    expect(workflow.state.productPreflight.reportId).toBe("preflight_editor_browser_sample");
  });
});

const statusByCategory = (
  categories: readonly {
    readonly category: string;
    readonly status: string;
  }[]
): Map<string, string> =>
  new Map(categories.map((category) => [category.category, category.status]));

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
