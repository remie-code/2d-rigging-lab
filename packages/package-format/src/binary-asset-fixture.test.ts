import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BinaryAssetIndexFileSchema,
  PackageDocumentSchema,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  parsePackageDocumentFromInMemoryFileSet,
  serializePackageDocumentToFileSet,
  verifyPackageBinaryAssetBytes,
  type BinaryAssetIndexFileDto,
  type BinaryAssetReferenceDto,
  type PackageDocumentDto,
  type PackageInMemoryFileSet
} from "./index.js";

describe("binary asset package-local reference contract fixture", () => {
  it("parses deterministic byte evidence without committing PSD, PNG, or image bytes", () => {
    const byteFixture = loadDeterministicBytesFixture();

    expect(byteFixture.contentPolicy).toMatchObject({
      generatedDeterministicTestBytes: true,
      notPsdContent: true,
      notPngContent: true,
      notImageContent: true,
      notThirdPartyContent: true
    });
    expect(byteFixture.contentPolicy.notCopiedFrom).toContain("test_data/sample_model.psd");

    for (const asset of byteFixture.assets) {
      const bytes = toFixtureBytes(asset);

      expect(bytes.byteLength).toBe(asset.byteLength);
      expect(asset.mediaType).toBe("application/octet-stream");
      expect(asset.packageRelativePath).not.toMatch(/\.(?:psd|png)$/i);
      expect(startsWith(bytes, PSD_SIGNATURE_BYTES)).toBe(false);
      expect(startsWith(bytes, PNG_SIGNATURE_BYTES)).toBe(false);
    }
  });

  it("roundtrips text package entries and verifies binary entries by length, digest, and media type", async () => {
    const document = loadPackageDocument();
    const binaryAssetIndex = loadBinaryAssetIndex();
    const fileSet = createFixtureFileSet(document);
    const sourceRef = getSourceBinaryRef(document);
    const textureRef = getTextureBinaryRef(document);
    const verificationReports = await Promise.all([
      sourceRef,
      textureRef,
      ...binaryAssetIndex.assets
    ].map((asset) => verifyPackageBinaryAssetBytes(fileSet, asset)));

    expect(parsePackageDocumentFromInMemoryFileSet(fileSet)).toEqual(document);
    expect(verificationReports.map((report) => report.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass"
    ]);
    expect(verificationReports.flatMap((report) => report.issues)).toEqual([]);
    expect(summarizePackageBinaryEvidence({
      document,
      binaryAssetIndex,
      byteFixture: loadDeterministicBytesFixture(),
      reports: verificationReports.slice(0, 2)
    })).toEqual(loadExpectedPackageSummary());
  });
});

interface DeterministicBinaryTestBytesFixture {
  readonly schemaVersion: "deterministic-binary-test-bytes-v1";
  readonly fixtureId: "binary-asset-package-local-reference";
  readonly contentPolicy: {
    readonly generatedDeterministicTestBytes: boolean;
    readonly notPsdContent: boolean;
    readonly notPngContent: boolean;
    readonly notImageContent: boolean;
    readonly notThirdPartyContent: boolean;
    readonly notCopiedFrom: readonly string[];
  };
  readonly assets: readonly DeterministicBinaryAssetFixture[];
}

interface DeterministicBinaryAssetFixture {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly mediaType: string;
  readonly storageStatus: "stored-package-local-v1";
  readonly provenanceId: string;
  readonly rightsAssetId: string;
  readonly byteLength: number;
  readonly digest: {
    readonly algorithm: "sha256";
    readonly hex: string;
  };
  readonly bytesDecimal: readonly number[];
}

