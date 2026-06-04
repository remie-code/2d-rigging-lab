import { describe, expect, it } from "vitest";

import {
  CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS,
  CodexProposalApprovalEvidenceResponseDtoSchema,
  CodexProposalDiffPreviewResultDtoSchema,
  CodexProposalOperationCatalogDtoSchema,
  CodexProposalRerunValidationResultDtoSchema,
  CodexProposalValidationResultDtoSchema,
  CodexRiggingEditProposalDtoSchema,
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  type CodexProposalUnsupportedBoundaryKindDto
} from "./index.js";

describe("Codex rigging edit proposal contract", () => {
  it("parses a Codex-submitted proposal with approval-gated operations", () => {
    const proposal = CodexRiggingEditProposalDtoSchema.parse(createProposal());

    expect(proposal.schemaVersion).toBe("codex-rigging-edit-proposal-v0");
    expect(proposal.approvalPolicy).toEqual({
      requiresUserApproval: true,
      allowAutomaticCommit: false
    });
    expect(proposal.operations).toEqual([
      expect.objectContaining({
        stepId: "step_createParameter",
        operationType: "createParameter",
        operationId: "op_createCodexParameter"
      })
    ]);
  });

  it("rejects duplicate proposal step ids and automatic commit claims", () => {
    expect(CodexRiggingEditProposalDtoSchema.safeParse({
      ...createProposal(),
      operations: [
        createProposal().operations[0],
        {
          ...createProposal().operations[0],
          operationId: "op_createCodexParameterDuplicate"
        }
      ]
    }).success).toBe(false);

    expect(CodexRiggingEditProposalDtoSchema.safeParse({
      ...createProposal(),
      approvalPolicy: {
        requiresUserApproval: true,
        allowAutomaticCommit: true
      }
    }).success).toBe(false);
  });

  it("parses an operation catalog that records required unsupported boundaries", () => {
    const catalog = CodexProposalOperationCatalogDtoSchema.parse(createCatalog());

    expect(catalog.schemaVersion).toBe("codex-proposal-operation-catalog-v0");
    expect(catalog.operations[0]).toMatchObject({
      operationType: "createParameter",
      availability: "available",
      approvalRequirement: {
        requiresUserApproval: true,
        allowAutomaticCommit: false
      }
    });
    expect(catalog.unsupportedBoundaries.map((boundary) => boundary.boundaryKind)).toEqual([
      ...CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS
    ]);
  });

  it("rejects catalogs that omit unsupported non-goal boundaries", () => {
    const catalog = createCatalog();
    const result = CodexProposalOperationCatalogDtoSchema.safeParse({
      ...catalog,
      unsupportedBoundaries: catalog.unsupportedBoundaries.filter((boundary) =>
        boundary.boundaryKind !== "llmProvider"
      )
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["unsupportedBoundaries"]
        })
      ]));
    }
  });

  it("parses validation, dry-run diff preview, and rerun Product Preflight results", () => {
    const validation = CodexProposalValidationResultDtoSchema.parse(createValidationResult());
    const preview = CodexProposalDiffPreviewResultDtoSchema.parse(createPreviewResult());
    const rerun = CodexProposalRerunValidationResultDtoSchema.parse(createRerunResult());

    expect(validation).toMatchObject({
      status: "valid",
      canPreview: true,
      canRequestApproval: true,
      approvalGate: {
        requiresUserApproval: true,
        automaticCommitAllowed: false,
        approvalReady: true
      }
    });
    expect(preview).toMatchObject({
      status: "ready",
      previewOnly: true,
      committed: false,
      previewPackageRevision: 8
    });
    expect(rerun.productPreflightReport?.schemaVersion).toBe("product-preflight-report-v0");
  });

  it("rejects non-valid validation results that allow approval requests", () => {
    const result = CodexProposalValidationResultDtoSchema.safeParse({
      ...createValidationResult(),
      status: "invalid",
      canPreview: false,
      canRequestApproval: true,
      operationResults: [
        {
          stepId: "step_createParameter",
          operationType: "createParameter",
          status: "invalid",
          issueIds: ["issue_invalidProposal"]
        }
      ],
      issues: [
        {
          issueId: "issue_invalidProposal",
          code: "schemaInvalid",
          severity: "blocking",
          message: "The proposal is invalid."
        }
      ]
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["canRequestApproval"]
        })
      ]));
    }
  });

  it("rejects ready previews that are not based on valid proposal validation", () => {
    const result = CodexProposalDiffPreviewResultDtoSchema.safeParse({
      ...createPreviewResult(),
      sourceValidationStatus: "invalid"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["sourceValidationStatus"]
        })
      ]));
    }
  });

  it("rejects ready previews that omit the preview package revision", () => {
    const previewWithoutRevision = {
      ...createPreviewResult(),
      previewPackageRevision: undefined
    };
    const result = CodexProposalDiffPreviewResultDtoSchema.safeParse(
      previewWithoutRevision
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["previewPackageRevision"]
        })
      ]));
    }
  });

  it("rejects preview-scoped rerun validation results without a preview id", () => {
    const rerunWithoutPreviewId = {
      ...createRerunResult(),
      previewId: undefined
    };
    const result = CodexProposalRerunValidationResultDtoSchema.safeParse(
      rerunWithoutPreviewId
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["previewId"]
        })
      ]));
    }
  });

  it("rejects passing rerun validation results without a Product Preflight report", () => {
    const passingRerunWithoutPreflight = {
      ...createRerunResult(),
      productPreflightReport: undefined
    };
    const result = CodexProposalRerunValidationResultDtoSchema.safeParse(
      passingRerunWithoutPreflight
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["productPreflightReport"]
        })
      ]));
    }
  });

  it("rejects rerun validation status that contradicts the embedded Product Preflight report", () => {
    const result = CodexProposalRerunValidationResultDtoSchema.safeParse({
      ...createRerunResult(),
      status: "warn"
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["status"]
        })
      ]));
    }
  });

  it("rejects committed approval evidence without approval and commit evidence refs", () => {
    expect(CodexProposalApprovalEvidenceResponseDtoSchema.safeParse({
      ...createApprovalResponse(),
      approvalStatus: "requested",
      commitStatus: "committed"
    }).success).toBe(false);

    expect(CodexProposalApprovalEvidenceResponseDtoSchema.parse(createApprovalResponse()))
      .toMatchObject({
        approvalStatus: "approved",
        commitStatus: "committed",
        requiresUserApproval: true,
        automaticCommitAllowed: false
      });
  });

  it("rejects committed approval evidence that omits approval decision evidence", () => {
    const result = CodexProposalApprovalEvidenceResponseDtoSchema.safeParse({
      ...createApprovalResponse(),
      evidenceRefs: createApprovalResponse().evidenceRefs.filter((evidenceRef) =>
        evidenceRef.evidenceKind !== "approvalDecision"
      )
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["evidenceRefs"]
        })
      ]));
    }
  });

  it("rejects committed approval evidence that omits commit result evidence", () => {
    const result = CodexProposalApprovalEvidenceResponseDtoSchema.safeParse({
      ...createApprovalResponse(),
      evidenceRefs: createApprovalResponse().evidenceRefs.filter((evidenceRef) =>
        evidenceRef.evidenceKind !== "commitResult"
      )
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          code: "custom",
          path: ["evidenceRefs"]
        })
      ]));
    }
  });
});

