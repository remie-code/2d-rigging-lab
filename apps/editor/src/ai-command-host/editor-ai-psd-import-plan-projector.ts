import type {
  AiPsdImportPlanCommandResult,
  AiPsdImportPlanDiagnostic,
  AiPsdImportPlanLatestBatch,
  AiPsdStructuralScaffoldLatestBatch
} from "@private-2d-rigging-lab/ai-interface";
import { PartIdSchema } from "@private-2d-rigging-lab/contracts";
import {
  AiPsdImportPlanCommandResultSchema,
  AiPsdStructuralScaffoldGroupPartRefSchema,
  AiPsdStructuralScaffoldLatestBatchSchema,
  AiPsdStructuralScaffoldLeafDrawableRefSchema,
  AiPsdStructuralScaffoldStateSchema
} from "@private-2d-rigging-lab/ai-interface";
import type {
  OperationResultDto,
  PsdLayerMaterializationBatchOperationEvidenceDto,
  PsdStructuralScaffoldGroupPartDto,
  PsdStructuralScaffoldLeafDrawableDto,
  PsdStructuralScaffoldOperationEvidenceDto
} from "@private-2d-rigging-lab/operation-core";

import type {
  EditorSemanticState,
  ExplicitPsdImportPlanCandidateState,
  ExplicitPsdStructuralScaffoldNodeState
} from "../editor-state/index.js";

export const projectEditorAiPsdImportPlanCommandResult = (input: {
  readonly state: EditorSemanticState;
  readonly detail: "summary" | "candidates" | "full";
  readonly operationResult?: OperationResultDto;
  readonly stage?: AiPsdImportPlanLatestBatch["stage"];
  readonly selectedLayerNodeRefs?: readonly string[];
}): AiPsdImportPlanCommandResult => {
  const result = {
    schemaVersion: "ai-psd-import-plan-command-result-v0" as const,
    importPlan: projectImportPlan(input.state, input.detail),
    structuralScaffold: projectStructuralScaffold(input.state, input.detail),
    latestBatch: projectLatestBatch(input),
    ...projectLatestStructuralScaffold(input),
    diagnostics: projectStateDiagnostics(input.state),
    evidenceRefs: [] as readonly string[]
  };

  return AiPsdImportPlanCommandResultSchema.parse(result);
};

const projectImportPlan = (
  state: EditorSemanticState,
  detail: "summary" | "candidates" | "full"
): AiPsdImportPlanCommandResult["importPlan"] => {
  const plan = state.explicitPsdImport.importPlan;
  if (plan === null) {
    return null;
  }

  const approvedLayerNodeRefs = plan.candidates
    .filter((candidate) => candidate.approved)
    .sort((left, right) =>
      (left.approvedOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.approvedOrder ?? Number.MAX_SAFE_INTEGER)
    )
    .map((candidate) => candidate.layerRef);

  return {
    status: plan.status,
    planId: plan.planId,
    candidatePlanDigest: plan.candidatePlanDigest,
    sourceFileName: plan.sourceFileName,
    sourceByteLength: plan.sourceByteLength,
    sourceDigest: plan.sourceDigest,
    scopeRef: plan.scopeRef,
    destinationParentPartId: plan.destinationParentPartId === null
      ? null
      : PartIdSchema.parse(plan.destinationParentPartId),
    candidateCount: plan.candidateCount,
    eligibleCandidateCount: plan.eligibleCandidateCount,
    approvedCount: plan.approvedCount,
    notApprovedCount: plan.notApprovedCount,
    hiddenCount: plan.hiddenCount,
    unsupportedCount: plan.unsupportedCount,
    collisionCount: plan.collisionCount,
    byteCapBlockedCount: plan.byteCapBlockedCount,
    totalRawRgbaByteEstimate: plan.totalRawRgbaByteEstimate,
    approvedRawRgbaByteEstimate: plan.approvedRawRgbaByteEstimate,
    approvedLayerNodeRefs,
    candidates: detail === "summary" ? [] : plan.candidates.map(projectCandidate),
    diagnostics: plan.diagnostics.map(projectDiagnostic)
  };
};

