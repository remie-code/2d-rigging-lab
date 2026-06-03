import { describe, expect, it } from "vitest";
import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import {
  validatePackageRuntimeWithBinaryAssets,
  type ValidationCheckResultDto
} from "@private-2d-rigging-lab/validator-core";

import { createBrowserProjectStore } from "../project-persistence/index.js";
import type { StorageLike } from "../project-persistence/index.js";
import {
  createEmptySourceIntakeDraftState,
  createPsdAdapterProfileSourceIntakeDraftState,
  type SourceIntakeDraftState
} from "../editor-state/index.js";
import { createEditorWorkflowController } from "./workflow-controller.js";

describe("editor workflow controller", () => {
  it("restores parameter and reload summary after commit, save, and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateParameter(createParameterCommand("smile"));
    const saved = first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(saved.status).toBe("saved");
    expect(loaded.status).toBe("loaded");
    expect(second.state.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        displayName: "Workflow Smile"
      })
    ]));
    expect(second.state.reload).toMatchObject({
      status: "reloaded",
      packageRevision: 1,
      parameterCount: second.state.parameters.length,
      parameterIds: expect.arrayContaining(["param_workflow_smile"])
    });
    expect(second.state.operationLog.entryCount).toBe(1);
    expect(second.state.generatedEvidence.validationReportArtifactPaths).toEqual(
      expect.arrayContaining([
        "validation/reports/val_editor_workflow_create_parameter_smile_baseline.validation.json",
        "validation/reports/val_editor_workflow_create_parameter_smile_candidate.validation.json"
      ])
    );
  });

  it("commits a generated drawable preset and restores it after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const commit = first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(commit.status).toBe("committed");
    expect(commit.finalPersistenceResult.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh"
    ]);
    expect(first.state.operationLog.entryCount).toBe(2);
    expect(first.state.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_workflow_star",
        displayName: "Workflow Star",
        meshId: "mesh_workflow_star",
        vertexCount: 4,
        triangleCount: 2
      })
    ]));
    expect(first.viewModel.drawableAuthoring).toMatchObject({
      canSubmitCreateDrawable: true,
      drawableCountLabel: "2 drawables",
      resultLabel: "Drawable preset committed"
    });
    expect(first.previewProjection?.drawables.map((drawable) => drawable.drawableId)).toContain(
      "draw_workflow_star"
    );
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh"
    ]);
    expect(saved.snapshot.packageFilePaths).toEqual(expect.arrayContaining([
      "model/drawables.json",
      "model/meshes.json",
      "operations/log.jsonl"
    ]));
    expect(loaded.status).toBe("loaded");
    expect(drawableIds(second)).toEqual(expect.arrayContaining(["draw_workflow_star"]));
    expect(second.state.operationLog.entryCount).toBe(2);
    expect(second.state.reload).toMatchObject({
      status: "reloaded",
      packageRevision: 2,
      drawableCount: 2,
      drawableIds: expect.arrayContaining(["draw_workflow_star"])
    });
  });

  it("imports a split PNG source draft, updates rights, creates a drawable, and restores source metadata after load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const imported = first.commitSourceIntakeDraft(createSourceIntakeDraft());
    const provenanceId = imported.result.reloadedDocument.assets.provenance.records.find(
      (record) => record.assetId === "src_workflow_split"
    )?.provenanceId;
    if (provenanceId === undefined) {
      throw new Error("Expected imported workflow source provenance.");
    }
    const rights = first.commitSetRightsMetadata({
      operationId: "op_workflow_set_rights_split",
      assetId: "src_workflow_split",
      rightsStatus: "cleared",
      license: "private-cleared",
      redistributionAllowed: false,
      provenanceId
    });
    const drawable = first.commitCreateDrawablePreset({
      createOperationId: "op_workflow_create_drawable_imported_face",
      generateOperationId: "op_workflow_generate_mesh_imported_face",
      displayName: "Workflow Imported Face",
      sourceAssetId: first.state.pendingCreateDrawable.sourceAssetId,
      ...(first.state.pendingCreateDrawable.sourceLayerId === null
        ? {}
        : { sourceLayerId: first.state.pendingCreateDrawable.sourceLayerId }),
      partId: first.state.pendingCreateDrawable.partId,
      initialBounds: first.state.pendingCreateDrawable.initialBounds,
      meshMethod: "auto-grid-v1",
      densityHint: "medium"
    });
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(imported.status).toBe("committed");
    expect(rights.status).toBe("committed");
    expect(drawable.status).toBe("committed");
    expect(first.state.sourceAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceAssetId: "src_workflow_split",
        kind: "split-png-set-v1",
        filePath: "assets/sources/workflow/split-manifest.json"
      })
    ]));
    expect(first.state.pendingCreateDrawable).toMatchObject({
      displayName: "Imported Face",
      sourceAssetId: "src_workflow_split",
      sourceLayerId: "layer_face",
      textureId: "tex_face",
      partId: "part_root",
      initialBounds: { x: 8, y: 10, width: 96, height: 112 }
    });
    expect(first.viewModel.drawableAuthoring).toMatchObject({
      sourceLabel: "src_workflow_split / layer_face",
      canSubmitCreateDrawable: true
    });
    expect(first.viewModel.sourceIntake).toMatchObject({
      importedAssetCountLabel: "1 imported source asset",
      importedAssets: expect.arrayContaining([
        expect.objectContaining({
          sourceAssetId: "src_workflow_split",
          layerCountLabel: "1 layer"
        })
      ])
    });
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "importSplitPngSourceAsset",
      "setRightsMetadata",
      "createDrawable",
      "generateMesh"
    ]);
    expect(saved.snapshot.packageFilePaths).toEqual(expect.arrayContaining([
      "assets/sources/source-manifest.json",
      "assets/textures/texture-atlas.json",
      "assets/provenance.json",
      "assets/rights.json",
      "operations/log.jsonl"
    ]));
    expect(saved.snapshot.operationLogEntries.find(
      (entry) => entry.operationType === "createDrawable"
    )?.payload).toMatchObject({
      operationType: "createDrawable",
      payload: {
        sourceAssetId: "src_workflow_split",
        sourceLayerId: "layer_face",
        textureId: "tex_face",
        partId: "part_root"
      }
    });
    expect(saved.snapshot.document.assets.textureAtlas).toMatchObject({
      textures: [
        expect.objectContaining({
          textureId: "tex_face",
          sourceAssetId: "src_workflow_split",
          sourceLayerId: "layer_face"
        })
      ],
      previewAssets: [
        expect.objectContaining({
          textureId: "tex_face",
          sourceAssetId: "src_workflow_split",
          sourceLayerId: "layer_face"
        })
      ]
    });
    expect(saved.snapshot.document.assets.rights.records).toContainEqual(
      expect.objectContaining({
        assetId: "src_workflow_split",
        rightsStatus: "cleared",
        license: "private-cleared"
      })
    );
    expect(
      saved.snapshot.document.assets.sourceManifest.sourceAssets
        .find((sourceAsset) => sourceAsset.sourceAssetId === "src_workflow_split")
        ?.layers.find((layer) => layer.sourceLayerId === "layer_face")
    ).toMatchObject({
      mappedDrawableIds: ["draw_workflow_imported_face"]
    });
    expect(loaded.status).toBe("loaded");
    expect(second.state.sourceAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceAssetId: "src_workflow_split",
        layers: expect.arrayContaining([
          expect.objectContaining({
            sourceLayerId: "layer_face",
            mappedDrawableIds: ["draw_workflow_imported_face"]
          })
        ])
      })
    ]));
    expect(second.state.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_workflow_imported_face",
        sourceAssetId: "src_workflow_split",
        textureId: "tex_face",
        partId: "part_root"
      })
    ]));
    expect(second.state.operationLog.entryCount).toBe(4);
    expect(second.state.reload).toMatchObject({
      status: "reloaded",
      packageRevision: 4,
      drawableIds: expect.arrayContaining(["draw_workflow_imported_face"])
    });
  });

  it("imports a manual PSD adapter/profile source draft through importPsdSourceAsset", () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);

    const imported = workflow.commitSourceIntakeDraft(createPsdSourceIntakeDraft());
    const saved = workflow.saveProject();
    const snapshot = saved.snapshot;
    const second = createWorkflow(storage);
    const loaded = second.loadProject();
    const sourceAsset = snapshot.document.assets.sourceManifest.sourceAssets.find(
      (candidate) => candidate.sourceAssetId === "src_workflow_psd_profile"
    );
    const importEntry = snapshot.operationLogEntries.find(
      (entry) => entry.operationType === "importPsdSourceAsset"
    );

    expect(imported.status).toBe("committed");
    expect(imported.result.operationType).toBe("importPsdSourceAsset");
    expect(imported.result.operationResult.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.importPsdSourceAsset.adapterDiagnostic",
        message: expect.stringContaining("no PSD bytes were parsed by the editor")
      })
    ]));
    expect(sourceAsset).toMatchObject({
      sourceAssetId: "src_workflow_psd_profile",
      kind: "psd-source-v1",
      filePath: "assets/sources/workflow/source.psd",
      contentHash: "sha256:workflow-psd-reference",
      importProfile: "layered-character-psd-profile-v1",
      layers: [
        expect.objectContaining({
          sourceLayerId: "layer_face",
          groupPath: ["Root", "Head"],
          bounds: { x: 320, y: 240, width: 512, height: 512 },
          unsupportedFeatures: ["psd.textLayer"]
        })
      ]
    });
    expect(sourceAsset?.psdProfile).toMatchObject({
      schemaVersion: "layered-character-psd-profile-v1",
      adapter: {
        adapterName: "manual-psd-profile-entry",
        evidenceKind: "adapter-supplied-metadata-v1"
      },
      canvas: {
        width: 2048,
        height: 3072
      },
      sourceGroups: [
        expect.objectContaining({
          sourceGroupId: "group_root",
          groupPath: ["Root"]
        }),
        expect.objectContaining({
          sourceGroupId: "group_root_head",
          groupPath: ["Root", "Head"]
        })
      ],
      sourceLayers: [
        expect.objectContaining({
          sourceLayerId: "layer_face",
          texturePreviewReference: "assets/sources/workflow/face.preview.png",
          textureId: "tex_face",
          targetPartId: "part_root",
          unsupportedFeatures: [
            expect.objectContaining({
              featureId: "psd.textLayer",
              manualConfirmationRequired: true
            })
          ]
        })
      ],
      diagnostics: [
        expect.objectContaining({
          checkId: "adapter.psd.manualProfileMetadata"
        })
      ]
    });
    expect(workflow.viewModel.sourceIntake.importedAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceAssetId: "src_workflow_psd_profile",
        profileEvidenceLabel:
          "Structured PSD profile metadata from manual-psd-profile-entry; editor did not parse PSD bytes.",
        psdProfile: expect.objectContaining({
          adapterLabel: "manual-psd-profile-entry / adapter-supplied-metadata-v1",
          canvasLabel: "2048 x 3072 / 0, 0 / 2048 x 3072",
          sourceGroupCountLabel: "2 source groups",
          structuredLayerCountLabel: "1 structured layer",
          unsupportedFeatureCountLabel: "1 structured unsupported feature",
          adapterDiagnosticCountLabel: "1 adapter diagnostic"
        })
      })
    ]));
    expect(snapshot.document.assets.textureAtlas).toMatchObject({
      textures: [
        expect.objectContaining({
          textureId: "tex_face",
          sourceAssetId: "src_workflow_psd_profile",
          sourceLayerId: "layer_face"
        })
      ],
      previewAssets: [
        expect.objectContaining({
          textureId: "tex_face",
          sourceAssetId: "src_workflow_psd_profile",
          sourceLayerId: "layer_face"
        })
      ]
    });
    expect(workflow.state.pendingCreateDrawable).toMatchObject({
      displayName: "Imported Face",
      sourceAssetId: "src_workflow_psd_profile",
      sourceLayerId: "layer_face",
      textureId: "tex_face",
      partId: "part_root",
      initialBounds: { x: 320, y: 240, width: 512, height: 512 }
    });
    expect(importEntry?.payload).toMatchObject({
      operationType: "importPsdSourceAsset",
      payload: {
        fileRef: {
          packageRelativePath: "assets/sources/workflow/source.psd",
          contentHash: "sha256:workflow-psd-reference"
        },
        importProfile: "layered-character-psd-profile-v1",
        adapterResult: {
          schemaVersion: "psd-adapter-result-v1",
          adapterName: "manual-psd-profile-entry",
          sourceProfile: "layered-character-psd-profile-v1",
          canvas: {
            width: 2048,
            height: 3072
          },
          sourceLayers: [
            expect.objectContaining({
              sourceLayerId: "layer_face",
              sourceOrder: 2,
              texturePreviewReference: "assets/sources/workflow/face.preview.png",
              textureId: "tex_face",
              targetPartId: "part_root"
            })
          ]
        }
      }
    });
    expect(JSON.stringify(importEntry?.payload)).not.toMatch(/FileReader|readFile|decode|raster extraction/i);
    expect(loaded.status).toBe("loaded");
    expect(second.state.sourceAssets.find(
      (candidate) => candidate.sourceAssetId === "src_workflow_psd_profile"
    )?.psdProfile).toMatchObject({
      adapter: {
        adapterName: "manual-psd-profile-entry"
      },
      sourceLayers: [
        expect.objectContaining({
          sourceLayerId: "layer_face",
          textureId: "tex_face",
          targetPartId: "part_root"
        })
      ]
    });
    expect(second.viewModel.sourceIntake.importedAssets).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceAssetId: "src_workflow_psd_profile",
        profileEvidenceLabel:
          "Structured PSD profile metadata from manual-psd-profile-entry; editor did not parse PSD bytes.",
        psdProfile: expect.objectContaining({
          unsupportedFeatureCountLabel: "1 structured unsupported feature"
        })
      })
    ]));
  });

  it("commits selected PSD source bytes and makes browser-local reload require reupload", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const imported = await first.commitSourceIntakeDraftWithSelectedFile(
      createPsdSourceIntakeDraft(),
      {
        fileName: "source.psd",
        bytes: new Uint8Array([0x50, 0x53, 0x44]),
        declaredMediaType: "application/octet-stream"
      }
    );
    const saved = first.saveProject();
    const sourceAsset = imported.result.reloadedDocument.assets.sourceManifest.sourceAssets.find(
      (candidate) => candidate.sourceAssetId === "src_workflow_psd_profile"
    );
    const binaryLabel = first.viewModel.sourceIntake.importedAssets
      .find((asset) => asset.sourceAssetId === "src_workflow_psd_profile")
      ?.binaryAssetLabels.join("\n") ?? "";

    expect(imported.status).toBe("committed");
    expect(imported.result.operationType).toBe("importPsdSourceAsset");
    expect(imported.result.operationLogJsonl).toContain("binaryAssetRef");
    expect(imported.result.operationLogJsonl).not.toContain("selectedFile");
    expect(sourceAsset?.binaryAssetRef).toMatchObject({
      binaryAssetId: "bin_workflow_psd_profile_source",
      packageRelativePath: "assets/sources/workflow/source.psd",
      byteLength: 3,
      mediaType: "application/octet-stream",
      storageStatus: "stored-package-local-v1",
      rightsAssetId: "src_workflow_psd_profile"
    });
    expect(first.state.sourceIntakeDraft.selectedFile).toMatchObject({
      fileName: "source.psd",
      byteLength: 3,
      declaredMediaType: "application/octet-stream",
      storageStatus: "package-local-current-session-memory-v1",
      availabilityStatus: "available-package-local-bytes-v1",
      commitStatus: "committed-to-package-binary-boundary-v1"
    });
    expect(first.state.binaryByteIntake.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_workflow_psd_profile_source",
        packageRelativePath: "assets/sources/workflow/source.psd",
        availabilityStatus: "available-current-editor-session-v1",
        validatorBytesAvailability: "available",
        sourceFilename: "source.psd",
        verificationStatus: "verified-pass-v1"
      })
    ]);
    expect(binaryLabel).toContain("session availability available in current editor session memory");
    expect(binaryLabel).toContain("validator bytesAvailability=available");
    expect(binaryLabel).toContain("source filename source.psd");
    expect(binaryLabel).toContain("byte intake verified-pass-v1");
    expect(binaryLabel).not.toMatch(/parsed from bytes|decoded from bytes|raster extraction|archive import/i);
    expect(saved.snapshot.packageFilePaths).not.toContain("assets/sources/workflow/source.psd");
    expect(saved.snapshot.packageInMemoryFilePaths).toContain("assets/sources/workflow/source.psd");

    const second = createWorkflow(storage);
    const loaded = second.loadProject();
    const resavedAfterLoad = second.saveProject();
    const loadedBinaryLabel = second.viewModel.sourceIntake.importedAssets
      .find((asset) => asset.sourceAssetId === "src_workflow_psd_profile")
      ?.binaryAssetLabels.join("\n") ?? "";
    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: resavedAfterLoad.snapshot.document,
      binaryFileSet: resavedAfterLoad.snapshot.packageInMemoryFileSet,
      byteIntakePreflight: resavedAfterLoad.snapshot.binaryByteEvidence.byteIntakePreflight,
      createdAt: "2026-06-02T01:00:00.000Z"
    });

    expect(loaded.status).toBe("loaded");
    expect(second.state.binaryByteIntake.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_workflow_psd_profile_source",
        availabilityStatus: "requires-reupload-after-browser-local-load-v1",
        validatorBytesAvailability: "requiresReupload"
      })
    ]);
    expect(loadedBinaryLabel).toContain("metadata reloaded without bytes; reupload required");
    expect(loadedBinaryLabel).toContain("validator bytesAvailability=requiresReupload");
    expect(resavedAfterLoad.snapshot.binaryByteEvidence.byteIntakePreflight.assets).toEqual([
      expect.objectContaining({
        binaryAssetId: "bin_workflow_psd_profile_source",
        packageRelativePath: "assets/sources/workflow/source.psd",
        bytesAvailability: "requiresReupload"
      })
    ]);
    expectReuploadPreflightRejectedByIntegratedValidation(report.checks, {
      binaryAssetId: "bin_workflow_psd_profile_source",
      packageRelativePath: "assets/sources/workflow/source.psd"
    });
  });

  it("does not treat blocked source intake rights as a successful import", () => {
    const workflow = createWorkflow(createMemoryStorage());

    const rejected = workflow.commitSourceIntakeDraft(
      createSourceIntakeDraft({
        rightsStatus: "blocked"
      })
    );

    expect(rejected.status).toBe("rejected");
    expect(rejected.result.operationResult.status).toBe("rejected");
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.state.sourceAssets.map((sourceAsset) => sourceAsset.sourceAssetId)).not.toContain(
      "src_workflow_split"
    );
    expect(workflow.state.sourceIntakeDraft).toMatchObject({
      status: "idle",
      sourceAssetId: "src_workflow_split",
      diagnostics: expect.arrayContaining([
        expect.stringContaining("operation.importSplitPngSourceAsset.blockedRights")
      ])
    });
    expect(workflow.state.pendingCreateDrawable).toMatchObject({
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body"
    });
  });

  it("keeps missing texture preview as a structured source intake diagnostic", () => {
    const workflow = createWorkflow(createMemoryStorage());

    const rejected = workflow.commitSourceIntakeDraft(
      createSourceIntakeDraft({
        omitTexturePreviewReference: true
      })
    );

    expect(rejected.status).toBe("rejected");
    expect(rejected.result.operationResult.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importSplitPngSourceAsset.missingTexturePreviewReference"
    );
    expect(workflow.state.sourceIntakeDraft).toMatchObject({
      status: "idle",
      diagnostics: expect.arrayContaining([
        expect.stringContaining("operation.importSplitPngSourceAsset.missingTexturePreviewReference")
      ])
    });
    expect(workflow.state.operationLog.entryCount).toBe(0);
  });

  it("toggles drawable visibility, reorders layers, and restores layer state after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const hidden = first.toggleDrawableRuntimeVisibility("draw_body");
    const moved = first.moveDrawableLayer("draw_body", "up");
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(hidden.status).toBe("committed");
    expect(moved.status).toBe("committed");
    expect(first.state.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      visible: drawable.visible,
      baseDrawOrder: drawable.baseDrawOrder,
      orderIndex: drawable.orderIndex,
      canMoveLayerUp: drawable.canMoveLayerUp,
      canMoveLayerDown: drawable.canMoveLayerDown
    }))).toEqual([
      {
        drawableId: "draw_workflow_star",
        visible: true,
        baseDrawOrder: 0,
        orderIndex: 0,
        canMoveLayerUp: true,
        canMoveLayerDown: false
      },
      {
        drawableId: "draw_body",
        visible: false,
        baseDrawOrder: 1,
        orderIndex: 1,
        canMoveLayerUp: false,
        canMoveLayerDown: true
      }
    ]);
    expect(first.state.operationLog.entryCount).toBe(4);
    expect(first.viewModel.drawableLayers).toMatchObject({
      hasMultipleDrawables: true,
      layerCountLabel: "2 layers",
      lastLayerOperationLabel: "setDrawOrder committed",
      orderedDrawables: [
        {
          drawableId: "draw_workflow_star",
          runtimeVisibilityLabel: "Visible",
          canMoveUp: true,
          canMoveDown: false
        },
        {
          drawableId: "draw_body",
          runtimeVisibilityLabel: "Hidden",
          canMoveUp: false,
          canMoveDown: true
        }
      ]
    });
    expect(first.previewProjection).toMatchObject({
      drawList: ["draw_workflow_star"],
      visibleDrawableCount: 1
    });
    expect(first.previewProjection?.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_body",
        visible: false
      })
    ]));
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "setRuntimeVisibility",
      "setDrawOrder"
    ]);
    expect(saved.snapshot.document.model.drawables.drawables).toContainEqual(
      expect.objectContaining({
        drawableId: "draw_body",
        runtimeVisibility: false,
        baseDrawOrder: 1
      })
    );
    expect(saved.snapshot.document.model.drawOrder.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          drawableId: "draw_workflow_star",
          baseDrawOrder: 0,
          stableOrder: 0
        }),
        expect.objectContaining({
          drawableId: "draw_body",
          baseDrawOrder: 1,
          stableOrder: 1
        })
      ])
    );
    expect(loaded.status).toBe("loaded");
    expect(second.state.drawables.map((drawable) => ({
      drawableId: drawable.drawableId,
      visible: drawable.visible,
      baseDrawOrder: drawable.baseDrawOrder,
      orderIndex: drawable.orderIndex
    }))).toEqual([
      {
        drawableId: "draw_workflow_star",
        visible: true,
        baseDrawOrder: 0,
        orderIndex: 0
      },
      {
        drawableId: "draw_body",
        visible: false,
        baseDrawOrder: 1,
        orderIndex: 1
      }
    ]);
    expect(second.previewProjection).toMatchObject({
      drawList: ["draw_workflow_star"],
      visibleDrawableCount: 1
    });
    expect(second.previewProjection?.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_body",
        visible: false
      })
    ]));
  });

  it("nudges an editable mesh vertex and restores vertex coordinates after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const selectedMesh = first.viewModel.meshEdit.selectedMesh;
    const vertex = first.viewModel.meshEdit.editableVertices[0];
    if (selectedMesh === null || vertex === undefined) {
      throw new Error("Expected generated drawable mesh to expose an editable vertex.");
    }

    const nudged = first.nudgeMeshVertex(vertex.nudgeCommands.right);
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(selectedMesh).toMatchObject({
      meshId: "mesh_workflow_star",
      drawableId: "draw_workflow_star"
    });
    expect(nudged.status).toBe("committed");
    expect(first.state.meshEdit.editableVertices[0]).toMatchObject({
      vertexId: "vtx_workflow_star_0_0",
      position: { x: 17, y: 24 }
    });
    expect(first.viewModel.meshEdit).toMatchObject({
      canNudgeSelectedMesh: true,
      lastMeshEditResultLabel: "moveMeshVertex committed"
    });
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "moveMeshVertex"
    ]);
    expect(saved.snapshot.packageFileSet.find((entry) => entry.path === "operations/log.jsonl")?.text).toContain(
      "moveMeshVertex"
    );
    expect(findMeshVertex(saved.snapshot.document, "mesh_workflow_star", 0)).toEqual({ x: 17, y: 24 });
    expect(loaded.status).toBe("loaded");
    expect(second.state.operationLog.entryCount).toBe(3);
    expect(second.state.meshEdit.selectedMesh).toMatchObject({
      meshId: "mesh_workflow_star",
      drawableId: "draw_workflow_star"
    });
    expect(second.state.meshEdit.editableVertices[0]).toMatchObject({
      vertexId: "vtx_workflow_star_0_0",
      position: { x: 17, y: 24 }
    });
  });

  it("selects and moves multiple mesh vertices from the canvas workflow and restores selection after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const selectedMesh = first.viewModel.meshEdit.selectedMesh;
    const firstVertex = first.viewModel.meshEdit.editableVertices[0];
    const thirdVertex = first.viewModel.meshEdit.editableVertices[2];
    if (selectedMesh === null || firstVertex === undefined || thirdVertex === undefined) {
      throw new Error("Expected generated drawable mesh vertices.");
    }

    first.selectMeshCanvasVertex({ vertexId: firstVertex.vertexId });
    first.selectMeshCanvasVertex({ vertexId: thirdVertex.vertexId, mode: "add" });
    const moved = first.dragMeshCanvasSelection({ x: 2, y: -1 });
    first.openViewerRuntimeSurface();
    const previewGeometry = first.previewProjection?.drawables
      .find((drawable) => drawable.meshId === selectedMesh.meshId)
      ?.geometry;
    const viewerGeometry = first.viewerRuntimeProjection?.previewProjection.drawables
      .find((drawable) => drawable.meshId === selectedMesh.meshId)
      ?.geometry;
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(moved.status).toBe("committed");
    expect(first.state.meshEdit.selectedVertexIds).toEqual([
      firstVertex.vertexId,
      thirdVertex.vertexId
    ]);
    expect(findEditableVertex(first, firstVertex.vertexId)?.position).toEqual({
      x: firstVertex.x + 2,
      y: firstVertex.y - 1
    });
    expect(findEditableVertex(first, thirdVertex.vertexId)?.position).toEqual({
      x: thirdVertex.x + 2,
      y: thirdVertex.y - 1
    });
    expect(previewGeometry?.polygonPoints).toEqual(expect.arrayContaining([
      { x: firstVertex.x + 2, y: firstVertex.y - 1 },
      { x: thirdVertex.x + 2, y: thirdVertex.y - 1 }
    ]));
    expect(viewerGeometry?.polygonPoints).toEqual(expect.arrayContaining([
      { x: firstVertex.x + 2, y: firstVertex.y - 1 },
      { x: thirdVertex.x + 2, y: thirdVertex.y - 1 }
    ]));
    expect(saved.snapshot.document.model.editorState).toMatchObject({
      schemaVersion: "editor-state-v1",
      activeTool: "meshEdit",
      selection: [firstVertex.vertexId, thirdVertex.vertexId]
    });
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "moveMeshVertex"
    ]);
    expect(loaded.status).toBe("loaded");
    expect(second.state.meshEdit.selectedMesh).toMatchObject({
      meshId: selectedMesh.meshId,
      drawableId: selectedMesh.drawableId
    });
    expect(second.state.layerTreeDraft.selection).toEqual([]);
    expect(second.state.meshEdit.selectedVertexIds).toEqual([
      firstVertex.vertexId,
      thirdVertex.vertexId
    ]);
    expect(findEditableVertex(second, firstVertex.vertexId)?.position).toEqual({
      x: firstVertex.x + 2,
      y: firstVertex.y - 1
    });
  });

  it("commits selected mesh canvas nudge through the operation lifecycle", () => {
    const workflow = createWorkflow(createMemoryStorage());

    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const selectedMesh = workflow.viewModel.meshEdit.selectedMesh;
    const firstVertex = workflow.viewModel.meshEdit.editableVertices[0];
    const secondVertex = workflow.viewModel.meshEdit.editableVertices[1];
    if (selectedMesh === null || firstVertex === undefined || secondVertex === undefined) {
      throw new Error("Expected generated drawable mesh vertices.");
    }

    workflow.selectMeshCanvasVertex({ vertexId: firstVertex.vertexId });
    workflow.selectMeshCanvasVertex({ vertexId: secondVertex.vertexId, mode: "add" });
    const nudged = workflow.nudgeMeshCanvasSelection({ x: 1, y: 0 });
    if (nudged.status !== "committed") {
      throw new Error(`Expected committed canvas nudge, received ${nudged.status}.`);
    }

    expect(nudged.selectedVertexIds).toEqual([
      firstVertex.vertexId,
      secondVertex.vertexId
    ]);
    expect(nudged.result.operationType).toBe("moveMeshVertex");
    expect(nudged.result.operationResult.status).toBe("committed");
    expect(workflow.latestSessionPersistenceResult?.operationType).toBe("moveMeshVertex");
    expect(workflow.state.operationLog.entryCount).toBe(3);
    expect(workflow.latestSessionPersistenceResult?.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "moveMeshVertex"
    ]);
    expect(workflow.state.meshEdit.selectedVertexIds).toEqual([
      firstVertex.vertexId,
      secondVertex.vertexId
    ]);
    expect(findEditableVertex(workflow, firstVertex.vertexId)?.position).toEqual({
      x: firstVertex.x + 1,
      y: firstVertex.y
    });
    expect(findEditableVertex(workflow, secondVertex.vertexId)?.position).toEqual({
      x: secondVertex.x + 1,
      y: secondVertex.y
    });
  });

  it("commits add and remove mesh vertex topology edits through the workflow", () => {
    const workflow = createWorkflow(createMemoryStorage());

    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const addCommand = workflow.viewModel.meshEdit.topology.addVertex.command;
    if (addCommand === null) {
      throw new Error("Expected add mesh vertex command.");
    }

    const added = workflow.addMeshVertex(addCommand);
    workflow.selectMeshCanvasVertex({ vertexId: addCommand.vertexId });
    const removeCommand = workflow.viewModel.meshEdit.topology.removeSelectedVertex.command;
    if (removeCommand === null) {
      throw new Error("Expected remove unreferenced vertex command.");
    }
    const removed = workflow.removeSelectedMeshVertex(removeCommand);
    const mesh = removed.result.reloadedDocument.model.meshes.meshes.find(
      (candidate) => candidate.meshId === addCommand.meshId
    );

    expect(added.status).toBe("committed");
    expect(added.result.operationType).toBe("addMeshVertex");
    expect(added.result.operationResult.meshTopologyEvidence?.[0]).toMatchObject({
      operationType: "addMeshVertex",
      rendererCorrectnessClaim: "none",
      textureSamplingCorrectnessClaim: "none"
    });
    expect(workflow.state.meshEdit.selectedVertexIds).toEqual([]);
    expect(removed.status).toBe("committed");
    expect(removed.result.operationType).toBe("removeMeshVertex");
    expect(mesh?.vertexStableIds).not.toContain(addCommand.vertexId);
    expect(removed.result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "addMeshVertex",
      "removeMeshVertex"
    ]);
  });

  it("commits add and remove mesh triangle topology edits through the workflow", () => {
    const workflow = createWorkflow(createMemoryStorage());

    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const addVertexCommand = workflow.viewModel.meshEdit.topology.addVertex.command;
    const firstVertex = workflow.viewModel.meshEdit.editableVertices[0];
    const secondVertex = workflow.viewModel.meshEdit.editableVertices[1];
    if (addVertexCommand === null || firstVertex === undefined || secondVertex === undefined) {
      throw new Error("Expected generated mesh vertices.");
    }

    workflow.addMeshVertex(addVertexCommand);
    workflow.selectMeshCanvasVertex({ vertexId: firstVertex.vertexId });
    workflow.selectMeshCanvasVertex({ vertexId: secondVertex.vertexId, mode: "add" });
    workflow.selectMeshCanvasVertex({ vertexId: addVertexCommand.vertexId, mode: "add" });
    const addTriangleCommand = workflow.viewModel.meshEdit.topology.addTriangle.command;
    if (addTriangleCommand === null) {
      throw new Error("Expected add triangle command.");
    }

    const added = workflow.addMeshTriangle(addTriangleCommand);
    const removeTriangleCommand = workflow.viewModel.meshEdit.topology.triangles.find(
      (triangle) => triangle.triangleId === addTriangleCommand.triangleId
    )?.remove.command;
    if (removeTriangleCommand === undefined || removeTriangleCommand === null) {
      throw new Error("Expected remove triangle command.");
    }
    const removed = workflow.removeMeshTriangle(removeTriangleCommand);
    const mesh = removed.result.reloadedDocument.model.meshes.meshes.find(
      (candidate) => candidate.meshId === addTriangleCommand.meshId
    );

    expect(added.status).toBe("committed");
    expect(added.result.operationType).toBe("addMeshTriangle");
    expect(mesh?.triangleStableIds).not.toContain(addTriangleCommand.triangleId);
    expect(removed.status).toBe("committed");
    expect(removed.result.operationType).toBe("removeMeshTriangle");
    expect(removed.result.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "addMeshVertex",
      "addMeshTriangle",
      "removeMeshTriangle"
    ]);
  });

  it("commits selected mesh UV nudges through the workflow", () => {
    const workflow = createWorkflow(createMemoryStorage());

    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const vertex = workflow.state.meshEdit.editableVertices[0];
    if (vertex === undefined) {
      throw new Error("Expected generated mesh vertex.");
    }
    workflow.selectMeshCanvasVertex({ vertexId: vertex.vertexId });
    const uvCommand = workflow.viewModel.meshEdit.topology.uvNudges.find(
      (nudge) => nudge.direction === "right"
    )?.command;
    if (uvCommand === undefined || uvCommand === null) {
      throw new Error("Expected UV nudge command.");
    }

    const moved = workflow.nudgeMeshUv(uvCommand);

    expect(moved.status).toBe("committed");
    expect(moved.result.operationType).toBe("moveMeshUvPoint");
    expect(moved.selectedVertexIds).toEqual([vertex.vertexId]);
    expect(findMeshUv(moved.result.reloadedDocument, uvCommand.meshId, vertex.vertexIndex)).toEqual({
      x: vertex.uv.x + 0.05,
      y: vertex.uv.y
    });
    expect(workflow.viewModel.meshEdit.lastMeshEditResultLabel).toBe("moveMeshUvPoint committed");
  });

  it("blocks canvas mesh movement on locked layers without committing an operation", () => {
    const workflow = createWorkflow(createMemoryStorage());

    workflow.commitCreateDrawablePreset(createDrawablePresetCommand("star"));
    const selectedMesh = workflow.viewModel.meshEdit.selectedMesh;
    const vertex = workflow.viewModel.meshEdit.editableVertices[0];
    if (selectedMesh === null || vertex === undefined) {
      throw new Error("Expected generated drawable mesh vertex.");
    }

    workflow.selectMeshCanvasVertex({ vertexId: vertex.vertexId });
    workflow.toggleDrawableLayerLock(selectedMesh.drawableId);
    const blockedCanvasMove = workflow.nudgeMeshCanvasSelection({ x: 1, y: 0 });
    const blockedRowNudge = workflow.nudgeMeshVertex(vertex.nudgeCommands.right);

    expect(blockedCanvasMove).toEqual({
      status: "blocked",
      blockedReason: "locked",
      selectedVertexIds: [vertex.vertexId]
    });
    expect(blockedRowNudge).toEqual({
      status: "not_editable",
      meshId: selectedMesh.meshId,
      vertexId: vertex.vertexId
    });
    expect(workflow.state.operationLog.entryCount).toBe(2);
    expect(workflow.latestSessionPersistenceResult?.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createDrawable",
      "generateMesh"
    ]);
    expect(workflow.latestSessionPersistenceResult?.operationType).toBe("generateMesh");
  });

  it("does not commit an operation when a layer move is not available", () => {
    const workflow = createWorkflow(createMemoryStorage());

    expect(workflow.moveDrawableLayer("draw_body", "down")).toEqual({
      status: "not_movable",
      drawableId: "draw_body",
      direction: "down"
    });
    expect(workflow.moveDrawableLayer("draw_missing", "up")).toEqual({
      status: "not_found",
      drawableId: "draw_missing"
    });
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.latestSessionPersistenceResult).toBeNull();
  });

  it("keeps committed drawable state visible when a duplicate preset create is rejected", () => {
    const workflow = createWorkflow(createMemoryStorage());
    const command = createDrawablePresetCommand("star");

    workflow.commitCreateDrawablePreset(command);
    const rejected = workflow.commitCreateDrawablePreset({
      ...command,
      createOperationId: "op_workflow_create_drawable_star_duplicate",
      generateOperationId: "op_workflow_generate_mesh_star_duplicate"
    });

    expect(rejected.status).toBe("rejected");
    expect(rejected.generateMesh).toBeNull();
    expect(workflow.state.pendingCreateDrawable.status).toBe("rejected");
    expect(workflow.state.drawables).toEqual(expect.arrayContaining([
      expect.objectContaining({
        drawableId: "draw_workflow_star",
        meshId: "mesh_workflow_star"
      })
    ]));
    expect(workflow.state.operationLog.entryCount).toBe(2);
    expect(workflow.viewModel.drawableAuthoring).toMatchObject({
      drawableCountLabel: "2 drawables",
      resultLabel: "Drawable preset rejected with 2 diagnostics"
    });
    expect(workflow.previewProjection?.drawables.map((drawable) => drawable.drawableId)).toContain(
      "draw_workflow_star"
    );
  });

  it("appends operation log entries after loading a persisted project", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    first.commitCreateParameter(createParameterCommand("smile"));
    first.saveProject();

    const second = createWorkflow(storage);
    second.loadProject();
    const commit = second.commitCreateParameter(createParameterCommand("brow"));

    expect(commit.operationLogEntries.map((entry) => entry.operationId)).toEqual([
      "op_workflow_create_parameter_smile",
      "op_workflow_create_parameter_brow"
    ]);
    expect(commit.operationLogJsonl.trim().split("\n")).toHaveLength(2);
    expect(second.state.operationLog.entryCount).toBe(2);
    expect(parameterIds(second)).toEqual(expect.arrayContaining([
      "param_workflow_smile",
      "param_workflow_brow"
    ]));
  });

  it("sets and resets preview parameter values without committing operations", () => {
    const workflow = createWorkflow(createMemoryStorage());
    workflow.commitCreateParameter(createParameterCommand("smile"));
    const sessionResultBeforePreview = workflow.latestSessionPersistenceResult;

    const set = workflow.setPreviewParameterValue("param_workflow_smile", 0.75);

    expect(set).toEqual({
      status: "updated",
      parameterId: "param_workflow_smile",
      requestedValue: 0.75,
      currentValue: 0.75
    });
    expect(workflow.state.previewParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        defaultValue: 0,
        currentValue: 0.75
      })
    ]));
    expect(workflow.viewModel.previewControls.parameterControls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        currentValue: 0.75,
        valueLabel: "Workflow Smile: 0.75"
      })
    ]));
    expect(workflow.latestSessionPersistenceResult).toBe(sessionResultBeforePreview);
    expect(workflow.state.operationLog.entryCount).toBe(1);

    const reset = workflow.resetPreviewParameterValues();

    expect(reset).toEqual({
      status: "reset",
      parameterCount: workflow.state.previewParameters.length
    });
    expect(workflow.state.previewParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        currentValue: 0
      })
    ]));
    expect(workflow.state.operationLog.entryCount).toBe(1);
  });

  it("creates a dynamics group, runs preview evidence, and restores it after load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const created = first.commitCreateDynamicsGroup(createDynamicsGroupCommand("hair"));
    first.setPreviewParameterValue("param_preview_body_yaw", 1);
    const ran = first.runDynamicsPreview(5);
    const reset = first.resetDynamicsPreview();
    const updated = first.commitUpdateDynamicsGroup({
      operationId: "op_workflow_update_dynamics_hair",
      dynamicsGroupId: "dyn_workflow_hair_sway",
      displayName: "Workflow Hair Settle",
      enabled: false,
      resetPolicy: "reset-on-large-input-jump"
    });
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(created.status).toBe("committed");
    expect(created.outputParameterResult?.operationType).toBe("createParameter");
    expect(created.dynamicsGroupResult?.operationType).toBe("createDynamicsGroup");
    expect(first.state.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_dynamics_workflow_hair_sway_r0",
        valueSource: "computedDynamics"
      })
    ]));
    expect(first.state.dynamicsGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dynamicsGroupId: "dyn_workflow_hair_sway",
        displayName: "Workflow Hair Settle",
        enabled: false,
        driverParameterIds: ["param_preview_body_yaw"],
        outputParameterId: "param_dynamics_workflow_hair_sway_r0",
        resetPolicy: "reset-on-large-input-jump"
      })
    ]));
    expect(ran).toMatchObject({
      status: "ran",
      frameCount: 5
    });
    expect(reset).toMatchObject({
      status: "reset",
      frameCount: 0
    });
    expect(updated.status).toBe("committed");
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createParameter",
      "createDynamicsGroup",
      "updateDynamicsGroup"
    ]);
    expect(saved.snapshot.document.model.dynamics.dynamicsGroups).toContainEqual(
      expect.objectContaining({
        dynamicsGroupId: "dyn_workflow_hair_sway",
        displayName: "Workflow Hair Settle",
        enabled: false
      })
    );
    expect(loaded.status).toBe("loaded");
    expect(second.state.dynamicsGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({
        dynamicsGroupId: "dyn_workflow_hair_sway",
        displayName: "Workflow Hair Settle",
        enabled: false
      })
    ]));
    expect(second.viewModel.dynamics).toMatchObject({
      groupCountLabel: "1 dynamics group",
      hasGroups: true,
      canCreateGroup: true,
      canRunPreview: false
    });
  });

  it("creates and binds a project-defined rig control, then restores it after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const created = first.commitCreateRotation2dRigControl(createRotationRigControlCommand("body"));
    const bound = first.commitBindRigControlChild({
      parentRigControlId: "rig_workflow_body_rotation",
      child: {
        kind: "drawable",
        id: "draw_body"
      }
    });
    first.openViewerRuntimeSurface();
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();
    second.openViewerRuntimeSurface();

    expect(created.status).toBe("committed");
    expect(bound.status).toBe("committed");
    expect(first.state.rigControls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        displayName: "Workflow Body Rotation",
        childDrawableIds: ["draw_body"],
        childRigControlIds: []
      })
    ]));
    expect(first.viewModel.rigControls).toMatchObject({
      controlCountLabel: "1 rig control",
      hasRigControls: true,
      canCreateRotation2d: true,
      lastRigControlOperationLabel: "bindRigControlChild committed"
    });
    expect(first.state.generatedEvidence.runtimeSnapshotIds.length).toBeGreaterThan(0);
    expect(first.viewerRuntimeProjection?.snapshotSummary).toMatchObject({
      rigControlCount: 1,
      evaluatedRigControlCount: 1,
      rigControls: [
        expect.objectContaining({
          rigControlId: "rig_workflow_body_rotation",
          evaluationStatus: "evaluated",
          affectedDrawableLabel: "draw_body"
        })
      ]
    });
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createRotation2dRigControl",
      "bindRigControlChild"
    ]);
    expect(saved.snapshot.document.model.rigControls.rigControls).toContainEqual(
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        childDrawableIds: ["draw_body"]
      })
    );
    expect(loaded.status).toBe("loaded");
    expect(second.state.rigControls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        childDrawableIds: ["draw_body"]
      })
    ]));
    expect(second.viewerRuntimeProjection?.snapshotSummary.rigControls).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        affectedDrawableLabel: "draw_body"
      })
    ]);
  });

  it("creates a rig control angle keyform and restores viewer-observable evidence after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    first.commitCreateRotation2dRigControl(createRotationRigControlCommand("body"));
    first.commitBindRigControlChild({
      parentRigControlId: "rig_workflow_body_rotation",
      child: {
        kind: "drawable",
        id: "draw_body"
      }
    });
    const keyform = first.commitCreateRotation2dRigControl({
      commandKind: "addRigControlAngleKeyform",
      parameterId: "param_preview_body_yaw",
      rigControlId: "rig_workflow_body_rotation",
      keyValue: 1,
      angleDegrees: 45
    });
    first.openViewerRuntimeSurface();
    first.setViewerParameterValue("param_preview_body_yaw", 1);
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();
    second.openViewerRuntimeSurface();
    second.setViewerParameterValue("param_preview_body_yaw", 1);

    expect(keyform.status).toBe("committed");
    expect(first.state.rigControlAngleKeyforms).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        parameterId: "param_preview_body_yaw",
        keyValue: 1,
        angleDegrees: 45
      })
    ]);
    expect(first.viewModel.rigControls).toMatchObject({
      angleKeyformCountLabel: "1 angle keyform",
      canCreateAngleKeyform: true,
      lastRigControlOperationLabel: "addKeyform committed"
    });
    expect(first.viewerRuntimeProjection?.snapshotSummary.rigControls).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        localAngleLabel: "45",
        worldAngleLabel: "45",
        affectedDrawableLabel: "draw_body"
      })
    ]);
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createRotation2dRigControl",
      "bindRigControlChild",
      "addKeyform"
    ]);
    expect(saved.snapshot.document.model.keyforms.keyformSets).toContainEqual(
      expect.objectContaining({
        target: {
          kind: "rigControl",
          id: "rig_workflow_body_rotation",
          property: "angleDegrees"
        },
        parameterId: "param_preview_body_yaw",
        keys: [
          {
            value: 1,
            statePatch: 45
          }
        ]
      })
    );
    expect(loaded.status).toBe("loaded");
    expect(second.state.rigControlAngleKeyforms).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        parameterId: "param_preview_body_yaw",
        angleDegrees: 45
      })
    ]);
    expect(second.viewerRuntimeProjection?.snapshotSummary.rigControls).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_rotation",
        localAngleLabel: "45",
        worldAngleLabel: "45"
      })
    ]);
  });

  it("creates a warpLattice2d controlPointOffsets keyform and restores it after save and load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    const created = first.commitCreateWarpLattice2dRigControl(createWarpLatticeRigControlCommand("body"));
    const keyform = first.commitAddWarpLattice2dControlPointOffsetsKeyform({
      commandKind: "draftWarpLattice2dControlPointOffsetsKeyform",
      target: {
        source: "package",
        id: "rig_workflow_body_warp",
        property: "controlPointOffsets"
      },
      parameterId: "param_preview_body_yaw",
      keyValue: 1,
      compositionMode: "replace",
      controlPointOffsets: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 0, y: 3 },
        { x: 6, y: 3 }
      ]
    });
    first.openViewerRuntimeSurface();
    first.setViewerParameterValue("param_preview_body_yaw", 1);
    const saved = first.saveProject();
    const second = createWorkflow(storage);
    const loaded = second.loadProject();
    second.openViewerRuntimeSurface();
    second.setViewerParameterValue("param_preview_body_yaw", 1);

    expect(created.status).toBe("committed");
    expect(keyform.status).toBe("committed");
    expect(first.state.rigControls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_warp",
        kind: "warpLattice2d",
        childDrawableIds: ["draw_body"],
        latticeColumns: 2,
        latticeRows: 2
      })
    ]));
    expect(first.state.rigControlWarpLatticeKeyforms).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_warp",
        parameterId: "param_preview_body_yaw",
        keyValue: 1,
        compositionMode: "replace",
        controlPointOffsets: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 0, y: 3 },
          { x: 6, y: 3 }
        ]
      })
    ]);
    expect(first.viewModel.rigControls).toMatchObject({
      warpLatticeKeyformCountLabel: "1 controlPointOffsets keyform",
      lastRigControlOperationLabel: "addKeyform committed"
    });
    expect(first.viewerRuntimeProjection?.snapshotSummary.rigControls).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_warp",
        evaluationStatus: "evaluated",
        affectedDrawableLabel: "draw_body"
      })
    ]);
    expect(saved.snapshot.operationLogEntries.map((entry) => entry.operationType)).toEqual([
      "createWarpLattice2dRigControl",
      "addKeyform"
    ]);
    expect(saved.snapshot.document.model.keyforms.keyformSets).toContainEqual(
      expect.objectContaining({
        target: {
          kind: "rigControl",
          id: "rig_workflow_body_warp",
          property: "controlPointOffsets"
        },
        parameterId: "param_preview_body_yaw",
        compositionMode: "replace"
      })
    );
    expect(loaded.status).toBe("loaded");
    expect(second.state.rigControlWarpLatticeKeyforms).toEqual([
      expect.objectContaining({
        rigControlId: "rig_workflow_body_warp",
        parameterId: "param_preview_body_yaw",
        controlPointOffsets: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 0, y: 3 },
          { x: 6, y: 3 }
        ]
      })
    ]);
  });

  it("surfaces deterministic rig control bind diagnostics without mutating state", () => {
    const workflow = createWorkflow(createMemoryStorage());

    const rejected = workflow.commitBindRigControlChild({
      parentRigControlId: "rig_missing_parent",
      child: {
        kind: "drawable",
        id: "draw_body"
      }
    });

    expect(rejected.status).toBe("rejected");
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.state.rigControls).toEqual([]);
    expect(workflow.viewModel.rigControls).toMatchObject({
      lastRigControlOperationLabel: "bindRigControlChild rejected",
      lastRigControlDiagnostics: [
        expect.objectContaining({
          checkId: "operation.bindRigControlChild.missingParentRigControl",
          severity: "error"
        })
      ]
    });
  });

  it("projects dynamics preview outputs, evidence, and validator diagnostics", () => {
    const workflow = createWorkflow(createMemoryStorage());

    workflow.commitCreateDynamicsGroup(createDynamicsGroupCommand("hair"));
    workflow.setPreviewParameterValue("param_preview_body_yaw", 1);
    const ran = workflow.runDynamicsPreview(3);
    const dynamics = workflow.viewModel.dynamics;

    expect(ran.status).toBe("ran");
    expect(workflow.state.dynamicsPreview).toMatchObject({
      status: "ran",
      lastFrameCount: 3,
      outputs: [
        expect.objectContaining({
          dynamicsGroupId: "dyn_workflow_hair_sway",
          outputParameterId: "param_dynamics_workflow_hair_sway_r0"
        })
      ],
      evidence: expect.objectContaining({
        packageRevision: 2,
        validationReportId: "val_editor_browser_sample_editorIncremental"
      })
    });
    expect(dynamics.previewStatusLabel).toBe("Ran 3 frames");
    expect(dynamics.previewOutputs[0]).toMatchObject({
      dynamicsGroupId: "dyn_workflow_hair_sway",
      outputParameterId: "param_dynamics_workflow_hair_sway_r0"
    });
    expect(dynamics.previewEvidence).toMatchObject({
      snapshotLabel: expect.stringContaining("frame"),
      validationLabel: expect.stringContaining("val_editor_browser_sample_editorIncremental")
    });
    expect(dynamics.previewDiagnostics).toEqual([]);
  });

  it("keeps preview parameter updates out of package documents and operation logs", () => {
    const workflow = createWorkflow(createMemoryStorage());
    const commit = workflow.commitCreateParameter(createParameterCommand("smile"));

    workflow.setPreviewParameterValue("param_workflow_smile", 0.6);
    const saved = workflow.saveProject();

    expect(saved.snapshot.operationLogJsonl).toBe(commit.operationLogJsonl);
    expect(saved.snapshot.document.model.parameters.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        default: 0
      })
    ]));
    expect(JSON.stringify(saved.snapshot.document)).not.toContain("0.6");
    expect(saved.snapshot.packageRevision).toBe(commit.packageRevisionAfterCommit);
    expect(workflow.state.operationLog.entryCount).toBe(1);
  });

  it("initializes preview parameter values from persisted package defaults on load", () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    first.commitCreateParameter(createParameterCommand("smile"));
    first.setPreviewParameterValue("param_workflow_smile", 0.9);
    first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(loaded.status).toBe("loaded");
    expect(second.state.previewParameters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        parameterId: "param_workflow_smile",
        defaultValue: 0,
        currentValue: 0
      })
    ]));
  });

  it("rejects missing and invalid preview parameter updates", () => {
    const workflow = createWorkflow(createMemoryStorage());

    expect(workflow.setPreviewParameterValue("param_missing", 0.5)).toEqual({
      status: "not_found",
      parameterId: "param_missing",
      requestedValue: 0.5
    });
    expect(workflow.setPreviewParameterValue("param_missing", Number.NaN)).toEqual({
      status: "invalid_value",
      parameterId: "param_missing",
      requestedValue: Number.NaN
    });
  });

  it("clears persisted state and returns to the sample package on reset", () => {
    const storage = createMemoryStorage();
    const workflow = createWorkflow(storage);
    workflow.commitCreateParameter(createParameterCommand("smile"));
    workflow.saveProject();

    const reset = workflow.resetToSamplePackage();

    expect(reset.status).toBe("reset");
    expect(workflow.state.loadedPackage?.packageId).toBe("pkg_editor_browser_sample");
    expect(workflow.state.revision.packageRevision).toBe(0);
    expect(parameterIds(workflow)).not.toContain("param_workflow_smile");
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.state.reload.status).toBe("not_reloaded");
    expect(storage.getItem(reset.clearResult.storageKey)).toBeNull();
  });

  it("dry-runs deterministic AI createParameter and leaves package state unmutated", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const initialParameters = workflow.state.parameters;

    const dryRun = await workflow.dryRunAiCreateParameterCommand();

    expect(dryRun.status).toBe("pending_approval");
    expect(dryRun.response).toMatchObject({
      status: "ok",
      command: "dryRunOperation",
      payload: {
        operationResult: {
          status: "dry_run",
          operationId: "op_editor_ai_create_parameter_r0_1"
        }
      }
    });
    expect(workflow.state.parameters).toEqual(initialParameters);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "pending_approval",
      latestDryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
      latestDryRunOperationId: "op_editor_ai_create_parameter_r0_1",
      canApproveLatestDryRun: true,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: true
    });
  });

  it("rejects and clears a pending AI dry-run without mutating package state", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const initialParameters = workflow.state.parameters;
    await workflow.dryRunAiCreateParameterCommand();

    const rejected = workflow.rejectLatestAiDryRun();

    expect(rejected.status).toBe("cleared");
    expect(workflow.state.parameters).toEqual(initialParameters);
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "idle",
      latestDryRunCommandId: null,
      latestDryRunOperationId: null,
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
  });

  it("approves and commits an AI dry-run through operation-core", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    const approval = workflow.approveLatestAiDryRun();
    const committed = await workflow.commitApprovedAiOperation();

    expect(approval.status).toBe("approved");
    expect(committed.status).toBe("committed");
    expect(committed.response).toMatchObject({
      status: "ok",
      command: "commitOperation",
      payload: {
        operationResult: {
          status: "committed",
          operationId: "op_editor_ai_create_parameter_r0_1"
        }
      }
    });
    expect(parameterIds(workflow)).toEqual(expect.arrayContaining(["param_editor_ai_r0_1"]));
    expect(workflow.state.operationLog).toMatchObject({
      entryCount: 1,
      latestEntry: expect.objectContaining({
        operationId: "op_editor_ai_create_parameter_r0_1",
        operationType: "createParameter",
        surface: "structuredApi"
      })
    });
    expect(workflow.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
  });

  it("does not let stale approval survive reset", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();
    workflow.approveLatestAiDryRun();

    workflow.resetToSamplePackage();
    const committed = await workflow.commitApprovedAiOperation();

    expect(committed.status).toBe("no_approved_operation");
    expect(parameterIds(workflow)).not.toContain("param_editor_ai_r0_1");
    expect(workflow.state.operationLog.entryCount).toBe(0);
    expect(workflow.viewModel.aiApproval.status).toBe("idle");
    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([]);
  });

  it("does not let pending approval survive an empty load", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    const initialParameters = workflow.state.parameters;
    await workflow.dryRunAiCreateParameterCommand();

    const loaded = workflow.loadProject();

    expect(loaded.status).toBe("empty");
    expect(workflow.viewModel.aiApproval.status).toBe("idle");
    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([]);
    expect(workflow.state.parameters).toEqual(initialParameters);
    expect(workflow.state.operationLog.entryCount).toBe(0);
  });

  it("summarizes AI command and approval transcript entries for the view model", async () => {
    const workflow = createWorkflow(createMemoryStorage());
    await workflow.dryRunAiCreateParameterCommand();

    workflow.approveLatestAiDryRun();

    expect(workflow.viewModel.aiApproval.transcriptEntries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1",
        evidenceCount: 6
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1",
        evidenceCount: 0
      })
    ]);
  });

  it("saves a non-empty AI transcript and restores it into the loaded view model", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);

    await first.dryRunAiCreateParameterCommand();
    first.approveLatestAiDryRun();
    const saved = first.saveProject();

    const second = createWorkflow(storage);
    const loaded = second.loadProject();

    expect(saved.storeResult.project.aiCommandTranscript.entries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1"
      })
    ]);
    expect(loaded.status).toBe("loaded");
    expect(second.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
    expect(second.viewModel.aiApproval.transcriptEntries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1"
      })
    ]);
  });

  it("loads AI transcript history without restoring actionable approval state", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    await first.dryRunAiCreateParameterCommand();
    first.approveLatestAiDryRun();
    first.saveProject();

    const second = createWorkflow(storage);
    second.loadProject();

    const approval = second.approveLatestAiDryRun();
    const commit = await second.commitApprovedAiOperation();

    expect(second.viewModel.aiApproval.transcriptEntries).toHaveLength(2);
    expect(approval.status).toBe("no_pending_dry_run");
    expect(commit.status).toBe("no_approved_operation");
    expect(second.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
    expect(parameterIds(second)).not.toContain("param_editor_ai_r0_1");
    expect(second.state.operationLog.entryCount).toBe(0);
  });

  it("keeps AI transcript history visible after async persistent byte load", async () => {
    const storage = createMemoryStorage();
    const first = createWorkflow(storage);
    await first.dryRunAiCreateParameterCommand();
    first.approveLatestAiDryRun();
    first.saveProject();

    const second = createWorkflow(storage);
    const loaded = await second.loadProjectWithPersistentBytes();

    expect(loaded.status).toBe("loaded");
    expect(second.viewModel.aiApproval).toMatchObject({
      status: "idle",
      canApproveLatestDryRun: false,
      canCommitApprovedOperation: false,
      canRejectPendingDryRun: false
    });
    expect(second.viewModel.aiApproval.transcriptEntries).toEqual([
      expect.objectContaining({
        entryType: "command",
        commandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        command: "dryRunOperation",
        status: "ok",
        operationId: "op_editor_ai_create_parameter_r0_1"
      }),
      expect.objectContaining({
        entryType: "approval",
        dryRunCommandId: "cmd_editor_ai_dry_run_create_parameter_r0_1",
        approvalStatus: "approved",
        operationId: "op_editor_ai_create_parameter_r0_1"
      })
    ]);
  });
});