const createProposal = () => ({
  schemaVersion: "codex-rigging-edit-proposal-v0",
  proposalId: "proposal_wave40Contract",
  createdAt: "2026-06-04T00:00:00.000Z",
  source: {
    surface: "codex",
    agentId: "agent_codex"
  },
  packageContext: {
    packageId: "pkg_codexProposal",
    basePackageRevision: 7,
    productPreflightReportId: "preflight_wave40",
    productPreflightStatus: "warn",
    validationReportIds: ["val_baseline"]
  },
  metadata: {
    title: "Create test parameter",
    summary: "Codex submitted a deterministic rigging edit proposal.",
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"],
    userVisibleRationale: "Create a parameter through the approval-gated proposal path."
  },
  operations: [
    {
      stepId: "step_createParameter",
      operationType: "createParameter",
      operationId: "op_createCodexParameter",
      targetRefs: [
        {
          kind: "parameter",
          id: "param_codex"
        }
      ],
      payload: {
        parameterId: "param_codex",
        displayName: "Codex Parameter"
      },
      expectedPreconditions: [
        {
          preconditionKind: "preflightAllowsPreview",
          summary: "Product Preflight has been supplied for preview gating."
        }
      ],
      expectedOutcome: {
        summary: "The parameter exists in the preview package only.",
        touchedTargetRefs: [
          {
            kind: "parameter",
            id: "param_codex"
          }
        ]
      }
    }
  ]
} as const);

