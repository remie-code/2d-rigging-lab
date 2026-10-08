import {
  AuthoringMutationError,
  addVariantTargetDrawable,
  createDryRunAuthoringSession,
  createVariant,
  createVariantGroup,
  deleteVariant,
  deleteVariantGroup,
  removeVariantTargetDrawable,
  setVariantDefaultActiveSelection,
  setVariantMembership,
  updateVariant,
  updateVariantGroup
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type {
  DiagnosticDto,
  JsonValue,
  ModelDiffDto,
  OperationId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "../operation-request.js";
import type { OperationResultDto } from "../operation-result.js";
import { OperationResultSchema } from "../operation-result.js";
import type { OperationApplyOutcome, OperationHandler } from "../operation-registry.js";
import type { OperationType } from "../operation-type.js";
import {
  createOperationDiagnostic,
  createPreconditionResult,
  createRejectedOperationResult
} from "../preconditions.js";

type VariantOperationType =
  | "createVariantGroup"
  | "updateVariantGroup"
  | "deleteVariantGroup"
  | "createVariant"
  | "updateVariant"
  | "deleteVariant"
  | "addVariantTargetDrawable"
  | "removeVariantTargetDrawable"
  | "setVariantMembership"
  | "setVariantDefaultActiveSelection";

type VariantMutationResult = ReturnType<typeof createVariantGroup>;
type VariantGroupDto = VariantMutationResult["variantGroupsAfter"][number];
type VariantGroupIdDto = VariantGroupDto["variantGroupId"];
type VariantIdDto = VariantGroupDto["variants"][number]["variantId"];

export const createVariantGroupOperationHandler = createVariantOperationHandler("createVariantGroup");
export const updateVariantGroupOperationHandler = createVariantOperationHandler("updateVariantGroup");
export const deleteVariantGroupOperationHandler = createVariantOperationHandler("deleteVariantGroup");
export const createVariantOperationHandlerEntry = createVariantOperationHandler("createVariant");
export const updateVariantOperationHandler = createVariantOperationHandler("updateVariant");
export const deleteVariantOperationHandler = createVariantOperationHandler("deleteVariant");
export const addVariantTargetDrawableOperationHandler =
  createVariantOperationHandler("addVariantTargetDrawable");
export const removeVariantTargetDrawableOperationHandler =
  createVariantOperationHandler("removeVariantTargetDrawable");
export const setVariantMembershipOperationHandler =
  createVariantOperationHandler("setVariantMembership");
export const setVariantDefaultActiveSelectionOperationHandler =
  createVariantOperationHandler("setVariantDefaultActiveSelection");

function createVariantOperationHandler(operationType: VariantOperationType): OperationHandler {
  return {
    operationType,

    dryRun(session, request, operationId) {
      const dryRunSession = createDryRunAuthoringSession(session);
      return applyVariantOperation(dryRunSession, request, operationId, "dry_run", operationType);
    },

    commit(session, request, operationId) {
      return applyVariantOperation(session, request, operationId, "committed", operationType);
    }
  };
}

const applyVariantOperation = (
  session: AuthoringSession,
  request: OperationRequestDto,
  operationId: OperationId,
  status: "dry_run" | "committed",
  expectedOperationType: VariantOperationType
): OperationApplyOutcome => {
  if (request.operationType !== expectedOperationType) {
    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [
          createOperationDiagnostic({
            checkId: `operation.${expectedOperationType}.unsupportedPayload`,
            message: `${expectedOperationType} handler cannot apply ${request.operationType}.`,
            target: { kind: "operation", id: operationId }
          })
        ]
      }),
      targetIds: [],
      candidateSession: session
    };
  }

  const baseRevision = session.authoringRevision;
  const variantRequest = request as Extract<OperationRequestDto, { operationType: VariantOperationType }>;

  try {
    const mutation = applyVariantAuthoringMutation(session, variantRequest);
    const checkedTargets = createCheckedTargets(session, variantRequest);

    return {
      result: createVariantOperationResult({
        operationId,
        status,
        operationType: variantRequest.operationType,
        baseRevision,
        candidateRevision: mutation.authoringRevision,
        packageId: session.packageIdentity.packageId,
        before: mutation.variantGroupsBefore,
        after: mutation.variantGroupsAfter,
        checkedTargets,
        addedTargets: createAddedTargets(session, variantRequest),
        removedTargets: createRemovedTargets(session, variantRequest)
      }),
      targetIds: createTargetIds(variantRequest),
      candidateSession: session
    };
  } catch (error) {
    if (!(error instanceof AuthoringMutationError)) {
      throw error;
    }

    return {
      result: createRejectedOperationResult({
        operationId,
        diagnostics: [createVariantMutationDiagnostic(error, variantRequest, session)]
      }),
      targetIds: createTargetIds(variantRequest),
      candidateSession: session
    };
  }
};

