import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";
import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";
import {
  createRuntimeSnapshotArtifactPath,
  RuntimeSnapshotSchema,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import {
  createEditorSessionAdapter,
  type EditorSessionAdapter,
  type EditorSessionPersistenceResult
} from "./session-adapter.js";

const PREVIEW_SAMPLE_PARAMETER_ID = "param_preview_body_yaw";

describe("editor session persistence adapter", () => {
  it("commits createParameter and reloads the persisted package file set", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:00:00.000Z")
    });

    const result = adapter.commitCreateParameter({
      operationId: "op_editor_create_parameter_smile",
      parameterId: "param_editor_smile",
      displayName: "Editor Smile",
      semanticRole: "mouth",
      projectPresetAlias: "private-editor-smile-control",
      min: 0,
      max: 1,
      defaultValue: 0,
      recommendedUiStep: 0.01
    });

    expect(result.operationResult.status).toBe("committed");
    expect(result.packageRevisionBefore).toBe(0);
    expect(result.packageRevisionAfterCommit).toBe(1);
    expect(result.reloadedPackageRevision).toBe(1);
    expect(result.parameterIdsAfterReload).toContain("param_editor_smile");
    expect(result.reloadedDocument.model.parameters.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: "param_editor_smile",
        displayName: "Editor Smile"
      })
    );
    expect(result.operationLogEntries).toHaveLength(1);
    expect(result.operationLogEntries[0]).toEqual(
      expect.objectContaining({
        operationType: "createParameter",
        surface: "gui"
      })
    );
    expect(result.operationLogJsonl.trim().split("\n")).toHaveLength(1);
    expect(result.packageFilePaths).toContain("operations/log.jsonl");
    expect(result.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^runtime\/snapshots\/.+\.runtime-snapshot\.json$/),
        expect.stringMatching(/^runtime\/states\/.+\.runtime-state\.json$/),
        expect.stringMatching(/^runtime\/state-sequences\/.+\.runtime-state-sequence\.json$/),
        "validation/reports/val_editor_editor_create_parameter_smile_baseline.validation.json",
        "validation/reports/val_editor_editor_create_parameter_smile_candidate.validation.json"
      ])
    );
    expect(result.evidence.runtimeArtifactPaths.length).toBeGreaterThan(0);
    expect(result.evidence.validationArtifactPaths.length).toBe(2);
  });

  it("commits createDynamicsGroup and records editor runtime evidence", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:05:00.000Z")
    });

    const output = adapter.commitCreateParameter({
      operationId: "op_editor_create_dynamics_output_hair",
      parameterId: "param_editor_hair_sway",
      displayName: "Editor Hair Sway",
      semanticRole: "dynamics",
      projectPresetAlias: "private-editor-hair-sway-output",
      valueSource: "computedDynamics",
      min: -1,
      max: 1,
      defaultValue: 0,
      recommendedUiStep: 0.01
    });
    const result = adapter.commitCreateDynamicsGroup({
      operationId: "op_editor_create_dynamics_hair",
      dynamicsGroupId: "dyn_editor_hair_sway",
      displayName: "Editor Hair Sway",
      driverParameterId: PREVIEW_SAMPLE_PARAMETER_ID,
      outputParameterId: "param_editor_hair_sway",
      outputMin: -1,
      outputMax: 1,
      outputScale: 1,
      outputOffset: 0,
      resetPolicy: "reset-on-manual-command",
      enabled: true,
      stiffness: 0.25,
      damping: 0.35,
      maxVelocity: 2,
      maxAmplitude: 1
    });

    expect(output.operationResult.status).toBe("committed");
    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("createDynamicsGroup");
    expect(result.reloadedPackageRevision).toBe(2);
    expect(result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createParameter",
      "createDynamicsGroup"
    ]);
    expect(result.reloadedDocument.model.parameters.parameters).toContainEqual(
      expect.objectContaining({
        parameterId: "param_editor_hair_sway",
        valueSource: "computedDynamics"
      })
    );
    expect(result.reloadedDocument.model.dynamics.dynamicsGroups).toContainEqual(
      expect.objectContaining({
        dynamicsGroupId: "dyn_editor_hair_sway",
        displayName: "Editor Hair Sway",
        drivers: [
          expect.objectContaining({
            sourceParameterId: PREVIEW_SAMPLE_PARAMETER_ID
          })
        ],
        output: expect.objectContaining({
          targetParameterId: "param_editor_hair_sway"
        }),
        settings: expect.objectContaining({
          stiffness: 0.25,
          damping: 0.35
        })
      })
    );
    expect(result.evidence.generatedValidationReportIds).toEqual([
      "val_editor_editor_create_dynamics_hair_baseline",
      "val_editor_editor_create_dynamics_hair_candidate"
    ]);
    expect(result.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_editor_create_dynamics_hair_baseline.validation.json",
        "validation/reports/val_editor_editor_create_dynamics_hair_candidate.validation.json"
      ])
    );
    expect(result.evidence.runtimeArtifactPaths.length).toBeGreaterThan(0);
    expect(result.evidence.generatedRuntimeStateRefs).toEqual([
      expect.stringMatching(/editor-create-dynamics-group-final/)
    ]);
  });

  it("commits addKeyform and keeps editor evidence paths operation-specific", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:10:00.000Z")
    });
    const setup = commitEditorParameter(adapter, {
      operationId: "op_editor_create_parameter_body_yaw",
      parameterId: "param_editor_body_yaw",
      displayName: "Editor Body Yaw"
    });

    const result = adapter.commitOperation(
      createAddKeyformRequest({
        basePackageRevision: setup.packageRevisionAfterCommit
      })
    );

    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("addKeyform");
    expect(result.reloadedPackageRevision).toBe(2);
    expect(result.reloadedDocument.model.keyforms.keyformSets).toContainEqual(
      expect.objectContaining({
        evaluator: "linear-1d-v1",
        parameterId: "param_editor_body_yaw",
        target: {
          kind: "mesh",
          id: "mesh_body",
          property: "vertices"
        }
      })
    );
    expect(result.operationLogEntries.at(-1)).toEqual(
      expect.objectContaining({
        operationId: "op_editor_add_keyform_body_yaw",
        operationType: "addKeyform",
        targetIds: expect.arrayContaining([
          "mesh_body",
          "param_editor_body_yaw",
          "keyset_mesh_mesh_body_vertices_editor_body_yaw_1"
        ])
      })
    );
    expect(result.evidence.generatedRuntimeStateRefs).toEqual([
      expect.stringMatching(/editor-add-keyform-final/)
    ]);
    expect(result.evidence.generatedRuntimeStateSequenceRefs).toEqual([
      expect.stringMatching(/editor-add-keyform\.runtime-state-sequence\.json$/)
    ]);
    const runtimeDiff = result.operationResult.runtimeDiff;
    if (runtimeDiff === undefined) {
      throw new Error("Committed addKeyform should expose runtime diff evidence.");
    }

    expect(result.operationResult.generatedRuntimeSnapshotIds).toEqual(
      expect.arrayContaining([runtimeDiff.beforeSnapshotId, runtimeDiff.afterSnapshotId])
    );
    expect(runtimeDiff.parameterChanges).toEqual([]);
    expect(runtimeDiff.drawableChanges).toEqual([
      expect.objectContaining({
        drawableId: "draw_body",
        boundsChanged: true
      })
    ]);
    const candidateSnapshot = parseRuntimeSnapshotArtifact(result.packageFileSet, runtimeDiff.afterSnapshotId);
    const candidateDrawable = candidateSnapshot.drawables.find((drawable) => drawable.drawableId === "draw_body");

    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        keyformSetId: "keyset_preview_body_yaw_vertices",
        sampledCoordinates: {
          [PREVIEW_SAMPLE_PARAMETER_ID]: 0
        }
      })
    );
    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        keyformSetId: "keyset_mesh_mesh_body_vertices_editor_body_yaw_1",
        evaluator: "linear-1d-v1",
        sampledCoordinates: {
          param_editor_body_yaw: 1
        },
        target: "mesh:mesh_body.vertices",
        samplingStatus: "exact",
        statePatch: [
          { x: 0, y: 0 },
          { x: 36, y: 0 },
          { x: 0, y: 32 }
        ]
      })
    );
    expect(candidateDrawable).toMatchObject({
      bounds: { x: 0, y: 0, width: 36, height: 32 },
      vertexHash: runtimeDiff.drawableChanges[0]?.vertexHashAfter
    });
    expect(result.evidence.generatedValidationReportIds).toEqual([
      "val_editor_editor_add_keyform_body_yaw_baseline",
      "val_editor_editor_add_keyform_body_yaw_candidate"
    ]);
    expect(result.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_editor_add_keyform_body_yaw_baseline.validation.json",
        "validation/reports/val_editor_editor_add_keyform_body_yaw_candidate.validation.json"
      ])
    );
  });

  it("commits rig control angle keyforms through the editor session adapter", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:15:00.000Z")
    });
    adapter.commitCreateRotation2dRigControl({
      operationId: "op_editor_create_rig_control_body",
      displayName: "Editor Body Rotation",
      partId: "part_root",
      pivot: { x: 50, y: 56 },
      restAngleDegrees: 15
    });

    const result = adapter.commitAddRigControlAngleKeyform({
      operationId: "op_editor_add_rig_control_angle",
      parameterId: "param_preview_body_yaw",
      rigControlId: "rig_editor_body_rotation",
      keyValue: 1,
      angleDegrees: 45
    });

    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("addKeyform");
    expect(result.reloadedDocument.model.keyforms.keyformSets).toContainEqual(
      expect.objectContaining({
        evaluator: "linear-1d-v1",
        parameterId: "param_preview_body_yaw",
        target: {
          kind: "rigControl",
          id: "rig_editor_body_rotation",
          property: "angleDegrees"
        },
        keys: [
          {
            value: 1,
            statePatch: 45
          }
        ]
      })
    );
    const runtimeDiff = result.operationResult.runtimeDiff;
    if (runtimeDiff === undefined) {
      throw new Error("Committed rig control angle keyform should expose runtime diff evidence.");
    }

    const candidateSnapshot = parseRuntimeSnapshotArtifact(result.packageFileSet, runtimeDiff.afterSnapshotId);
    expect(candidateSnapshot.rigControls).toContainEqual(
      expect.objectContaining({
        rigControlId: "rig_editor_body_rotation",
        localTransform: expect.objectContaining({
          angleDegrees: 45
        })
      })
    );
    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        target: "rigControl:rig_editor_body_rotation.angleDegrees",
        samplingStatus: "exact",
        statePatch: 45
      })
    );
  });

  it("commits warpLattice2d create and controlPointOffsets keyforms through the editor session adapter", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:16:00.000Z")
    });
    const create = adapter.commitCreateWarpLattice2dRigControl({
      operationId: "op_editor_create_warp_lattice_body",
      displayName: "Editor Body Warp",
      partId: "part_root",
      childDrawableIds: ["draw_body"],
      domainBounds: { x: 0, y: 0, width: 128, height: 128 },
      latticeColumns: 2,
      latticeRows: 2,
      interpolationMethod: "bilinear-grid-v1"
    });

    const result = adapter.commitAddWarpLattice2dControlPointOffsetsKeyform({
      operationId: "op_editor_add_warp_lattice_offsets",
      parameterId: "param_preview_body_yaw",
      rigControlId: "rig_editor_body_warp",
      keyValue: 1,
      compositionMode: "replace",
      controlPointOffsets: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 0, y: 2 },
        { x: 4, y: 2 }
      ]
    });

    expect(create.operationResult.status).toBe("committed");
    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("addKeyform");
    expect(result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createWarpLattice2dRigControl",
      "addKeyform"
    ]);
    expect(result.reloadedDocument.model.rigControls.rigControls).toContainEqual(
      expect.objectContaining({
        kind: "warpLattice2d",
        rigControlId: "rig_editor_body_warp",
        childDrawableIds: ["draw_body"],
        restControlPoints: [
          { x: 0, y: 0 },
          { x: 128, y: 0 },
          { x: 0, y: 128 },
          { x: 128, y: 128 }
        ]
      })
    );
    expect(result.reloadedDocument.model.keyforms.keyformSets).toContainEqual(
      expect.objectContaining({
        evaluator: "linear-1d-v1",
        parameterId: "param_preview_body_yaw",
        target: {
          kind: "rigControl",
          id: "rig_editor_body_warp",
          property: "controlPointOffsets"
        },
        compositionMode: "replace",
        keys: [
          {
            value: 1,
            statePatch: [
              { x: 0, y: 0 },
              { x: 4, y: 0 },
              { x: 0, y: 2 },
              { x: 4, y: 2 }
            ]
          }
        ]
      })
    );
    const runtimeDiff = result.operationResult.runtimeDiff;
    if (runtimeDiff === undefined) {
      throw new Error("Committed warp lattice keyform should expose runtime diff evidence.");
    }

    const candidateSnapshot = parseRuntimeSnapshotArtifact(result.packageFileSet, runtimeDiff.afterSnapshotId);
    expect(candidateSnapshot.rigControls).toContainEqual(
      expect.objectContaining({
        rigControlId: "rig_editor_body_warp",
        kind: "warpLattice2d",
        evaluationStatus: "evaluated",
        affectedDrawableIds: ["draw_body"]
      })
    );
    expect(candidateSnapshot.keyformSamples).toContainEqual(
      expect.objectContaining({
        target: "rigControl:rig_editor_body_warp.controlPointOffsets",
        samplingStatus: "exact",
        statePatch: [
          { x: 0, y: 0 },
          { x: 4, y: 0 },
          { x: 0, y: 2 },
          { x: 4, y: 2 }
        ]
      })
    );
    expect(result.evidence.generatedValidationReportIds).toEqual([
      "val_editor_editor_add_warp_lattice_offsets_baseline",
      "val_editor_editor_add_warp_lattice_offsets_candidate"
    ]);
  });

  it("commits addKeyformGrid2d and records generated editor evidence", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:20:00.000Z")
    });
    const yawSetup = commitEditorParameter(adapter, {
      operationId: "op_editor_create_parameter_grid_yaw",
      parameterId: "param_editor_grid_yaw",
      displayName: "Editor Grid Yaw"
    });
    const pitchSetup = commitEditorParameter(adapter, {
      operationId: "op_editor_create_parameter_grid_pitch",
      parameterId: "param_editor_grid_pitch",
      displayName: "Editor Grid Pitch"
    });

    const result = adapter.commitOperation(
      createAddKeyformGrid2dRequest({
        basePackageRevision: pitchSetup.packageRevisionAfterCommit
      })
    );

    expect(yawSetup.packageRevisionAfterCommit).toBe(1);
    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("addKeyformGrid2d");
    expect(result.reloadedPackageRevision).toBe(3);
    expect(result.reloadedDocument.model.keyforms.keyformSets).toContainEqual(
      expect.objectContaining({
        evaluator: "parameter-grid-2d-v1",
        interpolation: "bilinear-grid-v1",
        parameterX: "param_editor_grid_yaw",
        parameterY: "param_editor_grid_pitch",
        target: {
          kind: "mesh",
          id: "mesh_body",
          property: "vertices"
        }
      })
    );
    expect(result.operationLogEntries.at(-1)).toEqual(
      expect.objectContaining({
        operationId: "op_editor_add_keyform_grid_body",
        operationType: "addKeyformGrid2d",
        targetIds: [
          "keyset_grid_mesh_mesh_body_vertices_editor_grid_yaw_editor_grid_pitch",
          "mesh_body",
          "param_editor_grid_yaw",
          "param_editor_grid_pitch"
        ]
      })
    );
    expect(result.evidence.generatedRuntimeStateRefs).toEqual([
      expect.stringMatching(/editor-add-keyform-grid2d-final/)
    ]);
    expect(result.evidence.generatedRuntimeStateSequenceRefs).toEqual([
      expect.stringMatching(/editor-add-keyform-grid2d\.runtime-state-sequence\.json$/)
    ]);
    expect(result.evidence.generatedValidationReportIds).toEqual([
      "val_editor_editor_add_keyform_grid_body_baseline",
      "val_editor_editor_add_keyform_grid_body_candidate"
    ]);
    expect(result.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_editor_add_keyform_grid_body_baseline.validation.json",
        "validation/reports/val_editor_editor_add_keyform_grid_body_candidate.validation.json"
      ])
    );
  });

  it("commits a generated drawable preset through createDrawable then generateMesh", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:30:00.000Z")
    });

    const result = adapter.commitCreateDrawablePreset({
      createOperationId: "op_editor_create_drawable_star",
      generateOperationId: "op_editor_generate_mesh_star",
      displayName: "Editor Star",
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body",
      partId: "part_root",
      initialBounds: { x: 12, y: 20, width: 40, height: 30 },
      meshMethod: "auto-grid-v1",
      densityHint: "medium"
    });

    expect(result.status).toBe("committed");
    expect(result.createDrawable.operationResult.status).toBe("committed");
    expect(result.generateMesh?.operationResult.status).toBe("committed");
    expect(result.finalPersistenceResult.operationType).toBe("generateMesh");
    expect(result.finalPersistenceResult.packageRevisionAfterCommit).toBe(2);
    expect(result.finalPersistenceResult.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh"
    ]);
    expect(result.finalPersistenceResult.packageFilePaths).toEqual(
      expect.arrayContaining([
        "model/drawables.json",
        "model/meshes.json",
        "model/draw-order.json",
        "operations/log.jsonl"
      ])
    );
    expect(result.finalPersistenceResult.drawableIdsAfterReload).toEqual(
      expect.arrayContaining(["draw_editor_star"])
    );
    expect(result.finalPersistenceResult.reloadedDocument.model.drawables.drawables).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_editor_star",
        displayName: "Editor Star",
        meshId: "mesh_editor_star",
        partId: "part_root",
        sourceAssetId: "src_generated"
      })
    );
    expect(result.finalPersistenceResult.reloadedDocument.model.meshes.meshes).toContainEqual(
      expect.objectContaining({
        meshId: "mesh_editor_star",
        drawableId: "draw_editor_star",
        vertices: expect.arrayContaining([
          { x: 12, y: 20 },
          { x: 52, y: 50 }
        ]),
        triangles: expect.arrayContaining([[0, 1, 3]])
      })
    );
    expect(result.finalPersistenceResult.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_editor_create_drawable_star_candidate.validation.json",
        "validation/reports/val_editor_editor_generate_mesh_star_candidate.validation.json"
      ])
    );

    const snapshot = adapter.createPersistenceSnapshot();
    expect(snapshot.operationLogJsonl.trim().split("\n")).toHaveLength(2);
    expect(snapshot.drawableIds).toEqual(expect.arrayContaining(["draw_editor_star"]));
    expect(snapshot.document.model.meshes.meshes).toContainEqual(
      expect.objectContaining({
        meshId: "mesh_editor_star",
        vertices: expect.any(Array)
      })
    );
  });

  it("commits split PNG source import metadata into package assets and operation log", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:31:00.000Z")
    });

    const result = adapter.commitImportSplitPngSourceAsset(createSplitPngSourceImportCommand());

    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("importSplitPngSourceAsset");
    expect(result.packageRevisionBefore).toBe(0);
    expect(result.packageRevisionAfterCommit).toBe(1);
    expect(result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "importSplitPngSourceAsset"
    ]);
    expect(result.operationLogEntries[0]).toMatchObject({
      operationId: "op_editor_import_split_png_source_session",
      operationType: "importSplitPngSourceAsset",
      targetIds: expect.arrayContaining(["src_session_split", "layer_face"])
    });
    expect(result.packageFilePaths).toEqual(expect.arrayContaining([
      "assets/sources/source-manifest.json",
      "assets/textures/texture-atlas.json",
      "assets/provenance.json",
      "assets/rights.json",
      "operations/log.jsonl"
    ]));
    expect(result.packageFileSet.find((entry) => entry.path === "operations/log.jsonl")?.text).toContain(
      "importSplitPngSourceAsset"
    );
    expect(result.reloadedDocument.assets.sourceManifest.sourceAssets).toContainEqual(
      expect.objectContaining({
        sourceAssetId: "src_session_split",
        kind: "split-png-set-v1",
        filePath: "assets/sources/session/split-manifest.json",
        layers: expect.arrayContaining([
          expect.objectContaining({
            sourceLayerId: "layer_face",
            bounds: { x: 8, y: 10, width: 96, height: 112 },
            mappedDrawableIds: []
          })
        ])
      })
    );
    expect(result.reloadedDocument.assets.textureAtlas).toMatchObject({
      schemaVersion: "texture-atlas-v1",
      textures: [
        expect.objectContaining({
          textureId: "tex_face",
          filePath: "assets/textures/session/face.preview.png",
          sourceAssetId: "src_session_split",
          sourceLayerId: "layer_face"
        })
      ],
      previewAssets: [
        expect.objectContaining({
          previewAssetId: "preview_src_session_split_layer_face",
          textureId: "tex_face",
          sourceAssetId: "src_session_split",
          sourceLayerId: "layer_face",
          reference: {
            referenceKind: "package-local-file-v1",
            filePath: "assets/textures/session/face.preview.png"
          }
        })
      ]
    });
    expect(result.reloadedDocument.assets.provenance.records).toContainEqual(
      expect.objectContaining({
        assetId: "src_session_split",
        creator: "Session Artist",
        relatedOperationIds: ["op_editor_import_split_png_source_session"]
      })
    );
    expect(result.reloadedDocument.assets.rights.records).toContainEqual(
      expect.objectContaining({
        assetId: "src_session_split",
        rightsStatus: "needs_review",
        license: "private-review"
      })
    );
    expect(result.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_editor_import_split_png_source_session_candidate.validation.json"
      ])
    );
  });

  it("commits source rights metadata updates after source import", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:31:30.000Z")
    });

    const imported = adapter.commitImportSplitPngSourceAsset(createSplitPngSourceImportCommand());
    const provenanceId = imported.reloadedDocument.assets.provenance.records.find(
      (record) => record.assetId === "src_session_split"
    )?.provenanceId;
    if (provenanceId === undefined) {
      throw new Error("Expected imported source provenance.");
    }

    const result = adapter.commitSetRightsMetadata({
      operationId: "op_editor_set_rights_session_split",
      assetId: "src_session_split",
      rightsStatus: "cleared",
      license: "private-cleared",
      redistributionAllowed: false,
      provenanceId
    });

    expect(result.operationResult.status).toBe("committed");
    expect(result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "importSplitPngSourceAsset",
      "setRightsMetadata"
    ]);
    expect(result.reloadedDocument.assets.rights.records).toContainEqual(
      expect.objectContaining({
        assetId: "src_session_split",
        rightsStatus: "cleared",
        license: "private-cleared"
      })
    );
    expect(result.reloadedDocument.assets.provenance.records).toContainEqual(
      expect.objectContaining({
        provenanceId,
        relatedOperationIds: [
          "op_editor_import_split_png_source_session",
          "op_editor_set_rights_session_split"
        ]
      })
    );
    expect(result.packageFileSet.find((entry) => entry.path === "assets/rights.json")?.text).toContain(
      "private-cleared"
    );
  });

  it("creates a drawable from an imported split PNG source layer", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:31:45.000Z")
    });

    const imported = adapter.commitImportSplitPngSourceAsset(createSplitPngSourceImportCommand());
    const preset = adapter.commitCreateDrawablePreset({
      createOperationId: "op_editor_create_drawable_imported_face",
      generateOperationId: "op_editor_generate_mesh_imported_face",
      displayName: "Imported Face",
      sourceAssetId: "src_session_split",
      sourceLayerId: "layer_face",
      textureId: "tex_face",
      partId: "part_root",
      initialBounds: { x: 8, y: 10, width: 96, height: 112 },
      meshMethod: "auto-grid-v1",
      densityHint: "medium"
    });

    expect(imported.operationResult.status).toBe("committed");
    expect(preset.status).toBe("committed");
    expect(preset.finalPersistenceResult.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "importSplitPngSourceAsset",
      "createDrawable",
      "generateMesh"
    ]);
    expect(preset.finalPersistenceResult.reloadedDocument.model.drawables.drawables).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_imported_face",
        displayName: "Imported Face",
        sourceAssetId: "src_session_split",
        textureId: "tex_face",
        partId: "part_root",
        meshId: "mesh_imported_face"
      })
    );
    expect(
      preset.finalPersistenceResult.reloadedDocument.assets.sourceManifest.sourceAssets
        .find((sourceAsset) => sourceAsset.sourceAssetId === "src_session_split")
        ?.layers.find((layer) => layer.sourceLayerId === "layer_face")
    ).toMatchObject({
      mappedDrawableIds: ["draw_imported_face"]
    });
  });

  it("commits mesh vertex movement and reloads the persisted package file set", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:32:00.000Z")
    });
    const preset = adapter.commitCreateDrawablePreset({
      createOperationId: "op_editor_create_drawable_vertex_star",
      generateOperationId: "op_editor_generate_mesh_vertex_star",
      displayName: "Editor Vertex Star",
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body",
      partId: "part_root",
      initialBounds: { x: 10, y: 12, width: 20, height: 20 },
      meshMethod: "auto-grid-v1",
      densityHint: "low"
    });

    const result = adapter.commitMoveMeshVertex({
      operationId: "op_editor_move_mesh_vertex_star",
      meshId: "mesh_editor_vertex_star",
      vertexDeltas: [
        {
          vertexId: "vtx_editor_vertex_star_0_0",
          delta: { x: 3, y: -2 }
        }
      ],
      intent: "session test vertex nudge"
    });
    const mesh = result.reloadedDocument.model.meshes.meshes.find(
      (candidate) => candidate.meshId === "mesh_editor_vertex_star"
    );

    expect(preset.status).toBe("committed");
    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("moveMeshVertex");
    expect(result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "moveMeshVertex"
    ]);
    expect(result.operationLogEntries.at(-1)).toEqual(
      expect.objectContaining({
        operationId: "op_editor_move_mesh_vertex_star",
        operationType: "moveMeshVertex",
        targetIds: expect.arrayContaining([
          "mesh_editor_vertex_star",
          "vtx_editor_vertex_star_0_0"
        ])
      })
    );
    expect(result.packageFilePaths).toEqual(expect.arrayContaining([
      "model/meshes.json",
      "operations/log.jsonl"
    ]));
    expect(result.packageFileSet.find((entry) => entry.path === "operations/log.jsonl")?.text).toContain(
      "moveMeshVertex"
    );
    expect(mesh?.vertices[0]).toEqual({ x: 13, y: 10 });
    expect(result.reloadedPackageRevision).toBe(3);
    expect(result.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_editor_move_mesh_vertex_star_candidate.validation.json"
      ])
    );
  });

  it("commits drawable visibility and draw order changes into the persisted package file set", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:35:00.000Z")
    });
    const preset = adapter.commitCreateDrawablePreset({
      createOperationId: "op_editor_create_drawable_layer_star",
      generateOperationId: "op_editor_generate_mesh_layer_star",
      displayName: "Editor Layer Star",
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body",
      partId: "part_root",
      initialBounds: { x: 12, y: 20, width: 40, height: 30 },
      meshMethod: "auto-grid-v1",
      densityHint: "medium"
    });

    const visibility = adapter.commitSetDrawableRuntimeVisibility({
      operationId: "op_editor_hide_body",
      drawableId: "draw_body",
      runtimeVisibility: false
    });
    const reorder = adapter.commitSetDrawableDrawOrder({
      operationId: "op_editor_reorder_layers",
      entries: [
        { drawableId: DrawableIdSchema.parse("draw_editor_layer_star"), baseDrawOrder: 0 },
        { drawableId: DrawableIdSchema.parse("draw_body"), baseDrawOrder: 1 }
      ]
    });

    expect(preset.status).toBe("committed");
    expect(visibility.operationResult.status).toBe("committed");
    expect(reorder.operationResult.status).toBe("committed");
    expect(reorder.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "setRuntimeVisibility",
      "setDrawOrder"
    ]);
    expect(reorder.packageFilePaths).toEqual(expect.arrayContaining([
      "model/drawables.json",
      "model/draw-order.json",
      "operations/log.jsonl"
    ]));
    expect(reorder.reloadedDocument.model.drawables.drawables).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_body",
        runtimeVisibility: false,
        baseDrawOrder: 1
      })
    );
    expect(reorder.reloadedDocument.model.drawOrder.entries).toEqual([
      expect.objectContaining({
        drawableId: "draw_body",
        baseDrawOrder: 1,
        stableOrder: 1
      }),
      expect.objectContaining({
        drawableId: "draw_editor_layer_star",
        baseDrawOrder: 0,
        stableOrder: 0
      })
    ]);
    expect(reorder.generatedArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_editor_hide_body_candidate.validation.json",
        "validation/reports/val_editor_editor_reorder_layers_candidate.validation.json"
      ])
    );
    expect(adapter.createPersistenceSnapshot().operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "setRuntimeVisibility",
      "setDrawOrder"
    ]);
  });

  it("commits empty-leaf part delete and reloads part-tree evidence", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:37:00.000Z")
    });
    const created = adapter.commitCreatePart({
      operationId: "op_editor_create_empty_leaf_part",
      partId: "part_editor_empty_leaf",
      displayName: "Editor Empty Leaf",
      parentPartId: "part_root"
    });

    const result = adapter.commitDeletePart({
      operationId: "op_editor_delete_empty_leaf_part",
      partId: "part_editor_empty_leaf"
    });

    expect(created.operationResult.status).toBe("committed");
    expect(result.operationResult.status).toBe("committed");
    expect(result.operationType).toBe("deletePart");
    expect(result.reloadedPackageRevision).toBe(2);
    expect(result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createPart",
      "deletePart"
    ]);
    expect(result.reloadedDocument.model.graph.parts.find(
      (part) => part.partId === "part_editor_empty_leaf"
    )).toBeUndefined();
    expect(result.reloadedDocument.model.graph.parts.find(
      (part) => part.partId === "part_root"
    )?.childPartIds).not.toContain("part_editor_empty_leaf");
    expect(result.packageFilePaths).toEqual(expect.arrayContaining([
      "model/graph.json",
      "operations/log.jsonl"
    ]));
    expect(result.evidence.generatedValidationReportIds).toEqual([
      "val_editor_editor_delete_empty_leaf_part_baseline",
      "val_editor_editor_delete_empty_leaf_part_candidate"
    ]);
    expect(result.generatedArtifactPaths).toEqual(expect.arrayContaining([
      "validation/reports/val_editor_editor_delete_empty_leaf_part_baseline.validation.json",
      "validation/reports/val_editor_editor_delete_empty_leaf_part_candidate.validation.json"
    ]));
  });

  it("keeps the current session snapshot when a duplicate drawable preset is rejected", () => {
    const adapter = createEditorSessionAdapter({
      now: () => new Date("2026-05-29T02:40:00.000Z")
    });
    const command = {
      createOperationId: "op_editor_create_drawable_badge",
      generateOperationId: "op_editor_generate_mesh_badge",
      displayName: "Editor Badge",
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body",
      partId: "part_root",
      initialBounds: { x: 10, y: 10, width: 20, height: 20 },
      meshMethod: "auto-grid-v1",
      densityHint: "low"
    } as const;

    const committed = adapter.commitCreateDrawablePreset(command);
    const rejected = adapter.commitCreateDrawablePreset({
      ...command,
      createOperationId: "op_editor_create_drawable_badge_duplicate",
      generateOperationId: "op_editor_generate_mesh_badge_duplicate"
    });

    expect(committed.status).toBe("committed");
    expect(rejected.status).toBe("rejected");
    expect(rejected.createDrawable.operationResult.status).toBe("rejected");
    expect(rejected.generateMesh).toBeNull();
    expect(rejected.finalPersistenceResult.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh"
    ]);
    expect(rejected.finalPersistenceResult.reloadedDocument.model.drawables.drawables).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_editor_badge",
        meshId: "mesh_editor_badge"
      })
    );
    expect(rejected.finalPersistenceResult.drawableIdsAfterReload).toEqual(
      expect.arrayContaining(["draw_editor_badge"])
    );
    expect(rejected.finalPersistenceResult.packageFilePaths).toContain("model/drawables.json");
  });

  it("does not import Node fs from editor-session runtime source", () => {
    const sourceRoot = join(process.cwd(), "apps/editor/src/editor-session");
    const runtimeFiles = listRuntimeSourceFiles(sourceRoot);

    expect(runtimeFiles.length).toBeGreaterThan(0);
    for (const filePath of runtimeFiles) {
      const text = readFileSync(filePath, "utf8");
      expect(text).not.toMatch(/from\s+["'](?:node:)?fs(?:\/promises)?["']/);
      expect(text).not.toMatch(/require\(["'](?:node:)?fs(?:\/promises)?["']\)/);
    }
  });
});

const listRuntimeSourceFiles = (directory: string): readonly string[] =>
  readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);
    const stat = statSync(entryPath);

    if (stat.isDirectory()) {
      return listRuntimeSourceFiles(entryPath);
    }

    if (!entryPath.endsWith(".ts") || entryPath.endsWith(".test.ts")) {
      return [];
    }

    return [entryPath];
  });

