import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const browserSourceDirectoryPath = path.dirname(fileURLToPath(import.meta.url));

describe("Browser Source Stage entry boundary", () => {
  it("does not depend on Electron preload or Node APIs", () => {
    const sourceFiles = [
      "browser-source-stage-entry.tsx",
      "browser-source-stage-app.tsx",
      "browser-source-stage-client.ts",
      "browser-source-page-config.ts",
      "browser-source-client-diagnostics.ts"
    ];

    const source = sourceFiles
      .map((fileName) =>
        readFileSync(path.join(browserSourceDirectoryPath, fileName), "utf8")
      )
      .join("\n");

    expect(source).not.toContain("window.runtimePlayerStage");
    expect(source).not.toContain("window.runtimePlayer");
    expect(source).not.toContain("ipcRenderer");
    expect(source).not.toMatch(/\bfrom\s+["']electron["']/);
    expect(source).not.toMatch(/\bfrom\s+["']node:/);
  });
});
