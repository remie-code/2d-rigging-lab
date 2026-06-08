import {
  describe,
  expect,
  it
} from "vitest";

import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { ProductPreflightCategoryResultDto } from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import { buildProductPreflightReport } from "./product-preflight-report.js";
import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

const CREATED_AT = "2026-06-07T00:00:00.000Z";
const PACKAGE_ID = "pkg_wave50_psd_structural";
const SOURCE_ASSET_ID = "src_wave50_psd";
const SOURCE_PROVENANCE_ID = "prov_wave50_psd_source";
const SOURCE_BINARY_ID = "bin_wave50_psd_source";
const SOURCE_DIGEST = {
  algorithm: "sha256",
  hex: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
} as const;
const OTHER_DIGEST = {
  algorithm: "sha256",
  hex: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
} as const;
const PLAN_DIGEST = {
  algorithm: "sha256",
  hex: "1111111111111111111111111111111111111111111111111111111111111111"
} as const;
const APPROVAL_DIGEST = {
  algorithm: "sha256",
  hex: "2222222222222222222222222222222222222222222222222222222222222222"
} as const;
const SOURCE_BYTE_LENGTH = 2048;
const PARENT_PART_ID = "part_wave50_root";
const GROUP_PART_ID = "part_wave50_hair";
const VISIBLE_DRAWABLE_ID = "draw_wave50_front_hair";
const SECOND_DRAWABLE_ID = "draw_wave50_back_hair";
const HIDDEN_DRAWABLE_ID = "draw_wave50_hidden_hat";

