import type { RuntimeSnapshotId } from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  ModelPartDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import {
  ViewerRuntimeEvaluationEvidenceSchema,
  type EvaluatedPartDto,
  type RuntimeSnapshotDto,
  type ViewerRuntimeEvaluationEvidenceDto
} from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export interface PartRuntimeEvidenceValidationInput {
  readonly packageDocument: PackageDocumentDto;
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
  readonly viewerEvidence?: unknown;
}

interface ExpectedPartEvidence {
  readonly partId: string;
  readonly displayName: string;
  readonly parentPartId?: string;
  readonly childPartIds: readonly string[];
  readonly drawableIds: readonly string[];
  readonly hierarchyPath: readonly string[];
}

interface ActualPartEvidence {
  readonly part: EvaluatedPartDto;
  readonly index: number;
}

interface ActualDrawableLayerEvidence {
  readonly drawableId: string;
  readonly partId?: string;
  readonly index: number;
}

interface PartEvidenceSource {
  readonly source: "runtimeSnapshot" | "viewerEvidence";
  readonly basePath: string;
  readonly drawableBasePath: string;
  readonly snapshotId: RuntimeSnapshotId;
}

export const validatePartRuntimeEvidence = (
  input: PartRuntimeEvidenceValidationInput
): readonly ValidationCheckResultDto[] => {
  if (hasUnstablePackagePartHierarchy(input.packageDocument)) {
    return [];
  }

  return [
    ...validateRuntimeSnapshotPartEvidence(input.packageDocument, input.runtimeSnapshot),
    ...validateViewerPartEvidence(input.packageDocument, input.viewerEvidence, input.runtimeSnapshot)
  ];
};

const validateRuntimeSnapshotPartEvidence = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot: RuntimeSnapshotDto | undefined
): readonly ValidationCheckResultDto[] => {
  if (
    runtimeSnapshot?.parts === undefined ||
    runtimeSnapshot.parts.length === 0
  ) {
    return [];
  }

  const staleIdentityChecks = validateRuntimeSnapshotPartEvidenceIdentity(packageDocument, runtimeSnapshot);
  if (staleIdentityChecks.length > 0) {
    return staleIdentityChecks;
  }

  return validatePartEvidenceCollection({
    packageDocument,
    parts: runtimeSnapshot.parts,
    drawables: runtimeSnapshot.drawables.map((drawable, index) => ({
      drawableId: drawable.drawableId,
      ...(drawable.partId === undefined ? {} : { partId: drawable.partId }),
      index
    })),
    evidenceSource: {
      source: "runtimeSnapshot",
      basePath: "/runtimeSnapshot/parts",
      drawableBasePath: "/runtimeSnapshot/drawables",
      snapshotId: runtimeSnapshot.snapshotId
    }
  });
};

const validateRuntimeSnapshotPartEvidenceIdentity = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot: RuntimeSnapshotDto
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const evidenceSource: PartEvidenceSource = {
    source: "runtimeSnapshot",
    basePath: "/runtimeSnapshot/parts",
    drawableBasePath: "/runtimeSnapshot/drawables",
    snapshotId: runtimeSnapshot.snapshotId
  };

  if (runtimeSnapshot.packageId !== packageDocument.manifest.packageId) {
    checks.push(createPartRuntimeEvidenceMismatchCheck({
      evidenceSource,
      targetPath: "/runtimeSnapshot/packageId",
      field: "packageId",
      expectedValue: packageDocument.manifest.packageId,
      actualValue: runtimeSnapshot.packageId,
      reason: "stale-runtime-snapshot-identity"
    }));
  }

  if (runtimeSnapshot.packageRevision !== packageDocument.manifest.packageRevision) {
    checks.push(createPartRuntimeEvidenceMismatchCheck({
      evidenceSource,
      targetPath: "/runtimeSnapshot/packageRevision",
      field: "packageRevision",
      expectedValue: String(packageDocument.manifest.packageRevision),
      actualValue: String(runtimeSnapshot.packageRevision),
      reason: "stale-runtime-snapshot-identity"
    }));
  }

  return checks;
};

const validateViewerPartEvidence = (
  packageDocument: PackageDocumentDto,
  viewerEvidence: unknown,
  runtimeSnapshot: RuntimeSnapshotDto | undefined
): readonly ValidationCheckResultDto[] => {
  const parseResult = ViewerRuntimeEvaluationEvidenceSchema.safeParse(viewerEvidence);
  if (!parseResult.success) {
    return [];
  }

  const evidence = parseResult.data;
  if (
    evidence.partHierarchyEvidence.length === 0 ||
    evidence.packageId !== packageDocument.manifest.packageId ||
    evidence.packageRevision !== packageDocument.manifest.packageRevision ||
    (runtimeSnapshot !== undefined && evidence.snapshotId !== runtimeSnapshot.snapshotId)
  ) {
    return [];
  }

  return validatePartEvidenceCollection({
    packageDocument,
    parts: evidence.partHierarchyEvidence,
    drawables: evidence.drawableLayerEvidence.map((drawable, index) => ({
      drawableId: drawable.drawableId,
      ...(drawable.partId === undefined ? {} : { partId: drawable.partId }),
      index
    })),
    evidenceSource: {
      source: "viewerEvidence",
      basePath: "/viewer/runtimeEvidence/partHierarchyEvidence",
      drawableBasePath: "/viewer/runtimeEvidence/drawableLayerEvidence",
      snapshotId: evidence.snapshotId
    }
  });
};

