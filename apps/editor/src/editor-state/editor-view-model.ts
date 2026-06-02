import type { EditorSemanticState } from "./editor-semantic-state.js";
import type { AiTranscriptSummaryEntryState } from "./ai-transcript-summary.js";
import {
  isPreviewParameterDisabled,
  type PreviewParameterValueState
} from "./preview-parameter-state.js";
import {
  projectMeshEditViewModel,
  type MeshEditViewModel
} from "./mesh-edit-view-model.js";
import {
  projectSourceIntakeDraftViewModel,
  type SourceIntakeDraftViewModel
} from "./source-intake-view-model.js";
import {
  projectViewerRuntimeViewModel,
  type ViewerRuntimeViewModel
} from "./viewer-runtime-view-model.js";
import {
  projectCompositionAuthoringViewModel,
  type CompositionAuthoringViewModel
} from "./composition-authoring-view-model.js";
import {
  projectLayerTreeViewModel,
  type LayerTreeViewModel
} from "./layer-tree-view-model.js";
import {
  projectPartTextureWorkflowViewModel,
  type PartTextureWorkflowViewModel
} from "./part-texture-workflow-view-model.js";
import {
  projectTutorialGuidedWorkflowViewModel,
  type TutorialGuidedWorkflowViewModel
} from "./tutorial-guided-workflow-view-model.js";
import { formatBoundsLabel, formatPreviewNumber } from "./view-model-format.js";

export interface AiApprovalWorkflowViewModel {
  readonly status: EditorSemanticState["aiApproval"]["status"];
  readonly latestDryRunCommandId: string | null;
  readonly latestDryRunOperationId: string | null;
  readonly latestDryRunResultLabel: string;
  readonly canApproveLatestDryRun: boolean;
  readonly canCommitApprovedOperation: boolean;
  readonly canRejectPendingDryRun: boolean;
  readonly transcriptEntries: readonly AiTranscriptSummaryEntryState[];
}

export interface EditorWorkflowViewModel {
  readonly packageTitle: string;
  readonly packageRevisionLabel: string;
  readonly isPackageLoaded: boolean;
  readonly parameterCountLabel: string;
  readonly drawableCountLabel: string;
  readonly canSubmitCreateParameter: boolean;
  readonly canSubmitCreateDrawable: boolean;
  readonly lastOperationLabel: string;
  readonly operationLogLabel: string;
  readonly generatedEvidenceLabel: string;
  readonly reloadLabel: string;
  readonly drawableAuthoring: DrawableAuthoringViewModel;
  readonly drawableLayers: DrawableLayerControlsViewModel;
  readonly layerTree: LayerTreeViewModel;
  readonly partTextureWorkflow: PartTextureWorkflowViewModel;
  readonly meshEdit: MeshEditViewModel;
  readonly sourceIntake: SourceIntakeDraftViewModel;
  readonly previewControls: EditorPreviewControlsViewModel;
  readonly viewerRuntime: ViewerRuntimeViewModel;
  readonly tutorialGuidedWorkflow: TutorialGuidedWorkflowViewModel;
  readonly composition: CompositionAuthoringViewModel;
  readonly rigControls: RigControlAuthoringViewModel;
  readonly dynamics: DynamicsAuthoringViewModel;
  readonly aiApproval: AiApprovalWorkflowViewModel;
}

export interface DrawableListItemViewModel {
  readonly drawableId: string;
  readonly displayName: string;
  readonly meshId: string;
  readonly visible: boolean;
  readonly baseDrawOrder: number;
  readonly stableOrder: number;
  readonly orderIndex: number;
  readonly visibilityLabel: string;
  readonly canMoveLayerUp: boolean;
  readonly canMoveLayerDown: boolean;
  readonly baseDrawOrderLabel: string;
  readonly layerOrderLabel: string;
  readonly meshSummaryLabel: string;
  readonly boundsLabel: string;
}

export interface DrawableLayerItemViewModel {
  readonly drawableId: string;
  readonly displayName: string;
  readonly visible: boolean;
  readonly runtimeVisibilityLabel: string;
  readonly baseDrawOrder: number;
  readonly stableOrder: number;
  readonly orderIndex: number;
  readonly orderLabel: string;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly moveUpLabel: string;
  readonly moveDownLabel: string;
  readonly visibilityToggleLabel: string;
}

export interface DrawableLayerControlsViewModel {
  readonly orderedDrawables: readonly DrawableLayerItemViewModel[];
  readonly hasDrawables: boolean;
  readonly hasMultipleDrawables: boolean;
  readonly layerCountLabel: string;
  readonly lastLayerOperationLabel: string;
}

