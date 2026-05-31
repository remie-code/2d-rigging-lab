import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BinaryAssetDigestSchema,
  BinaryAssetEntrySchema,
  BinaryAssetIndexFileSchema,
  BinaryAssetMediaTypeSchema,
  BinaryAssetReferenceSchema,
  BinaryAssetStorageStatusSchema,
  SourceManifestSchema,
  TextureAtlasEntrySchema,
  parsePackageDocument
} from "./index.js";

const DIGEST_HEX = "0123456789abcdef".repeat(4);

describe("binary asset package contracts", () => {
  it("parses binary asset entry and package-local reference metadata without loading bytes", () => {
    const entry = BinaryAssetEntrySchema.parse(createBinaryAssetEntry());
    const reference = BinaryAssetReferenceSchema.parse(createBinaryAssetReference());
    const index = BinaryAssetIndexFileSchema.parse({
      schemaVersion: "binary-asset-index-v1",
      assets: [entry]
    });

    expect(entry).toMatchObject({
      binaryAssetId: "bin_source_psd",
      role: "source-original-v1",
      packageRelativePath: "assets/sources/character/source.psd",
      byteLength: 4096,
      mediaType: "image/vnd.adobe.photoshop",
      storageStatus: "stored-package-local-v1",
      provenanceId: "prov_source_psd",
      rightsAssetId: "src_psd_structured"
    });
    expect(entry.digest).toEqual({ algorithm: "sha256", hex: DIGEST_HEX });
    expect(reference).toMatchObject({
      referenceKind: "package-binary-asset-ref-v1",
      binaryAssetId: "bin_source_psd",
      packageRelativePath: "assets/sources/character/source.psd",
      byteLength: 4096,
      mediaType: "image/vnd.adobe.photoshop",
      storageStatus: "stored-package-local-v1",
      provenanceId: "prov_source_psd",
      rightsAssetId: "src_psd_structured"
    });
    expect(index.assets[0]).toEqual(entry);
  });

  it("rejects invalid digest, byte length, media type, storage status, and unsafe paths", () => {
    expect(BinaryAssetDigestSchema.safeParse({
      algorithm: "sha256",
      hex: DIGEST_HEX.toUpperCase()
    }).success).toBe(false);
    expect(BinaryAssetDigestSchema.safeParse({
      algorithm: "sha1",
      hex: DIGEST_HEX
    }).success).toBe(false);

    expect(BinaryAssetEntrySchema.safeParse({
      ...createBinaryAssetEntry(),
      byteLength: -1
    }).success).toBe(false);
    expect(BinaryAssetEntrySchema.safeParse({
      ...createBinaryAssetEntry(),
      byteLength: 1.5
    }).success).toBe(false);

    expect(BinaryAssetMediaTypeSchema.safeParse("Image/PNG").success).toBe(false);
    expect(BinaryAssetMediaTypeSchema.safeParse("image/png; charset=utf-8").success).toBe(false);
    expect(BinaryAssetStorageStatusSchema.safeParse("present").success).toBe(false);

    for (const packageRelativePath of [
      "../source.psd",
      "assets/model/source.psd",
      "https://example.test/source.psd"
    ]) {
      expect(BinaryAssetReferenceSchema.safeParse({
        ...createBinaryAssetReference(),
        packageRelativePath
      }).success).toBe(false);
    }
  });

  it("associates source and texture metadata with rights and provenance without binary decode fields", () => {
    const sourceReference = createBinaryAssetReference({
      storageStatus: "missing-package-local-bytes-v1"
    });
    const parsedSourceManifest = SourceManifestSchema.parse({
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: "src_psd_structured",
          kind: "psd-source-v1",
          filePath: "assets/sources/character/source.psd",
          contentHash: "sha256:metadata-only",
          importProfile: "layered-character-psd-profile-v1",
          binaryAssetRef: sourceReference
        }
      ]
    });
    const parsedTexture = TextureAtlasEntrySchema.parse({
      textureId: "tex_body",
      filePath: "assets/textures/body.png",
      contentHash: "sha256:texture-metadata",
      sourceAssetId: "src_psd_structured",
      sourceLayerId: "layer_body",
      provenanceId: "prov_texture_body",
      binaryAssetRef: createBinaryAssetReference({
        binaryAssetId: "bin_texture_body",
        packageRelativePath: "assets/textures/body.png",
        mediaType: "image/png",
        provenanceId: "prov_texture_body",
        rightsAssetId: "tex_body"
      })
    });

    expect(parsedSourceManifest.sourceAssets[0]?.binaryAssetRef).toMatchObject({
      byteLength: 4096,
      storageStatus: "missing-package-local-bytes-v1",
      provenanceId: "prov_source_psd",
      rightsAssetId: "src_psd_structured"
    });
    expect(parsedTexture.binaryAssetRef).toMatchObject({
      binaryAssetId: "bin_texture_body",
      mediaType: "image/png",
      provenanceId: "prov_texture_body",
      rightsAssetId: "tex_body"
    });
    expect(BinaryAssetReferenceSchema.safeParse({
      ...sourceReference,
      bytesBase64: "AAAA",
      decodedImageSize: { width: 1, height: 1 }
    }).success).toBe(false);
  });

  it("keeps existing text package fixtures compatible when no binary asset refs are present", () => {
    const parsed = parsePackageDocument(loadMinimalFixturePackageDocument());

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error(parsed.issues.map((issue) => issue.message).join("\n"));
    }

    expect(parsed.data.assets.sourceManifest.sourceAssets[0]?.kind).toBe("generated-fixture-v1");
    expect(parsed.data.assets.sourceManifest.sourceAssets[0]?.binaryAssetRef).toBeUndefined();
    expect(parsed.data.assets.textureAtlas).toBeUndefined();
  });
});

const createBinaryAssetReference = (
  overrides: Partial<ReturnType<typeof createBinaryAssetReferenceBase>> = {}
) => ({
  ...createBinaryAssetReferenceBase(),
  ...overrides
});

const createBinaryAssetReferenceBase = () => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_source_psd",
  packageRelativePath: "assets/sources/character/source.psd",
  digest: { algorithm: "sha256", hex: DIGEST_HEX },
  byteLength: 4096,
  mediaType: "image/vnd.adobe.photoshop",
  storageStatus: "stored-package-local-v1",
  provenanceId: "prov_source_psd",
  rightsAssetId: "src_psd_structured"
});

const createBinaryAssetEntry = () => ({
  binaryAssetId: "bin_source_psd",
  role: "source-original-v1",
  packageRelativePath: "assets/sources/character/source.psd",
  digest: { algorithm: "sha256", hex: DIGEST_HEX },
  byteLength: 4096,
  mediaType: "image/vnd.adobe.photoshop",
  storageStatus: "stored-package-local-v1",
  provenanceId: "prov_source_psd",
  rightsAssetId: "src_psd_structured",
  sourceAssetId: "src_psd_structured",
  createdByOperationId: "op_importPsdSource"
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
