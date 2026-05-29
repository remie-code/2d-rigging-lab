import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("ai-interface dependency boundary", () => {
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

  it("declares the expected package scaffold and approved production dependencies", () => {
    const packageJsonPath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
      exports?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
    const dependencyNames = Object.keys(packageJson.dependencies ?? {}).sort();

    expect(packageJson.name).toBe("@private-2d-rigging-lab/ai-interface");
    expect(packageJson.exports).toEqual({
      ".": "./src/index.ts"
    });
    expect(dependencyNames).toEqual([
      "@private-2d-rigging-lab/contracts",
      "@private-2d-rigging-lab/operation-core",
      "@private-2d-rigging-lab/runtime-core",
      "@private-2d-rigging-lab/validator-core",
      "zod"
    ]);
  });

  it("does not import forbidden implementation packages from production source", () => {
    const productionSourceFiles = listProductionSourceFiles();
    const forbiddenPackageImportPattern =
      /from\s+["'](?:@private-2d-rigging-lab\/(?:authoring-core|editor|editor-ui|package-format|renderer-adapter|viewer-ui)|(?:\.\.?\/)*apps\/editor(?:\/|["']))/;
    const offenders = productionSourceFiles.filter((filePath) =>
      forbiddenPackageImportPattern.test(readFileSync(filePath, "utf8"))
    );

    expect(offenders).toEqual([]);
  });

  it("does not import filesystem or transport APIs from production source", () => {
    const productionSourceFiles = listProductionSourceFiles();
    const forbiddenRuntimeImportPattern =
      /from\s+["'](?:node:fs|node:fs\/promises|fs|fs\/promises|node:http|node:https|http|https|ws|undici|@modelcontextprotocol\/[^"']+)["']/;
    const offenders = productionSourceFiles.filter((filePath) =>
      forbiddenRuntimeImportPattern.test(readFileSync(filePath, "utf8"))
    );

    expect(offenders).toEqual([]);
  });

  it("does not reference DOM or browser globals from production source", () => {
    const productionSourceFiles = listProductionSourceFiles();
    const forbiddenBrowserApiPattern =
      /\b(?:window|document|navigator|HTMLElement|HTMLCanvasElement|localStorage|sessionStorage|fetch|WebSocket|EventSource)\b/;
    const offenders = productionSourceFiles.filter((filePath) =>
      forbiddenBrowserApiPattern.test(readFileSync(filePath, "utf8"))
    );

    expect(offenders).toEqual([]);
  });
});

const listProductionSourceFiles = (): string[] => {
  const sourceDirectory = dirname(fileURLToPath(import.meta.url));

  return listTypeScriptFiles(sourceDirectory).filter((filePath) => !filePath.endsWith(".test.ts"));
};

const listTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return path.endsWith(".ts") ? [path] : [];
  });
