import {
  describe,
  expect,
  it
} from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  computePackageBinarySha256Digest,
  type BinaryAssetReferenceDto,
  type PackageBinaryBytes,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { ProductPreflightCategoryResultDto } from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import { buildProductPreflightReport } from "./product-preflight-report.js";
import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-06T00:00:00.000Z";
const PACKAGE_ID = "pkg_wave47_psd_batch_materialized_asset";
const SOURCE_ASSET_ID = "src_wave47_psd";
const SOURCE_PROVENANCE_ID = "prov_wave47_psd_source";
const SOURCE_BINARY_ID = "bin_wave47_psd_source";
const PARENT_PART_ID = "part_wave47_parent";
const RAW_RGBA_MEDIA_TYPE =
  "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
const SOURCE_BYTES = new Uint8Array([0x70, 0x73, 0x64, 0x34, 0x37]);
type BatchEvidenceFixture = {
  aggregateStatus: "success" | "preflightBlocked" | "partialFailure" | "failure";
  selectedLayerCount: number;
  successCount: number;
  failureCount: number;
  totalMaterializedByteLength: number;
  destination: {
    destinationKind: "generatedPartScaffold";
    parentPartId: string;
  };
  entries: Array<{
    selectedIndex: number;
    sourceLayerRef: ReturnType<typeof createSourceLayerRef>;
    materializationId: string;
    materializedByteLength: number;
    generated: {
      partId: string;
      partDisplayName: string;
      drawableId: string;
      drawableDisplayName: string;
      textureId: string;
      meshId: string;
    };
    status: "success" | "preflightReady" | "preflightBlocked";
    operationId?: string;
    diagnostics: Array<{
      checkId: string;
      status: "fail";
      severity: "error";
      phase: string;
      target: {
        kind: "operation";
        id: string;
        path: string;
      };
      message: string;
      evidence: string[];
      relatedAC: string[];
      relatedScenarios: string[];
    }>;
  }>;
};
const LAYER_FIXTURES = [
  {
    sourceLayerId: "psd_layer_headwear",
    materializationId: "mat_wave47Headwear",
    originalName: "Headwear",
    normalizedName: "headwear",
    groupPath: ["Root", "Head"],
    bytes: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]),
    width: 2,
    height: 1,
    materializedBinaryId: "bin_wave47_headwear_raw",
    materializedPath: "assets/textures/psd/headwear.raw-rgba",
    materializedProvenanceId: "prov_wave47_headwear_texture",
    partId: "part_root_head_headwear",
    drawableId: "draw_root_head_headwear",
    meshId: "mesh_root_head_headwear",
    textureId: "tex_root_head_headwear",
    displayName: "Root / Head / Headwear"
  },
  {
    sourceLayerId: "psd_layer_eyewear",
    materializationId: "mat_wave47Eyewear",
    originalName: "Eyewear",
    normalizedName: "eyewear",
    groupPath: ["Root", "Face"],
    bytes: new Uint8Array([12, 24, 36, 255]),
    width: 1,
    height: 1,
    materializedBinaryId: "bin_wave47_eyewear_raw",
    materializedPath: "assets/textures/psd/eyewear.raw-rgba",
    materializedProvenanceId: "prov_wave47_eyewear_texture",
    partId: "part_root_face_eyewear",
    drawableId: "draw_root_face_eyewear",
    meshId: "mesh_root_face_eyewear",
    textureId: "tex_root_face_eyewear",
    displayName: "Root / Face / Eyewear"
  }
] as const;

