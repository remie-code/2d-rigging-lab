import { describe, expect, it } from "vitest";

import {
  ImportPsdStructuralScaffoldPayloadSchema,
  OperationPayloadSchema,
  OperationResultSchema,
  PsdStructuralScaffoldGroupPartSchema,
  PsdStructuralScaffoldLeafDrawableSchema,
  PsdStructuralScaffoldOperationEvidenceDtoSchema
} from "./index.js";

describe("PSD structural scaffold operation DTO contracts", () => {
  it("parses structural scaffold payload, registered operation payload, and result evidence", () => {
    const payload = ImportPsdStructuralScaffoldPayloadSchema.parse(createStructuralPayload());
    const evidence = PsdStructuralScaffoldOperationEvidenceDtoSchema.parse(
      createStructuralOperationEvidence()
    );
    const result = OperationResultSchema.parse({
      schemaVersion: "operation-result-v1",
      operationId: "op_import_psd_structural_scaffold",
      status: "dry_run",
      precondition: {
        ok: true,
        diagnostics: []
      },
      diagnostics: [],
      psdStructuralScaffoldEvidence: [evidence],
      reversible: true
    });

    expect(payload.structuralScaffoldBridge.approval.approvedGroupPartScaffolds[0])
      .toMatchObject({
        scaffoldKind: "groupPartContainer",
        generatedPartId: "part_psd_group_2"
      });
    expect(evidence.generatedLeafScaffolds).toEqual([
      expect.objectContaining({
        sourceLayerRef: expect.objectContaining({ sourceLayerId: "psd:root/group[2]/layer[0]" }),
        generatedParentPartId: "part_psd_group_2",
        generatedDrawableId: "draw_front_hair",
        initialRuntimeVisibility: true
      }),
      expect.objectContaining({
        sourceLayerRef: expect.objectContaining({ sourceLayerId: "psd:root/layer[1]" }),
        generatedParentPartId: "part_root",
        initialRuntimeVisibility: false
      })
    ]);
    expect(result.psdStructuralScaffoldEvidence?.[0]?.operationType)
      .toBe("importPsdStructuralScaffold");
    expect(
      OperationPayloadSchema.safeParse({
        operationType: "importPsdStructuralScaffold",
        payload
      }).success
    ).toBe(true);
  });

  it("keeps existing leaf-only batch operation payloads parseable", () => {
    const parsed = OperationPayloadSchema.parse(createLeafOnlyBatchOperationPayload());

    expect(parsed.operationType).toBe("importPsdLayerMaterializationBatch");
    if (parsed.operationType !== "importPsdLayerMaterializationBatch") {
      throw new Error("Expected batch payload.");
    }
    expect(parsed.payload.importPlanBridge).toBeUndefined();
    expect(parsed.payload.entries[0]?.materialization.sourceLayerRef.sourceLayerId)
      .toBe("psd:root/group[2]/layer[0]");
  });

  it("rejects invalid structural group-as-drawable and visibility shapes", () => {
    expect(
      PsdStructuralScaffoldGroupPartSchema.safeParse({
        ...createGroupPartScaffold(),
        generatedTextureId: "tex_group_is_not_allowed"
      }).success
    ).toBe(false);

    expect(
      PsdStructuralScaffoldLeafDrawableSchema.safeParse({
        ...createHiddenLeafScaffold(),
        initialRuntimeVisibility: true
      }).success
    ).toBe(false);

    expect(
      ImportPsdStructuralScaffoldPayloadSchema.safeParse({
        ...createStructuralPayload(),
        capPolicy: {
          ...STRUCTURAL_CAP_POLICY,
          generatedNodeLimit: 0
        }
      }).success
    ).toBe(false);
  });
});

const createStructuralPayload = () => ({
  sourceAssetId: "src_psd_structural",
  batchId: "batch_wave50_structural",
  destination: {
    destinationKind: "structuralScaffold",
    parentPartId: "part_root"
  },
  structuralScaffoldBridge: createStructuralScaffoldBridge(),
  capPolicy: STRUCTURAL_CAP_POLICY,
  lockedTargetIds: []
} as const);

