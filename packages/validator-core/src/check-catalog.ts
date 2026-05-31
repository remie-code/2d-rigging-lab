import {
  CheckIdSchema,
  SeveritySchema,
  ValidationProfileSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  CheckId,
  Severity,
  ValidationProfile
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

export const ValidationPhaseSchema = z.enum([
  "package_schema",
  "source_import",
  "rights",
  "reference",
  "mesh_semantic",
  "dynamics_semantic",
  "dynamics_evaluation",
  "runtime_load",
  "runtime_state",
  "representative_evaluation",
  "acceptance_evidence",
  "demo_preflight"
]);
export type ValidationPhase = z.infer<typeof ValidationPhaseSchema>;

export const CheckDefinitionSchema = z.object({
  checkId: CheckIdSchema,
  phase: ValidationPhaseSchema,
  defaultSeverity: SeveritySchema,
  profiles: z.array(ValidationProfileSchema).default(["viewer", "strict", "acceptance", "aiDryRun"]),
  relatedAC: z.array(z.string()).default([]),
  description: z.string()
});
export type CheckDefinitionDto = z.infer<typeof CheckDefinitionSchema>;
export type CheckDefinitionInput = z.input<typeof CheckDefinitionSchema>;

export class CheckCatalog {
  readonly #checks = new Map<CheckId, CheckDefinitionDto>();

  constructor(definitions: readonly CheckDefinitionInput[] = []) {
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definitionValue: CheckDefinitionInput): CheckDefinitionDto {
    const definition = CheckDefinitionSchema.parse(definitionValue);
    if (this.#checks.has(definition.checkId)) {
      throw new Error(`Duplicate check definition: ${definition.checkId}`);
    }

    this.#checks.set(definition.checkId, definition);
    return definition;
  }

  get(checkIdValue: CheckId | string): CheckDefinitionDto | undefined {
    const checkId = CheckIdSchema.parse(checkIdValue);
    return this.#checks.get(checkId);
  }

  has(checkIdValue: CheckId | string): boolean {
    return this.get(checkIdValue) !== undefined;
  }

  list(profile?: ValidationProfile): readonly CheckDefinitionDto[] {
    const definitions = [...this.#checks.values()];
    if (profile === undefined) {
      return definitions;
    }

    return definitions.filter((definition) => definition.profiles.includes(profile));
  }
}

export const DEFAULT_CHECK_DEFINITIONS = [
  {
    checkId: "pkg.schema.requiredFileMissing",
    phase: "package_schema",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Required package file or required package DTO field is missing."
  },
  {
    checkId: "ref.drawableSourceMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004"],
    description: "Drawable source asset reference cannot be resolved."
  },
  {
    checkId: "ref.drawableTextureMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004"],
    description: "Drawable texture reference cannot be resolved."
  },
  {
    checkId: "ref.texturePreviewMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Texture atlas entry has no preview asset payload for a visible drawable."
  },
  {
    checkId: "ref.textureSourceLayerMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Texture source layer metadata does not match source manifest or drawable mapping."
  },
  {
    checkId: "binary.bytesMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset metadata expects package-local bytes that are not available in the package file set."
  },
  {
    checkId: "binary.byteLengthMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset byte length metadata does not match the package-local bytes."
  },
  {
    checkId: "binary.digestMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset SHA-256 digest metadata does not match the package-local bytes."
  },
  {
    checkId: "binary.digestUnsupported",
    phase: "reference",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset digest verification could not run in the current validation environment."
  },
  {
    checkId: "binary.mediaTypeMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset media type metadata does not match the package-local binary entry declaration."
  },
  {
    checkId: "binary.assetIdMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset ID metadata does not match the package-local binary entry declaration."
  },
  {
    checkId: "binary.referenceMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset reference metadata does not match its source manifest, texture atlas, or binary index owner."
  },
  {
    checkId: "asset.psd.unsupportedFeature",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "PSD source profile contains an unsupported feature retained as source import diagnostics."
  },
  {
    checkId: "asset.psd.adapterDiagnostic",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD source profile contains an adapter-supplied diagnostic."
  },
  {
    checkId: "asset.psd.structuredProfileMissing",
    phase: "source_import",
    defaultSeverity: "info",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "PSD source asset is using flattened Wave20 compatibility fields because psdProfile is absent."
  },
  {
    checkId: "asset.psd.structuredProfileMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "A non-PSD source asset carries PSD-only structured source profile metadata."
  },
  {
    checkId: "asset.psd.flattenedFallbackMismatch",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD unsupported feature details differ from flattened fallback feature IDs."
  },
  {
    checkId: "rights.recordMissing",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-013"],
    description: "Source asset has no rights metadata record."
  },
  {
    checkId: "rights.provenanceMissing",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-013"],
    description: "Source asset has no provenance metadata record."
  },
  {
    checkId: "rights.textureProvenanceMissing",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Texture atlas or preview asset provenance ID cannot be resolved."
  },
  {
    checkId: "rights.textureProvenanceMismatch",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Texture provenance and rights metadata point at different assets."
  },
  {
    checkId: "rights.binaryProvenanceMissing",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset provenance ID cannot be resolved."
  },
  {
    checkId: "rights.binaryRightsMissing",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset rights asset ID cannot be resolved."
  },
  {
    checkId: "rights.binaryProvenanceMismatch",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Binary asset provenance and rights metadata point at different assets."
  },
  {
    checkId: "rights.drawableProvenanceMissing",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Drawable source provenance ID cannot be resolved."
  },
  {
    checkId: "rights.drawableProvenanceMismatch",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Drawable source provenance record does not belong to the drawable source asset."
  },
  {
    checkId: "rights.psdLayerProvenanceMissing",
    phase: "rights",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "PSD source layer mapped to a drawable cannot be traced to a source provenance record."
  },
  {
    checkId: "rights.statusNeedsReview",
    phase: "rights",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002"],
    description: "Source asset rights metadata requires human review before final MVP acceptance."
  },
  {
    checkId: "rights.statusBlocked",
    phase: "rights",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-013"],
    description: "Source asset rights metadata blocks use in the package."
  },
  {
    checkId: "mesh.triangleIndexOutOfRange",
    phase: "mesh_semantic",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005"],
    description: "Mesh triangle index references a missing vertex."
  },
  {
    checkId: "dynamics.requiredGroupMissing",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "A required Minimum Open Dynamics v1 group is absent for a computed dynamics parameter."
  },
  {
    checkId: "dynamics.driverMissing",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics group references a missing driver parameter."
  },
  {
    checkId: "dynamics.outputMissing",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics group targets a missing computed output parameter."
  },
  {
    checkId: "dynamics.outputTargetDuplicate",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Multiple dynamics groups target the same computed output parameter."
  },
  {
    checkId: "dynamics.driverMustBeAuthoredInput",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics driver must reference an authoredInput parameter."
  },
  {
    checkId: "dynamics.outputMustBeComputedParameter",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics output must target a computedDynamics parameter."
  },
  {
    checkId: "dynamics.computedParameterProducerMissing",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Computed dynamics parameter has no producer group."
  },
  {
    checkId: "dynamics.outputParameterOutOfRange",
    phase: "dynamics_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-012", "AC-MVP-013"],
    description: "Dynamics output range or runtime output falls outside the target parameter range."
  },
  {
    checkId: "dynamics.outputClamped",
    phase: "dynamics_evaluation",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-012", "AC-MVP-013"],
    description: "Runtime dynamics output was clamped by declared output limits."
  },
  {
    checkId: "dynamics.outputUsedAsDriver",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "A computed dynamics output parameter is used as a dynamics driver."
  },
  {
    checkId: "dynamics.unstableSettings",
    phase: "dynamics_semantic",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics settings are statically unsafe or likely unstable."
  },
  {
    checkId: "dynamics.excessiveAmplitude",
    phase: "dynamics_evaluation",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics maxAmplitude exceeds the safe output or parameter range."
  },
  {
    checkId: "dynamics.runtimeEvidenceMissing",
    phase: "representative_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-012", "AC-MVP-013", "AC-MVP-014"],
    description: "Package dynamics cannot be matched to runtime snapshot evidence."
  },
  {
    checkId: "runtime.loadBlocking",
    phase: "runtime_load",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-012"],
    description: "Runtime snapshot or load evidence cannot be parsed."
  },
  {
    checkId: "runtime.drawListEmpty",
    phase: "runtime_load",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-012"],
    description: "Runtime load produced no visible drawables."
  },
  {
    checkId: "evidence.guiOperationLogMissing",
    phase: "acceptance_evidence",
    defaultSeverity: "blocking",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-001"],
    description: "Acceptance evidence does not include a GUI operation log."
  },
  {
    checkId: "demo.unsafeDependencyClaim",
    phase: "demo_preflight",
    defaultSeverity: "blocking",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-015", "AC-MVP-016"],
    description: "Demo-facing artifact claims a forbidden dependency or compatibility oracle."
  }
] satisfies readonly CheckDefinitionInput[];

export const createCheckCatalog = (
  definitions: readonly CheckDefinitionInput[] = DEFAULT_CHECK_DEFINITIONS
): CheckCatalog => new CheckCatalog(definitions);

export const defaultCheckCatalog = createCheckCatalog();
