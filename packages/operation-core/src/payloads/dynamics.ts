import {
  DynamicsGroupIdSchema,
  ParameterIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const DynamicsAxisKindPayloadSchema = z.enum(["angle", "positionX", "positionY"]);
export type DynamicsAxisKindPayloadDto = z.infer<typeof DynamicsAxisKindPayloadSchema>;

export const DynamicsNormalizationPayloadSchema = z
  .object({
    min: z.number().finite(),
    center: z.number().finite(),
    max: z.number().finite()
  })
  .superRefine((normalization, context) => {
    if (normalization.min >= normalization.center) {
      context.addIssue({
        code: "custom",
        path: ["min"],
        message: "Dynamics input normalization requires min < center."
      });
    }
    if (normalization.center >= normalization.max) {
      context.addIssue({
        code: "custom",
        path: ["max"],
        message: "Dynamics input normalization requires center < max."
      });
    }
  });
export type DynamicsNormalizationPayloadDto = z.infer<typeof DynamicsNormalizationPayloadSchema>;

export const DynamicsInputPayloadSchema = z.object({
  parameterId: ParameterIdSchema,
  kind: DynamicsAxisKindPayloadSchema,
  influencePercent: z.number().finite(),
  invert: z.boolean().default(false),
  normalization: DynamicsNormalizationPayloadSchema
});
export type DynamicsInputPayloadDto = z.infer<typeof DynamicsInputPayloadSchema>;

export const DynamicsPendulumPayloadSchema = z.object({
  length: z.number().finite().positive(),
  sway: z.number().finite().nonnegative(),
  reactionSpeed: z.number().finite().nonnegative(),
  convergenceSpeed: z.number().finite().nonnegative()
});
export type DynamicsPendulumPayloadDto = z.infer<typeof DynamicsPendulumPayloadSchema>;

export const DynamicsOutputPayloadSchema = z.object({
  parameterId: ParameterIdSchema,
  kind: DynamicsAxisKindPayloadSchema,
  strength: z.number().finite(),
  invert: z.boolean().default(false),
  limit: z.number().finite().nonnegative()
});
export type DynamicsOutputPayloadDto = z.infer<typeof DynamicsOutputPayloadSchema>;

export const CreateDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema.optional(),
  displayName: z.string().min(1),
  enabled: z.boolean().default(true),
  presetId: z.string().min(1).optional(),
  inputs: z.array(DynamicsInputPayloadSchema).min(1).optional(),
  pendulums: z.array(DynamicsPendulumPayloadSchema).length(1).optional(),
  outputs: z.array(DynamicsOutputPayloadSchema).length(1).optional()
});
export type CreateDynamicsGroupPayloadDto = z.infer<typeof CreateDynamicsGroupPayloadSchema>;

export const UpdateDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  displayName: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  presetId: z.string().min(1).optional(),
  inputs: z.array(DynamicsInputPayloadSchema).min(1).optional(),
  pendulums: z.array(DynamicsPendulumPayloadSchema).length(1).optional(),
  outputs: z.array(DynamicsOutputPayloadSchema).length(1).optional()
});
export type UpdateDynamicsGroupPayloadDto = z.infer<typeof UpdateDynamicsGroupPayloadSchema>;

export const DeleteDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema
});
export type DeleteDynamicsGroupPayloadDto = z.infer<typeof DeleteDynamicsGroupPayloadSchema>;
