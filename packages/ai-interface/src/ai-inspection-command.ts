import { TargetRefSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const InspectModelPayloadSchema = z.object({
  includeEditorOnly: z.boolean().default(false),
  includeRuntimeOnly: z.boolean().default(true)
});
export type InspectModelPayload = z.infer<typeof InspectModelPayloadSchema>;

export const InspectTargetPayloadSchema = z.object({
  target: TargetRefSchema,
  includeReferences: z.boolean().default(true)
});
export type InspectTargetPayload = z.infer<typeof InspectTargetPayloadSchema>;

export const InspectModelResultSchema = z
  .object({
    targets: z.array(TargetRefSchema).default([]),
    editableTargets: z.array(TargetRefSchema).default([])
  })
  .passthrough();
export type InspectModelResult = z.infer<typeof InspectModelResultSchema>;

export const InspectTargetResultSchema = z
  .object({
    target: TargetRefSchema,
    references: z.array(TargetRefSchema).default([])
  })
  .passthrough();
export type InspectTargetResult = z.infer<typeof InspectTargetResultSchema>;
