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
  OperationEvidenceResultDto
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

describe("created-drawable-runtime-evidence contract fixture", () => {
  it("parses createDrawable and generateMesh fixture requests through operation-core DTOs", () => {
    const createRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/create-drawable-commit.request.json")
    );
    const generateRequest = OperationRequestSchema.parse(
      loadFixtureJson("request/generate-mesh-commit.request.json")
    );

    expect(createRequest).toMatchObject({
      operationType: "createDrawable",
      dryRun: false,
      payload: {
        displayName: "Runtime Oracle",
        sourceAssetId: "src_generated",
        sourceLayerId: "layer_body",
        partId: "part_root"
      }
    });
    expect(generateRequest).toMatchObject({
      operationType: "generateMesh",
      dryRun: false,
      basePackageRevision: 1,
      payload: {
        drawableId: "draw_runtime_oracle",
        method: "auto-grid-v1",
        densityHint: "low"
      }
    });
  });

  it("keeps created drawable and generated mesh visible through runtime, validation, and operation evidence", () => {
    const session = createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());
    const capturedEvidence: CreatedDrawableEvidenceArtifacts[] = [];
    const core = createOperationCore({
      now: () => new Date("2026-05-30T00:00:00.000Z"),
      evidenceProvider: (input) => collectCreatedDrawableEvidence(input, capturedEvidence)
    });

    const createOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/create-drawable-commit.request.json")
    );
    const generateOutcome = core.commitOperation(
      session,
      loadFixtureJson("request/generate-mesh-commit.request.json")
    );
    const [createEvidence, generateEvidence] = capturedEvidence;

    if (createEvidence === undefined || generateEvidence === undefined) {
      throw new Error("Expected createDrawable and generateMesh evidence artifacts.");
    }

    assertMaterializedRuntimeArtifactsParse(createEvidence.runtimeArtifacts);
    assertMaterializedRuntimeArtifactsParse(generateEvidence.runtimeArtifacts);
    assertMaterializedValidationArtifactsParse(createEvidence.validationArtifacts);
    assertMaterializedValidationArtifactsParse(generateEvidence.validationArtifacts);

    expect(findCreatedDrawableInCandidateSnapshotArtifact(createEvidence)).toMatchObject({
      drawableId: "draw_runtime_oracle",
      meshId: "mesh_runtime_oracle",
      vertexCount: 0
    });
    expect(findCreatedDrawableInCandidateSnapshotArtifact(generateEvidence)).toMatchObject({
      drawableId: "draw_runtime_oracle",
      meshId: "mesh_runtime_oracle",
      vertexCount: 4
    });
    expect(createOutcome.result.status).toBe("committed");
    expect(generateOutcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(2);
    expect(summarizeCreatedDrawableEvidence({
      createOutcome,
      generateOutcome,
      createEvidence,
      generateEvidence
    })).toEqual(loadFixtureJson("expected/created-drawable-runtime-evidence-summary.json"));
  });
});

interface CreatedDrawableEvidenceArtifacts {
  readonly operationType: OperationEvidenceProviderInput["request"]["operationType"];
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly runtimeArtifacts: readonly RuntimeEvidenceArtifact[];
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
  readonly validationArtifacts: readonly ValidationReportArtifact[];
}

interface CreatedDrawableRuntimeEvidenceSummary {
  readonly schemaVersion: "created-drawable-runtime-evidence-summary-v1";
  readonly createdDrawableId: string;
  readonly createdMeshId: string;
  readonly operations: readonly OperationEvidenceSummary[];
}

interface OperationEvidenceSummary {
  readonly operationType: string;
  readonly operationId: string;
  readonly resultStatus: string;
  readonly runtimeSnapshots: {
    readonly baseline: RuntimeSnapshotSummary;
    readonly candidate: RuntimeSnapshotSummary;
  };
  readonly runtimeDiff: RuntimeDiffSummary;
  readonly validation: ValidationEvidenceSummary;
  readonly operationEvidence: OperationResultEvidenceSummary;
}

interface RuntimeSnapshotSummary {
  readonly snapshotId: RuntimeSnapshotId;
  readonly packageRevision: number;
  readonly drawList: readonly string[];
  readonly createdDrawable?: DrawableSnapshotSummary;
}

interface DrawableSnapshotSummary {
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
}

interface RuntimeDiffSummary {
  readonly beforeSnapshotId: RuntimeSnapshotId;
  readonly afterSnapshotId: RuntimeSnapshotId;
  readonly drawableChanges: RuntimeDiffDto["drawableChanges"];
  readonly drawListChanges: RuntimeDiffDto["drawListChanges"];
  readonly drawListParameterChanges: RuntimeDiffDto["parameterChanges"];
}

