import {
  confirmSourceIntakeDraft,
  createDefaultSourceIntakeLayerDraft,
  createSourceIntakeLayerRowTestId,
  editorTestIds,
  sourceIntakeLayerRoles,
  sourceIntakePlacementPolicies,
  sourceIntakeRightsStatuses,
  type SourceIntakeDraftInput,
  type SourceIntakeDraftState,
  type SourceIntakeDraftViewModel,
  type SourceIntakeLayerDraftState,
  type SourceIntakeLayerRole,
  type SourceIntakePlacementPolicy,
  type SourceIntakeRightsStatus
} from "../../editor-state/index.js";

export interface SourceIntakeFormOptions {
  readonly draft: SourceIntakeDraftState;
  readonly viewModel: SourceIntakeDraftViewModel;
  readonly onConfirmDraft: (draft: SourceIntakeDraftState) => void;
}

export const createSourceIntakeForm = (
  options: SourceIntakeFormOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "source-intake-form";
  form.dataset.testid = editorTestIds.sourceIntakeForm;
  form.setAttribute("aria-label", "Confirm split PNG source intake draft");

  const diagnostics = document.createElement("div");
  diagnostics.className = "source-intake-form__diagnostics";
  diagnostics.dataset.testid = editorTestIds.sourceIntakeDiagnostics;
  diagnostics.setAttribute("role", "status");

  const layerRows = document.createElement("div");
  layerRows.className = "source-intake-form__layer-rows";
  layerRows.dataset.testid = editorTestIds.sourceIntakeLayerRows;
  layerRows.setAttribute("aria-label", "Split PNG source layer rows");

  let nextLayerIndex = options.draft.layers.length;
  options.draft.layers.forEach((layer, index) => {
    layerRows.append(createLayerDraftRow(layer, index));
  });

  const addLayer = document.createElement("button");
  addLayer.type = "button";
  addLayer.className = "editor-button source-intake-form__secondary-action";
  addLayer.dataset.testid = editorTestIds.sourceIntakeAddLayer;
  addLayer.textContent = "Add layer row";
  addLayer.addEventListener("click", () => {
    layerRows.append(createLayerDraftRow(createDefaultSourceIntakeLayerDraft(nextLayerIndex), nextLayerIndex));
    nextLayerIndex += 1;
  });

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.sourceIntakeSubmit;
  submit.textContent = "Confirm source draft";

  form.append(
    createTextField({
      label: "Split PNG manifest path",
      name: "manifestPath",
      value: options.draft.manifestPath,
      required: true,
      wide: true,
      testId: editorTestIds.sourceIntakeManifestPath
    }),
    createTextField({
      label: "Source asset ID",
      name: "sourceAssetId",
      value: options.draft.sourceAssetId,
      required: true
    }),
    createTextField({
      label: "Content hash",
      name: "contentHash",
      value: options.draft.contentHash
    }),
    createTextField({
      label: "Default part ID",
      name: "defaultPartId",
      value: options.draft.defaultPartId
    }),
    createSelectField({
      label: "Placement policy",
      name: "placementPolicy",
      value: options.draft.placementPolicy,
      options: sourceIntakePlacementPolicies.map((policy) => ({
        value: policy,
        label: formatPlacementPolicy(policy)
      })),
      wide: true,
      testId: editorTestIds.sourceIntakePlacementPolicy
    }),
    createSelectField({
      label: "Rights status",
      name: "rightsStatus",
      value: options.draft.rights.rightsStatus,
      options: sourceIntakeRightsStatuses.map((status) => ({
        value: status,
        label: formatRightsStatus(status)
      })),
      testId: editorTestIds.sourceIntakeRightsStatus
    }),
    createTextField({
      label: "Creator",
      name: "creator",
      value: options.draft.rights.creator,
      required: true
    }),
    createTextField({
      label: "License",
      name: "license",
      value: options.draft.rights.license,
      required: true
    }),
    createTextField({
      label: "Source URL",
      name: "sourceUrl",
      value: options.draft.rights.sourceUrl,
      wide: true
    }),
    createCheckboxField({
      label: "Redistribution allowed",
      name: "redistributionAllowed",
      checked: options.draft.rights.redistributionAllowed
    }),
    createCheckboxField({
      label: "AI used",
      name: "aiUsed",
      checked: options.draft.rights.aiUsed
    }),
    createTextField({
      label: "Rights notes",
      name: "notes",
      value: options.draft.rights.notes,
      wide: true
    }),
    layerRows,
    addLayer,
    diagnostics,
    submit
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const draft = confirmSourceIntakeDraft(readSourceIntakeDraftInput(form, options.draft));

    if (draft.diagnostics.length > 0) {
      diagnostics.replaceChildren(...draft.diagnostics.map(createDiagnosticLine));
      return;
    }

    diagnostics.replaceChildren();
    options.onConfirmDraft(draft);
  });

  return form;
};

