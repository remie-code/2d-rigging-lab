import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";
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
