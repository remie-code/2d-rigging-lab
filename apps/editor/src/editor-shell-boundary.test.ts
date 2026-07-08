import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const sourceRoot = path.dirname(fileURLToPath(import.meta.url));
const mainRoot = path.join(sourceRoot, "main");
const preloadRoot = path.join(sourceRoot, "preload");

describe("Editor shell process boundaries", () => {
  it("keeps renderer production files away from Node and raw Electron APIs", () => {
    const rendererFiles = collectRendererProductionFiles(sourceRoot);

    expect(rendererFiles.length).toBeGreaterThan(0);

    for (const filePath of rendererFiles) {
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/\bfrom\s+["']electron["']/);
      expect(source, filePath).not.toMatch(/\bfrom\s+["']node:/);
      expect(source, filePath).not.toContain("ipcRenderer");
      expect(source, filePath).not.toContain("BrowserWindow");
    }
  });

  it("keeps the main process away from React and renderer app modules", () => {
    const mainFiles = collectProductionFiles(mainRoot);

    expect(mainFiles.length).toBeGreaterThan(0);

    for (const filePath of mainFiles) {
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/\bfrom\s+["']react/);
      expect(source, filePath).not.toMatch(/\bfrom\s+["']\.\.\/app/);
      expect(source, filePath).not.toMatch(/\bfrom\s+["'][^"']*\/main\.tsx/);
    }
  });
});

// Renderer production files = every non-test .ts/.tsx under src/**, excluding
// the Electron main (src/main/**) and preload (src/preload/**) subtrees.
function collectRendererProductionFiles(root: string): string[] {
  return collectProductionFiles(root).filter(
    (filePath) =>
      !isInside(filePath, mainRoot) && !isInside(filePath, preloadRoot)
  );
}

function isInside(filePath: string, directoryPath: string): boolean {
  const relative = path.relative(directoryPath, filePath);

  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(
    relative
  );
}

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
      !/\.test\.(ts|tsx)$/.test(entry.name)
    ) {
      files.push(entryPath);
    }
  }

  return files;
}
