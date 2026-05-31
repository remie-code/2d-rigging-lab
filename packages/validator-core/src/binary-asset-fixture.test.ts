import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BinaryAssetIndexFileSchema,
  PackageDocumentSchema,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  type BinaryAssetIndexFileDto,
  type PackageDocumentDto,
  type PackageInMemoryFileSet
} from "@private-2d-rigging-lab/package-format";
import { describe, expect, it } from "vitest";

import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntimeWithBinaryAssets } from "./validators/package-runtime.js";

const CREATED_AT = "2026-05-31T01:00:00.000Z";

describe("binary asset validator contract fixture", () => {
  it("keeps the deterministic stored binary fixture as a validation pass", async () => {
    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: loadPackageDocument(),
      binaryFileSet: createFixtureFileSet(),
      binaryAssetIndex: loadBinaryAssetIndex(),
      createdAt: CREATED_AT
    });

    expect(summarizeReport(report)).toEqual(loadExpectedValidationSummary().cases.storedPass);
    expect(report.checks).toEqual([]);
  });

  it("reports missing package-local bytes for embedded refs and binary index entries", async () => {
    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: loadPackageDocument(),
      binaryFileSet: createPackageInMemoryFileSet([]),
      binaryAssetIndex: loadBinaryAssetIndex(),
      createdAt: CREATED_AT
    });
    const checks = report.checks.filter((check) => check.checkId === "binary.bytesMissing");

    expect(summarizeReport(report)).toEqual(loadExpectedValidationSummary().cases.missingBytes);
    expect(checks).toHaveLength(4);
    expect(checks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "referenceSource=sourceAsset.binaryAssetRef",
      "referenceSource=textureAtlas.textures.binaryAssetRef",
      "referenceSource=binaryAssetIndex.assets",
      "verificationIssueCode=binary.bytes.missing",
      "actual=missing"
    ]));
    for (const check of checks) {
      expect(check.message).not.toMatch(/decode|parser|raster/i);
    }
  });

  it("reports digest mismatches with AI-readable binary reference evidence", async () => {
    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: loadPackageDocument(),
      binaryFileSet: createFixtureFileSet({
        bin_binary_fixture_source: mutateFirstByte(sourceBytes())
      }),
      binaryAssetIndex: loadBinaryAssetIndex(),
      createdAt: CREATED_AT
    });
    const checks = report.checks.filter((check) => check.checkId === "binary.digestMismatch");

    expect(summarizeReport(report)).toEqual(loadExpectedValidationSummary().cases.digestMismatch);
    expect(checks).toHaveLength(2);
    expect(checks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "referenceSource=sourceAsset.binaryAssetRef",
      "referenceSource=binaryAssetIndex.assets",
      "verificationIssueCode=binary.digest.mismatch",
      "expectedDigest=sha256:f56b93fa6ec02d0a4a3caca1bfe2d2e6ee012cc33b03690c963ca3207a145192",
      "expectedMediaType=application/octet-stream",
      "actualMediaType=application/octet-stream"
    ]));
    for (const check of checks) {
      expect(check.impact).toContain("package-local bytes");
      expect(check.message).not.toMatch(/decode|parser|raster/i);
    }
  });
});

interface ExpectedValidationSummary {
  readonly cases: Record<string, {
    readonly status: string;
    readonly checkIds: readonly string[];
  }>;
}

interface DeterministicBinaryTestBytesFixture {
  readonly assets: readonly DeterministicBinaryAssetFixture[];
}

interface DeterministicBinaryAssetFixture {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly mediaType: string;
  readonly bytesDecimal: readonly number[];
}

const summarizeReport = (
  report: ValidationReportDto
): ExpectedValidationSummary["cases"][string] => ({
  status: report.summary.status,
  checkIds: report.checks.map((check) => check.checkId)
});

const createFixtureFileSet = (
  byteOverrides: Readonly<Record<string, Uint8Array>> = {}
): PackageInMemoryFileSet => {
  const entries = loadDeterministicBytesFixture().assets.map((asset) =>
    createPackageBinaryFileEntry({
      path: asset.packageRelativePath,
      bytes: byteOverrides[asset.binaryAssetId] ?? toFixtureBytes(asset),
      mediaType: asset.mediaType,
      binaryAssetId: asset.binaryAssetId
    })
  );

  return createPackageInMemoryFileSet(entries);
};

const sourceBytes = (): Uint8Array => {
  const source = loadDeterministicBytesFixture().assets.find(
    (asset) => asset.binaryAssetId === "bin_binary_fixture_source"
  );

  if (source === undefined) {
    throw new Error("Missing source binary byte fixture.");
  }

  return toFixtureBytes(source);
};

const mutateFirstByte = (bytes: Uint8Array): Uint8Array => {
  const mutated = new Uint8Array(bytes);
  const firstByte = mutated[0];

  if (firstByte === undefined) {
    throw new Error("Cannot mutate an empty binary fixture.");
  }

  mutated[0] = firstByte ^ 0xff;
  return mutated;
};

const toFixtureBytes = (asset: DeterministicBinaryAssetFixture): Uint8Array =>
  new Uint8Array(asset.bytesDecimal);

const loadPackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(readFixtureJson("package-document.json"));

const loadBinaryAssetIndex = (): BinaryAssetIndexFileDto =>
  BinaryAssetIndexFileSchema.parse(readFixtureJson("binary-asset-index.json"));

const loadDeterministicBytesFixture = (): DeterministicBinaryTestBytesFixture =>
  readFixtureJson("deterministic-test-bytes.json") as DeterministicBinaryTestBytesFixture;

const loadExpectedValidationSummary = (): ExpectedValidationSummary =>
  readFixtureJson("expected/binary-validation-summary.json") as ExpectedValidationSummary;

const readFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8")) as unknown;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/binary-asset-package-local-reference"
);