describe("Wave50 PSD structural scaffold Product Preflight diagnostics", () => {
  it("registers structural scaffold check ids in the catalog", () => {
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldEvidenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldAvailable")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldPreflightBlocked")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldPlanStale")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldApprovalMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldSourceGroupMappingMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldSourceLayerMappingMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldParentageMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldSourceOrderMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralScaffoldGeneratedRefCollision")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralInitialRuntimeVisibilityMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuralGroupForbiddenDrawableClaim")).toBe(true);
  });

  it("accepts structural operation evidence and contributes sourceMaterialization evidence refs", () => {
    const fixture = createStructuralFixture();
    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [fixture.evidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findCategory(
      buildPreflight(report, "preflight_wave50_structural_available"),
      "assetBytes"
    );

    expect(report.summary.status).toBe("pass");
    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.structuralScaffoldAvailable"
    ]));
    expect(expectCheckById(report, "asset.psd.structuralScaffoldAvailable").evidence).toEqual(
      expect.arrayContaining([
        "structuralScaffoldAvailability=available",
        "groupsAsPartContainersOnly=true",
        "hiddenLeafRuntimeVisibility=validated",
        "validatorBoundary=no-parser-execution",
        "semanticRecognition=notProvided",
        "rendererPixelOracle=notClaimed"
      ])
    );
    expect(assetBytes.status).toBe("pass");
    expect(assetBytes.evidenceRefs).toEqual([
      expect.objectContaining({
        artifactRef: expect.objectContaining({
          artifactKind: "sourceMaterialization"
        }),
        producer: "validatorCore"
      })
    ]);
  });

  it("projects preflight-blocked structural evidence and collision issues as blocking diagnostics", () => {
    const fixture = createStructuralFixture({ storeStructuralEvidence: false });
    fixture.evidence.aggregateStatus = "preflightBlocked";
    fixture.evidence.issues = [
      createStructuralIssue("structuralGeneratedRefCollision", 0, {
        message: "Generated drawable id collision."
      })
    ];

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [fixture.evidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findCategory(
      buildPreflight(report, "preflight_wave50_structural_blocked"),
      "assetBytes"
    );

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.structuralScaffoldPreflightBlocked",
      "asset.psd.structuralScaffoldGeneratedRefCollision"
    ]));
    expect(assetBytes.status).toBe("fail");
    expect(assetBytes.blockingReasons.map((reason) => reason.reasonCode)).toEqual(
      expect.arrayContaining(["failingDiagnostic"])
    );
  });

  it("blocks hidden leaf generated drawables that remain runtime visible", () => {
    const fixture = createStructuralFixture({ storeStructuralEvidence: false });
    expectDrawable(fixture.document, HIDDEN_DRAWABLE_ID).runtimeVisibility = true;

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [fixture.evidence],
      createdAt: CREATED_AT
    });
    const composition = findCategory(
      buildPreflight(report, "preflight_wave50_structural_hidden_mismatch"),
      "composition"
    );

    expect(expectCheckById(report, "asset.psd.structuralInitialRuntimeVisibilityMismatch")).toMatchObject({
      status: "fail",
      severity: "error"
    });
    expect(composition.status).toBe("fail");
  });

  it("diagnoses missing generated group parent, leaf parent, drawable, texture, and mesh refs", () => {
    const fixture = createStructuralFixture({ storeStructuralEvidence: false });
    fixture.evidence.generatedGroupPartScaffolds[0]!.generatedParentPartId = "part_wave50_missing_group_parent";
    fixture.evidence.generatedLeafScaffolds[0]!.generatedParentPartId = "part_wave50_missing_leaf_parent";
    fixture.document.model.drawables.drawables = fixture.document.model.drawables.drawables.filter(
      (drawable) => drawable.drawableId !== SECOND_DRAWABLE_ID
    );
    fixture.document.model.meshes.meshes = fixture.document.model.meshes.meshes.filter(
      (mesh) => mesh.meshId !== "mesh_wave50_front_hair"
    );
    fixture.document.assets.textureAtlas!.textures = fixture.document.assets.textureAtlas!.textures.filter(
      (texture) => texture.textureId !== "tex_wave50_front_hair"
    );

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [fixture.evidence],
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.structuralScaffoldGeneratedParentMissing",
      "asset.psd.structuralScaffoldGeneratedDrawableMissing",
      "asset.psd.structuralScaffoldGeneratedTextureMissing",
      "asset.psd.structuralScaffoldGeneratedMeshMissing"
    ]));
  });

  it("diagnoses nested leaves routed to an existing but wrong generated parent part", () => {
    const fixture = createStructuralFixture({ storeStructuralEvidence: false });
    const leaf = fixture.evidence.generatedLeafScaffolds[0]!;
    leaf.generatedParentPartId = PARENT_PART_ID;
    const visibleDrawable = expectDrawable(fixture.document, VISIBLE_DRAWABLE_ID);
    const rootPart = expectPart(fixture.document, PARENT_PART_ID);
    const groupPart = expectPart(fixture.document, GROUP_PART_ID);
    visibleDrawable.partId = rootPart.partId;
    rootPart.drawableIds = [...rootPart.drawableIds, visibleDrawable.drawableId];
    groupPart.drawableIds = groupPart.drawableIds.filter((drawableId) =>
      drawableId !== visibleDrawable.drawableId
    );

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [fixture.evidence],
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toContain(
      "asset.psd.structuralScaffoldParentageMismatch"
    );
    expect(expectCheckById(report, "asset.psd.structuralScaffoldParentageMismatch").evidence).toEqual(
      expect.arrayContaining([
        `sourceParentGeneratedPartId:expected=${GROUP_PART_ID},actual=${PARENT_PART_ID}`
      ])
    );
    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.structuralScaffoldGeneratedRefMismatch"
    );
  });

  it("projects stale approval and source mapping issue kinds from structural evidence", () => {
    const fixture = createStructuralFixture({ storeStructuralEvidence: false });
    fixture.evidence.issues = [
      createStructuralIssue("structuralPlanStale", 0),
      createStructuralIssue("staleApproval", 1),
      createStructuralIssue("sourceGroupMappingMissing", 2, {
        sourceGroupRef: createSourceGroupRef()
      }),
      createStructuralIssue("sourceLayerMappingMissing", 3, {
        sourceLayerRef: createSourceLayerRef("psd:root/group[0]/layer[0]", "Front hair", ["Hair", "Front hair"])
      }),
      createStructuralIssue("currentSessionSourceMissing", 4)
    ];

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [fixture.evidence],
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.structuralScaffoldPlanStale",
      "asset.psd.structuralScaffoldApprovalMismatch",
      "asset.psd.structuralScaffoldSourceGroupMappingMissing",
      "asset.psd.structuralScaffoldSourceLayerMappingMissing",
      "asset.psd.structuralScaffoldSourceCurrentBytesMissing"
    ]));
    expect(expectCheckById(report, "asset.psd.structuralScaffoldSourceCurrentBytesMissing")).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
  });

  it("reports missing current source bytes as not evaluated without structural availability", () => {
    const fixture = createStructuralFixture({ storeStructuralEvidence: false });
    delete fixture.document.assets.sourceManifest.sourceAssets[0]!.binaryAssetRef;

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [fixture.evidence],
      createdAt: CREATED_AT
    });
    const assetBytes = findCategory(
      buildPreflight(report, "preflight_wave50_structural_source_bytes_missing"),
      "assetBytes"
    );

    expect(expectCheckById(report, "asset.psd.structuralScaffoldSourceCurrentBytesMissing")).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(report.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.structuralScaffoldAvailable"
    );
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.structuralScaffoldSourceCurrentBytesMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("reports not-evaluated only when structural plan or approval evidence exists without operation evidence", () => {
    const withoutStructuralPlan = createStructuralFixture({ storeStructuralEvidence: false });
    const noStructuralReport = validatePackageRuntime({
      packageDocument: withoutStructuralPlan.document,
      createdAt: CREATED_AT
    });
    expect(noStructuralReport.checks.map((check) => check.checkId)).not.toContain(
      "asset.psd.structuralScaffoldEvidenceMissing"
    );

    const withStructuralPlan = createStructuralFixture();
    const report = validatePackageRuntime({
      packageDocument: withStructuralPlan.document,
      createdAt: CREATED_AT
    });
    const assetBytes = findCategory(
      buildPreflight(report, "preflight_wave50_structural_missing"),
      "assetBytes"
    );

    expect(expectCheckById(report, "asset.psd.structuralScaffoldEvidenceMissing")).toMatchObject({
      status: "needs_review",
      severity: "warning"
    });
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.structuralScaffoldEvidenceMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("rejects malformed group drawable claims and malformed initial runtime visibility evidence", () => {
    const fixture = createStructuralFixture({ storeStructuralEvidence: false });
    const malformed = clone(fixture.evidence) as Record<string, unknown>;
    const group = (malformed.generatedGroupPartScaffolds as Array<Record<string, unknown>>)[0]!;
    group.generatedDrawableId = "draw_wave50_forbidden_group";
    const leaf = (malformed.generatedLeafScaffolds as Array<Record<string, unknown>>)[2]!;
    leaf.initialRuntimeVisibility = true;

    const report = validatePackageRuntime({
      packageDocument: fixture.document,
      psdStructuralScaffoldEvidence: [malformed],
      createdAt: CREATED_AT
    });

    expect(report.checks.map((check) => check.checkId)).toEqual(expect.arrayContaining([
      "asset.psd.structuralScaffoldEvidenceMismatch",
      "asset.psd.structuralGroupForbiddenDrawableClaim",
      "asset.psd.structuralInitialRuntimeVisibilityMismatch"
    ]));
  });
});

