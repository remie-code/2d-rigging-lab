import { describe, expect, it } from "vitest";

import {
  DrawableIdSchema,
  MeshIdSchema,
  OperationIdSchema,
  PartIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import {
  OperationResultSchema,
  createPsdLayerMaterializationBatchOperationEvidence
} from "@private-2d-rigging-lab/operation-core";

import { InMemoryAiApprovalPolicy } from "./ai-approval-policy.js";
import { InMemoryAiCommandTranscript } from "./ai-command-transcript.js";
import {
  executeAiPsdImportPlanCommand,
  type AiPsdImportPlanCommandHost,
  type AiPsdImportPlanCommandResult,
  type ExecutePsdImportPlanIntakePayload,
  type GetPsdImportPlanStatePayload,
  type PreflightPsdImportPlanIntakePayload,
  type SetPsdImportPlanApprovalPayload
} from "./index.js";

const agentId = "agent_psd_import_plan";
const operationId = OperationIdSchema.parse("op_ai_psd_import_plan_batch");
const childOperationId = OperationIdSchema.parse("op_ai_psd_import_plan_batch_0_front_hair");
const approvedLayerNodeRef = "psd:root/group[2]/layer[0]";
const swappedApprovedLayerNodeRef = "psd:root/group[3]/layer[0]";
const sourceAssetId = SourceAssetIdSchema.parse("src_explicit_psd_sample_model_128");
const batchId = "batch_ai_psd_import_plan";
const batchEvidenceId = `evidence_${batchId}`;
const materializationId = "mat_front_hair";
const destinationParentPartId = PartIdSchema.parse("part_root");
const partId = PartIdSchema.parse("part_front_hair");
const drawableId = DrawableIdSchema.parse("draw_front_hair");
const textureId = TextureIdSchema.parse("tex_front_hair");
const meshId = MeshIdSchema.parse("mesh_front_hair");
const candidatePlanDigest = `sha256:${"1".repeat(64)}`;
const sourceDigest = `sha256:${"2".repeat(64)}`;

class FakePsdImportPlanCommandHost implements AiPsdImportPlanCommandHost {
  readonly getStateCalls: GetPsdImportPlanStatePayload[] = [];
  readonly setApprovalCalls: SetPsdImportPlanApprovalPayload[] = [];
  readonly preflightCalls: PreflightPsdImportPlanIntakePayload[] = [];
  readonly executeCalls: ExecutePsdImportPlanIntakePayload[] = [];

  getPsdImportPlanState(payload: GetPsdImportPlanStatePayload): AiPsdImportPlanCommandResult {
    this.getStateCalls.push(payload);

    return createPsdImportPlanResult({ latestBatchStatus: "none" });
  }

  setPsdImportPlanApproval(payload: SetPsdImportPlanApprovalPayload): AiPsdImportPlanCommandResult {
    this.setApprovalCalls.push(payload);

    return createPsdImportPlanResult({ latestBatchStatus: "none" });
  }

  preflightPsdImportPlanIntake(payload: PreflightPsdImportPlanIntakePayload) {
    this.preflightCalls.push(payload);
    const operationResult = createBatchOperationResult("dry_run");

    return {
      result: createPsdImportPlanResult({
        latestBatchStatus: "preflightReady",
        operationResult
      }),
      operationResult
    };
  }

  executePsdImportPlanIntake(payload: ExecutePsdImportPlanIntakePayload) {
    this.executeCalls.push(payload);
    const operationResult = createBatchOperationResult("committed");

    return {
      result: createPsdImportPlanResult({
        latestBatchStatus: "committed",
        operationResult
      }),
      operationResult
    };
  }
}

describe("AI PSD import-plan command executor", () => {
  it("reads current import-plan state through the PSD command host", async () => {
    const host = new FakePsdImportPlanCommandHost();
    const response = await executeAiPsdImportPlanCommand(
      createAiRequest({
        commandId: "cmd_get_psd_import_plan",
        command: "getPsdImportPlanState",
        capabilities: ["read"],
        payload: { detail: "candidates" }
      }),
      {
        host,
        approvalPolicy: new InMemoryAiApprovalPolicy()
      }
    );

    expect(response).toMatchObject({
      status: "ok",
      command: "getPsdImportPlanState",
      payload: {
        result: {
          importPlan: {
            planId: "plan_ai_psd_import_plan",
            approvedLayerNodeRefs: [approvedLayerNodeRef],
            candidates: [
              expect.objectContaining({
                layerRef: approvedLayerNodeRef,
                generatedRefs: {
                  partId: "part_front_hair",
                  drawableId: "draw_front_hair",
                  textureId: "tex_front_hair",
                  meshId: "mesh_front_hair"
                }
              })
            ]
          }
        }
      }
    });
    expect(host.getStateCalls).toHaveLength(1);
  });

  it("requires dryRunEdit before changing approval state", async () => {
    const host = new FakePsdImportPlanCommandHost();
    const response = await executeAiPsdImportPlanCommand(
      createAiRequest({
        commandId: "cmd_set_psd_import_plan_approval_denied",
        command: "setPsdImportPlanApproval",
        capabilities: ["read"],
        payload: {
          approvedLayerNodeRefs: [approvedLayerNodeRef],
          destinationParentPartId,
          expectedPlan: createExpectedPlan()
        }
      }),
      {
        host,
        approvalPolicy: new InMemoryAiApprovalPolicy()
      }
    );

    expect(response).toMatchObject({
      status: "permission_denied",
      command: "setPsdImportPlanApproval"
    });
    expect(host.setApprovalCalls).toHaveLength(0);
  });

  it("preflights explicit approved leaf refs and records stable evidence refs", async () => {
    const host = new FakePsdImportPlanCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();
    const response = await executeAiPsdImportPlanCommand(
      createPreflightRequest(),
      {
        host,
        approvalPolicy,
        transcript
      }
    );

    expect(response).toMatchObject({
      status: "ok",
      command: "preflightPsdImportPlanIntake",
      operationResult: {
        operationId,
        status: "dry_run"
      },
      payload: {
        result: {
          latestBatch: {
            status: "preflightReady",
            operationId,
            batchEvidenceId,
            generatedResultRefs: [
              expect.objectContaining({
                sourceLayerId: approvedLayerNodeRef,
                operationId: childOperationId,
                partId: "part_front_hair",
                drawableId: "draw_front_hair",
                textureId: "tex_front_hair",
                meshId: "mesh_front_hair"
              })
            ]
          }
        }
      }
    });
    expect(response.evidenceRefs).toEqual(
      expect.arrayContaining([
        `operations/${operationId}#${batchEvidenceId}`,
        `operations/${operationId}#${materializationId}`,
        `operations/${operationId}#part_front_hair`,
        `operations/${operationId}#draw_front_hair`,
        `operations/${operationId}#tex_front_hair`,
        `operations/${operationId}#mesh_front_hair`
      ])
    );
    expect(approvalPolicy.records).toEqual([
      {
        dryRunCommandId: "cmd_preflight_psd_import_plan",
        agentId,
        operationId,
        approvalContextDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        approved: false
      }
    ]);
    expect(transcript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_preflight_psd_import_plan",
        command: "preflightPsdImportPlanIntake",
        status: "ok",
        operationId,
        evidenceRefs: expect.arrayContaining([`operations/${operationId}#${batchEvidenceId}`])
      })
    ]);
    expect(host.preflightCalls).toHaveLength(1);
  });

  it("requires approval before executing the approved intake", async () => {
    const host = new FakePsdImportPlanCommandHost();
    const response = await executeAiPsdImportPlanCommand(
      createExecuteRequest(),
      {
        host,
        approvalPolicy: new InMemoryAiApprovalPolicy()
      }
    );

    expect(response).toMatchObject({
      status: "needs_approval",
      command: "executePsdImportPlanIntake"
    });
    expect(host.executeCalls).toHaveLength(0);
  });

  it("executes only after the matching preflight command is approved", async () => {
    const host = new FakePsdImportPlanCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();
    const transcript = new InMemoryAiCommandTranscript();

    await executeAiPsdImportPlanCommand(createPreflightRequest(), {
      host,
      approvalPolicy,
      transcript
    });
    approvalPolicy.approveDryRunCommand({
      dryRunCommandId: "cmd_preflight_psd_import_plan",
      operationId
    });
    const response = await executeAiPsdImportPlanCommand(createExecuteRequest(), {
      host,
      approvalPolicy,
      transcript
    });

    expect(response).toMatchObject({
      status: "ok",
      command: "executePsdImportPlanIntake",
      operationResult: {
        operationId,
        status: "committed"
      },
      payload: {
        result: {
          latestBatch: {
            status: "committed",
            operationIds: [operationId, childOperationId]
          }
        }
      }
    });
    expect(response.evidenceRefs).toContain(`operations/log.jsonl#${operationId}`);
    expect(host.executeCalls).toEqual([
      expect.objectContaining({
        approvedPreflightCommandId: "cmd_preflight_psd_import_plan",
        expectedOperationId: operationId,
        approvedLayerNodeRefs: [approvedLayerNodeRef]
      })
    ]);
    expect(transcript.entries).toEqual([
      expect.objectContaining({
        commandId: "cmd_preflight_psd_import_plan",
        command: "preflightPsdImportPlanIntake",
        status: "ok"
      }),
      expect.objectContaining({
        commandId: "cmd_execute_psd_import_plan",
        command: "executePsdImportPlanIntake",
        status: "ok",
        operationId,
        evidenceRefs: expect.arrayContaining([`operations/log.jsonl#${operationId}`])
      })
    ]);
  });

  it("rejects execution when an approved preflight is reused for a different same-count leaf ref set", async () => {
    const host = new FakePsdImportPlanCommandHost();
    const approvalPolicy = new InMemoryAiApprovalPolicy();

    await executeAiPsdImportPlanCommand(createPreflightRequest(), {
      host,
      approvalPolicy
    });
    approvalPolicy.approveDryRunCommand({
      dryRunCommandId: "cmd_preflight_psd_import_plan",
      operationId
    });
    const response = await executeAiPsdImportPlanCommand(
      createExecuteRequest({
        approvedLayerNodeRefs: [swappedApprovedLayerNodeRef]
      }),
      {
        host,
        approvalPolicy
      }
    );

    expect(response).toMatchObject({
      status: "rejected",
      command: "executePsdImportPlanIntake",
      diagnostics: [
        expect.objectContaining({
          checkId: "ai.approvalRejected",
          message: expect.stringContaining("does not match commit context")
        })
      ]
    });
    expect(host.executeCalls).toHaveLength(0);
  });
});

