import {
  type ExplicitPsdImportState,
  type ExplicitPsdImportFactState,
  type ExplicitPsdImportTreeRowState
} from "./explicit-psd-import-state.js";
import type { ExplicitPsdImportPlanCandidateState } from "./explicit-psd-import-plan-state.js";
import { formatBoundsLabel, formatPreviewNumber } from "./view-model-format.js";

export interface ExplicitPsdImportFactViewModel {
  readonly label: string;
  readonly value: string;
}

export interface ExplicitPsdImportTreeRowViewModel {
  readonly nodeRef: string;
  readonly kind: ExplicitPsdImportTreeRowState["kind"];
  readonly depth: number;
  readonly label: string;
  readonly metaLabel: string;
}

export interface ExplicitPsdImportPlanCandidateViewModel {
  readonly layerRef: string;
  readonly label: string;
  readonly approved: boolean;
  readonly approvalEligible: boolean;
}

export interface ExplicitPsdImportViewModel {
  readonly status: ExplicitPsdImportState["status"];
  readonly statusLabel: string;
  readonly metaLabel: string;
  readonly selectedLayerNodeRef: string;
  readonly selectedLayerNodeRefs: readonly string[];
  readonly selectedLayerBatchLabel: string;
  readonly sourceFacts: readonly ExplicitPsdImportFactViewModel[];
  readonly documentFacts: readonly ExplicitPsdImportFactViewModel[];
  readonly featureFacts: readonly ExplicitPsdImportFactViewModel[];
  readonly persistenceFacts: readonly ExplicitPsdImportFactViewModel[];
  readonly intakeStatusLabel: string;
  readonly intakeFacts: readonly ExplicitPsdImportFactViewModel[];
  readonly intakeDiagnostics: readonly string[];
  readonly batchIntakeStatusLabel: string;
  readonly batchIntakeFacts: readonly ExplicitPsdImportFactViewModel[];
  readonly batchIntakeEntryLabels: readonly string[];
  readonly batchIntakeDiagnostics: readonly string[];
  readonly importPlanScopeRef: string;
  readonly importPlanDestinationParentPartId: string;
  readonly importPlanApprovedLayerNodeRefs: readonly string[];
  readonly importPlanStatusLabel: string;
  readonly importPlanFacts: readonly ExplicitPsdImportFactViewModel[];
  readonly importPlanCandidateRows: readonly ExplicitPsdImportPlanCandidateViewModel[];
  readonly importPlanCandidateLabels: readonly string[];
  readonly importPlanDiagnostics: readonly string[];
  readonly unsupportedFeatureLabels: readonly string[];
  readonly notEvaluatedFeatureLabels: readonly string[];
  readonly materializationLabels: readonly string[];
  readonly diagnostics: readonly string[];
  readonly treeRows: readonly ExplicitPsdImportTreeRowViewModel[];
}