const applyVariantAuthoringMutation = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: VariantOperationType }>
) => {
  switch (request.operationType) {
    case "createVariantGroup":
      return createVariantGroup(session, {
        group: createPackageVariantGroup(request)
      });
    case "updateVariantGroup":
      return updateVariantGroup(session, {
        variantGroupId: request.payload.variantGroupId,
        ...(request.payload.displayName === undefined ? {} : { displayName: request.payload.displayName }),
        ...(request.payload.mode === undefined ? {} : { mode: request.payload.mode })
      });
    case "deleteVariantGroup":
      return deleteVariantGroup(session, {
        variantGroupId: request.payload.variantGroupId
      });
    case "createVariant":
      return createVariant(session, {
        variantGroupId: request.payload.variantGroupId,
        variantId: request.payload.variantId,
        displayName: request.payload.displayName
      });
    case "updateVariant":
      return updateVariant(session, {
        variantGroupId: request.payload.variantGroupId,
        variantId: request.payload.variantId,
        displayName: request.payload.displayName
      });
    case "deleteVariant":
      return deleteVariant(session, {
        variantGroupId: request.payload.variantGroupId,
        variantId: request.payload.variantId
      });
    case "addVariantTargetDrawable":
      return addVariantTargetDrawable(session, {
        variantGroupId: request.payload.variantGroupId,
        drawableId: request.payload.drawableId
      });
    case "removeVariantTargetDrawable":
      return removeVariantTargetDrawable(session, {
        variantGroupId: request.payload.variantGroupId,
        drawableId: request.payload.drawableId
      });
    case "setVariantMembership":
      return setVariantMembership(session, {
        variantGroupId: request.payload.variantGroupId,
        drawableId: request.payload.drawableId,
        variantId: request.payload.variantId,
        member: request.payload.member
      });
    case "setVariantDefaultActiveSelection":
      return setVariantDefaultActiveSelection(session, {
        variantGroupId: request.payload.variantGroupId,
        defaultActive: request.payload.defaultActive
      });
  }
};

const createPackageVariantGroup = (
  request: Extract<OperationRequestDto, { operationType: "createVariantGroup" }>
): VariantGroupDto => {
  const initialVariantId = request.payload.initialVariantId ??
    createDefaultVariantId(request.payload.variantGroupId);
  const initialVariantName = request.payload.initialVariantName ?? "Default";
  const variants = request.payload.mode === "singleSelect" || request.payload.initialVariantId !== undefined
    ? [{ variantId: initialVariantId, displayName: initialVariantName }]
    : [];

  return {
    variantGroupId: request.payload.variantGroupId,
    displayName: request.payload.displayName,
    mode: request.payload.mode,
    variants,
    targetDrawableIds: [],
    memberships: [],
    defaultActive: request.payload.mode === "singleSelect"
      ? { kind: "singleSelect", variantId: initialVariantId }
      : { kind: "multiToggle", variantIds: [] }
  };
};

