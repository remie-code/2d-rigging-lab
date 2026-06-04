import { describe, expect, it } from "vitest";

import {
  CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS,
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  type CodexProposalUnsupportedBoundaryKindDto
} from "@private-2d-rigging-lab/contracts";

import {
  AiCodexProposalCommandRequestSchema,
  AiCodexProposalCommandResponseSchema
} from "./ai-codex-proposal-command.js";
import { AiCommandNameSchema } from "./ai-command-name.js";
import { AiCommandRequestSchema } from "./ai-command-request.js";

describe("AI Codex proposal command contract", () => {
  it("parses proposal command requests without provider or transport details", () => {
    const catalogRequest = AiCodexProposalCommandRequestSchema.parse({
      schemaVersion: "ai-codex-proposal-command-request-v0",
      commandId: "cmd_get_codex_proposal_catalog",
      session: {
        agentId: "agent_codex",
        capabilities: ["read"]
      },
      basis: {
        packageRevision: 7,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "getCodexProposalOperationCatalog",
      payload: {}
    });
    const validateRequest = AiCodexProposalCommandRequestSchema.parse({
      ...createCommandBase("cmd_validate_codex_proposal", ["validate"]),
      command: "validateCodexProposal",
      payload: {
        proposal: createProposal(),
        operationCatalog: createCatalog()
      }
    });
    const previewRequest = AiCodexProposalCommandRequestSchema.parse({
      ...createCommandBase("cmd_preview_codex_proposal", ["dryRunEdit"]),
      command: "previewCodexProposalDiff",
      payload: {
        proposal: createProposal(),
        validationResult: createValidationResult()
      }
    });
    const rerunRequest = AiCodexProposalCommandRequestSchema.parse({
      ...createCommandBase("cmd_rerun_codex_proposal", ["validate"]),
      command: "rerunCodexProposalValidation",
      payload: {
        proposal: createProposal(),
        preview: createPreviewResult()
      }
    });
    const approvalRequest = AiCodexProposalCommandRequestSchema.parse({
      ...createCommandBase("cmd_request_codex_proposal_approval", ["commitWithApproval"]),
      command: "requestCodexProposalApproval",
      payload: {
        proposal: createProposal(),
        validationResult: createValidationResult(),
        diffPreview: createPreviewResult(),
        rerunValidationResult: createRerunResult()
      }
    });

    expect(catalogRequest).toMatchObject({
      command: "getCodexProposalOperationCatalog",
      payload: {
        includeUnsupportedBoundaries: true
      }
    });
    expect(validateRequest.command).toBe("validateCodexProposal");
    expect(previewRequest).toMatchObject({
      command: "previewCodexProposalDiff",
      payload: {
        dryRunOnly: true
      }
    });
    expect(rerunRequest.command).toBe("rerunCodexProposalValidation");
    expect(approvalRequest.command).toBe("requestCodexProposalApproval");
  });

  it("rejects operation catalog requests that omit unsupported boundaries", () => {
    expect(
      AiCodexProposalCommandRequestSchema.safeParse({
        schemaVersion: "ai-codex-proposal-command-request-v0",
        commandId: "cmd_get_codex_proposal_catalog_without_boundaries",
        session: {
          agentId: "agent_codex",
          capabilities: ["read"]
        },
        basis: {
          packageRevision: 7,
          relatedAC: [],
          relatedScenarios: []
        },
        command: "getCodexProposalOperationCatalog",
        payload: {
          includeUnsupportedBoundaries: false
        }
      }).success
    ).toBe(false);
  });

  it("parses proposal command responses with validation, preview, rerun, and approval result shapes", () => {
    const catalogResponse = AiCodexProposalCommandResponseSchema.parse({
      ...createResponseBase("cmd_get_codex_proposal_catalog", "getCodexProposalOperationCatalog"),
      payload: createCatalog()
    });
    const validationResponse = AiCodexProposalCommandResponseSchema.parse({
      ...createResponseBase("cmd_validate_codex_proposal", "validateCodexProposal"),
      payload: createValidationResult()
    });
    const previewResponse = AiCodexProposalCommandResponseSchema.parse({
      ...createResponseBase("cmd_preview_codex_proposal", "previewCodexProposalDiff"),
      payload: createPreviewResult()
    });
    const rerunResponse = AiCodexProposalCommandResponseSchema.parse({
      ...createResponseBase("cmd_rerun_codex_proposal", "rerunCodexProposalValidation"),
      payload: createRerunResult()
    });
    const approvalResponse = AiCodexProposalCommandResponseSchema.parse({
      ...createResponseBase("cmd_request_codex_proposal_approval", "requestCodexProposalApproval"),
      payload: createApprovalResponse()
    });

    expect(catalogResponse).toMatchObject({
      payload: {
        unsupportedBoundaries: expect.arrayContaining([
          expect.objectContaining({ boundaryKind: "llmProvider" })
        ])
      }
    });
    expect(validationResponse).toMatchObject({
      payload: {
        canRequestApproval: true
      }
    });
    expect(previewResponse).toMatchObject({
      payload: {
        previewOnly: true,
        committed: false
      }
    });
    expect(rerunResponse).toMatchObject({
      payload: {
        status: "pass"
      }
    });
    expect(approvalResponse).toMatchObject({
      payload: {
        approvalStatus: "requested",
        commitStatus: "needs_approval",
        automaticCommitAllowed: false
      }
    });
  });

  it("keeps proposal commands out of the existing executable command union until host wiring lands", () => {
    expect(AiCommandNameSchema.safeParse("validateCodexProposal").success).toBe(false);
    expect(
      AiCommandRequestSchema.safeParse({
        ...createLegacyCommandBase("cmd_validate_codex_proposal", ["validate"]),
        command: "validateCodexProposal",
        payload: {
          proposal: createProposal()
        }
      }).success
    ).toBe(false);
  });
});

const createCommandBase = (commandId: string, capabilities: readonly string[]) => ({
  schemaVersion: "ai-codex-proposal-command-request-v0",
  commandId,
  session: {
    agentId: "agent_codex",
    capabilities
  },
  basis: {
    packageRevision: 7,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  }
} as const);

const createLegacyCommandBase = (commandId: string, capabilities: readonly string[]) => ({
  ...createCommandBase(commandId, capabilities),
  schemaVersion: "ai-command-request-v1"
} as const);

const createResponseBase = (commandId: string, command: string) => ({
  schemaVersion: "ai-codex-proposal-command-response-v0",
  commandId,
  status: "ok",
  command
} as const);

const createProposal = () => ({
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
    title: "Create AI proposal parameter",
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
        displayName: "Codex AI Parameter"
      }
    }
  ]
} as const);

