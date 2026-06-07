import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createWorkspaceDiagnosticsStripSurface,
  createWorkspaceInspectorSurface,
  createWorkspaceParameterBarSurface,
  workspaceContextSurfaceTestIds
} from "./workspace-context-surfaces.js";

describe("workspace context surfaces", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders an inspector summary surface with contextual callbacks and no raw evidence fields", () => {
    const calls: string[] = [];
    const inspector = createWorkspaceInspectorSurface({
      project: {
        title: "Sample Project",
        status: "Package r3 saved",
        facts: [
          { label: "Drawables", value: "4" },
          { label: "Warnings", value: "1" }
        ]
      },
      selection: {
        kind: "drawable",
        label: "Face Shadow",
        status: "Drawable selected",
        facts: [
          { label: "Visibility", value: "Editor visible / runtime visible" },
          { label: "Draw order", value: "Front of head" }
        ]
      },
      tool: {
        label: "Rig",
        status: "Rotation target ready",
        facts: [{ label: "Target", value: "Face Shadow opacity" }]
      },
      onRevealSelectionInPartsTree() {
        calls.push("reveal");
      },
      onFocusSelectionInCanvas() {
        calls.push("focus");
      },
      onOpenToolDetails() {
        calls.push("tool");
      }
    }) as unknown as TestElement;

    expect(inspector.dataset.workspaceContextSurface).toBe("inspector");
    expect(findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorProjectSummary)?.textContent).toContain(
      "Sample Project"
    );
    expect(findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorSelectionSummary)?.textContent).toContain(
      "Face Shadow"
    );
    expect(findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorToolSummary)?.textContent).toContain(
      "Rotation target ready"
    );
    expect(inspector.textContent.toLowerCase()).not.toContain("operation id");
    expect(inspector.textContent.toLowerCase()).not.toContain("evidence path");
    expect(inspector.textContent.toLowerCase()).not.toContain("generated refs");

    findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorRevealSelection)?.emit("click");
    findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorFocusCanvas)?.emit("click");
    findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorOpenToolDetails)?.emit("click");

    expect(calls).toEqual(["reveal", "focus", "tool"]);
  });

  it("disables inspector selection actions when there is no selected target", () => {
    const inspector = createWorkspaceInspectorSurface({
      project: {
        title: "Empty Project",
        status: "Ready"
      },
      selection: null,
      tool: null,
      onRevealSelectionInPartsTree() {},
      onFocusSelectionInCanvas() {},
      onOpenToolDetails() {}
    }) as unknown as TestElement;

    expect(findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorSelectionSummary)?.dataset.workspaceContextEmpty).toBe(
      "true"
    );
    expect(findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorRevealSelection)?.disabled).toBe(true);
    expect(findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorFocusCanvas)?.disabled).toBe(true);
    expect(findByTestId(inspector, workspaceContextSurfaceTestIds.inspectorOpenToolDetails)?.disabled).toBe(true);
  });

  it("renders Parameter Bar v0 as one active-parameter value surface", () => {
    const calls: unknown[] = [];
    const parameterBar = createWorkspaceParameterBarSurface({
      activeParameter: {
        parameterId: "param_angle_x",
        displayName: "Angle X",
        min: -30,
        max: 30,
        defaultValue: 0,
        currentValue: 10,
        recommendedUiStep: 0.5,
        valueSourceLabel: "authored input",
        keyMarkers: [
          { value: -30, label: "Left" },
          { value: 10, label: "Current", selected: true },
          { value: 30, label: "Right" }
        ]
      },
      onChangeCurrentValue(parameterId, value) {
        calls.push(["change", parameterId, value]);
      },
      onResetCurrentValue(parameterId) {
        calls.push(["reset", parameterId]);
      },
      onAddOrUpdateKeyform(parameterId, value) {
        calls.push(["keyform", parameterId, value]);
      },
      onPreviousKeyform(parameterId) {
        calls.push(["previous", parameterId]);
      },
      onNextKeyform(parameterId) {
        calls.push(["next", parameterId]);
      },
      onQuickCreateParameter() {
        calls.push(["quickCreate"]);
      },
      onOpenParameterManager() {
        calls.push(["manager"]);
      }
    }) as unknown as TestElement;

    expect(parameterBar.dataset.workspaceContextSurface).toBe("parameterBar");
    expect(parameterBar.textContent).toContain("Angle X / param_angle_x");
    expect(parameterBar.textContent).toContain("Current: 10 / authored input");
    expect(parameterBar.textContent).toContain("Left: -30");
    expect(parameterBar.textContent.toLowerCase()).not.toContain("all keyform table");
    expect(parameterBar.textContent.toLowerCase()).not.toContain("operation id");

    const slider = findByTestId(parameterBar, workspaceContextSurfaceTestIds.parameterBarCurrentValue);
    slider?.setProperty("value", "12.5");
    slider?.emit("input");
    expect(parameterBar.textContent).toContain("Current: 12.5 / authored input");
    findByTestId(parameterBar, workspaceContextSurfaceTestIds.parameterBarAddOrUpdateKeyform)?.emit("click");
    findByTestId(parameterBar, workspaceContextSurfaceTestIds.parameterBarPreviousKey)?.emit("click");
    findByTestId(parameterBar, workspaceContextSurfaceTestIds.parameterBarNextKey)?.emit("click");
    findByTestId(parameterBar, workspaceContextSurfaceTestIds.parameterBarReset)?.emit("click");
    findByTestId(parameterBar, workspaceContextSurfaceTestIds.parameterBarQuickCreate)?.emit("click");
    findByTestId(parameterBar, workspaceContextSurfaceTestIds.parameterBarOpenManager)?.emit("click");

    expect(calls).toEqual([
      ["change", "param_angle_x", 12.5],
      ["keyform", "param_angle_x", 12.5],
      ["previous", "param_angle_x"],
      ["next", "param_angle_x"],
      ["reset", "param_angle_x"],
      ["quickCreate"],
      ["manager"]
    ]);
  });

  it("renders Parameter Bar empty and blocked states without implementing Parameter Manager", () => {
    const calls: string[] = [];
    const emptyBar = createWorkspaceParameterBarSurface({
      activeParameter: null,
      onQuickCreateParameter() {
        calls.push("quickCreate");
      },
      onOpenParameterManager() {
        calls.push("manager");
      }
    }) as unknown as TestElement;

    expect(emptyBar.textContent).toContain("No active parameter selected.");
    expect(findByTestId(emptyBar, workspaceContextSurfaceTestIds.parameterBarCurrentValue)).toBeNull();
    findByTestId(emptyBar, workspaceContextSurfaceTestIds.parameterBarQuickCreate)?.emit("click");
    findByTestId(emptyBar, workspaceContextSurfaceTestIds.parameterBarOpenManager)?.emit("click");

    const blockedBar = createWorkspaceParameterBarSurface({
      activeParameter: {
        parameterId: "param_dynamics",
        displayName: "Dynamics Output",
        min: -1,
        max: 1,
        defaultValue: 0,
        currentValue: 0,
        recommendedUiStep: 0.01,
        disabled: true,
        disabledReason: "Computed dynamics output"
      },
      onChangeCurrentValue() {
        calls.push("blocked-change");
      },
      onResetCurrentValue() {
        calls.push("blocked-reset");
      }
    }) as unknown as TestElement;

    expect(findByTestId(blockedBar, workspaceContextSurfaceTestIds.parameterBarCurrentValue)?.disabled).toBe(true);
    expect(findByTestId(blockedBar, workspaceContextSurfaceTestIds.parameterBarReset)?.disabled).toBe(true);
    findByTestId(blockedBar, workspaceContextSurfaceTestIds.parameterBarCurrentValue)?.emit("input");
    findByTestId(blockedBar, workspaceContextSurfaceTestIds.parameterBarReset)?.emit("click");

    expect(calls).toEqual(["quickCreate", "manager"]);
  });

  it("renders Diagnostics Strip as blocking and warning summary only", () => {
    const calls: string[] = [];
    const strip = createWorkspaceDiagnosticsStripSurface({
      blockingCount: 1,
      warningCount: 2,
      statusLabel: "1 blocking / 2 warnings",
      maxVisibleItems: 2,
      items: [
        { severity: "blocking", label: "Schema validation blocked", targetLabel: "Model structure" },
        { severity: "warning", label: "Runtime evidence missing", targetLabel: "Viewer check" },
        { severity: "warning", label: "Texture placement needs review", targetLabel: "Atlas status" }
      ],
      onOpenDiagnostics() {
        calls.push("open");
      }
    }) as unknown as TestElement;

    expect(strip.dataset.workspaceContextSurface).toBe("diagnosticsStrip");
    expect(findByTestId(strip, workspaceContextSurfaceTestIds.diagnosticsStripSummary)?.textContent).toBe(
      "1 blocking / 2 warnings"
    );
    expect(strip.textContent).toContain("Schema validation blocked / Model structure");
    expect(strip.textContent).toContain("1 more summary item");
    expect(strip.textContent.toLowerCase()).not.toContain("operation id");
    expect(strip.textContent.toLowerCase()).not.toContain("evidence path");
    expect(strip.textContent.toLowerCase()).not.toContain("generated refs");

    findByTestId(strip, workspaceContextSurfaceTestIds.diagnosticsStripOpenDetails)?.emit("click");

    expect(calls).toEqual(["open"]);
  });
});

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  type = "";
  min = "";
  max = "";
  step = "";
  value = "";
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

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
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
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};