const createVariantOperationResult = (input: {
  readonly operationId: OperationId;
  readonly status: "dry_run" | "committed";
  readonly operationType: OperationType;
  readonly baseRevision: number;
  readonly candidateRevision: number;
  readonly packageId: string;
  readonly before: readonly VariantGroupDto[];
  readonly after: readonly VariantGroupDto[];
  readonly checkedTargets: readonly TargetRefDto[];
  readonly addedTargets: readonly TargetRefDto[];
  readonly removedTargets: readonly TargetRefDto[];
}): OperationResultDto => {
  const variantsTarget: TargetRefDto = {
    kind: "package",
    id: input.packageId,
    path: "/model/variants/variantGroups"
  };
  const modelDiff: ModelDiffDto = {
    schemaVersion: "model-diff-v1",
    baseRevision: input.baseRevision,
    candidateRevision: input.candidateRevision,
    added: [...input.addedTargets],
    removed: [...input.removedTargets],
    changed: [
      {
        target: variantsTarget,
        fields: [
          {
            path: "/model/variants/variantGroups",
            before: toJsonValue(input.before),
            after: toJsonValue(input.after)
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

const createCheckedTargets = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: VariantOperationType }>
): readonly TargetRefDto[] => {
  const packageTarget = createVariantPackageTarget(
    session.packageIdentity.packageId,
    request.payload.variantGroupId
  );

  switch (request.operationType) {
    case "addVariantTargetDrawable":
    case "removeVariantTargetDrawable":
      return [
        packageTarget,
        { kind: "drawable", id: request.payload.drawableId }
      ];
    case "setVariantMembership":
      return [
        packageTarget,
        {
          kind: "package",
          id: session.packageIdentity.packageId,
          path: createVariantPath(request.payload.variantGroupId, request.payload.variantId)
        },
        { kind: "drawable", id: request.payload.drawableId }
      ];
    case "createVariant":
    case "updateVariant":
    case "deleteVariant":
      return [
        packageTarget,
        {
          kind: "package",
          id: session.packageIdentity.packageId,
          path: createVariantPath(request.payload.variantGroupId, request.payload.variantId)
        }
      ];
    default:
      return [packageTarget];
  }
};

const createAddedTargets = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: VariantOperationType }>
): readonly TargetRefDto[] => {
  if (request.operationType === "createVariantGroup") {
    return [createVariantPackageTarget(session.packageIdentity.packageId, request.payload.variantGroupId)];
  }

  if (request.operationType === "createVariant") {
    return [{
      kind: "package",
      id: session.packageIdentity.packageId,
      path: createVariantPath(request.payload.variantGroupId, request.payload.variantId)
    }];
  }

  if (request.operationType === "addVariantTargetDrawable") {
    return [{
      kind: "drawable",
      id: request.payload.drawableId,
      path: `${createVariantGroupPath(request.payload.variantGroupId)}/targetDrawableIds`
    }];
  }

  return [];
};

const createRemovedTargets = (
  session: AuthoringSession,
  request: Extract<OperationRequestDto, { operationType: VariantOperationType }>
): readonly TargetRefDto[] => {
  if (request.operationType === "deleteVariantGroup") {
    return [createVariantPackageTarget(session.packageIdentity.packageId, request.payload.variantGroupId)];
  }

  if (request.operationType === "deleteVariant") {
    return [{
      kind: "package",
      id: session.packageIdentity.packageId,
      path: createVariantPath(request.payload.variantGroupId, request.payload.variantId)
    }];
  }

  if (request.operationType === "removeVariantTargetDrawable") {
    return [{
      kind: "drawable",
      id: request.payload.drawableId,
      path: `${createVariantGroupPath(request.payload.variantGroupId)}/targetDrawableIds`
    }];
  }

  return [];
};

const createVariantMutationDiagnostic = (
  error: AuthoringMutationError,
  request: Extract<OperationRequestDto, { operationType: VariantOperationType }>,
  session: AuthoringSession
): DiagnosticDto => {
  const checkIdByCode: Partial<Record<AuthoringMutationError["code"], string>> = {
    duplicate_variant_group: `operation.${request.operationType}.duplicateVariantGroup`,
    missing_variant_group: `operation.${request.operationType}.missingVariantGroup`,
    invalid_variant_group_display_name: `operation.${request.operationType}.invalidGroupDisplayName`,
    no_op_variant_group_update: `operation.${request.operationType}.noOp`,
    duplicate_variant: `operation.${request.operationType}.duplicateVariant`,
    missing_variant: `operation.${request.operationType}.missingVariant`,
    invalid_variant_display_name: `operation.${request.operationType}.invalidVariantDisplayName`,
    last_variant_delete: `operation.${request.operationType}.lastVariantDelete`,
    duplicate_variant_target_drawable: `operation.${request.operationType}.duplicateTargetDrawable`,
    variant_target_drawable_already_owned: `operation.${request.operationType}.targetDrawableAlreadyOwned`,
    missing_variant_target_drawable: `operation.${request.operationType}.missingTargetDrawable`,
    missing_variant_membership: `operation.${request.operationType}.missingMembership`,
    no_op_variant_membership_update: `operation.${request.operationType}.noOp`,
    invalid_variant_default_active: `operation.${request.operationType}.invalidDefaultActive`,
    missing_drawable: `operation.${request.operationType}.missingDrawable`
  };

  return createOperationDiagnostic({
    checkId: checkIdByCode[error.code] ?? `operation.${request.operationType}.authoringMutationFailed`,
    message: error.message,
    target: createVariantPackageTarget(session.packageIdentity.packageId, request.payload.variantGroupId),
    severity: error.code === "no_op_variant_group_update" ||
      error.code === "no_op_variant_membership_update"
      ? "warning"
      : "error"
  });
};

const createTargetIds = (
  request: Extract<OperationRequestDto, { operationType: VariantOperationType }>
): readonly string[] => {
  switch (request.operationType) {
    case "createVariant":
    case "updateVariant":
    case "deleteVariant":
      return [request.payload.variantGroupId, request.payload.variantId];
    case "addVariantTargetDrawable":
    case "removeVariantTargetDrawable":
      return [request.payload.variantGroupId, request.payload.drawableId];
    case "setVariantMembership":
      return [request.payload.variantGroupId, request.payload.drawableId, request.payload.variantId];
    default:
      return [request.payload.variantGroupId];
  }
};

const createVariantPackageTarget = (
  packageId: string,
  variantGroupId: VariantGroupIdDto
): TargetRefDto => ({
  kind: "package",
  id: packageId,
  path: createVariantGroupPath(variantGroupId)
});

const createVariantGroupPath = (variantGroupId: VariantGroupIdDto): string =>
  `/model/variants/variantGroups/${variantGroupId}`;

const createVariantPath = (
  variantGroupId: VariantGroupIdDto,
  variantId: VariantIdDto
): string => `${createVariantGroupPath(variantGroupId)}/variants/${variantId}`;

const createDefaultVariantId = (variantGroupId: VariantGroupIdDto): VariantIdDto =>
  `var_${variantGroupId.replace(/^vgrp_/, "")}_default` as VariantIdDto;

const toJsonValue = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
