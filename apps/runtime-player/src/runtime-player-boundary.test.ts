import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));

describe("Runtime Player process boundaries", () => {
  it("keeps renderer production files away from Node and raw Electron APIs", () => {
    const rendererFiles = [
      ...collectProductionFiles(path.join(sourceRoot, "control")),
      ...collectProductionFiles(path.join(sourceRoot, "stage"))
    ];

    for (const filePath of rendererFiles) {
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/\bfrom\s+["']electron["']/);
      expect(source, filePath).not.toMatch(/\bfrom\s+["']node:/);
      expect(source, filePath).not.toContain("ipcRenderer");
      expect(source, filePath).not.toContain("BrowserWindow");
    }
  });

  it("keeps Stage production files free of setup and debug controls", () => {
    const stageFiles = collectProductionFiles(path.join(sourceRoot, "stage"));
    const stageSource = stageFiles
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(stageSource).not.toContain("<button");
    expect(stageSource).not.toContain("Debug");
    expect(stageSource).not.toContain("Connect");
    expect(stageSource).not.toContain("Runtime Export");
  });

  it("keeps the main process away from React UI modules", () => {
    const mainFiles = collectProductionFiles(path.join(sourceRoot, "main"));

    for (const filePath of mainFiles) {
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/\bfrom\s+["']react/);
      expect(source, filePath).not.toMatch(/\bfrom\s+["']\.\.\/control/);
      expect(source, filePath).not.toMatch(/\bfrom\s+["']\.\.\/stage/);
    }
  });
});

function collectProductionFiles(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectProductionFiles(entryPath));
      continue;
    }

    if (
      statSync(entryPath).isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".test.ts")
    ) {
      files.push(entryPath);
    }
  }

  return files;
}