const createWorkflow = (storage: StorageLike) =>
  createEditorWorkflowController({
    projectStore: createBrowserProjectStore({
      storage,
      now: () => new Date("2026-05-29T04:00:00.000Z")
    }),
    now: () => new Date("2026-05-29T04:00:00.000Z")
  });

const expectReuploadPreflightRejectedByIntegratedValidation = (
  checks: readonly ValidationCheckResultDto[],
  expected: {
    readonly binaryAssetId: string;
    readonly packageRelativePath: string;
  }
): void => {
  const targetFailEvidence = checks
    .filter((check) =>
      check.status === "fail" &&
      check.evidence.includes(`binaryAssetId=${expected.binaryAssetId}`) &&
      check.evidence.includes(`packageRelativePath=${expected.packageRelativePath}`)
    )
    .flatMap((check) => check.evidence);

  expect(targetFailEvidence).toEqual(expect.arrayContaining([
    `binaryAssetId=${expected.binaryAssetId}`,
    `packageRelativePath=${expected.packageRelativePath}`
  ]));
  expect(
    targetFailEvidence.includes("bytesAvailability=requiresReupload") ||
    targetFailEvidence.includes("requiresReupload=true")
  ).toBe(true);
};

const parameterIds = (
  workflow: ReturnType<typeof createEditorWorkflowController>
): readonly string[] => workflow.state.parameters.map((parameter) => parameter.parameterId);

