import { describe, expect, it } from "vitest";

import {
  OperationIdSchema,
  PackageIdSchema,
  type CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import { createBrowserProjectStore, type StorageLike } from "../project-persistence/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("Codex proposal review workflow", () => {
  it("reviews pasted Codex proposal JSON without committing the preview", async () => {
    const workflow = createWorkflow();
    const initialRevision = workflow.state.revision.packageRevision;
    const proposal = createProposal(workflow.state);

    const result = await workflow.reviewCodexProposalText(JSON.stringify(proposal));

    expect(result.status).toBe("reviewed");
    expect(workflow.state.codexProposalReview.status).toBe("reviewed");
    expect(workflow.state.codexProposalReview.proposal?.proposalId).toBe(proposal.proposalId);
    expect(workflow.state.codexProposalReview.validation?.status).toBe("invalid");
    expect(workflow.state.codexProposalReview.diffPreview?.previewSafetyLabel).toBe(
      "Preview only / not committed"
    );
    expect(workflow.state.codexProposalReview.diffPreview?.status).toBe("blocked");
    expect(workflow.state.codexProposalReview.rerunValidation).toBeNull();
    expect(workflow.state.productPreflight.status).toBe("ready");
    expect(workflow.state.revision.packageRevision).toBe(initialRevision);
  });

  it("blocks approval request when rerun validation has not passed", async () => {
    const workflow = createWorkflow();
    const proposal = createProposal(workflow.state);
    await workflow.reviewCodexProposalText(JSON.stringify(proposal));

    const result = workflow.requestCodexProposalReviewApproval();

    expect(result.status).toBe("blocked");
    expect(result.response?.approvalStatus).toBe("not_requested");
    expect(result.response?.commitStatus).toBe("blocked");
    expect(result.response?.automaticCommitAllowed).toBe(false);
    expect(workflow.state.revision.packageRevision).toBe(proposal.packageContext.basePackageRevision);
  });

  it("requires explicit approval before committing a valid reviewed proposal", async () => {
    const workflow = createWorkflow();
    const tutorialResult = workflow.createTutorialMiniModel();
    expect(tutorialResult.status).toBe("created");

    const initialRevision = workflow.state.revision.packageRevision;
    const proposal = createProposal(workflow.state);

    const reviewResult = await workflow.reviewCodexProposalText(JSON.stringify(proposal));

    expect(reviewResult.status).toBe("reviewed");
    expect(workflow.state.codexProposalReview.validation?.status).toBe("valid");
    expect(workflow.state.codexProposalReview.diffPreview?.status).toBe("ready");
    expect(workflow.state.codexProposalReview.rerunValidation?.status).toBe("pass");
    expect(workflow.state.codexProposalReview.canRequestApproval).toBe(true);
    expect(workflow.state.revision.packageRevision).toBe(initialRevision);
    expect(workflow.state.parts.some((part) => part.partId === "part_editorWorkflowCodex")).toBe(false);

    const requestResult = workflow.requestCodexProposalReviewApproval();

    expect(requestResult.status).toBe("requested");
    expect(requestResult.response?.approvalStatus).toBe("requested");
    expect(requestResult.response?.commitStatus).toBe("needs_approval");
    expect(requestResult.response?.automaticCommitAllowed).toBe(false);
    expect(workflow.state.revision.packageRevision).toBe(initialRevision);
    expect(workflow.state.codexProposalReview.canRecordApproval).toBe(true);

    const approvalResult = workflow.approveCodexProposalReview();

    expect(approvalResult.status).toBe("approved");
    expect(approvalResult.response?.approvalStatus).toBe("approved");
    expect(approvalResult.response?.commitStatus).toBe("approved_not_committed");
    expect(approvalResult.response?.automaticCommitAllowed).toBe(false);
    expect(workflow.state.revision.packageRevision).toBe(initialRevision);
    expect(workflow.state.codexProposalReview.canCommitApprovedProposal).toBe(true);

    const commitResult = await workflow.commitApprovedCodexProposalReview();

    expect(commitResult.status).toBe("committed");
    expect(commitResult.response?.approvalStatus).toBe("approved");
    expect(commitResult.response?.commitStatus).toBe("committed");
    expect(commitResult.response?.automaticCommitAllowed).toBe(false);
    expect(workflow.state.revision.packageRevision).toBe(initialRevision + proposal.operations.length);
    expect(workflow.state.parts.some((part) => part.partId === "part_editorWorkflowCodex")).toBe(true);
    expect(workflow.state.codexProposalReview.status).toBe("reviewed");
    expect(workflow.state.codexProposalReview.approval.commitStatus).toBe("committed");
    expect(workflow.state.codexProposalReview.approvalResponseDto?.commitStatus).toBe("committed");
    expect(workflow.state.codexProposalReview.canCommitApprovedProposal).toBe(false);
  });

  it("records JSON input errors in the review state", async () => {
    const workflow = createWorkflow();

    const result = await workflow.reviewCodexProposalText("{");

    expect(result.status).toBe("failed");
    expect(workflow.state.codexProposalReview.status).toBe("input_error");
    expect(workflow.state.codexProposalReview.errorMessage).not.toBeNull();
  });
});

const createWorkflow = () =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage: createMemoryStorage(),
      now: () => new Date("2026-06-04T00:00:00.000Z")
    }),
    now: () => new Date("2026-06-04T00:00:00.000Z")
  });

const createProposal = (
  state: ReturnType<typeof createEditorWorkflowController>["state"]
): CodexRiggingEditProposalDto => {
  const packageId = state.loadedPackage?.packageId ?? "pkg_editorCodexReview";
  const parentPartId = state.parts[0]?.partId ?? "part_root";

  return {
    schemaVersion: "codex-rigging-edit-proposal-v0",
    proposalId: "proposal_editorWorkflowCodex",
    createdAt: "2026-06-04T00:00:00.000Z",
    source: {
      surface: "codex",
      agentId: "agent_editorWorkflowCodex",
      submittedBy: "codex"
    },
    packageContext: {
      packageId: PackageIdSchema.parse(packageId),
      basePackageRevision: state.revision.packageRevision,
      productPreflightStatus: "pass",
      validationReportIds: []
    },
    metadata: {
      title: "Review workflow part proposal",
      summary: "Codex submitted a structured createPart proposal for the editor review workflow.",
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operations: [{
      stepId: "step_editorWorkflowCodexPart",
      operationType: "createPart",
      operationId: OperationIdSchema.parse("op_editorWorkflowCodexPart"),
      targetRefs: [{ kind: "part", id: "part_editorWorkflowCodex" }],
      payload: {
        partId: "part_editorWorkflowCodex",
        displayName: "Editor Workflow Codex Part",
        parentPartId
      },
      expectedPreconditions: [{
        preconditionKind: "packageRevisionMatches",
        summary: "Proposal base package revision matches the current editor package."
      }],
      expectedOutcome: {
        summary: "Dry-run preview adds a part without committing it.",
        touchedTargetRefs: [{ kind: "part", id: "part_editorWorkflowCodex" }],
        expectedEvidenceRefs: []
      }
    }],
    approvalPolicy: {
      requiresUserApproval: true,
      allowAutomaticCommit: false
    },
    evidenceRefs: []
  };
};

const createMemoryStorage = (): StorageLike => {
  const values = new Map<string, string>();

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
