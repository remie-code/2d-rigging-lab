import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  PortablePackageBundleError,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  exportPortablePackageBundleV0,
  importPortablePackageBundleV0,
  readPackageBinaryFileEntry,
  type BinaryAssetReferenceDto,
  type PackageDocumentDto,
  type PortablePackageBundleV0Dto
} from "./index.js";

const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("portable package bundle writer/importer", () => {
  it("exports and imports package metadata plus verified base64 bytes", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const packageDocument = createPackageDocumentWithSourceBinaryRef(binaryAssetRef);
    const bundle = await exportPortablePackageBundleV0({
      packageDocument,
      fileSet: createPackageInMemoryFileSet([
        createPackageBinaryFileEntry({
          path: binaryAssetRef.packageRelativePath,
          bytes: TEST_BYTES,
          mediaType: binaryAssetRef.mediaType,
          binaryAssetId: binaryAssetRef.binaryAssetId
        })
      ])
    });
    const imported = await importPortablePackageBundleV0({ bundle: JSON.stringify(bundle) });
    const importedEntry = readPackageBinaryFileEntry(imported.fileSet, binaryAssetRef);

    expect(bundle).toMatchObject({
      schemaVersion: "portable-package-bundle-v0",
      bundleKind: "project-defined-json-bundle-v0",
      packageId: packageDocument.manifest.packageId,
      packageRevision: packageDocument.manifest.packageRevision
    });
    expect(bundle.binaryPayloads).toEqual([
      {
        binaryAssetRef,
        payloadEncoding: "base64-v1",
        payloadBase64: "YWJj"
      }
    ]);
    expect(imported.packageDocument).toEqual(packageDocument);
    expect(imported.verificationReports).toHaveLength(1);
    expect(imported.verificationReports[0]?.status).toBe("pass");
    expect(importedEntry?.mediaType).toBe(binaryAssetRef.mediaType);
    expect(Array.from(importedEntry?.bytes ?? [])).toEqual([0x61, 0x62, 0x63]);
  });

  it("fails export when referenced bytes are missing, require reupload, or do not verify", async () => {
    const binaryAssetRef = createBinaryAssetReference();
    const packageDocument = createPackageDocumentWithSourceBinaryRef(binaryAssetRef);

    await expectPortableBundleError(
      () => exportPortablePackageBundleV0({
        packageDocument,
        fileSet: createPackageInMemoryFileSet([])
      }),
      "portableBundle.binaryBytes.missing"
    );

    await expectPortableBundleError(
      () => exportPortablePackageBundleV0({
        packageDocument,
        fileSet: createPackageInMemoryFileSet([
          createPackageBinaryFileEntry({
            path: binaryAssetRef.packageRelativePath,
            bytes: TEST_BYTES,
            mediaType: binaryAssetRef.mediaType,
            binaryAssetId: binaryAssetRef.binaryAssetId
          })
        ]),
        requiresReupload: () => true
      }),
      "portableBundle.requiresReupload"
    );

    await expectPortableBundleError(
      () => exportPortablePackageBundleV0({
        packageDocument,
        fileSet: createPackageInMemoryFileSet([
          createPackageBinaryFileEntry({
            path: binaryAssetRef.packageRelativePath,
            bytes: new Uint8Array([0x61, 0x62, 0x64]),
            mediaType: binaryAssetRef.mediaType,
            binaryAssetId: binaryAssetRef.binaryAssetId
          })
        ])
      }),
      "portableBundle.digest.mismatch"
    );
  });

  it("fails import for unsupported schema version and missing document payload", async () => {
    const bundle = await createValidPortableBundle();

    await expectPortableBundleError(
      () => importPortablePackageBundleV0({
        bundle: {
          ...bundle,
          schemaVersion: "portable-package-bundle-v1"
        }
      }),
      "portableBundle.schema.invalid"
    );

    await expectPortableBundleError(
      () => importPortablePackageBundleV0({
        bundle: {
          ...bundle,
          binaryPayloads: []
        }
      }),
      "portableBundle.binaryPayload.missing"
    );
  });

  it("fails import when payload digest or byte length does not match metadata", async () => {
    const bundle = await createValidPortableBundle();

    await expectPortableBundleError(
      () => importPortablePackageBundleV0({
        bundle: replaceFirstPayload(bundle, { payloadBase64: "YWJk" })
      }),
      "portableBundle.digest.mismatch"
    );

    await expectPortableBundleError(
      () => importPortablePackageBundleV0({
        bundle: replaceFirstPayload(bundle, { payloadBase64: "YWI=" })
      }),
      "portableBundle.byteLength.mismatch"
    );
  });

  it("fails import when payload media type/ref metadata or duplicate refs are inconsistent", async () => {
    const bundle = await createValidPortableBundle();
    const firstPayload = bundle.binaryPayloads[0];

    if (firstPayload === undefined) {
      throw new Error("Expected fixture payload");
    }

    await expectPortableBundleError(
      () => importPortablePackageBundleV0({
        bundle: replaceFirstPayload(bundle, {
          binaryAssetRef: {
            ...firstPayload.binaryAssetRef,
            mediaType: "image/png"
          }
        })
      }),
      "portableBundle.binaryAssetRef.mismatch"
    );

    await expectPortableBundleError(
      () => importPortablePackageBundleV0({
        bundle: {
          ...bundle,
          binaryPayloads: [firstPayload, firstPayload]
        }
      }),
      "portableBundle.binaryPayload.duplicate"
    );
  });
});