export const projectExplicitPsdImportViewModel = (
  state: ExplicitPsdImportState
): ExplicitPsdImportViewModel => ({
  status: state.status,
  statusLabel: projectStatusLabel(state),
  metaLabel: projectMetaLabel(state),
  selectedLayerNodeRef: state.selectedLayerNodeRef,
  selectedLayerNodeRefs: state.selectedLayerNodeRefs,
  selectedLayerBatchLabel: projectSelectedLayerBatchLabel(state),
  sourceFacts: projectSourceFacts(state),
  documentFacts: projectDocumentFacts(state),
  featureFacts: projectFeatureFacts(state),
  persistenceFacts: projectPersistenceFacts(state),
  intakeStatusLabel: projectIntakeStatusLabel(state),
  intakeFacts: projectIntakeFacts(state),
  intakeDiagnostics: state.selectedLayerIntake.diagnostics.length === 0
    ? ["No selected layer intake diagnostics"]
    : state.selectedLayerIntake.diagnostics.map((diagnostic) =>
        `${diagnostic.checkId} / ${diagnostic.severity} / ${diagnostic.message}`
      ),
  batchIntakeStatusLabel: projectBatchIntakeStatusLabel(state),
  batchIntakeFacts: projectBatchIntakeFacts(state),
  batchIntakeEntryLabels: state.selectedLayerBatchIntake.entryLabels.length === 0
    ? ["No selected leaf layer batch entries"]
    : state.selectedLayerBatchIntake.entryLabels,
  batchIntakeDiagnostics: state.selectedLayerBatchIntake.diagnostics.length === 0
    ? ["No selected leaf layer batch diagnostics"]
    : state.selectedLayerBatchIntake.diagnostics.map((diagnostic) =>
      `${diagnostic.checkId} / ${diagnostic.severity} / ${diagnostic.message}`
      ),
  importPlanScopeRef: state.importPlan?.scopeRef ?? "psd:root",
  importPlanDestinationParentPartId: state.importPlan?.destinationParentPartId ?? "",
  importPlanApprovedLayerNodeRefs:
    state.importPlan?.candidates
      .filter((candidate) => candidate.approved)
      .sort((left, right) =>
        (left.approvedOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.approvedOrder ?? Number.MAX_SAFE_INTEGER)
      )
      .map((candidate) => candidate.layerRef) ?? [],
  importPlanStatusLabel: projectImportPlanStatusLabel(state),
  importPlanFacts: projectImportPlanFacts(state),
  importPlanCandidateRows: projectImportPlanCandidateRows(state),
  importPlanCandidateLabels: projectImportPlanCandidateLabels(state),
  importPlanDiagnostics: projectImportPlanDiagnostics(state),
  unsupportedFeatureLabels: state.unsupportedFeatureLabels.length === 0
    ? ["No unsupported feature evidence surfaced"]
    : state.unsupportedFeatureLabels,
  notEvaluatedFeatureLabels: state.notEvaluatedFeatureLabels.length === 0
    ? ["No notEvaluated feature evidence surfaced"]
    : state.notEvaluatedFeatureLabels,
  materializationLabels: state.materialization.length === 0
    ? ["No selected layer materialization evidence summary"]
    : state.materialization.map((materialization) =>
        [
          materialization.materializationId,
          materialization.sourceLayerId,
          materialization.mediaType,
          formatByteLength(materialization.byteLength),
          `sha256:${materialization.digest.hex}`,
          "summary only; raw materialized bytes not persisted"
        ].join(" / ")
      ),
  diagnostics: state.diagnostics.length === 0
    ? ["No PSD parser diagnostics"]
    : state.diagnostics.map((diagnostic) =>
        `${diagnostic.checkId} / ${diagnostic.severity} / ${diagnostic.message}`
      ),
  treeRows: state.treeRows.map(projectTreeRowViewModel)
});

const projectStatusLabel = (state: ExplicitPsdImportState): string => {
  switch (state.status) {
    case "idle":
      return "No PSD selected";
    case "parsed":
      return "PSD parsed in browser session";
    case "rejected":
      return "PSD rejected before parser";
    case "failed":
      return "PSD parser failed";
  }
};

const projectMetaLabel = (state: ExplicitPsdImportState): string => {
  if (state.source === null) {
    return "Explicit PSD file selection only";
  }

  const tree = state.treeSummary;
  if (tree === null) {
    return `${state.source.fileName} / ${formatByteLength(state.source.byteLength)}`;
  }

  return `${state.source.fileName} / ${tree.groupCount} group / ${tree.layerCount} layer`;
};

const projectSourceFacts = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportFactViewModel[] => {
  if (state.source === null) {
    return [
      { label: "Input", value: "User-selected PSD file only" },
      { label: "Size cap", value: "32 MiB browser parser cap" }
    ];
  }

  return [
    { label: "Filename", value: state.source.fileName },
    { label: "Byte length", value: formatByteLength(state.source.byteLength) },
    { label: "Declared media type", value: state.source.declaredMediaType ?? "No declared media type" },
    { label: "Size cap", value: formatByteLength(state.source.sizeCapBytes) },
    { label: "Intake", value: state.source.intakeKind },
    { label: "Raw PSD bytes", value: "not persisted by parser bridge" }
  ];
};

const projectDocumentFacts = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportFactViewModel[] => {
  if (state.document === null || state.treeSummary === null) {
    return [{ label: "Document", value: "No parsed PSD document metadata" }];
  }

  return [
    { label: "Profile", value: state.document.sourceProfile },
    { label: "Adapter", value: formatOptionalVersion(state.document.adapterName, state.document.adapterVersion) },
    { label: "Parser", value: state.document.parserLabel },
    { label: "Runtime", value: state.document.parserRuntime },
    {
      label: "Canvas",
      value: `${formatPreviewNumber(state.document.canvas.width)} x ${formatPreviewNumber(state.document.canvas.height)}`
    },
    {
      label: "Canvas bounds",
      value: state.document.canvas.bounds === null
        ? "No canvas bounds"
        : formatBoundsLabel(state.document.canvas.bounds)
    },
    { label: "Groups", value: String(state.treeSummary.groupCount) },
    { label: "Layers", value: String(state.treeSummary.layerCount) },
    { label: "Visible layers", value: String(state.treeSummary.visibleLayerCount) },
    { label: "Hidden layers", value: String(state.treeSummary.hiddenLayerCount) },
    { label: "Raster candidates", value: String(state.treeSummary.rasterCandidateLayerCount) },
    { label: "Max depth", value: String(state.treeSummary.maxDepth) }
  ];
};

