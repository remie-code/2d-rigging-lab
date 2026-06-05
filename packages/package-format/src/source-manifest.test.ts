import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  SourceManifestSchema,
  stringifyJsonDeterministic
} from "./index.js";

describe("source manifest PSD structured profile contract", () => {
  it("parses and serializes structured PSD profile evidence", () => {
    const parsed = SourceManifestSchema.parse(createStructuredPsdSourceManifest());
    const serialized = stringifyJsonDeterministic(parsed);
    const reparsed = SourceManifestSchema.parse(JSON.parse(serialized));

    expect(serialized).toContain("\"psdProfile\"");
    expect(reparsed).toEqual(parsed);

    const sourceAsset = parsed.sourceAssets[0];
    const profile = sourceAsset?.psdProfile;
    const sourceLayer = profile?.sourceLayers[0];

    expect(profile?.adapter).toEqual({
      adapterName: "synthetic-structured-profile-fixture",
      adapterResultSchemaVersion: "psd-adapter-result-v1",
      sourceProfile: "layered-character-psd-profile-v1",
      evidenceKind: "adapter-supplied-metadata-v1"
    });
    expect(profile?.canvas).toEqual({
      width: 2048,
      height: 3072,
      bounds: { x: 0, y: 0, width: 2048, height: 3072 }
    });
    expect(profile?.sourceGroups[0]).toMatchObject({
      sourceGroupId: "group_head",
      targetPartId: "part_head",
      blendMode: {
        modeKey: "pass",
        normalizedMode: "passThrough",
        supportedByMvp: false
      }
    });
    expect(sourceLayer).toMatchObject({
      sourceLayerId: "layer_head",
      bounds: { x: 320, y: 128, width: 512, height: 640 },
      visibleInSource: true,
      opacityInSource: 0.75,
      role: "editableLayer",
      texturePreviewReference: "assets/textures/head.preview.png",
      textureId: "tex_head",
      targetPartId: "part_head",
      blendMode: {
        modeKey: "mul ",
        normalizedMode: "multiply",
        displayName: "Multiply",
        supportedByMvp: false
      }
    });
    expect(sourceLayer?.unsupportedFeatures[0]).toMatchObject({
      featureId: "psd.smartObject",
      scope: "layer",
      severity: "warning",
      rasterizeCandidate: true,
      manualConfirmationRequired: true,
      source: { kind: "layer", id: "layer_head" }
    });
    expect(profile?.diagnostics[0]).toMatchObject({
      checkId: "adapter.psd.blendModeUnsupported",
      severity: "warning",
      source: { kind: "layer", id: "layer_head" },
      evidence: ["blendMode=mul ", "flattenedFallback=psd.smartObject"]
    });
  });

  it("keeps flattened diagnostics and unsupported feature ids as compatibility fallbacks", () => {
    const parsed = SourceManifestSchema.parse(createStructuredPsdSourceManifest());
    const sourceAsset = parsed.sourceAssets[0];

    expect(sourceAsset?.diagnostics).toEqual([
      "psd.adapter:synthetic-structured-profile-fixture",
      "psd.canvas:2048x3072",
      "psd.layerUnsupported:layer_head:psd.smartObject"
    ]);
    expect(sourceAsset?.layers[0]?.unsupportedFeatures).toEqual(["psd.smartObject"]);
    expect(sourceAsset?.psdProfile?.sourceLayers[0]?.unsupportedFeatures[0]).toMatchObject({
      featureId: "psd.smartObject",
      message: "Smart object layer remains adapter metadata only."
    });
    expect(sourceAsset?.psdProfile?.compatibility).toEqual({
      structuredProfilePrecedence: "structured-profile-preferred-v1",
      flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
      flattenedUnsupportedFeaturesFallback:
        "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
    });
  });

  it("loads existing Wave 20 flattened PSD manifests without structured profile data", () => {
    const parsed = SourceManifestSchema.parse({
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: "src_psd_unsupported_layer",
          kind: "psd-source-v1",
          filePath: "assets/sources/psd-unsupported-layer/source-reference.psd",
          contentHash: "metadata:unsupported-layer-synthetic-adapter-result",
          importProfile: "layered-character-psd-profile-v1",
          layers: [
            {
              sourceLayerId: "layer_smart_reference",
              sourceAssetId: "src_psd_unsupported_layer",
              originalName: "Smart reference",
              normalizedName: "smart_reference",
              groupPath: ["Reference"],
              bounds: { x: 256, y: 192, width: 640, height: 512 },
              visibleInSource: true,
              opacityInSource: 1,
              role: "unsupported",
              unsupportedFeatures: ["psd.smartObject", "psd.layerEffects"],
              mappedDrawableIds: []
            }
          ],
          diagnostics: [
            "psd.adapter:synthetic-unsupported-layer-profile-fixture",
            "psd.canvas:2048x3072",
            "psd.sourceAsset:src_psd_unsupported_layer"
          ]
        }
      ]
    });

    expect(parsed.sourceAssets[0]?.kind).toBe("psd-source-v1");
    expect(parsed.sourceAssets[0]?.psdProfile).toBeUndefined();
    expect(parsed.sourceAssets[0]?.layers[0]?.unsupportedFeatures).toEqual([
      "psd.smartObject",
      "psd.layerEffects"
    ]);
  });

  it("loads split PNG manifests without PSD structured profile data", () => {
    const parsed = SourceManifestSchema.parse({
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId: "src_split_png",
          kind: "split-png-set-v1",
          filePath: "assets/sources/split/source-manifest.json",
          contentHash: "metadata:split-png-manifest",
          importProfile: "split-png-fallback-v1",
          layers: [
            {
              sourceLayerId: "layer_body",
              sourceAssetId: "src_split_png",
              originalName: "Body",
              normalizedName: "body",
              groupPath: [],
              bounds: { x: 0, y: 0, width: 512, height: 512 },
              visibleInSource: true,
              opacityInSource: 1,
              role: "editableLayer"
            }
          ],
          diagnostics: ["split-png-fallback-v1"]
        }
      ]
    });

    expect(parsed.sourceAssets[0]?.kind).toBe("split-png-set-v1");
    expect(parsed.sourceAssets[0]?.psdProfile).toBeUndefined();
    expect(parsed.sourceAssets[0]?.layers[0]?.unsupportedFeatures).toEqual([]);
  });

  it("can persist the Wave 20 adapter result details without relying on lossy flattened fields", () => {
    const request = loadPsdUnsupportedLayerRequest();
    const adapterResult = request.payload.adapterResult;
    const sourceAssetId = request.payload.sourceAssetId;
    const parsed = SourceManifestSchema.parse({
      schemaVersion: "source-manifest-v1",
      sourceAssets: [
        {
          sourceAssetId,
          kind: "psd-source-v1",
          filePath: request.payload.fileRef.packageRelativePath,
          contentHash: request.payload.fileRef.contentHash,
          importProfile: request.payload.importProfile,
          layers: adapterResult.sourceLayers.map((layer) => ({
            sourceLayerId: layer.sourceLayerId,
            sourceAssetId,
            originalName: layer.originalName,
            normalizedName: layer.normalizedName,
            groupPath: layer.groupPath,
            bounds: layer.bounds,
            visibleInSource: layer.visibleInSource,
            opacityInSource: layer.opacityInSource,
            role: layer.role,
            unsupportedFeatures: layer.unsupportedFeatures.map((feature) => feature.featureId),
            mappedDrawableIds: []
          })),
          diagnostics: ["psd.adapter:synthetic-unsupported-layer-profile-fixture"],
          psdProfile: {
            schemaVersion: "layered-character-psd-profile-v1",
            adapter: {
              adapterName: adapterResult.adapterName,
              adapterResultSchemaVersion: adapterResult.schemaVersion,
              sourceProfile: adapterResult.sourceProfile,
              evidenceKind: "adapter-supplied-metadata-v1"
            },
            canvas: adapterResult.canvas,
            sourceGroups: adapterResult.sourceGroups,
            sourceLayers: adapterResult.sourceLayers,
            unsupportedFeatures: adapterResult.unsupportedFeatures,
            diagnostics: adapterResult.diagnostics,
            compatibility: PSD_COMPATIBILITY_POLICY
          }
        }
      ]
    });

    const sourceAsset = parsed.sourceAssets[0];
    const structuredLayer = sourceAsset?.psdProfile?.sourceLayers[0];

    expect(sourceAsset?.layers[0]?.unsupportedFeatures).toEqual([
      "psd.smartObject",
      "psd.layerEffects"
    ]);
    expect(structuredLayer?.unsupportedFeatures).toHaveLength(2);
    expect(structuredLayer?.unsupportedFeatures[0]).toMatchObject({
      featureId: "psd.smartObject",
      message: "Smart object layer remains source metadata only; operation-core must not expand embedded content.",
      rasterizeCandidate: true,
      manualConfirmationRequired: true
    });
    expect(sourceAsset?.psdProfile?.sourceGroups[0]).toMatchObject({
      sourceGroupId: "group_reference",
      visibleInSource: true,
      opacityInSource: 1,
      unsupportedFeatures: []
    });
  });

  it("serializes real PSD parse intake evidence without parser private shapes", () => {
    const manifest = createStructuredPsdSourceManifestWithRealParseEvidence();
    const parsed = SourceManifestSchema.parse(manifest);
    const serialized = stringifyJsonDeterministic(parsed);
    const reparsed = SourceManifestSchema.parse(JSON.parse(serialized));
    const profile = reparsed.sourceAssets[0]?.psdProfile;

    expect(reparsed).toEqual(parsed);
    expect(profile?.adapter).toMatchObject({
      evidenceKind: "real-psd-parse-result-v1",
      intakeKind: "realPsdParseResult",
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      }
    });
    expect(profile?.layerTreeEvidence).toMatchObject({
      evidenceKind: "psd-layer-tree-evidence-v1",
      evidenceId: "layerTree_wave44Sample",
      intakeKind: "realPsdParseResult",
      groupCount: 1,
      layerCount: 1,
      privateShapePolicy: "parser-private-shape-excluded-v1"
    });
    expect(profile?.featureSupportEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({
        featureId: "psd.fullCompositing",
        status: "notEvaluated",
        scope: "document"
      }),
      expect.objectContaining({
        featureId: "psd.layerEffects",
        status: "unsupported",
        scope: "layer"
      })
    ]));
    expect(profile?.materializationEvidence?.[0]).toMatchObject({
      evidenceKind: "psd-layer-materialization-evidence-v1",
      materializationId: "mat_wave44LayerHead",
      sourceLayerRef: {
        sourceAssetId: "src_psd_structured",
        sourceLayerId: "layer_head",
        sourceLayerPath: ["Character", "Head", "Head"]
      },
      mediaType: "image/png",
      byteLength: 4096,
      digest: {
        algorithm: "sha256",
        hex: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
      },
      textureId: "tex_head",
      provenance: {
        sourceFilePath: "test_data/sample_model.psd",
        sourceDigest: {
          algorithm: "sha256",
          hex: "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5"
        },
        sourceByteLength: 22406225,
        sourceMediaType: "image/vnd.adobe.photoshop",
        privacyLabel: "privateLocalFixture",
        publicDistribution: "notPublicDistributable",
        fixtureId: "wave44.sampleModel",
        derivedArtifactPath: "test_data/derived/wave44/layer_head.png",
        generatedBy: "wave44.psdSmoke"
      },
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        adapterName: "wave44-node-smoke-adapter",
        adapterVersion: "0.0.0",
        runtime: "node",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      extraction: {
        extractionKind: "selectedLayerRasterV1",
        optionsSchemaVersion: "psd-layer-extraction-options-v1",
        options: {
          includeHiddenLayers: false,
          layerSelection: "layer_head"
        }
      }
    });
  });

  it("serializes browser-origin parser-free PSD evidence without raw parser or byte payloads", () => {
    const manifest = createStructuredPsdSourceManifestWithBrowserParseEvidence();
    const parsed = SourceManifestSchema.parse(manifest);
    const serialized = stringifyJsonDeterministic(parsed);
    const reparsed = SourceManifestSchema.parse(JSON.parse(serialized));
    const profile = reparsed.sourceAssets[0]?.psdProfile;

    expect(reparsed).toEqual(parsed);
    expect(profile?.adapter).toMatchObject({
      evidenceKind: "real-psd-parse-result-v1",
      intakeKind: "realPsdParseResult",
      parser: {
        evidenceKind: "psd-parser-evidence-v1",
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        adapterName: "wave45-browser-explicit-psd-import-adapter",
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      }
    });
    expect(profile?.layerTreeEvidence?.parser?.runtime).toBe("browser");
    expect(profile?.materializationEvidence?.[0]).toMatchObject({
      evidenceKind: "psd-layer-materialization-evidence-v1",
      materializationId: "mat_wave44LayerHead",
      mediaType: "image/png",
      byteLength: 4096,
      digest: {
        algorithm: "sha256",
        hex: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
      },
      parser: {
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      }
    });
    expect(profile?.materializationEvidence?.[0]).not.toHaveProperty("binaryAssetRef");
    expect(serialized).not.toContain("rawLayerObject");
    expect(serialized).not.toContain("rawRgba");
    expect(serialized).not.toContain("data:image");
  });

  it("rejects parser-private layer objects in real PSD evidence fields", () => {
    const manifest = createStructuredPsdSourceManifestWithRealParseEvidence();
    const sourceAsset = manifest.sourceAssets[0];
    if (sourceAsset === undefined) {
      throw new Error("Expected structured PSD fixture source asset.");
    }

    const profile = sourceAsset.psdProfile;
    const parser = profile.adapter.parser;
    if (typeof parser !== "object" || parser === null || Array.isArray(parser)) {
      throw new Error("Expected parser evidence object.");
    }

    const result = SourceManifestSchema.safeParse({
      ...manifest,
      sourceAssets: [
        {
          ...sourceAsset,
          psdProfile: {
            ...profile,
            adapter: {
              ...profile.adapter,
              parser: {
                ...parser,
                rawLayerObject: { parserPrivate: true }
              }
            }
          }
        }
      ]
    });

    expect(result.success).toBe(false);
  });
});

