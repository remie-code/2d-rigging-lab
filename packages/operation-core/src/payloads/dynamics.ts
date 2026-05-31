import {
  DynamicsGroupIdSchema,
  ParameterIdSchema,
  RuntimeEvaluationContextSchema,
  RuntimeResetReasonSchema,
  RuntimeSequenceFrameSchema,
  RuntimeStateArtifactRefSchema,
  RuntimeStateDtoSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const DynamicsResetPolicySchema = z.enum([
  "reset-on-load",
  "reset-on-manual-command",
  "reset-on-large-input-jump"
]);
export type DynamicsResetPolicy = z.infer<typeof DynamicsResetPolicySchema>;

export const DynamicsSettingsSchema = z.object({
  stiffness: z.number().finite().nonnegative(),
  damping: z.number().finite().nonnegative(),
  maxVelocity: z.number().finite().positive().optional(),
  maxAmplitude: z.number().finite().positive().optional()
});
export type DynamicsSettingsDto = z.infer<typeof DynamicsSettingsSchema>;

export const DynamicsDriverBindingPayloadSchema = z.object({
  driverId: z.string().optional(),
  sourceParameterId: ParameterIdSchema,
  inputScale: z.number().finite().default(1),
  inputOffset: z.number().finite().default(0),
  invert: z.boolean().default(false)
});
export type DynamicsDriverBindingPayloadDto = z.infer<typeof DynamicsDriverBindingPayloadSchema>;

const dynamicsOutputBindingPayloadShape = {
  outputId: z.string().optional(),
  targetParameterId: ParameterIdSchema,
  outputScale: z.number().finite().default(1),
  outputOffset: z.number().finite().default(0),
  min: z.number().finite(),
  max: z.number().finite(),
  clampPolicy: z.literal("clamp-to-output-range")
};

export const DynamicsOutputBindingPayloadSchema = z
  .object(dynamicsOutputBindingPayloadShape)
  .refine((payload) => payload.min <= payload.max, {
    message: "min must be less than or equal to max",
    path: ["min"]
  });
export type DynamicsOutputBindingPayloadDto = z.infer<typeof DynamicsOutputBindingPayloadSchema>;

export const CreateDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema.optional(),
  displayName: z.string().min(1),
  enabled: z.boolean().default(true),
  solverKind: z.literal("scalarDampedFollowV1"),
  resetPolicy: DynamicsResetPolicySchema,
  settings: DynamicsSettingsSchema,
  drivers: z.array(DynamicsDriverBindingPayloadSchema).min(1).optional(),
  output: DynamicsOutputBindingPayloadSchema.optional()
});
export type CreateDynamicsGroupPayloadDto = z.infer<typeof CreateDynamicsGroupPayloadSchema>;

export const UpdateDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  displayName: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
  resetPolicy: DynamicsResetPolicySchema.optional()
});
export type UpdateDynamicsGroupPayloadDto = z.infer<typeof UpdateDynamicsGroupPayloadSchema>;

export const DeleteDynamicsGroupPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema
});
export type DeleteDynamicsGroupPayloadDto = z.infer<typeof DeleteDynamicsGroupPayloadSchema>;

export const BindDynamicsDriverPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  ...DynamicsDriverBindingPayloadSchema.shape
});
export type BindDynamicsDriverPayloadDto = z.infer<typeof BindDynamicsDriverPayloadSchema>;

export const BindDynamicsOutputPayloadSchema = z
  .object({
    dynamicsGroupId: DynamicsGroupIdSchema,
    ...dynamicsOutputBindingPayloadShape
  })
  .refine((payload) => payload.min <= payload.max, {
    message: "min must be less than or equal to max",
    path: ["min"]
  });
export type BindDynamicsOutputPayloadDto = z.infer<typeof BindDynamicsOutputPayloadSchema>;

export const SetDynamicsSettingsPayloadSchema = z.object({
  dynamicsGroupId: DynamicsGroupIdSchema,
  stiffness: z.number().finite().nonnegative(),
  damping: z.number().finite().nonnegative(),
  maxVelocity: z.number().finite().positive().optional(),
  maxAmplitude: z.number().finite().positive().optional()
});
export type SetDynamicsSettingsPayloadDto = z.infer<typeof SetDynamicsSettingsPayloadSchema>;

export const ResetDynamicsPreviewStatePayloadSchema = z.object({
  dynamicsGroupIds: z.array(DynamicsGroupIdSchema).optional(),
  reason: RuntimeResetReasonSchema
});
export type ResetDynamicsPreviewStatePayloadDto = z.infer<typeof ResetDynamicsPreviewStatePayloadSchema>;

export const RunDynamicsPreviewSequencePayloadSchema = z.object({
  frames: z.array(RuntimeSequenceFrameSchema).min(1),
  initialState: RuntimeStateDtoSchema.optional(),
  initialStateRef: RuntimeStateArtifactRefSchema.optional(),
  fixedStepMs: z.number().positive().default(16.6666667),
  maxSubSteps: z.number().int().min(1).max(16).default(4),
  detail: z.enum(["summary", "targeted", "full"]).default("targeted"),
  context: RuntimeEvaluationContextSchema.optional()
});
export type RunDynamicsPreviewSequencePayloadDto = z.infer<typeof RunDynamicsPreviewSequencePayloadSchema>;
