import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

describe("wave31 byte-only sample characterization fixture", () => {
  it("matches the workspace-local sample byte length and SHA-256 without PSD parsing", () => {
    const manifest = readJson("fixture-manifest.json");
    const expected = readJson("expected/sample-model-byte-characterization-summary.json");
    const sampleBytes = readFileSync(samplePath());
    const digestHex = createHash("sha256").update(sampleBytes).digest("hex");

    expect(manifest.fixtureId).toBe("wave31-byte-sample-characterization");
    expect(manifest.inputArtifacts).toEqual(["../../../test_data/sample_model.psd"]);
    expect(manifest.sampleCharacterization.byteOnly).toBe(true);
    expect(manifest.sampleCharacterization.bytesCopiedIntoFixture).toBe(false);
    expect(manifest.sampleCharacterization.byteLength).toBe(sampleBytes.byteLength);
    expect(manifest.sampleCharacterization.digest).toEqual({
      algorithm: "sha256",
      hex: digestHex
    });
    expect(manifest.rightsAndProvenance).toMatchObject({
      rightsStatus: "cleared",
      license: "user-provided-rights-cleared-local-test-fixture",
      redistributionAllowed: false,
      publicDistributionAllowed: false,
      aiUsed: false
    });
    expect(manifest.truthfulness).toMatchObject({
      psdBytesIncludedInFixture: false,
      psdBytesParsed: false,
      imageBytesDecoded: false,
      rasterExtractionClaimed: false,
      layerTreeClaimed: false,
      headerFactsClaimed: false,
      textureMaterializationClaimed: false,
      publicAssetDistributionClaimed: false
    });

    expect(expected.byteEvidence).toEqual({
      byteLength: sampleBytes.byteLength,
      digest: {
        algorithm: "sha256",
        hex: digestHex
      },
      mediaTypeExpectation: {
        declaredMediaType: "application/octet-stream",
        fallbackWhenBrowserTypeEmpty: true
      }
    });
    expect(expected.truthfulness).toMatchObject({
      fixtureContainsSampleBytes: false,
      psdParserUsed: false,
      imageDecodeUsed: false,
      rasterExtractionUsed: false,
      psdSemanticFactsClaimed: false,
      publicDistributionClaimed: false
    });
    expect(expected.downstreamUse.forbidden).toEqual(
      expect.arrayContaining([
        "PSD parser oracle",
        "PSD layer or header semantic oracle",
        "image decode oracle",
        "raster or texture oracle",
        "public sample asset distribution"
      ])
    );
  });
});

const fixtureDirectory = (): string =>
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/wave31-byte-sample-characterization"
  );

const samplePath = (): string =>
  join(dirname(fileURLToPath(import.meta.url)), "../../../test_data/sample_model.psd");

const readJson = (relativePath: string): any =>
  JSON.parse(readFileSync(join(fixtureDirectory(), relativePath), "utf8")) as unknown;
