import {
  describe,
  expect,
  it
} from "vitest";

import {
  BinaryAssetIndexFileSchema,
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  computePackageBinarySha256Digest,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  type BinaryAssetEntryDto,
  type BinaryAssetIndexFileDto,
  type BinaryAssetReferenceDto,
  type PackageBinaryBytes,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntimeWithBinaryAssets } from "./validators/package-runtime.js";

const SOURCE_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const TEXTURE_BYTES = new Uint8Array([0x64, 0x65, 0x66]);
const CREATED_AT = "2026-05-31T00:00:00.000Z";

describe("binary asset validator diagnostics", () => {
  it("registers binary asset diagnostics in the check catalog", () => {
    expect(defaultCheckCatalog.has("binary.bytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("binary.byteLengthMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("binary.digestMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("binary.mediaTypeMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("binary.assetIdMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("binary.referenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("rights.binaryProvenanceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("rights.binaryRightsMissing")).toBe(true);
    expect(defaultCheckCatalog.has("rights.binaryProvenanceMismatch")).toBe(true);
  });

  it("keeps valid stored source, texture, and binary index references as a validation pass", async () => {
    const sourceRef = await createBinaryAssetReference({
      binaryAssetId: "bin_source_binary",
      packageRelativePath: "assets/sources/source.bin",
      bytes: SOURCE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_source_binary",
      rightsAssetId: "src_binary"
    });
    const textureRef = await createBinaryAssetReference({
      binaryAssetId: "bin_texture_binary",
      packageRelativePath: "assets/textures/body.bin",
      bytes: TEXTURE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_texture_binary",
      rightsAssetId: "tex_binary"
    });
    const document = createPackageDocument({ sourceRef, textureRef });
    const binaryFileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: sourceRef.packageRelativePath,
        bytes: SOURCE_BYTES,
        mediaType: sourceRef.mediaType,
        binaryAssetId: sourceRef.binaryAssetId
      }),
      createPackageBinaryFileEntry({
        path: textureRef.packageRelativePath,
        bytes: TEXTURE_BYTES,
        mediaType: textureRef.mediaType,
        binaryAssetId: textureRef.binaryAssetId
      })
    ]);
    const binaryAssetIndex = createBinaryAssetIndex([
      createBinaryAssetEntryFromReference(sourceRef, {
        role: "source-original-v1",
        sourceAssetId: "src_binary"
      })
    ]);

    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: document,
      binaryFileSet,
      binaryAssetIndex,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
  });

  it("reports metadata-declared missing bytes and absent file-set bytes without decode claims", async () => {
    const missingStatusRef = await createBinaryAssetReference({
      binaryAssetId: "bin_source_binary",
      packageRelativePath: "assets/sources/source.bin",
      bytes: SOURCE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_source_binary",
      rightsAssetId: "src_binary",
      storageStatus: "missing-package-local-bytes-v1"
    });
    const missingStatusReport = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: createPackageDocument({ sourceRef: missingStatusRef }),
      createdAt: CREATED_AT
    });
    const missingStatusCheck = expectCheckById(missingStatusReport, "binary.bytesMissing");

    expect(missingStatusCheck).toMatchObject({
      checkId: "binary.bytesMissing",
      status: "fail",
      severity: "error",
      phase: "reference",
      target: {
        kind: "sourceAsset",
        id: "src_binary",
        path: "/assets/sourceManifest/sourceAssets/0/binaryAssetRef"
      }
    });
    expect(missingStatusCheck.evidence).toEqual(expect.arrayContaining([
      "storageStatus=missing-package-local-bytes-v1",
      "bytesAvailability=missing",
      "reason=storageStatus:missing-package-local-bytes-v1",
      "fileSetVerification=skipped"
    ]));
    expect(missingStatusCheck.message).not.toMatch(/decode|parser|raster/i);

    const storedRef = await createBinaryAssetReference({
      binaryAssetId: "bin_source_binary",
      packageRelativePath: "assets/sources/source.bin",
      bytes: SOURCE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_source_binary",
      rightsAssetId: "src_binary"
    });
    const absentFileSetReport = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: createPackageDocument({ sourceRef: storedRef }),
      binaryFileSet: createPackageInMemoryFileSet([]),
      createdAt: CREATED_AT
    });
    const absentFileSetCheck = expectCheckById(absentFileSetReport, "binary.bytesMissing");

    expect(absentFileSetCheck.evidence).toEqual(expect.arrayContaining([
      "storageStatus=stored-package-local-v1",
      "verificationIssueCode=binary.bytes.missing",
      "expected=assets/sources/source.bin",
      "actual=missing"
    ]));
    expect(absentFileSetCheck.message).not.toMatch(/decode|parser|raster/i);
  });

  it("reports BinaryAssetEntryDto byte length, digest, media type, and asset id mismatches", async () => {
    const sourceRef = await createBinaryAssetReference({
      binaryAssetId: "bin_source_binary",
      packageRelativePath: "assets/sources/source.bin",
      bytes: SOURCE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_source_binary",
      rightsAssetId: "src_binary"
    });
    const binaryAssetIndex = createBinaryAssetIndex([
      createBinaryAssetEntryFromReference(sourceRef, {
        role: "unknown-binary-v1"
      })
    ]);
    const binaryFileSet = createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: sourceRef.packageRelativePath,
        bytes: new Uint8Array([0x61]),
        mediaType: "text/plain",
        binaryAssetId: "bin_other_binary"
      })
    ]);

    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: createPackageDocument(),
      binaryFileSet,
      binaryAssetIndex,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "binary.assetIdMismatch",
      "binary.byteLengthMismatch",
      "binary.digestMismatch",
      "binary.mediaTypeMismatch"
    ]));
    expect(expectCheckById(report, "binary.digestMismatch").evidence).toEqual(expect.arrayContaining([
      "referenceSource=binaryAssetIndex.assets",
      "verificationIssueCode=binary.digest.mismatch",
      "actualMediaType=text/plain"
    ]));
  });

  it("reports missing and inconsistent binary rights/provenance records", async () => {
    const sourceRef = await createBinaryAssetReference({
      binaryAssetId: "bin_source_binary",
      packageRelativePath: "assets/sources/source.bin",
      bytes: SOURCE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_missing_binary",
      rightsAssetId: "asset_missing_binary"
    });

    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: createPackageDocument({ sourceRef }),
      binaryFileSet: createPackageInMemoryFileSet([]),
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "rights.binaryProvenanceMissing",
      "rights.binaryRightsMissing",
      "binary.bytesMissing"
    ]));
    expect(expectCheckById(report, "rights.binaryProvenanceMissing").evidence).toEqual(expect.arrayContaining([
      "provenanceId=prov_missing_binary",
      "provenanceIdMatch=missing"
    ]));
    expect(expectCheckById(report, "rights.binaryRightsMissing").evidence).toEqual(expect.arrayContaining([
      "rightsAssetId=asset_missing_binary",
      "rightsAssetMatch=missing"
    ]));

    const inconsistentRef = await createBinaryAssetReference({
      binaryAssetId: "bin_source_binary",
      packageRelativePath: "assets/sources/source.bin",
      bytes: SOURCE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_texture_binary",
      rightsAssetId: "src_binary"
    });
    const inconsistentReport = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: createPackageDocument({ sourceRef: inconsistentRef }),
      binaryFileSet: createPackageInMemoryFileSet([]),
      createdAt: CREATED_AT
    });
    const mismatchCheck = expectCheckById(inconsistentReport, "rights.binaryProvenanceMismatch");

    expect(mismatchCheck.evidence).toEqual(expect.arrayContaining([
      "provenanceId=prov_texture_binary",
      "provenanceAssetId=tex_binary",
      "rightsAssetId=src_binary",
      "reason=provenance-rights-asset-mismatch"
    ]));
  });

  it("reports source manifest and texture binary reference consistency gaps", async () => {
    const sourceRef = await createBinaryAssetReference({
      binaryAssetId: "bin_source_binary",
      packageRelativePath: "assets/sources/other-source.bin",
      bytes: SOURCE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_source_binary",
      rightsAssetId: "src_binary"
    });
    const textureRef = await createBinaryAssetReference({
      binaryAssetId: "bin_texture_binary",
      packageRelativePath: "assets/textures/other-body.bin",
      bytes: TEXTURE_BYTES,
      mediaType: "application/octet-stream",
      provenanceId: "prov_texture_binary",
      rightsAssetId: "tex_binary"
    });

    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: createPackageDocument({ sourceRef, textureRef }),
      binaryFileSet: createPackageInMemoryFileSet([]),
      createdAt: CREATED_AT
    });
    const mismatchChecks = report.checks.filter((check) => check.checkId === "binary.referenceMismatch");

    expect(mismatchChecks).toHaveLength(2);
    expect(mismatchChecks.flatMap((check) => check.evidence)).toEqual(expect.arrayContaining([
      "reason=source-binary-path-mismatch",
      "expected=assets/sources/source.bin",
      "actual=assets/sources/other-source.bin",
      "reason=texture-binary-path-mismatch",
      "expected=assets/textures/body.bin",
      "actual=assets/textures/other-body.bin"
    ]));
  });
});

