import {
  createInitialAuthoringRevision,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  RuntimeDiffDto,
  RuntimeSnapshotId,
  ValidationDiffDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationEvidenceResultSchema,
  OperationRequestSchema
} from "./index.js";
import type {
  CommitOperationOutcome,
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto,
  OperationLogEntryDto
} from "./index.js";
import {
  buildRuntimeEvidence,
  materializeRuntimeEvidenceArtifacts,
  RuntimeSnapshotSchema
} from "../../runtime-core/src/index.js";
import type {
  RuntimeEvidenceArtifact,
  RuntimeEvidenceResult
} from "../../runtime-core/src/index.js";
import {
  buildRuntimeEvidenceReport,
  buildValidationDiff,
  CANONICAL_OPERATION_LOG_PATH,
  materializeValidationReportArtifact,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type {
  ValidationReportArtifact,
  ValidationReportDto
} from "../../validator-core/src/index.js";

describe("drawable layer runtime evidence regression fixture", () => {
  it("keeps reorder, hide, and show operations visible through runtime and validation evidence", () => {
    const session = createLayerFixtureSession();
    const capturedEvidence: LayerOperationEvidenceArtifacts[] = [];
    const core = createOperationCore({
      now: () => new Date("2026-05-30T01:00:00.000Z"),
      evidenceProvider: (input) => collectLayerOperationEvidence(input, capturedEvidence)
    });

    const reorderOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/set-draw-order-commit.request.json")
    );
    const hideOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/hide-front-commit.request.json")
    );
    const showOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/show-front-commit.request.json")
    );

    expect(reorderOutcome.result.status).toBe("committed");
    expect(hideOutcome.result.status).toBe("committed");
    expect(showOutcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(3);
    expect(capturedEvidence).toHaveLength(3);

    for (const evidence of capturedEvidence) {
      assertMaterializedRuntimeArtifactsParse(evidence.runtimeArtifacts);
      assertMaterializedValidationArtifactsParse(evidence.validationArtifacts);
    }

    expect(summarizeLayerOperationEvidence({
      outcomes: [reorderOutcome, hideOutcome, showOutcome],
      logEntries: core.operationLog.entries,
      evidence: capturedEvidence
    })).toEqual(loadFixtureJson("expected/drawable-layer-runtime-evidence-summary.json"));
  });
});

interface LayerOperationEvidenceArtifacts {
  readonly operationType: OperationEvidenceProviderInput["request"]["operationType"];
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly runtimeArtifacts: readonly RuntimeEvidenceArtifact[];
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
  readonly validationArtifacts: readonly ValidationReportArtifact[];
}

interface LayerEvidenceSummary {
  readonly schemaVersion: "drawable-layer-runtime-evidence-summary-v1";
  readonly fixture: {
    readonly drawableIds: readonly string[];
    readonly operationTypes: readonly string[];
  };
  readonly operations: readonly LayerOperationSummary[];
}

interface LayerOperationSummary {
  readonly operationType: string;
  readonly operationId: string;
  readonly resultStatus: string;
  readonly targetIds: readonly string[];
  readonly modelDiffPaths: readonly string[];
  readonly runtimeSnapshots: {
    readonly baseline: LayerRuntimeSnapshotSummary;
    readonly candidate: LayerRuntimeSnapshotSummary;
  };
  readonly runtimeDiff: {
    readonly drawableRuntimeStateChanges: RuntimeDiffDto["drawableRuntimeStateChanges"];
    readonly drawListChanges: RuntimeDiffDto["drawListChanges"];
  };
  readonly validation: {
    readonly baselineReportId: ValidationReportId;
    readonly candidateReportId: ValidationReportId;
    readonly candidateStatus: string;
    readonly operationLogPresent: boolean;
    readonly operationLogPath?: string;
    readonly runtimeSnapshotIds: readonly RuntimeSnapshotId[];
    readonly validationDiff: {
      readonly beforeReportId: ValidationReportId;
      readonly afterReportId: ValidationReportId;
      readonly newFailureCount: number;
      readonly resolvedFailureCount: number;
      readonly severityChangeCount: number;
    };
  };
  readonly operationEvidence: {
    readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
    readonly generatedValidationReportIds: readonly ValidationReportId[];
    readonly logEntryRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
    readonly logEntryValidationReportIds: readonly ValidationReportId[];
  };
}

