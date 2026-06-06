import { describe, expect, it } from "vitest";

import type { BrowserPsdImportPlanCandidatePlan } from "./browser-psd-import-plan-candidate-result.js";
import {
  collectApprovedPsdImportPlanLeafRefs,
  createEditorPsdImportPlanApprovalBridgeEvidence
} from "./explicit-psd-import-plan-approval-bridge.js";

describe("explicit PSD import plan approval bridge", () => {
  it("builds parser-free bridge evidence for approved leaf candidates only", async () => {
    const plan = createPlan();
    const bridge = await createEditorPsdImportPlanApprovalBridgeEvidence({
      plan,
      sourceAssetId: "src_explicit_psd_sample_model_128",
      sourceFilePath: "assets/sources/psd/sample_model_128.psd",
      destinationParentPartId: "part_root"
    });

    expect(collectApprovedPsdImportPlanLeafRefs(plan)).toEqual([
      "psd:root/layer[0]",
      "psd:root/group[2]/layer[0]"
    ]);
    expect(bridge).toMatchObject({
      schemaVersion: "psd-import-plan-approval-bridge-evidence-v1",
      candidatePlan: {
        planId: "plan_wave48Root",
        sourcePsd: {
          sourceAssetId: "src_explicit_psd_sample_model_128",
          byteLength: 128,
          sourceBytePersistence: "metadataOnlyNoRawBytes",
          publicDemoAsset: false
        },
        summary: {
          candidateCount: 4,
          approvedCandidateCount: 2,
          notApprovedCandidateCount: 2,
          blockedCandidateCount: 1
        }
      },
      approval: {
        approvalId: "approval_wave48Root",
        approvalStatus: "approved",
        destination: {
          destinationKind: "generatedPartScaffold",
          parentPartId: "part_root"
        },
        boundary: {
          onlyApprovedLeafRefsPassedToBatch: true,
          publicDemoAsset: false
        }
      }
    });
    expect(bridge.approval.approvedLeafRefs.map((leaf) => leaf.sourceLayerRef.sourceLayerId)).toEqual([
      "psd:root/layer[0]",
      "psd:root/group[2]/layer[0]"
    ]);
    expect(bridge.approval.notApprovedCandidates.map((candidate) =>
      candidate.sourceLayerRef.sourceLayerId
    )).toEqual(["psd:root/layer[2]"]);
    expect(bridge.approval.blockedCandidates.map((candidate) =>
      candidate.sourceLayerRef.sourceLayerId
    )).toEqual(["psd:root/layer[1]"]);
    expect(bridge.approval.approvedLeafRefs[0]?.resolvedGeneratedIds).toMatchObject({
      parentPartId: "part_root",
      partId: "part_headwear",
      drawableId: "draw_headwear",
      textureId: "tex_headwear",
      meshId: "mesh_headwear",
      status: "resolved"
    });
    expect(bridge.approval.approvedLeafRefs[1]?.resolvedGeneratedIds).toMatchObject({
      parentPartId: "part_root",
      partId: "part_hair_front_hair",
      drawableId: "draw_hair_front_hair",
      textureId: "tex_hair_front_hair",
      meshId: "mesh_hair_front_hair",
      status: "resolved"
    });
    expect(JSON.stringify(bridge)).not.toContain("rawBytes");
  });
});

