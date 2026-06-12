import {
  CheckIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  PackageId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import type { z } from "zod";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const createWarpLatticeSchemaIssueCheck = (
  issue: z.ZodIssue,
  input: unknown,
  packageId: PackageId
): ValidationCheckResultDto | undefined => {
  const path = issue.path.map(String);
  if (path[0] !== "model") {
    return undefined;
  }

  const rigControlCheck = createWarpLatticeRigControlSchemaCheck(issue, input, packageId, path);
  if (rigControlCheck !== undefined) {
    return rigControlCheck;
  }

  return createWarpLatticeKeyformSchemaCheck(issue, input, packageId, path);
};

const createWarpLatticeRigControlSchemaCheck = (
  issue: z.ZodIssue,
  input: unknown,
  packageId: PackageId,
  path: readonly string[]
): ValidationCheckResultDto | undefined => {
  if (
    path[1] !== "rigControls" ||
    path[2] !== "rigControls" ||
    path[3] === undefined
  ) {
    return undefined;
  }

  const rigControlIndex = path[3];
  const rigControlPath = ["model", "rigControls", "rigControls", rigControlIndex];
  const rigControl = readNestedValue(input, rigControlPath);
  const rigControlId = readObjectString(rigControl, "rigControlId");
  if (readObjectString(rigControl, "kind") !== "warpLattice2d") {
    return undefined;
  }

  if (isDivisionIssuePath(path)) {
    return createWarpLatticeCheck({
      checkId: "rigControl.warpDeformerInvalidDivisions",
      target: createRigControlTarget(packageId, rigControlId, path),
      targetPath: path.join("."),
      message: `Warp Deformer ${rigControlId ?? "unknown"} has invalid division counts.`,
      evidence: [
        `rigControlId=${rigControlId ?? "unknown"}`,
        `latticeColumns=${readObjectNumber(rigControl, "latticeColumns") ?? "unknown"}`,
        `latticeRows=${readObjectNumber(rigControl, "latticeRows") ?? "unknown"}`,
        `transformColumns=${readNestedNumber(rigControl, ["warpDeformer", "transformGrid", "columns"]) ?? "unknown"}`,
        `transformRows=${readNestedNumber(rigControl, ["warpDeformer", "transformGrid", "rows"]) ?? "unknown"}`,
        `bezierColumns=${readNestedNumber(rigControl, ["warpDeformer", "bezierEditSurface", "columns"]) ?? "unknown"}`,
        `bezierRows=${readNestedNumber(rigControl, ["warpDeformer", "bezierEditSurface", "rows"]) ?? "unknown"}`,
        issue.message
      ],
      impact: "Warp Deformer transform and Bezier divisions must be integer control point counts of at least 2."
    });
  }

  if (path[4] === "warpDeformer" && path[5] === "transformGrid") {
    return createWarpLatticeCheck({
      checkId: "rigControl.warpDeformerTransformGridMismatch",
      target: createRigControlTarget(packageId, rigControlId, path),
      targetPath: path.join("."),
      message: `Warp Deformer ${rigControlId ?? "unknown"} has mismatched transformGrid storage.`,
      evidence: [
        `rigControlId=${rigControlId ?? "unknown"}`,
        `latticeColumns=${readObjectNumber(rigControl, "latticeColumns") ?? "unknown"}`,
        `latticeRows=${readObjectNumber(rigControl, "latticeRows") ?? "unknown"}`,
        `transformColumns=${readNestedNumber(rigControl, ["warpDeformer", "transformGrid", "columns"]) ?? "unknown"}`,
        `transformRows=${readNestedNumber(rigControl, ["warpDeformer", "transformGrid", "rows"]) ?? "unknown"}`,
        issue.message
      ],
      impact: "The Editor and runtime would disagree about the Warp Deformer's transform control point grid."
    });
  }

  if (
    path[4] === "warpDeformer" &&
    path[5] === "bezierEditSurface" &&
    (path[6] === "restControlPoints" || path[6] === "handles")
  ) {
    const surface = readNestedValue(rigControl, ["warpDeformer", "bezierEditSurface"]);
    const bezierColumns = readObjectNumber(surface, "columns");
    const bezierRows = readObjectNumber(surface, "rows");
    const expectedCount = bezierColumns === undefined || bezierRows === undefined
      ? "unknown"
      : String(bezierColumns * bezierRows);
    return createWarpLatticeCheck({
      checkId: "rigControl.warpDeformerBezierSurfaceCardinalityMismatch",
      target: createRigControlTarget(packageId, rigControlId, path),
      targetPath: path.join("."),
      message: `Warp Deformer ${rigControlId ?? "unknown"} has malformed Bezier edit surface cardinality.`,
      evidence: [
        `rigControlId=${rigControlId ?? "unknown"}`,
        `bezierColumns=${bezierColumns ?? "unknown"}`,
        `bezierRows=${bezierRows ?? "unknown"}`,
        `expectedBezierPointCount=${expectedCount}`,
        `actualBezierRestControlPointCount=${readObjectArray(surface, "restControlPoints")?.length ?? "unknown"}`,
        `actualBezierHandleCount=${readObjectArray(surface, "handles")?.length ?? "unknown"}`,
        issue.message
      ],
      impact: "The Editor cannot deterministically map Bezier edit points and handles to the stored Warp Deformer surface."
    });
  }

  if (path[4] === "restControlPoints") {
    const latticeColumns = readObjectNumber(rigControl, "latticeColumns");
    const latticeRows = readObjectNumber(rigControl, "latticeRows");
    const restControlPoints = readObjectArray(rigControl, "restControlPoints");
    const expectedCount = latticeColumns === undefined || latticeRows === undefined
      ? "unknown"
      : String(latticeColumns * latticeRows);
    const actualCount = restControlPoints === undefined ? "unknown" : String(restControlPoints.length);

    return createWarpLatticeCheck({
      checkId: "rigControl.warpLatticeCardinalityMismatch",
      target: createRigControlTarget(packageId, rigControlId, path),
      targetPath: path.join("."),
      message: `warpLattice2d rig control ${rigControlId ?? "unknown"} has mismatched lattice cardinality.`,
      evidence: [
        `rigControlId=${rigControlId ?? "unknown"}`,
        `latticeColumns=${latticeColumns ?? "unknown"}`,
        `latticeRows=${latticeRows ?? "unknown"}`,
        `expectedRestControlPointCount=${expectedCount}`,
        `actualRestControlPointCount=${actualCount}`,
        issue.message
      ],
      impact: "The warp lattice evaluator cannot deterministically map keyform offsets to control points when lattice cardinality and rest control point count disagree."
    });
  }

  if (path[4] === "domainBounds") {
    const domainBounds = readObjectRecord(rigControl, "domainBounds");
    return createWarpLatticeCheck({
      checkId: "rigControl.warpLatticeDomainBoundsInvalid",
      target: createRigControlTarget(packageId, rigControlId, path),
      targetPath: path.join("."),
      message: `warpLattice2d rig control ${rigControlId ?? "unknown"} has invalid domain bounds.`,
      evidence: [
        `rigControlId=${rigControlId ?? "unknown"}`,
        `domainBounds=${formatRectLike(domainBounds)}`,
        issue.message
      ],
      impact: "The warp lattice evaluator needs a positive domain rectangle to decide which drawable vertices are affected."
    });
  }

  return undefined;
};

const createWarpLatticeKeyformSchemaCheck = (
  issue: z.ZodIssue,
  input: unknown,
  packageId: PackageId,
  path: readonly string[]
): ValidationCheckResultDto | undefined => {
  if (
    path[1] !== "keyforms" ||
    path[2] !== "keyformSets" ||
    path[3] === undefined ||
    (path[4] !== "keys" && path[4] !== "compositionMode")
  ) {
    return undefined;
  }

  const keyformSetPath = ["model", "keyforms", "keyformSets", path[3]];
  const keyformSet = readNestedValue(input, keyformSetPath);
  const target = readObjectRecord(keyformSet, "target");
  if (readObjectString(target, "kind") !== "rigControl" || readObjectString(target, "property") !== "controlPointOffsets") {
    return undefined;
  }

  const keyformSetId = readObjectString(keyformSet, "keyformSetId");
  const rigControlId = readObjectString(target, "id");
  return createWarpLatticeCheck({
    checkId: "rigControl.warpLatticeMalformedPatch",
    target: keyformSetId === undefined
      ? {
          kind: "package",
          id: packageId,
          path: path.join(".")
        }
      : {
          kind: "keyformSet",
          id: keyformSetId,
          path: path.join(".")
        },
    targetPath: path.join("."),
    message: `warpLattice2d keyform ${keyformSetId ?? "unknown"} has a malformed controlPointOffsets patch.`,
    evidence: [
      `keyformSetId=${keyformSetId ?? "unknown"}`,
      `rigControlId=${rigControlId ?? "unknown"}`,
      "targetProperty=controlPointOffsets",
      issue.message
    ],
    impact: "The warp lattice evaluator cannot deterministically apply a controlPointOffsets keyform unless every key stores one Vec2 offset per rest control point."
  });
};

const createWarpLatticeCheck = (input: {
  readonly checkId:
    | "rigControl.warpLatticeCardinalityMismatch"
    | "rigControl.warpLatticeDomainBoundsInvalid"
    | "rigControl.warpLatticeMalformedPatch"
    | "rigControl.warpDeformerInvalidDivisions"
    | "rigControl.warpDeformerTransformGridMismatch"
    | "rigControl.warpDeformerBezierSurfaceCardinalityMismatch";
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: CheckIdSchema.parse(input.checkId),
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    relatedScenarios: ["SC-DEF-001", "SC-MVP-002"],
    impact: input.impact
  });

const createRigControlTarget = (
  packageId: PackageId,
  rigControlId: string | undefined,
  path: readonly string[]
): TargetRefDto =>
  rigControlId === undefined
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

const readObjectNumber = (input: unknown, key: string): number | undefined => {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return undefined;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const readNestedNumber = (input: unknown, path: readonly string[]): number | undefined => {
  const value = readNestedValue(input, path);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const isDivisionIssuePath = (path: readonly string[]): boolean =>
  path[4] === "latticeColumns" ||
  path[4] === "latticeRows" ||
  (
    path[4] === "warpDeformer" &&
    (
      (path[5] === "transformGrid" && (path[6] === "columns" || path[6] === "rows")) ||
      (path[5] === "bezierEditSurface" && (path[6] === "columns" || path[6] === "rows"))
    )
  );

const readObjectArray = (input: unknown, key: string): readonly unknown[] | undefined => {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return undefined;
  }

  const value = (input as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : undefined;
};

const readObjectRecord = (input: unknown, key: string): Readonly<Record<string, unknown>> | undefined => {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return undefined;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : undefined;
};

const formatRectLike = (rect: Readonly<Record<string, unknown>> | undefined): string => {
  if (rect === undefined) {
    return "missing";
  }

  return `x=${formatUnknownNumber(rect.x)},y=${formatUnknownNumber(rect.y)},width=${formatUnknownNumber(rect.width)},height=${formatUnknownNumber(rect.height)}`;
};

const formatUnknownNumber = (value: unknown): string =>
  typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(12)).toString()
    : "unknown";
