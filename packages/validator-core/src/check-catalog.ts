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
  "runtime_load",
  "runtime_state",
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
    checkId: "ref.drawableTextureMissing",
    phase: "reference",
    defaultSeverity: "error",
    profiles: ["viewer", "strict", "acceptance", "aiDryRun"],
    relatedAC: ["AC-MVP-004"],
    description: "Drawable texture reference cannot be resolved."
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

