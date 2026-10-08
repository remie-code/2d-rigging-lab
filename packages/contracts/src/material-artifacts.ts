import { z } from "zod";
import { DrawableIdSchema, MeshIdSchema, PartIdSchema, RigControlIdSchema, MaskRelationIdSchema } from "./ids.js";
import { TargetRefSchema } from "./target-ref.js";
import { MaterialPlacementSchema, MaterialStageRectSchema } from "./material-coordinates.js";
import { MaterialCandidateIdSchema, MaterialPackageVersionSchema, MaterialRestPoseSchema } from "./material-candidate.js";

export const MaterialAbsolutePathSchema = z.string().min(1).refine(
  (path) => /^(?:[A-Za-z]:[\\/]|\/|\\\\[^\\]+\\[^\\]+)/.test(path) && !path.includes("\0"),
  "Artifact paths must be absolute."
);
export const MaterialViewportSchema = z.object({
  stageRect: MaterialStageRectSchema,
  outputWidth: z.number().int().positive(), outputHeight: z.number().int().positive()
}).strict();
export const MaterialImageArtifactSchema = z.object({
  kind: z.enum(["source-texture", "context-composite", "placement-alpha-preview", "working-mesh-rig-preview"]),
  imageAbsolutePath: MaterialAbsolutePathSchema,
  sidecarAbsolutePath: MaterialAbsolutePathSchema
}).strict();
export const MaterialCoordinateSidecarSchema = z.object({
  schemaVersion: z.literal("material-coordinate-sidecar-v1"),
  kind: z.enum(["source-texture", "context-composite", "placement-alpha-preview", "working-mesh-rig-preview"]),
  candidateId: MaterialCandidateIdSchema.optional(),
  candidateRevision: z.number().int().nonnegative().optional(),
  packageVersion: MaterialPackageVersionSchema,
  viewport: MaterialViewportSchema,
  imageToStage: MaterialPlacementSchema,
  materialPlacement: MaterialPlacementSchema.optional(),
  restPose: MaterialRestPoseSchema,
  // A: full alpha extent in structural order. B: evaluated real working mesh/rig.
  coverage: z.enum(["full-image", "full-alpha-no-old-mesh-clip", "evaluated-mesh"]),
  workingPackage: MaterialPackageVersionSchema.optional()
}).strict().superRefine((sidecar, context) => {
  const fail = (message: string): void => context.addIssue({ code: "custom", message });
  const v = sidecar.viewport, p = sidecar.imageToStage;
  const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  if (!near(p.scale, v.stageRect.width / v.outputWidth) || !near(p.scale, v.stageRect.height / v.outputHeight) ||
      !near(p.translation.x, v.stageRect.x) || !near(p.translation.y, v.stageRect.y)) fail("Artifact pixel-edge mapping must agree with the fixed stage viewport.");
  if ((sidecar.candidateId === undefined) !== (sidecar.candidateRevision === undefined)) fail("Candidate id and revision travel together.");
  if (sidecar.kind === "placement-alpha-preview" && (sidecar.coverage !== "full-alpha-no-old-mesh-clip" || sidecar.candidateId === undefined || sidecar.materialPlacement === undefined)) fail("Placement preview must include all alpha and identify candidate.");
  if (sidecar.kind === "working-mesh-rig-preview" && (sidecar.coverage !== "evaluated-mesh" || sidecar.workingPackage === undefined || sidecar.candidateId === undefined)) fail("Working preview must identify the evaluated working package and candidate.");
});
export const MaterialSourceContextSchema = z.object({
  packageVersion: MaterialPackageVersionSchema,
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
export type MaterialImageArtifact = z.infer<typeof MaterialImageArtifactSchema>;
export type MaterialCoordinateSidecar = z.infer<typeof MaterialCoordinateSidecarSchema>;
export type MaterialSourceContext = z.infer<typeof MaterialSourceContextSchema>;


