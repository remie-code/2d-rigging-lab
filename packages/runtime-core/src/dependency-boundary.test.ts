import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("runtime-core dependency boundary", () => {
  it("does not import downstream or sibling implementation packages from runtime-core source", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const sourceFiles = listTypeScriptFiles(sourceDirectory);
    const forbiddenImportPattern =
      /from\s+["']@private-2d-rigging-lab\/(?:package-format|authoring-core|operation-core|validator-core)["']/;
    const offenders = sourceFiles.filter((filePath) => {
      if (filePath.endsWith("dependency-boundary.test.ts")) {
        return false;
      }

      return forbiddenImportPattern.test(readFileSync(filePath, "utf8"));
    });

    expect(offenders).toEqual([]);
  });

  it("does not perform package filesystem IO from production runtime-core source", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const productionSourceFiles = listTypeScriptFiles(sourceDirectory).filter((filePath) => !filePath.endsWith(".test.ts"));
    const forbiddenIoImportPattern = /from\s+["'](?:node:fs|node:fs\/promises|fs|fs\/promises)["']/;
    const offenders = productionSourceFiles.filter((filePath) =>
      forbiddenIoImportPattern.test(readFileSync(filePath, "utf8"))
    );

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
