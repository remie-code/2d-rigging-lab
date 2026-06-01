import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { NormalizedRuntimeGraph } from "@private-2d-rigging-lab/runtime-core";
import { evaluateViewerRuntimeSnapshot } from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { createCheckCatalog } from "./check-catalog.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const PACKAGE_ID = PackageIdSchema.parse("pkg_part_texture_layer");
const ROOT_PART_ID = PartIdSchema.parse("part_root");
const HEAD_PART_ID = PartIdSchema.parse("part_head");
const BODY_DRAWABLE_ID = DrawableIdSchema.parse("draw_body");
const EYE_DRAWABLE_ID = DrawableIdSchema.parse("draw_eye");
const BODY_MESH_ID = MeshIdSchema.parse("mesh_body");
const EYE_MESH_ID = MeshIdSchema.parse("mesh_eye");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_layers");
const BODY_TEXTURE_ID = TextureIdSchema.parse("tex_body");
const EYE_TEXTURE_ID = TextureIdSchema.parse("tex_eye");
const MISSING_PART_ID = PartIdSchema.parse("part_missing");
const SOURCE_PROVENANCE_ID = ProvenanceIdSchema.parse("prov_source_layers");
const BODY_TEXTURE_PROVENANCE_ID = ProvenanceIdSchema.parse("prov_texture_body");
const EYE_TEXTURE_PROVENANCE_ID = ProvenanceIdSchema.parse("prov_texture_eye");
const BODY_PREVIEW_PROVENANCE_ID = ProvenanceIdSchema.parse("prov_preview_body");
const EYE_PREVIEW_PROVENANCE_ID = ProvenanceIdSchema.parse("prov_preview_eye");
const CREATED_AT = "2026-06-01T00:00:00.000Z";

