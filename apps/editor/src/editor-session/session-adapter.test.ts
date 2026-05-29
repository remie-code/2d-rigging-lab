import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  OperationRequestSchema,
  type OperationRequestDto
} from "@private-2d-rigging-lab/operation-core";
import { describe, expect, it } from "vitest";

import {
  createEditorSessionAdapter,
  type EditorSessionAdapter
} from "./session-adapter.js";

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
