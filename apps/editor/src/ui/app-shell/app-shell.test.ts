import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  createInitialEditorSemanticState,
  createPreviewParameterControlTestId,
  editorTestIds,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "../../editor-state/index.js";
import { createEditorWorkflowController } from "../../editor-workflow/workflow-controller.js";
import { createBrowserProjectStore, type StorageLike } from "../../project-persistence/index.js";
import { createEditorAppShell } from "./app-shell.js";

describe("editor app shell preview panel", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders the embedded preview panel from runtime projection and preview controls", () => {
    const workflow = createWorkflow();
    const shell = renderShell(workflow);

    expect(findByTestId(shell, editorTestIds.previewPanel)?.textContent).toContain("Preview");
    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain("1 visible / 1 total");
    expect(findByTestId(shell, editorTestIds.previewVisual)?.textContent).not.toContain("No runtime drawables");
    expect(findByTestId(shell, createPreviewParameterControlTestId("param_preview_body_yaw"))?.getAttribute("aria-label")).toBe(
      "Preview Body Yaw"
    );
  });

  it("wires slider and reset callbacks", () => {
    const workflow = createWorkflow();
    const calls: Array<readonly [string, number]> = [];
    let resetCount = 0;
    const shell = renderShell(workflow, {
      onSetPreviewParameterValue(parameterId, value) {
        calls.push([parameterId, value]);
      },
      onResetPreviewParameterValues() {
        resetCount += 1;
      }
    });

    const slider = findByTestId(shell, createPreviewParameterControlTestId("param_preview_body_yaw"));
    expect(slider).not.toBeNull();
    slider?.setProperty("value", "1");
    slider?.emit("input");
    findByTestId(shell, editorTestIds.previewReset)?.emit("click");

    expect(calls).toEqual([["param_preview_body_yaw", 1]]);
    expect(resetCount).toBe(1);
  });

  it("updates the projected visual and summary after a preview parameter change", () => {
    const workflow = createWorkflow();
    const initialShell = renderShell(workflow);
    const initialPoints = findByTag(initialShell, "polygon")?.getAttribute("points");

    workflow.setPreviewParameterValue("param_preview_body_yaw", 1);
    const updatedShell = renderShell(workflow);

    expect(findByTag(updatedShell, "polygon")?.getAttribute("points")).not.toBe(initialPoints);
    expect(findByTestId(updatedShell, editorTestIds.previewSummary)?.textContent).toContain("2 changes");
  });

  it("renders no-preview and disabled-control states without throwing", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_disabled_preview",
        packageDisplayName: "Disabled Preview",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      parameters: [
        {
          parameterId: "param_computed",
          displayName: "Computed",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ]
    });
    const shell = createEditorAppShell({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      previewProjection: null,
      latestPersistenceResult: null,
      latestProjectPersistenceResult: null,
      onCommitCreateParameter() {},
      onSaveProject() {},
      onLoadProject() {},
      onResetProject() {},
      onSetPreviewParameterValue() {},
      onResetPreviewParameterValues() {},
      async onDryRunAiCreateParameter() {},
      async onApproveLatestAiDryRun() {},
      async onRejectLatestAiDryRun() {},
      async onCommitApprovedAiOperation() {}
    }) as unknown as TestElement;

    expect(findByTestId(shell, editorTestIds.previewSummary)?.textContent).toContain("No preview snapshot");
    expect(findByTestId(shell, createPreviewParameterControlTestId("param_computed"))?.disabled).toBe(true);
    expect(findByTestId(shell, editorTestIds.previewReset)?.disabled).toBe(true);
  });

  it("renders an empty preview control state", () => {
    const state = createInitialEditorSemanticState();
    const shell = createEditorAppShell({
      state,
      viewModel: projectEditorWorkflowViewModel(state),
      previewProjection: null,
      latestPersistenceResult: null,
      latestProjectPersistenceResult: null,
      onCommitCreateParameter() {},
      onSaveProject() {},
      onLoadProject() {},
      onResetProject() {},
      onSetPreviewParameterValue() {},
      onResetPreviewParameterValues() {},
      async onDryRunAiCreateParameter() {},
      async onApproveLatestAiDryRun() {},
      async onRejectLatestAiDryRun() {},
      async onCommitApprovedAiOperation() {}
    }) as unknown as TestElement;

    expect(findByTestId(shell, editorTestIds.previewEmpty)?.textContent).toBe("No package loaded");
  });
});

const renderShell = (
  workflow: ReturnType<typeof createEditorWorkflowController>,
  callbacks: {
    readonly onSetPreviewParameterValue?: (parameterId: string, value: number) => void;
    readonly onResetPreviewParameterValues?: () => void;
  } = {}
): TestElement =>
  createEditorAppShell({
    state: workflow.state,
    viewModel: workflow.viewModel,
    previewProjection: workflow.previewProjection,
    latestPersistenceResult: workflow.latestSessionPersistenceResult,
    latestProjectPersistenceResult: workflow.latestProjectPersistenceResult,
    onCommitCreateParameter() {},
    onSaveProject() {},
    onLoadProject() {},
    onResetProject() {},
    onSetPreviewParameterValue: callbacks.onSetPreviewParameterValue ?? (() => {}),
    onResetPreviewParameterValues: callbacks.onResetPreviewParameterValues ?? (() => {}),
    async onDryRunAiCreateParameter() {},
    async onApproveLatestAiDryRun() {},
    async onRejectLatestAiDryRun() {},
    async onCommitApprovedAiOperation() {}
  }) as unknown as TestElement;

const createWorkflow = () =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage: createMemoryStorage(),
      now: () => new Date("2026-05-30T00:00:00.000Z")
    }),
    now: () => new Date("2026-05-30T00:00:00.000Z")
  });

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const findByTag = (root: TestElement, tagName: string): TestElement | null =>
  root.queryByPredicate((element) => element.tagName === tagName);

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  readonly style: Record<string, string> = {};
  readonly classList = {
    add: (...classNames: string[]) => {
      this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...classNames])].join(" ");
    }
  };
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  htmlFor = "";
  type = "";
  min = "";
  max = "";
  step = "";
  value = "";
  name = "";
  required = false;
  disabled = false;
  private ownText = "";

  constructor(readonly tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? "";
    this.children.splice(0, this.children.length);
  }

  append(...nodes: Array<TestElement | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        const text = new TestElement("#text");
        text.textContent = node;
        this.append(text);
        continue;
      }

      node.parentElement = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: TestElement[]): void {
    this.children.splice(0, this.children.length);
    this.append(...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "aria-label" || name === "role") {
      return;
    }
    if (name === "id") {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  setProperty(name: "value", value: string): void {
    this[name] = value;
  }

  queryByPredicate(predicate: (element: TestElement) => boolean): TestElement | null {
    if (predicate(this)) {
      return this;
    }

    for (const child of this.children) {
      const match = child.queryByPredicate(predicate);
      if (match !== null) {
        return match;
      }
    }

    return null;
  }
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    },
    createElementNS(_namespace: string, tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};

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
