import { describe, expect, it } from "vitest";

import {
  PsdStructuralScaffoldApprovalBridgeEvidenceSchema,
  PsdStructuralScaffoldCapPolicySchema,
  PsdStructuralScaffoldGroupPartSchema,
  PsdStructuralScaffoldLeafDrawableSchema,
  PsdStructuralScaffoldPlanEvidenceSchema,
  SourceManifestSchema,
  stringifyJsonDeterministic
} from "./index.js";

describe("PSD structural scaffold package evidence contract", () => {
  it("parses structural group containers and leaf scaffolds without raw parser or PSD bytes", () => {
    const bridge = createStructuralScaffoldBridge();
    const parsedBridge = PsdStructuralScaffoldApprovalBridgeEvidenceSchema.parse(bridge);
    const manifest = SourceManifestSchema.parse(createSourceManifestWithStructuralEvidence(bridge));
    const serialized = stringifyJsonDeterministic(manifest);

    expect(parsedBridge.structuralPlan.plannedGroupPartScaffolds[0]).toMatchObject({
      scaffoldKind: "groupPartContainer",
      sourceGroupRef: {
        sourceGroupId: "psd:root/group[2]"
      },
      generatedPartId: "part_psd_group_2"
    });
    expect(parsedBridge.structuralPlan.plannedLeafScaffolds).toEqual([
      expect.objectContaining({
        scaffoldKind: "leafDrawableScaffold",
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
    expect(manifest.sourceAssets[0]?.psdProfile?.psdStructuralScaffoldPlanEvidence?.[0])
      .toEqual(parsedBridge.structuralPlan);
    expect(serialized).not.toContain("rawLayerObject");
    expect(serialized).not.toContain("sourcePsdBytes");
    expect(serialized).not.toContain("rawRgba");
  });

  it("rejects group containers that try to carry drawable, texture, or mesh refs", () => {
    expect(
      PsdStructuralScaffoldGroupPartSchema.safeParse({
        ...createGroupPartScaffold(),
        generatedDrawableId: "draw_group_is_not_allowed"
      }).success
    ).toBe(false);
  });

  it("rejects leaf scaffolds whose initial runtime visibility diverges from local source visibility", () => {
    expect(
      PsdStructuralScaffoldLeafDrawableSchema.safeParse({
        ...createHiddenLeafScaffold(),
        initialRuntimeVisibility: true
      }).success
    ).toBe(false);
  });

  it("allows parent-hidden leaves to keep runtime visibility from local layer visibility", () => {
    expect(
      PsdStructuralScaffoldLeafDrawableSchema.safeParse({
        ...createVisibleLeafScaffold(),
        visibleInSource: false,
        localVisibleInSource: true,
        effectiveVisibleInSource: false,
        initialRuntimeVisibility: true
      }).success
    ).toBe(true);

    expect(
      PsdStructuralScaffoldLeafDrawableSchema.safeParse({
        ...createVisibleLeafScaffold(),
        visibleInSource: false,
        localVisibleInSource: true,
        effectiveVisibleInSource: false,
        initialRuntimeVisibility: false
      }).success
    ).toBe(false);
  });

  it("rejects invalid structural cap shapes", () => {
    expect(
      PsdStructuralScaffoldCapPolicySchema.safeParse({
        ...STRUCTURAL_CAP_POLICY,
        approvedLeafLimit: 0
      }).success
    ).toBe(false);

    expect(
      PsdStructuralScaffoldPlanEvidenceSchema.safeParse({
        ...createStructuralPlanEvidence(),
        capPolicy: {
          ...STRUCTURAL_CAP_POLICY,
          structuralDepthLimit: -1
        }
      }).success
    ).toBe(false);
  });
});

const createSourceManifestWithStructuralEvidence = (
  bridge: ReturnType<typeof createStructuralScaffoldBridge>
) => ({
  schemaVersion: "source-manifest-v1",
  sourceAssets: [
    {
      sourceAssetId: "src_psd_structural",
      kind: "psd-source-v1",
      filePath: "assets/sources/private/source.psd",
      contentHash: `sha256:${SOURCE_PSD_DIGEST.hex}`,
      importProfile: "layered-character-psd-profile-v1",
      layers: [],
      diagnostics: [],
      psdProfile: {
        schemaVersion: "layered-character-psd-profile-v1",
        adapter: {
          adapterName: "fixture-browser-psd-adapter",
          adapterResultSchemaVersion: "psd-adapter-result-v1",
          sourceProfile: "layered-character-psd-profile-v1",
          evidenceKind: "real-psd-parse-result-v1",
          parser: PSD_PARSER_EVIDENCE
        },
        canvas: {
          width: 2048,
          height: 3072
        },
        sourceGroups: [],
        sourceLayers: [],
        unsupportedFeatures: [],
        diagnostics: [],
        psdStructuralScaffoldPlanEvidence: [bridge.structuralPlan],
        psdStructuralScaffoldApprovalEvidence: [bridge.approval],
        compatibility: {
          structuredProfilePrecedence: "structured-profile-preferred-v1",
          flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
          flattenedUnsupportedFeaturesFallback:
            "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
        }
      }
    }
  ]
});

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
      issueId: "issue_wave50_source_group_mapping_reserved",
      issueKind: "sourceGroupMappingMissing",
      checkId: "operation.importPsdStructuralScaffold.sourceGroupMappingMissing",
      message: "Reserved structural source group mapping hook.",
      sourceGroupRef: {
        sourceAssetId: "src_psd_structural",
        sourceGroupId: "psd:root/group[99]"
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
      issueId: "issue_wave50_visibility_hook_reserved",
      issueKind: "initialRuntimeVisibilityMismatch",
      checkId: "operation.importPsdStructuralScaffold.initialRuntimeVisibilityMismatch",
      message: "Reserved structural runtime visibility mismatch hook.",
      sourceLayerRef: {
        sourceAssetId: "src_psd_structural",
        sourceLayerId: "psd:root/layer[1]"
      }
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

const createGroupPartScaffold = (status: "previewReady" | "approved" = "previewReady") => ({
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

const createVisibleLeafScaffold = (status: "previewReady" | "approved" = "previewReady") => ({
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

const createHiddenLeafScaffold = (status: "previewReady" | "approved" = "previewReady") => ({
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