const PSD_COMPATIBILITY_POLICY = {
  structuredProfilePrecedence: "structured-profile-preferred-v1",
  flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
  flattenedUnsupportedFeaturesFallback:
    "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
} as const;

const createStructuredPsdSourceManifest = (): unknown => ({
  schemaVersion: "source-manifest-v1",
  sourceAssets: [
    {
      sourceAssetId: "src_psd_structured",
      kind: "psd-source-v1",
      filePath: "assets/sources/character/source.psd",
      contentHash: "metadata:structured-profile",
      importProfile: "layered-character-psd-profile-v1",
      layers: [
        {
          sourceLayerId: "layer_head",
          sourceAssetId: "src_psd_structured",
          originalName: "Head",
          normalizedName: "head",
          groupPath: ["Character", "Head"],
          bounds: { x: 320, y: 128, width: 512, height: 640 },
          visibleInSource: true,
          opacityInSource: 0.75,
          role: "editableLayer",
          unsupportedFeatures: ["psd.smartObject"],
          mappedDrawableIds: ["draw_head"]
        }
      ],
      diagnostics: [
        "psd.adapter:synthetic-structured-profile-fixture",
        "psd.canvas:2048x3072",
        "psd.layerUnsupported:layer_head:psd.smartObject"
      ],
      psdProfile: {
        schemaVersion: "layered-character-psd-profile-v1",
        adapter: {
          adapterName: "synthetic-structured-profile-fixture",
          adapterResultSchemaVersion: "psd-adapter-result-v1",
          sourceProfile: "layered-character-psd-profile-v1",
          evidenceKind: "adapter-supplied-metadata-v1"
        },
        canvas: {
          width: 2048,
          height: 3072,
          bounds: { x: 0, y: 0, width: 2048, height: 3072 }
        },
        sourceGroups: [
          {
            sourceGroupId: "group_head",
            originalName: "Head",
            normalizedName: "head",
            parentGroupId: "group_character",
            groupPath: ["Character", "Head"],
            sourceOrder: 4,
            visibleInSource: true,
            opacityInSource: 1,
            bounds: { x: 300, y: 100, width: 600, height: 700 },
            blendMode: {
              modeKey: "pass",
              normalizedMode: "passThrough",
              supportedByMvp: false,
              source: { kind: "group", id: "group_head" }
            },
            targetPartId: "part_head",
            unsupportedFeatures: []
          }
        ],
        sourceLayers: [
          {
            sourceLayerId: "layer_head",
            originalName: "Head",
            normalizedName: "head",
            parentGroupId: "group_head",
            groupPath: ["Character", "Head"],
            sourceOrder: 5,
            bounds: { x: 320, y: 128, width: 512, height: 640 },
            visibleInSource: true,
            opacityInSource: 0.75,
            role: "editableLayer",
            blendMode: {
              modeKey: "mul ",
              normalizedMode: "multiply",
              displayName: "Multiply",
              supportedByMvp: false,
              source: { kind: "layer", id: "layer_head" }
            },
            unsupportedFeatures: [
              {
                featureId: "psd.smartObject",
                scope: "layer",
                severity: "warning",
                message: "Smart object layer remains adapter metadata only.",
                source: { kind: "layer", id: "layer_head" },
                rasterizeCandidate: true,
                manualConfirmationRequired: true
              }
            ],
            texturePreviewReference: "assets/textures/head.preview.png",
            textureId: "tex_head",
            targetPartId: "part_head"
          }
        ],
        unsupportedFeatures: [
          {
            featureId: "psd.documentBlendMode",
            scope: "blendMode",
            severity: "info",
            message: "Document contains non-normal blend metadata retained as source evidence.",
            source: { kind: "document", path: "/blendModes/0" },
            rasterizeCandidate: false,
            manualConfirmationRequired: false
          }
        ],
        diagnostics: [
          {
            checkId: "adapter.psd.blendModeUnsupported",
            severity: "warning",
            message: "Blend mode is retained as metadata only.",
            source: { kind: "layer", id: "layer_head" },
            evidence: ["blendMode=mul ", "flattenedFallback=psd.smartObject"]
          }
        ],
        compatibility: PSD_COMPATIBILITY_POLICY
      }
    }
  ]
});