const createStructuralFixture = (
  options: { readonly storeStructuralEvidence?: boolean } = {}
) => {
  const storeStructuralEvidence = options.storeStructuralEvidence ?? true;
  const groupScaffold = createGroupScaffold();
  const leafScaffolds = [
    createLeafScaffold({
      sourceLayerId: "psd:root/group[0]/layer[0]",
      sourceLayerName: "Front hair",
      sourceLayerPath: ["Hair", "Front hair"],
      sourceOrder: 2,
      visibleInSource: true,
      generatedDrawableId: VISIBLE_DRAWABLE_ID,
      generatedMeshId: "mesh_wave50_front_hair",
      generatedTextureId: "tex_wave50_front_hair"
    }),
    createLeafScaffold({
      sourceLayerId: "psd:root/group[0]/layer[1]",
      sourceLayerName: "Back hair",
      sourceLayerPath: ["Hair", "Back hair"],
      sourceOrder: 3,
      visibleInSource: true,
      generatedDrawableId: SECOND_DRAWABLE_ID,
      generatedMeshId: "mesh_wave50_back_hair",
      generatedTextureId: "tex_wave50_back_hair"
    }),
    createLeafScaffold({
      sourceLayerId: "psd:root/layer[0]",
      sourceLayerName: "Hidden hat",
      sourceLayerPath: ["Hidden hat"],
      sourceOrder: 1,
      visibleInSource: false,
      generatedParentPartId: PARENT_PART_ID,
      generatedDrawableId: HIDDEN_DRAWABLE_ID,
      generatedMeshId: "mesh_wave50_hidden_hat",
      generatedTextureId: "tex_wave50_hidden_hat"
    })
  ];
  const bridge = createBridge(groupScaffold, leafScaffolds);
  const evidence = {
    schemaVersion: "psd-structural-scaffold-operation-evidence-v1" as const,
    operationType: "importPsdStructuralScaffold" as const,
    evidenceId: "evidence_wave50_structural",
    operationId: "op_wave50_structural",
    batchId: "batch_wave50_structural",
    sourceAssetId: SOURCE_ASSET_ID,
    destination: {
      destinationKind: "structuralScaffold" as const,
      parentPartId: PARENT_PART_ID
    },
    structuralScaffoldBridge: bridge,
    aggregateStatus: "success" as "success" | "preflightBlocked" | "failure",
    generatedGroupPartScaffolds: [groupScaffold],
    generatedLeafScaffolds: leafScaffolds,
    issues: [] as ReturnType<typeof createStructuralIssue>[],
    preflightPolicy: {
      approvedLeafLimit: 256,
      approvedGroupLimit: 128,
      generatedNodeLimit: 512,
      totalRawRgbaByteLimit: 256 * 1024 * 1024,
      mutationPolicy: "preflightBlocksOnAnyFailure" as const,
      silentPartialSuccess: "forbidden" as const
    },
    persistenceBoundary: {
      rawParserObjectPersistence: "notPersisted" as const,
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
      materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes" as const,
      photoshopCompositingClaim: "none" as const,
      rendererPixelOracleClaim: "none" as const,
      initialGridMeshGeneration: "notProvided" as const,
      semanticRecognition: "notProvided" as const,
      repoProposalGeneration: "notProvided" as const
    }
  };

  const document = PackageDocumentSchema.parse(createPackageDocument({
    bridge,
    groupScaffold,
    leafScaffolds,
    storeStructuralEvidence
  }));

  return { document, evidence };
};

