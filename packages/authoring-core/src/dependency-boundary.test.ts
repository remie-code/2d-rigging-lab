import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("authoring-core dependency boundary", () => {
  it("imports runtime-core only from the runtime graph adapter and never imports operation or validator packages", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceFiles = listTypeScriptFiles(sourceDirectory);
    const forbiddenImportPattern = /from\s+["']@private-2d-rigging-lab\/(?:operation-core|validator-core)["']/;
    const forbiddenOffenders = sourceFiles.filter((filePath) => {
      if (filePath.endsWith("dependency-boundary.test.ts")) {
        return false;
      }

      return forbiddenImportPattern.test(readFileSync(filePath, "utf8"));
    });
    const runtimeImportPattern = /from\s+["']@private-2d-rigging-lab\/runtime-core["']/;
    const allowedRuntimeImportFiles = new Set([
      "runtime-graph-parameters.ts",
      "runtime-graph-drawables.ts",
      "runtime-graph-dynamics.ts",
      "runtime-graph-rig-controls.ts",
      "runtime-graph-keyforms.ts",
      "to-runtime-graph.ts",
      "runtime-graph-adapter.test.ts"
    ]);
    const runtimeOffenders = sourceFiles.filter((filePath) => {
      if (!runtimeImportPattern.test(readFileSync(filePath, "utf8"))) {
        return false;
      }

      return !allowedRuntimeImportFiles.has(filePath.split(/[\\/]/).at(-1) ?? "");
    });

    expect(forbiddenOffenders).toEqual([]);
    expect(runtimeOffenders).toEqual([]);
  });
});

const listTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return path.endsWith(".ts") ? [path] : [];
  });
