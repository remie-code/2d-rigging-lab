import {
  describe,
  expect,
  it
} from "vitest";

import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import { ProvenanceIdSchema } from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

describe("PSD source profile validator diagnostics", () => {
  it("registers PSD source profile checks in the catalog", () => {
    expect(defaultCheckCatalog.has("asset.psd.unsupportedFeature")).toBe(true);
    expect(defaultCheckCatalog.has("rights.psdLayerProvenanceMissing")).toBe(true);
  });

  it("validates an adapter-backed PSD source profile with preview and provenance evidence", () => {
    const report = validatePsdPackage(createPsdPackageDocument());

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
  });

  it("reports unsupported PSD features as source-targeted diagnostics", () => {
    const document = createPsdPackageDocument();
    const sourceLayer = expectPsdLayer(document);

    sourceLayer.unsupportedFeatures = ["smartObject"];

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "asset.psd.unsupportedFeature");

    expect(report.summary.status).toBe("needs_review");
    expect(check).toMatchObject({
      checkId: "asset.psd.unsupportedFeature",
      status: "needs_review",
      severity: "warning",
      phase: "source_import",
      target: {
        kind: "sourceAsset",
        id: "src_psd_profile",
        path: "/assets/sourceManifest/sourceAssets/0/layers/0/unsupportedFeatures/0"
      },
      targetPath: "/assets/sourceManifest/sourceAssets/0/layers/0/unsupportedFeatures/0",
      relatedAC: ["AC-MVP-003", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-003"]
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceAssetId=src_psd_profile",
      "sourceKind=psd-source-v1",
      "importProfile=layered-character-psd-profile-v1",
      "sourceLayerId=psd_layer_body",
      "unsupportedFeature=smartObject",
      "flatteningStrategy=sourceLayer.unsupportedFeatures[]"
    ]));
  });

  it("reports missing PSD layer provenance through the drawable provenance contract", () => {
    const document = createPsdPackageDocument();
    const drawable = document.model.drawables.drawables[0];

    if (drawable === undefined) {
      throw new Error("Expected PSD fixture drawable.");
    }

    drawable.sourceProvenanceId = ProvenanceIdSchema.parse("prov_missing");

    const report = validatePsdPackage(document);
    const layerCheck = expectCheckById(report, "rights.psdLayerProvenanceMissing");

    expect(report.checks.map((check) => check.checkId)).toEqual([
      "rights.psdLayerProvenanceMissing",
      "rights.drawableProvenanceMissing"
    ]);
    expect(layerCheck).toMatchObject({
      checkId: "rights.psdLayerProvenanceMissing",
      status: "fail",
      severity: "error",
      phase: "rights",
      target: {
        kind: "sourceAsset",
        id: "src_psd_profile",
        path: "/assets/sourceManifest/sourceAssets/0/layers/0/mappedDrawableIds/0"
      },
      targetPath: "/assets/sourceManifest/sourceAssets/0/layers/0/mappedDrawableIds/0"
    });
    expect(layerCheck.evidence).toEqual(expect.arrayContaining([
      "sourceLayerId=psd_layer_body",
      "mappedDrawableId=draw_psd_body",
      "sourceProvenanceId=prov_missing",
      "reason=drawable-source-provenance-missing",
      "contractSupport=drawable.sourceProvenanceId"
    ]));
  });

  it("reports missing texture preview for a visible PSD-backed drawable", () => {
    const document = createPsdPackageDocument();

    delete document.assets.textureAtlas?.previewAssets;

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "ref.texturePreviewMissing");

    expect(check).toMatchObject({
      checkId: "ref.texturePreviewMissing",
      status: "fail",
      severity: "error",
      target: {
        kind: "texture",
        id: "tex_psd_body",
        path: "/assets/textureAtlas/previewAssets"
      },
      targetPath: "/assets/textureAtlas/previewAssets"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "drawableId=draw_psd_body",
      "textureId=tex_psd_body",
      "previewAssetMatch=missing",
      "sourceAssetId=src_psd_profile",
      "sourceKind=psd-source-v1"
    ]));
  });

  it("reports source-layer mismatch for PSD texture and drawable mappings", () => {
    const document = createPsdPackageDocument();
    const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
    const sourceLayer = sourceAsset?.layers[0];
    const textureEntry = document.assets.textureAtlas?.textures[0];
    const previewAsset = document.assets.textureAtlas?.previewAssets?.[0];

    if (sourceAsset === undefined || sourceLayer === undefined || textureEntry === undefined || previewAsset === undefined) {
      throw new Error("Expected PSD texture mapping fixture inputs.");
    }

    sourceAsset.layers.push({
      ...structuredClone(sourceLayer),
      sourceLayerId: "psd_layer_other",
      originalName: "Other",
      normalizedName: "other",
      mappedDrawableIds: []
    });
    textureEntry.sourceLayerId = "psd_layer_other";
    previewAsset.sourceLayerId = "psd_layer_other";

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "ref.textureSourceLayerMismatch");

    expect(report.checks.map((candidate) => candidate.checkId)).toEqual([
      "ref.textureSourceLayerMismatch"
    ]);
    expect(check).toMatchObject({
      checkId: "ref.textureSourceLayerMismatch",
      status: "fail",
      severity: "error",
      target: {
        kind: "texture",
        id: "tex_psd_body",
        path: "/model/drawables/drawables/0/textureId"
      },
      targetPath: "/model/drawables/drawables/0/textureId"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "drawableId=draw_psd_body",
      "drawableSourceAssetId=src_psd_profile",
      "textureSourceLayerId=psd_layer_other",
      "previewSourceLayerId=psd_layer_other",
      "expectedSourceLayerId=psd_layer_body",
      "reason=drawable-texture-source-layer-mismatch"
    ]));
  });

  it("keeps split PNG fallback validators on the existing compatible path", () => {
    const document = createPsdPackageDocument();
    const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
    const sourceProvenance = document.assets.provenance.records.find((record) => record.assetId === "src_psd_profile");

    if (sourceAsset === undefined || sourceProvenance === undefined) {
      throw new Error("Expected source fixture inputs.");
    }

    sourceAsset.kind = "split-png-set-v1";
    sourceAsset.importProfile = "split-png-fallback-v1";
    sourceAsset.filePath = "assets/sources/split/body.png";
    sourceAsset.diagnostics = ["source.psd.absent"];
    sourceProvenance.filePath = "assets/sources/split/body.png";

    const report = validatePsdPackage(document);

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
  });
});

