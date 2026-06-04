import {
  OperationIdSchema,
  PackageIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  CodexProposalDiffPreviewResultDto,
  CodexProposalValidationResultDto,
  CodexRiggingEditProposalDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createCodexProposalRerunValidationResult } from "./codex-proposal-rerun-validation.js";
import { buildValidationReport } from "./report-builder.js";

const CREATED_AT = "2026-06-04T00:00:00.000Z";
const PACKAGE_ID = PackageIdSchema.parse("pkg_codexRerun");
const OTHER_PACKAGE_ID = PackageIdSchema.parse("pkg_otherRerun");

describe("Codex proposal rerun validation bridge", () => {
  it("builds a preview-scoped Product Preflight result from fresh rerun validation reports", () => {
    const proposal = createProposal();
    const validationReport = buildValidationReport({
      reportId: "val_codexRerun_preview",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 1,
      profile: "strict"
    });

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal),
      stateBinding: {
        stateScope: "preview",
        diffPreview: createDiffPreview()
      },
      rerunValidationReports: [validationReport],
      generatedAt: CREATED_AT
    });

    expect(result).toMatchObject({
      proposalId: "proposal_rerunTest",
      previewId: "preview_rerunTest",
      generatedAt: CREATED_AT,
      stateScope: "preview",
      status: "not_evaluated"
    });
    expect(result.productPreflightReport).toMatchObject({
      reportId: "preflight_proposal_rerunTest",
      packageId: PACKAGE_ID,
      packageRevision: 1,
      summary: {
        status: "not_evaluated"
      }
    });
    expect(result.evidenceRefs.map((evidenceRef) => evidenceRef.evidenceKind)).toEqual([
      "rerunValidation",
      "productPreflight"
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("rejects stale preview rerun evidence instead of embedding it as current Product Preflight", () => {
    const proposal = createProposal();
    const staleValidationReport = buildValidationReport({
      reportId: "val_codexRerun_stale",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 0,
      profile: "strict"
    });

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal),
      stateBinding: {
        stateScope: "preview",
        diffPreview: createDiffPreview()
      },
      rerunValidationReports: [staleValidationReport],
      generatedAt: CREATED_AT
    });

    expect(result.status).toBe("fail");
    expect(result.previewId).toBe("preview_rerunTest");
    expect(result.productPreflightReport).toBeUndefined();
    expect(result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "codexProposal.rerunValidation.staleEvidence",
      "codexProposal.rerunValidation.staleEvidence"
    ]);
    expect(result.evidenceRefs.map((evidenceRef) => evidenceRef.evidenceKind)).toEqual([
      "rerunValidation"
    ]);
  });

  it("rejects preview rerun evidence from another package when proposal package id is omitted", () => {
    const proposal = createProposal({ packageId: "omit" });
    const otherPackageReport = buildValidationReport({
      reportId: "val_codexRerun_otherPreviewPackage",
      createdAt: CREATED_AT,
      packageId: OTHER_PACKAGE_ID,
      packageRevision: 1,
      profile: "strict"
    });

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal),
      stateBinding: {
        stateScope: "preview",
        diffPreview: createDiffPreview({ packageId: PACKAGE_ID })
      },
      rerunValidationReports: [otherPackageReport],
      generatedAt: CREATED_AT
    });

    expect(proposal.packageContext.packageId).toBeUndefined();
    expect(result.status).toBe("fail");
    expect(result.productPreflightReport).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "codexProposal.rerunValidation.staleEvidence",
        target: { kind: "package", id: OTHER_PACKAGE_ID }
      }),
      expect.objectContaining({
        checkId: "codexProposal.rerunValidation.staleEvidence",
        target: { kind: "package", id: OTHER_PACKAGE_ID }
      })
    ]);
    expect(result.diagnostics.every((diagnostic) =>
      diagnostic.message.includes(`does not match expected package ${PACKAGE_ID}`)
    )).toBe(true);
    expect(result.evidenceRefs[0]).toMatchObject({
      evidenceKind: "rerunValidation",
      target: { kind: "package", id: PACKAGE_ID }
    });
  });

  it("supports an explicit post-commit state without carrying a preview id", () => {
    const proposal = createProposal();
    const validationReport = buildValidationReport({
      reportId: "val_codexRerun_postCommit",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 3,
      profile: "strict"
    });

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal),
      stateBinding: {
        stateScope: "postCommit",
        packageRevision: 3,
        packageId: PACKAGE_ID
      },
      rerunValidationReports: [validationReport],
      generatedAt: CREATED_AT
    });

    expect(result.stateScope).toBe("postCommit");
    expect(result.previewId).toBeUndefined();
    expect(result.productPreflightReport?.packageRevision).toBe(3);
    expect(result.evidenceRefs[0]).toMatchObject({
      evidenceKind: "rerunValidation",
      artifactRef: {
        artifactKind: "rerunValidation",
        path: "generated/codex-proposals/proposal_rerunTest.postCommit_r3.rerun-validation.json"
      }
    });
  });

  it("preserves explicit post-commit package id when proposal package id is omitted", () => {
    const proposal = createProposal({ packageId: "omit" });
    const validationReport = buildValidationReport({
      reportId: "val_codexRerun_omittedProposalPackage",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 3,
      profile: "strict"
    });

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal),
      stateBinding: {
        stateScope: "postCommit",
        packageRevision: 3,
        packageId: PACKAGE_ID
      },
      rerunValidationReports: [validationReport],
      generatedAt: CREATED_AT
    });

    expect(result.stateScope).toBe("postCommit");
    expect(result.status).toBe("not_evaluated");
    expect(result.productPreflightReport?.packageId).toBe(PACKAGE_ID);
    expect(result.evidenceRefs[0]).toMatchObject({
      evidenceKind: "rerunValidation",
      target: { kind: "package", id: PACKAGE_ID }
    });
  });

  it("blocks a post-commit package id that differs from the proposal package id", () => {
    const proposal = createProposal();
    const otherPackageReport = buildValidationReport({
      reportId: "val_codexRerun_otherPostCommit",
      createdAt: CREATED_AT,
      packageId: OTHER_PACKAGE_ID,
      packageRevision: 3,
      profile: "strict"
    });

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal),
      stateBinding: {
        stateScope: "postCommit",
        packageRevision: 3,
        packageId: OTHER_PACKAGE_ID
      },
      rerunValidationReports: [otherPackageReport],
      generatedAt: CREATED_AT
    });

    expect(result.stateScope).toBe("postCommit");
    expect(result.status).toBe("fail");
    expect(result.productPreflightReport).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "codexProposal.rerunValidation.packageMismatch",
        severity: "blocking",
        target: { kind: "package", id: OTHER_PACKAGE_ID }
      })
    ]);
    expect(result.evidenceRefs.map((evidenceRef) => evidenceRef.evidenceKind)).toEqual([
      "rerunValidation"
    ]);
  });

  it("keeps missing rerun evidence explicit as not evaluated", () => {
    const proposal = createProposal();

    const result = createCodexProposalRerunValidationResult({
      proposal,
      validationResult: createValidValidationResult(proposal),
      stateBinding: {
        stateScope: "preview",
        diffPreview: createDiffPreview()
      },
      generatedAt: CREATED_AT
    });

    expect(result.status).toBe("not_evaluated");
    expect(result.productPreflightReport).toBeUndefined();
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "codexProposal.rerunValidation.notEvaluated",
        status: "needs_review",
        severity: "warning"
      })
    ]);
  });
});

