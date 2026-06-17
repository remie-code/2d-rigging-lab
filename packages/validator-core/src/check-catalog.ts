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
    checkId: "part.orderedChildrenDuplicate",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part mixed ordered children contains the same part or drawable more than once."
  },
  {
    checkId: "part.orderedChildrenTargetMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part mixed ordered children references a missing part or drawable."
  },
  {
    checkId: "part.orderedChildrenMembershipMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    description: "Part mixed ordered children disagrees with parent, childPartIds, or drawableIds membership."
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
    checkId: "asset.psd.parserEvidence",
    phase: "source_import",
    defaultSeverity: "info",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD source profile records parser provenance evidence without exposing parser-private shapes."
  },
  {
    checkId: "asset.psd.parserEvidenceUnavailable",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD source profile claims real PSD parse intake but parser evidence is unavailable."
  },
  {
    checkId: "asset.psd.layerTreeEvidence",
    phase: "source_import",
    defaultSeverity: "info",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD source profile records parser-derived layer tree evidence."
  },
  {
    checkId: "asset.psd.layerTreeEvidenceMissing",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD source profile claims real PSD parse intake but layer tree evidence is missing."
  },
  {
    checkId: "asset.psd.layerTreeEvidenceMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD layer tree evidence disagrees with the profile layer/group summary."
  },
  {
    checkId: "asset.psd.featureUnsupported",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD feature support evidence records an unsupported Photoshop feature boundary."
  },
  {
    checkId: "asset.psd.featureNotEvaluated",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD feature support evidence records a Photoshop feature as not evaluated."
  },
  {
    checkId: "asset.psd.materializationEvidence",
    phase: "source_import",
    defaultSeverity: "info",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD source profile records selected layer raster materialization evidence and provenance."
  },
  {
    checkId: "asset.psd.materializationEvidenceMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD source profile has real parse evidence but no selected layer raster materialization evidence."
  },
  {
    checkId: "asset.psd.materializationEvidenceMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Structured PSD materialization evidence cannot be connected to the referenced source asset or layer."
  },
  {
    checkId: "asset.psd.materializedAssetAvailable",
    phase: "source_import",
    defaultSeverity: "info",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave46 PSD selected-layer materialized asset evidence has package-local bytes and texture/drawable/part mapping."
  },
  {
    checkId: "asset.psd.materializedBytesMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave46 PSD selected-layer materialized bytes are missing or not package-local current bytes."
  },
  {
    checkId: "asset.psd.materializedSourceCurrentBytesMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave46 PSD source bytes are not currently available for re-materialization."
  },
  {
    checkId: "asset.psd.materializedSourceStale",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave46 PSD selected-layer materialized asset evidence was derived from stale or incomplete source PSD identity metadata."
  },
  {
    checkId: "asset.psd.materializedAssetMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave46 PSD selected-layer materialized asset digest, byte length, media type, dimensions, or package-local path metadata mismatch."
  },
  {
    checkId: "asset.psd.materializedParserExtractionMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-013"],
    description: "Wave46 PSD selected-layer materialized asset parser, extraction, or source layer reference evidence mismatch."
  },
  {
    checkId: "asset.psd.materializedProvenanceBlocked",
    phase: "rights",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave46 PSD selected-layer materialized asset lacks private/local non-public provenance or claims public demo asset use."
  },
  {
    checkId: "asset.psd.materializedDestinationMappingMissing",
    phase: "reference",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave46 PSD selected-layer materialized asset destination texture, drawable, or part mapping is missing or inconsistent."
  },
  {
    checkId: "asset.psd.materializedBatchEvidenceMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch materialization evidence was required but not supplied for session Product Preflight."
  },
  {
    checkId: "asset.psd.materializedBatchEvidenceMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch materialization evidence is malformed or internally inconsistent."
  },
  {
    checkId: "asset.psd.materializedBatchAvailable",
    phase: "source_import",
    defaultSeverity: "info",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch materialized assets and generated part scaffold evidence are available."
  },
  {
    checkId: "asset.psd.materializedBatchBytesMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch entry materialized bytes are missing or not package-local current bytes."
  },
  {
    checkId: "asset.psd.materializedBatchEntryMissing",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch entry is marked successful but the package has no matching per-layer materialization evidence."
  },
  {
    checkId: "asset.psd.materializedBatchSourceCurrentBytesMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch source bytes are not currently available for re-materialization."
  },
  {
    checkId: "asset.psd.materializedBatchSourceStale",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch entry was derived from stale or incomplete source PSD identity metadata."
  },
  {
    checkId: "asset.psd.materializedBatchAssetMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch entry digest, byte length, media type, dimensions, or package-local path metadata mismatch."
  },
  {
    checkId: "asset.psd.materializedBatchProvenanceBlocked",
    phase: "rights",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch entry lacks private/local non-public provenance or claims public demo asset use."
  },
  {
    checkId: "asset.psd.materializedBatchDestinationParentInvalid",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch generated part scaffold references an invalid destination parent part."
  },
  {
    checkId: "asset.psd.materializedBatchGeneratedScaffoldMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch generated part, drawable, mesh, texture, or materialized binary mapping is missing or inconsistent."
  },
  {
    checkId: "asset.psd.materializedBatchDuplicateLayer",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch repeats a source layer ref and must not silently duplicate materialization."
  },
  {
    checkId: "asset.psd.materializedBatchGeneratedScaffoldCollision",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch generated part, drawable, mesh, texture ID, or display name collides."
  },
  {
    checkId: "asset.psd.materializedBatchPreflightBlocked",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch was blocked before commit or failed without available per-layer materialization."
  },
  {
    checkId: "asset.psd.materializedBatchPartialFailure",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave47 PSD selected-layer batch reports partial failure and cannot be summarized as simple success."
  },
  {
    checkId: "asset.psd.importPlanEvidenceMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan approval bridge evidence was required but not supplied for session Product Preflight."
  },
  {
    checkId: "asset.psd.importPlanEvidenceMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan candidate or approval bridge evidence is malformed."
  },
  {
    checkId: "asset.psd.importPlanCandidateMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan candidate summary, digest, or selected candidate reference does not match approval or batch evidence."
  },
  {
    checkId: "asset.psd.importPlanCandidateStatusSummary",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan preview records not-approved, hidden, unsupported, duplicate, collision, or byte-cap-blocked candidates without importing them."
  },
  {
    checkId: "asset.psd.importPlanApprovalMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan approval status, selected leaf refs, destination, generated scaffold preview, or batch entries do not match."
  },
  {
    checkId: "asset.psd.importPlanNotApprovedCandidateSelected",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan evidence shows a not-approved candidate was selected for materialization."
  },
  {
    checkId: "asset.psd.importPlanCandidateBlocked",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan evidence shows a hidden, unsupported, empty, duplicate-ref, generated-collision, or byte-cap-blocked candidate was selected."
  },
  {
    checkId: "asset.psd.importPlanPreflightBlocked",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan approval or batch execution was blocked by collision, byte cap, approval, or preflight evidence."
  },
  {
    checkId: "asset.psd.importPlanPartialState",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave48 PSD import-plan batch evidence reports partial success or partial failure and cannot be summarized as available."
  },
  {
    checkId: "asset.psd.importPlanSourceCurrentBytesMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave48 PSD import-plan source bytes are not currently available for re-plan or re-materialization."
  },
  {
    checkId: "asset.psd.importPlanSourceStale",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave48 PSD import-plan source identity is stale or mismatched against current source or materialization evidence."
  },
  {
    checkId: "asset.psd.importPlanProvenanceBlocked",
    phase: "rights",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave48 PSD import-plan evidence lacks required private/local non-public provenance or no-raw-byte boundary fields."
  },
  {
    checkId: "asset.psd.structuralScaffoldEvidenceMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold operation evidence was required but not supplied for session Product Preflight."
  },
  {
    checkId: "asset.psd.structuralScaffoldEvidenceMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold operation evidence is malformed or internally inconsistent."
  },
  {
    checkId: "asset.psd.structuralScaffoldAvailable",
    phase: "source_import",
    defaultSeverity: "info",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold hierarchy and leaf materialization evidence are available."
  },
  {
    checkId: "asset.psd.structuralScaffoldPreflightBlocked",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold evidence reports a preflight-blocked operation or issue."
  },
  {
    checkId: "asset.psd.structuralScaffoldPartialState",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold evidence reports a failed or partial state that cannot be summarized as available."
  },
  {
    checkId: "asset.psd.structuralScaffoldPlanStale",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold plan evidence is stale or absent from stored source profile evidence."
  },
  {
    checkId: "asset.psd.structuralScaffoldApprovalMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold approval evidence is stale, mismatched, or not approved."
  },
  {
    checkId: "asset.psd.structuralScaffoldSourceCurrentBytesMissing",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold source bytes are not currently available for source identity revalidation."
  },
  {
    checkId: "asset.psd.structuralScaffoldSourceStale",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold source identity is stale or mismatched against current source evidence."
  },
  {
    checkId: "asset.psd.structuralScaffoldSourceGroupMappingMissing",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold group evidence cannot be resolved to source group metadata."
  },
  {
    checkId: "asset.psd.structuralScaffoldSourceLayerMappingMissing",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold leaf evidence cannot be resolved to source layer mapping metadata."
  },
  {
    checkId: "asset.psd.structuralScaffoldSourceLayerMappingMismatch",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold leaf source metadata disagrees with stored source layer metadata."
  },
  {
    checkId: "asset.psd.structuralScaffoldParentageMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold generated parentage does not match source hierarchy or model graph evidence."
  },
  {
    checkId: "asset.psd.structuralScaffoldSourceOrderMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold generated order does not preserve sourceOrder when model ordering evidence is available."
  },
  {
    checkId: "asset.psd.structuralScaffoldGeneratedPartMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural group scaffold references a missing generated part container."
  },
  {
    checkId: "asset.psd.structuralScaffoldGeneratedParentMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold references a missing generated parent part."
  },
  {
    checkId: "asset.psd.structuralScaffoldGeneratedDrawableMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural leaf scaffold references a missing generated drawable."
  },
  {
    checkId: "asset.psd.structuralScaffoldGeneratedTextureMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural leaf scaffold references a missing generated texture."
  },
  {
    checkId: "asset.psd.structuralScaffoldGeneratedMeshMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural leaf scaffold references a missing generated mesh."
  },
  {
    checkId: "asset.psd.structuralScaffoldGeneratedRefMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold generated drawable, texture, mesh, or membership refs are inconsistent."
  },
  {
    checkId: "asset.psd.structuralScaffoldGeneratedRefCollision",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold generated part, drawable, mesh, or texture refs collide."
  },
  {
    checkId: "asset.psd.structuralInitialRuntimeVisibilityMismatch",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural leaf initial runtime visibility does not match source visibility or generated drawable runtime visibility."
  },
  {
    checkId: "asset.psd.structuralScaffoldByteUnavailable",
    phase: "source_import",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold byte-dependent materialization evidence is unavailable for current Product Preflight evaluation."
  },
  {
    checkId: "asset.psd.structuralScaffoldProvenanceBlocked",
    phase: "rights",
    defaultSeverity: "blocking",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-002", "AC-MVP-003", "AC-MVP-013"],
    description: "Wave50 PSD structural scaffold evidence lacks private/local non-public provenance."
  },
  {
    checkId: "asset.psd.structuralGroupForbiddenDrawableClaim",
    phase: "source_import",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-003", "AC-MVP-004", "AC-MVP-013"],
    description: "Wave50 PSD structural group scaffold evidence claims forbidden drawable, texture, or mesh refs."
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
    checkId: "mesh.duplicateTriangle",
    phase: "mesh_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    description: "Mesh contains more than one triangle over the same vertex index triplet."
  },
  {
    checkId: "mesh.orphanedVertex",
    phase: "mesh_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    description: "Mesh contains a stable vertex ID that is not referenced by any triangle."
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
    checkId: "mesh.triangleStableIdsLengthMismatch",
    phase: "mesh_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    description: "Mesh triangleStableIds length does not match triangles length."
  },
  {
    checkId: "mesh.uvCoordinateOutOfBounds",
    phase: "mesh_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-013"],
    description: "Mesh UV coordinate is outside the project-defined semantic 0..1 UV domain."
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
    checkId: "mesh.runtimeEvidenceMismatch",
    phase: "representative_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-005", "AC-MVP-012", "AC-MVP-013"],
    description: "Runtime or viewer mesh evidence disagrees with package mesh topology, identity, bounds, hash, or exposed vertex evidence."
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
    checkId: "rigControl.duplicateChild",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Rig control child collections contain the same child target more than once."
  },
  {
    checkId: "rigControl.drawableMultipleParents",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "A drawable is bound under more than one rig control at the same time."
  },
  {
    checkId: "rigControl.opacityMultiplierRange",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    description: "Rig control static opacity multiplier must stay within the normalized 0..1 range."
  },
  {
    checkId: "parameter.duplicateId",
    phase: "package_schema",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Parameter ids must be unique within the package parameter file."
  },
  {
    checkId: "parameter.presetLockedMutation",
    phase: "package_schema",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Preset parameter role, group, range, and sign convention fields must match the locked catalog."
  },
  {
    checkId: "keyform.duplicateSetId",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Keyform set ids must be unique within the package keyforms file."
  },
  {
    checkId: "keyform.parameterMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Keyform parameter axes must reference stored or preset-initialized parameters."
  },
  {
    checkId: "keyform.keyOutOfRange",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Keyform positions must stay within the referenced parameter range."
  },
  {
    checkId: "keyform.targetMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Keyform targets must reference an existing drawable, mesh, rig control, or draw-order entry."
  },
  {
    checkId: "keyform.unsupportedTargetProperty",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Keyform targets must use a runtime-supported target/property pair."
  },
  {
    checkId: "keyform.linear1dDuplicateKey",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-013"],
    description: "Linear 1D keyform sets must not store duplicate key positions."
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
    checkId: "rigControl.warpDeformerInvalidDivisions",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    description: "Warp Deformer transform or Bezier divisions are not valid positive control point counts."
  },
  {
    checkId: "rigControl.warpDeformerTransformGridMismatch",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    description: "Warp Deformer transformGrid does not match the stored warpLattice2d latticeColumns/latticeRows."
  },
  {
    checkId: "rigControl.warpDeformerBezierSurfaceCardinalityMismatch",
    phase: "rigControl_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    description: "Warp Deformer Bezier edit surface cardinality does not match bezier columns * rows."
  },
  {
    checkId: "dynamics.inputMissing",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics v0 additive pendulum group has no input parameter."
  },
  {
    checkId: "dynamics.invalidPendulumCardinality",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics v0 group must contain exactly one pendulum."
  },
  {
    checkId: "dynamics.invalidOutputCardinality",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics v0 group must contain exactly one output."
  },
  {
    checkId: "dynamics.driverMissing",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics group references a missing input parameter."
  },
  {
    checkId: "dynamics.outputMissing",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics group targets a missing additive output parameter."
  },
  {
    checkId: "dynamics.outputTargetDuplicate",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Multiple dynamics groups target the same additive output parameter."
  },
  {
    checkId: "dynamics.normalizationInvalid",
    phase: "dynamics_semantic",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics input normalization must satisfy min < center < max."
  },
  {
    checkId: "dynamics.zeroInputInfluence",
    phase: "dynamics_semantic",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics inputs all have zero influence."
  },
  {
    checkId: "dynamics.outputStrengthZero",
    phase: "dynamics_semantic",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics output strength is zero."
  },
  {
    checkId: "dynamics.outputLimitTooSmall",
    phase: "dynamics_semantic",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics output limit is zero or too small to show visible motion."
  },
  {
    checkId: "dynamics.unstableSettings",
    phase: "dynamics_semantic",
    defaultSeverity: "warning",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-010", "AC-MVP-013"],
    description: "Dynamics pendulum coefficients are statically unsafe or likely unstable."
  },
  {
    checkId: "dynamics.runtimeEvidenceMismatch",
    phase: "representative_evaluation",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-012", "AC-MVP-013", "AC-MVP-014"],
    description: "Provided runtime dynamics evidence disagrees with package Dynamics group."
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
    description: "Tutorial mini model is missing enabled Dynamics v2 additive pendulum evidence."
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
