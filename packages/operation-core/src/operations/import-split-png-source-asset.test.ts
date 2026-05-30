import {
  createInitialAuthoringRevision,
  getDrawableById,
  getSourceAssetById
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
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "../operation-core.js";
import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { getOperationHandler } from "../operation-registry.js";
import { importSplitPngSourceAssetOperationHandler } from "./import-split-png-source-asset.js";
import { unsupportedPsdSourceAssetOperationHandler } from "./import-split-png-source-asset-unsupported-psd.js";
import { setRightsMetadataOperationHandler } from "./set-rights-metadata.js";

describe("importSplitPngSourceAsset operation handler", () => {
  it("is registered with the source import and rights handlers", () => {
    expect(getOperationHandler("importSplitPngSourceAsset")).toBe(
      importSplitPngSourceAssetOperationHandler
    );
    expect(getOperationHandler("importPsdSourceAsset")).toBe(
      unsupportedPsdSourceAssetOperationHandler
    );
    expect(getOperationHandler("setRightsMetadata")).toBe(setRightsMetadataOperationHandler);
  });

  it("dry-runs split PNG source import without mutating the original session", () => {
    const session = createFixtureSession();
    const request = createImportSplitPngRequest({ dryRun: true });

    const outcome = importSplitPngSourceAssetOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.candidateSession).not.toBe(session);
    expect(getSourceAssetById(session.graph, SourceAssetIdSchema.parse("src_split_body"))).toBeUndefined();
    expect(outcome.candidateSession.graph.sourceAssets[0]).toMatchObject({
      sourceAssetId: "src_split_body",
      kind: "split-png-set-v1",
      filePath: "assets/sources/body/manifest.json",
      contentHash: "sha256:split-body",
      importProfile: "split-png-fallback-v1"
    });
    expect(outcome.candidateSession.graph.provenanceRecords[0]).toMatchObject({
      provenanceId: "prov_import_split_body",
      assetId: "src_split_body",
      relatedOperationIds: ["op_import_split_body"]
    });
    expect(outcome.candidateSession.graph.rightsRecords[0]).toMatchObject({
      assetId: "src_split_body",
      rightsStatus: "cleared"
    });
    expect(outcome.result.modelDiff?.added).toEqual([
      { kind: "sourceAsset", id: "src_split_body" }
    ]);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
  });

  it("commits source manifest, provenance, and rights records through operation core", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-30T00:00:00.000Z")
    });

    const outcome = core.commitOperation(session, createImportSplitPngRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.graph.sourceAssets).toHaveLength(1);
    expect(session.graph.sourceAssets[0]?.layers[0]).toMatchObject({
      sourceLayerId: "layer_body",
      sourceAssetId: "src_split_body",
      bounds: { x: 4, y: 8, width: 40, height: 20 }
    });
    expect(session.graph.provenanceRecords[0]).toMatchObject({
      provenanceId: "prov_import_split_body",
      assetId: "src_split_body",
      license: "internal-test",
      transformHistory: ["importSplitPngSourceAsset:manifest-metadata", "fixture-split-png"]
    });
    expect(session.graph.rightsRecords).toEqual([
      {
        assetId: "src_split_body",
        rightsStatus: "cleared",
        license: "internal-test",
        redistributionAllowed: false
      }
    ]);
    expect(outcome.logEntry?.operationType).toBe("importSplitPngSourceAsset");
    expect(outcome.logEntry?.targetIds).toEqual(["src_split_body", "layer_body"]);
  });

  it("commits texture preview metadata when split PNG layer mapping is explicit", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-30T00:05:00.000Z")
    });

    const outcome = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeTextureMapping: true
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.textureAtlas?.textures).toEqual([
      expect.objectContaining({
        textureId: "tex_body",
        filePath: "assets/textures/body.preview.png",
        sourceAssetId: "src_split_body",
        sourceLayerId: "layer_body",
        provenanceId: "prov_import_split_body"
      })
    ]);
    expect(session.graph.textureAtlas?.previewAssets).toEqual([
      expect.objectContaining({
        previewAssetId: "preview_src_split_body_layer_body",
        textureId: "tex_body",
        reference: {
          referenceKind: "package-local-file-v1",
          filePath: "assets/textures/body.preview.png"
        },
        sourceAssetId: "src_split_body",
        sourceLayerId: "layer_body",
        provenanceId: "prov_import_split_body",
        rightsAssetId: "src_split_body"
      })
    ]);
    expect(outcome.result.modelDiff?.changed.flatMap((change) =>
      change.fields.map((field) => field.path)
    )).toEqual(expect.arrayContaining([
      "/assets/textureAtlas/textures",
      "/assets/textureAtlas/previewAssets",
      "/assets/textureAtlas/textures/tex_body",
      "/assets/textureAtlas/previewAssets/preview_src_split_body_layer_body"
    ]));
    expect(outcome.logEntry?.targetIds).toEqual([
      "src_split_body",
      "layer_body",
      "tex_body",
      "part_root"
    ]);
    expect(outcome.logEntry?.payload).toMatchObject({
      operationType: "importSplitPngSourceAsset",
      payload: {
        layers: [
          expect.objectContaining({
            sourceLayerId: "layer_body",
            texturePreviewReference: "assets/textures/body.preview.png",
            textureId: "tex_body",
            targetPartId: "part_root"
          })
        ]
      }
    });
  });

  it("commits deterministic data URL texture preview metadata as browser-renderable preview assets", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-30T00:06:00.000Z")
    });
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

    const outcome = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeTextureMapping: true,
        texturePreviewReference: dataUrl
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(session.graph.textureAtlas?.textures).toEqual([
      expect.objectContaining({
        textureId: "tex_body",
        filePath: "assets/textures/tex_body.png",
        sourceAssetId: "src_split_body",
        sourceLayerId: "layer_body"
      })
    ]);
    expect(session.graph.textureAtlas?.previewAssets).toEqual([
      expect.objectContaining({
        previewAssetId: "preview_src_split_body_layer_body",
        textureId: "tex_body",
        reference: {
          referenceKind: "deterministic-data-url-v1",
          dataUrl
        },
        sourceAssetId: "src_split_body",
        sourceLayerId: "layer_body",
        rightsAssetId: "src_split_body"
      })
    ]);
    expect(outcome.logEntry?.payload).toMatchObject({
      operationType: "importSplitPngSourceAsset",
      payload: {
        layers: [
          expect.objectContaining({
            sourceLayerId: "layer_body",
            texturePreviewReference: dataUrl,
            textureId: "tex_body"
          })
        ]
      }
    });
  });

  it("rejects texture materialization when the texture ID already exists in the atlas", () => {
    const session = createFixtureSession();
    session.graph.textureAtlas = {
      schemaVersion: "texture-atlas-v1",
      textures: [
        {
          textureId: TextureIdSchema.parse("tex_body"),
          filePath: "assets/textures/existing-body.png"
        }
      ],
      previewAssets: []
    };
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeTextureMapping: true
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.importSplitPngSourceAsset.existingTextureId",
        target: {
          kind: "texture",
          id: "tex_body",
          path: "/payload/layers/layer_body/textureId"
        }
      })
    ]));
    expect(session.graph.sourceAssets).toHaveLength(0);
    expect(session.graph.textureAtlas?.textures).toEqual([
      {
        textureId: "tex_body",
        filePath: "assets/textures/existing-body.png"
      }
    ]);
  });

  it("lets createDrawable reference an imported source asset and layer", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    const importOutcome = core.commitOperation(session, createImportSplitPngRequest({ dryRun: false }));
    expect(importOutcome.result.status).toBe("committed");

    const drawableOutcome = core.commitOperation(
      session,
      createCreateDrawableRequest({ dryRun: false, basePackageRevision: 1 })
    );

    expect(drawableOutcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_body"))).toMatchObject({
      sourceAssetId: "src_split_body",
      partId: "part_root"
    });
    expect(session.graph.sourceAssets[0]?.layers[0]?.mappedDrawableIds).toEqual(["draw_body"]);
  });

  it("updates source asset rights metadata and provenance evidence", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        rightsStatus: "needs_review"
      })
    );

    const outcome = core.commitOperation(session, createSetRightsMetadataRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(session.graph.rightsRecords).toEqual([
      {
        assetId: "src_split_body",
        rightsStatus: "cleared",
        license: "internal-test-updated",
        redistributionAllowed: false
      }
    ]);
    expect(session.graph.provenanceRecords[0]?.relatedOperationIds).toEqual([
      "op_import_split_body",
      "op_set_split_body_rights"
    ]);
    expect(outcome.result.modelDiff?.changed[0]?.fields[0]).toMatchObject({
      path: "/assets/rights/records/src_split_body",
      before: expect.objectContaining({ rightsStatus: "needs_review" }),
      after: expect.objectContaining({ rightsStatus: "cleared" })
    });
  });

  it("rejects deterministic split PNG import precondition failures", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const missingManifest = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        manifestPath: " "
      })
    );
    expect(missingManifest.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importSplitPngSourceAsset.missingManifestPath"
    );

    const invalidProfile = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        importProfile: "layered-character-psd-profile-v1"
      })
    );
    expect(invalidProfile.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importSplitPngSourceAsset.invalidImportProfile"
    );

    const missingRightsAndProvenance = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeRights: false,
        includeProvenance: false
      })
    );
    expect(missingRightsAndProvenance.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importSplitPngSourceAsset.missingRights",
        "operation.importSplitPngSourceAsset.missingProvenance"
      ])
    );

    const blockedRights = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        rightsStatus: "blocked"
      })
    );
    expect(blockedRights.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importSplitPngSourceAsset.blockedRights"
    );

    const missingBounds = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeLayerBounds: false
      })
    );
    expect(missingBounds.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importSplitPngSourceAsset.missingLayerBounds"
    );
    expect(session.graph.sourceAssets).toHaveLength(0);
    expect(session.graph.provenanceRecords).toHaveLength(0);
    expect(session.graph.rightsRecords).toHaveLength(0);
  });

  it("rejects explicit texture mapping without a texture preview reference", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeTextureMapping: true,
        includeTexturePreviewReference: false
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.importSplitPngSourceAsset.missingTexturePreviewReference",
        target: {
          kind: "sourceAsset",
          id: "src_split_body",
          path: "/payload/layers/layer_body/texturePreviewReference"
        }
      })
    ]));
    expect(session.graph.sourceAssets).toHaveLength(0);
    expect(session.graph.textureAtlas).toBeUndefined();
  });

  it("rejects unsafe texture preview references before source import commit", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeTextureMapping: true,
        texturePreviewReference: "https://example.invalid/body.png"
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importSplitPngSourceAsset.invalidTexturePreviewReference"
    );
    expect(session.graph.sourceAssets).toHaveLength(0);
  });

  it("rejects generated texture preview references before source import commit", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeTextureMapping: true,
        texturePreviewReference: "generated://texture-preview/body"
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.importSplitPngSourceAsset.invalidTexturePreviewReference",
        message: expect.stringContaining("generated://texture-preview/ references are not supported")
      })
    ]));
    expect(session.graph.sourceAssets).toHaveLength(0);
    expect(session.graph.textureAtlas).toBeUndefined();
  });

  it.each([
    "assets/textures//face.png",
    "assets/textures/./face.png"
  ])("rejects package-local texture preview references with invalid path segments: %s", (texturePreviewReference) => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        includeTextureMapping: true,
        texturePreviewReference
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        checkId: "operation.importSplitPngSourceAsset.invalidTexturePreviewReference",
        target: {
          kind: "sourceAsset",
          id: "src_split_body",
          path: "/payload/layers/layer_body/texturePreviewReference"
        }
      })
    ]));
    expect(session.graph.sourceAssets).toHaveLength(0);
    expect(session.graph.textureAtlas).toBeUndefined();
  });

  it("rejects duplicate source asset ids deterministically", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    const first = core.commitOperation(session, createImportSplitPngRequest({ dryRun: false }));
    expect(first.result.status).toBe("committed");

    const duplicate = core.commitOperation(
      session,
      createImportSplitPngRequest({
        dryRun: false,
        basePackageRevision: 1
      })
    );

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importSplitPngSourceAsset.duplicateSourceAsset"
    );
    expect(session.graph.sourceAssets).toHaveLength(1);
  });

  it("rejects unsupported PSD import with an operation-specific diagnostic", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(session, createImportPsdRequest());

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]?.checkId).toBe("operation.importPsdSourceAsset.unsupported");
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
  });

  it("rejects setRightsMetadata missing provenance and blocked rights deterministically", () => {
    const session = createFixtureSession();
    const core = createOperationCore();
    core.commitOperation(session, createImportSplitPngRequest({ dryRun: false }));
    session.graph.provenanceRecords.splice(0, session.graph.provenanceRecords.length);

    const missingProvenance = core.commitOperation(
      session,
      createSetRightsMetadataRequest({
        dryRun: false,
        basePackageRevision: 1
      })
    );
    expect(missingProvenance.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.setRightsMetadata.missingProvenance"
    );

    session.graph.provenanceRecords.push({
      provenanceId: ProvenanceIdSchema.parse("prov_import_split_body"),
      assetId: "src_split_body",
      assetKind: "source",
      filePath: "assets/sources/body/manifest.json",
      contentHash: "sha256:split-body",
      creator: "fixture artist",
      license: "internal-test",
      redistributionAllowed: false,
      aiUsed: false,
      transformHistory: [],
      relatedOperationIds: [OperationIdSchema.parse("op_import_split_body")]
    });
    const blockedRights = core.commitOperation(
      session,
      createSetRightsMetadataRequest({
        dryRun: false,
        basePackageRevision: 1,
        rightsStatus: "blocked"
      })
    );
    expect(blockedRights.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.setRightsMetadata.blockedRights"
    );
  });
});

const createImportSplitPngRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly manifestPath?: string;
  readonly importProfile?: string;
  readonly includeRights?: boolean;
  readonly includeProvenance?: boolean;
  readonly includeLayerBounds?: boolean;
  readonly includeTextureMapping?: boolean;
  readonly includeTexturePreviewReference?: boolean;
  readonly texturePreviewReference?: string;
  readonly rightsStatus?: "cleared" | "needs_review" | "blocked";
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_import_split_body",
    actor: "importer",
    surface: "structuredApi",
    dryRun: options.dryRun,
    basePackageRevision: options.basePackageRevision ?? 0,
    operationType: "importSplitPngSourceAsset",
    payload: {
      sourceAssetId: "src_split_body",
      manifestPath: options.manifestPath ?? "assets/sources/body/manifest.json",
      importProfile: options.importProfile ?? "split-png-fallback-v1",
      contentHash: "sha256:split-body",
      defaultPartId: "part_root",
      placementPolicy: "use-metadata",
      layers: [
        {
          sourceLayerId: "layer_body",
          imagePath: "assets/sources/body/body.png",
          originalName: "Body",
          normalizedName: "body",
          groupPath: ["Root"],
          ...(options.includeLayerBounds === false
            ? {}
            : { bounds: { x: 4, y: 8, width: 40, height: 20 } }),
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: [],
          ...(options.includeTextureMapping === true
            ? {
                ...(options.includeTexturePreviewReference === false
                  ? {}
                  : {
                      texturePreviewReference:
                        options.texturePreviewReference ?? "assets/textures/body.preview.png"
                    }),
                textureId: "tex_body",
                targetPartId: "part_root"
              }
            : {})
        }
      ],
      ...(options.includeRights === false
        ? {}
        : {
            rights: {
              rightsStatus: options.rightsStatus ?? "cleared",
              license: "internal-test",
              redistributionAllowed: false
            }
          }),
      ...(options.includeProvenance === false
        ? {}
        : {
            provenance: {
              creator: "fixture artist",
              sourceUrl: "https://example.invalid/source/body",
              license: "internal-test",
              redistributionAllowed: false,
              aiUsed: false,
              transformHistory: ["fixture-split-png"]
            }
          })
    }
  });

const createCreateDrawableRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision: number;
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_create_drawable_body",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: options.basePackageRevision,
    operationType: "createDrawable",
    payload: {
      sourceAssetId: "src_split_body",
      sourceLayerId: "layer_body",
      partId: "part_root",
      displayName: "Body"
    }
  });

const createSetRightsMetadataRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly rightsStatus?: "cleared" | "needs_review" | "blocked";
}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_set_split_body_rights",
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: options.basePackageRevision ?? 1,
    operationType: "setRightsMetadata",
    payload: {
      assetId: "src_split_body",
      rightsStatus: options.rightsStatus ?? "cleared",
      license: "internal-test-updated",
      redistributionAllowed: false,
      provenanceId: "prov_import_split_body"
    }
  });

const createImportPsdRequest = (): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_import_psd_body",
    actor: "importer",
    surface: "structuredApi",
    dryRun: false,
    basePackageRevision: 0,
    operationType: "importPsdSourceAsset",
    payload: {
      sourceAssetId: "src_psd_body",
      fileRef: {
        packageRelativePath: "assets/sources/body/body.psd",
        contentHash: "sha256:psd-body"
      },
      importProfile: "layered-character-psd-profile-v1",
      requestedLayerRoles: {},
      rights: {
        creator: "fixture artist",
        license: "internal-test",
        redistributionAllowed: false,
        aiUsed: false
      }
    }
  });

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_import_split_png_operation_test"),
    packageDisplayName: "Import Split PNG Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
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
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
