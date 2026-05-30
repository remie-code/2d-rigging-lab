import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
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
  OperationRequestSchema
} from "./index.js";
import type {
  CommitOperationOutcome,
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto,
  OperationLogEntryDto
} from "./index.js";
import {
  PackageDocumentSchema
} from "../../package-format/src/index.js";
import type {
  PackageDocumentDto
} from "../../package-format/src/index.js";
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

describe("mesh vertex runtime evidence regression fixture", () => {
  it("keeps a generated mesh vertex edit visible through runtime, validation, result, and log evidence", () => {
    const createRequest = OperationRequestSchema.parse(loadFixtureJson("request/create-drawable-commit.request.json"));
    const generateRequest = OperationRequestSchema.parse(loadFixtureJson("request/generate-mesh-commit.request.json"));
    const moveRequest = OperationRequestSchema.parse(loadFixtureJson("request/move-mesh-vertex-commit.request.json"));

    expect(moveRequest).toMatchObject({
      operationType: "moveMeshVertex",
      basePackageRevision: 2,
      payload: {
        meshId: "mesh_mesh_vertex_oracle",
        vertexDeltas: [
          {
            vertexId: "vtx_mesh_vertex_oracle_1_1",
            delta: { x: 4, y: 6 }
          }
        ]
      }
    });

    const session = createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());
    const capturedEvidence: MeshVertexOperationEvidenceArtifacts[] = [];
    const core = createOperationCore({
      now: () => new Date("2026-05-30T02:00:00.000Z"),
      evidenceProvider: (input) => collectMeshVertexEvidence(input, capturedEvidence)
    });

    const createOutcome = core.commitOperation(session, createRequest);
    const generateOutcome = core.commitOperation(session, generateRequest);
    const moveOutcome = core.commitOperation(session, moveRequest);
    const moveEvidence = expectEvidence(capturedEvidence, "moveMeshVertex");
    const moveLogEntry = expectLogEntry(moveOutcome);

    expect(createOutcome.result.status).toBe("committed");
    expect(generateOutcome.result.status).toBe("committed");
    expect(moveOutcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(3);
    expect(capturedEvidence.map((evidence) => evidence.operationType)).toEqual([
      "createDrawable",
      "generateMesh",
      "moveMeshVertex"
    ]);

    for (const evidence of capturedEvidence) {
      assertMaterializedRuntimeArtifactsParse(evidence.runtimeArtifacts);
      assertMaterializedValidationArtifactsParse(evidence.validationArtifacts);
    }

    expect(findFixtureDrawable(moveEvidence.runtimeEvidence.baselineSnapshot)).toMatchObject({
      vertexHash: "vhash_327bd044_4",
      bounds: { x: 48, y: 16, width: 24, height: 24 },
      vertices: [
        { x: 48, y: 16 },
        { x: 72, y: 16 },
        { x: 48, y: 40 },
        { x: 72, y: 40 }
      ]
    });
    expect(findFixtureDrawable(moveEvidence.runtimeEvidence.candidateSnapshot)).toMatchObject({
      vertexHash: "vhash_e5715a22_4",
      bounds: { x: 48, y: 16, width: 28, height: 30 },
      vertices: [
        { x: 48, y: 16 },
        { x: 72, y: 16 },
        { x: 48, y: 40 },
        { x: 76, y: 46 }
      ]
    });
    expect(moveOutcome.result.runtimeDiff?.drawableChanges).toEqual([
      {
        drawableId: "draw_mesh_vertex_oracle",
        boundsChanged: true,
        vertexHashBefore: "vhash_327bd044_4",
        vertexHashAfter: "vhash_e5715a22_4"
      }
    ]);
    expect(moveLogEntry.result.runtimeDiff?.drawableChanges).toEqual(moveOutcome.result.runtimeDiff?.drawableChanges);

    expect(summarizeMeshVertexEvidence({
      sessionPackageRevision: session.packageRevision,
      outcomes: [createOutcome, generateOutcome, moveOutcome],
      logEntry: moveLogEntry,
      evidence: capturedEvidence
    })).toEqual(loadFixtureJson("expected/mesh-vertex-runtime-evidence-summary.json"));
  });
});

interface MeshVertexOperationEvidenceArtifacts {
  readonly operationType: OperationEvidenceProviderInput["request"]["operationType"];
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly runtimeArtifacts: readonly RuntimeEvidenceArtifact[];
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
  readonly validationArtifacts: readonly ValidationReportArtifact[];
}

