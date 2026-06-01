import {
  AuthoringMutationError,
  bindRigControlChild,
  createDryRunAuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
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

type BindRigControlChildRequest = Extract<OperationRequestDto, { operationType: "bindRigControlChild" }>;
type BindRigControlChildMutation = ReturnType<typeof bindRigControlChild>;

export const bindRigControlChildOperationHandler: OperationHandler = {
  operationType: "bindRigControlChild",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyBindRigControlChild(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyBindRigControlChild(session, request, operationId, "committed");
  }
};

const applyBindRigControlChild = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "bindRigControlChild") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.bindRigControlChild.unsupportedPayload",
            message: `bindRigControlChild handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const targetIds = createBindRigControlChildTargetIds(request);
  const baseRevision = session.authoringRevision;

  try {
    const mutation = bindRigControlChild(session, {
      parentRigControlId: request.payload.parentRigControlId,
      child: request.payload.child
    });
    const result = createBindRigControlChildResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      mutation
    });

    return {
      result,
      targetIds,
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createBindRigControlChildMutationDiagnostic(error, request)]
      }),
      targetIds,
      candidateSession: session
    };
  }
};

const createBindRigControlChildResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: BindRigControlChildMutation;
}): OperationResultDto => {
  const parentTarget: TargetRefDto = {
    kind: "rigControl",
    id: input.mutation.parentRigControlAfter.rigControlId
  };
  const childTarget = createChildTargetRef(input.mutation);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: createBindRigControlChildChanges({
      packageId: input.packageId,
      mutation: input.mutation,
      childTarget
    }),
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], [parentTarget, childTarget]),
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

const createBindRigControlChildChanges = (input: {
  readonly packageId: string;
  readonly mutation: BindRigControlChildMutation;
  readonly childTarget: TargetRefDto;
}): ModelDiffDto["changed"] => {
  const parentId = input.mutation.parentRigControlAfter.rigControlId;
  const childListPath =
    input.mutation.child.kind === "drawable"
      ? `/model/rigControls/rigControls/${parentId}/childDrawableIds`
      : `/model/rigControls/rigControls/${parentId}/childRigControlIds`;
  const changes: ModelDiffDto["changed"] = [
    {
      target: {
        kind: "rigControl",
        id: parentId
      },
      fields: [
        {
          path: childListPath,
          before:
            input.mutation.child.kind === "drawable"
              ? [...input.mutation.parentRigControlBefore.childDrawableIds]
              : [...input.mutation.parentRigControlBefore.childRigControlIds],
          after:
            input.mutation.child.kind === "drawable"
              ? [...input.mutation.parentRigControlAfter.childDrawableIds]
              : [...input.mutation.parentRigControlAfter.childRigControlIds]
        }
      ]
    }
  ];

  if (input.mutation.childRigControlChange !== undefined) {
    changes.push({
      target: {
        kind: "rigControl",
        id: input.mutation.childRigControlChange.after.rigControlId
      },
      fields: [
        {
          path: `/model/rigControls/rigControls/${input.mutation.childRigControlChange.after.rigControlId}/parentId`,
          before: input.mutation.childRigControlChange.before.parentId ?? null,
          after: input.mutation.childRigControlChange.after.parentId ?? null
        }
      ]
    });
  }

  if (rootIdsChanged(input.mutation)) {
    changes.push({
      target: {
        kind: "package",
        id: input.packageId,
        path: "/model/graph/rigControlRootIds"
      },
      fields: [
        {
          path: "/model/graph/rigControlRootIds",
          before: [...input.mutation.rigControlRootIdsBefore],
          after: [...input.mutation.rigControlRootIdsAfter]
        }
      ]
    });
  }

  changes.push({
    target: input.childTarget,
    fields: [
      {
        path: input.childTarget.path ?? childListPath,
        before: null,
        after: input.childTarget.id
      }
    ]
  });

  return changes;
};

const createChildTargetRef = (mutation: BindRigControlChildMutation): TargetRefDto => {
  const parentId = mutation.parentRigControlAfter.rigControlId;
  const childPath =
    mutation.child.kind === "drawable"
      ? `/model/rigControls/rigControls/${parentId}/childDrawableIds`
      : `/model/rigControls/rigControls/${parentId}/childRigControlIds`;

  return {
    kind: mutation.child.kind,
    id: mutation.child.id,
    path: childPath
  };
};

const rootIdsChanged = (mutation: BindRigControlChildMutation): boolean =>
  JSON.stringify(mutation.rigControlRootIdsBefore) !== JSON.stringify(mutation.rigControlRootIdsAfter);

const createBindRigControlChildMutationDiagnostic = (
  error: AuthoringMutationError,
  request: BindRigControlChildRequest
): DiagnosticDto => {
  switch (error.code) {
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: error.message.startsWith("Parent ")
          ? "operation.bindRigControlChild.missingParentRigControl"
          : "operation.bindRigControlChild.missingChildRigControl",
        message: error.message,
        target: error.message.startsWith("Parent ")
          ? { kind: "rigControl", id: request.payload.parentRigControlId }
          : request.payload.child
      });
    case "missing_drawable":
      return createOperationDiagnostic({
        checkId: "operation.bindRigControlChild.missingChildDrawable",
        message: error.message,
        target: request.payload.child
      });
    case "invalid_rig_control_child_kind":
      return createOperationDiagnostic({
        checkId: "operation.bindRigControlChild.invalidChildKind",
        message: error.message,
        target: request.payload.child
      });
    case "invalid_rig_control_child_id":
      return createOperationDiagnostic({
        checkId: "operation.bindRigControlChild.invalidChildId",
        message: error.message,
        target: request.payload.child
      });
    case "rig_control_self_child":
    case "rig_control_cycle":
      return createOperationDiagnostic({
        checkId: "operation.bindRigControlChild.cycle",
        message: error.message,
        target: { kind: "rigControl", id: request.payload.parentRigControlId }
      });
    case "rig_control_child_already_parented":
      return createOperationDiagnostic({
        checkId: "operation.bindRigControlChild.childAlreadyParented",
        message: error.message,
        target: request.payload.child
      });
    case "no_op_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.bindRigControlChild.noOp",
        message: error.message,
        target: request.payload.child,
        severity: "warning"
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.bindRigControlChild.authoringMutationFailed",
        message: error.message,
        target: { kind: "rigControl", id: request.payload.parentRigControlId }
      });
  }
};

const createBindRigControlChildTargetIds = (
  request: BindRigControlChildRequest
): readonly string[] =>
  [request.payload.parentRigControlId, request.payload.child.id].filter(
    (targetId, index, targetIds) => targetIds.indexOf(targetId) === index
  );
