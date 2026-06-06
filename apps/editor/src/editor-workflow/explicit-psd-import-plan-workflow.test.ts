import { describe, expect, it } from "vitest";

import { createEditorSessionAdapter } from "../editor-session/index.js";
import {
  projectExplicitPsdImportStateFromBridgeResult,
  projectExplicitPsdImportViewModel
} from "../editor-state/index.js";
import { createEditorWorkflowState } from "./workflow-state-projection.js";
import {
  createBrowserPsdSourceEvidence,
  createBrowserPsdThreadingEvidence,
  type BrowserPsdParserBridgeParsedResult
} from "./browser-psd-parser-bridge-result.js";
import { runEditorExplicitPsdImportPlanPreviewWorkflow } from "./explicit-psd-import-plan-workflow.js";

describe("explicit PSD import plan workflow", () => {
  it("projects root candidate preview and keeps approval limited to eligible leaf candidates", async () => {
    const adapter = createEditorSessionAdapter();
    const parsedBridgeResult = createParsedBridgeResult();
    const state = {
      ...createEditorWorkflowState(adapter),
      explicitPsdImport: projectExplicitPsdImportStateFromBridgeResult(parsedBridgeResult, {
        selectedLayerNodeRef: "psd:root/layer[0]"
      })
    };

    const outcome = await runEditorExplicitPsdImportPlanPreviewWorkflow({
      state,
      command: {
        scopeRef: "psd:root",
        approvedLayerNodeRefs: [
          "psd:root/layer[0]",
          "psd:root/layer[1]",
          "psd:root/group[0]/layer[0]"
        ],
        destinationParentPartId: "part_root"
      },
      currentPsdFile: createCurrentPsdFile(),
      parsedBridgeResult
    });
    const viewModel = projectExplicitPsdImportViewModel(outcome.state);

    expect(outcome.result.status).toBe("ready");
    expect(outcome.result.approvedLayerNodeRefs).toEqual(["psd:root/layer[0]"]);
    expect(outcome.state.selectedLayerNodeRefs).toEqual(["psd:root/layer[0]"]);
    expect(outcome.state.importPlan).toMatchObject({
      scopeRef: "psd:root",
      destinationParentPartId: "part_root",
      candidateCount: 3,
      approvedCount: 1,
      hiddenCount: 1,
      unsupportedCount: 2,
      notApprovedCount: 2
    });
    expect(outcome.state.importPlan?.sourceDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(outcome.state.importPlan?.candidates.find((candidate) =>
      candidate.layerRef === "psd:root/layer[1]"
    )).toMatchObject({
      approved: false,
      statuses: ["hidden", "unsupported", "notApproved"],
      approvalBlockedReasons: ["hiddenLayerUnsupported"]
    });
    expect(viewModel.importPlanFacts.map((fact) => `${fact.label}=${fact.value}`).join("\n")).toContain(
      "Destination parent part=part_root"
    );
    expect(viewModel.importPlanCandidateLabels.join("\n")).toContain("part=part_headwear_psd_root_layer_0");
  });
});

const createCurrentPsdFile = (): File =>
  ({
    name: "sample_model.psd",
    size: 128,
    type: "image/vnd.adobe.photoshop",
    async arrayBuffer() {
      return new Uint8Array(128).buffer;
    }
  }) as File;

const createParsedBridgeResult = (): BrowserPsdParserBridgeParsedResult => {
  const source = createBrowserPsdSourceEvidence({
    intakeKind: "explicitFile",
    sourceAssetId: "src_browser_psd_import",
    fileName: "sample_model.psd",
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
      layerCount: 3,
      visibleLayerCount: 2,
      hiddenLayerCount: 1,
      rasterCandidateLayerCount: 2,
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
        sourceGroupId: "group_accessories",
        originalName: "Accessories",
        normalizedName: "Accessories",
        groupPath: ["Accessories"],
        sourceOrder: 2,
        visibleInSource: true,
        opacityInSource: 1,
        unsupportedFeatures: []
      }],
      sourceLayers: [
        createLayer("psd:root/layer[0]", "headwear", [], 0),
        createLayer("psd:root/layer[1]", "hidden", [], 1, false),
        createLayer("psd:root/group[0]/layer[0]", "tie", ["Accessories"], 3, true, "unsupported")
      ],
      unsupportedFeatures: [],
      diagnostics: []
    },
    diagnostics: [],
    errorEvidence: []
  };
};

const createLayer = (
  sourceLayerId: string,
  originalName: string,
  groupPath: readonly string[],
  sourceOrder: number,
  visibleInSource = true,
  role: "referenceOnly" | "unsupported" = "referenceOnly"
) => ({
  sourceLayerId,
  originalName,
  normalizedName: originalName,
  groupPath: [...groupPath],
  sourceOrder,
  bounds: { x: 0, y: 0, width: 4, height: 4 },
  visibleInSource,
  opacityInSource: 1,
  role,
  unsupportedFeatures: []
});
