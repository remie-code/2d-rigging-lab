import { describe, expect, it, vi } from "vitest";

import {
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalRerunValidationResultDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  type ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import {
  OperationResultSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";

import { InMemoryAiApprovalPolicy } from "./ai-approval-policy.js";
import { AiCommandBasisSchema, AiCommandSessionSchema } from "./ai-command-request.js";
import { InMemoryAiCommandTranscript } from "./ai-command-transcript.js";
import {
  approveCodexProposal,
  commitApprovedCodexProposal,
  requestCodexProposalApproval
} from "./ai-codex-proposal-approval-lifecycle.js";

describe("Codex proposal approval lifecycle transcript bridge", () => {
  it("records proposal preview evidence and blocks commit before approval", async () => {
    const policy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const proposal = createProposal();
    const validationResult = createValidationResult();
    const diffPreview = createDiffPreview();
    const rerunValidationResult = createRerunValidationResult();
    const approvalRequest = requestCodexProposalApproval({
      commandId: "cmd_request_codex_proposal_approval",
      session: createSession(),
      basis: createBasis(),
      proposal,
      validationResult,
      diffPreview,
      rerunValidationResult,
      approvalPolicy: policy,
      transcript
    });
    const host = createCommitHost();

    const commitAttempt = await commitApprovedCodexProposal({
      commandId: "cmd_commit_codex_proposal_without_approval",
      session: createSession(),
      basis: createBasis(),
      proposal,
      validationResult,
      diffPreview,
      rerunValidationResult,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript,
      host
    });

    expect(approvalRequest).toMatchObject({
      approvalStatus: "requested",
      commitStatus: "needs_approval",
      automaticCommitAllowed: false
    });
    expect(approvalRequest.evidenceRefs.map((evidenceRef) => evidenceRef.evidenceKind)).toEqual(
      expect.arrayContaining([
        "proposalReceipt",
        "proposalValidation",
        "dryRunDiffPreview",
        "rerunValidation",
        "productPreflight"
      ])
    );
    expect(commitAttempt.response).toMatchObject({
      approvalStatus: "requested",
      commitStatus: "needs_approval"
    });
    expect(host.commitOperation).not.toHaveBeenCalled();
    expect(transcript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        command: "dryRunOperation",
        status: "ok",
        evidenceRefs: expect.arrayContaining([
          "evidence_proposal_wave40Ai_proposalReceipt",
          "evidence_proposal_wave40Ai_proposalValidation",
          "evidence_proposal_wave40Ai_preview_wave40Ai_diffPreview",
          "evidence_proposal_wave40Ai_preview_wave40Ai_rerunValidation",
          "evidence_proposal_wave40Ai_preflight_wave40Ai_productPreflight"
        ])
      }),
      expect.objectContaining({
        entryType: "command",
        command: "commitOperation",
        status: "needs_approval",
        evidenceRefs: expect.arrayContaining([
          "evidence_proposal_wave40Ai_approval_wave40Ai_needs_approval_commitResult"
        ])
      })
    ]);
  });

  it("records approval decision and commit result evidence when an approved proposal commits", async () => {
    const policy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const proposal = createProposal();
    const validationResult = createValidationResult();
    const diffPreview = createDiffPreview();
    const rerunValidationResult = createRerunValidationResult();
    const approvalRequest = requestCodexProposalApproval({
      commandId: "cmd_request_codex_proposal_approval",
      session: createSession(),
      basis: createBasis(),
      proposal,
      validationResult,
      diffPreview,
      rerunValidationResult,
      approvalPolicy: policy,
      transcript
    });
    const approvalDecision = approveCodexProposal({
      proposal,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript
    });
    const host = createCommitHost();

    const committed = await commitApprovedCodexProposal({
      commandId: "cmd_commit_codex_proposal",
      session: createSession(),
      basis: createBasis(),
      proposal,
      validationResult,
      diffPreview,
      rerunValidationResult,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript,
      host
    });

    expect(approvalDecision).toMatchObject({
      approvalStatus: "approved",
      commitStatus: "approved_not_committed"
    });
    expect(committed.response).toMatchObject({
      approvalStatus: "approved",
      commitStatus: "committed"
    });
    expect(committed.response.evidenceRefs.map((evidenceRef) => evidenceRef.evidenceKind)).toEqual(
      expect.arrayContaining(["approvalDecision", "commitResult", "operationLog"])
    );
    expect(host.commitOperation).toHaveBeenCalledTimes(1);
    expect(host.commitOperation.mock.calls[0]?.[0]).toMatchObject({
      operationId: "op_createCodexAiParameter",
      dryRun: false,
      basePackageRevision: 7,
      operationType: "createParameter"
    });
    expect(transcript.entries).toEqual([
      expect.objectContaining({ entryType: "command", command: "dryRunOperation" }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "approval_wave40Ai",
        evidenceRefs: [
          "evidence_proposal_wave40Ai_approval_wave40Ai_approvalDecision"
        ]
      }),
      expect.objectContaining({
        entryType: "command",
        command: "commitOperation",
        status: "ok",
        operationId: "op_createCodexAiParameter",
        evidenceRefs: expect.arrayContaining([
          "evidence_proposal_wave40Ai_approval_wave40Ai_approvalDecision",
          "evidence_proposal_wave40Ai_approval_wave40Ai_committed_commitResult",
          "evidence_proposal_wave40Ai_op_createCodexAiParameter_operationLog"
        ])
      })
    ]);
  });

  it("does not register approval when rerun validation is missing", () => {
    const policy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const response = requestCodexProposalApproval({
      commandId: "cmd_request_codex_proposal_approval_missing_rerun",
      session: createSession(),
      basis: createBasis(),
      proposal: createProposal(),
      validationResult: createValidationResult(),
      diffPreview: createDiffPreview(),
      approvalPolicy: policy,
      transcript
    });

    expect(response).toMatchObject({
      approvalStatus: "not_requested",
      commitStatus: "blocked"
    });
    expect(policy.records).toEqual([]);
    expect(transcript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        command: "dryRunOperation",
        status: "rejected",
        evidenceRefs: expect.arrayContaining([
          "evidence_proposal_wave40Ai_proposalReceipt",
          "evidence_proposal_wave40Ai_proposalValidation",
          "evidence_proposal_wave40Ai_preview_wave40Ai_diffPreview"
        ])
      })
    ]);
  });

  it("does not register approval without commit approval capability", () => {
    const policy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const response = requestCodexProposalApproval({
      commandId: "cmd_request_codex_proposal_approval_without_capability",
      session: createSession(["dryRunEdit"]),
      basis: createBasis(),
      proposal: createProposal(),
      validationResult: createValidationResult(),
      diffPreview: createDiffPreview(),
      rerunValidationResult: createRerunValidationResult(),
      approvalPolicy: policy,
      transcript
    });

    expect(response).toMatchObject({
      approvalStatus: "not_requested",
      commitStatus: "blocked"
    });
    expect(policy.records).toEqual([]);
    expect(transcript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        command: "dryRunOperation",
        status: "permission_denied"
      })
    ]);
  });

  it("rejects approval request id reuse across proposals before commit host access", async () => {
    const policy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const approvedProposal = createProposal();
    const approvalRequest = requestCodexProposalApproval({
      commandId: "cmd_request_codex_proposal_approval",
      session: createSession(),
      basis: createBasis(),
      proposal: approvedProposal,
      validationResult: createValidationResult(),
      diffPreview: createDiffPreview(),
      rerunValidationResult: createRerunValidationResult(),
      approvalPolicy: policy,
      transcript
    });
    approveCodexProposal({
      proposal: approvedProposal,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript
    });
    const otherProposal = createOtherProposal();
    const otherValidationResult = createValidationResultForProposal(otherProposal);
    const otherDiffPreview = createDiffPreviewForProposal(otherProposal);
    const otherRerunValidationResult = createRerunValidationResultForProposal(
      otherProposal,
      otherDiffPreview
    );
    const rejectedApproval = approveCodexProposal({
      proposal: otherProposal,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript
    });
    const host = createCommitHost();

    const reusedApprovalCommit = await commitApprovedCodexProposal({
      commandId: "cmd_commit_other_codex_proposal_with_reused_approval",
      session: createSession(),
      basis: createBasis(),
      proposal: otherProposal,
      validationResult: otherValidationResult,
      diffPreview: otherDiffPreview,
      rerunValidationResult: otherRerunValidationResult,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript,
      host
    });

    expect(rejectedApproval).toMatchObject({
      approvalStatus: "rejected",
      commitStatus: "blocked"
    });
    expect(reusedApprovalCommit.response).toMatchObject({
      approvalStatus: "rejected",
      commitStatus: "blocked"
    });
    expect(host.commitOperation).not.toHaveBeenCalled();
    expect(transcript.entries).toEqual([
      expect.objectContaining({ entryType: "command", command: "dryRunOperation" }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "approval_wave40Ai"
      }),
      expect.objectContaining({
        entryType: "command",
        command: "commitOperation",
        status: "rejected",
        evidenceRefs: expect.arrayContaining([
          "evidence_proposal_otherWave40Ai_approval_wave40Ai_blocked_commitResult"
        ])
      })
    ]);
  });

  it("rejects stale diff-preview base revision before commit host access", async () => {
    const policy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const proposal = createProposal();
    const validationResult = createValidationResult();
    const diffPreview = createDiffPreview();
    const rerunValidationResult = createRerunValidationResult();
    const approvalRequest = requestCodexProposalApproval({
      commandId: "cmd_request_codex_proposal_approval",
      session: createSession(),
      basis: createBasis(),
      proposal,
      validationResult,
      diffPreview,
      rerunValidationResult,
      approvalPolicy: policy,
      transcript
    });
    approveCodexProposal({
      proposal,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript
    });
    const staleBaseDiffPreview = CodexProposalDiffPreviewResultDtoSchema.parse({
      ...diffPreview,
      basePackageRevision: 6,
      previewPackageRevision: 8
    });
    const host = createCommitHost();

    const staleCommit = await commitApprovedCodexProposal({
      commandId: "cmd_commit_codex_proposal_with_stale_diff_base",
      session: createSession(),
      basis: createBasis(),
      proposal,
      validationResult,
      diffPreview: staleBaseDiffPreview,
      rerunValidationResult,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy: policy,
      transcript,
      host
    });

    expect(staleCommit.response).toMatchObject({
      approvalStatus: "requested",
      commitStatus: "blocked"
    });
    expect(staleCommit.response.summary).toContain(
      "Diff preview base package revision does not match the proposal base package revision."
    );
    expect(host.commitOperation).not.toHaveBeenCalled();
  });
});

