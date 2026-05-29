import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PackageDocumentSchema,
  PACKAGE_PROVENANCE_PATH,
  PACKAGE_RIGHTS_PATH,
  parsePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet,
  stringifyJsonDeterministic,
  type PackageDocumentDto
} from "./index.js";

describe("package file set serialization", () => {
  it("serializes minimal-valid-package and reloads the same semantic document", () => {
    const document = loadMinimalFixturePackageDocument();
    const fileSet = serializePackageDocumentToFileSet(document);
    const reloaded = parsePackageDocumentFromFileSet(fileSet);

    expect(reloaded).toEqual(document);
  });

  it("uses required package paths from the manifest", () => {
    const document = loadMinimalFixturePackageDocument();
    const fileSet = serializePackageDocumentToFileSet(document);
    const paths = fileSet.map((entry) => entry.path);

    expect(paths).toEqual([
      "manifest.json",
      document.manifest.modelFiles.graph,
      document.manifest.modelFiles.drawables,
      document.manifest.modelFiles.meshes,
      document.manifest.modelFiles.parameters,
      document.manifest.modelFiles.keyforms,
      document.manifest.modelFiles.rigControls,
      document.manifest.modelFiles.dynamics,
      document.manifest.modelFiles.masks,
      document.manifest.modelFiles.drawOrder,
      document.manifest.assetIndex,
      PACKAGE_PROVENANCE_PATH,
      PACKAGE_RIGHTS_PATH
    ]);
  });

  it("serializes JSON deterministically with a trailing newline", () => {
    const document = loadMinimalFixturePackageDocument();
    const first = serializePackageDocumentToFileSet(document);
    const second = serializePackageDocumentToFileSet(document);
    const manifestEntry = first.find((entry) => entry.path === "manifest.json");

    expect(first).toEqual(second);
    expect(manifestEntry?.text.endsWith("\n")).toBe(true);
    expect(stringifyJsonDeterministic({ zebra: 1, alpha: { beta: 2, alpha: 1 } })).toBe(
      "{\n" +
        "  \"alpha\": {\n" +
        "    \"alpha\": 1,\n" +
        "    \"beta\": 2\n" +
        "  },\n" +
        "  \"zebra\": 1\n" +
        "}\n"
    );
  });

  it("rejects unsafe package-relative paths", () => {
    const document = loadMinimalFixturePackageDocument();
    const validFileSet = serializePackageDocumentToFileSet(document);

    expect(() => parsePackageDocumentFromFileSet([
      ...validFileSet,
      {
        path: "../outside.json",
        text: "{}"
      }
    ])).toThrow(/path traversal/);

    expect(() => serializePackageDocumentToFileSet(document, {
      generatedArtifacts: [
        {
          path: "runtime\\states\\bad.runtime-state.json",
          text: "{}"
        }
      ]
    })).toThrow(/backslash/);

    expect(() => parsePackageDocumentFromFileSet([
      ...validFileSet,
      {
        path: "/absolute.json",
        text: "{}"
      }
    ])).toThrow(/absolute path/);

    expect(() => serializePackageDocumentToFileSet(document, {
      generatedArtifacts: [
        {
          path: "C:/absolute.json",
          text: "{}"
        }
      ]
    })).toThrow(/absolute path/);

    expect(() => parsePackageDocumentFromFileSet([
      ...validFileSet,
      {
        path: "manifest.json",
        text: "{}"
      }
    ])).toThrow(/Duplicate package file path/);

    expect(() => serializePackageDocumentToFileSet(document, {
      generatedArtifacts: [
        {
          path: "runtime/snapshots/duplicate.runtime-snapshot.json",
          text: "{}"
        },
        {
          path: "runtime/snapshots/duplicate.runtime-snapshot.json",
          text: "{}"
        }
      ]
    })).toThrow(/Duplicate package file path/);
  });

  it("validates optional operation log and generated artifacts only as package text paths", () => {
    const document = loadMinimalFixturePackageDocument();
    const fileSet = serializePackageDocumentToFileSet(document, {
      operationLogText: "not json\n",
      generatedArtifacts: [
        {
          path: "runtime/snapshots/not-parsed.runtime-snapshot.json",
          text: "not json either"
        }
      ]
    });

    expect(fileSet.some((entry) => entry.path === document.manifest.operationLog)).toBe(true);
    expect(parsePackageDocumentFromFileSet(fileSet)).toEqual(document);
  });

  it("does not import peer core modules into package-format", () => {
    const sourceDirectory = dirname(fileURLToPath(import.meta.url));
    const forbiddenImportPattern =
      /@private-2d-rigging-lab\/(?:authoring-core|operation-core|runtime-core|validator-core)/;

    for (const sourceFile of collectProductionSourceFiles(sourceDirectory)) {
      expect(readFileSync(sourceFile, "utf8")).not.toMatch(forbiddenImportPattern);
    }
  });
});

const loadMinimalFixturePackageDocument = (): PackageDocumentDto => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );

  return PackageDocumentSchema.parse({
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
  });
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const collectProductionSourceFiles = (directory: string): readonly string[] => {
  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectProductionSourceFiles(entryPath));
      continue;
    }

    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(entryPath);
    }
  }

  return files;
};
