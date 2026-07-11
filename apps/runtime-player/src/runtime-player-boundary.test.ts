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

  it("keeps Stage production files away from raw tracking input", () => {
    const stageFiles = collectProductionFiles(path.join(sourceRoot, "stage"));
    const stageSource = stageFiles
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(stageSource).not.toContain("TrackingFrame");
    expect(stageSource).not.toContain("rawFrame");
    expect(stageSource).not.toContain("blendshapes");
  });

  it("uses a minimal Stage preload bridge instead of the Control API", () => {
    const stageWindowApp = readFileSync(
      path.join(sourceRoot, "stage", "stage-window-app.tsx"),
      "utf8"
    );
    const stageBridgeContract = readFileSync(
      path.join(sourceRoot, "preload", "runtime-player-stage-bridge-contract.ts"),
      "utf8"
    );
    const stageBridge = readFileSync(
      path.join(sourceRoot, "preload", "runtime-player-stage-bridge.ts"),
      "utf8"
    );
    const windowManagement = readFileSync(
      path.join(sourceRoot, "main", "window-management", "runtime-player-windows.ts"),
      "utf8"
    );

    expect(stageWindowApp).toContain("window.runtimePlayerStage");
    expect(stageWindowApp).not.toContain("window.runtimePlayer.");
    expect(stageBridge).toContain("runtimePlayerStage");
    expect(windowManagement).toContain("getControlPreloadFilePath");
    expect(windowManagement).toContain("getStagePreloadFilePath");

    for (const source of [stageBridgeContract, stageBridge]) {
      expect(source).not.toContain("RuntimePlayerInputApi");
      expect(source).not.toContain("RuntimePlayerInputProfileApi");
      expect(source).not.toContain("RuntimePlayerModelMappingApi");
      expect(source).not.toContain("RuntimePlayerApi");
      expect(source).not.toContain("inputProfile");
      expect(source).not.toContain("modelMapping");
      expect(source).not.toContain("getDiagnostics");
      expect(source).not.toContain("copyDiagnostics");
      expect(source).not.toContain("openDirectory");
      expect(source).not.toContain("TrackingFrame");
      expect(source).not.toContain("rawFrame");
      expect(source).not.toContain("blendshapes");
    }
  });

  it("keeps the main process away from React UI modules", () => {
    const mainFiles = collectProductionFiles(path.join(sourceRoot, "main"));

    for (const filePath of mainFiles) {
      const source = readFileSync(filePath, "utf8");

      expect(source, filePath).not.toMatch(/\bfrom\s+["']react/);
      // The trailing [/"'] anchors the match to the `control` / `stage` renderer
      // DIRECTORIES (`../control/…`, `../control"`), so a main-process sibling
      // whose name merely starts with `control` (e.g. `../control-channel/…`, the
      // C4 Control Channel main module) is NOT a false positive.
      expect(source, filePath).not.toMatch(/\bfrom\s+["']\.\.\/control[/"']/);
      expect(source, filePath).not.toMatch(/\bfrom\s+["']\.\.\/stage[/"']/);
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
