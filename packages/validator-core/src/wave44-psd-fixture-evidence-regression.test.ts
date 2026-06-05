import { readFile } from "node:fs/promises";

import {
  PackageIdSchema,
  type ProductPreflightCategoryResultDto,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  PsdLayerMaterializationEvidenceSchema,
  SourceManifestSchema
} from "@private-2d-rigging-lab/package-format";
import type {
  LayeredCharacterPsdProfileDto,
  PsdLayerMaterializationEvidenceDto,
  SourceAssetDto
} from "@private-2d-rigging-lab/package-format";
import {
  describe,
  expect,
  it
} from "vitest";

import { buildProductPreflightReport } from "./product-preflight-report.js";
import { buildValidationReport } from "./report-builder.js";
import { validatePsdSourceEvidenceDiagnostics } from "./validators/psd-source-evidence-diagnostics.js";

const CREATED_AT = "2026-06-05T00:00:00.000Z";
const EVIDENCE_PATH =
  "test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json";
const PRODUCT_PREFLIGHT_EVIDENCE_REF_PATH =
  "generated/source-materialization/wave44-sample-headwear.json";
const PACKAGE_ID = PackageIdSchema.parse("pkg_wave44PsdFixtureEvidence");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_wave44_sample_model_psd");

describe("Wave44 PSD fixture evidence regression", () => {
  it("connects private selected-layer materialization evidence to validator and Product Preflight diagnostics", async () => {
    const fixture = await readWave44MaterializationFixture();
    const sourceAsset = createSourceAssetFromMaterialization(fixture);
    const profile = expectPsdProfile(sourceAsset);
    const checks = validatePsdSourceEvidenceDiagnostics(sourceAsset, 0, profile);

    expect(checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.featureNotEvaluated",
      "asset.psd.materializationEvidence"
    ]);
    expect(checks.map((check) => check.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
      "needs_review",
      "pass"
    ]);

    const materializationCheck = expectCheckById(checks, "asset.psd.materializationEvidence");
    expect(materializationCheck.evidence).toEqual(expect.arrayContaining([
      "sourceAssetId=src_wave44_sample_model_psd",
      "validatorBoundary=no-parser-execution",
      "photoshopCompositing=notClaimed",
      "rendererPixelOracle=notClaimed",
      "materializationEvidenceKind=psd-layer-materialization-evidence-v1",
      "materializationId=mat_wave44SampleHeadwearRawRgba",
      "sourceLayerAssetId=src_wave44_sample_model_psd",
      "sourceLayerId=psd:root/layer[0]",
      "sourceLayerPath=headwear",
      "mediaType=application/vnd.private-2d-rigging-lab.raw-rgba",
      "byteLength=460800",
      "digest=sha256:671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a",
      "binaryAssetId=missing",
      "textureId=missing",
      "privacyLabel=privateLocalFixture",
      "publicDistribution=notPublicDistributable",
      "sourceFilePath=test_data/sample_model.psd",
      "sourceDigest=sha256:44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5",
      "sourceByteLength=22406225",
      "sourceMediaType=image/vnd.adobe.photoshop",
      "fixtureId=wave44.sampleModel",
      "generatedBy=wave44.psdLayerMaterialization",
      "parserEvidencePresent=true",
      "extractionKind=selectedLayerRasterV1"
    ]));

    const validationReport = buildValidationReport({
      reportId: "val_wave44PsdFixtureEvidence",
      createdAt: CREATED_AT,
      packageId: PACKAGE_ID,
      packageRevision: 0,
      profile: "acceptance",
      checks,
      relatedScenarios: ["SC-SAMPLE-001", "SC-VERIFY-001"]
    });
    const productPreflight = buildProductPreflightReport({
      reportId: "preflight_wave44PsdFixtureEvidence",
      createdAt: CREATED_AT,
      validationReports: [validationReport],
      categoryEvidenceRefs: {
        assetBytes: [
          {
            evidenceId: "evidence_wave44SampleHeadwearRawRgba",
            artifactRef: {
              artifactKind: "sourceMaterialization",
              path: PRODUCT_PREFLIGHT_EVIDENCE_REF_PATH
            },
            target: {
              kind: "package",
              id: PACKAGE_ID
            },
            summary:
              "Wave44 private selected-layer materialization evidence supplies asset byte evidence.",
            producer: "validatorCore"
          }
        ]
      }
    });
    const assetBytes = expectCategory(productPreflight.categories, "assetBytes");

    expect(validationReport.summary.status).toBe("needs_review");
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.evidenceRefs).toEqual([
      expect.objectContaining({
        evidenceId: "evidence_wave44SampleHeadwearRawRgba",
        artifactRef: {
          artifactKind: "sourceMaterialization",
          path: PRODUCT_PREFLIGHT_EVIDENCE_REF_PATH
        }
      })
    ]);
    expect(assetBytes.diagnosticRefs.map((diagnosticRef) => diagnosticRef.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.materializationEvidence"
    ]);
    expect(assetBytes.unsupportedClaims).toEqual([]);
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "validationReport",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.featureNotEvaluated",
            status: "needs_review",
            severity: "warning"
          })
        ]
      })
    ]);
  });
});