export interface DrawableAuthoringViewModel {
  readonly drawables: readonly DrawableListItemViewModel[];
  readonly hasDrawables: boolean;
  readonly drawableCountLabel: string;
  readonly canSubmitCreateDrawable: boolean;
  readonly defaultDisplayName: string;
  readonly sourceLabel: string;
  readonly partLabel: string;
  readonly boundsLabel: string;
  readonly meshMethodLabel: string;
  readonly resultLabel: string;
}

export interface PreviewParameterControlViewModel {
  readonly parameterId: string;
  readonly displayName: string;
  readonly valueSource: PreviewParameterValueState["valueSource"];
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

export interface EditorPreviewControlsViewModel {
  readonly hasParameters: boolean;
  readonly parameterCountLabel: string;
  readonly resetLabel: string;
  readonly emptyMessage: string;
  readonly authoredInputCount: number;
  readonly parameterControls: readonly PreviewParameterControlViewModel[];
}

export interface DynamicsParameterOptionViewModel {
  readonly parameterId: string;
  readonly label: string;
  readonly rangeLabel: string;
}

export interface DynamicsGroupItemViewModel {
  readonly dynamicsGroupId: string;
  readonly displayName: string;
  readonly enabled: boolean;
  readonly enabledLabel: string;
  readonly resetPolicy: EditorSemanticState["dynamicsGroups"][number]["resetPolicy"];
  readonly resetPolicyLabel: string;
  readonly driverLabel: string;
  readonly outputLabel: string;
  readonly settingsLabel: string;
}

export interface DynamicsPreviewOutputViewModel {
  readonly dynamicsGroupId: string;
  readonly outputParameterId: string;
  readonly outputValueLabel: string;
  readonly stateLabel: string;
  readonly driverValuesLabel: string;
  readonly targetLabel: string;
}

export interface DynamicsPreviewDiagnosticViewModel {
  readonly checkId: string;
  readonly severity: string;
  readonly status: string;
  readonly message: string;
  readonly targetLabel: string;
}

export interface DynamicsPreviewEvidenceViewModel {
  readonly snapshotLabel: string;
  readonly runtimeDiffLabel: string;
  readonly validationLabel: string;
}

export interface RigControlPartOptionViewModel {
  readonly partId: string;
  readonly label: string;
}

export interface RigControlParameterOptionViewModel {
  readonly parameterId: string;
  readonly label: string;
  readonly rangeLabel: string;
}

export interface RigControlItemViewModel {
  readonly rigControlId: string;
  readonly displayName: string;
  readonly kindLabel: string;
  readonly enabledLabel: string;
  readonly partLabel: string;
  readonly parentLabel: string;
  readonly childDrawableLabel: string;
  readonly childRigControlLabel: string;
  readonly transformLabel: string;
}

export interface RigControlTargetOptionViewModel {
  readonly kind: "drawable" | "rigControl";
  readonly id: string;
  readonly label: string;
}

export interface RigControlAngleKeyformItemViewModel {
  readonly keyformSetId: string;
  readonly keyIndex: number;
  readonly rigControlId: string;
  readonly parameterId: string;
  readonly targetLabel: string;
  readonly parameterLabel: string;
  readonly keyValueLabel: string;
  readonly angleLabel: string;
}

export interface RigControlOperationDiagnosticViewModel {
  readonly checkId: string;
  readonly severity: string;
  readonly message: string;
}

export interface RigControlAuthoringViewModel {
  readonly controlCountLabel: string;
  readonly hasRigControls: boolean;
  readonly rigControls: readonly RigControlItemViewModel[];
  readonly partOptions: readonly RigControlPartOptionViewModel[];
  readonly defaultPivotX: number;
  readonly defaultPivotY: number;
  readonly defaultRestAngleDegrees: number;
  readonly canCreateRotation2d: boolean;
  readonly createDisabledMessage: string | null;
  readonly parentOptions: readonly RigControlTargetOptionViewModel[];
  readonly childOptions: readonly RigControlTargetOptionViewModel[];
  readonly canBindChild: boolean;
  readonly bindDisabledMessage: string | null;
  readonly angleKeyformParameterOptions: readonly RigControlParameterOptionViewModel[];
  readonly angleKeyformRigControlOptions: readonly RigControlTargetOptionViewModel[];
  readonly angleKeyforms: readonly RigControlAngleKeyformItemViewModel[];
  readonly angleKeyformCountLabel: string;
  readonly canCreateAngleKeyform: boolean;
  readonly angleKeyformDisabledMessage: string | null;
  readonly lastRigControlOperationLabel: string;
  readonly lastRigControlDiagnostics: readonly RigControlOperationDiagnosticViewModel[];
}

export interface DynamicsAuthoringViewModel {
  readonly groupCountLabel: string;
  readonly hasGroups: boolean;
  readonly groups: readonly DynamicsGroupItemViewModel[];
  readonly driverParameters: readonly DynamicsParameterOptionViewModel[];
  readonly computedOutputParameters: readonly DynamicsParameterOptionViewModel[];
  readonly canCreateGroup: boolean;
  readonly createDisabledMessage: string | null;
  readonly canRunPreview: boolean;
  readonly canResetPreview: boolean;
  readonly previewStatusLabel: string;
  readonly previewOutputs: readonly DynamicsPreviewOutputViewModel[];
  readonly previewDiagnostics: readonly DynamicsPreviewDiagnosticViewModel[];
  readonly previewEvidence: DynamicsPreviewEvidenceViewModel | null;
}

export const projectEditorWorkflowViewModel = (
  state: EditorSemanticState
): EditorWorkflowViewModel => {
  const runtimeArtifactCount =
    state.generatedEvidence.runtimeSnapshotIds.length +
    state.generatedEvidence.runtimeStateArtifactPaths.length +
    state.generatedEvidence.runtimeStateSequenceArtifactPaths.length;
  const validationArtifactCount =
    state.generatedEvidence.validationReportIds.length +
    state.generatedEvidence.validationReportArtifactPaths.length;

  return {
    packageTitle: state.loadedPackage?.displayName ?? "No package loaded",
    packageRevisionLabel: `Package r${state.revision.packageRevision} / authoring r${state.revision.authoringRevision}`,
    isPackageLoaded: state.loadedPackage !== null,
    parameterCountLabel: `${state.parameters.length} parameter${state.parameters.length === 1 ? "" : "s"}`,
    drawableCountLabel: `${state.drawables.length} drawable${state.drawables.length === 1 ? "" : "s"}`,
    canSubmitCreateParameter: state.loadedPackage !== null && state.pendingCreateParameter.status !== "submitting",
    canSubmitCreateDrawable: canSubmitCreateDrawable(state),
    lastOperationLabel: projectLastOperationLabel(state),
    operationLogLabel: `${state.operationLog.entryCount} operation${state.operationLog.entryCount === 1 ? "" : "s"}`,
    generatedEvidenceLabel: `${runtimeArtifactCount} runtime / ${validationArtifactCount} validation artifacts`,
    reloadLabel: projectReloadLabel(state),
    drawableAuthoring: projectDrawableAuthoringViewModel(state),
    drawableLayers: projectDrawableLayerControlsViewModel(state),
    layerTree: projectLayerTreeViewModel({
      parts: state.parts,
      drawables: state.drawables,
      textureAtlas: state.textureAtlas,
      layerTreeDraft: state.layerTreeDraft
    }),
    partTextureWorkflow: projectPartTextureWorkflowViewModel({
      loaded: state.loadedPackage !== null,
      parts: state.parts,
      drawables: state.drawables,
      textureAtlas: state.textureAtlas
    }),
    meshEdit: projectMeshEditViewModel(state),
    sourceIntake: projectSourceIntakeDraftViewModel(state.sourceIntakeDraft, {
      sourceAssets: state.sourceAssets,
      binaryByteIntake: state.binaryByteIntake,
      ...(state.textureAtlas === null ? {} : { textureAtlas: state.textureAtlas })
    }),
    previewControls: projectPreviewControlsViewModel(state),
    viewerRuntime: projectViewerRuntimeViewModel(state.viewerRuntime),
    tutorialGuidedWorkflow: projectTutorialGuidedWorkflowViewModel(state.tutorialGuidedWorkflow),
    composition: projectCompositionAuthoringViewModel(state),
    rigControls: projectRigControlAuthoringViewModel(state),
    dynamics: projectDynamicsAuthoringViewModel(state),
    aiApproval: projectAiApprovalViewModel(state)
  };
};

const projectLastOperationLabel = (state: EditorSemanticState): string => {
  if (state.lastOperationResult === null) {
    return "No operation committed";
  }

  return `${state.lastOperationResult.operationType} ${state.lastOperationResult.status}`;
};

const projectReloadLabel = (state: EditorSemanticState): string => {
  if (state.reload.status === "not_reloaded") {
    return "Not reloaded";
  }

  if (state.reload.status === "failed") {
    return "Reload failed";
  }

  return `Reloaded r${state.reload.packageRevision} with ${state.reload.parameterCount} parameter${state.reload.parameterCount === 1 ? "" : "s"} / ${state.reload.drawableCount} drawable${state.reload.drawableCount === 1 ? "" : "s"}`;
};

const projectDrawableAuthoringViewModel = (
  state: EditorSemanticState
): DrawableAuthoringViewModel => ({
  drawables: state.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    displayName: drawable.displayName,
    meshId: drawable.meshId,
    visible: drawable.visible,
    baseDrawOrder: drawable.baseDrawOrder,
    stableOrder: drawable.stableOrder,
    orderIndex: drawable.orderIndex,
    visibilityLabel: drawable.visible ? "Visible" : "Hidden",
    canMoveLayerUp: drawable.canMoveLayerUp,
    canMoveLayerDown: drawable.canMoveLayerDown,
    baseDrawOrderLabel: `Draw order ${drawable.baseDrawOrder}`,
    layerOrderLabel: `Layer ${drawable.orderIndex + 1}`,
    meshSummaryLabel: `${drawable.vertexCount} vertices / ${drawable.triangleCount} triangles`,
    boundsLabel: formatBoundsLabel(drawable.bounds)
  })),
  hasDrawables: state.drawables.length > 0,
  drawableCountLabel: `${state.drawables.length} drawable${state.drawables.length === 1 ? "" : "s"}`,
  canSubmitCreateDrawable: canSubmitCreateDrawable(state),
  defaultDisplayName: state.pendingCreateDrawable.displayName,
  sourceLabel:
    state.pendingCreateDrawable.sourceLayerId === null
      ? state.pendingCreateDrawable.sourceAssetId
      : `${state.pendingCreateDrawable.sourceAssetId} / ${state.pendingCreateDrawable.sourceLayerId}`,
  partLabel: state.pendingCreateDrawable.partId,
  boundsLabel: formatBoundsLabel(state.pendingCreateDrawable.initialBounds),
  meshMethodLabel: `${state.pendingCreateDrawable.meshMethod} / ${state.pendingCreateDrawable.densityHint}`,
  resultLabel: projectCreateDrawableResultLabel(state)
});