interface LayerRuntimeSnapshotSummary {
  readonly packageRevision: number;
  readonly drawList: readonly string[];
  readonly drawables: readonly {
    readonly drawableId: string;
    readonly visible: boolean;
    readonly baseDrawOrder: number;
    readonly evaluatedDrawOrder: number;
  }[];
}

const collectLayerOperationEvidence = (
  input: OperationEvidenceProviderInput,
  artifacts: LayerOperationEvidenceArtifacts[]
): OperationEvidenceResultDto => {
  if (input.request.operationType !== "setDrawOrder" && input.request.operationType !== "setRuntimeVisibility") {
    throw new Error(`Unsupported layer evidence fixture operation: ${input.request.operationType}`);
  }

  const packageHash = "sha256:drawable-layer-runtime-evidence";
  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, { packageHash }),
    candidateGraph: toRuntimeGraph(input.candidateSession, { packageHash }),
    baseline: {
      frame: {
        targetIds: [...input.targetIds]
      }
    },
    candidate: {
      frame: {
        targetIds: [...input.targetIds]
      }
    },
    context: {
      source: { surface: "validator", operationId: input.result.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: `${input.request.operationId}-runtime-evidence`
  });
  const runtimeArtifacts = materializeRuntimeEvidenceArtifacts(runtimeEvidence).artifacts;
  const baselineReport = buildRuntimeEvidenceReport({
    reportId: `val_${input.request.operationId}_baseline`,
    createdAt: "2026-05-30T01:00:00.000Z",
    packageId: runtimeEvidence.baselineSnapshot.packageId,
    packageRevision: runtimeEvidence.baselineSnapshot.packageRevision,
    packageHash,
    runtimeSnapshotIds: [runtimeEvidence.baselineSnapshot.snapshotId]
  });
  const candidateReport = buildRuntimeEvidenceReport({
    reportId: `val_${input.request.operationId}_candidate`,
    createdAt: "2026-05-30T01:00:00.000Z",
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
    validationArtifacts
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

const summarizeLayerOperationEvidence = (input: {
  readonly outcomes: readonly CommitOperationOutcome[];
  readonly logEntries: readonly OperationLogEntryDto[];
  readonly evidence: readonly LayerOperationEvidenceArtifacts[];
}): LayerEvidenceSummary => ({
  schemaVersion: "drawable-layer-runtime-evidence-summary-v1",
  fixture: {
    drawableIds: ["draw_back", "draw_front"],
    operationTypes: input.evidence.map((evidence) => evidence.operationType)
  },
  operations: input.evidence.map((evidence, index) => {
    const outcome = input.outcomes[index];
    const logEntry = input.logEntries[index];

    if (outcome === undefined || logEntry === undefined) {
      throw new Error(`Missing operation outcome or log entry at index ${index}.`);
    }

    return summarizeLayerOperation(outcome, logEntry, evidence);
  })
});

const summarizeLayerOperation = (
  outcome: CommitOperationOutcome,
  logEntry: OperationLogEntryDto,
  evidence: LayerOperationEvidenceArtifacts
): LayerOperationSummary => ({
  operationType: evidence.operationType,
  operationId: outcome.result.operationId,
  resultStatus: outcome.result.status,
  targetIds: logEntry.targetIds,
  modelDiffPaths: outcome.result.modelDiff?.changed.flatMap((change) =>
    change.fields.map((field) => field.path)
  ) ?? [],
  runtimeSnapshots: {
    baseline: summarizeRuntimeSnapshot(evidence.runtimeEvidence.baselineSnapshot),
    candidate: summarizeRuntimeSnapshot(evidence.runtimeEvidence.candidateSnapshot)
  },
  runtimeDiff: {
    drawableRuntimeStateChanges: evidence.runtimeEvidence.runtimeDiff.drawableRuntimeStateChanges,
    drawListChanges: evidence.runtimeEvidence.runtimeDiff.drawListChanges
  },
  validation: {
    baselineReportId: evidence.baselineReport.reportId,
    candidateReportId: evidence.candidateReport.reportId,
    candidateStatus: evidence.candidateReport.summary.status,
    operationLogPresent: evidence.candidateReport.evidence.operationLogPresent,
    ...(evidence.candidateReport.evidence.operationLogPath === undefined
      ? {}
      : { operationLogPath: evidence.candidateReport.evidence.operationLogPath }),
    runtimeSnapshotIds: evidence.candidateReport.evidence.runtimeSnapshotIds,
    validationDiff: {
      beforeReportId: evidence.validationDiff.beforeReportId,
      afterReportId: evidence.validationDiff.afterReportId,
      newFailureCount: evidence.validationDiff.newFailures.length,
      resolvedFailureCount: evidence.validationDiff.resolvedFailures.length,
      severityChangeCount: evidence.validationDiff.severityChanges.length
    }
  },
  operationEvidence: {
    generatedRuntimeSnapshotIds: outcome.result.generatedRuntimeSnapshotIds,
    generatedValidationReportIds: outcome.result.generatedValidationReportIds,
    logEntryRuntimeSnapshotIds: logEntry.runtimeSnapshotIds,
    logEntryValidationReportIds: logEntry.validationReportIds
  }
});

const summarizeRuntimeSnapshot = (
  snapshot: RuntimeEvidenceResult["candidateSnapshot"]
): LayerRuntimeSnapshotSummary => ({
  packageRevision: snapshot.packageRevision,
  drawList: snapshot.drawList,
  drawables: snapshot.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    visible: drawable.visible,
    baseDrawOrder: drawable.baseDrawOrder,
    evaluatedDrawOrder: drawable.evaluatedDrawOrder
  }))
});

