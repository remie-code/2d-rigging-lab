import { Buffer } from "node:buffer";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  PortablePackageBundleV0DtoSchema,
  computePackageBinarySha256Digest,
  type BinaryAssetDigestDto,
  type BinaryAssetReferenceDto,
  type PackageBinaryBytes,
  type PackageDocumentDto,
  type PortablePackageBundleV0Dto
} from "@private-2d-rigging-lab/package-format";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationCheckResultDto } from "./validation-report.js";
import { validatePortablePackageBundleIntegrity } from "./validators/portable-bundle-integrity.js";

const PACKAGE_ID = "pkg_portableBundleValidator";
const PACKAGE_REVISION = 0;
const CREATED_AT = "2026-06-03T00:00:00.000Z";
const SOURCE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const SAME_LENGTH_OTHER_BYTES = new Uint8Array([0x64, 0x65, 0x66]);
const SHORT_BYTES = new Uint8Array([0x61]);

describe("portable bundle integrity diagnostics", () => {
  it("registers portable bundle diagnostics in the check catalog", () => {
    expect(defaultCheckCatalog.has("portableBundle.schemaInvalid")).toBe(true);
    expect(defaultCheckCatalog.has("portableBundle.unsupportedVersion")).toBe(true);
    expect(defaultCheckCatalog.has("portableBundle.missingPayload")).toBe(true);
    expect(defaultCheckCatalog.has("portableBundle.missingRequiredBinary")).toBe(true);
    expect(defaultCheckCatalog.has("portableBundle.digestMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("portableBundle.byteLengthMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("portableBundle.availabilityMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("portableBundle.digestUnsupported")).toBe(true);
  });

  it("accepts valid verified project-defined JSON bundle evidence", async () => {
    const bundle = await createPortableBundle();

    await expect(validatePortablePackageBundleIntegrity(bundle)).resolves.toEqual([]);
  });

  it("maps unsupported bundle version and missing payload to stable diagnostics", async () => {
    const bundle = await createPortableBundle();
    const unsupportedVersionChecks = await validatePortablePackageBundleIntegrity({
      ...bundle,
      schemaVersion: "portable-package-bundle-v1"
    });

    expect(unsupportedVersionChecks).toHaveLength(1);
    expect(unsupportedVersionChecks[0]).toMatchObject({
      checkId: "portableBundle.unsupportedVersion",
      status: "fail",
      severity: "error",
      phase: "source_import",
      targetPath: "/schemaVersion"
    });
    expect(unsupportedVersionChecks[0]?.evidence).toEqual(expect.arrayContaining([
      "bundleSchemaVersion=portable-package-bundle-v1",
      "expectedBundleSchemaVersion=portable-package-bundle-v0",
      "actualBundleSchemaVersion=portable-package-bundle-v1",
      "issueTargetPath=/schemaVersion"
    ]));

    const payload = bundle.binaryPayloads[0];
    if (payload === undefined) {
      throw new Error("Expected bundle payload.");
    }

    const { payloadBase64: _payloadBase64, ...missingPayload } = payload;
    const missingPayloadChecks = await validatePortablePackageBundleIntegrity({
      ...bundle,
      binaryPayloads: [missingPayload]
    });

    expect(missingPayloadChecks).toHaveLength(1);
    expect(missingPayloadChecks[0]).toMatchObject({
      checkId: "portableBundle.missingPayload",
      status: "fail",
      targetPath: "/binaryPayloads/0/payloadBase64"
    });
    expect(missingPayloadChecks[0]?.evidence).toEqual(expect.arrayContaining([
      "bundlePayloadIndex=0",
      "payloadEncoding=base64-v1",
      "payloadBase64=missing",
      "issueTargetPath=/binaryPayloads/0/payloadBase64"
    ]));
  });

  it("reports a package binary reference without a bundle payload", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_portableBundle_required",
      packageRelativePath: "assets/sources/required.bin",
      bytes: SOURCE_BYTES
    });
    const bundle = await createPortableBundle({
      binaryAssetRef,
      packageDocument: createPackageDocument(binaryAssetRef),
      binaryPayloads: []
    });

    const checks = await validatePortablePackageBundleIntegrity(bundle);

    expect(checks.map((check) => check.checkId)).toEqual([
      "portableBundle.missingRequiredBinary"
    ]);
    expect(checks[0]).toMatchObject({
      checkId: "portableBundle.missingRequiredBinary",
      status: "fail",
      target: {
        kind: "sourceAsset",
        id: "src_portableBundle",
        path: "/packageDocument/assets/sourceManifest/sourceAssets/0/binaryAssetRef"
      },
      targetPath: "/packageDocument/assets/sourceManifest/sourceAssets/0/binaryAssetRef"
    });
    expect(checks[0]?.evidence).toEqual(expect.arrayContaining([
      "binaryAssetId=bin_portableBundle_required",
      "packageRelativePath=assets/sources/required.bin",
      "bundlePayloadIndex=missing",
      "binaryPayloadMatch=missing"
    ]));
  });

  it("reports digest and byteLength mismatches without parser or image claims", async () => {
    const sameLengthOtherDigest = await computeDigest(SAME_LENGTH_OTHER_BYTES);
    const digestOnlyRef = await createBinaryAssetReference({
      binaryAssetId: "bin_portableBundle_digest",
      packageRelativePath: "assets/sources/digest.bin",
      bytes: SOURCE_BYTES
    });
    const digestChecks = await validatePortablePackageBundleIntegrity(
      await createPortableBundle({
        binaryAssetRef: digestOnlyRef,
        packageDocument: createPackageDocument(digestOnlyRef),
        payloadBytes: SAME_LENGTH_OTHER_BYTES
      })
    );

    expect(digestChecks.map((check) => check.checkId)).toEqual([
      "portableBundle.digestMismatch"
    ]);
    expect(expectCheckById(digestChecks, "portableBundle.digestMismatch").evidence).toEqual(expect.arrayContaining([
      "bundleSchemaVersion=portable-package-bundle-v0",
      "bundlePayloadIndex=0",
      "expectedByteLength=3",
      `actualDigest=sha256:${sameLengthOtherDigest.hex}`,
      "verificationIssueCode=portableBundle.digestMismatch"
    ]));

    const byteLengthRef = await createBinaryAssetReference({
      binaryAssetId: "bin_portableBundle_length",
      packageRelativePath: "assets/sources/length.bin",
      bytes: SOURCE_BYTES
    });
    const lengthChecks = await validatePortablePackageBundleIntegrity(
      await createPortableBundle({
        binaryAssetRef: byteLengthRef,
        packageDocument: createPackageDocument(byteLengthRef),
        payloadBytes: SHORT_BYTES
      })
    );

    expect(lengthChecks.map((check) => check.checkId)).toEqual([
      "portableBundle.byteLengthMismatch",
      "portableBundle.digestMismatch"
    ]);
    expect(expectCheckById(lengthChecks, "portableBundle.byteLengthMismatch").evidence).toEqual(expect.arrayContaining([
      "expectedByteLength=3",
      "actualByteLength=1",
      "verificationIssueCode=portableBundle.byteLengthMismatch"
    ]));
    for (const check of [...digestChecks, ...lengthChecks]) {
      expect(check.message).not.toMatch(/archive|parser|image decode|raster/i);
      expect(check.impact).not.toMatch(/archive|parser|image decode|raster/i);
    }
  });

  it("reports availability metadata mismatches for portable byte payloads", async () => {
    const binaryAssetRef = await createBinaryAssetReference({
      binaryAssetId: "bin_portableBundle_availability",
      packageRelativePath: "assets/sources/availability.bin",
      bytes: SOURCE_BYTES,
      storageStatus: "missing-package-local-bytes-v1"
    });
    const bundle = await createPortableBundle({
      binaryAssetRef,
      packageDocument: createPackageDocument(),
      payloadBytes: SOURCE_BYTES
    });

    const checks = await validatePortablePackageBundleIntegrity(bundle);

    expect(checks.map((check) => check.checkId)).toEqual([
      "portableBundle.availabilityMismatch"
    ]);
    expect(checks[0]?.evidence).toEqual(expect.arrayContaining([
      "binaryAssetId=bin_portableBundle_availability",
      "bundlePayloadIndex=0",
      "payloadPresent=true",
      "expectedStorageStatus=stored-package-local-v1",
      "actualStorageStatus=missing-package-local-bytes-v1",
      "reason=payload-ref-storage-status-mismatch"
    ]));
  });
});

