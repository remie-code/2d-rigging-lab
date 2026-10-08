import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  deleteRigControl
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  JsonValue,
  ModelDiffDto,
  OperationId,
  RigControlId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type DeleteRigControlRequest = Extract<OperationRequestDto, { operationType: "deleteRigControl" }>;
type DeleteRigControlMutation = ReturnType<typeof deleteRigControl>;

export const deleteRigControlOperationHandler: OperationHandler = {
  operationType: "deleteRigControl",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyDeleteRigControl(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyDeleteRigControl(session, request, operationId, "committed");
  }
};

const applyDeleteRigControl = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "deleteRigControl") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.deleteRigControl.unsupportedPayload",
            message: `deleteRigControl handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  try {
    const mutation = deleteRigControl(session, {
      rigControlId: request.payload.rigControlId
    });

    return {
      result: createDeleteRigControlResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        packageId: session.packageIdentity.packageId,
        mutation
      }),
      targetIds: createDeleteRigControlTargetIds(mutation),
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createDeleteRigControlMutationDiagnostic(error, request)]
      }),
      targetIds: [request.payload.rigControlId],
      candidateSession: session
    };
  }
};

const createDeleteRigControlResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: DeleteRigControlMutation;
}): OperationResultDto => {
  const rigControlTarget = createRigControlTarget(input.mutation.rigControlBefore.rigControlId);
  const removedKeyformSetTargets = input.mutation.removedKeyformSets.map((keyformSet): TargetRefDto => ({
    kind: "keyformSet",
    id: keyformSet.keyformSetId
  }));
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [rigControlTarget, ...removedKeyformSetTargets],
    changed: createDeleteRigControlChanges(input.packageId, input.mutation),
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult(
      [],
      uniqueTargetRefs([
        rigControlTarget,
        ...removedKeyformSetTargets,
        ...input.mutation.rigControlBefore.childDrawableIds.map((childDrawableId): TargetRefDto => ({
          kind: "drawable",
          id: childDrawableId
        })),
        ...modelDiff.changed.map((change) => change.target)
      ])
    ),
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

const createDeleteRigControlChanges = (
  packageId: string,
  mutation: DeleteRigControlMutation
): ModelDiffDto["changed"] => {
  const rigControlPath = `/model/rigControls/rigControls/${mutation.rigControlBefore.rigControlId}`;
  const changes: ModelDiffDto["changed"] = [
    {
      target: {
        kind: "package",
        id: packageId,
        path: "/model/rigControls/rigControls"
      },
      fields: [
        {
          path: "/model/rigControls/rigControls",
          before: mutation.rigControlBefore.rigControlId,
          after: null
        }
      ]
    },
    {
      target: {
        kind: "package",
        id: packageId,
        path: "/model/graph/stableOrder"
      },
      fields: [
        {
          path: "/model/graph/stableOrder",
          before: [...mutation.stableOrderBefore],
          after: [...mutation.stableOrderAfter]
        }
      ]
    },
    {
      target: createRigControlTarget(mutation.rigControlBefore.rigControlId),
      fields: [
        {
          path: rigControlPath,
          before: toJsonValue(mutation.rigControlBefore),
          after: null
        }
      ]
    }
  ];

  if (mutation.removedKeyformSets.length > 0) {
    changes.push({
      target: {
        kind: "package",
        id: packageId,
        path: "/model/keyforms/keyformSets"
      },
      fields: mutation.removedKeyformSets.map((keyformSet) => ({
        path: "/model/keyforms/keyformSets",
        before: keyformSet.keyformSetId,
        after: null
      }))
    });

    for (const keyformSet of mutation.removedKeyformSets) {
      changes.push({
        target: {
          kind: "keyformSet",
          id: keyformSet.keyformSetId
        },
        fields: [
          {
            path: `/model/keyforms/keyformSets/${keyformSet.keyformSetId}`,
            before: toJsonValue(keyformSet),
            after: null
          }
        ]
      });
    }
  }

  if (
    JSON.stringify(mutation.rigControlRootIdsBefore) !==
    JSON.stringify(mutation.rigControlRootIdsAfter)
  ) {
    changes.push({
      target: {
        kind: "package",
        id: packageId,
        path: "/model/graph/rigControlRootIds"
      },
      fields: [
        {
          path: "/model/graph/rigControlRootIds",
          before: [...mutation.rigControlRootIdsBefore],
          after: [...mutation.rigControlRootIdsAfter]
        }
      ]
    });
  }

  if (
    mutation.parentRigControlBefore !== undefined &&
    mutation.parentRigControlAfter !== undefined
  ) {
    changes.push({
      target: createRigControlTarget(mutation.parentRigControlAfter.rigControlId),
      fields: [
        {
          path: `/model/rigControls/rigControls/${mutation.parentRigControlAfter.rigControlId}/childDrawableIds`,
          before: [...mutation.parentRigControlBefore.childDrawableIds],
          after: [...mutation.parentRigControlAfter.childDrawableIds]
        },
        {
          path: `/model/rigControls/rigControls/${mutation.parentRigControlAfter.rigControlId}/childRigControlIds`,
          before: [...mutation.parentRigControlBefore.childRigControlIds],
          after: [...mutation.parentRigControlAfter.childRigControlIds]
        }
      ].filter((field) => JSON.stringify(field.before) !== JSON.stringify(field.after))
    });
  }

  for (const childRigControlChange of mutation.childRigControlChanges) {
    changes.push({
      target: createRigControlTarget(childRigControlChange.after.rigControlId),
      fields: [
        {
          path: `/model/rigControls/rigControls/${childRigControlChange.after.rigControlId}/parentId`,
          before: childRigControlChange.before.parentId ?? null,
          after: childRigControlChange.after.parentId ?? null
        }
      ]
    });
  }

  return changes;
};

const createDeleteRigControlMutationDiagnostic = (
  error: AuthoringMutationError,
  request: DeleteRigControlRequest
): DiagnosticDto => {
  const target = createRigControlTarget(request.payload.rigControlId);
  switch (error.code) {
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: "operation.deleteRigControl.missingRigControl",
        message: error.message,
        target
      });
    case "missing_drawable":
      return createOperationDiagnostic({
        checkId: "operation.deleteRigControl.missingChildDrawable",
        message: error.message,
        target
      });
    case "duplicate_rig_control_child":
    case "duplicate_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.deleteRigControl.duplicateChildBinding",
        message: error.message,
        target
      });
    case "rig_control_parent_child_mismatch":
      return createOperationDiagnostic({
        checkId: "operation.deleteRigControl.parentChildMismatch",
        message: error.message,
        target
      });
    case "illegal_rig_control_root_state":
      return createOperationDiagnostic({
        checkId: "operation.deleteRigControl.illegalRootState",
        message: error.message,
        target
      });
    case "rig_control_self_child":
    case "rig_control_cycle":
      return createOperationDiagnostic({
        checkId: "operation.deleteRigControl.cycle",
        message: error.message,
        target
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.deleteRigControl.authoringMutationFailed",
        message: error.message,
        target
      });
  }
};

const createDeleteRigControlTargetIds = (
  mutation: DeleteRigControlMutation
): readonly string[] =>
  uniqueStrings([
    mutation.rigControlBefore.rigControlId,
    ...(mutation.rigControlBefore.parentId === undefined ? [] : [mutation.rigControlBefore.parentId]),
    ...mutation.rigControlBefore.childRigControlIds,
    ...mutation.rigControlBefore.childDrawableIds,
    ...mutation.removedKeyformSets.map((keyformSet) => keyformSet.keyformSetId)
  ]);

const createRigControlTarget = (rigControlId: RigControlId | string): TargetRefDto => ({
  kind: "rigControl",
  id: rigControlId
});

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

const uniqueStrings = (values: readonly string[]): readonly string[] => [...new Set(values)];

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
