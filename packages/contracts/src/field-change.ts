import { z } from "zod";

import { JsonPointerSchema, JsonValueSchema } from "./json-value.js";

export const FieldChangeSchema = z.object({
  path: JsonPointerSchema,
  before: JsonValueSchema,
  after: JsonValueSchema
});
export type FieldChangeDto = z.infer<typeof FieldChangeSchema>;
export const FieldChangeDtoSchema = FieldChangeSchema;
