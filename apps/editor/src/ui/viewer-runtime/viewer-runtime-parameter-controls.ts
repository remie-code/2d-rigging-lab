import {
  createViewerParameterControlTestId,
  type ViewerRuntimeViewModel,
  type ViewerRuntimeParameterControlViewModel
} from "../../editor-state/index.js";

export interface ViewerRuntimeParameterControlsOptions {
  readonly viewModel: ViewerRuntimeViewModel;
  readonly onSetViewerParameterValue: (parameterId: string, value: number) => void;
}

export const createViewerRuntimeParameterControls = (
  options: ViewerRuntimeParameterControlsOptions
): HTMLElement => {
  const container = document.createElement("div");
  container.className = "preview-controls";

  for (const control of options.viewModel.parameterControls) {
    container.append(createViewerRuntimeParameterControl(control, options.onSetViewerParameterValue));
  }

  return container;
};

const createViewerRuntimeParameterControl = (
  control: ViewerRuntimeParameterControlViewModel,
  onSetViewerParameterValue: (parameterId: string, value: number) => void
): HTMLElement => {
  const row = document.createElement("label");
  row.className = "preview-control";
  row.htmlFor = `viewer-control-${control.parameterId}`;

  const header = document.createElement("span");
  header.className = "preview-control__header";

  const name = document.createElement("span");
  name.className = "preview-control__name";
  name.textContent = control.label;

  const value = document.createElement("span");
  value.className = "preview-control__value";
  value.textContent = formatViewerNumber(control.currentValue);

  header.append(name, value);

  const input = document.createElement("input");
  input.id = `viewer-control-${control.parameterId}`;
  input.type = "range";
  input.min = String(control.min);
  input.max = String(control.max);
  input.step = String(control.recommendedUiStep);
  input.value = String(control.currentValue);
  input.disabled = control.disabled;
  input.dataset.testid = createViewerParameterControlTestId(control.parameterId);
  input.setAttribute("aria-label", `Viewer ${control.label}`);
  input.addEventListener("input", () => {
    onSetViewerParameterValue(control.parameterId, Number(input.value));
  });

  const meta = document.createElement("span");
  meta.className = "preview-control__meta";
  meta.textContent = control.disabledMessage ?? `${control.rangeLabel} / ${control.defaultValueLabel}`;

  row.append(header, input, meta);
  return row;
};

const formatViewerNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : Number.parseFloat(value.toFixed(4)).toString();
