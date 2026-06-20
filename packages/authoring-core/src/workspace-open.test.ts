import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PackageDocumentSchema,
  serializeWorkspacePackageFileSet,
  type PackageDocumentDto,
  type PackageTextFileEntry
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import { openAuthoringWorkspaceFromTextFileSet } from "./index.js";

describe("authoring workspace open adapter", () => {
  it("opens a workspace text file-set through the package-format parser", () => {
    const document = loadMinimalFixturePackageDocument();
    const fileSet = serializeWorkspacePackageFileSet({ packageDocument: document });

    const opened = openAuthoringWorkspaceFromTextFileSet({ fileSet });

    expect(opened.workspaceMetadata).toMatchObject({
      schemaVersion: "ai-native-live2d-workspace-v1",
      workspaceKind: "directory-workspace-v1",
      packageEntrypoint: "manifest.json"
    });
    expect(opened.packageDocument).toEqual(document);
    expect(opened.session.packageIdentity.packageId).toBe(document.manifest.packageId);
    expect(opened.session.packageIdentity.packageDisplayName).toBe(
      document.manifest.packageDisplayName
    );
    expect(opened.session.dirty).toBe(false);
    expect(opened.editorHiddenPartIds).toEqual([]);
    expect(opened.binaryRegistrationTargets).toEqual([]);
  });

  it("rejects invalid workspace.json metadata through WorkspaceMetadataSchema", () => {
    const document = loadMinimalFixturePackageDocument();
    const fileSet = replaceTextEntry(
      serializeWorkspacePackageFileSet({ packageDocument: document }),
      "workspace.json",
      JSON.stringify({
        schemaVersion: "ai-native-live2d-workspace-v1",
        workspaceKind: "directory-workspace-v1",
        packageEntrypoint: "manifest.json",
        unexpectedAppLocalField: true
      })
    );

    expect(() => openAuthoringWorkspaceFromTextFileSet({ fileSet })).toThrow();
  });

  it("rejects invalid package file sets through package-format schema validation", () => {
    const document = loadMinimalFixturePackageDocument();
    const validFileSet = serializeWorkspacePackageFileSet({ packageDocument: document });
    const manifest = JSON.parse(readTextEntry(validFileSet, "manifest.json")) as {
      packageRevision: unknown;
    };
    manifest.packageRevision = "not-a-number";

    const fileSet = replaceTextEntry(validFileSet, "manifest.json", JSON.stringify(manifest));

    expect(() => openAuthoringWorkspaceFromTextFileSet({ fileSet })).toThrow();
  });
});

const replaceTextEntry = (
  fileSet: readonly PackageTextFileEntry[],
  path: string,
  text: string
): readonly PackageTextFileEntry[] =>
  fileSet.map((entry) => entry.path === path ? { path, text } : entry);

const readTextEntry = (fileSet: readonly PackageTextFileEntry[], path: string): string => {
  const entry = fileSet.find((candidate) => candidate.path === path);
  if (entry === undefined) {
    throw new Error(`Expected fixture file set to include "${path}".`);
  }

  return entry.text;
};

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
