import { z } from "zod";
import { DiagnosticSchema } from "./diagnostics.js";
import { OperationIdSchema } from "./ids.js";
import { TargetRefSchema } from "./target-ref.js";
import { MaterialCandidateSchema, MaterialCandidateIdSchema, MaterialPackageVersionSchema, materialPackageVersionsEqual } from "./material-candidate.js";
import { MaterialImageArtifactSchema, MaterialSourceContextSchema, MaterialCoordinateSidecarSchema } from "./material-artifacts.js";
import { MaterialImpactSchema } from "./material-intent.js";

export const MaterialOperationResultSchema = z.object({
  schemaVersion: z.literal("material-operation-result-v1"),
  operationId: OperationIdSchema,
  operation: z.enum(["extract", "register", "place", "preview", "build", "edit", "approve", "apply", "discard"]),
  status: z.enum(["completed", "pending", "rejected", "failed"]),
  candidateId: MaterialCandidateIdSchema.nullable(),
  basePackage: MaterialPackageVersionSchema,
  candidate: MaterialCandidateSchema.optional(),
  changedTargets: z.array(TargetRefSchema),
  baseChanged: z.boolean(),
  artifacts: z.array(MaterialImageArtifactSchema),
  diagnostics: z.array(DiagnosticSchema),
  sourceContext: MaterialSourceContextSchema.optional(),
  previewContext: z.object({
    artifact: MaterialImageArtifactSchema,
    sidecar: MaterialCoordinateSidecarSchema
  }).strict().optional(),
  impact: MaterialImpactSchema.optional()
}).strict().superRefine((result, context) => {
  const fail = (message: string): void => context.addIssue({ code: "custom", message });
  const completed = result.status === "completed";
  if (result.baseChanged !== (completed && result.operation === "apply")) fail("Only a completed apply changes the base package.");
  if (!completed && (result.diagnostics.length === 0 || result.changedTargets.length > 0)) fail("Non-completed results need diagnostics and cannot claim changes.");
  if (completed && result.diagnostics.some((d) => d.severity === "error" || d.severity === "blocking" || d.status === "fail")) fail("Completed results cannot carry failing diagnostics.");
  if (result.candidate !== undefined && (result.candidateId !== result.candidate.candidateId || !materialPackageVersionsEqual(result.basePackage, result.candidate.basePackage))) fail("Candidate identity and base version must match the result.");
  if (completed && result.operation !== "extract" && result.candidate === undefined) fail("Completed candidate operations require a candidate snapshot.");
  if (completed && result.operation === "extract") {
    const source = result.sourceContext;
    if (source === undefined || !materialPackageVersionsEqual(source.packageVersion, result.basePackage)) {
      fail("Extraction requires source context for the exact base package.");
    } else {
      for (const expected of [source.sourceTexture, source.contextComposite]) {
        if (!result.artifacts.some((artifact) => artifact.kind === expected.kind &&
            artifact.imageAbsolutePath === expected.imageAbsolutePath && artifact.sidecarAbsolutePath === expected.sidecarAbsolutePath)) {
          fail("Extraction requires matching original texture and context composite artifacts.");
        }
      }
    }
  }
  if (completed && result.operation === "preview") {
    const preview = result.previewContext, candidate = result.candidate;
    if (preview === undefined || candidate === undefined) {
      fail("Completed preview requires an artifact and its coordinate sidecar for the candidate.");
    } else {
      const { artifact, sidecar } = preview;
      if (artifact.kind !== "placement-alpha-preview" && artifact.kind !== "working-mesh-rig-preview") fail("Preview requires a placement alpha or working mesh/rig artifact.");
      if (!result.artifacts.some((a) => a.kind === artifact.kind && a.imageAbsolutePath === artifact.imageAbsolutePath && a.sidecarAbsolutePath === artifact.sidecarAbsolutePath)) fail("Preview artifact must be included in returned artifacts.");
      if (sidecar.kind !== artifact.kind || sidecar.candidateId !== candidate.candidateId || sidecar.candidateRevision !== candidate.candidateRevision ||
          !materialPackageVersionsEqual(sidecar.packageVersion, candidate.basePackage)) fail("Preview sidecar must identify the artifact and exact candidate/base version.");
      if (candidate.state === "discarded") fail("Discarded candidates cannot produce a completed preview.");
      if (artifact.kind === "working-mesh-rig-preview" &&
          (!("workingPackage" in candidate) || candidate.workingPackage === undefined || sidecar.workingPackage === undefined ||
          !materialPackageVersionsEqual(sidecar.workingPackage, candidate.workingPackage))) fail("Working preview must correspond to the candidate's current working package.");
    }
  }
  const requiredStates: Record<string, string> = { register: "registered", place: "registered", build: "working", edit: "working", approve: "approved", apply: "applied", discard: "discarded" };
  if (completed && requiredStates[result.operation] !== undefined && result.candidate?.state !== requiredStates[result.operation]) fail("Completed operation has an incompatible candidate state.");
  if (completed && (result.operation === "extract" || result.operation === "preview") && result.artifacts.length === 0) fail("Completed image operations require artifacts.");
  if (completed && (result.operation === "build" || result.operation === "apply") && (result.impact === undefined || result.impact.refusedDeletions.length > 0)) fail("Successful build/apply requires an impact report without refused deletions.");
});
export type MaterialOperationResult = z.infer<typeof MaterialOperationResultSchema>;
