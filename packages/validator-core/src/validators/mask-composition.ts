import type {
  RuntimeSnapshotId,
  TargetRefDto
} from "@private-2d-rigging-lab/contracts";
import type {
  MaskRelationDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";
import {
  createRuntimeSnapshotArtifactPath,
  type RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

interface MaskRelationEntry {
  readonly maskRelation: MaskRelationDto;
  readonly index: number;
}

type RuntimeMaskEvidence = RuntimeSnapshotDto["masks"][number];

export const validateMaskCompositionSemantics = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot?: RuntimeSnapshotDto
): readonly ValidationCheckResultDto[] => {
  const drawableIds = new Set(
    packageDocument.model.drawables.drawables.map((drawable) => drawable.drawableId)
  );
  const entries = packageDocument.model.masks.masks.map((maskRelation, index) => ({
    maskRelation,
    index
  }));
  const checks: ValidationCheckResultDto[] = [];
  const invalidForRuntimeEvidence = new Set<string>();
  const firstEntryByRelationId = new Map<string, MaskRelationEntry>();
  const firstEntryBySemanticKey = new Map<string, MaskRelationEntry>();

  for (const entry of entries) {
    const relationChecks = validateStaticMaskRelation(entry, drawableIds);
    checks.push(...relationChecks.checks);
    if (!relationChecks.runtimeResolvable) {
      invalidForRuntimeEvidence.add(entry.maskRelation.maskRelationId);
    }

    const duplicateIdEntry = firstEntryByRelationId.get(entry.maskRelation.maskRelationId);
    if (duplicateIdEntry === undefined) {
      firstEntryByRelationId.set(entry.maskRelation.maskRelationId, entry);
    } else {
      invalidForRuntimeEvidence.add(entry.maskRelation.maskRelationId);
      checks.push(createDuplicateRelationCheck({
        entry,
        firstEntry: duplicateIdEntry,
        duplicateKind: "maskRelationId",
        duplicateKey: entry.maskRelation.maskRelationId
      }));
    }

    const semanticKey = createRelationSemanticKey(entry.maskRelation);
    const duplicateSemanticEntry = firstEntryBySemanticKey.get(semanticKey);
    if (duplicateSemanticEntry === undefined) {
      firstEntryBySemanticKey.set(semanticKey, entry);
    } else {
      invalidForRuntimeEvidence.add(entry.maskRelation.maskRelationId);
      checks.push(createDuplicateRelationCheck({
        entry,
        firstEntry: duplicateSemanticEntry,
        duplicateKind: "semanticRelation",
        duplicateKey: semanticKey
      }));
    }
  }

  checks.push(...validateRuntimeMaskEvidence({
    packageDocument,
    entries,
    invalidForRuntimeEvidence,
    ...(runtimeSnapshot === undefined ? {} : { runtimeSnapshot })
  }));

  return checks;
};

const validateStaticMaskRelation = (
  entry: MaskRelationEntry,
  drawableIds: ReadonlySet<string>
): {
  readonly checks: readonly ValidationCheckResultDto[];
  readonly runtimeResolvable: boolean;
} => {
  const checks: ValidationCheckResultDto[] = [];

  entry.maskRelation.maskDrawableIds.forEach((drawableId, drawableIndex) => {
    if (!drawableIds.has(drawableId)) {
      checks.push(createMissingMaskDrawableCheck(entry, drawableId, drawableIndex));
    }
  });

  entry.maskRelation.targetDrawableIds.forEach((drawableId, drawableIndex) => {
    if (!drawableIds.has(drawableId)) {
      checks.push(createMissingTargetDrawableCheck(entry, drawableId, drawableIndex));
    }
  });

  for (const drawableId of createSelfMaskDrawableIds(entry.maskRelation)) {
    checks.push(createSelfMaskCheck(entry, drawableId));
  }

  return {
    checks,
    runtimeResolvable: checks.length === 0
  };
};

const validateRuntimeMaskEvidence = (input: {
  readonly packageDocument: PackageDocumentDto;
  readonly entries: readonly MaskRelationEntry[];
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
  readonly invalidForRuntimeEvidence: ReadonlySet<string>;
}): readonly ValidationCheckResultDto[] => {
  const runtimeResolvableEntries = input.entries.filter((entry) =>
    entry.maskRelation.enabled && !input.invalidForRuntimeEvidence.has(entry.maskRelation.maskRelationId)
  );
  if (runtimeResolvableEntries.length === 0 && input.runtimeSnapshot === undefined) {
    return [];
  }

  if (input.runtimeSnapshot === undefined) {
    return runtimeResolvableEntries.map((entry) =>
      createRuntimeEvidenceMissingCheck({
        entry,
        reason: "missing",
        evidence: [
          `maskRelationId=${entry.maskRelation.maskRelationId}`,
          "enabled=true",
          "runtimeSnapshot=missing"
        ]
      })
    );
  }

  const runtimeSnapshot = input.runtimeSnapshot;
  const identityMismatchEvidence = createRuntimeSnapshotIdentityMismatchEvidence(
    input.packageDocument,
    runtimeSnapshot
  );
  if (identityMismatchEvidence.length > 0) {
    return runtimeResolvableEntries.map((entry) =>
      createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        reason: "stale",
        evidence: [
          `maskRelationId=${entry.maskRelation.maskRelationId}`,
          ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
          "runtimeSnapshotIdentity=mismatch",
          ...identityMismatchEvidence
        ]
      })
    );
  }

  const runtimeMaskEntriesById = createRuntimeMaskEntriesById(runtimeSnapshot);
  const runtimeDrawablesById = new Set<string>(
    runtimeSnapshot.drawables.map((drawable) => drawable.drawableId)
  );
  const packageRelationIds = new Set(
    input.entries.map((entry) => entry.maskRelation.maskRelationId)
  );
  const checks: ValidationCheckResultDto[] = [];

  for (const entry of input.entries) {
    const runtimeMaskEntry = runtimeMaskEntriesById.get(entry.maskRelation.maskRelationId);
    if (!entry.maskRelation.enabled) {
      if (runtimeMaskEntry !== undefined) {
        checks.push(createRuntimeEvidenceMismatchCheck({
          entry,
          runtimeSnapshotId: runtimeSnapshot.snapshotId,
          runtimeMaskPath: runtimeMaskBasePath(runtimeMaskEntry.index),
          message: `Disabled mask relation ${entry.maskRelation.maskRelationId} is present in runtime evidence ${runtimeSnapshot.snapshotId}.`,
          evidence: [
            `maskRelationId=${entry.maskRelation.maskRelationId}`,
            ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
            "packageEnabled=false",
            "runtimeMaskEvidence=present"
          ],
          impact: "Disabled mask relations must not appear as active runtime clipping evidence."
        }));
      }
      continue;
    }

    if (input.invalidForRuntimeEvidence.has(entry.maskRelation.maskRelationId)) {
      continue;
    }

    if (runtimeMaskEntry === undefined) {
      checks.push(createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        reason: "missing",
        evidence: [
          `maskRelationId=${entry.maskRelation.maskRelationId}`,
          ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
          "runtimeMaskRelationMatch=missing"
        ]
      }));
      continue;
    }

    const mismatchEvidence = createRuntimeMaskMismatchEvidence(
      entry.maskRelation,
      runtimeMaskEntry.runtimeMask
    );
    if (mismatchEvidence.length > 0) {
      checks.push(createRuntimeEvidenceMismatchCheck({
        entry,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        runtimeMaskPath: runtimeMaskBasePath(runtimeMaskEntry.index),
        message: `Runtime snapshot ${runtimeSnapshot.snapshotId} has mismatched mask relation evidence for ${entry.maskRelation.maskRelationId}.`,
        evidence: [
          `maskRelationId=${entry.maskRelation.maskRelationId}`,
          ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
          "runtimeMaskEvidence=mismatch",
          ...mismatchEvidence
        ],
        impact: "Validator cannot prove semantic clipping intent when runtime mask evidence disagrees with the package relation."
      }));
    }

    const missingOpacityDrawableIds = createMaskRelationDrawableIds(entry.maskRelation)
      .filter((drawableId) => !runtimeDrawablesById.has(drawableId));
    if (missingOpacityDrawableIds.length > 0) {
      checks.push(createOpacityEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        missingDrawableIds: missingOpacityDrawableIds,
        evidence: [
          `maskRelationId=${entry.maskRelation.maskRelationId}`,
          ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
          `opacityDrawableEvidenceMissing=${missingOpacityDrawableIds.join(",")}`
        ]
      }));
    }
  }

  runtimeSnapshot.masks.forEach((runtimeMask, runtimeMaskIndex) => {
    if (!packageRelationIds.has(runtimeMask.maskRelationId)) {
      checks.push(createUnknownRuntimeMaskEvidenceCheck({
        runtimeMask,
        runtimeMaskIndex,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        evidence: [
          `maskRelationId=${runtimeMask.maskRelationId}`,
          ...createRuntimeSnapshotEvidenceBase(runtimeSnapshot),
          "packageMaskRelationMatch=missing"
        ]
      }));
    }
  });

  return checks;
};

