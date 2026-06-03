import {
  confirmSourceIntakeDraft,
  createDefaultSourceIntakeLayerDraft,
  createSourceIntakeSelectedFileDraft,
  createSourceIntakeLayerRowTestId,
  editorTestIds,
  sourceIntakeLayerRoles,
  sourceIntakeModes,
  sourceIntakePlacementPolicies,
  sourceIntakeRightsStatuses,
  type SourceIntakeDraftInput,
  type SourceIntakeDraftState,
  type SourceIntakeDraftViewModel,
  type SourceIntakeLayerDraftState,
  type SourceIntakeLayerRole,
  type SourceIntakeMode,
  type SourceIntakePlacementPolicy,
  type SourceIntakeRightsDraftState,
  type SourceIntakeRightsStatus,
  type SourceIntakeSelectedFileBytes,
  type SourceIntakeSelectedFileDraftState
} from "../../editor-state/index.js";

export interface SourceIntakeFormOptions {
  readonly draft: SourceIntakeDraftState;
  readonly viewModel: SourceIntakeDraftViewModel;
  readonly onConfirmDraft: (
    draft: SourceIntakeDraftState,
    selectedFileBytes?: SourceIntakeSelectedFileBytes
  ) => unknown | Promise<unknown>;
}

export const createSourceIntakeForm = (
  options: SourceIntakeFormOptions
): HTMLFormElement => {
  const form = document.createElement("form");
  form.className = "source-intake-form";
  form.dataset.testid = editorTestIds.sourceIntakeForm;
  form.setAttribute("aria-label", "Confirm source intake adapter profile draft");

  const diagnostics = document.createElement("div");
  diagnostics.className = "source-intake-form__diagnostics";
  diagnostics.dataset.testid = editorTestIds.sourceIntakeDiagnostics;
  diagnostics.setAttribute("role", "status");

  const layerRows = document.createElement("div");
  layerRows.className = "source-intake-form__layer-rows";
  layerRows.dataset.testid = editorTestIds.sourceIntakeLayerRows;
  layerRows.setAttribute("aria-label", "Source intake layer rows");

  let selectedFileDraft = options.draft.selectedFile;
  let selectedBrowserFile: File | null = null;
  const selectedFileSummary = document.createElement("div");
  selectedFileSummary.className = "source-intake-form__file-summary";
  selectedFileSummary.dataset.testid = editorTestIds.sourceIntakeSelectedFile;
  selectedFileSummary.setAttribute("role", "status");
  updateSelectedFileDraftSummary(
    selectedFileSummary,
    selectedFileDraft,
    options.draft.rights
  );
  const fileInputControl = createFileInputControl({
    label: "Source file draft",
    name: "sourceFileDraft",
    testId: editorTestIds.sourceIntakeFileInput
  });
  fileInputControl.input.addEventListener("change", () => {
    const selectedFile = readFirstSelectedFile(fileInputControl.input);
    selectedBrowserFile = selectedFile ?? null;
    selectedFileDraft =
      selectedFile === undefined
        ? null
        : createSourceIntakeSelectedFileDraft({
            name: selectedFile.name,
            size: selectedFile.size,
            type: selectedFile.type
          });
    updateSelectedFileDraftSummary(
      selectedFileSummary,
      selectedFileDraft,
      readRightsDraftFromForm(form, options.draft.rights)
    );
  });

  const requiredSyncCallbacks: Array<() => void> = [];
  const intakeModeControl = createSelectFieldControl({
    label: "Source intake mode",
    name: "intakeMode",
    value: options.draft.intakeMode,
    options: sourceIntakeModes.map((mode) => ({
      value: mode,
      label: formatSourceIntakeMode(mode)
    })),
    wide: true
  });
  const getCurrentIntakeMode = (): SourceIntakeMode =>
    sourceIntakeModes.includes(intakeModeControl.select.value as SourceIntakeMode)
      ? (intakeModeControl.select.value as SourceIntakeMode)
      : options.draft.intakeMode;
  intakeModeControl.select.addEventListener("change", () => {
    requiredSyncCallbacks.forEach((sync) => sync());
  });
  let nextLayerIndex = options.draft.layers.length;
  options.draft.layers.forEach((layer, index) => {
    layerRows.append(
      createLayerDraftRow(layer, index, {
        ...(options.viewModel.layerRows[index] === undefined
          ? {}
          : { viewModel: options.viewModel.layerRows[index] }),
        getIntakeMode: getCurrentIntakeMode,
        onRequiredSync(sync) {
          requiredSyncCallbacks.push(sync);
        }
      })
    );
  });

  const addLayer = document.createElement("button");
  addLayer.type = "button";
  addLayer.className = "editor-button source-intake-form__secondary-action";
  addLayer.dataset.testid = editorTestIds.sourceIntakeAddLayer;
  addLayer.textContent = "Add layer row";
  addLayer.addEventListener("click", () => {
    layerRows.append(
      createLayerDraftRow(
        createDefaultSourceIntakeLayerDraft(nextLayerIndex, {
          defaultPartId: options.draft.defaultPartId
        }),
        nextLayerIndex,
        {
          getIntakeMode: getCurrentIntakeMode,
          onRequiredSync(sync) {
            requiredSyncCallbacks.push(sync);
          }
        }
      )
    );
    nextLayerIndex += 1;
  });

  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "editor-button editor-button--primary";
  submit.dataset.testid = editorTestIds.sourceIntakeSubmit;
  submit.textContent = "Confirm source draft";
  const placementPolicyControl = createSelectFieldControl({
    label: "Placement policy",
    name: "placementPolicy",
    value: options.draft.placementPolicy,
    options: sourceIntakePlacementPolicies.map((policy) => ({
      value: policy,
      label: formatPlacementPolicy(policy)
    })),
    wide: true,
    testId: editorTestIds.sourceIntakePlacementPolicy
  });
  const rightsStatusControl = createSelectFieldControl({
    label: "Rights status",
    name: "rightsStatus",
    value: options.draft.rights.rightsStatus,
    options: sourceIntakeRightsStatuses.map((status) => ({
      value: status,
      label: formatRightsStatus(status)
    })),
    testId: editorTestIds.sourceIntakeRightsStatus
  });
  const creatorControl = createTextFieldControl({
    label: "Creator",
    name: "creator",
    value: options.draft.rights.creator,
    required: true
  });
  const licenseControl = createTextFieldControl({
    label: "License",
    name: "license",
    value: options.draft.rights.license,
    required: true
  });
  const sourceUrlControl = createTextFieldControl({
    label: "Source URL",
    name: "sourceUrl",
    value: options.draft.rights.sourceUrl,
    wide: true
  });
  const redistributionAllowedControl = createCheckboxFieldControl({
    label: "Redistribution allowed",
    name: "redistributionAllowed",
    checked: options.draft.rights.redistributionAllowed
  });
  const aiUsedControl = createCheckboxFieldControl({
    label: "AI used",
    name: "aiUsed",
    checked: options.draft.rights.aiUsed
  });
  const notesControl = createTextFieldControl({
    label: "Rights notes",
    name: "notes",
    value: options.draft.rights.notes,
    wide: true
  });
  const refreshSelectedFileRightsSummary = (): void => {
    updateSelectedFileDraftSummary(
      selectedFileSummary,
      selectedFileDraft,
      readRightsDraftFromForm(form, options.draft.rights)
    );
  };
  rightsStatusControl.select.addEventListener("change", refreshSelectedFileRightsSummary);
  for (const input of [
    creatorControl.input,
    licenseControl.input,
    sourceUrlControl.input,
    notesControl.input
  ]) {
    input.addEventListener("input", refreshSelectedFileRightsSummary);
    input.addEventListener("change", refreshSelectedFileRightsSummary);
  }
  redistributionAllowedControl.input.addEventListener("change", refreshSelectedFileRightsSummary);
  aiUsedControl.input.addEventListener("change", refreshSelectedFileRightsSummary);

  form.append(
    intakeModeControl.label,
    fileInputControl.label,
    selectedFileSummary,
    createTextField({
      label: "Split PNG manifest path / PSD source reference",
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
      label: "PSD adapter/profile name",
      name: "psdAdapterName",
      value: options.draft.psdProfile.adapterName
    }),
    createNumberField(
      "PSD canvas width",
      "psdCanvasWidth",
      options.draft.psdProfile.canvasWidth,
      "0.000001"
    ),
    createNumberField(
      "PSD canvas height",
      "psdCanvasHeight",
      options.draft.psdProfile.canvasHeight,
      "0.000001"
    ),
    createTextField({
      label: "Default part ID",
      name: "defaultPartId",
      value: options.draft.defaultPartId
    }),
    placementPolicyControl.label,
    rightsStatusControl.label,
    creatorControl.label,
    licenseControl.label,
    sourceUrlControl.label,
    redistributionAllowedControl.label,
    aiUsedControl.label,
    notesControl.label,
    layerRows,
    addLayer,
    diagnostics,
    submit
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const draft = confirmSourceIntakeDraft(
      readSourceIntakeDraftInput(form, options.draft, selectedFileDraft)
    );

    if (draft.diagnostics.length > 0) {
      diagnostics.replaceChildren(...draft.diagnostics.map(createDiagnosticLine));
      return;
    }

    diagnostics.replaceChildren();
    try {
      const selectedFileBytes = readSelectedBrowserFileBytes(selectedBrowserFile, draft.selectedFile);

      if (selectedFileBytes === undefined) {
        await options.onConfirmDraft(draft);
        return;
      }

      await options.onConfirmDraft(draft, await selectedFileBytes);
    } catch (error) {
      diagnostics.replaceChildren(createDiagnosticLine(formatSelectedFileReadError(error)));
    }
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

interface TextFieldControl {
  readonly label: HTMLLabelElement;
  readonly input: HTMLInputElement;
}

interface FileInputControl {
  readonly label: HTMLLabelElement;
  readonly input: HTMLInputElement;
}

interface CheckboxFieldControl {
  readonly label: HTMLLabelElement;
  readonly input: HTMLInputElement;
}

interface SelectFieldControl<TValue extends string> {
  readonly label: HTMLLabelElement;
  readonly select: HTMLSelectElement;
}

const createTextField = (options: TextFieldOptions): HTMLLabelElement => {
  return createTextFieldControl(options).label;
};

const createTextFieldControl = (options: TextFieldOptions): TextFieldControl => {
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
  return { label, input };
};

const createFileInputControl = (options: {
  readonly label: string;
  readonly name: string;
  readonly testId?: string;
}): FileInputControl => {
  const label = document.createElement("label");
  label.className = "editor-field editor-field--wide";
  label.textContent = options.label;

  const input = document.createElement("input");
  input.name = options.name;
  input.type = "file";
  if (options.testId !== undefined) {
    input.dataset.testid = options.testId;
  }

  label.append(input);
  return { label, input };
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
  return createCheckboxFieldControl(options).label;
};

const createCheckboxFieldControl = (
  options: CheckboxFieldOptions
): CheckboxFieldControl => {
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
  return { label, input };
};

const createSelectField = <TValue extends string>(
  options: SelectFieldOptions<TValue>
): HTMLLabelElement => {
  return createSelectFieldControl(options).label;
};

const createSelectFieldControl = <TValue extends string>(
  options: SelectFieldOptions<TValue>
): SelectFieldControl<TValue> => {
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
  return { label, select };
};

const createLayerDraftRow = (
  layer: SourceIntakeLayerDraftState,
  index: number,
  options: {
    readonly viewModel?: SourceIntakeDraftViewModel["layerRows"][number];
    readonly getIntakeMode: () => SourceIntakeMode;
    readonly onRequiredSync?: (sync: () => void) => void;
  }
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

  const mappingSummary = document.createElement("p");
  mappingSummary.className = "source-intake-layer-row__mapping-summary";
  mappingSummary.textContent =
    options.viewModel === undefined
      ? createLayerMappingSummaryLabel(layer)
      : options.viewModel.textureMappingStatusLabel;
  const initialTextureMappingRequired = requiresLayerTextureMapping(options.getIntakeMode(), layer.role);
  const texturePreviewReferenceField = createTextFieldControl({
    label: "Texture preview reference",
    name: layerFieldName("texturePreviewReference", index),
    value: layer.texturePreviewReference ?? "",
    required: initialTextureMappingRequired,
    wide: true
  });
  const textureIdField = createTextFieldControl({
    label: "Texture ID",
    name: layerFieldName("textureId", index),
    value: layer.textureId ?? "",
    required: initialTextureMappingRequired
  });
  const roleField = createSelectFieldControl({
    label: "Layer role",
    name: layerFieldName("role", index),
    value: layer.role,
    options: sourceIntakeLayerRoles.map((role) => ({ value: role, label: role }))
  });
  const syncNativeRequired = (): void => {
    const required = requiresLayerTextureMapping(
      options.getIntakeMode(),
      readLayerRoleValue(roleField.select.value, layer.role)
    );
    texturePreviewReferenceField.input.required = required;
    textureIdField.input.required = required;
  };
  roleField.select.addEventListener("change", syncNativeRequired);
  options.onRequiredSync?.(syncNativeRequired);

  row.append(
    heading,
    mappingSummary,
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
    texturePreviewReferenceField.label,
    textureIdField.label,
    createTextField({
      label: "Target part ID",
      name: layerFieldName("targetPartId", index),
      value: layer.targetPartId ?? ""
    }),
    createNumberField("X", layerFieldName("x", index), layer.bounds.x),
    createNumberField("Y", layerFieldName("y", index), layer.bounds.y),
    createNumberField("Width", layerFieldName("width", index), layer.bounds.width, "0.000001"),
    createNumberField("Height", layerFieldName("height", index), layer.bounds.height, "0.000001"),
    createNumberField("Opacity", layerFieldName("opacityInSource", index), layer.opacityInSource, "0", "1"),
    roleField.label,
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

const requiresLayerTextureMapping = (
  intakeMode: SourceIntakeMode,
  role: SourceIntakeLayerRole
): boolean => intakeMode === "splitPng" || role !== "unsupported";

const readLayerRoleValue = (
  value: string,
  fallback: SourceIntakeLayerRole
): SourceIntakeLayerRole =>
  sourceIntakeLayerRoles.includes(value as SourceIntakeLayerRole)
    ? (value as SourceIntakeLayerRole)
    : fallback;

const createLayerMappingSummaryLabel = (
  layer: SourceIntakeLayerDraftState
): string => {
  const textureId = layer.textureId?.trim() ?? "";
  const targetPartId = layer.targetPartId?.trim() ?? "";

  return `${textureId.length === 0 ? "No texture ID" : textureId} / ${
    targetPartId.length === 0 ? "No target part" : targetPartId
  }`;
};

const readSourceIntakeDraftInput = (
  form: HTMLFormElement,
  fallback: SourceIntakeDraftState,
  selectedFile: SourceIntakeSelectedFileDraftState | null
): SourceIntakeDraftInput => {
  const fields = new FormData(form);

  return {
    intakeMode: readSourceIntakeMode(fields, fallback.intakeMode),
    sourceAssetId: readText(fields, "sourceAssetId", fallback.sourceAssetId),
    manifestPath: readText(fields, "manifestPath", fallback.manifestPath),
    contentHash: readText(fields, "contentHash", fallback.contentHash),
    defaultPartId: readText(fields, "defaultPartId", fallback.defaultPartId),
    placementPolicy: readPlacementPolicy(fields, fallback.placementPolicy),
    psdProfile: {
      adapterName: readText(fields, "psdAdapterName", fallback.psdProfile.adapterName),
      canvasWidth: readNumber(fields, "psdCanvasWidth", fallback.psdProfile.canvasWidth),
      canvasHeight: readNumber(fields, "psdCanvasHeight", fallback.psdProfile.canvasHeight)
    },
    selectedFile,
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

const readFirstSelectedFile = (input: HTMLInputElement): File | undefined => {
  const files = input.files;
  if (files === null || files.length === 0) {
    return undefined;
  }

  return files.item(0) ?? files[0] ?? undefined;
};

const readSelectedBrowserFileBytes = (
  file: File | null,
  selectedFile: SourceIntakeSelectedFileDraftState | null
): Promise<SourceIntakeSelectedFileBytes> | undefined => {
  if (
    file === null ||
    selectedFile === null ||
    typeof file.arrayBuffer !== "function"
  ) {
    return undefined;
  }

  return file.arrayBuffer().then((buffer) => ({
    fileName: selectedFile.fileName,
    bytes: new Uint8Array(buffer),
    declaredMediaType: selectedFile.declaredMediaType
  }));
};

const updateSelectedFileDraftSummary = (
  summary: HTMLElement,
  selectedFile: SourceIntakeSelectedFileDraftState | null,
  rights: SourceIntakeRightsDraftState
): void => {
  if (selectedFile === null) {
    summary.textContent = "No browser file selected";
    return;
  }

  const facts = document.createElement("dl");
  facts.className = "source-intake-summary";
  appendSelectedFileFact(facts, "Filename", selectedFile.fileName || "No filename");
  appendSelectedFileFact(facts, "Byte length", formatByteLength(selectedFile.byteLength));
  appendSelectedFileFact(
    facts,
    "Declared media type",
    selectedFile.declaredMediaType || "No declared media type"
  );
  appendSelectedFileFact(
    facts,
    "Storage",
    formatSelectedFileStorageTruth(selectedFile)
  );
  appendSelectedFileFact(
    facts,
    "Rights draft",
    `${formatRightsStatus(rights.rightsStatus)} / ${rights.license || "No license"}`
  );
  appendSelectedFileFact(
    facts,
    "Provenance draft",
    `${rights.creator || "No creator"} / ${rights.aiUsed ? "AI used" : "No AI use"}`
  );

  summary.replaceChildren(facts);
};

const formatSelectedFileStorageTruth = (
  selectedFile: SourceIntakeSelectedFileDraftState
): string =>
  selectedFile.commitStatus === "committed-to-package-binary-boundary-v1"
    ? "Bytes are registered in current editor session memory; same-origin browser-local IndexedDB stores bytes separately on a best-effort basis and load verifies bytes before availability."
    : "Bytes are selected in browser memory only; not committed to package; reupload is required after reload.";

const appendSelectedFileFact = (
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

const readRightsDraftFromForm = (
  form: HTMLFormElement,
  fallback: SourceIntakeRightsDraftState
): SourceIntakeRightsDraftState => {
  const fields = new FormData(form);

  return {
    rightsStatus: readRightsStatus(fields, fallback.rightsStatus),
    creator: readText(fields, "creator", fallback.creator),
    license: readText(fields, "license", fallback.license),
    redistributionAllowed: fields.get("redistributionAllowed") === "true",
    aiUsed: fields.get("aiUsed") === "true",
    sourceUrl: readText(fields, "sourceUrl", fallback.sourceUrl),
    notes: readText(fields, "notes", fallback.notes)
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
      ),
      texturePreviewReference: readText(
        fields,
        layerFieldName("texturePreviewReference", index),
        fallback.texturePreviewReference ?? ""
      ),
      textureId: readText(fields, layerFieldName("textureId", index), fallback.textureId ?? ""),
      targetPartId: readText(fields, layerFieldName("targetPartId", index), fallback.targetPartId ?? "")
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

const readSourceIntakeMode = (
  fields: FormData,
  fallback: SourceIntakeMode
): SourceIntakeMode => {
  const value = String(fields.get("intakeMode") ?? fallback);

  return sourceIntakeModes.includes(value as SourceIntakeMode)
    ? (value as SourceIntakeMode)
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

const formatByteLength = (byteLength: number): string =>
  `${byteLength} byte${byteLength === 1 ? "" : "s"}`;

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
    | "texturePreviewReference"
    | "textureId"
    | "targetPartId"
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
  line.style.overflowWrap = "anywhere";

  return line;
};

const formatSelectedFileReadError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return `Selected browser file bytes could not be read for byte intake: ${message}`;
};

const formatSourceIntakeMode = (mode: SourceIntakeMode): string => {
  switch (mode) {
    case "splitPng":
      return "Split PNG manifest metadata";
    case "psdAdapterProfile":
      return "PSD adapter/profile metadata (manual)";
  }
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
