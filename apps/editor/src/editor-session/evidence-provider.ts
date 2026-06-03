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
    case "importPsdSourceAsset":
      return createImportPsdSourceAssetEvidenceInput(input);
    case "importSplitPngSourceAsset":
      return createImportSplitPngSourceAssetEvidenceInput(input);
    case "createDrawable":
      return createDrawableRuntimeEvidenceInput(input);
    case "createPart":
      return createPartRuntimeEvidenceInput(input);
    case "updatePart":
      return createUpdatePartRuntimeEvidenceInput(input);
    case "deletePart":
      return createDeletePartRuntimeEvidenceInput(input);
    case "setDrawablePart":
      return createSetDrawablePartRuntimeEvidenceInput(input);
    case "setDrawableTexture":
      return createSetDrawableTextureRuntimeEvidenceInput(input);
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
    case "addMeshVertex":
    case "removeMeshVertex":
    case "addMeshTriangle":
    case "removeMeshTriangle":
    case "moveMeshUvPoint":
      return createMeshTopologyEvidenceInput(input);
    case "createDynamicsGroup":
      return createCreateDynamicsGroupEvidenceInput(input);
    case "updateDynamicsGroup":
      return createUpdateDynamicsGroupEvidenceInput(input);
    case "createRotation2dRigControl":
      return createCreateRotation2dRigControlEvidenceInput(input);
    case "createWarpLattice2dRigControl":
      return createCreateWarpLattice2dRigControlEvidenceInput(input);
    case "bindRigControlChild":
      return createBindRigControlChildEvidenceInput(input);
    case "setMaskRelation":
      return createSetMaskRelationEvidenceInput(input);
    case "setRightsMetadata":
      return createSetRightsMetadataEvidenceInput(input);
    default:
      throw new Error(`Editor session evidence does not support ${input.request.operationType}.`);
  }
};

const createImportPsdSourceAssetEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "importPsdSourceAsset") {
    throw new Error(`importPsdSourceAsset evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...(input.request.payload.sourceAssetId === undefined ? [] : [input.request.payload.sourceAssetId]),
    ...(input.request.payload.adapterResult?.sourceGroups.map((group) => group.sourceGroupId) ?? []),
    ...(input.request.payload.adapterResult?.sourceLayers.map((layer) => layer.sourceLayerId) ?? []),
    ...collectCandidatePsdProfileEvidenceTargetIds(input)
  ]);

  return {
    artifactLabel: "editor-import-psd-source-profile",
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

const collectCandidatePsdProfileEvidenceTargetIds = (
  input: OperationEvidenceProviderInput
): readonly string[] => {
  if (input.request.operationType !== "importPsdSourceAsset") {
    return [];
  }

  const sourceAsset = findCandidatePsdSourceAsset(input);
  const profile = sourceAsset?.psdProfile;
  if (sourceAsset === undefined || profile === undefined) {
    return [];
  }

  return [
    `psd-profile:${sourceAsset.sourceAssetId}`,
    `psd-profile-adapter:${sanitizeEvidenceTargetToken(profile.adapter.adapterName)}`,
    `psd-profile-canvas:${formatEvidenceNumber(profile.canvas.width)}x${formatEvidenceNumber(profile.canvas.height)}`,
    ...profile.sourceGroups.map((group) => `psd-profile-group:${group.sourceGroupId}`),
    ...profile.sourceLayers.map((layer) => `psd-profile-layer:${layer.sourceLayerId}`),
    ...profile.unsupportedFeatures.map((feature) =>
      `psd-profile-unsupported:${feature.scope}:${sanitizeEvidenceTargetToken(feature.featureId)}`
    ),
    ...profile.sourceGroups.flatMap((group) =>
      group.unsupportedFeatures.map((feature) =>
        `psd-profile-group-unsupported:${group.sourceGroupId}:${sanitizeEvidenceTargetToken(feature.featureId)}`
      )
    ),
    ...profile.sourceLayers.flatMap((layer) =>
      layer.unsupportedFeatures.map((feature) =>
        `psd-profile-layer-unsupported:${layer.sourceLayerId}:${sanitizeEvidenceTargetToken(feature.featureId)}`
      )
    ),
    ...profile.diagnostics.map((diagnostic) =>
      `psd-profile-diagnostic:${sanitizeEvidenceTargetToken(diagnostic.checkId)}`
    )
  ];
};

const findCandidatePsdSourceAsset = (
  input: OperationEvidenceProviderInput
): OperationEvidenceProviderInput["candidateSession"]["graph"]["sourceAssets"][number] | undefined => {
  if (input.request.operationType !== "importPsdSourceAsset") {
    return undefined;
  }

  const payload = input.request.payload as {
    readonly sourceAssetId?: string;
    readonly fileRef: {
      readonly packageRelativePath: string;
    };
  };
  const requestedSourceAssetId = payload.sourceAssetId;
  if (requestedSourceAssetId !== undefined) {
    return input.candidateSession.graph.sourceAssets.find(
      (sourceAsset) => sourceAsset.sourceAssetId === requestedSourceAssetId
    );
  }

  return input.candidateSession.graph.sourceAssets.find(
    (sourceAsset) =>
      sourceAsset.kind === "psd-source-v1" &&
      sourceAsset.filePath === payload.fileRef.packageRelativePath
  );
};

const sanitizeEvidenceTargetToken = (value: string): string =>
  value.trim().replace(/[^A-Za-z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed";

const formatEvidenceNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));

const formatOperationArtifactToken = (value: string): string =>
  value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);

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

const createPartRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "createPart") {
    throw new Error(`createPart evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...(input.request.payload.partId === undefined ? [] : [input.request.payload.partId]),
    ...(input.request.payload.parentPartId === undefined ? [] : [input.request.payload.parentPartId])
  ]);

  return {
    artifactLabel: "editor-create-part",
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

const createUpdatePartRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "updatePart") {
    throw new Error(`updatePart evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.partId,
    ...(input.request.payload.parentPartId === undefined || input.request.payload.parentPartId === null
      ? []
      : [input.request.payload.parentPartId])
  ]);

  return {
    artifactLabel: "editor-update-part",
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

const createDeletePartRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "deletePart") {
    throw new Error(`deletePart evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.partId
  ]);

  return {
    artifactLabel: "editor-delete-part",
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

const createSetDrawablePartRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "setDrawablePart") {
    throw new Error(`setDrawablePart evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.drawableId,
    input.request.payload.partId
  ]);

  return {
    artifactLabel: "editor-set-drawable-part",
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

const createSetDrawableTextureRuntimeEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "setDrawableTexture") {
    throw new Error(`setDrawableTexture evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.drawableId,
    input.request.payload.textureId
  ]);

  return {
    artifactLabel: "editor-set-drawable-texture",
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

const createMeshTopologyEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...collectMeshTopologyRequestTargetIds(input)
  ]);

  return {
    artifactLabel: `editor-${formatOperationArtifactToken(input.request.operationType)}`,
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

const collectMeshTopologyRequestTargetIds = (
  input: OperationEvidenceProviderInput
): readonly string[] => {
  switch (input.request.operationType) {
    case "addMeshVertex":
    case "removeMeshVertex":
      return [input.request.payload.meshId, input.request.payload.vertexId];
    case "addMeshTriangle":
      return [
        input.request.payload.meshId,
        input.request.payload.triangleId,
        ...input.request.payload.vertexIds
      ];
    case "removeMeshTriangle":
      return [input.request.payload.meshId, input.request.payload.triangleId];
    case "moveMeshUvPoint":
      return [
        input.request.payload.meshId,
        ...input.request.payload.uvDeltas.map((uvDelta) => uvDelta.vertexId)
      ];
    default:
      return [];
  }
};

const createCreateDynamicsGroupEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "createDynamicsGroup") {
    throw new Error(`createDynamicsGroup evidence input received ${input.request.operationType}.`);
  }

  const driverParameterIds = input.request.payload.drivers?.map((driver) => driver.sourceParameterId) ?? [];
  const outputParameterId = input.request.payload.output?.targetParameterId;
  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...driverParameterIds,
    ...(outputParameterId === undefined ? [] : [outputParameterId])
  ]);

  return {
    artifactLabel: "editor-create-dynamics-group",
    authoredParameterValues: createRuntimeProbeParameterValues(
      input.candidateSession,
      driverParameterIds
    ),
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: createRuntimeProbeParameterValues(
          input.baselineSession,
          driverParameterIds
        ),
        targetIds
      }
    }
  };
};

const createUpdateDynamicsGroupEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "updateDynamicsGroup") {
    throw new Error(`updateDynamicsGroup evidence input received ${input.request.operationType}.`);
  }

  const payload = input.request.payload as { readonly dynamicsGroupId: string };
  const group = input.candidateSession.graph.dynamicsGroups.find(
    (candidate) => candidate.dynamicsGroupId === payload.dynamicsGroupId
  );
  const driverParameterIds = group?.drivers.map((driver) => driver.sourceParameterId) ?? [];
  const outputParameterId = group?.output.targetParameterId;
  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...driverParameterIds,
    ...(outputParameterId === undefined ? [] : [outputParameterId])
  ]);

  return {
    artifactLabel: "editor-update-dynamics-group",
    authoredParameterValues: createRuntimeProbeParameterValues(
      input.candidateSession,
      driverParameterIds
    ),
    targetIds,
    baseline: {
      frame: {
        authoredParameterValues: createRuntimeProbeParameterValues(
          input.baselineSession,
          driverParameterIds
        ),
        targetIds
      }
    }
  };
};

const createCreateRotation2dRigControlEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "createRotation2dRigControl") {
    throw new Error(`createRotation2dRigControl evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.partId,
    ...input.request.payload.childDrawableIds,
    ...input.request.payload.childRigControlIds
  ]);

  return {
    artifactLabel: "editor-create-rotation2d-rig-control",
    authoredParameterValues: {},
    targetIds
  };
};

const createCreateWarpLattice2dRigControlEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "createWarpLattice2dRigControl") {
    throw new Error(`createWarpLattice2dRigControl evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    input.request.payload.partId,
    ...input.request.payload.childDrawableIds,
    ...input.request.payload.childRigControlIds
  ]);

  return {
    artifactLabel: "editor-create-warp-lattice2d-rig-control",
    authoredParameterValues: {},
    targetIds
  };
};

const createBindRigControlChildEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "bindRigControlChild") {
    throw new Error(`bindRigControlChild evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...collectCandidateRigControlEvidenceTargetIds(input, input.request.payload.parentRigControlId),
    ...(input.request.payload.child.kind === "rigControl"
      ? collectCandidateRigControlEvidenceTargetIds(input, input.request.payload.child.id)
      : [input.request.payload.child.id])
  ]);

  return {
    artifactLabel: "editor-bind-rig-control-child",
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

const createSetMaskRelationEvidenceInput = (
  input: OperationEvidenceProviderInput
): RuntimeEvidenceInput => {
  if (input.request.operationType !== "setMaskRelation") {
    throw new Error(`setMaskRelation evidence input received ${input.request.operationType}.`);
  }

  const targetIds = uniqueStrings([
    ...input.targetIds,
    ...input.request.payload.maskDrawableIds,
    ...input.request.payload.targetDrawableIds
  ]);

  return {
    artifactLabel: "editor-set-mask-relation",
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

const collectCandidateRigControlEvidenceTargetIds = (
  input: OperationEvidenceProviderInput,
  rigControlId: string
): readonly string[] => {
  const rigControl = input.candidateSession.graph.rigControls.find(
    (candidate) => candidate.rigControlId === rigControlId
  );
  if (rigControl === undefined) {
    return [rigControlId];
  }

  return [
    rigControl.rigControlId,
    rigControl.partId,
    ...rigControl.childDrawableIds,
    ...rigControl.childRigControlIds
  ];
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

const createRuntimeProbeParameterValues = (
  session: OperationEvidenceProviderInput["candidateSession"],
  parameterIds: readonly string[]
): Record<string, number> =>
  Object.fromEntries(
    parameterIds.map((parameterId) => {
      const parameter = session.graph.parameters.find(
        (candidate) => candidate.parameterId === parameterId
      );
      const value = parameter === undefined
        ? 0
        : parameter.default === parameter.max
          ? parameter.default
          : parameter.max;
      return [parameterId, value];
    })
  );

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
