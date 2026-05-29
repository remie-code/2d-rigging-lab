import {
  KeyformSetIdSchema,
  OperationIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema,
  TransactionIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  KeyformSetId,
  OperationId,
  ParameterId,
  ProvenanceId,
  TransactionId
} from "@private-2d-rigging-lab/contracts";

import type { OperationRequestDto } from "./operation-request.js";

export const resolveOperationId = (request: OperationRequestDto): OperationId =>
  request.operationId ?? OperationIdSchema.parse(`op_${operationToken(request)}`);

export const createTransactionId = (operationId: OperationId): TransactionId =>
  TransactionIdSchema.parse(`txn_${stripIdPrefix(operationId, "op_")}`);

export const createProvenanceId = (operationId: OperationId): ProvenanceId =>
  ProvenanceIdSchema.parse(`prov_${stripIdPrefix(operationId, "op_")}`);

export const createParameterIdFromDisplayName = (displayName: string): ParameterId =>
  ParameterIdSchema.parse(`param_${sanitizeIdToken(displayName)}`);

export const createKeyformSetIdFromOperationRequest = (request: OperationRequestDto): KeyformSetId => {
  if (request.operationType === "addKeyform") {
    return KeyformSetIdSchema.parse(
      `keyset_${[
        request.payload.target.kind,
        request.payload.target.id,
        request.payload.targetProperty,
        stripIdPrefix(request.payload.parameterId, "param_"),
        numberToken(request.payload.keyValue)
      ].map(sanitizeIdToken).join("_")}`
    );
  }

  if (request.operationType === "addKeyformGrid2d") {
    return KeyformSetIdSchema.parse(
      `keyset_${[
        "grid",
        request.payload.target.kind,
        request.payload.target.id,
        request.payload.targetProperty,
        stripIdPrefix(request.payload.parameterX, "param_"),
        stripIdPrefix(request.payload.parameterY, "param_")
      ].map(sanitizeIdToken).join("_")}`
    );
  }

  throw new Error(`Cannot create keyform set id for ${request.operationType}.`);
};

const operationToken = (request: OperationRequestDto): string => {
  if (request.operationType === "createParameter") {
    return `create_parameter_${sanitizeIdToken(
      request.payload.parameterId?.replace(/^param_/, "") ?? request.payload.displayName
    )}`;
  }

  if (request.operationType === "addKeyform" || request.operationType === "addKeyformGrid2d") {
    return `add_keyform_${stripIdPrefix(createKeyformSetIdFromOperationRequest(request), "keyset_")}`;
  }

  return sanitizeIdToken(request.operationType);
};

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : sanitizeIdToken(id);

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};

const numberToken = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toString().replace("-", "minus_").replace(".", "_");