const projectCandidate = (
  candidate: ExplicitPsdImportPlanCandidateState
) => ({
  layerRef: candidate.layerRef,
  displayName: candidate.displayName,
  fullPathLabel: candidate.fullPathLabel,
  sourceOrder: candidate.sourceOrder,
  visibleInSource: candidate.visibleInSource,
  rawRgbaByteEstimate: candidate.rawRgbaByteEstimate,
  statuses: [...candidate.statuses],
  statusReasons: [...candidate.statusReasons],
  requestedApproval: candidate.requestedApproval,
  approved: candidate.approved,
  approvedOrder: candidate.approvedOrder,
  approvalBlockedReasons: [...candidate.approvalBlockedReasons],
  generatedRefs: {
    partId: candidate.generatedPartId,
    drawableId: candidate.generatedDrawableId,
    textureId: candidate.generatedTextureId,
    meshId: candidate.generatedMeshId
  }
});

const projectStructuralScaffold = (
  state: EditorSemanticState,
  detail: "summary" | "candidates" | "full"
): AiPsdImportPlanCommandResult["structuralScaffold"] => {
  const plan = state.explicitPsdImport.structuralScaffoldPlan;
  if (plan === null) {
    return null;
  }

  const includeNodeRefs = detail !== "summary";

  return AiPsdStructuralScaffoldStateSchema.parse({
    status: plan.status,
    structuralPlanId: plan.structuralPlanId,
    structuralPlanDigest: plan.structuralPlanDigest,
    approvalId: plan.approvalId,
    approvalSelectionDigest: plan.approvalSelectionDigest,
    approvalStatus: plan.approvalStatus,
    sourceFilePath: plan.sourceFilePath,
    sourceByteLength: plan.sourceByteLength,
    sourceDigest: plan.sourceDigest,
    scopeLabel: plan.scopeLabel,
    scopeRef: plan.scopeRef,
    destinationParentPartId: plan.destinationParentPartId === null
      ? null
      : PartIdSchema.parse(plan.destinationParentPartId),
    sourceGroupCount: plan.sourceGroupCount,
    sourceLayerCount: plan.sourceLayerCount,
    approvedGroupCount: plan.approvedGroupCount,
    approvedLeafCount: plan.approvedLeafCount,
    hiddenLeafCount: plan.hiddenLeafCount,
    runtimeHiddenDrawableCount: plan.runtimeHiddenDrawableCount,
    generatedGroupPartCount: plan.generatedGroupPartCount,
    generatedDrawableCount: plan.generatedDrawableCount,
    totalByteEstimate: plan.totalByteEstimate,
    approvedNodeRefs: [...plan.approvedNodeRefs],
    groupPartRefs: includeNodeRefs
      ? plan.nodes.filter(isStructuralGroupNode).map(projectStructuralGroupNode)
      : [],
    leafDrawableRefs: includeNodeRefs
      ? plan.nodes.filter(isStructuralLeafNode).map(projectStructuralLeafNode)
      : [],
    diagnostics: plan.diagnostics.map(projectDiagnostic)
  });
};

const isStructuralGroupNode = (
  node: ExplicitPsdStructuralScaffoldNodeState
): node is ExplicitPsdStructuralScaffoldNodeState & { readonly kind: "group" } =>
  node.kind === "group";

const isStructuralLeafNode = (
  node: ExplicitPsdStructuralScaffoldNodeState
): node is ExplicitPsdStructuralScaffoldNodeState & { readonly kind: "leaf" } =>
  node.kind === "leaf";