const createStructuredPsdSourceManifestWithRealParseEvidence = () => {
  const manifest = createStructuredPsdSourceManifest() as StructuredPsdManifestFixture;
  const sourceAsset = manifest.sourceAssets[0];
  if (sourceAsset === undefined) {
    throw new Error("Expected structured PSD fixture source asset.");
  }

  const profile = sourceAsset.psdProfile;
  const sourceLayer = profile.sourceLayers[0];
  if (sourceLayer === undefined) {
    throw new Error("Expected structured PSD fixture source layer.");
  }

  const parser = {
    evidenceKind: "psd-parser-evidence-v1",
    parserName: "webtoonPsd",
    parserPackageName: "@webtoon/psd",
    parserVersion: "0.4.0",
    adapterName: "wave44-node-smoke-adapter",
    adapterVersion: "0.0.0",
    runtime: "node",
    privateShapePolicy: "parser-private-shape-excluded-v1"
  } as const;

  profile.adapter = {
    ...profile.adapter,
    adapterVersion: "0.0.0",
    evidenceKind: "real-psd-parse-result-v1",
    intakeKind: "realPsdParseResult",
    parser
  };
  profile.layerTreeEvidence = {
    evidenceKind: "psd-layer-tree-evidence-v1",
    evidenceId: "layerTree_wave44Sample",
    intakeKind: "realPsdParseResult",
    groupCount: profile.sourceGroups.length,
    layerCount: profile.sourceLayers.length,
    maxDepth: 2,
    parser,
    privateShapePolicy: "parser-private-shape-excluded-v1"
  };
  profile.featureSupportEvidence = [
    {
      evidenceKind: "psd-feature-support-evidence-v1",
      featureId: "psd.fullCompositing",
      status: "notEvaluated",
      scope: "document",
      severity: "warning",
      message: "Photoshop-style full compositing is outside Wave44 evidence.",
      source: { kind: "document" }
    },
    {
      evidenceKind: "psd-feature-support-evidence-v1",
      featureId: "psd.layerEffects",
      status: "unsupported",
      scope: "layer",
      severity: "warning",
      message: "Layer effects are retained as source evidence and not rendered.",
      source: { kind: "layer", id: "layer_head" },
      rasterizeCandidate: false,
      manualConfirmationRequired: true
    }
  ];
  sourceLayer.featureSupportEvidence = [
    {
      evidenceKind: "psd-feature-support-evidence-v1",
      featureId: "psd.layerEffects",
      status: "unsupported",
      scope: "layer",
      severity: "warning",
      message: "Layer effects are not part of selected layer raster materialization.",
      source: { kind: "layer", id: "layer_head" },
      rasterizeCandidate: false,
      manualConfirmationRequired: true
    }
  ];
  profile.materializationEvidence = [
    {
      evidenceKind: "psd-layer-materialization-evidence-v1",
      materializationId: "mat_wave44LayerHead",
      sourceLayerRef: {
        sourceAssetId: "src_psd_structured",
        sourceLayerId: "layer_head",
        sourceLayerPath: ["Character", "Head", "Head"]
      },
      mediaType: "image/png",
      byteLength: 4096,
      digest: {
        algorithm: "sha256",
        hex: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
      },
      textureId: "tex_head",
      provenance: {
        sourceFilePath: "test_data/sample_model.psd",
        sourceDigest: {
          algorithm: "sha256",
          hex: "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5"
        },
        sourceByteLength: 22406225,
        sourceMediaType: "image/vnd.adobe.photoshop",
        privacyLabel: "privateLocalFixture",
        publicDistribution: "notPublicDistributable",
        fixtureId: "wave44.sampleModel",
        derivedArtifactPath: "test_data/derived/wave44/layer_head.png",
        generatedBy: "wave44.psdSmoke"
      },
      parser,
      extraction: {
        extractionKind: "selectedLayerRasterV1",
        optionsSchemaVersion: "psd-layer-extraction-options-v1",
        options: {
          includeHiddenLayers: false,
          layerSelection: "layer_head"
        }
      }
    }
  ];

  return manifest;
};

