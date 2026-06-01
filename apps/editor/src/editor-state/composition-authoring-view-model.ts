import type { EditorSemanticState } from "./editor-semantic-state.js";
import { formatPreviewNumber } from "./view-model-format.js";

export interface CompositionDrawableOptionViewModel {
  readonly drawableId: string;
  readonly label: string;
  readonly defaultOpacityLabel: string;
}

export interface CompositionParameterOptionViewModel {
  readonly parameterId: string;
  readonly label: string;
  readonly rangeLabel: string;
}

export interface CompositionMaskRelationItemViewModel {
  readonly maskRelationId: string;
  readonly enabledLabel: string;
  readonly maskDrawableLabel: string;
  readonly targetDrawableLabel: string;
  readonly maskGroupLabel: string;
}

export interface CompositionOpacityKeyformItemViewModel {
  readonly keyformSetId: string;
  readonly keyIndex: number;
  readonly targetLabel: string;
  readonly parameterLabel: string;
  readonly keyValueLabel: string;
  readonly opacityLabel: string;
}

export interface CompositionOperationDiagnosticViewModel {
  readonly checkId: string;
  readonly severity: string;
  readonly message: string;
}

export interface CompositionAuthoringViewModel {
  readonly relationCountLabel: string;
  readonly hasMaskRelations: boolean;
  readonly maskRelations: readonly CompositionMaskRelationItemViewModel[];
  readonly drawableOptions: readonly CompositionDrawableOptionViewModel[];
  readonly defaultMaskRelationId: string;
  readonly defaultMaskDrawableIds: readonly string[];
  readonly defaultTargetDrawableIds: readonly string[];
  readonly defaultMaskRelationEnabled: boolean;
  readonly canCommitMaskRelation: boolean;
  readonly maskRelationDisabledMessage: string | null;
  readonly opacityKeyformCountLabel: string;
  readonly opacityKeyforms: readonly CompositionOpacityKeyformItemViewModel[];
  readonly opacityParameterOptions: readonly CompositionParameterOptionViewModel[];
  readonly canAddOpacityKeyform: boolean;
  readonly opacityKeyformDisabledMessage: string | null;
  readonly lastCompositionOperationLabel: string;
  readonly lastCompositionDiagnostics: readonly CompositionOperationDiagnosticViewModel[];
}

export const projectCompositionAuthoringViewModel = (
  state: EditorSemanticState
): CompositionAuthoringViewModel => {
  const drawableOptions = state.drawables.map(projectDrawableOption);
  const authoredInputParameters = state.parameters
    .filter((parameter) => parameter.valueSource === "authoredInput")
    .map(projectParameterOption);
  const firstRelation = state.maskRelations[0];
  const hasLoadedPackage = state.loadedPackage !== null;
  const hasDrawableCandidates = state.drawables.length >= 2;
  const hasAuthoredInputParameter = authoredInputParameters.length > 0;
  const hasDrawable = state.drawables.length > 0;

  return {
    relationCountLabel: `${state.maskRelations.length} mask relation${state.maskRelations.length === 1 ? "" : "s"}`,
    hasMaskRelations: state.maskRelations.length > 0,
    maskRelations: state.maskRelations.map((relation) => projectMaskRelationItem(state, relation)),
    drawableOptions,
    defaultMaskRelationId: firstRelation?.maskRelationId ?? "",
    defaultMaskDrawableIds: firstRelation?.maskDrawableIds ?? defaultMaskDrawableIds(state),
    defaultTargetDrawableIds: firstRelation?.targetDrawableIds ?? defaultTargetDrawableIds(state),
    defaultMaskRelationEnabled: firstRelation?.enabled ?? true,
    canCommitMaskRelation: hasLoadedPackage && hasDrawableCandidates,
    maskRelationDisabledMessage: projectMaskRelationDisabledMessage({
      hasLoadedPackage,
      hasDrawableCandidates
    }),
    opacityKeyformCountLabel: `${state.drawableOpacityKeyforms.length} opacity keyform${state.drawableOpacityKeyforms.length === 1 ? "" : "s"}`,
    opacityKeyforms: state.drawableOpacityKeyforms.map((keyform) =>
      projectOpacityKeyformItem(state, keyform)
    ),
    opacityParameterOptions: authoredInputParameters,
    canAddOpacityKeyform: hasLoadedPackage && hasDrawable && hasAuthoredInputParameter,
    opacityKeyformDisabledMessage: projectOpacityKeyformDisabledMessage({
      hasLoadedPackage,
      hasDrawable,
      hasAuthoredInputParameter
    }),
    lastCompositionOperationLabel: projectLastCompositionOperationLabel(state),
    lastCompositionDiagnostics: projectLastCompositionDiagnostics(state)
  };
};