const drawableIds = (
  workflow: ReturnType<typeof createEditorWorkflowController>
): readonly string[] => workflow.state.drawables.map((drawable) => drawable.drawableId);

const findMeshVertex = (
  document: PackageDocumentDto,
  meshId: string,
  vertexIndex: number
) => document.model.meshes.meshes.find((mesh) => mesh.meshId === meshId)?.vertices[vertexIndex];

const findMeshUv = (
  document: PackageDocumentDto,
  meshId: string,
  vertexIndex: number
) => document.model.meshes.meshes.find((mesh) => mesh.meshId === meshId)?.uvs[vertexIndex];

const findEditableVertex = (
  workflow: ReturnType<typeof createEditorWorkflowController>,
  vertexId: string
) => workflow.state.meshEdit.editableVertices.find((vertex) => vertex.vertexId === vertexId);

const createParameterCommand = (name: "smile" | "brow") => ({
  operationId: `op_workflow_create_parameter_${name}`,
  parameterId: `param_workflow_${name}`,
  displayName: `Workflow ${capitalize(name)}`,
  semanticRole: name === "smile" ? "mouth" : "brow",
  projectPresetAlias: `private-workflow-${name}-control`,
  min: 0,
  max: 1,
  defaultValue: 0,
  recommendedUiStep: 0.01
} as const);