const createPackageDocument = (input: {
  readonly bridge: ReturnType<typeof createBridge>;
  readonly groupScaffold: ReturnType<typeof createGroupScaffold>;
  readonly leafScaffolds: readonly ReturnType<typeof createLeafScaffold>[];
  readonly storeStructuralEvidence: boolean;
}) => ({
  manifest: {
    schemaVersion: "open-model-package-manifest-v1" as const,
    packageId: PACKAGE_ID,
    packageDisplayName: "Wave50 Structural Package",
    formatVersion: "open-model-package-v1" as const,
    packageRevision: 0,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    schemaVersions: {
      manifest: "open-model-package-manifest-v1"
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
      schemaVersion: "model-graph-v1" as const,
      coordinateSystem: "canvas-y-down-v1" as const,
      canvasSize: { width: 1024, height: 1024 },
      parts: [
        {
          partId: PARENT_PART_ID,
          displayName: "Root",
          childPartIds: [GROUP_PART_ID],
          drawableIds: [HIDDEN_DRAWABLE_ID]
        },
        {
          partId: GROUP_PART_ID,
          displayName: "Hair",
          parentPartId: PARENT_PART_ID,
          childPartIds: [],
          drawableIds: [VISIBLE_DRAWABLE_ID, SECOND_DRAWABLE_ID]
        }
      ],
      rigControlRootIds: [],
      stableOrder: [
        PARENT_PART_ID,
        GROUP_PART_ID,
        HIDDEN_DRAWABLE_ID,
        VISIBLE_DRAWABLE_ID,
        SECOND_DRAWABLE_ID
      ]
    },
    drawables: {
      schemaVersion: "drawables-file-v1" as const,
      drawables: input.leafScaffolds.map((leaf) => ({
        drawableId: leaf.generatedDrawableId,
        displayName: leaf.generatedDrawableDisplayName,
        partId: leaf.generatedParentPartId,
        sourceAssetId: SOURCE_ASSET_ID,
        textureId: leaf.generatedTextureId,
        meshId: leaf.generatedMeshId,
        defaultOpacity: 1,
        runtimeVisibility: leaf.initialRuntimeVisibility,
        baseDrawOrder: leaf.sourceOrder,
        sourceProvenanceId: SOURCE_PROVENANCE_ID
      }))
    },
    meshes: {
      schemaVersion: "meshes-file-v1" as const,
      meshes: input.leafScaffolds.map((leaf) => ({
        meshId: leaf.generatedMeshId,
        drawableId: leaf.generatedDrawableId,
        vertices: [],
        uvs: [],
        triangles: [],
        vertexStableIds: [],
        bounds: leaf.bounds,
        generationProvenanceId: SOURCE_PROVENANCE_ID
      }))
    },
    parameters: { schemaVersion: "parameters-file-v1" as const, parameters: [] },
    keyforms: { schemaVersion: "keyforms-file-v1" as const, keyformSets: [] },
    rigControls: { schemaVersion: "rig-controls-file-v1" as const, rigControls: [] },
    dynamics: { schemaVersion: "dynamics-file-v1" as const, dynamicsGroups: [] },
    masks: { schemaVersion: "masks-file-v1" as const, masks: [] },
    drawOrder: {
      schemaVersion: "draw-order-file-v1" as const,
      entries: input.leafScaffolds.map((leaf) => ({
        drawableId: leaf.generatedDrawableId,
        baseDrawOrder: leaf.sourceOrder,
        stableOrder: leaf.sourceOrder
      }))
    }
  },
  assets: {
    sourceManifest: {
      schemaVersion: "source-manifest-v1" as const,
      sourceAssets: [
        {
          sourceAssetId: SOURCE_ASSET_ID,
          kind: "psd-source-v1" as const,
          filePath: "test_data/wave50_structural.psd",
          contentHash: `sha256:${SOURCE_DIGEST.hex}`,
          importProfile: "layered-character-psd-profile-v1" as const,
          layers: input.leafScaffolds.map((leaf) => ({
            sourceLayerId: leaf.sourceLayerRef.sourceLayerId,
            sourceAssetId: SOURCE_ASSET_ID,
            originalName: leaf.sourceLayerName ?? leaf.sourceLayerRef.sourceLayerId,
            normalizedName: (leaf.sourceLayerName ?? leaf.sourceLayerRef.sourceLayerId).toLocaleLowerCase(),
            groupPath: leaf.sourceLayerPath.slice(0, -1),
            bounds: leaf.bounds,
            visibleInSource: leaf.visibleInSource,
            opacityInSource: leaf.opacityInSource,
            role: "editableLayer" as const,
            unsupportedFeatures: [],
            mappedDrawableIds: [leaf.generatedDrawableId]
          })),
          diagnostics: [],
          binaryAssetRef: createBinaryAssetRef({
            binaryAssetId: SOURCE_BINARY_ID,
            packageRelativePath: "assets/sources/wave50_structural.psd",
            digest: SOURCE_DIGEST,
            byteLength: SOURCE_BYTE_LENGTH,
            mediaType: "image/vnd.adobe.photoshop"
          }),
          psdProfile: {
            schemaVersion: "layered-character-psd-profile-v1" as const,
            adapter: {
              adapterName: "wave50-structural-fixture",
              adapterResultSchemaVersion: "psd-adapter-result-v1" as const,
              sourceProfile: "layered-character-psd-profile-v1" as const,
              evidenceKind: "adapter-supplied-metadata-v1" as const
            },
            canvas: {
              width: 1024,
              height: 1024
            },
            sourceGroups: [
              {
                sourceGroupId: input.groupScaffold.sourceGroupRef.sourceGroupId,
                originalName: "Hair",
                normalizedName: "hair",
                groupPath: ["Hair"],
                sourceOrder: input.groupScaffold.sourceOrder,
                visibleInSource: true,
                opacityInSource: 1,
                bounds: input.groupScaffold.bounds,
                unsupportedFeatures: []
              }
            ],
            sourceLayers: input.leafScaffolds.map((leaf) => ({
              sourceLayerId: leaf.sourceLayerRef.sourceLayerId,
              originalName: leaf.sourceLayerName ?? leaf.sourceLayerRef.sourceLayerId,
              normalizedName: (leaf.sourceLayerName ?? leaf.sourceLayerRef.sourceLayerId).toLocaleLowerCase(),
              ...(leaf.sourceParentGroupRef === undefined
                ? {}
                : { parentGroupId: leaf.sourceParentGroupRef.sourceGroupId }),
              groupPath: leaf.sourceLayerPath.slice(0, -1),
              sourceOrder: leaf.sourceOrder,
              bounds: leaf.bounds,
              visibleInSource: leaf.visibleInSource,
              opacityInSource: leaf.opacityInSource,
              role: "editableLayer" as const,
              unsupportedFeatures: []
            })),
            unsupportedFeatures: [],
            ...(input.storeStructuralEvidence
              ? {
                  psdStructuralScaffoldPlanEvidence: [input.bridge.structuralPlan],
                  psdStructuralScaffoldApprovalEvidence: [input.bridge.approval]
                }
              : {}),
            diagnostics: [],
            compatibility: {
              structuredProfilePrecedence: "structured-profile-preferred-v1" as const,
              flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1" as const,
              flattenedUnsupportedFeaturesFallback: "sourceLayer.unsupportedFeatures-feature-id-fallback-v1" as const
            }
          }
        }
      ]
    },
    textureAtlas: {
      schemaVersion: "texture-atlas-v1" as const,
      textures: input.leafScaffolds.map((leaf) => ({
        textureId: leaf.generatedTextureId,
        filePath: `assets/textures/${leaf.generatedTextureId}.raw-rgba`,
        sourceAssetId: SOURCE_ASSET_ID,
        sourceLayerId: leaf.sourceLayerRef.sourceLayerId,
        provenanceId: SOURCE_PROVENANCE_ID
      })),
      previewAssets: input.leafScaffolds.map((leaf) => ({
        previewAssetId: `preview_${leaf.generatedTextureId}`,
        textureId: leaf.generatedTextureId,
        reference: {
          referenceKind: "package-local-file-v1" as const,
          filePath: `assets/textures/${leaf.generatedTextureId}.png`
        },
        sourceAssetId: SOURCE_ASSET_ID,
        sourceLayerId: leaf.sourceLayerRef.sourceLayerId,
        provenanceId: SOURCE_PROVENANCE_ID,
        rightsAssetId: SOURCE_ASSET_ID
      }))
    },
    provenance: {
      schemaVersion: "provenance-file-v1" as const,
      records: [
        {
          provenanceId: SOURCE_PROVENANCE_ID,
          assetId: SOURCE_ASSET_ID,
          assetKind: "source" as const,
          filePath: "test_data/wave50_structural.psd",
          contentHash: `sha256:${SOURCE_DIGEST.hex}`,
          creator: "fixture",
          license: "private-fixture",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: []
        }
      ]
    },
    rights: {
      schemaVersion: "rights-file-v1" as const,
      records: [
        {
          assetId: SOURCE_ASSET_ID,
          rightsStatus: "cleared" as const,
          license: "private-fixture",
          redistributionAllowed: false
        }
      ]
    }
  }
});