const projectDrawableOption = (
  drawable: EditorSemanticState["drawables"][number]
): CompositionDrawableOptionViewModel => ({
  drawableId: drawable.drawableId,
  label: `${drawable.displayName} / ${drawable.drawableId}`,
  defaultOpacityLabel: `default opacity ${formatPreviewNumber(drawable.defaultOpacity)}`
});

const projectParameterOption = (
  parameter: EditorSemanticState["parameters"][number]
): CompositionParameterOptionViewModel => ({
  parameterId: parameter.parameterId,
  label: parameter.displayName,
  rangeLabel: `${parameter.parameterId} / ${formatPreviewNumber(parameter.min)} to ${formatPreviewNumber(parameter.max)}`
});

const projectMaskRelationItem = (
  state: EditorSemanticState,
  relation: EditorSemanticState["maskRelations"][number]
): CompositionMaskRelationItemViewModel => ({
  maskRelationId: relation.maskRelationId,
  enabledLabel: relation.enabled ? "Enabled" : "Disabled",
  maskDrawableLabel: formatDrawableList(state, relation.maskDrawableIds),
  targetDrawableLabel: formatDrawableList(state, relation.targetDrawableIds),
  maskGroupLabel: relation.maskGroupHint ?? "None"
});

const projectOpacityKeyformItem = (
  state: EditorSemanticState,
  keyform: EditorSemanticState["drawableOpacityKeyforms"][number]
): CompositionOpacityKeyformItemViewModel => {
  const drawable = state.drawables.find((candidate) => candidate.drawableId === keyform.drawableId);
  const parameter = state.parameters.find((candidate) => candidate.parameterId === keyform.parameterId);

  return {
    keyformSetId: keyform.keyformSetId,
    keyIndex: keyform.keyIndex,
    targetLabel:
      drawable === undefined
        ? keyform.drawableId
        : `${drawable.displayName} / ${drawable.drawableId}`,
    parameterLabel:
      parameter === undefined
        ? keyform.parameterId
        : `${parameter.displayName} / ${parameter.parameterId}`,
    keyValueLabel: formatPreviewNumber(keyform.keyValue),
    opacityLabel: formatPreviewNumber(keyform.opacity)
  };
};

const defaultMaskDrawableIds = (state: EditorSemanticState): readonly string[] =>
  state.drawables[0] === undefined ? [] : [state.drawables[0].drawableId];

const defaultTargetDrawableIds = (state: EditorSemanticState): readonly string[] =>
  state.drawables[1] === undefined ? [] : [state.drawables[1].drawableId];

const projectMaskRelationDisabledMessage = (input: {
  readonly hasLoadedPackage: boolean;
  readonly hasDrawableCandidates: boolean;
}): string | null => {
  if (!input.hasLoadedPackage) {
    return "No package loaded";
  }

  if (!input.hasDrawableCandidates) {
    return "At least two drawables are required";
  }

  return null;
};

const projectOpacityKeyformDisabledMessage = (input: {
  readonly hasLoadedPackage: boolean;
  readonly hasDrawable: boolean;
  readonly hasAuthoredInputParameter: boolean;
}): string | null => {
  if (!input.hasLoadedPackage) {
    return "No package loaded";
  }

  if (!input.hasDrawable) {
    return "No drawable available";
  }

  if (!input.hasAuthoredInputParameter) {
    return "No authored input parameter";
  }

  return null;
};

const projectLastCompositionOperationLabel = (state: EditorSemanticState): string => {
  const result = state.lastOperationResult;
  if (
    result === null ||
    (result.operationType !== "setMaskRelation" && result.operationType !== "addKeyform")
  ) {
    return "No composition operation committed";
  }

  return `${result.operationType} ${result.status}`;
};

const projectLastCompositionDiagnostics = (
  state: EditorSemanticState
): readonly CompositionOperationDiagnosticViewModel[] => {
  const result = state.lastOperationResult;
  if (
    result === null ||
    (result.operationType !== "setMaskRelation" && result.operationType !== "addKeyform")
  ) {
    return [];
  }

  return result.diagnostics.map((diagnostic) => ({
    checkId: diagnostic.checkId,
    severity: diagnostic.severity,
    message: diagnostic.message
  }));
};

const formatDrawableList = (
  state: EditorSemanticState,
  drawableIds: readonly string[]
): string =>
  drawableIds
    .map((drawableId) => {
      const drawable = state.drawables.find((candidate) => candidate.drawableId === drawableId);
      return drawable === undefined ? drawableId : `${drawable.displayName} / ${drawableId}`;
    })
    .join(", ") || "None";
