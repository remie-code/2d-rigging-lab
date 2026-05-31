import {
  OperationIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
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

  it("preserves package-local source binary refs when provenance and rights match", () => {
    const session = createFixtureSession();
    const binaryAssetRef = createBinaryAssetReference({
      binaryAssetId: "bin_split_body_manifest",
      packageRelativePath: "assets/sources/body/manifest.json",
      mediaType: "application/json",
      storageStatus: "missing-package-local-bytes-v1",
      provenanceId: "prov_import_split_body",
      rightsAssetId: "src_split_body"
    });
    const sourceAsset = {
      ...createSourceAsset(),
      binaryAssetRef
    };

    const result = importSourceAssetMetadata(session, {
      sourceAsset,
      provenanceRecord: createProvenanceRecord(),
      rightsRecord: createRightsRecord("cleared")
    });

    expect(result.sourceAsset.binaryAssetRef).toEqual(binaryAssetRef);
    expect(session.graph.sourceAssets[0]?.binaryAssetRef).toEqual(binaryAssetRef);
  });

  it("rejects source binary refs that do not match the source file path", () => {
    const session = createFixtureSession();
    const sourceAsset = {
      ...createSourceAsset(),
      binaryAssetRef: createBinaryAssetReference({
        binaryAssetId: "bin_split_body_other",
        packageRelativePath: "assets/sources/body/other.json",
        mediaType: "application/json",
        storageStatus: "missing-package-local-bytes-v1",
        provenanceId: "prov_import_split_body",
        rightsAssetId: "src_split_body"
      })
    };

    expect(() =>
      importSourceAssetMetadata(session, {
        sourceAsset,
        provenanceRecord: createProvenanceRecord(),
        rightsRecord: createRightsRecord("cleared")
      })
    ).toThrow(
      expect.objectContaining({
        code: "source_binary_ref_path_mismatch"
      }) as AuthoringMutationError
    );
    expect(session.graph.sourceAssets).toHaveLength(0);
  });

  it("imports PSD source profile metadata with flattened adapter diagnostics", () => {
    const session = createFixtureSession();
    const sourceAsset = createPsdSourceAsset();

    const result = importSourceAssetMetadata(session, {
      sourceAsset,
      provenanceRecord: {
        provenanceId: ProvenanceIdSchema.parse("prov_import_psd_character"),
        assetId: "src_psd_character",
        assetKind: "source",
        filePath: "assets/sources/character/source.psd",
        contentHash: "sha256:psd-character",
        creator: "fixture artist",
        license: "internal-test",
        redistributionAllowed: false,
        aiUsed: false,
        transformHistory: [
          "importPsdSourceAsset:adapter-result-metadata",
          "psdAdapter:fixture-psd-adapter"
        ],
        relatedOperationIds: [OperationIdSchema.parse("op_import_psd_character")]
      },
      rightsRecord: {
        assetId: "src_psd_character",
        rightsStatus: "cleared",
        license: "internal-test",
        redistributionAllowed: false
      }
    });

    expect(result.sourceAsset).toEqual(sourceAsset);
    expect(session.graph.sourceAssets).toEqual([sourceAsset]);
    expect(session.graph.sourceAssets[0]?.kind).toBe("psd-source-v1");
    expect(session.graph.sourceAssets[0]?.importProfile).toBe("layered-character-psd-profile-v1");
    expect(session.graph.sourceAssets[0]?.layers[0]).toMatchObject({
      sourceLayerId: "layer_face",
      role: "editableLayer",
      unsupportedFeatures: ["psd.textLayer"]
    });
    expect(session.graph.sourceAssets[0]?.diagnostics).toEqual(expect.arrayContaining([
      "psd.layerTargetPart:layer_face:part_root",
      "psd.layerTexture:layer_face:tex_face",
      expect.stringContaining("psd.layerUnsupportedFeature:layer_face:")
    ]));
    expect(session.graph.sourceAssets[0]?.psdProfile).toMatchObject({
      schemaVersion: "layered-character-psd-profile-v1",
      adapter: {
        adapterName: "fixture-psd-adapter",
        adapterResultSchemaVersion: "psd-adapter-result-v1",
        evidenceKind: "adapter-supplied-metadata-v1"
      },
      compatibility: {
        structuredProfilePrecedence: "structured-profile-preferred-v1",
        flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
        flattenedUnsupportedFeaturesFallback:
          "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
      }
    });
    expect(session.graph.sourceAssets[0]?.psdProfile?.sourceLayers[0]).toMatchObject({
      sourceLayerId: "layer_face",
      role: "referenceOnly",
      texturePreviewReference: "assets/textures/face.preview.png",
      textureId: "tex_face",
      targetPartId: "part_root",
      unsupportedFeatures: [
        expect.objectContaining({
          featureId: "psd.textLayer",
          scope: "layer"
        })
      ]
    });
    expect(session.graph.provenanceRecords[0]).toMatchObject({
      provenanceId: "prov_import_psd_character",
      assetId: "src_psd_character",
      relatedOperationIds: ["op_import_psd_character"]
    });
    expect(session.graph.rightsRecords[0]).toMatchObject({
      assetId: "src_psd_character",
      rightsStatus: "cleared"
    });
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

const createPsdSourceAsset = (): AuthoringSession["graph"]["sourceAssets"][number] => ({
  sourceAssetId: SourceAssetIdSchema.parse("src_psd_character"),
  kind: "psd-source-v1",
  filePath: "assets/sources/character/source.psd",
  contentHash: "sha256:psd-character",
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
      opacityInSource: 0.8,
      role: "editableLayer",
      unsupportedFeatures: ["psd.textLayer"],
      mappedDrawableIds: []
    }
  ],
  diagnostics: [
    "layered-character-psd-profile-v1",
    "psd-adapter-result-v1",
    "psd.adapterName:fixture-psd-adapter",
    "psd.canvas:2048x3072",
    "psd.layerTargetPart:layer_face:part_root",
    "psd.layerTexture:layer_face:tex_face",
    "psd.layerTexturePreview:layer_face:assets/textures/face.preview.png",
    "psd.layerUnsupportedFeature:layer_face:{\"featureId\":\"psd.textLayer\",\"scope\":\"layer\",\"severity\":\"warning\",\"message\":\"Text layer requires adapter-side rasterization before materialization.\",\"rasterizeCandidate\":true,\"manualConfirmationRequired\":true}"
  ],
  psdProfile: {
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
    sourceGroups: [
      {
        sourceGroupId: "group_head",
        originalName: "Head",
        normalizedName: "head",
        groupPath: ["Root", "Head"],
        sourceOrder: 0,
        visibleInSource: true,
        opacityInSource: 1,
        targetPartId: PartIdSchema.parse("part_root"),
        unsupportedFeatures: []
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
        texturePreviewReference: "assets/textures/face.preview.png",
        textureId: TextureIdSchema.parse("tex_face"),
        targetPartId: PartIdSchema.parse("part_root")
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
    ],
    compatibility: {
      structuredProfilePrecedence: "structured-profile-preferred-v1",
      flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
      flattenedUnsupportedFeaturesFallback:
        "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
    }
  }
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
  referenceKind: "package-binary-asset-ref-v1" as const,
  binaryAssetId: overrides.binaryAssetId,
  packageRelativePath: overrides.packageRelativePath,
  digest: {
    algorithm: "sha256" as const,
    hex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  },
  byteLength: 12,
  mediaType: overrides.mediaType,
  storageStatus: overrides.storageStatus,
  provenanceId: ProvenanceIdSchema.parse(overrides.provenanceId),
  rightsAssetId: overrides.rightsAssetId
});