describe("part, texture, and editor layer diagnostics", () => {
  it("registers deterministic part and editor-state checks in the catalog", () => {
    const catalog = createCheckCatalog();

    expect(catalog.has("ref.drawablePartMissing")).toBe(true);
    expect(catalog.has("part.parentMissing")).toBe(true);
    expect(catalog.has("part.childMissing")).toBe(true);
    expect(catalog.has("part.parentChildMismatch")).toBe(true);
    expect(catalog.has("part.cycle")).toBe(true);
    expect(catalog.has("part.drawableMembershipMismatch")).toBe(true);
    expect(catalog.has("editorState.staleReference")).toBe(true);
  });

  it("accepts valid part, texture, and editor layer state with runtime and viewer evidence", () => {
    const viewerResult = evaluateViewerRuntimeSnapshot(createRuntimeGraph(), {
      targetIds: [BODY_DRAWABLE_ID, EYE_DRAWABLE_ID]
    });

    const report = validatePackageRuntime({
      packageDocument: createPackageDocument(),
      runtimeSnapshot: viewerResult.snapshot,
      viewerEvidence: viewerResult.evidence,
      profile: "viewer",
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
    expect(report.evidence.runtimeSnapshotIds).toEqual([
      viewerResult.baselineSnapshot.snapshotId,
      viewerResult.snapshot.snapshotId
    ]);
  });

  it("reports missing drawable part and drawable membership mismatch deterministically", () => {
    const missingPartBaseDocument = clonePackageDocument(createPackageDocument());
    const missingPartDocument = {
      ...missingPartBaseDocument,
      model: {
        ...missingPartBaseDocument.model,
        graph: {
          ...missingPartBaseDocument.model.graph,
          parts: [
            {
              ...missingPartBaseDocument.model.graph.parts[0]!,
              drawableIds: []
            },
            missingPartBaseDocument.model.graph.parts[1]!
          ]
        },
        drawables: {
          ...missingPartBaseDocument.model.drawables,
          drawables: [
            {
              ...missingPartBaseDocument.model.drawables.drawables[0]!,
              partId: MISSING_PART_ID
            },
            missingPartBaseDocument.model.drawables.drawables[1]!
          ]
        }
      }
    };

    const missingPartReport = validatePackageRuntime({
      packageDocument: missingPartDocument,
      createdAt: CREATED_AT
    });

    expect(missingPartReport.checks).toEqual([
      expect.objectContaining({
        checkId: "ref.drawablePartMissing",
        status: "fail",
        severity: "error",
        targetPath: "/model/drawables/drawables/0/partId",
        evidence: [
          `drawableId=${BODY_DRAWABLE_ID}`,
          `partId=${MISSING_PART_ID}`,
          "partGraphMatch=missing"
        ]
      })
    ]);

    const membershipBaseDocument = clonePackageDocument(createPackageDocument());
    const membershipDocument = withGraphParts(membershipBaseDocument, [
      {
        ...membershipBaseDocument.model.graph.parts[0]!,
        drawableIds: []
      },
      membershipBaseDocument.model.graph.parts[1]!
    ]);

    const membershipReport = validatePackageRuntime({
      packageDocument: membershipDocument,
      createdAt: CREATED_AT
    });

    expect(membershipReport.checks).toEqual([
      expect.objectContaining({
        checkId: "part.drawableMembershipMismatch",
        status: "fail",
        severity: "error",
        targetPath: "/model/drawables/drawables/0/partId",
        evidence: [
          `drawableId=${BODY_DRAWABLE_ID}`,
          `drawablePartId=${ROOT_PART_ID}`,
          `partId=${ROOT_PART_ID}`,
          "partDrawableIds=",
          "reason=drawable-part-list-missing"
        ]
      })
    ]);
  });

  it("reports missing part parent and child references deterministically", () => {
    const parentMissingBaseDocument = clonePackageDocument(createPackageDocument());
    const parentMissingDocument = withGraphParts(parentMissingBaseDocument, [
      {
        ...parentMissingBaseDocument.model.graph.parts[0]!,
        childPartIds: []
      },
      {
        ...parentMissingBaseDocument.model.graph.parts[1]!,
        parentPartId: MISSING_PART_ID
      }
    ]);

    const parentMissingReport = validatePackageRuntime({
      packageDocument: parentMissingDocument,
      createdAt: CREATED_AT
    });

    expect(parentMissingReport.checks).toEqual([
      expect.objectContaining({
        checkId: "part.parentMissing",
        status: "fail",
        severity: "error",
        targetPath: "/model/graph/parts/1/parentPartId",
        evidence: [
          `partId=${HEAD_PART_ID}`,
          `parentPartId=${MISSING_PART_ID}`,
          "parentPartMatch=missing"
        ]
      })
    ]);

    const childMissingBaseDocument = clonePackageDocument(createPackageDocument());
    const childMissingDocument = withGraphParts(childMissingBaseDocument, [
      {
        ...childMissingBaseDocument.model.graph.parts[0]!,
        childPartIds: [HEAD_PART_ID, MISSING_PART_ID]
      },
      childMissingBaseDocument.model.graph.parts[1]!
    ]);

    const childMissingReport = validatePackageRuntime({
      packageDocument: childMissingDocument,
      createdAt: CREATED_AT
    });

    expect(childMissingReport.checks).toEqual([
      expect.objectContaining({
        checkId: "part.childMissing",
        status: "fail",
        severity: "error",
        targetPath: "/model/graph/parts/0/childPartIds/1",
        evidence: [
          `partId=${ROOT_PART_ID}`,
          `childPartId=${MISSING_PART_ID}`,
          "childPartMatch=missing"
        ]
      })
    ]);
  });

  it("reports part parent/child mismatch and part cycles deterministically", () => {
    const mismatchBaseDocument = clonePackageDocument(createPackageDocument());
    const { parentPartId: _removedParentPartId, ...headPartWithoutParent } =
      mismatchBaseDocument.model.graph.parts[1]!;
    const mismatchDocument = withGraphParts(mismatchBaseDocument, [
      mismatchBaseDocument.model.graph.parts[0]!,
      headPartWithoutParent
    ]);

    const mismatchReport = validatePackageRuntime({
      packageDocument: mismatchDocument,
      createdAt: CREATED_AT
    });

    expect(mismatchReport.checks).toEqual([
      expect.objectContaining({
        checkId: "part.parentChildMismatch",
        targetPath: "/model/graph/parts/0/childPartIds/0",
        evidence: [
          `partId=${ROOT_PART_ID}`,
          `relatedPartId=${HEAD_PART_ID}`,
          "partParentPartId=missing",
          "relatedParentPartId=missing",
          `partChildPartIds=${HEAD_PART_ID}`,
          "relatedChildPartIds=",
          "reason=child-parent-id-mismatch"
        ]
      })
    ]);

    const cycleBaseDocument = clonePackageDocument(createPackageDocument());
    const cycleDocument = withGraphParts(cycleBaseDocument, [
      {
        ...cycleBaseDocument.model.graph.parts[0]!,
        parentPartId: HEAD_PART_ID
      },
      {
        ...cycleBaseDocument.model.graph.parts[1]!,
        childPartIds: [ROOT_PART_ID]
      }
    ]);

    const cycleReport = validatePackageRuntime({
      packageDocument: cycleDocument,
      createdAt: CREATED_AT
    });

    expect(cycleReport.checks).toEqual([
      expect.objectContaining({
        checkId: "part.cycle",
        status: "fail",
        severity: "blocking",
        targetPath: "/model/graph/parts/0",
        evidence: [
          `cyclePath=${ROOT_PART_ID}->${HEAD_PART_ID}->${ROOT_PART_ID}`,
          "edgeSources=parentPartId,childPartIds"
        ]
      })
    ]);
  });

  it("reports missing texture atlas entries and texture/source mismatches", () => {
    const missingTextureDocument = clonePackageDocument(createPackageDocument());
    missingTextureDocument.assets.textureAtlas!.textures = missingTextureDocument.assets.textureAtlas!.textures.filter(
      (texture) => texture.textureId !== BODY_TEXTURE_ID
    );

    const missingTextureReport = validatePackageRuntime({
      packageDocument: missingTextureDocument,
      createdAt: CREATED_AT
    });

    expect(missingTextureReport.checks.map((check) => check.checkId)).toEqual([
      "ref.drawableTextureMissing"
    ]);
    expect(missingTextureReport.checks[0]!).toMatchObject({
      status: "fail",
      severity: "error",
      targetPath: "/model/drawables/drawables/0/textureId"
    });

    const mismatchDocument = clonePackageDocument(createPackageDocument());
    mismatchDocument.assets.textureAtlas!.textures[0]!.sourceLayerId = "layer_eye";
    mismatchDocument.assets.textureAtlas!.previewAssets![0]!.sourceLayerId = "layer_eye";

    const mismatchReport = validatePackageRuntime({
      packageDocument: mismatchDocument,
      createdAt: CREATED_AT
    });

    expect(mismatchReport.checks).toEqual([
      expect.objectContaining({
        checkId: "ref.textureSourceLayerMismatch",
        status: "fail",
        severity: "error",
        targetPath: "/model/drawables/drawables/0/textureId",
        evidence: expect.arrayContaining([
          `textureId=${BODY_TEXTURE_ID}`,
          `drawableId=${BODY_DRAWABLE_ID}`,
          "textureSourceLayerId=layer_eye",
          "expectedSourceLayerId=layer_body",
          "reason=drawable-texture-source-layer-mismatch"
        ])
      })
    ]);
  });

  it("keeps editor-only selection, lock, and hide stale references as warnings", () => {
    const document = clonePackageDocument(createPackageDocument());
    document.model.editorState!.selection = ["draw_missing"];
    document.model.editorState!.lockedIds = ["part_missing"];
    document.model.editorState!.editorHiddenIds = ["draw_hidden_missing"];

    const report = validatePackageRuntime({
      packageDocument: document,
      createdAt: CREATED_AT
    });

    expect(report.summary).toMatchObject({
      status: "warning",
      highestSeverity: "warning"
    });
    expect(report.checks).toEqual([
      expect.objectContaining({
        checkId: "editorState.staleReference",
        status: "warning",
        severity: "warning",
        targetPath: "/model/editorState/selection/0",
        evidence: [
          "editorStateCollection=selection",
          "editorStateRef=draw_missing",
          "targetMatch=missing",
          "runtimeSemantics=unchanged"
        ]
      }),
      expect.objectContaining({
        checkId: "editorState.staleReference",
        status: "warning",
        severity: "warning",
        targetPath: "/model/editorState/lockedIds/0",
        evidence: [
          "editorStateCollection=lockedIds",
          "editorStateRef=part_missing",
          "targetMatch=missing",
          "runtimeSemantics=unchanged"
        ]
      }),
      expect.objectContaining({
        checkId: "editorState.staleReference",
        status: "warning",
        severity: "warning",
        targetPath: "/model/editorState/editorHiddenIds/0",
        evidence: [
          "editorStateCollection=editorHiddenIds",
          "editorStateRef=draw_hidden_missing",
          "targetMatch=missing",
          "runtimeSemantics=unchanged"
        ]
      })
    ]);
  });

  it("does not let editor-only hide mask runtime texture semantics", () => {
    const document = clonePackageDocument(createPackageDocument());
    document.assets.textureAtlas!.textures = document.assets.textureAtlas!.textures.filter(
      (texture) => texture.textureId !== BODY_TEXTURE_ID
    );
    document.model.editorState!.editorHiddenIds = [BODY_DRAWABLE_ID];

    const report = validatePackageRuntime({
      packageDocument: document,
      createdAt: CREATED_AT
    });

    expect(report.summary.status).toBe("fail");
    expect(report.checks.map((check) => check.checkId)).toEqual([
      "ref.drawableTextureMissing"
    ]);
  });
});

type TestPackageDocument = PackageDocumentDto;

const clonePackageDocument = (document: TestPackageDocument): TestPackageDocument =>
  JSON.parse(JSON.stringify(document)) as TestPackageDocument;

const withGraphParts = (
  document: TestPackageDocument,
  parts: TestPackageDocument["model"]["graph"]["parts"]
): TestPackageDocument => ({
  ...document,
  model: {
    ...document.model,
    graph: {
      ...document.model.graph,
      parts
    }
  }
});

const createRuntimeGraph = (): NormalizedRuntimeGraph => ({
  packageId: PACKAGE_ID,
  packageRevision: 1,
  coordinateSystem: "canvas-y-down-v1",
  parameters: new Map(),
  dynamicsGroups: new Map(),
  drawables: new Map([
    [
      BODY_DRAWABLE_ID,
      {
        drawableId: BODY_DRAWABLE_ID,
        meshId: BODY_MESH_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 0,
        bounds: {
          x: 0,
          y: 0,
          width: 16,
          height: 16
        },
        vertexCount: 3,
        vertexHash: "hash_draw_body_3"
      }
    ],
    [
      EYE_DRAWABLE_ID,
      {
        drawableId: EYE_DRAWABLE_ID,
        meshId: EYE_MESH_ID,
        visible: true,
        opacity: 1,
        baseDrawOrder: 1,
        bounds: {
          x: 4,
          y: 4,
          width: 4,
          height: 4
        },
        vertexCount: 3,
        vertexHash: "hash_draw_eye_3"
      }
    ]
  ]),
  rigControls: new Map(),
  keyformBindings: [],
  masks: [],
  drawOrder: [
    {
      drawableId: BODY_DRAWABLE_ID,
      drawOrder: 0
    },
    {
      drawableId: EYE_DRAWABLE_ID,
      drawOrder: 1
    }
  ],
  disabledFutureLayers: []
});

const createPackageDocument = (): TestPackageDocument => PackageDocumentSchema.parse({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1",
    packageId: PACKAGE_ID,
    packageDisplayName: "Part Texture Layer",
    formatVersion: "open-model-package-v1",
    packageRevision: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    schemaVersions: {},
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
      drawOrder: "model/draw-order.json",
      editorState: "model/editor-state.json"
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
          partId: ROOT_PART_ID,
          displayName: "Root",
          childPartIds: [HEAD_PART_ID],
          drawableIds: [BODY_DRAWABLE_ID]
        },
        {
          partId: HEAD_PART_ID,
          displayName: "Head",
          parentPartId: ROOT_PART_ID,
          childPartIds: [],
          drawableIds: [EYE_DRAWABLE_ID]
        }
      ],
      rigControlRootIds: [],
      stableOrder: [ROOT_PART_ID, HEAD_PART_ID, BODY_DRAWABLE_ID, EYE_DRAWABLE_ID]
    },
    drawables: {
      schemaVersion: "drawables-file-v1",
      drawables: [
        createDrawable({
          drawableId: BODY_DRAWABLE_ID,
          displayName: "Body",
          partId: ROOT_PART_ID,
          textureId: BODY_TEXTURE_ID,
          meshId: BODY_MESH_ID,
          baseDrawOrder: 0
        }),
        createDrawable({
          drawableId: EYE_DRAWABLE_ID,
          displayName: "Eye",
          partId: HEAD_PART_ID,
          textureId: EYE_TEXTURE_ID,
          meshId: EYE_MESH_ID,
          baseDrawOrder: 1
        })
      ]
    },
    meshes: {
      schemaVersion: "meshes-file-v1",
      meshes: [
        createMesh(BODY_MESH_ID, BODY_DRAWABLE_ID),
        createMesh(EYE_MESH_ID, EYE_DRAWABLE_ID)
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
          drawableId: BODY_DRAWABLE_ID,
          baseDrawOrder: 0,
          stableOrder: 0
        },
        {
          drawableId: EYE_DRAWABLE_ID,
          baseDrawOrder: 1,
          stableOrder: 1
        }
      ]
    },
    editorState: {
      schemaVersion: "editor-state-v1",
      selection: [BODY_DRAWABLE_ID as string],
      lockedIds: [HEAD_PART_ID as string],
      editorHiddenIds: [EYE_DRAWABLE_ID as string],
      activeTool: "layerTree",
      canvas: {
        zoom: 1,
        pan: {
          x: 0,
          y: 0
        }
      }
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: SOURCE_ASSET_ID,
          kind: "generated-fixture-v1",
          filePath: "assets/sources/layers.png",
          contentHash: "sha256:source-layers",
          importProfile: "split-png-fallback-v1",
          layers: [
            createSourceLayer("layer_body", "Body", BODY_DRAWABLE_ID),
            createSourceLayer("layer_eye", "Eye", EYE_DRAWABLE_ID)
          ],
          diagnostics: []
        }
      ]
    },
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: [
        createTextureEntry(BODY_TEXTURE_ID, "body", "layer_body", BODY_TEXTURE_PROVENANCE_ID),
        createTextureEntry(EYE_TEXTURE_ID, "eye", "layer_eye", EYE_TEXTURE_PROVENANCE_ID)
      ],
      previewAssets: [
        createPreviewAsset(BODY_TEXTURE_ID, "body", "layer_body", BODY_PREVIEW_PROVENANCE_ID, "asset_preview_body"),
        createPreviewAsset(EYE_TEXTURE_ID, "eye", "layer_eye", EYE_PREVIEW_PROVENANCE_ID, "asset_preview_eye")
      ]
    },
    provenance: {
      schemaVersion: "provenance-file-v1",
      records: [
        createProvenanceRecord(SOURCE_PROVENANCE_ID, SOURCE_ASSET_ID, "source", "assets/sources/layers.png"),
        createProvenanceRecord(BODY_TEXTURE_PROVENANCE_ID, BODY_TEXTURE_ID, "texture", "assets/textures/body.png"),
        createProvenanceRecord(EYE_TEXTURE_PROVENANCE_ID, EYE_TEXTURE_ID, "texture", "assets/textures/eye.png"),
        createProvenanceRecord(BODY_PREVIEW_PROVENANCE_ID, "asset_preview_body", "thumbnail", "assets/thumbnails/body.png"),
        createProvenanceRecord(EYE_PREVIEW_PROVENANCE_ID, "asset_preview_eye", "thumbnail", "assets/thumbnails/eye.png")
      ]
    },
    rights: {
      schemaVersion: "rights-file-v1",
      records: [
        createRightsRecord(SOURCE_ASSET_ID),
        createRightsRecord("asset_preview_body"),
        createRightsRecord("asset_preview_eye")
      ]
    }
  }
});

