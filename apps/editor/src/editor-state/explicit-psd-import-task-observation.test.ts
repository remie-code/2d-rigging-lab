import { describe, expect, it } from "vitest";

import {
  createEmptyExplicitPsdImportState,
  projectExplicitPsdImportTaskObservation,
  type ExplicitPsdImportPlanState,
  type ExplicitPsdImportState,
  type ExplicitPsdStructuralScaffoldPlanState
} from "./index.js";

describe("explicit PSD import task observation", () => {
  it("projects empty state to idle statuses and disabled readiness flags", () => {
    const observation = projectExplicitPsdImportTaskObservation(
      createEmptyExplicitPsdImportState()
    );

    expect(observation).toMatchObject({
      schemaVersion: "explicit-psd-import-task-observation-v1",
      sourceLoaded: false,
      parseStatus: "idle",
      selectedScope: {
        selectedLayerNodeRefs: ["psd:root/layer[0]"],
        importPlanScopeRef: null,
        structuralScaffoldScopeRef: null
      },
      importPlan: {
        previewStatus: "none",
        approvalStatus: "none",
        candidateCount: 0,
        eligibleCandidateCount: 0,
        approvedCount: 0,
        readyToSubmitApprovedBatch: false,
        warningCount: 0
      },
      structuralScaffold: {
        previewStatus: "none",
        approvalStatus: "none",
        approvedGroupCount: 0,
        approvedLeafCount: 0,
        runtimeHiddenDrawableCount: 0,
        readyToCommitStructuralScaffold: false,
        warningCount: 0
      },
      evidenceBoundary: {
        detailSurface: "diagnosticsEvidenceView",
        detailStatus: "empty",
        rawDetailRefsIncluded: false
      }
    });
    expect(observation.humanSummary.text).toBe(
      "No PSD source loaded. No import-plan preview. No structural scaffold preview. Warnings: 0. Details: diagnosticsEvidenceView."
    );
  });

  it("projects parsed import-plan and structural scaffold status flags and warning counts", () => {
    const observation = projectExplicitPsdImportTaskObservation(
      createParsedStateWithPlanAndScaffold()
    );

    expect(observation.sourceLoaded).toBe(true);
    expect(observation.parseStatus).toBe("parsed");
    expect(observation.selectedScope).toEqual({
      selectedLayerNodeRefs: ["psd:root/group[0]/layer[0]", "psd:root/group[0]/layer[1]"],
      importPlanScopeRef: "psd:root/group[0]",
      structuralScaffoldScopeRef: "psd:root"
    });
    expect(observation.importPlan).toMatchObject({
      previewStatus: "ready",
      approvalStatus: "approved",
      candidateCount: 3,
      eligibleCandidateCount: 2,
      approvedCount: 2,
      readyToSubmitApprovedBatch: true,
      warningCount: 1
    });
    expect(observation.structuralScaffold).toMatchObject({
      previewStatus: "ready",
      approvalStatus: "approved",
      approvedGroupCount: 1,
      approvedLeafCount: 2,
      runtimeHiddenDrawableCount: 1,
      readyToCommitStructuralScaffold: true,
      warningCount: 1
    });
    expect(observation.humanSummary.warningCount).toBe(4);
    expect(observation.evidenceBoundary).toMatchObject({
      detailSurface: "diagnosticsEvidenceView",
      detailStatus: "available",
      parserDiagnosticCount: 1,
      importPlanDiagnosticCount: 2,
      structuralScaffoldDiagnosticCount: 2,
      materializationSummaryCount: 1,
      importPlanCandidateDetailCount: 2,
      structuralScaffoldNodeDetailCount: 2,
      selectedLayerBatchResultEntryCount: 1,
      structuralScaffoldResultEntryCount: 1,
      rawDetailRefsIncluded: false
    });
  });

  it("projects blocked structural approval status without enabling commit readiness", () => {
    const baseState = createParsedStateWithPlanAndScaffold();
    const observation = projectExplicitPsdImportTaskObservation({
      ...baseState,
      structuralScaffoldPlan: {
        ...baseState.structuralScaffoldPlan!,
        status: "blocked",
        approvalStatus: "preflightBlocked"
      }
    });

    expect(observation.structuralScaffold).toMatchObject({
      previewStatus: "blocked",
      approvalStatus: "preflightBlocked",
      readyToCommitStructuralScaffold: false
    });
  });

  it("keeps machine-only refs out of the concise human and evidence summaries", () => {
    const observation = projectExplicitPsdImportTaskObservation(
      createParsedStateWithPlanAndScaffold()
    );
    const summaries = [
      observation.humanSummary.text,
      observation.evidenceBoundary.summary
    ].join("\n");

    expect(summaries).not.toContain("sha256:");
    expect(summaries).not.toContain("approval_structural_123");
    expect(summaries).not.toContain("draw_headwear_generated_ref");
    expect(summaries).not.toContain("operations/op_psd_import_123");
    expect(summaries).not.toContain("evidence/psd-import/detail.json");
    expect(summaries).not.toContain("commandPayload");
    expect(summaries).not.toContain("parserPrivatePayload");
    expect(summaries).toContain("diagnosticsEvidenceView");
  });

  it("exposes the projector through the editor-state barrel while keeping implementation file-scoped", () => {
    expect(projectExplicitPsdImportTaskObservation).toBeTypeOf("function");
    expect(
      projectExplicitPsdImportTaskObservation(createEmptyExplicitPsdImportState()).schemaVersion
    ).toBe("explicit-psd-import-task-observation-v1");
  });
});