const readWave44MaterializationFixture = async (): Promise<{
  readonly source: {
    readonly path: string;
    readonly byteLength: number;
    readonly digest: {
      readonly algorithm: string;
      readonly hex: string;
    };
  };
  readonly selectedLayer: {
    readonly nodeRef: string;
    readonly name: string;
    readonly sourceLayerPath: readonly string[];
    readonly bounds: {
      readonly left: number;
      readonly top: number;
      readonly width: number;
      readonly height: number;
    };
    readonly visible: boolean;
    readonly opacity: number;
    readonly composedOpacity: number;
  };
  readonly materializationEvidence: PsdLayerMaterializationEvidenceDto;
}> => {
  const parsed = JSON.parse(await readFile(EVIDENCE_PATH, "utf8")) as {
    readonly source: {
      readonly path: string;
      readonly byteLength: number;
      readonly digest: {
        readonly algorithm: string;
        readonly hex: string;
      };
    };
    readonly selectedLayer: {
      readonly nodeRef: string;
      readonly name: string;
      readonly sourceLayerPath: readonly string[];
      readonly bounds: {
        readonly left: number;
        readonly top: number;
        readonly width: number;
        readonly height: number;
      };
      readonly visible: boolean;
      readonly opacity: number;
      readonly composedOpacity: number;
    };
    readonly materializationEvidence: unknown;
  };

  return {
    ...parsed,
    materializationEvidence: PsdLayerMaterializationEvidenceSchema.parse(
      parsed.materializationEvidence
    )
  };
};

