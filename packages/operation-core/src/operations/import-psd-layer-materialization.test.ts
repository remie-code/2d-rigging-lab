import {
  createInitialAuthoringRevision,
  getDrawableById,
  getPartById,
  getSourceAssetById,
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
  importPsdLayerMaterializationOperationHandler
} from "./import-psd-layer-materialization.js";
import { PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE } from "../psd-layer-materialization-operation-evidence.js";

describe("importPsdLayerMaterialization operation handler", () => {
  it("connects selected PSD layer materialization to an existing part, texture, and drawable", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-06-05T01:00:00.000Z")
    });
    const request = createImportMaterializationRequest({
      dryRun: false,
      destinationPart: {
        destinationKind: "existingPart",
        partId: "part_root"
      }
    });

    const outcome = core.commitOperation(session, request);

    expect(getOperationHandler("importPsdLayerMaterialization")).toBe(
      importPsdLayerMaterializationOperationHandler
    );
    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(getTextureAtlasEntryById(session.graph, TextureIdSchema.parse("tex_face_rgba"))).toMatchObject({
      textureId: "tex_face_rgba",
      filePath: "assets/textures/psd/face.raw-rgba",
      sourceAssetId: "src_psd_character",
      sourceLayerId: "layer_face",
      provenanceId: "prov_psd_face_rgba",
      binaryAssetRef: expect.objectContaining({
        binaryAssetId: "bin_psd_face_rgba",
        mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
        byteLength: 16
      })
    });
    expect(session.graph.textureAtlas?.previewAssets?.[0]).toMatchObject({
      textureId: "tex_face_rgba",
      reference: {
        referenceKind: "package-local-file-v1",
        filePath: "assets/textures/psd/face.raw-rgba"
      },
      sourceAssetId: "src_psd_character",
      sourceLayerId: "layer_face",
      provenanceId: "prov_psd_face_rgba",
      rightsAssetId: "src_psd_character"
    });
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_face_materialized"))).toMatchObject({
      drawableId: "draw_face_materialized",
      displayName: "Face Materialized",
      partId: "part_root",
      sourceAssetId: "src_psd_character",
      textureId: "tex_face_rgba",
      meshId: "mesh_face_materialized",
      defaultOpacity: 0.42,
      sourceProvenanceId: "prov_psd_face_rgba"
    });
    expect(session.graph.meshes[0]).toMatchObject({
      meshId: "mesh_face_materialized",
      drawableId: "draw_face_materialized",
      bounds: { x: 320, y: 240, width: 512, height: 512 },
      generationProvenanceId: "prov_psd_face_rgba"
    });
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.drawableIds).toEqual([
      "draw_face_materialized"
    ]);
    expect(
      getSourceAssetById(session.graph, SourceAssetIdSchema.parse("src_psd_character"))?.layers[0]
        ?.mappedDrawableIds
    ).toEqual(["draw_face_materialized"]);
    expect(session.graph.provenanceRecords).toEqual(expect.arrayContaining([
      expect.objectContaining({
        provenanceId: "prov_psd_face_rgba",
        assetKind: "texture",
        filePath: "assets/textures/psd/face.raw-rgba",
        redistributionAllowed: false,
        transformHistory: expect.arrayContaining([
          "importPsdLayerMaterialization:selected-layer-raw-rgba",
          "sourceLayer:layer_face:Face",
          "materialization:mat_selectedFace"
        ])
      })
    ]));
    expect(outcome.result.psdLayerMaterializationEvidence?.[0]).toMatchObject({
      schemaVersion: "psd-layer-materialization-operation-evidence-v1",
      operationType: "importPsdLayerMaterialization",
      sourceAssetId: "src_psd_character",
      sourceLayerRef: {
        sourceAssetId: "src_psd_character",
        sourceLayerId: "layer_face",
        sourceLayerName: "Face"
      },
      sourcePsd: {
        digest: SOURCE_PSD_DIGEST,
        byteLength: SOURCE_PSD_BYTE_LENGTH,
        mediaType: "image/vnd.adobe.photoshop"
      },
      materializedAsset: {
        mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
        byteLength: 16,
        width: 2,
        height: 2,
        provenance: expect.objectContaining({
          privacyLabel: "packageLocalAsset",
          publicDistribution: "notPublicDistributable",
          publicDemoAsset: false
        }),
        parser: expect.objectContaining({
          parserName: "webtoonPsd",
          parserVersion: "0.4.0",
          runtime: "browser"
        }),
        extraction: expect.objectContaining({
          extractionKind: "selectedLayerRasterV1"
        })
      },
      materializedByteStorage: "packageLocalBinaryAssetRef",
      destination: {
        destinationKind: "existingPart",
        partId: "part_root",
        textureId: "tex_face_rgba",
        drawableId: "draw_face_materialized",
        meshId: "mesh_face_materialized"
      },
      mapping: {
        sourceLayerId: "layer_face",
        textureId: "tex_face_rgba",
        drawableId: "draw_face_materialized",
        partId: "part_root"
      },
      persistenceBoundary: {
        rawParserObjectPersistence: "notPersisted",
        materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
        photoshopCompositingClaim: "none",
        rendererPixelOracleClaim: "none"
      }
    });
    expect(outcome.logEntry?.result.psdLayerMaterializationEvidence).toEqual(
      outcome.result.psdLayerMaterializationEvidence
    );
    expect(JSON.stringify(outcome.result.psdLayerMaterializationEvidence)).not.toContain("rawRgba");
    expect(JSON.stringify(outcome.result.psdLayerMaterializationEvidence)).not.toContain("rawLayerObject");
  });

  it("creates a new destination part before connecting the materialized layer drawable", () => {
    const session = createFixtureSession();
    const request = createImportMaterializationRequest({
      dryRun: false,
      destinationPart: {
        destinationKind: "newPart",
        partId: "part_face",
        displayName: "Face",
        parentPartId: "part_root"
      },
      drawableDisplayName: "Face From PSD"
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("committed");
    expect(getPartById(session.graph, PartIdSchema.parse("part_face"))).toMatchObject({
      partId: "part_face",
      displayName: "Face",
      parentPartId: "part_root",
      drawableIds: ["draw_face_from_psd"]
    });
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.childPartIds).toEqual([
      "part_face"
    ]);
    expect(outcome.result.psdLayerMaterializationEvidence?.[0]?.destination).toMatchObject({
      destinationKind: "newPart",
      partId: "part_face",
      drawableId: "draw_face_from_psd"
    });
  });

  it("rejects stale or missing materialized byte evidence before mutating the session", () => {
    const session = createFixtureSession();
    const request = createImportMaterializationRequest({
      dryRun: false,
      destinationPart: {
        destinationKind: "existingPart",
        partId: "part_root"
      },
      materializationOverrides: {
        digest: OTHER_DIGEST,
        provenance: {
          sourceDigest: OTHER_DIGEST
        },
        binaryAssetRef: createTextureBinaryAssetReference({
          digest: MATERIALIZED_DIGEST,
          storageStatus: "missing-package-local-bytes-v1"
        })
      }
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdLayerMaterialization.sourcePsdDigestMismatch",
        "operation.importPsdLayerMaterialization.materializedBinaryAssetRefMismatch",
        "operation.importPsdLayerMaterialization.materializedBytesUnavailable"
      ])
    );
    expect(session.graph.textureAtlas).toBeUndefined();
    expect(session.graph.drawables).toHaveLength(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.drawableIds).toEqual([]);
  });

  it("rejects non-selected-layer or non-canonical extraction evidence", () => {
    const session = createFixtureSession();
    const request = createImportMaterializationRequest({
      dryRun: false,
      destinationPart: {
        destinationKind: "existingPart",
        partId: "part_root"
      },
      materializationOverrides: {
        extraction: {
          extractionKind: "texturePreviewRasterV1",
          optionsSchemaVersion: "psd-layer-extraction-options-v1",
          options: {
            channelOrder: "rgba",
            includeEffects: true,
            includeHiddenLayers: false,
            composeWithOtherLayers: true,
            layerSelection: "layer_shadow"
          }
        }
      }
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdLayerMaterialization.unsupportedExtractionKind",
        "operation.importPsdLayerMaterialization.extractionOptionMismatch"
      ])
    );
    expect(session.graph.textureAtlas).toBeUndefined();
    expect(session.graph.drawables).toHaveLength(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.drawableIds).toEqual([]);
  });

  it("rejects source digest mismatch from source contentHash when no source binary ref exists", () => {
    const session = createFixtureSession({ includeSourceBinaryAssetRef: false });
    const request = createImportMaterializationRequest({
      dryRun: false,
      destinationPart: {
        destinationKind: "existingPart",
        partId: "part_root"
      },
      materializationOverrides: {
        provenance: {
          sourceDigest: OTHER_DIGEST
        }
      }
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdLayerMaterialization.sourcePsdDigestMismatch"
      ])
    );
    expect(session.graph.textureAtlas).toBeUndefined();
    expect(session.graph.drawables).toHaveLength(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.drawableIds).toEqual([]);
  });

  it("rejects source layer path mismatch even when the final layer name matches", () => {
    const session = createFixtureSession();
    const request = createImportMaterializationRequest({
      dryRun: false,
      destinationPart: {
        destinationKind: "existingPart",
        partId: "part_root"
      },
      materializationOverrides: {
        sourceLayerPath: ["Root", "Body", "Face"]
      }
    });

    const outcome = createOperationCore().commitOperation(session, request);

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdLayerMaterialization.sourceLayerPathMismatch"
      ])
    );
    expect(session.graph.textureAtlas).toBeUndefined();
    expect(session.graph.drawables).toHaveLength(0);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))?.drawableIds).toEqual([]);
  });
});

