import { describe, expect, it } from "vitest";

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
  createEmptyCodexProposalReviewState,
  projectCodexProposalReviewState
} from "./codex-proposal-review-state.js";

describe("Codex proposal review state", () => {
  it("starts with an empty review state", () => {
    const state = createEmptyCodexProposalReviewState();

    expect(state.status).toBe("not_loaded");
    expect(state.statusLabel).toContain("No Codex proposal loaded");
    expect(state.canRequestApproval).toBe(false);
    expect(state.canCommitApprovedProposal).toBe(false);
  });

  it("projects proposal, validation, diff, rerun, and approval status for review", () => {
    const state = projectCodexProposalReviewState({
      inputText: JSON.stringify(createProposal()),
      proposal: createProposal(),
      validationResult: createValidationResult(),
      diffPreviewResult: createDiffPreview(),
      rerunValidationResult: createRerunValidation({ status: "not_evaluated" }),
      approvalResponse: createApprovalResponse({
        approvalStatus: "requested",
        commitStatus: "needs_approval"
      })
    });

    expect(state.status).toBe("reviewed");
    expect(state.proposal?.proposalId).toBe("proposal_editorCodexReview");
    expect(state.validation?.statusLabel).toContain("valid");
    expect(state.diffPreview?.previewSafetyLabel).toBe("Preview only / not committed");
    expect(state.rerunValidation?.statusLabel).toContain("not_evaluated");
    expect(state.approval.automaticCommitLabel).toBe("Automatic commit disabled");
    expect(state.canRequestApproval).toBe(false);
    expect(state.canRecordApproval).toBe(true);
    expect(state.canCommitApprovedProposal).toBe(false);
    expect(JSON.stringify(state).toLowerCase()).not.toContain("auto-fix");
  });

  it("enables manual commit only after an approved-not-committed response", () => {
    const state = projectCodexProposalReviewState({
      inputText: JSON.stringify(createProposal()),
      proposal: createProposal(),
      validationResult: createValidationResult(),
      diffPreviewResult: createDiffPreview(),
      rerunValidationResult: createRerunValidation({ status: "pass" }),
      approvalResponse: createApprovalResponse({
        approvalStatus: "approved",
        commitStatus: "approved_not_committed"
      })
    });

    expect(state.canRequestApproval).toBe(false);
    expect(state.canRecordApproval).toBe(false);
    expect(state.canCommitApprovedProposal).toBe(true);
    expect(state.commitSafetyLabel).toContain("Manual commit");
  });
});

