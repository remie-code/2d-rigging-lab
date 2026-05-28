import { z } from "zod";

export const TargetKindSchema = z.enum([
  "package",
  "sourceAsset",
  "texture",
  "part",
  "drawable",
  "mesh",
  "vertex",
  "parameter",
  "keyformSet",
  "rigControl",
  "dynamicsGroup",
  "maskRelation",
  "operation",
  "runtimeSnapshot",
  "validationReport",
  "guiEvidence"
]);
export type TargetKind = z.infer<typeof TargetKindSchema>;

export const TargetRefSchema = z.object({
  kind: TargetKindSchema,
  id: z.string(),
  path: z.string().optional()
});
export type TargetRefDto = z.infer<typeof TargetRefSchema>;