const projectDrawableLayerControlsViewModel = (
  state: EditorSemanticState
): DrawableLayerControlsViewModel => ({
  orderedDrawables: state.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    displayName: drawable.displayName,
    visible: drawable.visible,
    runtimeVisibilityLabel: drawable.visible ? "Visible" : "Hidden",
    baseDrawOrder: drawable.baseDrawOrder,
    stableOrder: drawable.stableOrder,
    orderIndex: drawable.orderIndex,
    orderLabel: `Layer ${drawable.orderIndex + 1} / draw order ${drawable.baseDrawOrder}`,
    canMoveUp: drawable.canMoveLayerUp,
    canMoveDown: drawable.canMoveLayerDown,
    moveUpLabel: `Move ${drawable.displayName} up`,
    moveDownLabel: `Move ${drawable.displayName} down`,
    visibilityToggleLabel: drawable.visible
      ? `Hide ${drawable.displayName}`
      : `Show ${drawable.displayName}`
  })),
  hasDrawables: state.drawables.length > 0,
  hasMultipleDrawables: state.drawables.length > 1,
  layerCountLabel: `${state.drawables.length} layer${state.drawables.length === 1 ? "" : "s"}`,
  lastLayerOperationLabel: projectLastLayerOperationLabel(state)
});

const canSubmitCreateDrawable = (state: EditorSemanticState): boolean =>
  state.loadedPackage !== null &&
  state.pendingCreateDrawable.status !== "submitting" &&
  state.pendingCreateDrawable.displayName.trim().length > 0 &&
  state.pendingCreateDrawable.sourceAssetId.length > 0 &&
  state.pendingCreateDrawable.partId.length > 0;