const createPortableBundle = async (input: {
  readonly binaryAssetRef?: BinaryAssetReferenceDto;
  readonly packageDocument?: PackageDocumentDto;
  readonly payloadBytes?: PackageBinaryBytes;
  readonly binaryPayloads?: readonly unknown[];
} = {}): Promise<PortablePackageBundleV0Dto> => {
  const binaryAssetRef = input.binaryAssetRef ?? await createBinaryAssetReference({
    binaryAssetId: "bin_portableBundle_source",
    packageRelativePath: "assets/sources/source.bin",
    bytes: SOURCE_BYTES
  });

  return PortablePackageBundleV0DtoSchema.parse({
    schemaVersion: "portable-package-bundle-v0",
    bundleKind: "project-defined-json-bundle-v0",
    packageId: PACKAGE_ID,
    packageRevision: PACKAGE_REVISION,
    packageDocument: input.packageDocument ?? createPackageDocument(binaryAssetRef),
    binaryPayloads: input.binaryPayloads ?? [{
      binaryAssetRef,
      payloadEncoding: "base64-v1",
      payloadBase64: toBase64(input.payloadBytes ?? SOURCE_BYTES)
    }]
  });
};

const createBinaryAssetReference = async (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly bytes: PackageBinaryBytes;
  readonly mediaType?: string;
  readonly storageStatus?: BinaryAssetReferenceDto["storageStatus"];
}): Promise<BinaryAssetReferenceDto> =>
  BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: input.binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest: await computeDigest(input.bytes),
    byteLength: new Uint8Array(input.bytes instanceof Uint8Array ? input.bytes : input.bytes.slice(0)).byteLength,
    mediaType: input.mediaType ?? "application/octet-stream",
    storageStatus: input.storageStatus ?? "stored-package-local-v1",
    provenanceId: "prov_portableBundle",
    rightsAssetId: "src_portableBundle"
  });

