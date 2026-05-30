import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import {
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeDiffDto,
  RuntimeSnapshotId,
  ValidationDiffDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationEvidenceResultSchema,
  OperationRequestSchema,
  parseOperationLogEntriesFromJsonl,
  serializeOperationLogEntriesToJsonl
} from "./index.js";
import type {
  CommitOperationOutcome,
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto,
  OperationLogEntryDto
} from "./index.js";
import {
  PackageDocumentSchema,
  PACKAGE_PROVENANCE_PATH,
  PACKAGE_RIGHTS_PATH,
  PACKAGE_TEXTURE_ATLAS_PATH,
  parsePackageDocumentFromFileSet,
  serializePackageDocumentToFileSet
} from "../../package-format/src/index.js";
import type {
  PackageDocumentDto,
  PackageTextFileEntry
} from "../../package-format/src/index.js";
import {
  buildRuntimeEvidence,
  materializeRuntimeEvidenceArtifacts,
  RuntimeSnapshotSchema
} from "../../runtime-core/src/index.js";
import type {
  EvaluatedDrawableDto,
  RuntimeEvidenceArtifact,
  RuntimeEvidenceResult,
  RuntimeSnapshotDto
} from "../../runtime-core/src/index.js";
import {
  buildRuntimeEvidenceReport,
  buildValidationDiff,
  CANONICAL_OPERATION_LOG_PATH,
  materializeValidationReportArtifact,
  validatePackageRuntime,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type {
  ValidationReportArtifact,
  ValidationReportDto
} from "../../validator-core/src/index.js";

describe("imported source package evidence and preview consistency fixture", () => {
  it("parses the import, createDrawable, and generateMesh requests through operation-core DTOs", () => {
    const importRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/import-split-png-source-commit.request.json")
    );
    const createDrawableRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/create-drawable-commit.request.json")
    );
    const generateMeshRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/generate-mesh-commit.request.json")
    );

    expect(importRequest).toMatchObject({
      operationType: "importSplitPngSourceAsset",
      dryRun: false,
      payload: {
        sourceAssetId: "src_split_body",
        importProfile: "split-png-fallback-v1",
        placementPolicy: "use-metadata",
        layers: [
          {
            sourceLayerId: "layer_body",
            imagePath: "assets/sources/split/body.png"
          }
        ]
      }
    });
    expect(createDrawableRequest).toMatchObject({
      operationType: "createDrawable",
      basePackageRevision: 1,
      payload: {
        sourceAssetId: "src_split_body",
        sourceLayerId: "layer_body",
        displayName: "Body"
      }
    });
    expect(generateMeshRequest).toMatchObject({
      operationType: "generateMesh",
      basePackageRevision: 2,
      payload: {
        drawableId: "draw_body",
        method: "auto-grid-v1",
        densityHint: "low"
      }
    });
  });

  it("keeps imported source evidence observable through operation log, package file set, and SVG preview semantics", () => {
    const baseDocument = loadBaselinePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);
    const capturedEvidence: ImportedSourceOperationEvidenceArtifacts[] = [];
    const core = createOperationCore({
      now: () => new Date("2026-05-30T02:00:00.000Z"),
      evidenceProvider: (input) => collectImportedSourceEvidence(input, capturedEvidence)
    });

    const importOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/import-split-png-source-commit.request.json")
    );
    const createOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/create-drawable-commit.request.json")
    );
    const generateOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/generate-mesh-commit.request.json")
    );
    const operationLogText = serializeOperationLogEntriesToJsonl(core.operationLog.entries);
    const parsedLogEntries = parseOperationLogEntriesFromJsonl(operationLogText);
    const savedDocument = toPackageDocument(session, baseDocument, {
      updatedAt: "2026-05-30T02:30:00.000Z"
    });
    const generatedArtifacts = toUniquePackageFileEntries(capturedEvidence);
    const fileSet = serializePackageDocumentToFileSet(savedDocument, {
      operationLogText,
      generatedArtifacts
    });
    const reloadedDocument = parsePackageDocumentFromFileSet(fileSet);
    const finalValidationReport = validatePackageRuntime({
      packageDocument: reloadedDocument,
      runtimeSnapshot: lastCapturedEvidence(capturedEvidence).runtimeEvidence.candidateSnapshot,
      createdAt: "2026-05-30T02:30:00.000Z"
    });

    expect(importOutcome.result.status).toBe("committed");
    expect(createOutcome.result.status).toBe("committed");
    expect(generateOutcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(3);
    expect(capturedEvidence).toHaveLength(3);
    expect(parsedLogEntries).toEqual(core.operationLog.entries);
    expect(PackageDocumentSchema.parse(reloadedDocument)).toEqual(reloadedDocument);
    expect(savedDocument.assets.textureAtlas).toEqual(baseDocument.assets.textureAtlas);
    expect(fileSet.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      baseDocument.manifest.assetIndex,
      PACKAGE_TEXTURE_ATLAS_PATH,
      PACKAGE_PROVENANCE_PATH,
      PACKAGE_RIGHTS_PATH,
      CANONICAL_OPERATION_LOG_PATH
    ]));
    assertTexturePreviewMissingDiagnostic(finalValidationReport);

    for (const evidence of capturedEvidence) {
      assertMaterializedRuntimeArtifactsParse(evidence.runtimeArtifacts);
      assertMaterializedValidationArtifactsParse(evidence.validationArtifacts);
    }

    const expectedSummary = withTexturePreviewMissingValidation(
      loadFixtureJson(
        "expected/imported-source-package-evidence-preview-consistency-summary.json"
      ) as Partial<ImportedSourceEvidenceSummary>
    );

    expect(summarizeImportedSourcePackageEvidence({
      outcomes: [importOutcome, createOutcome, generateOutcome],
      logEntries: core.operationLog.entries,
      evidence: capturedEvidence,
      document: reloadedDocument,
      fileSet,
      generatedArtifacts,
      finalValidationReport
    })).toMatchObject(expectedSummary);
  });
});

