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
import { OperationPayloadSchema } from "../operation-payload.js";
import { OperationRequestSchema, type OperationRequestDto } from "../operation-request.js";
import { PsdAdapterLayerMaterializationEvidenceSchema } from "../payloads/import-source.js";
import { getOperationHandler } from "../operation-registry.js";
import { PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE } from "../psd-layer-materialization-operation-evidence.js";
import {
  PsdStructuralScaffoldApprovalEvidenceSchema,
  PsdStructuralScaffoldPlanEvidenceSchema
} from "../psd-structural-scaffold-evidence.js";
import { importPsdStructuralScaffoldOperationHandler } from "./import-psd-structural-scaffold.js";

describe("importPsdStructuralScaffold operation handler", () => {
  it("registers structural payload parsing and operation execution", () => {
    const payload = OperationPayloadSchema.parse({
      operationType: "importPsdStructuralScaffold",
      payload: createStructuralPayload()
    });

    expect(payload.operationType).toBe("importPsdStructuralScaffold");
    expect(getOperationHandler("importPsdStructuralScaffold")).toBe(
      importPsdStructuralScaffoldOperationHandler
    );
  });

  it("creates group part containers and materializes leaves under generated parents", () => {
    const session = createFixtureSession();
    const outcome = createOperationCore({
      now: () => new Date("2026-06-07T00:00:00.000Z")
    }).commitOperation(session, createStructuralRequest());

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(getPartById(session.graph, PartIdSchema.parse("part_root"))).toMatchObject({
      childPartIds: ["part_psd_group_hair_front"],
      drawableIds: ["draw_headwear_hidden"],
      children: [
        { kind: "drawable", drawableId: "draw_headwear_hidden" },
        { kind: "part", partId: "part_psd_group_hair_front" }
      ]
    });
    expect(getPartById(session.graph, PartIdSchema.parse("part_psd_group_hair_front"))).toMatchObject({
      partId: "part_psd_group_hair_front",
      displayName: "hair_front",
      parentPartId: "part_root",
      drawableIds: ["draw_front_hair_structural"],
      children: [{ kind: "drawable", drawableId: "draw_front_hair_structural" }]
    });
    expect(outcome.result.modelDiff?.changed.flatMap((change) =>
      change.fields.map((field) => field.path)
    )).toEqual(expect.arrayContaining([
      "/model/graph/parts/part_root/children",
      "/model/graph/parts/part_psd_group_hair_front/children",
      "/model/drawOrder/entries"
    ]));
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_front_hair_structural"))).toMatchObject({
      drawableId: "draw_front_hair_structural",
      displayName: "front hair",
      partId: "part_psd_group_hair_front",
      textureId: "tex_front_hair_structural",
      meshId: "mesh_front_hair_structural",
      runtimeVisibility: true
    });
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_headwear_hidden"))).toMatchObject({
      drawableId: "draw_headwear_hidden",
      displayName: "headwear",
      partId: "part_root",
      runtimeVisibility: false
    });
    expect(getTextureAtlasEntryById(session.graph, TextureIdSchema.parse("tex_front_hair_structural")))
      .toMatchObject({
        textureId: "tex_front_hair_structural",
        sourceLayerId: "psd:root/group[2]/layer[0]"
      });
    expect(getTextureAtlasEntryById(session.graph, TextureIdSchema.parse("tex_headwear_hidden")))
      .toMatchObject({
        textureId: "tex_headwear_hidden",
        sourceLayerId: "psd:root/layer[1]"
      });
    expect(session.graph.drawables).toHaveLength(2);
    expect(session.graph.meshes).toHaveLength(2);
    expect(session.graph.textureAtlas?.textures).toHaveLength(2);
    expect(session.graph.textureAtlas?.textures.map((texture) => texture.textureId)).not.toContain(
      "tex_psd_group_hair_front"
    );
    expect(outcome.result.psdStructuralScaffoldEvidence?.[0]).toMatchObject({
      operationType: "importPsdStructuralScaffold",
      batchId: "batch_wave50_structural",
      aggregateStatus: "success",
      generatedGroupPartScaffolds: [
        expect.objectContaining({
          scaffoldKind: "groupPartContainer",
          generatedPartId: "part_psd_group_hair_front",
          status: "resolved"
        })
      ],
      generatedLeafScaffolds: [
        expect.objectContaining({
          sourceLayerRef: expect.objectContaining({ sourceLayerId: "psd:root/layer[1]" }),
          generatedParentPartId: "part_root",
          initialRuntimeVisibility: false,
          status: "resolved"
        }),
        expect.objectContaining({
          sourceLayerRef: expect.objectContaining({ sourceLayerId: "psd:root/group[2]/layer[0]" }),
          generatedParentPartId: "part_psd_group_hair_front",
          initialRuntimeVisibility: true,
          status: "resolved"
        })
      ]
    });
    expect(outcome.result.psdLayerMaterializationEvidence).toHaveLength(2);
    expect(JSON.stringify(outcome.result.psdStructuralScaffoldEvidence)).not.toContain("rawRgba");
    expect(JSON.stringify(outcome.result.psdStructuralScaffoldEvidence)).not.toContain("sourcePsdBytes");
  });

  it("keeps parent-hidden child drawables runtime-visible while scaffold evidence records effective hidden", () => {
    const session = createFixtureSession();
    const sourceAsset = session.graph.sourceAssets[0]!;
    const profile = sourceAsset.psdProfile!;
    sourceAsset.layers.push(
      createSourceLayer({
        sourceLayerId: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerId,
        originalName: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerName,
        groupPath: ["hidden_parent"],
        visibleInSource: false,
        localVisibleInSource: true,
        effectiveVisibleInSource: false,
        bounds: { x: 20, y: 30, width: 64, height: 64 }
      })
    );
    profile.sourceGroups.push({
      sourceGroupId: "psd:root/group[5]",
      originalName: "hidden_parent",
      normalizedName: "hidden_parent",
      groupPath: ["hidden_parent"],
      sourceOrder: 5,
      visibleInSource: false,
      localVisibleInSource: false,
      effectiveVisibleInSource: false,
      opacityInSource: 1,
      bounds: { x: 20, y: 30, width: 64, height: 64 },
      unsupportedFeatures: []
    });
    profile.sourceLayers.push({
      sourceLayerId: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerId,
      originalName: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerName,
      normalizedName: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerName,
      parentGroupId: "psd:root/group[5]",
      groupPath: ["hidden_parent"],
      sourceOrder: 6,
      bounds: { x: 20, y: 30, width: 64, height: 64 },
      visibleInSource: false,
      localVisibleInSource: true,
      effectiveVisibleInSource: false,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: []
    });
    profile.materializationEvidence?.push(createMaterializationEvidence(PARENT_HIDDEN_VISIBLE_LAYER));

    const request = createStructuralRequest({
      plannedGroupPartScaffolds: [createHiddenParentGroupScaffold("previewReady")],
      approvedGroupPartScaffolds: [createHiddenParentGroupScaffold("approved")],
      plannedLeafScaffolds: [createParentHiddenVisibleLeafScaffold("previewReady")],
      approvedLeafScaffolds: [createParentHiddenVisibleLeafScaffold("approved")]
    });
    const outcome = createOperationCore({
      now: () => new Date("2026-06-07T00:00:00.000Z")
    }).commitOperation(session, request);

    expect(outcome.result.status).toBe("committed");
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_parent_hidden_child"))).toMatchObject({
      drawableId: "draw_parent_hidden_child",
      partId: "part_psd_group_hidden_parent",
      runtimeVisibility: true
    });
    expect(outcome.result.psdStructuralScaffoldEvidence?.[0]).toMatchObject({
      generatedGroupPartScaffolds: [
        expect.objectContaining({
          generatedPartId: "part_psd_group_hidden_parent",
          localVisibleInSource: false,
          effectiveVisibleInSource: false
        })
      ],
      generatedLeafScaffolds: [
        expect.objectContaining({
          generatedDrawableId: "draw_parent_hidden_child",
          visibleInSource: false,
          localVisibleInSource: true,
          effectiveVisibleInSource: false,
          initialRuntimeVisibility: true
        })
      ]
    });
  });

  it("keeps child drawable runtime visible when only its source parent group is hidden", () => {
    const session = createFixtureSession();
    const sourceAsset = session.graph.sourceAssets[0]!;
    const profile = sourceAsset.psdProfile!;
    sourceAsset.layers[0] = {
      ...sourceAsset.layers[0]!,
      visibleInSource: false,
      localVisibleInSource: true
    };
    profile.sourceGroups[0] = {
      ...profile.sourceGroups[0]!,
      visibleInSource: false,
      localVisibleInSource: false
    };
    profile.sourceLayers[0] = {
      ...profile.sourceLayers[0]!,
      visibleInSource: false,
      localVisibleInSource: true
    };
    const hiddenParentGroupPreview = {
      ...createGroupPartScaffold("previewReady"),
      visibleInSource: false,
      localVisibleInSource: false
    } as const;
    const hiddenParentGroupApproval = {
      ...hiddenParentGroupPreview,
      status: "approved",
      statusReasons: []
    } as const;
    const parentHiddenLeafPreview = {
      ...createVisibleLeafScaffold("previewReady"),
      visibleInSource: false,
      localVisibleInSource: true,
      initialRuntimeVisibility: true
    } as const;
    const parentHiddenLeafApproval = {
      ...parentHiddenLeafPreview,
      status: "approved",
      statusReasons: []
    } as const;

    const outcome = createOperationCore({
      now: () => new Date("2026-06-07T00:00:00.000Z")
    }).commitOperation(
      session,
      createStructuralRequest({
        plannedGroupPartScaffolds: [hiddenParentGroupPreview],
        approvedGroupPartScaffolds: [hiddenParentGroupApproval],
        plannedLeafScaffolds: [
          parentHiddenLeafPreview,
          createHiddenLeafScaffold("previewReady")
        ],
        approvedLeafScaffolds: [
          parentHiddenLeafApproval,
          createHiddenLeafScaffold("approved")
        ]
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(getPartById(session.graph, PartIdSchema.parse("part_psd_group_hair_front"))).toMatchObject({
      partId: "part_psd_group_hair_front",
      parentPartId: "part_root"
    });
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_front_hair_structural"))).toMatchObject({
      drawableId: "draw_front_hair_structural",
      runtimeVisibility: true
    });
    expect(getDrawableById(session.graph, DrawableIdSchema.parse("draw_headwear_hidden"))).toMatchObject({
      drawableId: "draw_headwear_hidden",
      runtimeVisibility: false
    });
    expect(outcome.result.psdStructuralScaffoldEvidence?.[0]?.generatedGroupPartScaffolds[0])
      .toMatchObject({
        visibleInSource: false,
        localVisibleInSource: false
      });
    expect(outcome.result.psdStructuralScaffoldEvidence?.[0]?.generatedLeafScaffolds)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          sourceLayerRef: expect.objectContaining({
            sourceLayerId: "psd:root/group[2]/layer[0]"
          }),
          visibleInSource: false,
          localVisibleInSource: true,
          initialRuntimeVisibility: true
        })
      ]));
  });

  it("rejects stale approval evidence before mutating the session", () => {
    const session = createFixtureSession();
    const before = structuredClone(session);
    const outcome = createOperationCore().commitOperation(
      session,
      createStructuralRequest({
        approvalStatus: "structuralPlanStale",
        approvalPlanDigest: OTHER_PLAN_DIGEST
      })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "operation.importPsdStructuralScaffold.structuralPlanDigestMismatch",
        "operation.importPsdStructuralScaffold.approvalNotApproved"
      ])
    );
    expect(outcome.result.psdStructuralScaffoldEvidence?.[0]).toMatchObject({
      aggregateStatus: "preflightBlocked",
      issues: expect.arrayContaining([
        expect.objectContaining({ issueKind: "structuralPlanStale" })
      ])
    });
    expect(session).toEqual(before);
  });

  it("rejects stored approval selection digest mismatch before mutating the session", () => {
    expectRejectedWithoutMutation(
      createFixtureSession(),
      createStructuralRequest({ approvalSelectionDigest: OTHER_APPROVAL_DIGEST }),
      ["operation.importPsdStructuralScaffold.storedApprovalEvidenceMismatch"]
    );
  });

  it("rejects approved scaffolds missing from the structural plan before mutating the session", () => {
    expectRejectedWithoutMutation(
      createFixtureSession(),
      createStructuralRequest({
        plannedGroupPartScaffolds: [],
        plannedLeafScaffolds: [createHiddenLeafScaffold("previewReady")]
      }),
      [
        "operation.importPsdStructuralScaffold.approvedGroupNotPlanned",
        "operation.importPsdStructuralScaffold.approvedLeafNotPlanned"
      ]
    );
  });

  it("rejects duplicate approved source group and layer refs before mutating the session", () => {
    const duplicateGroupPreview = {
      ...createGroupPartScaffold("previewReady"),
      generatedPartId: "part_psd_group_hair_front_copy",
      generatedPartDisplayName: "hair_front copy"
    } as const;
    const duplicateGroupApproval = {
      ...duplicateGroupPreview,
      status: "approved",
      statusReasons: []
    } as const;
    const duplicateLeafPreview = {
      ...createVisibleLeafScaffold("previewReady"),
      generatedDrawableId: "draw_front_hair_structural_copy",
      generatedDrawableDisplayName: "front hair copy",
      generatedTextureId: "tex_front_hair_structural_copy",
      generatedMeshId: "mesh_front_hair_structural_copy"
    } as const;
    const duplicateLeafApproval = {
      ...duplicateLeafPreview,
      status: "approved",
      statusReasons: []
    } as const;

    expectRejectedWithoutMutation(
      createFixtureSession(),
      createStructuralRequest({
        plannedGroupPartScaffolds: [
          createGroupPartScaffold("previewReady"),
          duplicateGroupPreview
        ],
        approvedGroupPartScaffolds: [
          createGroupPartScaffold("approved"),
          duplicateGroupApproval
        ],
        plannedLeafScaffolds: [
          createVisibleLeafScaffold("previewReady"),
          duplicateLeafPreview,
          createHiddenLeafScaffold("previewReady")
        ],
        approvedLeafScaffolds: [
          createVisibleLeafScaffold("approved"),
          duplicateLeafApproval,
          createHiddenLeafScaffold("approved")
        ]
      }),
      [
        "operation.importPsdStructuralScaffold.duplicateApprovedSourceGroup",
        "operation.importPsdStructuralScaffold.duplicateApprovedSourceLayer"
      ]
    );
  });

  it("rejects stale source name, opacity, and bounds evidence before mutating the session", () => {
    const session = createFixtureSession();
    const sourceAsset = session.graph.sourceAssets[0]!;
    const profile = sourceAsset.psdProfile!;

    profile.sourceGroups[0] = {
      ...profile.sourceGroups[0]!,
      originalName: "hair_front_stale",
      normalizedName: "hair_front_stale",
      visibleInSource: false,
      opacityInSource: 0.5,
      bounds: { x: 681, y: 120, width: 660, height: 660 }
    };
    sourceAsset.layers[0] = {
      ...sourceAsset.layers[0]!,
      originalName: "front hair stale",
      normalizedName: "front hair stale",
      opacityInSource: 0.5,
      bounds: { x: 693, y: 144, width: 620, height: 620 }
    };
    profile.sourceLayers[0] = {
      ...profile.sourceLayers[0]!,
      originalName: "front hair stale",
      normalizedName: "front hair stale",
      opacityInSource: 0.5,
      bounds: { x: 693, y: 144, width: 620, height: 620 }
    };

    expectRejectedWithoutMutation(session, createStructuralRequest(), [
      "operation.importPsdStructuralScaffold.groupNameMismatch",
      "operation.importPsdStructuralScaffold.groupVisibilityMismatch",
      "operation.importPsdStructuralScaffold.groupOpacityMismatch",
      "operation.importPsdStructuralScaffold.groupBoundsMismatch",
      "operation.importPsdStructuralScaffold.leafNameMismatch",
      "operation.importPsdStructuralScaffold.leafOpacityMismatch",
      "operation.importPsdStructuralScaffold.leafBoundsMismatch"
    ]);
  });

  it("rejects non-positive structural leaf bounds before mutating the session", () => {
    const zeroWidthLeafPreview = {
      ...createVisibleLeafScaffold("previewReady"),
      bounds: { x: 692, y: 144, width: 0, height: 620 }
    } as const;
    const zeroWidthLeafApproval = {
      ...zeroWidthLeafPreview,
      status: "approved",
      statusReasons: []
    } as const;

    expectRejectedWithoutMutation(
      createFixtureSession(),
      createStructuralRequest({
        plannedLeafScaffolds: [
          zeroWidthLeafPreview,
          createHiddenLeafScaffold("previewReady")
        ],
        approvedLeafScaffolds: [
          zeroWidthLeafApproval,
          createHiddenLeafScaffold("approved")
        ]
      }),
      ["operation.importPsdStructuralScaffold.nonPositiveLeafBounds"]
    );
  });

  it("rejects generated id collisions before mutating the session", () => {
    const session = createFixtureSession({
      extraParts: [
        {
          partId: PartIdSchema.parse("part_psd_group_hair_front"),
          displayName: "Existing Hair",
          parentPartId: PartIdSchema.parse("part_root"),
          childPartIds: [],
          drawableIds: []
        }
      ]
    });
    const before = structuredClone(session);
    const outcome = createOperationCore().commitOperation(session, createStructuralRequest());

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toContain(
      "operation.importPsdStructuralScaffold.generatedGroupPartAlreadyExists"
    );
    expect(outcome.result.psdStructuralScaffoldEvidence?.[0]).toMatchObject({
      aggregateStatus: "preflightBlocked",
      issues: expect.arrayContaining([
        expect.objectContaining({ issueKind: "structuralGeneratedRefCollision" })
      ])
    });
    expect(session).toEqual(before);
  });
});

