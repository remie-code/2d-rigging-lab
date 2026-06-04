import { describe, expect, it } from "vitest";

import {
  AiCommandBasisSchema,
  AiCommandSessionSchema,
  InMemoryAiApprovalPolicy,
  InMemoryAiCommandTranscript,
  approveCodexProposal,
  commitApprovedCodexProposal,
  requestCodexProposalApproval,
  validateCodexProposal
} from "@private-2d-rigging-lab/ai-interface";
import {
  CodexRiggingEditProposalDtoSchema,
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  type ProductPreflightReportDto
} from "@private-2d-rigging-lab/contracts";
import { previewCodexProposalDiff } from "@private-2d-rigging-lab/operation-core";
import { createCodexProposalRerunValidationResult } from "@private-2d-rigging-lab/validator-core";

import { createEditorSessionAdapter } from "./session-adapter.js";

describe("editor session Codex proposal approval lifecycle", () => {
  it("keeps proposal commit approval-gated and records lifecycle evidence in the AI transcript", async () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-06-04T00:00:00.000Z")
    });
    const packageId = adapter.authoringSession.packageIdentity.packageId;
    const proposal = createProposal({
      packageId,
      basePackageRevision: adapter.authoringSession.packageRevision
    });
    const validationResult = validateCodexProposal({
      proposal,
      productPreflightReport: createProductPreflightReport({
        packageId,
        packageRevision: adapter.authoringSession.packageRevision
      }),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });
    const preview = previewCodexProposalDiff({
      session: adapter.authoringSession,
      proposal,
      validationResult,
      generatedAt: "2026-06-04T00:00:00.000Z"
    }).diffPreview;
    const rerunValidationResult = createCodexProposalRerunValidationResult({
      proposal,
      validationResult,
      stateBinding: {
        stateScope: "preview",
        diffPreview: preview
      },
      productPreflightReport: createProductPreflightReport({
        packageId,
        packageRevision: preview.previewPackageRevision ?? 1
      }),
      generatedAt: "2026-06-04T00:00:00.000Z"
    });
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const operationHost = {
      dryRunOperation: adapter.dryRunOperation,
      commitOperation: (request: Parameters<typeof adapter.commitOperation>[0]) =>
        adapter.commitOperation(request).operationResult
    };

    expect(validationResult.status).toBe("valid");
    expect(preview.status).toBe("ready");
    expect(rerunValidationResult.status).toBe("pass");
    expect(adapter.createPersistenceSnapshot().parameterIds).not.toContain(
      "param_editorCodexProposal"
    );

    const approvalRequest = requestCodexProposalApproval({
      commandId: "cmd_editor_request_codex_proposal_approval",
      session: createSession(),
      basis: createBasis(adapter.authoringSession.packageRevision),
      proposal,
      validationResult,
      diffPreview: preview,
      rerunValidationResult,
      approvalPolicy,
      transcript
    });
    const blockedCommit = await commitApprovedCodexProposal({
      commandId: "cmd_editor_commit_codex_proposal_without_approval",
      session: createSession(),
      basis: createBasis(adapter.authoringSession.packageRevision),
      proposal,
      validationResult,
      diffPreview: preview,
      rerunValidationResult,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy,
      transcript,
      host: operationHost
    });

    expect(blockedCommit.response.commitStatus).toBe("needs_approval");
    expect(adapter.createPersistenceSnapshot().parameterIds).not.toContain(
      "param_editorCodexProposal"
    );

    approveCodexProposal({
      proposal,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy,
      transcript
    });
    const committed = await commitApprovedCodexProposal({
      commandId: "cmd_editor_commit_codex_proposal",
      session: createSession(),
      basis: createBasis(adapter.authoringSession.packageRevision),
      proposal,
      validationResult,
      diffPreview: preview,
      rerunValidationResult,
      approvalRequestId: approvalRequest.approvalRequestId,
      approvalPolicy,
      transcript,
      host: operationHost
    });

    expect(committed.response.commitStatus).toBe("committed");
    expect(adapter.createPersistenceSnapshot().parameterIds).toContain(
      "param_editorCodexProposal"
    );
    expect(transcript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        command: "dryRunOperation",
        evidenceRefs: expect.arrayContaining([
          "evidence_proposal_editorCodexProposal_proposalReceipt",
          "evidence_proposal_editorCodexProposal_proposalValidation"
        ])
      }),
      expect.objectContaining({
        entryType: "command",
        command: "commitOperation",
        status: "needs_approval"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "approval_editorCodexProposal",
        evidenceRefs: [
          "evidence_proposal_editorCodexProposal_approval_editorCodexProposal_approvalDecision"
        ]
      }),
      expect.objectContaining({
        entryType: "command",
        command: "commitOperation",
        status: "ok",
        evidenceRefs: expect.arrayContaining([
          "evidence_proposal_editorCodexProposal_approval_editorCodexProposal_committed_commitResult",
          "evidence_proposal_editorCodexProposal_op_editorCodexProposalCreateParameter_operationLog"
        ])
      })
    ]);
  });
});

const createSession = () => ({
  ...AiCommandSessionSchema.parse({
    agentId: "agent_codex",
    capabilities: ["dryRunEdit", "commitWithApproval"]
  })
});

const createBasis = (packageRevision: number) =>
  AiCommandBasisSchema.parse({
    packageRevision,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  });

const createProposal = (input: {
  readonly packageId: string;
  readonly basePackageRevision: number;
}) =>
  CodexRiggingEditProposalDtoSchema.parse({
    schemaVersion: "codex-rigging-edit-proposal-v0",
    proposalId: "proposal_editorCodexProposal",
    createdAt: "2026-06-04T00:00:00.000Z",
    source: {
      surface: "codex",
      agentId: "agent_codex"
    },
    packageContext: {
      packageId: input.packageId,
      basePackageRevision: input.basePackageRevision,
      productPreflightReportId: "preflight_editorCodexProposal",
      validationReportIds: []
    },
    metadata: {
      title: "Create editor proposal parameter",
      summary: "Codex submitted a structured createParameter proposal.",
      relatedAC: ["AC-MVP-014"],
      relatedScenarios: ["SC-AGENT-002"]
    },
    operations: [
      {
        stepId: "step_createParameter",
        operationType: "createParameter",
        operationId: "op_editorCodexProposalCreateParameter",
        targetRefs: [
          {
            kind: "parameter",
            id: "param_editorCodexProposal"
          }
        ],
        payload: {
          parameterId: "param_editorCodexProposal",
          displayName: "Editor Codex Proposal Parameter",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      }
    ]
  });

const createProductPreflightReport = (input: {
  readonly packageId: string;
  readonly packageRevision: number;
}): ProductPreflightReportDto =>
  ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId: "preflight_editorCodexProposal",
    createdAt: "2026-06-04T00:00:00.000Z",
    packageId: input.packageId,
    packageRevision: input.packageRevision,
    validatorVersion: "validator-test",
    sourceValidationReportIds: [],
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
