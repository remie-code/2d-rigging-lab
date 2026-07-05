import {
  describe,
  expect,
  it
} from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  computePackageBinarySha256Digest,
  createPackageBinaryFileEntry,
  createPackageInMemoryFileSet,
  type BinaryAssetReferenceDto,
  type PackageBinaryBytes,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { ProductPreflightCategoryResultDto } from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import { buildProductPreflightReport } from "./product-preflight-report.js";
import type { ValidationReportDto } from "./validation-report.js";
import {
  validatePackageRuntime,
  validatePackageRuntimeWithBinaryAssets
} from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-05T00:00:00.000Z";
const PACKAGE_ID = "pkg_wave46_psd_materialized_asset";
const SOURCE_ASSET_ID = "src_wave46_psd";
const SOURCE_LAYER_ID = "psd_layer_headwear";
const SOURCE_PROVENANCE_ID = "prov_wave46_psd_source";
const MATERIALIZED_PROVENANCE_ID = "prov_wave46_psd_headwear_texture";
const MATERIALIZED_BINARY_ID = "bin_wave46_psd_headwear_raw";
const SOURCE_BINARY_ID = "bin_wave46_psd_source";
const TEXTURE_ID = "tex_wave46_psd_headwear";
const DRAWABLE_ID = "draw_wave46_psd_headwear";
const MESH_ID = "mesh_wave46_psd_headwear";
const PART_ID = "part_wave46_head";
const RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
const SOURCE_BYTES = new Uint8Array([0x70, 0x73, 0x64, 0x31]);
const MATERIALIZED_BYTES = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]);