const createCatalog = () => ({
  schemaVersion: "codex-proposal-operation-catalog-v0",
  catalogId: "catalog_wave40",
  generatedAt: "2026-06-04T00:00:00.000Z",
  operations: [
    {
      operationType: "createParameter",
      operationFamily: "modelStructure",
      availability: "available",
      displayName: "Create parameter",
      summary: "Create a project-defined parameter through the deterministic operation path.",
      targetKinds: ["parameter"],
      payloadSchemaRef: "operation.createParameter.payload.v1",
      requiredInputs: [
        {
          inputId: "payload.parameterId",
          inputKind: "payloadField",
          required: true,
          summary: "Stable parameter id to create."
        }
      ],
      approvalRequirement: {
        requiresUserApproval: true,
        allowAutomaticCommit: false
      },
      previewSupport: {
        dryRunSupported: true,
        standaloneDiffSupported: true,
        rerunValidationSupported: true,
        productPreflightSupported: true
      },
      unsupportedBoundaryKinds: []
    }
  ],
  unsupportedBoundaries: CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS.map(
    (boundaryKind: CodexProposalUnsupportedBoundaryKindDto) => ({
      boundaryKind,
      status: "unsupported",
      severity: "blocking",
      summary: `${boundaryKind} is outside the Codex proposal API contract.`
    })
  )
} as const);

const createValidationResult = () => ({
  schemaVersion: "codex-proposal-validation-result-v0",
  proposalId: "proposal_wave40Contract",
  checkedAt: "2026-06-04T00:00:00.000Z",
  status: "valid",
  summary: "The proposal matches schema and catalog constraints.",
  catalogId: "catalog_wave40",
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
      status: "valid",
      checkedTargetRefs: [
        {
          kind: "parameter",
          id: "param_codex"
        }
      ]
    }
  ]
} as const);

const createPreviewResult = () => ({
  schemaVersion: "codex-proposal-diff-preview-result-v0",
  proposalId: "proposal_wave40Contract",
  previewId: "preview_wave40Contract",
  generatedAt: "2026-06-04T00:00:00.000Z",
  status: "ready",
  summary: "Dry-run preview is ready and has not committed state.",
  previewOnly: true,
  committed: false,
  basePackageRevision: 7,
  previewPackageRevision: 8,
  sourceValidationStatus: "valid",
  modelDiff: {
    schemaVersion: "model-diff-v1",
    baseRevision: 7,
    candidateRevision: 8,
    added: [
      {
        kind: "parameter",
        id: "param_codex"
      }
    ],
    operationIds: ["op_createCodexParameter"]
  }
} as const);

const createRerunResult = () => ({
  schemaVersion: "codex-proposal-rerun-validation-result-v0",
  proposalId: "proposal_wave40Contract",
  previewId: "preview_wave40Contract",
  generatedAt: "2026-06-04T00:00:00.000Z",
  stateScope: "preview",
  status: "pass",
  summary: "Product Preflight passes for the preview state.",
  productPreflightReport: createPassingProductPreflightReport()
} as const);

const createApprovalResponse = () => ({
  schemaVersion: "codex-proposal-approval-evidence-response-v0",
  proposalId: "proposal_wave40Contract",
  approvalRequestId: "approval_wave40Contract",
  generatedAt: "2026-06-04T00:00:00.000Z",
  approvalStatus: "approved",
  commitStatus: "committed",
  requiresUserApproval: true,
  automaticCommitAllowed: false,
  summary: "The approved proposal was committed through the approval-gated path.",
  evidenceRefs: [
    {
      evidenceId: "evidence_approvalDecision",
      evidenceKind: "approvalDecision",
      artifactRef: {
        artifactKind: "approvalEvidence",
        path: "generated/codex-proposals/wave40.approval-evidence.json"
      },
      summary: "Human approval was recorded.",
      producer: "human"
    },
    {
      evidenceId: "evidence_commitResult",
      evidenceKind: "commitResult",
      artifactRef: {
        artifactKind: "operationLog",
        path: "operations/log.jsonl",
        operationId: "op_createCodexParameter"
      },
      summary: "Operation log contains the committed proposal operation.",
      producer: "operationCore"
    }
  ]
} as const);

const createPassingProductPreflightReport = () => ({
  schemaVersion: "product-preflight-report-v0",
  reportId: "preflight_wave40",
  createdAt: "2026-06-04T00:00:00.000Z",
  packageId: "pkg_codexProposal",
  packageRevision: 8,
  validatorVersion: "validator-test",
  sourceValidationReportIds: ["val_preview"],
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
    summary: `${category} evidence passes for the preview state.`
  }))
} as const);
