import {
  createInitialAuthoringRevision,
  getSourceAssetById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  OperationIdSchema,
  PackageIdSchema,
  PartIdSchema,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { importPsdSourceAssetOperationHandler } from "./import-psd-source-asset.js";

describe("importPsdSourceAsset operation handler", () => {
  it("dry-runs adapter-backed PSD import without mutating the original session", () => {
    const session = createFixtureSession();
    const request = createImportPsdRequest({ dryRun: true });

    const outcome = importPsdSourceAssetOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getSourceAssetById(session.graph, SourceAssetIdSchema.parse("src_psd_character"))).toBeUndefined();
    expect(session.graph.textureAtlas).toBeUndefined();
    expect(outcome.candidateSession.graph.sourceAssets[0]).toMatchObject({
      sourceAssetId: "src_psd_character",
      kind: "psd-source-v1",
      filePath: "assets/sources/character/source.psd",
      contentHash: "sha256:psd-character",
      importProfile: "layered-character-psd-profile-v1"
    });
    expect(outcome.candidateSession.graph.sourceAssets[0]?.layers[0]).toMatchObject({
      sourceLayerId: "layer_face",
      sourceAssetId: "src_psd_character",
      role: "editableLayer",
      groupPath: ["Root", "Head"],
      unsupportedFeatures: ["psd.textLayer"]
    });
    expect(outcome.candidateSession.graph.sourceAssets[0]?.psdProfile).toMatchObject({
      schemaVersion: "layered-character-psd-profile-v1",
      adapter: {
        adapterName: "fixture-psd-adapter",
        adapterResultSchemaVersion: "psd-adapter-result-v1",
        sourceProfile: "layered-character-psd-profile-v1",
        evidenceKind: "adapter-supplied-metadata-v1"
      },
      canvas: {
        width: 2048,
        height: 3072,
        bounds: { x: 0, y: 0, width: 2048, height: 3072 }
      },
      compatibility: {
        structuredProfilePrecedence: "structured-profile-preferred-v1",
        flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
        flattenedUnsupportedFeaturesFallback:
          "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
      }
    });
    expect(outcome.candidateSession.graph.sourceAssets[0]?.psdProfile?.sourceGroups[0]).toMatchObject({
      sourceGroupId: "group_head",
      blendMode: {
        modeKey: "pass",
        normalizedMode: "passThrough",
        supportedByMvp: false
      },
      targetPartId: "part_root"
    });
    expect(outcome.candidateSession.graph.sourceAssets[0]?.psdProfile?.sourceLayers[0]).toMatchObject({
      sourceLayerId: "layer_face",
      role: "referenceOnly",
      blendMode: {
        modeKey: "mul ",
        normalizedMode: "multiply",
        displayName: "Multiply",
        supportedByMvp: false
      },
      texturePreviewReference: "assets/textures/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root",
      unsupportedFeatures: [
        expect.objectContaining({
          featureId: "psd.textLayer",
          scope: "layer",
          manualConfirmationRequired: true
        })
      ]
    });
    expect(outcome.candidateSession.graph.sourceAssets[0]?.diagnostics).toEqual(
      expect.arrayContaining([
        "psd.layerTargetPart:layer_face:part_root",
        "psd.layerTexture:layer_face:tex_face",
        "psd.layerTexturePreview:layer_face:assets/textures/face.preview.png",
        "psd.requestedLayerRole:layer_face:editableLayer"
      ])
    );
    expect(outcome.candidateSession.graph.textureAtlas?.previewAssets?.[0]).toMatchObject({
      previewAssetId: "preview_src_psd_character_layer_face",
      textureId: "tex_face",
      reference: {
        referenceKind: "package-local-file-v1",
        filePath: "assets/textures/face.preview.png"
      },
      sourceAssetId: "src_psd_character",
      sourceLayerId: "layer_face",
      provenanceId: "prov_import_psd_character",
      rightsAssetId: "src_psd_character"
    });
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.importPsdSourceAsset.unsupportedFeature",
      "operation.importPsdSourceAsset.adapterDiagnostic"
    ]);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
  });

  it("commits source manifest, texture preview, rights, and provenance records through operation core", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-31T00:00:00.000Z")
    });

    const outcome = core.commitOperation(session, createImportPsdRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(2);
    expect(session.graph.sourceAssets).toHaveLength(1);
    expect(session.graph.sourceAssets[0]?.psdProfile?.sourceLayers[0]).toMatchObject({
      sourceLayerId: "layer_face",
      texturePreviewReference: "assets/textures/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root"
    });
    expect(session.graph.provenanceRecords[0]).toMatchObject({
      provenanceId: "prov_import_psd_character",
      assetId: "src_psd_character",
      assetKind: "source",
      filePath: "assets/sources/character/source.psd",
      contentHash: "sha256:psd-character",
      creator: "fixture artist",
      license: "internal-test",
      transformHistory: [
        "importPsdSourceAsset:adapter-result-metadata",
        "psdAdapter:fixture-psd-adapter",
        "psdAdapterSchema:psd-adapter-result-v1"
      ],
      relatedOperationIds: ["op_import_psd_character"]
    });
    expect(session.graph.rightsRecords).toEqual([
      {
        assetId: "src_psd_character",
        rightsStatus: "cleared",
        license: "internal-test",
        redistributionAllowed: false
      }
    ]);
    expect(session.graph.textureAtlas?.textures[0]).toMatchObject({
      textureId: "tex_face",
      filePath: "assets/textures/face.preview.png",
      sourceAssetId: "src_psd_character",
      sourceLayerId: "layer_face",
      provenanceId: "prov_import_psd_character"
    });
    expect(outcome.result.modelDiff?.changed.flatMap((change) =>
      change.fields.map((field) => field.path)
    )).toEqual(expect.arrayContaining([
      "/assets/sourceManifest/sourceAssets",
      "/assets/provenance/records",
      "/assets/rights/records",
      "/assets/textureAtlas/textures",
      "/assets/textureAtlas/previewAssets",
      "/assets/textureAtlas/textures/tex_face",
      "/assets/textureAtlas/previewAssets/preview_src_psd_character_layer_face"
    ]));
    expect(outcome.logEntry?.targetIds).toEqual([
      "src_psd_character",
      "group_head",
      "layer_face",
      "part_root",
      "tex_face"
    ]);
  });

  it("materializes PSD source and texture binary refs as pending package-local metadata", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-31T00:10:00.000Z")
    });

    const outcome = core.commitOperation(
      session,
      createImportPsdRequest({
        dryRun: false,
        sourceBinaryAssetRefStorageStatus: "missing-package-local-bytes-v1",
        texturePreviewBinaryAssetRefStorageStatus: "missing-package-local-bytes-v1",
        includeTexturePreviewReference: false
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.sourceAssets[0]?.binaryAssetRef).toMatchObject({
      binaryAssetId: "bin_psd_character_source",
      packageRelativePath: "assets/sources/character/source.psd",
      storageStatus: "missing-package-local-bytes-v1",
      provenanceId: "prov_import_psd_character",
      rightsAssetId: "src_psd_character"
    });
    expect(session.graph.sourceAssets[0]?.psdProfile?.sourceLayers[0]).toMatchObject({
      sourceLayerId: "layer_face",
      texturePreviewReference: "assets/textures/face.preview.png",
      textureId: "tex_face"
    });
    expect(session.graph.textureAtlas?.textures[0]).toMatchObject({
      textureId: "tex_face",
      filePath: "assets/textures/face.preview.png",
      binaryAssetRef: expect.objectContaining({
        binaryAssetId: "bin_psd_character_face_preview",
        packageRelativePath: "assets/textures/face.preview.png",
        storageStatus: "missing-package-local-bytes-v1",
        provenanceId: "prov_import_psd_character",
        rightsAssetId: "src_psd_character"
      })
    });
    const pendingDiagnostics = outcome.result.diagnostics.filter(
      (diagnostic) => diagnostic.checkId === "operation.importPsdSourceAsset.binaryPayloadPending"
    );
    expect(pendingDiagnostics).toEqual([
      expect.objectContaining({
        status: "needs_review",
        severity: "warning",
        target: {
          kind: "sourceAsset",
          id: "src_psd_character",
          path: "/payload/fileRef/binaryAssetRef"
        }
      }),
      expect.objectContaining({
        status: "needs_review",
        severity: "warning",
        target: {
          kind: "sourceAsset",
          id: "src_psd_character",
          path: "/payload/adapterResult/sourceLayers/layer_face/texturePreviewBinaryAssetRef"
        }
      })
    ]);
  });

  it("rejects missing adapter results without parsing PSD bytes", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createImportPsdRequest({ dryRun: false, includeAdapterResult: false })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics).toEqual([
      expect.objectContaining({
        checkId: "operation.importPsdSourceAsset.missingAdapterResult",
        message: expect.stringContaining("does not parse PSD bytes"),
        target: {
          kind: "sourceAsset",
          id: "src_psd_character",
          path: "/payload/adapterResult"
        }
      })
    ]);
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.graph.sourceAssets).toHaveLength(0);
  });

  it("rejects unsafe adapter preview references before mutating package assets", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createImportPsdRequest({
        dryRun: false,
        texturePreviewReference: "generated://texture-preview/face"
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.importPsdSourceAsset.invalidTexturePreviewReference",
        message: expect.stringContaining("generated://texture-preview/ references are not supported")
      })
    ]));
    expect(session.graph.sourceAssets).toHaveLength(0);
    expect(session.graph.textureAtlas).toBeUndefined();
  });

  it("rejects missing target part mappings deterministically", () => {
    const session = createFixtureSession({ includeRootPart: false });
    const core = createOperationCore();

    const outcome = core.commitOperation(session, createImportPsdRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdSourceAsset.missingGroupTargetPart",
        "operation.importPsdSourceAsset.missingLayerTargetPart"
      ])
    );
    expect(session.graph.sourceAssets).toHaveLength(0);
  });
});