const validatePsdPackage = (document: PackageDocumentDto): ValidationReportDto =>
  validatePackageRuntime({
    packageDocument: document,
    createdAt: "2026-05-31T00:00:00.000Z"
  });

const expectPsdLayer = (document: PackageDocumentDto) => {
  const sourceLayer = document.assets.sourceManifest.sourceAssets[0]?.layers[0];

  if (sourceLayer === undefined) {
    throw new Error("Expected PSD fixture source layer.");
  }

  return sourceLayer;
};

const expectCheckById = (
  report: ValidationReportDto,
  checkId: string
): ValidationReportDto["checks"][number] => {
  const check = report.checks.find((candidate) => candidate.checkId === checkId);

  if (check === undefined) {
    throw new Error(`Expected validation check ${checkId}.`);
  }

  return check;
};

const createPsdPackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: "pkg_psd_profile_validator",
      packageDisplayName: "PSD Profile Validator",
      formatVersion: "open-model-package-v1",
      packageRevision: 0,
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:00:00.000Z",
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
          width: 2048,
          height: 3072
        },
        parts: [
          {
            partId: "part_body",
            displayName: "Body",
            childPartIds: [],
            drawableIds: ["draw_psd_body"]
          }
        ],
        rigControlRootIds: [],
        stableOrder: ["part_body", "draw_psd_body", "mesh_psd_body"]
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: [
          {
            drawableId: "draw_psd_body",
            displayName: "Body",
            partId: "part_body",
            sourceAssetId: "src_psd_profile",
            textureId: "tex_psd_body",
            meshId: "mesh_psd_body",
            defaultOpacity: 0.9,
            runtimeVisibility: true,
            baseDrawOrder: 0,
            sourceProvenanceId: "prov_psd_source"
          }
        ]
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: [
          {
            meshId: "mesh_psd_body",
            drawableId: "draw_psd_body",
            vertices: [
              { x: 0, y: 0 },
              { x: 128, y: 0 },
              { x: 0, y: 128 }
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
              width: 128,
              height: 128
            },
            generationProvenanceId: "prov_psd_source"
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
        schemaVersion: "dynamics-file-v1",
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
            drawableId: "draw_psd_body",
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
            sourceAssetId: "src_psd_profile",
            kind: "psd-source-v1",
            filePath: "assets/sources/character.psd",
            contentHash: "sha256:adapter-backed-psd-source-profile",
            importProfile: "layered-character-psd-profile-v1",
            layers: [
              {
                sourceLayerId: "psd_layer_body",
                sourceAssetId: "src_psd_profile",
                originalName: "Body",
                normalizedName: "body",
                groupPath: ["Root"],
                bounds: {
                  x: 0,
                  y: 0,
                  width: 128,
                  height: 128
                },
                visibleInSource: true,
                opacityInSource: 0.9,
                role: "editableLayer",
                unsupportedFeatures: [],
                mappedDrawableIds: ["draw_psd_body"]
              }
            ],
            diagnostics: [
              "profile.adapterResultSupplied"
            ]
          }
        ]
      },
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: "tex_psd_body",
            filePath: "assets/textures/psd/body.png",
            contentHash: "sha256:psd-texture-body",
            sourceAssetId: "src_psd_profile",
            sourceLayerId: "psd_layer_body",
            provenanceId: "prov_psd_texture"
          }
        ],
        previewAssets: [
          {
            previewAssetId: "preview_psd_body",
            textureId: "tex_psd_body",
            reference: {
              referenceKind: "deterministic-data-url-v1",
              dataUrl: "data:image/png;base64,iVBORw0KGgo="
            },
            contentHash: "sha256:psd-preview-body",
            sourceAssetId: "src_psd_profile",
            sourceLayerId: "psd_layer_body",
            provenanceId: "prov_psd_texture",
            rightsAssetId: "tex_psd_body"
          }
        ]
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: "prov_psd_source",
            assetId: "src_psd_profile",
            assetKind: "source",
            filePath: "assets/sources/character.psd",
            contentHash: "sha256:adapter-backed-psd-source-profile",
            creator: "contract-fixture",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            aiUsed: false,
            transformHistory: [
              "Adapter-backed PSD source profile fixture; no PSD bytes parsed by validator."
            ],
            relatedOperationIds: []
          },
          {
            provenanceId: "prov_psd_texture",
            assetId: "tex_psd_body",
            assetKind: "texture",
            filePath: "assets/textures/psd/body.png",
            contentHash: "sha256:psd-texture-body",
            creator: "contract-fixture",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            aiUsed: false,
            transformHistory: [
              "Texture preview reference supplied by adapter result; no PSD raster extraction in validator."
            ],
            relatedOperationIds: []
          }
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: "src_psd_profile",
            rightsStatus: "cleared",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            notes: "Synthetic adapter-backed PSD profile metadata; no PSD binary fixture."
          },
          {
            assetId: "tex_psd_body",
            rightsStatus: "cleared",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            notes: "Deterministic preview texture metadata for validator diagnostics."
          }
        ]
      }
    }
  });