const createDrawablePresetCommand = (name: "star") => ({
  createOperationId: `op_workflow_create_drawable_${name}`,
  generateOperationId: `op_workflow_generate_mesh_${name}`,
  displayName: `Workflow ${capitalize(name)}`,
  sourceAssetId: "src_generated",
  sourceLayerId: "layer_body",
  partId: "part_root",
  initialBounds: { x: 16, y: 24, width: 24, height: 24 },
  meshMethod: "auto-grid-v1",
  densityHint: "low"
} as const);

const createRotationRigControlCommand = (name: "body") => ({
  rigControlId: `rig_workflow_${name}_rotation`,
  displayName: `Workflow ${capitalize(name)} Rotation`,
  partId: "part_root",
  pivot: { x: 50, y: 56 },
  restAngleDegrees: 15
} as const);

const createWarpLatticeRigControlCommand = (name: "body") => ({
  displayName: `Workflow ${capitalize(name)} Warp`,
  partId: "part_root",
  childDrawableIds: ["draw_body"],
  domainBounds: { x: 0, y: 0, width: 128, height: 128 },
  latticeColumns: 2,
  latticeRows: 2,
  interpolationMethod: "bilinear-grid-v1"
} as const);

const createDynamicsGroupCommand = (name: "hair") => ({
  operationId: `op_workflow_create_dynamics_${name}`,
  outputParameterOperationId: `op_workflow_create_dynamics_output_${name}`,
  dynamicsGroupId: "dyn_workflow_hair_sway",
  displayName: "Workflow Hair Sway",
  driverParameterId: "param_preview_body_yaw",
  outputParameterDisplayName: "Workflow Hair Sway",
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
} as const);

