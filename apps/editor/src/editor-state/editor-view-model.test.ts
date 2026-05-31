import { describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  applyCommittedOperationSummary,
  createInitialEditorSemanticState,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "./index.js";

describe("editor semantic state view model", () => {
  it("projects an empty initial state", () => {
    const state = createInitialEditorSemanticState();
    const viewModel = projectEditorWorkflowViewModel(state);

    expect(state.loadedPackage).toBeNull();
    expect(state.parameters).toEqual([]);
    expect(state.operationLog.entryCount).toBe(0);
    expect(viewModel).toMatchObject({
      packageTitle: "No package loaded",
      packageRevisionLabel: "Package r0 / authoring r0",
      isPackageLoaded: false,
      parameterCountLabel: "0 parameters",
      drawableCountLabel: "0 drawables",
      canSubmitCreateParameter: false,
      canSubmitCreateDrawable: false,
      lastOperationLabel: "No operation committed",
      operationLogLabel: "0 operations",
      generatedEvidenceLabel: "0 runtime / 0 validation artifacts",
      reloadLabel: "Not reloaded"
    });
    expect(viewModel.drawableAuthoring).toMatchObject({
      hasDrawables: false,
      drawableCountLabel: "0 drawables",
      canSubmitCreateDrawable: false,
      defaultDisplayName: "Generated Drawable",
      resultLabel: "Drawable preset ready"
    });
    expect(viewModel.meshEdit).toMatchObject({
      selectedMesh: null,
      editableVertices: [],
      hasSelectedMesh: false,
      hasEditableVertices: false,
      canNudgeSelectedMesh: false,
      selectedMeshLabel: "No mesh selected",
      lastMeshEditResultLabel: "No mesh edit committed"
    });
  });

  it("summarizes a committed createParameter operation for the view model", () => {
    const loaded = projectLoadedPackageState({
      identity: {
        packageId: "pkg_minimal",
        packageDisplayName: "Minimal Package",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      }
    });

    const state = applyCommittedOperationSummary(loaded, {
      result: {
        operationId: "op_create_smile",
        operationType: "createParameter",
        status: "committed",
        precondition: {
          ok: true
        },
        reversible: true
      },
      operationLogEntries: [
        {
          operationId: "op_create_smile",
          operationType: "createParameter",
          surface: "gui",
          timestamp: "2026-05-29T00:00:00.000Z",
          targetIds: ["param_smile"]
        }
      ],
      generatedEvidence: {
        runtimeSnapshotIds: ["snapshot_after_smile"],
        runtimeStateArtifactPaths: ["runtime/states/pkg_minimal-r1-after.runtime-state.json"],
        validationReportIds: ["val_after_smile"],
        validationReportArtifactPaths: ["validation/reports/val_after_smile.validation.json"]
      },
      revision: {
        packageRevision: 1,
        authoringRevision: 1
      },
      parameters: [
        {
          parameterId: "param_smile",
          displayName: "Smile",
          valueSource: "authoredInput",
          min: 0,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ],
      reload: {
        status: "reloaded",
        packageRevision: 1,
        parameterIds: ["param_smile"],
        filePaths: ["model/parameters.json", "operations/log.jsonl"]
      }
    });
    const viewModel = projectEditorWorkflowViewModel(state);

    expect(state.lastOperationResult).toMatchObject({
      operationId: "op_create_smile",
      operationType: "createParameter",
      status: "committed",
      preconditionOk: true
    });
    expect(state.operationLog.latestEntry).toMatchObject({
      operationId: "op_create_smile",
      surface: "gui",
      targetIds: ["param_smile"]
    });
    expect(state.parameters).toEqual([
      {
        parameterId: "param_smile",
        displayName: "Smile",
        valueSource: "authoredInput",
        min: 0,
        max: 1,
        defaultValue: 0,
        recommendedUiStep: 0.01
      }
    ]);
    expect(viewModel).toMatchObject({
      packageTitle: "Minimal Package",
      packageRevisionLabel: "Package r1 / authoring r1",
      isPackageLoaded: true,
      parameterCountLabel: "1 parameter",
      canSubmitCreateParameter: true,
      lastOperationLabel: "createParameter committed",
      operationLogLabel: "1 operation",
      generatedEvidenceLabel: "2 runtime / 2 validation artifacts",
      reloadLabel: "Reloaded r1 with 1 parameter / 0 drawables"
    });
    expect(viewModel.previewControls).toMatchObject({
      hasParameters: true,
      parameterCountLabel: "1 preview parameter",
      resetLabel: "Reset preview parameters",
      authoredInputCount: 1,
      parameterControls: [
        {
          parameterId: "param_smile",
          displayName: "Smile",
          min: 0,
          max: 1,
          defaultValue: 0,
          currentValue: 0,
          disabled: false,
          label: "Smile",
          valueLabel: "Smile: 0",
          rangeLabel: "0 to 1",
          defaultValueLabel: "Default 0",
          disabledMessage: null
        }
      ]
    });
  });

  it("projects binary source and texture refs through the editor source intake view model", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_binary_refs",
        packageDisplayName: "Binary Ref Package",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      sourceAssets: [
        {
          sourceAssetId: SourceAssetIdSchema.parse("src_binary_psd"),
          kind: "psd-source-v1",
          filePath: "assets/sources/binary/source.psd",
          contentHash: "sha256:binary-source",
          importProfile: "layered-character-psd-profile-v1",
          binaryAssetRef: createEditorBinaryAssetRef({
            binaryAssetId: "bin_binary_source",
            packageRelativePath: "assets/sources/binary/source.psd",
            mediaType: "application/vnd.adobe.photoshop",
            byteLength: 8192,
            storageStatus: "stored-package-local-v1",
            digestHex: "c".repeat(64)
          }),
          layers: [
            {
              sourceLayerId: "layer_face",
              sourceAssetId: SourceAssetIdSchema.parse("src_binary_psd"),
              originalName: "Face",
              normalizedName: "face",
              groupPath: ["Root"],
              bounds: { x: 0, y: 0, width: 64, height: 64 },
              visibleInSource: true,
              opacityInSource: 1,
              role: "editableLayer",
              unsupportedFeatures: [],
              mappedDrawableIds: []
            }
          ],
          diagnostics: []
        }
      ],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TextureIdSchema.parse("tex_binary_face"),
            filePath: "assets/textures/binary_face.png",
            sourceAssetId: SourceAssetIdSchema.parse("src_binary_psd"),
            sourceLayerId: "layer_face",
            provenanceId: ProvenanceIdSchema.parse("prov_binary_source"),
            binaryAssetRef: createEditorBinaryAssetRef({
              binaryAssetId: "bin_binary_texture",
              packageRelativePath: "assets/textures/binary_face.png",
              mediaType: "image/png",
              byteLength: 1024,
              storageStatus: "missing-package-local-bytes-v1",
              digestHex: "d".repeat(64)
            })
          }
        ]
      }
    });

    const importedAsset = projectEditorWorkflowViewModel(state).sourceIntake.importedAssets[0];

    expect(importedAsset).toMatchObject({
      sourceAssetId: "src_binary_psd",
      binaryAssetLabels: [
        expect.stringContaining("Source binary ref / bin_binary_source / stored-package-local-v1 status; bytes are not decoded by the editor"),
        expect.stringContaining("Texture binary ref tex_binary_face / bin_binary_texture / missing-package-local-bytes-v1; package-local bytes are missing")
      ],
      layers: [
        expect.objectContaining({
          textureBinaryAssetLabel: expect.stringContaining(
            "Texture binary ref tex_binary_face / bin_binary_texture"
          )
        })
      ]
    });
    expect(JSON.stringify(importedAsset)).not.toMatch(/FileReader|readFile|decoded from bytes|file picker/i);
  });

  it("projects drawable list and create drawable defaults for workflow UI", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_drawable",
        packageDisplayName: "Drawable Package",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      parts: [
        {
          partId: PartIdSchema.parse("part_root"),
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DrawableIdSchema.parse("draw_body")]
        }
      ],
      sourceAssets: [
        {
          sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
          kind: "generated-fixture-v1",
          filePath: "assets/sources/generated/body.json",
          contentHash: "sha256:body",
          importProfile: "split-png-fallback-v1",
          layers: [
            {
              sourceLayerId: "layer_body",
              sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
              originalName: "Body",
              normalizedName: "body",
              groupPath: ["Root"],
              bounds: { x: 10, y: 12, width: 34, height: 56 },
              visibleInSource: true,
              opacityInSource: 1,
              role: "editableLayer",
              unsupportedFeatures: [],
              mappedDrawableIds: [DrawableIdSchema.parse("draw_body")]
            }
          ],
          diagnostics: []
        }
      ],
      canvasSize: { width: 128, height: 128 },
      drawables: [
        {
          drawableId: DrawableIdSchema.parse("draw_star"),
          displayName: "Star",
          partId: PartIdSchema.parse("part_root"),
          sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
          textureId: TextureIdSchema.parse("tex_star"),
          meshId: MeshIdSchema.parse("mesh_star"),
          defaultOpacity: 1,
          runtimeVisibility: false,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
        },
        {
          drawableId: DrawableIdSchema.parse("draw_body"),
          displayName: "Body",
          partId: PartIdSchema.parse("part_root"),
          sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
          textureId: TextureIdSchema.parse("tex_body"),
          meshId: MeshIdSchema.parse("mesh_body"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ],
      drawOrderEntries: [
        {
          drawableId: DrawableIdSchema.parse("draw_body"),
          baseDrawOrder: 1,
          stableOrder: 1
        },
        {
          drawableId: DrawableIdSchema.parse("draw_star"),
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      meshes: [
        {
          meshId: MeshIdSchema.parse("mesh_star"),
          drawableId: DrawableIdSchema.parse("draw_star"),
          vertices: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
            { x: 10, y: 10 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 }
          ],
          triangles: [[0, 1, 2], [1, 3, 2]],
          vertexStableIds: ["s0", "s1", "s2", "s3"],
          bounds: { x: 0, y: 0, width: 10, height: 10 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
        },
        {
          meshId: MeshIdSchema.parse("mesh_body"),
          drawableId: DrawableIdSchema.parse("draw_body"),
          vertices: [
            { x: 10, y: 12 },
            { x: 44, y: 12 },
            { x: 10, y: 68 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          triangles: [[0, 1, 2]],
          vertexStableIds: ["v0", "v1", "v2"],
          bounds: { x: 10, y: 12, width: 34, height: 56 },
          generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
        }
      ]
    });
    const viewModel = projectEditorWorkflowViewModel(state);

    expect(state.pendingCreateDrawable).toMatchObject({
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body",
      partId: "part_root",
      initialBounds: { x: 10, y: 12, width: 34, height: 56 },
      meshMethod: "auto-grid-v1",
      densityHint: "medium"
    });
    expect(viewModel).toMatchObject({
      drawableCountLabel: "2 drawables",
      canSubmitCreateDrawable: true
    });
    expect(viewModel.drawableAuthoring).toMatchObject({
      hasDrawables: true,
      drawableCountLabel: "2 drawables",
      canSubmitCreateDrawable: true,
      sourceLabel: "src_generated / layer_body",
      partLabel: "part_root",
      boundsLabel: "10, 12 / 34 x 56",
      meshMethodLabel: "auto-grid-v1 / medium",
      drawables: [
        {
          drawableId: "draw_star",
          displayName: "Star",
          meshId: "mesh_star",
          visible: false,
          baseDrawOrder: 0,
          stableOrder: 0,
          orderIndex: 0,
          visibilityLabel: "Hidden",
          canMoveLayerUp: true,
          canMoveLayerDown: false,
          baseDrawOrderLabel: "Draw order 0",
          layerOrderLabel: "Layer 1",
          meshSummaryLabel: "4 vertices / 2 triangles",
          boundsLabel: "0, 0 / 10 x 10"
        },
        {
          drawableId: "draw_body",
          displayName: "Body",
          meshId: "mesh_body",
          visible: true,
          baseDrawOrder: 1,
          stableOrder: 1,
          orderIndex: 1,
          visibilityLabel: "Visible",
          canMoveLayerUp: false,
          canMoveLayerDown: true,
          baseDrawOrderLabel: "Draw order 1",
          layerOrderLabel: "Layer 2",
          meshSummaryLabel: "3 vertices / 1 triangles",
          boundsLabel: "10, 12 / 34 x 56"
        }
      ]
    });
    expect(viewModel.drawableLayers).toMatchObject({
      hasDrawables: true,
      hasMultipleDrawables: true,
      layerCountLabel: "2 layers",
      lastLayerOperationLabel: "No layer operation committed",
      orderedDrawables: [
        {
          drawableId: "draw_star",
          runtimeVisibilityLabel: "Hidden",
          orderLabel: "Layer 1 / draw order 0",
          canMoveUp: true,
          canMoveDown: false,
          visibilityToggleLabel: "Show Star"
        },
        {
          drawableId: "draw_body",
          runtimeVisibilityLabel: "Visible",
          orderLabel: "Layer 2 / draw order 1",
          canMoveUp: false,
          canMoveDown: true,
          visibilityToggleLabel: "Hide Body"
        }
      ]
    });
  });

  it("projects disabled preview controls for non-authored parameters", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_dynamics",
        packageDisplayName: "Dynamics Package",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      },
      parameters: [
        {
          parameterId: "param_hair_sway",
          displayName: "Hair Sway",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        }
      ]
    });

    expect(projectEditorWorkflowViewModel(state).previewControls).toMatchObject({
      authoredInputCount: 0,
      parameterControls: [
        {
          parameterId: "param_hair_sway",
          disabled: true,
          disabledMessage: "Preview control disabled for computedDynamics parameter"
        }
      ]
    });
  });

  it("projects dynamics authoring controls and group state for the editor panel", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_dynamics_authoring",
        packageDisplayName: "Dynamics Authoring Package",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 1,
        authoringRevision: 1
      },
      parameters: [
        {
          parameterId: "param_body_yaw",
          displayName: "Body Yaw",
          valueSource: "authoredInput",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
        },
        {
          parameterId: "param_hair_sway",
          displayName: "Hair Sway",
          valueSource: "computedDynamics",
          min: -1,
          max: 1,
          default: 0,
          recommendedUiStep: 0.01
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
              driverId: "drv_body_yaw",
              sourceParameterId: ParameterIdSchema.parse("param_body_yaw"),
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
            stiffness: 0.25,
            damping: 0.35,
            maxVelocity: 2,
            maxAmplitude: 1
          },
          resetPolicy: "reset-on-manual-command"
        }
      ]
    });
    const dynamics = projectEditorWorkflowViewModel(state).dynamics;

    expect(dynamics).toMatchObject({
      groupCountLabel: "1 dynamics group",
      hasGroups: true,
      canCreateGroup: true,
      canRunPreview: true,
      canResetPreview: true,
      previewStatusLabel: "No dynamics preview run",
      groups: [
        {
          dynamicsGroupId: "dyn_hair_sway",
          displayName: "Hair Sway",
          enabledLabel: "Enabled",
          resetPolicyLabel: "Reset on manual command",
          driverLabel: "param_body_yaw",
          outputLabel: "param_hair_sway",
          settingsLabel: "stiffness 0.25 / damping 0.35 / max velocity 2 / max amplitude 1"
        }
      ],
      driverParameters: [
        {
          parameterId: "param_body_yaw",
          label: "Body Yaw",
          rangeLabel: "param_body_yaw / -1 to 1"
        }
      ],
      computedOutputParameters: [
        {
          parameterId: "param_hair_sway",
          label: "Hair Sway",
          rangeLabel: "param_hair_sway / -1 to 1"
        }
      ]
    });
  });

  it("projects selected editable mesh vertices and nudge commands for Domain D", () => {
    const state = applyCommittedOperationSummary(
      projectLoadedPackageState({
        identity: {
          packageId: "pkg_mesh_edit",
          packageDisplayName: "Mesh Edit Package",
          formatVersion: "open-model-package-v1"
        },
        revision: {
          packageRevision: 2,
          authoringRevision: 2
        },
        drawables: [
          {
            drawableId: DrawableIdSchema.parse("draw_mesh_edit"),
            displayName: "Mesh Edit",
            partId: PartIdSchema.parse("part_root"),
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            textureId: TextureIdSchema.parse("tex_mesh_edit"),
            meshId: MeshIdSchema.parse("mesh_mesh_edit"),
            defaultOpacity: 1,
            runtimeVisibility: true,
            baseDrawOrder: 0,
            sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
          }
        ],
        drawOrderEntries: [
          {
            drawableId: DrawableIdSchema.parse("draw_mesh_edit"),
            baseDrawOrder: 0,
            stableOrder: 0
          }
        ],
        meshes: [
          {
            meshId: MeshIdSchema.parse("mesh_mesh_edit"),
            drawableId: DrawableIdSchema.parse("draw_mesh_edit"),
            vertices: [
              { x: 4, y: 6 },
              { x: 12, y: 6 },
              { x: 4, y: 18 }
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ],
            triangles: [[0, 1, 2]],
            vertexStableIds: ["vtx_mesh_edit_0", "vtx_mesh_edit_1", "vtx_mesh_edit_2"],
            bounds: { x: 4, y: 6, width: 8, height: 12 },
            generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
          }
        ]
      }),
      {
        result: {
          operationId: "op_move_mesh_edit",
          operationType: "moveMeshVertex",
          status: "committed",
          precondition: {
            ok: true
          },
          reversible: true
        },
        operationLogEntries: [
          {
            operationId: "op_move_mesh_edit",
            operationType: "moveMeshVertex",
            surface: "gui",
            timestamp: "2026-05-29T00:00:00.000Z",
            targetIds: ["mesh_mesh_edit", "vtx_mesh_edit_0"]
          }
        ],
        revision: {
          packageRevision: 3,
          authoringRevision: 3
        },
        drawables: [
          {
            drawableId: DrawableIdSchema.parse("draw_mesh_edit"),
            displayName: "Mesh Edit",
            partId: PartIdSchema.parse("part_root"),
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            textureId: TextureIdSchema.parse("tex_mesh_edit"),
            meshId: MeshIdSchema.parse("mesh_mesh_edit"),
            defaultOpacity: 1,
            runtimeVisibility: true,
            baseDrawOrder: 0,
            sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
          }
        ],
        drawOrderEntries: [
          {
            drawableId: DrawableIdSchema.parse("draw_mesh_edit"),
            baseDrawOrder: 0,
            stableOrder: 0
          }
        ],
        meshes: [
          {
            meshId: MeshIdSchema.parse("mesh_mesh_edit"),
            drawableId: DrawableIdSchema.parse("draw_mesh_edit"),
            vertices: [
              { x: 5, y: 6 },
              { x: 12, y: 6 },
              { x: 4, y: 18 }
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ],
            triangles: [[0, 1, 2]],
            vertexStableIds: ["vtx_mesh_edit_0", "vtx_mesh_edit_1", "vtx_mesh_edit_2"],
            bounds: { x: 4, y: 6, width: 8, height: 12 },
            generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
          }
        ]
      }
    );
    const viewModel = projectEditorWorkflowViewModel(state);

    expect(viewModel.meshEdit).toMatchObject({
      hasSelectedMesh: true,
      hasEditableVertices: true,
      canNudgeSelectedMesh: true,
      nudgeStep: 1,
      selectedMeshLabel: "Mesh Edit / mesh_mesh_edit",
      editableVertexCountLabel: "3 editable vertices",
      lastMeshEditResultLabel: "moveMeshVertex committed",
      selectedMesh: {
        meshId: "mesh_mesh_edit",
        drawableId: "draw_mesh_edit",
        drawableDisplayName: "Mesh Edit",
        boundsLabel: "4, 6 / 8 x 12",
        vertexCountLabel: "3 vertices / 1 triangles"
      }
    });
    expect(viewModel.meshEdit.editableVertices[0]).toMatchObject({
      vertexId: "vtx_mesh_edit_0",
      vertexIndex: 0,
      x: 5,
      y: 6,
      positionLabel: "5, 6",
      nudgeCommands: {
        left: {
          meshId: "mesh_mesh_edit",
          vertexId: "vtx_mesh_edit_0",
          delta: { x: -1, y: 0 }
        },
        right: {
          meshId: "mesh_mesh_edit",
          vertexId: "vtx_mesh_edit_0",
          delta: { x: 1, y: 0 }
        },
        up: {
          meshId: "mesh_mesh_edit",
          vertexId: "vtx_mesh_edit_0",
          delta: { x: 0, y: -1 }
        },
        down: {
          meshId: "mesh_mesh_edit",
          vertexId: "vtx_mesh_edit_0",
          delta: { x: 0, y: 1 }
        }
      }
    });
  });
});

const createEditorBinaryAssetRef = (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly storageStatus:
    | "stored-package-local-v1"
    | "missing-package-local-bytes-v1"
    | "storage-unsupported-v1";
  readonly digestHex: string;
}) => ({
  referenceKind: "package-binary-asset-ref-v1" as const,
  binaryAssetId: input.binaryAssetId,
  packageRelativePath: input.packageRelativePath,
  digest: {
    algorithm: "sha256" as const,
    hex: input.digestHex
  },
  byteLength: input.byteLength,
  mediaType: input.mediaType,
  storageStatus: input.storageStatus,
  provenanceId: ProvenanceIdSchema.parse("prov_binary_source"),
  rightsAssetId: "src_binary_psd"
});