const createImportPsdRequest = (options: {
  readonly dryRun: boolean;
  readonly includeAdapterResult?: boolean;
  readonly includeTexturePreviewReference?: boolean;
  readonly sourceBinaryAssetRefStorageStatus?:
    | "stored-package-local-v1"
    | "missing-package-local-bytes-v1"
    | "storage-unsupported-v1";
  readonly texturePreviewBinaryAssetRefStorageStatus?:
    | "stored-package-local-v1"
    | "missing-package-local-bytes-v1"
    | "storage-unsupported-v1";
  readonly texturePreviewReference?: string;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_import_psd_character",
    actor: "importer",
    surface: "structuredApi",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "importPsdSourceAsset",
    payload: {
      sourceAssetId: "src_psd_character",
      fileRef: {
        packageRelativePath: "assets/sources/character/source.psd",
        contentHash: "sha256:psd-character",
        ...(options.sourceBinaryAssetRefStorageStatus === undefined
          ? {}
          : {
              binaryAssetRef: createBinaryAssetReference({
                binaryAssetId: "bin_psd_character_source",
                packageRelativePath: "assets/sources/character/source.psd",
                mediaType: "application/octet-stream",
                storageStatus: options.sourceBinaryAssetRefStorageStatus,
                provenanceId: "prov_import_psd_character",
                rightsAssetId: "src_psd_character"
              })
            })
      },
      importProfile: "layered-character-psd-profile-v1",
      requestedLayerRoles: {
        layer_face: "editableLayer"
      },
      ...(options.includeAdapterResult === false
        ? {}
        : {
            adapterResult: {
              schemaVersion: "psd-adapter-result-v1",
              sourceProfile: "layered-character-psd-profile-v1",
              adapterName: "fixture-psd-adapter",
              canvas: {
                width: 2048,
                height: 3072,
                bounds: { x: 0, y: 0, width: 2048, height: 3072 }
              },
              sourceGroups: [
                {
                  sourceGroupId: "group_head",
                  originalName: "Head",
                  normalizedName: "head",
                  groupPath: ["Root", "Head"],
                  sourceOrder: 0,
                  blendMode: {
                    modeKey: "pass",
                    normalizedMode: "passThrough",
                    supportedByMvp: false,
                    source: { kind: "group", id: "group_head" }
                  },
                  targetPartId: "part_root"
                }
              ],
              sourceLayers: [
                {
                  sourceLayerId: "layer_face",
                  originalName: "Face",
                  normalizedName: "face",
                  parentGroupId: "group_head",
                  groupPath: ["Root", "Head"],
                  sourceOrder: 1,
                  bounds: { x: 320, y: 240, width: 512, height: 512 },
                  visibleInSource: true,
                  opacityInSource: 0.8,
                  role: "referenceOnly",
                  blendMode: {
                    modeKey: "mul ",
                    normalizedMode: "multiply",
                    displayName: "Multiply",
                    supportedByMvp: false,
                    source: { kind: "layer", id: "layer_face" }
                  },
                  unsupportedFeatures: [
                    {
                      featureId: "psd.textLayer",
                      scope: "layer",
                      severity: "warning",
                      message: "Text layer requires adapter-side rasterization before materialization.",
                      source: { kind: "layer", id: "layer_face" },
                      rasterizeCandidate: true,
                      manualConfirmationRequired: true
                    }
                  ],
                  ...(options.includeTexturePreviewReference === false
                    ? {}
                    : {
                        texturePreviewReference:
                          options.texturePreviewReference ?? "assets/textures/face.preview.png"
                      }),
                  ...(options.texturePreviewBinaryAssetRefStorageStatus === undefined
                    ? {}
                    : {
                        texturePreviewBinaryAssetRef: createBinaryAssetReference({
                          binaryAssetId: "bin_psd_character_face_preview",
                          packageRelativePath: "assets/textures/face.preview.png",
                          mediaType: "image/png",
                          storageStatus: options.texturePreviewBinaryAssetRefStorageStatus,
                          provenanceId: "prov_import_psd_character",
                          rightsAssetId: "src_psd_character"
                        })
                      }),
                  textureId: "tex_face",
                  targetPartId: "part_root"
                }
              ],
              unsupportedFeatures: [],
              diagnostics: [
                {
                  checkId: "adapter.psd.unsupportedFeature",
                  severity: "warning",
                  message: "Adapter detected PSD features that operation-core must not render.",
                  source: { kind: "adapter", path: "/unsupportedFeatures" },
                  evidence: ["fixture-adapter-diagnostic"]
                }
              ]
            }
          }),
      rights: {
        creator: "fixture artist",
        license: "internal-test",
        redistributionAllowed: false,
        aiUsed: false
      }
    }
  });

const createBinaryAssetReference = (overrides: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly mediaType: string;
  readonly storageStatus:
    | "stored-package-local-v1"
    | "missing-package-local-bytes-v1"
    | "storage-unsupported-v1";
  readonly provenanceId: string;
  readonly rightsAssetId: string;
}) => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: overrides.binaryAssetId,
  packageRelativePath: overrides.packageRelativePath,
  digest: {
    algorithm: "sha256",
    hex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  byteLength: 12,
  mediaType: overrides.mediaType,
  storageStatus: overrides.storageStatus,
  provenanceId: overrides.provenanceId,
  rightsAssetId: overrides.rightsAssetId
});

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return OperationIdSchema.parse(request.operationId);
};

const createFixtureSession = (options: {
  readonly includeRootPart?: boolean;
} = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_import_psd_operation_test"),
    packageDisplayName: "Import PSD Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 2048, height: 3072 },
    parts: options.includeRootPart === false
      ? []
      : [
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
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