const createGroupScaffold = () => ({
  scaffoldKind: "groupPartContainer" as const,
  sourceGroupRef: createSourceGroupRef(),
  sourceGroupName: "Hair",
  sourceGroupPath: ["Hair"],
  sourceOrder: 0,
  visibleInSource: true,
  opacityInSource: 1,
  bounds: { x: 0, y: 0, width: 256, height: 256 },
  generatedParentPartId: PARENT_PART_ID,
  generatedPartId: GROUP_PART_ID,
  generatedPartDisplayName: "Hair",
  status: "resolved" as const,
  statusReasons: []
});

const createLeafScaffold = (input: {
  readonly sourceLayerId: string;
  readonly sourceLayerName: string;
  readonly sourceLayerPath: readonly string[];
  readonly sourceOrder: number;
  readonly visibleInSource: boolean;
  readonly generatedDrawableId: string;
  readonly generatedMeshId: string;
  readonly generatedTextureId: string;
  readonly generatedParentPartId?: string;
}) => ({
  scaffoldKind: "leafDrawableScaffold" as const,
  sourceLayerRef: createSourceLayerRef(
    input.sourceLayerId,
    input.sourceLayerName,
    input.sourceLayerPath
  ),
  ...(input.generatedParentPartId === PARENT_PART_ID
    ? {}
    : { sourceParentGroupRef: createSourceGroupRef() }),
  sourceLayerName: input.sourceLayerName,
  sourceLayerPath: [...input.sourceLayerPath],
  sourceOrder: input.sourceOrder,
  visibleInSource: input.visibleInSource,
  opacityInSource: input.visibleInSource ? 1 : 0,
  bounds: { x: 0, y: 0, width: 64, height: 64 },
  byteEstimate: 64 * 64 * 4,
  generatedParentPartId: input.generatedParentPartId ?? GROUP_PART_ID,
  generatedDrawableId: input.generatedDrawableId,
  generatedDrawableDisplayName: input.sourceLayerPath.join(" / "),
  generatedTextureId: input.generatedTextureId,
  generatedMeshId: input.generatedMeshId,
  initialRuntimeVisibility: input.visibleInSource,
  status: "resolved" as const,
  statusReasons: []
});

