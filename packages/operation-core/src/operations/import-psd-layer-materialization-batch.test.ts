import {
  createInitialAuthoringRevision,
  getDrawableById,
  getPartById,
  getTextureAtlasEntryById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  OperationIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { getOperationHandler } from "../operation-registry.js";
import { OperationRequestSchema, type OperationRequestDto } from "../operation-request.js";
import {
  importPsdLayerMaterializationBatchOperationHandler
} from "./import-psd-layer-materialization-batch.js";
import { PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE } from "../psd-layer-materialization-operation-evidence.js";

describe("importPsdLayerMaterializationBatch operation handler", () => {
  it("connects multiple selected PSD layer materializations to generated part scaffold", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-06T00:00:00.000Z")
    });
    const request = createBatchRequest({
      entries: [
        createMaterializationEvidence(FACE_LAYER),
        createMaterializationEvidence(HAIR_FRONT_LAYER)
      ]
    });

    const outcome = core.commitOperation(session, request);

    expect(getOperationHandler("importPsdLayerMaterializationBatch")).toBe(
      importPsdLayerMaterializationBatchOperationHandler
    );
    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.childPartIds).toEqual([
      "part_face",
      "part_hair_front"
    ]);
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toMatchObject({
      partId: "part_face",
      displayName: "Face",
      parentPartId: "part_root",
      drawableIds: ["draw_face"]
    });
    expect(getPartById(session.graph, PartIdSchema.parse("part_hair_front"))).toMatchObject({
      partId: "part_hair_front",
      displayName: "Hair / Front",
      parentPartId: "part_root",
      drawableIds: ["draw_hair_front"]
    });
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_hair_front"))).toMatchObject({
      drawableId: "draw_hair_front",
      displayName: "Hair / Front",
      partId: "part_hair_front",
      textureId: "tex_hair_front",
      meshId: "mesh_hair_front",
      sourceAssetId: "src_psd_character"
    });
    expect(getTextureAtlasEntryById(session.graph, TextureIdSchema.parse("tex_face"))).toMatchObject({
      textureId: "tex_face",
      sourceLayerId: "layer_face",
      binaryAssetRef: expect.objectContaining({
        binaryAssetId: "bin_psd_face_rgba",
        mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE
      })
    });
    expect(getTextureAtlasEntryById(session.graph, TextureIdSchema.parse("tex_hair_front"))).toMatchObject({
      textureId: "tex_hair_front",
      sourceLayerId: "layer_hair_front",
      binaryAssetRef: expect.objectContaining({
        binaryAssetId: "bin_psd_hair_front_rgba",
        byteLength: 64
      })
    });
    expect(outcome.result.psdLayerMaterializationEvidence).toHaveLength(2);
    expect(outcome.result.psdLayerMaterializationBatchEvidence?.[0]).toMatchObject({
      schemaVersion: "psd-layer-materialization-batch-operation-evidence-v1",
      operationType: "importPsdLayerMaterializationBatch",
      batchId: "batch_face_hair",
      sourceAssetId: "src_psd_character",
      destination: {
        destinationKind: "generatedPartScaffold",
        parentPartId: "part_root"
      },
      aggregateStatus: "success",
      selectedLayerCount: 2,
      successCount: 2,
      failureCount: 0,
      totalMaterializedByteLength: 80,
      entries: [
        {
          selectedIndex: 0,
          status: "success",
          sourceLayerRef: expect.objectContaining({ sourceLayerId: "layer_face" }),
          generated: {
            partId: "part_face",
            partDisplayName: "Face",
            drawableId: "draw_face",
            drawableDisplayName: "Face",
            textureId: "tex_face",
            meshId: "mesh_face"
          }
        },
        {
          selectedIndex: 1,
          status: "success",
          sourceLayerRef: expect.objectContaining({ sourceLayerId: "layer_hair_front" }),
          generated: {
            partId: "part_hair_front",
            partDisplayName: "Hair / Front",
            drawableId: "draw_hair_front",
            drawableDisplayName: "Hair / Front",
            textureId: "tex_hair_front",
            meshId: "mesh_hair_front"
          }
        }
      ],
      preflightPolicy: {
        selectedLayerLimit: 4,
        totalRawRgbaByteLimit: 33554432,
        mutationPolicy: "preflightBlocksOnAnyFailure",
        silentPartialSuccess: "forbidden"
      },
      persistenceBoundary: {
        rawParserObjectPersistence: "notPersisted",
        sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
        materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes"
      }
    });
    expect(outcome.logEntry?.result.psdLayerMaterializationBatchEvidence).toEqual(
      outcome.result.psdLayerMaterializationBatchEvidence
    );
    expect(JSON.stringify(outcome.result.psdLayerMaterializationBatchEvidence)).not.toContain("rawRgba");
    expect(JSON.stringify(outcome.result.psdLayerMaterializationBatchEvidence)).not.toContain("rawLayerObject");
    expect(JSON.stringify(outcome.result.psdLayerMaterializationBatchEvidence)).not.toContain("sourcePsdBytes");
  });

  it("rejects duplicate layer refs before mutating the session", () => {
    const session = createFixtureSession();
    const request = createBatchRequest({
      entries: [
        createMaterializationEvidence(FACE_LAYER),
        createMaterializationEvidence(FACE_LAYER)
      ]
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importPsdLayerMaterializationBatch.duplicateLayerRef"
    );
    expect(outcome.result.psdLayerMaterializationBatchEvidence?.[0]).toMatchObject({
      aggregateStatus: "preflightBlocked",
      successCount: 0,
      entries: [
        { selectedIndex: 0, status: "preflightReady" },
        { selectedIndex: 1, status: "preflightBlocked" }
      ]
    });
    expect(session.packageRevision).toBe(0);
    expect(session.graph.textureAtlas).toBeUndefined();
    expect(session.graph.drawables).toHaveLength(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.childPartIds).toEqual([]);
  });

  it("rejects generated id and display-name collisions before mutating the session", () => {
    const session = createFixtureSession();
    const request = createBatchRequest({
      entries: [
        createMaterializationEvidence(ACCESSORY_A_LAYER),
        createMaterializationEvidence(ACCESSORY_B_LAYER)
      ]
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdLayerMaterializationBatch.duplicateGeneratedId",
        "operation.importPsdLayerMaterializationBatch.idNameCollision"
      ])
    );
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).not.toContain(
      "operation.importPsdLayerMaterializationBatch.duplicateLayerRef"
    );
    expect(session.graph.parts.map((part) => part.partId)).toEqual(["part_root"]);
    expect(session.graph.drawables).toHaveLength(0);
  });

  it("rejects stale, mismatched, or missing materialized byte evidence without partial mutation", () => {
    const session = createFixtureSession();
    const request = createBatchRequest({
      entries: [
        createMaterializationEvidence(FACE_LAYER),
        createMaterializationEvidence(HAIR_FRONT_LAYER, {
          mediaType: "image/png",
          sourceDigest: OTHER_DIGEST,
          binaryAssetRef: createTextureBinaryAssetReference(HAIR_FRONT_LAYER, {
            digest: MATERIALIZED_HAIR_DIGEST,
            byteLength: 16,
            mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
            storageStatus: "missing-package-local-bytes-v1"
          })
        })
      ]
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdLayerMaterialization.unsupportedMaterializedMediaType",
        "operation.importPsdLayerMaterialization.sourcePsdDigestMismatch",
        "operation.importPsdLayerMaterialization.materializedBinaryAssetRefMismatch",
        "operation.importPsdLayerMaterialization.materializedBytesUnavailable"
      ])
    );
    expect(outcome.result.psdLayerMaterializationBatchEvidence?.[0]?.entries).toEqual([
      expect.objectContaining({ selectedIndex: 0, status: "preflightReady" }),
      expect.objectContaining({ selectedIndex: 1, status: "preflightBlocked" })
    ]);
    expect(session.packageRevision).toBe(0);
    expect(session.graph.textureAtlas).toBeUndefined();
    expect(session.graph.drawables).toHaveLength(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.childPartIds).toEqual([]);
  });

  it("rejects an invalid destination parent before mutating the session", () => {
    const session = createFixtureSession();
    const request = createBatchRequest({
      parentPartId: "part_missing",
      entries: [
        createMaterializationEvidence(FACE_LAYER),
        createMaterializationEvidence(HAIR_FRONT_LAYER)
      ]
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importPsdLayerMaterializationBatch.missingDestinationParentPart"
    );
    expect(outcome.result.psdLayerMaterializationBatchEvidence?.[0]).toMatchObject({
      aggregateStatus: "preflightBlocked",
      failureCount: 2,
      entries: [
        { selectedIndex: 0, status: "preflightBlocked" },
        { selectedIndex: 1, status: "preflightBlocked" }
      ]
    });
    expect(session.packageRevision).toBe(0);
    expect(session.graph.parts.map((part) => part.partId)).toEqual(["part_root"]);
  });
});