const projectCreateDrawableResultLabel = (state: EditorSemanticState): string => {
  if (state.pendingCreateDrawable.status === "committed") {
    return "Drawable preset committed";
  }

  if (state.pendingCreateDrawable.status === "rejected") {
    return `Drawable preset rejected with ${state.pendingCreateDrawable.diagnostics.length} diagnostic${state.pendingCreateDrawable.diagnostics.length === 1 ? "" : "s"}`;
  }

  if (state.pendingCreateDrawable.status === "submitting") {
    return "Drawable preset submitting";
  }

  return "Drawable preset ready";
};

const projectLastLayerOperationLabel = (state: EditorSemanticState): string => {
  const result = state.lastOperationResult;
  if (result === null) {
    return "No layer operation committed";
  }

  if (result.operationType !== "setDrawOrder" && result.operationType !== "setRuntimeVisibility") {
    return "No layer operation committed";
  }

  return `${result.operationType} ${result.status}`;
};

const projectAiApprovalViewModel = (
  state: EditorSemanticState
): AiApprovalWorkflowViewModel => ({
  status: state.aiApproval.status,
  latestDryRunCommandId: state.aiApproval.latestDryRunCommandId,
  latestDryRunOperationId: state.aiApproval.latestDryRunOperationId,
  latestDryRunResultLabel:
    state.aiApproval.latestDryRunResult === null
      ? "No AI dry-run pending"
      : `${state.aiApproval.latestDryRunResult.operationType} ${state.aiApproval.latestDryRunResult.status}`,
  canApproveLatestDryRun: state.aiApproval.canApproveLatestDryRun,
  canCommitApprovedOperation: state.aiApproval.canCommitApprovedOperation,
  canRejectPendingDryRun: state.aiApproval.canRejectPendingDryRun,
  transcriptEntries: state.aiApproval.transcriptEntries
});

