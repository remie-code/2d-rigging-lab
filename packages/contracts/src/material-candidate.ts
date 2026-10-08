import { z } from "zod";
import { PackageIdSchema } from "./ids.js";
import { MaterialPlacementSchema } from "./material-coordinates.js";
import { MaterialImageDescriptorSchema, MaterialSha256Schema } from "./material-image.js";
import { MaterialIntentSchema } from "./material-intent.js";

export const MaterialCandidateIdSchema = z.string().regex(/^material_[A-Za-z0-9_-]+$/);
export const MaterialPackageVersionSchema = z.object({
  packageId: PackageIdSchema,
  packageRevision: z.number().int().nonnegative(),
  contentFingerprint: MaterialSha256Schema,
  fingerprintVersion: z.literal("material-package-content-v1")
}).strict();
export const MaterialRestPoseSchema = z.object({
  kind: z.literal("undeformed-rest"),
  coordinateSystem: z.literal("canvas-y-down-v1"),
  keyedDeformation: z.literal(false),
  dynamics: z.literal(false)
}).strict();
export const MaterialApprovalSchema = z.object({
  candidateRevision: z.number().int().nonnegative(),
  workingPackage: MaterialPackageVersionSchema,
  approvedBy: z.string().min(1),
  approvedAt: z.string().datetime()
}).strict();
const common = {
  schemaVersion: z.literal("material-candidate-v1"),
  candidateId: MaterialCandidateIdSchema,
  candidateRevision: z.number().int().nonnegative(),
  basePackage: MaterialPackageVersionSchema,
  image: MaterialImageDescriptorSchema,
  restPose: MaterialRestPoseSchema,
  placement: MaterialPlacementSchema,
  intent: MaterialIntentSchema,
  provenance: z.object({ kind: z.literal("generated-material"), note: z.string().min(1) }).strict()
};
export const MaterialCandidateSchema = z.discriminatedUnion("state", [
  z.object({ ...common, state: z.literal("registered") }).strict(),
  z.object({ ...common, state: z.literal("working"), workingPackage: MaterialPackageVersionSchema }).strict(),
  z.object({ ...common, state: z.literal("approved"), workingPackage: MaterialPackageVersionSchema, approval: MaterialApprovalSchema }).strict(),
  z.object({ ...common, state: z.literal("applied"), workingPackage: MaterialPackageVersionSchema, approval: MaterialApprovalSchema, appliedPackage: MaterialPackageVersionSchema }).strict(),
  z.object({ ...common, state: z.literal("stale"), workingPackage: MaterialPackageVersionSchema.optional(), observedBasePackage: MaterialPackageVersionSchema }).strict(),
  z.object({ ...common, state: z.literal("discarded") }).strict()
]).superRefine((candidate, context) => {
  if ("workingPackage" in candidate && candidate.workingPackage !== undefined && candidate.workingPackage.packageId !== candidate.basePackage.packageId) {
    context.addIssue({ code: "custom", path: ["workingPackage"], message: "Working package retains base logical package identity." });
  }
  if ("approval" in candidate && (candidate.approval.candidateRevision !== candidate.candidateRevision ||
      !materialPackageVersionsEqual(candidate.approval.workingPackage, candidate.workingPackage))) {
    context.addIssue({ code: "custom", path: ["approval"], message: "Approval must bind the exact candidate and working package versions." });
  }
  if (candidate.state === "stale" && materialPackageVersionsEqual(candidate.basePackage, candidate.observedBasePackage)) {
    context.addIssue({ code: "custom", path: ["observedBasePackage"], message: "Stale requires a changed base identity, revision or fingerprint." });
  }
  if (candidate.state === "applied" && (candidate.appliedPackage.packageId !== candidate.basePackage.packageId ||
      candidate.appliedPackage.packageRevision <= candidate.basePackage.packageRevision)) {
    context.addIssue({ code: "custom", path: ["appliedPackage"], message: "Apply must advance the saved base package revision." });
  }
});
export type MaterialPackageVersion = z.infer<typeof MaterialPackageVersionSchema>;
export type MaterialCandidate = z.infer<typeof MaterialCandidateSchema>;
export const materialPackageVersionsEqual = (a: MaterialPackageVersion, b: MaterialPackageVersion): boolean =>
  a.packageId === b.packageId && a.packageRevision === b.packageRevision &&
  a.contentFingerprint === b.contentFingerprint && a.fingerprintVersion === b.fingerprintVersion;

/** Pure precondition validator; it neither mutates a package nor grants approval. */
export const MaterialCandidateActionSchema = z.object({
  candidate: MaterialCandidateSchema,
  action: z.enum(["place", "build", "edit", "approve", "apply", "discard"]),
  expectedCandidateRevision: z.number().int().nonnegative(),
  observedBasePackage: MaterialPackageVersionSchema
}).strict().superRefine((input, context) => {
  const c = input.candidate;
  const fail = (message: string): void => context.addIssue({ code: "custom", path: ["action"], message });
  if (input.expectedCandidateRevision !== c.candidateRevision) fail("Candidate revision is stale.");
  if (c.state === "applied" || c.state === "discarded") fail("Terminal candidates cannot be changed.");
  if (c.state === "stale" && input.action !== "discard") fail("Stale candidates are retained for inspection or discard.");
  if (input.action !== "discard" && !materialPackageVersionsEqual(c.basePackage, input.observedBasePackage)) fail("Base package is stale.");
  if (input.action === "apply" && c.state !== "approved") fail("Apply requires an approved candidate.");
  if (input.action === "approve" && c.state !== "working") fail("Approve requires a working package.");
  if (input.action === "edit" && c.state !== "working" && c.state !== "approved") fail("Edit requires a working package.");
});