describe("Wave46 PSD materialized selected-layer asset diagnostics", () => {
  it("registers materialized asset check ids in the catalog", () => {
    expect(defaultCheckCatalog.has("asset.psd.materializedAssetAvailable")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedSourceCurrentBytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedSourceStale")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedAssetMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedParserExtractionMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedProvenanceBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedDestinationMappingMissing")).toBe(true);
  });

  it("accepts valid package-local raw RGBA materialized bytes and destination mapping as Product Preflight available", async () => {
    const fixture = await createWave46Fixture();
    const report = await validatePackageRuntimeWithBinaryAssets({
      packageDocument: fixture.document,
      binaryFileSet: fixture.binaryFileSet,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave46_materialized_available");

    expect(report.summary.status).toBe("pass");
    expect(report.checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.materializationEvidence",
      "asset.psd.materializedAssetAvailable"
    ]);
    expect(expectCheckById(report, "asset.psd.materializedAssetAvailable").evidence).toEqual(
      expect.arrayContaining([
        "materializedAssetAvailability=available",
        "materializedBytesAvailability=package-local-binary-ref",
        `binaryAssetId=${MATERIALIZED_BINARY_ID}`,
        `destinationTextureId=${TEXTURE_ID}`,
        `destinationDrawableId=${DRAWABLE_ID}`,
        `destinationPartId=${PART_ID}`,
        "textureMapping=available",
        "drawableMapping=available",
        "partMapping=available",
        "validatorBoundary=no-parser-execution",
        "rawParserObject=notPersisted",
        "rawMaterializedBytes=notInlined",
        "publicDemoAsset=falseRequired"
      ])
    );
    expect(assetBytes.status).toBe("pass");
  });

  it("keeps missing source current bytes as a Product Preflight warning while materialized bytes remain available", async () => {
    const fixture = await createWave46Fixture();
    const sourceAsset = expectSourceAsset(fixture.document);
    delete sourceAsset.binaryAssetRef;

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave46_source_current_bytes_warning");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedSourceCurrentBytesMissing",
      "asset.psd.materializedAssetAvailable"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedSourceCurrentBytesMissing")).toMatchObject({
      status: "warning",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("warn");
  });

  it("blocks stale source identity and stale materialized byte reference metadata", async () => {
    const fixture = await createWave46Fixture();
    const materialization = expectMaterialization(fixture.document);

    materialization.provenance.sourceDigest = {
      algorithm: "sha256",
      hex: "1111111111111111111111111111111111111111111111111111111111111111"
    };
    materialization.provenance.sourceByteLength = 999;
    materialization.binaryAssetRef = {
      ...materialization.binaryAssetRef!,
      digest: {
        algorithm: "sha256",
        hex: "2222222222222222222222222222222222222222222222222222222222222222"
      },
      byteLength: 4,
      mediaType: "application/octet-stream"
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave46_materialized_stale_blocking");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedSourceStale",
      "asset.psd.materializedAssetMismatch"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedSourceStale").evidence).toEqual(
      expect.arrayContaining([
        "reasons=source-psd-digest-mismatch,source-psd-byte-length-mismatch"
      ])
    );
    expect(expectCheckById(report, "asset.psd.materializedAssetMismatch").evidence).toEqual(
      expect.arrayContaining([
        "reasons=binary-media-type-not-wave46-raw-rgba,materialized-digest-mismatch,materialized-byte-length-mismatch,materialized-media-type-mismatch"
      ])
    );
    expect(assetBytes.status).toBe("fail");
    expect(assetBytes.blockingReasons.map((reason) => reason.diagnosticRefs[0]?.checkId)).toEqual(
      expect.arrayContaining([
        "asset.psd.materializedSourceStale",
        "asset.psd.materializedAssetMismatch"
      ])
    );
  });

  it("reports parser, extraction, layer ref, and destination mapping gaps as not evaluated when bytes exist but mapping is absent", async () => {
    const fixture = await createWave46Fixture();
    const materialization = expectMaterialization(fixture.document);

    delete materialization.textureId;
    materialization.sourceLayerRef.sourceLayerName = "Wrong Layer";
    materialization.sourceLayerRef.sourceLayerPath = ["Wrong", "Group", "Headwear"];
    materialization.parser = {
      ...materialization.parser!,
      parserVersion: "0.5.0"
    };
    materialization.extraction = {
      extractionKind: "texturePreviewRasterV1",
      optionsSchemaVersion: "psd-layer-extraction-options-v1",
      options: {
        channelOrder: "bgra",
        includeEffects: true,
        includeHiddenLayers: false,
        composeWithOtherLayers: true,
        layerSelection: "psd_layer_other"
      }
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave46_materialized_not_evaluated");

    expect(expectCheckById(report, "asset.psd.materializedParserExtractionMismatch").evidence).toEqual(
      expect.arrayContaining([
        "reasons=source-layer-name-mismatch,source-layer-path-mismatch,parser-evidence-mismatch,extraction-kind-mismatch,extraction-option-channelOrder-mismatch,extraction-option-includeEffects-mismatch,extraction-option-composeWithOtherLayers-mismatch,extraction-option-layerSelection-mismatch"
      ])
    );
    expect(expectCheckById(report, "asset.psd.materializedDestinationMappingMissing")).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("fail");
    expect(assetBytes.blockingReasons.map((reason) => reason.diagnosticRefs[0]?.checkId)).toEqual([
      "asset.psd.materializedParserExtractionMismatch"
    ]);

    materialization.sourceLayerRef.sourceLayerName = "Headwear";
    materialization.sourceLayerRef.sourceLayerPath = ["Root", "Head", "Headwear"];
    materialization.parser = createParserEvidence();
    materialization.extraction = createExtractionEvidence();

    const mappingOnlyReport = validatePackageRuntime({
      packageDocument: fixture.document,
      createdAt: CREATED_AT
    });
    const mappingOnlyAssetBytes = findAssetBytes(
      mappingOnlyReport,
      "preflight_wave46_materialized_mapping_not_evaluated"
    );

    expect(mappingOnlyAssetBytes.status).toBe("not_evaluated");
    expect(mappingOnlyAssetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.materializedDestinationMappingMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("blocks destination mapping when the texture atlas points to unrelated materialized bytes", async () => {
    const fixture = await createWave46Fixture();
    const unrelatedTextureRef = await createBinaryAssetReference({
      binaryAssetId: "bin_wave46_unrelated_raw",
      packageRelativePath: "assets/textures/psd/unrelated.raw-rgba",
      bytes: new Uint8Array([1, 2, 3, 4]),
      mediaType: RAW_RGBA_MEDIA_TYPE,
      provenanceId: MATERIALIZED_PROVENANCE_ID,
      rightsAssetId: SOURCE_ASSET_ID
    });
    const textureEntry = expectTextureAtlasEntry(fixture.document);

    textureEntry.filePath = unrelatedTextureRef.packageRelativePath;
    textureEntry.contentHash = `${unrelatedTextureRef.digest.algorithm}:${unrelatedTextureRef.digest.hex}`;
    textureEntry.binaryAssetRef = unrelatedTextureRef;

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave46_texture_binary_mismatch");
    const check = expectCheckById(report, "asset.psd.materializedDestinationMappingMissing");

    expect(report.checks.map((candidate) => candidate.checkId)).not.toContain(
      "asset.psd.materializedAssetAvailable"
    );
    expect(check).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      `textureBinaryAssetId=${unrelatedTextureRef.binaryAssetId}`,
      `textureBinaryPath=${unrelatedTextureRef.packageRelativePath}`,
      `materializedBinaryPath=assets/textures/psd/headwear.raw-rgba`,
      "reasons=texture-file-path-mismatch,texture-content-hash-mismatch,texture-binary-asset-id-mismatch,texture-binary-path-mismatch,texture-binary-digest-mismatch,texture-binary-byte-length-mismatch"
    ]));
    expect(assetBytes.status).toBe("fail");
    expect(assetBytes.blockingReasons.map((reason) => reason.diagnosticRefs[0]?.checkId)).toEqual(
      expect.arrayContaining(["asset.psd.materializedDestinationMappingMissing"])
    );
  });

  it("blocks non-raw selected-layer materialized media even when materialization metadata agrees", async () => {
    const fixture = await createWave46Fixture();
    const materialization = expectMaterialization(fixture.document);
    const textureEntry = expectTextureAtlasEntry(fixture.document);

    materialization.mediaType = "image/png";
    materialization.binaryAssetRef = {
      ...materialization.binaryAssetRef!,
      mediaType: "image/png"
    };
    textureEntry.binaryAssetRef = {
      ...textureEntry.binaryAssetRef!,
      mediaType: "image/png"
    };

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave46_non_raw_media_blocking");
    const check = expectCheckById(report, "asset.psd.materializedAssetMismatch");

    expect(report.checks.map((candidate) => candidate.checkId)).not.toContain(
      "asset.psd.materializedAssetAvailable"
    );
    expect(check.evidence).toEqual(expect.arrayContaining([
      "materializationMediaType=image/png",
      "binaryMediaType=image/png",
      "reasons=materialized-media-type-not-wave46-raw-rgba,binary-media-type-not-wave46-raw-rgba"
    ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("reports missing explicit private/local provenance and publicDemoAsset=true without parser imports", async () => {
    const fixture = await createWave46Fixture();
    const materialization = expectMaterialization(fixture.document);

    delete materialization.provenance.publicDemoAsset;

    const missingFlagReport = validatePackageRuntime({
      packageDocument: fixture.document,
      createdAt: CREATED_AT
    });
    expect(expectCheckById(missingFlagReport, "asset.psd.materializedProvenanceBlocked").evidence).toEqual(
      expect.arrayContaining([
        "publicDemoAsset=missing",
        "reasons=public-demo-asset-flag-missing"
      ])
    );

    const publicDemoDocument = clonePackageDocument(fixture.document) as Record<string, unknown>;
    const publicDemoMaterialization = expectMaterialization(
      publicDemoDocument as PackageDocumentDto
    ) as unknown as { provenance: { publicDemoAsset: boolean } };
    publicDemoMaterialization.provenance.publicDemoAsset = true;

    const publicDemoReport = validatePackageRuntime({
      packageDocument: publicDemoDocument,
      createdAt: CREATED_AT
    });
    const check = expectCheckById(publicDemoReport, "asset.psd.materializedProvenanceBlocked");

    expect(check).toMatchObject({
      status: "fail",
      severity: "blocking",
      targetPath:
        "/assets/sourceManifest/sourceAssets/0/psdProfile/materializationEvidence/0/provenance/publicDemoAsset"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "actual=true",
      "reason=public-demo-asset-true",
      "validatorBoundary=no-parser-execution"
    ]));
    expect(findAssetBytes(publicDemoReport, "preflight_wave46_public_demo_blocked").status).toBe("fail");
  });
});

const createWave46Fixture = async () => {
  const sourceRef = await createBinaryAssetReference({
    binaryAssetId: SOURCE_BINARY_ID,
    packageRelativePath: "assets/sources/wave46-character.psd",
    bytes: SOURCE_BYTES,
    mediaType: "image/vnd.adobe.photoshop",
    provenanceId: SOURCE_PROVENANCE_ID,
    rightsAssetId: SOURCE_ASSET_ID
  });
  const materializedRef = await createBinaryAssetReference({
    binaryAssetId: MATERIALIZED_BINARY_ID,
    packageRelativePath: "assets/textures/psd/headwear.raw-rgba",
    bytes: MATERIALIZED_BYTES,
    mediaType: RAW_RGBA_MEDIA_TYPE,
    provenanceId: MATERIALIZED_PROVENANCE_ID,
    rightsAssetId: SOURCE_ASSET_ID
  });
  const document = createWave46PackageDocument({
    sourceRef,
    materializedRef
  });

  return {
    document,
    binaryFileSet: createPackageInMemoryFileSet([
      createPackageBinaryFileEntry({
        path: sourceRef.packageRelativePath,
        bytes: SOURCE_BYTES,
        mediaType: sourceRef.mediaType,
        binaryAssetId: sourceRef.binaryAssetId
      }),
      createPackageBinaryFileEntry({
        path: materializedRef.packageRelativePath,
        bytes: MATERIALIZED_BYTES,
        mediaType: materializedRef.mediaType,
        binaryAssetId: materializedRef.binaryAssetId
      })
    ])
  };
};

const createBinaryAssetReference = async (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly bytes: PackageBinaryBytes;
  readonly mediaType: string;
  readonly provenanceId: string;
  readonly rightsAssetId: string;
}): Promise<BinaryAssetReferenceDto> =>
  BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: input.binaryAssetId,
    packageRelativePath: input.packageRelativePath,
    digest: await computeDigest(input.bytes),
    byteLength: input.bytes.byteLength,
    mediaType: input.mediaType,
    storageStatus: "stored-package-local-v1",
    provenanceId: input.provenanceId,
    rightsAssetId: input.rightsAssetId
  });

const computeDigest = async (bytes: PackageBinaryBytes) => {
  const result = await computePackageBinarySha256Digest(bytes);
  if (result.status === "unsupported") {
    throw new Error("Expected SHA-256 support in validator tests.");
  }

  return result.digest;
};

const createWave46PackageDocument = (input: {
  readonly sourceRef: BinaryAssetReferenceDto;
  readonly materializedRef: BinaryAssetReferenceDto;
}): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: PACKAGE_ID,
      packageDisplayName: "Wave46 PSD Materialized Asset",
      formatVersion: "open-model-package-v1",
      packageRevision: 1,
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
          width: 512,
          height: 512
        },
        parts: [
          {
            partId: PART_ID,
            displayName: "Head",
            childPartIds: [],
            drawableIds: [DRAWABLE_ID]
          }
        ],
        rigControlRootIds: [],
        stableOrder: [PART_ID, DRAWABLE_ID, MESH_ID]
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: [
          {
            drawableId: DRAWABLE_ID,
            displayName: "Headwear",
            partId: PART_ID,
            sourceAssetId: SOURCE_ASSET_ID,
            textureId: TEXTURE_ID,
            meshId: MESH_ID,
            defaultOpacity: 1,
            runtimeVisibility: true,
            baseDrawOrder: 0,
            sourceProvenanceId: MATERIALIZED_PROVENANCE_ID
          }
        ]
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: [
          {
            meshId: MESH_ID,
            drawableId: DRAWABLE_ID,
            vertices: [
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 0, y: 1 }
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ],
            triangles: [[0, 1, 2]],
            vertexStableIds: ["v0", "v1", "v2"],
            bounds: {
              x: 0,
              y: 0,
              width: 2,
              height: 1
            },
            generationProvenanceId: MATERIALIZED_PROVENANCE_ID
          }
        ]
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
        schemaVersion: "dynamics-file-v3",
        dynamicsGroups: []
      },
      masks: {
        schemaVersion: "masks-file-v1",
        masks: []
      },
      drawOrder: {
        schemaVersion: "draw-order-file-v1",
        entries: [
          {
            drawableId: DRAWABLE_ID,
            baseDrawOrder: 0,
            stableOrder: 0
          }
        ]
      }
    },
    assets: {
      sourceManifest: {
        schemaVersion: "source-manifest-v1",
        sourceAssets: [
          {
            sourceAssetId: SOURCE_ASSET_ID,
            kind: "psd-source-v1",
            filePath: input.sourceRef.packageRelativePath,
            contentHash: `${input.sourceRef.digest.algorithm}:${input.sourceRef.digest.hex}`,
            importProfile: "layered-character-psd-profile-v1",
            binaryAssetRef: input.sourceRef,
            layers: [
              {
                sourceLayerId: SOURCE_LAYER_ID,
                sourceAssetId: SOURCE_ASSET_ID,
                originalName: "Headwear",
                normalizedName: "headwear",
                groupPath: ["Root", "Head"],
                bounds: {
                  x: 0,
                  y: 0,
                  width: 2,
                  height: 1
                },
                visibleInSource: true,
                opacityInSource: 1,
                role: "editableLayer",
                unsupportedFeatures: [],
                mappedDrawableIds: [DRAWABLE_ID]
              }
            ],
            diagnostics: [],
            psdProfile: {
              schemaVersion: "layered-character-psd-profile-v1",
              adapter: {
                adapterName: "wave46-browser-explicit-psd-import-adapter",
                adapterVersion: "0.1.0",
                adapterResultSchemaVersion: "psd-adapter-result-v1",
                sourceProfile: "layered-character-psd-profile-v1",
                evidenceKind: "real-psd-parse-result-v1",
                intakeKind: "realPsdParseResult",
                parser: createParserEvidence()
              },
              canvas: {
                width: 512,
                height: 512
              },
              sourceGroups: [],
              sourceLayers: [
                {
                  sourceLayerId: SOURCE_LAYER_ID,
                  originalName: "Headwear",
                  normalizedName: "headwear",
                  groupPath: ["Root", "Head"],
                  sourceOrder: 0,
                  bounds: {
                    x: 0,
                    y: 0,
                    width: 2,
                    height: 1
                  },
                  visibleInSource: true,
                  opacityInSource: 1,
                  role: "editableLayer",
                  unsupportedFeatures: [],
                  textureId: TEXTURE_ID,
                  targetPartId: PART_ID
                }
              ],
              unsupportedFeatures: [],
              diagnostics: [],
              layerTreeEvidence: {
                evidenceKind: "psd-layer-tree-evidence-v1",
                evidenceId: "layerTree_wave46SelectedLayer",
                intakeKind: "realPsdParseResult",
                groupCount: 0,
                layerCount: 1,
                maxDepth: 2,
                parser: createParserEvidence(),
                privateShapePolicy: "parser-private-shape-excluded-v1"
              },
              materializationEvidence: [
                {
                  evidenceKind: "psd-layer-materialization-evidence-v1",
                  materializationId: "mat_wave46Headwear",
                  sourceLayerRef: {
                    sourceAssetId: SOURCE_ASSET_ID,
                    sourceLayerId: SOURCE_LAYER_ID,
                    sourceLayerName: "Headwear",
                    sourceLayerPath: ["Root", "Head", "Headwear"]
                  },
                  mediaType: RAW_RGBA_MEDIA_TYPE,
                  byteLength: input.materializedRef.byteLength,
                  digest: input.materializedRef.digest,
                  width: 2,
                  height: 1,
                  binaryAssetRef: input.materializedRef,
                  textureId: TEXTURE_ID,
                  provenance: {
                    sourceFilePath: "test_data/sample_model.psd",
                    sourceDigest: input.sourceRef.digest,
                    sourceByteLength: input.sourceRef.byteLength,
                    sourceMediaType: input.sourceRef.mediaType,
                    privacyLabel: "packageLocalAsset",
                    publicDistribution: "notPublicDistributable",
                    generatedBy: "wave46.browserSelectedLayerMaterialization",
                    publicDemoAsset: false
                  },
                  parser: createParserEvidence(),
                  extraction: createExtractionEvidence()
                }
              ],
              compatibility: {
                structuredProfilePrecedence: "structured-profile-preferred-v1",
                flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
                flattenedUnsupportedFeaturesFallback:
                  "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
              }
            }
          }
        ]
      },
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: TEXTURE_ID,
            filePath: input.materializedRef.packageRelativePath,
            contentHash: `${input.materializedRef.digest.algorithm}:${input.materializedRef.digest.hex}`,
            sourceAssetId: SOURCE_ASSET_ID,
            sourceLayerId: SOURCE_LAYER_ID,
            provenanceId: MATERIALIZED_PROVENANCE_ID,
            binaryAssetRef: input.materializedRef
          }
        ],
        previewAssets: [
          {
            previewAssetId: "preview_wave46_headwear",
            textureId: TEXTURE_ID,
            reference: {
              referenceKind: "package-local-file-v1",
              filePath: input.materializedRef.packageRelativePath
            },
            contentHash: `${input.materializedRef.digest.algorithm}:${input.materializedRef.digest.hex}`,
            sourceAssetId: SOURCE_ASSET_ID,
            sourceLayerId: SOURCE_LAYER_ID,
            provenanceId: MATERIALIZED_PROVENANCE_ID,
            rightsAssetId: SOURCE_ASSET_ID
          }
        ]
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: SOURCE_PROVENANCE_ID,
            assetId: SOURCE_ASSET_ID,
            assetKind: "source",
            filePath: input.sourceRef.packageRelativePath,
            contentHash: `${input.sourceRef.digest.algorithm}:${input.sourceRef.digest.hex}`,
            creator: "validator-test",
            license: "private-local-selected-psd",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: [
              "Explicit user-selected private/local PSD bytes."
            ],
            relatedOperationIds: []
          },
          {
            provenanceId: MATERIALIZED_PROVENANCE_ID,
            assetId: SOURCE_ASSET_ID,
            assetKind: "texture",
            filePath: input.materializedRef.packageRelativePath,
            contentHash: `${input.materializedRef.digest.algorithm}:${input.materializedRef.digest.hex}`,
            creator: "validator-test",
            license: "private-local-selected-psd-layer",
            redistributionAllowed: false,
            aiUsed: false,
            transformHistory: [
              "importPsdLayerMaterialization:selected-layer-raw-rgba"
            ],
            relatedOperationIds: ["op_wave46_psd_layer_materialization"]
          }
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: SOURCE_ASSET_ID,
            rightsStatus: "cleared",
            license: "private-local-selected-psd",
            redistributionAllowed: false
          }
        ]
      }
    }
  });

