import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";
import type { ProductPreflightCategoryResultDto } from "@private-2d-rigging-lab/contracts";
import {
  describe,
  expect,
  it
} from "vitest";

import {
  buildBrowserPsdImportPreflightValidationReport,
  type BrowserPsdImportPreflightEvidenceInput
} from "./psd-import-preflight-diagnostics.js";
import { buildProductPreflightReport } from "./product-preflight-report.js";

const CREATED_AT = "2026-06-05T00:00:00.000Z";
const PACKAGE_ID = PackageIdSchema.parse("pkg_wave45PsdImportPreflight");

describe("browser PSD import Product Preflight diagnostics", () => {
  it("reports browser parse success and selected materialization availability without renderer claims", () => {
    const validationReport = buildPsdImportReport([
      createParsedBrowserPsdEvidence({
        materializationEvidence: [createMaterializationEvidence()]
      })
    ]);
    const productPreflight = buildProductPreflightReport({
      reportId: "preflight_wave45PsdParsed",
      createdAt: CREATED_AT,
      validationReports: [validationReport]
    });
    const assetBytes = findCategory(productPreflight.categories, "assetBytes");

    expect(validationReport.checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.materializationEvidence"
    ]);
    expect(assetBytes.status).toBe("pass");
    expect(assetBytes.diagnosticRefs).toEqual([]);
    expect(validationReport.checks.flatMap((check) => check.evidence)).toEqual(
      expect.arrayContaining([
        "browserPsdImportEvidence=explicitSelection",
        "parserRuntime=browser",
        "materializationEvidenceKind=psd-layer-materialization-evidence-v1",
        "rawMaterializedBytes=notPersisted",
        "photoshopCompositing=notClaimed",
        "rendererPixelOracle=notClaimed",
        "publicDemoAsset=notClaimed"
      ])
    );
  });

  it("turns parser size cap rejection into a Product Preflight blocking reason", () => {
    const validationReport = buildPsdImportReport([
      {
        status: "rejected",
        failureKind: "sizeLimitExceeded",
        source: {
          sourceAssetId: "src_browser_psd_import",
          fileName: "too-large.psd",
          intakeKind: "explicitFile",
          declaredMediaType: "image/vnd.adobe.photoshop",
          byteLength: 40 * 1024 * 1024,
          sizeCapBytes: 32 * 1024 * 1024
        },
        diagnostics: [
          {
            checkId: "browserPsdParser.sizeCapExceeded",
            severity: "error",
            message: "Selected PSD is larger than the browser parser size cap.",
            evidence: ["source=browser-bridge"]
          }
        ]
      }
    ]);
    const assetBytes = findAssetBytes(validationReport, "preflight_wave45PsdOversize");

    expect(validationReport.checks).toEqual([
      expect.objectContaining({
        checkId: "asset.psd.adapterDiagnostic",
        status: "fail",
        severity: "error",
        evidence: expect.arrayContaining([
          "failureKind=sizeLimitExceeded",
          "adapterCheckId=browserPsdParser.sizeCapExceeded",
          "byteLength=41943040",
          "sizeCapBytes=33554432"
        ])
      })
    ]);
    expect(assetBytes.status).toBe("fail");
    expect(assetBytes.blockingReasons).toEqual([
      expect.objectContaining({
        reasonCode: "failingDiagnostic",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.adapterDiagnostic",
            status: "fail"
          })
        ]
      })
    ]);
  });

  it("turns parser failure into a Product Preflight blocking reason without parser imports", () => {
    const validationReport = buildPsdImportReport([
      {
        status: "failed",
        failureKind: "parserFailure",
        source: createSourceEvidence("broken.psd"),
        errorEvidence: [
          {
            errorId: "err_brokenPsd",
            failureKind: "parserFailure",
            severity: "error",
            message: "PSD parser failed on selected bytes."
          }
        ]
      }
    ]);
    const assetBytes = findAssetBytes(validationReport, "preflight_wave45PsdParseFailure");

    expect(validationReport.checks[0]).toEqual(expect.objectContaining({
      checkId: "asset.psd.adapterDiagnostic",
      status: "fail",
      severity: "error",
      evidence: expect.arrayContaining([
        "failureKind=parserFailure",
        "adapterCheckId=browserPsdParser.parse.failed",
        "errorEvidence[0].errorId=err_brokenPsd"
      ])
    }));
    expect(assetBytes.status).toBe("fail");
    expect(assetBytes.blockingReasons[0]?.message).toBe(
      "Browser PSD parser bridge failed to parse selected PSD bytes."
    );
  });

  it("keeps missing current bytes and reparse-required states failing until bytes are restored", () => {
    const validationReport = buildPsdImportReport([
      createParsedBrowserPsdEvidence({
        byteAvailability: {
          currentSessionBytes: "missing",
          requiresReupload: true,
          reason: "loaded-session-has-parser-summary-but-no-current-psd-bytes"
        },
        materializationEvidence: [createMaterializationEvidence()]
      })
    ]);
    const assetBytes = findAssetBytes(validationReport, "preflight_wave45PsdReparseRequired");

    expect(validationReport.checks.map((check) => check.checkId)).toEqual([
      "byteAvailability.currentSessionBytes.missing",
      "byteAvailability.requiresReupload",
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.materializationEvidence"
    ]);
    expect(assetBytes.status).toBe("fail");
    expect(assetBytes.blockingReasons.map((reason) =>
      reason.diagnosticRefs[0]?.checkId
    )).toEqual([
      "byteAvailability.currentSessionBytes.missing",
      "byteAvailability.requiresReupload"
    ]);
  });

  it("maps unsupported and not-evaluated PSD feature evidence to distinct Preflight claims", () => {
    const unsupportedReport = buildPsdImportReport([
      createParsedBrowserPsdEvidence({
        featureSupportEvidence: [
          {
            evidenceKind: "psd-feature-support-evidence-v1",
            featureId: "psd.fullCompositing",
            status: "unsupported",
            scope: "document",
            severity: "warning",
            message: "Full Photoshop compositing is outside Wave45 scope."
          }
        ],
        materializationEvidence: [createMaterializationEvidence()]
      })
    ]);
    const unsupportedAssetBytes = findAssetBytes(
      unsupportedReport,
      "preflight_wave45PsdUnsupported"
    );

    expect(unsupportedAssetBytes.status).toBe("not_supported");
    expect(unsupportedAssetBytes.unsupportedClaims).toEqual([
      expect.objectContaining({
        capabilityLabel: "asset.psd.featureUnsupported",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.featureUnsupported",
            status: "not_applicable"
          })
        ]
      })
    ]);

    const notEvaluatedReport = buildPsdImportReport([
      createParsedBrowserPsdEvidence({
        featureSupportEvidence: [
          {
            evidenceKind: "psd-feature-support-evidence-v1",
            featureId: "psd.layerEffects",
            status: "notEvaluated",
            scope: "layer",
            severity: "warning",
            message: "Layer effects were not evaluated by the browser parser bridge."
          }
        ],
        materializationEvidence: [createMaterializationEvidence()]
      })
    ]);
    const notEvaluatedAssetBytes = findAssetBytes(
      notEvaluatedReport,
      "preflight_wave45PsdFeatureNotEvaluated"
    );

    expect(notEvaluatedAssetBytes.status).toBe("not_evaluated");
    expect(notEvaluatedAssetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "validationReport",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.featureNotEvaluated",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("reports missing selected materialization evidence as not evaluated", () => {
    const validationReport = buildPsdImportReport([
      createParsedBrowserPsdEvidence({
        selectedMaterialization: {
          status: "missing",
          sourceLayerId: "psd:root/layer[0]",
          reason: "selected-layer-materialization-not-available"
        }
      })
    ]);
    const assetBytes = findAssetBytes(validationReport, "preflight_wave45PsdMaterializationMissing");

    expect(validationReport.checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.materializationEvidenceMissing"
    ]);
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.materializationEvidenceMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });

  it("treats parsed Domain B materialization failure evidence as missing selected materialization", () => {
    const validationReport = buildPsdImportReport([
      createParsedBrowserPsdEvidence({
        diagnostics: [
          {
            checkId: "browserPsdParser.materialization.failed",
            severity: "warning",
            message: "Selected PSD layer materialization evidence could not be created.",
            evidence: ["parserPrivateShape=excluded"]
          }
        ],
        errorEvidence: [
          {
            errorId: "browserPsdParser.materialization.failed",
            failureKind: "materializationFailure",
            severity: "warning",
            message: "Layer pixel extraction failed in the browser parser bridge."
          }
        ]
      })
    ]);
    const assetBytes = findAssetBytes(
      validationReport,
      "preflight_wave45PsdDomainBMaterializationFailure"
    );

    expect(validationReport.checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.materializationEvidenceMissing"
    ]);
    expect(validationReport.checks[2]?.evidence).toEqual(expect.arrayContaining([
      "materializationFailureEvidencePresent=true",
      "errorEvidence[0].failureKind=materializationFailure",
      "errorEvidence[0].errorId=browserPsdParser.materialization.failed"
    ]));
    expect(assetBytes.status).toBe("not_evaluated");
    expect(assetBytes.notEvaluatedClaims).toEqual([
      expect.objectContaining({
        evidenceKind: "sourceMaterialization",
        diagnosticRefs: [
          expect.objectContaining({
            checkId: "asset.psd.materializationEvidenceMissing",
            status: "needs_review"
          })
        ]
      })
    ]);
  });
});