const createStructuredPsdSourceManifestWithBrowserParseEvidence = () => {
  const manifest = createStructuredPsdSourceManifestWithRealParseEvidence() as StructuredPsdManifestFixture;
  const sourceAsset = manifest.sourceAssets[0];
  if (sourceAsset === undefined) {
    throw new Error("Expected structured PSD fixture source asset.");
  }

  const profile = sourceAsset.psdProfile;
  const adapterParser = profile.adapter.parser;
  if (adapterParser === undefined) {
    throw new Error("Expected parser evidence in browser PSD fixture.");
  }

  const browserParser = {
    ...adapterParser,
    adapterName: "wave45-browser-explicit-psd-import-adapter",
    runtime: "browser"
  };

  profile.adapter = {
    ...profile.adapter,
    adapterName: "wave45-browser-explicit-psd-import-adapter",
    parser: browserParser
  };

  if (profile.layerTreeEvidence !== undefined) {
    profile.layerTreeEvidence = {
      ...profile.layerTreeEvidence,
      parser: browserParser
    };
  }

  if (profile.materializationEvidence !== undefined) {
    profile.materializationEvidence = profile.materializationEvidence.map((evidence) => ({
      ...evidence,
      parser: browserParser
    }));
  }

  return manifest;
};

type StructuredPsdManifestFixture = {
  readonly sourceAssets: Array<{
    readonly psdProfile: {
      adapter: Record<string, unknown> & { parser?: Record<string, unknown> };
      sourceGroups: readonly unknown[];
      sourceLayers: Array<Record<string, unknown>>;
      layerTreeEvidence?: Record<string, unknown>;
      featureSupportEvidence?: unknown;
      materializationEvidence?: Array<Record<string, unknown>>;
    };
  }>;
};