const createParserEvidence = () => ({
  evidenceKind: "psd-parser-evidence-v1" as const,
  parserName: "@webtoon/psd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: "wave46-browser-explicit-psd-import-adapter",
  adapterVersion: "0.1.0",
  runtime: "browser" as const,
  privateShapePolicy: "parser-private-shape-excluded-v1" as const
});

const createExtractionEvidence = () => ({
  extractionKind: "selectedLayerRasterV1" as const,
  optionsSchemaVersion: "psd-layer-extraction-options-v1" as const,
  options: {
    channelOrder: "rgba",
    includeEffects: false,
    includeHiddenLayers: false,
    composeWithOtherLayers: false,
    layerSelection: SOURCE_LAYER_ID
  }
});

const expectSourceAsset = (document: PackageDocumentDto) => {
  const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
  if (sourceAsset === undefined) {
    throw new Error("Expected source asset.");
  }

  return sourceAsset;
};

const expectMaterialization = (document: PackageDocumentDto) => {
  const materialization = expectSourceAsset(document).psdProfile?.materializationEvidence?.[0];
  if (materialization === undefined) {
    throw new Error("Expected materialization evidence.");
  }

  return materialization;
};

const expectTextureAtlasEntry = (document: PackageDocumentDto) => {
  const textureEntry = document.assets.textureAtlas?.textures[0];
  if (textureEntry === undefined) {
    throw new Error("Expected texture atlas entry.");
  }

  return textureEntry;
};

const findAssetBytes = (
  validationReport: ValidationReportDto,
  reportId: string
): ProductPreflightCategoryResultDto => {
  const productPreflight = buildProductPreflightReport({
    reportId,
    createdAt: CREATED_AT,
    validationReports: [validationReport]
  });
  const category = productPreflight.categories.find((candidate) =>
    candidate.category === "assetBytes"
  );

  if (category === undefined) {
    throw new Error("Expected assetBytes category.");
  }

  return category;
};

const expectCheckById = (
  report: ValidationReportDto,
  checkId: string
): ValidationReportDto["checks"][number] => {
  const check = report.checks.find((candidate) => candidate.checkId === checkId);
  if (check === undefined) {
    throw new Error(
      `Expected validation check ${checkId}. Found: ${report.checks.map((candidate) => candidate.checkId).join(", ")}`
    );
  }

  return check;
};

const clonePackageDocument = <TValue>(value: TValue): TValue =>
  JSON.parse(JSON.stringify(value)) as TValue;
