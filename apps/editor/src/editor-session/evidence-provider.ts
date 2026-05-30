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
      const capture = collectEditorOperationEvidence(input, options);
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

const collectEditorOperationEvidence = (
  input: OperationEvidenceProviderInput,
  options: EditorEvidenceCollectorOptions
): EditorOperationEvidenceCapture => {
  const evidenceInput = createRuntimeEvidenceInput(input);

  const runtimeEvidence = buildRuntimeEvidence({
    baselineGraph: toRuntimeGraph(input.baselineSession, {
      packageHash: options.packageHash
    }),
    candidateGraph: toRuntimeGraph(input.candidateSession, {
      packageHash: options.packageHash
    }),
    ...(evidenceInput.baseline === undefined ? {} : { baseline: evidenceInput.baseline }),
    candidate: {
      frame: {
        authoredParameterValues: evidenceInput.authoredParameterValues,
        targetIds: evidenceInput.targetIds
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
    artifactLabel: evidenceInput.artifactLabel
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

interface RuntimeEvidenceInput {
  readonly artifactLabel: string;
  readonly authoredParameterValues: Record<string, number>;
  readonly targetIds: string[];
  readonly baseline?: {
    readonly frame: {
      readonly authoredParameterValues: Record<string, number>;
      readonly targetIds: string[];
    };
  };
}

const createRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  switch (input.request.operationType) {
    case "importSplitPngSourceAsset":
      return createImportSplitPngSourceAssetEvidenceInput(input);
    case "createDrawable":
      return createDrawableRuntimeEvidenceInput(input);
    case "generateMesh":
      return createGenerateMeshRuntimeEvidenceInput(input);
    case "createParameter":
      return createParameterRuntimeEvidenceInput(input);
    case "addKeyform":
      return createAddKeyformRuntimeEvidenceInput(input);
    case "addKeyformGrid2d":
      return createAddKeyformGrid2dRuntimeEvidenceInput(input);
    case "setRuntimeVisibility":
      return createSetRuntimeVisibilityEvidenceInput(input);
    case "setDrawOrder":
      return createSetDrawOrderEvidenceInput(input);
    case "moveMeshVertex":
      return createMoveMeshVertexEvidenceInput(input);
    case "setRightsMetadata":
      return createSetRightsMetadataEvidenceInput(input);
    default:
      throw new Error(`Editor session evidence does not support ${input.request.operationType}.`);
  }
};

const createImportSplitPngSourceAssetEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "importSplitPngSourceAsset") {
    throw new Error(`importSplitPngSourceAsset evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...(input.request.payload.sourceAssetId === undefined ? [] : [input.request.payload.sourceAssetId]),
    ...input.request.payload.layers.map((layer) => layer.sourceLayerId)
  ]);

  return {
    artifactLabel: "editor-import-split-png-source",
    authoredParameterValues: {},
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: {},
        targetIds
      }
    }
  };
};

const createDrawableRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "createDrawable") {
    throw new Error(`createDrawable evidence input received ${input.request.operationType}.`);
  }

  const drawableId = input.targetIds[0];
  const meshId = input.targetIds[1];
  if (drawableId === undefined || meshId === undefined) {
    throw new Error("createDrawable evidence requires committed drawable and mesh targets.");
  }

  return {
    artifactLabel: "editor-create-drawable",
    authoredParameterValues: {},
    targetIds: [drawableId, meshId]
  };
};

const createGenerateMeshRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "generateMesh") {
    throw new Error(`generateMesh evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([...input.targetIds, input.request.payload.drawableId]);

  return {
    artifactLabel: "editor-generate-mesh",
    authoredParameterValues: {},
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: {},
        targetIds
      }
    }
  };
};

const createParameterRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "createParameter") {
    throw new Error(`createParameter evidence input received ${input.request.operationType}.`);
  }

  const parameterId = input.targetIds[0];
  if (parameterId === undefined) {
    throw new Error("createParameter evidence requires a committed target parameter.");
  }

  return {
    artifactLabel: "editor-create-parameter",
    authoredParameterValues: {
      [parameterId]: input.request.payload.max
    },
    targetIds: [parameterId]
  };
};

const createAddKeyformRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "addKeyform") {
    throw new Error(`addKeyform evidence input received ${input.request.operationType}.`);
  }

  const authoredParameterValues = {
    [input.request.payload.parameterId]: input.request.payload.keyValue
  };
  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.target.id,
    input.request.payload.parameterId
  ]);

  return {
    artifactLabel: "editor-add-keyform",
    authoredParameterValues,
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues,
        targetIds
      }
    }
  };
};

const createAddKeyformGrid2dRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "addKeyformGrid2d") {
    throw new Error(`addKeyformGrid2d evidence input received ${input.request.operationType}.`);
  }

  const firstKey = input.request.payload.keys[0];
  if (firstKey === undefined) {
    throw new Error("addKeyformGrid2d evidence requires at least one grid key.");
  }

  const authoredParameterValues = {
    [input.request.payload.parameterX]: firstKey.x,
    [input.request.payload.parameterY]: firstKey.y
  };
  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.target.id,
    input.request.payload.parameterX,
    input.request.payload.parameterY
  ]);

  return {
    artifactLabel: "editor-add-keyform-grid2d",
    authoredParameterValues,
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues,
        targetIds
      }
    }
  };
};

const createSetRuntimeVisibilityEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "setRuntimeVisibility") {
    throw new Error(`setRuntimeVisibility evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([...input.targetIds, input.request.payload.target.id]);

  return {
    artifactLabel: "editor-set-runtime-visibility",
    authoredParameterValues: {},
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: {},
        targetIds
      }
    }
  };
};

const createSetDrawOrderEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "setDrawOrder") {
    throw new Error(`setDrawOrder evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...input.request.payload.entries.map((entry) => entry.drawableId)
  ]);

  return {
    artifactLabel: "editor-set-draw-order",
    authoredParameterValues: {},
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: {},
        targetIds
      }
    }
  };
};

const createMoveMeshVertexEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "moveMeshVertex") {
    throw new Error(`moveMeshVertex evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.meshId,
    ...input.request.payload.vertexDeltas.map((vertexDelta) => vertexDelta.vertexId)
  ]);

  return {
    artifactLabel: "editor-move-mesh-vertex",
    authoredParameterValues: {},
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: {},
        targetIds
      }
    }
  };
};

const createSetRightsMetadataEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "setRightsMetadata") {
    throw new Error(`setRightsMetadata evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([...input.targetIds, input.request.payload.assetId]);

  return {
    artifactLabel: "editor-set-rights-metadata",
    authoredParameterValues: {},
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: {},
        targetIds
      }
    }
  };
};

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
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