const computeDigest = async (bytes: PackageBinaryBytes): Promise<BinaryAssetDigestDto> => {
  const result = await computePackageBinarySha256Digest(bytes);

  if (result.status === "unsupported") {
    throw new Error("Test environment does not support SHA-256 digest verification.");
  }

  return result.digest;
};

const createPackageDocument = (binaryAssetRef?: BinaryAssetReferenceDto): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: PACKAGE_ID,
      packageDisplayName: "Portable Bundle Validator",
      formatVersion: "open-model-package-v1",
      packageRevision: PACKAGE_REVISION,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      schemaVersions: {
        manifest: "open-model-package-manifest-v1",
        sourceManifest: "source-manifest-v1",
        textureAtlas: "texture-atlas-v1"
      },
      evaluatorVersions: {},
      modelFiles: {
        graph: "model/graph.json",
        drawables: "model/drawables.json",
        meshes: "model/meshes.json",
        parameters: "model/parameters.json",
        keyforms: "model/keyforms.json",
        rigControls: "model/rig-controls.json",
        dynamics: "model/dynamics.json",
        masks: "model/masks.json",
        drawOrder: "model/draw-order.json"
      },
      assetIndex: "assets/sources/source-manifest.json",
      operationLog: "operations/log.jsonl",
      rightsSummary: {
        status: "cleared"
      },
      provenanceSummary: {
        sourceAssetCount: 1
      },
      packageStableOrderVersion: "stable-order-v1"
    },
    model: {
      graph: {
        schemaVersion: "model-graph-v1",
        coordinateSystem: "canvas-y-down-v1",
        canvasSize: {
          width: 64,
          height: 64
        },
        parts: [],
        rigControlRootIds: [],
        stableOrder: []
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: []
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: []
      },
      parameters: {
        schemaVersion: "parameters-file-v1",
        parameters: []
      },
      keyforms: {
        schemaVersion: "keyforms-file-v1",
        keyformSets: []
      },
      rigControls: {
        schemaVersion: "rig-controls-file-v1",
        rigControls: []
      },
      dynamics: {
        schemaVersion: "dynamics-file-v2",
        dynamicsGroups: []
      },
      masks: {
        schemaVersion: "masks-file-v1",
        masks: []
      },
      drawOrder: {
        schemaVersion: "draw-order-file-v1",
        entries: []
      }
    },
    assets: {
      sourceManifest: {
        schemaVersion: "source-manifest-v1",
        sourceAssets: [
          {
            sourceAssetId: "src_portableBundle",
            kind: "generated-fixture-v1",
            filePath: binaryAssetRef?.packageRelativePath ?? "assets/sources/source.bin",
            contentHash: "sha256:portable-bundle-source-metadata",
            importProfile: "split-png-fallback-v1",
            layers: [],
            diagnostics: [],
            ...(binaryAssetRef === undefined ? {} : { binaryAssetRef })
          }
        ]
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: "prov_portableBundle",
            assetId: "src_portableBundle",
            assetKind: "generatedFixture",
            filePath: binaryAssetRef?.packageRelativePath ?? "assets/sources/source.bin",
            contentHash: "sha256:portable-bundle-source-metadata",
            creator: "validator-test",
            license: "internal-test",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: [
              "Deterministic test bytes; no parser or image interpretation."
            ],
            relatedOperationIds: []
          }
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: "src_portableBundle",
            rightsStatus: "cleared",
            license: "internal-test",
            redistributionAllowed: false
          }
        ]
      }
    }
  });

const toBase64 = (bytes: PackageBinaryBytes): string =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : bytes.slice(0)).toString("base64");

const expectCheckById = (
  checks: readonly ValidationCheckResultDto[],
  checkId: string
): ValidationCheckResultDto => {
  const check = checks.find((candidate) => candidate.checkId === checkId);

  if (check === undefined) {
    throw new Error(`Expected validation check ${checkId}. Found: ${checks.map((candidate) => candidate.checkId).join(", ")}`);
  }

  return check;
};
