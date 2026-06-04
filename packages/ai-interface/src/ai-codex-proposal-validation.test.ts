import {
  CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS,
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema,
  type ProductPreflightCategoryDto,
  type ProductPreflightReportDto,
  type ProductPreflightStatusDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { getCodexProposalOperationCatalog } from "./ai-codex-proposal-operation-catalog.js";
import { validateCodexProposal } from "./ai-codex-proposal-validation.js";

describe("AI Codex proposal operation catalog", () => {
  it("returns deterministic, sorted, Codex-readable catalog data", () => {
    const firstCatalog = getCodexProposalOperationCatalog();
    const secondCatalog = getCodexProposalOperationCatalog();

    expect(firstCatalog).toEqual(secondCatalog);
    expect(firstCatalog.generatedAt).toBeUndefined();
    expect(firstCatalog.operations.map((operation) => operation.operationType)).toEqual(
      [...firstCatalog.operations.map((operation) => operation.operationType)].sort()
    );
    expect(firstCatalog.unsupportedBoundaries.map((boundary) => boundary.boundaryKind)).toEqual(
      CODEX_PROPOSAL_REQUIRED_UNSUPPORTED_BOUNDARY_KINDS
    );
    expect(firstCatalog.operations).toContainEqual(
      expect.objectContaining({
        operationType: "createParameter",
        availability: "available",
        targetKinds: ["parameter"],
        approvalRequirement: {
          requiresUserApproval: true,
          allowAutomaticCommit: false,
          approvalScope: "wholeProposal"
        },
        previewSupport: {
          dryRunSupported: true,
          standaloneDiffSupported: true,
          rerunValidationSupported: true,
          productPreflightSupported: true
        }
      })
    );
    expect(findCatalogOperation(firstCatalog, "addKeyform")).toMatchObject({
      targetKinds: ["drawable", "mesh", "rigControl"]
    });
    expect(findCatalogOperation(firstCatalog, "addKeyformGrid2d")).toMatchObject({
      targetKinds: ["drawable", "mesh", "rigControl"]
    });
    expect(findCatalogOperation(firstCatalog, "setRuntimeVisibility")).toMatchObject({
      targetKinds: ["drawable"]
    });
    expect(firstCatalog.operations).toContainEqual(
      expect.objectContaining({
        operationType: "renderPixelOracle",
        availability: "unsupported",
        unsupportedBoundaryKinds: ["rendererPixelOracle"]
      })
    );
  });
});

describe("AI Codex proposal validation", () => {
  it("accepts a schema-valid proposal against catalog, target refs, and passing preflight context", () => {
    const result = validateCodexProposal({
      proposal: createProposal(),
      productPreflightReport: createProductPreflightReport("pass"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(result).toMatchObject({
      proposalId: "proposal_wave40DomainB",
      checkedAt: "2026-06-04T00:00:00.000Z",
      status: "valid",
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
          issueIds: []
        }
      ],
      issues: []
    });
  });

  it("marks missing preflight context as not evaluated instead of inventing repair actions", () => {
    const result = validateCodexProposal({
      proposal: createProposal(),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(result).toMatchObject({
      status: "not_evaluated",
      canPreview: false,
      canRequestApproval: false,
      approvalGate: {
        approvalReady: false
      }
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "preflightContextMissing",
        severity: "warning"
      })
    );
    expect(result.evidenceRefs).toEqual([]);
  });

  it("surfaces unsupported catalog operations as non-committable unsupported boundaries", () => {
    const result = validateCodexProposal({
      proposal: createProposal({
        operations: [
          {
            stepId: "step_renderPixelOracle",
            operationType: "renderPixelOracle",
            targetRefs: [],
            payload: {}
          }
        ]
      }),
      productPreflightReport: createProductPreflightReport("pass"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(result.status).toBe("invalid");
    expect(result.canRequestApproval).toBe(false);
    expect(result.operationResults).toEqual([
      expect.objectContaining({
        stepId: "step_renderPixelOracle",
        operationType: "renderPixelOracle",
        status: "unsupported",
        issueIds: expect.arrayContaining(["issue_wave40DomainB_001", "issue_wave40DomainB_002"])
      })
    ]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupportedOperation" }),
        expect.objectContaining({ code: "unsupportedBoundary" })
      ])
    );
  });

  it("requires user decision for warning preflight context without allowing approval", () => {
    const result = validateCodexProposal({
      proposal: createProposal({
        packageContext: {
          productPreflightStatus: "warn"
        }
      }),
      productPreflightReport: createProductPreflightReport("warn"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(result).toMatchObject({
      status: "requires_user_decision",
      canPreview: false,
      canRequestApproval: false,
      approvalGate: {
        approvalReady: false
      }
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "requiresUserDecision",
        severity: "warning"
      })
    );
  });

  it.each([
    {
      preflightStatus: "fail" as const,
      expectedValidationStatus: "invalid" as const,
      expectedIssueCode: "preflightBlocking"
    },
    {
      preflightStatus: "not_supported" as const,
      expectedValidationStatus: "invalid" as const,
      expectedIssueCode: "unsupportedBoundary"
    },
    {
      preflightStatus: "not_evaluated" as const,
      expectedValidationStatus: "not_evaluated" as const,
      expectedIssueCode: "notEvaluated"
    }
  ])(
    "gates supplied Product Preflight $preflightStatus as non-approval-ready",
    ({ preflightStatus, expectedValidationStatus, expectedIssueCode }) => {
      const result = validateCodexProposal({
        proposal: createProposal({
          packageContext: {
            productPreflightStatus: preflightStatus
          }
        }),
        productPreflightReport: createProductPreflightReport(preflightStatus),
        checkedAt: "2026-06-04T00:00:00.000Z"
      });

      expect(result).toMatchObject({
        status: expectedValidationStatus,
        canPreview: false,
        canRequestApproval: false,
        approvalGate: {
          requiresUserApproval: true,
          automaticCommitAllowed: false,
          approvalReady: false
        }
      });
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          code: expectedIssueCode
        })
      );
      expect(result.evidenceRefs).toEqual([]);
    }
  );

  it("uses catalog target kinds as the proposal target-ref oracle", () => {
    const meshKeyformResult = validateCodexProposal({
      proposal: createProposal({
        operations: [
          {
            stepId: "step_addMeshKeyform",
            operationType: "addKeyform",
            operationId: "op_addMeshKeyform",
            targetRefs: [{ kind: "mesh", id: "mesh_keyformTarget" }],
            payload: {
              target: { kind: "mesh", id: "mesh_keyformTarget" },
              targetProperty: "vertices",
              parameterId: "param_codexParameter",
              keyValue: 0,
              interpolation: "linear-1d-v1",
              statePatch: {
                propertyPath: "vertices",
                value: [
                  { x: 0, y: 0 },
                  { x: 1, y: 1 }
                ]
              }
            }
          }
        ]
      }),
      productPreflightReport: createProductPreflightReport("pass"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });
    const invalidRuntimeVisibilityResult = validateCodexProposal({
      proposal: createProposal({
        operations: [
          {
            stepId: "step_setPartRuntimeVisibility",
            operationType: "setRuntimeVisibility",
            operationId: "op_setPartRuntimeVisibility",
            targetRefs: [{ kind: "part", id: "part_notDrawable" }],
            payload: {
              target: { kind: "part", id: "part_notDrawable" },
              runtimeVisibility: false
            }
          }
        ]
      }),
      productPreflightReport: createProductPreflightReport("pass"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(meshKeyformResult.issues).not.toContainEqual(
      expect.objectContaining({ code: "targetRefInvalid" })
    );
    expect(meshKeyformResult.operationResults[0]).toMatchObject({
      status: "valid"
    });
    expect(invalidRuntimeVisibilityResult.status).toBe("invalid");
    expect(invalidRuntimeVisibilityResult.issues).toContainEqual(
      expect.objectContaining({
        code: "targetRefInvalid",
        target: {
          kind: "part",
          id: "part_notDrawable"
        }
      })
    );
  });

  it("rejects target refs not allowed by the catalog entry", () => {
    const result = validateCodexProposal({
      proposal: createProposal({
        operations: [
          {
            stepId: "step_createParameter",
            operationType: "createParameter",
            operationId: "op_createCodexParameter",
            targetRefs: [{ kind: "part", id: "part_wrongTarget" }],
            payload: createParameterPayload()
          }
        ]
      }),
      productPreflightReport: createProductPreflightReport("pass"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(result.status).toBe("invalid");
    expect(result.operationResults[0]).toMatchObject({
      status: "invalid",
      issueIds: ["issue_wave40DomainB_001"]
    });
    expect(result.issues[0]).toMatchObject({
      code: "targetRefInvalid",
      target: {
        kind: "part",
        id: "part_wrongTarget"
      }
    });
  });

  it("rejects payloads that fail required catalog inputs or operation-core schema", () => {
    const result = validateCodexProposal({
      proposal: createProposal({
        operations: [
          {
            stepId: "step_createParameter",
            operationType: "createParameter",
            operationId: "op_createCodexParameter",
            targetRefs: [{ kind: "parameter", id: "param_codexParameter" }],
            payload: {
              displayName: "Codex parameter",
              min: 1,
              max: 0,
              default: 0.5,
              recommendedUiStep: 0.01
            }
          }
        ]
      }),
      productPreflightReport: createProductPreflightReport("pass"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(result.status).toBe("invalid");
    expect(result.operationResults[0]).toMatchObject({
      status: "invalid"
    });
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "schemaInvalid",
          message: expect.stringContaining("parameterId")
        }),
        expect.objectContaining({
          code: "schemaInvalid",
          message: expect.stringContaining("min must be less than or equal to max")
        })
      ])
    );
  });

  it("returns invalid schema results without throwing when Codex submits malformed proposal data", () => {
    const result = validateCodexProposal({
      proposal: {
        schemaVersion: "codex-rigging-edit-proposal-v0",
        proposalId: "proposal_bad",
        operations: []
      },
      productPreflightReport: createProductPreflightReport("pass"),
      checkedAt: "2026-06-04T00:00:00.000Z"
    });

    expect(result).toMatchObject({
      proposalId: "proposal_bad",
      status: "invalid",
      operationResults: [],
      canRequestApproval: false
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        issueId: "issue_bad_001",
        code: "schemaInvalid"
      })
    );
  });
});

const findCatalogOperation = (
  catalog: ReturnType<typeof getCodexProposalOperationCatalog>,
  operationType: string
) => {
  const operation = catalog.operations.find((entry) => entry.operationType === operationType);
  expect(operation).toBeDefined();
  return operation;
};

const createProposal = (
  options: {
    readonly packageContext?: Partial<ReturnType<typeof createBasePackageContext>>;
    readonly operations?: readonly unknown[];
  } = {}
) => ({
  schemaVersion: "codex-rigging-edit-proposal-v0",
  proposalId: "proposal_wave40DomainB",
  createdAt: "2026-06-04T00:00:00.000Z",
  source: {
    surface: "codex",
    agentId: "agent_codex"
  },
  packageContext: {
    ...createBasePackageContext(),
    ...options.packageContext
  },
  metadata: {
    title: "Create Codex parameter",
    summary: "Codex submitted a structured rigging edit proposal.",
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  operations: options.operations ?? [
    {
      stepId: "step_createParameter",
      operationType: "createParameter",
      operationId: "op_createCodexParameter",
      targetRefs: [{ kind: "parameter", id: "param_codexParameter" }],
      payload: createParameterPayload()
    }
  ]
});

const createBasePackageContext = () => ({
  packageId: "pkg_codexProposal",
  basePackageRevision: 7,
  packageHash: "hash_codexProposal",
  productPreflightReportId: "preflight_codexProposal",
  productPreflightStatus: "pass",
  validationReportIds: ["val_codexBaseline"]
});

const createParameterPayload = () => ({
  parameterId: "param_codexParameter",
  displayName: "Codex parameter",
  semanticRole: "custom",
  min: 0,
  max: 1,
  default: 0.5,
  recommendedUiStep: 0.01
});

const createProductPreflightReport = (
  status: ProductPreflightStatusDto
): ProductPreflightReportDto => {
  const categories = PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category, index) =>
    index === 0 ? createCategoryForStatus(category, status) : createPassCategory(category)
  );
  const categoryCounts = {
    pass: categories.filter((category) => category.status === "pass").length,
    warn: categories.filter((category) => category.status === "warn").length,
    fail: categories.filter((category) => category.status === "fail").length,
    not_supported: categories.filter((category) => category.status === "not_supported").length,
    not_evaluated: categories.filter((category) => category.status === "not_evaluated").length
  };
  const diagnosticRefCount = categories.reduce(
    (total, category) =>
      total +
      category.diagnosticRefs.length +
      category.blockingReasons.reduce(
        (reasonTotal, reason) => reasonTotal + reason.diagnosticRefs.length,
        0
      ) +
      category.unsupportedClaims.reduce(
        (claimTotal, claim) => claimTotal + claim.diagnosticRefs.length,
        0
      ) +
      category.notEvaluatedClaims.reduce(
        (claimTotal, claim) => claimTotal + claim.diagnosticRefs.length,
        0
      ),
    0
  );

  return ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId: "preflight_codexProposal",
    createdAt: "2026-06-04T00:00:00.000Z",
    packageId: "pkg_codexProposal",
    packageRevision: 7,
    packageHash: "hash_codexProposal",
    validatorVersion: "validator-test",
    sourceValidationReportIds: ["val_codexBaseline"],
    summary: {
      status,
      highestSeverity: highestSeverityForStatus(status),
      categoryCounts,
      blockingReasonCount: categories.reduce(
        (total, category) => total + category.blockingReasons.length,
        0
      ),
      unsupportedClaimCount: categories.reduce(
        (total, category) => total + category.unsupportedClaims.length,
        0
      ),
      notEvaluatedClaimCount: categories.reduce(
        (total, category) => total + category.notEvaluatedClaims.length,
        0
      ),
      evidenceRefCount: 0,
      diagnosticRefCount
    },
    categories,
    recommendedNextActions: []
  });
};

const createCategoryForStatus = (
  category: ProductPreflightCategoryDto,
  status: ProductPreflightStatusDto
) => {
  switch (status) {
    case "pass":
      return createPassCategory(category);
    case "warn":
      return {
        category,
        status,
        severity: "warning",
        summary: `${category} needs user review.`,
        evidenceRefs: [],
        diagnosticRefs: [
          {
            checkId: "mesh.degenerateTriangle",
            reportId: "val_codexBaseline",
            status: "warning",
            severity: "warning"
          }
        ],
        blockingReasons: [],
        unsupportedClaims: [],
        notEvaluatedClaims: [],
        recommendedNextActions: []
      };
    case "fail":
      return {
        category,
        status,
        severity: "blocking",
        summary: `${category} has a blocking diagnostic.`,
        evidenceRefs: [],
        diagnosticRefs: [],
        blockingReasons: [
          {
            reasonId: "block_codexPreflight",
            reasonCode: "failingDiagnostic",
            severity: "blocking",
            message: "Blocking diagnostic prevents proposal approval.",
            evidenceRefs: [],
            diagnosticRefs: [
              {
                checkId: "mesh.triangleIndexOutOfRange",
                reportId: "val_codexBaseline",
                status: "fail",
                severity: "blocking"
              }
            ],
            recommendedNextActions: [
              {
                actionId: "action_inspectCodexDiagnostic",
                actionKind: "inspectDiagnostic",
                summary: "Inspect the blocking diagnostic.",
                targetCategory: category
              }
            ]
          }
        ],
        unsupportedClaims: [],
        notEvaluatedClaims: [],
        recommendedNextActions: []
      };
    case "not_supported":
      return {
        category,
        status,
        severity: "blocking",
        summary: `${category} records an unsupported claim.`,
        evidenceRefs: [],
        diagnosticRefs: [],
        blockingReasons: [],
        unsupportedClaims: [
          {
            claimId: "claim_codexUnsupported",
            status: "not_supported",
            claimKind: "rendererPixelOracle",
            capabilityLabel: "Renderer pixel oracle",
            explanation: "Renderer pixel oracle support is outside this project boundary.",
            severity: "blocking",
            evidenceRefs: [],
            diagnosticRefs: [],
            recommendedNextActions: [
              {
                actionId: "action_recordUnsupportedBoundary",
                actionKind: "recordUnsupportedBoundary",
                summary: "Record the unsupported boundary.",
                targetCategory: category
              }
            ]
          }
        ],
        notEvaluatedClaims: [],
        recommendedNextActions: []
      };
    case "not_evaluated":
      return {
        category,
        status,
        severity: "warning",
        summary: `${category} has not been evaluated.`,
        evidenceRefs: [],
        diagnosticRefs: [],
        blockingReasons: [],
        unsupportedClaims: [],
        notEvaluatedClaims: [
          {
            claimId: "claim_codexNotEvaluated",
            status: "not_evaluated",
            category,
            evidenceKind: "runtimeSnapshot",
            reason: "Runtime snapshot evidence was not supplied.",
            severity: "warning",
            requiredEvidenceKinds: ["runtimeSnapshot"],
            evidenceRefs: [],
            diagnosticRefs: [],
            recommendedNextActions: [
              {
                actionId: "action_provideRuntimeEvidence",
                actionKind: "provideEvidence",
                summary: "Provide runtime snapshot evidence.",
                targetCategory: category
              }
            ]
          }
        ],
        recommendedNextActions: []
      };
  }
};

const createPassCategory = (
  category: ProductPreflightCategoryDto
) => ({
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
});

const highestSeverityForStatus = (status: ProductPreflightStatusDto) => {
  switch (status) {
    case "pass":
      return "info";
    case "warn":
    case "not_evaluated":
      return "warning";
    case "fail":
    case "not_supported":
      return "blocking";
  }
};