const buildPsdImportReport = (
  psdImportEvidence: readonly BrowserPsdImportPreflightEvidenceInput[]
) =>
  buildBrowserPsdImportPreflightValidationReport({
    reportId: "val_wave45PsdImportPreflight",
    createdAt: CREATED_AT,
    packageId: PACKAGE_ID,
    packageRevision: 1,
    profile: "acceptance",
    psdImportEvidence
  });

const findAssetBytes = (
  validationReport: ReturnType<typeof buildPsdImportReport>,
  reportId: string
): ProductPreflightCategoryResultDto => {
  const productPreflight = buildProductPreflightReport({
    reportId,
    createdAt: CREATED_AT,
    validationReports: [validationReport]
  });

  return findCategory(productPreflight.categories, "assetBytes");
};

const createParsedBrowserPsdEvidence = (
  overrides: Partial<BrowserPsdImportPreflightEvidenceInput> = {}
): BrowserPsdImportPreflightEvidenceInput => ({
  status: "parsed",
  source: createSourceEvidence("sample.psd"),
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
  layerTreeEvidence: {
    evidenceKind: "psd-layer-tree-evidence-v1",
    evidenceId: "layerTree_browserSample",
    intakeKind: "realPsdParseResult",
    groupCount: 2,
    layerCount: 5,
    maxDepth: 3,
    privateShapePolicy: "parser-private-shape-excluded-v1"
  },
  ...overrides
});

const createSourceEvidence = (
  fileName: string
): BrowserPsdImportPreflightEvidenceInput["source"] => ({
  evidenceKind: "browser-psd-source-evidence-v1",
  sourceAssetId: "src_browser_psd_import",
  fileName,
  intakeKind: "explicitFile",
  declaredMediaType: "image/vnd.adobe.photoshop",
  byteLength: 22_406_225,
  sizeCapBytes: 32 * 1024 * 1024
});

const createMaterializationEvidence = (): NonNullable<
  BrowserPsdImportPreflightEvidenceInput["materializationEvidence"]
>[number] => ({
  evidenceKind: "psd-layer-materialization-evidence-v1",
  materializationId: "mat_browserSelectedLayer",
  sourceLayerRef: {
    sourceAssetId: "src_browser_psd_import",
    sourceLayerId: "psd:root/layer[0]",
    sourceLayerPath: ["headwear"]
  },
  mediaType: "application/vnd.private-2d-rigging-lab.raw-rgba",
  byteLength: 460_800,
  digest: {
    algorithm: "sha256",
    hex: "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a"
  }
});

const findCategory = (
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
