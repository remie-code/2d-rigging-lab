import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";

import { buildValidationReport, createDefaultEvidence } from "../report-builder.js";
import type { ValidationReportDto } from "../validation-report.js";
import { validatePackageSchema } from "./package-schema.js";
import { validateRuntimeSnapshot } from "./runtime-load.js";

export interface PackageRuntimeValidationInput {
  readonly packageDocument: unknown;
  readonly runtimeSnapshot?: unknown;
  readonly profile?: string;
  readonly createdAt?: string;
}

export const validatePackageRuntime = (input: PackageRuntimeValidationInput): ValidationReportDto => {
  const packageResult = validatePackageSchema(input.packageDocument);
  const runtimeResult =
    input.runtimeSnapshot === undefined
      ? undefined
      : validateRuntimeSnapshot(input.runtimeSnapshot, packageResult.packageId);
  const runtimeSnapshotIds: RuntimeSnapshotId[] =
    runtimeResult?.snapshotId === undefined ? [] : [runtimeResult.snapshotId];

  return buildValidationReport({
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
    packageId: packageResult.packageId,
    packageRevision: packageResult.packageRevision,
    profile: input.profile ?? "strict",
    checks: [...packageResult.checks, ...(runtimeResult?.checks ?? [])],
    evidence: createDefaultEvidence(runtimeSnapshotIds)
  });
};
