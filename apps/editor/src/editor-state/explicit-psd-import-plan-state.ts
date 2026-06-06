import type {
  BrowserPsdImportPlanCandidatePlan,
  BrowserPsdImportPlanCandidateStatus
} from "../editor-workflow/browser-psd-import-plan-candidate-result.js";

export interface ExplicitPsdImportPlanCandidateState {
  readonly layerRef: string;
  readonly displayName: string;
  readonly fullPathLabel: string;
  readonly parentGroupPathLabel: string | null;
  readonly boundsLabel: string;
  readonly visibleInSource: boolean;
  readonly opacityInSource: number;
  readonly sourceOrder: number;
  readonly rawRgbaByteEstimate: number;
  readonly statuses: readonly BrowserPsdImportPlanCandidateStatus[];
  readonly statusReasons: readonly string[];
  readonly defaultSelection: "notApproved";
  readonly requestedApproval: boolean;
  readonly approved: boolean;
  readonly approvedOrder: number | null;
  readonly approvalBlockedReasons: readonly string[];
  readonly generatedPartId: string;
  readonly generatedDrawableId: string;
  readonly generatedTextureId: string;
  readonly generatedMeshId: string;
}

export interface ExplicitPsdImportPlanState {
  readonly status: BrowserPsdImportPlanCandidatePlan["status"];
  readonly planId: string;
  readonly candidatePlanDigest: string;
  readonly sourceFileName: string;
  readonly sourceByteLength: number;
  readonly sourceDigest: string | null;
  readonly sourceProvenanceLabel: string;
  readonly parserLabel: string;
  readonly scopeRef: string;
  readonly scopeLabel: string;
  readonly destinationParentPartId: string | null;
  readonly candidateCount: number;
  readonly eligibleCandidateCount: number;
  readonly approvedCount: number;
  readonly notApprovedCount: number;
  readonly hiddenCount: number;
  readonly unsupportedCount: number;
  readonly collisionCount: number;
  readonly byteCapBlockedCount: number;
  readonly totalRawRgbaByteEstimate: number;
  readonly approvedRawRgbaByteEstimate: number;
  readonly candidates: readonly ExplicitPsdImportPlanCandidateState[];
  readonly diagnostics: readonly {
    readonly checkId: string;
    readonly severity: "info" | "warning" | "error";
    readonly message: string;
  }[];
}

export const projectExplicitPsdImportPlanState = (
  plan: BrowserPsdImportPlanCandidatePlan,
  options: {
    readonly destinationParentPartId?: string;
  } = {}
): ExplicitPsdImportPlanState => ({
  status: plan.status,
  planId: plan.planId,
  candidatePlanDigest: `${plan.candidatePlanDigest.algorithm}:${plan.candidatePlanDigest.hex}`,
  sourceFileName: plan.source.fileName,
  sourceByteLength: plan.source.byteLength,
  sourceDigest: plan.sourceDigest === undefined
    ? null
    : `${plan.sourceDigest.algorithm}:${plan.sourceDigest.hex}`,
  sourceProvenanceLabel: [
    "private/local",
    plan.source.privacy.publicDistribution,
    plan.persistenceBoundary.sourcePsdBytePersistence,
    plan.persistenceBoundary.rawParserObjectPersistence
  ].join(" / "),
  parserLabel: plan.parser === undefined
    ? "No parser evidence"
    : [
        plan.parser.parserName,
        plan.parser.parserPackageName,
        plan.parser.parserVersion,
        plan.parser.runtime
      ].filter((value): value is string => value !== undefined && value.length > 0).join(" / "),
  scopeRef: plan.scope.scopeRef,
  scopeLabel: plan.scope.displayPath.length === 0 ? plan.scope.scopeRef : plan.scope.displayPath.join(" / "),
  destinationParentPartId: options.destinationParentPartId?.trim() || null,
  candidateCount: plan.summary.totalLeafCount,
  eligibleCandidateCount: plan.summary.eligibleCandidateCount,
  approvedCount: plan.summary.approvedCount,
  notApprovedCount: plan.summary.notApprovedCount,
  hiddenCount: plan.summary.hiddenCount,
  unsupportedCount: plan.summary.unsupportedCount,
  collisionCount: plan.summary.generatedIdCollisionCount + plan.summary.generatedNameCollisionCount,
  byteCapBlockedCount: plan.summary.byteCapBlockedCount,
  totalRawRgbaByteEstimate: plan.summary.totalRawRgbaByteEstimate,
  approvedRawRgbaByteEstimate: plan.summary.approvedRawRgbaByteEstimate,
  candidates: plan.candidates.map((candidate) => ({
    layerRef: candidate.layerRef,
    displayName: candidate.displayName,
    fullPathLabel: candidate.fullPath.join(" / ") || candidate.displayName,
    parentGroupPathLabel: candidate.parentGroups.length === 0
      ? null
      : candidate.parentGroups.map((group) => group.displayName).join(" / "),
    boundsLabel: `${candidate.bounds.x},${candidate.bounds.y} ${candidate.bounds.width}x${candidate.bounds.height}`,
    visibleInSource: candidate.visibleInSource,
    opacityInSource: candidate.opacityInSource,
    sourceOrder: candidate.sourceOrder,
    rawRgbaByteEstimate: candidate.rawRgbaByteEstimate,
    statuses: candidate.statuses,
    statusReasons: candidate.statusReasons,
    defaultSelection: candidate.selection.default,
    requestedApproval: candidate.selection.requestedApproval,
    approved: candidate.selection.approved,
    approvedOrder: candidate.selection.approvedOrder,
    approvalBlockedReasons: candidate.selection.approvalBlockedReasons,
    generatedPartId: candidate.generated.partId,
    generatedDrawableId: candidate.generated.drawableId,
    generatedTextureId: candidate.generated.textureId,
    generatedMeshId: candidate.generated.meshId
  })),
  diagnostics: plan.diagnostics.map((diagnostic) => ({
    checkId: diagnostic.checkId,
    severity: diagnostic.severity,
    message: diagnostic.message
  }))
});
