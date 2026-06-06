import { describe, expect, it } from "vitest";

import type { OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import { OperationResultSchema } from "@private-2d-rigging-lab/operation-core";

import type { EditorSemanticState } from "../editor-state/index.js";
import { projectEditorAiPsdImportPlanCommandResult } from "./editor-ai-psd-import-plan-projector.js";

describe("editor AI PSD import-plan projector", () => {
  it("exposes structural scaffold group and leaf refs from editor state", () => {
    const result = projectEditorAiPsdImportPlanCommandResult({
      state: createStateWithStructuralScaffold("committed"),
      detail: "full"
    });

    expect(result).toMatchObject({
      structuralScaffold: {
        structuralPlanId: "plan_ai_psd_structural",
        approvalSelectionDigest: `sha256:${"4".repeat(64)}`,
        approvedNodeRefs: ["psd:root/group[2]", "psd:root/group[2]/layer[0]"],
        groupPartRefs: [
          expect.objectContaining({
            sourceGroupId: "psd:root/group[2]",
            generatedParentPartId: "part_root",
            generatedPartId: "part_psd_group_2"
          })
        ],
        leafDrawableRefs: [
          expect.objectContaining({
            sourceLayerId: "psd:root/group[2]/layer[0]",
            generatedParentPartId: "part_psd_group_2",
            generatedDrawableId: "draw_front_hair",
            generatedTextureId: "tex_front_hair",
            generatedMeshId: "mesh_front_hair",
            initialRuntimeVisibility: true
          })
        ]
      },
      latestStructuralScaffold: {
        status: "committed",
        approvedNodeRefs: ["psd:root/group[2]", "psd:root/group[2]/layer[0]"],
        generatedGroupPartRefs: [
          expect.objectContaining({ generatedPartId: "part_psd_group_2" })
        ],
        generatedLeafDrawableRefs: [
          expect.objectContaining({ initialRuntimeVisibility: true })
        ]
      }
    });
  });

  it("prefers structural operation evidence when an operation result is supplied", () => {
    const operationResult = createStructuralOperationResult();
    const result = projectEditorAiPsdImportPlanCommandResult({
      state: createStateWithStructuralScaffold("idle"),
      detail: "summary",
      operationResult
    });

    expect(result.latestStructuralScaffold).toMatchObject({
      status: "preflightReady",
      operationStatus: "dry_run",
      operationId: "op_ai_psd_structural",
      batchId: "batch_ai_psd_structural",
      evidenceId: "evidence_batch_ai_psd_structural",
      generatedGroupPartRefs: [
        expect.objectContaining({
          sourceGroupId: "psd:root/group[2]",
          generatedPartId: "part_psd_group_2"
        })
      ],
      generatedLeafDrawableRefs: [
        expect.objectContaining({
          sourceLayerId: "psd:root/group[2]/layer[0]",
          generatedDrawableId: "draw_front_hair",
          initialRuntimeVisibility: true
        })
      ],
      evidenceRefs: expect.arrayContaining([
        "operations/op_ai_psd_structural#evidence_batch_ai_psd_structural",
        "operations/op_ai_psd_structural#part_psd_group_2",
        "operations/op_ai_psd_structural#draw_front_hair"
      ])
    });
  });
});

const createStateWithStructuralScaffold = (
  intakeStatus: "idle" | "committed" | "rejected" | "failed"
) => ({
  explicitPsdImport: {
    importPlan: null,
    structuralScaffoldPlan: {
      status: "ready",
      structuralPlanId: "plan_ai_psd_structural",
      structuralPlanDigest: `sha256:${"3".repeat(64)}`,
      approvalId: "approval_ai_psd_structural",
      approvalSelectionDigest: `sha256:${"4".repeat(64)}`,
      approvalStatus: "approved",
      sourceFilePath: "assets/sources/private/sample_model.psd",
      sourceByteLength: 128,
      sourceDigest: `sha256:${"2".repeat(64)}`,
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
      nodes: [
        {
          nodeRef: "psd:root/group[2]",
          kind: "group",
          label: "hair_front",
          fullPathLabel: "hair_front",
          sourceOrder: 2,
          visibleInSource: true,
          opacityInSource: 1,
          boundsLabel: "x=0 y=0 w=4 h=4",
          approvalEligible: true,
          approved: true,
          generatedParentPartId: "part_root",
          generatedPartId: "part_psd_group_2",
          generatedDrawableId: null,
          generatedTextureId: null,
          generatedMeshId: null,
          initialRuntimeVisibility: null,
          status: "approved",
          statusReasons: []
        },
        {
          nodeRef: "psd:root/group[2]/layer[0]",
          kind: "leaf",
          label: "front hair",
          fullPathLabel: "hair_front / front hair",
          sourceOrder: 3,
          visibleInSource: true,
          opacityInSource: 1,
          boundsLabel: "x=0 y=0 w=4 h=4",
          approvalEligible: true,
          approved: true,
          generatedParentPartId: "part_psd_group_2",
          generatedPartId: null,
          generatedDrawableId: "draw_front_hair",
          generatedTextureId: "tex_front_hair",
          generatedMeshId: "mesh_front_hair",
          initialRuntimeVisibility: true,
          status: "approved",
          statusReasons: []
        }
      ],
      diagnostics: []
    },
    selectedLayerNodeRefs: ["psd:root/group[2]/layer[0]"],
    selectedLayerBatchIntake: {
      status: "idle",
      diagnostics: []
    },
    structuralScaffoldIntake: {
      status: intakeStatus,
      summaryFacts: [],
      entryLabels: [],
      diagnostics: intakeStatus === "committed"
        ? [{
            checkId: "editor.psdStructuralScaffold.committed",
            severity: "info",
            message: "PSD structural scaffold was committed."
          }]
        : []
    },
    diagnostics: []
  }
}) as unknown as EditorSemanticState;

const createStructuralOperationResult = (): OperationResultDto =>
  OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: "op_ai_psd_structural",
    status: "dry_run",
    precondition: {
      ok: true,
      diagnostics: []
    },
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    psdStructuralScaffoldEvidence: [createStructuralOperationEvidence()],
    reversible: true
  });

