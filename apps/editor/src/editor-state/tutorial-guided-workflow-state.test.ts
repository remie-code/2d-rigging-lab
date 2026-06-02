import { describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MaskRelationIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  applyCommittedOperationSummary,
  createInitialEditorSemanticState,
  openViewerRuntimeSurface,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState,
  selectTutorialTargetInEditorState,
  type TutorialReadinessPreflightState
} from "./index.js";

describe("tutorial guided workflow state", () => {
  it("starts as a deterministic draft recipe with no unsupported capability claims", () => {
    const state = createInitialEditorSemanticState();
    const viewModel = projectEditorWorkflowViewModel(state).tutorialGuidedWorkflow;

    expect(state.tutorialGuidedWorkflow.recipe).toMatchObject({
      recipeId: "tutorialMiniModelV0",
      recipeVersion: "v0",
      targetKind: "rightsCleanSyntheticMiniModel"
    });
    expect(state.tutorialGuidedWorkflow.recipe.nonGoalClaims).toEqual([
      "realAssetImport",
      "imageDecode",
      "filePicker",
      "archiveImportExport",
      "fullRenderer",
      "pixelOracle",
      "publicTutorialDistribution",
      "cubismCompatibility"
    ]);
    expect(state.tutorialGuidedWorkflow.readiness).toMatchObject({
      status: "notStarted",
      readyStepCount: 0,
      totalStepCount: 8
    });
    expect(state.tutorialGuidedWorkflow.steps.map((step) => step.status)).toEqual([
      "missingEvidence",
      "missingEvidence",
      "missingEvidence",
      "missingEvidence",
      "missingEvidence",
      "missingEvidence",
      "missingEvidence",
      "missingEvidence"
    ]);
    expect(viewModel).toMatchObject({
      recipeId: "tutorialMiniModelV0",
      recipeLabel: "Tutorial Mini Model v0",
      readinessStatus: "notStarted",
      readinessLabel: "Not started: 0 of 8 tutorial steps ready",
      selectedTargetLabel: "No tutorial target selected",
      targetOptions: []
    });
    expect(viewModel.nonGoalLabel).toContain("no real asset import");
    expect(viewModel.nonGoalLabel).toContain("no image decode");
    expect(viewModel.nonGoalLabel).toContain("no full renderer");
    expect(viewModel.nonGoalLabel).toContain("no Cubism compatibility");
  });

  it("projects tutorial readiness from existing semantic editor capabilities", () => {
    const loaded = projectLoadedPackageState({
      identity: {
        packageId: "pkg_tutorial_mini",
        packageDisplayName: "Tutorial Mini Model",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 1,
        authoringRevision: 1
      },
      parameters: [
        {
          parameterId: ParameterIdSchema.parse("param_head_yaw"),
          displayName: "Head Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        },
        {
          parameterId: ParameterIdSchema.parse("param_hair_sway"),
          displayName: "Hair Sway",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ],
      parts: [
        {
          partId: PartIdSchema.parse("part_body"),
          displayName: "Body",
          childPartIds: [PartIdSchema.parse("part_head")],
          drawableIds: [DrawableIdSchema.parse("draw_body")]
        },
        {
          partId: PartIdSchema.parse("part_head"),
          displayName: "Head",
          parentPartId: PartIdSchema.parse("part_body"),
          childPartIds: [],
          drawableIds: [
            DrawableIdSchema.parse("draw_face"),
            DrawableIdSchema.parse("draw_front_hair")
          ]
        }
      ],
      drawables: [
        {
          drawableId: DrawableIdSchema.parse("draw_body"),
          displayName: "Body",
          partId: PartIdSchema.parse("part_body"),
          sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
          textureId: TextureIdSchema.parse("tex_body"),
          meshId: MeshIdSchema.parse("mesh_body"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
        },
        {
          drawableId: DrawableIdSchema.parse("draw_face"),
          displayName: "Face",
          partId: PartIdSchema.parse("part_head"),
          sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
          textureId: TextureIdSchema.parse("tex_face"),
          meshId: MeshIdSchema.parse("mesh_face"),
          defaultOpacity: 0.85,
          runtimeVisibility: true,
          baseDrawOrder: 1,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
        },
        {
          drawableId: DrawableIdSchema.parse("draw_front_hair"),
          displayName: "Front Hair",
          partId: PartIdSchema.parse("part_head"),
          sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
          textureId: TextureIdSchema.parse("tex_hair"),
          meshId: MeshIdSchema.parse("mesh_front_hair"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 2,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
        }
      ],
      drawOrderEntries: [
        {
          drawableId: DrawableIdSchema.parse("draw_body"),
          baseDrawOrder: 0,
          stableOrder: 0
        },
        {
          drawableId: DrawableIdSchema.parse("draw_face"),
          baseDrawOrder: 1,
          stableOrder: 1
        },
        {
          drawableId: DrawableIdSchema.parse("draw_front_hair"),
          baseDrawOrder: 2,
          stableOrder: 2
        }
      ],
      meshes: [
        createTriangleMesh("mesh_body", "draw_body"),
        createTriangleMesh("mesh_face", "draw_face"),
        createTriangleMesh("mesh_front_hair", "draw_front_hair")
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_body"),
            filePath: "assets/textures/tutorial/body.metadata.json",
            sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
            sourceLayerId: "layer_body",
            provenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
          },
          {
            textureId: TextureIdSchema.parse("tex_face"),
            filePath: "assets/textures/tutorial/face.metadata.json",
            sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
            sourceLayerId: "layer_face",
            provenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
          },
          {
            textureId: TextureIdSchema.parse("tex_hair"),
            filePath: "assets/textures/tutorial/hair.metadata.json",
            sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
            sourceLayerId: "layer_front_hair",
            provenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
          }
        ]
      },
      masks: [
        {
          maskRelationId: MaskRelationIdSchema.parse("maskrel_hair_over_face"),
          maskDrawableIds: [DrawableIdSchema.parse("draw_front_hair")],
          targetDrawableIds: [DrawableIdSchema.parse("draw_face")],
          enabled: true
        }
      ],
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RigControlIdSchema.parse("rig_head_rotation"),
          displayName: "Head Rotation",
          partId: PartIdSchema.parse("part_head"),
          childDrawableIds: [
            DrawableIdSchema.parse("draw_face"),
            DrawableIdSchema.parse("draw_front_hair")
          ],
          childRigControlIds: [],
          pivot: { x: 16, y: 20 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ],
      keyformSets: [
        {
          keyformSetId: KeyformSetIdSchema.parse("keyset_head_rotation_angle"),
          target: {
            kind: "rigControl",
            id: RigControlIdSchema.parse("rig_head_rotation"),
            property: "angleDegrees"
          },
          parameterId: ParameterIdSchema.parse("param_head_yaw"),
          evaluator: "linear-1d-v1",
          interpolation: "linear-1d-v1",
          compositionMode: "replace",
          compositionOrder: 0,
          keys: [
            {
              value: 1,
              statePatch: 18
            }
          ]
        }
      ],
      dynamicsGroups: [
        {
          dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_hair_sway"),
          displayName: "Hair Sway",
          enabled: true,
          solverKind: "scalarDampedFollowV1",
          drivers: [
            {
              driverId: "drv_head_yaw",
              sourceParameterId: ParameterIdSchema.parse("param_head_yaw"),
              inputScale: 1,
              inputOffset: 0,
              invert: false
            }
          ],
          output: {
            outputId: "out_hair_sway",
            targetParameterId: ParameterIdSchema.parse("param_hair_sway"),
            outputScale: 1,
            outputOffset: 0,
            min: -1,
            max: 1,
            clampPolicy: "clamp-to-output-range"
          },
          settings: {
            stiffness: 0.2,
            damping: 0.4
          },
          resetPolicy: "reset-on-manual-command"
        }
      ],
      editorState: {
        schemaVersion: "editor-state-v1",
        selection: [DrawableIdSchema.parse("draw_face")],
        lockedIds: [],
        editorHiddenIds: []
      }
    });
    const withViewerOpen = {
      ...loaded,
      viewerRuntime: openViewerRuntimeSurface(loaded.viewerRuntime)
    };
    const state = applyCommittedOperationSummary(withViewerOpen, {
      result: {
        operationId: "op_tutorial_projection",
        operationType: "tutorial.readinessProjection",
        status: "committed",
        precondition: {
          ok: true
        },
        reversible: false
      },
      operationLogEntries: [
        {
          operationId: "op_tutorial_projection",
          operationType: "tutorial.readinessProjection",
          surface: "gui",
          timestamp: "2026-06-02T00:00:00.000Z",
          targetIds: ["pkg_tutorial_mini"]
        }
      ],
      generatedEvidence: {
        runtimeSnapshotIds: ["snap_tutorial_ready"],
        validationReportIds: ["val_tutorial_ready"]
      },
      tutorialReadinessPreflight: {
        status: "pass",
        reportId: "val_tutorial_ready_tutorialReadiness",
        checkCount: 12,
        failingCheckIds: [],
        runtimeSnapshotIds: ["snap_tutorial_ready"],
        supplementalGuiEvidenceRefs: ["viewer:semantic-evidence"]
      },
      reload: {
        status: "reloaded",
        source: "browserLocalLoad",
        packageRevision: 2,
        parameterIds: ["param_head_yaw", "param_hair_sway"],
        drawableIds: ["draw_body", "draw_face", "draw_front_hair"],
        filePaths: ["manifest.json", "model/graph.json", "operations/log.jsonl"]
      }
    });
    const tutorial = state.tutorialGuidedWorkflow;
    const viewModel = projectEditorWorkflowViewModel(state).tutorialGuidedWorkflow;

    expect(tutorial.selectedTarget).toEqual({
      kind: "drawable",
      id: "draw_face"
    });
    expect(tutorial.readiness).toMatchObject({
      status: "ready",
      readyStepCount: 8,
      totalStepCount: 8,
      missingStepIds: []
    });
    expect(tutorial.steps.map((step) => [step.stepId, step.status])).toEqual([
      ["partLayerSelection", "ready"],
      ["generatedDrawableMesh", "ready"],
      ["textureMetadata", "ready"],
      ["maskOrOpacity", "ready"],
      ["rotation2dRigKeyform", "ready"],
      ["dynamicsEvidence", "ready"],
      ["previewViewerValidator", "ready"],
      ["browserLocalSaveLoad", "ready"]
    ]);
    expect(viewModel.readinessLabel).toBe("Ready: 8 of 8 tutorial steps ready");
    expect(viewModel.selectedTargetLabel).toBe("Drawable draw_face");
    expect(viewModel.targetOptions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "drawable",
          id: "draw_face",
          selected: true
        }),
        expect.objectContaining({
          kind: "rigControl",
          id: "rig_head_rotation"
        }),
        expect.objectContaining({
          kind: "tutorialReadinessReport",
          id: "val_tutorial_ready_tutorialReadiness"
        }),
        expect.objectContaining({
          kind: "reload",
          id: "packageRevision:2"
        })
      ])
    );
  });

  it("preserves an explicit selected tutorial target while the target still exists", () => {
    const loaded = projectLoadedPackageState({
      identity: {
        packageId: "pkg_tutorial_target",
        packageDisplayName: "Tutorial Target",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      rigControls: [
        {
          kind: "rotation2d",
          rigControlId: RigControlIdSchema.parse("rig_face_rotation"),
          displayName: "Face Rotation",
          partId: PartIdSchema.parse("part_face"),
          childDrawableIds: [],
          childRigControlIds: [],
          pivot: { x: 0, y: 0 },
          restAngleDegrees: 0,
          restTranslation: { x: 0, y: 0 },
          restScale: { x: 1, y: 1 },
          enabled: true
        }
      ]
    });
    const selected = selectTutorialTargetInEditorState(loaded, {
      kind: "rigControl",
      id: "rig_face_rotation"
    });
    const state = applyCommittedOperationSummary(selected, {
      result: {
        operationId: "op_noop",
        operationType: "tutorial.noop",
        status: "committed",
        precondition: {
          ok: true
        },
        reversible: false
      },
      operationLogEntries: []
    });

    expect(state.tutorialGuidedWorkflow.selectedTarget).toEqual({
      kind: "rigControl",
      id: "rig_face_rotation"
    });
  });

  it("preserves tutorial readiness preflight when an unrelated commit omits generatedEvidence", () => {
    const ready = createReadyTutorialState();
    const state = applyCommittedOperationSummary(ready, {
      result: {
        operationId: "op_unrelated_metadata",
        operationType: "tutorial.unrelatedMetadata",
        status: "committed",
        precondition: {
          ok: true
        },
        reversible: false
      },
      operationLogEntries: [
        {
          operationId: "op_unrelated_metadata",
          operationType: "tutorial.unrelatedMetadata",
          surface: "gui",
          timestamp: "2026-06-02T00:10:00.000Z",
          targetIds: ["pkg_tutorial_ready_fixture"]
        }
      ]
    });
    const previewViewerValidator = state.tutorialGuidedWorkflow.steps.find(
      (step) => step.stepId === "previewViewerValidator"
    );

    expect(state.generatedEvidence).toEqual(ready.generatedEvidence);
    expect(state.tutorialReadinessPreflight).toEqual(ready.tutorialReadinessPreflight);
    expect(previewViewerValidator).toMatchObject({
      status: "ready",
      evidenceRefs: expect.arrayContaining([
        {
          kind: "runtimeEvidence",
          id: "snap_tutorial_ready_fixture"
        },
        {
          kind: "tutorialReadinessReport",
          id: "val_tutorial_ready_fixture_tutorialReadiness"
        }
      ])
    });
    expect(state.tutorialGuidedWorkflow.readiness).toMatchObject({
      status: "ready",
      readyStepCount: 8
    });
  });

  it("does not treat generic validation reports as tutorial readiness validator evidence", () => {
    const state = createReadyTutorialState({
      generatedEvidence: {
        runtimeSnapshotIds: ["snap_generic_runtime"],
        validationReportIds: ["val_generic_runtime"]
      },
      tutorialReadinessPreflight: {
        status: "not_run",
        reportId: null,
        checkCount: 0,
        failingCheckIds: [],
        runtimeSnapshotIds: [],
        supplementalGuiEvidenceRefs: []
      }
    });
    const previewViewerValidator = state.tutorialGuidedWorkflow.steps.find(
      (step) => step.stepId === "previewViewerValidator"
    );

    expect(previewViewerValidator).toMatchObject({
      status: "missingEvidence",
      missingEvidence: ["tutorial readiness validator pass"],
      evidenceRefs: expect.arrayContaining([
        {
          kind: "runtimeEvidence",
          id: "snap_generic_runtime"
        }
      ])
    });
    expect(previewViewerValidator?.evidenceRefs).not.toEqual(
      expect.arrayContaining([
        {
          kind: "tutorialReadinessReport",
          id: "val_generic_runtime"
        }
      ])
    );
    expect(state.tutorialGuidedWorkflow.readiness).toMatchObject({
      status: "inProgress",
      readyStepCount: 7,
      missingStepIds: ["previewViewerValidator"]
    });
  });

  it("does not select a stale layer selection ID as the tutorial target", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_stale_selection",
        packageDisplayName: "Stale Selection",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      drawables: [
        {
          drawableId: DrawableIdSchema.parse("draw_existing"),
          displayName: "Existing",
          partId: PartIdSchema.parse("part_existing"),
          sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
          textureId: TextureIdSchema.parse("tex_existing"),
          meshId: MeshIdSchema.parse("mesh_existing"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
        }
      ],
      editorState: {
        schemaVersion: "editor-state-v1",
        selection: ["draw_missing"],
        lockedIds: [],
        editorHiddenIds: []
      }
    });

    expect(state.tutorialGuidedWorkflow.selectedTarget).toEqual({
      kind: "package",
      id: "pkg_stale_selection"
    });
  });
});

