import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ParameterIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  type PackageDocumentDto,
  type ParameterDto,
  parsePackageDocument
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import {
  createAuthoringSessionFromPackageDocument,
  createParameter,
  toPackageDocument,
  upsertTexturePreviewAssetMetadata
} from "./index.js";

describe("authoring package document adapter", () => {
  it("converts a minimal-valid-package session back to a package document", () => {
    const baseDocument = loadMinimalFixturePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);

    const document = toPackageDocument(session, baseDocument, {
      updatedAt: baseDocument.manifest.updatedAt
    });

    expect(PackageDocumentSchema.parse(document)).toEqual(document);
    expect(document.manifest.packageRevision).toBe(baseDocument.manifest.packageRevision);
    expect(document.model.graph).toEqual(baseDocument.model.graph);
    expect(document.model.drawables).toEqual(baseDocument.model.drawables);
    expect(document.assets.sourceManifest).toEqual(baseDocument.assets.sourceManifest);
  });

  it("includes a newly added parameter, stable order, package revision, and updatedAt", () => {
    const baseDocument = loadMinimalFixturePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);
    const parameter = createTestParameter("param_adapter_smile");

    createParameter(session, parameter);
    session.packageRevision = 1;

    const document = toPackageDocument(session, baseDocument, {
      updatedAt: "2026-05-29T01:00:00.000Z"
    });

    expect(document.manifest.packageRevision).toBe(1);
    expect(document.manifest.updatedAt).toBe("2026-05-29T01:00:00.000Z");
    expect(document.model.parameters.parameters).toEqual([parameter]);
    expect(document.model.graph.stableOrder).toEqual([
      ...baseDocument.model.graph.stableOrder,
      parameter.parameterId
    ]);
  });

  it("preserves base manifest metadata while reflecting session model and asset graph", () => {
    const baseDocument = loadMinimalFixturePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);
    session.packageRevision = 3;

    const document = toPackageDocument(session, baseDocument, {
      updatedAt: "2026-05-29T02:00:00.000Z"
    });

    expect(document.manifest).toMatchObject({
      packageId: baseDocument.manifest.packageId,
      packageDisplayName: baseDocument.manifest.packageDisplayName,
      formatVersion: baseDocument.manifest.formatVersion,
      createdAt: baseDocument.manifest.createdAt,
      schemaVersions: baseDocument.manifest.schemaVersions,
      evaluatorVersions: baseDocument.manifest.evaluatorVersions,
      rightsSummary: baseDocument.manifest.rightsSummary,
      provenanceSummary: baseDocument.manifest.provenanceSummary
    });
    expect(document.manifest.packageRevision).toBe(session.packageRevision);
    expect(document.assets.provenance.records).toEqual(session.graph.provenanceRecords);
    expect(document.assets.rights.records).toEqual(session.graph.rightsRecords);
  });

  it("carries source-layer-derived texture preview metadata back to package assets", () => {
    const baseDocument = loadMinimalFixturePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);

    const result = upsertTexturePreviewAssetMetadata(session, {
      textureEntry: {
        textureId: TextureIdSchema.parse("tex_generated_body"),
        filePath: "assets/textures/generated-body.png",
        contentHash: "sha256:generated-body-texture"
      },
      previewAsset: {
        previewAssetId: "preview_generated_body",
        textureId: TextureIdSchema.parse("tex_generated_body"),
        reference: {
          referenceKind: "package-local-file-v1",
          filePath: "assets/thumbnails/generated-body-preview.png"
        },
        contentHash: "sha256:generated-body-preview",
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        sourceLayerId: "layer_body",
        provenanceId: ProvenanceIdSchema.parse("prov_generated"),
        rightsAssetId: "src_generated"
      }
    });

    const document = toPackageDocument(session, baseDocument, {
      updatedAt: baseDocument.manifest.updatedAt
    });

    expect(result.authoringRevision).toBe(1);
    expect(document.assets.sourceManifest.sourceAssets[0]?.layers[0]?.sourceLayerId).toBe(
      "layer_body"
    );
    expect(document.assets.provenance.records).toEqual(session.graph.provenanceRecords);
    expect(document.assets.rights.records).toEqual(session.graph.rightsRecords);
    expect(document.assets.textureAtlas?.textures[0]).toMatchObject({
      textureId: "tex_generated_body",
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body",
      provenanceId: "prov_generated"
    });
    expect(document.assets.textureAtlas?.previewAssets?.[0]).toMatchObject({
      previewAssetId: "preview_generated_body",
      textureId: "tex_generated_body",
      sourceAssetId: "src_generated",
      sourceLayerId: "layer_body",
      provenanceId: "prov_generated",
      rightsAssetId: "src_generated"
    });
    expect(document.assets.textureAtlas?.previewAssets?.[0]?.reference).toEqual({
      referenceKind: "package-local-file-v1",
      filePath: "assets/thumbnails/generated-body-preview.png"
    });
  });

  it("exposes the adapter from the public barrel", () => {
    expect(toPackageDocument).toBeTypeOf("function");
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

const loadMinimalFixturePackageDocument = (): PackageDocumentDto => {
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
