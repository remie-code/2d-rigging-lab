import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";

import type { PsdAdapterResultDto } from "@private-2d-rigging-lab/operation-core";

import {
  createBrowserPsdImportPlanCandidatePlan,
  createBrowserPsdSourceEvidence,
  createBrowserPsdThreadingEvidence,
  parseExplicitBrowserPsdArrayBuffer,
  type BrowserPsdParserBridgeParsedResult
} from "./index.js";
import { projectExplicitPsdImportPlanState } from "../editor-state/index.js";

const samplePsdPath = "test_data/sample_model.psd";

describe("browser PSD import plan candidate service", () => {
  it("generates root leaf candidates from parser-free browser session evidence", async () => {
    const parsed = await parseSamplePsd();
    const plan = await createBrowserPsdImportPlanCandidatePlan({
      parsedBridgeResult: parsed,
      scopeRef: "psd:root"
    });
    const repeatedPlan = await createBrowserPsdImportPlanCandidatePlan({
      parsedBridgeResult: parsed,
      scopeRef: "psd:root"
    });

    expect(plan.status).toBe("ready");
    expect(plan.scope).toMatchObject({
      scopeRef: "psd:root",
      scopeKind: "root",
      discoveryMode: "recursiveLeafCandidatePreview",
      displayPath: []
    });
    expect(plan.summary).toMatchObject({
      totalLeafCount: 126,
      eligibleCandidateCount: 121,
      hiddenCount: 5,
      emptyZeroSizeCount: 0,
      totalRawRgbaByteEstimate: 49172000,
      eligibleRawRgbaByteEstimate: 40626328,
      requestedApprovalCount: 0,
      approvedCount: 0,
      notApprovedCount: 126,
      publicDemoAsset: false
    });
    expect(plan.candidatePlanDigest.hex).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.candidatePlanDigest).toEqual(repeatedPlan.candidatePlanDigest);

    const headwear = findCandidate(plan, "psd:root/layer[0]");
    expect(headwear).toMatchObject({
      displayName: "headwear",
      fullPath: ["headwear"],
      bounds: {
        x: 808,
        y: 92,
        width: 400,
        height: 288
      },
      rawRgbaByteEstimate: 460800,
      statuses: ["candidate", "duplicateName", "notApproved"],
      selection: {
        default: "notApproved",
        requestedApproval: false,
        approved: false
      },
      generated: {
        destinationKind: "generatedPartScaffold",
        displayName: "headwear",
        partId: "part_headwear_psd_root_layer_0",
        drawableId: "draw_headwear_psd_root_layer_0",
        textureId: "tex_headwear_psd_root_layer_0",
        meshId: "mesh_headwear_psd_root_layer_0"
      }
    });
    expect(JSON.stringify(plan)).not.toContain("\"children\"");
  });

  it("walks an explicit group scope recursively but keeps groups as context only", async () => {
    const parsed = await parseSamplePsd();
    const plan = await createBrowserPsdImportPlanCandidatePlan({
      parsedBridgeResult: parsed,
      scopeRef: "psd:root/group[6]",
      approvedLayerNodeRefs: ["psd:root/group[6]/layer[0]"]
    });

    expect(plan.scope).toMatchObject({
      scopeRef: "psd:root/group[6]",
      scopeKind: "group",
      displayPath: ["tie"]
    });
    expect(plan.candidates.length).toBeGreaterThan(0);
    expect(plan.candidates.every((candidate) =>
      candidate.layerRef.startsWith("psd:root/group[6]/")
    )).toBe(true);

    const tie = findCandidate(plan, "psd:root/group[6]/layer[0]");
    expect(tie).toMatchObject({
      displayName: "tie",
      fullPath: ["tie", "tie"],
      parentGroups: [{
        groupRef: "psd:root/group[6]",
        displayName: "tie",
        fullPath: ["tie"],
        depth: 1
      }],
      statuses: ["candidate"],
      selection: {
        requestedApproval: true,
        approved: true,
        approvedOrder: 0
      }
    });
    expect(plan.candidates.some((candidate) => candidate.layerRef === "psd:root/group[6]")).toBe(false);
  });

  it("rejects leaf and malformed group-like scope refs deterministically", async () => {
    const parsed = await parseSamplePsd();
    const invalidScopeRefs = [
      "psd:root/group[6]/layer[0]",
      "psd:root/group[6]/layer[0]/group[1]",
      "psd:root/group[x]",
      "psd:root/group[6]oops",
      "psd:root/group[]",
      "psd:root/group[-1]",
      "psd:root/layer[0]",
      "psd:root/group[999]"
    ];

    for (const scopeRef of invalidScopeRefs) {
      await expect(createBrowserPsdImportPlanCandidatePlan({
        parsedBridgeResult: parsed,
        scopeRef
      })).rejects.toThrow(/Browser PSD import plan .*scope/);
    }
  });

  it("reports hidden, unsupported, empty, duplicate, collision, byte-cap, and default not-approved statuses", async () => {
    const parsed = createSyntheticParsedResult();
    const plan = await createBrowserPsdImportPlanCandidatePlan({
      parsedBridgeResult: parsed,
      scopeRef: "psd:root",
      caps: {
        maxLeafRawRgbaBytes: 64
      },
      reservedGeneratedIds: {
        partIds: ["part_face_psd_root_layer_0"]
      },
      reservedGeneratedNames: ["Face"]
    });

    expect(findCandidate(plan, "psd:root/layer[0]")).toMatchObject({
      statuses: ["generatedIdCollision", "generatedNameCollision", "notApproved"],
      selection: {
        approved: false,
        approvalBlockedReasons: expect.arrayContaining([
          "generatedIdCollision",
          "generatedNameCollision"
        ])
      }
    });
    expect(findCandidate(plan, "psd:root/layer[1]").statuses).toEqual([
      "hidden",
      "unsupported",
      "notApproved"
    ]);
    expect(findCandidate(plan, "psd:root/layer[2]").statuses).toEqual([
      "emptyZeroSize",
      "notApproved"
    ]);
    expect(findCandidate(plan, "psd:root/layer[3]").statuses).toEqual([
      "unsupported",
      "notApproved"
    ]);
    expect(findCandidate(plan, "psd:root/group[0]/layer[0]").statuses).toEqual([
      "candidate",
      "duplicateName",
      "notApproved"
    ]);
    expect(findCandidate(plan, "psd:root/layer[7]").statuses).toEqual([
      "duplicateRef",
      "notApproved"
    ]);
    expect(findCandidate(plan, "psd:root/layer[8]").statuses).toEqual([
      "byteCapBlocked",
      "notApproved"
    ]);
    expect(findCandidate(plan, "psd:root/group[0]/layer[1]").statuses).toEqual([
      "candidate",
      "duplicateName",
      "notApproved"
    ]);
    expect(plan.summary).toMatchObject({
      hiddenCount: 1,
      unsupportedCount: 2,
      emptyZeroSizeCount: 1,
      duplicateRefCount: 2,
      duplicateNameCount: 4,
      generatedIdCollisionCount: 1,
      generatedNameCollisionCount: 1,
      byteCapBlockedCount: 1,
      notApprovedCount: 11
    });
  });

  it("blocks duplicate approval refs and approval caps without changing the candidate plan digest", async () => {
    const parsed = createSyntheticParsedResult();
    const approvalCaps = {
      maxApprovedLeaves: 1,
      maxApprovedRawRgbaBytes: 16
    };
    const defaultPlan = await createBrowserPsdImportPlanCandidatePlan({
      parsedBridgeResult: parsed,
      scopeRef: "psd:root",
      caps: approvalCaps
    });
    const approvalPlan = await createBrowserPsdImportPlanCandidatePlan({
      parsedBridgeResult: parsed,
      scopeRef: "psd:root",
      approvedLayerNodeRefs: [
        "psd:root/group[0]/layer[0]",
        "psd:root/group[1]/layer[0]",
        "psd:root/group[0]/layer[0]",
        "psd:root/group[0]/layer[1]",
        "psd:root/group[0]/layer[2]"
      ],
      caps: approvalCaps
    });

    expect(approvalPlan.candidatePlanDigest).toEqual(defaultPlan.candidatePlanDigest);
    expect(approvalPlan.summary).toMatchObject({
      requestedApprovalCount: 4,
      approvedCount: 0,
      byteCapBlockedCount: 4,
      approvalCap: {
        exceeded: true,
        requestedApprovalCount: 4,
        maxApprovedLeaves: 1
      },
      approvalRawRgbaCap: {
        exceeded: true,
        requestedApprovalRawRgbaByteEstimate: 64,
        maxApprovedRawRgbaBytes: 16
      }
    });
    expect(approvalPlan.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual(
      expect.arrayContaining([
        "browserPsdImportPlan.approvalDuplicateRef",
        "browserPsdImportPlan.approvalCapBlocked"
      ])
    );
    expect(findCandidate(approvalPlan, "psd:root/group[0]/layer[0]")).toMatchObject({
      statuses: ["duplicateRef", "duplicateName", "byteCapBlocked", "notApproved"],
      selection: {
        requestedApproval: true,
        approved: false,
        approvalBlockedReasons: expect.arrayContaining([
          "duplicateApprovalRef",
          "approvedLeafCountCapExceeded"
        ])
      }
    });
    expect(findCandidate(approvalPlan, "psd:root/group[0]/layer[1]")).toMatchObject({
      statuses: [
        "duplicateName",
        "generatedNameCollision",
        "byteCapBlocked",
        "notApproved"
      ],
      selection: {
        requestedApproval: true,
        approved: false,
        approvalBlockedReasons: expect.arrayContaining([
          "generatedNameCollision",
          "approvedLeafCountCapExceeded",
          "approvedRawRgbaByteCapExceeded"
        ])
      }
    });
  });

  it("projects a compact workflow state view for later UI workflow use", async () => {
    const parsed = await parseSamplePsd();
    const plan = await createBrowserPsdImportPlanCandidatePlan({
      parsedBridgeResult: parsed,
      scopeRef: "psd:root/group[6]",
      approvedLayerNodeRefs: ["psd:root/group[6]/layer[0]"]
    });
    const state = projectExplicitPsdImportPlanState(plan);

    expect(state).toMatchObject({
      status: "ready",
      planId: plan.planId,
      candidatePlanDigest: `sha256:${plan.candidatePlanDigest.hex}`,
      scopeRef: "psd:root/group[6]",
      scopeLabel: "tie",
      approvedCount: 1
    });
    expect(state.candidates.find((candidate) => candidate.layerRef === "psd:root/group[6]/layer[0]"))
      .toMatchObject({
        fullPathLabel: "tie / tie",
        parentGroupPathLabel: "tie",
        approved: true,
        defaultSelection: "notApproved"
      });
  });
});

