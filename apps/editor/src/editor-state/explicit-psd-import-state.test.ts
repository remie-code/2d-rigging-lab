import { describe, expect, it } from "vitest";
import { SourceAssetIdSchema } from "@private-2d-rigging-lab/contracts";

import {
  projectExplicitPsdImportStateFromBridgeResult,
  projectExplicitPsdImportViewModel,
  type ExplicitPsdImportBridgeResultInput
} from "./index.js";

describe("explicit PSD import state", () => {
  it("projects parser-free bridge evidence into session UX state", () => {
    const state = projectExplicitPsdImportStateFromBridgeResult(createParsedBridgeResult(), {
      selectedLayerNodeRef: "psd:root/layer[0]"
    });
    const viewModel = projectExplicitPsdImportViewModel(state);

    expect(state.status).toBe("parsed");
    expect(state.document).toMatchObject({
      adapterName: "wave45-browser-explicit-psd-import-adapter",
      parserRuntime: "browser",
      canvas: {
        width: 2048,
        height: 3072
      }
    });
    expect(state.treeSummary).toMatchObject({
      groupCount: 1,
      layerCount: 1,
      visibleLayerCount: 1,
      hiddenLayerCount: 0,
      rasterCandidateLayerCount: 1,
      maxDepth: 2
    });
    expect(state.treeRows.map((row) => row.nodeRef)).toEqual([
      "group_psd_root_group_0",
      "psd:root/group[0]/layer[0]"
    ]);
    expect(state.featureSupport).toMatchObject({
      evidenceCount: 2,
      unsupportedCount: 1,
      notEvaluatedCount: 1,
      unsupportedFeatureIds: ["psd.layerEffects"],
      notEvaluatedFeatureIds: ["psd.fullCompositing"]
    });
    expect(state.materialization[0]).toMatchObject({
      sourceLayerId: "psd:root/group[0]/layer[0]",
      byteLength: 460800,
      bytePersistence: "summaryOnlyNoRawBytes"
    });
    expect(state.persistenceBoundary).toMatchObject({
      rawParserObjectPersistence: "notPersisted",
      sourcePsdBytePersistence: "sessionReadOnlyNoRawBytesPersistedByParser",
      materializedLayerBytePersistence: "summaryOnlyNoRawBytes",
      photoshopCompositingClaim: "none",
      rendererPixelOracleClaim: "none"
    });
    expect(viewModel.statusLabel).toBe("PSD parsed in browser session");
    expect(viewModel.documentFacts.map((fact) => fact.value).join(" / ")).toContain(
      "webtoonPsd / @webtoon/psd / 0.4.0"
    );
    expect(viewModel.materializationLabels[0]).toContain("summary only; raw materialized bytes not persisted");
    expect(JSON.stringify(state)).not.toContain("children");
  });

  it("keeps oversize rejection parser-free and document-free", () => {
    const state = projectExplicitPsdImportStateFromBridgeResult({
      status: "rejected",
      source: {
        fileName: "oversize.psd",
        byteLength: 33_554_433,
        sizeCapBytes: 33_554_432,
        intakeKind: "explicitFile",
        privacy: {
          publicDistribution: "notPublicDistributable",
          rawBytesPersistence: "notPersistedByParserBridge"
        }
      },
      diagnostics: [
        {
          checkId: "browserPsdParser.sizeCapExceeded",
          severity: "error",
          message: "Selected PSD byte length exceeds the browser parser bridge cap.",
          evidence: []
        }
      ],
      errorEvidence: [
        {
          errorId: "browserPsdParser.sizeCapExceeded",
          severity: "error",
          message: "Selected PSD byte length exceeds size cap."
        }
      ]
    });

    expect(state.status).toBe("rejected");
    expect(state.document).toBeNull();
    expect(state.treeRows).toEqual([]);
    expect(state.source).toMatchObject({
      fileName: "oversize.psd",
      byteLength: 33_554_433,
      sizeCapBytes: 33_554_432
    });
    expect(projectExplicitPsdImportViewModel(state).statusLabel).toBe("PSD rejected before parser");
  });
});

