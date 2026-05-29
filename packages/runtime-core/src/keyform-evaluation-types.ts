import { KeyformSetIdSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const KeyformEvaluatorSchema = z.enum(["linear-1d-v1", "parameter-grid-2d-v1"]);
export type KeyformEvaluator = z.infer<typeof KeyformEvaluatorSchema>;

export const KeyformSampleSchema = z
  .object({
    keyformSetId: KeyformSetIdSchema,
    evaluator: KeyformEvaluatorSchema,
    sampledCoordinates: z.record(z.string(), z.number().finite()),
    target: z.string()
  })
  .passthrough();
export type KeyformSampleDto = z.infer<typeof KeyformSampleSchema>;
