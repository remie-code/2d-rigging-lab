import { describe, expect, it } from "vitest";

import {
  createBrowserPsdSourceEvidence,
  createBrowserPsdThreadingEvidence,
  type BrowserPsdParserBridgeParsedResult
} from "./browser-psd-parser-bridge-result.js";
import { createBrowserPsdStructuralScaffoldPlan } from "./browser-psd-structural-scaffold-plan-service.js";

describe("browser PSD structural scaffold plan service", () => {
  it("plans approved groups as part containers and hidden positive-size leaves as runtime-hidden drawables", async () => {
    const parsedBridgeResult = createParsedBridgeResult();
    const plan = await createBrowserPsdStructuralScaffoldPlan({
      parsedBridgeResult,
      sourceAssetId: "src_structural_psd",
      sourceFilePath: "assets/sources/private/structural.psd",
      sourceDigest: {
        algorithm: "sha256",
        hex: "1111111111111111111111111111111111111111111111111111111111111111"
      },
      scopeRef: "psd:root",
      destinationParentPartId: "part_root",
      approvedNodeRefs: ["group_hair", "psd:root/layer[1]"]
    });

    expect(plan.status).toBe("ready");
    expect(plan.structuralScaffoldBridge.approval.approvalStatus).toBe("approved");
    expect(plan.structuralScaffoldBridge.approval.approvedGroupPartScaffolds).toHaveLength(1);
    expect(plan.structuralScaffoldBridge.approval.approvedGroupPartScaffolds[0]).toMatchObject({
      scaffoldKind: "groupPartContainer",
      sourceGroupRef: {
        sourceGroupId: "group_hair",
        sourceGroupName: "Hair",
        sourceGroupPath: ["Hair"]
      },
      generatedParentPartId: "part_root",
      status: "approved"
    });
    expect(JSON.stringify(plan.structuralScaffoldBridge.approval.approvedGroupPartScaffolds[0]))
      .not.toContain("generatedDrawableId");

    expect(plan.structuralScaffoldBridge.approval.approvedLeafScaffolds.map((leaf) => ({
      sourceLayerId: leaf.sourceLayerRef.sourceLayerId,
      parentPartId: leaf.generatedParentPartId,
      visibleInSource: leaf.visibleInSource,
      initialRuntimeVisibility: leaf.initialRuntimeVisibility,
      status: leaf.status
    }))).toEqual([
      {
        sourceLayerId: "psd:root/layer[1]",
        parentPartId: "part_root",
        visibleInSource: false,
        initialRuntimeVisibility: false,
        status: "approved"
      },
      {
        sourceLayerId: "psd:root/group[0]/layer[0]",
        parentPartId: plan.structuralScaffoldBridge.approval.approvedGroupPartScaffolds[0]?.generatedPartId,
        visibleInSource: true,
        initialRuntimeVisibility: true,
        status: "approved"
      }
    ]);
    expect(plan.approvedNodeRefs).toEqual([
      "psd:root/layer[1]",
      "psd:root/group[0]/layer[0]"
    ]);
    expect(plan.nodes.find((node) => node.nodeRef === "psd:root/layer[1]")).toMatchObject({
      kind: "leaf",
      approvalEligible: true,
      approved: true,
      initialRuntimeVisibility: false
    });
  });

  it("includes descendant group containers for stable group source-ref scopes", async () => {
    const parsedBridgeResult = createNestedParsedBridgeResult();
    const plan = await createBrowserPsdStructuralScaffoldPlan({
      parsedBridgeResult,
      sourceAssetId: "src_structural_psd",
      sourceFilePath: "assets/sources/private/structural.psd",
      sourceDigest: {
        algorithm: "sha256",
        hex: "1111111111111111111111111111111111111111111111111111111111111111"
      },
      scopeRef: "group_hair",
      destinationParentPartId: "part_root",
      approvedNodeRefs: ["group_hair"]
    });

    const approvedGroups =
      plan.structuralScaffoldBridge.approval.approvedGroupPartScaffolds;
    const parentGroup = approvedGroups.find((group) =>
      group.sourceGroupRef.sourceGroupId === "group_hair"
    );
    const childGroup = approvedGroups.find((group) =>
      group.sourceGroupRef.sourceGroupId === "group_hair_front"
    );
    const nestedLeaf =
      plan.structuralScaffoldBridge.approval.approvedLeafScaffolds.find((leaf) =>
        leaf.sourceLayerRef.sourceLayerId === "psd:root/group[0]/group[0]/layer[0]"
      );

    expect(plan.status).toBe("ready");
    expect(approvedGroups.map((group) => group.sourceGroupRef.sourceGroupId)).toEqual([
      "group_hair",
      "group_hair_front"
    ]);
    expect(parentGroup).toBeDefined();
    expect(childGroup).toMatchObject({
      sourceParentGroupRef: {
        sourceGroupId: "group_hair"
      },
      generatedParentPartId: parentGroup?.generatedPartId
    });
    expect(nestedLeaf).toMatchObject({
      sourceParentGroupRef: {
        sourceGroupId: "group_hair_front"
      },
      generatedParentPartId: childGroup?.generatedPartId,
      visibleInSource: false,
      initialRuntimeVisibility: false,
      status: "approved"
    });
  });
});