const projectFeatureFacts = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportFactViewModel[] => [
  { label: "Feature evidence", value: String(state.featureSupport.evidenceCount) },
  { label: "Unsupported", value: String(state.featureSupport.unsupportedCount) },
  { label: "Not evaluated", value: String(state.featureSupport.notEvaluatedCount) },
  {
    label: "Unsupported IDs",
    value: state.featureSupport.unsupportedFeatureIds.join(", ") || "None"
  },
  {
    label: "Not evaluated IDs",
    value: state.featureSupport.notEvaluatedFeatureIds.join(", ") || "None"
  }
];

const projectPersistenceFacts = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportFactViewModel[] => [
  { label: "Parser objects", value: state.persistenceBoundary.rawParserObjectPersistence },
  { label: "PSD bytes", value: state.persistenceBoundary.sourcePsdBytePersistence },
  { label: "Materialized bytes", value: state.persistenceBoundary.materializedLayerBytePersistence },
  { label: "Save/load", value: state.persistenceBoundary.saveLoadSemantics },
  { label: "Compositing claim", value: state.persistenceBoundary.photoshopCompositingClaim },
  { label: "Pixel oracle claim", value: state.persistenceBoundary.rendererPixelOracleClaim }
];

const projectIntakeStatusLabel = (state: ExplicitPsdImportState): string => {
  switch (state.selectedLayerIntake.status) {
    case "idle":
      return "No selected layer intake result";
    case "committed":
      return "Selected PSD layer added to project";
    case "rejected":
      return "Selected PSD layer intake rejected";
    case "failed":
      return "Selected PSD layer intake failed";
  }
};

const projectIntakeFacts = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportFactViewModel[] =>
  state.selectedLayerIntake.summaryFacts.length === 0
    ? [{ label: "Result", value: "No materialized project asset yet" }]
    : state.selectedLayerIntake.summaryFacts.map(projectFact);

const projectBatchIntakeStatusLabel = (state: ExplicitPsdImportState): string => {
  switch (state.selectedLayerBatchIntake.status) {
    case "idle":
      return "No selected leaf layer batch result";
    case "committed":
      return "Selected PSD leaf layers added to generated parts";
    case "rejected":
      return "Selected PSD leaf layer batch rejected";
    case "failed":
      return "Selected PSD leaf layer batch failed";
  }
};

const projectBatchIntakeFacts = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportFactViewModel[] =>
  state.selectedLayerBatchIntake.summaryFacts.length === 0
    ? [{ label: "Result", value: "No selected leaf layer batch materialized yet" }]
    : state.selectedLayerBatchIntake.summaryFacts.map(projectFact);

const projectImportPlanStatusLabel = (state: ExplicitPsdImportState): string => {
  if (state.importPlan === null) {
    return "No import-plan preview generated";
  }

  return state.importPlan.status === "ready"
    ? "Import-plan preview ready"
    : "Import-plan preview blocked";
};

const projectImportPlanFacts = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportFactViewModel[] => {
  const plan = state.importPlan;
  if (plan === null) {
    return [{ label: "Preview", value: "No candidate plan preview" }];
  }

  return [
    { label: "Plan id", value: plan.planId },
    { label: "Candidate plan digest", value: plan.candidatePlanDigest },
    { label: "Source", value: `${plan.sourceFileName} / ${formatByteLength(plan.sourceByteLength)}` },
    { label: "Source digest", value: plan.sourceDigest ?? "No source digest evidence" },
    { label: "Source provenance", value: plan.sourceProvenanceLabel },
    { label: "Parser", value: plan.parserLabel },
    { label: "Scope", value: `${plan.scopeLabel} / ${plan.scopeRef}` },
    { label: "Destination parent part", value: plan.destinationParentPartId ?? "No destination parent selected" },
    {
      label: "Candidates / eligible / approved / not-approved",
      value: [
        plan.candidateCount,
        plan.eligibleCandidateCount,
        plan.approvedCount,
        plan.notApprovedCount
      ].join(" / ")
    },
    {
      label: "Hidden / unsupported / collisions / byte blocked",
      value: [
        plan.hiddenCount,
        plan.unsupportedCount,
        plan.collisionCount,
        plan.byteCapBlockedCount
      ].join(" / ")
    },
    {
      label: "Byte estimate total / approved",
      value: [
        formatByteLength(plan.totalRawRgbaByteEstimate),
        formatByteLength(plan.approvedRawRgbaByteEstimate)
      ].join(" / ")
    }
  ];
};

