import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDiagnosticsEvidenceViewSkeleton,
  diagnosticsEvidenceViewSkeletonTestIds
} from "./diagnostics-evidence-view-skeleton.js";
import { shellSurfaces } from "./shell-surfaces.js";

describe("diagnostics evidence view skeleton", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders a separated read-only view with shell surface metadata", () => {
    const view = createDiagnosticsEvidenceViewSkeleton() as unknown as TestElement;

    expect(view.dataset.testid).toBe(diagnosticsEvidenceViewSkeletonTestIds.root);
    expect(view.dataset.shellSurfaceId).toBe(shellSurfaces.diagnosticsEvidenceView.id);
    expect(view.dataset.shellSurfaceKind).toBe("view");
    expect(view.dataset.shellSurfaceLabel).toBe(shellSurfaces.diagnosticsEvidenceView.label);
    expect(view.dataset.shellSurfaceGroup).toBe("diagnostics-evidence-skeleton");
    expect(view.getAttribute("aria-labelledby")).toBe("diagnostics-evidence-view-skeleton-title");
    expect(view.textContent).toContain("Diagnostics / Evidence");
    expect(findByTestId(view, diagnosticsEvidenceViewSkeletonTestIds.purpose)?.textContent).toContain(
      "Separated read-only home"
    );
  });

  it("exposes stable slots for every future diagnostics and evidence home", () => {
    const view = createDiagnosticsEvidenceViewSkeleton() as unknown as TestElement;
    const navigation = findByTestId(view, diagnosticsEvidenceViewSkeletonTestIds.navigation);
    const details = findByTestId(view, diagnosticsEvidenceViewSkeletonTestIds.details);

    expect(navigation?.textContent).toContain("Navigation");
    expect(details?.textContent).toContain("Details");

    const expectedSlots: readonly (readonly [string, string, string])[] = [
      [diagnosticsEvidenceViewSkeletonTestIds.operationLog, "operation-log", "Operation Log"],
      [diagnosticsEvidenceViewSkeletonTestIds.generatedEvidence, "generated-evidence", "Generated Evidence"],
      [diagnosticsEvidenceViewSkeletonTestIds.packageFileSet, "package-file-set", "Package File Set"],
      [diagnosticsEvidenceViewSkeletonTestIds.reloadSummary, "reload-summary", "Reload Summary"],
      [
        diagnosticsEvidenceViewSkeletonTestIds.validationDiagnostics,
        "validation-diagnostics",
        "Full Validation Diagnostics / Product Preflight Details"
      ],
      [
        diagnosticsEvidenceViewSkeletonTestIds.runtimeSnapshotDiff,
        "runtime-snapshot-diff",
        "Runtime Snapshot / Diff Details"
      ],
      [
        diagnosticsEvidenceViewSkeletonTestIds.psdStructuralEvidence,
        "psd-structural-evidence",
        "PSD Import / Structural Scaffold Evidence"
      ]
    ];

    for (const [testId, slotId, title] of expectedSlots) {
      const slot = findByTestId(view, testId);

      expect(navigation?.textContent).toContain(title);
      expect(slot?.dataset.diagnosticsEvidenceSlot).toBe(slotId);
      expect(slot?.textContent).toContain(title);
    }
  });

  it("keeps the empty state bounded and avoids raw debug dump controls", () => {
    const view = createDiagnosticsEvidenceViewSkeleton() as unknown as TestElement;
    const emptyState = findByTestId(view, diagnosticsEvidenceViewSkeletonTestIds.emptyState);
    const normalizedText = view.textContent.toLowerCase();

    expect(emptyState?.textContent).toContain("No detailed evidence is selected yet.");
    expect(view.queryAllByPredicate((element) => element.tagName === "button")).toHaveLength(0);
    expect(view.queryAllByPredicate((element) => element.tagName === "pre")).toHaveLength(0);
    expect(view.queryAllByPredicate((element) => element.tagName === "code")).toHaveLength(0);
    expect(view.queryAllByPredicate((element) => element.tagName === "textarea")).toHaveLength(0);
    expect(normalizedText).not.toContain("operation id");
    expect(normalizedText).not.toContain("approval id");
    expect(normalizedText).not.toContain("evidence path");
    expect(normalizedText).not.toContain("generated refs");
    expect(normalizedText).not.toContain("raw parser payload");
  });

  it("does not include Codex automation content or claim a full implementation", () => {
    const view = createDiagnosticsEvidenceViewSkeleton() as unknown as TestElement;
    const normalizedText = view.textContent.toLowerCase();

    expect(normalizedText).not.toContain("codex");
    expect(normalizedText).not.toContain("automation");
    expect(normalizedText).not.toContain("ai transcript");
    expect(normalizedText).not.toContain("proposal");
    expect(normalizedText).not.toContain("auto-fix");
    expect(normalizedText).not.toContain("fully implemented");
    expect(normalizedText).not.toContain("complete evidence browser");
    expect(normalizedText).not.toContain("final view");
  });
});

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
