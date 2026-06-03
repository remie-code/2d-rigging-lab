import {
  JsonValueSchema,
  type JsonValue
} from "@private-2d-rigging-lab/contracts";

export const toModelDiffJsonValue = (value: unknown): JsonValue =>
  JsonValueSchema.parse(value);