interface BinaryAssetReferenceInput {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly bytes: PackageBinaryBytes;
  readonly mediaType: string;
  readonly provenanceId: string;
  readonly rightsAssetId: string;
  readonly storageStatus?: BinaryAssetReferenceDto["storageStatus"];
}

const createBinaryAssetReference = async (
  input: BinaryAssetReferenceInput
): Promise<BinaryAssetReferenceDto> => {
  const digest = await computeDigest(input.bytes);

  return BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: input.binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest,
    byteLength: input.bytes.byteLength,
    mediaType: input.mediaType,
    storageStatus: input.storageStatus ?? "stored-package-local-v1",
    provenanceId: input.provenanceId,
    rightsAssetId: input.rightsAssetId
  });
};

const createBinaryAssetEntryFromReference = (
  reference: BinaryAssetReferenceDto,
  overrides: Readonly<Record<string, unknown>>
): BinaryAssetEntryDto => {
  const index = createBinaryAssetIndex([{
    binaryAssetId: reference.binaryAssetId,
    role: "source-original-v1",
    packageRelativePath: reference.packageRelativePath,
    digest: reference.digest,
    byteLength: reference.byteLength,
    mediaType: reference.mediaType,
    storageStatus: reference.storageStatus,
    provenanceId: reference.provenanceId,
    rightsAssetId: reference.rightsAssetId,
    ...overrides
  }]);
  const entry = index.assets[0];

  if (entry === undefined) {
    throw new Error("Expected binary asset index entry.");
  }

  return entry;
};