const createSession = (
  capabilities: readonly ("dryRunEdit" | "commitWithApproval")[] = [
    "dryRunEdit",
    "commitWithApproval"
  ]
) => ({
  ...AiCommandSessionSchema.parse({
    agentId: "agent_codex",
    capabilities
  })
});

const createBasis = () =>
  AiCommandBasisSchema.parse({
    packageRevision: 7,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  });

const createProposal = () =>
  CodexRiggingEditProposalDtoSchema.parse({
    schemaVersion: "codex-rigging-edit-proposal-v0",
    proposalId: "proposal_wave40Ai",
    createdAt: "2026-06-04T00:00:00.000Z",
    source: {
      surface: "codex",
      agentId: "agent_codex"
    },
    packageContext: {
      packageId: "pkg_codexAi",
      basePackageRevision: 7,
      productPreflightReportId: "preflight_wave40Ai",
      validationReportIds: ["val_baseline"]
    },
    metadata: {
      title: "Create Codex proposal parameter",
      summary: "Codex submitted a structured proposal.",
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operations: [
      {
        stepId: "step_createParameter",
        operationType: "createParameter",
        operationId: "op_createCodexAiParameter",
        targetRefs: [
          {
            kind: "parameter",
            id: "param_codexAi"
          }
        ],
        payload: {
          parameterId: "param_codexAi",
          displayName: "Codex AI Parameter",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      }
    ]
  });

const createOtherProposal = () =>
  CodexRiggingEditProposalDtoSchema.parse({
    ...createProposal(),
    proposalId: "proposal_otherWave40Ai",
    operations: [
      {
        ...createProposal().operations[0],
        stepId: "step_createOtherParameter",
        operationId: "op_createOtherCodexAiParameter",
        targetRefs: [
          {
            kind: "parameter",
            id: "param_otherCodexAi"
          }
        ],
        payload: {
          parameterId: "param_otherCodexAi",
          displayName: "Other Codex AI Parameter",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      }
    ]
  });

const createValidationResult = () =>
  CodexProposalValidationResultDtoSchema.parse({
    schemaVersion: "codex-proposal-validation-result-v0",
    proposalId: "proposal_wave40Ai",
    checkedAt: "2026-06-04T00:00:00.000Z",
    status: "valid",
    summary: "Proposal validates against the catalog.",
    catalogId: "catalog_wave40Ai",
    canPreview: true,
    canRequestApproval: true,
    approvalGate: {
      requiresUserApproval: true,
      automaticCommitAllowed: false,
      approvalReady: true
    },
    operationResults: [
      {
        stepId: "step_createParameter",
        operationType: "createParameter",
        status: "valid"
      }
    ],
    evidenceRefs: []
  });

const createValidationResultForProposal = (
  proposal: ReturnType<typeof createProposal>
) =>
  CodexProposalValidationResultDtoSchema.parse({
    ...createValidationResult(),
    proposalId: proposal.proposalId,
    operationResults: proposal.operations.map((operation) => ({
      stepId: operation.stepId,
      operationType: operation.operationType,
      status: "valid"
    }))
  });

const createDiffPreview = () =>
  CodexProposalDiffPreviewResultDtoSchema.parse({
    schemaVersion: "codex-proposal-diff-preview-result-v0",
    proposalId: "proposal_wave40Ai",
    previewId: "preview_wave40Ai",
    generatedAt: "2026-06-04T00:00:00.000Z",
    status: "ready",
    summary: "Preview diff is available without committing.",
    previewOnly: true,
    committed: false,
    basePackageRevision: 7,
    previewPackageRevision: 8,
    sourceValidationStatus: "valid",
    evidenceRefs: []
  });

const createDiffPreviewForProposal = (
  proposal: ReturnType<typeof createProposal>
) =>
  CodexProposalDiffPreviewResultDtoSchema.parse({
    ...createDiffPreview(),
    proposalId: proposal.proposalId,
    previewId: `preview_${proposal.proposalId.replace(/^proposal_/, "")}`,
    basePackageRevision: proposal.packageContext.basePackageRevision,
    previewPackageRevision: proposal.packageContext.basePackageRevision + proposal.operations.length,
    evidenceRefs: []
  });

const createRerunValidationResult = () =>
  CodexProposalRerunValidationResultDtoSchema.parse({
    schemaVersion: "codex-proposal-rerun-validation-result-v0",
    proposalId: "proposal_wave40Ai",
    previewId: "preview_wave40Ai",
    generatedAt: "2026-06-04T00:00:00.000Z",
    stateScope: "preview",
    status: "pass",
    summary: "Preview Product Preflight passes.",
    productPreflightReport: createProductPreflightReport(8),
    evidenceRefs: [
      {
        evidenceId: "evidence_proposal_wave40Ai_preview_wave40Ai_rerunValidation",
        evidenceKind: "rerunValidation",
        artifactRef: {
          artifactKind: "rerunValidation",
          path: "generated/codex-proposals/proposal_wave40Ai.preview_wave40Ai.rerun-validation.json"
        },
        target: {
          kind: "package",
          id: "pkg_codexAi"
        },
        summary: "Rerun validation evidence for proposal proposal_wave40Ai.",
        producer: "validatorCore"
      },
      {
        evidenceId: "evidence_proposal_wave40Ai_preflight_wave40Ai_productPreflight",
        evidenceKind: "productPreflight",
        artifactRef: {
          artifactKind: "productPreflightReport",
          path: "generated/product-preflight/preflight_wave40Ai.product-preflight.json"
        },
        target: {
          kind: "package",
          id: "pkg_codexAi"
        },
        summary: "Product Preflight report preflight_wave40Ai for proposal proposal_wave40Ai.",
        producer: "validatorCore"
      }
    ]
  });

const createRerunValidationResultForProposal = (
  proposal: ReturnType<typeof createProposal>,
  diffPreview: ReturnType<typeof createDiffPreview>
) =>
  CodexProposalRerunValidationResultDtoSchema.parse({
    ...createRerunValidationResult(),
    proposalId: proposal.proposalId,
    previewId: diffPreview.previewId,
    productPreflightReport: createProductPreflightReport(
      diffPreview.previewPackageRevision ?? proposal.packageContext.basePackageRevision
    ),
    evidenceRefs: []
  });

const createProductPreflightReport = (packageRevision: number): ProductPreflightReportDto =>
  ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId: "preflight_wave40Ai",
    createdAt: "2026-06-04T00:00:00.000Z",
    packageId: "pkg_codexAi",
    packageRevision,
    validatorVersion: "validator-test",
    sourceValidationReportIds: ["val_baseline"],
    summary: {
      status: "pass",
      highestSeverity: "info",
      categoryCounts: {
        pass: PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.length,
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
    categories: PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) => ({
      category,
      status: "pass",
      severity: "info",
      summary: `${category} passes.`,
      evidenceRefs: [],
      diagnosticRefs: [],
      blockingReasons: [],
      unsupportedClaims: [],
      notEvaluatedClaims: [],
      recommendedNextActions: []
    })),
    recommendedNextActions: []
  });

const createCommitHost = () => ({
  dryRunOperation: vi.fn(),
  commitOperation: vi.fn((request: OperationRequestDto) =>
    OperationResultSchema.parse({
      schemaVersion: "operation-result-v1",
      operationId: request.operationId ?? "op_codexProposalCommit",
      status: "committed",
      precondition: {
        ok: true,
        diagnostics: [],
        checkedTargetRefs: []
      },
      diagnostics: [],
      generatedRuntimeSnapshotIds: [],
      generatedRuntimeStateRefs: [],
      generatedRuntimeStateSequenceRefs: [],
      generatedValidationReportIds: [],
      reversible: true
    })
  )
});