const createMissingMaskDrawableCheck = (
  entry: MaskRelationEntry,
  drawableId: string,
  drawableIndex: number
): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.sourceMissing",
    severity: "blocking",
    target: {
      kind: "drawable",
      id: drawableId,
      path: `${maskRelationBasePath(entry.index)}/maskDrawableIds/${drawableIndex}`
    },
    targetPath: `${maskRelationBasePath(entry.index)}/maskDrawableIds/${drawableIndex}`,
    message: `Mask relation ${entry.maskRelation.maskRelationId} references missing mask drawable ${drawableId}.`,
    evidence: [
      `maskRelationId=${entry.maskRelation.maskRelationId}`,
      `maskDrawableId=${drawableId}`,
      "maskDrawableMatch=missing"
    ],
    impact: "The mask relation cannot resolve its source drawable."
  });

const createMissingTargetDrawableCheck = (
  entry: MaskRelationEntry,
  drawableId: string,
  drawableIndex: number
): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.targetMissing",
    severity: "blocking",
    target: {
      kind: "drawable",
      id: drawableId,
      path: `${maskRelationBasePath(entry.index)}/targetDrawableIds/${drawableIndex}`
    },
    targetPath: `${maskRelationBasePath(entry.index)}/targetDrawableIds/${drawableIndex}`,
    message: `Mask relation ${entry.maskRelation.maskRelationId} references missing target drawable ${drawableId}.`,
    evidence: [
      `maskRelationId=${entry.maskRelation.maskRelationId}`,
      `targetDrawableId=${drawableId}`,
      "targetDrawableMatch=missing"
    ],
    impact: "The mask relation cannot resolve the drawable it is intended to clip."
  });