async function createValidPortableBundle(): Promise<PortablePackageBundleV0Dto> {
  const binaryAssetRef = createBinaryAssetReference();
  const packageDocument = createPackageDocumentWithSourceBinaryRef(binaryAssetRef);

  return exportPortablePackageBundleV0({
    packageDocument,
    fileSet: createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: binaryAssetRef.packageRelativePath,
        bytes: TEST_BYTES,
        mediaType: binaryAssetRef.mediaType,
        binaryAssetId: binaryAssetRef.binaryAssetId
      })
    ])
  });
}

async function expectPortableBundleError(
  action: () => Promise<unknown>,
  expectedCode: PortablePackageBundleError["code"]
): Promise<void> {
  await expect(action()).rejects.toMatchObject({
    name: "PortablePackageBundleError",
    code: expectedCode
  });
}

function replaceFirstPayload(
  bundle: PortablePackageBundleV0Dto,
  overrides: Partial<PortablePackageBundleV0Dto["binaryPayloads"][number]>
): PortablePackageBundleV0Dto {
  const firstPayload = bundle.binaryPayloads[0];

  if (firstPayload === undefined) {
    throw new Error("Expected fixture payload");
  }

  return {
    ...bundle,
    binaryPayloads: [
      {
        ...firstPayload,
        ...overrides
      },
      ...bundle.binaryPayloads.slice(1)
    ]
  };
}

function createBinaryAssetReference(
  overrides: Partial<BinaryAssetReferenceDto> = {}
): BinaryAssetReferenceDto {
  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_generated_fixture",
    packageRelativePath: "assets/sources/generated-fixture.bin",
    digest: {
      algorithm: "sha256",
      hex: TEST_BYTES_SHA256_HEX
    },
    byteLength: 3,
    mediaType: "application/octet-stream",
    storageStatus: "stored-package-local-v1",
    provenanceId: "prov_generated_fixture",
    rightsAssetId: "src_generated_fixture",
    ...overrides
  });
}

function createPackageDocumentWithSourceBinaryRef(
  binaryAssetRef: BinaryAssetReferenceDto
): PackageDocumentDto {
  const packageDocument = loadMinimalFixturePackageDocument();
  const firstSourceAsset = packageDocument.assets.sourceManifest.sourceAssets[0];

  if (firstSourceAsset === undefined) {
    throw new Error("Expected minimal package source asset");
  }

  return PackageDocumentSchema.parse({
    ...packageDocument,
    assets: {
      ...packageDocument.assets,
      sourceManifest: {
        ...packageDocument.assets.sourceManifest,
        sourceAssets: [
          {
            ...firstSourceAsset,
            filePath: binaryAssetRef.packageRelativePath,
            binaryAssetRef
          },
          ...packageDocument.assets.sourceManifest.sourceAssets.slice(1)
        ]
      }
    }
  });
}

function loadMinimalFixturePackageDocument(): PackageDocumentDto {
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
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}