interface ImportedSourceOperationEvidenceArtifacts {
  readonly operationType: OperationEvidenceProviderInput["request"]["operationType"];
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly runtimeArtifacts: readonly RuntimeEvidenceArtifact[];
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
  readonly validationArtifacts: readonly ValidationReportArtifact[];
  readonly candidateSourceState: SourceStateSummary;
}

interface ImportedSourceEvidenceSummary {
  readonly schemaVersion: "imported-source-package-evidence-preview-consistency-summary-v1";
  readonly operations: readonly OperationEvidenceSummary[];
  readonly packageFileSet: PackageFileSetEvidenceSummary;
  readonly runtimePreviewConsistency: {
    readonly snapshots: readonly RuntimePreviewSummary[];
    readonly textureBitmapRendered: false;
    readonly semantics: "current-svg-geometry-preview";
  };
  readonly validation: {
    readonly status: string;
    readonly checkIds: readonly string[];
  };
}

interface OperationEvidenceSummary {
  readonly operationType: string;
  readonly operationId: string;
  readonly resultStatus: string;
  readonly targetIds: readonly string[];
  readonly modelDiffPaths: readonly string[];
  readonly sourceState: SourceStateSummary;
  readonly operationEvidence: {
    readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
    readonly generatedValidationReportIds: readonly ValidationReportId[];
    readonly logEntryRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
    readonly logEntryValidationReportIds: readonly ValidationReportId[];
    readonly validationDiff: {
      readonly beforeReportId: ValidationReportId;
      readonly afterReportId: ValidationReportId;
      readonly newFailureCount: number;
      readonly resolvedFailureCount: number;
      readonly severityChangeCount: number;
    };
  };
  readonly runtimeDiff: {
    readonly beforeSnapshotId: RuntimeDiffDto["beforeSnapshotId"];
    readonly afterSnapshotId: RuntimeDiffDto["afterSnapshotId"];
    readonly drawableChangeCount: number;
    readonly drawListChangeCount: number;
  };
}

