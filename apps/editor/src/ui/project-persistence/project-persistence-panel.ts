import type { EditorWorkflowPersistenceResult } from "../../editor-workflow/index.js";
import {
  editorTestIds,
  projectTransportCapabilityViewRows,
  type EditorWorkflowViewModel
} from "../../editor-state/index.js";
import { createProjectTransportCapabilitySection } from "./project-transport-capability-section.js";

export interface ProjectPersistencePanelOptions {
  readonly viewModel: EditorWorkflowViewModel;
  readonly latestProjectPersistenceResult: EditorWorkflowPersistenceResult | null;
  readonly onSaveProject: () => void;
  readonly onLoadProject: () => void;
  readonly onResetProject: () => void;
  readonly onExportPortableBundle?: () => void | Promise<void>;
  readonly onImportPortableBundleText?: (bundleText: string) => void | Promise<void>;
}

export const createProjectPersistencePanel = (
  options: ProjectPersistencePanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "project-persistence-panel";
  panel.dataset.testid = editorTestIds.projectPersistencePanel;
  panel.setAttribute("aria-labelledby", "project-persistence-heading");

  const heading = document.createElement("h2");
  heading.id = "project-persistence-heading";
  heading.textContent = "Project Storage";

  const actions = document.createElement("div");
  actions.className = "project-persistence-panel__actions";
  actions.append(
    createActionButton({
      label: "Save",
      testId: editorTestIds.projectPersistenceSave,
      disabled: !options.viewModel.isPackageLoaded,
      onClick: options.onSaveProject
    }),
    createActionButton({
      label: "Load saved",
      testId: editorTestIds.projectPersistenceLoad,
      disabled: false,
      onClick: options.onLoadProject
    }),
    createActionButton({
      label: "Reset sample",
      testId: editorTestIds.projectPersistenceReset,
      disabled: false,
      onClick: options.onResetProject
    }),
    createActionButton({
      label: "Export portable JSON",
      testId: editorTestIds.projectPersistencePortableExport,
      disabled: !options.viewModel.isPackageLoaded || options.onExportPortableBundle === undefined,
      onClick: () => {
        void options.onExportPortableBundle?.();
      }
    }),
    createPortableBundleImportInput({
      disabled: options.onImportPortableBundleText === undefined,
      ...(options.onImportPortableBundleText === undefined
        ? {}
        : { onImportPortableBundleText: options.onImportPortableBundleText })
    })
  );

  panel.append(
    heading,
    actions,
    createProjectTransportCapabilitySection(projectTransportCapabilityViewRows()),
    createProjectPersistenceStatus(options.latestProjectPersistenceResult)
  );

  return panel;
};

interface ActionButtonOptions {
  readonly label: string;
  readonly testId: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

const createActionButton = (options: ActionButtonOptions): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "editor-button project-persistence-panel__button";
  button.dataset.testid = options.testId;
  button.disabled = options.disabled;
  button.textContent = options.label;
  button.addEventListener("click", options.onClick);

  return button;
};

interface PortableBundleImportInputOptions {
  readonly disabled: boolean;
  readonly onImportPortableBundleText?: (bundleText: string) => void | Promise<void>;
}

const createPortableBundleImportInput = (
  options: PortableBundleImportInputOptions
): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "project-persistence-panel__import-label";
  label.textContent = "Import portable JSON";

  const input = document.createElement("input");
  input.type = "file";
  input.className = "project-persistence-panel__file-input";
  input.dataset.testid = editorTestIds.projectPersistencePortableImportInput;
  input.disabled = options.disabled;
  input.setAttribute("accept", "application/json,.json");
  input.addEventListener("change", () => {
    void importPortableBundleFile(input, options.onImportPortableBundleText);
  });

  label.append(input);

  return label;
};

const importPortableBundleFile = async (
  input: HTMLInputElement,
  onImportPortableBundleText:
    | ((bundleText: string) => void | Promise<void>)
    | undefined
): Promise<void> => {
  const selectedFile = input.files?.[0];

  if (selectedFile === undefined || onImportPortableBundleText === undefined) {
    return;
  }

  await onImportPortableBundleText(await selectedFile.text());
  input.value = "";
};

const createProjectPersistenceStatus = (
  result: EditorWorkflowPersistenceResult | null
): HTMLElement => {
  const status = document.createElement("div");
  const summary = summarizeProjectPersistenceResult(result);
  status.className = `project-persistence-panel__status project-persistence-panel__status--${summary.tone}`;
  status.dataset.testid = editorTestIds.projectPersistenceStatus;
  status.setAttribute("role", "status");

  const label = document.createElement("p");
  label.className = "project-persistence-panel__status-label";
  label.textContent = summary.label;

  const detail = document.createElement("p");
  detail.className = "project-persistence-panel__status-detail";
  detail.dataset.testid = editorTestIds.projectPersistenceSummary;
  detail.textContent = summary.detail;

  status.append(label, detail);
  return status;
};

interface ProjectPersistenceStatusSummary {
  readonly tone: "idle" | "success" | "empty" | "failed";
  readonly label: string;
  readonly detail: string;
}

