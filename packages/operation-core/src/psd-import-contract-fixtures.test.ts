import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type {
  ModelDiffDto
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationRequestSchema,
  type CommitOperationOutcome,
  type OperationLogEntryDto
} from "./index.js";
import {
  validatePackageRuntime,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type { ValidationReportDto } from "../../validator-core/src/index.js";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "../../package-format/src/index.js";

describe("PSD import contract fixtures", () => {
  it("fixes happy path adapter metadata through import, drawable, texture preview, and validation evidence", () => {
    const run = runFixtureOperations("psd-import-happy-path", [
      "request/import-psd-source-commit.request.json",
      "request/create-drawable-commit.request.json",
      "request/generate-mesh-commit.request.json"
    ], {
      logTimestamp: "2026-05-31T04:15:00.000Z",
      packageUpdatedAt: "2026-05-31T04:30:00.000Z",
      validationCreatedAt: "2026-05-31T04:30:00.000Z"
    });

    expect(run.outcomes.map((outcome) => outcome.result.status)).toEqual([
      "committed",
      "committed",
      "committed"
    ]);
    expect(run.session.packageRevision).toBe(3);
    expect(run.document.assets.sourceManifest.sourceAssets).toHaveLength(1);
    expect(run.document.assets.textureAtlas?.textures).toHaveLength(1);
    expect(run.document.assets.textureAtlas?.previewAssets).toHaveLength(1);
    expect(ValidationReportSchema.parse(run.validationReport)).toEqual(
      loadFixtureJson("psd-import-happy-path", "expected/validation-report.json")
    );
    expect(summarizePsdFixtureRun("psd-import-happy-path", run)).toEqual(
      loadFixtureJson("psd-import-happy-path", "expected/psd-import-happy-path-summary.json")
    );
  });

  it("fixes unsupported layer diagnostics without leaking PSD feature metadata into runtime", () => {
    const run = runFixtureOperations("psd-unsupported-layer", [
      "request/import-psd-source-commit.request.json"
    ], {
      logTimestamp: "2026-05-31T05:15:00.000Z",
      packageUpdatedAt: "2026-05-31T05:30:00.000Z",
      validationCreatedAt: "2026-05-31T05:30:00.000Z"
    });

    expect(run.outcomes[0]?.result.status).toBe("committed");
    expect(run.outcomes[0]?.result.diagnostics.map((diagnostic) => diagnostic.checkId)).toEqual([
      "operation.importPsdSourceAsset.unsupportedFeature",
      "operation.importPsdSourceAsset.unsupportedFeature"
    ]);
    expect(ValidationReportSchema.parse(run.validationReport)).toEqual(
      loadFixtureJson("psd-unsupported-layer", "expected/validation-report.json")
    );
    expect(summarizePsdFixtureRun("psd-unsupported-layer", run)).toEqual(
      loadFixtureJson("psd-unsupported-layer", "expected/psd-unsupported-layer-summary.json")
    );
  });
});

interface FixtureRunOptions {
  readonly logTimestamp: string;
  readonly packageUpdatedAt: string;
  readonly validationCreatedAt: string;
}

interface FixtureRun {
  readonly session: ReturnType<typeof createAuthoringSessionFromPackageDocument>;
  readonly outcomes: readonly CommitOperationOutcome[];
  readonly logEntries: readonly OperationLogEntryDto[];
  readonly document: PackageDocumentDto;
  readonly validationReport: ValidationReportDto;
}

type TexturePreviewFixtureAsset = NonNullable<
  NonNullable<PackageDocumentDto["assets"]["textureAtlas"]>["previewAssets"]
>[number];

const runFixtureOperations = (
  fixtureId: string,
  requestPaths: readonly string[],
  options: FixtureRunOptions
): FixtureRun => {
  const baseDocument = PackageDocumentSchema.parse(
    loadFixtureJson(fixtureId, "baseline-package.json")
  );
  const session = createAuthoringSessionFromPackageDocument(baseDocument);
  const core = createOperationCore({
    now: () => new Date(options.logTimestamp)
  });
  const outcomes = requestPaths.map((requestPath) =>
    core.commitOperation(
      session,
      OperationRequestSchema.parse(loadFixtureJson(fixtureId, requestPath))
    )
  );
  const document = toPackageDocument(session, baseDocument, {
    updatedAt: options.packageUpdatedAt
  });
  const validationReport = validatePackageRuntime({
    packageDocument: document,
    createdAt: options.validationCreatedAt
  });

  return {
    session,
    outcomes,
    logEntries: core.operationLog.entries,
    document,
    validationReport
  };
};

const summarizePsdFixtureRun = (
  fixtureId: string,
  run: FixtureRun
) => ({
  schemaVersion: "psd-import-contract-evidence-summary-v1",
  fixtureId,
  operations: run.outcomes.map((outcome, index) => {
    const logEntry = run.logEntries[index];

    if (logEntry === undefined) {
      throw new Error(`Missing operation log entry for fixture ${fixtureId} at index ${index}.`);
    }

    return summarizeOperation(outcome, logEntry);
  }),
  sourceManifest: summarizeSourceManifest(run.document),
  textureRelations: summarizeTextureRelations(run.document),
  texturePreviewMetadata: summarizeTexturePreviewMetadata(run.document),
  rightsAndProvenance: summarizeRightsAndProvenance(run.document),
  validation: {
    reportId: run.validationReport.reportId,
    status: run.validationReport.summary.status,
    highestSeverity: run.validationReport.summary.highestSeverity,
    checkIds: run.validationReport.checks.map((check) => check.checkId)
  },
  ...(fixtureId === "psd-unsupported-layer"
    ? { runtimeLeakage: summarizeRuntimeLeakage(run.session) }
    : {})
});

const summarizeOperation = (
  outcome: CommitOperationOutcome,
  logEntry: OperationLogEntryDto
) => ({
  operationType: logEntry.operationType,
  operationId: outcome.result.operationId,
  resultStatus: outcome.result.status,
  targetIds: logEntry.targetIds,
  diagnosticCheckIds: outcome.result.diagnostics.map((diagnostic) => diagnostic.checkId),
  diagnostics: outcome.result.diagnostics,
  modelDiffPaths: summarizeModelDiffPaths(outcome.result.modelDiff)
});

const summarizeModelDiffPaths = (
  modelDiff: ModelDiffDto | undefined
): readonly string[] =>
  modelDiff?.changed.flatMap((change) =>
    change.fields.map((field) => field.path)
  ).filter((path) =>
    [
      "/assets/sourceManifest/sourceAssets",
      "/assets/provenance/records",
      "/assets/rights/records",
      "/assets/textureAtlas/textures",
      "/assets/textureAtlas/previewAssets",
      "/model/drawables/draw_psd_face_base",
      "/model/meshes/mesh_psd_face_base",
      "/model/graph/parts/drawableIds",
      "/model/meshes/mesh_psd_face_base/vertices",
      "/model/meshes/mesh_psd_face_base/triangles",
      "/meshId"
    ].includes(path) ||
    path.startsWith("/assets/sourceManifest/sourceAssets/src_psd_") ||
    path.startsWith("/assets/textureAtlas/textures/tex_psd_") ||
    path.startsWith("/assets/textureAtlas/previewAssets/preview_src_psd_")
  ) ?? [];

const summarizeSourceManifest = (document: PackageDocumentDto) => {
  const sourceAsset = expectSingleSourceAsset(document);

  return {
    sourceAssetId: sourceAsset.sourceAssetId,
    kind: sourceAsset.kind,
    filePath: sourceAsset.filePath,
    contentHash: sourceAsset.contentHash,
    importProfile: sourceAsset.importProfile,
    layerMappings: sourceAsset.layers.map((layer) => ({
      sourceLayerId: layer.sourceLayerId,
      originalName: layer.originalName,
      normalizedName: layer.normalizedName,
      groupPath: layer.groupPath,
      bounds: layer.bounds,
      role: layer.role,
      mappedDrawableIds: layer.mappedDrawableIds,
      unsupportedFeatures: layer.unsupportedFeatures
    })),
    psdProfile: expectPsdProfile(sourceAsset),
    diagnosticEvidence: summarizeSourceDiagnostics(sourceAsset.diagnostics)
  };
};

const summarizeSourceDiagnostics = (diagnostics: readonly string[]) => {
  const unsupportedFeatures = diagnostics
    .filter((diagnostic) => diagnostic.startsWith("psd.layerUnsupportedFeature:"))
    .map((diagnostic) => extractUnsupportedFeatureId(diagnostic));

  return {
    canvas: expectDiagnostic(diagnostics, "psd.canvas:"),
    ...(unsupportedFeatures.length === 0
      ? {
          groupTargetParts: diagnostics.filter((diagnostic) =>
            diagnostic.startsWith("psd.groupTargetPart:")
          ),
          layerTargetParts: diagnostics.filter((diagnostic) =>
            diagnostic.startsWith("psd.layerTargetPart:")
          ),
          layerTextures: diagnostics.filter((diagnostic) =>
            diagnostic.startsWith("psd.layerTexture:")
          ),
          layerTexturePreviews: diagnostics.filter((diagnostic) =>
            diagnostic.startsWith("psd.layerTexturePreview:")
          )
        }
      : { unsupportedFeatures }),
    sourceAsset: expectDiagnostic(diagnostics, "psd.sourceAsset:")
  };
};

const summarizeTexturePreviewMetadata = (document: PackageDocumentDto) => ({
  textures: document.assets.textureAtlas?.textures.map((texture) => ({
    textureId: texture.textureId,
    filePath: texture.filePath,
    ...(texture.sourceAssetId === undefined ? {} : { sourceAssetId: texture.sourceAssetId }),
    ...(texture.sourceLayerId === undefined ? {} : { sourceLayerId: texture.sourceLayerId }),
    ...(texture.provenanceId === undefined ? {} : { provenanceId: texture.provenanceId })
  })) ?? [],
  previewAssets: document.assets.textureAtlas?.previewAssets?.map((previewAsset) => ({
    previewAssetId: previewAsset.previewAssetId,
    textureId: previewAsset.textureId,
    referenceKind: previewAsset.reference.referenceKind,
    ...("filePath" in previewAsset.reference
      ? { filePath: previewAsset.reference.filePath }
      : { dataUrl: previewAsset.reference.dataUrl }),
    sourceAssetId: previewAsset.sourceAssetId,
    sourceLayerId: previewAsset.sourceLayerId,
    provenanceId: previewAsset.provenanceId,
    rightsAssetId: previewAsset.rightsAssetId
  })) ?? []
});

const summarizeTextureRelations = (document: PackageDocumentDto) => {
  const sourceAsset = expectSingleSourceAsset(document);
  const psdProfile = expectPsdProfile(sourceAsset);

  return psdProfile.sourceLayers
    .filter((layer) =>
      layer.textureId !== undefined || layer.texturePreviewReference !== undefined
    )
    .map((layer) => {
      const texture = document.assets.textureAtlas?.textures.find((candidate) =>
        candidate.textureId === layer.textureId
      );
      const previewAsset = document.assets.textureAtlas?.previewAssets?.find((candidate) =>
        candidate.sourceAssetId === sourceAsset.sourceAssetId &&
        candidate.sourceLayerId === layer.sourceLayerId
      );

      return {
        sourceAssetId: sourceAsset.sourceAssetId,
        sourceLayerId: layer.sourceLayerId,
        profileTextureId: layer.textureId ?? "missing",
        profileTexturePreviewReference: layer.texturePreviewReference ?? "missing",
        atlasTextureId: texture?.textureId ?? "missing",
        atlasTextureFilePath: texture?.filePath ?? "missing",
        previewAssetId: previewAsset?.previewAssetId ?? "missing",
        previewReferenceKind: previewAsset?.reference.referenceKind ?? "missing",
        ...summarizePreviewReference(previewAsset),
        relationConsistent:
          layer.textureId !== undefined &&
          texture?.textureId === layer.textureId &&
          previewAsset?.textureId === layer.textureId &&
          previewAsset?.sourceAssetId === sourceAsset.sourceAssetId &&
          previewAsset?.sourceLayerId === layer.sourceLayerId
      };
    });
};

const summarizePreviewReference = (
  previewAsset: TexturePreviewFixtureAsset | undefined
) => {
  if (previewAsset === undefined) {
    return {};
  }

  return "filePath" in previewAsset.reference
    ? { previewFilePath: previewAsset.reference.filePath }
    : { previewDataUrl: previewAsset.reference.dataUrl };
};

const summarizeRightsAndProvenance = (document: PackageDocumentDto) => ({
  rights: document.assets.rights.records.map((record) => ({
    assetId: record.assetId,
    rightsStatus: record.rightsStatus,
    license: record.license,
    redistributionAllowed: record.redistributionAllowed
  })),
  provenance: document.assets.provenance.records
    .filter((record) => record.provenanceId.startsWith("prov_import_psd_"))
    .map((record) => ({
      provenanceId: record.provenanceId,
      assetId: record.assetId,
      assetKind: record.assetKind,
      filePath: record.filePath,
      contentHash: record.contentHash,
      creator: record.creator,
      license: record.license,
      redistributionAllowed: record.redistributionAllowed,
      aiUsed: record.aiUsed,
      transformHistory: record.transformHistory,
      relatedOperationIds: record.relatedOperationIds
    }))
});

const summarizeRuntimeLeakage = (
  session: ReturnType<typeof createAuthoringSessionFromPackageDocument>
) => {
  const runtimeGraph = toRuntimeGraph(session);
  const runtimeText = JSON.stringify(runtimeGraph);

  return {
    drawableCount: runtimeGraph.drawables.size,
    containsSourceAssetIds: runtimeText.includes("src_psd_unsupported_layer"),
    containsPsdProfile: runtimeText.includes("layered-character-psd-profile-v1"),
    containsUnsupportedFeatureIds:
      runtimeText.includes("psd.smartObject") || runtimeText.includes("psd.layerEffects")
  };
};

const expectSingleSourceAsset = (
  document: PackageDocumentDto
): PackageDocumentDto["assets"]["sourceManifest"]["sourceAssets"][number] => {
  const sourceAsset = document.assets.sourceManifest.sourceAssets[0];

  if (sourceAsset === undefined) {
    throw new Error("Expected PSD fixture source asset.");
  }

  return sourceAsset;
};

const expectPsdProfile = (
  sourceAsset: PackageDocumentDto["assets"]["sourceManifest"]["sourceAssets"][number]
) => {
  if (sourceAsset.psdProfile === undefined) {
    throw new Error(`Expected structured PSD profile for ${sourceAsset.sourceAssetId}.`);
  }

  return sourceAsset.psdProfile;
};

const expectDiagnostic = (
  diagnostics: readonly string[],
  prefix: string
): string => {
  const diagnostic = diagnostics.find((candidate) => candidate.startsWith(prefix));

  if (diagnostic === undefined) {
    throw new Error(`Expected source diagnostic with prefix ${prefix}.`);
  }

  return diagnostic;
};

const extractUnsupportedFeatureId = (diagnostic: string): string => {
  const jsonStart = diagnostic.indexOf("{");
  if (jsonStart === -1) {
    throw new Error(`Expected unsupported feature diagnostic JSON: ${diagnostic}`);
  }

  const parsed = JSON.parse(diagnostic.slice(jsonStart)) as { featureId?: unknown };
  if (typeof parsed.featureId !== "string") {
    throw new Error(`Expected unsupported feature ID in diagnostic: ${diagnostic}`);
  }

  return parsed.featureId;
};

const loadFixtureJson = (
  fixtureId: string,
  relativePath: string
): unknown =>
  JSON.parse(
    readFileSync(join(fixtureRootDirectory, fixtureId, relativePath), "utf8")
  ) as unknown;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts"
);
