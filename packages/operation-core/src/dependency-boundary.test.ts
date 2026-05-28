import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("operation-core boundary", () => {
  it("keeps the public index as a barrel-only entrypoint", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const indexText = readFileSync(join(sourceDirectory, "index.ts"), "utf8");
    const nonBarrelLines = indexText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.startsWith("export "));

    expect(nonBarrelLines).toEqual([]);
  });

  it("does not import GUI, AI, renderer, runtime, or validator packages", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceFiles = listTypeScriptFiles(sourceDirectory);
    const forbiddenImportPattern =
      /from\s+["']@private-2d-rigging-lab\/(?:editor-ui|ai-interface|renderer-adapter|runtime-core|validator-core)["']/;
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