const projectStructuralGroupNode = (
  node: ExplicitPsdStructuralScaffoldNodeState
) =>
  AiPsdStructuralScaffoldGroupPartRefSchema.parse({
    sourceGroupId: node.nodeRef,
    sourceGroupPath: [...splitPathLabel(node.fullPathLabel)],
    sourceOrder: node.sourceOrder,
    visibleInSource: node.visibleInSource,
    opacityInSource: node.opacityInSource,
    generatedParentPartId: PartIdSchema.parse(node.generatedParentPartId),
    generatedPartId: node.generatedPartId === null ? null : PartIdSchema.parse(node.generatedPartId),
    status: node.status,
    statusReasons: [...node.statusReasons]
  });

const projectStructuralLeafNode = (
  node: ExplicitPsdStructuralScaffoldNodeState
) =>
  AiPsdStructuralScaffoldLeafDrawableRefSchema.parse({
    sourceLayerId: node.nodeRef,
    sourceLayerPath: [...splitPathLabel(node.fullPathLabel)],
    sourceOrder: node.sourceOrder,
    visibleInSource: node.visibleInSource,
    opacityInSource: node.opacityInSource,
    generatedParentPartId: PartIdSchema.parse(node.generatedParentPartId),
    generatedDrawableId: node.generatedDrawableId,
    generatedTextureId: node.generatedTextureId,
    generatedMeshId: node.generatedMeshId,
    initialRuntimeVisibility: node.initialRuntimeVisibility,
    status: node.status,
    statusReasons: [...node.statusReasons]
  });

const projectLatestBatch = (input: {
  readonly state: EditorSemanticState;
  readonly operationResult?: OperationResultDto;
  readonly stage?: AiPsdImportPlanLatestBatch["stage"];
  readonly selectedLayerNodeRefs?: readonly string[];
}): AiPsdImportPlanLatestBatch => {
  const operationResult = input.operationResult;
  if (operationResult === undefined) {
    const intake = input.state.explicitPsdImport.selectedLayerBatchIntake;
    return {
      status: intake.status === "idle" ? "none" : intake.status,
      selectedLayerNodeRefs: [...(input.selectedLayerNodeRefs ?? input.state.explicitPsdImport.selectedLayerNodeRefs)],
      approvedLayerNodeRefs: [...collectApprovedLayerNodeRefs(input.state)],
      generatedResultRefs: [],
      operationIds: [],
      evidenceRefs: [],
      issues: [],
      diagnostics: intake.diagnostics.map(projectDiagnostic)
    };
  }

  const evidence = operationResult.psdLayerMaterializationBatchEvidence?.[0];
  const selectedLayerNodeRefs = input.selectedLayerNodeRefs ??
    evidence?.entries.map((entry) => entry.sourceLayerRef.sourceLayerId) ??
    input.state.explicitPsdImport.selectedLayerNodeRefs;
  const evidenceRefs = collectBatchEvidenceRefs(operationResult, evidence);

  return {
    status: projectBatchStatus(operationResult, evidence),
    ...(input.stage === undefined ? {} : { stage: input.stage }),
    operationStatus: operationResult.status,
    operationId: operationResult.operationId,
    ...(evidence?.batchId === undefined ? {} : { batchId: evidence.batchId }),
    ...(evidence?.evidenceId === undefined ? {} : { batchEvidenceId: evidence.evidenceId }),
    ...(evidence?.aggregateStatus === undefined ? {} : { aggregateStatus: evidence.aggregateStatus }),
    selectedLayerNodeRefs: [...selectedLayerNodeRefs],
    approvedLayerNodeRefs: [
      ...(evidence?.importPlanBridge?.approval.approvedLeafRefs.map(
        (leaf) => leaf.sourceLayerRef.sourceLayerId
      ) ?? collectApprovedLayerNodeRefs(input.state))
    ],
    generatedResultRefs: evidence?.entries.map((entry) => ({
      selectedIndex: entry.selectedIndex,
      sourceLayerId: entry.sourceLayerRef.sourceLayerId,
      sourceLayerPath: entry.approvedLeafRef?.sourceLayerPath ??
        entry.sourceLayerRef.sourceLayerPath ??
        [],
      status: entry.status,
      ...(entry.approvalOrder === undefined ? {} : { approvalOrder: entry.approvalOrder }),
      ...(entry.operationId === undefined ? {} : { operationId: entry.operationId }),
      ...(entry.resultRefs?.batchEvidenceId === undefined
        ? {}
        : { batchEvidenceId: entry.resultRefs.batchEvidenceId }),
      ...(entry.resultRefs?.materializationEvidenceId === undefined
        ? {}
        : { materializationEvidenceId: entry.resultRefs.materializationEvidenceId }),
      materializationId: entry.materializationId,
      partId: entry.generated.partId,
      drawableId: entry.generated.drawableId,
      textureId: entry.generated.textureId,
      meshId: entry.generated.meshId,
      issues: [...entry.issues]
    })) ?? [],
    operationIds: [
      operationResult.operationId,
      ...(evidence?.perLayerOperationIds ?? [])
    ],
    evidenceRefs: [...evidenceRefs],
    issues: [
      ...(evidence?.issues ?? []),
      ...(evidence?.entries.flatMap((entry) => entry.issues) ?? [])
    ],
    diagnostics: [
      ...operationResult.diagnostics.map(projectDiagnostic),
      ...(evidence?.entries.flatMap((entry) => entry.diagnostics.map(projectDiagnostic)) ?? [])
    ]
  };
};