const expectRejectedWithoutMutation = (
  session: AuthoringSession,
  request: OperationRequestDto,
  expectedCheckIds: readonly string[]
) => {
  const before = structuredClone(session);
  const outcome = createOperationCore().commitOperation(session, request);

  expect(outcome.result.status).toBe("rejected");
  expect(outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
    expect.arrayContaining([...expectedCheckIds])
  );
  expect(outcome.result.psdStructuralScaffoldEvidence?.[0]).toMatchObject({
    aggregateStatus: "preflightBlocked"
  });
  expect(session).toEqual(before);

  return outcome;
};

const createStructuralRequest = (options: StructuralRequestOptions = {}): OperationRequestDto =>
  OperationRequestSchema.parse({
    schemaVersion: "operation-request-v1",
    operationId: "op_import_psd_structural_scaffold",
    actor: "importer",
    surface: "structuredApi",
    dryRun: false,
    basePackageRevision: 0,
    idempotencyKey: "structural-fixture",
    operationType: "importPsdStructuralScaffold",
    payload: createStructuralPayload(options)
  });

const createStructuralPayload = (options: StructuralRequestOptions = {}) => ({
  sourceAssetId: SOURCE_ASSET_ID,
  batchId: "batch_wave50_structural",
  destination: {
    destinationKind: "structuralScaffold",
    parentPartId: "part_root"
  },
  structuralScaffoldBridge: createStructuralScaffoldBridge(options),
  capPolicy: STRUCTURAL_CAP_POLICY,
  lockedTargetIds: []
} as const);