describe("Wave47 PSD batch materialized asset diagnostics", () => {
  it("registers batch materialized asset check ids in the catalog", () => {
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchEvidenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchAvailable")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchBytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchEntryMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchSourceCurrentBytesMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchSourceStale")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchAssetMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchProvenanceBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchDestinationParentInvalid")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchGeneratedScaffoldMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchDuplicateLayer")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchGeneratedScaffoldCollision")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchPreflightBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializedBatchPartialFailure")).toBe(true);
  });

  it("accepts valid two-layer batch materialized bytes and generated part scaffold as Product Preflight available", async () => {
    const fixture = await createWave47BatchFixture();
    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_available");

    expect(report.summary.status).toBe("pass");
    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedAssetAvailable",
      "asset.psd.materializedBatchAvailable"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedBatchAvailable").evidence).toEqual(
      expect.arrayContaining([
        "batchMaterializedAssetAvailability=available",
        "generatedPartScaffoldAvailability=available",
        "materializedBytesAvailability=package-local-binary-ref",
        "validatorBoundary=no-parser-execution",
        "rawParserObject=notPersisted",
        "allLayerImport=notClaimed",
        "recursiveGroupImport=notClaimed",
        "rendererPixelOracle=notClaimed"
      ])
    );
    expect(assetBytes.status).toBe("pass");
  });

  it("keeps missing source current bytes as a batch Product Preflight warning while batch entries remain available", async () => {
    const fixture = await createWave47BatchFixture();
    const sourceAsset = expectSourceAsset(fixture.document);
    delete sourceAsset.binaryAssetRef;

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_source_warning");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchSourceCurrentBytesMissing",
      "asset.psd.materializedBatchAvailable"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedBatchSourceCurrentBytesMissing")).toMatchObject({
      status: "warning",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("warn");
  });

  it("blocks stale, missing, media type, digest, and byteLength batch entry evidence", async () => {
    const fixture = await createWave47BatchFixture();
    const materialization = expectMaterialization(fixture.document, 1);

    materialization.provenance.sourceDigest = {
      algorithm: "sha256",
      hex: "1111111111111111111111111111111111111111111111111111111111111111"
    };
    materialization.provenance.sourceByteLength = 999;
    materialization.mediaType = "image/png";
    materialization.byteLength = 99;
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
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_stale_blocking");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchSourceStale",
      "asset.psd.materializedBatchAssetMismatch"
    ]));
    expect(expectCheckById(report, "asset.psd.materializedBatchSourceStale").evidence).toEqual(
      expect.arrayContaining([
        "reasons=source-psd-digest-mismatch,source-psd-byte-length-mismatch"
      ])
    );
    expect(expectCheckById(report, "asset.psd.materializedBatchAssetMismatch").evidence).toEqual(
      expect.arrayContaining([
        "reasons=materialized-media-type-not-wave47-raw-rgba,binary-media-type-not-wave47-raw-rgba,materialized-digest-mismatch,materialized-byte-length-mismatch,batch-entry-byte-length-mismatch,materialized-media-type-mismatch,raw-rgba-byte-length-mismatch"
      ])
    );
    expect(assetBytes.status).toBe("fail");
  });

  it("blocks success aggregate evidence when entry statuses and counts are inconsistent", async () => {
    const fixture = await createWave47BatchFixture();
    const malformedBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    malformedBatch.aggregateStatus = "success";
    malformedBatch.successCount = 2;
    malformedBatch.failureCount = 1;
    malformedBatch.entries[1]!.status = "preflightReady";

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [malformedBatch],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_success_count_mismatch");
    const mismatch = expectCheckById(report, "asset.psd.materializedBatchEvidenceMismatch");

    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.materializedBatchAvailable"
    );
    expect(mismatch).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(mismatch.evidence).toEqual(expect.arrayContaining([
      "actualSuccessEntryCount=1",
      "actualPreflightBlockedEntryCount=0",
      "actualNonSuccessEntryCount=1",
      "reasons=success-count-entry-status-mismatch,failure-count-entry-status-mismatch,success-aggregate-has-non-success-entry,success-aggregate-failure-count-nonzero"
    ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("blocks successful batch entries that have no matching per-layer materialization evidence", async () => {
    const fixture = await createWave47BatchFixture();
    const missingEntryBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    missingEntryBatch.entries[0]!.materializationId = "mat_wave47Missing";

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [missingEntryBatch],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_entry_missing");
    const missing = expectCheckById(report, "asset.psd.materializedBatchEntryMissing");

    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.materializedBatchAvailable"
    );
    expect(missing).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(missing.evidence).toEqual(expect.arrayContaining([
      "expectedMaterializationId=mat_wave47Missing",
      "reason=successful-entry-materialization-evidence-missing"
    ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("blocks duplicate selections, generated scaffold collisions, invalid destination parent, and preflight failure", async () => {
    const fixture = await createWave47BatchFixture();
    const duplicateBatch = clone(fixture.batchEvidence) as BatchEvidenceFixture;
    duplicateBatch.aggregateStatus = "preflightBlocked";
    duplicateBatch.successCount = 0;
    duplicateBatch.failureCount = 2;
    duplicateBatch.destination.parentPartId = "part_missingParent";
    duplicateBatch.entries[1]!.sourceLayerRef = duplicateBatch.entries[0]!.sourceLayerRef;
    duplicateBatch.entries[1]!.generated = duplicateBatch.entries[0]!.generated;
    duplicateBatch.entries[1]!.status = "preflightBlocked";
    duplicateBatch.entries[1]!.diagnostics = [
      {
        checkId: "operation.importPsdLayerMaterializationBatch.duplicateLayerRef",
        status: "fail",
        severity: "error",
        phase: "precondition",
        target: {
          kind: "operation",
          id: "op_wave47_batch",
          path: "/payload/entries/1/materialization/sourceLayerRef"
        },
        message: "Duplicate PSD source layer ref.",
        evidence: [],
        relatedAC: [],
        relatedScenarios: []
      },
      {
        checkId: "operation.importPsdLayerMaterializationBatch.idNameCollision",
        status: "fail",
        severity: "error",
        phase: "precondition",
        target: {
          kind: "operation",
          id: "op_wave47_batch",
          path: "/payload/entries/1"
        },
        message: "Generated part id already exists.",
        evidence: [],
        relatedAC: [],
        relatedScenarios: []
      }
    ];

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [duplicateBatch],
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_preflight_blocked");

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.materializedBatchPreflightBlocked",
      "asset.psd.materializedBatchDestinationParentInvalid",
      "asset.psd.materializedBatchDuplicateLayer",
      "asset.psd.materializedBatchGeneratedScaffoldCollision"
    ]));
    expect(assetBytes.status).toBe("fail");
  });

  it("maps required-but-missing batch evidence to Product Preflight not_evaluated", async () => {
    const fixture = await createWave47BatchFixture();
    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      requirePsdLayerMaterializationBatchEvidence: true,
      createdAt: CREATED_AT
    });
    const assetBytes = findAssetBytes(report, "preflight_wave47_batch_not_evaluated");

    expect(expectCheckById(report, "asset.psd.materializedBatchEvidenceMissing")).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.materializedBatchEvidenceMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("blocks missing private/local batch provenance and publicDemoAsset=true package evidence", async () => {
    const fixture = await createWave47BatchFixture();
    const materialization = expectMaterialization(fixture.document, 0);
    delete materialization.provenance.publicDemoAsset;

    const missingFlagReport = validatePackageRuntime({
      packageDocument: fixture.document,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    expect(expectCheckById(missingFlagReport, "asset.psd.materializedBatchProvenanceBlocked").evidence)
      .toEqual(expect.arrayContaining([
        "publicDemoAsset=missing",
        "reasons=public-demo-asset-flag-missing"
      ]));
    expect(findAssetBytes(missingFlagReport, "preflight_wave47_batch_missing_public_flag").status)
      .toBe("fail");

    const publicDemoDocument = clone(fixture.document) as Record<string, unknown>;
    const publicDemoMaterialization = expectMaterialization(
      publicDemoDocument as PackageDocumentDto,
      0
    ) as unknown as { provenance: { publicDemoAsset: boolean } };
    publicDemoMaterialization.provenance.publicDemoAsset = true;

    const publicDemoReport = validatePackageRuntime({
      packageDocument: publicDemoDocument,
      psdLayerMaterializationBatchEvidence: [fixture.batchEvidence],
      createdAt: CREATED_AT
    });
    const check = expectCheckById(publicDemoReport, "asset.psd.materializedProvenanceBlocked");

    expect(check).toMatchObject({
      status: "fail",
      severity: "blocking"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "actual=true",
      "reason=public-demo-asset-true",
      "validatorBoundary=no-parser-execution"
    ]));
    expect(findAssetBytes(publicDemoReport, "preflight_wave47_public_demo_blocked").status)
      .toBe("fail");
  });
});

const createWave47BatchFixture = async () => {
  const sourceRef = await createBinaryAssetReference({
    binaryAssetId: SOURCE_BINARY_ID,
    packageRelativePath: "assets/sources/wave47-character.psd",
    bytes: SOURCE_BYTES,
    mediaType: "image/vnd.adobe.photoshop",
    provenanceId: SOURCE_PROVENANCE_ID,
    rightsAssetId: SOURCE_ASSET_ID
  });
  const materializedRefs = await Promise.all(LAYER_FIXTURES.map((layer) =>
    createBinaryAssetReference({
      binaryAssetId: layer.materializedBinaryId,
      packageRelativePath: layer.materializedPath,
      bytes: layer.bytes,
      mediaType: RAW_RGBA_MEDIA_TYPE,
      provenanceId: layer.materializedProvenanceId,
      rightsAssetId: SOURCE_ASSET_ID
    })
  ));
  const document = createWave47PackageDocument({
    sourceRef,
    materializedRefs
  });
  const batchEvidence = createBatchEvidence(materializedRefs);

  return { document, batchEvidence };
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

const createWave47PackageDocument = (input: {
  readonly sourceRef: BinaryAssetReferenceDto;
  readonly materializedRefs: readonly BinaryAssetReferenceDto[];
}): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: PACKAGE_ID,
      packageDisplayName: "Wave47 PSD Batch Materialized Asset",
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
            partId: PARENT_PART_ID,
            displayName: "Imported PSD Layers",
            childPartIds: LAYER_FIXTURES.map((layer) => layer.partId),
            drawableIds: []
          },
          ...LAYER_FIXTURES.map((layer) => ({
            partId: layer.partId,
            displayName: layer.displayName,
            parentPartId: PARENT_PART_ID,
            childPartIds: [],
            drawableIds: [layer.drawableId]
          }))
        ],
        rigControlRootIds: [],
        stableOrder: [
          PARENT_PART_ID,
          ...LAYER_FIXTURES.flatMap((layer) => [
            layer.partId,
            layer.drawableId,
            layer.meshId
          ])
        ]
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: LAYER_FIXTURES.map((layer) => ({
          drawableId: layer.drawableId,
          displayName: layer.displayName,
          partId: layer.partId,
          sourceAssetId: SOURCE_ASSET_ID,
          textureId: layer.textureId,
          meshId: layer.meshId,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: layer.materializedProvenanceId
        }))
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: LAYER_FIXTURES.map((layer) => ({
          meshId: layer.meshId,
          drawableId: layer.drawableId,
          vertices: [
            { x: 0, y: 0 },
            { x: layer.width, y: 0 },
            { x: 0, y: layer.height }
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
            width: layer.width,
            height: layer.height
          },
          generationProvenanceId: layer.materializedProvenanceId
        }))
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
        entries: LAYER_FIXTURES.map((layer, index) => ({
          drawableId: layer.drawableId,
          baseDrawOrder: index,
          stableOrder: index
        }))
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
            layers: LAYER_FIXTURES.map((layer) => ({
              sourceLayerId: layer.sourceLayerId,
              sourceAssetId: SOURCE_ASSET_ID,
              originalName: layer.originalName,
              normalizedName: layer.normalizedName,
              groupPath: layer.groupPath,
              bounds: {
                x: 0,
                y: 0,
                width: layer.width,
                height: layer.height
              },
              visibleInSource: true,
              opacityInSource: 1,
              role: "editableLayer",
              unsupportedFeatures: [],
              mappedDrawableIds: [layer.drawableId]
            })),
            diagnostics: [],
            psdProfile: {
              schemaVersion: "layered-character-psd-profile-v1",
              adapter: {
                adapterName: "wave47-browser-explicit-psd-batch-import-adapter",
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
              sourceLayers: LAYER_FIXTURES.map((layer, sourceOrder) => ({
                sourceLayerId: layer.sourceLayerId,
                originalName: layer.originalName,
                normalizedName: layer.normalizedName,
                groupPath: layer.groupPath,
                sourceOrder,
                bounds: {
                  x: 0,
                  y: 0,
                  width: layer.width,
                  height: layer.height
                },
                visibleInSource: true,
                opacityInSource: 1,
                role: "editableLayer",
                unsupportedFeatures: [],
                textureId: layer.textureId,
                targetPartId: layer.partId
              })),
              unsupportedFeatures: [],
              diagnostics: [],
              layerTreeEvidence: {
                evidenceKind: "psd-layer-tree-evidence-v1",
                evidenceId: "layerTree_wave47Batch",
                intakeKind: "realPsdParseResult",
                groupCount: 0,
                layerCount: LAYER_FIXTURES.length,
                maxDepth: 2,
                parser: createParserEvidence(),
                privateShapePolicy: "parser-private-shape-excluded-v1"
              },
              materializationEvidence: LAYER_FIXTURES.map((layer, index) =>
                createMaterializationEvidence(layer, input.sourceRef, input.materializedRefs[index]!)
              ),
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
        textures: LAYER_FIXTURES.map((layer, index) => {
          const ref = input.materializedRefs[index]!;
          return {
            textureId: layer.textureId,
            filePath: ref.packageRelativePath,
            contentHash: `${ref.digest.algorithm}:${ref.digest.hex}`,
            sourceAssetId: SOURCE_ASSET_ID,
            sourceLayerId: layer.sourceLayerId,
            provenanceId: layer.materializedProvenanceId,
            binaryAssetRef: ref
          };
        }),
        previewAssets: LAYER_FIXTURES.map((layer, index) => {
          const ref = input.materializedRefs[index]!;
          return {
            previewAssetId: `preview_wave47_${layer.normalizedName}`,
            textureId: layer.textureId,
            reference: {
              referenceKind: "package-local-file-v1",
              filePath: ref.packageRelativePath
            },
            contentHash: `${ref.digest.algorithm}:${ref.digest.hex}`,
            sourceAssetId: SOURCE_ASSET_ID,
            sourceLayerId: layer.sourceLayerId,
            provenanceId: layer.materializedProvenanceId,
            rightsAssetId: SOURCE_ASSET_ID
          };
        })
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
          ...LAYER_FIXTURES.map((layer, index) => {
            const ref = input.materializedRefs[index]!;
            return {
              provenanceId: layer.materializedProvenanceId,
              assetId: SOURCE_ASSET_ID,
              assetKind: "texture",
              filePath: ref.packageRelativePath,
              contentHash: `${ref.digest.algorithm}:${ref.digest.hex}`,
              creator: "validator-test",
              license: "private-local-selected-psd-layer",
              redistributionAllowed: false,
              aiUsed: false,
              transformHistory: [
                "importPsdLayerMaterializationBatch:selected-layer-raw-rgba"
              ],
              relatedOperationIds: ["op_wave47_psd_batch"]
            };
          })
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

const createMaterializationEvidence = (
  layer: typeof LAYER_FIXTURES[number],
  sourceRef: BinaryAssetReferenceDto,
  materializedRef: BinaryAssetReferenceDto
) => ({
  evidenceKind: "psd-layer-materialization-evidence-v1" as const,
  materializationId: layer.materializationId,
  sourceLayerRef: createSourceLayerRef(layer),
  mediaType: RAW_RGBA_MEDIA_TYPE,
  byteLength: materializedRef.byteLength,
  digest: materializedRef.digest,
  width: layer.width,
  height: layer.height,
  binaryAssetRef: materializedRef,
  textureId: layer.textureId,
  provenance: {
    sourceFilePath: "test_data/sample_model.psd",
    sourceDigest: sourceRef.digest,
    sourceByteLength: sourceRef.byteLength,
    sourceMediaType: sourceRef.mediaType,
    privacyLabel: "packageLocalAsset" as const,
    publicDistribution: "notPublicDistributable" as const,
    generatedBy: "wave47.browserSelectedLayerBatchMaterialization",
    publicDemoAsset: false
  },
  parser: createParserEvidence(),
  extraction: createExtractionEvidence(layer)
});

const createBatchEvidence = (
  materializedRefs: readonly BinaryAssetReferenceDto[]
) => ({
  schemaVersion: "psd-layer-materialization-batch-operation-evidence-v1" as const,
  operationType: "importPsdLayerMaterializationBatch" as const,
  batchId: "batch_wave47HeadwearEyewear",
  sourceAssetId: SOURCE_ASSET_ID,
  destination: {
    destinationKind: "generatedPartScaffold" as const,
    parentPartId: PARENT_PART_ID
  },
  aggregateStatus: "success" as const,
  selectedLayerCount: LAYER_FIXTURES.length,
  successCount: LAYER_FIXTURES.length,
  failureCount: 0,
  totalMaterializedByteLength: materializedRefs.reduce((sum, ref) => sum + ref.byteLength, 0),
  entries: LAYER_FIXTURES.map((layer, selectedIndex) => ({
    selectedIndex,
    sourceLayerRef: createSourceLayerRef(layer),
    materializationId: layer.materializationId,
    materializedByteLength: materializedRefs[selectedIndex]!.byteLength,
    status: "success" as const,
    generated: {
      partId: layer.partId,
      partDisplayName: layer.displayName,
      drawableId: layer.drawableId,
      drawableDisplayName: layer.displayName,
      textureId: layer.textureId,
      meshId: layer.meshId
    },
    operationId: `op_wave47_batch_${selectedIndex}`,
    diagnostics: []
  })),
  perLayerOperationIds: LAYER_FIXTURES.map((_, index) => `op_wave47_batch_${index}`),
  preflightPolicy: {
    selectedLayerLimit: 4,
    totalRawRgbaByteLimit: 32 * 1024 * 1024,
    mutationPolicy: "preflightBlocksOnAnyFailure" as const,
    silentPartialSuccess: "forbidden" as const
  },
  persistenceBoundary: {
    rawParserObjectPersistence: "notPersisted" as const,
    sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
    materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes" as const,
    photoshopCompositingClaim: "none" as const,
    rendererPixelOracleClaim: "none" as const
  }
});

const createSourceLayerRef = (layer: typeof LAYER_FIXTURES[number]) => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceLayerId: layer.sourceLayerId,
  sourceLayerName: layer.originalName,
  sourceLayerPath: [...layer.groupPath, layer.originalName]
});

const createParserEvidence = () => ({
  evidenceKind: "psd-parser-evidence-v1" as const,
  parserName: "@webtoon/psd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: "wave47-browser-explicit-psd-batch-import-adapter",
  adapterVersion: "0.1.0",
  runtime: "browser" as const,
  privateShapePolicy: "parser-private-shape-excluded-v1" as const
});

const createExtractionEvidence = (layer: typeof LAYER_FIXTURES[number]) => ({
  extractionKind: "selectedLayerRasterV1" as const,
  optionsSchemaVersion: "psd-layer-extraction-options-v1" as const,
  options: {
    channelOrder: "rgba",
    includeEffects: false,
    includeHiddenLayers: false,
    composeWithOtherLayers: false,
    layerSelection: layer.sourceLayerId
  }
});

const expectSourceAsset = (document: PackageDocumentDto) => {
  const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
  if (sourceAsset === undefined) {
    throw new Error("Expected source asset.");
  }

  return sourceAsset;
};

const expectMaterialization = (document: PackageDocumentDto, index: number) => {
  const materialization = expectSourceAsset(document).psdProfile?.materializationEvidence?.[index];
  if (materialization === undefined) {
    throw new Error(`Expected materialization evidence ${index}.`);
  }

  return materialization;
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

const clone = <TValue>(value: TValue): TValue =>
  JSON.parse(JSON.stringify(value)) as TValue;
