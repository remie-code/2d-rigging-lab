import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  getParameterById,
  toPackageDocument,
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  ParameterIdSchema,
  RuntimeStateDtoSchema,
  RuntimeStateSequenceArtifactSchema
} from "@private-2d-rigging-lab/contracts";
import type {
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
  OperationEvidenceProviderInput,
  OperationEvidenceResultDto
} from "./index.js";
import {
  PackageDocumentSchema,
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
  RuntimeEvidenceArtifact,
  RuntimeEvidenceResult
} from "../../runtime-core/src/index.js";
import {
  buildRuntimeEvidenceReport,
  buildValidationDiff,
  materializeValidationReportArtifact,
  ValidationReportSchema
} from "../../validator-core/src/index.js";
import type {
  ValidationReportArtifact,
  ValidationReportDto
} from "../../validator-core/src/index.js";

describe("minimal-operation-persisted-package contract fixture", () => {
  it("persists committed createParameter evidence through package file set reload", () => {
    const baseDocument = loadBaselinePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baseDocument);
    const capturedEvidence: PersistedEvidenceArtifacts[] = [];
    const core = createOperationCore({
      evidenceProvider: (input) => collectPersistedEvidence(input, capturedEvidence)
    });
    const request = OperationRequestSchema.parse(
      loadFixtureJson("request/create-parameter-commit.request.json")
    );
    const targetParameterId = ParameterIdSchema.parse("param_persisted_smile");

    const outcome = core.commitOperation(session, request);
    const evidence = expectSingleEvidenceArtifact(capturedEvidence);
    const savedDocument = toPackageDocument(session, baseDocument, {
      updatedAt: "2026-05-29T01:00:00.000Z"
    });
    const generatedArtifacts = toPackageFileEntries(evidence);
    const fileSet = serializePackageDocumentToFileSet(savedDocument, {
      generatedArtifacts
    });
    const reloadedDocument = parsePackageDocumentFromFileSet(fileSet);

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(getParameterById(session.graph, targetParameterId)).toBeDefined();
    expect(PackageDocumentSchema.parse(reloadedDocument)).toEqual(reloadedDocument);
    expect(reloadedDocument.manifest.packageRevision).toBe(1);
    expect(reloadedDocument.model.parameters.parameters).toHaveLength(1);
    expect(reloadedDocument.model.parameters.parameters[0]?.parameterId).toBe(targetParameterId);
    assertMaterializedRuntimeArtifactsParse(evidence.runtimeArtifacts);
    assertMaterializedValidationArtifactsParse(evidence.validationArtifacts);

    expect(summarizePackageFileSet(fileSet, generatedArtifacts)).toEqual(
      loadFixtureJson("expected/package-file-set-summary.json")
    );
    expect(summarizeRuntimeArtifacts(evidence)).toEqual(
      loadFixtureJson("expected/runtime-artifact-summary.json")
    );
    expect(summarizeValidationArtifacts(evidence)).toEqual(
      loadFixtureJson("expected/validation-artifact-summary.json")
    );
    expect(summarizeReloadedDocument(reloadedDocument)).toEqual(
      loadFixtureJson("expected/reload-summary.json")
    );
  });
});

type PackageDocumentInput = Parameters<typeof createAuthoringSessionFromPackageDocument>[0];

interface BaselineAuthoringInputFixture {
  readonly baselinePackage: {
    readonly rootRelativePath: string;
    readonly packageHash: string;
  };
}

interface PersistedEvidenceArtifacts {
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly runtimeArtifacts: readonly RuntimeEvidenceArtifact[];
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
  readonly validationArtifacts: readonly ValidationReportArtifact[];
}

interface PackageFileSetSummary {
  readonly schemaVersion: "package-file-set-summary-v1";
  readonly entryCount: number;
  readonly authoredEntryCount: number;
  readonly generatedArtifactEntryCount: number;
  readonly generatedArtifactPaths: readonly string[];
  readonly uniqueGeneratedArtifactPathCount: number;
}

