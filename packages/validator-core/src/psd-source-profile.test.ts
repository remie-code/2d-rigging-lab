import {
  describe,
  expect,
  it
} from "vitest";

import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import {
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import { defaultCheckCatalog } from "./check-catalog.js";
import type { ValidationReportDto } from "./validation-report.js";
import { validatePackageRuntime } from "./validators/package-runtime.js";

describe("PSD source profile validator diagnostics", () => {
  it("registers PSD source profile checks in the catalog", () => {
    expect(defaultCheckCatalog.has("asset.psd.unsupportedFeature")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.adapterDiagnostic")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuredProfileMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.structuredProfileMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.flattenedFallbackMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.parserEvidence")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.parserEvidenceUnavailable")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.layerTreeEvidence")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.layerTreeEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.layerTreeEvidenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.featureUnsupported")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.featureNotEvaluated")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializationEvidence")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializationEvidenceMissing")).toBe(true);
    expect(defaultCheckCatalog.has("asset.psd.materializationEvidenceMismatch")).toBe(true);
    expect(defaultCheckCatalog.has("rights.psdLayerProvenanceMissing")).toBe(true);
  });

  it("validates an adapter-backed PSD source profile with preview and provenance evidence", () => {
    const report = validatePsdPackage(createPsdPackageDocument());

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
  });

  it("reports real PSD parser, layer tree, feature support, and materialization evidence without renderer claims", () => {
    const document = createPsdPackageDocument();
    const profile = expectPsdProfile(document);
    const sourceLayer = profile.sourceLayers[0];

    if (sourceLayer === undefined) {
      throw new Error("Expected structured PSD layer.");
    }

    profile.adapter.evidenceKind = "real-psd-parse-result-v1";
    profile.adapter.intakeKind = "realPsdParseResult";
    profile.adapter.parser = createParserEvidence();
    profile.layerTreeEvidence = {
      evidenceKind: "psd-layer-tree-evidence-v1",
      evidenceId: "layerTree_wave44Synthetic",
      intakeKind: "realPsdParseResult",
      groupCount: 1,
      layerCount: 1,
      maxDepth: 2,
      parser: createParserEvidence(),
      privateShapePolicy: "parser-private-shape-excluded-v1"
    };
    profile.featureSupportEvidence = [
      {
        evidenceKind: "psd-feature-support-evidence-v1",
        featureId: "psd.fullCompositing",
        status: "unsupported",
        scope: "document",
        severity: "warning",
        message: "Full Photoshop-style compositing is outside Wave44 validator evidence.",
        source: { kind: "document", id: "sample_model" },
        rasterizeCandidate: false,
        manualConfirmationRequired: false
      }
    ];
    sourceLayer.featureSupportEvidence = [
      {
        evidenceKind: "psd-feature-support-evidence-v1",
        featureId: "psd.layerEffects",
        status: "notEvaluated",
        scope: "layer",
        severity: "warning",
        message: "Layer effects were not evaluated by the selected parser evidence.",
        source: { kind: "layer", id: "psd_layer_body" },
        rasterizeCandidate: true,
        manualConfirmationRequired: true,
        evidenceRefs: ["layerTree_wave44Synthetic"]
      }
    ];
    profile.materializationEvidence = [
      createMaterializationEvidence()
    ];

    const report = validatePsdPackage(document);

    expect(report.checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.featureUnsupported",
      "asset.psd.featureNotEvaluated",
      "asset.psd.materializationEvidence"
    ]);
    expect(report.checks.map((check) => check.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
      "not_applicable",
      "needs_review",
      "pass"
    ]);

    const parserCheck = expectCheckById(report, "asset.psd.parserEvidence");
    expect(parserCheck.evidence).toEqual(expect.arrayContaining([
      "parserEvidenceKind=psd-parser-evidence-v1",
      "parserPackageName=@webtoon/psd",
      "parserVersion=0.4.0",
      "parserRuntime=node",
      "privateShapePolicy=parser-private-shape-excluded-v1",
      "validatorBoundary=no-parser-execution",
      "photoshopCompositing=notClaimed",
      "rendererPixelOracle=notClaimed"
    ]));

    const layerTreeCheck = expectCheckById(report, "asset.psd.layerTreeEvidence");
    expect(layerTreeCheck.evidence).toEqual(expect.arrayContaining([
      "layerTreeEvidenceKind=psd-layer-tree-evidence-v1",
      "layerTreeEvidenceId=layerTree_wave44Synthetic",
      "layerTreeIntakeKind=realPsdParseResult",
      "groupCount=1",
      "layerCount=1",
      "parserEvidencePresent=true"
    ]));

    const unsupportedFeatureCheck = expectCheckById(report, "asset.psd.featureUnsupported");
    expect(unsupportedFeatureCheck).toMatchObject({
      checkId: "asset.psd.featureUnsupported",
      status: "not_applicable",
      severity: "warning",
      targetPath: "/assets/sourceManifest/sourceAssets/0/psdProfile/featureSupportEvidence/0"
    });
    expect(unsupportedFeatureCheck.evidence).toEqual(expect.arrayContaining([
      "featureSupportEvidenceKind=psd-feature-support-evidence-v1",
      "featureId=psd.fullCompositing",
      "featureStatus=unsupported",
      "featureScope=document",
      "featureSourceKind=document"
    ]));

    const notEvaluatedCheck = expectCheckById(report, "asset.psd.featureNotEvaluated");
    expect(notEvaluatedCheck).toMatchObject({
      status: "needs_review",
      severity: "warning",
      targetPath: "/assets/sourceManifest/sourceAssets/0/psdProfile/sourceLayers/0/featureSupportEvidence/0"
    });
    expect(notEvaluatedCheck.evidence).toEqual(expect.arrayContaining([
      "featureId=psd.layerEffects",
      "featureStatus=notEvaluated",
      "featureEvidenceRef[0]=layerTree_wave44Synthetic"
    ]));

    const materializationCheck = expectCheckById(report, "asset.psd.materializationEvidence");
    expect(materializationCheck.evidence).toEqual(expect.arrayContaining([
      "materializationEvidenceKind=psd-layer-materialization-evidence-v1",
      "materializationId=mat_wave44Body",
      "sourceLayerAssetId=src_psd_profile",
      "sourceLayerId=psd_layer_body",
      "mediaType=image/png",
      "byteLength=1024",
      "digest=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "binaryAssetId=bin_psd_body",
      "textureId=tex_psd_body",
      "privacyLabel=privateLocalFixture",
      "publicDistribution=notPublicDistributable",
      "sourceFilePath=test_data/sample_model.psd",
      "sourceDigest=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      "fixtureId=wave44.synthetic",
      "generatedBy=wave44.validatorSyntheticFixture",
      "parserEvidencePresent=true",
      "extractionKind=selectedLayerRasterV1"
    ]));
  });

  it("fails unavailable or inconsistent real PSD parser and layer tree evidence", () => {
    const document = createPsdPackageDocument();
    const profile = expectPsdProfile(document);

    profile.adapter.evidenceKind = "real-psd-parse-result-v1";
    profile.adapter.intakeKind = "realPsdParseResult";

    const missingReport = validatePsdPackage(document);

    expect(missingReport.summary.status).toBe("fail");
    expect(missingReport.checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidenceUnavailable",
      "asset.psd.layerTreeEvidenceMissing",
      "asset.psd.materializationEvidenceMissing"
    ]);
    expect(expectCheckById(missingReport, "asset.psd.parserEvidenceUnavailable").evidence).toEqual(
      expect.arrayContaining([
        "reason=real-psd-parse-result-missing-parser-evidence",
        "layerTreeEvidencePresent=false",
        "materializationEvidenceCount=0"
      ])
    );

    profile.adapter.parser = createParserEvidence();
    profile.layerTreeEvidence = {
      evidenceKind: "psd-layer-tree-evidence-v1",
      evidenceId: "layerTree_mismatch",
      intakeKind: "parserFreeAdapterResult",
      groupCount: 99,
      layerCount: 0,
      privateShapePolicy: "parser-private-shape-excluded-v1"
    };
    profile.materializationEvidence = [
      {
        ...createMaterializationEvidence(),
        sourceLayerRef: {
          sourceAssetId: SourceAssetIdSchema.parse("src_psd_profile"),
          sourceLayerId: "psd_layer_missing"
        }
      }
    ];

    const mismatchReport = validatePsdPackage(document);

    expect(mismatchReport.summary.status).toBe("fail");
    expect(mismatchReport.checks.map((check) => check.checkId)).toEqual([
      "asset.psd.parserEvidence",
      "asset.psd.parserEvidence",
      "asset.psd.layerTreeEvidence",
      "asset.psd.layerTreeEvidenceMismatch",
      "asset.psd.materializationEvidence",
      "asset.psd.materializationEvidenceMismatch"
    ]);
    expect(expectCheckById(mismatchReport, "asset.psd.layerTreeEvidenceMismatch").evidence).toEqual(
      expect.arrayContaining([
        "layerTreeIntakeKind=parserFreeAdapterResult",
        "expectedIntakeKind=realPsdParseResult",
        "layerTreeGroupCount=99",
        "structuredGroupCount=1",
        "layerTreeLayerCount=0",
        "structuredLayerCount=1"
      ])
    );
    expect(expectCheckById(mismatchReport, "asset.psd.materializationEvidenceMismatch").evidence).toEqual(
      expect.arrayContaining([
        "materializationId=mat_wave44Body",
        "sourceLayerId=psd_layer_missing",
        "structuredLayerMatch=false",
        "flattenedLayerMatch=false"
      ])
    );
  });

  it("reports structured unsupported PSD layer features as source-targeted diagnostics", () => {
    const document = createPsdPackageDocument();
    const profile = expectPsdProfile(document);
    const structuredLayer = profile.sourceLayers[0];

    if (structuredLayer === undefined) {
      throw new Error("Expected structured PSD layer.");
    }

    structuredLayer.unsupportedFeatures = [
      {
        featureId: "psd.smartObject",
        scope: "layer",
        severity: "warning",
        message: "Smart object layer remains adapter metadata only.",
        source: { kind: "layer", id: "psd_layer_body" },
        rasterizeCandidate: true,
        manualConfirmationRequired: true
      }
    ];

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "asset.psd.unsupportedFeature");

    expect(report.summary.status).toBe("needs_review");
    expect(check).toMatchObject({
      checkId: "asset.psd.unsupportedFeature",
      status: "needs_review",
      severity: "warning",
      phase: "source_import",
      target: {
        kind: "sourceAsset",
        id: "src_psd_profile",
        path: "/assets/sourceManifest/sourceAssets/0/psdProfile/sourceLayers/0/unsupportedFeatures/0"
      },
      targetPath: "/assets/sourceManifest/sourceAssets/0/psdProfile/sourceLayers/0/unsupportedFeatures/0",
      relatedAC: ["AC-MVP-003", "AC-MVP-013"],
      relatedScenarios: ["SC-IN-003"]
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceAssetId=src_psd_profile",
      "sourceKind=psd-source-v1",
      "importProfile=layered-character-psd-profile-v1",
      "adapterName=synthetic-structured-profile-fixture",
      "profileEntry=sourceLayer",
      "sourceLayerId=psd_layer_body",
      "sourceLayerRole=editableLayer",
      "targetPartId=part_body",
      "textureId=tex_psd_body",
      "unsupportedFeature=psd.smartObject",
      "unsupportedFeatureScope=layer",
      "rasterizeCandidate=true",
      "manualConfirmationRequired=true",
      "unsupportedFeatureSourceKind=layer",
      "unsupportedFeatureSourceId=psd_layer_body",
      "structuredProfile=psdProfile",
      "compatibility=structured-profile-preferred-v1",
      "flattenedFallback=sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
    ]));
  });

  it("reports structured unsupported PSD group features with group identity", () => {
    const document = createPsdPackageDocument();
    const sourceGroup = expectPsdProfile(document).sourceGroups[0];

    if (sourceGroup === undefined) {
      throw new Error("Expected structured PSD group.");
    }

    sourceGroup.unsupportedFeatures = [
      {
        featureId: "psd.passThroughBlend",
        scope: "group",
        severity: "warning",
        message: "Pass-through group blend mode remains source metadata only.",
        source: { kind: "group", id: "group_body" },
        rasterizeCandidate: false,
        manualConfirmationRequired: true
      }
    ];

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "asset.psd.unsupportedFeature");

    expect(check.targetPath).toBe(
      "/assets/sourceManifest/sourceAssets/0/psdProfile/sourceGroups/0/unsupportedFeatures/0"
    );
    expect(check.evidence).toEqual(expect.arrayContaining([
      "profileEntry=sourceGroup",
      "sourceGroupId=group_body",
      "groupPath=Root/Body",
      "targetPartId=part_body",
      "unsupportedFeature=psd.passThroughBlend",
      "unsupportedFeatureScope=group",
      "manualConfirmationRequired=true"
    ]));
  });

  it("keeps flattened PSD unsupported features as compatibility fallback", () => {
    const document = createPsdPackageDocument();
    const sourceAsset = expectPsdSourceAsset(document);
    const sourceLayer = expectPsdLayer(document);

    delete sourceAsset.psdProfile;
    sourceLayer.unsupportedFeatures = ["smartObject"];

    const report = validatePsdPackage(document);
    const fallbackCheck = expectCheckById(report, "asset.psd.structuredProfileMissing");
    const unsupportedCheck = expectCheckById(report, "asset.psd.unsupportedFeature");

    expect(report.summary.status).toBe("needs_review");
    expect(fallbackCheck).toMatchObject({
      checkId: "asset.psd.structuredProfileMissing",
      status: "pass",
      severity: "info",
      targetPath: "/assets/sourceManifest/sourceAssets/0/psdProfile"
    });
    expect(fallbackCheck.evidence).toEqual(expect.arrayContaining([
      "structuredProfile=missing",
      "fallbackCompatibility=sourceAsset.diagnostics-summary-fallback-v1",
      "flattenedUnsupportedFeaturesFallback=sourceLayer.unsupportedFeatures-feature-id-fallback-v1",
      "flattenedUnsupportedFeatureCount=1"
    ]));
    expect(unsupportedCheck).toMatchObject({
      checkId: "asset.psd.unsupportedFeature",
      targetPath: "/assets/sourceManifest/sourceAssets/0/layers/0/unsupportedFeatures/0"
    });
    expect(unsupportedCheck.evidence).toEqual(expect.arrayContaining([
      "sourceLayerId=psd_layer_body",
      "unsupportedFeature=smartObject",
      "flatteningStrategy=sourceLayer.unsupportedFeatures[]"
    ]));
  });

  it("reports structured PSD adapter diagnostics with adapter evidence", () => {
    const document = createPsdPackageDocument();
    const profile = expectPsdProfile(document);

    profile.diagnostics = [
      {
        checkId: "adapter.psd.blendModeUnsupported",
        severity: "warning",
        message: "Blend mode is retained as metadata only.",
        source: { kind: "layer", id: "psd_layer_body" },
        evidence: ["blendMode=mul ", "normalizedMode=multiply"]
      }
    ];

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "asset.psd.adapterDiagnostic");

    expect(check).toMatchObject({
      checkId: "asset.psd.adapterDiagnostic",
      status: "needs_review",
      severity: "warning",
      phase: "source_import",
      targetPath: "/assets/sourceManifest/sourceAssets/0/psdProfile/diagnostics/0"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "adapterName=synthetic-structured-profile-fixture",
      "adapterDiagnosticCheckId=adapter.psd.blendModeUnsupported",
      "adapterDiagnosticSeverity=warning",
      "adapterDiagnosticSourceKind=layer",
      "adapterDiagnosticSourceId=psd_layer_body",
      "adapterEvidence[0]=blendMode=mul ",
      "adapterEvidence[1]=normalizedMode=multiply",
      "structuredProfile=psdProfile"
    ]));
  });

  it("reports mismatched flattened unsupported feature fallback when structured profile is authoritative", () => {
    const document = createPsdPackageDocument();
    const sourceLayer = expectPsdLayer(document);

    sourceLayer.unsupportedFeatures = ["psd.layerEffects"];

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "asset.psd.flattenedFallbackMismatch");

    expect(check).toMatchObject({
      checkId: "asset.psd.flattenedFallbackMismatch",
      status: "needs_review",
      severity: "warning",
      targetPath: "/assets/sourceManifest/sourceAssets/0/layers/0/unsupportedFeatures"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceLayerId=psd_layer_body",
      "structuredUnsupportedFeatures=none",
      "flattenedUnsupportedFeatures=psd.layerEffects",
      "structuredProfile=psdProfile",
      "compatibility=structured-profile-preferred-v1",
      "flattenedFallback=sourceLayer.unsupportedFeatures-feature-id-fallback-v1",
      "reason=unsupported-feature-fallback-mismatch"
    ]));
  });

  it("rejects PSD structured profile metadata on non-PSD source assets", () => {
    const document = createPsdPackageDocument();
    const sourceAsset = expectPsdSourceAsset(document);
    const sourceProvenance = document.assets.provenance.records.find((record) =>
      record.assetId === "src_psd_profile"
    );

    sourceAsset.kind = "split-png-set-v1";
    sourceAsset.importProfile = "split-png-fallback-v1";
    sourceAsset.filePath = "assets/sources/split/body.png";
    sourceAsset.diagnostics = ["split-png-fallback-v1"];

    if (sourceProvenance !== undefined) {
      sourceProvenance.filePath = "assets/sources/split/body.png";
    }

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "asset.psd.structuredProfileMismatch");

    expect(report.summary.status).toBe("fail");
    expect(check).toMatchObject({
      checkId: "asset.psd.structuredProfileMismatch",
      status: "fail",
      severity: "error",
      targetPath: "/assets/sourceManifest/sourceAssets/0/psdProfile"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "sourceKind=split-png-set-v1",
      "importProfile=split-png-fallback-v1",
      "structuredProfile=present",
      "reason=psd-profile-on-non-psd-source"
    ]));
  });

  it("reports missing PSD layer provenance through the drawable provenance contract", () => {
    const document = createPsdPackageDocument();
    const drawable = document.model.drawables.drawables[0];

    if (drawable === undefined) {
      throw new Error("Expected PSD fixture drawable.");
    }

    drawable.sourceProvenanceId = ProvenanceIdSchema.parse("prov_missing");

    const report = validatePsdPackage(document);
    const layerCheck = expectCheckById(report, "rights.psdLayerProvenanceMissing");

    expect(report.checks.map((check) => check.checkId)).toEqual([
      "rights.psdLayerProvenanceMissing",
      "rights.drawableProvenanceMissing"
    ]);
    expect(layerCheck).toMatchObject({
      checkId: "rights.psdLayerProvenanceMissing",
      status: "fail",
      severity: "error",
      phase: "rights",
      target: {
        kind: "sourceAsset",
        id: "src_psd_profile",
        path: "/assets/sourceManifest/sourceAssets/0/layers/0/mappedDrawableIds/0"
      },
      targetPath: "/assets/sourceManifest/sourceAssets/0/layers/0/mappedDrawableIds/0"
    });
    expect(layerCheck.evidence).toEqual(expect.arrayContaining([
      "sourceLayerId=psd_layer_body",
      "mappedDrawableId=draw_psd_body",
      "sourceProvenanceId=prov_missing",
      "reason=drawable-source-provenance-missing",
      "contractSupport=drawable.sourceProvenanceId"
    ]));
  });

  it("reports missing texture preview for a visible PSD-backed drawable", () => {
    const document = createPsdPackageDocument();

    delete document.assets.textureAtlas?.previewAssets;

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "ref.texturePreviewMissing");

    expect(check).toMatchObject({
      checkId: "ref.texturePreviewMissing",
      status: "fail",
      severity: "error",
      target: {
        kind: "texture",
        id: "tex_psd_body",
        path: "/assets/textureAtlas/previewAssets"
      },
      targetPath: "/assets/textureAtlas/previewAssets"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "drawableId=draw_psd_body",
      "textureId=tex_psd_body",
      "previewAssetMatch=missing",
      "sourceAssetId=src_psd_profile",
      "sourceKind=psd-source-v1"
    ]));
  });

  it("reports source-layer mismatch for PSD texture and drawable mappings", () => {
    const document = createPsdPackageDocument();
    const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
    const sourceLayer = sourceAsset?.layers[0];
    const textureEntry = document.assets.textureAtlas?.textures[0];
    const previewAsset = document.assets.textureAtlas?.previewAssets?.[0];

    if (sourceAsset === undefined || sourceLayer === undefined || textureEntry === undefined || previewAsset === undefined) {
      throw new Error("Expected PSD texture mapping fixture inputs.");
    }

    sourceAsset.layers.push({
      ...structuredClone(sourceLayer),
      sourceLayerId: "psd_layer_other",
      originalName: "Other",
      normalizedName: "other",
      mappedDrawableIds: []
    });
    textureEntry.sourceLayerId = "psd_layer_other";
    previewAsset.sourceLayerId = "psd_layer_other";

    const report = validatePsdPackage(document);
    const check = expectCheckById(report, "ref.textureSourceLayerMismatch");

    expect(report.checks.map((candidate) => candidate.checkId)).toEqual([
      "ref.textureSourceLayerMismatch"
    ]);
    expect(check).toMatchObject({
      checkId: "ref.textureSourceLayerMismatch",
      status: "fail",
      severity: "error",
      target: {
        kind: "texture",
        id: "tex_psd_body",
        path: "/model/drawables/drawables/0/textureId"
      },
      targetPath: "/model/drawables/drawables/0/textureId"
    });
    expect(check.evidence).toEqual(expect.arrayContaining([
      "drawableId=draw_psd_body",
      "drawableSourceAssetId=src_psd_profile",
      "textureSourceLayerId=psd_layer_other",
      "previewSourceLayerId=psd_layer_other",
      "expectedSourceLayerId=psd_layer_body",
      "reason=drawable-texture-source-layer-mismatch"
    ]));
  });

  it("keeps split PNG fallback validators on the existing compatible path", () => {
    const document = createPsdPackageDocument();
    const sourceAsset = document.assets.sourceManifest.sourceAssets[0];
    const sourceProvenance = document.assets.provenance.records.find((record) => record.assetId === "src_psd_profile");

    if (sourceAsset === undefined || sourceProvenance === undefined) {
      throw new Error("Expected source fixture inputs.");
    }

    sourceAsset.kind = "split-png-set-v1";
    sourceAsset.importProfile = "split-png-fallback-v1";
    sourceAsset.filePath = "assets/sources/split/body.png";
    sourceAsset.diagnostics = ["source.psd.absent"];
    delete sourceAsset.psdProfile;
    sourceProvenance.filePath = "assets/sources/split/body.png";

    const report = validatePsdPackage(document);

    expect(report.summary.status).toBe("pass");
    expect(report.checks).toEqual([]);
  });
});

