import { z } from "zod";
import { DrawableIdSchema, MaterialCoordinateSidecarSchema, MaterialCorrespondenceSchema, MaterialFitEvidenceSchema,
  MaterialImageArtifactSchema, MaterialImageFileRefSchema, MaterialIntentSchema, MaterialPackageRefSchema,
  MaterialPlacementSchema, MaterialSourceContextSchema, MaterialViewportSchema } from "@private-2d-rigging-lab/contracts";

/**
 * Read-only material commands. Both render from the saved package and write artifacts outside it; neither changes
 * the package. Adding or replacing a drawable from an image is the ordinary operation pair
 * addDrawableFromImage / replaceDrawableImage (dryRunOperation / commitOperation).
 * Those two are deliberately absent from the Codex proposal operation catalog: proposals are dry-run without the
 * authoring host's PNG intake, so they would always be rejected with imageBytesMissing.
 */
export const ExtractMaterialSourcePayloadSchema = z.object({
  drawableId: DrawableIdSchema,
  viewport: MaterialViewportSchema
}).strict();
export type ExtractMaterialSourcePayload = z.infer<typeof ExtractMaterialSourcePayloadSchema>;

/** Explicit placement, or at least two pixel/stage correspondences fitted to a positive uniform scale. */
export const MaterialAlignmentSchema = z.union([
  z.object({ placement: MaterialPlacementSchema }).strict(),
  z.object({ correspondences: z.array(MaterialCorrespondenceSchema).min(2) }).strict()
]);
export type MaterialAlignment = z.infer<typeof MaterialAlignmentSchema>;

export const PreviewMaterialPlacementPayloadSchema = z.object({
  image: MaterialImageFileRefSchema,
  alignment: MaterialAlignmentSchema,
  intent: MaterialIntentSchema,
  viewport: MaterialViewportSchema
}).strict();
export type PreviewMaterialPlacementPayload = z.infer<typeof PreviewMaterialPlacementPayloadSchema>;

export const MaterialCommandPayloadOptions = [
  z.object({ command: z.literal("extractMaterialSource"), payload: ExtractMaterialSourcePayloadSchema }),
  z.object({ command: z.literal("previewMaterialPlacement"), payload: PreviewMaterialPlacementPayloadSchema })
] as const;
export const AiMaterialCommandSchema = z.discriminatedUnion("command", MaterialCommandPayloadOptions);
export type AiMaterialCommand = z.infer<typeof AiMaterialCommandSchema>;
export const AiMaterialCommandNameSchema = z.enum(["extractMaterialSource", "previewMaterialPlacement"]);
export type AiMaterialCommandName = z.infer<typeof AiMaterialCommandNameSchema>;

export const ExtractMaterialSourceResultSchema = z.object({
  packageRef: MaterialPackageRefSchema,
  sourceContext: MaterialSourceContextSchema,
  artifacts: z.array(MaterialImageArtifactSchema).min(1)
}).strict();
export type ExtractMaterialSourceResult = z.infer<typeof ExtractMaterialSourceResultSchema>;

export const PreviewMaterialPlacementResultSchema = z.object({
  packageRef: MaterialPackageRefSchema,
  /** The placement used; copy it into the operation payload. */
  placement: MaterialPlacementSchema,
  /** Present when the placement was fitted from correspondences. Numerical residuals only. */
  fitEvidence: MaterialFitEvidenceSchema.optional(),
  preview: z.object({ artifact: MaterialImageArtifactSchema, sidecar: MaterialCoordinateSidecarSchema }).strict(),
  /** The current package at the same viewport, for before/after comparison. */
  context: MaterialImageArtifactSchema,
  artifacts: z.array(MaterialImageArtifactSchema).min(1)
}).strict();
export type PreviewMaterialPlacementResult = z.infer<typeof PreviewMaterialPlacementResultSchema>;

export const ExtractMaterialSourceResponsePayloadSchema = z.object({ result: ExtractMaterialSourceResultSchema.optional() }).strict();
export const PreviewMaterialPlacementResponsePayloadSchema = z.object({ result: PreviewMaterialPlacementResultSchema.optional() }).strict();
export type AiMaterialCommandResponsePayload =
  | z.infer<typeof ExtractMaterialSourceResponsePayloadSchema>
  | z.infer<typeof PreviewMaterialPlacementResponsePayloadSchema>;

export const MaterialCommandResponseOptions = [
  z.object({ command: z.literal("extractMaterialSource"), payload: ExtractMaterialSourceResponsePayloadSchema }),
  z.object({ command: z.literal("previewMaterialPlacement"), payload: PreviewMaterialPlacementResponsePayloadSchema })
] as const;

export const isMaterialCommandName = (value: unknown): value is AiMaterialCommandName => AiMaterialCommandNameSchema.safeParse(value).success;
/** Both material commands are read-only renders. */
export const materialCommandCapability = (_name: AiMaterialCommandName): "render" => "render";