const summarizeProjectPersistenceResult = (
  result: EditorWorkflowPersistenceResult | null
): ProjectPersistenceStatusSummary => {
  if (result === null) {
    return {
      tone: "idle",
      label: "Ready",
      detail: "No project storage action has run in this session."
    };
  }

  switch (result.status) {
    case "saved":
      return {
        tone: "success",
        label: "Saved",
        detail: formatSavedProjectDetail(result.storeResult.project)
      };
    case "loaded":
      return {
        tone: "success",
        label: "Loaded",
        detail: formatLoadedProjectDetail(result)
      };
    case "empty":
      return {
        tone: "empty",
        label: "No saved project",
        detail: `Storage key ${result.storeResult.storageKey} is empty.`
      };
    case "failed":
      return {
        tone: "failed",
        label: "Load failed",
        detail: `${result.storeResult.reason}: ${result.storeResult.message}`
      };
    case "reset":
      return {
        tone: "success",
        label: "Cleared",
        detail: `Sample project restored; ${result.clearResult.storageKey} was cleared.`
      };
    case "portableExported":
      return {
        tone: "success",
        label: "Portable JSON exported",
        detail: formatPortableBundleExportDetail(result)
      };
    case "portableExportFailed":
      return {
        tone: "failed",
        label: "Portable JSON export failed",
        detail: formatPortableBundleFailureDetail(result)
      };
    case "portableImported":
      return {
        tone: "success",
        label: "Portable JSON imported",
        detail: formatPortableBundleImportDetail(result)
      };
    case "portableImportFailed":
      return {
        tone: "failed",
        label: "Portable JSON import failed",
        detail: formatPortableBundleFailureDetail(result)
      };
  }
};

type SavedProject = Extract<
  EditorWorkflowPersistenceResult,
  { readonly status: "saved" | "loaded" }
>["storeResult"]["project"];

type LoadedProjectResult = Extract<
  EditorWorkflowPersistenceResult,
  { readonly status: "loaded" }
>;

const formatSavedProjectDetail = (project: SavedProject): string => {
  const operationCount = project.operationLogJsonl
    .split("\n")
    .filter((line) => line.trim().length > 0).length;

  return `${project.packageSummary.packageDisplayName} r${project.packageSummary.packageRevision} at ${project.savedAt}; ${operationCount} operations, ${project.generatedArtifactPaths.length} generated artifacts.`;
};

const formatLoadedProjectDetail = (result: LoadedProjectResult): string => {
  const baseDetail = formatSavedProjectDetail(result.storeResult.project);

  if (!("persistentByteRestore" in result)) {
    return `${baseDetail} Persistent bytes were not restored; metadata-only load may require reupload.`;
  }

  return `${baseDetail} ${formatPersistentByteRestoreDetail(result.persistentByteRestore)}`;
};

const formatPersistentByteRestoreDetail = (
  restore: LoadedProjectResult extends infer T
    ? T extends { readonly persistentByteRestore: infer R }
      ? R
      : never
    : never
): string => {
  const issueCodes = [
    ...new Set(restore.assets.flatMap((asset) =>
      asset.report.issues.map((issue) => issue.code)
    ))
  ];
  const backendStates = [
    ...new Set(restore.assets.map((asset) => asset.report.storageBackendState))
  ];
  const issuesLabel = issueCodes.length === 0 ? "issues none" : `issues ${issueCodes.join(", ")}`;
  const backendStateLabel =
    backendStates.length === 0 ? "no backend state" : `backend states ${backendStates.join(", ")}`;

  return `Persistent bytes: ${restore.restoredCount} restored / ${restore.assets.length} checked through same-origin browser-local IndexedDB; ${backendStateLabel}; ${issuesLabel}.`;
};

const formatPortableBundleExportDetail = (
  result: Extract<EditorWorkflowPersistenceResult, { readonly status: "portableExported" }>
): string =>
  `Portable JSON bundle v0 prepared as ${result.suggestedFilename}; ${result.binaryPayloadCount} binary payloads verified from current editor session bytes.`;

const formatPortableBundleImportDetail = (
  result: Extract<EditorWorkflowPersistenceResult, { readonly status: "portableImported" }>
): string => {
  const registration = result.byteRegistration;

  return `Portable JSON bundle v0 ${result.packageId} r${result.packageRevision} imported; ${registration.registeredCount}/${registration.assetCount} binary assets registered in current session; persistent bytes ${registration.persistentStoredCount}/${registration.persistentStoreAttemptCount} stored through same-origin browser-local IndexedDB, ${registration.persistentUnavailableCount} unavailable.`;
};

const formatPortableBundleFailureDetail = (
  result: Extract<
    EditorWorkflowPersistenceResult,
    { readonly status: "portableExportFailed" | "portableImportFailed" }
  >
): string => {
  const issueCodes = [...new Set(result.issues.map((issue) => issue.code))];
  const issueLabel = issueCodes.length === 0 ? "issues none" : `issues ${issueCodes.join(", ")}`;

  return `${result.code}: ${result.message} ${issueLabel}.`;
};
