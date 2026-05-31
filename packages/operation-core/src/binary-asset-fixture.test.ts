import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument
} from "@private-2d-rigging-lab/authoring-core";
import {
  PackageDocumentSchema,
  type BinaryAssetReferenceDto,
  type PackageDocumentDto
} from "../../package-format/src/index.js";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationRequestSchema,
  type CommitOperationOutcome
} from "./index.js";

describe("binary asset operation contract fixture", () => {
  it("parses the split PNG import request with package-local binary refs", () => {
    const request = OperationRequestSchema.parse(
      loadFixtureJson("request/import-split-png-source-commit.request.json")
    );

    expect(request).toMatchObject({
      operationType: "importSplitPngSourceAsset",
      operationId: "op_import_binary_fixture",
      payload: {
        sourceAssetId: "src_binary_fixture",
        manifestPath: "assets/sources/binary-fixture/source.bytes",
        binaryAssetRef: {
          binaryAssetId: "bin_binary_fixture_source",
          storageStatus: "stored-package-local-v1",
          mediaType: "application/octet-stream"
        },
        layers: [
          {
            sourceLayerId: "layer_binary_fixture_body",
            textureId: "tex_binary_fixture_body",
            texturePreviewBinaryAssetRef: {
              binaryAssetId: "bin_binary_fixture_texture",
              storageStatus: "stored-package-local-v1",
              mediaType: "application/octet-stream"
            }
          }
        ]
      }
    });
  });

  it("materializes source and texture binary refs without byte verification or decode claims", () => {
    const baselineDocument = loadBaselinePackageDocument();
    const expectedDocument = loadExpectedPackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baselineDocument);
    const core = createOperationCore({
      now: () => new Date("2026-05-31T01:00:00.000Z")
    });
    const outcome = core.commitOperation(
      session,
      loadFixtureJson("request/import-split-png-source-commit.request.json")
    );
    const savedDocument = toPackageDocument(session, baselineDocument, {
      updatedAt: "2026-05-31T01:00:00.000Z"
    });

    expect(summarizeOperationMaterialization(outcome, savedDocument)).toEqual(
      loadExpectedOperationSummary()
    );
    expect(getSourceBinaryRef(savedDocument)).toEqual(getSourceBinaryRef(expectedDocument));
    expect(getTextureBinaryRef(savedDocument)).toEqual(getTextureBinaryRef(expectedDocument));
    expect(outcome.result.diagnostics).toEqual([]);
    expect(getSourceBinaryRef(savedDocument)).not.toHaveProperty("bytesBase64");
    expect(getSourceBinaryRef(savedDocument)).not.toHaveProperty("decodedImageSize");
    expect(getTextureBinaryRef(savedDocument)).not.toHaveProperty("bytesBase64");
    expect(getTextureBinaryRef(savedDocument)).not.toHaveProperty("decodedImageSize");
  });
});

const summarizeOperationMaterialization = (
  outcome: CommitOperationOutcome,
  document: PackageDocumentDto
) => {
  const sourceRef = getSourceBinaryRef(document);
  const textureRef = getTextureBinaryRef(document);
  const previewReference = document.assets.textureAtlas?.previewAssets?.[0]?.reference;
  const provenance = document.assets.provenance.records[0];

  if (previewReference === undefined || provenance === undefined) {
    throw new Error("Fixture operation did not materialize preview/provenance evidence.");
  }

  return {
    schemaVersion: "binary-asset-operation-materialization-summary-v1",
    fixtureId: "binary-asset-package-local-reference",
    operationId: outcome.result.operationId,
    resultStatus: outcome.result.status,
    operationDiagnostics: outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId),
    sourceBinaryAssetRef: summarizeBinaryAssetRef(sourceRef),
    textureBinaryAssetRef: summarizeBinaryAssetRef(textureRef),
    texturePreviewReference: previewReference,
    rightsAndProvenance: {
      rightsAssetId: sourceRef.rightsAssetId,
      provenanceId: sourceRef.provenanceId,
      relatedOperationIds: provenance.relatedOperationIds
    }
  };
};

const summarizeBinaryAssetRef = (reference: BinaryAssetReferenceDto) => ({
  binaryAssetId: reference.binaryAssetId,
  packageRelativePath: reference.packageRelativePath,
  storageStatus: reference.storageStatus,
  mediaType: reference.mediaType,
  byteLength: reference.byteLength,
  digest: `${reference.digest.algorithm}:${reference.digest.hex}`,
  provenanceId: reference.provenanceId,
  rightsAssetId: reference.rightsAssetId
});

const getSourceBinaryRef = (document: PackageDocumentDto): BinaryAssetReferenceDto => {
  const reference = document.assets.sourceManifest.sourceAssets[0]?.binaryAssetRef;

  if (reference === undefined) {
    throw new Error("Missing source binary asset reference.");
  }

  return reference;
};

const getTextureBinaryRef = (document: PackageDocumentDto): BinaryAssetReferenceDto => {
  const reference = document.assets.textureAtlas?.textures[0]?.binaryAssetRef;

  if (reference === undefined) {
    throw new Error("Missing texture binary asset reference.");
  }

  return reference;
};

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadExpectedPackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("package-document.json"));

const loadExpectedOperationSummary = (): unknown =>
  loadFixtureJson("expected/binary-operation-summary.json");

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8")) as unknown;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/binary-asset-package-local-reference"
);