const createBridge = (
  groupScaffold: ReturnType<typeof createGroupScaffold>,
  leafScaffolds: readonly ReturnType<typeof createLeafScaffold>[]
) => ({
  schemaVersion: "psd-structural-scaffold-approval-bridge-evidence-v1" as const,
  structuralPlan: {
    schemaVersion: "psd-structural-scaffold-plan-evidence-v1" as const,
    evidenceKind: "psd-structural-scaffold-plan-evidence-v1" as const,
    structuralPlanId: "plan_wave50_structural",
    structuralPlanDigest: PLAN_DIGEST,
    sourcePsd: createSourcePsdIdentity(),
    parser: createParserEvidence(),
    scope: {
      scopeRef: {
        kind: "document" as const,
        id: "psd:root"
      },
      scopeDisplayPath: [],
      discoveryMode: "explicitStructuralScaffoldPreview" as const
    },
    plannedGroupPartScaffolds: [markStatus(groupScaffold, "previewReady")],
    plannedLeafScaffolds: leafScaffolds.map((leaf) => markStatus(leaf, "previewReady")),
    summary: createSummary(leafScaffolds),
    capPolicy: createCapPolicy(),
    issues: [],
    boundary: {
      explicitStructuralApprovalRequired: true as const,
      groupsAsPartContainersOnly: true as const,
      groupDrawableTextureMeshRefs: "forbidden" as const,
      rawParserObjectPersistence: "notPersisted" as const,
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
      structuralPreviewBytePersistence: "metadataOnlyNoRawBytes" as const,
      publicDemoAsset: false as const,
      semanticRecognition: "notProvided" as const,
      repoProposalGeneration: "notProvided" as const,
      initialGridMeshGeneration: "notProvided" as const,
      photoshopCompositingClaim: "none" as const
    }
  },
  approval: {
    schemaVersion: "psd-structural-scaffold-approval-evidence-v1" as const,
    evidenceKind: "psd-structural-scaffold-approval-evidence-v1" as const,
    approvalId: "approval_wave50_structural",
    structuralPlanDigest: PLAN_DIGEST,
    approvalSelectionDigest: APPROVAL_DIGEST,
    sourcePsd: createSourcePsdIdentity(),
    destination: {
      destinationKind: "structuralScaffold" as const,
      parentPartId: PARENT_PART_ID
    },
    approvalStatus: "approved" as const,
    approvedGroupPartScaffolds: [markStatus(groupScaffold, "approved")],
    approvedLeafScaffolds: leafScaffolds.map((leaf) => markStatus(leaf, "approved")),
    summary: createSummary(leafScaffolds),
    capPolicy: createCapPolicy(),
    issues: [],
    boundary: {
      explicitStructuralApproval: true as const,
      groupsAsPartContainersOnly: true as const,
      groupDrawableTextureMeshRefs: "forbidden" as const,
      rawParserObjectPersistence: "notPersisted" as const,
      sourcePsdBytePersistence: "metadataOnlyNoRawBytes" as const,
      materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes" as const,
      publicDemoAsset: false as const,
      semanticRecognition: "notProvided" as const,
      repoProposalGeneration: "notProvided" as const,
      initialGridMeshGeneration: "notProvided" as const,
      photoshopCompositingClaim: "none" as const
    }
  }
});