const validatePsdPackage = (document: PackageDocumentDto): ValidationReportDto =>
  validatePackageRuntime({
    packageDocument: document,
    createdAt: "2026-05-31T00:00:00.000Z"
  });

const expectPsdLayer = (document: PackageDocumentDto) => {
  const sourceLayer = document.assets.sourceManifest.sourceAssets[0]?.layers[0];

  if (sourceLayer === undefined) {
    throw new Error("Expected PSD fixture source layer.");
  }

  return sourceLayer;
};

const expectPsdSourceAsset = (document: PackageDocumentDto) => {
  const sourceAsset = document.assets.sourceManifest.sourceAssets[0];

  if (sourceAsset === undefined) {
    throw new Error("Expected PSD fixture source asset.");
  }

  return sourceAsset;
};

const expectPsdProfile = (document: PackageDocumentDto) => {
  const profile = expectPsdSourceAsset(document).psdProfile;

  if (profile === undefined) {
    throw new Error("Expected structured PSD profile.");
  }

  return profile;
};

const expectCheckById = (
  report: ValidationReportDto,
  checkId: string
): ValidationReportDto["checks"][number] => {
  const check = report.checks.find((candidate) => candidate.checkId === checkId);

  if (check === undefined) {
    throw new Error(`Expected validation check ${checkId}.`);
  }

  return check;
};

