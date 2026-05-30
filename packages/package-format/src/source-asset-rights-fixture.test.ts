import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PACKAGE_TEXTURE_ATLAS_PATH,
  parsePackageDocument,
  parsePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet
} from "./index.js";

describe("source asset rights validator contract fixture", () => {
  it("parses the compact split PNG package with texture atlas metadata", () => {
    const parsed = parsePackageDocument(loadClearedPackageDocument());

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
    }

    expect(parsed.data.assets.sourceManifest.sourceAssets[0]?.kind).toBe("split-png-set-v1");
    expect(parsed.data.assets.textureAtlas?.textures[0]?.textureId).toBe("tex_body");
  });

  it("roundtrips optional texture atlas through package file set serialization", () => {
    const parsed = parsePackageDocument(loadClearedPackageDocument());
    if (!parsed.success) {
      throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
    }

    const fileSet = serializePackageDocumentToFileSet(parsed.data);
    expect(fileSet.map((entry) => entry.path)).toContain(PACKAGE_TEXTURE_ATLAS_PATH);
    expect(parsePackageDocumentFromFileSet(fileSet)).toEqual(parsed.data);
  });
});

const loadClearedPackageDocument = (): unknown => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/source-asset-rights-provenance-validator"
  );

  return JSON.parse(readFileSync(join(fixtureDirectory, "source-package.cleared.json"), "utf8")) as unknown;
};
