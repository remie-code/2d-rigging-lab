import {
  createInitialAuthoringRevision,
  getPartById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  OperationIdSchema,
  PackageIdSchema,
  PartIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  CodexProposalValidationIssueDto,
  CodexProposalValidationResultDto,
  CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { previewCodexProposalDiff } from "./codex-proposal-preview.js";

const CREATED_AT = "2026-06-04T00:00:00.000Z";

describe("Codex proposal diff preview bridge", () => {
  it("dry-runs a validated proposal sequence without mutating committed state", () => {
    const session = createFixtureSession();
    const proposal = createProposal([
      {
        stepId: "step_createFace",
        operationType: "createPart",
        operationId: OperationIdSchema.parse("op_create_face"),
        payload: {
          partId: "part_face",
          displayName: "Face",
          parentPartId: "part_root"
        }
      },
      {
        stepId: "step_updateFace",
        operationType: "updatePart",
        operationId: OperationIdSchema.parse("op_update_face"),
        payload: {
          partId: "part_face",
          displayName: "Face Controls"
        }
      }
    ]);

    const result = previewCodexProposalDiff({
      session,
      proposal,
      validationResult: createValidValidationResult(proposal),
      generatedAt: CREATED_AT
    });

    expect(result.diffPreview).toMatchObject({
      proposalId: "proposal_previewTest",
      previewId: "preview_previewTest",
      generatedAt: CREATED_AT,
      status: "ready",
      previewOnly: true,
      committed: false,
      basePackageRevision: 0,
      previewPackageRevision: 2,
      sourceValidationStatus: "valid"
    });
    expect(result.operationResults.map((operationResult) => operationResult.status)).toEqual([
      "dry_run",
      "dry_run"
    ]);
    expect(result.diffPreview.modelDiff).toMatchObject({
      schemaVersion: "model-diff-v1",
      baseRevision: 0,
      candidateRevision: 2,
      operationIds: ["op_create_face", "op_update_face"],
      added: [{ kind: "part", id: "part_face" }]
    });
    expect(result.diffPreview.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceKind: "dryRunDiffPreview",
        producer: "operationCore",
        artifactRef: expect.objectContaining({
          artifactKind: "diffPreview",
          path: "generated/codex-proposals/proposal_previewTest.preview_previewTest.diff-preview.json"
        })
      })
    ]);

    expect(session.packageRevision).toBe(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toBeUndefined();
    expect(result.previewSession).not.toBe(session);
    expect(result.previewSession?.packageRevision).toBe(2);
    expect(getPartById(result.previewSession!.graph, PartIdSchema.parse("part_face"))).toMatchObject({
      displayName: "Face Controls",
      parentPartId: "part_root"
    });
  });

  it("blocks preview when source proposal validation is not valid", () => {
    const session = createFixtureSession();
    const proposal = createProposal([
      {
        stepId: "step_createFace",
        operationType: "createPart",
        operationId: OperationIdSchema.parse("op_create_face"),
        payload: {
          partId: "part_face",
          displayName: "Face",
          parentPartId: "part_root"
        }
      }
    ]);

    const result = previewCodexProposalDiff({
      session,
      proposal,
      validationResult: createInvalidValidationResult(proposal),
      generatedAt: CREATED_AT
    });

    expect(result.diffPreview.status).toBe("blocked");
    expect(result.diffPreview.sourceValidationStatus).toBe("invalid");
    expect(result.diffPreview.previewPackageRevision).toBeUndefined();
    expect(result.diffPreview.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "codexProposal.preview.validationNotReady"
    );
    expect(result.previewSession).toBeUndefined();
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toBeUndefined();
  });

  it("blocks stale committed package state instead of previewing from the wrong revision", () => {
    const session = createFixtureSession();
    session.packageRevision = 1;
    const proposal = createProposal([
      {
        stepId: "step_createFace",
        operationType: "createPart",
        operationId: OperationIdSchema.parse("op_create_face"),
        payload: {
          partId: "part_face",
          displayName: "Face",
          parentPartId: "part_root"
        }
      }
    ]);

    const result = previewCodexProposalDiff({
      session,
      proposal,
      validationResult: createValidValidationResult(proposal),
      generatedAt: CREATED_AT
    });

    expect(result.diffPreview.status).toBe("blocked");
    expect(result.diffPreview.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "codexProposal.preview.stalePackageRevision",
        severity: "blocking"
      })
    ]);
    expect(result.operationResults).toEqual([]);
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toBeUndefined();
  });

  it("blocks package id mismatch instead of previewing another package at the same revision", () => {
    const session = createFixtureSession();
    const proposal = createProposal([
      {
        stepId: "step_createFace",
        operationType: "createPart",
        operationId: OperationIdSchema.parse("op_create_face"),
        payload: {
          partId: "part_face",
          displayName: "Face",
          parentPartId: "part_root"
        }
      }
    ], {
      packageId: PackageIdSchema.parse("pkg_otherPreview")
    });

    const result = previewCodexProposalDiff({
      session,
      proposal,
      validationResult: createValidValidationResult(proposal),
      generatedAt: CREATED_AT
    });

    expect(result.diffPreview.status).toBe("blocked");
    expect(result.diffPreview.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "codexProposal.preview.packageMismatch",
        severity: "blocking",
        target: { kind: "package", id: "pkg_codexPreview" }
      })
    ]);
    expect(result.previewSession).toBeUndefined();
    expect(result.operationResults).toEqual([]);
    expect(session.packageIdentity.packageId).toBe("pkg_codexPreview");
    expect(session.packageRevision).toBe(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toBeUndefined();
  });

  it("binds omitted proposal package id previews to the concrete session package", () => {
    const session = createFixtureSession();
    const proposal = createProposal([
      {
        stepId: "step_createFace",
        operationType: "createPart",
        operationId: OperationIdSchema.parse("op_create_face"),
        payload: {
          partId: "part_face",
          displayName: "Face",
          parentPartId: "part_root"
        }
      }
    ], {
      packageId: "omit"
    });

    const result = previewCodexProposalDiff({
      session,
      proposal,
      validationResult: createValidValidationResult(proposal),
      generatedAt: CREATED_AT
    });

    expect(proposal.packageContext.packageId).toBeUndefined();
    expect(result.diffPreview.status).toBe("ready");
    expect(result.diffPreview.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceKind: "dryRunDiffPreview",
        target: { kind: "package", id: "pkg_codexPreview" }
      })
    ]);
    expect(session.packageIdentity.packageId).toBe("pkg_codexPreview");
    expect(session.packageRevision).toBe(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toBeUndefined();
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_codexPreview"),
    packageDisplayName: "Codex Preview Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: []
      }
    ],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["part_root"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createProposal = (
  operations: readonly ProposalOperationInput[],
  options: {
    readonly packageId?: CodexRiggingEditProposalDto["packageContext"]["packageId"] | "omit";
  } = {}
): CodexRiggingEditProposalDto => {
  const packageId = options.packageId ?? PackageIdSchema.parse("pkg_codexPreview");

  return {
    schemaVersion: "codex-rigging-edit-proposal-v0",
    proposalId: "proposal_previewTest",
    createdAt: CREATED_AT,
    source: {
      surface: "codex",
      agentId: "codex-test-agent",
      submittedBy: "codex"
    },
    packageContext: {
      ...(packageId === "omit" ? {} : { packageId }),
      basePackageRevision: 0,
      validationReportIds: []
    },
    metadata: {
      title: "Preview test",
      summary: "Focused Codex proposal preview test.",
      relatedAC: [],
      relatedScenarios: []
    },
    operations: operations.map((operation) => ({
      ...operation,
      targetRefs: operation.targetRefs ?? [],
      expectedPreconditions: operation.expectedPreconditions ?? []
    })),
    approvalPolicy: {
      requiresUserApproval: true,
      allowAutomaticCommit: false
    },
    evidenceRefs: []
  };
};

type ProposalOperationInput = Pick<
  CodexRiggingEditProposalDto["operations"][number],
  "stepId" | "operationType" | "operationId" | "payload"
> & Partial<
  Pick<
    CodexRiggingEditProposalDto["operations"][number],
    "targetRefs" | "expectedPreconditions"
  >
>;

const createValidValidationResult = (
  proposal: CodexRiggingEditProposalDto
): CodexProposalValidationResultDto => ({
  schemaVersion: "codex-proposal-validation-result-v0",
  proposalId: proposal.proposalId,
  checkedAt: CREATED_AT,
  status: "valid",
  summary: "Proposal is valid for preview.",
  canPreview: true,
  canRequestApproval: true,
  approvalGate: {
    requiresUserApproval: true,
    automaticCommitAllowed: false,
    approvalReady: true
  },
  operationResults: proposal.operations.map((operation) => ({
    stepId: operation.stepId,
    operationType: operation.operationType,
    status: "valid",
    issueIds: [],
    diagnosticRefs: [],
    checkedTargetRefs: operation.targetRefs
  })),
  issues: [],
  evidenceRefs: []
});

const createInvalidValidationResult = (
  proposal: CodexRiggingEditProposalDto
): CodexProposalValidationResultDto => {
  const issue: CodexProposalValidationIssueDto = {
    issueId: "issue_previewBlocked",
    code: "preflightBlocking",
    severity: "blocking",
    message: "Focused invalid validation fixture.",
    stepId: proposal.operations[0]!.stepId,
    diagnosticRefs: [],
    evidenceRefs: []
  };

  return {
    schemaVersion: "codex-proposal-validation-result-v0",
    proposalId: proposal.proposalId,
    checkedAt: CREATED_AT,
    status: "invalid",
    summary: "Proposal is not valid for preview.",
    canPreview: false,
    canRequestApproval: false,
    approvalGate: {
      requiresUserApproval: true,
      automaticCommitAllowed: false,
      approvalReady: false
    },
    operationResults: [
      {
        stepId: issue.stepId!,
        operationType: proposal.operations[0]!.operationType,
        status: "invalid",
        issueIds: [issue.issueId],
        diagnosticRefs: [],
        checkedTargetRefs: []
      }
    ],
    issues: [issue],
    evidenceRefs: []
  };
};