const createStructuralScaffoldBridge = (options: StructuralRequestOptions = {}) => ({
  schemaVersion: "psd-structural-scaffold-approval-bridge-evidence-v1",
  structuralPlan: createStructuralPlanEvidence(options),
  approval: createStructuralApprovalEvidence(options)
} as const);

const createStructuralPlanEvidence = (options: StructuralRequestOptions = {}) => PsdStructuralScaffoldPlanEvidenceSchema.parse({
  schemaVersion: "psd-structural-scaffold-plan-evidence-v1",
  evidenceKind: "psd-structural-scaffold-plan-evidence-v1",
  structuralPlanId: "plan_wave50Structural",
  structuralPlanDigest: STRUCTURAL_PLAN_DIGEST,
  sourcePsd: createSourcePsdIdentity(),
  parser: PSD_PARSER_EVIDENCE,
  scope: {
    scopeRef: { kind: "document", id: "psd:root" },
    scopeDisplayPath: [],
    discoveryMode: "explicitStructuralScaffoldPreview"
  },
  plannedGroupPartScaffolds: options.plannedGroupPartScaffolds ?? [createGroupPartScaffold("previewReady")],
  plannedLeafScaffolds: options.plannedLeafScaffolds ?? [
    createVisibleLeafScaffold("previewReady"),
    createHiddenLeafScaffold("previewReady")
  ],
  summary: STRUCTURAL_SUMMARY,
  capPolicy: STRUCTURAL_CAP_POLICY,
  issues: [],
  boundary: {
    explicitStructuralApprovalRequired: true,
    groupsAsPartContainersOnly: true,
    groupDrawableTextureMeshRefs: "forbidden",
    rawParserObjectPersistence: "notPersisted",
    sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
    structuralPreviewBytePersistence: "metadataOnlyNoRawBytes",
    publicDemoAsset: false,
    semanticRecognition: "notProvided",
    repoProposalGeneration: "notProvided",
    initialGridMeshGeneration: "notProvided",
    photoshopCompositingClaim: "none"
  }
});