const createPreflightRequest = (
  options: { readonly approvedLayerNodeRefs?: readonly string[] } = {}
) =>
  createAiRequest({
    commandId: "cmd_preflight_psd_import_plan",
    command: "preflightPsdImportPlanIntake",
    capabilities: ["dryRunEdit"],
    payload: {
      approvedLayerNodeRefs: options.approvedLayerNodeRefs ?? [approvedLayerNodeRef],
      destinationParentPartId,
      expectedPlan: createExpectedPlan()
    }
  });

const createExecuteRequest = (
  options: { readonly approvedLayerNodeRefs?: readonly string[] } = {}
) =>
  createAiRequest({
    commandId: "cmd_execute_psd_import_plan",
    command: "executePsdImportPlanIntake",
    capabilities: ["commitWithApproval"],
    payload: {
      approvedLayerNodeRefs: options.approvedLayerNodeRefs ?? [approvedLayerNodeRef],
      destinationParentPartId,
      expectedPlan: createExpectedPlan(),
      approvedPreflightCommandId: "cmd_preflight_psd_import_plan",
      expectedOperationId: operationId
    }
  });

const createAiRequest = (input: {
  readonly commandId: string;
  readonly command:
    | "getPsdImportPlanState"
    | "setPsdImportPlanApproval"
    | "preflightPsdImportPlanIntake"
    | "executePsdImportPlanIntake";
  readonly capabilities: readonly ("read" | "dryRunEdit" | "commitWithApproval")[];
  readonly payload: unknown;
}) => ({
  schemaVersion: "ai-command-request-v1",
  commandId: input.commandId,
  session: {
    agentId,
    capabilities: input.capabilities
  },
  basis: {
    packageRevision: 7,
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"]
  },
  command: input.command,
  payload: input.payload
});