const createSelfMaskCheck = (
  entry: MaskRelationEntry,
  drawableId: string
): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.selfReference",
    severity: "error",
    target: createMaskRelationTarget(entry),
    targetPath: maskRelationBasePath(entry.index),
    message: `Mask relation ${entry.maskRelation.maskRelationId} uses drawable ${drawableId} as both mask and target.`,
    evidence: [
      `maskRelationId=${entry.maskRelation.maskRelationId}`,
      `drawableId=${drawableId}`,
      "selfMask=true"
    ],
    impact: "Self-mask relations are not accepted as deterministic semantic clipping evidence."
  });

const createDuplicateRelationCheck = (input: {
  readonly entry: MaskRelationEntry;
  readonly firstEntry: MaskRelationEntry;
  readonly duplicateKind: "maskRelationId" | "semanticRelation";
  readonly duplicateKey: string;
}): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.duplicateRelation",
    severity: "error",
    target: createMaskRelationTarget(input.entry),
    targetPath: maskRelationBasePath(input.entry.index),
    message: `Mask relation ${input.entry.maskRelation.maskRelationId} duplicates an earlier mask relation.`,
    evidence: [
      `maskRelationId=${input.entry.maskRelation.maskRelationId}`,
      `duplicateKind=${input.duplicateKind}`,
      `duplicateKey=${input.duplicateKey}`,
      `firstRelationIndex=${input.firstEntry.index}`,
      `duplicateRelationIndex=${input.entry.index}`,
      `firstMaskRelationId=${input.firstEntry.maskRelation.maskRelationId}`
    ],
    impact: "Duplicate mask relations make clipping intent ambiguous for deterministic validation and runtime evidence matching."
  });

