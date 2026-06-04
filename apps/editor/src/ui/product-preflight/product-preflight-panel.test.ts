import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  editorTestIds,
  type ProductPreflightComparisonState,
  type ProductPreflightState
} from "../../editor-state/index.js";
import { createProductPreflightPanel } from "./product-preflight-panel.js";

describe("product preflight panel", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders product preflight summary sections and wires run callback", () => {
    const calls: string[] = [];
    const panel = createProductPreflightPanel({
      state: createReadyPreflightState(),
      isPackageLoaded: true,
      currentPackageRevision: 7,
      onRunProductPreflight() {
        calls.push("run");
      }
    }) as unknown as TestElement;

    expect(findByTestId(panel, editorTestIds.productPreflightSummary)?.textContent).toContain(
      "not_supported1"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightCategorySummary)?.textContent).toContain(
      "runtimeViewerEvidence: not_evaluated"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightBlockingIssues)?.textContent).toContain(
      "blocking"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightWarnings)?.textContent).toContain(
      "needs_review"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightWarnings)?.textContent).toContain(
      "modelStructure"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightUnsupportedClaims)?.textContent).toContain(
      "otherUnsupportedCapability"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightNotEvaluated)?.textContent).toContain(
      "runtimeSnapshot"
    );
    expect(panel.textContent.toLowerCase()).not.toContain("auto-fix");

    findByTestId(panel, editorTestIds.productPreflightRun)?.emit("click");

    expect(calls).toEqual(["run"]);
  });

  it("keeps run disabled until a package is loaded", () => {
    const panel = createProductPreflightPanel({
      state: {
        ...createReadyPreflightState(),
        status: "not_run",
        reportId: null,
        createdAt: null,
        packageId: null,
        packageRevision: null,
        overallStatus: "not_run",
        highestSeverity: null,
        categories: []
      },
      isPackageLoaded: false,
      currentPackageRevision: 0,
      onRunProductPreflight() {}
    }) as unknown as TestElement;

    expect(findByTestId(panel, editorTestIds.productPreflightRun)?.disabled).toBe(true);
    expect(findByTestId(panel, editorTestIds.productPreflightStatus)?.textContent).toContain(
      "No product preflight report has run"
    );
  });

  it("renders deterministic report comparison sections when comparison state is supplied", () => {
    const panel = createProductPreflightPanel({
      state: createReadyPreflightState(),
      comparisonState: createReadyComparisonState(),
      isPackageLoaded: true,
      currentPackageRevision: 7,
      onRunProductPreflight() {}
    }) as unknown as TestElement;

    expect(findByTestId(panel, editorTestIds.productPreflightComparison)?.textContent).toContain(
      "Deterministic report comparison"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightComparisonSummary)?.textContent).toContain(
      "Previous -> current"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightComparisonTransitions)?.textContent).toContain(
      "meshTopologyUv"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightComparisonRefs)?.textContent).toContain(
      "Evidence added evidence ref"
    );
    expect(findByTestId(panel, editorTestIds.productPreflightComparisonRerun)?.textContent).toContain(
      "manual request available"
    );
    expect(panel.textContent.toLowerCase()).not.toContain("auto-fix");
  });
});