const createSourceGroupRef = () => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceGroupId: "psd:root/group[0]",
  sourceGroupName: "Hair",
  sourceGroupPath: ["Hair"]
});

const createSourceLayerRef = (
  sourceLayerId: string,
  sourceLayerName: string,
  sourceLayerPath: readonly string[]
) => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceLayerId,
  sourceLayerName,
  sourceLayerPath: [...sourceLayerPath]
});

const createSourcePsdIdentity = () => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceFilePath: "test_data/wave50_structural.psd",
  digest: SOURCE_DIGEST,
  byteLength: SOURCE_BYTE_LENGTH,
  mediaType: "image/vnd.adobe.photoshop",
  sourceBytePersistence: "metadataOnlyNoRawBytes" as const,
  publicDemoAsset: false as const
});

const createParserEvidence = () => ({
  evidenceKind: "psd-parser-evidence-v1" as const,
  parserName: "@webtoon/psd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: "wave50-structural-fixture",
  adapterVersion: "0.1.0",
  runtime: "browser" as const,
  privateShapePolicy: "parser-private-shape-excluded-v1" as const
});

const createSummary = (
  leafScaffolds: readonly ReturnType<typeof createLeafScaffold>[]
) => ({
  sourceGroupCount: 1,
  sourceLayerCount: leafScaffolds.length,
  approvedGroupCount: 1,
  approvedLeafCount: leafScaffolds.length,
  generatedGroupPartCount: 1,
  generatedDrawableCount: leafScaffolds.length,
  hiddenLeafCount: leafScaffolds.filter((leaf) => !leaf.visibleInSource).length,
  runtimeHiddenDrawableCount: leafScaffolds.filter((leaf) => !leaf.initialRuntimeVisibility).length,
  structuralDepth: 2,
  totalByteEstimate: leafScaffolds.reduce((total, leaf) => total + (leaf.byteEstimate ?? 0), 0)
});

