import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAuthoringToolboxSurface,
  createWorkspaceDiagnosticsStripShellSurface
} from "./authoring-workspace-v0-shell.js";
import type { EditorAppShellOptions } from "./app-shell.js";
import {
  createPrimaryHumanShell,
  primaryHumanShellTestIds
} from "./primary-human-shell.js";

describe("primary human shell", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("composes only the essential authoring regions in primary order", () => {
    const appBar = createRegion("app-bar", "Project App Bar");
    const toolbox = createRegion("toolbox", "Toolbox");
    const partsTree = createRegion("parts-tree", "Structure / Parts");
    const canvas = createRegion("canvas-preview", "Canvas / Preview");
    const inspector = createRegion("inspector", "Inspector");
    const parameterBar = createRegion("parameter-bar", "Parameter Bar");
    const diagnostics = createRegion("diagnostics-strip", "Diagnostics");

    const shell = createPrimaryHumanShell({
      appBarSlot: appBar,
      toolboxSurface: toolbox,
      partsTreeSurface: partsTree,
      canvasPreviewRegion: canvas,
      inspectorSurface: inspector,
      parameterBarSurface: parameterBar,
      diagnosticsStripSurface: diagnostics
    }) as unknown as TestElement;

    expect(shell.dataset.testid).toBe(primaryHumanShellTestIds.shell);
    expect(shell.dataset.shellSurfaceId).toBe("authoringWorkspace");
    expect(shell.dataset.shellSurfaceGroup).toBe("primary-human-shell");
    expect(appBar.dataset.primaryHumanShellRegion).toBe("app-bar");

    const workspace = findByTestId(shell, primaryHumanShellTestIds.workspace);
    const layout = findByTestId(shell, primaryHumanShellTestIds.layout);
    expect(workspace?.dataset.shellSurfaceGroup).toBe("primary-workspace");
    expect(workspace?.getAttribute("aria-label")).toBe("Primary human authoring workspace");
    expect(layout?.dataset.shellSurfaceGroup).toBe("workspace-v0");
    expect(layout?.dataset.primaryHumanShellLayout).toBe("essentials");
    expect(layout?.children.map((child) => child.dataset.primaryShellSlot)).toEqual([
      "toolbox",
      "parts-tree",
      "canvas-preview",
      "inspector",
      "parameter-bar",
      "diagnostics-strip"
    ]);
  });

  it("does not render legacy support or debug/evidence/Codex-heavy primary content", () => {
    const shell = createPrimaryHumanShell({
      toolboxSurface: createRegion("toolbox", "Toolbox Import PSD Mesh Rig Dynamics"),
      partsTreeSurface: createRegion("parts-tree", "Structure / Parts Body Head"),
      canvasPreviewRegion: createRegion("canvas-preview", "Canvas / Preview Empty model"),
      inspectorSurface: createRegion("inspector", "Inspector No selection"),
      parameterBarSurface: createRegion("parameter-bar", "Parameter Bar No active parameter"),
      diagnosticsStripSurface: createRegion("diagnostics-strip", "Diagnostics 0 blocking / 0 warnings")
    }) as unknown as TestElement;

    expect(findByClassName(shell, "authoring-workspace-support")).toBeNull();
    expect(findByShellSurfaceGroup(shell, "legacy-support")).toBeNull();
    expect(collectTextAndAttributeValues(shell)).not.toMatch(/Workspace support panels/i);
    for (const forbidden of primaryForbiddenTextPatterns) {
      expect(collectTextAndAttributeValues(shell)).not.toMatch(forbidden);
    }
  });

  it("can host the active task window inside the primary workspace without support panels", () => {
    const taskWindow = createRegion("task-window", "PSD Import Task");

    const shell = createPrimaryHumanShell({
      toolboxSurface: createRegion("toolbox", "Toolbox"),
      partsTreeSurface: createRegion("parts-tree", "Structure / Parts"),
      canvasPreviewRegion: createRegion("canvas-preview", "Canvas / Preview"),
      inspectorSurface: createRegion("inspector", "Inspector"),
      parameterBarSurface: createRegion("parameter-bar", "Parameter Bar"),
      diagnosticsStripSurface: createRegion("diagnostics-strip", "Diagnostics"),
      taskWindowSurface: taskWindow
    }) as unknown as TestElement;

    const workspace = findByTestId(shell, primaryHumanShellTestIds.workspace);

    expect(taskWindow.dataset.primaryHumanShellRegion).toBe("active-task");
    expect(taskWindow.parentElement).toBe(workspace);
    expect(findByClassName(shell, "authoring-workspace-support")).toBeNull();
    expect(findByShellSurfaceGroup(shell, "legacy-support")).toBeNull();
  });

  it("passes through region slots and callbacks without rebuilding their logic", () => {
    const calls: string[] = [];
    const toolbox = createRegion("toolbox", "Toolbox", () => calls.push("toolbox"));
    const parameterBar = createRegion("parameter-bar", "Parameter Bar", () => calls.push("parameter"));
    const diagnostics = createRegion("diagnostics-strip", "Diagnostics", () => calls.push("diagnostics"));

    const shell = createPrimaryHumanShell({
      toolboxSurface: toolbox,
      partsTreeSurface: createRegion("parts-tree", "Structure / Parts"),
      canvasPreviewRegion: createRegion("canvas-preview", "Canvas / Preview"),
      inspectorSurface: createRegion("inspector", "Inspector"),
      parameterBarSurface: parameterBar,
      diagnosticsStripSurface: diagnostics
    }) as unknown as TestElement;

    expect(findByPrimaryShellSlot(shell, "toolbox")).toBe(toolbox);
    expect(findByPrimaryShellSlot(shell, "parameter-bar")).toBe(parameterBar);
    expect(findByPrimaryShellSlot(shell, "diagnostics-strip")).toBe(diagnostics);

    findByPrimaryShellSlot(shell, "toolbox")?.queryByPredicate((element) => element.tagName === "button")?.emit("click");
    findByPrimaryShellSlot(shell, "parameter-bar")?.queryByPredicate((element) => element.tagName === "button")?.emit("click");
    findByPrimaryShellSlot(shell, "diagnostics-strip")?.queryByPredicate((element) => element.tagName === "button")?.emit("click");

    expect(calls).toEqual(["toolbox", "parameter", "diagnostics"]);
  });

  it("keeps authoring Toolbox launcher copy away from legacy support-panel directions", () => {
    const calls: string[] = [];
    const toolbox = createAuthoringToolboxSurface({
      activeTask: null,
      viewModel: {
        isPackageLoaded: false,
        viewerRuntime: {
          isOpen: false
        }
      },
      onOpenPsdImportTask() {
        calls.push("psd");
      },
      onOpenDiagnosticsEvidenceView() {
        calls.push("diagnostics");
      },
      onOpenCodexAutomationView() {
        calls.push("codex");
      },
      onOpenViewerRuntimeSurface() {
        calls.push("viewer");
      }
    } as unknown as EditorAppShellOptions) as unknown as TestElement;

    const copy = collectTextAndAttributeValues(toolbox);
    expect(copy).not.toMatch(/support panels/i);
    expect(copy).not.toMatch(/Product Preflight/i);
    expect(findByToolboxItemId(toolbox, "mesh")?.getAttribute("title")).toBe(
      "Mesh tools - Select a drawable to enable Mesh tools"
    );
    expect(findByToolboxItemId(toolbox, "storage")?.getAttribute("aria-description")).toBe(
      "Project storage task is not available yet"
    );
    expect(findByToolboxItemId(toolbox, "validate")?.getAttribute("title")).toBe(
      "Validation - Validation task is not available yet"
    );

    findByToolboxItemId(toolbox, "import-psd")?.emit("click");
    findByToolboxItemId(toolbox, "diagnostics")?.emit("click");
    findByToolboxItemId(toolbox, "codex")?.emit("click");

    expect(calls).toEqual(["psd", "diagnostics", "codex"]);
  });

  it("passes the compact Diagnostics Strip details action to Diagnostics / Evidence", () => {
    const calls: string[] = [];
    const diagnostics = createWorkspaceDiagnosticsStripShellSurface({
      state: {
        productPreflight: {
          status: "idle",
          blockingIssues: [],
          warnings: [],
          unsupportedClaimCount: 0,
          notEvaluatedClaimCount: 0,
          errorMessage: null,
          unsupportedClaims: [],
          notEvaluatedClaims: []
        }
      },
      onOpenDiagnosticsEvidenceView() {
        calls.push("open-diagnostics");
      }
    } as unknown as EditorAppShellOptions) as unknown as TestElement;

    const details = diagnostics.queryByPredicate(
      (element) => element.dataset.testid === "workspaceContext.diagnosticsStrip.openDetails"
    );
    expect(details?.disabled).toBe(false);

    details?.emit("click");

    expect(calls).toEqual(["open-diagnostics"]);
  });
});

