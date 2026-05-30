import {
  createPreviewParameterControlTestId,
  type EditorPreviewControlsViewModel,
  type PreviewParameterControlViewModel
} from "../../editor-state/index.js";

export interface PreviewParameterControlsOptions {
  readonly viewModel: EditorPreviewControlsViewModel;
  readonly onSetPreviewParameterValue: (parameterId: string, value: number) => void;
}

export const createPreviewParameterControls = (
  options: PreviewParameterControlsOptions
): HTMLElement => {
  const container = document.createElement("div");
  container.className = "preview-controls";

  for (const control of options.viewModel.parameterControls) {
    container.append(createPreviewParameterControl(control, options.onSetPreviewParameterValue));
  }

  return container;
};

const createPreviewParameterControl = (
  control: PreviewParameterControlViewModel,
  onSetPreviewParameterValue: (parameterId: string, value: number) => void
): HTMLElement => {
  const row = document.createElement("label");
  row.className = "preview-control";
  row.htmlFor = `preview-control-${control.parameterId}`;

  const header = document.createElement("span");
  header.className = "preview-control__header";

  const name = document.createElement("span");
  name.className = "preview-control__name";
  name.textContent = control.label;

  const value = document.createElement("span");
  value.className = "preview-control__value";
  value.textContent = formatPreviewNumber(control.currentValue);

  header.append(name, value);

  const input = document.createElement("input");
  input.id = `preview-control-${control.parameterId}`;
  input.type = "range";
  input.min = String(control.min);
  input.max = String(control.max);
  input.step = String(control.recommendedUiStep);
  input.value = String(control.currentValue);
  input.disabled = control.disabled;
  input.dataset.testid = createPreviewParameterControlTestId(control.parameterId);
  input.setAttribute("aria-label", control.label);
  input.addEventListener("input", () => {
    onSetPreviewParameterValue(control.parameterId, Number(input.value));
  });

  const meta = document.createElement("span");
  meta.className = "preview-control__meta";
  meta.textContent = control.disabledMessage ?? `${control.rangeLabel} / ${control.defaultValueLabel}`;

  row.append(header, input, meta);
  return row;
};

const formatPreviewNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : Number.parseFloat(value.toFixed(4)).toString();
