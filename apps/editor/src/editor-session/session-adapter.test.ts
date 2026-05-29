import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createEditorSessionAdapter } from "./session-adapter.js";

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
