import {
  OperationIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema,
  TransactionIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
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

const operationToken = (request: OperationRequestDto): string => {
  if (request.operationType === "createParameter") {
    return `create_parameter_${sanitizeIdToken(
      request.payload.parameterId?.replace(/^param_/, "") ?? request.payload.displayName
    )}`;
  }

  return sanitizeIdToken(request.operationType);
};

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : sanitizeIdToken(id);

const sanitizeIdToken = (value: string): string => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.length > 0 ? normalized : "unnamed";
};