const createReadyPreflightState = (): ProductPreflightState => ({
  status: "ready",
  reportId: "preflight_editor_fixture",
  createdAt: "2026-06-04T00:00:00.000Z",
  packageId: "pkg_editor_fixture",
  packageRevision: 7,
  overallStatus: "fail",
  highestSeverity: "blocking",
  categoryCounts: {
    pass: 1,
    warn: 1,
    fail: 1,
    not_supported: 1,
    not_evaluated: 1
  },
  blockingReasonCount: 1,
  unsupportedClaimCount: 1,
  notEvaluatedClaimCount: 1,
  evidenceRefCount: 3,
  diagnosticRefCount: 2,
  categories: [
    {
      category: "modelStructure",
      status: "fail",
      severity: "blocking",
      summary: "Model structure has a blocking issue.",
      evidenceRefCount: 1,
      diagnosticRefCount: 1,
      blockingReasonCount: 1,
      unsupportedClaimCount: 0,
      notEvaluatedClaimCount: 0
    },
    {
      category: "meshTopologyUv",
      status: "warn",
      severity: "warning",
      summary: "Mesh evidence needs review.",
      evidenceRefCount: 1,
      diagnosticRefCount: 1,
      blockingReasonCount: 0,
      unsupportedClaimCount: 0,
      notEvaluatedClaimCount: 0
    },
    {
      category: "unsupportedClaims",
      status: "not_supported",
      severity: "warning",
      summary: "Unsupported claim is recorded.",
      evidenceRefCount: 0,
      diagnosticRefCount: 0,
      blockingReasonCount: 0,
      unsupportedClaimCount: 1,
      notEvaluatedClaimCount: 0
    },
    {
      category: "runtimeViewerEvidence",
      status: "not_evaluated",
      severity: "warning",
      summary: "Runtime evidence is missing.",
      evidenceRefCount: 0,
      diagnosticRefCount: 0,
      blockingReasonCount: 0,
      unsupportedClaimCount: 0,
      notEvaluatedClaimCount: 1
    }
  ],
  blockingIssues: [{
    reasonId: "block_modelStructure_0",
    category: "modelStructure",
    severity: "blocking",
    reasonCode: "schemaInvalid",
    message: "Schema validation blocked product preflight.",
    diagnosticLabel: "val_fixture:pkg.schema.fixture"
  }],
  warnings: [{
    id: "modelStructure:pkg.schema.fixtureNeedsReview:0",
    category: "modelStructure",
    severity: "warning",
    status: "needs_review",
    message: "Schema evidence needs review.",
    diagnosticLabel: "val_fixture:pkg.schema.fixtureNeedsReview"
  }],
  unsupportedClaims: [{
    claimId: "claim_unsupported_boundary",
    category: "unsupportedClaims",
    severity: "warning",
    claimKind: "otherUnsupportedCapability",
    capabilityLabel: "Unsupported boundary",
    explanation: "The unsupported boundary is recorded without claiming support."
  }],
  notEvaluatedClaims: [{
    claimId: "claim_runtime_notEvaluated",
    category: "runtimeViewerEvidence",
    severity: "warning",
    evidenceKind: "runtimeSnapshot",
    reason: "No runtime snapshot evidence was supplied.",
    requiredEvidenceLabel: "runtimeSnapshot"
  }],
  errorMessage: null
});

const createReadyComparisonState = (): ProductPreflightComparisonState => ({
  status: "ready",
  generatedAt: "2026-06-04T00:00:00.000Z",
  summaryLabel: "1 deterministic report comparison / 3 structural changes",
  safetyLabel: "Session-generated reports; manual rerun only; automatic commit disabled.",
  reportSlots: [
    {
      slotKind: "current",
      label: "Current report",
      available: true,
      reportIdLabel: "preflight_editor_fixture",
      statusLabel: "fail / blocking",
      packageLabel: "pkg_editor_fixture r7; created 2026-06-04T00:00:00.000Z",
      refCountLabel: "3 evidence refs / 2 diagnostic refs"
    },
    {
      slotKind: "previous",
      label: "Previous report",
      available: true,
      reportIdLabel: "preflight_editor_previous",
      statusLabel: "warn / warning",
      packageLabel: "pkg_editor_fixture r6; created 2026-06-04T00:00:00.000Z",
      refCountLabel: "1 evidence refs / 1 diagnostic refs"
    },
    {
      slotKind: "proposalPreview",
      label: "Proposal-preview report",
      available: false,
      reportIdLabel: "not available",
      statusLabel: "not available",
      packageLabel: "not available",
      refCountLabel: "0 evidence refs / 0 diagnostic refs"
    }
  ],
  rerunAffordances: [{
    label: "Current report rerun",
    sourceReportId: "preflight_editor_fixture",
    statusLabel: "available / Manual Product Preflight rerun is available.",
    triggerLabel: "manual request available: manualCurrentSession",
    safetyLabel: "Automatic rerun disabled / automatic commit disabled"
  }],
  comparisons: [{
    comparisonKind: "previousToCurrent",
    title: "Previous -> current",
    reportLabel: "preflight_editor_previous -> preflight_editor_fixture",
    statusTransitionLabel: "warn -> fail",
    severityTransitionLabel: "warning -> blocking",
    changeCountLabel: "3 total / 1 category / 1 evidence ref / 1 diagnostic ref",
    categoryTransitions: [{
      category: "meshTopologyUv",
      statusLabel: "warn -> fail",
      severityLabel: "warning -> blocking",
      changedLabel: "changed"
    }],
    evidenceRefChanges: [{
      title: "added evidence ref evidence_editor_fixture",
      detail: "Editor evidence ref was added.",
      meta: "category:meshTopologyUv / validationReport:validation/reports/val_editor.validation.json"
    }],
    diagnosticRefChanges: [{
      title: "added diagnostic ref mesh.topology.needsReview",
      detail: "val_editor / mesh.topology.needsReview / needs_review / warning",
      meta: "category:meshTopologyUv / val_editor / mesh:mesh_editor"
    }]
  }],
  errorMessage: null
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
