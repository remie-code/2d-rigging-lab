import type { EditorSemanticState } from "./editor-semantic-state.js";

export const tutorialRecipeId = "tutorialMiniModelV0";

export type TutorialRecipeId = typeof tutorialRecipeId;

export type TutorialGuidedStepId =
  | "partLayerSelection"
  | "generatedDrawableMesh"
  | "textureMetadata"
  | "maskOrOpacity"
  | "rotation2dRigKeyform"
  | "dynamicsEvidence"
  | "previewViewerValidator"
  | "browserLocalSaveLoad";

export type TutorialGuidedStepStatus = "ready" | "missingEvidence";

export type TutorialReadinessStatus = "notStarted" | "inProgress" | "ready";

export type TutorialTargetKind =
  | "package"
  | "part"
  | "drawable"
  | "mesh"
  | "texture"
  | "maskRelation"
  | "opacityKeyform"
  | "rigControl"
  | "keyformSet"
  | "dynamicsGroup"
  | "runtimeEvidence"
  | "validationReport"
  | "tutorialReadinessReport"
  | "viewerRuntime"
  | "reload";

export interface TutorialRecipeState {
  readonly recipeId: TutorialRecipeId;
  readonly recipeVersion: "v0";
  readonly targetKind: "rightsCleanSyntheticMiniModel";
  readonly stepIds: readonly TutorialGuidedStepId[];
  readonly nonGoalClaims: readonly string[];
}

export interface TutorialSelectedTargetState {
  readonly kind: TutorialTargetKind;
  readonly id: string;
}

export interface TutorialStepEvidenceRef {
  readonly kind: TutorialTargetKind;
  readonly id: string;
}

export interface TutorialGuidedStepState {
  readonly stepId: TutorialGuidedStepId;
  readonly status: TutorialGuidedStepStatus;
  readonly evidenceRefs: readonly TutorialStepEvidenceRef[];
  readonly missingEvidence: readonly string[];
}

export interface TutorialReadinessSummaryState {
  readonly status: TutorialReadinessStatus;
  readonly readyStepCount: number;
  readonly totalStepCount: number;
  readonly readyStepIds: readonly TutorialGuidedStepId[];
  readonly missingStepIds: readonly TutorialGuidedStepId[];
}

export interface TutorialGuidedWorkflowState {
  readonly recipe: TutorialRecipeState;
  readonly selectedTarget: TutorialSelectedTargetState | null;
  readonly readiness: TutorialReadinessSummaryState;
  readonly steps: readonly TutorialGuidedStepState[];
}

export type TutorialGuidedWorkflowProjectionInput = Pick<
  EditorSemanticState,
  | "loadedPackage"
  | "parts"
  | "drawables"
  | "layerTreeDraft"
  | "meshEdit"
  | "textureAtlas"
  | "maskRelations"
  | "drawableOpacityKeyforms"
  | "rigControls"
  | "rigControlAngleKeyforms"
  | "dynamicsGroups"
  | "generatedEvidence"
  | "tutorialReadinessPreflight"
  | "viewerRuntime"
  | "reload"
>;

export interface TutorialGuidedWorkflowOwner {
  readonly tutorialGuidedWorkflow: TutorialGuidedWorkflowState;
}

export const tutorialGuidedStepIds: readonly TutorialGuidedStepId[] = [
  "partLayerSelection",
  "generatedDrawableMesh",
  "textureMetadata",
  "maskOrOpacity",
  "rotation2dRigKeyform",
  "dynamicsEvidence",
  "previewViewerValidator",
  "browserLocalSaveLoad"
];

export const createEmptyTutorialGuidedWorkflowState = (
  selectedTarget: TutorialSelectedTargetState | null = null
): TutorialGuidedWorkflowState => {
  const steps = tutorialGuidedStepIds.map((stepId) =>
    createStep(stepId, [], ["No editor evidence projected yet"])
  );

  return {
    recipe: createTutorialRecipeState(),
    selectedTarget,
    readiness: summarizeSteps(steps),
    steps
  };
};

export const projectTutorialGuidedWorkflowState = (
  input: TutorialGuidedWorkflowProjectionInput,
  previous: TutorialGuidedWorkflowState | null = null
): TutorialGuidedWorkflowState => {
  const steps = projectTutorialGuidedSteps(input);
  const selectedTarget = resolveSelectedTutorialTarget(input, previous?.selectedTarget ?? null);

  return {
    recipe: createTutorialRecipeState(),
    selectedTarget,
    readiness: summarizeSteps(steps),
    steps
  };
};