interface TextFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly required?: boolean;
  readonly wide?: boolean;
  readonly testId?: string;
}

interface CheckboxFieldOptions {
  readonly label: string;
  readonly name: string;
  readonly checked: boolean;
}

interface SelectFieldOptions<TValue extends string> {
  readonly label: string;
  readonly name: string;
  readonly value: TValue;
  readonly options: readonly {
    readonly value: TValue;
    readonly label: string;
  }[];
  readonly wide?: boolean;
  readonly testId?: string;
}

const createTextField = (options: TextFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = options.wide === true ? "editor-field editor-field--wide" : "editor-field";
  label.textContent = options.label;

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "text";
  input.value = options.value;
  input.required = options.required ?? false;
  input.autocomplete = "off";
  if (options.testId !== undefined) {
    input.dataset.testid = options.testId;
  }

  label.append(input);
  return label;
};

const createNumberField = (
  labelText: string,
  name: string,
  value: number,
  min?: string,
  max?: string
): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "editor-field";
  label.textContent = labelText;

  const input = document.createElement("input");
  input.name = name;
  input.type = "number";
  input.value = String(value);
  input.step = "any";
  if (min !== undefined) {
    input.min = min;
  }
  if (max !== undefined) {
    input.max = max;
  }

  label.append(input);
  return label;
};

const createCheckboxField = (options: CheckboxFieldOptions): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = "source-intake-form__checkbox";

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "checkbox";
  input.value = "true";
  input.checked = options.checked;

  const text = document.createElement("span");
  text.textContent = options.label;

  label.append(input, text);
  return label;
};

const createSelectField = <TValue extends string>(
  options: SelectFieldOptions<TValue>
): HTMLLabelElement => {
  const label = document.createElement("label");
  label.className = options.wide === true ? "editor-field editor-field--wide" : "editor-field";
  label.textContent = options.label;

  const select = document.createElement("select");
  select.name = options.name;
  select.value = options.value;
  if (options.testId !== undefined) {
    select.dataset.testid = options.testId;
  }

  for (const option of options.options) {
    const item = document.createElement("option");
    item.value = option.value;
    item.textContent = option.label;
    select.append(item);
  }

  label.append(select);
  return label;
};

const createLayerDraftRow = (
  layer: SourceIntakeLayerDraftState,
  index: number
): HTMLElement => {
  const row = document.createElement("section");
  row.className = "source-intake-layer-row";
  row.dataset.testid = createSourceIntakeLayerRowTestId(layer.sourceLayerId || `draft_${index + 1}`);
  row.setAttribute("aria-label", `Source layer row ${index + 1}`);

  const heading = document.createElement("h3");
  heading.textContent = `Layer ${index + 1}`;

  const indexField = document.createElement("input");
  indexField.type = "hidden";
  indexField.name = "layerIndex";
  indexField.value = String(index);

  row.append(
    heading,
    indexField,
    createTextField({
      label: "Layer ID",
      name: layerFieldName("sourceLayerId", index),
      value: layer.sourceLayerId,
      required: true
    }),
    createTextField({
      label: "Original name",
      name: layerFieldName("originalName", index),
      value: layer.originalName,
      required: true
    }),
    createTextField({
      label: "Normalized name",
      name: layerFieldName("normalizedName", index),
      value: layer.normalizedName,
      required: true
    }),
    createTextField({
      label: "Group path",
      name: layerFieldName("groupPath", index),
      value: layer.groupPath.join("/")
    }),
    createNumberField("X", layerFieldName("x", index), layer.bounds.x),
    createNumberField("Y", layerFieldName("y", index), layer.bounds.y),
    createNumberField("Width", layerFieldName("width", index), layer.bounds.width, "0.000001"),
    createNumberField("Height", layerFieldName("height", index), layer.bounds.height, "0.000001"),
    createNumberField("Opacity", layerFieldName("opacityInSource", index), layer.opacityInSource, "0", "1"),
    createSelectField({
      label: "Layer role",
      name: layerFieldName("role", index),
      value: layer.role,
      options: sourceIntakeLayerRoles.map((role) => ({ value: role, label: role }))
    }),
    createCheckboxField({
      label: "Visible in source",
      name: layerFieldName("visibleInSource", index),
      checked: layer.visibleInSource
    }),
    createTextField({
      label: "Unsupported features",
      name: layerFieldName("unsupportedFeatures", index),
      value: layer.unsupportedFeatures.join(", "),
      wide: true
    })
  );

  return row;
};

