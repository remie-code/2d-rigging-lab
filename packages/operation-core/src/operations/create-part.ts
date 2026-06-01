import {
  createDryRunAuthoringSession,
  createPart,
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

import { createPartIdFromDisplayName } from "../operation-ids.js";
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

export const createPartOperationHandler: OperationHandler = {
  operationType: "createPart",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applyCreatePart(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applyCreatePart(session, request, operationId, "committed");
  }
};

const applyCreatePart = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "createPart") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.createPart.unsupportedPayload",
            message: `createPart handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const partId = request.payload.partId ?? createPartIdFromDisplayName(request.payload.displayName);
  const partTarget = createPartTarget(partId);
  const parentTarget =
    request.payload.parentPartId === undefined ? undefined : createPartTarget(request.payload.parentPartId);
  const checkedTargetRefs = parentTarget === undefined ? [partTarget] : [partTarget, parentTarget];
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const diagnostics = evaluateCreatePartPreconditions({
    session,
    request,
    partId,
    partTarget,
    checkedTargetRefs
  });

  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const part: ModelPart = {
    partId,
    displayName: request.payload.displayName,
    ...(request.payload.parentPartId === undefined ? {} : { parentPartId: request.payload.parentPartId }),
    childPartIds: [],
    drawableIds: []
  };
  const mutation = createPart(session, { part });

  return {
    result: createCreatePartResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      packageId: session.packageIdentity.packageId,
      part: mutation.part,
      ...(mutation.parentBefore === undefined ? {} : { parentBefore: mutation.parentBefore }),
      ...(mutation.parentAfter === undefined ? {} : { parentAfter: mutation.parentAfter }),
      checkedTargetRefs
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateCreatePartPreconditions = (input: {
  readonly session: AuthoringSession;
  readonly request: Extract<OperationRequestDto, { operationType: "createPart" }>;
  readonly partId: PartId;
  readonly partTarget: TargetRefDto;
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): DiagnosticDto[] => {
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "createPart",
      lockedTargetIds: input.request.payload.lockedTargetIds,
      targets: input.checkedTargetRefs
    })
  ];

  if (getPartById(input.session.graph, input.partId) !== undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.createPart.duplicatePart",
        message: `Part already exists: ${input.partId}.`,
        target: input.partTarget
      })
    );
  }

  const parentPartId = input.request.payload.parentPartId;
  if (parentPartId !== undefined) {
    const parentTarget = createPartTarget(parentPartId);

    if (parentPartId === input.partId) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.createPart.partCycle",
          message: `Part ${input.partId} cannot parent itself.`,
          target: parentTarget
        })
      );
    }

    const parent = getPartById(input.session.graph, parentPartId);
    if (parent === undefined) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.createPart.missingParentPart",
          message: `Parent part does not exist: ${parentPartId}.`,
          target: parentTarget
        })
      );
    } else if (parent.childPartIds.includes(input.partId)) {
      diagnostics.push(
        createOperationDiagnostic({
          checkId: "operation.createPart.duplicateChildPart",
          message: `Parent part ${parentPartId} already contains child ${input.partId}.`,
          target: { ...parentTarget, path: "/model/graph/parts/childPartIds" }
        })
      );
    }
  }

  return diagnostics;
};

const createCreatePartResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly part: ModelPart;
  readonly parentBefore?: ModelPart;
  readonly parentAfter?: ModelPart;
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): OperationResultDto => {
  const partTarget = createPartTarget(input.part.partId);
  const parentTarget =
    input.parentAfter === undefined ? undefined : createPartTarget(input.parentAfter.partId);
  const changed = [
    {
      target: { kind: "package", id: input.packageId } satisfies TargetRefDto,
      fields: [
        {
          path: "/model/graph/parts",
          before: null,
          after: input.part.partId
        },
        {
          path: "/model/graph/stableOrder",
          before: null,
          after: input.part.partId
        }
      ]
    },
    {
      target: partTarget,
      fields: [
        {
          path: `/model/graph/parts/${input.part.partId}`,
          before: null,
          after: partToJson(input.part)
        }
      ]
    },
    ...(parentTarget === undefined || input.parentBefore === undefined || input.parentAfter === undefined
      ? []
      : [
          {
            target: parentTarget,
            fields: [
              {
                path: `/model/graph/parts/${parentTarget.id}/childPartIds`,
                before: input.parentBefore.childPartIds,
                after: input.parentAfter.childPartIds
              }
            ]
          }
        ])
  ];
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [partTarget],
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