const createBatchRequest = (options: {
  readonly entries: readonly ReturnType<typeof createMaterializationEvidence>[];
  readonly parentPartId?: string;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_import_psd_batch",
    actor: "importer",
    surface: "structuredApi",
    dryRun: false,
    basePackageRevision: 0,
    operationType: "importPsdLayerMaterializationBatch",
    payload: {
      sourceAssetId: "src_psd_character",
      batchId: "batch_face_hair",
      destination: {
        destinationKind: "generatedPartScaffold",
        parentPartId: options.parentPartId ?? "part_root"
      },
      entries: options.entries.map((materialization) => ({ materialization })),
      lockedTargetIds: []
    }
  });

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_import_psd_layer_materialization_batch_test"),
    packageDisplayName: "Import PSD Layer Materialization Batch Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 2048, height: 3072 },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: []
      }
    ],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [
      {
        sourceAssetId: SourceAssetIdSchema.parse("src_psd_character"),
        kind: "psd-source-v1",
        filePath: "assets/sources/private/source.psd",
        contentHash: `sha256:${SOURCE_PSD_DIGEST.hex}`,
        importProfile: "layered-character-psd-profile-v1",
        layers: [
          createSourceLayer(FACE_LAYER),
          createSourceLayer(HAIR_FRONT_LAYER),
          createSourceLayer(ACCESSORY_A_LAYER),
          createSourceLayer(ACCESSORY_B_LAYER)
        ],
        diagnostics: [],
        binaryAssetRef: createSourceBinaryAssetReference(),
        psdProfile: {
          schemaVersion: "layered-character-psd-profile-v1",
          adapter: {
            adapterName: "fixture-browser-psd-adapter",
            adapterVersion: "0.0.0",
            adapterResultSchemaVersion: "psd-adapter-result-v1",
            sourceProfile: "layered-character-psd-profile-v1",
            evidenceKind: "real-psd-parse-result-v1",
            intakeKind: "realPsdParseResult",
            parser: PSD_PARSER_EVIDENCE
          },
          canvas: {
            width: 2048,
            height: 3072
          },
          sourceGroups: [],
          sourceLayers: [],
          unsupportedFeatures: [],
          diagnostics: [],
          compatibility: {
            structuredProfilePrecedence: "structured-profile-preferred-v1",
            flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
            flattenedUnsupportedFeaturesFallback:
              "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
          }
        }
      }
    ],
    provenanceRecords: [
      {
        provenanceId: ProvenanceIdSchema.parse("prov_import_psd_source"),
        assetId: "src_psd_character",
        assetKind: "source",
        filePath: "assets/sources/private/source.psd",
        contentHash: `sha256:${SOURCE_PSD_DIGEST.hex}`,
        creator: "fixture artist",
        license: "private-local",
        redistributionAllowed: false,
        aiUsed: false,
        transformHistory: ["fixture-source-psd"],
        relatedOperationIds: [OperationIdSchema.parse("op_import_psd_source")]
      }
    ],
    rightsRecords: [
      {
        assetId: "src_psd_character",
        rightsStatus: "cleared",
        license: "private-local",
        redistributionAllowed: false
      }
    ]
  }
});