const createDrawable = (input: {
  readonly drawableId: string;
  readonly displayName: string;
  readonly partId: string;
  readonly textureId: string;
  readonly meshId: string;
  readonly baseDrawOrder: number;
}) => ({
  drawableId: input.drawableId,
  displayName: input.displayName,
  partId: input.partId,
  sourceAssetId: SOURCE_ASSET_ID,
  textureId: input.textureId,
  meshId: input.meshId,
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder: input.baseDrawOrder,
  sourceProvenanceId: SOURCE_PROVENANCE_ID
});

const createMesh = (meshId: string, drawableId: string) => ({
  meshId,
  drawableId,
  vertices: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
  ],
  uvs: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
  ],
  triangles: [[0, 1, 2]],
  vertexStableIds: [`${meshId}_v0`, `${meshId}_v1`, `${meshId}_v2`],
  bounds: {
    x: 0,
    y: 0,
    width: 1,
    height: 1
  },
  generationProvenanceId: SOURCE_PROVENANCE_ID
});

const createSourceLayer = (sourceLayerId: string, displayName: string, drawableId: string) => ({
  sourceLayerId,
  sourceAssetId: SOURCE_ASSET_ID,
  originalName: displayName,
  normalizedName: displayName.toLowerCase(),
  groupPath: ["Root"],
  bounds: {
    x: 0,
    y: 0,
    width: 16,
    height: 16
  },
  visibleInSource: true,
  opacityInSource: 1,
  role: "editableLayer",
  unsupportedFeatures: [],
  mappedDrawableIds: [drawableId]
});