const createParsedStateWithPlanAndScaffold = (): ExplicitPsdImportState => ({
  ...createEmptyExplicitPsdImportState(),
  status: "parsed",
  selectedLayerNodeRef: "psd:root/group[0]/layer[0]",
  selectedLayerNodeRefs: ["psd:root/group[0]/layer[0]", "psd:root/group[0]/layer[1]"],
  source: {
    fileName: "private_model.psd",
    declaredMediaType: "image/vnd.adobe.photoshop",
    byteLength: 2048,
    sizeCapBytes: 33_554_432,
    intakeKind: "explicitFile",
    rawBytesPersistence: "notPersistedByParserBridge",
    publicDistribution: "notPublicDistributable"
  },
  treeSummary: {
    groupCount: 1,
    layerCount: 2,
    visibleLayerCount: 1,
    hiddenLayerCount: 1,
    rasterCandidateLayerCount: 2,
    maxDepth: 2
  },
  materialization: [{
    materializationId: "mat_private_headwear",
    sourceLayerId: "psd:root/group[0]/layer[0]",
    sourceLayerPath: ["Head", "Headwear"],
    mediaType: "application/vnd.ai-native-live2d.raw-rgba",
    byteLength: 128,
    digest: {
      algorithm: "sha256",
      hex: "digest_materialized_layer_123"
    },
    bytePersistence: "summaryOnlyNoRawBytes"
  }],
  diagnostics: [{
    checkId: "parser.warning",
    severity: "warning",
    message: "Parser warning with parserPrivatePayload excluded from task summary."
  }],
  importPlan: createImportPlanState(),
  structuralScaffoldPlan: createStructuralScaffoldPlanState(),
  selectedLayerBatchIntake: {
    status: "committed",
    summaryFacts: [
      { label: "Operation", value: "operations/op_psd_import_123" },
      { label: "Evidence path", value: "evidence/psd-import/detail.json" }
    ],
    entryLabels: ["draw_headwear_generated_ref / evidence/psd-import/detail.json"],
    diagnostics: []
  },
  structuralScaffoldIntake: {
    status: "committed",
    summaryFacts: [
      { label: "Operation", value: "operations/op_structural_123" },
      { label: "Evidence path", value: "evidence/psd-structural/detail.json" }
    ],
    entryLabels: ["part_head_generated_ref / draw_headwear_generated_ref"],
    diagnostics: [{
      checkId: "structural.result.warning",
      severity: "warning",
      message: "Structural result warning."
    }]
  }
});

