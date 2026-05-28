import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("authoring-core dependency boundary", () => {
  it("does not import runtime, operation, or validator implementation packages", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceFiles = listTypeScriptFiles(sourceDirectory);
    const forbiddenImportPattern =
      /from\s+["']@private-2d-rigging-lab\/(?:runtime-core|operation-core|validator-core)["']/;
    const offenders = sourceFiles.filter((filePath) => {
      if (filePath.endsWith("dependency-boundary.test.ts")) {
        return false;
      }

      return forbiddenImportPattern.test(readFileSync(filePath, "utf8"));
    });

    expect(offenders).toEqual([]);
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