const createStructuralOperationEvidence = () => ({
  schemaVersion: "psd-structural-scaffold-operation-evidence-v1",
  operationType: "importPsdStructuralScaffold",
  evidenceId: "evidence_batch_wave50_structural",
  operationId: "op_import_psd_structural_scaffold",
  batchId: "batch_wave50_structural",
  sourceAssetId: "src_psd_structural",
  destination: {
    destinationKind: "structuralScaffold",
    parentPartId: "part_root"
  },
  structuralScaffoldBridge: createStructuralScaffoldBridge(),
  aggregateStatus: "success",
  generatedGroupPartScaffolds: [createGroupPartScaffold("resolved")],
  generatedLeafScaffolds: [
    createVisibleLeafScaffold("resolved"),
    createHiddenLeafScaffold("resolved")
  ],
  issues: [
    {
      issueId: "issue_wave50_structural_cap_hook_reserved",
      issueKind: "structuralExpansionCapExceeded",
      checkId: "operation.importPsdStructuralScaffold.structuralExpansionCapExceeded",
      message: "Reserved structural cap hook."
    },
    {
      issueId: "issue_wave50_structural_order_hook_reserved",
      issueKind: "structuralSourceOrderMismatch",
      checkId: "operation.importPsdStructuralScaffold.sourceOrderMismatch",
      message: "Reserved structural source order hook.",
      sourceOrder: 3
    }
  ],
  preflightPolicy: {
    approvedLeafLimit: 256,
    approvedGroupLimit: 128,
    generatedNodeLimit: 512,
    totalRawRgbaByteLimit: 268435456,
    mutationPolicy: "preflightBlocksOnAnyFailure",
    silentPartialSuccess: "forbidden"
  },
  persistenceBoundary: {
    rawParserObjectPersistence: "notPersisted",
    sourcePsdBytePersistence: "metadataOnlyNoRawBytes",
    materializedLayerBytePersistence: "binaryAssetRefOnlyNoInlineBytes",
    photoshopCompositingClaim: "none",
    rendererPixelOracleClaim: "none",
    initialGridMeshGeneration: "notProvided",
    semanticRecognition: "notProvided",
    repoProposalGeneration: "notProvided"
  }
} as const);

const createStructuralScaffoldBridge = () => ({
  schemaVersion: "psd-structural-scaffold-approval-bridge-evidence-v1",
  structuralPlan: createStructuralPlanEvidence(),
  approval: createStructuralApprovalEvidence()
} as const);

const createStructuralPlanEvidence = () => ({
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
  plannedGroupPartScaffolds: [createGroupPartScaffold()],
  plannedLeafScaffolds: [createVisibleLeafScaffold(), createHiddenLeafScaffold()],
  summary: STRUCTURAL_SUMMARY,
  capPolicy: STRUCTURAL_CAP_POLICY,
  issues: [
    {
      issueId: "issue_wave50_source_layer_mapping_reserved",
      issueKind: "sourceLayerMappingMissing",
      checkId: "operation.importPsdStructuralScaffold.sourceLayerMappingMissing",
      message: "Reserved structural source layer mapping hook.",
      sourceLayerRef: {
        sourceAssetId: "src_psd_structural",
        sourceLayerId: "psd:root/layer[99]"
      }
    }
  ],
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
} as const);

