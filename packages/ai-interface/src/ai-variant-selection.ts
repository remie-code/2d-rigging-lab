import { z } from "zod";

/**
 * Shared `variantSelections` payload contract (Wave105 Domain A, §3.1).
 *
 * The perception commands (`renderView` / `inspectEvaluatedGeometry`) may carry
 * an optional `variantSelections` array so a caller can ask "what does the model
 * look like in THIS outfit". Each entry names a Variant Group and the active
 * selection within it, discriminated by `kind` to mirror package-format's
 * `VariantDefaultActiveSelectionDto` (singleSelect: one variantId; multiToggle:
 * a set of variantIds). Omitting `variantSelections` resolves to the package's
 * `defaultActive` for every group.
 *
 * This module is pure zod and dependency-clean: the id token schemas are
 * declared here (mirroring package-format's `vgrp_*` / `var_*` patterns) rather
 * than imported, because ai-interface must not depend on `package-format` (the
 * dependency boundary forbids it). The group / variant existence + mode-integrity
 * validation, which needs the session's variant groups, lives in the
 * authoring-host resolver, not here.
 */

const idTokenPattern = "[A-Za-z0-9_-]+";

/** `vgrp_*` — mirrors package-format's `VariantGroupIdSchema`. */
export const VariantSelectionGroupIdSchema = z
  .string()
  .regex(new RegExp(`^vgrp_${idTokenPattern}$`));

/** `var_*` — mirrors package-format's `VariantIdSchema`. */
export const VariantSelectionVariantIdSchema = z
  .string()
  .regex(new RegExp(`^var_${idTokenPattern}$`));

/** One requested active selection for a single Variant Group. */
export const VariantSelectionEntrySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("singleSelect"),
      variantGroupId: VariantSelectionGroupIdSchema,
      variantId: VariantSelectionVariantIdSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal("multiToggle"),
      variantGroupId: VariantSelectionGroupIdSchema,
      variantIds: z.array(VariantSelectionVariantIdSchema).default([])
    })
    .strict()
]);
export type VariantSelectionEntry = z.infer<typeof VariantSelectionEntrySchema>;

/**
 * The optional payload field shared by the perception commands. When present,
 * it replaces `defaultActive` for the named groups; groups not named still
 * resolve to their `defaultActive`.
 */
export const VariantSelectionsPayloadSchema = z
  .array(VariantSelectionEntrySchema)
  .optional();
export type VariantSelectionsPayload = z.infer<typeof VariantSelectionsPayloadSchema>;

/**
 * A RESOLVED active selection, recorded in sidecars / measurement results so a
 * reader can prove which outfit a render or measurement describes (§3.1: "どの
 * 衣装で撮った写真か"). This is the resolved echo — one entry for every group the
 * gate evaluated, sorted by `variantGroupId`. Empty when the package has no
 * Variant Groups.
 */
export const ResolvedVariantSelectionEntrySchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("singleSelect"),
      variantGroupId: VariantSelectionGroupIdSchema,
      variantId: VariantSelectionVariantIdSchema
    })
    .strict(),
  z
    .object({
      kind: z.literal("multiToggle"),
      variantGroupId: VariantSelectionGroupIdSchema,
      variantIds: z.array(VariantSelectionVariantIdSchema)
    })
    .strict()
]);
export type ResolvedVariantSelectionEntry = z.infer<
  typeof ResolvedVariantSelectionEntrySchema
>;
