import {
  MaterialAddIntentSchema,
  MaterialImageFileRefSchema,
  MaterialPlacementSchema,
  MaterialReplaceIntentSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

const LockedTargetIdsSchema = z.array(z.string().min(1)).default([]);

/**
 * Payload fields shared by the two image operations. `image.imagePath` is for the host, which reads the PNG,
 * normalizes it, checks `image.rgbaSha256` and registers the RGBA bytes before dry-run/commit. Operation Core
 * never reads files; it only requires those registered bytes to carry the same SHA-256.
 */
const materialImagePayloadFields = {
  image: MaterialImageFileRefSchema,
  placement: MaterialPlacementSchema,
  provenanceNote: z.string().min(1),
  lockedTargetIds: LockedTargetIdsSchema
};

export const AddDrawableFromImagePayloadSchema = z.object({
  ...materialImagePayloadFields,
  intent: MaterialAddIntentSchema
}).strict();
export type AddDrawableFromImagePayloadDto = z.infer<typeof AddDrawableFromImagePayloadSchema>;

export const ReplaceDrawableImagePayloadSchema = z.object({
  ...materialImagePayloadFields,
  intent: MaterialReplaceIntentSchema
}).strict();
export type ReplaceDrawableImagePayloadDto = z.infer<typeof ReplaceDrawableImagePayloadSchema>;