const createProposal = (): CodexRiggingEditProposalDto => ({
  schemaVersion: "codex-rigging-edit-proposal-v0",
  proposalId: "proposal_editorCodexReview",
  createdAt: "2026-06-04T00:00:00.000Z",
  source: {
    surface: "codex",
    agentId: "agent_editorCodexReview",
    submittedBy: "codex"
  },
  packageContext: {
    packageId: PackageIdSchema.parse("pkg_editorCodexReview"),
    basePackageRevision: 0,
    packageHash: "hash_editorCodexReview",
    productPreflightReportId: "preflight_editorCodexReview",
    productPreflightStatus: "pass",
    validationReportIds: [ValidationReportIdSchema.parse("val_editorCodexReview")]
  },
  metadata: {
    title: "Review face part proposal",
    summary: "Codex submitted a structured createPart proposal for editor review.",
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"],
    userVisibleRationale: "Adds a face part under the root part for user review."
  },
  operations: [{
    stepId: "step_editorCreateFacePart",
    operationType: "createPart",
    operationId: OperationIdSchema.parse("op_editorCreateFacePart"),
    targetRefs: [{ kind: "part", id: "part_editorFace" }],
    payload: {
      partId: "part_editorFace",
      displayName: "Editor Face",
      parentPartId: "part_root"
    },
    expectedPreconditions: [{
      preconditionKind: "packageRevisionMatches",
      summary: "Proposal base package revision matches the current editor package."
    }],
    expectedOutcome: {
      summary: "Dry-run preview adds the face part without committing.",
      touchedTargetRefs: [{ kind: "part", id: "part_editorFace" }],
      expectedEvidenceRefs: ["evidence_editorCodexReview_diffPreview"]
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
  proposalId: "proposal_editorCodexReview",
  checkedAt: "2026-06-04T00:00:00.000Z",
  status: "valid",
  summary: "Proposal validates against the deterministic catalog and Product Preflight context.",
  catalogId: "catalog_editorCodexReview",
  canPreview: true,
  canRequestApproval: true,
  approvalGate: {
    requiresUserApproval: true,
    automaticCommitAllowed: false,
    approvalReady: true
  },
  operationResults: [{
    stepId: "step_editorCreateFacePart",
    operationType: "createPart",
    status: "valid",
    issueIds: [],
    diagnosticRefs: [],
    checkedTargetRefs: [{ kind: "part", id: "part_editorFace" }]
  }],
  issues: [],
  evidenceRefs: []
});

const createDiffPreview = (): CodexProposalDiffPreviewResultDto => ({
  schemaVersion: "codex-proposal-diff-preview-result-v0",
  proposalId: "proposal_editorCodexReview",
  previewId: "preview_editorCodexReview",
  generatedAt: "2026-06-04T00:00:00.000Z",
  status: "ready",
  summary: "Codex proposal preview is ready with one dry-run operation.",
  previewOnly: true,
  committed: false,
  basePackageRevision: 0,
  previewPackageRevision: 1,
  sourceValidationStatus: "valid",
  modelDiff: {
    schemaVersion: "model-diff-v1",
    baseRevision: 0,
    candidateRevision: 1,
    added: [{ kind: "part", id: "part_editorFace" }],
    removed: [],
    changed: [],
    operationIds: [OperationIdSchema.parse("op_editorCreateFacePart")]
  },
  diagnostics: [],
  evidenceRefs: []
});

const createRerunValidation = (input: {
  readonly status: CodexProposalRerunValidationResultDto["status"];
}): CodexProposalRerunValidationResultDto => ({
  schemaVersion: "codex-proposal-rerun-validation-result-v0",
  proposalId: "proposal_editorCodexReview",
  previewId: "preview_editorCodexReview",
  generatedAt: "2026-06-04T00:00:00.000Z",
  stateScope: "preview",
  status: input.status,
  summary: `Rerun validation status is ${input.status}.`,
  diagnostics: [],
  evidenceRefs: [],
  ...(input.status === "pass"
    ? {
        productPreflightReport: {
          schemaVersion: "product-preflight-report-v0",
          reportId: "preflight_editorCodexReviewPreview",
          createdAt: "2026-06-04T00:00:00.000Z",
          packageId: PackageIdSchema.parse("pkg_editorCodexReview"),
          packageRevision: 1,
          packageHash: "hash_editorCodexReviewPreview",
          validatorVersion: "validator-test",
          sourceValidationReportIds: [
            ValidationReportIdSchema.parse("val_editorCodexReviewPreview")
          ],
          summary: {
            status: "pass",
            highestSeverity: "info",
            categoryCounts: {
              pass: 1,
              warn: 0,
              fail: 0,
              not_supported: 0,
              not_evaluated: 0
            },
            blockingReasonCount: 0,
            unsupportedClaimCount: 0,
            notEvaluatedClaimCount: 0,
            evidenceRefCount: 0,
            diagnosticRefCount: 0
          },
          categories: [],
          recommendedNextActions: []
        }
      }
    : {})
});

const createApprovalResponse = (input: {
  readonly approvalStatus: CodexProposalApprovalEvidenceResponseDto["approvalStatus"];
  readonly commitStatus: CodexProposalApprovalEvidenceResponseDto["commitStatus"];
}): CodexProposalApprovalEvidenceResponseDto => ({
  schemaVersion: "codex-proposal-approval-evidence-response-v0",
  proposalId: "proposal_editorCodexReview",
  approvalRequestId: "approval_editorCodexReview",
  generatedAt: "2026-06-04T00:00:00.000Z",
  approvalStatus: input.approvalStatus,
  commitStatus: input.commitStatus,
  requiresUserApproval: true,
  automaticCommitAllowed: false,
  summary: `Approval ${input.approvalStatus}; commit ${input.commitStatus}.`,
  evidenceRefs: []
});
