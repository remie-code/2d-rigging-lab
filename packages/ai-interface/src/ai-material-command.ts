import { z } from "zod";
import { OperationRequestSchema } from "@private-2d-rigging-lab/operation-core";
import { DrawableIdSchema, MaterialAbsolutePathSchema, MaterialCandidateIdSchema, MaterialCandidateSchema,
  MaterialCorrespondenceSchema, MaterialFitEvidenceSchema, MaterialIntentSchema, MaterialOperationResultSchema,
  MaterialPlacementSchema, MaterialRestPoseSchema, MaterialSha256Schema, MaterialViewportSchema } from "@private-2d-rigging-lab/contracts";
import { RenderViewPayloadSchema, RenderViewResultSchema } from "./ai-render-view-command.js";

const candidate = { candidateId: MaterialCandidateIdSchema };
const revision = { ...candidate, expectedCandidateRevision: z.number().int().nonnegative() };
const placement = z.union([
  z.object({ placement: MaterialPlacementSchema }).strict(),
  z.object({ correspondences: z.array(MaterialCorrespondenceSchema).min(2) }).strict()
]);
export const MaterialCommandPayloadOptions = [
  z.object({ command: z.literal("extractMaterialSource"), payload: z.object({ drawableId: DrawableIdSchema, viewport: MaterialViewportSchema }).strict() }),
  z.object({ command: z.literal("registerMaterialCandidate"), payload: z.object({ imagePath: MaterialAbsolutePathSchema, expectedOriginalFileSha256: MaterialSha256Schema.optional(), placement: MaterialPlacementSchema, restPose: MaterialRestPoseSchema, intent: MaterialIntentSchema, provenanceNote: z.string().min(1) }).strict() }),
  z.object({ command: z.literal("setMaterialPlacement"), payload: z.object({ ...revision, alignment: placement }).strict() }),
  z.object({ command: z.literal("inspectMaterialCandidate"), payload: z.object(candidate).strict() }),
  z.object({ command: z.literal("previewMaterialCandidate"), payload: z.object({ ...candidate, mode: z.enum(["placement", "working"]), viewport: MaterialViewportSchema,
    parameterOverrides: RenderViewPayloadSchema.shape.parameterOverrides, variantSelections: RenderViewPayloadSchema.shape.variantSelections }).strict() }),
  z.object({ command: z.literal("buildMaterialCandidate"), payload: z.object(revision).strict() }),
  z.object({ command: z.literal("editMaterialCandidate"), payload: z.object({ ...revision, operation: OperationRequestSchema.refine(op => !op.dryRun, "Candidate edits require dryRun=false.") }).strict() }),
  z.object({ command: z.literal("approveMaterialCandidate"), payload: z.object(revision).strict() }),
  z.object({ command: z.literal("applyMaterialCandidate"), payload: z.object(revision).strict() }),
  z.object({ command: z.literal("discardMaterialCandidate"), payload: z.object(revision).strict() })
] as const;
export const AiMaterialCommandSchema = z.discriminatedUnion("command", MaterialCommandPayloadOptions);
export type AiMaterialCommand = z.infer<typeof AiMaterialCommandSchema>;
export const AiMaterialCommandNameSchema = z.enum(["extractMaterialSource", "registerMaterialCandidate", "setMaterialPlacement", "inspectMaterialCandidate", "previewMaterialCandidate", "buildMaterialCandidate", "editMaterialCandidate", "approveMaterialCandidate", "applyMaterialCandidate", "discardMaterialCandidate"]);
export const AiMaterialCommandResultSchema = z.object({
  result: MaterialOperationResultSchema.optional(), candidate: MaterialCandidateSchema.optional(),
  fitEvidence: MaterialFitEvidenceSchema.optional(), comparisonAbsolutePath: MaterialAbsolutePathSchema.optional(),
  evaluatedRender: RenderViewResultSchema.optional(), baseEvaluatedRender: RenderViewResultSchema.optional()
}).strict();
export type AiMaterialCommandResult = z.infer<typeof AiMaterialCommandResultSchema>;
export const MaterialCommandResponseOptions = [
  z.object({ command: z.literal("extractMaterialSource"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("registerMaterialCandidate"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("setMaterialPlacement"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("inspectMaterialCandidate"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("previewMaterialCandidate"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("buildMaterialCandidate"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("editMaterialCandidate"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("approveMaterialCandidate"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("applyMaterialCandidate"), payload: AiMaterialCommandResultSchema }),
  z.object({ command: z.literal("discardMaterialCandidate"), payload: AiMaterialCommandResultSchema })
] as const;
export const isMaterialCommandName = (value: unknown): value is AiMaterialCommand["command"] => AiMaterialCommandNameSchema.safeParse(value).success;
export const materialCommandCapability = (name: AiMaterialCommand["command"]): "read" | "render" | "commitWithApproval" =>
  name === "inspectMaterialCandidate" ? "read" : name === "extractMaterialSource" || name === "previewMaterialCandidate" ? "render" : "commitWithApproval";