const createCapPolicy = () => ({
  structuralNodeLimit: 256,
  structuralDepthLimit: 8,
  approvedGroupLimit: 128,
  approvedLeafLimit: 256,
  generatedNodeLimit: 512,
  totalRawRgbaByteLimit: 256 * 1024 * 1024
});

const createStructuralIssue = (
  issueKind: string,
  issueIndex: number,
  overrides: Partial<{
    readonly message: string;
    readonly sourceGroupRef: ReturnType<typeof createSourceGroupRef>;
    readonly sourceLayerRef: ReturnType<typeof createSourceLayerRef>;
  }> = {}
) => ({
  issueId: `issue_wave50_${issueIndex}_${issueKind}`,
  issueKind,
  checkId: `operation.importPsdStructuralScaffold.${issueKind}`,
  message: overrides.message ?? `Synthetic ${issueKind} issue.`,
  targetPath: `/payload/structural/issues/${issueIndex}`,
  ...(overrides.sourceGroupRef === undefined ? {} : { sourceGroupRef: overrides.sourceGroupRef }),
  ...(overrides.sourceLayerRef === undefined ? {} : { sourceLayerRef: overrides.sourceLayerRef })
});

const markStatus = <
  TScaffold extends { readonly status: string; readonly statusReasons: readonly string[] }
>(
  scaffold: TScaffold,
  status: "previewReady" | "approved"
): TScaffold => ({
  ...scaffold,
  status,
  statusReasons: []
});

const createBinaryAssetRef = (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly digest: typeof SOURCE_DIGEST | typeof OTHER_DIGEST;
  readonly byteLength: number;
  readonly mediaType: string;
}) => ({
  referenceKind: "package-binary-asset-ref-v1" as const,
  binaryAssetId: input.binaryAssetId,
  packageRelativePath: input.packageRelativePath,
  digest: input.digest,
  byteLength: input.byteLength,
  mediaType: input.mediaType,
  storageStatus: "stored-package-local-v1" as const,
  provenanceId: SOURCE_PROVENANCE_ID,
  rightsAssetId: SOURCE_ASSET_ID
});

const buildPreflight = (
  validationReport: ValidationReportDto,
  reportId: string
) => buildProductPreflightReport({
  reportId,
  createdAt: CREATED_AT,
  validationReports: [validationReport]
});

const findCategory = (
  report: ReturnType<typeof buildProductPreflightReport>,
  categoryId: ProductPreflightCategoryResultDto["category"]
) => {
  const category = report.categories.find((candidate) => candidate.category === categoryId);
  expect(category).toBeDefined();
  if (category === undefined) {
    throw new Error(`Missing category ${categoryId}.`);
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

const expectDrawable = (
  document: PackageDocumentDto,
  drawableId: string
) => {
  const drawable = document.model.drawables.drawables.find((candidate) =>
    candidate.drawableId === drawableId
  );
  if (drawable === undefined) {
    throw new Error(`Expected drawable ${drawableId}.`);
  }

  return drawable;
};

const expectPart = (
  document: PackageDocumentDto,
  partId: string
) => {
  const part = document.model.graph.parts.find((candidate) =>
    candidate.partId === partId
  );
  if (part === undefined) {
    throw new Error(`Expected part ${partId}.`);
  }

  return part;
};

const clone = <TValue>(value: TValue): TValue =>
  JSON.parse(JSON.stringify(value)) as TValue;
