import { editorTestIds, type EditorSemanticState, type EditorWorkflowViewModel } from "../../editor-state/index.js";

export const createPackageStatus = (
  state: EditorSemanticState,
  viewModel: EditorWorkflowViewModel
): HTMLElement => {
  const container = document.createElement("div");
  container.className = "editor-package-status";
  container.dataset.testid = editorTestIds.packageStatus;

  const packageName = document.createElement("p");
  packageName.className = "editor-package-status__name";
  packageName.textContent = viewModel.packageTitle;

  const packageMeta = document.createElement("p");
  packageMeta.className = "editor-package-status__meta";
  packageMeta.dataset.testid = editorTestIds.packageRevision;
  packageMeta.textContent =
    state.loadedPackage === null
      ? "No package loaded"
      : `${state.loadedPackage.packageId} | ${viewModel.packageRevisionLabel}`;

  container.append(packageName, packageMeta);

  return container;
};