const createSourceIntakeDraft = (
  overrides: {
    readonly rightsStatus?: SourceIntakeDraftState["rights"]["rightsStatus"];
    readonly omitTexturePreviewReference?: boolean;
  } = {}
): SourceIntakeDraftState => ({
  ...createEmptySourceIntakeDraftState({ defaultPartId: "part_root" }),
  status: "confirmed",
  sourceAssetId: "src_workflow_split",
  manifestPath: "assets/sources/workflow/split-manifest.json",
  contentHash: "sha256:workflow-split",
  defaultPartId: "part_root",
  placementPolicy: "use-metadata",
  layers: [
    {
      sourceLayerId: "layer_face",
      originalName: "Face.png",
      normalizedName: "face",
      groupPath: ["Head"],
      bounds: { x: 8, y: 10, width: 96, height: 112 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: [],
      ...(overrides.omitTexturePreviewReference === true
        ? {}
        : { texturePreviewReference: "assets/textures/workflow/face.preview.png" }),
      textureId: "tex_face",
      targetPartId: "part_root"
    }
  ],
  rights: {
    rightsStatus: overrides.rightsStatus ?? "needs_review",
    creator: "Workflow Artist",
    license: "private-review",
    redistributionAllowed: false,
    aiUsed: false,
    sourceUrl: "https://example.invalid/workflow-source",
    notes: "workflow source intake test"
  },
  diagnostics: []
});

const createPsdSourceIntakeDraft = (): SourceIntakeDraftState => ({
  ...createPsdAdapterProfileSourceIntakeDraftState({ defaultPartId: "part_root" }),
  status: "confirmed",
  sourceAssetId: "src_workflow_psd_profile",
  manifestPath: "assets/sources/workflow/source.psd",
  contentHash: "sha256:workflow-psd-reference",
  defaultPartId: "part_root",
  psdProfile: {
    adapterName: "manual-psd-profile-entry",
    canvasWidth: 2048,
    canvasHeight: 3072
  },
  layers: [
    {
      sourceLayerId: "layer_face",
      originalName: "Face",
      normalizedName: "face",
      groupPath: ["Root", "Head"],
      bounds: { x: 320, y: 240, width: 512, height: 512 },
      visibleInSource: true,
      opacityInSource: 0.8,
      role: "editableLayer",
      unsupportedFeatures: ["psd.textLayer"],
      texturePreviewReference: "assets/sources/workflow/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root"
    }
  ],
  rights: {
    rightsStatus: "cleared",
    creator: "Workflow Artist",
    license: "private-cleared",
    redistributionAllowed: false,
    aiUsed: false,
    sourceUrl: "https://example.invalid/workflow-psd-source",
    notes: "manual PSD adapter/profile metadata"
  },
  diagnostics: []
});

const capitalize = (text: string): string =>
  `${text.slice(0, 1).toUpperCase()}${text.slice(1)}`;

const createMemoryStorage = (
  entries: readonly (readonly [string, string])[] = []
): StorageLike => {
  const values = new Map(entries);

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    }
  };
};