interface SourceStateSummary {
  readonly sourceAssets: readonly {
    readonly sourceAssetId: string;
    readonly kind: string;
    readonly filePath: string;
    readonly layerIds: readonly string[];
    readonly mappedDrawableIds: readonly string[];
    readonly diagnostics: readonly string[];
  }[];
  readonly drawables: readonly {
    readonly drawableId: string;
    readonly sourceAssetId: string;
    readonly textureId: string;
    readonly meshId: string;
    readonly sourceProvenanceId: string;
  }[];
  readonly provenanceByAsset: readonly {
    readonly assetId: string;
    readonly provenanceIds: readonly string[];
    readonly relatedOperationIds: readonly string[];
  }[];
  readonly rightsByAsset: readonly {
    readonly assetId: string;
    readonly rightsStatus: string;
  }[];
}

interface PackageFileSetEvidenceSummary {
  readonly entryCount: number;
  readonly authoredPaths: readonly string[];
  readonly operationLogPath: string;
  readonly operationLogTypes: readonly string[];
  readonly generatedArtifactPaths: readonly string[];
  readonly sourceManifest: {
    readonly sourceAssetIds: readonly string[];
    readonly layerMappings: readonly {
      readonly sourceLayerId: string;
      readonly mappedDrawableIds: readonly string[];
    }[];
  };
  readonly textureAtlas: {
    readonly present: boolean;
    readonly textureRefs: readonly {
      readonly textureId: string;
      readonly sourceAssetId?: string;
      readonly sourceLayerId?: string;
      readonly provenanceId?: string;
    }[];
  };
  readonly provenance: readonly {
    readonly provenanceId: string;
    readonly assetId: string;
    readonly relatedOperationIds: readonly string[];
  }[];
  readonly rights: readonly {
    readonly assetId: string;
    readonly rightsStatus: string;
  }[];
}

interface RuntimePreviewSummary {
  readonly operationType: string;
  readonly snapshotId: RuntimeSnapshotId;
  readonly packageRevision: number;
  readonly drawList: readonly string[];
  readonly visibleDrawableCount: number;
  readonly drawableCount: number;
  readonly drawables: readonly RuntimePreviewDrawableSummary[];
}

