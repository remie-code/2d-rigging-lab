import {
  CheckIdSchema,
  PackageIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { PackageId, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import {
  parsePackageDocument,
  type PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import type { z } from "zod";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import { createWarpLatticeSchemaIssueCheck } from "./warp-lattice-schema-issues.js";

export interface PackageSchemaValidationResult {
  readonly packageDocument?: PackageDocumentDto;
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly packageHash?: string;
  readonly checks: readonly ValidationCheckResultDto[];
}

export const validatePackageSchema = (input: unknown): PackageSchemaValidationResult => {
  const parseResult = parsePackageDocument(input);
  if (parseResult.success) {
    return {
      packageDocument: parseResult.data,
      packageId: parseResult.data.manifest.packageId,
      packageRevision: parseResult.data.manifest.packageRevision,
      checks: []
    };
  }

  const fallbackPackageId = readPackageId(input);
  return {
    packageId: fallbackPackageId,
    packageRevision: readPackageRevision(input),
    checks: parseResult.issues.map((issue) => createSchemaIssueCheck(issue, input, fallbackPackageId))
  };
};

const createSchemaIssueCheck = (
  issue: z.ZodIssue,
  input: unknown,
  packageId: PackageId
): ValidationCheckResultDto => {
  const rigControlChildKindCheck = createInvalidRigControlChildTargetKindCheck(issue, input, packageId);
  if (rigControlChildKindCheck !== undefined) {
    return rigControlChildKindCheck;
  }

  const warpLatticeSchemaCheck = createWarpLatticeSchemaIssueCheck(issue, input, packageId);
  if (warpLatticeSchemaCheck !== undefined) {
    return warpLatticeSchemaCheck;
  }

  const path = issue.path.map(String).join(".");
  const target: TargetRefDto = {
    kind: "package",
    id: packageId,
    ...(path === "" ? {} : { path })
  };

  return ValidationCheckResultSchema.parse({
    checkId: CheckIdSchema.parse("pkg.schema.requiredFileMissing"),
    status: "fail",
    severity: "blocking",
    phase: "package_schema",
    target,
    targetPath: path === "" ? undefined : path,
    message: path === ""
      ? "Package document does not match the required package schema."
      : `Package document is missing or invalid at ${path}.`,
    evidence: [issue.message],
    relatedAC: ["AC-MVP-013"],
    relatedScenarios: [],
    impact: "Validator cannot trust package contents until the required package DTO is present."
  });
};

const createInvalidRigControlChildTargetKindCheck = (
  issue: z.ZodIssue,
  input: unknown,
  packageId: PackageId
): ValidationCheckResultDto | undefined => {
  const path = issue.path.map(String);
  if (
    path[0] !== "model" ||
    path[1] !== "rigControls" ||
    path[2] !== "rigControls" ||
    (path[4] !== "childDrawableIds" && path[4] !== "childRigControlIds")
  ) {
    return undefined;
  }

  const expectedChildKind = path[4] === "childDrawableIds" ? "drawable" : "rigControl";
  const childId = readNestedValue(input, path);
  const actualChildKind = typeof childId === "string" ? inferTargetKindFromId(childId) : "unknown";
  const rigControl = readNestedValue(input, path.slice(0, 4));
  const rigControlId = readObjectString(rigControl, "rigControlId");
  const target: TargetRefDto = rigControlId === undefined
    ? {
        kind: "package",
        id: packageId,
        path: path.join(".")
      }
    : {
        kind: "rigControl",
        id: rigControlId,
        path: path.join(".")
      };

  return ValidationCheckResultSchema.parse({
    checkId: CheckIdSchema.parse("rigControl.invalidChildTargetKind"),
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target,
    targetPath: path.join("."),
    message: `Rig control child binding at ${path.join(".")} is not a ${expectedChildKind} target.`,
    evidence: [
      `rigControlId=${rigControlId ?? "unknown"}`,
      `childCollection=${path[4]}`,
      `expectedChildKind=${expectedChildKind}`,
      `childId=${typeof childId === "string" ? childId : "unknown"}`,
      `actualChildKind=${actualChildKind}`,
      issue.message
    ],
    relatedAC: ["AC-MVP-009", "AC-MVP-013"],
    relatedScenarios: ["SC-MVP-002", "SC-MVP-004"],
    impact: "The package cannot resolve a rig control child binding whose stored collection and target kind disagree."
  });
};

const readPackageId = (input: unknown): PackageId => {
  const candidate = readNestedValue(input, ["manifest", "packageId"]);
  const parsed = typeof candidate === "string" ? PackageIdSchema.safeParse(candidate) : undefined;
  return parsed?.success === true ? parsed.data : PackageIdSchema.parse("pkg_unknown");
};

const readPackageRevision = (input: unknown): number => {
  const candidate = readNestedValue(input, ["manifest", "packageRevision"]);
  return typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0 ? candidate : 0;
};

const readNestedValue = (input: unknown, path: readonly (string | number)[]): unknown => {
  let current = input;
  for (const segment of path) {
    const key = String(segment);
    if (typeof current !== "object" || current === null || !(key in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current;
};

const readObjectString = (input: unknown, key: string): string | undefined => {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return undefined;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
};

const inferTargetKindFromId = (targetId: string): string => {
  if (targetId.startsWith("draw_")) {
    return "drawable";
  }
  if (targetId.startsWith("rig_")) {
    return "rigControl";
  }
  if (targetId.startsWith("part_")) {
    return "part";
  }
  if (targetId.startsWith("mesh_")) {
    return "mesh";
  }
  if (targetId.startsWith("param_")) {
    return "parameter";
  }
  if (targetId.startsWith("dyn_")) {
    return "dynamicsGroup";
  }

  return "unknown";
};