const primaryForbiddenTextPatterns = [
  /Operation Log/i,
  /Generated Evidence/i,
  /Package File Set/i,
  /Reload Summary/i,
  /Codex Proposal Review/i,
  /AI Approval/i,
  /AI transcript/i,
  /Product Preflight/i,
  /\bsupport panels\b/i,
  /operation id/i,
  /evidence path/i,
  /generated refs/i,
  /raw refs/i,
  /command payload/i,
  /AI transcript/i
] as const;

const createRegion = (
  slot: string,
  label: string,
  onClick?: () => void
): HTMLElement => {
  const region = document.createElement("section") as unknown as TestElement;
  region.dataset.primaryShellSlot = slot;
  region.setAttribute("aria-label", label);
  region.textContent = label;

  if (onClick !== undefined) {
    const button = document.createElement("button") as unknown as TestElement;
    button.type = "button";
    button.textContent = `Activate ${label}`;
    button.addEventListener("click", onClick);
    region.append(button);
  }

  return region as unknown as HTMLElement;
};

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const findByClassName = (root: TestElement, className: string): TestElement | null =>
  root.queryByPredicate((element) => element.className.split(" ").includes(className));

const findByShellSurfaceGroup = (root: TestElement, group: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.shellSurfaceGroup === group);

const findByPrimaryShellSlot = (root: TestElement, slot: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.primaryShellSlot === slot);

const findByToolboxItemId = (root: TestElement, itemId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.toolboxItemId === itemId);

const collectTextAndAttributeValues = (root: TestElement): string =>
  root
    .queryAllByPredicate(() => true)
    .flatMap((element) => [
      element.textContent,
      ...Array.from(element.attributes.values()),
      ...Object.values(element.dataset)
    ])
    .join(" ");

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
