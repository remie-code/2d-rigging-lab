import { z } from "zod";
import { DrawableIdSchema, MeshIdSchema, PartIdSchema, RigControlIdSchema, MaskRelationIdSchema } from "./ids.js";
import { TargetRefSchema } from "./target-ref.js";
import { MaterialPlacementSchema, MaterialStageRectSchema } from "./material-coordinates.js";
import { MaterialSha256Schema } from "./material-image.js";
import { MaterialPackageRefSchema } from "./material-package-ref.js";

export const MaterialAbsolutePathSchema = z.string().min(1).refine(
  (path) => /^(?:[A-Za-z]:[\\/]|\/|\\\\[^\\]+\\[^\\]+)/.test(path) && !path.includes("\0"),
  "Artifact paths must be absolute."
);
/** Material artifacts describe undeformed rest artwork: no keyed deformation, no dynamics. */
export const MaterialRestPoseSchema = z.object({
  kind: z.literal("undeformed-rest"),
  coordinateSystem: z.literal("canvas-y-down-v1"),
  keyedDeformation: z.literal(false),
  dynamics: z.literal(false)
}).strict();
export const MaterialViewportSchema = z.object({
  stageRect: MaterialStageRectSchema,
  outputWidth: z.number().int().positive(), outputHeight: z.number().int().positive()
}).strict();
export const MaterialArtifactKindSchema = z.enum(["source-texture", "context-composite", "placement-alpha-preview"]);
export const MaterialImageArtifactSchema = z.object({
  kind: MaterialArtifactKindSchema,
  imageAbsolutePath: MaterialAbsolutePathSchema,
  sidecarAbsolutePath: MaterialAbsolutePathSchema
}).strict();
/** Coordinates of one read-only material artifact. `packageRef` names the saved package revision it was rendered from. */
export const MaterialCoordinateSidecarSchema = z.object({
  schemaVersion: z.literal("material-coordinate-sidecar-v1"),
  kind: MaterialArtifactKindSchema,
  packageRef: MaterialPackageRefSchema,
  viewport: MaterialViewportSchema,
  imageToStage: MaterialPlacementSchema,
  materialPlacement: MaterialPlacementSchema.optional(),
  /** Normalized RGBA SHA-256 of the placed image; required for a placement preview. */
  materialRgbaSha256: MaterialSha256Schema.optional(),
  restPose: MaterialRestPoseSchema,
  coverage: z.enum(["full-image", "full-alpha-no-old-mesh-clip", "evaluated-mesh"])
}).strict().superRefine((sidecar, context) => {
  const fail = (message: string): void => context.addIssue({ code: "custom", message });
  const v = sidecar.viewport, p = sidecar.imageToStage;
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (!near(p.scale, v.stageRect.width / v.outputWidth) || !near(p.scale, v.stageRect.height / v.outputHeight) ||
      !near(p.translation.x, v.stageRect.x) || !near(p.translation.y, v.stageRect.y)) fail("Artifact pixel-edge mapping must agree with the fixed stage viewport.");
  if (sidecar.kind === "placement-alpha-preview" && (sidecar.coverage !== "full-alpha-no-old-mesh-clip" ||
      sidecar.materialPlacement === undefined || sidecar.materialRgbaSha256 === undefined)) {
    fail("Placement preview must include all alpha and identify the placed image and placement.");
  }
});
export const MaterialSourceContextSchema = z.object({
  packageRef: MaterialPackageRefSchema,
  drawableId: DrawableIdSchema, meshId: MeshIdSchema, parentPartId: PartIdSchema,
  rigControlIds: z.array(RigControlIdSchema), maskRelationIds: z.array(MaskRelationIdSchema),
  variantRefs: z.array(z.string().min(1)),
  relatedTargets: z.array(TargetRefSchema),
  sourceTexture: MaterialImageArtifactSchema.refine((a) => a.kind === "source-texture"),
  contextComposite: MaterialImageArtifactSchema.refine((a) => a.kind === "context-composite"),
  sourceImageToStage: MaterialPlacementSchema,
  sourceLayerStageBounds: MaterialStageRectSchema,
  restPose: MaterialRestPoseSchema
}).strict();
export type MaterialRestPose = z.infer<typeof MaterialRestPoseSchema>;
export type MaterialViewport = z.infer<typeof MaterialViewportSchema>;
export type MaterialImageArtifact = z.infer<typeof MaterialImageArtifactSchema>;
export type MaterialCoordinateSidecar = z.infer<typeof MaterialCoordinateSidecarSchema>;
export type MaterialSourceContext = z.infer<typeof MaterialSourceContextSchema>;
