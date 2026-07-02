import type { PackageDocumentDto } from "@private-2d-rigging-lab/package-format";
import type { ValidationProfile } from "@private-2d-rigging-lab/contracts";
import {
  buildValidationReport,
  createDefaultEvidence,
  validateDrawableProvenanceReferences,
  validateDrawableReferences,
  validateDynamicsSemantics,
  validateMaskCompositionSemantics,
  validateMeshSemantics,
  validatePackageSchema,
  validatePartLayerSemantics,
  validateRigControlSemantics,
  validateSourceAssetRightsAndProvenance,
  validateTextureAssetReferences,
  type ValidationCheckResultDto,
  type ValidationReportDto
} from "@private-2d-rigging-lab/validator-core";

/**
 * Version tag recorded in the produced report so consumers can distinguish the
 * headless authoring-host's document-only validator orchestration from other
 * validator-core drivers (e.g. GUI or runtime-evidence flows).
 */
export const AUTHORING_HOST_VALIDATOR_VERSION = "authoring-host-validate-package-v1";

export interface ValidatePackageDocumentInput {
  /**
   * The package document to validate. For the one-shot CLI this is the document
   * obtained at load time, which — because a validate request neither dry-runs nor
   * commits — is identical to the current session graph (the session revision has not
   * advanced within the process).
   */
  readonly packageDocument: PackageDocumentDto;
  readonly profile: ValidationProfile;
  /** When set, overrides the packageRevision recorded on the report. */
  readonly packageRevision?: number;
  readonly createdAt?: string;
}

/**
 * Runs validator-core's document-only validator set against a package document and
 * aggregates the diagnostics into a single {@link ValidationReportDto}.
 *
 * Scope of coverage (document-derivable diagnostics only):
 *   - package schema conformance (via validatePackageSchema),
 *   - drawable → source-asset / texture references,
 *   - texture atlas asset references,
 *   - mesh topology semantics (runtime-evidence lane intentionally not required),
 *   - mask composition semantics,
 *   - rig-control semantics,
 *   - part / layer semantics,
 *   - dynamics semantics,
 *   - drawable provenance references,
 *   - source-asset rights and provenance.
 *
 * Intentionally excluded: validators that require a runtime snapshot or GUI operation
 * log as input (runtime-load / runtime-evidence / viewer-evidence / part-runtime-evidence /
 * package-runtime / binary-asset byte checks / PSD intake / product-preflight). Those need
 * evidence the headless validate path does not evaluate; the report's `evidence` block
 * records that no runtime snapshots or operation log backed this report so the coverage
 * gap is explicit rather than silently implied as "passed".
 */
export const validatePackageDocument = (
  input: ValidatePackageDocumentInput
): ValidationReportDto => {
  const schemaResult = validatePackageSchema(input.packageDocument);

  const checks: ValidationCheckResultDto[] = [...schemaResult.checks];

  // Only run structural document validators when the document parsed cleanly. If schema
  // parsing failed, `schemaResult.packageDocument` is undefined and the schema
  // diagnostics already describe the defect; running structural validators against an
  // unvalidated shape would risk spurious throws on malformed input.
  const parsedDocument = schemaResult.packageDocument;
  if (parsedDocument !== undefined) {
    checks.push(
      ...validateDrawableReferences(parsedDocument),
      ...validateTextureAssetReferences(parsedDocument),
      ...validateMeshSemantics({ packageDocument: parsedDocument }),
      ...validateMaskCompositionSemantics(parsedDocument),
      ...validateRigControlSemantics(parsedDocument),
      ...validatePartLayerSemantics(parsedDocument),
      ...validateDynamicsSemantics(parsedDocument),
      ...validateDrawableProvenanceReferences(parsedDocument),
      ...validateSourceAssetRightsAndProvenance(parsedDocument)
    );
  }

  return buildValidationReport({
    packageId: schemaResult.packageId,
    packageRevision: input.packageRevision ?? schemaResult.packageRevision,
    ...(schemaResult.packageHash === undefined ? {} : { packageHash: schemaResult.packageHash }),
    validatorVersion: AUTHORING_HOST_VALIDATOR_VERSION,
    profile: input.profile,
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    checks,
    // No runtime snapshot or operation log backs a document-only validate: record the
    // coverage boundary explicitly instead of leaving it implied.
    evidence: createDefaultEvidence()
  });
};