const projectPreviewControlsViewModel = (
  state: EditorSemanticState
): EditorPreviewControlsViewModel => {
  const parameterControls = state.previewParameters.map(projectPreviewParameterControl);
  const authoredInputCount = parameterControls.filter((parameter) => !parameter.disabled).length;

  return {
    hasParameters: parameterControls.length > 0,
    parameterCountLabel: `${parameterControls.length} preview parameter${parameterControls.length === 1 ? "" : "s"}`,
    resetLabel: "Reset preview parameters",
    emptyMessage:
      state.loadedPackage === null
        ? "No package loaded"
        : "No preview parameters available",
    authoredInputCount,
    parameterControls
  };
};

const projectPreviewParameterControl = (
  parameter: PreviewParameterValueState
): PreviewParameterControlViewModel => {
  const disabled = isPreviewParameterDisabled(parameter);

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
      ? `Preview control disabled for ${parameter.valueSource} parameter`
      : null
  };
};

const projectDynamicsAuthoringViewModel = (
  state: EditorSemanticState
): DynamicsAuthoringViewModel => {
  const driverParameters = state.parameters
    .filter((parameter) => parameter.valueSource === "authoredInput")
    .map(projectDynamicsParameterOption);
  const computedOutputParameters = state.parameters
    .filter((parameter) => parameter.valueSource === "computedDynamics")
    .map(projectDynamicsParameterOption);
  const hasDriverParameter = driverParameters.length > 0;
  const hasLoadedPackage = state.loadedPackage !== null;

  return {
    groupCountLabel: `${state.dynamicsGroups.length} dynamics group${state.dynamicsGroups.length === 1 ? "" : "s"}`,
    hasGroups: state.dynamicsGroups.length > 0,
    groups: state.dynamicsGroups.map((group) => ({
      dynamicsGroupId: group.dynamicsGroupId,
      displayName: group.displayName,
      enabled: group.enabled,
      enabledLabel: group.enabled ? "Enabled" : "Disabled",
      resetPolicy: group.resetPolicy,
      resetPolicyLabel: formatResetPolicy(group.resetPolicy),
      driverLabel: group.driverParameterIds.join(", "),
      outputLabel: group.outputParameterId,
      settingsLabel: `stiffness ${formatPreviewNumber(group.stiffness)} / damping ${formatPreviewNumber(group.damping)}${group.maxVelocity === null ? "" : ` / max velocity ${formatPreviewNumber(group.maxVelocity)}`}${group.maxAmplitude === null ? "" : ` / max amplitude ${formatPreviewNumber(group.maxAmplitude)}`}`
    })),
    driverParameters,
    computedOutputParameters,
    canCreateGroup: hasLoadedPackage && hasDriverParameter,
    createDisabledMessage: projectDynamicsCreateDisabledMessage({
      hasLoadedPackage,
      hasDriverParameter
    }),
    canRunPreview: hasLoadedPackage && state.dynamicsGroups.some((group) => group.enabled),
    canResetPreview: hasLoadedPackage && state.dynamicsGroups.some((group) => group.enabled),
    previewStatusLabel: projectDynamicsPreviewStatusLabel(state),
    previewOutputs: state.dynamicsPreview.outputs.map((output) => ({
      dynamicsGroupId: output.dynamicsGroupId,
      outputParameterId: output.outputParameterId,
      outputValueLabel: formatPreviewNumber(output.outputValue),
      stateLabel: `position ${formatPreviewNumber(output.position)} / velocity ${formatPreviewNumber(output.velocity)} / tick ${output.tick} / resets ${output.resetCounter}`,
      driverValuesLabel: Object.entries(output.driverValues)
        .map(([parameterId, value]) => `${parameterId} ${formatPreviewNumber(value)}`)
        .join(", ") || "None",
      targetLabel:
        output.rawTarget === null || output.clampedTarget === null
          ? "Target unavailable"
          : `raw ${formatPreviewNumber(output.rawTarget)} / clamped ${formatPreviewNumber(output.clampedTarget)}${output.outputClamped ? " / output clamped" : ""}`
    })),
    previewDiagnostics: state.dynamicsPreview.diagnostics.map((diagnostic) => ({
      checkId: diagnostic.checkId,
      severity: diagnostic.severity,
      status: diagnostic.status,
      message: diagnostic.message,
      targetLabel:
        diagnostic.targetKind === null || diagnostic.targetId === null
          ? diagnostic.phase
          : `${diagnostic.phase} / ${diagnostic.targetKind}:${diagnostic.targetId}`
    })),
    previewEvidence:
      state.dynamicsPreview.evidence === null
        ? null
        : {
            snapshotLabel: `${state.dynamicsPreview.evidence.snapshotId} / r${state.dynamicsPreview.evidence.packageRevision} / frame ${state.dynamicsPreview.evidence.frameIndex}`,
            runtimeDiffLabel: `${state.dynamicsPreview.evidence.parameterChangeCount} parameter / ${state.dynamicsPreview.evidence.dynamicsChangeCount} dynamics / ${state.dynamicsPreview.evidence.drawableChangeCount} drawable changes`,
            validationLabel:
              state.dynamicsPreview.evidence.validationReportId === null
                ? "No validation report"
                : `${state.dynamicsPreview.evidence.validationReportId} / ${state.dynamicsPreview.evidence.validationStatus} / ${state.dynamicsPreview.evidence.validationHighestSeverity} / ${state.dynamicsPreview.evidence.validationCheckCount} checks`
          }
  };
};

