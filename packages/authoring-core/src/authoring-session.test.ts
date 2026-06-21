import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import type { ParameterDto } from "@private-2d-rigging-lab/package-format";
import { parsePackageDocument } from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  cloneAuthoringSession,
  cloneAuthoringSessionSharingBinaryAssets,
  createAuthoringSessionFromPackageDocument,
  createDryRunAuthoringSession,
  createParameter,
  getParameterById
} from "./index.js";

describe("authoring session foundation", () => {
  it("creates an authoring session from the minimal valid package fixture", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());

    expect(session.packageIdentity.packageId).toBe("pkg_minimal-valid-package");
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(session.graph.drawables).toHaveLength(1);
    expect(session.graph.parameters).toHaveLength(0);
  });

  it("clones a dry-run authoring session without mutating the original", () => {
    const original = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const dryRunSession = createDryRunAuthoringSession(original);
    const parameter = createTestParameter("param_dry_run_only");

    createParameter(dryRunSession, parameter);

    expect(getParameterById(dryRunSession.graph, parameter.parameterId)?.displayName).toBe("Dry Run Only");
    expect(getParameterById(original.graph, parameter.parameterId)).toBeUndefined();
    expect(dryRunSession.authoringRevision).toBe(1);
    expect(original.authoringRevision).toBe(0);
    expect(dryRunSession.dirty).toBe(true);
    expect(original.dirty).toBe(false);
  });

  it("clones graph-edit sessions while sharing immutable binary byte payloads", () => {
    const original = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const bytes = new Uint8Array([0x61, 0x62, 0x63]);
    original.binaryAssets = {
      fileEntries: [
        {
          path: "assets/textures/test.raw-rgba",
          bytes,
          mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
          binaryAssetId: "bin_test_raw_rgba"
        }
      ],
      binaryAssetIndex: {
        schemaVersion: "binary-asset-index-v1",
        assets: []
      },
      byteIntakeSummaries: []
    };

    const clone = cloneAuthoringSessionSharingBinaryAssets(original);
    const parameter = createTestParameter("param_graph_edit_only");
    createParameter(clone, parameter);

    expect(clone).not.toBe(original);
    expect(clone.graph).not.toBe(original.graph);
    expect(clone.binaryAssets).not.toBe(original.binaryAssets);
    expect(clone.binaryAssets?.fileEntries).not.toBe(original.binaryAssets.fileEntries);
    expect(clone.binaryAssets?.fileEntries[0]).not.toBe(original.binaryAssets.fileEntries[0]);
    expect(clone.binaryAssets?.fileEntries[0]?.bytes).toBe(bytes);
    expect(clone.binaryAssets?.binaryAssetIndex).not.toBe(original.binaryAssets.binaryAssetIndex);
    expect(getParameterById(clone.graph, parameter.parameterId)?.displayName).toBe("Graph Edit Only");
    expect(getParameterById(original.graph, parameter.parameterId)).toBeUndefined();
  });

  it("keeps the generic authoring session clone as a full binary deep clone", () => {
    const original = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const bytes = new Uint8Array([0x61, 0x62, 0x63]);
    original.binaryAssets = {
      fileEntries: [
        {
          path: "assets/textures/test.raw-rgba",
          bytes,
          mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
          binaryAssetId: "bin_test_raw_rgba"
        }
      ],
      binaryAssetIndex: {
        schemaVersion: "binary-asset-index-v1",
        assets: []
      },
      byteIntakeSummaries: []
    };

    const clone = cloneAuthoringSession(original);

    expect(clone.binaryAssets?.fileEntries[0]?.bytes).toEqual(bytes);
    expect(clone.binaryAssets?.fileEntries[0]?.bytes).not.toBe(bytes);
  });

  it("creates a parameter and marks the session dirty with a new authoring revision", () => {
    const session = createAuthoringSessionFromPackageDocument(loadMinimalFixturePackageDocument());
    const parameter = createTestParameter("param_new_smile");

    const result = createParameter(session, parameter);

    expect(result.session).toBe(session);
    expect(result.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getParameterById(session.graph, parameter.parameterId)).toEqual(parameter);
    expect(session.graph.stableOrder).toContain(parameter.parameterId);
  });
});

const createTestParameter = (parameterIdText: string): ParameterDto => ({
  parameterId: ParameterIdSchema.parse(parameterIdText),
  displayName: toDisplayName(parameterIdText),
  valueSource: "authoredInput",
  min: -1,
  max: 1,
  default: 0,
  recommendedUiStep: 0.01
});

const toDisplayName = (parameterIdText: string): string =>
  parameterIdText
    .replace(/^param_/, "")
    .split("_")
    .map((token) => `${token[0]?.toUpperCase() ?? ""}${token.slice(1)}`)
    .join(" ");

const loadMinimalFixturePackageDocument = () => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );
  const parsed = parsePackageDocument({
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

  if (!parsed.success) {
    throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
  }

  return parsed.data;
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
