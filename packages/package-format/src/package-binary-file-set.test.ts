import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  computePackageBinarySha256Digest,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  extractPackageTextFileSet,
  parsePackageDocumentFromInMemoryFileSet,
  readPackageBinaryFileEntry,
  serializePackageDocumentToFileSet,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetReferenceDto,
  type PackageDocumentDto
} from "./index.js";

const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("package binary in-memory file set", () => {
  it("stores and reads text plus binary entries while preserving text package parsing", async () => {
    const document = loadMinimalFixturePackageDocument();
    const textFileSet = serializePackageDocumentToFileSet(document);
    const binaryEntry = createPackageBinaryFileEntry({
      path: "assets/sources/generated-fixture.bin",
      bytes: TEST_BYTES,
      mediaType: "application/octet-stream",
      binaryAssetId: "bin_generated_fixture"
    });
    const mixedFileSet = createPackageInMemoryFileSet([...textFileSet, binaryEntry]);
    const storedBinaryEntry = readPackageBinaryFileEntry(
      mixedFileSet,
      "assets/sources/generated-fixture.bin"
    );
    const digestResult = await computePackageBinarySha256Digest(TEST_BYTES);

    expect(storedBinaryEntry).toMatchObject({
      path: "assets/sources/generated-fixture.bin",
      mediaType: "application/octet-stream",
      binaryAssetId: "bin_generated_fixture"
    });
    expect(Array.from(storedBinaryEntry?.bytes ?? [])).toEqual([0x61, 0x62, 0x63]);
    expect(digestResult).toEqual({
      status: "computed",
      digest: {
        algorithm: "sha256",
        hex: TEST_BYTES_SHA256_HEX
      }
    });
    expect(extractPackageTextFileSet(mixedFileSet)).toEqual(textFileSet);
    expect(parsePackageDocumentFromInMemoryFileSet(mixedFileSet)).toEqual(document);
  });

  it("verifies binary bytes against Domain A reference metadata", async () => {
    const reference = createBinaryAssetReference();
    const mixedFileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: reference.packageRelativePath,
        bytes: TEST_BYTES,
        mediaType: reference.mediaType,
        binaryAssetId: reference.binaryAssetId
      })
    ]);
    const report = await verifyPackageBinaryAssetBytes(mixedFileSet, reference);

    expect(report).toMatchObject({
      status: "pass",
      binaryAssetId: "bin_generated_fixture",
      packageRelativePath: "assets/sources/generated-fixture.bin",
      expectedByteLength: 3,
      actualByteLength: 3,
      expectedMediaType: "application/octet-stream",
      actualMediaType: "application/octet-stream"
    });
    expect(report.expectedDigest.hex).toBe(TEST_BYTES_SHA256_HEX);
    expect(report.actualDigest?.hex).toBe(TEST_BYTES_SHA256_HEX);
    expect(report.issues).toEqual([]);
  });

  it("represents missing bytes as a verification failure", async () => {
    const reference = createBinaryAssetReference();
    const report = await verifyPackageBinaryAssetBytes(createPackageInMemoryFileSet([]), reference);

    expect(report.status).toBe("fail");
    expect(report.actualByteLength).toBeUndefined();
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: "binary.bytes.missing",
        path: "assets/sources/generated-fixture.bin",
        expected: "assets/sources/generated-fixture.bin",
        actual: "missing"
      })
    ]);
  });

  it("represents digest, byte length, and media type mismatches", async () => {
    const reference = createBinaryAssetReference({
      digest: {
        algorithm: "sha256",
        hex: "0".repeat(64)
      },
      byteLength: 4,
      mediaType: "image/png"
    });
    const mixedFileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: reference.packageRelativePath,
        bytes: TEST_BYTES,
        mediaType: "application/octet-stream",
        binaryAssetId: reference.binaryAssetId
      })
    ]);
    const report = await verifyPackageBinaryAssetBytes(mixedFileSet, reference);
    const issueCodes = report.issues.map((issue) => issue.code);

    expect(report.status).toBe("fail");
    expect(report.actualByteLength).toBe(3);
    expect(report.actualDigest?.hex).toBe(TEST_BYTES_SHA256_HEX);
    expect(report.actualMediaType).toBe("application/octet-stream");
    expect(issueCodes).toEqual(expect.arrayContaining([
      "binary.byteLength.mismatch",
      "binary.digest.mismatch",
      "binary.mediaType.mismatch"
    ]));
  });

  it("keeps binary paths package-local and rejects duplicate text/binary paths", () => {
    expect(() => createPackageBinaryFileEntry({
      path: "model/not-an-asset.bin",
      bytes: TEST_BYTES,
      mediaType: "application/octet-stream",
      binaryAssetId: "bin_generated_fixture"
    })).toThrow(/assets\/sources/);

    expect(() => createPackageInMemoryFileSet([
      {
        path: "assets/sources/generated-fixture.bin",
        text: "not binary"
      },
      createPackageBinaryFileEntry({
        path: "assets/sources/generated-fixture.bin",
        bytes: TEST_BYTES,
        mediaType: "application/octet-stream",
        binaryAssetId: "bin_generated_fixture"
      })
    ])).toThrow(/Duplicate package file path/);
  });
});

const createBinaryAssetReference = (
  overrides: Readonly<Record<string, unknown>> = {}
): BinaryAssetReferenceDto => BinaryAssetReferenceSchema.parse({
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