const createSourceLayer = (layer: LayerFixture) => ({
  sourceLayerId: layer.sourceLayerId,
  sourceAssetId: SourceAssetIdSchema.parse("src_psd_character"),
  originalName: layer.sourceLayerName,
  normalizedName: layer.sourceLayerName.toLowerCase(),
  groupPath: [...layer.groupPath],
  bounds: layer.bounds,
  visibleInSource: true,
  opacityInSource: 1,
  role: "editableLayer" as const,
  unsupportedFeatures: [],
  mappedDrawableIds: []
});

const createMaterializationEvidence = (
  layer: LayerFixture,
  overrides: MaterializationOverrides = {}
) => ({
  evidenceKind: "psd-layer-materialization-evidence-v1",
  materializationId: layer.materializationId,
  sourceLayerRef: {
    sourceAssetId: "src_psd_character",
    sourceLayerId: layer.sourceLayerId,
    sourceLayerName: layer.sourceLayerName,
    sourceLayerPath: [...layer.sourceLayerPath]
  },
  mediaType: overrides.mediaType ?? PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  byteLength: layer.byteLength,
  digest: layer.digest,
  width: layer.width,
  height: layer.height,
  binaryAssetRef: overrides.binaryAssetRef ?? createTextureBinaryAssetReference(layer),
  provenance: {
    sourceFilePath: "private/source.psd",
    sourceDigest: overrides.sourceDigest ?? SOURCE_PSD_DIGEST,
    sourceByteLength: SOURCE_PSD_BYTE_LENGTH,
    sourceMediaType: "image/vnd.adobe.photoshop",
    privacyLabel: "packageLocalAsset",
    publicDistribution: "notPublicDistributable",
    publicDemoAsset: false
  },
  parser: PSD_PARSER_EVIDENCE,
  extraction: {
    extractionKind: "selectedLayerRasterV1",
    optionsSchemaVersion: "psd-layer-extraction-options-v1",
    options: {
      channelOrder: "rgba",
      includeEffects: false,
      includeHiddenLayers: false,
      composeWithOtherLayers: false,
      layerSelection: layer.sourceLayerId
    }
  }
} as const);