const assertMaterializedRuntimeArtifactsParse = (
  artifacts: readonly RuntimeEvidenceArtifact[]
): void => {
  for (const artifact of artifacts) {
    if (artifact.kind === "runtimeSnapshot") {
      expect(RuntimeSnapshotSchema.parse(JSON.parse(artifact.content)).snapshotId).toBe(artifact.snapshotId);
    }
  }
};

const assertMaterializedValidationArtifactsParse = (
  artifacts: readonly ValidationReportArtifact[]
): void => {
  for (const artifact of artifacts) {
    expect(ValidationReportSchema.parse(JSON.parse(artifact.content))).toEqual(artifact.report);
  }
};

const createLayerFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_drawable_layer_runtime_evidence"),
    packageDisplayName: "Drawable Layer Runtime Evidence",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 128, height: 128 },
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: [
          DrawableIdSchema.parse("draw_back"),
          DrawableIdSchema.parse("draw_front")
        ]
      }
    ],
    drawables: [
      createFixtureDrawable("draw_back", "mesh_back", "Back", 0),
      createFixtureDrawable("draw_front", "mesh_front", "Front", 10)
    ],
    meshes: [
      createFixtureMesh("mesh_back", "draw_back", { x: 0, y: 0, width: 16, height: 16 }),
      createFixtureMesh("mesh_front", "draw_front", { x: 8, y: 8, width: 16, height: 16 })
    ],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [
      {
        drawableId: DrawableIdSchema.parse("draw_back"),
        baseDrawOrder: 0,
        stableOrder: 0
      },
      {
        drawableId: DrawableIdSchema.parse("draw_front"),
        baseDrawOrder: 10,
        stableOrder: 1
      }
    ],
    rigControlRootIds: [],
    stableOrder: ["draw_back", "draw_front"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const createFixtureDrawable = (
  drawableId: string,
  meshId: string,
  displayName: string,
  baseDrawOrder: number
) => ({
  drawableId: DrawableIdSchema.parse(drawableId),
  displayName,
  partId: PartIdSchema.parse("part_root"),
  sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
  textureId: TextureIdSchema.parse(`tex_${drawableId.replace(/^draw_/, "")}`),
  meshId: MeshIdSchema.parse(meshId),
  defaultOpacity: 1,
  runtimeVisibility: true,
  baseDrawOrder,
  sourceProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});

const createFixtureMesh = (
  meshId: string,
  drawableId: string,
  bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
) => ({
  meshId: MeshIdSchema.parse(meshId),
  drawableId: DrawableIdSchema.parse(drawableId),
  vertices: [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x, y: bounds.y + bounds.height }
  ],
  uvs: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 }
  ],
  triangles: [[0, 1, 2] as [number, number, number]],
  vertexStableIds: ["v0", "v1", "v2"],
  bounds,
  generationProvenanceId: ProvenanceIdSchema.parse(`prov_${drawableId.replace(/^draw_/, "")}`)
});

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/drawable-layer-runtime-evidence"
);
