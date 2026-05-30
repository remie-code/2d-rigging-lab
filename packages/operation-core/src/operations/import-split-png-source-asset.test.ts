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
  SourceAssetIdSchema
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
          unsupportedFeatures: []
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
