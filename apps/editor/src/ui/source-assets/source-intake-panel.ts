import {
  createImportedSourceAssetRowTestId,
  editorTestIds,
  type SourceIntakeDraftState,
  type ImportedSourceAssetViewModel,
  type SourceIntakeDraftViewModel
} from "../../editor-state/index.js";
import { createSourceIntakeForm } from "./source-intake-form.js";

export interface SourceIntakePanelOptions {
  readonly draft: SourceIntakeDraftState;
  readonly viewModel: SourceIntakeDraftViewModel;
  readonly onConfirmDraft: (draft: SourceIntakeDraftState) => void;
}

export const createSourceIntakePanel = (options: SourceIntakePanelOptions): HTMLElement => {
  const panel = document.createElement("section");
  panel.className = "editor-panel source-intake-panel";
  panel.dataset.testid = editorTestIds.sourceIntakePanel;
  panel.setAttribute("aria-labelledby", "editor-source-intake-heading");

  const heading = document.createElement("h2");
  heading.id = "editor-source-intake-heading";
  heading.textContent = "Source Intake";

  const meta = document.createElement("p");
  meta.className = "editor-panel__meta";
  meta.textContent = `${options.viewModel.sourceModeLabel} / ${options.viewModel.layerCountLabel}`;

  panel.append(
    heading,
    meta,
    createSourceIntakeSummary(options.viewModel),
    createImportedSourceAssetList(options.viewModel),
    createSourceIntakeForm({
      draft: options.draft,
      viewModel: options.viewModel,
      onConfirmDraft: options.onConfirmDraft
    })
  );

  return panel;
};

const createSourceIntakeSummary = (
  viewModel: SourceIntakeDraftViewModel
): HTMLElement => {
  const summary = document.createElement("dl");
  summary.className = "source-intake-summary";
  summary.dataset.testid = editorTestIds.sourceIntakeSummary;

  appendFact(summary, "Status", viewModel.statusLabel);
  appendFact(summary, "Mode", viewModel.sourceModeLabel);
  appendFact(summary, "Reference", viewModel.sourceReferenceLabel);
  appendFact(summary, "Source asset", viewModel.sourceAssetLabel);
  appendFact(summary, "Profile", viewModel.importProfileLabel);
  appendFact(summary, "Adapter", viewModel.psdAdapterNameLabel);
  appendFact(summary, "Canvas", viewModel.psdCanvasLabel);
  appendFact(summary, "Placement", viewModel.placementPolicyLabel);
  appendFact(summary, "Rights", viewModel.rightsSummaryLabel);
  appendFact(summary, "Provenance", viewModel.provenanceSummaryLabel);
  appendFact(summary, "Layers", viewModel.layerCountLabel);
  appendFact(summary, "Default part", viewModel.defaultPartLabel);

  return summary;
};

const createImportedSourceAssetList = (
  viewModel: SourceIntakeDraftViewModel
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "source-intake-imported";
  section.dataset.testid = editorTestIds.sourceIntakeImportedSources;
  section.setAttribute("aria-label", "Imported source assets");

  const heading = document.createElement("h3");
  heading.textContent = "Imported Sources";

  const meta = document.createElement("p");
  meta.className = "source-intake-imported__meta";
  meta.textContent = viewModel.importedAssetCountLabel;

  section.append(heading, meta);

  if (viewModel.importedAssets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "source-intake-imported__empty";
    empty.textContent = "No imported source assets";
    section.append(empty);
    return section;
  }

  const list = document.createElement("div");
  list.className = "source-intake-imported__list";
  for (const sourceAsset of viewModel.importedAssets) {
    list.append(createImportedSourceAssetRow(sourceAsset));
  }
  section.append(list);

  return section;
};

