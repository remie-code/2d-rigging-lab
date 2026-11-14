import { ReferenceImageStateSchema, ReferenceImageUpdateSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const ReferenceImageCommandPayloadSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("get") }),
  z.strictObject({
    action: z.literal("register"),
    imagePath: z.string().min(1),
    settings: ReferenceImageUpdateSchema.optional()
  }),
  z.strictObject({ action: z.literal("update"), settings: ReferenceImageUpdateSchema }),
  z.strictObject({ action: z.literal("remove") })
]);
export type ReferenceImageCommandPayload = z.infer<typeof ReferenceImageCommandPayloadSchema>;

export const ReferenceImageCommandResultSchema = z.strictObject({
  reference: ReferenceImageStateSchema.nullable()
});
