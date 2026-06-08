import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createLegacyDebugQuarantineSurface,
  legacyDebugQuarantineSurfaceMetadata,
  legacyDebugQuarantineSurfaceTestIds
} from "./legacy-debug-quarantine-surface.js";

describe("legacy debug quarantine surface", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("marks the root as a non-primary internal quarantine surface", () => {
    const surface = createLegacyDebugQuarantineSurface() as unknown as TestElement;

    expect(surface.dataset.testid).toBe(legacyDebugQuarantineSurfaceTestIds.root);
    expect(surface.dataset.shellSurfaceId).toBe(legacyDebugQuarantineSurfaceMetadata.surfaceId);
    expect(surface.dataset.shellSurfaceKind).toBe(legacyDebugQuarantineSurfaceMetadata.surfaceKind);
    expect(surface.dataset.shellSurfaceLabel).toBe(legacyDebugQuarantineSurfaceMetadata.surfaceLabel);
    expect(surface.dataset.shellSurfaceGroup).toBe(legacyDebugQuarantineSurfaceMetadata.surfaceGroup);
    expect(surface.dataset.shellSurfacePrimary).toBe("false");
    expect(surface.dataset.primaryAuthoringSurface).toBe("false");
    expect(surface.dataset.authoringWorkspaceFlow).toBe("false");
    expect(surface.dataset.internalDebugSurface).toBe("true");
    expect(surface.dataset.quarantineSurface).toBe("true");
    expect(surface.getAttribute("aria-labelledby")).toBe("legacy-debug-quarantine-surface-title");
    expect(surface.getAttribute("aria-describedby")).toBe(
      "legacy-debug-quarantine-surface-boundary legacy-debug-quarantine-surface-status"
    );
  });

  it("does not reuse the authoring support region class or legacy-support shell group", () => {
    const surface = createLegacyDebugQuarantineSurface() as unknown as TestElement;

    expect(surface.dataset.shellSurfaceGroup).not.toBe("legacy-support");
    expect(surface.className.split(/\s+/)).not.toContain("authoring-workspace-support");
    expect(
      surface.queryAllByPredicate((element) => element.dataset.shellSurfaceGroup === "legacy-support")
    ).toHaveLength(0);
    expect(
      surface.queryAllByPredicate((element) =>
        element.className.split(/\s+/).includes("authoring-workspace-support")
      )
    ).toHaveLength(0);
  });

  it("preserves passed panel nodes by appending them under the quarantine host", () => {
    const panelA = createPanel("legacy.panel.a", "Operation Log Summary");
    const panelB = createPanel("legacy.panel.b", "AI Transcript");
    const surface = createLegacyDebugQuarantineSurface([panelA, panelB]) as unknown as TestElement;
    const host = findByTestId(surface, legacyDebugQuarantineSurfaceTestIds.panelHost);

    expect(surface.dataset.legacyDebugQuarantinePanelCount).toBe("2");
    expect(host?.dataset.quarantinePanelHost).toBe("true");
    expect(host?.children).toEqual([panelA, panelB]);
    expect(panelA.parentElement).toBe(host);
    expect(panelB.parentElement).toBe(host);
    expect(findByTestId(surface, "legacy.panel.a")).toBe(panelA);
    expect(findByTestId(surface, "legacy.panel.b")).toBe(panelB);
    expect(findByTestId(surface, legacyDebugQuarantineSurfaceTestIds.emptyState)).toBeNull();
  });

  it("renders an explicit non-primary empty state", () => {
    const surface = createLegacyDebugQuarantineSurface() as unknown as TestElement;
    const emptyState = findByTestId(surface, legacyDebugQuarantineSurfaceTestIds.emptyState);
    const status = findByTestId(surface, legacyDebugQuarantineSurfaceTestIds.status);

    expect(surface.dataset.legacyDebugQuarantinePanelCount).toBe("0");
    expect(status?.textContent).toContain("non-primary quarantine surface");
    expect(emptyState?.textContent).toContain("Primary UI absence is expected");
    expect(emptyState?.textContent).toContain("quarantine presence is empty");
    expect(surface.textContent).not.toContain("Authoring Workspace");
    expect(surface.textContent).not.toContain("support panels");
  });

  it("exposes metadata that distinguishes primary absence from quarantine presence", () => {
    const panel = createPanel("legacy.panel", "Legacy panel");
    const surface = createLegacyDebugQuarantineSurface([panel]) as unknown as TestElement;
    const boundary = findByTestId(surface, legacyDebugQuarantineSurfaceTestIds.boundary);

    expect(surface.dataset.primaryUiAbsence).toBe(
      "normal-authoring-workspace-does-not-mount-legacy-panels"
    );
    expect(surface.dataset.quarantinePresence).toBe(
      "legacy-panel-reachability-preserved-outside-primary-flow"
    );
    expect(surface.dataset.shellSurfaceId).not.toBe("authoringWorkspace");
    expect(surface.dataset.shellSurfaceKind).not.toBe("authoring-workspace");
    expect(boundary?.textContent).toContain("Primary UI absence");
    expect(boundary?.textContent).toContain("Quarantine / specialized surface presence");
    expect(boundary?.textContent).toContain("outside the primary flow");
  });
});

const createPanel = (testId: string, text: string): HTMLElement & TestElement => {
  const panel = document.createElement("section") as unknown as HTMLElement & TestElement;
  panel.dataset.testid = testId;
  panel.textContent = text;

  return panel;
};

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  parentElement: TestElement | null = null;
  className = "";
  id = "";
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

      if (node.parentElement !== null) {
        const existingIndex = node.parentElement.children.indexOf(node);
        if (existingIndex >= 0) {
          node.parentElement.children.splice(existingIndex, 1);
        }
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
