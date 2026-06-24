import { z } from "zod";

import { DrawableIdSchema } from "@private-2d-rigging-lab/contracts";

export const VARIANTS_FILE_SCHEMA_VERSION = "variants-file-v1";
export const VARIANTS_MODEL_FILE_PATH = "model/variants.json";

const idTokenPattern = "[A-Za-z0-9_-]+";

export const VariantGroupIdSchema = z.string().regex(
  new RegExp(`^vgrp_${idTokenPattern}$`)
);
export type VariantGroupIdDto = z.infer<typeof VariantGroupIdSchema>;

export const VariantIdSchema = z.string().regex(
  new RegExp(`^var_${idTokenPattern}$`)
);
export type VariantIdDto = z.infer<typeof VariantIdSchema>;

export const VariantGroupModeSchema = z.enum(["singleSelect", "multiToggle"]);
export type VariantGroupModeDto = z.infer<typeof VariantGroupModeSchema>;

export const VariantSchema = z.object({
  variantId: VariantIdSchema,
  displayName: z.string().min(1)
}).strict();
export type VariantDto = z.infer<typeof VariantSchema>;

export const VariantMembershipSchema = z.object({
  drawableId: DrawableIdSchema,
  variantIds: z.array(VariantIdSchema)
}).strict().superRefine((membership, context) => {
  addDuplicateIssue({
    values: membership.variantIds,
    context,
    path: ["variantIds"],
    message: "Variant membership variantIds must be unique."
  });
});
export type VariantMembershipDto = z.infer<typeof VariantMembershipSchema>;

export const VariantDefaultActiveSelectionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("singleSelect"),
    variantId: VariantIdSchema
  }).strict(),
  z.object({
    kind: z.literal("multiToggle"),
    variantIds: z.array(VariantIdSchema).default([])
  }).strict().superRefine((selection, context) => {
    addDuplicateIssue({
      values: selection.variantIds,
      context,
      path: ["variantIds"],
      message: "multiToggle default active variantIds must be unique."
    });
  })
]);
export type VariantDefaultActiveSelectionDto = z.infer<
  typeof VariantDefaultActiveSelectionSchema
>;

export const VariantGroupSchema = z.object({
  variantGroupId: VariantGroupIdSchema,
  displayName: z.string().min(1),
  mode: VariantGroupModeSchema,
  variants: z.array(VariantSchema),
  targetDrawableIds: z.array(DrawableIdSchema),
  memberships: z.array(VariantMembershipSchema),
  defaultActive: VariantDefaultActiveSelectionSchema
}).strict().superRefine((group, context) => {
  const variantIds = group.variants.map((variant) => variant.variantId);
  const variantIdSet = new Set(variantIds);
  const targetDrawableIdSet = new Set(group.targetDrawableIds);
  const membershipDrawableIds = group.memberships.map((membership) => membership.drawableId);

  addDuplicateIssue({
    values: variantIds,
    context,
    path: ["variants"],
    message: "Variant IDs must be unique within a group."
  });
  addDuplicateIssue({
    values: group.targetDrawableIds,
    context,
    path: ["targetDrawableIds"],
    message: "Target drawable IDs must be unique within a group."
  });
  addDuplicateIssue({
    values: membershipDrawableIds,
    context,
    path: ["memberships"],
    message: "Membership rows must be unique per drawable."
  });

  if (group.mode === "singleSelect" && group.variants.length === 0) {
    context.addIssue({
      code: "custom",
      path: ["variants"],
      message: "singleSelect Variant Groups require at least one Variant."
    });
  }

  if (group.mode !== group.defaultActive.kind) {
    context.addIssue({
      code: "custom",
      path: ["defaultActive"],
      message: "Variant Group mode must match defaultActive kind."
    });
  }

  group.memberships.forEach((membership, membershipIndex) => {
    if (!targetDrawableIdSet.has(membership.drawableId)) {
      context.addIssue({
        code: "custom",
        path: ["memberships", membershipIndex, "drawableId"],
        message: `Membership drawableId must be listed in targetDrawableIds: ${membership.drawableId}.`
      });
    }

    membership.variantIds.forEach((variantId, variantIndex) => {
      if (!variantIdSet.has(variantId)) {
        context.addIssue({
          code: "custom",
          path: ["memberships", membershipIndex, "variantIds", variantIndex],
          message: `Membership references missing Variant: ${variantId}.`
        });
      }
    });
  });

  group.targetDrawableIds.forEach((drawableId, index) => {
    if (!membershipDrawableIds.includes(drawableId)) {
      context.addIssue({
        code: "custom",
        path: ["targetDrawableIds", index],
        message: `Target drawable must have a membership row: ${drawableId}.`
      });
    }
  });

  if (group.defaultActive.kind === "singleSelect") {
    if (!variantIdSet.has(group.defaultActive.variantId)) {
      context.addIssue({
        code: "custom",
        path: ["defaultActive", "variantId"],
        message: `Default active selection references missing Variant: ${group.defaultActive.variantId}.`
      });
    }
  } else {
    group.defaultActive.variantIds.forEach((variantId, index) => {
      if (!variantIdSet.has(variantId)) {
        context.addIssue({
          code: "custom",
          path: ["defaultActive", "variantIds", index],
          message: `Default active selection references missing Variant: ${variantId}.`
        });
      }
    });
  }
});
export type VariantGroupDto = z.infer<typeof VariantGroupSchema>;

export const VariantsFileSchema = z.object({
  schemaVersion: z.literal(VARIANTS_FILE_SCHEMA_VERSION),
  variantGroups: z.array(VariantGroupSchema)
}).strict().superRefine((file, context) => {
  const groupIds = file.variantGroups.map((group) => group.variantGroupId);
  const variantIds = file.variantGroups.flatMap((group) =>
    group.variants.map((variant) => variant.variantId)
  );
  const ownedDrawableIds = new Map<string, string>();

  addDuplicateIssue({
    values: groupIds,
    context,
    path: ["variantGroups"],
    message: "Variant Group IDs must be unique."
  });
  addDuplicateIssue({
    values: variantIds,
    context,
    path: ["variantGroups"],
    message: "Variant IDs must be unique across all groups."
  });

  file.variantGroups.forEach((group, groupIndex) => {
    group.targetDrawableIds.forEach((drawableId, targetIndex) => {
      const ownerGroupId = ownedDrawableIds.get(drawableId);
      if (ownerGroupId !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["variantGroups", groupIndex, "targetDrawableIds", targetIndex],
          message:
            `Drawable ${drawableId} is already owned by Variant Group ${ownerGroupId}.`
        });
        return;
      }

      ownedDrawableIds.set(drawableId, group.variantGroupId);
    });
  });
});
export type VariantsFileDto = z.infer<typeof VariantsFileSchema>;

export const createEmptyVariantsFile = (): VariantsFileDto => ({
  schemaVersion: VARIANTS_FILE_SCHEMA_VERSION,
  variantGroups: []
});

function addDuplicateIssue(input: {
  readonly values: readonly string[];
  readonly context: z.RefinementCtx;
  readonly path: (string | number)[];
  readonly message: string;
}): void {
  const seen = new Set<string>();
  const duplicate = input.values.find((value) => {
    if (seen.has(value)) {
      return true;
    }

    seen.add(value);
    return false;
  });

  if (duplicate === undefined) {
    return;
  }

  input.context.addIssue({
    code: "custom",
    path: input.path,
    message: `${input.message} Duplicate value: ${duplicate}.`
  });
}