const createStructuralApprovalEvidence = (options: StructuralRequestOptions = {}) => PsdStructuralScaffoldApprovalEvidenceSchema.parse({
  schemaVersion: "psd-structural-scaffold-approval-evidence-v1",
  evidenceKind: "psd-structural-scaffold-approval-evidence-v1",
  approvalId: "approval_wave50Structural",
  structuralPlanDigest: options.approvalPlanDigest ?? STRUCTURAL_PLAN_DIGEST,
  approvalSelectionDigest: options.approvalSelectionDigest ?? STRUCTURAL_APPROVAL_DIGEST,
  sourcePsd: createSourcePsdIdentity(),
  destination: {
    destinationKind: "structuralScaffold",
    parentPartId: "part_root"
  },
  approvalStatus: options.approvalStatus ?? "approved",
  approvedGroupPartScaffolds: options.approvedGroupPartScaffolds ?? [createGroupPartScaffold("approved")],
  approvedLeafScaffolds: options.approvedLeafScaffolds ?? [
    createVisibleLeafScaffold("approved"),
    createHiddenLeafScaffold("approved")
  ],
  summary: STRUCTURAL_SUMMARY,
  capPolicy: STRUCTURAL_CAP_POLICY,
  issues: [],
  boundary: {
    explicitStructuralApproval: true,
    groupsAsPartContainersOnly: true,
    groupDrawableTextureMeshRefs: "forbidden",
    rawParserObjectPersistence: "notPersisted",
    sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
    materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
    publicDemoAsset: false,
    semanticRecognition: "notProvided",
    repoProposalGeneration: "notProvided",
    initialGridMeshGeneration: "notProvided",
    photoshopCompositingClaim: "none"
  }
});

const createGroupPartScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "groupPartContainer",
  sourceGroupRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceGroupId: "psd:root/group[2]",
    sourceGroupName: "hair_front",
    sourceGroupPath: ["hair_front"]
  },
  sourceGroupName: "hair_front",
  sourceGroupPath: ["hair_front"],
  sourceOrder: 2,
  visibleInSource: true,
  opacityInSource: 1,
  bounds: { x: 680, y: 120, width: 660, height: 660 },
  generatedParentPartId: "part_root",
  generatedPartId: "part_psd_group_hair_front",
  generatedPartDisplayName: "hair_front",
  status,
  statusReasons: []
} as const);

const createVisibleLeafScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "leafDrawableScaffold",
  sourceLayerRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceLayerId: "psd:root/group[2]/layer[0]",
    sourceLayerName: "front hair",
    sourceLayerPath: ["hair_front", "front hair"]
  },
  sourceParentGroupRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceGroupId: "psd:root/group[2]",
    sourceGroupName: "hair_front",
    sourceGroupPath: ["hair_front"]
  },
  sourceLayerName: "front hair",
  sourceLayerPath: ["hair_front", "front hair"],
  sourceOrder: 3,
  visibleInSource: true,
  opacityInSource: 1,
  bounds: { x: 692, y: 144, width: 620, height: 620 },
  byteEstimate: 1537600,
  generatedParentPartId: "part_psd_group_hair_front",
  generatedDrawableId: "draw_front_hair_structural",
  generatedDrawableDisplayName: "front hair",
  generatedTextureId: "tex_front_hair_structural",
  generatedMeshId: "mesh_front_hair_structural",
  initialRuntimeVisibility: true,
  status,
  statusReasons: []
} as const);

const createHiddenLeafScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "leafDrawableScaffold",
  sourceLayerRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceLayerId: "psd:root/layer[1]",
    sourceLayerName: "headwear",
    sourceLayerPath: ["headwear"]
  },
  sourceLayerName: "headwear",
  sourceLayerPath: ["headwear"],
  sourceOrder: 1,
  visibleInSource: false,
  opacityInSource: 1,
  bounds: { x: 807, y: 93, width: 400, height: 286 },
  byteEstimate: 457600,
  generatedParentPartId: "part_root",
  generatedDrawableId: "draw_headwear_hidden",
  generatedDrawableDisplayName: "headwear",
  generatedTextureId: "tex_headwear_hidden",
  generatedMeshId: "mesh_headwear_hidden",
  initialRuntimeVisibility: false,
  status,
  statusReasons: []
} as const);

const createHiddenParentGroupScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "groupPartContainer",
  sourceGroupRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceGroupId: "psd:root/group[5]",
    sourceGroupName: "hidden_parent",
    sourceGroupPath: ["hidden_parent"]
  },
  sourceGroupName: "hidden_parent",
  sourceGroupPath: ["hidden_parent"],
  sourceOrder: 5,
  visibleInSource: false,
  localVisibleInSource: false,
  effectiveVisibleInSource: false,
  opacityInSource: 1,
  bounds: { x: 20, y: 30, width: 64, height: 64 },
  generatedParentPartId: "part_root",
  generatedPartId: "part_psd_group_hidden_parent",
  generatedPartDisplayName: "hidden_parent",
  status,
  statusReasons: []
} as const);

const createParentHiddenVisibleLeafScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "leafDrawableScaffold",
  sourceLayerRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceLayerId: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerId,
    sourceLayerName: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerName,
    sourceLayerPath: [...PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerPath]
  },
  sourceParentGroupRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceGroupId: "psd:root/group[5]",
    sourceGroupName: "hidden_parent",
    sourceGroupPath: ["hidden_parent"]
  },
  sourceLayerName: PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerName,
  sourceLayerPath: [...PARENT_HIDDEN_VISIBLE_LAYER.sourceLayerPath],
  sourceOrder: 6,
  visibleInSource: false,
  localVisibleInSource: true,
  effectiveVisibleInSource: false,
  opacityInSource: 1,
  bounds: { x: 20, y: 30, width: 64, height: 64 },
  byteEstimate: PARENT_HIDDEN_VISIBLE_LAYER.byteLength,
  generatedParentPartId: "part_psd_group_hidden_parent",
  generatedDrawableId: "draw_parent_hidden_child",
  generatedDrawableDisplayName: "visible child",
  generatedTextureId: PARENT_HIDDEN_VISIBLE_LAYER.textureId,
  generatedMeshId: "mesh_parent_hidden_child",
  initialRuntimeVisibility: true,
  status,
  statusReasons: []
} as const);