interface RuntimePreviewDrawableSummary {
  readonly drawableId: string;
  readonly meshId: string;
  readonly sourceAssetId?: string;
  readonly sourceLayerId?: string;
  readonly textureId?: string;
  readonly sourceProvenanceId?: string;
  readonly visible: boolean;
  readonly svgShape: "rect" | "polygon";
  readonly vertexCount: number;
  readonly polygonPointCount: number;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

const collectImportedSourceEvidence = (
  input: OperationEvidenceProviderInput,
  artifacts: ImportedSourceOperationEvidenceArtifacts[]
): OperationEvidenceResultDto => {
  if (
    input.request.operationType !== "importSplitPngSourceAsset" &&
    input.request.operationType !== "createDrawable" &&
    input.request.operationType !== "generateMesh"
  ) {
    throw new Error(`Unsupported imported source evidence operation: ${input.request.operationType}`);
  }

  const frameStart = frameStartForOperation(input.request.operationType);
  const packageHash = "sha256:imported-source-package-evidence-preview-consistency";
  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, { packageHash }),
    candidateGraph: toRuntimeGraph(input.candidateSession, { packageHash }),
    baseline: {
      frame: {
        frameIndex: frameStart,
        targetIds: [...input.targetIds]
      }
    },
    candidate: {
      frame: {
        frameIndex: frameStart + 1,
        targetIds: [...input.targetIds]
      }
    },
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
    },
    context: {
      source: { surface: "validator", operationId: input.result.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: `${input.request.operationType}-imported-source-evidence`
  });
  const runtimeArtifacts = materializeRuntimeEvidenceArtifacts(runtimeEvidence).artifacts;
  const baselineReport = buildRuntimeEvidenceReport({
    reportId: `val_${input.result.operationId}_baseline`,
    createdAt: "2026-05-30T02:00:00.000Z",
    packageId: runtimeEvidence.baselineSnapshot.packageId,
    packageRevision: runtimeEvidence.baselineSnapshot.packageRevision,
    packageHash,
    runtimeSnapshotIds: [runtimeEvidence.baselineSnapshot.snapshotId]
  });
  const candidateReport = buildRuntimeEvidenceReport({
    reportId: `val_${input.result.operationId}_candidate`,
    createdAt: "2026-05-30T02:00:00.000Z",
    packageId: runtimeEvidence.candidateSnapshot.packageId,
    packageRevision: runtimeEvidence.candidateSnapshot.packageRevision,
    packageHash,
    operationLogPresent: true,
    operationLogPath: CANONICAL_OPERATION_LOG_PATH,
    runtimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds
  });
  const validationDiff = buildValidationDiff({
    baseline: baselineReport,
    candidate: candidateReport
  });
  const validationArtifacts = [
    materializeValidationReportArtifact(baselineReport),
    materializeValidationReportArtifact(candidateReport)
  ];

  artifacts.push({
    operationType: input.request.operationType,
    runtimeEvidence,
    runtimeArtifacts,
    baselineReport,
    candidateReport,
    validationDiff,
    validationArtifacts,
    candidateSourceState: summarizeSourceState(input.candidateSession)
  });

  return OperationEvidenceResultSchema.parse({
    runtimeDiff: runtimeEvidence.runtimeDiff,
    validationDiff,
    generatedRuntimeSnapshotIds: runtimeEvidence.generatedRuntimeSnapshotIds,
    generatedRuntimeStateRefs: runtimeEvidence.generatedRuntimeStateRefs,
    generatedRuntimeStateSequenceRefs: runtimeEvidence.generatedRuntimeStateSequenceRefs,
    finalRuntimeState: runtimeEvidence.finalRuntimeState,
    finalRuntimeStateRef: runtimeEvidence.finalRuntimeStateRef,
    generatedValidationReportIds: [
      baselineReport.reportId,
      candidateReport.reportId
    ]
  });
};

const summarizeImportedSourcePackageEvidence = (input: {
  readonly outcomes: readonly CommitOperationOutcome[];
  readonly logEntries: readonly OperationLogEntryDto[];
  readonly evidence: readonly ImportedSourceOperationEvidenceArtifacts[];
  readonly document: PackageDocumentDto;
  readonly fileSet: readonly PackageTextFileEntry[];
  readonly generatedArtifacts: readonly PackageTextFileEntry[];
  readonly finalValidationReport: ValidationReportDto;
}): ImportedSourceEvidenceSummary => ({
  schemaVersion: "imported-source-package-evidence-preview-consistency-summary-v1",
  operations: input.evidence.map((evidence, index) => {
    const outcome = input.outcomes[index];
    const logEntry = input.logEntries[index];

    if (outcome === undefined || logEntry === undefined) {
      throw new Error(`Missing imported source operation evidence at index ${index}.`);
    }

    return summarizeOperationEvidence(outcome, logEntry, evidence);
  }),
  packageFileSet: summarizePackageFileSet(input),
  runtimePreviewConsistency: {
    snapshots: input.evidence
      .filter((evidence) => evidence.operationType === "createDrawable" || evidence.operationType === "generateMesh")
      .map((evidence) =>
        summarizeRuntimePreview({
          operationType: evidence.operationType,
          snapshot: evidence.runtimeEvidence.candidateSnapshot,
          document: input.document
        })
      ),
    textureBitmapRendered: false,
    semantics: "current-svg-geometry-preview"
  },
  validation: {
    status: input.finalValidationReport.summary.status,
    checkIds: input.finalValidationReport.checks.map((check) => check.checkId)
  }
});