const summarizePackageBinaryEvidence = (input: {
  readonly document: PackageDocumentDto;
  readonly binaryAssetIndex: BinaryAssetIndexFileDto;
  readonly byteFixture: DeterministicBinaryTestBytesFixture;
  readonly reports: readonly { readonly status: string }[];
}) => {
  const sourceRef = getSourceBinaryRef(input.document);
  const textureRef = getTextureBinaryRef(input.document);

  return {
    schemaVersion: "binary-asset-package-local-reference-summary-v1",
    fixtureId: "binary-asset-package-local-reference",
    contentPolicy: {
      generatedDeterministicTestBytes: input.byteFixture.contentPolicy.generatedDeterministicTestBytes,
      notPsdContent: input.byteFixture.contentPolicy.notPsdContent,
      notPngContent: input.byteFixture.contentPolicy.notPngContent,
      notImageContent: input.byteFixture.contentPolicy.notImageContent,
      notThirdPartyContent: input.byteFixture.contentPolicy.notThirdPartyContent
    },
    packageReferences: {
      sourceBinaryAssetId: sourceRef.binaryAssetId,
      textureBinaryAssetId: textureRef.binaryAssetId,
      binaryAssetIndexCount: input.binaryAssetIndex.assets.length,
      storageStatus: [sourceRef.storageStatus, textureRef.storageStatus],
      mediaTypes: [sourceRef.mediaType, textureRef.mediaType],
      rightsAssetIds: [sourceRef.rightsAssetId, textureRef.rightsAssetId],
      provenanceIds: [sourceRef.provenanceId, textureRef.provenanceId]
    },
    deterministicBytes: input.byteFixture.assets.map((asset, index) => ({
      binaryAssetId: asset.binaryAssetId,
      packageRelativePath: asset.packageRelativePath,
      byteLength: asset.byteLength,
      digest: `${asset.digest.algorithm}:${asset.digest.hex}`,
      verificationStatus: input.reports[index]?.status ?? "missing"
    })),
    fileSet: {
      textPackageRoundtrip: "pass",
      binaryEntryCount: input.byteFixture.assets.length,
      verificationStatus: input.reports.every((report) => report.status === "pass")
        ? "pass"
        : "fail"
    }
  };
};

const createFixtureFileSet = (document: PackageDocumentDto): PackageInMemoryFileSet => {
  const byteFixture = loadDeterministicBytesFixture();
  const binaryEntries = byteFixture.assets.map((asset) =>
    createPackageBinaryFileEntry({
      path: asset.packageRelativePath,
      bytes: toFixtureBytes(asset),
      mediaType: asset.mediaType,
      binaryAssetId: asset.binaryAssetId
    })
  );

  return createPackageInMemoryFileSet([
    ...serializePackageDocumentToFileSet(document),
    ...binaryEntries
  ]);
};

const getSourceBinaryRef = (document: PackageDocumentDto): BinaryAssetReferenceDto => {
  const reference = document.assets.sourceManifest.sourceAssets[0]?.binaryAssetRef;

  if (reference === undefined) {
    throw new Error("Fixture package is missing the source binary asset reference.");
  }

  return reference;
};

const getTextureBinaryRef = (document: PackageDocumentDto): BinaryAssetReferenceDto => {
  const reference = document.assets.textureAtlas?.textures[0]?.binaryAssetRef;

  if (reference === undefined) {
    throw new Error("Fixture package is missing the texture binary asset reference.");
  }

  return reference;
};

const toFixtureBytes = (asset: DeterministicBinaryAssetFixture): Uint8Array => {
  if (
    asset.bytesDecimal.length !== asset.byteLength ||
    asset.bytesDecimal.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    throw new Error(`Invalid deterministic bytes for ${asset.binaryAssetId}.`);
  }

  return new Uint8Array(asset.bytesDecimal);
};

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((byte, index) => bytes[index] === byte);

const loadPackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(readFixtureJson("package-document.json"));

const loadBinaryAssetIndex = (): BinaryAssetIndexFileDto =>
  BinaryAssetIndexFileSchema.parse(readFixtureJson("binary-asset-index.json"));

const loadDeterministicBytesFixture = (): DeterministicBinaryTestBytesFixture => {
  const fixture = readFixtureJson("deterministic-test-bytes.json") as DeterministicBinaryTestBytesFixture;

  if (fixture.schemaVersion !== "deterministic-binary-test-bytes-v1") {
    throw new Error("Unexpected deterministic byte fixture schema version.");
  }

  return fixture;
};

const loadExpectedPackageSummary = (): unknown =>
  readFixtureJson("expected/package-binary-evidence-summary.json");

const readFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8")) as unknown;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/binary-asset-package-local-reference"
);

const PSD_SIGNATURE_BYTES = [0x38, 0x42, 0x50, 0x53] as const;
const PNG_SIGNATURE_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
