import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  OperationIdSchema,
  PackageIdSchema,
  ValidationReportIdSchema,
  type CodexProposalApprovalEvidenceResponseDto,
  type CodexProposalDiffPreviewResultDto,
  type CodexProposalRerunValidationResultDto,
  type CodexProposalValidationResultDto,
  type CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import {
  editorTestIds,
  projectCodexProposalReviewState
} from "../../editor-state/index.js";
import { createCodexProposalReviewPanel } from "./codex-proposal-review-panel.js";

describe("Codex proposal review panel", () => {
  let originalFormData: typeof FormData | undefined;

  beforeEach(() => {
    installTestDocument();
    originalFormData = globalThis.FormData;
    (globalThis as unknown as { FormData: typeof FormData }).FormData =
      TestFormData as unknown as typeof FormData;
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
    if (originalFormData === undefined) {
      delete (globalThis as Partial<{ FormData: typeof FormData }>).FormData;
    } else {
      globalThis.FormData = originalFormData;
    }
  });

  it("renders proposal review sections and keeps approval actions manual", () => {
    const calls: string[] = [];
    const panel = createCodexProposalReviewPanel({
      state: createReviewState(),
      isPackageLoaded: true,
      onReviewProposalText(proposalText) {
        calls.push(`review:${proposalText}`);
      },
      onClearReview() {
        calls.push("clear");
      },
      onRequestApproval() {
        calls.push("request");
      },
      onRecordApproval() {
        calls.push("approve");
      },
      onCommitApprovedProposal() {
        calls.push("commit");
      }
    }) as unknown as TestElement;

    expect(findByTestId(panel, editorTestIds.codexProposalReviewProposal)?.textContent).toContain(
      "proposal_editorPanelCodex"
    );
    expect(findByTestId(panel, editorTestIds.codexProposalReviewValidation)?.textContent).toContain(
      "Proposal validation"
    );
    expect(findByTestId(panel, editorTestIds.codexProposalReviewDiff)?.textContent).toContain(
      "Preview only / not committed"
    );
    expect(findByTestId(panel, editorTestIds.codexProposalReviewRerunValidation)?.textContent).toContain(
      "not_evaluated"
    );
    expect(findByTestId(panel, editorTestIds.codexProposalReviewApproval)?.textContent).toContain(
      "Automatic commit disabled"
    );
    expect(panel.textContent.toLowerCase()).not.toContain("auto-fix");
    expect(panel.textContent.toLowerCase()).not.toContain("llm");

    expect(findByTestId(panel, editorTestIds.codexProposalReviewRequestApproval)?.disabled).toBe(true);
    expect(findByTestId(panel, editorTestIds.codexProposalReviewRecordApproval)?.disabled).toBe(false);
    expect(findByTestId(panel, editorTestIds.codexProposalReviewCommit)?.disabled).toBe(true);

    findByTestId(panel, editorTestIds.codexProposalReviewRequestApproval)?.emit("click");
    findByTestId(panel, editorTestIds.codexProposalReviewRecordApproval)?.emit("click");
    findByTestId(panel, editorTestIds.codexProposalReviewCommit)?.emit("click");
    findByTestId(panel, editorTestIds.codexProposalReviewClear)?.emit("click");

    const input = findByTestId(panel, editorTestIds.codexProposalReviewInput);
    input?.setProperty("value", "{\"schemaVersion\":\"codex-rigging-edit-proposal-v0\"}");
    findByTestId(panel, editorTestIds.codexProposalReviewForm)?.emit("submit");

    expect(calls).toEqual([
      "approve",
      "clear",
      "review:{\"schemaVersion\":\"codex-rigging-edit-proposal-v0\"}"
    ]);
  });
});

const createReviewState = () => projectCodexProposalReviewState({
  inputText: JSON.stringify(createProposal()),
  proposal: createProposal(),
  validationResult: createValidationResult(),
  diffPreviewResult: createDiffPreview(),
  rerunValidationResult: createRerunValidation(),
  approvalResponse: createApprovalResponse()
});