const summarizeOperationEvidence = (
  outcome: CommitOperationOutcome,
  logEntry: OperationLogEntryDto,
  evidence: ImportedSourceOperationEvidenceArtifacts
): OperationEvidenceSummary => ({
  operationType: evidence.operationType,
  operationId: outcome.result.operationId,
  resultStatus: outcome.result.status,
  targetIds: logEntry.targetIds,
  modelDiffPaths: outcome.result.modelDiff?.changed.flatMap((change) =>
    change.fields.map((field) => field.path)
  ) ?? [],
  sourceState: evidence.candidateSourceState,
  operationEvidence: {
    generatedRuntimeSnapshotIds: outcome.result.generatedRuntimeSnapshotIds,
    generatedValidationReportIds: outcome.result.generatedValidationReportIds,
    logEntryRuntimeSnapshotIds: logEntry.runtimeSnapshotIds,
    logEntryValidationReportIds: logEntry.validationReportIds,
    validationDiff: {
      beforeReportId: evidence.validationDiff.beforeReportId,
      afterReportId: evidence.validationDiff.afterReportId,
      newFailureCount: evidence.validationDiff.newFailures.length,
      resolvedFailureCount: evidence.validationDiff.resolvedFailures.length,
      severityChangeCount: evidence.validationDiff.severityChanges.length
    }
  },
  runtimeDiff: {
    beforeSnapshotId: evidence.runtimeEvidence.runtimeDiff.beforeSnapshotId,
    afterSnapshotId: evidence.runtimeEvidence.runtimeDiff.afterSnapshotId,
    drawableChangeCount: evidence.runtimeEvidence.runtimeDiff.drawableChanges.length,
    drawListChangeCount: evidence.runtimeEvidence.runtimeDiff.drawListChanges.length
  }
});

const summarizeSourceState = (
  session: OperationEvidenceProviderInput["candidateSession"]
): SourceStateSummary => ({
  sourceAssets: session.graph.sourceAssets.map((sourceAsset) => ({
    sourceAssetId: sourceAsset.sourceAssetId,
    kind: sourceAsset.kind,
    filePath: sourceAsset.filePath,
    layerIds: sourceAsset.layers.map((layer) => layer.sourceLayerId),
    mappedDrawableIds: sourceAsset.layers.flatMap((layer) => layer.mappedDrawableIds),
    diagnostics: [...sourceAsset.diagnostics]
  })),
  drawables: session.graph.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    sourceAssetId: drawable.sourceAssetId,
    textureId: drawable.textureId,
    meshId: drawable.meshId,
    sourceProvenanceId: drawable.sourceProvenanceId
  })),
  provenanceByAsset: summarizeProvenanceByAsset(session.graph.provenanceRecords),
  rightsByAsset: session.graph.rightsRecords.map((record) => ({
    assetId: record.assetId,
    rightsStatus: record.rightsStatus
  }))
});

const summarizeProvenanceByAsset = (
  records: readonly PackageDocumentDto["assets"]["provenance"]["records"][number][]
) =>
  [...new Set(records.map((record) => record.assetId))]
    .sort()
    .map((assetId) => {
      const assetRecords = records.filter((record) => record.assetId === assetId);
      return {
        assetId,
        provenanceIds: assetRecords.map((record) => record.provenanceId),
        relatedOperationIds: [...new Set(assetRecords.flatMap((record) => record.relatedOperationIds))]
      };
    });