const projectRigControlAuthoringViewModel = (
  state: EditorSemanticState
): RigControlAuthoringViewModel => {
  const boundDrawableIds = new Set(state.rigControls.flatMap((rigControl) => rigControl.childDrawableIds));
  const unparentedRigControls = state.rigControls.filter((rigControl) => rigControl.parentId === null);
  const authoredInputParameters = state.parameters
    .filter((parameter) => parameter.valueSource === "authoredInput")
    .map(projectRigControlParameterOption);
  const rotation2dRigControls = state.rigControls
    .filter((rigControl) => rigControl.kind === "rotation2d")
    .map((rigControl): RigControlTargetOptionViewModel => ({
      kind: "rigControl",
      id: rigControl.rigControlId,
      label: `${rigControl.displayName} / ${rigControl.rigControlId}`
    }));
  const childDrawableOptions = state.drawables
    .filter((drawable) => !boundDrawableIds.has(drawable.drawableId))
    .map((drawable): RigControlTargetOptionViewModel => ({
      kind: "drawable",
      id: drawable.drawableId,
      label: `${drawable.displayName} / ${drawable.drawableId}`
    }));
  const childRigControlOptions =
    unparentedRigControls.length < 2
      ? []
      : unparentedRigControls.map((rigControl): RigControlTargetOptionViewModel => ({
          kind: "rigControl",
          id: rigControl.rigControlId,
          label: `${rigControl.displayName} / ${rigControl.rigControlId}`
        }));
  const defaultPivot = resolveDefaultRigControlPivot(state);
  const hasLoadedPackage = state.loadedPackage !== null;
  const hasParts = state.parts.length > 0;
  const hasParent = state.rigControls.length > 0;
  const hasBindableChild =
    childDrawableOptions.length > 0 || unparentedRigControls.length > 1;
  const hasAuthoredInputParameter = authoredInputParameters.length > 0;
  const hasRotation2dRigControl = rotation2dRigControls.length > 0;

  return {
    controlCountLabel: `${state.rigControls.length} rig control${state.rigControls.length === 1 ? "" : "s"}`,
    hasRigControls: state.rigControls.length > 0,
    rigControls: state.rigControls.map(projectRigControlItem),
    partOptions: state.parts.map((part) => ({
      partId: part.partId,
      label: `${part.displayName} / ${part.partId}`
    })),
    defaultPivotX: defaultPivot.x,
    defaultPivotY: defaultPivot.y,
    defaultRestAngleDegrees: 15,
    canCreateRotation2d: hasLoadedPackage && hasParts,
    createDisabledMessage: projectRigControlCreateDisabledMessage({ hasLoadedPackage, hasParts }),
    parentOptions: state.rigControls.map((rigControl) => ({
      kind: "rigControl",
      id: rigControl.rigControlId,
      label: `${rigControl.displayName} / ${rigControl.rigControlId}`
    })),
    childOptions: [...childDrawableOptions, ...childRigControlOptions],
    canBindChild: hasLoadedPackage && hasParent && hasBindableChild,
    bindDisabledMessage: projectRigControlBindDisabledMessage({
      hasLoadedPackage,
      hasParent,
      hasBindableChild
    }),
    angleKeyformParameterOptions: authoredInputParameters,
    angleKeyformRigControlOptions: rotation2dRigControls,
    angleKeyforms: state.rigControlAngleKeyforms.map((keyform) =>
      projectRigControlAngleKeyformItem(state, keyform)
    ),
    angleKeyformCountLabel: `${state.rigControlAngleKeyforms.length} angle keyform${state.rigControlAngleKeyforms.length === 1 ? "" : "s"}`,
    canCreateAngleKeyform: hasLoadedPackage && hasAuthoredInputParameter && hasRotation2dRigControl,
    angleKeyformDisabledMessage: projectRigControlAngleKeyformDisabledMessage({
      hasLoadedPackage,
      hasAuthoredInputParameter,
      hasRotation2dRigControl
    }),
    lastRigControlOperationLabel: projectLastRigControlOperationLabel(state),
    lastRigControlDiagnostics: projectLastRigControlDiagnostics(state)
  };
};

