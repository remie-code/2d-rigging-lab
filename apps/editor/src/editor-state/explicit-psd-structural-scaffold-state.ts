import type {
  PsdStructuralScaffoldOperationEvidenceDto
} from "@private-2d-rigging-lab/operation-core";

import type {
  BrowserPsdStructuralScaffoldPlan,
  BrowserPsdStructuralScaffoldNodePreview
} from "../editor-workflow/browser-psd-structural-scaffold-plan-service.js";
import type {
  ExplicitPsdImportDiagnosticState,
  ExplicitPsdImportFactState
} from "./explicit-psd-import-state.js";

export interface ExplicitPsdStructuralScaffoldNodeState {
  readonly nodeRef: string;
  readonly kind: BrowserPsdStructuralScaffoldNodePreview["kind"];
  readonly label: string;
  readonly fullPathLabel: string;
  readonly sourceOrder: number;
  readonly visibleInSource: boolean;
  readonly opacityInSource: number;
  readonly boundsLabel: string;
  readonly approvalEligible: boolean;
  readonly approved: boolean;
  readonly generatedParentPartId: string;
  readonly generatedPartId: string | null;
  readonly generatedDrawableId: string | null;
  readonly generatedTextureId: string | null;
  readonly generatedMeshId: string | null;
  readonly initialRuntimeVisibility: boolean | null;
  readonly status: string;
  readonly statusReasons: readonly string[];
}

export interface ExplicitPsdStructuralScaffoldPlanState {
  readonly status: BrowserPsdStructuralScaffoldPlan["status"];
  readonly structuralPlanId: string;
  readonly structuralPlanDigest: string;
  readonly approvalId: string;
  readonly approvalSelectionDigest: string;
  readonly approvalStatus: string;
  readonly sourceFilePath: string;
  readonly sourceByteLength: number;
  readonly sourceDigest: string;
  readonly scopeLabel: string;
  readonly scopeRef: string;
  readonly destinationParentPartId: string | null;
  readonly sourceGroupCount: number;
  readonly sourceLayerCount: number;
  readonly approvedGroupCount: number;
  readonly approvedLeafCount: number;
  readonly hiddenLeafCount: number;
  readonly runtimeHiddenDrawableCount: number;
  readonly generatedGroupPartCount: number;
  readonly generatedDrawableCount: number;
  readonly totalByteEstimate: number | null;
  readonly approvedNodeRefs: readonly string[];
  readonly nodes: readonly ExplicitPsdStructuralScaffoldNodeState[];
  readonly diagnostics: readonly ExplicitPsdImportDiagnosticState[];
}

export interface ExplicitPsdStructuralScaffoldIntakeState {
  readonly status: "idle" | "committed" | "rejected" | "failed";
  readonly summaryFacts: readonly ExplicitPsdImportFactState[];
  readonly entryLabels: readonly string[];
  readonly diagnostics: readonly ExplicitPsdImportDiagnosticState[];
}

export const createEmptyExplicitPsdStructuralScaffoldIntakeState =
  (): ExplicitPsdStructuralScaffoldIntakeState => ({
    status: "idle",
    summaryFacts: [],
    entryLabels: [],
    diagnostics: []
  });

export const projectExplicitPsdStructuralScaffoldPlanState = (
  plan: BrowserPsdStructuralScaffoldPlan,
  options: {
    readonly destinationParentPartId?: string;
  } = {}
): ExplicitPsdStructuralScaffoldPlanState => {
  const structuralPlan = plan.structuralScaffoldBridge.structuralPlan;
  const approval = plan.structuralScaffoldBridge.approval;

  return {
    status: plan.status,
    structuralPlanId: structuralPlan.structuralPlanId,
    structuralPlanDigest: `${structuralPlan.structuralPlanDigest.algorithm}:${structuralPlan.structuralPlanDigest.hex}`,
    approvalId: approval.approvalId,
    approvalSelectionDigest: `${approval.approvalSelectionDigest.algorithm}:${approval.approvalSelectionDigest.hex}`,
    approvalStatus: approval.approvalStatus,
    sourceFilePath: structuralPlan.sourcePsd.sourceFilePath ?? "no source file path",
    sourceByteLength: structuralPlan.sourcePsd.byteLength,
    sourceDigest: `${structuralPlan.sourcePsd.digest.algorithm}:${structuralPlan.sourcePsd.digest.hex}`,
    scopeLabel: structuralPlan.scope.scopeDisplayPath.join(" / ") ||
      structuralPlan.scope.scopeRef.id ||
      "document",
    scopeRef: structuralPlan.scope.scopeRef.id ?? structuralPlan.scope.scopeRef.path ?? "psd:root",
    destinationParentPartId: options.destinationParentPartId?.trim() || approval.destination.parentPartId || null,
    sourceGroupCount: structuralPlan.summary.sourceGroupCount,
    sourceLayerCount: structuralPlan.summary.sourceLayerCount,
    approvedGroupCount: approval.summary.approvedGroupCount,
    approvedLeafCount: approval.summary.approvedLeafCount,
    hiddenLeafCount: approval.summary.hiddenLeafCount,
    runtimeHiddenDrawableCount: approval.summary.runtimeHiddenDrawableCount,
    generatedGroupPartCount: approval.summary.generatedGroupPartCount,
    generatedDrawableCount: approval.summary.generatedDrawableCount,
    totalByteEstimate: approval.summary.totalByteEstimate ?? null,
    approvedNodeRefs: plan.approvedNodeRefs,
    nodes: plan.nodes.map(projectStructuralNode),
    diagnostics: plan.diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity: diagnostic.severity,
      message: diagnostic.message
    }))
  };
};