const projectImportPlanCandidateRows = (
  state: ExplicitPsdImportState
): readonly ExplicitPsdImportPlanCandidateViewModel[] =>
  state.importPlan?.candidates.map((candidate) => ({
    layerRef: candidate.layerRef,
    label: projectImportPlanCandidateLabel(candidate),
    approved: candidate.approved,
    approvalEligible: candidate.statuses.includes("candidate") &&
      candidate.approvalBlockedReasons.length === 0
  })) ?? [];

const projectImportPlanCandidateLabels = (
  state: ExplicitPsdImportState
): readonly string[] =>
  state.importPlan === null || state.importPlan.candidates.length === 0
    ? ["No import-plan leaf candidates"]
    : state.importPlan.candidates.map(projectImportPlanCandidateLabel);

const projectImportPlanCandidateLabel = (
  candidate: ExplicitPsdImportPlanCandidateState
): string =>
  [
    candidate.layerRef,
    candidate.fullPathLabel,
    `name=${candidate.displayName}`,
    candidate.parentGroupPathLabel === null ? "parent=root" : `parent=${candidate.parentGroupPathLabel}`,
    candidate.visibleInSource ? "visible" : "hidden",
    `opacity=${formatPreviewNumber(candidate.opacityInSource)}`,
    `bounds=${candidate.boundsLabel}`,
    `statuses=${candidate.statuses.join(",")}`,
    candidate.statusReasons.length === 0 ? "reasons=none" : `reasons=${candidate.statusReasons.join(" | ")}`,
    `bytes=${formatByteLength(candidate.rawRgbaByteEstimate)}`,
    candidate.requestedApproval ? "approval=requested" : "approval=notRequested",
    candidate.approved ? `approvedOrder=${candidate.approvedOrder ?? "unknown"}` : "approved=false",
    candidate.approvalBlockedReasons.length === 0
      ? "approvalBlocked=none"
      : `approvalBlocked=${candidate.approvalBlockedReasons.join(",")}`,
    `part=${candidate.generatedPartId}`,
    `drawable=${candidate.generatedDrawableId}`,
    `texture=${candidate.generatedTextureId}`,
    `mesh=${candidate.generatedMeshId}`
  ].join(" / ");

const projectImportPlanDiagnostics = (
  state: ExplicitPsdImportState
): readonly string[] =>
  state.importPlan === null || state.importPlan.diagnostics.length === 0
    ? ["No import-plan preview diagnostics"]
    : state.importPlan.diagnostics.map((diagnostic) =>
        `${diagnostic.checkId} / ${diagnostic.severity} / ${diagnostic.message}`
      );

const projectSelectedLayerBatchLabel = (state: ExplicitPsdImportState): string =>
  state.selectedLayerNodeRefs.length === 0
    ? "No selected PSD leaf layers"
    : state.selectedLayerNodeRefs.join(", ");

const projectFact = (
  fact: ExplicitPsdImportFactState
): ExplicitPsdImportFactViewModel => ({
  label: fact.label,
  value: fact.value
});

const projectTreeRowViewModel = (
  row: ExplicitPsdImportTreeRowState
): ExplicitPsdImportTreeRowViewModel => ({
  nodeRef: row.nodeRef,
  kind: row.kind,
  depth: row.depth,
  label: [
    `${row.kind}: ${row.name}`,
    row.normalizedName === row.name ? "" : `normalized ${row.normalizedName}`,
    row.groupPath.length === 0 ? "root" : row.groupPath.join(" / ")
  ].filter((value) => value.length > 0).join(" / "),
  metaLabel: [
    row.nodeRef,
    row.visibleInSource ? "visible" : "hidden",
    `opacity ${formatPreviewNumber(row.opacityInSource)}`,
    row.bounds === null ? "bounds unavailable" : formatBoundsLabel(row.bounds),
    row.role ?? "group",
    row.blendModeLabel ?? "no blend mode evidence",
    row.unsupportedFeatureIds.length === 0
      ? "no unsupported features"
      : `unsupported ${row.unsupportedFeatureIds.join(", ")}`
  ].join(" / ")
});

const formatOptionalVersion = (name: string, version: string | null): string =>
  version === null ? name : `${name} / ${version}`;

const formatByteLength = (byteLength: number): string =>
  `${byteLength} byte${byteLength === 1 ? "" : "s"}`;
