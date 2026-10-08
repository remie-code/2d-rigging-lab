import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PackageDocumentSchema,
  WORKSPACE_BINARY_ASSET_INDEX_METADATA_PATH,
  WORKSPACE_METADATA_PATH,
  parseWorkspacePackageDocumentFromFileSet,
  serializeWorkspacePackageFileSet,
  type PackageDocumentDto
} from "./index.js";

describe("workspace package file set", () => {
  it("serializes workspace metadata as an entrypoint beside the PackageDocument file set", () => {
    const document = loadMinimalFixturePackageDocument();
    const fileSet = serializeWorkspacePackageFileSet({ packageDocument: document });
    const parsed = parseWorkspacePackageDocumentFromFileSet(fileSet);

    expect(fileSet[0]).toMatchObject({
      path: WORKSPACE_METADATA_PATH
    });
    expect(parsed.workspaceMetadata).toMatchObject({
      schemaVersion: "ai-native-live2d-workspace-v1",
      workspaceKind: "directory-workspace-v1",
      packageEntrypoint: "manifest.json",
      packageId: document.manifest.packageId,
      packageDisplayName: document.manifest.packageDisplayName
    });
    expect(parsed.packageDocument).toEqual(document);
  });

  it("rejects traversal, absolute paths, backslashes, and duplicate paths before opening", () => {
    const document = loadMinimalFixturePackageDocument();
    const validFileSet = serializeWorkspacePackageFileSet({ packageDocument: document });

    expect(() => parseWorkspacePackageDocumentFromFileSet([
      ...validFileSet,
      { path: "../outside.json", text: "{}" }
    ])).toThrow(/path traversal/);

    expect(() => parseWorkspacePackageDocumentFromFileSet([
      ...validFileSet,
      { path: "/absolute.json", text: "{}" }
    ])).toThrow(/absolute paths/);

    expect(() => parseWorkspacePackageDocumentFromFileSet([
      ...validFileSet,
      { path: "C:/absolute.json", text: "{}" }
    ])).toThrow(/absolute paths/);

    expect(() => parseWorkspacePackageDocumentFromFileSet([
      ...validFileSet,
      { path: "metadata\\binary-asset-index.json", text: "{}" }
    ])).toThrow(/backslash/);

    expect(() => parseWorkspacePackageDocumentFromFileSet([
      ...validFileSet,
      { path: WORKSPACE_METADATA_PATH, text: "{}" }
    ])).toThrow(/Duplicate workspace file path/);
  });

  it("treats stale derived binary metadata as a warning, not an authority", () => {
    const document = loadMinimalFixturePackageDocument();
    const fileSet = serializeWorkspacePackageFileSet({
      packageDocument: document,
      derivedMetadataEntries: [
        {
          path: WORKSPACE_BINARY_ASSET_INDEX_METADATA_PATH,
          text: JSON.stringify({
            schemaVersion: "binary-asset-index-v1",
            assets: [
              {
                binaryAssetId: "bin_stale_metadata_only",
                role: "texture-raster-v1",
                packageRelativePath: "assets/textures/stale.raw-rgba",
                digest: { algorithm: "sha256", hex: "0".repeat(64) },
                byteLength: 1,
                mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
                storageStatus: "stored-package-local-v1",
                provenanceId: "prov_stale",
                rightsAssetId: "rights_stale"
              }
            ]
          })
        }
      ]
    });
    const parsed = parseWorkspacePackageDocumentFromFileSet(fileSet);

    expect(parsed.packageDocument).toEqual(document);
    expect(parsed.warnings).toEqual([
      expect.objectContaining({
        code: "workspace.metadata.binaryAssetIndex.ignored",
        path: WORKSPACE_BINARY_ASSET_INDEX_METADATA_PATH
      })
    ]);
  });

  it("does not allow operation logs through workspace derived metadata entries", () => {
    const document = loadMinimalFixturePackageDocument();

    expect(() => serializeWorkspacePackageFileSet({
      packageDocument: document,
      derivedMetadataEntries: [
        {
          path: "operations/log.jsonl",
          text: ""
        }
      ]
    })).toThrow(/Unsupported workspace derived metadata path/);
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