const createTextureEntry = (
  textureId: string,
  name: string,
  sourceLayerId: string,
  provenanceId: string
) => ({
  textureId,
  filePath: `assets/textures/${name}.png`,
  contentHash: `sha256:texture-${name}`,
  sourceAssetId: SOURCE_ASSET_ID,
  sourceLayerId,
  provenanceId
});

const createPreviewAsset = (
  textureId: string,
  name: string,
  sourceLayerId: string,
  provenanceId: string,
  rightsAssetId: string
) => ({
  previewAssetId: `preview_${name}`,
  textureId,
  reference: {
    referenceKind: "deterministic-data-url-v1",
    dataUrl: "data:image/png;base64,AA=="
  },
  contentHash: `sha256:preview-${name}`,
  sourceAssetId: SOURCE_ASSET_ID,
  sourceLayerId,
  provenanceId,
  rightsAssetId
});

const createProvenanceRecord = (
  provenanceId: string,
  assetId: string,
  assetKind: "source" | "texture" | "thumbnail",
  filePath: string
) => ({
  provenanceId,
  assetId,
  assetKind,
  filePath,
  contentHash: `sha256:${assetId}`,
  creator: "validator-test",
  license: "internal-test",
  redistributionAllowed: false,
  aiUsed: false,
  transformHistory: [],
  relatedOperationIds: []
});

const createRightsRecord = (assetId: string) => ({
  assetId,
  rightsStatus: "cleared",
  license: "internal-test",
  redistributionAllowed: false
});