const createReadyTutorialState = (
  options: {
    readonly generatedEvidence?: {
      readonly runtimeSnapshotIds?: readonly string[];
      readonly validationReportIds?: readonly string[];
    };
    readonly tutorialReadinessPreflight?: TutorialReadinessPreflightState;
  } = {}
) => {
  const loaded = projectLoadedPackageState({
    identity: {
      packageId: "pkg_tutorial_ready_fixture",
      packageDisplayName: "Tutorial Ready Fixture",
      formatVersion: "open-model-package-v1"
    },
    revision: {
      packageRevision: 1,
      authoringRevision: 1
    },
    parameters: [
      {
        parameterId: ParameterIdSchema.parse("param_tutorial_yaw"),
        displayName: "Tutorial Yaw",
        valueSource: "authoredInput",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      },
      {
        parameterId: ParameterIdSchema.parse("param_tutorial_sway"),
        displayName: "Tutorial Sway",
        valueSource: "computedDynamics",
        min: -1,
        max: 1,
        default: 0,
        recommendedUiStep: 0.01
      }
    ],
    parts: [
      {
        partId: PartIdSchema.parse("part_tutorial"),
        displayName: "Tutorial Part",
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_tutorial")]
      }
    ],
    drawables: [
      {
        drawableId: DrawableIdSchema.parse("draw_tutorial"),
        displayName: "Tutorial Drawable",
        partId: PartIdSchema.parse("part_tutorial"),
        sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
        textureId: TextureIdSchema.parse("tex_tutorial"),
        meshId: MeshIdSchema.parse("mesh_tutorial"),
        defaultOpacity: 0.9,
        runtimeVisibility: true,
        baseDrawOrder: 0,
        sourceProvenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
      }
    ],
    drawOrderEntries: [
      {
        drawableId: DrawableIdSchema.parse("draw_tutorial"),
        baseDrawOrder: 0,
        stableOrder: 0
      }
    ],
    meshes: [createTriangleMesh("mesh_tutorial", "draw_tutorial")],
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: [
        {
          textureId: TextureIdSchema.parse("tex_tutorial"),
          filePath: "assets/textures/tutorial/texture.metadata.json",
          sourceAssetId: SourceAssetIdSchema.parse("src_tutorial_synthetic"),
          sourceLayerId: "layer_tutorial",
          provenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
        }
      ]
    },
    masks: [
      {
        maskRelationId: MaskRelationIdSchema.parse("maskrel_tutorial"),
        maskDrawableIds: [DrawableIdSchema.parse("draw_tutorial")],
        targetDrawableIds: [DrawableIdSchema.parse("draw_tutorial")],
        enabled: true
      }
    ],
    rigControls: [
      {
        kind: "rotation2d",
        rigControlId: RigControlIdSchema.parse("rig_tutorial_rotation"),
        displayName: "Tutorial Rotation",
        partId: PartIdSchema.parse("part_tutorial"),
        childDrawableIds: [DrawableIdSchema.parse("draw_tutorial")],
        childRigControlIds: [],
        pivot: { x: 16, y: 16 },
        restAngleDegrees: 0,
        restTranslation: { x: 0, y: 0 },
        restScale: { x: 1, y: 1 },
        enabled: true
      }
    ],
    keyformSets: [
      {
        keyformSetId: KeyformSetIdSchema.parse("keyset_tutorial_rotation_angle"),
        target: {
          kind: "rigControl",
          id: RigControlIdSchema.parse("rig_tutorial_rotation"),
          property: "angleDegrees"
        },
        parameterId: ParameterIdSchema.parse("param_tutorial_yaw"),
        evaluator: "linear-1d-v1",
        interpolation: "linear-1d-v1",
        compositionMode: "replace",
        compositionOrder: 0,
        keys: [
          {
            value: 1,
            statePatch: 12
          }
        ]
      }
    ],
    dynamicsGroups: [
      {
        dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_tutorial_sway"),
        displayName: "Tutorial Sway",
        enabled: true,
        solverKind: "scalarDampedFollowV1",
        drivers: [
          {
            driverId: "drv_tutorial_yaw",
            sourceParameterId: ParameterIdSchema.parse("param_tutorial_yaw"),
            inputScale: 1,
            inputOffset: 0,
            invert: false
          }
        ],
        output: {
          outputId: "out_tutorial_sway",
          targetParameterId: ParameterIdSchema.parse("param_tutorial_sway"),
          outputScale: 1,
          outputOffset: 0,
          min: -1,
          max: 1,
          clampPolicy: "clamp-to-output-range"
        },
        settings: {
          stiffness: 0.2,
          damping: 0.4
        },
        resetPolicy: "reset-on-manual-command"
      }
    ],
    editorState: {
      schemaVersion: "editor-state-v1",
      selection: [DrawableIdSchema.parse("draw_tutorial")],
      lockedIds: [],
      editorHiddenIds: []
    }
  });
  const withViewerOpen = {
    ...loaded,
    viewerRuntime: openViewerRuntimeSurface(loaded.viewerRuntime)
  };

  return applyCommittedOperationSummary(withViewerOpen, {
    result: {
      operationId: "op_tutorial_ready_fixture",
      operationType: "tutorial.readyFixtureProjection",
      status: "committed",
      precondition: {
        ok: true
      },
      reversible: false
    },
    operationLogEntries: [
      {
        operationId: "op_tutorial_ready_fixture",
        operationType: "tutorial.readyFixtureProjection",
        surface: "gui",
        timestamp: "2026-06-02T00:00:00.000Z",
        targetIds: ["pkg_tutorial_ready_fixture"]
      }
    ],
    generatedEvidence: options.generatedEvidence ?? {
      runtimeSnapshotIds: ["snap_tutorial_ready_fixture"],
      validationReportIds: ["val_tutorial_ready_fixture"]
    },
    tutorialReadinessPreflight:
      options.tutorialReadinessPreflight ?? createPassingTutorialReadinessPreflight(),
    reload: {
      status: "reloaded",
      source: "browserLocalLoad",
      packageRevision: 2,
      parameterIds: ["param_tutorial_yaw", "param_tutorial_sway"],
      drawableIds: ["draw_tutorial"],
      filePaths: ["manifest.json", "model/graph.json", "operations/log.jsonl"]
    }
  });
};

const createPassingTutorialReadinessPreflight = (): TutorialReadinessPreflightState => ({
  status: "pass",
  reportId: "val_tutorial_ready_fixture_tutorialReadiness",
  checkCount: 12,
  failingCheckIds: [],
  runtimeSnapshotIds: ["snap_tutorial_ready_fixture"],
  supplementalGuiEvidenceRefs: ["viewer:semantic-evidence"]
});

const createTriangleMesh = (meshId: string, drawableId: string) => ({
  meshId: MeshIdSchema.parse(meshId),
  drawableId: DrawableIdSchema.parse(drawableId),
  vertices: [
    { x: 0, y: 0 },
    { x: 32, y: 0 },
    { x: 0, y: 32 }
  ],
  uvs: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
  ],
  triangles: [[0, 1, 2] as [number, number, number]],
  vertexStableIds: [`${meshId}_v0`, `${meshId}_v1`, `${meshId}_v2`],
  bounds: { x: 0, y: 0, width: 32, height: 32 },
  generationProvenanceId: ProvenanceIdSchema.parse("prov_tutorial_synthetic")
});