const createSourceBinaryAssetReference = () => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_psd_character_source",
  packageRelativePath: "assets/sources/private/source.psd",
  digest: SOURCE_PSD_DIGEST,
  byteLength: SOURCE_PSD_BYTE_LENGTH,
  mediaType: "image/vnd.adobe.photoshop",
  storageStatus: "stored-package-local-v1",
  provenanceId: ProvenanceIdSchema.parse("prov_import_psd_source"),
  rightsAssetId: "src_psd_character"
} as const);

const createTextureBinaryAssetReference = (
  layer: LayerFixture,
  overrides: BinaryReferenceOverrides = {}
) => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: layer.binaryAssetId,
  packageRelativePath: layer.packageRelativePath,
  digest: overrides.digest ?? layer.digest,
  byteLength: overrides.byteLength ?? layer.byteLength,
  mediaType: overrides.mediaType ?? PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  storageStatus: overrides.storageStatus ?? "stored-package-local-v1",
  provenanceId: ProvenanceIdSchema.parse(layer.provenanceId),
  rightsAssetId: "src_psd_character"
} as const);

type LayerFixture = {
  readonly sourceLayerId: string;
  readonly sourceLayerName: string;
  readonly groupPath: readonly string[];
  readonly sourceLayerPath: readonly string[];
  readonly materializationId: string;
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly provenanceId: string;
  readonly width: number;
  readonly height: number;
  readonly byteLength: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly digest: FixtureDigest;
};

