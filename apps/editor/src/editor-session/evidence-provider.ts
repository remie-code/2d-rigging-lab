import {
  toRuntimeGraph
} from "@private-2d-rigging-lab/authoring-core";
import type {
  RuntimeStateArtifactRef,
  RuntimeStateSequenceArtifactRef,
  ValidationDiffDto,
  ValidationReportId
} from "@private-2d-rigging-lab/contracts";
import {
  OperationEvidenceResultSchema,
  type OperationEvidenceProviderInput,
  type OperationEvidenceResultDto
} from "@private-2d-rigging-lab/operation-core";
import {
  buildRuntimeEvidence,
  materializeRuntimeEvidenceArtifacts,
  type RuntimeEvidenceArtifact,
  type RuntimeEvidenceResult
} from "@private-2d-rigging-lab/runtime-core";
import {
  buildRuntimeEvidenceReport,
  buildValidationDiff,
  CANONICAL_OPERATION_LOG_PATH,
  materializeValidationReportArtifact,
  type ValidationReportArtifact,
  type ValidationReportDto
} from "@private-2d-rigging-lab/validator-core";

export interface EditorOperationEvidenceCapture {
  readonly runtimeEvidence: RuntimeEvidenceResult;
  readonly runtimeArtifacts: readonly RuntimeEvidenceArtifact[];
  readonly baselineReport: ValidationReportDto;
  readonly candidateReport: ValidationReportDto;
  readonly validationDiff: ValidationDiffDto;
  readonly validationArtifacts: readonly ValidationReportArtifact[];
}

export interface EditorEvidenceCollector {
  readonly captures: readonly EditorOperationEvidenceCapture[];
  collectOperationEvidence(input: OperationEvidenceProviderInput): OperationEvidenceResultDto;
}

export interface EditorEvidenceCollectorOptions {
  readonly packageHash: string;
  readonly now?: () => Date;
}

export const createEditorEvidenceCollector = (
  options: EditorEvidenceCollectorOptions
): EditorEvidenceCollector => {
  const captures: EditorOperationEvidenceCapture[] = [];

  return {
    captures,
    collectOperationEvidence(input) {
      const capture = collectCreateParameterEvidence(input, options);
      captures.push(capture);

      return OperationEvidenceResultSchema.parse({
        runtimeDiff: capture.runtimeEvidence.runtimeDiff,
        validationDiff: capture.validationDiff,
        generatedRuntimeSnapshotIds: capture.runtimeEvidence.generatedRuntimeSnapshotIds,
        generatedRuntimeStateRefs: capture.runtimeEvidence.generatedRuntimeStateRefs,
        generatedRuntimeStateSequenceRefs: capture.runtimeEvidence.generatedRuntimeStateSequenceRefs,
        finalRuntimeState: capture.runtimeEvidence.finalRuntimeState,
        finalRuntimeStateRef: capture.runtimeEvidence.finalRuntimeStateRef,
        generatedValidationReportIds: [
          capture.baselineReport.reportId,
          capture.candidateReport.reportId
        ]
      });
    }
  };
};

export const toEvidencePackageFileEntries = (
  capture: EditorOperationEvidenceCapture
): readonly { readonly path: string; readonly text: string }[] => [
  ...capture.runtimeArtifacts.map((artifact) => ({
    path: artifact.path,
    text: artifact.content
  })),
  ...capture.validationArtifacts.map((artifact) => ({
    path: artifact.path,
    text: artifact.content
  }))
];

const collectCreateParameterEvidence = (
  input: OperationEvidenceProviderInput,
  options: EditorEvidenceCollectorOptions
): EditorOperationEvidenceCapture => {
  if (input.request.operationType !== "createParameter") {
    throw new Error(`Editor session evidence does not support ${input.request.operationType}.`);
  }

  const parameterId = input.targetIds[0];
  if (parameterId === undefined) {
    throw new Error("createParameter evidence requires a committed target parameter.");
  }

  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, {
      packageHash: options.packageHash
    }),
    candidateGraph: toRuntimeGraph(input.candidateSession, {
      packageHash: options.packageHash
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
      source: {
        surface: "validator",
        operationId: input.result.operationId
      },
      policy: {
        strictness: "strict"
      }
    },
    artifactLabel: "editor-create-parameter"
  });
  const runtimeArtifacts = materializeRuntimeEvidenceArtifacts(runtimeEvidence).artifacts;
  const createdAt = (options.now?.() ?? new Date()).toISOString();
  const reportToken = input.result.operationId.replace(/^op_/, "");
  const baselineReport = buildRuntimeEvidenceReport({
    reportId: `val_editor_${reportToken}_baseline`,
    createdAt,
    packageId: runtimeEvidence.baselineSnapshot.packageId,
    packageRevision: runtimeEvidence.baselineSnapshot.packageRevision,
    packageHash: options.packageHash,
    runtimeSnapshotIds: [runtimeEvidence.baselineSnapshot.snapshotId]
  });
  const candidateReport = buildRuntimeEvidenceReport({
    reportId: `val_editor_${reportToken}_candidate`,
    createdAt,
    packageId: runtimeEvidence.candidateSnapshot.packageId,
    packageRevision: runtimeEvidence.candidateSnapshot.packageRevision,
    packageHash: options.packageHash,
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

  return {
    runtimeEvidence,
    runtimeArtifacts,
    baselineReport,
    candidateReport,
    validationDiff,
    validationArtifacts
  };
};

export interface EditorEvidencePathSummary {
  readonly runtimeArtifactPaths: readonly string[];
  readonly validationArtifactPaths: readonly string[];
  readonly generatedRuntimeStateRefs: readonly RuntimeStateArtifactRef[];
  readonly generatedRuntimeStateSequenceRefs: readonly RuntimeStateSequenceArtifactRef[];
  readonly generatedValidationReportIds: readonly ValidationReportId[];
}

export const summarizeEvidencePaths = (
  capture: EditorOperationEvidenceCapture
): EditorEvidencePathSummary => ({
  runtimeArtifactPaths: capture.runtimeArtifacts.map((artifact) => artifact.path),
  validationArtifactPaths: capture.validationArtifacts.map((artifact) => artifact.path),
  generatedRuntimeStateRefs: capture.runtimeEvidence.generatedRuntimeStateRefs,
  generatedRuntimeStateSequenceRefs: capture.runtimeEvidence.generatedRuntimeStateSequenceRefs,
  generatedValidationReportIds: [
    capture.baselineReport.reportId,
    capture.candidateReport.reportId
  ]
});