const summarizePackageFileSet = (input: {
  readonly logEntries: readonly OperationLogEntryDto[];
  readonly document: PackageDocumentDto;
  readonly fileSet: readonly PackageTextFileEntry[];
  readonly generatedArtifacts: readonly PackageTextFileEntry[];
}): PackageFileSetEvidenceSummary => {
  const generatedPaths = new Set(input.generatedArtifacts.map((entry) => entry.path));
  const sourceAssets = input.document.assets.sourceManifest.sourceAssets;
  const textureAtlas = input.document.assets.textureAtlas;

  return {
    entryCount: input.fileSet.length,
    authoredPaths: input.fileSet
      .map((entry) => entry.path)
      .filter((path) => !generatedPaths.has(path) && path !== CANONICAL_OPERATION_LOG_PATH),
    operationLogPath: CANONICAL_OPERATION_LOG_PATH,
    operationLogTypes: input.logEntries.map((entry) => entry.operationType),
    generatedArtifactPaths: input.generatedArtifacts.map((entry) => entry.path),
    sourceManifest: {
      sourceAssetIds: sourceAssets.map((sourceAsset) => sourceAsset.sourceAssetId),
      layerMappings: sourceAssets.flatMap((sourceAsset) =>
        sourceAsset.layers.map((layer) => ({
          sourceLayerId: layer.sourceLayerId,
          mappedDrawableIds: layer.mappedDrawableIds
        }))
      )
    },
    textureAtlas: {
      present: textureAtlas !== undefined,
      textureRefs: textureAtlas?.textures.map((texture) => ({
        textureId: texture.textureId,
        ...(texture.sourceAssetId === undefined ? {} : { sourceAssetId: texture.sourceAssetId }),
        ...(texture.sourceLayerId === undefined ? {} : { sourceLayerId: texture.sourceLayerId }),
        ...(texture.provenanceId === undefined ? {} : { provenanceId: texture.provenanceId })
      })) ?? []
    },
    provenance: input.document.assets.provenance.records.map((record) => ({
      provenanceId: record.provenanceId,
      assetId: record.assetId,
      relatedOperationIds: record.relatedOperationIds
    })),
    rights: input.document.assets.rights.records.map((record) => ({
      assetId: record.assetId,
      rightsStatus: record.rightsStatus
    }))
  };
};

const summarizeRuntimePreview = (input: {
  readonly operationType: ImportedSourceOperationEvidenceArtifacts["operationType"];
  readonly snapshot: RuntimeSnapshotDto;
  readonly document: PackageDocumentDto;
}): RuntimePreviewSummary => ({
  operationType: input.operationType,
  snapshotId: input.snapshot.snapshotId,
  packageRevision: input.snapshot.packageRevision,
  drawList: input.snapshot.drawList,
  visibleDrawableCount: input.snapshot.drawables.filter((drawable) => drawable.visible).length,
  drawableCount: input.snapshot.drawables.length,
  drawables: input.snapshot.drawables.map((drawable) =>
    summarizeRuntimePreviewDrawable(drawable, input.document)
  )
});

const summarizeRuntimePreviewDrawable = (
  drawable: EvaluatedDrawableDto,
  document: PackageDocumentDto
): RuntimePreviewDrawableSummary => {
  const packageDrawable = document.model.drawables.drawables.find(
    (candidate) => candidate.drawableId === drawable.drawableId
  );
  const sourceLayer = findSourceLayerForDrawable(document, drawable.drawableId);
  const polygonPointCount = drawable.vertices?.length ?? 0;

  return {
    drawableId: drawable.drawableId,
    meshId: drawable.meshId,
    ...(packageDrawable === undefined
      ? {}
      : {
          sourceAssetId: packageDrawable.sourceAssetId,
          textureId: packageDrawable.textureId,
          sourceProvenanceId: packageDrawable.sourceProvenanceId
        }),
    ...(sourceLayer === undefined ? {} : { sourceLayerId: sourceLayer.sourceLayerId }),
    visible: drawable.visible,
    svgShape: polygonPointCount >= 3 ? "polygon" : "rect",
    vertexCount: drawable.vertexCount,
    polygonPointCount,
    bounds: drawable.bounds
  };
};

