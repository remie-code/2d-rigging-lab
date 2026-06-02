import type {
  TutorialGuidedStepId,
  TutorialGuidedStepState,
  TutorialGuidedWorkflowState,
  TutorialReadinessStatus,
  TutorialSelectedTargetState,
  TutorialStepEvidenceRef,
  TutorialTargetKind
} from "./tutorial-guided-workflow-state.js";

export interface TutorialTargetOptionViewModel {
  readonly kind: TutorialTargetKind;
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
}

export interface TutorialGuidedStepViewModel {
  readonly stepId: TutorialGuidedStepId;
  readonly title: string;
  readonly status: TutorialGuidedStepState["status"];
  readonly statusLabel: string;
  readonly evidenceCount: number;
  readonly evidenceLabel: string;
  readonly missingEvidenceLabel: string;
  readonly evidenceRefs: readonly TutorialStepEvidenceRef[];
}

export interface TutorialGuidedWorkflowViewModel {
  readonly recipeId: string;
  readonly recipeLabel: string;
  readonly readinessStatus: TutorialReadinessStatus;
  readonly readinessLabel: string;
  readonly selectedTarget: TutorialSelectedTargetState | null;
  readonly selectedTargetLabel: string;
  readonly targetOptions: readonly TutorialTargetOptionViewModel[];
  readonly steps: readonly TutorialGuidedStepViewModel[];
  readonly canApplySmallEdit: boolean;
  readonly smallEditLabel: string;
  readonly nonGoalLabel: string;
}

export const projectTutorialGuidedWorkflowViewModel = (
  state: TutorialGuidedWorkflowState
): TutorialGuidedWorkflowViewModel => ({
  recipeId: state.recipe.recipeId,
  recipeLabel: "Tutorial Mini Model v0",
  readinessStatus: state.readiness.status,
  readinessLabel: formatReadinessLabel(state),
  selectedTarget: state.selectedTarget,
  selectedTargetLabel: formatSelectedTargetLabel(state.selectedTarget),
  targetOptions: projectTargetOptions(state),
  steps: state.steps.map(projectGuidedStepViewModel),
  canApplySmallEdit: canApplySmallEdit(state),
  smallEditLabel: canApplySmallEdit(state)
    ? "Apply front hair mesh nudge"
    : "Create tutorial mesh evidence first",
  nonGoalLabel:
    "Semantic tutorial draft only: no real asset import, no image decode, no file picker, no archive import/export, no full renderer, no pixel oracle, no public tutorial distribution, and no Cubism compatibility."
});

const projectGuidedStepViewModel = (
  step: TutorialGuidedStepState
): TutorialGuidedStepViewModel => ({
  stepId: step.stepId,
  title: tutorialStepTitles[step.stepId],
  status: step.status,
  statusLabel: step.status === "ready" ? "Ready" : "Missing evidence",
  evidenceCount: step.evidenceRefs.length,
  evidenceLabel:
    step.evidenceRefs.length === 0
      ? "No evidence"
      : step.evidenceRefs.map(formatEvidenceRef).join(", "),
  missingEvidenceLabel:
    step.missingEvidence.length === 0
      ? "No missing evidence"
      : step.missingEvidence.join(", "),
  evidenceRefs: step.evidenceRefs
});

const projectTargetOptions = (
  state: TutorialGuidedWorkflowState
): readonly TutorialTargetOptionViewModel[] => {
  const selectedKey = state.selectedTarget === null ? null : targetKey(state.selectedTarget);
  const uniqueTargets = new Map<string, TutorialStepEvidenceRef>();

  for (const step of state.steps) {
    for (const ref of step.evidenceRefs) {
      uniqueTargets.set(targetKey(ref), ref);
    }
  }

  return [...uniqueTargets.values()].map((target) => ({
    kind: target.kind,
    id: target.id,
    label: formatEvidenceRef(target),
    selected: selectedKey === targetKey(target)
  }));
};

const formatReadinessLabel = (state: TutorialGuidedWorkflowState): string => {
  const prefix = {
    notStarted: "Not started",
    inProgress: "In progress",
    ready: "Ready"
  }[state.readiness.status];

  return `${prefix}: ${state.readiness.readyStepCount} of ${state.readiness.totalStepCount} tutorial steps ready`;
};

const formatSelectedTargetLabel = (
  target: TutorialSelectedTargetState | null
): string => target === null ? "No tutorial target selected" : formatEvidenceRef(target);

const canApplySmallEdit = (state: TutorialGuidedWorkflowState): boolean =>
  state.steps.some(
    (step) =>
      step.stepId === "generatedDrawableMesh" &&
      step.status === "ready" &&
      step.evidenceRefs.some((ref) => ref.kind === "mesh")
  );

const formatEvidenceRef = (ref: TutorialStepEvidenceRef): string =>
  `${tutorialTargetKindLabels[ref.kind]} ${ref.id}`;

const targetKey = (target: Pick<TutorialSelectedTargetState, "kind" | "id">): string =>
  `${target.kind}:${target.id}`;

const tutorialStepTitles: Record<TutorialGuidedStepId, string> = {
  partLayerSelection: "Part and layer selection",
  generatedDrawableMesh: "Generated drawable and mesh",
  textureMetadata: "Texture metadata",
  maskOrOpacity: "Mask or opacity evidence",
  rotation2dRigKeyform: "rotation2d rig-control keyform",
  dynamicsEvidence: "Dynamics evidence",
  previewViewerValidator: "Preview, Viewer, and Validator evidence",
  browserLocalSaveLoad: "Browser-local save/load"
};

const tutorialTargetKindLabels: Record<TutorialTargetKind, string> = {
  package: "Package",
  part: "Part",
  drawable: "Drawable",
  mesh: "Mesh",
  texture: "Texture",
  maskRelation: "Mask relation",
  opacityKeyform: "Opacity keyform",
  rigControl: "Rig control",
  keyformSet: "Keyform set",
  dynamicsGroup: "Dynamics group",
  runtimeEvidence: "Runtime evidence",
  validationReport: "Validation report",
  tutorialReadinessReport: "Tutorial readiness report",
  viewerRuntime: "Viewer runtime",
  reload: "Reload"
};