const createCatalog = () => ({
  schemaVersion: "codex-proposal-operation-catalog-v0",
  catalogId: "catalog_wave40Ai",
  operations: [
    {
      operationType: "createParameter",
      operationFamily: "modelStructure",
      availability: "available",
      displayName: "Create parameter",
      summary: "Create a project-defined parameter.",
      targetKinds: ["parameter"],
      payloadSchemaRef: "operation.createParameter.payload.v1",
      requiredInputs: [],
      approvalRequirement: {
        requiresUserApproval: true,
        allowAutomaticCommit: false
      },
      previewSupport: {
        dryRunSupported: true,
        standaloneDiffSupported: true,
        rerunValidationSupported: true,
        productPreflightSupported: true
      }
    }
  ],
  unsupportedBoundaries: CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS.map(
    (boundaryKind: CodexProposalUnsupportedBoundaryKindDto) => ({
      boundaryKind,
      status: "unsupported",
      severity: "blocking",
      summary: `${boundaryKind} is outside the Codex proposal command contract.`
    })
  )
} as const);

const createValidationResult = () => ({
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
  ]
} as const);

const createPreviewResult = () => ({
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
  sourceValidationStatus: "valid"
} as const);

const createRerunResult = () => ({
  schemaVersion: "codex-proposal-rerun-validation-result-v0",
  proposalId: "proposal_wave40Ai",
  previewId: "preview_wave40Ai",
  generatedAt: "2026-06-04T00:00:00.000Z",
  stateScope: "preview",
  status: "pass",
  summary: "Preview Product Preflight passes.",
  productPreflightReport: {
    schemaVersion: "product-preflight-report-v0",
    reportId: "preflight_wave40Ai",
    createdAt: "2026-06-04T00:00:00.000Z",
    packageId: "pkg_codexAi",
    packageRevision: 8,
    validatorVersion: "validator-test",
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
      summary: `${category} passes.`
    }))
  }
} as const);

const createApprovalResponse = () => ({
  schemaVersion: "codex-proposal-approval-evidence-response-v0",
  proposalId: "proposal_wave40Ai",
  approvalRequestId: "approval_wave40Ai",
  generatedAt: "2026-06-04T00:00:00.000Z",
  approvalStatus: "requested",
  commitStatus: "needs_approval",
  requiresUserApproval: true,
  automaticCommitAllowed: false,
  summary: "Approval has been requested and no commit has occurred.",
  evidenceRefs: []
} as const);
