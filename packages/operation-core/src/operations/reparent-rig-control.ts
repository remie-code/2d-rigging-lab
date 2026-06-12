import {
  AuthoringMutationError,
  createDryRunAuthoringSession,
  reparentRigControl
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
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

type ReparentRigControlRequest = Extract<OperationRequestDto, { operationType: "reparentRigControl" }>;
type ReparentRigControlMutation = ReturnType<typeof reparentRigControl>;

export const reparentRigControlOperationHandler: OperationHandler = {
  operationType: "reparentRigControl",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyReparentRigControl(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyReparentRigControl(session, request, operationId, "committed");
  }
};

const applyReparentRigControl = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "reparentRigControl") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.reparentRigControl.unsupportedPayload",
            message: `reparentRigControl handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const fallbackTargetIds = [
    request.payload.childRigControlId,
    ...(request.payload.parentRigControlId === null ? [] : [request.payload.parentRigControlId])
  ];

  try {
    const mutation = reparentRigControl(session, {
      childRigControlId: request.payload.childRigControlId,
      parentRigControlId: request.payload.parentRigControlId
    });

    return {
      result: createReparentRigControlResult({
        operationId,
        status,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        packageId: session.packageIdentity.packageId,
        mutation
      }),
      targetIds: createReparentRigControlTargetIds(mutation),
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createReparentRigControlMutationDiagnostic(error, request)]
      }),
      targetIds: fallbackTargetIds,
      candidateSession: session
    };
  }
};

const createReparentRigControlResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: ReparentRigControlMutation;
}): OperationResultDto => {
  const childTarget: TargetRefDto = {
    kind: "rigControl",
    id: input.mutation.childRigControlAfter.rigControlId
  };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: createReparentRigControlChanges(input.packageId, input.mutation),
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], uniqueTargetRefs([
      childTarget,
      ...modelDiff.changed.map((change) => change.target)
    ])),
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

const createReparentRigControlChanges = (
  packageId: string,
  mutation: ReparentRigControlMutation
): ModelDiffDto["changed"] => {
  const changes: ModelDiffDto["changed"] = [
    {
      target: {
        kind: "rigControl",
        id: mutation.childRigControlAfter.rigControlId
      },
      fields: [
        {
          path: `/model/rigControls/rigControls/${mutation.childRigControlAfter.rigControlId}/parentId`,
          before: mutation.childRigControlBefore.parentId ?? null,
          after: mutation.childRigControlAfter.parentId ?? null
        }
      ]
    }
  ];

  if (mutation.previousParentRigControlChange !== undefined) {
    changes.push(createParentChildListChange(mutation.previousParentRigControlChange));
  }
  if (mutation.newParentRigControlChange !== undefined) {
    changes.push(createParentChildListChange(mutation.newParentRigControlChange));
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

  return changes;
};

const createParentChildListChange = (
  change: NonNullable<ReparentRigControlMutation["previousParentRigControlChange"]>
): ModelDiffDto["changed"][number] => ({
  target: {
    kind: "rigControl",
    id: change.after.rigControlId
  },
  fields: [
    {
      path: `/model/rigControls/rigControls/${change.after.rigControlId}/childRigControlIds`,
      before: [...change.before.childRigControlIds],
      after: [...change.after.childRigControlIds]
    }
  ]
});

const createReparentRigControlMutationDiagnostic = (
  error: AuthoringMutationError,
  request: ReparentRigControlRequest
): DiagnosticDto => {
  const childTarget: TargetRefDto = {
    kind: "rigControl",
    id: request.payload.childRigControlId
  };
  switch (error.code) {
    case "missing_rig_control":
      return createOperationDiagnostic({
        checkId: error.message.startsWith("Child ")
          ? "operation.reparentRigControl.missingChildRigControl"
          : "operation.reparentRigControl.missingParentRigControl",
        message: error.message,
        target: error.message.startsWith("Child ")
          ? childTarget
          : { kind: "rigControl", id: request.payload.parentRigControlId ?? "root" }
      });
    case "rig_control_self_child":
    case "rig_control_cycle":
      return createOperationDiagnostic({
        checkId: "operation.reparentRigControl.cycle",
        message: error.message,
        target: childTarget
      });
    case "duplicate_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.reparentRigControl.duplicateChild",
        message: error.message,
        target: childTarget
      });
    case "rig_control_parent_child_mismatch":
      return createOperationDiagnostic({
        checkId: "operation.reparentRigControl.parentChildMismatch",
        message: error.message,
        target: childTarget
      });
    case "illegal_rig_control_root_state":
      return createOperationDiagnostic({
        checkId: "operation.reparentRigControl.illegalRootState",
        message: error.message,
        target: childTarget
      });
    case "no_op_rig_control_child_binding":
      return createOperationDiagnostic({
        checkId: "operation.reparentRigControl.noOp",
        message: error.message,
        target: childTarget,
        severity: "warning"
      });
    default:
      return createOperationDiagnostic({
        checkId: "operation.reparentRigControl.authoringMutationFailed",
        message: error.message,
        target: childTarget
      });
  }
};

const createReparentRigControlTargetIds = (
  mutation: ReparentRigControlMutation
): readonly string[] =>
  uniqueStrings([
    mutation.childRigControlAfter.rigControlId,
    ...(mutation.childRigControlBefore.parentId === undefined ? [] : [mutation.childRigControlBefore.parentId]),
    ...(mutation.childRigControlAfter.parentId === undefined ? [] : [mutation.childRigControlAfter.parentId])
  ]);

const uniqueTargetRefs = (targetRefs: readonly TargetRefDto[]): readonly TargetRefDto[] => {
  const seen = new Set<string>();
  const unique: TargetRefDto[] = [];
  for (const targetRef of targetRefs) {
    const key = `${targetRef.kind}:${targetRef.id}:${targetRef.path ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(targetRef);
    }
  }
  return unique;
};

const uniqueStrings = (values: readonly (RigControlId | string)[]): readonly string[] =>
  [...new Set(values.map(String))];