const createStructuralApprovalEvidence = () => ({
  schemaVersion: "psd-structural-scaffold-approval-evidence-v1",
  evidenceKind: "psd-structural-scaffold-approval-evidence-v1",
  approvalId: "approval_wave50Structural",
  structuralPlanDigest: STRUCTURAL_PLAN_DIGEST,
  approvalSelectionDigest: STRUCTURAL_APPROVAL_DIGEST,
  sourcePsd: createSourcePsdIdentity(),
  destination: {
    destinationKind: "structuralScaffold",
    parentPartId: "part_root"
  },
  approvalStatus: "approved",
  approvedGroupPartScaffolds: [createGroupPartScaffold("approved")],
  approvedLeafScaffolds: [
    createVisibleLeafScaffold("approved"),
    createHiddenLeafScaffold("approved")
  ],
  summary: STRUCTURAL_SUMMARY,
  capPolicy: STRUCTURAL_CAP_POLICY,
  issues: [
    {
      issueId: "issue_wave50_structural_stale_reserved",
      issueKind: "structuralPlanStale",
      checkId: "operation.importPsdStructuralScaffold.structuralPlanStale",
      message: "Reserved structural stale hook."
    },
    {
      issueId: "issue_wave50_structural_byte_unavailable_reserved",
      issueKind: "structuralByteUnavailable",
      checkId: "operation.importPsdStructuralScaffold.byteUnavailable",
      message: "Reserved structural byte unavailable hook."
    },
    {
      issueId: "issue_wave50_structural_parentage_reserved",
      issueKind: "structuralParentageMismatch",
      checkId: "operation.importPsdStructuralScaffold.parentageMismatch",
      message: "Reserved structural parentage hook."
    },
    {
      issueId: "issue_wave50_structural_collision_reserved",
      issueKind: "structuralGeneratedRefCollision",
      checkId: "operation.importPsdStructuralScaffold.generatedRefCollision",
      message: "Reserved structural generated ref collision hook."
    }
  ],
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
} as const);

const createGroupPartScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "groupPartContainer",
  sourceGroupRef: {
    sourceAssetId: "src_psd_structural",
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
  generatedPartId: "part_psd_group_2",
  generatedPartDisplayName: "hair_front",
  status,
  statusReasons: []
} as const);

const createVisibleLeafScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "leafDrawableScaffold",
  sourceLayerRef: {
    sourceAssetId: "src_psd_structural",
    sourceLayerId: "psd:root/group[2]/layer[0]",
    sourceLayerName: "front hair",
    sourceLayerPath: ["hair_front", "front hair"]
  },
  sourceParentGroupRef: {
    sourceAssetId: "src_psd_structural",
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
  generatedParentPartId: "part_psd_group_2",
  generatedDrawableId: "draw_front_hair",
  generatedDrawableDisplayName: "front hair",
  generatedTextureId: "tex_front_hair",
  generatedMeshId: "mesh_front_hair",
  initialRuntimeVisibility: true,
  status,
  statusReasons: []
} as const);

const createHiddenLeafScaffold = (
  status: "previewReady" | "approved" | "resolved" = "previewReady"
) => ({
  scaffoldKind: "leafDrawableScaffold",
  sourceLayerRef: {
    sourceAssetId: "src_psd_structural",
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

const createLeafOnlyBatchOperationPayload = () => ({
  operationType: "importPsdLayerMaterializationBatch",
  payload: {
    sourceAssetId: "src_psd_structural",
    batchId: "batch_leaf_only",
    destination: {
      destinationKind: "generatedPartScaffold",
      parentPartId: "part_root"
    },
    entries: [
      {
        materialization: {
          evidenceKind: "psd-layer-materialization-evidence-v1",
          materializationId: "mat_front_hair",
          sourceLayerRef: {
            sourceAssetId: "src_psd_structural",
            sourceLayerId: "psd:root/group[2]/layer[0]",
            sourceLayerName: "front hair",
            sourceLayerPath: ["hair_front", "front hair"]
          },
          mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
          byteLength: 16,
          digest: STRUCTURAL_APPROVAL_DIGEST,
          width: 2,
          height: 2,
          provenance: {
            sourceFilePath: "private/source.psd",
            sourceDigest: SOURCE_PSD_DIGEST,
            sourceByteLength: 22406225,
            sourceMediaType: "image/vnd.adobe.photoshop",
            privacyLabel: "packageLocalAsset",
            publicDistribution: "notPublicDistributable",
            publicDemoAsset: false
          },
          parser: PSD_PARSER_EVIDENCE
        }
      }
    ],
    lockedTargetIds: []
  }
} as const);

const createSourcePsdIdentity = () => ({
  sourceAssetId: "src_psd_structural",
  sourceFilePath: "private/source.psd",
  digest: SOURCE_PSD_DIGEST,
  byteLength: 22406225,
  mediaType: "image/vnd.adobe.photoshop",
  sourceBytePersistence: "metadataOnlyNoRawBytes",
  publicDemoAsset: false
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
const SOURCE_PSD_DIGEST = {
  algorithm: "sha256",
  hex: "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5"
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
