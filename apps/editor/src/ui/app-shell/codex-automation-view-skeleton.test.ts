import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { shellSurfaces } from "./shell-surfaces.js";
import { createCodexAutomationViewSkeleton } from "./codex-automation-view-skeleton.js";

describe("codex automation view skeleton", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders a separated read-only Codex automation view skeleton", () => {
    const skeleton = createCodexAutomationViewSkeleton() as unknown as TestElement;

    expect(skeleton.dataset.shellSurfaceId).toBe(shellSurfaces.codexAutomationView.id);
    expect(skeleton.dataset.shellSurfaceKind).toBe("view");
    expect(skeleton.dataset.shellSurfaceLabel).toBe("Codex / Automation View");
    expect(skeleton.dataset.shellSurfaceGroup).toBe("codex-automation-skeleton");
    expect(skeleton.dataset.codexAutomationSkeleton).toBe("true");
    expect(skeleton.getAttribute("aria-labelledby")).toBe("codex-automation-view-skeleton-title");
    expect(skeleton.getAttribute("aria-describedby")).toBe("codex-automation-view-skeleton-status");
    expect(skeleton.textContent).toContain("Codex / Automation");
    expect(skeleton.textContent).toContain("Bounded read-only skeleton");
    expect(queryAllInteractiveElements(skeleton)).toHaveLength(0);
  });

  it("keeps the required navigation sections observable without routing them", () => {
    const skeleton = createCodexAutomationViewSkeleton() as unknown as TestElement;

    expect(sectionText(skeleton, "proposal-review")).toContain("Proposal Review");
    expect(sectionText(skeleton, "ai-approval")).toContain("AI Approval");
    expect(sectionText(skeleton, "ai-transcript")).toContain("AI Transcript");
    expect(sectionText(skeleton, "command-surface-status")).toContain("Command Surface Status");
    expect(sectionText(skeleton, "psd-structural-scaffold-availability")).toContain(
      "PSD Import / Structural Scaffold Command Availability"
    );
    expect(sectionMapRefs(skeleton)).toEqual([
      "proposal-review",
      "ai-approval",
      "ai-transcript",
      "command-surface-status",
      "psd-structural-scaffold-availability"
    ]);
  });

  it("states the automation policy boundary and blocked capabilities explicitly", () => {
    const skeleton = createCodexAutomationViewSkeleton() as unknown as TestElement;
    const text = normalizeText(skeleton.textContent);

    expect(text).toContain("Deterministic repository surfaces");
    expect(text).toContain("validate, dry-run, diff, require approval, record transcript, attach evidence, and report status");
    expect(text).toContain("Repo/Editor-side proposal generation unavailable");
    expect(text).toContain("Semantic recognition blocked");
    expect(text).toContain("Auto-rigging blocked");
    expect(text).toContain("Auto-fix blocked");
    expect(text).toContain("Auto-commit blocked");
    expect(text).toContain("Embedded provider/LLM unavailable");
    expect(text).toContain("External HTTP/WebSocket/MCP transport unavailable");
    expect(text).toContain("external Codex/LLMs");
  });

  it("exposes PSD structural command availability without semantic automation", () => {
    const skeleton = createCodexAutomationViewSkeleton() as unknown as TestElement;
    const section = sectionText(skeleton, "psd-structural-scaffold-availability");

    expect(section).toContain("PSD parse");
    expect(section).toContain("import plan");
    expect(section).toContain("approved refs");
    expect(section).toContain("preview or dry-run");
    expect(section).toContain("commit");
    expect(section).toContain("latest result");
    expect(section).toContain("deterministic copying from explicit PSD tree refs");
    expect(section).toContain("automatic layer classification");
    expect(section).toContain("remain blocked");
  });
});

const sectionText = (root: TestElement, sectionId: string): string => {
  const section = root.queryByPredicate((element) => element.dataset.codexAutomationSection === sectionId);

  return normalizeText(section?.textContent ?? "");
};

const sectionMapRefs = (root: TestElement): readonly string[] =>
  root
    .queryAllByPredicate((element) => element.dataset.codexAutomationSectionRef !== undefined)
    .map((element) => element.dataset.codexAutomationSectionRef)
    .filter((sectionRef): sectionRef is string => sectionRef !== undefined);

const queryAllInteractiveElements = (root: TestElement): readonly TestElement[] =>
  root.queryAllByPredicate((element) =>
    ["a", "button", "form", "input", "select", "textarea"].includes(element.tagName)
  );

const normalizeText = (text: string): string => text.replace(/\s+/g, " ").trim();

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