type MaterializationOverrides = {
  readonly mediaType?: string;
  readonly sourceDigest?: FixtureDigest;
  readonly binaryAssetRef?: ReturnType<typeof createTextureBinaryAssetReference>;
};

type BinaryReferenceOverrides = {
  readonly digest?: FixtureDigest;
  readonly byteLength?: number;
  readonly mediaType?: string;
  readonly storageStatus?:
    | "stored-package-local-v1"
    | "missing-package-local-bytes-v1"
    | "storage-unsupported-v1";
};

const FACE_LAYER: LayerFixture = {
  sourceLayerId: "layer_face",
  sourceLayerName: "Face",
  groupPath: [],
  sourceLayerPath: ["Face"],
  materializationId: "mat_selectedFace",
  binaryAssetId: "bin_psd_face_rgba",
  packageRelativePath: "assets/textures/psd/face.raw-rgba",
  provenanceId: "prov_psd_face_rgba",
  width: 2,
  height: 2,
  byteLength: 16,
  bounds: { x: 320, y: 240, width: 2, height: 2 },
  digest: {
    algorithm: "sha256",
    hex: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
  }
};

const HAIR_FRONT_LAYER: LayerFixture = {
  sourceLayerId: "layer_hair_front",
  sourceLayerName: "Front",
  groupPath: ["Hair"],
  sourceLayerPath: ["Hair", "Front"],
  materializationId: "mat_selectedHairFront",
  binaryAssetId: "bin_psd_hair_front_rgba",
  packageRelativePath: "assets/textures/psd/hair-front.raw-rgba",
  provenanceId: "prov_psd_hair_front_rgba",
  width: 4,
  height: 4,
  byteLength: 64,
  bounds: { x: 400, y: 100, width: 4, height: 4 },
  digest: {
    algorithm: "sha256",
    hex: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  }
};

const ACCESSORY_A_LAYER: LayerFixture = {
  sourceLayerId: "layer_accessory_a",
  sourceLayerName: "Accessory",
  groupPath: [],
  sourceLayerPath: ["Accessory"],
  materializationId: "mat_selectedAccessoryA",
  binaryAssetId: "bin_psd_accessory_a_rgba",
  packageRelativePath: "assets/textures/psd/accessory-a.raw-rgba",
  provenanceId: "prov_psd_accessory_a_rgba",
  width: 2,
  height: 2,
  byteLength: 16,
  bounds: { x: 0, y: 0, width: 2, height: 2 },
  digest: {
    algorithm: "sha256",
    hex: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
  }
};

const ACCESSORY_B_LAYER: LayerFixture = {
  sourceLayerId: "layer_accessory_b",
  sourceLayerName: "Accessory",
  groupPath: [],
  sourceLayerPath: ["Accessory"],
  materializationId: "mat_selectedAccessoryB",
  binaryAssetId: "bin_psd_accessory_b_rgba",
  packageRelativePath: "assets/textures/psd/accessory-b.raw-rgba",
  provenanceId: "prov_psd_accessory_b_rgba",
  width: 2,
  height: 2,
  byteLength: 16,
  bounds: { x: 8, y: 8, width: 2, height: 2 },
  digest: {
    algorithm: "sha256",
    hex: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
  }
};

const SOURCE_PSD_DIGEST = {
  algorithm: "sha256",
  hex: "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5"
} as const;
const SOURCE_PSD_BYTE_LENGTH = 22406225;
const MATERIALIZED_HAIR_DIGEST = HAIR_FRONT_LAYER.digest;
const OTHER_DIGEST = {
  algorithm: "sha256",
  hex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
} as const;
const PSD_PARSER_EVIDENCE = {
  evidenceKind: "psd-parser-evidence-v1",
  parserName: "webtoonPsd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: "fixture-browser-psd-adapter",
  adapterVersion: "0.0.0",
  runtime: "browser",
  privateShapePolicy: "parser-private-shape-excluded-v1"
} as const;

type FixtureDigest = {
  readonly algorithm: "sha256";
  readonly hex: string;
};
