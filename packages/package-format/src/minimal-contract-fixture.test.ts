import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parsePackageDocument } from "./index.js";

describe("minimal-valid-package contract fixture", () => {
  it("parses the unpacked fixture package DTO", () => {
    const packageDocument = loadMinimalFixturePackageDocument();
    const parsed = parsePackageDocument(packageDocument);

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
    }

    expect(parsed.data.manifest.packageId).toBe("pkg_minimal-valid-package");
    expect(parsed.data.model.drawables.drawables).toHaveLength(1);
    expect(parsed.data.assets.sourceManifest.sourceAssets[0]?.kind).toBe("generated-fixture-v1");
  });
});

const loadMinimalFixturePackageDocument = (): unknown => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );

  return {
    manifest: readJson(join(fixtureDirectory, "manifest.json")),
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")),
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")),
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")),
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")),
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")),
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")),
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")),
      masks: readJson(join(fixtureDirectory, "model/masks.json")),
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json"))
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")),
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")),
      rights: readJson(join(fixtureDirectory, "assets/rights.json"))
    }
  };
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
