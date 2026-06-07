import { applyShellSurfaceMetadata, shellSurfaces } from "./shell-surfaces.js";

export const diagnosticsEvidenceViewSkeletonTestIds = {
  root: "diagnosticsEvidenceView.skeleton",
  purpose: "diagnosticsEvidenceView.purpose",
  emptyState: "diagnosticsEvidenceView.emptyState",
  navigation: "diagnosticsEvidenceView.navigation",
  details: "diagnosticsEvidenceView.details",
  operationLog: "diagnosticsEvidenceView.slot.operationLog",
  generatedEvidence: "diagnosticsEvidenceView.slot.generatedEvidence",
  packageFileSet: "diagnosticsEvidenceView.slot.packageFileSet",
  reloadSummary: "diagnosticsEvidenceView.slot.reloadSummary",
  validationDiagnostics: "diagnosticsEvidenceView.slot.validationDiagnostics",
  runtimeSnapshotDiff: "diagnosticsEvidenceView.slot.runtimeSnapshotDiff",
  psdStructuralEvidence: "diagnosticsEvidenceView.slot.psdStructuralEvidence"
} as const;

type DiagnosticsEvidenceSlotId =
  | "operation-log"
  | "generated-evidence"
  | "package-file-set"
  | "reload-summary"
  | "validation-diagnostics"
  | "runtime-snapshot-diff"
  | "psd-structural-evidence";

interface DiagnosticsEvidenceSlotDefinition {
  readonly id: DiagnosticsEvidenceSlotId;
  readonly testId: string;
  readonly title: string;
  readonly summary: string;
}

const diagnosticsEvidenceSlots: readonly DiagnosticsEvidenceSlotDefinition[] = [
  {
    id: "operation-log",
    testId: diagnosticsEvidenceViewSkeletonTestIds.operationLog,
    title: "Operation Log",
    summary: "Read-only history for completed editor operations will be grouped here."
  },
  {
    id: "generated-evidence",
    testId: diagnosticsEvidenceViewSkeletonTestIds.generatedEvidence,
    title: "Generated Evidence",
    summary: "Generated artifacts and evidence summaries will be available without crowding the authoring workspace."
  },
  {
    id: "package-file-set",
    testId: diagnosticsEvidenceViewSkeletonTestIds.packageFileSet,
    title: "Package File Set",
    summary: "Package contents, file availability, and reference summaries will have a separated review area."
  },
  {
    id: "reload-summary",
    testId: diagnosticsEvidenceViewSkeletonTestIds.reloadSummary,
    title: "Reload Summary",
    summary: "Project reload results and importable package state will appear as bounded summaries."
  },
  {
    id: "validation-diagnostics",
    testId: diagnosticsEvidenceViewSkeletonTestIds.validationDiagnostics,
    title: "Full Validation Diagnostics / Product Preflight Details",
    summary: "Blocking issues, warnings, and Product Preflight detail records will live outside the compact diagnostics strip."
  },
  {
    id: "runtime-snapshot-diff",
    testId: diagnosticsEvidenceViewSkeletonTestIds.runtimeSnapshotDiff,
    title: "Runtime Snapshot / Diff Details",
    summary: "Viewer/runtime snapshot and diff evidence will be reviewable here after integration."
  },
  {
    id: "psd-structural-evidence",
    testId: diagnosticsEvidenceViewSkeletonTestIds.psdStructuralEvidence,
    title: "PSD Import / Structural Scaffold Evidence",
    summary: "PSD import, approval, batch, parser, and structural scaffold evidence will use this separated slot."
  }
];

export const createDiagnosticsEvidenceViewSkeleton = (): HTMLElement => {
  const root = document.createElement("section");
  root.className = "diagnostics-evidence-view-skeleton";
  root.dataset.testid = diagnosticsEvidenceViewSkeletonTestIds.root;
  root.setAttribute("aria-labelledby", "diagnostics-evidence-view-skeleton-title");
  applyShellSurfaceMetadata(root, shellSurfaces.diagnosticsEvidenceView, {
    group: "diagnostics-evidence-skeleton"
  });

  const header = document.createElement("header");
  header.className = "diagnostics-evidence-view-skeleton__header";

  const title = document.createElement("h2");
  title.id = "diagnostics-evidence-view-skeleton-title";
  title.textContent = "Diagnostics / Evidence";

  const purpose = document.createElement("p");
  purpose.className = "diagnostics-evidence-view-skeleton__purpose";
  purpose.dataset.testid = diagnosticsEvidenceViewSkeletonTestIds.purpose;
  purpose.textContent =
    "Separated read-only home for detailed diagnostics, generated evidence, and debug records that do not belong in the primary authoring workspace.";

  header.append(title, purpose);

  const emptyState = document.createElement("p");
  emptyState.className = "diagnostics-evidence-view-skeleton__empty-state";
  emptyState.dataset.testid = diagnosticsEvidenceViewSkeletonTestIds.emptyState;
  emptyState.textContent =
    "No detailed evidence is selected yet. Future integrations can attach concise summaries to the slots below.";

  const layout = document.createElement("div");
  layout.className = "diagnostics-evidence-view-skeleton__layout";
  layout.append(createDiagnosticsEvidenceNavigation(), createDiagnosticsEvidenceDetails());

  root.append(header, emptyState, layout);
  return root;
};

const createDiagnosticsEvidenceNavigation = (): HTMLElement => {
  const navigation = document.createElement("nav");
  navigation.className = "diagnostics-evidence-view-skeleton__navigation";
  navigation.dataset.testid = diagnosticsEvidenceViewSkeletonTestIds.navigation;
  navigation.setAttribute("aria-label", "Diagnostics evidence sections");

  const heading = document.createElement("h3");
  heading.textContent = "Navigation";

  const list = document.createElement("ul");
  for (const slot of diagnosticsEvidenceSlots) {
    const item = document.createElement("li");
    item.dataset.diagnosticsEvidenceSlot = slot.id;
    item.textContent = slot.title;
    list.append(item);
  }

  navigation.append(heading, list);
  return navigation;
};

const createDiagnosticsEvidenceDetails = (): HTMLElement => {
  const details = document.createElement("div");
  details.className = "diagnostics-evidence-view-skeleton__details";
  details.dataset.testid = diagnosticsEvidenceViewSkeletonTestIds.details;
  details.setAttribute("aria-label", "Diagnostics evidence detail slots");

  const heading = document.createElement("h3");
  heading.textContent = "Details";
  details.append(heading);

  for (const slot of diagnosticsEvidenceSlots) {
    details.append(createDiagnosticsEvidenceSlot(slot));
  }

  return details;
};

const createDiagnosticsEvidenceSlot = (
  slot: DiagnosticsEvidenceSlotDefinition
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "diagnostics-evidence-view-skeleton__slot";
  section.dataset.testid = slot.testId;
  section.dataset.diagnosticsEvidenceSlot = slot.id;
  section.setAttribute("aria-labelledby", `diagnostics-evidence-view-skeleton-${slot.id}-title`);

  const title = document.createElement("h4");
  title.id = `diagnostics-evidence-view-skeleton-${slot.id}-title`;
  title.textContent = slot.title;

  const summary = document.createElement("p");
  summary.textContent = slot.summary;

  section.append(title, summary);
  return section;
};