const createProposal = (
  options: {
    readonly packageId?: CodexRiggingEditProposalDto["packageContext"]["packageId"] | "omit";
  } = {}
): CodexRiggingEditProposalDto => {
  const packageId = options.packageId ?? PACKAGE_ID;

  return {
    schemaVersion: "codex-rigging-edit-proposal-v0",
    proposalId: "proposal_rerunTest",
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
      title: "Rerun test",
      summary: "Focused Codex proposal rerun validation test.",
      relatedAC: [],
      relatedScenarios: []
    },
    operations: [
      {
        stepId: "step_createFace",
        operationType: "createPart",
        operationId: OperationIdSchema.parse("op_create_face"),
        targetRefs: [],
        payload: {
          partId: "part_face",
          displayName: "Face",
          parentPartId: "part_root"
        },
        expectedPreconditions: []
      }
    ],
    approvalPolicy: {
      requiresUserApproval: true,
      allowAutomaticCommit: false
    },
    evidenceRefs: []
  };
};

const createValidValidationResult = (
  proposal: CodexRiggingEditProposalDto
): CodexProposalValidationResultDto => ({
  schemaVersion: "codex-proposal-validation-result-v0",
  proposalId: proposal.proposalId,
  checkedAt: CREATED_AT,
  status: "valid",
  summary: "Proposal is valid for rerun validation.",
  canPreview: true,
  canRequestApproval: true,
  approvalGate: {
    requiresUserApproval: true,
    automaticCommitAllowed: false,
    approvalReady: true
  },
  operationResults: [
    {
      stepId: "step_createFace",
      operationType: "createPart",
      status: "valid",
      issueIds: [],
      diagnosticRefs: [],
      checkedTargetRefs: []
    }
  ],
  issues: [],
  evidenceRefs: []
});

const createDiffPreview = (
  options: {
    readonly packageId?: string;
  } = {}
): CodexProposalDiffPreviewResultDto => ({
  schemaVersion: "codex-proposal-diff-preview-result-v0",
  proposalId: "proposal_rerunTest",
  previewId: "preview_rerunTest",
  generatedAt: CREATED_AT,
  status: "ready",
  summary: "Preview is ready for rerun validation.",
  previewOnly: true,
  committed: false,
  basePackageRevision: 0,
  previewPackageRevision: 1,
  sourceValidationStatus: "valid",
  diagnostics: [],
  evidenceRefs: [
    {
      evidenceId: "evidence_proposal_rerunTest_preview_rerunTest_diffPreview",
      evidenceKind: "dryRunDiffPreview",
      artifactRef: {
        artifactKind: "diffPreview",
        path: "generated/codex-proposals/proposal_rerunTest.preview_rerunTest.diff-preview.json"
      },
      target: {
        kind: "package",
        id: options.packageId ?? PACKAGE_ID
      },
      summary: "Dry-run diff preview evidence for rerun validation tests.",
      producer: "operationCore"
    }
  ]
});
