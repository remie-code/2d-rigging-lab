import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { shellSurfaces } from "./shell-surfaces.js";
import { createTaskShell } from "./task-shell.js";

describe("task shell", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders title, status, content, and shell surface metadata", () => {
    const shell = createTaskShell({
      surface: shellSurfaces.projectStorageTask,
      surfaceMetadata: { group: "project-storage" },
      title: "Project Storage",
      status: "Ready to save",
      content: createSlotElement("p", "Save, load, export, or import a project.")
    }) as unknown as TestElement;

    const status = findByRegion(shell, "status");

    expect(shell.dataset.shellSurfaceId).toBe(shellSurfaces.projectStorageTask.id);
    expect(shell.dataset.shellSurfaceKind).toBe(shellSurfaces.projectStorageTask.kind);
    expect(shell.dataset.shellSurfaceLabel).toBe(shellSurfaces.projectStorageTask.label);
    expect(shell.dataset.shellSurfaceGroup).toBe("project-storage");
    expect(findByRegion(shell, "heading")?.textContent).toContain("Project Storage");
    expect(status?.textContent).toBe("Ready to save");
    expect(findByRegion(shell, "content")?.textContent).toContain("Save, load");
    expect(shell.getAttribute("aria-describedby")).toBe(status?.id);
  });

  it("renders action, action status, diagnostics, and content slots into stable regions", () => {
    const shell = createTaskShell({
      surface: shellSurfaces.validationTask,
      surfaceMetadata: { group: "validation-task" },
      title: "Product Preflight",
      status: "Warnings available",
      primaryAction: createSlotElement("button", "Run preflight"),
      secondaryAction: [
        createSlotElement("button", "Export report"),
        createSlotElement("button", "Copy summary")
      ],
      actionStatus: createSlotElement("span", "Last run completed"),
      diagnosticsSummary: createSlotElement("p", "2 warnings"),
      content: createSlotElement("div", "Validation content")
    }) as unknown as TestElement;

    expect(findByRegion(shell, "actions")?.textContent).toContain("Run preflight");
    expect(findByRegion(shell, "primary-action")?.textContent).toContain("Run preflight");
    expect(findByRegion(shell, "secondary-action")?.textContent).toContain("Export report");
    expect(findByRegion(shell, "secondary-action")?.textContent).toContain("Copy summary");
    expect(findByRegion(shell, "action-status")?.textContent).toBe("Last run completed");
    expect(findByRegion(shell, "diagnostics")?.textContent).toBe("2 warnings");
    expect(findByRegion(shell, "content")?.textContent).toBe("Validation content");
  });

  it("uses native back and close buttons with labels, state, and callbacks", () => {
    const calls: string[] = [];
    const shell = createTaskShell({
      surface: shellSurfaces.diagnosticsEvidenceView,
      surfaceMetadata: { group: "diagnostics-evidence" },
      title: "Diagnostics",
      status: "Evidence ready",
      back: {
        ariaLabel: "Return to authoring workspace",
        onClick: () => {
          calls.push("back");
        }
      },
      close: {
        ariaLabel: "Close diagnostics view",
        onClick: () => {
          calls.push("close");
        }
      },
      content: createSlotElement("p", "Diagnostics content")
    }) as unknown as TestElement;

    const back = findByAriaLabel(shell, "Return to authoring workspace");
    const close = findByAriaLabel(shell, "Close diagnostics view");

    expect(back?.tagName).toBe("button");
    expect(back?.type).toBe("button");
    expect(back?.disabled).toBe(false);
    expect(close?.tagName).toBe("button");
    expect(close?.type).toBe("button");
    expect(close?.disabled).toBe(false);

    back?.emit("click");
    close?.emit("click");

    expect(calls).toEqual(["back", "close"]);

    const disabledShell = createTaskShell({
      surface: shellSurfaces.diagnosticsEvidenceView,
      surfaceMetadata: { group: "diagnostics-evidence-busy" },
      title: "Diagnostics",
      status: "Closing",
      back: {
        ariaLabel: "Back disabled",
        disabled: true,
        onClick: () => {
          calls.push("disabled-back");
        }
      },
      close: {
        ariaLabel: "Close busy",
        busy: true,
        onClick: () => {
          calls.push("busy-close");
        }
      }
    }) as unknown as TestElement;

    const disabledBack = findByAriaLabel(disabledShell, "Back disabled");
    const busyClose = findByAriaLabel(disabledShell, "Close busy");

    expect(disabledBack?.disabled).toBe(true);
    expect(disabledBack?.getAttribute("aria-disabled")).toBe("true");
    expect(busyClose?.disabled).toBe(true);
    expect(busyClose?.getAttribute("aria-busy")).toBe("true");
    expect(busyClose?.getAttribute("aria-disabled")).toBe("true");

    disabledBack?.emit("click");
    busyClose?.emit("click");

    expect(calls).toEqual(["back", "close"]);
  });

  it("omits optional regions when actions and slots are absent", () => {
    const shell = createTaskShell({
      surface: shellSurfaces.tutorialTask,
      surfaceMetadata: { group: "tutorial-task" },
      title: "Tutorial",
      status: "Not started"
    }) as unknown as TestElement;

    expect(findByRegion(shell, "navigation")).toBeNull();
    expect(findByRegion(shell, "actions")).toBeNull();
    expect(findByRegion(shell, "primary-action")).toBeNull();
    expect(findByRegion(shell, "secondary-action")).toBeNull();
    expect(findByRegion(shell, "action-status")).toBeNull();
    expect(findByRegion(shell, "diagnostics")).toBeNull();
    expect(findByRegion(shell, "content")).toBeNull();
    expect(shell.queryAllByPredicate((element) => element.tagName === "button")).toHaveLength(0);
  });

  it("stays generic for non-PSD views such as Codex automation", () => {
    const shell = createTaskShell({
      surface: shellSurfaces.codexAutomationView,
      surfaceMetadata: { group: "codex-automation" },
      title: "Codex Automation",
      status: "Review waiting",
      content: createSlotElement("p", "Proposal and approval transcript.")
    }) as unknown as TestElement;

    expect(shell.dataset.shellSurfaceId).toBe(shellSurfaces.codexAutomationView.id);
    expect(shell.dataset.shellSurfaceKind).toBe("view");
    expect(shell.textContent).toContain("Codex Automation");
    expect(shell.textContent).not.toContain("PSD");
  });
});

const createSlotElement = (tagName: string, text: string): HTMLElement => {
  const element = document.createElement(tagName);
  element.textContent = text;
  return element;
};

const findByRegion = (root: TestElement, region: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.taskShellRegion === region);

const findByAriaLabel = (root: TestElement, ariaLabel: string): TestElement | null =>
  root.queryByPredicate((element) => element.getAttribute("aria-label") === ariaLabel);

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  type = "";
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

  queryAllByPredicate(predicate: (element: TestElement) => boolean): readonly TestElement[] {
    return [
      ...(predicate(this) ? [this] : []),
      ...this.children.flatMap((child) => child.queryAllByPredicate(predicate))
    ];
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
