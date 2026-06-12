import { z } from "zod";

export const ParameterKindSchema = z.enum(["preset", "custom"]);
export type ParameterKindDto = z.infer<typeof ParameterKindSchema>;

export const ParameterTypeSchema = z.literal("scalar");
export type ParameterTypeDto = z.infer<typeof ParameterTypeSchema>;

export const ParameterGroupSchema = z.enum([
  "face",
  "eyes",
  "mouth",
  "browCheek",
  "body",
  "secondary",
  "custom"
]);
export type ParameterGroupDto = z.infer<typeof ParameterGroupSchema>;

export const ParameterLockedFieldSchema = z.enum([
  "parameterId",
  "semanticRole",
  "projectPresetAlias",
  "presetRole",
  "kind",
  "parameterType",
  "group",
  "valueSource",
  "min",
  "max",
  "default",
  "recommendedUiStep",
  "signConvention"
]);
export type ParameterLockedFieldDto = z.infer<typeof ParameterLockedFieldSchema>;

export const ParameterSignConventionSchema = z.object({
  min: z.string().min(1),
  default: z.string().min(1),
  max: z.string().min(1)
});
export type ParameterSignConventionDto = z.infer<typeof ParameterSignConventionSchema>;

export const PRESET_PARAMETER_LOCKED_FIELDS: readonly ParameterLockedFieldDto[] = [
  "parameterId",
  "semanticRole",
  "projectPresetAlias",
  "presetRole",
  "kind",
  "parameterType",
  "group",
  "valueSource",
  "min",
  "max",
  "default",
  "recommendedUiStep",
  "signConvention"
];
