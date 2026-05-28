import { z } from "zod";

export const SurfaceSchema = z.enum([
  "gui",
  "file",
  "structuredApi",
  "schemaMigration",
  "validatorRepair",
  "testFixture"
]);
export type Surface = z.infer<typeof SurfaceSchema>;

export const ActorSchema = z.enum([
  "human",
  "ai",
  "importer",
  "schemaMigration",
  "validatorRepairCandidate",
  "test"
]);
export type Actor = z.infer<typeof ActorSchema>;

export const SeveritySchema = z.enum(["info", "warning", "error", "blocking"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const CheckStatusSchema = z.enum(["pass", "warning", "fail", "needs_review", "not_applicable"]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const ValidationProfileSchema = z.enum(["editorIncremental", "viewer", "strict", "acceptance", "aiDryRun"]);
export type ValidationProfile = z.infer<typeof ValidationProfileSchema>;

/**
 * @deprecated New contracts use RuntimeEvaluationContext source surface plus strictness.
 */
export const RuntimeEvaluationProfileSchema = z.enum(["preview", "viewer", "validatorStrict", "aiDryRun"]);
export type RuntimeEvaluationProfile = z.infer<typeof RuntimeEvaluationProfileSchema>;

export const SnapshotDetailSchema = z.enum(["summary", "targeted", "full"]);
export type SnapshotDetail = z.infer<typeof SnapshotDetailSchema>;

export const RuntimeResetReasonSchema = z.enum([
  "packageLoad",
  "manualCommand",
  "previewRestart",
  "largeInputJump",
  "validationRunStart",
  "demoCaptureStart"
]);
export type RuntimeResetReason = z.infer<typeof RuntimeResetReasonSchema>;

export const RuntimeSourceSurfaceSchema = z.enum(["preview", "viewer", "validator", "aiDryRun"]);
export type RuntimeSourceSurface = z.infer<typeof RuntimeSourceSurfaceSchema>;

export const RuntimeEvaluationStrictnessSchema = z.enum(["interactive", "strict", "acceptance", "demoSafe"]);
export type RuntimeEvaluationStrictness = z.infer<typeof RuntimeEvaluationStrictnessSchema>;