const createPlan = (): BrowserPsdImportPlanCandidatePlan => ({
  evidenceKind: "browser-psd-import-plan-candidate-plan-v1",
  planId: "plan_wave48Root",
  status: "ready",
  source: {
    evidenceKind: "browser-psd-source-evidence-v1",
    intakeKind: "explicitFile",
    sourceAssetId: "src_browser_psd_import",
    fileName: "sample_model.psd",
    declaredMediaType: "image/vnd.adobe.photoshop",
    byteLength: 128,
    sizeCapBytes: 32 * 1024 * 1024,
    privacy: {
      privacyLabel: "packageLocalAsset",
      publicDistribution: "notPublicDistributable",
      rawBytesPersistence: "notPersistedByParserBridge"
    }
  },
  sourceDigest: { algorithm: "sha256", hex: "1".repeat(64) },
  parser: {
    evidenceKind: "psd-parser-evidence-v1",
    parserName: "webtoonPsd",
    parserPackageName: "@webtoon/psd",
    parserVersion: "0.4.0",
    runtime: "browser",
    privateShapePolicy: "parser-private-shape-excluded-v1"
  },
  scope: {
    scopeRef: "psd:root",
    scopeKind: "root",
    discoveryMode: "recursiveLeafCandidatePreview",
    displayPath: []
  },
  caps: {
    maxSourceBytes: 32 * 1024 * 1024,
    maxLeafCandidates: 200,
    maxLeafRawRgbaBytes: 64 * 1024 * 1024,
    maxApprovedLeaves: 4,
    maxApprovedRawRgbaBytes: 32 * 1024 * 1024
  },
  candidatePlanDigest: {
    algorithm: "sha256",
    hex: "2".repeat(64),
    canonicalJsonByteLength: 512
  },
  candidates: [
    createCandidate({
      layerRef: "psd:root/layer[0]",
      displayName: "headwear",
      fullPath: ["headwear"],
      statuses: ["candidate"],
      approved: true,
      approvedOrder: 0
    }),
    createCandidate({
      layerRef: "psd:root/group[2]/layer[0]",
      displayName: "front hair",
      fullPath: ["Hair", "front hair"],
      statuses: ["candidate"],
      approved: true,
      approvedOrder: 1
    }),
    createCandidate({
      layerRef: "psd:root/layer[1]",
      displayName: "hidden",
      fullPath: ["hidden"],
      statuses: ["hidden", "unsupported", "notApproved"],
      approved: false,
      approvalBlockedReasons: ["hiddenLayerUnsupported"]
    }),
    createCandidate({
      layerRef: "psd:root/layer[2]",
      displayName: "eyewear",
      fullPath: ["eyewear"],
      statuses: ["candidate", "notApproved"],
      approved: false
    })
  ],
  summary: {
    totalLeafCount: 4,
    eligibleCandidateCount: 3,
    hiddenCount: 1,
    unsupportedCount: 1,
    emptyZeroSizeCount: 0,
    duplicateRefCount: 0,
    duplicateNameCount: 0,
    generatedIdCollisionCount: 0,
    generatedNameCollisionCount: 0,
    byteCapBlockedCount: 0,
    notApprovedCount: 2,
    requestedApprovalCount: 2,
    approvedCount: 2,
    totalRawRgbaByteEstimate: 64,
    eligibleRawRgbaByteEstimate: 48,
    requestedApprovalRawRgbaByteEstimate: 32,
    approvedRawRgbaByteEstimate: 32,
    candidateEnumerationCap: {
      exceeded: false,
      totalLeafCount: 4,
      maxLeafCandidates: 200
    },
    sourceParseCap: {
      exceeded: false,
      sourceByteLength: 128,
      maxSourceBytes: 32 * 1024 * 1024
    },
    approvalCap: {
      exceeded: false,
      requestedApprovalCount: 1,
      maxApprovedLeaves: 4
    },
    approvalRawRgbaCap: {
      exceeded: false,
      requestedApprovalRawRgbaByteEstimate: 16,
      maxApprovedRawRgbaBytes: 32 * 1024 * 1024
    },
    publicDemoAsset: false
  },
  diagnostics: [],
  persistenceBoundary: {
    rawParserObjectPersistence: "notPersisted",
    sourcePsdBytePersistence: "sessionReadOnlyNoRawBytesPersistedByImportPlan",
    materializedLayerBytePersistence: "notMaterializedByImportPlan",
    approvalExecution: "explicitApprovedLeafRefsOnly",
    publicDemoAsset: false
  }
});

const createCandidate = (input: {
  readonly layerRef: string;
  readonly displayName: string;
  readonly fullPath: readonly string[];
  readonly statuses: BrowserPsdImportPlanCandidatePlan["candidates"][number]["statuses"];
  readonly approved: boolean;
  readonly approvedOrder?: number;
  readonly approvalBlockedReasons?: readonly string[];
}): BrowserPsdImportPlanCandidatePlan["candidates"][number] => ({
  candidateId: `candidate_${input.displayName}`,
  layerRef: input.layerRef,
  displayName: input.displayName,
  normalizedName: input.displayName,
  fullPath: [...input.fullPath],
  parentGroups: [],
  bounds: { x: 0, y: 0, width: 2, height: 2 },
  visibleInSource: !input.statuses.includes("hidden"),
  opacityInSource: 1,
  sourceOrder: 0,
  role: input.statuses.includes("unsupported") ? "unsupported" : "referenceOnly",
  rawRgbaByteEstimate: 16,
  statuses: input.statuses,
  statusReasons: input.statuses.includes("hidden")
    ? ["Hidden layer approval is not supported by the v0 import plan."]
    : [],
  unsupportedFeatureIds: [],
  generated: {
    destinationKind: "generatedPartScaffold",
    displayName: input.displayName,
    partId: `part_${input.displayName}`,
    drawableId: `draw_${input.displayName}`,
    textureId: `tex_${input.displayName}`,
    meshId: `mesh_${input.displayName}`
  },
  selection: {
    default: "notApproved",
    requestedApproval: input.approved,
    approved: input.approved,
    approvedOrder: input.approvedOrder ?? null,
    approvalBlockedReasons: [...(input.approvalBlockedReasons ?? [])]
  }
});