interface RuntimeArtifactSummary {
  readonly schemaVersion: "runtime-artifact-summary-v1";
  readonly generatedRuntimeSnapshotIds: readonly RuntimeSnapshotId[];
  readonly generatedRuntimeStateRefs: readonly string[];
  readonly generatedRuntimeStateSequenceRefs: readonly string[];
  readonly finalRuntimeState: {
    readonly packageId: string;
    readonly packageRevision: number;
    readonly frameIndex: number;
  };
  readonly artifactKinds: readonly RuntimeEvidenceArtifact["kind"][];
  readonly artifactPaths: readonly string[];
  readonly uniqueArtifactPathCount: number;
}

interface ValidationArtifactSummary {
  readonly schemaVersion: "validation-artifact-summary-v1";
  readonly reportIds: readonly ValidationReportId[];
  readonly artifactPaths: readonly string[];
  readonly candidateReport: {
    readonly reportId: ValidationReportId;
    readonly packageRevision: number;
    readonly status: string;
    readonly highestSeverity: string;
    readonly runtimeSnapshotIds: readonly RuntimeSnapshotId[];
  };
}

interface ReloadSummary {
  readonly schemaVersion: "persisted-package-reload-summary-v1";
  readonly packageId: string;
  readonly packageRevision: number;
  readonly updatedAt: string;
  readonly parameterIds: readonly string[];
  readonly committedParameter: NonNullable<PackageDocumentDto["model"]["parameters"]["parameters"][number]>;
  readonly stableOrder: readonly string[];
}

