import {
  createDryRunAuthoringSession,
  deletePart,
  getPartById
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

export const deletePartOperationHandler: OperationHandler = {
  operationType: "deletePart",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyDeletePart(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyDeletePart(session, request, operationId, "committed");
  }
};

const applyDeletePart = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "deletePart") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.deletePart.unsupportedPayload",
            message: `deletePart handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const checkedTargetRefs = createDeletePartCheckedTargetRefs(session, request);
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const diagnostics = evaluateDeletePartPreconditions(session, request, checkedTargetRefs);
  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const mutation = deletePart(session, {
    partId: request.payload.partId
  });

  return {
    result: createDeletePartResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      mutation,
      checkedTargetRefs
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateDeletePartPreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "deletePart" }>,
  checkedTargetRefs: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const partTarget = createPartTarget(request.payload.partId);
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "deletePart",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargetRefs
    })
  ];
  const part = getPartById(session.graph, request.payload.partId);

  if (part === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.deletePart.missingPart",
        message: `Part does not exist: ${request.payload.partId}.`,
        target: partTarget
      })
    );
    return diagnostics;
  }

  if (part.parentPartId === part.partId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.deletePart.partCycle",
        message: `Part ${part.partId} cannot parent itself.`,
        target: partTarget
      })
    );
  }

  if (part.parentPartId !== undefined && getPartById(session.graph, part.parentPartId) === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.deletePart.missingParentPart",
        message: `Parent part does not exist: ${part.parentPartId}.`,
        target: createPartTarget(part.parentPartId)
      })
    );
  }

  const childPartIds = getDirectChildPartIds(session, part.partId);
  if (childPartIds.length > 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.deletePart.partHasChildParts",
        message: `Part ${part.partId} cannot be deleted because it has child parts: ${childPartIds.join(", ")}.`,
        target: { ...partTarget, path: `/model/graph/parts/${part.partId}/childPartIds` }
      })
    );
  }

  const drawableIds = getPartDrawableIds(session, part);
  if (drawableIds.length > 0) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.deletePart.partHasDrawables",
        message: `Part ${part.partId} cannot be deleted because it owns drawables: ${drawableIds.join(", ")}.`,
        target: { ...partTarget, path: `/model/graph/parts/${part.partId}/drawableIds` }
      })
    );
  }

  return diagnostics;
};

const createDeletePartResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly mutation: ReturnType<typeof deletePart>;
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): OperationResultDto => {
  const partTarget = createPartTarget(input.mutation.partBefore.partId);
  const packageTarget: TargetRefDto = {
    kind: "package",
    id: input.packageId
  };
  const changed = [
    {
      target: packageTarget,
      fields: [
        {
          path: "/model/graph/parts",
          before: input.mutation.partBefore.partId,
          after: null
        },
        {
          path: "/model/graph/stableOrder",
          before: input.mutation.stableOrderBefore,
          after: input.mutation.stableOrderAfter
        }
      ]
    },
    {
      target: partTarget,
      fields: [
        {
          path: `/model/graph/parts/${input.mutation.partBefore.partId}`,
          before: partToJson(input.mutation.partBefore),
          after: null
        }
      ]
    },
    ...(input.mutation.parentBefore === undefined || input.mutation.parentAfter === undefined
      ? []
      : [
          {
            target: createPartTarget(input.mutation.parentAfter.partId),
            fields: [
              {
                path: `/model/graph/parts/${input.mutation.parentAfter.partId}/childPartIds`,
                before: input.mutation.parentBefore.childPartIds,
                after: input.mutation.parentAfter.childPartIds
              }
            ]
          }
        ])
  ];
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [partTarget],
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

const createDeletePartCheckedTargetRefs = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "deletePart" }>
): readonly TargetRefDto[] => {
  const refs = [createPartTarget(request.payload.partId)];
  const part = getPartById(session.graph, request.payload.partId);
  if (part?.parentPartId !== undefined) {
    refs.push(createPartTarget(part.parentPartId));
  }

  return uniqueTargetRefs(refs);
};

const getDirectChildPartIds = (session: AuthoringSession, partId: PartId): readonly string[] =>
  uniqueStrings([
    ...(getPartById(session.graph, partId)?.childPartIds ?? []),
    ...session.graph.parts
      .filter((candidate) => candidate.parentPartId === partId)
      .map((candidate) => candidate.partId)
  ]);

const getPartDrawableIds = (session: AuthoringSession, part: ModelPart): readonly string[] =>
  uniqueStrings([
    ...part.drawableIds,
    ...session.graph.drawables
      .filter((drawable) => drawable.partId === part.partId)
      .map((drawable) => drawable.drawableId)
  ]);

const uniqueStrings = (values: readonly string[]): readonly string[] => {
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

const partToJson = (part: ModelPart) => ({
  partId: part.partId,
  displayName: part.displayName,
  ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
  childPartIds: [...part.childPartIds],
  drawableIds: [...part.drawableIds]
});

type ModelPart = AuthoringSession["graph"]["parts"][number];