const createBinaryAssetIndex = (
  entries: readonly unknown[]
): BinaryAssetIndexFileDto =>
  BinaryAssetIndexFileSchema.parse({
    schemaVersion: "binary-asset-index-v1",
    assets: entries
  });

const computeDigest = async (bytes: PackageBinaryBytes) => {
  const result = await computePackageBinarySha256Digest(bytes);

  if (result.status === "unsupported") {
    throw new Error("Test environment does not support SHA-256 digest verification.");
  }

  return result.digest;
};

const expectCheckById = (
  report: ValidationReportDto,
  checkId: string
): ValidationReportDto["checks"][number] => {
  const check = report.checks.find((candidate) => candidate.checkId === checkId);

  if (check === undefined) {
    throw new Error(`Expected validation check ${checkId}. Found: ${report.checks.map((candidate) => candidate.checkId).join(", ")}`);
  }

  return check;
};

const createPackageDocument = (input: {
  readonly sourceRef?: BinaryAssetReferenceDto;
  readonly textureRef?: BinaryAssetReferenceDto;
} = {}): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: "pkg_binary_validator",
      packageDisplayName: "Binary Validator",
      formatVersion: "open-model-package-v1",
      packageRevision: 0,
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
        schemaVersion: "dynamics-file-v1",
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
            sourceAssetId: "src_binary",
            kind: "generated-fixture-v1",
            filePath: "assets/sources/source.bin",
            contentHash: "sha256:source-binary-metadata",
            importProfile: "split-png-fallback-v1",
            layers: [
              {
                sourceLayerId: "layer_body",
                sourceAssetId: "src_binary",
                originalName: "Body",
                normalizedName: "body",
                groupPath: [],
                bounds: {
                  x: 0,
                  y: 0,
                  width: 1,
                  height: 1
                },
                visibleInSource: true,
                opacityInSource: 1,
                role: "editableLayer",
                unsupportedFeatures: [],
                mappedDrawableIds: []
              }
            ],
            diagnostics: [],
            ...(input.sourceRef === undefined ? {} : { binaryAssetRef: input.sourceRef })
          }
        ]
      },
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: "tex_binary",
            filePath: "assets/textures/body.bin",
            contentHash: "sha256:texture-binary-metadata",
            sourceAssetId: "src_binary",
            sourceLayerId: "layer_body",
            provenanceId: "prov_texture_binary",
            ...(input.textureRef === undefined ? {} : { binaryAssetRef: input.textureRef })
          }
        ],
        previewAssets: []
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: "prov_source_binary",
            assetId: "src_binary",
            assetKind: "generatedFixture",
            filePath: "assets/sources/source.bin",
            contentHash: "sha256:source-binary-metadata",
            creator: "validator-test",
            license: "internal-test",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: [
              "Deterministic test bytes; no image or PSD decode."
            ],
            relatedOperationIds: []
          },
          {
            provenanceId: "prov_texture_binary",
            assetId: "tex_binary",
            assetKind: "texture",
            filePath: "assets/textures/body.bin",
            contentHash: "sha256:texture-binary-metadata",
            creator: "validator-test",
            license: "internal-test",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: [
              "Deterministic test bytes; media type is declared metadata only."
            ],
            relatedOperationIds: []
          }
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: "src_binary",
            rightsStatus: "cleared",
            license: "internal-test",
            redistributionAllowed: false
          },
          {
            assetId: "tex_binary",
            rightsStatus: "cleared",
            license: "internal-test",
            redistributionAllowed: false
          }
        ]
      }
    }
  });