interface MeshVertexRuntimeEvidenceSummary {
  readonly schemaVersion: "mesh-vertex-runtime-evidence-summary-v1";
  readonly fixture: {
    readonly drawableId: string;
    readonly meshId: string;
    readonly movedVertexId: string;
    readonly operationTypes: readonly string[];
    readonly finalPackageRevision: number;
  };
  readonly moveOperation: {
    readonly operationType: string;
    readonly operationId: string;
    readonly resultStatus: string;
    readonly targetIds: readonly string[];
    readonly modelDiffPaths: readonly string[];
    readonly runtimeSnapshots: {
      readonly baseline: MeshVertexRuntimeSnapshotSummary;
      readonly candidate: MeshVertexRuntimeSnapshotSummary;
    };
    readonly runtimeDiff: {
      readonly beforeSnapshotId: RuntimeSnapshotId;
      readonly afterSnapshotId: RuntimeSnapshotId;
      readonly drawableChanges: RuntimeDiffDto["drawableChanges"];
      readonly drawableRuntimeStateChanges: RuntimeDiffDto["drawableRuntimeStateChanges"];
      readonly drawListChanges: RuntimeDiffDto["drawListChanges"];
    };
    readonly validation: MeshVertexValidationSummary;
    readonly operationEvidence: MeshVertexOperationEvidenceSummary;
  };
}

interface MeshVertexRuntimeSnapshotSummary {
  readonly packageRevision: number;
  readonly drawable: {
    readonly drawableId: string;
    readonly meshId: string;
    readonly vertexCount: number;
    readonly vertexHash: string;
    readonly bounds: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly vertices?: readonly {
      readonly x: number;
      readonly y: number;
    }[];
  };
}

interface MeshVertexValidationSummary {
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
}

interface MeshVertexOperationEvidenceSummary {
  readonly resultRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly resultValidationReportIds: readonly ValidationReportId[];
  readonly resultRuntimeDiffDrawableChanges: RuntimeDiffDto["drawableChanges"];
  readonly logEntryRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly logEntryValidationReportIds: readonly ValidationReportId[];
  readonly logEntryRuntimeDiffDrawableChanges: RuntimeDiffDto["drawableChanges"];
  readonly logEntryPayloadVertexDeltas: readonly {
    readonly vertexId: string;
    readonly delta: {
      readonly x: number;
      readonly y: number;
    };
  }[];
  readonly finalRuntimeStateRef: string;
}