const createExpectedPlan = () => ({
  planId: "plan_ai_psd_import_plan",
  candidatePlanDigest,
  sourceDigest,
  sourceFileName: "sample_model.psd",
  sourceByteLength: 128,
  scopeRef: "psd:root",
  destinationParentPartId
});

const createPsdImportPlanResult = (input: {
  readonly latestBatchStatus: "none" | "preflightReady" | "committed";
  readonly operationResult?: OperationResultDto;
}): AiPsdImportPlanCommandResult => ({
  schemaVersion: "ai-psd-import-plan-command-result-v0",
  importPlan: {
    status: "ready",
    planId: "plan_ai_psd_import_plan",
    candidatePlanDigest,
    sourceFileName: "sample_model.psd",
    sourceByteLength: 128,
    sourceDigest,
    scopeRef: "psd:root",
    destinationParentPartId,
    candidateCount: 1,
    eligibleCandidateCount: 1,
    approvedCount: 1,
    notApprovedCount: 0,
    hiddenCount: 0,
    unsupportedCount: 0,
    collisionCount: 0,
    byteCapBlockedCount: 0,
    totalRawRgbaByteEstimate: 16,
    approvedRawRgbaByteEstimate: 16,
    approvedLayerNodeRefs: [approvedLayerNodeRef],
    candidates: [{
      layerRef: approvedLayerNodeRef,
      displayName: "front hair",
      fullPathLabel: "Hair / front hair",
      sourceOrder: 0,
      visibleInSource: true,
      rawRgbaByteEstimate: 16,
      statuses: ["candidate"],
      statusReasons: [],
      requestedApproval: true,
      approved: true,
      approvedOrder: 0,
      approvalBlockedReasons: [],
      generatedRefs: {
        partId,
        drawableId,
        textureId,
        meshId
      }
    }],
    diagnostics: []
  },
  latestBatch: createLatestBatch(input),
  diagnostics: [],
  evidenceRefs: []
});

