import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS,
  ProductPreflightReportDtoSchema
} from "@private-2d-rigging-lab/contracts";

import {
  AiCapabilitySchema,
  AiCommandNameSchema,
  AiCommandRequestSchema,
  AiCommandResponseSchema
} from "./index.js";
import { observeProductPreflightReport } from "./ai-product-preflight-observation.js";

const createParameterOperationRequest = {
  schemaVersion: "operation-request-v1",
  operationId: "op_create_ai_parameter",
  actor: "ai",
  surface: "structuredApi",
  dryRun: true,
  basePackageRevision: 0,
  trace: {
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  operationType: "createParameter",
  payload: {
    parameterId: "param_ai_parameter",
    displayName: "AI Parameter",
    semanticRole: "custom",
    min: 0,
    max: 1,
    default: 0.5,
    recommendedUiStep: 0.01
  }
} as const;

const dryRunOperationResult = {
  schemaVersion: "operation-result-v1",
  operationId: "op_create_ai_parameter",
  status: "dry_run",
  precondition: {
    ok: true,
    diagnostics: []
  },
  modelDiff: {
    schemaVersion: "model-diff-v1",
    baseRevision: 0,
    candidateRevision: 1,
    added: [
      {
        kind: "parameter",
        id: "param_ai_parameter"
      }
    ],
    removed: [],
    changed: [],
    operationIds: ["op_create_ai_parameter"]
  },
  reversible: true
} as const;

const committedOperationResult = {
  ...dryRunOperationResult,
  status: "committed"
} as const;

const operationLogEntry = {
  schemaVersion: "operation-log-entry-v1",
  operationId: "op_create_ai_parameter",
  transactionId: "txn_create_ai_parameter",
  timestamp: "2026-05-29T00:00:00.000Z",
  actor: "ai",
  surface: "structuredApi",
  operationType: "createParameter",
  targetIds: ["param_ai_parameter"],
  precondition: {
    ok: true,
    diagnostics: [],
    checkedTargetRefs: [
      {
        kind: "parameter",
        id: "param_ai_parameter"
      }
    ]
  },
  payload: {
    operationType: "createParameter",
    payload: createParameterOperationRequest.payload
  },
  result: committedOperationResult,
  provenanceId: "prov_ai_command",
  reversible: true
} as const;

const validationReport = {
  schemaVersion: "validation-report-v1",
  reportId: "val_ai_read_contract",
  createdAt: "2026-05-29T00:00:00.000Z",
  packageId: "pkg_ai_read_contract",
  packageRevision: 0,
  validatorVersion: "validator-test",
  profile: "strict",
  relatedScenarios: ["SC-AGENT-001"],
  summary: {
    status: "pass",
    highestSeverity: "info",
    counts: {
      info: 0,
      warning: 0,
      error: 0,
      blocking: 0
    }
  },
  checks: [],
  repairCandidates: [],
  evidence: {
    operationLogPresent: false,
    runtimeSnapshotIds: [],
    supplementalGuiEvidenceRefs: []
  }
} as const;

const psdImportPlanExpectedContext = {
  planId: "plan_ai_psd_import_plan",
  candidatePlanDigest: `sha256:${"a".repeat(64)}`,
  sourceDigest: `sha256:${"b".repeat(64)}`,
  sourceFileName: "sample.psd",
  sourceByteLength: 128,
  scopeRef: "psd:root",
  destinationParentPartId: "part_root"
} as const;

const psdImportPlanResult = {
  schemaVersion: "ai-psd-import-plan-command-result-v0",
  importPlan: null,
  latestBatch: {
    status: "none",
    selectedLayerNodeRefs: [],
    approvedLayerNodeRefs: [],
    generatedResultRefs: [],
    operationIds: [],
    evidenceRefs: [],
    issues: [],
    diagnostics: []
  },
  diagnostics: [],
  evidenceRefs: []
} as const;

describe("AI command schema foundation", () => {
  it("parses valid minimal command requests", () => {
    const editorStateRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_get_editor_state",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: ["AC-MVP-014"],
        relatedScenarios: ["SC-AGENT-002"]
      },
      command: "getEditorState",
      payload: {}
    });
    const inspectModelRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_inspect_model",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        relatedAC: ["AC-AGENT-001"],
        relatedScenarios: ["SC-AGENT-001"]
      },
      command: "inspectModel",
      payload: {}
    });
    const inspectTargetRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_inspect_target",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        relatedAC: ["AC-AGENT-001"],
        relatedScenarios: ["SC-AGENT-001"]
      },
      command: "inspectTarget",
      payload: {
        target: {
          kind: "parameter",
          id: "param_faceYaw"
        }
      }
    });
    const validatePackageRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_validate_package",
      session: {
        agentId: "agent_test",
        capabilities: ["validate"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: ["AC-AGENT-001"],
        relatedScenarios: ["SC-AGENT-001"]
      },
      command: "validatePackage",
      payload: {
        profile: "strict"
      }
    });
    const dryRunRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_dry_run_create_parameter",
      session: {
        agentId: "agent_test",
        capabilities: ["read", "dryRunEdit"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "dryRunOperation",
      payload: createParameterOperationRequest
    });
    const commitRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_commit_create_parameter",
      session: {
        agentId: "agent_test",
        capabilities: ["read", "dryRunEdit", "commitWithApproval"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "commitOperation",
      payload: {
        approvedDryRunCommandId: "cmd_dry_run_create_parameter",
        operation: {
          ...createParameterOperationRequest,
          dryRun: false
        }
      }
    });
    const operationLogRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_get_operation_log",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        relatedAC: [],
        relatedScenarios: []
      },
      command: "getOperationLog",
      payload: {
        operationIds: ["op_create_ai_parameter"],
        surface: "structuredApi"
      }
    });
    const getPsdImportPlanRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_get_psd_import_plan",
      session: {
        agentId: "agent_test",
        capabilities: ["read"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "getPsdImportPlanState",
      payload: {}
    });
    const setPsdImportPlanApprovalRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_set_psd_import_plan_approval",
      session: {
        agentId: "agent_test",
        capabilities: ["dryRunEdit"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "setPsdImportPlanApproval",
      payload: {
        approvedLayerNodeRefs: ["psd:root/layer[0]"],
        destinationParentPartId: "part_root",
        expectedPlan: psdImportPlanExpectedContext
      }
    });
    const preflightPsdImportPlanRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_preflight_psd_import_plan",
      session: {
        agentId: "agent_test",
        capabilities: ["dryRunEdit"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "preflightPsdImportPlanIntake",
      payload: {
        approvedLayerNodeRefs: ["psd:root/layer[0]"],
        destinationParentPartId: "part_root",
        expectedPlan: psdImportPlanExpectedContext
      }
    });
    const executePsdImportPlanRequest = AiCommandRequestSchema.parse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_execute_psd_import_plan",
      session: {
        agentId: "agent_test",
        capabilities: ["commitWithApproval"]
      },
      basis: {
        packageRevision: 0,
        relatedAC: [],
        relatedScenarios: []
      },
      command: "executePsdImportPlanIntake",
      payload: {
        approvedLayerNodeRefs: ["psd:root/layer[0]"],
        destinationParentPartId: "part_root",
        expectedPlan: psdImportPlanExpectedContext,
        approvedPreflightCommandId: "cmd_preflight_psd_import_plan",
        expectedOperationId: "op_ai_psd_import_plan_batch"
      }
    });

    expect(editorStateRequest).toMatchObject({
      command: "getEditorState",
      payload: {
        detail: "summary"
      }
    });
    expect(inspectModelRequest).toMatchObject({
      command: "inspectModel",
      payload: {
        includeEditorOnly: false,
        includeRuntimeOnly: true
      }
    });
    expect(inspectTargetRequest).toMatchObject({
      command: "inspectTarget",
      payload: {
        includeReferences: true,
        target: {
          kind: "parameter",
          id: "param_faceYaw"
        }
      }
    });
    expect(validatePackageRequest).toMatchObject({
      command: "validatePackage",
      payload: {
        profile: "strict"
      }
    });
    expect(dryRunRequest).toMatchObject({
      command: "dryRunOperation",
      payload: {
        dryRun: true
      }
    });
    expect(commitRequest).toMatchObject({
      command: "commitOperation",
      payload: {
        operation: {
          dryRun: false
        }
      }
    });
    expect(operationLogRequest).toMatchObject({
      command: "getOperationLog",
      payload: {
        operationIds: ["op_create_ai_parameter"]
      }
    });
    expect(getPsdImportPlanRequest).toMatchObject({
      command: "getPsdImportPlanState",
      payload: {
        detail: "summary"
      }
    });
    expect(setPsdImportPlanApprovalRequest).toMatchObject({
      command: "setPsdImportPlanApproval",
      payload: {
        approvedLayerNodeRefs: ["psd:root/layer[0]"],
        destinationParentPartId: "part_root"
      }
    });
    expect(preflightPsdImportPlanRequest).toMatchObject({
      command: "preflightPsdImportPlanIntake",
      payload: {
        expectedPlan: {
          candidatePlanDigest: psdImportPlanExpectedContext.candidatePlanDigest
        }
      }
    });
    expect(executePsdImportPlanRequest).toMatchObject({
      command: "executePsdImportPlanIntake",
      payload: {
        approvedPreflightCommandId: "cmd_preflight_psd_import_plan",
        expectedOperationId: "op_ai_psd_import_plan_batch"
      }
    });
  });

  it("parses valid minimal command responses", () => {
    const editorStateResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_get_editor_state",
      status: "ok",
      command: "getEditorState",
      payload: {
        editorState: {
          schemaVersion: "editor-semantic-state-v1",
          packageRevision: 0,
          activeMode: "authoring"
        }
      }
    });
    const inspectModelResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_inspect_model",
      status: "ok",
      command: "inspectModel",
      payload: {
        targets: [
          {
            kind: "parameter",
            id: "param_faceYaw"
          }
        ]
      }
    });
    const inspectTargetResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_inspect_target",
      status: "ok",
      command: "inspectTarget",
      payload: {
        target: {
          kind: "parameter",
          id: "param_faceYaw"
        }
      }
    });
    const validatePackageResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_validate_package",
      status: "ok",
      command: "validatePackage",
      payload: {
        reportId: "val_ai_read_contract",
        report: validationReport
      }
    });
    const dryRunResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_dry_run_create_parameter",
      status: "ok",
      modelDiff: dryRunOperationResult.modelDiff,
      operationResult: dryRunOperationResult,
      evidenceRefs: ["runtime/snapshots/snap_ai_preview.runtime-snapshot.json"],
      command: "dryRunOperation",
      payload: {
        operationResult: dryRunOperationResult
      }
    });
    const commitResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_commit_create_parameter",
      status: "ok",
      operationResult: committedOperationResult,
      evidenceRefs: ["operations/log.jsonl#op_create_ai_parameter"],
      command: "commitOperation",
      payload: {
        operationResult: committedOperationResult
      }
    });
    const operationLogResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_get_operation_log",
      status: "ok",
      command: "getOperationLog",
      payload: {
        entries: [operationLogEntry]
      }
    });
    const psdImportPlanStateResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_get_psd_import_plan",
      status: "ok",
      command: "getPsdImportPlanState",
      payload: {
        result: psdImportPlanResult
      }
    });
    const psdStructuralScaffoldStateResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_get_psd_import_plan_structural",
      status: "ok",
      evidenceRefs: ["operations/op_ai_psd_structural#evidence_batch_ai_psd_structural"],
      command: "getPsdImportPlanState",
      payload: {
        result: {
          ...psdImportPlanResult,
          structuralScaffold: {
            status: "ready",
            structuralPlanId: "plan_ai_psd_structural",
            structuralPlanDigest: `sha256:${"c".repeat(64)}`,
            approvalId: "approval_ai_psd_structural",
            approvalSelectionDigest: `sha256:${"d".repeat(64)}`,
            approvalStatus: "approved",
            sourceFilePath: "assets/sources/private/sample.psd",
            sourceByteLength: 128,
            sourceDigest: `sha256:${"b".repeat(64)}`,
            scopeLabel: "document",
            scopeRef: "psd:root",
            destinationParentPartId: "part_root",
            sourceGroupCount: 1,
            sourceLayerCount: 1,
            approvedGroupCount: 1,
            approvedLeafCount: 1,
            hiddenLeafCount: 0,
            runtimeHiddenDrawableCount: 0,
            generatedGroupPartCount: 1,
            generatedDrawableCount: 1,
            totalByteEstimate: 16,
            approvedNodeRefs: ["psd:root/group[2]", "psd:root/group[2]/layer[0]"],
            groupPartRefs: [{
              sourceGroupId: "psd:root/group[2]",
              sourceGroupPath: ["hair_front"],
              sourceOrder: 2,
              visibleInSource: true,
              opacityInSource: 1,
              generatedParentPartId: "part_root",
              generatedPartId: "part_psd_group_2",
              status: "approved",
              statusReasons: []
            }],
            leafDrawableRefs: [{
              sourceLayerId: "psd:root/group[2]/layer[0]",
              sourceLayerPath: ["hair_front", "front hair"],
              sourceOrder: 3,
              visibleInSource: true,
              opacityInSource: 1,
              generatedParentPartId: "part_psd_group_2",
              generatedDrawableId: "draw_front_hair",
              generatedTextureId: "tex_front_hair",
              generatedMeshId: "mesh_front_hair",
              initialRuntimeVisibility: true,
              status: "approved",
              statusReasons: []
            }],
            diagnostics: []
          },
          latestStructuralScaffold: {
            status: "preflightReady",
            operationStatus: "dry_run",
            operationId: "op_ai_psd_structural",
            batchId: "batch_ai_psd_structural",
            evidenceId: "evidence_batch_ai_psd_structural",
            aggregateStatus: "success",
            sourceAssetId: "src_ai_psd_profile",
            destinationParentPartId: "part_root",
            approvedNodeRefs: ["psd:root/group[2]", "psd:root/group[2]/layer[0]"],
            generatedGroupPartRefs: [],
            generatedLeafDrawableRefs: [],
            operationIds: ["op_ai_psd_structural"],
            evidenceRefs: ["operations/op_ai_psd_structural#evidence_batch_ai_psd_structural"],
            issues: [],
            diagnostics: []
          }
        }
      }
    });
    const psdImportPlanPreflightResponse = AiCommandResponseSchema.parse({
      schemaVersion: "ai-command-response-v1",
      commandId: "cmd_preflight_psd_import_plan",
      status: "ok",
      operationResult: dryRunOperationResult,
      command: "preflightPsdImportPlanIntake",
      payload: {
        result: psdImportPlanResult,
        operationResult: dryRunOperationResult
      }
    });

    expect(editorStateResponse).toMatchObject({
      payload: {
        editorState: {
          packageRevision: 0
        }
      }
    });
    expect(editorStateResponse.diagnostics).toEqual([]);
    expect(inspectModelResponse).toMatchObject({
      payload: {
        targets: [
          {
            id: "param_faceYaw"
          }
        ],
        editableTargets: []
      }
    });
    expect(inspectTargetResponse).toMatchObject({
      payload: {
        target: {
          id: "param_faceYaw"
        },
        references: []
      }
    });
    expect(validatePackageResponse).toMatchObject({
      payload: {
        reportId: "val_ai_read_contract",
        report: {
          schemaVersion: "validation-report-v1"
        }
      }
    });
    expect(dryRunResponse).toMatchObject({
      payload: {
        operationResult: {
          status: "dry_run"
        }
      }
    });
    expect(dryRunResponse.evidenceRefs).toEqual(["runtime/snapshots/snap_ai_preview.runtime-snapshot.json"]);
    expect(commitResponse).toMatchObject({
      payload: {
        operationResult: {
          status: "committed"
        }
      }
    });
    expect(operationLogResponse).toMatchObject({
      payload: {
        entries: [
          {
            operationType: "createParameter"
          }
        ]
      }
    });
    expect(psdImportPlanStateResponse).toMatchObject({
      payload: {
        result: {
          schemaVersion: "ai-psd-import-plan-command-result-v0",
          importPlan: null
        }
      }
    });
    expect(psdStructuralScaffoldStateResponse).toMatchObject({
      payload: {
        result: {
          structuralScaffold: {
            structuralPlanId: "plan_ai_psd_structural",
            leafDrawableRefs: [
              expect.objectContaining({
                sourceLayerId: "psd:root/group[2]/layer[0]",
                initialRuntimeVisibility: true
              })
            ]
          },
          latestStructuralScaffold: {
            status: "preflightReady",
            operationId: "op_ai_psd_structural"
          }
        }
      }
    });
    expect(psdImportPlanPreflightResponse).toMatchObject({
      payload: {
        operationResult: {
          status: "dry_run"
        }
      }
    });
  });

  it("rejects dryRunOperation requests when the operation is not dry-run", () => {
    const result = AiCommandRequestSchema.safeParse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_invalid_dry_run",
      session: {
        agentId: "agent_test",
        capabilities: ["dryRunEdit"]
      },
      basis: {
        relatedAC: [],
        relatedScenarios: []
      },
      command: "dryRunOperation",
      payload: {
        ...createParameterOperationRequest,
        dryRun: false
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects commitOperation requests when the nested operation is dry-run", () => {
    const result = AiCommandRequestSchema.safeParse({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_invalid_commit",
      session: {
        agentId: "agent_test",
        capabilities: ["commitWithApproval"]
      },
      basis: {
        relatedAC: [],
        relatedScenarios: []
      },
      command: "commitOperation",
      payload: {
        approvedDryRunCommandId: "cmd_dry_run_create_parameter",
        operation: createParameterOperationRequest
      }
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid capabilities and command names", () => {
    expect(AiCapabilitySchema.safeParse("mutateDirectly").success).toBe(false);
    expect(AiCommandNameSchema.parse("inspectModel")).toBe("inspectModel");
    expect(AiCommandNameSchema.parse("inspectTarget")).toBe("inspectTarget");
    expect(AiCommandNameSchema.parse("validatePackage")).toBe("validatePackage");
    expect(AiCommandNameSchema.parse("getPsdImportPlanState")).toBe("getPsdImportPlanState");
    expect(AiCommandNameSchema.parse("setPsdImportPlanApproval")).toBe("setPsdImportPlanApproval");
    expect(AiCommandNameSchema.parse("preflightPsdImportPlanIntake")).toBe("preflightPsdImportPlanIntake");
    expect(AiCommandNameSchema.parse("executePsdImportPlanIntake")).toBe("executePsdImportPlanIntake");
    expect(AiCommandNameSchema.safeParse("getRuntimeSnapshot").success).toBe(false);
    expect(
      AiCommandRequestSchema.safeParse({
        schemaVersion: "ai-command-request-v1",
        commandId: "cmd_invalid_command",
        session: {
          agentId: "agent_test",
          capabilities: ["read"]
        },
        basis: {
          relatedAC: [],
          relatedScenarios: []
        },
        command: "getRuntimeSnapshot",
        payload: {}
      }).success
    ).toBe(false);
  });

  it("does not expose product preflight observation as an executable command", () => {
    const report = createProductPreflightReport();

    expect(AiCommandNameSchema.safeParse("observeProductPreflightReport").success).toBe(false);
    expect(
      AiCommandRequestSchema.safeParse({
        schemaVersion: "ai-command-request-v1",
        commandId: "cmd_observe_product_preflight",
        session: {
          agentId: "agent_test",
          capabilities: ["read"]
        },
        basis: {
          packageRevision: 7,
          relatedAC: [],
          relatedScenarios: []
        },
        command: "observeProductPreflightReport",
        payload: {
          report
        }
      }).success
    ).toBe(false);
    expect(
      AiCommandResponseSchema.safeParse({
        schemaVersion: "ai-command-response-v1",
        commandId: "cmd_observe_product_preflight",
        status: "ok",
        evidenceRefs: ["evidence_manifest", "evidence_runtimeSnapshot"],
        command: "observeProductPreflightReport",
        payload: observeProductPreflightReport({
          report
        })
      }).success
    ).toBe(false);
  });

  it("keeps the public index as a barrel-only entrypoint", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const indexText = readFileSync(join(sourceDirectory, "index.ts"), "utf8");
    const nonBarrelLines = indexText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith("export "));

    expect(nonBarrelLines).toEqual([]);
  });
});