const createRuntimeEvidenceMissingCheck = (input: {
  readonly entry: MaskRelationEntry;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly reason: "missing" | "stale";
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.runtimeEvidenceMissing",
    severity: "error",
    target: createMaskRelationTarget(input.entry),
    targetPath: maskRelationBasePath(input.entry.index),
    message: createRuntimeEvidenceMissingMessage(input),
    evidence: input.evidence,
    impact: "Validator cannot prove semantic mask relation runtime behavior without matching runtime snapshot evidence.",
    snapshotIds: input.runtimeSnapshotId === undefined ? [] : [input.runtimeSnapshotId]
  });

const createRuntimeEvidenceMismatchCheck = (input: {
  readonly entry: MaskRelationEntry;
  readonly runtimeSnapshotId: RuntimeSnapshotId;
  readonly runtimeMaskPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
}): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.runtimeEvidenceMismatch",
    severity: "error",
    target: createMaskRelationTarget(input.entry, input.runtimeMaskPath),
    targetPath: input.runtimeMaskPath,
    message: input.message,
    evidence: input.evidence,
    impact: input.impact,
    snapshotIds: [input.runtimeSnapshotId]
  });

const createOpacityEvidenceMissingCheck = (input: {
  readonly entry: MaskRelationEntry;
  readonly runtimeSnapshotId: RuntimeSnapshotId;
  readonly missingDrawableIds: readonly string[];
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.opacityEvidenceMissing",
    severity: "error",
    target: createMaskRelationTarget(input.entry),
    targetPath: maskRelationBasePath(input.entry.index),
    message: `Runtime snapshot ${input.runtimeSnapshotId} is missing drawable opacity evidence for mask relation ${input.entry.maskRelation.maskRelationId}.`,
    evidence: input.evidence,
    impact: "Validator cannot prove opacity-dependent composition evidence when a mask or target drawable is absent from runtime drawable evidence.",
    snapshotIds: [input.runtimeSnapshotId]
  });