const parseSamplePsd = async (): Promise<BrowserPsdParserBridgeParsedResult> => {
  const sampleBytes = await readFile(samplePsdPath);
  const result = await parseExplicitBrowserPsdArrayBuffer({
    fileName: "sample_model.psd",
    bytes: sampleBytes,
    declaredMediaType: "image/vnd.adobe.photoshop",
    sourceAssetId: "src_wave48_sample_model_psd"
  });

  if (result.status !== "parsed") {
    throw new Error(`Expected sample PSD parse to succeed, got ${result.status}.`);
  }

  return result;
};

const findCandidate = (
  plan: Awaited<ReturnType<typeof createBrowserPsdImportPlanCandidatePlan>>,
  layerRef: string
) => {
  const candidate = plan.candidates.find((entry) => entry.layerRef === layerRef);
  if (candidate === undefined) {
    throw new Error(`Expected candidate ${layerRef}.`);
  }

  return candidate;
};

const createSyntheticParsedResult = (): BrowserPsdParserBridgeParsedResult => {
  const adapterResult: PsdAdapterResultDto = {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "synthetic-parser-free-adapter",
    adapterVersion: "0.0.0-test",
    intakeKind: "parserFreeAdapterResult",
    parser: {
      evidenceKind: "psd-parser-evidence-v1",
      parserName: "synthetic",
      adapterName: "synthetic-parser-free-adapter",
      adapterVersion: "0.0.0-test",
      runtime: "browser",
      privateShapePolicy: "parser-private-shape-excluded-v1"
    },
    canvas: {
      width: 128,
      height: 128
    },
    sourceGroups: [
      {
        sourceGroupId: "group_synthetic_0",
        originalName: "Group",
        normalizedName: "group",
        groupPath: ["Group"],
        sourceOrder: 4,
        visibleInSource: true,
        opacityInSource: 1,
        unsupportedFeatures: []
      },
      {
        sourceGroupId: "group_synthetic_1",
        originalName: "Other",
        normalizedName: "other",
        groupPath: ["Other"],
        sourceOrder: 6,
        visibleInSource: true,
        opacityInSource: 1,
        unsupportedFeatures: []
      }
    ],
    sourceLayers: [
      createSyntheticLayer({
        sourceLayerId: "psd:root/layer[0]",
        originalName: "Face",
        sourceOrder: 0
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/layer[1]",
        originalName: "Hidden",
        sourceOrder: 1,
        visibleInSource: false
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/layer[2]",
        originalName: "Empty",
        sourceOrder: 2,
        width: 0
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/layer[3]",
        originalName: "Unsupported",
        sourceOrder: 3,
        role: "unsupported"
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/group[0]/layer[0]",
        originalName: "Same",
        groupPath: ["Group"],
        parentGroupId: "group_synthetic_0",
        sourceOrder: 5
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/group[1]/layer[0]",
        originalName: "Same",
        groupPath: ["Other"],
        parentGroupId: "group_synthetic_1",
        sourceOrder: 7
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/layer[7]",
        originalName: "Duplicate ref A",
        sourceOrder: 8
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/layer[7]",
        originalName: "Duplicate ref B",
        sourceOrder: 9
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/layer[8]",
        originalName: "Huge",
        sourceOrder: 10,
        width: 5,
        height: 5
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/group[0]/layer[1]",
        originalName: "SameName",
        groupPath: ["Group"],
        parentGroupId: "group_synthetic_0",
        sourceOrder: 11
      }),
      createSyntheticLayer({
        sourceLayerId: "psd:root/group[0]/layer[2]",
        originalName: "SameName",
        groupPath: ["Group"],
        parentGroupId: "group_synthetic_0",
        sourceOrder: 12
      })
    ],
    unsupportedFeatures: [],
    diagnostics: []
  };

  return {
    status: "parsed",
    source: createBrowserPsdSourceEvidence({
      intakeKind: "explicitArrayBuffer",
      sourceAssetId: "src_synthetic_psd",
      fileName: "synthetic.psd",
      byteLength: 4096,
      sizeCapBytes: 32 * 1024 * 1024
    }),
    threading: createBrowserPsdThreadingEvidence(),
    treeSummary: {
      groupCount: 2,
      layerCount: adapterResult.sourceLayers.length,
      visibleLayerCount: adapterResult.sourceLayers.filter((layer) => layer.visibleInSource).length,
      hiddenLayerCount: adapterResult.sourceLayers.filter((layer) => !layer.visibleInSource).length,
      rasterCandidateLayerCount: adapterResult.sourceLayers.filter((layer) =>
        layer.visibleInSource && layer.bounds.width > 0 && layer.bounds.height > 0
      ).length,
      maxDepth: 2
    },
    adapterResult,
    diagnostics: [],
    errorEvidence: []
  };
};

const createSyntheticLayer = (input: {
  readonly sourceLayerId: string;
  readonly originalName: string;
  readonly sourceOrder: number;
  readonly groupPath?: readonly string[];
  readonly parentGroupId?: string;
  readonly visibleInSource?: boolean;
  readonly role?: "editableLayer" | "guideImage" | "referenceOnly" | "unsupported";
  readonly width?: number;
  readonly height?: number;
}): PsdAdapterResultDto["sourceLayers"][number] => ({
  sourceLayerId: input.sourceLayerId,
  originalName: input.originalName,
  normalizedName: input.originalName.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  ...(input.parentGroupId === undefined ? {} : { parentGroupId: input.parentGroupId }),
  groupPath: [...(input.groupPath ?? [])],
  sourceOrder: input.sourceOrder,
  bounds: {
    x: input.sourceOrder,
    y: input.sourceOrder,
    width: input.width ?? 2,
    height: input.height ?? 2
  },
  visibleInSource: input.visibleInSource ?? true,
  opacityInSource: 1,
  role: input.role ?? "referenceOnly",
  unsupportedFeatures: []
});