const parseRuntimeSnapshotArtifact = (
  packageFileSet: EditorSessionPersistenceResult["packageFileSet"],
  snapshotId: RuntimeSnapshotDto["snapshotId"]
): RuntimeSnapshotDto => {
  const path = createRuntimeSnapshotArtifactPath(snapshotId);
  const entry = packageFileSet.find((candidate) => candidate.path === path);
  if (entry === undefined) {
    throw new Error(`Missing runtime snapshot artifact ${path}.`);
  }

  return RuntimeSnapshotSchema.parse(JSON.parse(entry.text));
};

const commitEditorParameter = (
  adapter: EditorSessionAdapter,
  input: {
    readonly operationId: string;
    readonly parameterId: string;
    readonly displayName: string;
  }
) =>
  adapter.commitCreateParameter({
    operationId: input.operationId,
    parameterId: input.parameterId,
    displayName: input.displayName,
    semanticRole: "body",
    projectPresetAlias: input.parameterId.replace(/^param_/, "private-"),
    min: -1,
    max: 1,
    defaultValue: 0,
    recommendedUiStep: 0.01
  });

const createAddKeyformRequest = (input: {
  readonly basePackageRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_editor_add_keyform_body_yaw",
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    trace: {
      relatedAC: ["AC-MVP-008"],
      relatedScenarios: ["SC-PARAM-002"]
    },
    operationType: "addKeyform",
    payload: {
      target: {
        kind: "mesh",
        id: "mesh_body"
      },
      targetProperty: "vertices",
      parameterId: "param_editor_body_yaw",
      keyValue: 1,
      interpolation: "linear-1d-v1",
      statePatch: {
        propertyPath: "vertices",
        value: [
          { x: 0, y: 0 },
          { x: 36, y: 0 },
          { x: 0, y: 32 }
        ],
        valueSchemaHint: "mesh.vertices"
      }
    }
  });

