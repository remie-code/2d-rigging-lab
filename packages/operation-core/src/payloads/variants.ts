import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

const idTokenPattern = "[A-Za-z0-9_-]+";
const VariantGroupIdSchema = z.string().regex(new RegExp(`^vgrp_${idTokenPattern}$`));
const VariantIdSchema = z.string().regex(new RegExp(`^var_${idTokenPattern}$`));
const VariantGroupModeSchema = z.enum(["singleSelect", "multiToggle"]);
const VariantDefaultActiveSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("singleSelect"),
    variantId: VariantIdSchema
  }).strict(),
  z.object({
    kind: z.literal("multiToggle"),
    variantIds: z.array(VariantIdSchema).default([])
  }).strict()
]);

const NonBlankDisplayNameSchema = z.string().min(1).refine(
  (value) => value.trim().length > 0,
  { message: "displayName must not be blank" }
);

export const CreateVariantGroupPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  displayName: NonBlankDisplayNameSchema,
  mode: VariantGroupModeSchema,
  initialVariantId: VariantIdSchema.optional(),
  initialVariantName: NonBlankDisplayNameSchema.optional()
});
export type CreateVariantGroupPayloadDto = z.infer<typeof CreateVariantGroupPayloadSchema>;

export const UpdateVariantGroupPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  displayName: NonBlankDisplayNameSchema.optional(),
  mode: VariantGroupModeSchema.optional()
}).refine(
  (payload) => payload.displayName !== undefined || payload.mode !== undefined,
  {
    message: "updateVariantGroup requires displayName or mode",
    path: ["displayName"]
  }
);
export type UpdateVariantGroupPayloadDto = z.infer<typeof UpdateVariantGroupPayloadSchema>;

export const DeleteVariantGroupPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema
});
export type DeleteVariantGroupPayloadDto = z.infer<typeof DeleteVariantGroupPayloadSchema>;

export const CreateVariantPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  variantId: VariantIdSchema,
  displayName: NonBlankDisplayNameSchema
});
export type CreateVariantPayloadDto = z.infer<typeof CreateVariantPayloadSchema>;

export const UpdateVariantPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  variantId: VariantIdSchema,
  displayName: NonBlankDisplayNameSchema
});
export type UpdateVariantPayloadDto = z.infer<typeof UpdateVariantPayloadSchema>;

export const DeleteVariantPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  variantId: VariantIdSchema
});
export type DeleteVariantPayloadDto = z.infer<typeof DeleteVariantPayloadSchema>;

export const AddVariantTargetDrawablePayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  drawableId: DrawableIdSchema
});
export type AddVariantTargetDrawablePayloadDto = z.infer<
  typeof AddVariantTargetDrawablePayloadSchema
>;

export const RemoveVariantTargetDrawablePayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  drawableId: DrawableIdSchema
});
export type RemoveVariantTargetDrawablePayloadDto = z.infer<
  typeof RemoveVariantTargetDrawablePayloadSchema
>;

export const SetVariantMembershipPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  drawableId: DrawableIdSchema,
  variantId: VariantIdSchema,
  member: z.boolean()
});
export type SetVariantMembershipPayloadDto = z.infer<typeof SetVariantMembershipPayloadSchema>;

export const SetVariantDefaultActiveSelectionPayloadSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  defaultActive: VariantDefaultActiveSelectionSchema
});
export type SetVariantDefaultActiveSelectionPayloadDto = z.infer<
  typeof SetVariantDefaultActiveSelectionPayloadSchema
>;
