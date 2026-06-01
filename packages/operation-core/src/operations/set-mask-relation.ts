import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  getDrawableById,
  setMaskRelation
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession, MaskRelationMutationResult } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
  JsonValue,
  MaskRelationId,
  ModelDiffDto,
  OperationId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import { createMaskRelationIdFromDrawableIds } from "../operation-ids.js";
import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type SetMaskRelationRequest = Extract<OperationRequestDto, { operationType: "setMaskRelation" }>;
type MaskRelation = AuthoringSession["graph"]["masks"][number];

export const setMaskRelationOperationHandler: OperationHandler = {
  operationType: "setMaskRelation",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applySetMaskRelation(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applySetMaskRelation(session, request, operationId, "committed");
  }
};

const applySetMaskRelation = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "setMaskRelation") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.setMaskRelation.unsupportedPayload",
            message: `setMaskRelation handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const requestedMaskRelationId = resolveRequestedMaskRelationId(request);
  const targetIds = createTargetIds(request, requestedMaskRelationId);
  const checkedTargets = createCheckedTargets(request, requestedMaskRelationId);
  const preconditionDiagnostics = evaluateSetMaskRelationPreconditions(
    session,
    request,
    requestedMaskRelationId
  );

  if (preconditionDiagnostics.length > 0 || requestedMaskRelationId === undefined) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: preconditionDiagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;

  try {
    const mutation = setMaskRelation(session, {
      maskRelationId: requestedMaskRelationId,
      maskDrawableIds: request.payload.maskDrawableIds,
      targetDrawableIds: request.payload.targetDrawableIds,
      enabled: request.payload.enabled
    });

    return {
      result: createSetMaskRelationResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        mutation,
        checkedTargets
      }),
      targetIds,
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    const diagnostic = createSetMaskRelationMutationDiagnostic(error, operationId);
    return {
      result: createRejectedOperationResult({ operationId, diagnostics: [diagnostic] }),
      targetIds,
      candidateSession: session
    };
  }
};

const resolveRequestedMaskRelationId = (
  request: SetMaskRelationRequest
): MaskRelationId | undefined => {
  if (request.payload.maskRelationId !== undefined) {
    return request.payload.maskRelationId;
  }

  if (request.payload.maskDrawableIds.length === 0 || request.payload.targetDrawableIds.length === 0) {
    return undefined;
  }

  return createMaskRelationIdFromDrawableIds(
    request.payload.maskDrawableIds,
    request.payload.targetDrawableIds
  );
};

const evaluateSetMaskRelationPreconditions = (
  session: AuthoringSession,
  request: SetMaskRelationRequest,
  maskRelationId: MaskRelationId | undefined
): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [];

  if (request.payload.maskDrawableIds.length === 0 || request.payload.targetDrawableIds.length === 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setMaskRelation.emptyRelation",
        message: "setMaskRelation requires at least one mask drawable and one target drawable.",
        target: {
          kind: "maskRelation",
          id: maskRelationId ?? "maskrel_unresolved",
          path: "/payload"
        }
      })
    );
  }

  diagnostics.push(
    ...findDuplicateDrawableIds(request.payload.maskDrawableIds).map((drawableId) =>
      createOperationDiagnostic({
        checkId: "operation.setMaskRelation.duplicateMaskDrawable",
        message: `Mask drawable appears more than once in setMaskRelation payload: ${drawableId}.`,
        target: { kind: "drawable", id: drawableId, path: "/payload/maskDrawableIds" }
      })
    )
  );

  diagnostics.push(
    ...findDuplicateDrawableIds(request.payload.targetDrawableIds).map((drawableId) =>
      createOperationDiagnostic({
        checkId: "operation.setMaskRelation.duplicateTargetDrawable",
        message: `Target drawable appears more than once in setMaskRelation payload: ${drawableId}.`,
        target: { kind: "drawable", id: drawableId, path: "/payload/targetDrawableIds" }
      })
    )
  );

  diagnostics.push(
    ...findMissingDrawableIds(session, request.payload.maskDrawableIds).map((drawableId) =>
      createOperationDiagnostic({
        checkId: "operation.setMaskRelation.missingMaskDrawable",
        message: `Mask drawable does not exist: ${drawableId}.`,
        target: createDrawableTarget(drawableId)
      })
    )
  );

  diagnostics.push(
    ...findMissingDrawableIds(session, request.payload.targetDrawableIds).map((drawableId) =>
      createOperationDiagnostic({
        checkId: "operation.setMaskRelation.missingTargetDrawable",
        message: `Target drawable does not exist: ${drawableId}.`,
        target: createDrawableTarget(drawableId)
      })
    )
  );

  diagnostics.push(
    ...findSelfMaskDrawableIds(
      request.payload.maskDrawableIds,
      request.payload.targetDrawableIds
    ).map((drawableId) =>
      createOperationDiagnostic({
        checkId: "operation.setMaskRelation.selfMask",
        message: `Drawable cannot be both mask and target in the same mask relation: ${drawableId}.`,
        target: { kind: "drawable", id: drawableId, path: "/payload" }
      })
    )
  );

  if (
    diagnostics.length === 0 &&
    maskRelationId !== undefined &&
    isSetMaskRelationNoOp(session, request, maskRelationId)
  ) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setMaskRelation.noOp",
        message: `Mask relation ${maskRelationId} is already applied.`,
        target: createMaskRelationTarget(maskRelationId),
        severity: "warning"
      })
    );
  }

  return diagnostics;
};

const createSetMaskRelationMutationDiagnostic = (
  error: AuthoringMutationError,
  operationId: OperationId
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    missing_mask_drawable: "operation.setMaskRelation.missingMaskDrawable",
    missing_mask_target_drawable: "operation.setMaskRelation.missingTargetDrawable",
    duplicate_mask_drawable: "operation.setMaskRelation.duplicateMaskDrawable",
    duplicate_mask_target_drawable: "operation.setMaskRelation.duplicateTargetDrawable",
    empty_mask_relation: "operation.setMaskRelation.emptyRelation",
    self_mask_relation: "operation.setMaskRelation.selfMask",
    no_op_mask_relation_update: "operation.setMaskRelation.noOp"
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? "operation.setMaskRelation.authoringMutationFailed",
    message: error.message,
    target: { kind: "operation", id: operationId },
    severity: error.code === "no_op_mask_relation_update" ? "warning" : "error"
  });
};

const createSetMaskRelationResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: MaskRelationMutationResult;
  readonly checkedTargets: readonly TargetRefDto[];
}): OperationResultDto => {
  const relationTarget = createMaskRelationTarget(input.mutation.relationAfter.maskRelationId);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: input.mutation.created ? [relationTarget] : [],
    removed: [],
    changed: [
      {
        target: relationTarget,
        fields: createMaskRelationDiffFields(input.mutation)
      }
    ],
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.checkedTargets),
    modelDiff,
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });
};

const createMaskRelationDiffFields = (
  mutation: MaskRelationMutationResult
): ModelDiffDto["changed"][number]["fields"] => {
  const relationPath = `/model/masks/${mutation.relationAfter.maskRelationId}`;
  const before = mutation.relationBefore;
  const after = mutation.relationAfter;

  if (before === undefined) {
    return [
      {
        path: relationPath,
        before: null,
        after: toJsonMaskRelation(after)
      }
    ];
  }

  const fields: ModelDiffDto["changed"][number]["fields"] = [];

  if (!stringArraysEqual(before.maskDrawableIds, after.maskDrawableIds)) {
    fields.push({
      path: `${relationPath}/maskDrawableIds`,
      before: [...before.maskDrawableIds],
      after: [...after.maskDrawableIds]
    });
  }

  if (!stringArraysEqual(before.targetDrawableIds, after.targetDrawableIds)) {
    fields.push({
      path: `${relationPath}/targetDrawableIds`,
      before: [...before.targetDrawableIds],
      after: [...after.targetDrawableIds]
    });
  }

  if (before.maskGroupHint !== after.maskGroupHint) {
    fields.push({
      path: `${relationPath}/maskGroupHint`,
      before: before.maskGroupHint ?? null,
      after: after.maskGroupHint ?? null
    });
  }

  if (before.enabled !== after.enabled) {
    fields.push({
      path: `${relationPath}/enabled`,
      before: before.enabled,
      after: after.enabled
    });
  }

  return fields;
};

const isSetMaskRelationNoOp = (
  session: AuthoringSession,
  request: SetMaskRelationRequest,
  maskRelationId: MaskRelationId
): boolean => {
  const existingRelation = session.graph.masks.find(
    (relation) => relation.maskRelationId === maskRelationId
  );

  return (
    existingRelation !== undefined &&
    stringArraysEqual(existingRelation.maskDrawableIds, request.payload.maskDrawableIds) &&
    stringArraysEqual(existingRelation.targetDrawableIds, request.payload.targetDrawableIds) &&
    existingRelation.enabled === request.payload.enabled
  );
};

const createTargetIds = (
  request: SetMaskRelationRequest,
  maskRelationId: MaskRelationId | undefined
): readonly string[] =>
  uniqueStrings([
    ...(maskRelationId === undefined ? [] : [maskRelationId]),
    ...request.payload.maskDrawableIds,
    ...request.payload.targetDrawableIds
  ]);

const createCheckedTargets = (
  request: SetMaskRelationRequest,
  maskRelationId: MaskRelationId | undefined
): readonly TargetRefDto[] =>
  uniqueTargetRefs([
    ...(maskRelationId === undefined ? [] : [createMaskRelationTarget(maskRelationId)]),
    ...request.payload.maskDrawableIds.map(createDrawableTarget),
    ...request.payload.targetDrawableIds.map(createDrawableTarget)
  ]);

const createMaskRelationTarget = (maskRelationId: MaskRelationId | string): TargetRefDto => ({
  kind: "maskRelation",
  id: maskRelationId,
  path: `/model/masks/${maskRelationId}`
});

const createDrawableTarget = (drawableId: DrawableId | string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const findDuplicateDrawableIds = (drawableIds: readonly DrawableId[]): readonly DrawableId[] => {
  const seen = new Set<DrawableId>();
  const duplicates: DrawableId[] = [];

  for (const drawableId of drawableIds) {
    if (seen.has(drawableId)) {
      duplicates.push(drawableId);
      continue;
    }

    seen.add(drawableId);
  }

  return uniqueStrings(duplicates) as readonly DrawableId[];
};

const findMissingDrawableIds = (
  session: AuthoringSession,
  drawableIds: readonly DrawableId[]
): readonly DrawableId[] => {
  const missingDrawableIds: DrawableId[] = [];

  for (const drawableId of uniqueStrings(drawableIds)) {
    if (getDrawableById(session.graph, drawableId) === undefined) {
      missingDrawableIds.push(drawableId);
    }
  }

  return missingDrawableIds;
};

const findSelfMaskDrawableIds = (
  maskDrawableIds: readonly DrawableId[],
  targetDrawableIds: readonly DrawableId[]
): readonly DrawableId[] => {
  const targetDrawableIdsSet = new Set(targetDrawableIds);
  return uniqueStrings(maskDrawableIds.filter((drawableId) => targetDrawableIdsSet.has(drawableId)));
};

const uniqueStrings = <TValue extends string>(values: readonly TValue[]): readonly TValue[] => {
  const seen = new Set<TValue>();
  const unique: TValue[] = [];

  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }

    seen.add(value);
    unique.push(value);
  }

  return unique;
};

const uniqueTargetRefs = (targetRefs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];

  for (const targetRef of targetRefs) {
    const key = `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(targetRef);
  }

  return unique;
};

const toJsonMaskRelation = (relation: MaskRelation): JsonValue => {
  const jsonRelation: Record<string, JsonValue> = {
    maskRelationId: relation.maskRelationId,
    maskDrawableIds: [...relation.maskDrawableIds],
    targetDrawableIds: [...relation.targetDrawableIds],
    enabled: relation.enabled
  };

  if (relation.maskGroupHint !== undefined) {
    jsonRelation.maskGroupHint = relation.maskGroupHint;
  }

  return jsonRelation;
};

const stringArraysEqual = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => right[index] === value);