const createLatestBatch = (input: {
  readonly latestBatchStatus: "none" | "preflightReady" | "committed";
  readonly operationResult?: OperationResultDto;
}): AiPsdImportPlanCommandResult["latestBatch"] => {
  if (input.operationResult === undefined) {
    return {
      status: "none",
      selectedLayerNodeRefs: [],
      approvedLayerNodeRefs: [approvedLayerNodeRef],
      generatedResultRefs: [],
      operationIds: [],
      evidenceRefs: [],
      issues: [],
      diagnostics: []
    };
  }

  return {
    status: input.latestBatchStatus,
    stage: "operationCommit",
    operationStatus: input.operationResult.status,
    operationId,
    batchId,
    batchEvidenceId,
    aggregateStatus: "success",
    selectedLayerNodeRefs: [approvedLayerNodeRef],
    approvedLayerNodeRefs: [approvedLayerNodeRef],
    generatedResultRefs: [{
      selectedIndex: 0,
      sourceLayerId: approvedLayerNodeRef,
      sourceLayerPath: ["Hair", "front hair"],
      status: "success",
      approvalOrder: 0,
      operationId: childOperationId,
      batchEvidenceId,
      materializationEvidenceId: materializationId,
      materializationId,
      partId,
      drawableId,
      textureId,
      meshId,
      issues: []
    }],
    operationIds: [operationId, childOperationId],
    evidenceRefs: [`operations/${operationId}#${batchEvidenceId}`],
    issues: [],
    diagnostics: []
  };
};

const createBatchOperationResult = (
  status: "dry_run" | "committed"
): OperationResultDto =>
  OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId,
    status,
    precondition: {
      ok: true,
      diagnostics: []
    },
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    psdLayerMaterializationBatchEvidence: [
      createPsdLayerMaterializationBatchOperationEvidence({
        schemaVersion: "psd-layer-materialization-batch-operation-evidence-v1",
        operationType: "importPsdLayerMaterializationBatch",
        operationId,
        batchId,
        sourceAssetId,
        destination: {
          destinationKind: "generatedPartScaffold",
          parentPartId: destinationParentPartId
        },
        aggregateStatus: "success",
        selectedLayerCount: 1,
        successCount: 1,
        failureCount: 0,
        totalMaterializedByteLength: 16,
        entries: [{
          selectedIndex: 0,
          sourceLayerRef: createSourceLayerRef(),
          approvedLeafRef: createSourceLayerRef(),
          approvalOrder: 0,
          materializationId,
          materializedByteLength: 16,
          status: "success",
          generated: {
            partId,
            partDisplayName: "front hair",
            drawableId,
            drawableDisplayName: "front hair",
            textureId,
            meshId
          },
          resultRefs: {
            batchEvidenceId,
            materializationEvidenceId: materializationId,
            materializationId,
            operationId: childOperationId,
            partId,
            drawableId,
            meshId,
            textureId
          },
          operationId: childOperationId,
          diagnostics: [],
          issues: []
        }],
        perLayerOperationIds: [childOperationId],
        issues: []
      })
    ],
    reversible: true
  });

const createSourceLayerRef = () => ({
  sourceAssetId,
  sourceLayerId: approvedLayerNodeRef,
  sourceLayerName: "front hair",
  sourceLayerPath: ["Hair", "front hair"]
});
