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
    checks: parseResult.issues.map((issue) => createSchemaIssueCheck(issue, fallbackPackageId))
  };
};

const createSchemaIssueCheck = (issue: z.ZodIssue, packageId: PackageId): ValidationCheckResultDto => {
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

const readPackageId = (input: unknown): PackageId => {
  const candidate = readNestedValue(input, ["manifest", "packageId"]);
  const parsed = typeof candidate === "string" ? PackageIdSchema.safeParse(candidate) : undefined;
  return parsed?.success === true ? parsed.data : PackageIdSchema.parse("pkg_unknown");
};

const readPackageRevision = (input: unknown): number => {
  const candidate = readNestedValue(input, ["manifest", "packageRevision"]);
  return typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0 ? candidate : 0;
};

const readNestedValue = (input: unknown, path: readonly string[]): unknown => {
  let current = input;
  for (const segment of path) {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
};