interface ValidationEvidenceSummary {
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

interface OperationResultEvidenceSummary {
  readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly generatedRuntimeStateRefs: readonly string[];
  readonly generatedRuntimeStateSequenceRefs: readonly string[];
  readonly finalRuntimeStateRef: string;
  readonly generatedValidationReportIds: readonly ValidationReportId[];
}

const collectCreatedDrawableEvidence = (
  input: OperationEvidenceProviderInput,
  artifacts: CreatedDrawableEvidenceArtifacts[]
): OperationEvidenceResultDto => {
  if (input.request.operationType !== "createDrawable" && input.request.operationType !== "generateMesh") {
    throw new Error(`Unsupported created drawable fixture operation: ${input.request.operationType}`);
  }

  const packageHash = "sha256:created-drawable-runtime-evidence";
  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, { packageHash }),
    candidateGraph: toRuntimeGraph(input.candidateSession, { packageHash }),
    candidate: {
      frame: {
        targetIds: [...input.targetIds]
      }
    },
    context: {
      source: { surface: "validator", operationId: input.result.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: `${input.request.operationType}-runtime-evidence`
  });
  const runtimeArtifacts = materializeRuntimeEvidenceArtifacts(runtimeEvidence).artifacts;
  const baselineReport = buildRuntimeEvidenceReport({
    reportId: `val_${input.request.operationType}_baseline`,
    createdAt: "2026-05-30T00:00:00.000Z",
    packageId: runtimeEvidence.baselineSnapshot.packageId,
    packageRevision: runtimeEvidence.baselineSnapshot.packageRevision,
    packageHash,
    runtimeSnapshotIds: [runtimeEvidence.baselineSnapshot.snapshotId]
  });
  const candidateReport = buildRuntimeEvidenceReport({
    reportId: `val_${input.request.operationType}_candidate`,
    createdAt: "2026-05-30T00:00:00.000Z",
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

const summarizeCreatedDrawableEvidence = (input: {
  readonly createOutcome: CommitOperationOutcome;
  readonly generateOutcome: CommitOperationOutcome;
  readonly createEvidence: CreatedDrawableEvidenceArtifacts;
  readonly generateEvidence: CreatedDrawableEvidenceArtifacts;
}): CreatedDrawableRuntimeEvidenceSummary => ({
  schemaVersion: "created-drawable-runtime-evidence-summary-v1",
  createdDrawableId: "draw_runtime_oracle",
  createdMeshId: "mesh_runtime_oracle",
  operations: [
    summarizeOperationEvidence(input.createOutcome, input.createEvidence),
    summarizeOperationEvidence(input.generateOutcome, input.generateEvidence)
  ]
});

const summarizeOperationEvidence = (
  outcome: CommitOperationOutcome,
  evidence: CreatedDrawableEvidenceArtifacts
): OperationEvidenceSummary => ({
  operationType: evidence.operationType,
  operationId: outcome.result.operationId,
  resultStatus: outcome.result.status,
  runtimeSnapshots: {
    baseline: summarizeRuntimeSnapshot(evidence.runtimeEvidence.baselineSnapshot),
    candidate: summarizeRuntimeSnapshot(evidence.runtimeEvidence.candidateSnapshot)
  },
  runtimeDiff: {
    beforeSnapshotId: evidence.runtimeEvidence.runtimeDiff.beforeSnapshotId,
    afterSnapshotId: evidence.runtimeEvidence.runtimeDiff.afterSnapshotId,
    drawableChanges: evidence.runtimeEvidence.runtimeDiff.drawableChanges,
    drawListChanges: evidence.runtimeEvidence.runtimeDiff.drawListChanges,
    drawListParameterChanges: evidence.runtimeEvidence.runtimeDiff.parameterChanges.filter(
      (change) => change.path === "/drawList"
    )
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
    generatedRuntimeStateRefs: outcome.result.generatedRuntimeStateRefs,
    generatedRuntimeStateSequenceRefs: outcome.result.generatedRuntimeStateSequenceRefs,
    finalRuntimeStateRef: outcome.result.finalRuntimeStateRef ?? "",
    generatedValidationReportIds: outcome.result.generatedValidationReportIds
  }
});

const summarizeRuntimeSnapshot = (
  snapshot: RuntimeEvidenceResult["candidateSnapshot"]
): RuntimeSnapshotSummary => ({
  snapshotId: snapshot.snapshotId,
  packageRevision: snapshot.packageRevision,
  drawList: snapshot.drawList,
  ...summarizeCreatedDrawable(snapshot)
});

const summarizeCreatedDrawable = (
  snapshot: RuntimeEvidenceResult["candidateSnapshot"]
): { readonly createdDrawable?: DrawableSnapshotSummary } => {
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === "draw_runtime_oracle");
  if (drawable === undefined) {
    return {};
  }

  return {
    createdDrawable: {
      drawableId: drawable.drawableId,
      meshId: drawable.meshId,
      vertexCount: drawable.vertexCount,
      vertexHash: drawable.vertexHash,
      bounds: drawable.bounds
    }
  };
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

const findCreatedDrawableInCandidateSnapshotArtifact = (
  evidence: CreatedDrawableEvidenceArtifacts
) => {
  const artifact = evidence.runtimeArtifacts.find(
    (candidate) =>
      candidate.kind === "runtimeSnapshot" &&
      candidate.snapshotId === evidence.runtimeEvidence.candidateSnapshot.snapshotId
  );
  if (artifact === undefined) {
    throw new Error(`Missing candidate snapshot artifact ${evidence.runtimeEvidence.candidateSnapshot.snapshotId}.`);
  }

  const snapshot = RuntimeSnapshotSchema.parse(JSON.parse(artifact.content));
  const drawable = snapshot.drawables.find((candidate) => candidate.drawableId === "draw_runtime_oracle");
  if (drawable === undefined) {
    throw new Error("Candidate runtime snapshot artifact is missing draw_runtime_oracle.");
  }

  return drawable;
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
const fixtureRootDirectory = join(contractFixtureRootDirectory, "created-drawable-runtime-evidence");