export const selectTutorialTarget = (
  state: TutorialGuidedWorkflowState,
  target: TutorialSelectedTargetState | null
): TutorialGuidedWorkflowState => ({
  ...state,
  selectedTarget: normalizeTutorialSelectedTarget(target)
});

export const selectTutorialTargetInEditorState = <State extends TutorialGuidedWorkflowOwner>(
  state: State,
  target: TutorialSelectedTargetState | null
): State => ({
  ...state,
  tutorialGuidedWorkflow: selectTutorialTarget(state.tutorialGuidedWorkflow, target)
});

const createTutorialRecipeState = (): TutorialRecipeState => ({
  recipeId: tutorialRecipeId,
  recipeVersion: "v0",
  targetKind: "rightsCleanSyntheticMiniModel",
  stepIds: tutorialGuidedStepIds,
  nonGoalClaims: [
    "realAssetImport",
    "imageDecode",
    "filePicker",
    "archiveImportExport",
    "fullRenderer",
    "pixelOracle",
    "publicTutorialDistribution",
    "cubismCompatibility"
  ]
});

const projectTutorialGuidedSteps = (
  input: TutorialGuidedWorkflowProjectionInput
): readonly TutorialGuidedStepState[] => [
  projectPartLayerSelectionStep(input),
  projectGeneratedDrawableMeshStep(input),
  projectTextureMetadataStep(input),
  projectMaskOrOpacityStep(input),
  projectRotation2dRigKeyformStep(input),
  projectDynamicsEvidenceStep(input),
  projectPreviewViewerValidatorStep(input),
  projectBrowserLocalSaveLoadStep(input)
];

const projectPartLayerSelectionStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const selectedDrawableIds = new Set(input.layerTreeDraft.selection);
  const selectedMeshDrawableId = input.meshEdit.selectedMesh?.drawableId ?? null;
  const selectedDrawable =
    input.drawables.find((drawable) => selectedDrawableIds.has(drawable.drawableId)) ??
    (selectedMeshDrawableId === null
      ? undefined
      : input.drawables.find((drawable) => drawable.drawableId === selectedMeshDrawableId));
  const selectedPart =
    selectedDrawable === undefined
      ? undefined
      : input.parts.find((part) => part.partId === selectedDrawable.partId);
  const evidenceRefs = compactEvidenceRefs([
    selectedPart === undefined ? null : { kind: "part", id: selectedPart.partId },
    selectedDrawable === undefined ? null : { kind: "drawable", id: selectedDrawable.drawableId }
  ]);
  const missingEvidence = [
    ...(input.parts.length === 0 ? ["part hierarchy"] : []),
    ...(input.drawables.length === 0 ? ["layer drawable"] : []),
    ...(evidenceRefs.length === 0 ? ["selected part or layer target"] : [])
  ];

  return createStep("partLayerSelection", evidenceRefs, missingEvidence);
};

const projectGeneratedDrawableMeshStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const drawableWithMesh = input.drawables.find(
    (drawable) => drawable.vertexCount > 0 && drawable.triangleCount > 0
  );
  const evidenceRefs = compactEvidenceRefs([
    drawableWithMesh === undefined ? null : { kind: "drawable", id: drawableWithMesh.drawableId },
    drawableWithMesh === undefined ? null : { kind: "mesh", id: drawableWithMesh.meshId }
  ]);

  return createStep(
    "generatedDrawableMesh",
    evidenceRefs,
    evidenceRefs.length === 0 ? ["generated drawable with mesh vertices and triangles"] : []
  );
};

const projectTextureMetadataStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const textureIds = new Set<string>(
    input.textureAtlas?.textures.map((texture) => texture.textureId) ?? []
  );
  const texturedDrawable = input.drawables.find((drawable) => textureIds.has(drawable.textureId));
  const evidenceRefs = compactEvidenceRefs([
    texturedDrawable === undefined ? null : { kind: "drawable", id: texturedDrawable.drawableId },
    texturedDrawable === undefined ? null : { kind: "texture", id: texturedDrawable.textureId }
  ]);

  return createStep(
    "textureMetadata",
    evidenceRefs,
    evidenceRefs.length === 0 ? ["texture atlas metadata assigned to a drawable"] : []
  );
};

const projectMaskOrOpacityStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const maskRelation = input.maskRelations.find((relation) => relation.enabled);
  const opacityKeyform = input.drawableOpacityKeyforms[0];
  const opacityDrawable = input.drawables.find((drawable) => drawable.defaultOpacity !== 1);
  const evidenceRefs = compactEvidenceRefs([
    maskRelation === undefined ? null : { kind: "maskRelation", id: maskRelation.maskRelationId },
    opacityKeyform === undefined ? null : { kind: "opacityKeyform", id: opacityKeyform.keyformSetId },
    opacityDrawable === undefined ? null : { kind: "drawable", id: opacityDrawable.drawableId }
  ]);

  return createStep(
    "maskOrOpacity",
    evidenceRefs,
    evidenceRefs.length === 0 ? ["enabled mask relation or authored opacity evidence"] : []
  );
};

const projectRotation2dRigKeyformStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const rotation2dRigControl = input.rigControls.find(
    (rigControl) => rigControl.kind === "rotation2d" && rigControl.enabled
  );
  const angleKeyform =
    rotation2dRigControl === undefined
      ? undefined
      : input.rigControlAngleKeyforms.find(
          (keyform) => keyform.rigControlId === rotation2dRigControl.rigControlId
        );
  const evidenceRefs = compactEvidenceRefs([
    rotation2dRigControl === undefined
      ? null
      : { kind: "rigControl", id: rotation2dRigControl.rigControlId },
    angleKeyform === undefined ? null : { kind: "keyformSet", id: angleKeyform.keyformSetId }
  ]);
  const missingEvidence = [
    ...(rotation2dRigControl === undefined ? ["enabled rotation2d rig control"] : []),
    ...(angleKeyform === undefined ? ["rigControl:angleDegrees keyform"] : [])
  ];

  return createStep("rotation2dRigKeyform", evidenceRefs, missingEvidence);
};

const projectDynamicsEvidenceStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const dynamicsGroup = input.dynamicsGroups.find((group) => group.enabled);
  const evidenceRefs = compactEvidenceRefs([
    dynamicsGroup === undefined ? null : { kind: "dynamicsGroup", id: dynamicsGroup.dynamicsGroupId }
  ]);

  return createStep(
    "dynamicsEvidence",
    evidenceRefs,
    evidenceRefs.length === 0 ? ["enabled scalar dynamics group"] : []
  );
};

const projectPreviewViewerValidatorStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const runtimeEvidenceId =
    input.tutorialReadinessPreflight.runtimeSnapshotIds[0] ??
    input.generatedEvidence.runtimeSnapshotIds[0] ??
    input.generatedEvidence.runtimeStateArtifactPaths[0] ??
    input.generatedEvidence.runtimeStateSequenceArtifactPaths[0];
  const tutorialReadinessReportId = input.tutorialReadinessPreflight.reportId;
  const hasTutorialReadinessPass = input.tutorialReadinessPreflight.status === "pass";
  const evidenceRefs = compactEvidenceRefs([
    runtimeEvidenceId === undefined ? null : { kind: "runtimeEvidence", id: runtimeEvidenceId },
    tutorialReadinessReportId === null
      ? null
      : { kind: "tutorialReadinessReport", id: tutorialReadinessReportId },
    input.viewerRuntime.surface === "open" ? { kind: "viewerRuntime", id: "viewerRuntime" } : null
  ]);
  const missingEvidence = [
    ...(runtimeEvidenceId === undefined ? ["semantic Preview or Viewer runtime evidence"] : []),
    ...(hasTutorialReadinessPass ? [] : ["tutorial readiness validator pass"])
  ];

  return createStep("previewViewerValidator", evidenceRefs, missingEvidence);
};

const projectBrowserLocalSaveLoadStep = (
  input: TutorialGuidedWorkflowProjectionInput
): TutorialGuidedStepState => {
  const isBrowserLocalReloaded =
    input.reload.status === "reloaded" && input.reload.source === "browserLocalLoad";
  const evidenceRefs = compactEvidenceRefs([
    isBrowserLocalReloaded
      ? { kind: "reload", id: `packageRevision:${input.reload.packageRevision}` }
      : null,
    input.loadedPackage === null ? null : { kind: "package", id: input.loadedPackage.packageId }
  ]);

  return createStep(
    "browserLocalSaveLoad",
    evidenceRefs,
    isBrowserLocalReloaded ? [] : ["browser-local save/load reload summary"]
  );
};

const createStep = (
  stepId: TutorialGuidedStepId,
  evidenceRefs: readonly TutorialStepEvidenceRef[],
  missingEvidence: readonly string[]
): TutorialGuidedStepState => ({
  stepId,
  status: missingEvidence.length === 0 ? "ready" : "missingEvidence",
  evidenceRefs,
  missingEvidence
});