const createStructuralOperationEvidence = () => ({
  schemaVersion: "psd-structural-scaffold-operation-evidence-v1",
  operationType: "importPsdStructuralScaffold",
  evidenceId: "evidence_batch_ai_psd_structural",
  operationId: "op_ai_psd_structural",
  batchId: "batch_ai_psd_structural",
  sourceAssetId: "src_ai_psd_profile",
  destination: {
    destinationKind: "structuralScaffold",
    parentPartId: "part_root"
  },
  aggregateStatus: "success",
  generatedGroupPartScaffolds: [{
    scaffoldKind: "groupPartContainer",
    sourceGroupRef: {
      sourceAssetId: "src_ai_psd_profile",
      sourceGroupId: "psd:root/group[2]",
      sourceGroupName: "hair_front",
      sourceGroupPath: ["hair_front"]
    },
    sourceGroupName: "hair_front",
    sourceGroupPath: ["hair_front"],
    sourceOrder: 2,
    visibleInSource: true,
    opacityInSource: 1,
    generatedParentPartId: "part_root",
    generatedPartId: "part_psd_group_2",
    generatedPartDisplayName: "hair_front",
    status: "resolved",
    statusReasons: []
  }],
  generatedLeafScaffolds: [{
    scaffoldKind: "leafDrawableScaffold",
    sourceLayerRef: {
      sourceAssetId: "src_ai_psd_profile",
      sourceLayerId: "psd:root/group[2]/layer[0]",
      sourceLayerName: "front hair",
      sourceLayerPath: ["hair_front", "front hair"]
    },
    sourceLayerName: "front hair",
    sourceLayerPath: ["hair_front", "front hair"],
    sourceOrder: 3,
    visibleInSource: true,
    opacityInSource: 1,
    bounds: { x: 0, y: 0, width: 4, height: 4 },
    byteEstimate: 16,
    generatedParentPartId: "part_psd_group_2",
    generatedDrawableId: "draw_front_hair",
    generatedDrawableDisplayName: "front hair",
    generatedTextureId: "tex_front_hair",
    generatedMeshId: "mesh_front_hair",
    initialRuntimeVisibility: true,
    status: "resolved",
    statusReasons: []
  }],
  issues: [],
  preflightPolicy: {
    approvedLeafLimit: 6,
    approvedGroupLimit: 32,
    generatedNodeLimit: 64,
    totalRawRgbaByteLimit: 33554432,
    mutationPolicy: "preflightBlocksOnAnyFailure",
    silentPartialSuccess: "forbidden"
  },
  persistenceBoundary: {
    rawParserObjectPersistence: "notPersisted",
    sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
    materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
    photoshopCompositingClaim: "none",
    rendererPixelOracleClaim: "none",
    initialGridMeshGeneration: "notProvided",
    semanticRecognition: "notProvided",
    repoProposalGeneration: "notProvided"
  }
} as const);