const createFixtureSession = (options: FixtureSessionOptions = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_psd_structural_scaffold_test"),
    packageDisplayName: "PSD Structural Scaffold Test",
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
        childPartIds: options.extraParts?.map((part) => part.partId) ?? [],
        drawableIds: []
      },
      ...(options.extraParts ?? [])
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
        sourceAssetId: SOURCE_ASSET_ID,
        kind: "psd-source-v1",
        filePath: "assets/sources/private/source.psd",
        contentHash: `sha256:${SOURCE_PSD_DIGEST.hex}`,
        importProfile: "layered-character-psd-profile-v1",
        layers: [
          createSourceLayer({
            sourceLayerId: "psd:root/group[2]/layer[0]",
            originalName: "front hair",
            groupPath: ["hair_front"],
            visibleInSource: true,
            bounds: { x: 692, y: 144, width: 620, height: 620 }
          }),
          createSourceLayer({
            sourceLayerId: "psd:root/layer[1]",
            originalName: "headwear",
            groupPath: [],
            visibleInSource: false,
            bounds: { x: 807, y: 93, width: 400, height: 286 }
          })
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
          sourceGroups: [
            {
              sourceGroupId: "psd:root/group[2]",
              originalName: "hair_front",
              normalizedName: "hair_front",
              groupPath: ["hair_front"],
              sourceOrder: 2,
              visibleInSource: true,
              opacityInSource: 1,
              bounds: { x: 680, y: 120, width: 660, height: 660 },
              unsupportedFeatures: []
            }
          ],
          sourceLayers: [
            {
              sourceLayerId: "psd:root/group[2]/layer[0]",
              originalName: "front hair",
              normalizedName: "front hair",
              parentGroupId: "psd:root/group[2]",
              groupPath: ["hair_front"],
              sourceOrder: 3,
              bounds: { x: 692, y: 144, width: 620, height: 620 },
              visibleInSource: true,
              opacityInSource: 1,
              role: "editableLayer",
              unsupportedFeatures: []
            },
            {
              sourceLayerId: "psd:root/layer[1]",
              originalName: "headwear",
              normalizedName: "headwear",
              groupPath: [],
              sourceOrder: 1,
              bounds: { x: 807, y: 93, width: 400, height: 286 },
              visibleInSource: false,
              opacityInSource: 1,
              role: "editableLayer",
              unsupportedFeatures: []
            }
          ],
          unsupportedFeatures: [],
          materializationEvidence: [
            createMaterializationEvidence(FRONT_HAIR_LAYER),
            createMaterializationEvidence(HIDDEN_HEADWEAR_LAYER)
          ],
          psdStructuralScaffoldPlanEvidence: [createStructuralPlanEvidence()],
          psdStructuralScaffoldApprovalEvidence: [createStructuralApprovalEvidence()],
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
        assetId: "src_psd_structural",
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
        assetId: "src_psd_structural",
        rightsStatus: "cleared",
        license: "private-local",
        redistributionAllowed: false
      }
    ]
  }
});

const createSourceLayer = (input: {
  readonly sourceLayerId: string;
  readonly originalName: string;
  readonly groupPath: readonly string[];
  readonly visibleInSource: boolean;
  readonly localVisibleInSource?: boolean;
  readonly effectiveVisibleInSource?: boolean;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}) => ({
  sourceLayerId: input.sourceLayerId,
  sourceAssetId: SOURCE_ASSET_ID,
  originalName: input.originalName,
  normalizedName: input.originalName.toLowerCase(),
  groupPath: [...input.groupPath],
  bounds: input.bounds,
  visibleInSource: input.visibleInSource,
  ...(input.localVisibleInSource === undefined
    ? {}
    : { localVisibleInSource: input.localVisibleInSource }),
  ...(input.effectiveVisibleInSource === undefined
    ? {}
    : { effectiveVisibleInSource: input.effectiveVisibleInSource }),
  opacityInSource: 1,
  role: "editableLayer" as const,
  unsupportedFeatures: [],
  mappedDrawableIds: []
});

const createMaterializationEvidence = (layer: LayerFixture) => PsdAdapterLayerMaterializationEvidenceSchema.parse({
  evidenceKind: "psd-layer-materialization-evidence-v1",
  materializationId: layer.materializationId,
  sourceLayerRef: {
    sourceAssetId: SOURCE_ASSET_ID,
    sourceLayerId: layer.sourceLayerId,
    sourceLayerName: layer.sourceLayerName,
    sourceLayerPath: [...layer.sourceLayerPath]
  },
  mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  byteLength: layer.byteLength,
  digest: layer.digest,
  width: layer.width,
  height: layer.height,
  binaryAssetRef: createTextureBinaryAssetReference(layer),
  textureId: layer.textureId,
  provenance: {
    sourceFilePath: "private/source.psd",
    sourceDigest: SOURCE_PSD_DIGEST,
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
});

const createSourcePsdIdentity = () => ({
  sourceAssetId: SOURCE_ASSET_ID,
  sourceFilePath: "private/source.psd",
  digest: SOURCE_PSD_DIGEST,
  byteLength: SOURCE_PSD_BYTE_LENGTH,
  mediaType: "image/vnd.adobe.photoshop",
  sourceBytePersistence: "metadataOnlyNoRawBytes",
  publicDemoAsset: false
} as const);

const createSourceBinaryAssetReference = () => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_psd_structural_source",
  packageRelativePath: "assets/sources/private/source.psd",
  digest: SOURCE_PSD_DIGEST,
  byteLength: SOURCE_PSD_BYTE_LENGTH,
  mediaType: "image/vnd.adobe.photoshop",
  storageStatus: "stored-package-local-v1",
  provenanceId: ProvenanceIdSchema.parse("prov_import_psd_source"),
  rightsAssetId: "src_psd_structural"
} as const);

const createTextureBinaryAssetReference = (layer: LayerFixture) => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: layer.binaryAssetId,
  packageRelativePath: layer.packageRelativePath,
  digest: layer.digest,
  byteLength: layer.byteLength,
  mediaType: PSD_SELECTED_LAYER_RAW_RGBA_MEDIA_TYPE,
  storageStatus: "stored-package-local-v1",
  provenanceId: ProvenanceIdSchema.parse(layer.provenanceId),
  rightsAssetId: "src_psd_structural"
} as const);