const collectMeshVertexEvidence = (
  input: OperationEvidenceProviderInput,
  artifacts: MeshVertexOperationEvidenceArtifacts[]
): OperationEvidenceResultDto => {
  if (
    input.request.operationType !== "createDrawable" &&
    input.request.operationType !== "generateMesh" &&
    input.request.operationType !== "moveMeshVertex"
  ) {
    throw new Error(`Unsupported mesh vertex evidence fixture operation: ${input.request.operationType}`);
  }

  const packageHash = "sha256:mesh-vertex-runtime-evidence";
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
    options: {
      schemaVersion: "runtime-evaluation-options-v1",
      snapshotDetail: "full"
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
    createdAt: "2026-05-30T02:00:00.000Z",
    packageId: runtimeEvidence.baselineSnapshot.packageId,
    packageRevision: runtimeEvidence.baselineSnapshot.packageRevision,
    packageHash,
    runtimeSnapshotIds: [runtimeEvidence.baselineSnapshot.snapshotId]
  });
  const candidateReport = buildRuntimeEvidenceReport({
    reportId: `val_${input.request.operationId}_candidate`,
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

const summarizeMeshVertexEvidence = (input: {
  readonly sessionPackageRevision: number;
  readonly outcomes: readonly CommitOperationOutcome[];
  readonly logEntry: OperationLogEntryDto;
  readonly evidence: readonly MeshVertexOperationEvidenceArtifacts[];
}): MeshVertexRuntimeEvidenceSummary => {
  const moveOutcome = input.outcomes.find((outcome) => outcome.result.operationId === "op_mesh_vertex_move");
  const moveEvidence = expectEvidence(input.evidence, "moveMeshVertex");

  if (moveOutcome === undefined) {
    throw new Error("Missing moveMeshVertex outcome.");
  }

  return {
    schemaVersion: "mesh-vertex-runtime-evidence-summary-v1",
    fixture: {
      drawableId: "draw_mesh_vertex_oracle",
      meshId: "mesh_mesh_vertex_oracle",
      movedVertexId: "vtx_mesh_vertex_oracle_1_1",
      operationTypes: input.evidence.map((evidence) => evidence.operationType),
      finalPackageRevision: input.sessionPackageRevision
    },
    moveOperation: {
      operationType: moveEvidence.operationType,
      operationId: moveOutcome.result.operationId,
      resultStatus: moveOutcome.result.status,
      targetIds: input.logEntry.targetIds,
      modelDiffPaths: moveOutcome.result.modelDiff?.changed.flatMap((change) =>
        change.fields.map((field) => field.path)
      ) ?? [],
      runtimeSnapshots: {
        baseline: summarizeRuntimeSnapshot(moveEvidence.runtimeEvidence.baselineSnapshot),
        candidate: summarizeRuntimeSnapshot(moveEvidence.runtimeEvidence.candidateSnapshot)
      },
      runtimeDiff: {
        beforeSnapshotId: moveEvidence.runtimeEvidence.runtimeDiff.beforeSnapshotId,
        afterSnapshotId: moveEvidence.runtimeEvidence.runtimeDiff.afterSnapshotId,
        drawableChanges: moveEvidence.runtimeEvidence.runtimeDiff.drawableChanges,
        drawableRuntimeStateChanges: moveEvidence.runtimeEvidence.runtimeDiff.drawableRuntimeStateChanges,
        drawListChanges: moveEvidence.runtimeEvidence.runtimeDiff.drawListChanges
      },
      validation: summarizeValidationEvidence(moveEvidence),
      operationEvidence: summarizeOperationEvidence(moveOutcome, input.logEntry)
    }
  };
};

const summarizeRuntimeSnapshot = (
  snapshot: RuntimeEvidenceResult["candidateSnapshot"]
): MeshVertexRuntimeSnapshotSummary => ({
  packageRevision: snapshot.packageRevision,
  drawable: summarizeFixtureDrawable(snapshot)
});

const summarizeFixtureDrawable = (
  snapshot: RuntimeEvidenceResult["candidateSnapshot"]
): MeshVertexRuntimeSnapshotSummary["drawable"] => {
  const drawable = findFixtureDrawable(snapshot);

  return {
    drawableId: drawable.drawableId,
    meshId: drawable.meshId,
    vertexCount: drawable.vertexCount,
    vertexHash: drawable.vertexHash,
    bounds: drawable.bounds,
    ...(drawable.vertices === undefined ? {} : { vertices: drawable.vertices })
  };
};

const summarizeValidationEvidence = (
  evidence: MeshVertexOperationEvidenceArtifacts
): MeshVertexValidationSummary => ({
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
});

const summarizeOperationEvidence = (
  outcome: CommitOperationOutcome,
  logEntry: OperationLogEntryDto
): MeshVertexOperationEvidenceSummary => {
  if (logEntry.payload.operationType !== "moveMeshVertex") {
    throw new Error(`Expected moveMeshVertex log entry payload, got ${logEntry.payload.operationType}.`);
  }

  return {
    resultRuntimeSnapshotIds: outcome.result.generatedRuntimeSnapshotIds,
    resultValidationReportIds: outcome.result.generatedValidationReportIds,
    resultRuntimeDiffDrawableChanges: outcome.result.runtimeDiff?.drawableChanges ?? [],
    logEntryRuntimeSnapshotIds: logEntry.runtimeSnapshotIds,
    logEntryValidationReportIds: logEntry.validationReportIds,
    logEntryRuntimeDiffDrawableChanges: logEntry.result.runtimeDiff?.drawableChanges ?? [],
    logEntryPayloadVertexDeltas: logEntry.payload.payload.vertexDeltas,
    finalRuntimeStateRef: outcome.result.finalRuntimeStateRef ?? ""
  };
};

const findFixtureDrawable = (
  snapshot: RuntimeEvidenceResult["candidateSnapshot"]
) => {
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === "draw_mesh_vertex_oracle");
  if (drawable === undefined) {
    throw new Error("Runtime snapshot is missing draw_mesh_vertex_oracle.");
  }

  return drawable;
};

const expectEvidence = (
  evidence: readonly MeshVertexOperationEvidenceArtifacts[],
  operationType: MeshVertexOperationEvidenceArtifacts["operationType"]
): MeshVertexOperationEvidenceArtifacts => {
  const found = evidence.find((candidate) => candidate.operationType === operationType);
  if (found === undefined) {
    throw new Error(`Missing ${operationType} evidence.`);
  }

  return found;
};

const expectLogEntry = (outcome: CommitOperationOutcome): OperationLogEntryDto => {
  if (outcome.logEntry === undefined) {
    throw new Error("Expected committed moveMeshVertex log entry.");
  }

  return outcome.logEntry;
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

const loadBaselinePackageDocument = (): PackageDocumentDto => {
  const fixtureDirectory = join(contractFixtureRootDirectory, "minimal-valid-package");

  return PackageDocumentSchema.parse({
    manifest: readJson(join(fixtureDirectory, "manifest.json")),
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")),
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")),
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")),
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")),
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")),
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")),
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")),
      masks: readJson(join(fixtureDirectory, "model/masks.json")),
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json"))
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")),
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")),
      rights: readJson(join(fixtureDirectory, "assets/rights.json"))
    }
  });
};

const loadFixtureJson = (relativePath: string): unknown =>
  readJson(join(fixtureRootDirectory, relativePath));

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const operationCoreDirectory = dirname(fileURLToPath(import.meta.url));
const contractFixtureRootDirectory = join(operationCoreDirectory, "../../../fixtures/contracts");
const fixtureRootDirectory = join(contractFixtureRootDirectory, "mesh-vertex-runtime-evidence");