const projectRigControlItem = (
  rigControl: EditorSemanticState["rigControls"][number]
): RigControlItemViewModel => ({
  rigControlId: rigControl.rigControlId,
  displayName: rigControl.displayName,
  kindLabel: rigControl.kind,
  enabledLabel: rigControl.enabled ? "Enabled" : "Disabled",
  partLabel: rigControl.partId,
  parentLabel: rigControl.parentId ?? "Root",
  childDrawableLabel: rigControl.childDrawableIds.join(", ") || "None",
  childRigControlLabel: rigControl.childRigControlIds.join(", ") || "None",
  transformLabel:
    rigControl.kind === "rotation2d" && rigControl.pivot !== null && rigControl.restAngleDegrees !== null
      ? `pivot ${formatPreviewNumber(rigControl.pivot.x)}, ${formatPreviewNumber(rigControl.pivot.y)} / rest ${formatPreviewNumber(rigControl.restAngleDegrees)} deg`
      : "Future-scope evaluator"
});

const projectRigControlParameterOption = (
  parameter: EditorSemanticState["parameters"][number]
): RigControlParameterOptionViewModel => ({
  parameterId: parameter.parameterId,
  label: parameter.displayName,
  rangeLabel: `${parameter.parameterId} / ${formatPreviewNumber(parameter.min)} to ${formatPreviewNumber(parameter.max)}`
});

const projectRigControlAngleKeyformItem = (
  state: EditorSemanticState,
  keyform: EditorSemanticState["rigControlAngleKeyforms"][number]
): RigControlAngleKeyformItemViewModel => {
  const rigControl = state.rigControls.find((candidate) => candidate.rigControlId === keyform.rigControlId);
  const parameter = state.parameters.find((candidate) => candidate.parameterId === keyform.parameterId);

  return {
    keyformSetId: keyform.keyformSetId,
    keyIndex: keyform.keyIndex,
    rigControlId: keyform.rigControlId,
    parameterId: keyform.parameterId,
    targetLabel:
      rigControl === undefined
        ? keyform.rigControlId
        : `${rigControl.displayName} / ${rigControl.rigControlId}`,
    parameterLabel:
      parameter === undefined
        ? keyform.parameterId
        : `${parameter.displayName} / ${parameter.parameterId}`,
    keyValueLabel: formatPreviewNumber(keyform.keyValue),
    angleLabel: `${formatPreviewNumber(keyform.angleDegrees)} deg`
  };
};

