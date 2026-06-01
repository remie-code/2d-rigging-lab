import {
  createDryRunAuthoringSession,
  getDrawableById,
  getTextureAtlasEntryById,
  setDrawableTexture
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  DrawableId,
  ModelDiffDto,
  OperationId,
  TargetRefDto,
  TextureId
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

export const setDrawableTextureOperationHandler: OperationHandler = {
  operationType: "setDrawableTexture",

  dryRun(session, request, operationId) {
    const dryRunSession = createDryRunAuthoringSession(session);
    return applySetDrawableTexture(dryRunSession, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    return applySetDrawableTexture(session, request, operationId, "committed");
  }
};

const applySetDrawableTexture = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== "setDrawableTexture") {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: "operation.setDrawableTexture.unsupportedPayload",
            message: `setDrawableTexture handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const checkedTargetRefs = [
    createDrawableTarget(request.payload.drawableId),
    createTextureTarget(request.payload.textureId)
  ];
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const diagnostics = evaluateSetDrawableTexturePreconditions(session, request, checkedTargetRefs);
  if (diagnostics.length > 0) {
    return {
      result: createRejectedOperationResult({ operationId, diagnostics }),
      targetIds,
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const mutation = setDrawableTexture(session, {
    drawableId: request.payload.drawableId,
    textureId: request.payload.textureId
  });

  return {
    result: createSetDrawableTextureResult({
      operationId,
      status,
      baseRevision,
      candidateRevision: mutation.authoringRevision,
      drawableId: mutation.drawableAfter.drawableId,
      textureId: mutation.drawableAfter.textureId,
      before: mutation.drawableBefore.textureId,
      checkedTargetRefs
    }),
    targetIds,
    candidateSession: session
  };
};

const evaluateSetDrawableTexturePreconditions = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: "setDrawableTexture" }>,
  checkedTargetRefs: readonly TargetRefDto[]
): DiagnosticDto[] => {
  const drawableTarget = createDrawableTarget(request.payload.drawableId);
  const textureTarget = createTextureTarget(request.payload.textureId);
  const diagnostics: DiagnosticDto[] = [
    ...createLockedTargetDiagnostics({
      operationType: "setDrawableTexture",
      lockedTargetIds: request.payload.lockedTargetIds,
      targets: checkedTargetRefs
    })
  ];
  const drawable = getDrawableById(session.graph, request.payload.drawableId);
  const texture = getTextureAtlasEntryById(session.graph, request.payload.textureId);

  if (drawable === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setDrawableTexture.missingDrawable",
        message: `Drawable does not exist: ${request.payload.drawableId}.`,
        target: drawableTarget
      })
    );
  }

  if (texture === undefined) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setDrawableTexture.missingTexture",
        message: `Texture atlas entry does not exist: ${request.payload.textureId}.`,
        target: textureTarget
      })
    );
  }

  if (drawable !== undefined && texture !== undefined && drawable.textureId === request.payload.textureId) {
    diagnostics.push(
      createOperationDiagnostic({
        checkId: "operation.setDrawableTexture.noOp",
        message: `Drawable ${drawable.drawableId} already uses texture ${texture.textureId}.`,
        target: drawableTarget,
        severity: "warning"
      })
    );
  }

  return diagnostics;
};

const createSetDrawableTextureResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly drawableId: DrawableId;
  readonly textureId: TextureId;
  readonly before: TextureId;
  readonly checkedTargetRefs: readonly TargetRefDto[];
}): OperationResultDto => {
  const drawableTarget = createDrawableTarget(input.drawableId);
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [],
    removed: [],
    changed: [
      {
        target: drawableTarget,
        fields: [
          {
            path: `/model/drawables/${input.drawableId}/textureId`,
            before: input.before,
            after: input.textureId
          }
        ]
      }
    ],
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

const createDrawableTarget = (drawableId: DrawableId | string): TargetRefDto => ({
  kind: "drawable",
  id: drawableId
});

const createTextureTarget = (textureId: TextureId | string): TargetRefDto => ({
  kind: "texture",
  id: textureId
});
