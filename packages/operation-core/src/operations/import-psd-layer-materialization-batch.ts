import {
  cloneAuthoringSession,
  createDryRunAuthoringSession,
  getDrawableById,
  getMeshById,
  getPartById,
  getTextureAtlasEntryById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  PartId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import { OperationIdSchema } from "@private-2d-rigging-lab/contracts";

import {
  createDrawableIdFromDisplayName,
  createMeshIdFromDrawableId,
  createPartIdFromDisplayName,
  createTextureIdFromDrawableId
} from "../operation-ids.js";
import { OperationRequestSchema, type OperationRequestDto } from "../operation-request.js";
import { OperationResultSchema, type OperationResultDto } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createPsdLayerMaterializationBatchOperationEvidence,
  PSD_BATCH_SELECTED_LAYER_LIMIT,
  PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT,
  type PsdLayerMaterializationBatchEntryResultDto,
  type PsdLayerMaterializationBatchGeneratedTargetsDto
} from "../psd-layer-materialization-batch-operation-evidence.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { importPsdLayerMaterializationOperationHandler } from "./import-psd-layer-materialization.js";

type ImportPsdLayerMaterializationBatchRequest = Extract<
  OperationRequestDto,
  { operationType: "importPsdLayerMaterializationBatch" }
>;

type ImportPsdLayerMaterializationRequest = Extract<
  OperationRequestDto,
  { operationType: "importPsdLayerMaterialization" }
>;

interface PlannedBatchEntry {
  readonly selectedIndex: number;
  readonly operationId: OperationId;
  readonly sourceLayerKey: string;
  readonly generated: PsdLayerMaterializationBatchGeneratedTargetsDto;
  readonly request: ImportPsdLayerMaterializationRequest;
}

interface IndexedDiagnostics {
  readonly globalDiagnostics: readonly DiagnosticDto[];
  readonly entryDiagnostics: ReadonlyMap<number, readonly DiagnosticDto[]>;
}

export const importPsdLayerMaterializationBatchOperationHandler: OperationHandler = {
  operationType: "importPsdLayerMaterializationBatch",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyImportPsdLayerMaterializationBatch(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    const candidateSession = cloneAuthoringSession(session);
    const applied = applyImportPsdLayerMaterializationBatch(
      candidateSession,
      request,
      operationId,
      "committed"
    );

    if (applied.result.status !== "committed") {
      return {
        ...applied,
        candidateSession: session
      };
    }

    replaceAuthoringSession(session, candidateSession);

    return {
      ...applied,
      candidateSession: session
    };
  }
};