const createSourceAssetFromMaterialization = (
  fixture: Awaited<ReturnType<typeof readWave44MaterializationFixture>>
): SourceAssetDto => {
  const sourceLayerId = fixture.materializationEvidence.sourceLayerRef.sourceLayerId;
  const groupPath = [...(fixture.materializationEvidence.sourceLayerRef.sourceLayerPath ?? [])];
  const sourceManifest = SourceManifestSchema.parse({
    schemaVersion: "source-manifest-v1",
    sourceAssets: [
      {
        sourceAssetId: SOURCE_ASSET_ID,
        kind: "psd-source-v1",
        filePath: fixture.source.path,
        contentHash: `${fixture.source.digest.algorithm}:${fixture.source.digest.hex}`,
        importProfile: "layered-character-psd-profile-v1",
        layers: [
          {
            sourceLayerId,
            sourceAssetId: SOURCE_ASSET_ID,
            originalName: fixture.selectedLayer.name,
            normalizedName: "headwear",
            groupPath,
            bounds: {
              x: fixture.selectedLayer.bounds.left,
              y: fixture.selectedLayer.bounds.top,
              width: fixture.selectedLayer.bounds.width,
              height: fixture.selectedLayer.bounds.height
            },
            visibleInSource: fixture.selectedLayer.visible,
            opacityInSource: fixture.selectedLayer.composedOpacity,
            role: "editableLayer",
            unsupportedFeatures: [],
            mappedDrawableIds: []
          }
        ],
        diagnostics: ["wave44.privateLocalMaterializationEvidence"],
        psdProfile: {
          schemaVersion: "layered-character-psd-profile-v1",
          adapter: {
            adapterName: "wave44-real-psd-fixture-evidence-regression",
            adapterVersion: "0.0.0",
            adapterResultSchemaVersion: "psd-adapter-result-v1",
            sourceProfile: "layered-character-psd-profile-v1",
            evidenceKind: "real-psd-parse-result-v1",
            intakeKind: "realPsdParseResult",
            parser: fixture.materializationEvidence.parser
          },
          canvas: {
            width: 2048,
            height: 3072,
            bounds: {
              x: 0,
              y: 0,
              width: 2048,
              height: 3072
            }
          },
          sourceGroups: [],
          sourceLayers: [
            {
              sourceLayerId,
              originalName: fixture.selectedLayer.name,
              normalizedName: "headwear",
              groupPath,
              sourceOrder: 0,
              bounds: {
                x: fixture.selectedLayer.bounds.left,
                y: fixture.selectedLayer.bounds.top,
                width: fixture.selectedLayer.bounds.width,
                height: fixture.selectedLayer.bounds.height
              },
              visibleInSource: fixture.selectedLayer.visible,
              opacityInSource: fixture.selectedLayer.composedOpacity,
              role: "editableLayer"
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
              message:
                "Wave44 selected-layer evidence does not evaluate Photoshop-style final compositing.",
              source: {
                kind: "document",
                id: "wave44.sampleModel"
              },
              rasterizeCandidate: false,
              manualConfirmationRequired: false,
              evidenceRefs: [fixture.materializationEvidence.materializationId]
            }
          ],
          layerTreeEvidence: {
            evidenceKind: "psd-layer-tree-evidence-v1",
            evidenceId: "layerTree_wave44SelectedLayerOnly",
            intakeKind: "realPsdParseResult",
            groupCount: 0,
            layerCount: 1,
            maxDepth: 1,
            parser: fixture.materializationEvidence.parser,
            privateShapePolicy: "parser-private-shape-excluded-v1"
          },
          materializationEvidence: [fixture.materializationEvidence],
          diagnostics: [],
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
  const sourceAsset = sourceManifest.sourceAssets[0];

  if (sourceAsset === undefined) {
    throw new Error("Expected Wave44 PSD source asset fixture.");
  }

  return sourceAsset;
};

const expectPsdProfile = (sourceAsset: SourceAssetDto): LayeredCharacterPsdProfileDto => {
  if (sourceAsset.psdProfile === undefined) {
    throw new Error("Expected Wave44 PSD source profile.");
  }

  return sourceAsset.psdProfile;
};

const expectCheckById = (
  checks: readonly ReturnType<typeof validatePsdSourceEvidenceDiagnostics>[number][],
  checkId: string
) => {
  const check = checks.find((candidate) => candidate.checkId === checkId);

  expect(check).toBeDefined();
  if (check === undefined) {
    throw new Error(`Missing check ${checkId}.`);
  }

  return check;
};

const expectCategory = (
  categories: readonly ProductPreflightCategoryResultDto[],
  categoryId: ProductPreflightCategoryResultDto["category"]
): ProductPreflightCategoryResultDto => {
  const category = categories.find((candidate) => candidate.category === categoryId);

  expect(category).toBeDefined();
  if (category === undefined) {
    throw new Error(`Missing category ${categoryId}.`);
  }

  return category;
};