const createImportPlanState = (): ExplicitPsdImportPlanState => ({
  status: "ready",
  planId: "plan_with_commandPayload",
  candidatePlanDigest: "sha256:plan_digest_123",
  sourceFileName: "private_model.psd",
  sourceByteLength: 2048,
  sourceDigest: "sha256:source_digest_123",
  sourceProvenanceLabel: "private/local",
  parserLabel: "webtoonPsd",
  scopeRef: "psd:root/group[0]",
  scopeLabel: "Head",
  destinationParentPartId: "part_root",
  candidateCount: 3,
  eligibleCandidateCount: 2,
  approvedCount: 2,
  notApprovedCount: 1,
  hiddenCount: 1,
  unsupportedCount: 0,
  collisionCount: 0,
  byteCapBlockedCount: 0,
  totalRawRgbaByteEstimate: 512,
  approvedRawRgbaByteEstimate: 384,
  candidates: [
    {
      layerRef: "psd:root/group[0]/layer[0]",
      displayName: "Headwear",
      fullPathLabel: "Head / Headwear",
      parentGroupPathLabel: "Head",
      boundsLabel: "0,0 8x8",
      visibleInSource: true,
      opacityInSource: 1,
      sourceOrder: 1,
      rawRgbaByteEstimate: 256,
      statuses: ["candidate"],
      statusReasons: [],
      defaultSelection: "notApproved",
      requestedApproval: true,
      approved: true,
      approvedOrder: 0,
      approvalBlockedReasons: [],
      generatedPartId: "part_headwear_generated_ref",
      generatedDrawableId: "draw_headwear_generated_ref",
      generatedTextureId: "tex_headwear_generated_ref",
      generatedMeshId: "mesh_headwear_generated_ref"
    },
    {
      layerRef: "psd:root/group[0]/layer[1]",
      displayName: "Shadow",
      fullPathLabel: "Head / Shadow",
      parentGroupPathLabel: "Head",
      boundsLabel: "0,0 8x8",
      visibleInSource: false,
      opacityInSource: 0.5,
      sourceOrder: 2,
      rawRgbaByteEstimate: 128,
      statuses: ["candidate", "hidden"],
      statusReasons: ["Hidden source layer remains explicit."],
      defaultSelection: "notApproved",
      requestedApproval: true,
      approved: true,
      approvedOrder: 1,
      approvalBlockedReasons: [],
      generatedPartId: "part_shadow_generated_ref",
      generatedDrawableId: "draw_shadow_generated_ref",
      generatedTextureId: "tex_shadow_generated_ref",
      generatedMeshId: "mesh_shadow_generated_ref"
    }
  ],
  diagnostics: [
    {
      checkId: "importPlan.warning",
      severity: "warning",
      message: "Import-plan warning."
    },
    {
      checkId: "importPlan.info",
      severity: "info",
      message: "Import-plan info."
    }
  ]
});

const createStructuralScaffoldPlanState = (): ExplicitPsdStructuralScaffoldPlanState => ({
  status: "ready",
  structuralPlanId: "structural_plan_123",
  structuralPlanDigest: "sha256:structural_plan_digest_123",
  approvalId: "approval_structural_123",
  approvalSelectionDigest: "sha256:approval_selection_digest_123",
  approvalStatus: "approved",
  sourceFilePath: "evidence/psd-import/private_model.psd",
  sourceByteLength: 2048,
  sourceDigest: "sha256:source_digest_123",
  scopeLabel: "Document",
  scopeRef: "psd:root",
  destinationParentPartId: "part_root",
  sourceGroupCount: 1,
  sourceLayerCount: 2,
  approvedGroupCount: 1,
  approvedLeafCount: 2,
  hiddenLeafCount: 1,
  runtimeHiddenDrawableCount: 1,
  generatedGroupPartCount: 1,
  generatedDrawableCount: 2,
  totalByteEstimate: 384,
  approvedNodeRefs: ["psd:root/group[0]/layer[0]", "psd:root/group[0]/layer[1]"],
  nodes: [
    {
      nodeRef: "psd:root/group[0]",
      kind: "group",
      label: "Head",
      fullPathLabel: "Head",
      sourceOrder: 0,
      visibleInSource: true,
      opacityInSource: 1,
      boundsLabel: "0,0 8x8",
      approvalEligible: true,
      approved: true,
      generatedParentPartId: "part_root",
      generatedPartId: "part_head_generated_ref",
      generatedDrawableId: null,
      generatedTextureId: null,
      generatedMeshId: null,
      initialRuntimeVisibility: null,
      status: "approved",
      statusReasons: []
    },
    {
      nodeRef: "psd:root/group[0]/layer[0]",
      kind: "leaf",
      label: "Headwear",
      fullPathLabel: "Head / Headwear",
      sourceOrder: 1,
      visibleInSource: true,
      opacityInSource: 1,
      boundsLabel: "0,0 8x8",
      approvalEligible: true,
      approved: true,
      generatedParentPartId: "part_head_generated_ref",
      generatedPartId: null,
      generatedDrawableId: "draw_headwear_generated_ref",
      generatedTextureId: "tex_headwear_generated_ref",
      generatedMeshId: "mesh_headwear_generated_ref",
      initialRuntimeVisibility: true,
      status: "approved",
      statusReasons: []
    }
  ],
  diagnostics: [
    {
      checkId: "structural.warning",
      severity: "warning",
      message: "Structural scaffold warning."
    },
    {
      checkId: "structural.info",
      severity: "info",
      message: "Structural scaffold info."
    }
  ]
});
