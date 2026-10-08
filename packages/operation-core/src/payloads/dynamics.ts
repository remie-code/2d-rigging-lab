import {
  DynamicsGroupIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

// Dynamics v3 world-frame chain operation payloads. See
// discussion/design/dynamics-world-frame-chain.md §4. The payload mirrors the package-format v3
// schema: inputs carry one signed `scale`, the chain replaces the old pendulums array, and outputs
// read one chain segment (`segmentIndex`) with a signed `scale` and clamp `limit`.

export const DynamicsAxisKindPayloadSchema = z.enum(["angle", "positionX", "positionY"]);
export type DynamicsAxisKindPayloadDto = z.infer<typeof DynamicsAxisKindPayloadSchema>;

export const DynamicsInputPayloadSchema = z.object({
  parameterId: ParameterIdSchema,
  kind: DynamicsAxisKindPayloadSchema,
  scale: z.number().finite()
});
export type DynamicsInputPayloadDto = z.infer<typeof DynamicsInputPayloadSchema>;

export const DynamicsChainRootOffsetPayloadSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite()
});
export type DynamicsChainRootOffsetPayloadDto = z.infer<typeof DynamicsChainRootOffsetPayloadSchema>;

export const DynamicsChainPayloadSchema = z.object({
  rootOffset: DynamicsChainRootOffsetPayloadSchema.default({ x: 0, y: 0 }),
  segmentLengths: z.array(z.number().finite().positive()).min(1),
  damping: z.number().finite().nonnegative(),
  gravityScale: z.number().finite().nonnegative()
});
export type DynamicsChainPayloadDto = z.infer<typeof DynamicsChainPayloadSchema>;

export const DynamicsOutputPayloadSchema = z.object({
  parameterId: ParameterIdSchema,
  segmentIndex: z.number().int().min(1).default(1),
  scale: z.number().finite(),
  limit: z.number().finite().nonnegative()
});
export type DynamicsOutputPayloadDto = z.infer<typeof DynamicsOutputPayloadSchema>;

export const CreateDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema.optional(),
  displayName: z.string().min(1),
  enabled: z.boolean().default(true),
  presetId: z.string().min(1).optional(),
  inputs: z.array(DynamicsInputPayloadSchema).min(1).optional(),
  chain: DynamicsChainPayloadSchema.optional(),
  outputs: z.array(DynamicsOutputPayloadSchema).min(1).optional()
});
export type CreateDynamicsGroupPayloadDto = z.infer<typeof CreateDynamicsGroupPayloadSchema>;

export const UpdateDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  displayName: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  presetId: z.string().min(1).optional(),
  inputs: z.array(DynamicsInputPayloadSchema).min(1).optional(),
  chain: DynamicsChainPayloadSchema.optional(),
  outputs: z.array(DynamicsOutputPayloadSchema).min(1).optional()
});
export type UpdateDynamicsGroupPayloadDto = z.infer<typeof UpdateDynamicsGroupPayloadSchema>;

export const DeleteDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema
});
export type DeleteDynamicsGroupPayloadDto = z.infer<typeof DeleteDynamicsGroupPayloadSchema>;