const validatePartEvidenceCollection = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly parts: readonly EvaluatedPartDto[];
  readonly drawables: readonly ActualDrawableLayerEvidence[];
  readonly evidenceSource: PartEvidenceSource;
}): readonly ValidationCheckResultDto[] => {
  const expectedParts = createExpectedPartEvidence(input.packageDocument);
  const actualPartsById = new Map<string, ActualPartEvidence>(
    input.parts.map((part, index) => [part.partId, { part, index }])
  );
  const checks: ValidationCheckResultDto[] = [];

  for (const expectedPart of expectedParts) {
    const actualEntry = actualPartsById.get(expectedPart.partId);
    if (actualEntry === undefined) {
      checks.push(createPartRuntimeEvidenceMismatchCheck({
        evidenceSource: input.evidenceSource,
        targetPath: input.evidenceSource.basePath,
        partId: expectedPart.partId,
        field: "partId",
        expectedValue: expectedPart.partId,
        actualValue: "missing",
        reason: "part-evidence-missing"
      }));
      continue;
    }

    checks.push(...comparePartEvidenceFields(expectedPart, actualEntry, input.evidenceSource));
  }

  const expectedPartIds = new Set(expectedParts.map((part) => part.partId));
  for (const actualEntry of [...actualPartsById.values()].sort((left, right) =>
    left.part.partId.localeCompare(right.part.partId)
  )) {
    if (expectedPartIds.has(actualEntry.part.partId)) {
      continue;
    }

    checks.push(createPartRuntimeEvidenceMismatchCheck({
      evidenceSource: input.evidenceSource,
      targetPath: `${input.evidenceSource.basePath}/${actualEntry.index}/partId`,
      partId: actualEntry.part.partId,
      field: "partId",
      expectedValue: "missing",
      actualValue: actualEntry.part.partId,
      reason: "extra-part-evidence"
    }));
  }

  checks.push(...validateDrawableLayerEvidence({
    packageDrawables: input.packageDocument.model.drawables.drawables,
    actualDrawables: input.drawables,
    evidenceSource: input.evidenceSource
  }));

  return checks;
};

const comparePartEvidenceFields = (
  expectedPart: ExpectedPartEvidence,
  actualEntry: ActualPartEvidence,
  evidenceSource: PartEvidenceSource
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const comparisons = [
    {
      field: "displayName",
      expectedValue: expectedPart.displayName,
      actualValue: actualEntry.part.displayName
    },
    {
      field: "parentPartId",
      expectedValue: expectedPart.parentPartId ?? "missing",
      actualValue: actualEntry.part.parentPartId ?? "missing"
    },
    {
      field: "childPartIds",
      expectedValue: formatArrayValue(expectedPart.childPartIds),
      actualValue: formatArrayValue(actualEntry.part.childPartIds)
    },
    {
      field: "drawableIds",
      expectedValue: formatArrayValue(expectedPart.drawableIds),
      actualValue: formatArrayValue(actualEntry.part.drawableIds)
    },
    {
      field: "hierarchyPath",
      expectedValue: formatArrayValue(expectedPart.hierarchyPath),
      actualValue: formatArrayValue(actualEntry.part.hierarchyPath)
    }
  ];

  for (const comparison of comparisons) {
    if (comparison.expectedValue === comparison.actualValue) {
      continue;
    }

    checks.push(createPartRuntimeEvidenceMismatchCheck({
      evidenceSource,
      targetPath: `${evidenceSource.basePath}/${actualEntry.index}/${comparison.field}`,
      partId: expectedPart.partId,
      field: comparison.field,
      expectedValue: comparison.expectedValue,
      actualValue: comparison.actualValue,
      reason: "part-field-mismatch"
    }));
  }

  return checks;
};

const validateDrawableLayerEvidence = (input: {
  readonly packageDrawables: readonly DrawableDto[];
  readonly actualDrawables: readonly ActualDrawableLayerEvidence[];
  readonly evidenceSource: PartEvidenceSource;
}): readonly ValidationCheckResultDto[] => {
  const actualDrawablesById = new Map(input.actualDrawables.map((drawable) => [drawable.drawableId, drawable]));
  const checks: ValidationCheckResultDto[] = [];

  for (const packageDrawable of input.packageDrawables) {
    const actualDrawable = actualDrawablesById.get(packageDrawable.drawableId);
    if (actualDrawable === undefined || actualDrawable.partId === packageDrawable.partId) {
      continue;
    }

    checks.push(createPartRuntimeEvidenceMismatchCheck({
      evidenceSource: input.evidenceSource,
      targetPath: `${input.evidenceSource.drawableBasePath}/${actualDrawable.index}/partId`,
      partId: packageDrawable.partId,
      field: "drawable.partId",
      expectedValue: packageDrawable.partId,
      actualValue: actualDrawable.partId ?? "missing",
      reason: "drawable-part-mismatch",
      drawableId: packageDrawable.drawableId
    }));
  }

  return checks;
};