const projectLatestStructuralScaffold = (input: {
  readonly state: EditorSemanticState;
  readonly operationResult?: OperationResultDto;
}): { readonly latestStructuralScaffold?: AiPsdStructuralScaffoldLatestBatch } => {
  const operationResult = input.operationResult;
  const evidence = operationResult?.psdStructuralScaffoldEvidence?.[0];
  if (operationResult !== undefined && evidence !== undefined) {
    return {
      latestStructuralScaffold: AiPsdStructuralScaffoldLatestBatchSchema.parse({
        status: projectStructuralScaffoldStatus(operationResult, evidence),
        operationStatus: operationResult.status,
        operationId: operationResult.operationId,
        batchId: evidence.batchId,
        ...(evidence.evidenceId === undefined ? {} : { evidenceId: evidence.evidenceId }),
        aggregateStatus: evidence.aggregateStatus,
        sourceAssetId: evidence.sourceAssetId,
        destinationParentPartId: evidence.destination.parentPartId,
        approvedNodeRefs: collectStructuralApprovedNodeRefsFromEvidence(evidence),
        generatedGroupPartRefs: evidence.generatedGroupPartScaffolds.map(
          projectStructuralGroupEvidence
        ),
        generatedLeafDrawableRefs: evidence.generatedLeafScaffolds.map(
          projectStructuralLeafEvidence
        ),
        operationIds: [operationResult.operationId],
        evidenceRefs: collectStructuralEvidenceRefs(operationResult, evidence),
        issues: [...evidence.issues],
        diagnostics: [
          ...operationResult.diagnostics.map(projectDiagnostic),
          ...evidence.issues.map(projectStructuralIssueDiagnostic)
        ]
      })
    };
  }

  const intake = input.state.explicitPsdImport.structuralScaffoldIntake;
  const plan = input.state.explicitPsdImport.structuralScaffoldPlan;
  if (intake.status === "idle" && plan === null) {
    return {};
  }

  return {
    latestStructuralScaffold: AiPsdStructuralScaffoldLatestBatchSchema.parse({
      status: intake.status === "idle" ? "none" : intake.status,
      approvedNodeRefs: [...(plan?.approvedNodeRefs ?? input.state.explicitPsdImport.selectedLayerNodeRefs)],
      generatedGroupPartRefs:
        plan?.nodes.filter(isStructuralGroupNode).map(projectStructuralGroupNode) ?? [],
      generatedLeafDrawableRefs:
        plan?.nodes.filter(isStructuralLeafNode).map(projectStructuralLeafNode) ?? [],
      operationIds: [],
      evidenceRefs: [],
      issues: [],
      diagnostics: intake.diagnostics.map(projectDiagnostic)
    })
  };
};