const createParsedBridgeResult = (): ExplicitPsdImportBridgeResultInput => ({
  status: "parsed",
  source: {
    fileName: "sample_model.psd",
    declaredMediaType: "image/vnd.adobe.photoshop",
    byteLength: 22_406_225,
    sizeCapBytes: 33_554_432,
    intakeKind: "explicitFile",
    privacy: {
      publicDistribution: "notPublicDistributable",
      rawBytesPersistence: "notPersistedByParserBridge"
    }
  },
  treeSummary: {
    groupCount: 1,
    layerCount: 1,
    visibleLayerCount: 1,
    hiddenLayerCount: 0,
    rasterCandidateLayerCount: 1,
    maxDepth: 2
  },
  adapterResult: {
    schemaVersion: "psd-adapter-result-v1",
    sourceProfile: "layered-character-psd-profile-v1",
    adapterName: "wave45-browser-explicit-psd-import-adapter",
    adapterVersion: "0.1.0",
    intakeKind: "realPsdParseResult",
    parser: {
      evidenceKind: "psd-parser-evidence-v1",
      parserName: "webtoonPsd",
      parserPackageName: "@webtoon/psd",
      parserVersion: "0.4.0",
      adapterName: "wave45-browser-explicit-psd-import-adapter",
      adapterVersion: "0.1.0",
      runtime: "browser",
      privateShapePolicy: "parser-private-shape-excluded-v1"
    },
    canvas: {
      width: 2048,
      height: 3072,
      bounds: { x: 0, y: 0, width: 2048, height: 3072 }
    },
    sourceGroups: [
      {
        sourceGroupId: "group_psd_root_group_0",
        originalName: "Head",
        normalizedName: "head",
        groupPath: ["Head"],
        sourceOrder: 0,
        visibleInSource: true,
        opacityInSource: 1,
        unsupportedFeatures: []
      }
    ],
    sourceLayers: [
      {
        sourceLayerId: "psd:root/group[0]/layer[0]",
        originalName: "headwear",
        normalizedName: "headwear",
        parentGroupId: "group_psd_root_group_0",
        groupPath: ["Head"],
        sourceOrder: 1,
        bounds: { x: 808, y: 92, width: 400, height: 288 },
        visibleInSource: true,
        opacityInSource: 0.75,
        role: "referenceOnly",
        unsupportedFeatures: []
      }
    ],
    unsupportedFeatures: [],
    featureSupportEvidence: [
      {
        evidenceKind: "psd-feature-support-evidence-v1",
        featureId: "psd.fullCompositing",
        status: "notEvaluated",
        scope: "document",
        severity: "warning",
        message: "Full compositing is outside Wave45 scope."
      },
      {
        evidenceKind: "psd-feature-support-evidence-v1",
        featureId: "psd.layerEffects",
        status: "unsupported",
        scope: "layer",
        severity: "warning",
        message: "Layer effects are surfaced as unsupported metadata."
      }
    ],
    layerTreeEvidence: {
      evidenceKind: "psd-layer-tree-evidence-v1",
      evidenceId: "layerTree_src_wave45_sample",
      intakeKind: "realPsdParseResult",
      groupCount: 1,
      layerCount: 1,
      maxDepth: 2,
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      privateShapePolicy: "parser-private-shape-excluded-v1"
    },
    materializationEvidence: [
      {
        evidenceKind: "psd-layer-materialization-evidence-v1",
        materializationId: "mat_headwear",
        sourceLayerRef: {
          sourceAssetId: SourceAssetIdSchema.parse("src_browser_psd_import"),
          sourceLayerId: "psd:root/group[0]/layer[0]",
          sourceLayerName: "headwear",
          sourceLayerPath: ["Head", "headwear"]
        },
        mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
        byteLength: 460800,
        width: 400,
        height: 288,
        digest: {
          algorithm: "sha256",
          hex: "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a"
        },
        provenance: {
          sourceFilePath: "sample_model.psd",
          sourceByteLength: 22406225,
          sourceMediaType: "image/vnd.adobe.photoshop",
          privacyLabel: "packageLocalAsset",
          publicDistribution: "notPublicDistributable",
          publicDemoAsset: false
        }
      }
    ],
    diagnostics: []
  },
  diagnostics: [],
  errorEvidence: []
});