const applyImportPsdLayerMaterializationBatch = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "importPsdLayerMaterializationBatch") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.importPsdLayerMaterializationBatch.unsupportedPayload",
            message: `importPsdLayerMaterializationBatch handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const plannedEntries = request.payload.entries.map((_, selectedIndex) =>
    createPlannedBatchEntry({ request, operationId, selectedIndex })
  );
  const checkedTargetRefs = createBatchCheckedTargetRefs(request, plannedEntries);
  const targetIds = createBatchTargetIds(request, operationId, plannedEntries);
  const batchDiagnostics = evaluateBatchPreconditions({
    session,
    request,
    operationId,
    plannedEntries
  });

  if (hasDiagnostics(batchDiagnostics)) {
    return {
      result: createRejectedBatchResult({
        request,
        operationId,
        checkedTargetRefs,
        plannedEntries,
        diagnostics: batchDiagnostics
      }),
      targetIds,
      candidateSession: session
    };
  }

  const mutationSession = cloneAuthoringSession(session);
  const childOutcomes = plannedEntries.map((entry) =>
    importPsdLayerMaterializationOperationHandler.commit(
      mutationSession,
      entry.request,
      entry.operationId
    )
  );
  const childDiagnostics = collectChildDiagnostics(childOutcomes);

  if (hasDiagnostics(childDiagnostics)) {
    return {
      result: createRejectedBatchResult({
        request,
        operationId,
        checkedTargetRefs,
        plannedEntries,
        diagnostics: childDiagnostics
      }),
      targetIds,
      candidateSession: session
    };
  }

  replaceAuthoringSession(session, mutationSession);

  return {
    result: createCommittedBatchResult({
      request,
      operationId,
      status,
      checkedTargetRefs,
      baseRevision,
      finalRevision: mutationSession.authoringRevision,
      plannedEntries,
      childOutcomes
    }),
    targetIds,
    candidateSession: session
  };
};

const createPlannedBatchEntry = (input: {
  readonly request: ImportPsdLayerMaterializationBatchRequest;
  readonly operationId: OperationId;
  readonly selectedIndex: number;
}): PlannedBatchEntry => {
  const entry = input.request.payload.entries[input.selectedIndex];
  if (entry === undefined) {
    throw new Error(`Missing batch entry ${input.selectedIndex}.`);
  }

  const generated = createGeneratedTargets(entry.materialization.sourceLayerRef);
  const operationId = createChildOperationId(input.operationId, input.selectedIndex, generated.partId);
  const request = OperationRequestSchema.parse({
    schemaVersion: input.request.schemaVersion,
    operationId,
    actor: input.request.actor,
    surface: input.request.surface,
    dryRun: false,
    basePackageRevision: input.request.basePackageRevision,
    idempotencyKey: `${input.request.idempotencyKey ?? input.request.payload.batchId}:${input.selectedIndex}`,
    trace: input.request.trace,
    operationType: "importPsdLayerMaterialization",
    payload: {
      sourceAssetId: input.request.payload.sourceAssetId,
      materialization: entry.materialization,
      textureId: generated.textureId,
      drawableId: generated.drawableId,
      meshId: generated.meshId,
      drawableDisplayName: generated.drawableDisplayName,
      destinationPart: {
        destinationKind: "newPart",
        partId: generated.partId,
        displayName: generated.partDisplayName,
        parentPartId: input.request.payload.destination.parentPartId
      },
      ...(entry.initialBounds === undefined ? {} : { initialBounds: entry.initialBounds }),
      lockedTargetIds: input.request.payload.lockedTargetIds
    }
  });

  if (request.operationType !== "importPsdLayerMaterialization") {
    throw new Error("Expected single-layer materialization request.");
  }

  return {
    selectedIndex: input.selectedIndex,
    operationId,
    sourceLayerKey: createSourceLayerKey(entry.materialization.sourceLayerRef),
    generated,
    request
  };
};

const createGeneratedTargets = (
  sourceLayerRef: ImportPsdLayerMaterializationRequest["payload"]["materialization"]["sourceLayerRef"]
): PsdLayerMaterializationBatchGeneratedTargetsDto => {
  const displayName = createLayerPathDisplayName(sourceLayerRef);
  const drawableId = createDrawableIdFromDisplayName(displayName);

  return {
    partId: createPartIdFromDisplayName(displayName),
    partDisplayName: displayName,
    drawableId,
    drawableDisplayName: displayName,
    textureId: createTextureIdFromDrawableId(drawableId),
    meshId: createMeshIdFromDrawableId(drawableId)
  };
};

const createLayerPathDisplayName = (
  sourceLayerRef: ImportPsdLayerMaterializationRequest["payload"]["materialization"]["sourceLayerRef"]
): string => {
  const path = sourceLayerRef.sourceLayerPath?.filter((segment) => segment.trim().length > 0) ?? [];
  if (path.length > 0) {
    return path.join(" / ");
  }

  return sourceLayerRef.sourceLayerName ?? sourceLayerRef.sourceLayerId;
};

const evaluateBatchPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: ImportPsdLayerMaterializationBatchRequest;
  readonly operationId: OperationId;
  readonly plannedEntries: readonly PlannedBatchEntry[];
}): IndexedDiagnostics => {
  const globalDiagnostics: DiagnosticDto[] = [];
  const entryDiagnostics = new Map<number, DiagnosticDto[]>();

  if (input.request.payload.entries.length > PSD_BATCH_SELECTED_LAYER_LIMIT) {
    globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.layerCountCapExceeded",
        message: `PSD selected layer batch accepts at most ${PSD_BATCH_SELECTED_LAYER_LIMIT} entries; received ${input.request.payload.entries.length}.`,
        path: "/payload/entries"
      })
    );
  }

  const totalByteLength = input.request.payload.entries.reduce(
    (sum, entry) => sum + entry.materialization.byteLength,
    0
  );
  if (totalByteLength > PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT) {
    globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.totalByteLengthCapExceeded",
        message: `PSD selected layer batch raw RGBA bytes exceed ${PSD_BATCH_TOTAL_RAW_RGBA_BYTE_LIMIT}; received ${totalByteLength}.`,
        path: "/payload/entries"
      })
    );
  }

  if (getPartById(input.session.graph, input.request.payload.destination.parentPartId) === undefined) {
    globalDiagnostics.push(
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.missingDestinationParentPart",
        message: `Destination parent part does not exist: ${input.request.payload.destination.parentPartId}.`,
        path: "/payload/destination/parentPartId"
      })
    );
  }

  addDuplicateLayerRefDiagnostics({
    operationId: input.operationId,
    plannedEntries: input.plannedEntries,
    entryDiagnostics
  });
  addGeneratedIdCollisionDiagnostics({
    session: input.session,
    operationId: input.operationId,
    plannedEntries: input.plannedEntries,
    entryDiagnostics
  });
  addGeneratedNameCollisionDiagnostics({
    session: input.session,
    operationId: input.operationId,
    parentPartId: input.request.payload.destination.parentPartId,
    plannedEntries: input.plannedEntries,
    entryDiagnostics
  });

  return { globalDiagnostics, entryDiagnostics };
};

const addDuplicateLayerRefDiagnostics = (input: {
  readonly operationId: OperationId;
  readonly plannedEntries: readonly PlannedBatchEntry[];
  readonly entryDiagnostics: Map<number, DiagnosticDto[]>;
}): void => {
  const firstByLayerRef = new Map<string, number>();

  for (const entry of input.plannedEntries) {
    const firstIndex = firstByLayerRef.get(entry.sourceLayerKey);
    if (firstIndex === undefined) {
      firstByLayerRef.set(entry.sourceLayerKey, entry.selectedIndex);
      continue;
    }

    addEntryDiagnostic(
      input.entryDiagnostics,
      entry.selectedIndex,
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.duplicateLayerRef",
        message: `Duplicate PSD source layer ref ${entry.sourceLayerKey}; first selected at entry ${firstIndex}.`,
        path: `/payload/entries/${entry.selectedIndex}/materialization/sourceLayerRef`
      })
    );
  }
};

const addGeneratedIdCollisionDiagnostics = (input: {
  readonly session: AuthoringSession;
  readonly operationId: OperationId;
  readonly plannedEntries: readonly PlannedBatchEntry[];
  readonly entryDiagnostics: Map<number, DiagnosticDto[]>;
}): void => {
  const firstByGeneratedId = new Map<string, number>();

  for (const entry of input.plannedEntries) {
    for (const target of createGeneratedTargetRefs(entry.generated)) {
      const key = `${target.kind}:${target.id}`;
      const firstIndex = firstByGeneratedId.get(key);
      if (firstIndex !== undefined) {
        addEntryDiagnostic(
          input.entryDiagnostics,
          entry.selectedIndex,
          createBatchDiagnostic({
            operationId: input.operationId,
            checkId: "operation.importPsdLayerMaterializationBatch.duplicateGeneratedId",
            message: `Generated ${target.kind} id ${target.id} collides with entry ${firstIndex}.`,
            path: `/payload/entries/${entry.selectedIndex}`
          })
        );
        continue;
      }

      firstByGeneratedId.set(key, entry.selectedIndex);
    }

    addExistingGeneratedIdCollisionDiagnostics(input.session, input.operationId, entry, input.entryDiagnostics);
  }
};

const addExistingGeneratedIdCollisionDiagnostics = (
  session: AuthoringSession,
  operationId: OperationId,
  entry: PlannedBatchEntry,
  entryDiagnostics: Map<number, DiagnosticDto[]>
): void => {
  const collisions: ReadonlyArray<readonly ["part" | "drawable" | "mesh" | "texture", string, boolean]> = [
    ["part", entry.generated.partId, getPartById(session.graph, entry.generated.partId) !== undefined],
    [
      "drawable",
      entry.generated.drawableId,
      getDrawableById(session.graph, entry.generated.drawableId) !== undefined
    ],
    ["mesh", entry.generated.meshId, getMeshById(session.graph, entry.generated.meshId) !== undefined],
    [
      "texture",
      entry.generated.textureId,
      getTextureAtlasEntryById(session.graph, entry.generated.textureId) !== undefined
    ]
  ];

  for (const [kind, id, collides] of collisions) {
    if (!collides) {
      continue;
    }

    addEntryDiagnostic(
      entryDiagnostics,
      entry.selectedIndex,
      createBatchDiagnostic({
        operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.idNameCollision",
        message: `Generated ${kind} id already exists: ${id}.`,
        path: `/payload/entries/${entry.selectedIndex}`
      })
    );
  }
};

const addGeneratedNameCollisionDiagnostics = (input: {
  readonly session: AuthoringSession;
  readonly operationId: OperationId;
  readonly parentPartId: PartId;
  readonly plannedEntries: readonly PlannedBatchEntry[];
  readonly entryDiagnostics: Map<number, DiagnosticDto[]>;
}): void => {
  const firstPartName = new Map<string, number>();
  const firstDrawableName = new Map<string, number>();
  const existingSiblingPartNames = getSiblingPartDisplayNames(input.session, input.parentPartId);
  const existingDrawableNames = new Set(
    input.session.graph.drawables.map((drawable) => normalizeDisplayName(drawable.displayName))
  );

  for (const entry of input.plannedEntries) {
    addNameCollisionDiagnostic({
      operationId: input.operationId,
      entryDiagnostics: input.entryDiagnostics,
      selectedIndex: entry.selectedIndex,
      nameKind: "part",
      displayName: entry.generated.partDisplayName,
      firstByName: firstPartName,
      existingNames: existingSiblingPartNames
    });
    addNameCollisionDiagnostic({
      operationId: input.operationId,
      entryDiagnostics: input.entryDiagnostics,
      selectedIndex: entry.selectedIndex,
      nameKind: "drawable",
      displayName: entry.generated.drawableDisplayName,
      firstByName: firstDrawableName,
      existingNames: existingDrawableNames
    });
  }
};

const addNameCollisionDiagnostic = (input: {
  readonly operationId: OperationId;
  readonly entryDiagnostics: Map<number, DiagnosticDto[]>;
  readonly selectedIndex: number;
  readonly nameKind: "part" | "drawable";
  readonly displayName: string;
  readonly firstByName: Map<string, number>;
  readonly existingNames: ReadonlySet<string>;
}): void => {
  const normalized = normalizeDisplayName(input.displayName);
  const firstIndex = input.firstByName.get(normalized);
  if (firstIndex !== undefined) {
    addEntryDiagnostic(
      input.entryDiagnostics,
      input.selectedIndex,
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.idNameCollision",
        message: `Generated ${input.nameKind} display name ${input.displayName} collides with entry ${firstIndex}.`,
        path: `/payload/entries/${input.selectedIndex}`
      })
    );
    return;
  }

  input.firstByName.set(normalized, input.selectedIndex);

  if (input.existingNames.has(normalized)) {
    addEntryDiagnostic(
      input.entryDiagnostics,
      input.selectedIndex,
      createBatchDiagnostic({
        operationId: input.operationId,
        checkId: "operation.importPsdLayerMaterializationBatch.idNameCollision",
        message: `Generated ${input.nameKind} display name already exists: ${input.displayName}.`,
        path: `/payload/entries/${input.selectedIndex}`
      })
    );
  }
};

const collectChildDiagnostics = (
  childOutcomes: readonly OperationApplyOutcome[]
): IndexedDiagnostics => {
  const entryDiagnostics = new Map<number, DiagnosticDto[]>();

  childOutcomes.forEach((outcome, selectedIndex) => {
    if (outcome.result.status === "committed") {
      return;
    }

    entryDiagnostics.set(selectedIndex, outcome.result.diagnostics);
  });

  return {
    globalDiagnostics: [],
    entryDiagnostics
  };
};

const createCommittedBatchResult = (input: {
  readonly request: ImportPsdLayerMaterializationBatchRequest;
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly checkedTargetRefs: readonly TargetRefDto[];
  readonly baseRevision: number;
  readonly finalRevision: number;
  readonly plannedEntries: readonly PlannedBatchEntry[];
  readonly childOutcomes: readonly OperationApplyOutcome[];
}): OperationResultDto => {
  const childEvidence = input.childOutcomes.flatMap(
    (outcome) => outcome.result.psdLayerMaterializationEvidence ?? []
  );
  const evidence = createPsdLayerMaterializationBatchOperationEvidence({
    schemaVersion: "psd-layer-materialization-batch-operation-evidence-v1",
    operationType: "importPsdLayerMaterializationBatch",
    batchId: input.request.payload.batchId,
    sourceAssetId: input.request.payload.sourceAssetId,
    destination: input.request.payload.destination,
    aggregateStatus: "success",
    selectedLayerCount: input.plannedEntries.length,
    successCount: input.plannedEntries.length,
    failureCount: 0,
    totalMaterializedByteLength: getTotalMaterializedByteLength(input.request),
    entries: input.plannedEntries.map((entry) => createEvidenceEntry(entry, "success", [])),
    perLayerOperationIds: input.plannedEntries.map((entry) => entry.operationId)
  });

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.checkedTargetRefs),
    modelDiff: combineModelDiffs({
      operationId: input.operationId,
      baseRevision: input.baseRevision,
      finalRevision: input.finalRevision,
      childOutcomes: input.childOutcomes
    }),
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    psdLayerMaterializationEvidence: childEvidence,
    psdLayerMaterializationBatchEvidence: [evidence],
    reversible: true
  });
};

const createRejectedBatchResult = (input: {
  readonly request: ImportPsdLayerMaterializationBatchRequest;
  readonly operationId: OperationId;
  readonly checkedTargetRefs: readonly TargetRefDto[];
  readonly plannedEntries: readonly PlannedBatchEntry[];
  readonly diagnostics: IndexedDiagnostics;
}): OperationResultDto => {
  const diagnostics = flattenDiagnostics(input.diagnostics);
  const hasGlobalBlock = input.diagnostics.globalDiagnostics.length > 0;
  const entries = input.plannedEntries.map((entry) => {
    const entryDiagnostics = input.diagnostics.entryDiagnostics.get(entry.selectedIndex) ?? [];
    return createEvidenceEntry(
      entry,
      hasGlobalBlock || entryDiagnostics.length > 0 ? "preflightBlocked" : "preflightReady",
      entryDiagnostics
    );
  });
  const failureCount = entries.filter((entry) => entry.status === "preflightBlocked").length;
  const evidence = createPsdLayerMaterializationBatchOperationEvidence({
    schemaVersion: "psd-layer-materialization-batch-operation-evidence-v1",
    operationType: "importPsdLayerMaterializationBatch",
    batchId: input.request.payload.batchId,
    sourceAssetId: input.request.payload.sourceAssetId,
    destination: input.request.payload.destination,
    aggregateStatus: "preflightBlocked",
    selectedLayerCount: input.plannedEntries.length,
    successCount: 0,
    failureCount,
    totalMaterializedByteLength: getTotalMaterializedByteLength(input.request),
    entries,
    perLayerOperationIds: []
  });

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: "rejected",
    precondition: createPreconditionResult(diagnostics, input.checkedTargetRefs),
    diagnostics,
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    psdLayerMaterializationBatchEvidence: [evidence],
    reversible: false
  });
};

const createEvidenceEntry = (
  entry: PlannedBatchEntry,
  status: PsdLayerMaterializationBatchEntryResultDto["status"],
  diagnostics: readonly DiagnosticDto[]
): PsdLayerMaterializationBatchEntryResultDto => ({
  selectedIndex: entry.selectedIndex,
  sourceLayerRef: entry.request.payload.materialization.sourceLayerRef,
  materializationId: entry.request.payload.materialization.materializationId,
  materializedByteLength: entry.request.payload.materialization.byteLength,
  status,
  generated: entry.generated,
  operationId: entry.operationId,
  diagnostics: [...diagnostics]
});

const combineModelDiffs = (input: {
  readonly operationId: OperationId;
  readonly baseRevision: number;
  readonly finalRevision: number;
  readonly childOutcomes: readonly OperationApplyOutcome[];
}): ModelDiffDto => {
  const childDiffs = input.childOutcomes.flatMap((outcome) =>
    outcome.result.modelDiff === undefined ? [] : [outcome.result.modelDiff]
  );

  return {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.finalRevision,
    added: [...uniqueTargetRefs(childDiffs.flatMap((diff) => diff.added))],
    removed: [...uniqueTargetRefs(childDiffs.flatMap((diff) => diff.removed))],
    changed: childDiffs.flatMap((diff) => diff.changed),
    operationIds: [input.operationId, ...input.childOutcomes.map((outcome) => outcome.result.operationId)]
  };
};

const createBatchCheckedTargetRefs = (
  request: ImportPsdLayerMaterializationBatchRequest,
  plannedEntries: readonly PlannedBatchEntry[]
): readonly TargetRefDto[] =>
  uniqueTargetRefs([
    { kind: "sourceAsset", id: request.payload.sourceAssetId },
    { kind: "part", id: request.payload.destination.parentPartId },
    ...plannedEntries.flatMap((entry) => createGeneratedTargetRefs(entry.generated))
  ]);

const createGeneratedTargetRefs = (
  generated: PsdLayerMaterializationBatchGeneratedTargetsDto
): readonly TargetRefDto[] => [
  { kind: "part", id: generated.partId },
  { kind: "drawable", id: generated.drawableId },
  { kind: "mesh", id: generated.meshId },
  { kind: "texture", id: generated.textureId }
];

const createBatchTargetIds = (
  request: ImportPsdLayerMaterializationBatchRequest,
  operationId: OperationId,
  plannedEntries: readonly PlannedBatchEntry[]
): readonly string[] =>
  uniqueStrings([
    operationId,
    request.payload.batchId,
    request.payload.sourceAssetId,
    request.payload.destination.parentPartId,
    ...plannedEntries.flatMap((entry) => [
      entry.operationId,
      entry.sourceLayerKey,
      entry.request.payload.materialization.materializationId,
      entry.request.payload.materialization.binaryAssetRef?.binaryAssetId,
      entry.generated.partId,
      entry.generated.drawableId,
      entry.generated.meshId,
      entry.generated.textureId
    ].filter((value): value is string => value !== undefined))
  ]);

const createChildOperationId = (
  operationId: OperationId,
  selectedIndex: number,
  partId: PartId
): OperationId =>
  OperationIdSchema.parse(
    `op_${sanitizeIdToken(`${stripIdPrefix(operationId, "op_")}_${selectedIndex}_${stripIdPrefix(partId, "part_")}`)}`
  );

const createSourceLayerKey = (
  sourceLayerRef: ImportPsdLayerMaterializationRequest["payload"]["materialization"]["sourceLayerRef"]
): string => `${sourceLayerRef.sourceAssetId}:${sourceLayerRef.sourceLayerId}`;

const getSiblingPartDisplayNames = (
  session: AuthoringSession,
  parentPartId: PartId
): ReadonlySet<string> => {
  const parentPart = getPartById(session.graph, parentPartId);
  const childPartIds = new Set(parentPart?.childPartIds ?? []);

  return new Set(
    session.graph.parts
      .filter((part) => part.parentPartId === parentPartId || childPartIds.has(part.partId))
      .map((part) => normalizeDisplayName(part.displayName))
  );
};

const createBatchDiagnostic = (input: {
  readonly operationId: OperationId;
  readonly checkId: string;
  readonly message: string;
  readonly path: string;
}): DiagnosticDto =>
  createOperationDiagnostic({
    checkId: input.checkId,
    message: input.message,
    target: {
      kind: "operation",
      id: input.operationId,
      path: input.path
    }
  });

const addEntryDiagnostic = (
  entryDiagnostics: Map<number, DiagnosticDto[]>,
  selectedIndex: number,
  diagnostic: DiagnosticDto
): void => {
  const diagnostics = entryDiagnostics.get(selectedIndex) ?? [];
  entryDiagnostics.set(selectedIndex, [...diagnostics, diagnostic]);
};

const hasDiagnostics = (diagnostics: IndexedDiagnostics): boolean =>
  diagnostics.globalDiagnostics.length > 0 || diagnostics.entryDiagnostics.size > 0;

const flattenDiagnostics = (diagnostics: IndexedDiagnostics): readonly DiagnosticDto[] => [
  ...diagnostics.globalDiagnostics,
  ...[...diagnostics.entryDiagnostics.values()].flat()
];

const getTotalMaterializedByteLength = (
  request: ImportPsdLayerMaterializationBatchRequest
): number => request.payload.entries.reduce((sum, entry) => sum + entry.materialization.byteLength, 0);

const replaceAuthoringSession = (
  target: AuthoringSession,
  source: AuthoringSession
): void => {
  target.packageIdentity = source.packageIdentity;
  target.packageRevision = source.packageRevision;
  target.authoringRevision = source.authoringRevision;
  target.dirty = source.dirty;
  target.graph = source.graph;

  if (source.binaryAssets === undefined) {
    delete target.binaryAssets;
  } else {
    target.binaryAssets = source.binaryAssets;
  }
};

const uniqueTargetRefs = (refs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];

  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}:${ref.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(ref);
  }

  return unique;
};

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)];

const normalizeDisplayName = (value: string): string => value.trim().toLocaleLowerCase();

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : sanitizeIdToken(id);

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};