const createImportMaterializationRequest = (options: {
  readonly dryRun: boolean;
  readonly destinationPart:
    | {
        readonly destinationKind: "existingPart";
        readonly partId: string;
      }
    | {
        readonly destinationKind: "newPart";
        readonly partId?: string;
        readonly displayName: string;
        readonly parentPartId?: string;
      };
  readonly drawableDisplayName?: string;
  readonly materializationOverrides?: MaterializationOverrides;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_import_psd_layer_materialization",
    actor: "importer",
    surface: "structuredApi",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "importPsdLayerMaterialization",
    payload: {
      sourceAssetId: "src_psd_character",
      materialization: createMaterializationEvidence(options.materializationOverrides),
      drawableDisplayName: options.drawableDisplayName ?? "Face Materialized",
      destinationPart: options.destinationPart,
      lockedTargetIds: []
    }
  });

type MaterializationOverrides = {
  readonly digest?: FixtureDigest;
  readonly sourceLayerPath?: readonly string[];
  readonly provenance?: {
    readonly sourceDigest?: FixtureDigest;
  };
  readonly extraction?: ReturnType<typeof createSelectedLayerExtractionEvidence>;
  readonly binaryAssetRef?: ReturnType<typeof createTextureBinaryAssetReference>;
};

const createMaterializationEvidence = (overrides: MaterializationOverrides = {}) => ({
  evidenceKind: "psd-layer-materialization-evidence-v1",
  materializationId: "mat_selectedFace",
  sourceLayerRef: {
    sourceAssetId: "src_psd_character",
    sourceLayerId: "layer_face",
    sourceLayerName: "Face",
    sourceLayerPath: [...(overrides.sourceLayerPath ?? ["Root", "Head", "Face"])]
  },
  mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  byteLength: 16,
  digest: overrides.digest ?? MATERIALIZED_DIGEST,
  width: 2,
  height: 2,
  binaryAssetRef: overrides.binaryAssetRef ?? createTextureBinaryAssetReference(),
  textureId: "tex_face_rgba",
  provenance: {
    sourceFilePath: "private/source.psd",
    sourceDigest: overrides.provenance?.sourceDigest ?? SOURCE_PSD_DIGEST,
    sourceByteLength: SOURCE_PSD_BYTE_LENGTH,
    sourceMediaType: "image/vnd.adobe.photoshop",
    privacyLabel: "packageLocalAsset",
    publicDistribution: "notPublicDistributable",
    publicDemoAsset: false
  },
  parser: PSD_PARSER_EVIDENCE,
  extraction: overrides.extraction ?? createSelectedLayerExtractionEvidence()
});

