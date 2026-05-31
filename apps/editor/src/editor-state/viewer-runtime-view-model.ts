import { formatPreviewNumber } from "./view-model-format.js";
import {
  isViewerParameterDisabled,
  type ViewerParameterValueState,
  type ViewerRuntimeState
} from "./viewer-runtime-state.js";

export interface ViewerRuntimeParameterControlViewModel {
  readonly parameterId: string;
  readonly displayName: string;
  readonly valueSource: ViewerParameterValueState["valueSource"];
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly currentValue: number;
  readonly recommendedUiStep: number;
  readonly disabled: boolean;
  readonly label: string;
  readonly valueLabel: string;
  readonly rangeLabel: string;
  readonly defaultValueLabel: string;
  readonly disabledMessage: string | null;
}

export interface ViewerRuntimeViewModel {
  readonly isOpen: boolean;
  readonly openButtonLabel: string;
  readonly closeButtonLabel: string;
  readonly parameterCountLabel: string;
  readonly hasParameters: boolean;
  readonly authoredInputCount: number;
  readonly resetLabel: string;
  readonly emptyMessage: string;
  readonly parameterControls: readonly ViewerRuntimeParameterControlViewModel[];
}

export const projectViewerRuntimeViewModel = (
  viewerRuntime: ViewerRuntimeState
): ViewerRuntimeViewModel => {
  const parameterControls = viewerRuntime.parameters.map(projectViewerParameterControl);
  const authoredInputCount = parameterControls.filter((parameter) => !parameter.disabled).length;

  return {
    isOpen: viewerRuntime.surface === "open",
    openButtonLabel:
      viewerRuntime.surface === "open" ? "Close Viewer / Runtime" : "Open Viewer / Runtime",
    closeButtonLabel: "Close Viewer / Runtime",
    parameterCountLabel: `${parameterControls.length} viewer parameter${parameterControls.length === 1 ? "" : "s"}`,
    hasParameters: parameterControls.length > 0,
    authoredInputCount,
    resetLabel: "Reset viewer parameters",
    emptyMessage: "No viewer parameters available",
    parameterControls
  };
};

const projectViewerParameterControl = (
  parameter: ViewerParameterValueState
): ViewerRuntimeParameterControlViewModel => {
  const disabled = isViewerParameterDisabled(parameter);

  return {
    parameterId: parameter.parameterId,
    displayName: parameter.displayName,
    valueSource: parameter.valueSource,
    min: parameter.min,
    max: parameter.max,
    defaultValue: parameter.defaultValue,
    currentValue: parameter.currentValue,
    recommendedUiStep: parameter.recommendedUiStep,
    disabled,
    label: parameter.displayName,
    valueLabel: `${parameter.displayName}: ${formatPreviewNumber(parameter.currentValue)}`,
    rangeLabel: `${formatPreviewNumber(parameter.min)} to ${formatPreviewNumber(parameter.max)}`,
    defaultValueLabel: `Default ${formatPreviewNumber(parameter.defaultValue)}`,
    disabledMessage: disabled
      ? `Viewer control disabled for ${parameter.valueSource} parameter`
      : null
  };
};
