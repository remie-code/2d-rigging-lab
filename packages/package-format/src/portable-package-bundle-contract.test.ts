import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PortablePackageBundleBase64PayloadDtoSchema,
  PortablePackageBundleBinaryPayloadDtoSchema,
  PortablePackageBundleV0DtoSchema
} from "./index.js";

const DIGEST_HEX = "0123456789abcdef".repeat(4);
const PACKAGE_ID = "pkg_minimal-valid-package";
const SAMPLE_MODEL_PSD_BYTE_LENGTH = 22_406_225;
const SAMPLE_MODEL_PSD_BASE64_LENGTH = Math.ceil(SAMPLE_MODEL_PSD_BYTE_LENGTH / 3) * 4;

describe("portable package bundle v0 contract", () => {
  it("parses project-defined JSON bundle evidence with base64 binary payload metadata", () => {
    const bundle = PortablePackageBundleV0DtoSchema.parse(createPortableBundle());
    const payload = bundle.binaryPayloads[0];

    expect(bundle).toMatchObject({
      schemaVersion: "portable-package-bundle-v0",
      bundleKind: "project-defined-json-bundle-v0",
      packageId: PACKAGE_ID,
      packageRevision: 0
    });
    expect(payload?.binaryAssetRef).toMatchObject({
      referenceKind: "package-binary-asset-ref-v1",
      binaryAssetId: "bin_source_psd",
      packageRelativePath: "assets/sources/character/source.psd",
      byteLength: 4096,
      mediaType: "image/vnd.adobe.photoshop",
      provenanceId: "prov_source_psd",
      rightsAssetId: "src_psd_structured"
    });
    expect(payload?.binaryAssetRef.digest).toEqual({ algorithm: "sha256", hex: DIGEST_HEX });
    expect(payload?.payloadEncoding).toBe("base64-v1");
    expect(payload?.payloadBase64).toBe("QUJDRA==");
    expect("archivePath" in bundle).toBe(false);
    expect("zip" in bundle).toBe(false);
    expect("archiveCompatibility" in bundle).toBe(false);
  });

  it("validates sample_model.psd-scale base64 payloads without recursion", () => {
    const payloadBase64 = "A".repeat(SAMPLE_MODEL_PSD_BASE64_LENGTH - 1) + "=";

    expect(payloadBase64).toHaveLength(29_874_968);
    expect(PortablePackageBundleBase64PayloadDtoSchema.safeParse(payloadBase64).success).toBe(
      true
    );
  });

  it("rejects unsupported bundle version and identity mismatch", () => {
    expect(PortablePackageBundleV0DtoSchema.safeParse({
      ...createPortableBundle(),
      schemaVersion: "portable-package-bundle-v1"
    }).success).toBe(false);

    expect(PortablePackageBundleV0DtoSchema.safeParse({
      ...createPortableBundle(),
      packageId: "pkg_other"
    }).success).toBe(false);

    expect(PortablePackageBundleV0DtoSchema.safeParse({
      ...createPortableBundle(),
      packageRevision: 1
    }).success).toBe(false);
  });

  it("rejects unsafe package-relative paths and malformed binary payload metadata", () => {
    for (const packageRelativePath of [
      "../source.psd",
      "assets/sources/../source.psd",
      "C:/package/source.psd",
      "assets/model/source.psd"
    ]) {
      expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
        ...createBinaryPayload(),
        binaryAssetRef: {
          ...createBinaryAssetReference(),
          packageRelativePath
        }
      }).success).toBe(false);
    }

    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
      ...createBinaryPayload(),
      binaryAssetRef: {
        ...createBinaryAssetReference(),
        digest: { algorithm: "sha256", hex: DIGEST_HEX.toUpperCase() }
      }
    }).success).toBe(false);
    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
      ...createBinaryPayload(),
      binaryAssetRef: {
        ...createBinaryAssetReference(),
        byteLength: -1
      }
    }).success).toBe(false);
    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
      ...createBinaryPayload(),
      binaryAssetRef: {
        ...createBinaryAssetReference(),
        mediaType: "Image/PNG"
      }
    }).success).toBe(false);
  });

  it("rejects missing payloads, unsupported payload encoding, and non-standard base64", () => {
    const { payloadBase64: _payloadBase64, ...missingPayload } = createBinaryPayload();

    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse(missingPayload).success).toBe(
      false
    );
    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
      ...createBinaryPayload(),
      payloadEncoding: "bytes-raw-v1"
    }).success).toBe(false);

    expect(PortablePackageBundleBase64PayloadDtoSchema.safeParse("").success).toBe(true);

    for (const payloadBase64 of [
      "data:application/octet-stream;base64,QUJDRA==",
      "QUJD RA==",
      "QUJDRA?=",
      "QU=JDRA=",
      "QUJDRA",
      "QUJDRA=A",
      "QUJD===="
    ]) {
      expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
        ...createBinaryPayload(),
        payloadBase64
      }).success).toBe(false);
    }
  });

  it("rejects archive, filesystem, parser, and image decode compatibility claims", () => {
    for (const forbiddenClaim of [
      { archivePath: "package.zip" },
      { zip: { entry: "assets/sources/character/source.psd" } },
      { archiveCompatibility: "zip-v1" },
      { fileSystemHandle: { name: "source.psd" } }
    ]) {
      expect(PortablePackageBundleV0DtoSchema.safeParse({
        ...createPortableBundle(),
        ...forbiddenClaim
      }).success).toBe(false);
    }

    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
      ...createBinaryPayload(),
      binaryAssetRef: {
        ...createBinaryAssetReference(),
        archivePath: "package.zip"
      }
    }).success).toBe(false);
    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
      ...createBinaryPayload(),
      binaryAssetRef: {
        ...createBinaryAssetReference(),
        decodedImageSize: { width: 1, height: 1 }
      }
    }).success).toBe(false);
    expect(PortablePackageBundleBinaryPayloadDtoSchema.safeParse({
      ...createBinaryPayload(),
      parserProfile: "psd-parser-v1"
    }).success).toBe(false);
  });
});

const createPortableBundle = () => ({
  schemaVersion: "portable-package-bundle-v0",
  bundleKind: "project-defined-json-bundle-v0",
  packageId: PACKAGE_ID,
  packageRevision: 0,
  packageDocument: loadMinimalFixturePackageDocument(),
  binaryPayloads: [createBinaryPayload()]
});

const createBinaryPayload = () => ({
  binaryAssetRef: createBinaryAssetReference(),
  payloadEncoding: "base64-v1",
  payloadBase64: "QUJDRA=="
});

const createBinaryAssetReference = () => ({
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