const projectStructuralScaffoldStatus = (
  operationResult: OperationResultDto,
  evidence: PsdStructuralScaffoldOperationEvidenceDto
): AiPsdStructuralScaffoldLatestBatch["status"] => {
  if (operationResult.status === "committed") {
    return "committed";
  }
  if (operationResult.status === "rejected") {
    return evidence.aggregateStatus === "preflightBlocked" ? "preflightBlocked" : "rejected";
  }
  if (operationResult.status === "dry_run") {
    return evidence.aggregateStatus === "success" ? "preflightReady" : "preflightBlocked";
  }

  return "failed";
};

const projectStructuralGroupEvidence = (
  group: PsdStructuralScaffoldGroupPartDto
) =>
  AiPsdStructuralScaffoldGroupPartRefSchema.parse({
    sourceGroupId: group.sourceGroupRef.sourceGroupId,
    sourceGroupPath: [...(group.sourceGroupRef.sourceGroupPath ?? group.sourceGroupPath)],
    sourceOrder: group.sourceOrder,
    visibleInSource: group.visibleInSource,
    opacityInSource: group.opacityInSource,
    generatedParentPartId: group.generatedParentPartId,
    generatedPartId: group.generatedPartId,
    status: group.status,
    statusReasons: [...group.statusReasons]
  });

const projectStructuralLeafEvidence = (
  leaf: PsdStructuralScaffoldLeafDrawableDto
) =>
  AiPsdStructuralScaffoldLeafDrawableRefSchema.parse({
    sourceLayerId: leaf.sourceLayerRef.sourceLayerId,
    sourceLayerPath: [...(leaf.sourceLayerRef.sourceLayerPath ?? leaf.sourceLayerPath)],
    sourceOrder: leaf.sourceOrder,
    visibleInSource: leaf.visibleInSource,
    opacityInSource: leaf.opacityInSource,
    generatedParentPartId: leaf.generatedParentPartId,
    generatedDrawableId: leaf.generatedDrawableId,
    generatedTextureId: leaf.generatedTextureId,
    generatedMeshId: leaf.generatedMeshId,
    initialRuntimeVisibility: leaf.initialRuntimeVisibility,
    status: leaf.status,
    statusReasons: [...leaf.statusReasons]
  });

const collectStructuralApprovedNodeRefsFromEvidence = (
  evidence: PsdStructuralScaffoldOperationEvidenceDto
): readonly string[] => [
  ...evidence.generatedGroupPartScaffolds.map((group) => group.sourceGroupRef.sourceGroupId),
  ...evidence.generatedLeafScaffolds.map((leaf) => leaf.sourceLayerRef.sourceLayerId)
];

const projectStructuralIssueDiagnostic = (
  issue: PsdStructuralScaffoldOperationEvidenceDto["issues"][number]
): AiPsdImportPlanDiagnostic => ({
  checkId: issue.checkId ?? issue.issueKind,
  severity: issue.issueKind === "structuralExpansionCapExceeded" ? "error" : "warning",
  message: issue.message
});

const projectBatchStatus = (
  operationResult: OperationResultDto,
  evidence: PsdLayerMaterializationBatchOperationEvidenceDto | undefined
): AiPsdImportPlanLatestBatch["status"] => {
  if (operationResult.status === "committed") {
    return "committed";
  }
  if (operationResult.status === "rejected") {
    return evidence?.aggregateStatus === "preflightBlocked" ? "preflightBlocked" : "rejected";
  }
  if (operationResult.status === "dry_run") {
    return evidence?.aggregateStatus === "success" ? "preflightReady" : "preflightBlocked";
  }

  return "failed";
};