const createProposal = (): CodexRiggingEditProposalDto => ({
  schemaVersion: "codex-rigging-edit-proposal-v0",
  proposalId: "proposal_editorPanelCodex",
  createdAt: "2026-06-04T00:00:00.000Z",
  source: {
    surface: "codex",
    agentId: "agent_editorPanelCodex",
    submittedBy: "codex"
  },
  packageContext: {
    packageId: PackageIdSchema.parse("pkg_editorPanelCodex"),
    basePackageRevision: 0,
    productPreflightReportId: "preflight_editorPanelCodex",
    productPreflightStatus: "pass",
    validationReportIds: [ValidationReportIdSchema.parse("val_editorPanelCodex")]
  },
  metadata: {
    title: "Panel proposal",
    summary: "Codex submitted a structured proposal for panel review.",
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  operations: [{
    stepId: "step_editorPanelPart",
    operationType: "createPart",
    operationId: OperationIdSchema.parse("op_editorPanelPart"),
    targetRefs: [{ kind: "part", id: "part_editorPanel" }],
    payload: {
      partId: "part_editorPanel",
      displayName: "Panel Part",
      parentPartId: "part_root"
    },
    expectedPreconditions: [],
    expectedOutcome: {
      summary: "Dry-run preview adds a part for review.",
      touchedTargetRefs: [{ kind: "part", id: "part_editorPanel" }],
      expectedEvidenceRefs: []
    }
  }],
  approvalPolicy: {
    requiresUserApproval: true,
    allowAutomaticCommit: false
  },
  evidenceRefs: []
});

const createValidationResult = (): CodexProposalValidationResultDto => ({
  schemaVersion: "codex-proposal-validation-result-v0",
  proposalId: "proposal_editorPanelCodex",
  checkedAt: "2026-06-04T00:00:00.000Z",
  status: "valid",
  summary: "Proposal validates against the deterministic catalog.",
  catalogId: "catalog_editorPanelCodex",
  canPreview: true,
  canRequestApproval: true,
  approvalGate: {
    requiresUserApproval: true,
    automaticCommitAllowed: false,
    approvalReady: true
  },
  operationResults: [{
    stepId: "step_editorPanelPart",
    operationType: "createPart",
    status: "valid",
    issueIds: [],
    diagnosticRefs: [],
    checkedTargetRefs: [{ kind: "part", id: "part_editorPanel" }]
  }],
  issues: [],
  evidenceRefs: []
});

const createDiffPreview = (): CodexProposalDiffPreviewResultDto => ({
  schemaVersion: "codex-proposal-diff-preview-result-v0",
  proposalId: "proposal_editorPanelCodex",
  previewId: "preview_editorPanelCodex",
  generatedAt: "2026-06-04T00:00:00.000Z",
  status: "ready",
  summary: "Codex proposal preview is ready.",
  previewOnly: true,
  committed: false,
  basePackageRevision: 0,
  previewPackageRevision: 1,
  sourceValidationStatus: "valid",
  modelDiff: {
    schemaVersion: "model-diff-v1",
    baseRevision: 0,
    candidateRevision: 1,
    added: [{ kind: "part", id: "part_editorPanel" }],
    removed: [],
    changed: [],
    operationIds: [OperationIdSchema.parse("op_editorPanelPart")]
  },
  diagnostics: [],
  evidenceRefs: []
});

const createRerunValidation = (): CodexProposalRerunValidationResultDto => ({
  schemaVersion: "codex-proposal-rerun-validation-result-v0",
  proposalId: "proposal_editorPanelCodex",
  previewId: "preview_editorPanelCodex",
  generatedAt: "2026-06-04T00:00:00.000Z",
  stateScope: "preview",
  status: "not_evaluated",
  summary: "Rerun validation has not evaluated a preview Product Preflight report.",
  diagnostics: [],
  evidenceRefs: []
});

const createApprovalResponse = (): CodexProposalApprovalEvidenceResponseDto => ({
  schemaVersion: "codex-proposal-approval-evidence-response-v0",
  proposalId: "proposal_editorPanelCodex",
  approvalRequestId: "approval_editorPanelCodex",
  generatedAt: "2026-06-04T00:00:00.000Z",
  approvalStatus: "requested",
  commitStatus: "needs_approval",
  requiresUserApproval: true,
  automaticCommitAllowed: false,
  summary: "Approval was requested; no commit has occurred.",
  evidenceRefs: []
});

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

class TestFormData {
  private readonly values = new Map<string, string>();

  constructor(form: TestElement) {
    for (const field of form.queryAllByPredicate((element) => element.name.length > 0)) {
      this.values.set(field.name, field.value);
    }
  }

  get(name: string): string | null {
    return this.values.get(name) ?? null;
  }
}

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: { preventDefault(): void }) => void>>();
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  type = "";
  name = "";
  value = "";
  rows = 0;
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

  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    const event = {
      preventDefault() {}
    };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
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