const createAddKeyformGrid2dRequest = (input: {
  readonly basePackageRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_editor_add_keyform_grid_body",
    actor: "human",
    surface: "gui",
    dryRun: false,
    basePackageRevision: input.basePackageRevision,
    trace: {
      relatedAC: ["AC-PARAM-005"],
      relatedScenarios: ["SC-PARAM-004"]
    },
    operationType: "addKeyformGrid2d",
    payload: {
      target: {
        kind: "mesh",
        id: "mesh_body"
      },
      targetProperty: "vertices",
      parameterX: "param_editor_grid_yaw",
      parameterY: "param_editor_grid_pitch",
      evaluator: "parameter-grid-2d-v1",
      interpolation: "bilinear-grid-v1",
      clampPolicy: "clamp-to-parameter-range",
      keys: [
        {
          x: -1,
          y: -1,
          statePatch: [
            { x: -2, y: 0 },
            { x: 32, y: 0 },
            { x: 0, y: 32 }
          ]
        },
        {
          x: 1,
          y: 1,
          statePatch: [
            { x: 2, y: 0 },
            { x: 32, y: 0 },
            { x: 0, y: 32 }
          ]
        }
      ]
    }
  });

const createSplitPngSourceImportCommand = () => ({
  operationId: "op_editor_import_split_png_source_session",
  sourceAssetId: "src_session_split",
  manifestPath: "assets/sources/session/split-manifest.json",
  contentHash: "sha256:session-split",
  defaultPartId: "part_root",
  placementPolicy: "use-metadata" as const,
  layers: [
    {
      sourceLayerId: "layer_face",
      originalName: "Face.png",
      normalizedName: "face",
      groupPath: ["Head"] as string[],
      bounds: { x: 8, y: 10, width: 96, height: 112 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer" as const,
      unsupportedFeatures: [] as string[],
      texturePreviewReference: "assets/textures/session/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root"
    }
  ],
  rights: {
    rightsStatus: "needs_review" as const,
    license: "private-review",
    redistributionAllowed: false
  },
  provenance: {
    creator: "Session Artist",
    sourceUrl: "https://example.invalid/session-source",
    license: "private-review",
    redistributionAllowed: false,
    aiUsed: false,
    transformHistory: ["session-test"] as string[]
  }
});
