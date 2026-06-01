import {
  createDryRunAuthoringSession,
  getPartById,
  updatePart
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  ModelDiffDto,
  OperationId,
  PartId,
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
import { createLockedTargetDiagnostics } from "./locked-targets.js";

export const updatePartOperationHandler: OperationHandler = {
  operationType: "updatePart",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyUpdatePart(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyUpdatePart(session, request, operationId, "committed");
  }
};

const applyUpdatePart = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "updatePart") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.updatePart.unsupportedPayload",
            message: `updatePart handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const checkedTargetRefs = createUpdatePartCheckedTargetRefs(session, request);
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const diagnostics = evaluateUpdatePartPreconditions(session, request, checkedTargetRefs);
  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const updatesParent = Object.prototype.hasOwnProperty.call(request.payload, "parentPartId");
  const mutation = updatePart(session, {
    partId: request.payload.partId,
    ...(request.payload.displayName === undefined ? {} : { displayName: request.payload.displayName }),
    ...(updatesParent ? { parentPartId: request.payload.parentPartId ?? null } : {})
  });

  return {
    result: createUpdatePartResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      mutation,
      checkedTargetRefs
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateUpdatePartPreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "updatePart" }>,
  checkedTargetRefs: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const partTarget = createPartTarget(request.payload.partId);
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "updatePart",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargetRefs
    })
  ];
  const part = getPartById(session.graph, request.payload.partId);

  if (part === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.updatePart.missingPart",
        message: `Part does not exist: ${request.payload.partId}.`,
        target: partTarget
      })
    );
    return diagnostics;
  }

  const updatesParent = Object.prototype.hasOwnProperty.call(request.payload, "parentPartId");
  const nextParentPartId = updatesParent ? request.payload.parentPartId ?? undefined : part.parentPartId;
  if (nextParentPartId !== undefined) {
    const parentTarget = createPartTarget(nextParentPartId);
    if (getPartById(session.graph, nextParentPartId) === undefined) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.updatePart.missingParentPart",
          message: `Parent part does not exist: ${nextParentPartId}.`,
          target: parentTarget
        })
      );
    }

    if (nextParentPartId === part.partId || isDescendantPart(session, part.partId, nextParentPartId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.updatePart.partCycle",
          message: `Part ${part.partId} cannot be parented by descendant ${nextParentPartId}.`,
          target: parentTarget
        })
      );
    }
  }

  diagnostics.push(...createDuplicateChildPartDiagnostics(session, "operation.updatePart.duplicateChildPart"));

  const displayNameChanged =
    request.payload.displayName !== undefined && request.payload.displayName !== part.displayName;
  const parentChanged = updatesParent && nextParentPartId !== part.parentPartId;
  if (diagnostics.length === 0 && !displayNameChanged && !parentChanged) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.updatePart.noOp",
        message: `Part ${part.partId} is already up to date.`,
        target: partTarget,
        severity: "warning"
      })
    );
  }

  return diagnostics;
};

const createUpdatePartResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly mutation: ReturnType<typeof updatePart>;
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): OperationResultDto => {
  const changed = [
    {
      target: createPartTarget(input.mutation.partAfter.partId),
      fields: createPartFieldChanges(input.mutation.partBefore, input.mutation.partAfter)
    },
    ...createParentChildFieldChanges(input.mutation)
  ].filter((change) => change.fields.length > 0);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed,
    operationIds: [input.operationId]
  };

  return OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId: input.operationId,
    status: input.status,
    precondition: createPreconditionResult([], input.checkedTargetRefs),
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

const createPartFieldChanges = (before: ModelPart, after: ModelPart) => [
  ...(before.displayName === after.displayName
    ? []
    : [
        {
          path: `/model/graph/parts/${after.partId}/displayName`,
          before: before.displayName,
          after: after.displayName
        }
      ]),
  ...(before.parentPartId === after.parentPartId
    ? []
    : [
        {
          path: `/model/graph/parts/${after.partId}/parentPartId`,
          before: before.parentPartId ?? null,
          after: after.parentPartId ?? null
        }
      ])
];

const createParentChildFieldChanges = (mutation: ReturnType<typeof updatePart>) => [
  ...(mutation.oldParentBefore === undefined || mutation.oldParentAfter === undefined
    ? []
    : [
        {
          target: createPartTarget(mutation.oldParentAfter.partId),
          fields: [
            {
              path: `/model/graph/parts/${mutation.oldParentAfter.partId}/childPartIds`,
              before: mutation.oldParentBefore.childPartIds,
              after: mutation.oldParentAfter.childPartIds
            }
          ]
        }
      ]),
  ...(mutation.newParentBefore === undefined || mutation.newParentAfter === undefined
    ? []
    : [
        {
          target: createPartTarget(mutation.newParentAfter.partId),
          fields: [
            {
              path: `/model/graph/parts/${mutation.newParentAfter.partId}/childPartIds`,
              before: mutation.newParentBefore.childPartIds,
              after: mutation.newParentAfter.childPartIds
            }
          ]
        }
      ])
];

const createUpdatePartCheckedTargetRefs = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "updatePart" }>
): readonly TargetRefDto[] => {
  const refs = [createPartTarget(request.payload.partId)];
  const part = getPartById(session.graph, request.payload.partId);
  if (part?.parentPartId !== undefined) {
    refs.push(createPartTarget(part.parentPartId));
  }

  if (
    Object.prototype.hasOwnProperty.call(request.payload, "parentPartId") &&
    request.payload.parentPartId !== null &&
    request.payload.parentPartId !== undefined
  ) {
    refs.push(createPartTarget(request.payload.parentPartId));
  }

  return uniqueTargetRefs(refs);
};

const createDuplicateChildPartDiagnostics = (
  session: AuthoringSession,
  checkId: string
): DiagnosticDto[] =>
  session.graph.parts.flatMap((part) =>
    findDuplicateStrings(part.childPartIds).map((childPartId) =>
      createOperationDiagnostic({
        checkId,
        message: `Part ${part.partId} contains duplicate child part ${childPartId}.`,
        target: {
          kind: "part",
          id: part.partId,
          path: `/model/graph/parts/${part.partId}/childPartIds`
        }
      })
    )
  );

const isDescendantPart = (
  session: AuthoringSession,
  ancestorPartId: PartId,
  candidatePartId: PartId
): boolean => {
  const stack = [...(getPartById(session.graph, ancestorPartId)?.childPartIds ?? [])];
  const seen = new Set<string>();

  while (stack.length > 0) {
    const partId = stack.pop();
    if (partId === undefined || seen.has(partId)) {
      continue;
    }

    if (partId === candidatePartId) {
      return true;
    }

    seen.add(partId);
    stack.push(...(getPartById(session.graph, partId)?.childPartIds ?? []));
  }

  return false;
};

const findDuplicateStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return [...duplicates];
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

const createPartTarget = (partId: string): TargetRefDto => ({
  kind: "part",
  id: partId
});

type ModelPart = AuthoringSession["graph"]["parts"][number];
