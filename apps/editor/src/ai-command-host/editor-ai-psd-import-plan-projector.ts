import type {
  AiPsdImportPlanCommandResult,
  AiPsdImportPlanDiagnostic,
  AiPsdImportPlanLatestBatch
} from "@private-2d-rigging-lab/ai-interface";
import { PartIdSchema } from "@private-2d-rigging-lab/contracts";
import { AiPsdImportPlanCommandResultSchema } from "@private-2d-rigging-lab/ai-interface";
import type {
  OperationResultDto,
  PsdLayerMaterializationBatchOperationEvidenceDto
} from "@private-2d-rigging-lab/operation-core";

import type {
  EditorSemanticState,
  ExplicitPsdImportPlanCandidateState
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
    latestBatch: projectLatestBatch(input),
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