const resolveDefaultRigControlPivot = (
  state: EditorSemanticState
): { readonly x: number; readonly y: number } => {
  const firstVisibleDrawable = state.drawables.find((drawable) => drawable.visible) ?? state.drawables[0];
  if (firstVisibleDrawable !== undefined) {
    return {
      x: firstVisibleDrawable.bounds.x + firstVisibleDrawable.bounds.width / 2,
      y: firstVisibleDrawable.bounds.y + firstVisibleDrawable.bounds.height / 2
    };
  }

  return { x: 0, y: 0 };
};

const projectRigControlCreateDisabledMessage = (input: {
  readonly hasLoadedPackage: boolean;
  readonly hasParts: boolean;
}): string | null => {
  if (!input.hasLoadedPackage) {
    return "No package loaded";
  }

  if (!input.hasParts) {
    return "No part available";
  }

  return null;
};

const projectRigControlBindDisabledMessage = (input: {
  readonly hasLoadedPackage: boolean;
  readonly hasParent: boolean;
  readonly hasBindableChild: boolean;
}): string | null => {
  if (!input.hasLoadedPackage) {
    return "No package loaded";
  }

  if (!input.hasParent) {
    return "Create a rotation2d rig control first";
  }

  if (!input.hasBindableChild) {
    return "No unbound drawable or child rig control available";
  }

  return null;
};

const projectRigControlAngleKeyformDisabledMessage = (input: {
  readonly hasLoadedPackage: boolean;
  readonly hasAuthoredInputParameter: boolean;
  readonly hasRotation2dRigControl: boolean;
}): string | null => {
  if (!input.hasLoadedPackage) {
    return "No package loaded";
  }

  if (!input.hasAuthoredInputParameter) {
    return "No authored input parameter";
  }

  if (!input.hasRotation2dRigControl) {
    return "No rotation2d rig control";
  }

  return null;
};

const projectLastRigControlOperationLabel = (state: EditorSemanticState): string => {
  const result = state.lastOperationResult;
  if (
    result === null ||
    (result.operationType !== "createRotation2dRigControl" &&
      result.operationType !== "bindRigControlChild" &&
      result.operationType !== "addKeyform")
  ) {
    return "No rig control operation committed";
  }

  return `${result.operationType} ${result.status}`;
};

const projectLastRigControlDiagnostics = (
  state: EditorSemanticState
): readonly RigControlOperationDiagnosticViewModel[] => {
  const result = state.lastOperationResult;
  if (
    result === null ||
    (result.operationType !== "createRotation2dRigControl" &&
      result.operationType !== "bindRigControlChild" &&
      result.operationType !== "addKeyform")
  ) {
    return [];
  }

  return result.diagnostics.map((diagnostic) => ({
    checkId: diagnostic.checkId,
    severity: diagnostic.severity,
    message: diagnostic.message
  }));
};

const projectDynamicsParameterOption = (
  parameter: EditorSemanticState["parameters"][number]
): DynamicsParameterOptionViewModel => ({
  parameterId: parameter.parameterId,
  label: parameter.displayName,
  rangeLabel: `${parameter.parameterId} / ${formatPreviewNumber(parameter.min)} to ${formatPreviewNumber(parameter.max)}`
});

const projectDynamicsCreateDisabledMessage = (input: {
  readonly hasLoadedPackage: boolean;
  readonly hasDriverParameter: boolean;
}): string | null => {
  if (!input.hasLoadedPackage) {
    return "No package loaded";
  }

  if (!input.hasDriverParameter) {
    return "No authored input parameter";
  }

  return null;
};

const projectDynamicsPreviewStatusLabel = (state: EditorSemanticState): string => {
  if (state.dynamicsPreview.status === "idle") {
    return "No dynamics preview run";
  }

  const action = state.dynamicsPreview.status === "reset" ? "Reset" : "Ran";
  return `${action} ${state.dynamicsPreview.lastFrameCount} frame${state.dynamicsPreview.lastFrameCount === 1 ? "" : "s"}`;
};

const formatResetPolicy = (
  resetPolicy: EditorSemanticState["dynamicsGroups"][number]["resetPolicy"]
): string => {
  switch (resetPolicy) {
    case "reset-on-load":
      return "Reset on load";
    case "reset-on-manual-command":
      return "Reset on manual command";
    case "reset-on-large-input-jump":
      return "Reset on large input jump";
  }
};