const collectApprovedLayerNodeRefs = (state: EditorSemanticState): readonly string[] =>
  state.explicitPsdImport.importPlan?.candidates
    .filter((candidate) => candidate.approved)
    .sort((left, right) =>
      (left.approvedOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.approvedOrder ?? Number.MAX_SAFE_INTEGER)
    )
    .map((candidate) => candidate.layerRef) ?? [];

const projectStateDiagnostics = (
  state: EditorSemanticState
): readonly AiPsdImportPlanDiagnostic[] => [
  ...state.explicitPsdImport.diagnostics.map(projectDiagnostic),
  ...(state.explicitPsdImport.importPlan?.diagnostics.map(projectDiagnostic) ?? []),
  ...state.explicitPsdImport.selectedLayerBatchIntake.diagnostics.map(projectDiagnostic)
];

const projectDiagnostic = (
  diagnostic: { readonly checkId: string; readonly severity: string; readonly message: string }
): AiPsdImportPlanDiagnostic => ({
  checkId: diagnostic.checkId,
  severity: diagnostic.severity === "blocking"
    ? "blocking"
    : (diagnostic.severity as AiPsdImportPlanDiagnostic["severity"]),
  message: diagnostic.message
});

const collectBatchEvidenceRefs = (
  operationResult: OperationResultDto,
  evidence: PsdLayerMaterializationBatchOperationEvidenceDto | undefined
): readonly string[] => {
  if (evidence === undefined) {
    return [];
  }

  return [
    ...(evidence.evidenceId === undefined
      ? []
      : [`operations/${operationResult.operationId}#${evidence.evidenceId}`]),
    ...evidence.entries.flatMap((entry) =>
      entry.resultRefs === undefined
        ? []
        : [
            `operations/${operationResult.operationId}#${entry.resultRefs.materializationEvidenceId}`,
            `operations/${operationResult.operationId}#${entry.resultRefs.materializationId}`,
            `operations/${operationResult.operationId}#${entry.resultRefs.partId}`,
            `operations/${operationResult.operationId}#${entry.resultRefs.drawableId}`,
            `operations/${operationResult.operationId}#${entry.resultRefs.textureId}`,
            `operations/${operationResult.operationId}#${entry.resultRefs.meshId}`
          ]
    )
  ].sort();
};

const collectStructuralEvidenceRefs = (
  operationResult: OperationResultDto,
  evidence: PsdStructuralScaffoldOperationEvidenceDto
): readonly string[] => [
  ...(evidence.evidenceId === undefined
    ? []
    : [`operations/${operationResult.operationId}#${evidence.evidenceId}`]),
  ...(evidence.structuralScaffoldBridge === undefined
    ? []
    : [
        `operations/${operationResult.operationId}#${evidence.structuralScaffoldBridge.structuralPlan.structuralPlanId}`,
        `operations/${operationResult.operationId}#${evidence.structuralScaffoldBridge.approval.approvalId}`
      ]),
  ...evidence.generatedGroupPartScaffolds.flatMap((group) => [
    `operations/${operationResult.operationId}#${group.sourceGroupRef.sourceGroupId}`,
    `operations/${operationResult.operationId}#${group.generatedPartId}`
  ]),
  ...evidence.generatedLeafScaffolds.flatMap((leaf) => [
    `operations/${operationResult.operationId}#${leaf.sourceLayerRef.sourceLayerId}`,
    `operations/${operationResult.operationId}#${leaf.generatedDrawableId}`,
    `operations/${operationResult.operationId}#${leaf.generatedTextureId}`,
    `operations/${operationResult.operationId}#${leaf.generatedMeshId}`
  ])
].sort();

const splitPathLabel = (label: string): readonly string[] =>
  label
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