const createExpectedPartEvidence = (
  packageDocument: PackageDocumentDto
): readonly ExpectedPartEvidence[] => {
  const partsById = new Map(packageDocument.model.graph.parts.map((part) => [part.partId, part]));

  return packageDocument.model.graph.parts.map((part) => ({
    partId: part.partId,
    displayName: part.displayName,
    ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
    childPartIds: [...part.childPartIds],
    drawableIds: [...part.drawableIds],
    hierarchyPath: createHierarchyPath(part, partsById)
  }));
};

const createHierarchyPath = (
  part: ModelPartDto,
  partsById: ReadonlyMap<string, ModelPartDto>
): readonly string[] => {
  const reversedPath: string[] = [];
  const seen = new Set<string>();
  let current: ModelPartDto | undefined = part;

  while (current !== undefined && !seen.has(current.partId)) {
    reversedPath.push(current.partId);
    seen.add(current.partId);
    current = current.parentPartId === undefined ? undefined : partsById.get(current.parentPartId);
  }

  return reversedPath.reverse();
};

const hasUnstablePackagePartHierarchy = (packageDocument: PackageDocumentDto): boolean => {
  const parts = packageDocument.model.graph.parts;
  const partsById = new Map(parts.map((part) => [part.partId, part]));

  for (const part of parts) {
    if (new Set(part.childPartIds).size !== part.childPartIds.length) {
      return true;
    }

    if (part.parentPartId !== undefined) {
      const parent = partsById.get(part.parentPartId);
      if (parent === undefined || !parent.childPartIds.includes(part.partId)) {
        return true;
      }
    }

    for (const childPartId of part.childPartIds) {
      const child = partsById.get(childPartId);
      if (child === undefined || child.parentPartId !== part.partId) {
        return true;
      }
    }
  }

  return findFirstCycle(partsById) !== undefined;
};

const findFirstCycle = (
  partsById: ReadonlyMap<string, ModelPartDto>
): readonly string[] | undefined => {
  const visited = new Set<string>();
  const visiting = new Map<string, number>();
  const stack: string[] = [];

  const visit = (partId: string): readonly string[] | undefined => {
    const existingIndex = visiting.get(partId);
    if (existingIndex !== undefined) {
      return [...stack.slice(existingIndex), partId];
    }

    if (visited.has(partId)) {
      return undefined;
    }

    const part = partsById.get(partId);
    if (part === undefined) {
      return undefined;
    }

    visiting.set(partId, stack.length);
    stack.push(partId);

    for (const childPartId of part.childPartIds) {
      const cycle = visit(childPartId);
      if (cycle !== undefined) {
        return cycle;
      }
    }

    stack.pop();
    visiting.delete(partId);
    visited.add(partId);
    return undefined;
  };

  for (const partId of partsById.keys()) {
    const cycle = visit(partId);
    if (cycle !== undefined) {
      return cycle;
    }
  }

  return undefined;
};

const createPartRuntimeEvidenceMismatchCheck = (input: {
  readonly evidenceSource: PartEvidenceSource;
  readonly targetPath: string;
  readonly partId?: string;
  readonly field: string;
  readonly expectedValue: string;
  readonly actualValue: string;
  readonly reason: string;
  readonly drawableId?: string;
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "part.runtimeEvidenceMismatch",
    status: "fail",
    severity: "error",
    phase: "representative_evaluation",
    target: {
      kind: "runtimeSnapshot",
      id: input.evidenceSource.snapshotId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: input.partId === undefined
      ? `Part runtime evidence does not match package field ${input.field}.`
      : `Part evidence for ${input.partId} does not match package field ${input.field}.`,
    evidence: [
      `evidenceSource=${input.evidenceSource.source}`,
      `snapshotId=${input.evidenceSource.snapshotId}`,
      ...(input.partId === undefined ? [] : [`partId=${input.partId}`]),
      ...(input.drawableId === undefined ? [] : [`drawableId=${input.drawableId}`]),
      `field=${input.field}`,
      `packageValue=${input.expectedValue}`,
      `evidenceValue=${input.actualValue}`,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-012", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "Validator cannot trust direct-manipulation runtime or viewer evidence while part hierarchy evidence disagrees with the package graph.",
    snapshotIds: [input.evidenceSource.snapshotId]
  });

const formatArrayValue = (values: readonly string[]): string => values.join(",");