const createParserEvidence = () => ({
  evidenceKind: "psd-parser-evidence-v1" as const,
  parserName: "@webtoon/psd",
  parserPackageName: "@webtoon/psd",
  parserVersion: "0.4.0",
  adapterName: "wave44-node-smoke",
  adapterVersion: "0.1.0",
  runtime: "node" as const,
  privateShapePolicy: "parser-private-shape-excluded-v1" as const
});

const createMaterializationEvidence = () => ({
  evidenceKind: "psd-layer-materialization-evidence-v1" as const,
  materializationId: "mat_wave44Body",
  sourceLayerRef: {
    sourceAssetId: SourceAssetIdSchema.parse("src_psd_profile"),
    sourceLayerId: "psd_layer_body",
    sourceLayerPath: ["Root", "Body"]
  },
  mediaType: "image/png",
  byteLength: 1024,
  digest: {
    algorithm: "sha256" as const,
    hex: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  },
  binaryAssetRef: {
    referenceKind: "package-binary-asset-ref-v1" as const,
    binaryAssetId: "bin_psd_body",
    packageRelativePath: "assets/textures/psd/body.materialized.png",
    digest: {
      algorithm: "sha256" as const,
      hex: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    },
    byteLength: 1024,
    mediaType: "image/png",
    storageStatus: "stored-package-local-v1" as const,
    provenanceId: ProvenanceIdSchema.parse("prov_psd_texture"),
    rightsAssetId: "tex_psd_body"
  },
  textureId: TextureIdSchema.parse("tex_psd_body"),
  provenance: {
    sourceFilePath: "test_data/sample_model.psd",
    sourceDigest: {
      algorithm: "sha256" as const,
      hex: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    },
    sourceByteLength: 22406225,
    sourceMediaType: "image/vnd.adobe.photoshop",
    privacyLabel: "privateLocalFixture" as const,
    publicDistribution: "notPublicDistributable" as const,
    fixtureId: "wave44.synthetic",
    derivedArtifactPath: "generated/source-materialization/wave44-body.json",
    generatedBy: "wave44.validatorSyntheticFixture"
  },
  parser: createParserEvidence(),
  extraction: {
    extractionKind: "selectedLayerRasterV1" as const,
    optionsSchemaVersion: "psd-layer-extraction-options-v1" as const,
    options: {
      effect: false,
      composed: false
    }
  }
});

const createPsdPackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse({
    manifest: {
      schemaVersion: "open-model-package-manifest-v1",
      packageId: "pkg_psd_profile_validator",
      packageDisplayName: "PSD Profile Validator",
      formatVersion: "open-model-package-v1",
      packageRevision: 0,
      createdAt: "2026-05-31T00:00:00.000Z",
      updatedAt: "2026-05-31T00:00:00.000Z",
      schemaVersions: {
        manifest: "open-model-package-manifest-v1",
        sourceManifest: "source-manifest-v1",
        textureAtlas: "texture-atlas-v1"
      },
      evaluatorVersions: {},
      modelFiles: {
        graph: "model/graph.json",
        drawables: "model/drawables.json",
        meshes: "model/meshes.json",
        parameters: "model/parameters.json",
        keyforms: "model/keyforms.json",
        rigControls: "model/rig-controls.json",
        dynamics: "model/dynamics.json",
        masks: "model/masks.json",
        drawOrder: "model/draw-order.json"
      },
      assetIndex: "assets/sources/source-manifest.json",
      operationLog: "operations/log.jsonl",
      rightsSummary: {
        status: "cleared"
      },
      provenanceSummary: {
        sourceAssetCount: 1
      },
      packageStableOrderVersion: "stable-order-v1"
    },
    model: {
      graph: {
        schemaVersion: "model-graph-v1",
        coordinateSystem: "canvas-y-down-v1",
        canvasSize: {
          width: 2048,
          height: 3072
        },
        parts: [
          {
            partId: "part_body",
            displayName: "Body",
            childPartIds: [],
            drawableIds: ["draw_psd_body"]
          }
        ],
        rigControlRootIds: [],
        stableOrder: ["part_body", "draw_psd_body", "mesh_psd_body"]
      },
      drawables: {
        schemaVersion: "drawables-file-v1",
        drawables: [
          {
            drawableId: "draw_psd_body",
            displayName: "Body",
            partId: "part_body",
            sourceAssetId: "src_psd_profile",
            textureId: "tex_psd_body",
            meshId: "mesh_psd_body",
            defaultOpacity: 0.9,
            runtimeVisibility: true,
            baseDrawOrder: 0,
            sourceProvenanceId: "prov_psd_source"
          }
        ]
      },
      meshes: {
        schemaVersion: "meshes-file-v1",
        meshes: [
          {
            meshId: "mesh_psd_body",
            drawableId: "draw_psd_body",
            vertices: [
              { x: 0, y: 0 },
              { x: 128, y: 0 },
              { x: 0, y: 128 }
            ],
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ],
            triangles: [[0, 1, 2]],
            vertexStableIds: ["v0", "v1", "v2"],
            bounds: {
              x: 0,
              y: 0,
              width: 128,
              height: 128
            },
            generationProvenanceId: "prov_psd_source"
          }
        ]
      },
      parameters: {
        schemaVersion: "parameters-file-v1",
        parameters: []
      },
      keyforms: {
        schemaVersion: "keyforms-file-v1",
        keyformSets: []
      },
      rigControls: {
        schemaVersion: "rig-controls-file-v1",
        rigControls: []
      },
      dynamics: {
        schemaVersion: "dynamics-file-v2",
        dynamicsGroups: []
      },
      masks: {
        schemaVersion: "masks-file-v1",
        masks: []
      },
      drawOrder: {
        schemaVersion: "draw-order-file-v1",
        entries: [
          {
            drawableId: "draw_psd_body",
            baseDrawOrder: 0,
            stableOrder: 0
          }
        ]
      }
    },
    assets: {
      sourceManifest: {
        schemaVersion: "source-manifest-v1",
        sourceAssets: [
          {
            sourceAssetId: "src_psd_profile",
            kind: "psd-source-v1",
            filePath: "assets/sources/character.psd",
            contentHash: "sha256:adapter-backed-psd-source-profile",
            importProfile: "layered-character-psd-profile-v1",
            layers: [
              {
                sourceLayerId: "psd_layer_body",
                sourceAssetId: "src_psd_profile",
                originalName: "Body",
                normalizedName: "body",
                groupPath: ["Root"],
                bounds: {
                  x: 0,
                  y: 0,
                  width: 128,
                  height: 128
                },
                visibleInSource: true,
                opacityInSource: 0.9,
                role: "editableLayer",
                unsupportedFeatures: [],
                mappedDrawableIds: ["draw_psd_body"]
              }
            ],
            diagnostics: [
              "profile.adapterResultSupplied"
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
                bounds: {
                  x: 0,
                  y: 0,
                  width: 2048,
                  height: 3072
                }
              },
              sourceGroups: [
                {
                  sourceGroupId: "group_body",
                  originalName: "Body",
                  normalizedName: "body",
                  groupPath: ["Root", "Body"],
                  sourceOrder: 0,
                  visibleInSource: true,
                  opacityInSource: 1,
                  bounds: {
                    x: 0,
                    y: 0,
                    width: 128,
                    height: 128
                  },
                  blendMode: {
                    modeKey: "pass",
                    normalizedMode: "passThrough",
                    displayName: "Pass Through",
                    supportedByMvp: false,
                    source: { kind: "group", id: "group_body" }
                  },
                  targetPartId: "part_body",
                  unsupportedFeatures: []
                }
              ],
              sourceLayers: [
                {
                  sourceLayerId: "psd_layer_body",
                  originalName: "Body",
                  normalizedName: "body",
                  parentGroupId: "group_body",
                  groupPath: ["Root", "Body"],
                  sourceOrder: 1,
                  bounds: {
                    x: 0,
                    y: 0,
                    width: 128,
                    height: 128
                  },
                  visibleInSource: true,
                  opacityInSource: 0.9,
                  role: "editableLayer",
                  blendMode: {
                    modeKey: "norm",
                    normalizedMode: "normal",
                    displayName: "Normal",
                    supportedByMvp: true,
                    source: { kind: "layer", id: "psd_layer_body" }
                  },
                  unsupportedFeatures: [],
                  texturePreviewReference: "assets/textures/psd/body.preview.png",
                  textureId: "tex_psd_body",
                  targetPartId: "part_body"
                }
              ],
              unsupportedFeatures: [],
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
      },
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures: [
          {
            textureId: "tex_psd_body",
            filePath: "assets/textures/psd/body.png",
            contentHash: "sha256:psd-texture-body",
            sourceAssetId: "src_psd_profile",
            sourceLayerId: "psd_layer_body",
            provenanceId: "prov_psd_texture"
          }
        ],
        previewAssets: [
          {
            previewAssetId: "preview_psd_body",
            textureId: "tex_psd_body",
            reference: {
              referenceKind: "deterministic-data-url-v1",
              dataUrl: "data:image/png;base64,iVBORw0KGgo="
            },
            contentHash: "sha256:psd-preview-body",
            sourceAssetId: "src_psd_profile",
            sourceLayerId: "psd_layer_body",
            provenanceId: "prov_psd_texture",
            rightsAssetId: "tex_psd_body"
          }
        ]
      },
      provenance: {
        schemaVersion: "provenance-file-v1",
        records: [
          {
            provenanceId: "prov_psd_source",
            assetId: "src_psd_profile",
            assetKind: "source",
            filePath: "assets/sources/character.psd",
            contentHash: "sha256:adapter-backed-psd-source-profile",
            creator: "contract-fixture",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            aiUsed: false,
            transformHistory: [
              "Adapter-backed PSD source profile fixture; no PSD bytes parsed by validator."
            ],
            relatedOperationIds: []
          },
          {
            provenanceId: "prov_psd_texture",
            assetId: "tex_psd_body",
            assetKind: "texture",
            filePath: "assets/textures/psd/body.png",
            contentHash: "sha256:psd-texture-body",
            creator: "contract-fixture",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            aiUsed: false,
            transformHistory: [
              "Texture preview reference supplied by adapter result; no PSD raster extraction in validator."
            ],
            relatedOperationIds: []
          }
        ]
      },
      rights: {
        schemaVersion: "rights-file-v1",
        records: [
          {
            assetId: "src_psd_profile",
            rightsStatus: "cleared",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            notes: "Synthetic adapter-backed PSD profile metadata; no PSD binary fixture."
          },
          {
            assetId: "tex_psd_body",
            rightsStatus: "cleared",
            license: "internal-test-fixture",
            redistributionAllowed: true,
            notes: "Deterministic preview texture metadata for validator diagnostics."
          }
        ]
      }
    }
  });
