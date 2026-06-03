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
  "mask_resolution",
  "rigControl_semantic",
  "rigControl_evaluation",
  "dynamics_semantic",
  "dynamics_evaluation",
  "runtime_load",
  "runtime_state",
  "representative_evaluation",
  "acceptance_evidence",
  "tutorial_readiness",
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
    checkId: "ref.drawablePartMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Drawable part reference cannot be resolved."
  },
  {
    checkId: "part.parentMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part parent reference cannot be resolved."
  },
  {
    checkId: "part.childMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part child reference cannot be resolved."
  },
  {
    checkId: "part.duplicateChild",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part childPartIds contains the same child part more than once."
  },
  {
    checkId: "part.parentChildMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part parentPartId and childPartIds references disagree."
  },
  {
    checkId: "part.cycle",
    phase: "reference",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part hierarchy contains a cycle."
  },
  {
    checkId: "part.drawableMembershipMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Drawable partId and part drawableIds membership disagree."
  },
  {
    checkId: "part.deleteNonEmpty",
    phase: "reference",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part delete candidate is blocked because the part still owns child, drawable, mask, or rig-control evidence."
  },
  {
    checkId: "part.runtimeEvidenceMismatch",
    phase: "representative_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-012", "AC-MVP-013"],
    description: "Runtime or viewer part hierarchy evidence disagrees with package part and drawable membership."
  },
  {
    checkId: "editorState.staleReference",
    phase: "reference",
    defaultSeverity: "warning",
    profiles: ["editorIncremental", "viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-011", "AC-MVP-013"],
    description: "Editor-only selection, lock, or hide state references a package target that no longer exists."
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
    checkId: "mask.sourceMissing",
    phase: "mask_resolution",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-007", "AC-MVP-013"],
    description: "Mask relation source drawable reference cannot be resolved."
  },
  {
    checkId: "mask.targetMissing",
    phase: "mask_resolution",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-007", "AC-MVP-013"],
    description: "Mask relation target drawable reference cannot be resolved."
  },
  {
    checkId: "mask.selfReference",
    phase: "mask_resolution",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-007", "AC-MVP-013"],
    description: "Mask relation uses the same drawable as source and target."
  },
  {
    checkId: "mask.duplicateRelation",
    phase: "mask_resolution",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-007", "AC-MVP-013"],
    description: "Mask relation duplicates an existing relation ID or source-target relation."
  },
  {
    checkId: "mask.runtimeEvidenceMissing",
    phase: "mask_resolution",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-007", "AC-MVP-012", "AC-MVP-013"],
    description: "Enabled mask relation cannot be matched to current runtime snapshot evidence, including stale snapshot identity mismatch."
  },
  {
    checkId: "mask.runtimeEvidenceMismatch",
    phase: "mask_resolution",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-007", "AC-MVP-012", "AC-MVP-013"],
    description: "Runtime mask evidence is disabled, unknown, unresolved, or source/target-mismatched for the package relation."
  },
  {
    checkId: "mask.opacityEvidenceMissing",
    phase: "mask_resolution",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-007", "AC-MVP-012", "AC-MVP-013"],
    description: "Runtime evidence lacks drawable opacity entries required to validate mask composition semantics."
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
    checkId: "byteAvailability.currentSessionBytes.missing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Current-session byte evidence is missing for byte-intake validation."
  },
  {
    checkId: "byteAvailability.requiresReupload",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "The caller must reupload binary bytes before validation can treat byte-intake evidence as available."
  },
  {
    checkId: "byteAvailability.verifiedSummary.stale",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "A verified byte summary is stale and cannot stand in for current-session bytes."
  },
  {
    checkId: "byteAvailability.packageId.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Byte availability evidence belongs to a different package identity."
  },
  {
    checkId: "byteAvailability.packageRevision.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Byte availability evidence belongs to a different package revision."
  },
  {
    checkId: "byteAvailability.binaryAssetRef.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Byte availability evidence targets a different binary asset reference."
  },
  {
    checkId: "byteAvailability.digest.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Byte availability digest evidence does not match the requested binary asset reference."
  },
  {
    checkId: "byteAvailability.byteLength.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Byte availability byte length evidence does not match the requested binary asset reference."
  },
  {
    checkId: "byteAvailability.mediaType.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Byte availability media type evidence does not match the requested binary asset reference."
  },
  {
    checkId: "byteAvailability.digest.unsupported",
    phase: "reference",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Current-session byte digest verification is unsupported in the current validation environment."
  },
  {
    checkId: "persistentByteStorage.backend.unavailable",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Browser-local persistent byte storage is unavailable or unsupported for the requested binary asset."
  },
  {
    checkId: "persistentByteStorage.backend.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte storage evidence was recorded for a different storage backend."
  },
  {
    checkId: "persistentByteStorage.record.missing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "No browser-local persistent byte record is linked to the requested binary asset."
  },
  {
    checkId: "persistentByteStorage.record.unverified",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Browser-local persistent byte record metadata has not been verified."
  },
  {
    checkId: "persistentByteStorage.verification.missing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent bytes were not re-read and verified before validator availability evaluation."
  },
  {
    checkId: "persistentByteStorage.packageId.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte storage evidence belongs to a different package identity."
  },
  {
    checkId: "persistentByteStorage.packageRevision.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte storage evidence belongs to a different package revision."
  },
  {
    checkId: "persistentByteStorage.binaryAssetRef.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte storage evidence targets a different binary asset reference."
  },
  {
    checkId: "persistentByteStorage.digest.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte storage digest evidence does not match the requested binary asset reference or re-read bytes."
  },
  {
    checkId: "persistentByteStorage.byteLength.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte storage byte length evidence does not match the requested binary asset reference or re-read bytes."
  },
  {
    checkId: "persistentByteStorage.mediaType.mismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte storage media type evidence does not match the requested binary asset reference or re-read bytes."
  },
  {
    checkId: "persistentByteStorage.bytes.missing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte verification could not find the browser-local stored bytes."
  },
  {
    checkId: "persistentByteStorage.digest.unsupported",
    phase: "reference",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Persistent byte digest verification is unsupported in the current validation environment."
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
    checkId: "portableBundle.schemaInvalid",
    phase: "source_import",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle evidence does not match the project-defined JSON bundle v0 contract."
  },
  {
    checkId: "portableBundle.unsupportedVersion",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle schemaVersion is not supported by the validator."
  },
  {
    checkId: "portableBundle.missingPayload",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle binary payload evidence is missing required base64 bytes."
  },
  {
    checkId: "portableBundle.missingRequiredBinary",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle evidence is missing a required package binary payload."
  },
  {
    checkId: "portableBundle.digestMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle payload SHA-256 digest does not match binary reference metadata."
  },
  {
    checkId: "portableBundle.byteLengthMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle payload byte length does not match binary reference metadata."
  },
  {
    checkId: "portableBundle.availabilityMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle byte payload evidence conflicts with binary availability metadata."
  },
  {
    checkId: "portableBundle.digestUnsupported",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Portable bundle payload SHA-256 digest verification is unsupported in the current validation environment."
  },
  {
    checkId: "transportCapability.evidenceMissing",
    phase: "source_import",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    description: "Required package transport capability evidence is absent."
  },
  {
    checkId: "transportCapability.schemaInvalid",
    phase: "source_import",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    description: "Package transport capability evidence is malformed or contradicts the transport capability contract."
  },
  {
    checkId: "transportCapability.unsupported",
    phase: "source_import",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    description: "Package transport capability evidence records an unsupported transport boundary."
  },
  {
    checkId: "transportCapability.futureGated",
    phase: "source_import",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    description: "Package transport capability evidence records a future-gated transport boundary."
  },
  {
    checkId: "transportCapability.dependencyGated",
    phase: "source_import",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013", "AC-MVP-015", "AC-MVP-016"],
    description: "Package transport capability evidence records a dependency-gated transport boundary."
  },
  {
    checkId: "byteIntake.unsupportedClaim",
    phase: "source_import",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-015", "AC-MVP-016"],
    description: "Byte-intake evidence claims parser, image decode, or archive support that Wave31 does not implement."
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
    checkId: "mesh.degenerateTriangle",
    phase: "mesh_semantic",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005"],
    description: "Mesh triangle has repeated vertices or zero area."
  },
  {
    checkId: "mesh.vertexStableIdsLengthMismatch",
    phase: "mesh_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    description: "Mesh vertexStableIds length does not match vertices length."
  },
  {
    checkId: "mesh.uvCountMismatch",
    phase: "mesh_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    description: "Mesh UV count does not match vertices length."
  },
  {
    checkId: "mesh.runtimeEvidenceMissing",
    phase: "representative_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-012", "AC-MVP-013"],
    description: "Package mesh cannot be matched to runtime or viewer snapshot evidence."
  },
  {
    checkId: "rigControl.cycle",
    phase: "rigControl_semantic",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Rig control hierarchy contains a parent-child cycle."
  },
  {
    checkId: "rigControl.parentMissing",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Rig control parent reference cannot be resolved."
  },
  {
    checkId: "rigControl.childMissing",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Rig control child drawable or child rig control reference cannot be resolved."
  },
  {
    checkId: "rigControl.invalidChildTargetKind",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Rig control child binding is stored under a child collection that does not match the target ID kind."
  },
  {
    checkId: "rigControl.parentChildMismatch",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Rig control child list and child parent reference disagree."
  },
  {
    checkId: "rigControl.runtimeEvidenceMissing",
    phase: "rigControl_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-012", "AC-MVP-013"],
    description: "Package rig control hierarchy cannot be matched to runtime snapshot evidence."
  },
  {
    checkId: "rigControl.warpLatticeCardinalityMismatch",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    description: "warpLattice2d latticeColumns * latticeRows does not match restControlPoints length."
  },
  {
    checkId: "rigControl.warpLatticeDomainBoundsInvalid",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "warpLattice2d domainBounds is not a positive runtime evaluation domain."
  },
  {
    checkId: "rigControl.warpLatticeRestControlPointMismatch",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "warpLattice2d restControlPoints are not coherent with the declared domainBounds."
  },
  {
    checkId: "rigControl.warpLatticeUnsupportedProperty",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    description: "warpLattice2d keyform targets a property other than controlPointOffsets."
  },
  {
    checkId: "rigControl.warpLatticeMalformedPatch",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    description: "warpLattice2d controlPointOffsets keyform patch is not one Vec2 offset per rest control point."
  },
  {
    checkId: "rigControl.warpLatticeRuntimeEvidenceMismatch",
    phase: "rigControl_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-012", "AC-MVP-013"],
    description: "warpLattice2d runtime evidence disagrees with package lattice shape, domain, affected drawables, or keyform patch evidence."
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
    checkId: "viewer.runtimeEvidenceMissing",
    phase: "representative_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-012", "AC-MVP-013", "AC-MVP-014"],
    description: "Viewer validation requires viewer runtime snapshot/evaluation evidence that is absent or unparseable."
  },
  {
    checkId: "viewer.runtimeEvidenceStale",
    phase: "representative_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-012", "AC-MVP-013", "AC-MVP-014"],
    description: "Viewer runtime evidence does not match the validated package or runtime snapshot context."
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
    checkId: "tutorial.requiredPartMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Tutorial mini model is missing one of the required synthetic character part roles."
  },
  {
    checkId: "tutorial.requiredMeshMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    description: "Tutorial mini model is missing generated drawable mesh evidence."
  },
  {
    checkId: "tutorial.requiredDrawableMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-004", "AC-MVP-005", "AC-MVP-013"],
    description: "Tutorial mini model is missing required mouth or eye drawable/layer evidence under the face part."
  },
  {
    checkId: "tutorial.requiredMaskOrOpacityMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-007", "AC-MVP-013"],
    description: "Tutorial mini model is missing enabled mask relation or authored opacity evidence."
  },
  {
    checkId: "tutorial.requiredRigControlMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Tutorial mini model is missing enabled rotation2d rig control evidence."
  },
  {
    checkId: "tutorial.requiredKeyformMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Tutorial mini model is missing rigControl angle keyform evidence."
  },
  {
    checkId: "tutorial.requiredDynamicsMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-010", "AC-MVP-012", "AC-MVP-013"],
    description: "Tutorial mini model is missing enabled Minimum Open Dynamics v1 evidence."
  },
  {
    checkId: "tutorial.viewerEvidenceMissing",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-012", "AC-MVP-013", "AC-MVP-014"],
    description: "Tutorial readiness requires semantic viewer runtime evidence."
  },
  {
    checkId: "tutorial.evidenceStale",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-012", "AC-MVP-013", "AC-MVP-014"],
    description: "Tutorial readiness evidence does not match the validated package or viewer context."
  },
  {
    checkId: "tutorial.missingReference",
    phase: "tutorial_readiness",
    defaultSeverity: "error",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    description: "Tutorial readiness-specific evidence references a missing package target."
  },
  {
    checkId: "tutorial.unsupportedClaim",
    phase: "tutorial_readiness",
    defaultSeverity: "blocking",
    profiles: ["acceptance"],
    relatedAC: ["AC-MVP-015", "AC-MVP-016"],
    description: "Tutorial readiness rejects real-asset, renderer, pixel oracle, public distribution, file I/O, or Cubism compatibility claims."
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