const readSourceIntakeDraftInput = (
  form: HTMLFormElement,
  fallback: SourceIntakeDraftState
): SourceIntakeDraftInput => {
  const fields = new FormData(form);

  return {
    sourceAssetId: readText(fields, "sourceAssetId", fallback.sourceAssetId),
    manifestPath: readText(fields, "manifestPath", fallback.manifestPath),
    contentHash: readText(fields, "contentHash", fallback.contentHash),
    defaultPartId: readText(fields, "defaultPartId", fallback.defaultPartId),
    placementPolicy: readPlacementPolicy(fields, fallback.placementPolicy),
    layers: readLayerDrafts(fields, fallback.layers),
    rights: {
      rightsStatus: readRightsStatus(fields, fallback.rights.rightsStatus),
      creator: readText(fields, "creator", fallback.rights.creator),
      license: readText(fields, "license", fallback.rights.license),
      redistributionAllowed: fields.get("redistributionAllowed") === "true",
      aiUsed: fields.get("aiUsed") === "true",
      sourceUrl: readText(fields, "sourceUrl", fallback.rights.sourceUrl),
      notes: readText(fields, "notes", fallback.rights.notes)
    }
  };
};

const readLayerDrafts = (
  fields: FormData,
  fallbackLayers: readonly SourceIntakeLayerDraftState[]
): readonly SourceIntakeLayerDraftState[] => {
  const indexes = fields
    .getAll("layerIndex")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0);

  return indexes.map((index) => {
    const fallback = fallbackLayers[index] ?? createDefaultSourceIntakeLayerDraft(index);

    return {
      sourceLayerId: readText(fields, layerFieldName("sourceLayerId", index), fallback.sourceLayerId),
      originalName: readText(fields, layerFieldName("originalName", index), fallback.originalName),
      normalizedName: readText(fields, layerFieldName("normalizedName", index), fallback.normalizedName),
      groupPath: splitList(readText(fields, layerFieldName("groupPath", index), fallback.groupPath.join("/")), "/"),
      bounds: {
        x: readNumber(fields, layerFieldName("x", index), fallback.bounds.x),
        y: readNumber(fields, layerFieldName("y", index), fallback.bounds.y),
        width: readNumber(fields, layerFieldName("width", index), fallback.bounds.width),
        height: readNumber(fields, layerFieldName("height", index), fallback.bounds.height)
      },
      visibleInSource: fields.get(layerFieldName("visibleInSource", index)) === "true",
      opacityInSource: readNumber(fields, layerFieldName("opacityInSource", index), fallback.opacityInSource),
      role: readLayerRole(fields, layerFieldName("role", index), fallback.role),
      unsupportedFeatures: splitList(
        readText(
          fields,
          layerFieldName("unsupportedFeatures", index),
          fallback.unsupportedFeatures.join(", ")
        ),
        ","
      )
    };
  });
};

const readText = (fields: FormData, name: string, fallback: string): string => {
  const value = fields.get(name);

  return value === null ? fallback : String(value);
};

const readNumber = (fields: FormData, name: string, fallback: number): number => {
  const value = fields.get(name);
  if (value === null) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const splitList = (text: string, separator: "/" | ","): readonly string[] =>
  text
    .split(separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const readPlacementPolicy = (
  fields: FormData,
  fallback: SourceIntakePlacementPolicy
): SourceIntakePlacementPolicy => {
  const value = String(fields.get("placementPolicy") ?? fallback);

  return sourceIntakePlacementPolicies.includes(value as SourceIntakePlacementPolicy)
    ? (value as SourceIntakePlacementPolicy)
    : fallback;
};

const readRightsStatus = (
  fields: FormData,
  fallback: SourceIntakeRightsStatus
): SourceIntakeRightsStatus => {
  const value = String(fields.get("rightsStatus") ?? fallback);

  return sourceIntakeRightsStatuses.includes(value as SourceIntakeRightsStatus)
    ? (value as SourceIntakeRightsStatus)
    : fallback;
};

const readLayerRole = (
  fields: FormData,
  name: string,
  fallback: SourceIntakeLayerRole
): SourceIntakeLayerRole => {
  const value = String(fields.get(name) ?? fallback);

  return sourceIntakeLayerRoles.includes(value as SourceIntakeLayerRole)
    ? (value as SourceIntakeLayerRole)
    : fallback;
};

const layerFieldName = (
  field:
    | "sourceLayerId"
    | "originalName"
    | "normalizedName"
    | "groupPath"
    | "x"
    | "y"
    | "width"
    | "height"
    | "opacityInSource"
    | "role"
    | "visibleInSource"
    | "unsupportedFeatures",
  index: number
): string => `${field}.${index}`;

const createDiagnosticLine = (diagnostic: string): HTMLElement => {
  const line = document.createElement("p");
  line.textContent = diagnostic;

  return line;
};

const formatPlacementPolicy = (policy: SourceIntakePlacementPolicy): string => {
  switch (policy) {
    case "use-metadata":
      return "Use manifest metadata";
    case "origin-with-warning":
      return "Place at origin with warning";
  }
};

const formatRightsStatus = (status: SourceIntakeRightsStatus): string => {
  switch (status) {
    case "cleared":
      return "Cleared";
    case "needs_review":
      return "Needs review";
    case "blocked":
      return "Blocked";
  }
};
