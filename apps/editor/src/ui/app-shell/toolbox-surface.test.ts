import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createToolboxSurface } from "./toolbox-surface.js";

describe("toolbox surface", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders action, task, and view launchers as explicit accessible callbacks", () => {
    const calls: string[] = [];
    const surface = createToolboxSurface({
      labelMode: "expanded",
      actions: [
        {
          id: "select",
          label: "Select",
          ariaLabel: "Select tool",
          tooltip: "Select parts or drawables",
          iconText: "S",
          active: true,
          status: "Active"
        },
        {
          id: "mesh",
          label: "Mesh",
          tooltip: "Mesh tools",
          iconText: "M",
          disabled: true,
          disabledReason: "Select a drawable first"
        }
      ],
      tasks: [
        {
          id: "import-psd",
          label: "Import PSD",
          ariaLabel: "Open PSD import task",
          tooltip: "Import PSD",
          iconText: "PSD",
          badge: "Task"
        }
      ],
      views: [
        {
          id: "diagnostics",
          label: "Diagnostics",
          tooltip: "Diagnostics / Evidence",
          iconText: "D",
          status: "Warnings only"
        }
      ],
      onActivate: (itemId) => calls.push(itemId)
    }) as unknown as TestElement;

    expect(surface.dataset.shellSurfaceId).toBe("authoringWorkspace");
    expect(surface.dataset.shellSurfaceGroup).toBe("toolbox");
    expect(surface.textContent).toContain("Toolbox");
    expect(surface.textContent).toContain("Actions");
    expect(surface.textContent).toContain("Tasks");
    expect(surface.textContent).toContain("Views");

    const select = findByToolboxItemId(surface, "select");
    expect(select?.getAttribute("aria-label")).toBe("Select tool");
    expect(select?.getAttribute("aria-pressed")).toBe("true");
    expect(select?.getAttribute("title")).toBe("Select parts or drawables");
    expect(select?.textContent).toContain("Active");

    const mesh = findByToolboxItemId(surface, "mesh");
    expect(mesh?.disabled).toBe(true);
    expect(mesh?.getAttribute("aria-description")).toBe("Select a drawable first");
    expect(mesh?.getAttribute("title")).toBe("Mesh tools - Select a drawable first");

    findByToolboxItemId(surface, "select")?.emit("click");
    findByToolboxItemId(surface, "mesh")?.emit("click");
    findByToolboxItemId(surface, "import-psd")?.emit("click");
    findByToolboxItemId(surface, "diagnostics")?.emit("click");

    expect(calls).toEqual(["select", "import-psd", "diagnostics"]);
  });
});

const findByToolboxItemId = (root: TestElement, itemId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.toolboxItemId === itemId);

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
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};
