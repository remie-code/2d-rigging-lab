import { addDrawableFromImage, replaceDrawableImage } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession, MaterialImageDrawableResult } from "@private-2d-rigging-lab/authoring-core";
import type { DiagnosticDto, OperationId, TargetRefDto } from "@private-2d-rigging-lab/contracts";

import { createMaterialImageIdSeed } from "../operation-ids.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import type { OperationRequestDto } from "../operation-request.js";
import { OperationResultSchema } from "../operation-result.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";
import { createLockedTargetDiagnostics } from "./locked-targets.js";
import { createMaterialImageModelDiff } from "./material-image-model-diff.js";

type MaterialImageOperationType = "addDrawableFromImage" | "replaceDrawableImage";
type MaterialImageRequest = Extract<OperationRequestDto, { operationType: MaterialImageOperationType }>;

/**
 * Synchronous handlers. The host must register the normalized RGBA bytes (registerMaterialImageBytes with
 * createMaterialImageIdSeed(operationId)) before dry-run and before commit; this handler neither reads the image
 * file nor computes SHA-256, and rejects when the registered digest differs from `payload.image.rgbaSha256`.
 */
const createMaterialImageOperationHandler = (operationType: MaterialImageOperationType): OperationHandler => ({
  operationType,

  dryRun(session, request, operationId) {
    // The authoring-core functions never mutate their input; the candidate is always a new session.
    return applyMaterialImageOperation(operationType, session, request, operationId, "dry_run");
  },

  commit(session, request, operationId) {
    const applied = applyMaterialImageOperation(operationType, session, request, operationId, "committed");
    if (applied.result.status !== "committed") {
      return { ...applied, candidateSession: session };
    }

    replaceAuthoringSession(session, applied.candidateSession);
    return { ...applied, candidateSession: session };
  }
});

export const addDrawableFromImageOperationHandler = createMaterialImageOperationHandler("addDrawableFromImage");
export const replaceDrawableImageOperationHandler = createMaterialImageOperationHandler("replaceDrawableImage");

const applyMaterialImageOperation = (
  operationType: MaterialImageOperationType,
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed"
): OperationApplyOutcome => {
  if (request.operationType !== operationType) {
    return reject(session, operationId, [], [
      createOperationDiagnostic({
        checkId: `operation.${operationType}.unsupportedPayload`,
        message: `${operationType} handler cannot apply ${request.operationType}.`,
        target: { kind: "operation", id: operationId }
      })
    ]);
  }

  const imageRequest = request as MaterialImageRequest;
  const checkedTargetRefs = createCheckedTargetRefs(session, imageRequest);
  const targetIds = checkedTargetRefs.map((target) => target.id);
  const lockedDiagnostics = createLockedTargetDiagnostics({
    operationType,
    lockedTargetIds: imageRequest.payload.lockedTargetIds,
    targets: checkedTargetRefs
  });
  if (lockedDiagnostics.length > 0) {
    return reject(session, operationId, targetIds, lockedDiagnostics);
  }

  const outcome = runAuthoringCore(session, imageRequest, createMaterialImageIdSeed(operationId));
  if (outcome.status === "rejected") {
    return reject(session, operationId, targetIds, outcome.diagnostics.map((diagnostic) =>
      createOperationDiagnostic({
        checkId: `operation.${operationType}.${diagnostic.checkId.replace(/^material\./, "")}`,
        message: diagnostic.message,
        target: diagnostic.target,
        evidence: diagnostic.evidence
      })));
  }

  const result = OperationResultSchema.parse({
    schemaVersion: "operation-result-v1",
    operationId,
    status,
    precondition: createPreconditionResult([], checkedTargetRefs),
    modelDiff: createMaterialImageModelDiff({
      operationId,
      before: session,
      after: outcome.session,
      intent: imageRequest.payload.intent,
      impact: outcome.impact,
      assets: outcome.assets
    }),
    runtimeDiff: undefined,
    validationDiff: undefined,
    diagnostics: [],
    generatedRuntimeSnapshotIds: [],
    generatedRuntimeStateRefs: [],
    generatedRuntimeStateSequenceRefs: [],
    generatedValidationReportIds: [],
    reversible: true
  });

  return { result, targetIds, candidateSession: outcome.session };
};

const runAuthoringCore = (
  session: AuthoringSession,
  request: MaterialImageRequest,
  idSeed: string
): MaterialImageDrawableResult => {
  const { image, placement, provenanceNote } = request.payload;
  const input = {
    image: { rgbaSha256: image.rgbaSha256, width: image.width, height: image.height, contentInset: image.contentInset },
    placement,
    provenanceNote,
    idSeed
  };

  return request.operationType === "addDrawableFromImage"
    ? addDrawableFromImage(session, { ...input, intent: request.payload.intent })
    : replaceDrawableImage(session, { ...input, intent: request.payload.intent });
};

/** Everything the operation changes, so lockedTargetIds can protect it. */
const createCheckedTargetRefs = (session: AuthoringSession, request: MaterialImageRequest): TargetRefDto[] => {
  const intent = request.payload.intent;
  const drawable: TargetRefDto = { kind: "drawable", id: intent.drawableId };
  if (intent.kind === "replace") {
    const existing = session.graph.drawables.find((item) => item.drawableId === intent.drawableId);
    return [
      drawable,
      ...(existing === undefined ? [] : [
        { kind: "mesh", id: existing.meshId } as const,
        { kind: "texture", id: existing.textureId } as const
      ]),
      ...intent.geometryReset.keyformSetIds.map((id): TargetRefDto => ({ kind: "keyformSet", id }))
    ];
  }

  const insertion = intent.insertion;
  const sibling: TargetRefDto[] = !("sibling" in insertion) ? []
    : insertion.sibling.kind === "part"
      ? [{ kind: "part", id: insertion.sibling.partId }]
      : [{ kind: "drawable", id: insertion.sibling.drawableId }];
  return [
    drawable,
    { kind: "part", id: intent.parentPartId },
    ...sibling,
    ...intent.rigControlIds.map((id): TargetRefDto => ({ kind: "rigControl", id })),
    ...intent.maskBindings.map((binding): TargetRefDto => ({ kind: "maskRelation", id: binding.maskRelationId }))
  ];
};

const reject = (
  session: AuthoringSession,
  operationId: OperationId,
  targetIds: readonly string[],
  diagnostics: readonly DiagnosticDto[]
): OperationApplyOutcome => ({
  result: createRejectedOperationResult({ operationId, diagnostics }),
  targetIds,
  candidateSession: session
});

const replaceAuthoringSession = (target: AuthoringSession, source: AuthoringSession): void => {
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
