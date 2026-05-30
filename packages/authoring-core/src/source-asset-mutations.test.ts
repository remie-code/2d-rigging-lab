import {
  OperationIdSchema,
  PackageIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createInitialAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { AuthoringMutationError } from "./authoring-mutations.js";
import {
  importSourceAssetMetadata,
  setRightsMetadata
} from "./source-asset-mutations.js";

describe("source asset authoring mutations", () => {
  it("imports source asset metadata with provenance and rights records", () => {
    const session = createFixtureSession();
    const sourceAsset = createSourceAsset();

    const result = importSourceAssetMetadata(session, {
      sourceAsset,
      provenanceRecord: {
        provenanceId: ProvenanceIdSchema.parse("prov_import_split_body"),
        assetId: "src_split_body",
        assetKind: "source",
        filePath: "assets/sources/body/manifest.json",
        contentHash: "sha256:split-body",
        creator: "fixture artist",
        license: "internal-test",
        redistributionAllowed: false,
        aiUsed: false,
        transformHistory: ["split-png-manifest"],
        relatedOperationIds: []
      },
      rightsRecord: {
        assetId: "src_split_body",
        rightsStatus: "cleared",
        license: "internal-test",
        redistributionAllowed: false
      }
    });

    expect(result.sourceAsset).toEqual(sourceAsset);
    expect(session.graph.sourceAssets).toEqual([sourceAsset]);
    expect(session.graph.provenanceRecords[0]).toMatchObject({
      provenanceId: "prov_import_split_body",
      assetId: "src_split_body"
    });
    expect(session.graph.rightsRecords[0]).toMatchObject({
      assetId: "src_split_body",
      rightsStatus: "cleared"
    });
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
  });

  it("rejects duplicate source asset ids before mutating rights or provenance", () => {
    const session = createFixtureSession();
    const sourceAsset = createSourceAsset();
    importSourceAssetMetadata(session, {
      sourceAsset,
      provenanceRecord: createProvenanceRecord(),
      rightsRecord: createRightsRecord("cleared")
    });
    const revisionAfterImport = session.authoringRevision;

    expect(() =>
      importSourceAssetMetadata(session, {
        sourceAsset,
        provenanceRecord: {
          ...createProvenanceRecord(),
          provenanceId: ProvenanceIdSchema.parse("prov_duplicate_split_body")
        },
        rightsRecord: createRightsRecord("needs_review")
      })
    ).toThrow(
      expect.objectContaining({
        code: "duplicate_source_asset"
      }) as AuthoringMutationError
    );
    expect(session.graph.sourceAssets).toHaveLength(1);
    expect(session.graph.provenanceRecords).toHaveLength(1);
    expect(session.graph.rightsRecords).toHaveLength(1);
    expect(session.authoringRevision).toBe(revisionAfterImport);
  });

  it("updates rights metadata and records the related operation on provenance", () => {
    const session = createFixtureSession();
    importSourceAssetMetadata(session, {
      sourceAsset: createSourceAsset(),
      provenanceRecord: createProvenanceRecord(),
      rightsRecord: createRightsRecord("needs_review")
    });

    const result = setRightsMetadata(session, {
      rightsRecord: createRightsRecord("cleared"),
      provenanceId: ProvenanceIdSchema.parse("prov_import_split_body"),
      relatedOperationId: OperationIdSchema.parse("op_set_split_body_rights")
    });

    expect(result.rightsBefore?.rightsStatus).toBe("needs_review");
    expect(result.rightsRecord.rightsStatus).toBe("cleared");
    expect(result.provenanceRecord?.relatedOperationIds).toEqual(["op_set_split_body_rights"]);
    expect(session.graph.rightsRecords).toEqual([createRightsRecord("cleared")]);
    expect(session.graph.provenanceRecords[0]?.relatedOperationIds).toEqual([
      "op_set_split_body_rights"
    ]);
    expect(session.authoringRevision).toBe(2);
  });
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_source_asset_mutation_test"),
    packageDisplayName: "Source Asset Mutation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [],
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

const createSourceAsset = (): AuthoringSession["graph"]["sourceAssets"][number] => ({
  sourceAssetId: SourceAssetIdSchema.parse("src_split_body"),
  kind: "split-png-set-v1",
  filePath: "assets/sources/body/manifest.json",
  contentHash: "sha256:split-body",
  importProfile: "split-png-fallback-v1",
  layers: [
    {
      sourceLayerId: "layer_body",
      sourceAssetId: SourceAssetIdSchema.parse("src_split_body"),
      originalName: "Body",
      normalizedName: "body",
      groupPath: ["Root"],
      bounds: { x: 4, y: 8, width: 40, height: 20 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: [],
      mappedDrawableIds: []
    }
  ],
  diagnostics: []
});

const createProvenanceRecord = (): AuthoringSession["graph"]["provenanceRecords"][number] => ({
  provenanceId: ProvenanceIdSchema.parse("prov_import_split_body"),
  assetId: "src_split_body",
  assetKind: "source",
  filePath: "assets/sources/body/manifest.json",
  contentHash: "sha256:split-body",
  creator: "fixture artist",
  license: "internal-test",
  redistributionAllowed: false,
  aiUsed: false,
  transformHistory: ["split-png-manifest"],
  relatedOperationIds: []
});

const createRightsRecord = (
  rightsStatus: AuthoringSession["graph"]["rightsRecords"][number]["rightsStatus"]
): AuthoringSession["graph"]["rightsRecords"][number] => ({
  assetId: "src_split_body",
  rightsStatus,
  license: "internal-test",
  redistributionAllowed: false
});
