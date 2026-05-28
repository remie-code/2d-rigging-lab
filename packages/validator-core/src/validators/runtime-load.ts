import {
  CheckIdSchema,
  RuntimeSnapshotIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  PackageId,
  RuntimeSnapshotId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import {
  RuntimeSnapshotSchema,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";
import type { z } from "zod";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export interface RuntimeSnapshotValidationResult {
  readonly snapshot?: RuntimeSnapshotDto;
  readonly snapshotId?: RuntimeSnapshotId;
  readonly checks: readonly ValidationCheckResultDto[];
}

export const validateRuntimeSnapshot = (
  input: unknown,
  packageId: PackageId
): RuntimeSnapshotValidationResult => {
  const parseResult = RuntimeSnapshotSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      checks: parseResult.error.issues.map((issue) => createRuntimeLoadCheck(issue, packageId))
    };
  }

  const checks = parseResult.data.drawList.length === 0
    ? [createEmptyDrawListCheck(parseResult.data)]
    : [];

  return {
    snapshot: parseResult.data,
    snapshotId: parseResult.data.snapshotId,
    checks
  };
};

const createRuntimeLoadCheck = (issue: z.ZodIssue, packageId: PackageId): ValidationCheckResultDto => {
  const path = issue.path.map(String).join(".");
  const target: TargetRefDto = {
    kind: "package",
    id: packageId,
    ...(path === "" ? {} : { path })
  };

  return ValidationCheckResultSchema.parse({
    checkId: CheckIdSchema.parse("runtime.loadBlocking"),
    status: "fail",
    severity: "blocking",
    phase: "runtime_load",
    target,
    targetPath: path === "" ? undefined : path,
    message: "Runtime snapshot evidence cannot be parsed.",
    evidence: [issue.message],
    relatedAC: ["AC-MVP-012"],
    relatedScenarios: [],
    impact: "Validator cannot prove the package can load into runtime evidence."
  });
};

const createEmptyDrawListCheck = (snapshot: RuntimeSnapshotDto): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: CheckIdSchema.parse("runtime.drawListEmpty"),
    status: "fail",
    severity: "blocking",
    phase: "runtime_load",
    target: {
      kind: "runtimeSnapshot",
      id: snapshot.snapshotId,
      path: "drawList"
    },
    targetPath: "drawList",
    message: "Runtime snapshot drawList is empty.",
    evidence: [`snapshotId=${snapshot.snapshotId}`],
    relatedAC: ["AC-MVP-012"],
    relatedScenarios: [],
    impact: "Viewer load evidence has no visible drawable to render.",
    snapshotIds: [RuntimeSnapshotIdSchema.parse(snapshot.snapshotId)]
  });