const STRUCTURAL_SUMMARY = {
  sourceGroupCount: 1,
  sourceLayerCount: 2,
  approvedGroupCount: 1,
  approvedLeafCount: 2,
  generatedGroupPartCount: 1,
  generatedDrawableCount: 2,
  hiddenLeafCount: 1,
  runtimeHiddenDrawableCount: 1,
  structuralDepth: 2,
  totalByteEstimate: 1995200
} as const;

const STRUCTURAL_CAP_POLICY = {
  structuralNodeLimit: 256,
  structuralDepthLimit: 8,
  approvedGroupLimit: 128,
  approvedLeafLimit: 256,
  generatedNodeLimit: 512,
  totalRawRgbaByteLimit: 268435456
} as const;

const STRUCTURAL_PLAN_DIGEST = {
  algorithm: "sha256",
  hex: "1111111111111111111111111111111111111111111111111111111111111111"
} as const;
const STRUCTURAL_APPROVAL_DIGEST = {
  algorithm: "sha256",
  hex: "2222222222222222222222222222222222222222222222222222222222222222"
} as const;
const OTHER_APPROVAL_DIGEST = {
  algorithm: "sha256",
  hex: "5555555555555555555555555555555555555555555555555555555555555555"
} as const;
const OTHER_PLAN_DIGEST = {
  algorithm: "sha256",
  hex: "3333333333333333333333333333333333333333333333333333333333333333"
} as const;
const SOURCE_PSD_DIGEST = {
  algorithm: "sha256",
  hex: "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5"
} as const;
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_psd_structural");
const SOURCE_PSD_BYTE_LENGTH = 22406225;
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

const FRONT_HAIR_LAYER = {
  sourceLayerId: "psd:root/group[2]/layer[0]",
  sourceLayerName: "front hair",
  sourceLayerPath: ["hair_front", "front hair"],
  materializationId: "mat_psd_root_group_2_layer_0",
  binaryAssetId: "bin_psd_front_hair_rgba",
  packageRelativePath: "assets/textures/psd/front-hair.raw-rgba",
  provenanceId: "prov_psd_front_hair_rgba",
  textureId: "tex_front_hair_structural",
  width: 620,
  height: 620,
  byteLength: 1537600,
  digest: {
    algorithm: "sha256",
    hex: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  }
} as const;

const HIDDEN_HEADWEAR_LAYER = {
  sourceLayerId: "psd:root/layer[1]",
  sourceLayerName: "headwear",
  sourceLayerPath: ["headwear"],
  materializationId: "mat_psd_root_layer_1",
  binaryAssetId: "bin_psd_headwear_hidden_rgba",
  packageRelativePath: "assets/textures/psd/headwear-hidden.raw-rgba",
  provenanceId: "prov_psd_headwear_hidden_rgba",
  textureId: "tex_headwear_hidden",
  width: 400,
  height: 286,
  byteLength: 457600,
  digest: {
    algorithm: "sha256",
    hex: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
  }
} as const;

const PARENT_HIDDEN_VISIBLE_LAYER = {
  sourceLayerId: "psd:root/group[5]/layer[0]",
  sourceLayerName: "visible child",
  sourceLayerPath: ["hidden_parent", "visible child"],
  materializationId: "mat_psd_root_group_5_layer_0",
  binaryAssetId: "bin_psd_parent_hidden_child_rgba",
  packageRelativePath: "assets/textures/psd/parent-hidden-child.raw-rgba",
  provenanceId: "prov_psd_parent_hidden_child_rgba",
  textureId: "tex_parent_hidden_child",
  width: 64,
  height: 64,
  byteLength: 16384,
  digest: {
    algorithm: "sha256",
    hex: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
  }
} as const;

type StructuralRequestOptions = {
  readonly approvalStatus?:
    | "approved"
    | "structuralPlanStale"
    | "approvalSelectionMismatch"
    | "preflightBlocked"
    | "structuralExpansionCapExceeded";
  readonly approvalPlanDigest?: FixtureDigest;
  readonly approvalSelectionDigest?: FixtureDigest;
  readonly plannedGroupPartScaffolds?: readonly unknown[];
  readonly plannedLeafScaffolds?: readonly unknown[];
  readonly approvedGroupPartScaffolds?: readonly unknown[];
  readonly approvedLeafScaffolds?: readonly unknown[];
};

type FixtureSessionOptions = {
  readonly extraParts?: AuthoringSession["graph"]["parts"];
};

type LayerFixture =
  | typeof FRONT_HAIR_LAYER
  | typeof HIDDEN_HEADWEAR_LAYER
  | typeof PARENT_HIDDEN_VISIBLE_LAYER;

type FixtureDigest = {
  readonly algorithm: "sha256";
  readonly hex: string;
};