export const projectCommittedPsdStructuralScaffoldIntakeState = (
  evidence: PsdStructuralScaffoldOperationEvidenceDto
): ExplicitPsdStructuralScaffoldIntakeState => ({
  status: evidence.aggregateStatus === "success" ? "committed" : "rejected",
  summaryFacts: [
    { label: "Batch id", value: evidence.batchId },
    { label: "Evidence id", value: evidence.evidenceId ?? "not returned" },
    { label: "Operation", value: evidence.operationId ?? "not returned" },
    { label: "Aggregate status", value: evidence.aggregateStatus },
    { label: "Destination parent part", value: evidence.destination.parentPartId },
    { label: "Generated group parts", value: String(evidence.generatedGroupPartScaffolds.length) },
    { label: "Generated drawables", value: String(evidence.generatedLeafScaffolds.length) },
    {
      label: "Runtime-hidden drawables",
      value: String(evidence.generatedLeafScaffolds.filter((leaf) => !leaf.initialRuntimeVisibility).length)
    },
    { label: "Issues", value: evidence.issues.length === 0 ? "none" : String(evidence.issues.length) }
  ],
  entryLabels: [
    ...evidence.generatedGroupPartScaffolds.map((group) => [
      "group",
      group.sourceGroupRef.sourceGroupId,
      group.sourceGroupPath.join(" / ") || group.sourceGroupName,
      `part=${group.generatedPartId}`,
      `parent=${group.generatedParentPartId}`,
      `status=${group.status}`
    ].join(" / ")),
    ...evidence.generatedLeafScaffolds.map((leaf) => [
      "leaf",
      leaf.sourceLayerRef.sourceLayerId,
      leaf.sourceLayerPath.join(" / ") || leaf.sourceLayerName,
      `drawable=${leaf.generatedDrawableId}`,
      `texture=${leaf.generatedTextureId}`,
      `mesh=${leaf.generatedMeshId}`,
      `parent=${leaf.generatedParentPartId}`,
      leaf.initialRuntimeVisibility ? "runtime=visible" : "runtime=hidden",
      `status=${leaf.status}`
    ].join(" / "))
  ],
  diagnostics: evidence.issues.length === 0
    ? [{
        checkId: "editor.psdStructuralScaffold.committed",
        severity: "info",
        message: "PSD structural scaffold was committed with explicit approved groups and leaves."
      }]
    : evidence.issues.map((issue) => ({
        checkId: issue.checkId ?? issue.issueKind,
        severity: issue.issueKind === "structuralExpansionCapExceeded" ? "error" : "warning",
        message: issue.message
      }))
});

export const createFailedPsdStructuralScaffoldIntakeState = (input: {
  readonly checkId: string;
  readonly message: string;
  readonly status?: "rejected" | "failed";
  readonly entryLabels?: readonly string[];
  readonly summaryFacts?: readonly ExplicitPsdImportFactState[];
  readonly diagnostics?: readonly ExplicitPsdImportDiagnosticState[];
}): ExplicitPsdStructuralScaffoldIntakeState => ({
  status: input.status ?? "failed",
  summaryFacts: input.summaryFacts ?? [{ label: "Failure", value: input.message }],
  entryLabels: input.entryLabels ?? [],
  diagnostics: input.diagnostics ?? [{
    checkId: input.checkId,
    severity: "error",
    message: input.message
  }]
});

const projectStructuralNode = (
  node: BrowserPsdStructuralScaffoldNodePreview
): ExplicitPsdStructuralScaffoldNodeState => ({
  nodeRef: node.nodeRef,
  kind: node.kind,
  label: node.label,
  fullPathLabel: node.fullPathLabel,
  sourceOrder: node.sourceOrder,
  visibleInSource: node.visibleInSource,
  opacityInSource: node.opacityInSource,
  boundsLabel: node.boundsLabel,
  approvalEligible: node.approvalEligible,
  approved: node.approved,
  generatedParentPartId: node.generatedParentPartId,
  generatedPartId: node.generatedPartId ?? null,
  generatedDrawableId: node.generatedDrawableId ?? null,
  generatedTextureId: node.generatedTextureId ?? null,
  generatedMeshId: node.generatedMeshId ?? null,
  initialRuntimeVisibility: node.initialRuntimeVisibility ?? null,
  status: node.status,
  statusReasons: node.statusReasons
});