const createSelectedLayerExtractionEvidence = () => ({
  extractionKind: "selectedLayerRasterV1",
  optionsSchemaVersion: "psd-layer-extraction-options-v1",
  options: {
    channelOrder: "rgba",
    includeEffects: false,
    includeHiddenLayers: false,
    composeWithOtherLayers: false,
    layerSelection: "layer_face"
  }
});

const createFixtureSession = (
  options: { readonly includeSourceBinaryAssetRef?: boolean } = {}
): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_import_psd_layer_materialization_test"),
    packageDisplayName: "Import PSD Layer Materialization Test",
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
          {
            sourceLayerId: "layer_face",
            sourceAssetId: SourceAssetIdSchema.parse("src_psd_character"),
            originalName: "Face",
            normalizedName: "face",
            groupPath: ["Root", "Head"],
            bounds: { x: 320, y: 240, width: 512, height: 512 },
            visibleInSource: true,
            opacityInSource: 0.42,
            role: "editableLayer",
            unsupportedFeatures: [],
            mappedDrawableIds: []
          }
        ],
        diagnostics: [],
        ...(options.includeSourceBinaryAssetRef === false
          ? {}
          : { binaryAssetRef: createSourceBinaryAssetReference() }),
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

const createTextureBinaryAssetReference = (overrides: {
  readonly digest?: FixtureDigest;
  readonly storageStatus?:
    | "stored-package-local-v1"
    | "missing-package-local-bytes-v1"
    | "storage-unsupported-v1";
} = {}) => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_psd_face_rgba",
  packageRelativePath: "assets/textures/psd/face.raw-rgba",
  digest: overrides.digest ?? MATERIALIZED_DIGEST,
  byteLength: 16,
  mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  storageStatus: overrides.storageStatus ?? "stored-package-local-v1",
  provenanceId: ProvenanceIdSchema.parse("prov_psd_face_rgba"),
  rightsAssetId: "src_psd_character"
} as const);

const SOURCE_PSD_DIGEST = {
  algorithm: "sha256",
  hex: "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5"
} as const;
const SOURCE_PSD_BYTE_LENGTH = 22406225;
const MATERIALIZED_DIGEST = {
  algorithm: "sha256",
  hex: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
} as const;
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