const collectPersistedEvidence = (
  input: OperationEvidenceProviderInput,
  artifacts: PersistedEvidenceArtifacts[]
): OperationEvidenceResultDto => {
  if (input.request.operationType !== "createParameter") {
    throw new Error(`Unsupported persisted fixture operation: ${input.request.operationType}`);
  }
  const parameterId = input.request.payload.parameterId;
  if (parameterId === undefined) {
    throw new Error("Persisted operation fixture requires an explicit parameterId.");
  }

  const baseline = loadBaselineAuthoringInput();
  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, {
      packageHash: baseline.baselinePackage.packageHash
    }),
    candidateGraph: toRuntimeGraph(input.candidateSession, {
      packageHash: baseline.baselinePackage.packageHash
    }),
    candidate: {
      frame: {
        authoredParameterValues: {
          [parameterId]: input.request.payload.max
        },
        targetIds: [parameterId]
      }
    },
    context: {
      source: { surface: "validator", operationId: input.result.operationId },
      policy: { strictness: "strict" }
    },
    artifactLabel: "persisted-create-parameter"
  });
  const runtimeArtifacts = materializeRuntimeEvidenceArtifacts(runtimeEvidence).artifacts;
  const baselineReport = buildRuntimeEvidenceReport({
    reportId: "val_persisted_create_parameter_baseline",
    createdAt: "2026-05-29T00:00:00.000Z",
    packageId: runtimeEvidence.baselineSnapshot.packageId,
    packageRevision: runtimeEvidence.baselineSnapshot.packageRevision,
    packageHash: baseline.baselinePackage.packageHash,
    runtimeSnapshotIds: [runtimeEvidence.baselineSnapshot.snapshotId]
  });
  const candidateReport = buildRuntimeEvidenceReport({
    reportId: "val_persisted_create_parameter_candidate",
    createdAt: "2026-05-29T00:00:00.000Z",
    packageId: runtimeEvidence.candidateSnapshot.packageId,
    packageRevision: runtimeEvidence.candidateSnapshot.packageRevision,
    packageHash: baseline.baselinePackage.packageHash,
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

const summarizePackageFileSet = (
  fileSet: readonly PackageTextFileEntry[],
  generatedArtifacts: readonly PackageTextFileEntry[]
): PackageFileSetSummary => {
  const paths = fileSet.map((entry) => entry.path);
  const generatedArtifactPathSet = new Set(generatedArtifacts.map((entry) => entry.path));
  const generatedArtifactPaths = paths.filter((path) => generatedArtifactPathSet.has(path));

  return {
    schemaVersion: "package-file-set-summary-v1",
    entryCount: fileSet.length,
    authoredEntryCount: fileSet.length - generatedArtifacts.length,
    generatedArtifactEntryCount: generatedArtifactPaths.length,
    generatedArtifactPaths,
    uniqueGeneratedArtifactPathCount: new Set(generatedArtifactPaths).size
  };
};

const summarizeRuntimeArtifacts = (
  artifacts: PersistedEvidenceArtifacts
): RuntimeArtifactSummary => ({
  schemaVersion: "runtime-artifact-summary-v1",
  generatedRuntimeSnapshotIds: artifacts.runtimeEvidence.generatedRuntimeSnapshotIds,
  generatedRuntimeStateRefs: artifacts.runtimeEvidence.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: artifacts.runtimeEvidence.generatedRuntimeStateSequenceRefs,
  finalRuntimeState: {
    packageId: artifacts.runtimeEvidence.finalRuntimeState.packageId,
    packageRevision: artifacts.runtimeEvidence.finalRuntimeState.packageRevision,
    frameIndex: artifacts.runtimeEvidence.finalRuntimeState.frameIndex
  },
  artifactKinds: artifacts.runtimeArtifacts.map((artifact) => artifact.kind),
  artifactPaths: artifacts.runtimeArtifacts.map((artifact) => artifact.path),
  uniqueArtifactPathCount: new Set(artifacts.runtimeArtifacts.map((artifact) => artifact.path)).size
});

const summarizeValidationArtifacts = (
  artifacts: PersistedEvidenceArtifacts
): ValidationArtifactSummary => ({
  schemaVersion: "validation-artifact-summary-v1",
  reportIds: [
    artifacts.baselineReport.reportId,
    artifacts.candidateReport.reportId
  ],
  artifactPaths: artifacts.validationArtifacts.map((artifact) => artifact.path),
  candidateReport: {
    reportId: artifacts.candidateReport.reportId,
    packageRevision: artifacts.candidateReport.packageRevision,
    status: artifacts.candidateReport.summary.status,
    highestSeverity: artifacts.candidateReport.summary.highestSeverity,
    runtimeSnapshotIds: artifacts.candidateReport.evidence.runtimeSnapshotIds
  }
});

const summarizeReloadedDocument = (
  document: PackageDocumentDto
): ReloadSummary => {
  const committedParameter = document.model.parameters.parameters.find(
    (parameter) => parameter.parameterId === "param_persisted_smile"
  );
  if (committedParameter === undefined) {
    throw new Error("Reloaded persisted package is missing param_persisted_smile.");
  }

  return {
    schemaVersion: "persisted-package-reload-summary-v1",
    packageId: document.manifest.packageId,
    packageRevision: document.manifest.packageRevision,
    updatedAt: document.manifest.updatedAt,
    parameterIds: document.model.parameters.parameters.map((parameter) => parameter.parameterId),
    committedParameter,
    stableOrder: document.model.graph.stableOrder
  };
};

const toPackageFileEntries = (
  artifacts: PersistedEvidenceArtifacts
): readonly PackageTextFileEntry[] => [
  ...artifacts.runtimeArtifacts.map((artifact) => ({
    path: artifact.path,
    text: artifact.content
  })),
  ...artifacts.validationArtifacts.map((artifact) => ({
    path: artifact.path,
    text: artifact.content
  }))
];

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

const expectSingleEvidenceArtifact = (
  artifacts: readonly PersistedEvidenceArtifacts[]
): PersistedEvidenceArtifacts => {
  expect(artifacts).toHaveLength(1);
  const artifact = artifacts[0];
  if (artifact === undefined) {
    throw new Error("Expected persisted evidence artifacts to be captured.");
  }

  return artifact;
};

const loadBaselinePackageDocument = (): PackageDocumentDto => {
  const baseline = loadBaselineAuthoringInput();
  const fixtureDirectory = join(fixtureRootDirectory, baseline.baselinePackage.rootRelativePath);

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

const loadBaselineAuthoringInput = (): BaselineAuthoringInputFixture =>
  loadFixtureJson("baseline-authoring-input.json") as BaselineAuthoringInputFixture;

const loadFixtureJson = (relativePath: string): unknown =>
  readJson(join(fixtureRootDirectory, relativePath));

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/minimal-operation-persisted-package"
);