const createImportedSourceAssetRow = (
  sourceAsset: ImportedSourceAssetViewModel
): HTMLElement => {
  const article = document.createElement("article");
  article.className = "source-intake-imported-source";
  article.dataset.testid = createImportedSourceAssetRowTestId(sourceAsset.sourceAssetId);

  const heading = document.createElement("h4");
  heading.textContent = sourceAsset.assetLabel;

  const meta = document.createElement("p");
  meta.className = "source-intake-imported-source__meta";
  meta.textContent = `${sourceAsset.importProfileLabel} / ${sourceAsset.layerCountLabel}`;

  const path = document.createElement("p");
  path.className = "source-intake-imported-source__path";
  path.textContent = sourceAsset.filePathLabel;

  const profileEvidence = document.createElement("p");
  profileEvidence.className = "source-intake-imported-source__diagnostics";
  profileEvidence.textContent = sourceAsset.profileEvidenceLabel;
  applyLongTextWrap(profileEvidence);

  const diagnostics = document.createElement("p");
  diagnostics.className = "source-intake-imported-source__diagnostics";
  diagnostics.textContent = sourceAsset.diagnosticsLabel;
  applyLongTextWrap(diagnostics);

  const layers = document.createElement("ul");
  layers.className = "source-intake-imported-source__layers";
  for (const layer of sourceAsset.layers) {
    const item = document.createElement("li");
    item.textContent = [
      layer.layerLabel,
      layer.groupPathLabel,
      layer.boundsLabel,
      layer.visibilityLabel,
      layer.opacityLabel,
      layer.roleLabel,
      layer.unsupportedFeaturesLabel,
      layer.textureMappingLabel,
      ...(layer.textureBinaryAssetLabel === undefined ? [] : [layer.textureBinaryAssetLabel]),
      layer.blendModeLabel,
      layer.mappedDrawableCountLabel
    ].join(" / ");
    applyLongTextWrap(item);
    layers.append(item);
  }

  const psdProfileSummary =
    sourceAsset.psdProfile === undefined ? [] : [createPsdProfileSummary(sourceAsset)];
  const binaryAssetSummary =
    sourceAsset.binaryAssetLabels.length === 0
      ? []
      : [createProfileList(
          `Binary asset references for ${sourceAsset.sourceAssetId}`,
          sourceAsset.binaryAssetLabels
        )];

  article.append(
    heading,
    meta,
    path,
    profileEvidence,
    diagnostics,
    ...binaryAssetSummary,
    ...psdProfileSummary,
    layers
  );
  return article;
};

const createPsdProfileSummary = (
  sourceAsset: ImportedSourceAssetViewModel
): HTMLElement => {
  const profile = sourceAsset.psdProfile;
  const section = document.createElement("section");
  section.className = "source-intake-imported-source__diagnostics";
  section.setAttribute("aria-label", `Structured PSD profile metadata for ${sourceAsset.sourceAssetId}`);

  if (profile === undefined) {
    return section;
  }

  const facts = document.createElement("dl");
  facts.className = "source-intake-summary";
  appendFact(facts, "Adapter evidence", profile.adapterLabel);
  appendFact(facts, "Canvas", profile.canvasLabel);
  appendFact(facts, "Groups", profile.sourceGroupCountLabel);
  appendFact(facts, "Structured layers", profile.structuredLayerCountLabel);
  appendFact(facts, "Unsupported features", profile.unsupportedFeatureCountLabel);
  appendFact(facts, "Adapter diagnostics", profile.adapterDiagnosticCountLabel);
  appendFact(facts, "Compatibility", profile.compatibilityLabel);

  section.append(
    facts,
    createProfileList("Source groups", profile.groupLabels),
    createProfileList("Unsupported feature evidence", profile.unsupportedFeatureLabels),
    createProfileList("Adapter diagnostics", profile.adapterDiagnosticLabels)
  );
  return section;
};

const createProfileList = (
  label: string,
  items: readonly string[]
): HTMLElement => {
  const section = document.createElement("section");
  section.className = "source-intake-imported-source__diagnostics";
  section.setAttribute("aria-label", label);

  const heading = document.createElement("h5");
  heading.textContent = label;

  const list = document.createElement("ul");
  list.className = "source-intake-imported-source__layers";
  for (const itemText of items) {
    const item = document.createElement("li");
    item.textContent = itemText;
    applyLongTextWrap(item);
    list.append(item);
  }

  section.append(heading, list);
  return section;
};

const appendFact = (list: HTMLDListElement, label: string, value: string): void => {
  const term = document.createElement("dt");
  term.textContent = label;

  const description = document.createElement("dd");
  description.textContent = value;
  applyLongTextWrap(description);

  list.append(term, description);
};

const applyLongTextWrap = (element: HTMLElement): void => {
  element.style.overflowWrap = "anywhere";
};
