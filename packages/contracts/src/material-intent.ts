import { z } from "zod";
import { DrawableIdSchema, KeyformSetIdSchema, MaskRelationIdSchema, PartIdSchema, RigControlIdSchema } from "./ids.js";
import { TargetRefSchema } from "./target-ref.js";

const StructuralSiblingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("part"), partId: PartIdSchema }).strict(),
  z.object({ kind: z.literal("drawable"), drawableId: DrawableIdSchema }).strict()
]);
export const MaterialInsertionSchema = z.discriminatedUnion("position", [
  z.object({ position: z.literal("first") }).strict(),
  z.object({ position: z.literal("last") }).strict(),
  z.object({ position: z.literal("before"), sibling: StructuralSiblingSchema }).strict(),
  z.object({ position: z.literal("after"), sibling: StructuralSiblingSchema }).strict()
]);
export const MaterialIntentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("add"),
    drawableId: DrawableIdSchema,
    displayName: z.string().min(1),
    parentPartId: PartIdSchema,
    insertion: MaterialInsertionSchema,
    // Explicit empty array means no motion membership or masks.
    rigControlIds: z.array(RigControlIdSchema),
    maskBindings: z.array(z.object({
      maskRelationId: MaskRelationIdSchema,
      role: z.enum(["maskSource", "target"])
    }).strict()),
    runtimeVisibility: z.boolean(),
    defaultOpacity: z.number().finite().min(0).max(1)
  }).strict(),
  z.object({
    kind: z.literal("replace"),
    drawableId: DrawableIdSchema,
    preserveLogicalDrawableId: z.literal(true),
    geometryReset: z.object({
      scope: z.literal("target-direct-geometry-keyforms"),
      keyformSetIds: z.array(KeyformSetIdSchema)
    }).strict(),
    preserveExistingDeformers: z.literal(true),
    sharedControlPolicy: z.literal("reject-shared-control-key-parameter-deletion")
  }).strict()
]);
export const MaterialImpactSchema = z.object({
  drawableId: DrawableIdSchema,
  preserved: z.array(TargetRefSchema),
  reset: z.array(TargetRefSchema),
  created: z.array(TargetRefSchema),
  sharedReferences: z.array(z.object({
    target: TargetRefSchema, affectedDrawableIds: z.array(DrawableIdSchema).min(1)
  }).strict()),
  refusedDeletions: z.array(z.object({
    target: TargetRefSchema, affectedDrawableIds: z.array(DrawableIdSchema).min(1),
    reason: z.literal("shared-control-key-parameter")
  }).strict()),
  existingDeformersChanged: z.literal(false)
}).strict();
export type MaterialIntent = z.infer<typeof MaterialIntentSchema>;
export type MaterialImpact = z.infer<typeof MaterialImpactSchema>;


