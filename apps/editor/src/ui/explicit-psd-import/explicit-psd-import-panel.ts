import {
  editorTestIds,
  type ExplicitPsdImportViewModel
} from "../../editor-state/index.js";
import type { EditorExplicitPsdImportFileCommand } from "../../editor-workflow/index.js";

export interface ExplicitPsdImportPanelOptions {
  readonly viewModel: ExplicitPsdImportViewModel;
  readonly onParsePsdFile: (
    command: EditorExplicitPsdImportFileCommand
  ) => unknown | Promise<unknown>;
}

export const createExplicitPsdImportPanel = (
  options: ExplicitPsdImportPanelOptions
): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel explicit-psd-import-panel";
  panel.dataset.testid = editorTestIds.explicitPsdImportPanel;
  panel.setAttribute("aria-labelledby", "editor-explicit-psd-import-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-explicit-psd-import-heading";
  heading.textContent = "PSD Import";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = options.viewModel.metaLabel;

  panel.append(
    heading,
    meta,
    createExplicitPsdImportForm(options),
    createFactSection("Parser Session", editorTestIds.explicitPsdImportStatus, [
      { label: "Status", value: options.viewModel.statusLabel },
      { label: "Selected layer", value: options.viewModel.selectedLayerNodeRef }
    ]),
    createFactSection("Source File", editorTestIds.explicitPsdImportSource, options.viewModel.sourceFacts),
    createFactSection("Document", editorTestIds.explicitPsdImportDocument, options.viewModel.documentFacts),
    createFactSection(
      "Unsupported / Not Evaluated",
      editorTestIds.explicitPsdImportFeatureSupport,
      options.viewModel.featureFacts,
      [
        createTextList("Unsupported feature evidence", options.viewModel.unsupportedFeatureLabels),
        createTextList("Not evaluated feature evidence", options.viewModel.notEvaluatedFeatureLabels)
      ]
    ),
    createTextList(
      "Selected Layer Materialization",
      options.viewModel.materializationLabels,
      editorTestIds.explicitPsdImportMaterialization
    ),
    createLayerTree(options.viewModel),
    createFactSection(
      "Persistence Boundary",
      editorTestIds.explicitPsdImportPersistence,
      options.viewModel.persistenceFacts
    ),
    createTextList(
      "Diagnostics",
      options.viewModel.diagnostics,
      editorTestIds.explicitPsdImportDiagnostics
    )
  );

  return panel;
};

const createExplicitPsdImportForm = (
  options: ExplicitPsdImportPanelOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "explicit-psd-import-form";
  form.dataset.testid = editorTestIds.explicitPsdImportForm;
  form.setAttribute("aria-label", "Parse explicitly selected PSD in browser session");

  const fileLabel = document.createElement("label");
  fileLabel.className = "editor-field editor-field--wide";
  fileLabel.textContent = "PSD file";

  const fileInput = document.createElement("input");
  fileInput.name = "explicitPsdFile";
  fileInput.type = "file";
  fileInput.accept = ".psd,image/vnd.adobe.photoshop,application/octet-stream";
  fileInput.dataset.testid = editorTestIds.explicitPsdImportFileInput;
  fileLabel.append(fileInput);

  const selectedLayerLabel = document.createElement("label");
  selectedLayerLabel.className = "editor-field editor-field--wide";
  selectedLayerLabel.textContent = "Selected layer node ref";

  const selectedLayer = document.createElement("input");
  selectedLayer.name = "selectedLayerNodeRef";
  selectedLayer.type = "text";
  selectedLayer.value = options.viewModel.selectedLayerNodeRef;
  selectedLayer.autocomplete = "off";
  selectedLayer.dataset.testid = editorTestIds.explicitPsdImportSelectedLayerNodeRef;
  selectedLayerLabel.append(selectedLayer);

  const diagnostics = document.createElement("div");
  diagnostics.className = "explicit-psd-import-form__diagnostics";
  diagnostics.setAttribute("role", "status");

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.explicitPsdImportSubmit;
  submit.textContent = "Parse PSD";

  form.append(fileLabel, selectedLayerLabel, diagnostics, submit);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = readFirstSelectedFile(fileInput);
    if (file === undefined) {
      diagnostics.replaceChildren(createDiagnosticLine("Select a PSD file before parsing."));
      return;
    }

    diagnostics.replaceChildren();
    try {
      await options.onParsePsdFile({
        file,
        selectedLayerNodeRef: selectedLayer.value.trim()
      });
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatParseError(error)));
    }
  });

  return form;
};

const readFirstSelectedFile = (input: HTMLInputElement): File | undefined => {
  const files = input.files;
  if (files === null || files.length === 0) {
    return undefined;
  }

  return files.item(0) ?? files[0] ?? undefined;
};

const createFactSection = (
  headingText: string,
  testId: string,
  facts: readonly {
    readonly label: string;
    readonly value: string;
  }[],
  extraNodes: readonly HTMLElement[] = []
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  section.dataset.testid = testId;
  section.setAttribute("aria-label", headingText);

  const heading = document.createElement("h3");
  heading.textContent = headingText;

  const list = document.createElement("dl");
  list.className = "source-intake-summary";
  for (const fact of facts) {
    appendFact(list, fact.label, fact.value);
  }

  section.append(heading, list, ...extraNodes);
  return section;
};

const createLayerTree = (
  viewModel: ExplicitPsdImportViewModel
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  section.dataset.testid = editorTestIds.explicitPsdImportLayerTree;
  section.setAttribute("aria-label", "Parsed PSD layer tree");

  const heading = document.createElement("h3");
  heading.textContent = "Layer Tree";
  section.append(heading);

  if (viewModel.treeRows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "explicit-psd-import-empty";
    empty.textContent = "No parsed PSD layer tree";
    section.append(empty);
    return section;
  }

  const list = document.createElement("ol");
  list.className = "explicit-psd-import-tree";
  for (const row of viewModel.treeRows) {
    const item = document.createElement("li");
    item.className = "explicit-psd-import-tree__row";
    item.style.paddingLeft = `${Math.max(0, row.depth - 1) * 14}px`;

    const label = document.createElement("span");
    label.className = "explicit-psd-import-tree__label";
    label.textContent = row.label;

    const meta = document.createElement("span");
    meta.className = "explicit-psd-import-tree__meta";
    meta.textContent = row.metaLabel;

    item.append(label, meta);
    list.append(item);
  }

  section.append(list);
  return section;
};

const createTextList = (
  headingText: string,
  items: readonly string[],
  testId?: string
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "explicit-psd-import-section";
  if (testId !== undefined) {
    section.dataset.testid = testId;
  }
  section.setAttribute("aria-label", headingText);

  const heading = document.createElement("h3");
  heading.textContent = headingText;

  const list = document.createElement("ul");
  list.className = "explicit-psd-import-list";
  for (const itemText of items) {
    const item = document.createElement("li");
    item.textContent = itemText;
    item.style.overflowWrap = "anywhere";
    list.append(item);
  }

  section.append(heading, list);
  return section;
};

const appendFact = (
  list: HTMLDListElement,
  label: string,
  value: string
): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;
  description.style.overflowWrap = "anywhere";

  list.append(term, description);
};

const createDiagnosticLine = (message: string): HTMLElement => {
  const line = document.createElement("p");
  line.textContent = message;
  line.style.overflowWrap = "anywhere";

  return line;
};

const formatParseError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Explicit PSD parse failed before workflow state update: ${message}`;
};
