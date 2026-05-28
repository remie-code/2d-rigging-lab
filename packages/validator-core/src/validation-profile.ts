import {
  SeveritySchema,
  ValidationProfileSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  Severity,
  ValidationProfile
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const ValidationProfileConfigSchema = z.object({
  profile: ValidationProfileSchema,
  failSeverities: z.array(SeveritySchema),
  requiresGuiOperationLog: z.boolean().default(false),
  description: z.string()
});
export type ValidationProfileConfigDto = z.infer<typeof ValidationProfileConfigSchema>;

export const DEFAULT_VALIDATION_PROFILES = [
  {
    profile: "editorIncremental",
    failSeverities: ["blocking"],
    requiresGuiOperationLog: false,
    description: "Fast authoring feedback with only destructive blocking checks treated as failure."
  },
  {
    profile: "viewer",
    failSeverities: ["blocking"],
    requiresGuiOperationLog: false,
    description: "Saved package load diagnostics for viewer-facing inspection."
  },
  {
    profile: "strict",
    failSeverities: ["error", "blocking"],
    requiresGuiOperationLog: false,
    description: "Full package validation foundation that fails on error or blocking diagnostics."
  },
  {
    profile: "acceptance",
    failSeverities: ["error", "blocking"],
    requiresGuiOperationLog: true,
    description: "MVP acceptance evidence profile."
  },
  {
    profile: "aiDryRun",
    failSeverities: ["error", "blocking"],
    requiresGuiOperationLog: false,
    description: "AI proposed operation review profile."
  }
] satisfies readonly z.input<typeof ValidationProfileConfigSchema>[];

export const getValidationProfileConfig = (profileValue: ValidationProfile | string): ValidationProfileConfigDto => {
  const profile = ValidationProfileSchema.parse(profileValue);
  const config = DEFAULT_VALIDATION_PROFILES.find((candidate) => candidate.profile === profile);
  if (config === undefined) {
    throw new Error(`Unknown validation profile: ${profile}`);
  }

  return ValidationProfileConfigSchema.parse(config);
};

export const severityFailsProfile = (
  severityValue: Severity | string,
  profileValue: ValidationProfile | string
): boolean => {
  const severity = SeveritySchema.parse(severityValue);
  const profile = getValidationProfileConfig(profileValue);
  return profile.failSeverities.includes(severity);
};