const findSourceLayerForDrawable = (
  document: PackageDocumentDto,
  drawableId: string
): PackageDocumentDto["assets"]["sourceManifest"]["sourceAssets"][number]["layers"][number] | undefined =>
  document.assets.sourceManifest.sourceAssets
    .flatMap((sourceAsset) => sourceAsset.layers)
    .find((layer) => layer.mappedDrawableIds.some((candidate) => candidate === drawableId));

const toUniquePackageFileEntries = (
  artifacts: readonly ImportedSourceOperationEvidenceArtifacts[]
): readonly PackageTextFileEntry[] => {
  const entries = artifacts.flatMap((artifact) => [
    ...artifact.runtimeArtifacts.map((runtimeArtifact) => ({
      path: runtimeArtifact.path,
      text: runtimeArtifact.content
    })),
    ...artifact.validationArtifacts.map((validationArtifact) => ({
      path: validationArtifact.path,
      text: validationArtifact.content
    }))
  ]);
  const byPath = new Map<string, PackageTextFileEntry>();

  for (const entry of entries) {
    byPath.set(entry.path, entry);
  }

  return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
};

const assertMaterializedRuntimeArtifactsParse = (
  artifacts: readonly RuntimeEvidenceArtifact[]
): void => {
  for (const artifact of artifacts) {
    const parsed = JSON.parse(artifact.content) as unknown;

    if (artifact.kind === "runtimeSnapshot") {
      expect(RuntimeSnapshotSchema.parse(parsed).snapshotId).toBe(artifact.snapshotId);
      continue;
    }

    if (artifact.kind === "runtimeState") {
      expect(RuntimeStateDtoSchema.parse(parsed)).toEqual(artifact.state);
      continue;
    }

    expect(RuntimeStateSequenceArtifactSchema.parse(parsed)).toEqual(artifact.artifact);
  }
};

const assertMaterializedValidationArtifactsParse = (
  artifacts: readonly ValidationReportArtifact[]
): void => {
  for (const artifact of artifacts) {
    expect(ValidationReportSchema.parse(JSON.parse(artifact.content))).toEqual(artifact.report);
  }
};

const assertTexturePreviewMissingDiagnostic = (report: ValidationReportDto): void => {
  expect(report.summary).toMatchObject({
    status: "fail",
    highestSeverity: "error"
  });
  expect(report.checks).toHaveLength(1);
  expect(report.checks[0]).toMatchObject({
    checkId: "ref.texturePreviewMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "texture",
      id: "tex_body",
      path: "/assets/textureAtlas/previewAssets"
    },
    targetPath: "/assets/textureAtlas/previewAssets",
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-IN-002"]
  });
  expect(report.checks[0]?.evidence).toEqual(expect.arrayContaining([
    "drawableId=draw_body",
    "textureId=tex_body",
    "textureAtlasMatch=present",
    "previewAssetMatch=missing",
    "sourceKind=split-png-set-v1"
  ]));
};

const withTexturePreviewMissingValidation = (
  summary: Partial<ImportedSourceEvidenceSummary>
): Partial<ImportedSourceEvidenceSummary> => ({
  ...summary,
  validation: {
    status: "fail",
    checkIds: ["ref.texturePreviewMissing"]
  }
});

const lastCapturedEvidence = (
  artifacts: readonly ImportedSourceOperationEvidenceArtifacts[]
): ImportedSourceOperationEvidenceArtifacts => {
  const artifact = artifacts.at(-1);
  if (artifact === undefined) {
    throw new Error("Expected imported source operation evidence to be captured.");
  }

  return artifact;
};

const frameStartForOperation = (
  operationType: ImportedSourceOperationEvidenceArtifacts["operationType"]
): number => {
  switch (operationType) {
    case "importSplitPngSourceAsset":
      return 0;
    case "createDrawable":
      return 2;
    case "generateMesh":
      return 4;
    default:
      return 6;
  }
};

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8")) as unknown;

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/imported-source-package-evidence-preview-consistency"
);