const createProductPreflightReport = (): ReturnType<typeof ProductPreflightReportDtoSchema.parse> =>
  ProductPreflightReportDtoSchema.parse({
    schemaVersion: "product-preflight-report-v0",
    reportId: "preflight_aiObservation",
    createdAt: "2026-06-03T00:00:00.000Z",
    packageId: "pkg_aiObservation",
    packageRevision: 7,
    packageHash: "sha256-ai-observation",
    validatorVersion: "validator-test",
    sourceValidationReportIds: ["val_aiObservation"],
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
      evidenceRefCount: 2,
      diagnosticRefCount: 0
    },
    categories: PRODUCT_PREFLIGHT_REQUIRED_CATEGORY_IDS.map((category) => ({
      category,
      status: "pass",
      severity: "info",
      summary: `${category} evidence is available.`,
      evidenceRefs: category === "modelStructure"
        ? [
            {
              evidenceId: "evidence_manifest",
              artifactRef: {
                artifactKind: "packageManifest",
                path: "manifest.json"
              },
              target: {
                kind: "package",
                id: "pkg_aiObservation"
              },
              summary: "Package manifest evidence is available.",
              producer: "packageFormat"
            }
          ]
        : category === "runtimeViewerEvidence"
          ? [
              {
                evidenceId: "evidence_runtimeSnapshot",
                artifactRef: {
                  artifactKind: "runtimeSnapshot",
                  path: "runtime/snapshots/preflight.runtime-snapshot.json",
                  snapshotId: "snap_preflight"
                },
                target: {
                  kind: "runtimeSnapshot",
                  id: "snap_preflight"
                },
                summary: "Viewer runtime snapshot evidence is available.",
                producer: "viewer"
              }
            ]
          : []
    }))
  });