const createParsedBridgeResult = (): BrowserPsdParserBridgeParsedResult => {
  const source = createBrowserPsdSourceEvidence({
    intakeKind: "explicitFile",
    sourceAssetId: "src_structural_psd",
    fileName: "structural.psd",
    declaredMediaType: "image/vnd.adobe.photoshop",
    byteLength: 128,
    sizeCapBytes: 32 * 1024 * 1024
  });

  return {
    status: "parsed",
    source,
    threading: createBrowserPsdThreadingEvidence(),
    treeSummary: {
      groupCount: 1,
      layerCount: 2,
      visibleLayerCount: 1,
      hiddenLayerCount: 1,
      rasterCandidateLayerCount: 1,
      maxDepth: 2
    },
    adapterResult: {
      schemaVersion: "psd-adapter-result-v1",
      sourceProfile: "layered-character-psd-profile-v1",
      adapterName: "test-browser-psd-adapter",
      adapterVersion: "0.1.0",
      intakeKind: "parserFreeAdapterResult",
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      canvas: { width: 64, height: 64 },
      sourceGroups: [{
        sourceGroupId: "group_hair",
        originalName: "Hair",
        normalizedName: "Hair",
        groupPath: ["Hair"],
        sourceOrder: 0,
        visibleInSource: true,
        opacityInSource: 1,
        unsupportedFeatures: []
      }],
      sourceLayers: [
        createLayer({
          sourceLayerId: "psd:root/layer[1]",
          originalName: "hidden headwear",
          groupPath: [],
          sourceOrder: 1,
          visibleInSource: false
        }),
        createLayer({
          sourceLayerId: "psd:root/group[0]/layer[0]",
          originalName: "front hair",
          groupPath: ["Hair"],
          sourceOrder: 2,
          parentGroupId: "group_hair"
        })
      ],
      unsupportedFeatures: [],
      diagnostics: []
    },
    diagnostics: [],
    errorEvidence: []
  };
};

const createNestedParsedBridgeResult = (): BrowserPsdParserBridgeParsedResult => {
  const source = createBrowserPsdSourceEvidence({
    intakeKind: "explicitFile",
    sourceAssetId: "src_structural_psd",
    fileName: "structural.psd",
    declaredMediaType: "image/vnd.adobe.photoshop",
    byteLength: 128,
    sizeCapBytes: 32 * 1024 * 1024
  });

  return {
    status: "parsed",
    source,
    threading: createBrowserPsdThreadingEvidence(),
    treeSummary: {
      groupCount: 2,
      layerCount: 1,
      visibleLayerCount: 0,
      hiddenLayerCount: 1,
      rasterCandidateLayerCount: 1,
      maxDepth: 3
    },
    adapterResult: {
      schemaVersion: "psd-adapter-result-v1",
      sourceProfile: "layered-character-psd-profile-v1",
      adapterName: "test-browser-psd-adapter",
      adapterVersion: "0.1.0",
      intakeKind: "parserFreeAdapterResult",
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      canvas: { width: 64, height: 64 },
      sourceGroups: [
        {
          sourceGroupId: "group_hair",
          originalName: "Hair",
          normalizedName: "Hair",
          groupPath: ["Hair"],
          sourceOrder: 0,
          visibleInSource: true,
          opacityInSource: 1,
          unsupportedFeatures: []
        },
        {
          sourceGroupId: "group_hair_front",
          parentGroupId: "group_hair",
          originalName: "Front",
          normalizedName: "Front",
          groupPath: ["Hair", "Front"],
          sourceOrder: 1,
          visibleInSource: true,
          opacityInSource: 1,
          unsupportedFeatures: []
        }
      ],
      sourceLayers: [
        createLayer({
          sourceLayerId: "psd:root/group[0]/group[0]/layer[0]",
          originalName: "hidden front strand",
          groupPath: ["Hair", "Front"],
          sourceOrder: 2,
          parentGroupId: "group_hair_front",
          visibleInSource: false
        })
      ],
      unsupportedFeatures: [],
      diagnostics: []
    },
    diagnostics: [],
    errorEvidence: []
  };
};

const createLayer = (input: {
  readonly sourceLayerId: string;
  readonly originalName: string;
  readonly groupPath: readonly string[];
  readonly sourceOrder: number;
  readonly parentGroupId?: string;
  readonly visibleInSource?: boolean;
}) => ({
  sourceLayerId: input.sourceLayerId,
  originalName: input.originalName,
  normalizedName: input.originalName,
  ...(input.parentGroupId === undefined ? {} : { parentGroupId: input.parentGroupId }),
  groupPath: [...input.groupPath],
  sourceOrder: input.sourceOrder,
  bounds: { x: 0, y: 0, width: 4, height: 4 },
  visibleInSource: input.visibleInSource ?? true,
  opacityInSource: 1,
  role: "referenceOnly" as const,
  unsupportedFeatures: []
});