interface PsdUnsupportedLayerRequest {
  readonly payload: {
    readonly sourceAssetId: string;
    readonly fileRef: {
      readonly packageRelativePath: string;
      readonly contentHash: string;
    };
    readonly importProfile: "layered-character-psd-profile-v1";
    readonly adapterResult: {
      readonly schemaVersion: "psd-adapter-result-v1";
      readonly sourceProfile: "layered-character-psd-profile-v1";
      readonly adapterName: string;
      readonly canvas: unknown;
      readonly sourceGroups: readonly unknown[];
      readonly sourceLayers: ReadonlyArray<{
        readonly sourceLayerId: string;
        readonly originalName: string;
        readonly normalizedName: string;
        readonly groupPath: readonly string[];
        readonly bounds: unknown;
        readonly visibleInSource: boolean;
        readonly opacityInSource: number;
        readonly role: string;
        readonly unsupportedFeatures: ReadonlyArray<{
          readonly featureId: string;
          readonly message: string;
        }>;
      }>;
      readonly unsupportedFeatures: readonly unknown[];
      readonly diagnostics: readonly unknown[];
    };
  };
}

const loadPsdUnsupportedLayerRequest = (): PsdUnsupportedLayerRequest => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/psd-unsupported-layer"
  );

  return JSON.parse(
    readFileSync(join(fixtureDirectory, "request/import-psd-source-commit.request.json"), "utf8")
  ) as PsdUnsupportedLayerRequest;
};