const summarizeSteps = (
  steps: readonly TutorialGuidedStepState[]
): TutorialReadinessSummaryState => {
  const readyStepIds = steps
    .filter((step) => step.status === "ready")
    .map((step) => step.stepId);
  const missingStepIds = steps
    .filter((step) => step.status !== "ready")
    .map((step) => step.stepId);

  return {
    status:
      readyStepIds.length === 0
        ? "notStarted"
        : readyStepIds.length === steps.length
          ? "ready"
          : "inProgress",
    readyStepCount: readyStepIds.length,
    totalStepCount: steps.length,
    readyStepIds,
    missingStepIds
  };
};

const resolveSelectedTutorialTarget = (
  input: TutorialGuidedWorkflowProjectionInput,
  previousTarget: TutorialSelectedTargetState | null
): TutorialSelectedTargetState | null => {
  const normalizedPreviousTarget = normalizeTutorialSelectedTarget(previousTarget);
  if (
    normalizedPreviousTarget !== null &&
    tutorialTargetExists(input, normalizedPreviousTarget)
  ) {
    return normalizedPreviousTarget;
  }

  const selectedDrawableId = input.layerTreeDraft.selection.find((drawableId) =>
    input.drawables.some((drawable) => drawable.drawableId === drawableId)
  );
  if (selectedDrawableId !== undefined) {
    return { kind: "drawable", id: selectedDrawableId };
  }

  const selectedMesh = input.meshEdit.selectedMesh;
  if (selectedMesh !== null) {
    return { kind: "mesh", id: selectedMesh.meshId };
  }

  if (input.loadedPackage !== null) {
    return { kind: "package", id: input.loadedPackage.packageId };
  }

  return null;
};

const normalizeTutorialSelectedTarget = (
  target: TutorialSelectedTargetState | null
): TutorialSelectedTargetState | null => {
  if (target === null) {
    return null;
  }

  const id = target.id.trim();

  return id.length === 0 ? null : { kind: target.kind, id };
};

const tutorialTargetExists = (
  input: TutorialGuidedWorkflowProjectionInput,
  target: TutorialSelectedTargetState
): boolean => {
  switch (target.kind) {
    case "package":
      return input.loadedPackage?.packageId === target.id;
    case "part":
      return input.parts.some((part) => part.partId === target.id);
    case "drawable":
      return input.drawables.some((drawable) => drawable.drawableId === target.id);
    case "mesh":
      return input.drawables.some((drawable) => drawable.meshId === target.id);
    case "texture":
      return (input.textureAtlas?.textures ?? []).some((texture) => texture.textureId === target.id);
    case "maskRelation":
      return input.maskRelations.some((relation) => relation.maskRelationId === target.id);
    case "opacityKeyform":
      return input.drawableOpacityKeyforms.some((keyform) => keyform.keyformSetId === target.id);
    case "rigControl":
      return input.rigControls.some((rigControl) => rigControl.rigControlId === target.id);
    case "keyformSet":
      return input.rigControlAngleKeyforms.some((keyform) => keyform.keyformSetId === target.id);
    case "dynamicsGroup":
      return input.dynamicsGroups.some((group) => group.dynamicsGroupId === target.id);
    case "runtimeEvidence":
      return [
        ...input.generatedEvidence.runtimeSnapshotIds,
        ...input.generatedEvidence.runtimeStateArtifactPaths,
        ...input.generatedEvidence.runtimeStateSequenceArtifactPaths
      ].includes(target.id);
    case "validationReport":
      return [
        ...input.generatedEvidence.validationReportIds,
        ...input.generatedEvidence.validationReportArtifactPaths
      ].includes(target.id);
    case "tutorialReadinessReport":
      return input.tutorialReadinessPreflight.reportId === target.id;
    case "viewerRuntime":
      return target.id === "viewerRuntime" && input.viewerRuntime.surface === "open";
    case "reload":
      return (
        target.id === `packageRevision:${input.reload.packageRevision}` &&
        input.reload.status === "reloaded" &&
        input.reload.source === "browserLocalLoad"
      );
  }
};

const compactEvidenceRefs = (
  refs: readonly (TutorialStepEvidenceRef | null)[]
): readonly TutorialStepEvidenceRef[] => refs.filter((ref): ref is TutorialStepEvidenceRef => ref !== null);