const createUnknownRuntimeMaskEvidenceCheck = (input: {
  readonly runtimeMask: RuntimeMaskEvidence;
  readonly runtimeMaskIndex: number;
  readonly runtimeSnapshotId: RuntimeSnapshotId;
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createMaskCheck({
    checkId: "mask.runtimeEvidenceMismatch",
    severity: "error",
    target: {
      kind: "maskRelation",
      id: input.runtimeMask.maskRelationId,
      path: runtimeMaskBasePath(input.runtimeMaskIndex)
    },
    targetPath: runtimeMaskBasePath(input.runtimeMaskIndex),
    message: `Runtime snapshot ${input.runtimeSnapshotId} has mask evidence for unknown relation ${input.runtimeMask.maskRelationId}.`,
    evidence: input.evidence,
    impact: "Runtime mask evidence must correspond to a package mask relation.",
    snapshotIds: [input.runtimeSnapshotId]
  });

const createRuntimeMaskMismatchEvidence = (
  maskRelation: MaskRelationDto,
  runtimeMask: RuntimeMaskEvidence
): readonly string[] => {
  const evidence: string[] = [];

  if (!runtimeMask.resolved) {
    evidence.push("runtimeMaskResolved=false");
  }

  const expectedSourceIds = normalizeIdSet(maskRelation.maskDrawableIds);
  const actualSourceIds = normalizeIdSet(runtimeMask.sourceDrawableIds);
  if (!sameOrderedIds(expectedSourceIds, actualSourceIds)) {
    evidence.push(`packageMaskDrawableIds=${expectedSourceIds.join(",")}`);
    evidence.push(`runtimeMaskDrawableIds=${actualSourceIds.join(",")}`);
  }

  const expectedTargetIds = normalizeIdSet(maskRelation.targetDrawableIds);
  const actualTargetIds = normalizeIdSet(runtimeMask.targetDrawableIds);
  if (!sameOrderedIds(expectedTargetIds, actualTargetIds)) {
    evidence.push(`packageTargetDrawableIds=${expectedTargetIds.join(",")}`);
    evidence.push(`runtimeTargetDrawableIds=${actualTargetIds.join(",")}`);
  }

  return evidence;
};

const createRuntimeSnapshotIdentityMismatchEvidence = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot: RuntimeSnapshotDto
): readonly string[] => {
  const evidence: string[] = [];

  if (packageDocument.manifest.packageId !== runtimeSnapshot.packageId) {
    evidence.push(`packageId=${packageDocument.manifest.packageId}`);
    evidence.push(`snapshotPackageId=${runtimeSnapshot.packageId}`);
  }

  if (packageDocument.manifest.packageRevision !== runtimeSnapshot.packageRevision) {
    evidence.push(`packageRevision=${packageDocument.manifest.packageRevision}`);
    evidence.push(`snapshotPackageRevision=${runtimeSnapshot.packageRevision}`);
  }

  return evidence;
};

const createRuntimeSnapshotEvidenceBase = (runtimeSnapshot: RuntimeSnapshotDto): readonly string[] => [
  `snapshotId=${runtimeSnapshot.snapshotId}`,
  `runtimeSnapshotRef=${createRuntimeSnapshotArtifactPath(runtimeSnapshot.snapshotId)}`
];

const createRuntimeMaskEntriesById = (
  runtimeSnapshot: RuntimeSnapshotDto
): ReadonlyMap<string, { readonly runtimeMask: RuntimeMaskEvidence; readonly index: number }> => {
  const entriesById = new Map<string, { readonly runtimeMask: RuntimeMaskEvidence; readonly index: number }>();
  runtimeSnapshot.masks.forEach((runtimeMask, index) => {
    if (!entriesById.has(runtimeMask.maskRelationId)) {
      entriesById.set(runtimeMask.maskRelationId, { runtimeMask, index });
    }
  });
  return entriesById;
};

const createRuntimeEvidenceMissingMessage = (input: {
  readonly entry: MaskRelationEntry;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly reason: "missing" | "stale";
}): string => {
  if (input.runtimeSnapshotId === undefined) {
    return `Mask relation ${input.entry.maskRelation.maskRelationId} has no runtime snapshot evidence.`;
  }

  if (input.reason === "stale") {
    return `Runtime snapshot ${input.runtimeSnapshotId} is stale for mask relation evidence ${input.entry.maskRelation.maskRelationId}.`;
  }

  return `Runtime snapshot ${input.runtimeSnapshotId} is missing mask relation evidence for ${input.entry.maskRelation.maskRelationId}.`;
};

const createMaskCheck = (input: {
  readonly checkId: string;
  readonly severity: "error" | "blocking";
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
  readonly snapshotIds?: readonly RuntimeSnapshotId[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: "fail",
    severity: input.severity,
    phase: "mask_resolution",
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: [...input.evidence],
    relatedAC: ["AC-MVP-007", "AC-MVP-012", "AC-MVP-013"],
    relatedScenarios: ["SC-MVP-004"],
    impact: input.impact,
    snapshotIds: [...(input.snapshotIds ?? [])]
  });

const createMaskRelationTarget = (
  entry: MaskRelationEntry,
  path = maskRelationBasePath(entry.index)
): TargetRefDto => ({
  kind: "maskRelation",
  id: entry.maskRelation.maskRelationId,
  path
});

const createSelfMaskDrawableIds = (maskRelation: MaskRelationDto): readonly string[] => {
  const targetDrawableIds = new Set(maskRelation.targetDrawableIds);
  return normalizeIdSet(maskRelation.maskDrawableIds.filter((drawableId) => targetDrawableIds.has(drawableId)));
};

const createRelationSemanticKey = (maskRelation: MaskRelationDto): string =>
  [
    `mask=${normalizeIdSet(maskRelation.maskDrawableIds).join("+")}`,
    `target=${normalizeIdSet(maskRelation.targetDrawableIds).join("+")}`
  ].join("|");

const createMaskRelationDrawableIds = (maskRelation: MaskRelationDto): readonly string[] =>
  normalizeIdSet([
    ...maskRelation.maskDrawableIds,
    ...maskRelation.targetDrawableIds
  ]);

const normalizeIdSet = (ids: readonly string[]): readonly string[] =>
  [...new Set(ids)].sort((left, right) => left.localeCompare(right));

const sameOrderedIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const maskRelationBasePath = (index: number): string =>
  `/model/masks/masks/${index}`;

const runtimeMaskBasePath = (index: number): string =>
  `/runtimeSnapshot/masks/${index}`;
