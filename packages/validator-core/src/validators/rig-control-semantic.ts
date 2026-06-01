import type { RuntimeSnapshotId, TargetRefDto } from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  PackageDocumentDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

interface RigControlEntry {
  readonly rigControl: RigControlDto;
  readonly index: number;
}

interface DrawableEntry {
  readonly drawable: DrawableDto;
  readonly index: number;
}

type RuntimeRigControlEvidence = RuntimeSnapshotDto["rigControls"][number];

export const validateRigControlSemantics = (
  packageDocument: PackageDocumentDto,
  runtimeSnapshot?: RuntimeSnapshotDto
): readonly ValidationCheckResultDto[] => {
  const rigControlEntries = packageDocument.model.rigControls.rigControls
    .map((rigControl, index) => ({ rigControl, index }))
    .sort(compareRigControlEntries);
  const rigControlsById = new Map(
    rigControlEntries.map((entry) => [entry.rigControl.rigControlId, entry])
  );
  const drawablesById = new Map(
    packageDocument.model.drawables.drawables.map((drawable, index) => [
      drawable.drawableId,
      { drawable, index }
    ])
  );

  const referenceChecks = validateRigControlReferences({
    rigControlEntries,
    rigControlsById,
    drawablesById
  });
  const cycleChecks = validateRigControlCycles(rigControlEntries, rigControlsById);
  const runtimeEvidenceChecks = cycleChecks.length > 0
    ? []
    : validateRuntimeRigControlEvidence({
        rigControlEntries,
        ...(runtimeSnapshot === undefined ? {} : { runtimeSnapshot })
      });

  return [
    ...referenceChecks,
    ...cycleChecks,
    ...runtimeEvidenceChecks
  ];
};

const validateRigControlReferences = (input: {
  readonly rigControlEntries: readonly RigControlEntry[];
  readonly rigControlsById: ReadonlyMap<string, RigControlEntry>;
  readonly drawablesById: ReadonlyMap<string, DrawableEntry>;
}): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  for (const entry of input.rigControlEntries) {
    if (
      entry.rigControl.parentId !== undefined &&
      input.rigControlsById.get(entry.rigControl.parentId) === undefined
    ) {
      checks.push(createParentMissingCheck(entry));
    }

    entry.rigControl.childRigControlIds.forEach((childRigControlId, childIndex) => {
      const childEntry = input.rigControlsById.get(childRigControlId);
      if (childEntry === undefined) {
        checks.push(createChildRigControlMissingCheck(entry, childRigControlId, childIndex));
        return;
      }

      if (childEntry.rigControl.parentId !== entry.rigControl.rigControlId) {
        checks.push(createParentChildMismatchCheck(entry, childEntry, childIndex));
      }
    });

    entry.rigControl.childDrawableIds.forEach((childDrawableId, childIndex) => {
      if (input.drawablesById.get(childDrawableId) === undefined) {
        checks.push(createChildDrawableMissingCheck(entry, childDrawableId, childIndex));
      }
    });
  }

  return checks;
};

const validateRigControlCycles = (
  rigControlEntries: readonly RigControlEntry[],
  rigControlsById: ReadonlyMap<string, RigControlEntry>
): readonly ValidationCheckResultDto[] => {
  const cycleChecks = new Map<string, ValidationCheckResultDto>();
  const adjacency = buildRigControlAdjacency(rigControlEntries, rigControlsById);

  for (const entry of rigControlEntries) {
    const cycle = findCycleFrom(entry.rigControl.rigControlId, rigControlsById, adjacency);
    if (cycle === undefined) {
      continue;
    }

    const canonicalCycle = canonicalizeCycle(cycle);
    const cycleKey = canonicalCycle.join(">");
    if (cycleChecks.has(cycleKey)) {
      continue;
    }

    const targetEntry = rigControlsById.get(canonicalCycle[0] ?? entry.rigControl.rigControlId) ?? entry;
    cycleChecks.set(cycleKey, createCycleCheck(targetEntry, canonicalCycle));
  }

  return [...cycleChecks.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, check]) => check);
};

const validateRuntimeRigControlEvidence = (input: {
  readonly rigControlEntries: readonly RigControlEntry[];
  readonly runtimeSnapshot?: RuntimeSnapshotDto;
}): readonly ValidationCheckResultDto[] => {
  const enabledRigControls = input.rigControlEntries.filter((entry) => entry.rigControl.enabled);
  if (enabledRigControls.length === 0) {
    return [];
  }

  if (input.runtimeSnapshot === undefined) {
    return enabledRigControls.map((entry) =>
      createRuntimeEvidenceMissingCheck({
        entry,
        evidence: [
          `rigControlId=${entry.rigControl.rigControlId}`,
          `rigControlKind=${entry.rigControl.kind}`,
          "runtimeSnapshot=missing"
        ]
      })
    );
  }

  const runtimeSnapshot = input.runtimeSnapshot;
  const snapshotRigControlsById = new Map(
    runtimeSnapshot.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );

  return enabledRigControls.flatMap((entry) => {
    const snapshotRigControl = snapshotRigControlsById.get(entry.rigControl.rigControlId);
    if (snapshotRigControl === undefined) {
      return [
        createRuntimeEvidenceMissingCheck({
          entry,
          runtimeSnapshotId: runtimeSnapshot.snapshotId,
          reason: "missing",
          evidence: [
            `rigControlId=${entry.rigControl.rigControlId}`,
            `snapshotId=${runtimeSnapshot.snapshotId}`,
            "snapshotRigControl=missing"
          ]
        })
      ];
    }

    const mismatchEvidence = createRuntimeRigControlMismatchEvidence(entry.rigControl, snapshotRigControl);
    if (mismatchEvidence.length === 0) {
      return [];
    }

    return [
      createRuntimeEvidenceMissingCheck({
        entry,
        runtimeSnapshotId: runtimeSnapshot.snapshotId,
        reason: "mismatch",
        evidence: [
          `rigControlId=${entry.rigControl.rigControlId}`,
          `snapshotId=${runtimeSnapshot.snapshotId}`,
          "snapshotRigControl=mismatch",
          ...mismatchEvidence
        ]
      })
    ];
  });
};

const buildRigControlAdjacency = (
  rigControlEntries: readonly RigControlEntry[],
  rigControlsById: ReadonlyMap<string, RigControlEntry>
): ReadonlyMap<string, readonly string[]> => {
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (fromRigControlId: string, toRigControlId: string): void => {
    const targets = adjacency.get(fromRigControlId) ?? new Set<string>();
    targets.add(toRigControlId);
    adjacency.set(fromRigControlId, targets);
  };

  for (const entry of rigControlEntries) {
    adjacency.set(entry.rigControl.rigControlId, adjacency.get(entry.rigControl.rigControlId) ?? new Set<string>());

    for (const childRigControlId of entry.rigControl.childRigControlIds) {
      if (rigControlsById.has(childRigControlId)) {
        addEdge(entry.rigControl.rigControlId, childRigControlId);
      }
    }

    if (entry.rigControl.parentId !== undefined && rigControlsById.has(entry.rigControl.parentId)) {
      addEdge(entry.rigControl.parentId, entry.rigControl.rigControlId);
    }
  }

  return new Map(
    [...adjacency.entries()].map(([rigControlId, childIds]) => [
      rigControlId,
      [...childIds].sort()
    ])
  );
};

const findCycleFrom = (
  startRigControlId: string,
  rigControlsById: ReadonlyMap<string, RigControlEntry>,
  adjacency: ReadonlyMap<string, readonly string[]>
): readonly string[] | undefined => {
  const visiting = new Map<string, number>();
  const path: string[] = [];

  const visit = (rigControlId: string): readonly string[] | undefined => {
    const existingIndex = visiting.get(rigControlId);
    if (existingIndex !== undefined) {
      return [...path.slice(existingIndex), rigControlId];
    }

    const entry = rigControlsById.get(rigControlId);
    if (entry === undefined) {
      return undefined;
    }

    visiting.set(rigControlId, path.length);
    path.push(rigControlId);
    for (const childRigControlId of adjacency.get(entry.rigControl.rigControlId) ?? []) {
      const cycle = visit(childRigControlId);
      if (cycle !== undefined) {
        return cycle;
      }
    }
    path.pop();
    visiting.delete(rigControlId);
    return undefined;
  };

  return visit(startRigControlId);
};

const canonicalizeCycle = (cycle: readonly string[]): readonly string[] => {
  const closedCycle = cycle.length > 1 && cycle[0] === cycle.at(-1)
    ? cycle.slice(0, -1)
    : [...cycle];
  if (closedCycle.length === 0) {
    return [];
  }

  const rotations = closedCycle.map((_, index) => [
    ...closedCycle.slice(index),
    ...closedCycle.slice(0, index)
  ]);
  const canonical = rotations.sort((left, right) => left.join(">").localeCompare(right.join(">")))[0] ?? closedCycle;
  return [...canonical, canonical[0] ?? ""].filter((value) => value.length > 0);
};

const createRuntimeRigControlMismatchEvidence = (
  packageRigControl: RigControlDto,
  runtimeRigControl: RuntimeRigControlEvidence
): readonly string[] => {
  const evidence: string[] = [];

  if (packageRigControl.kind !== runtimeRigControl.kind) {
    evidence.push(`packageKind=${packageRigControl.kind}`);
    evidence.push(`runtimeKind=${runtimeRigControl.kind}`);
  }

  if (packageRigControl.enabled !== runtimeRigControl.enabled) {
    evidence.push(`packageEnabled=${packageRigControl.enabled}`);
    evidence.push(`runtimeEnabled=${runtimeRigControl.enabled}`);
  }

  if (normalizeOptionalRigControlId(packageRigControl.parentId) !== normalizeOptionalRigControlId(runtimeRigControl.parentId)) {
    evidence.push(`packageParentId=${normalizeOptionalRigControlId(packageRigControl.parentId)}`);
    evidence.push(`runtimeParentId=${normalizeOptionalRigControlId(runtimeRigControl.parentId)}`);
  }

  return evidence;
};

const normalizeOptionalRigControlId = (rigControlId: string | undefined): string =>
  rigControlId ?? "root";

const createParentMissingCheck = (entry: RigControlEntry): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.parentMissing",
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target: {
      kind: "rigControl",
      id: entry.rigControl.parentId ?? entry.rigControl.rigControlId,
      path: `${rigControlBasePath(entry.index)}/parentId`
    },
    targetPath: `${rigControlBasePath(entry.index)}/parentId`,
    message: `Rig control ${entry.rigControl.rigControlId} references missing parent ${entry.rigControl.parentId}.`,
    evidence: [
      `rigControlId=${entry.rigControl.rigControlId}`,
      `parentId=${entry.rigControl.parentId ?? "missing"}`,
      "parentMatch=missing"
    ],
    impact: "The rig control hierarchy cannot be topologically evaluated while a parent reference is missing."
  });

const createChildRigControlMissingCheck = (
  entry: RigControlEntry,
  childRigControlId: string,
  childIndex: number
): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.childMissing",
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target: {
      kind: "rigControl",
      id: childRigControlId,
      path: `${rigControlBasePath(entry.index)}/childRigControlIds/${childIndex}`
    },
    targetPath: `${rigControlBasePath(entry.index)}/childRigControlIds/${childIndex}`,
    message: `Rig control ${entry.rigControl.rigControlId} references missing child rig control ${childRigControlId}.`,
    evidence: [
      `rigControlId=${entry.rigControl.rigControlId}`,
      "childKind=rigControl",
      `childId=${childRigControlId}`,
      "childMatch=missing"
    ],
    impact: "The rig control hierarchy cannot be topologically evaluated while a child rig control is missing."
  });

const createChildDrawableMissingCheck = (
  entry: RigControlEntry,
  childDrawableId: string,
  childIndex: number
): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.childMissing",
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target: {
      kind: "drawable",
      id: childDrawableId,
      path: `${rigControlBasePath(entry.index)}/childDrawableIds/${childIndex}`
    },
    targetPath: `${rigControlBasePath(entry.index)}/childDrawableIds/${childIndex}`,
    message: `Rig control ${entry.rigControl.rigControlId} references missing child drawable ${childDrawableId}.`,
    evidence: [
      `rigControlId=${entry.rigControl.rigControlId}`,
      "childKind=drawable",
      `childId=${childDrawableId}`,
      "childMatch=missing"
    ],
    impact: "The rig control hierarchy cannot affect a drawable that is absent from the package graph."
  });

const createParentChildMismatchCheck = (
  entry: RigControlEntry,
  childEntry: RigControlEntry,
  childIndex: number
): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.parentChildMismatch",
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target: {
      kind: "rigControl",
      id: childEntry.rigControl.rigControlId,
      path: `${rigControlBasePath(entry.index)}/childRigControlIds/${childIndex}`
    },
    targetPath: `${rigControlBasePath(entry.index)}/childRigControlIds/${childIndex}`,
    message: `Rig control ${childEntry.rigControl.rigControlId} does not point back to parent ${entry.rigControl.rigControlId}.`,
    evidence: [
      `parentRigControlId=${entry.rigControl.rigControlId}`,
      `childRigControlId=${childEntry.rigControl.rigControlId}`,
      `expectedChildParentId=${entry.rigControl.rigControlId}`,
      `childParentId=${childEntry.rigControl.parentId ?? "missing"}`
    ],
    impact: "The stored child list and child parent reference disagree, so hierarchy ordering is ambiguous."
  });

const createCycleCheck = (
  entry: RigControlEntry,
  cycle: readonly string[]
): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.cycle",
    status: "fail",
    severity: "blocking",
    phase: "rigControl_semantic",
    target: {
      kind: "rigControl",
      id: entry.rigControl.rigControlId,
      path: rigControlBasePath(entry.index)
    },
    targetPath: rigControlBasePath(entry.index),
    message: `Rig control hierarchy contains a cycle: ${cycle.join(" -> ")}.`,
    evidence: [
      `cyclePath=${cycle.join(">")}`,
      `cycleLength=${Math.max(cycle.length - 1, 0)}`
    ],
    impact: "Runtime cannot produce a deterministic parent-before-child rig control evaluation order."
  });

const createRuntimeEvidenceMissingCheck = (input: {
  readonly entry: RigControlEntry;
  readonly runtimeSnapshotId?: RuntimeSnapshotId;
  readonly reason?: "missing" | "mismatch";
  readonly evidence: readonly string[];
}): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.runtimeEvidenceMissing",
    status: "fail",
    severity: "error",
    phase: "rigControl_evaluation",
    target: {
      kind: "rigControl",
      id: input.entry.rigControl.rigControlId,
      path: rigControlBasePath(input.entry.index)
    },
    targetPath: rigControlBasePath(input.entry.index),
    message: input.runtimeSnapshotId === undefined
      ? `Rig control ${input.entry.rigControl.rigControlId} has no runtime snapshot evidence.`
      : input.reason === "mismatch"
        ? `Runtime snapshot ${input.runtimeSnapshotId} has mismatched rig control evidence for ${input.entry.rigControl.rigControlId}.`
      : `Runtime snapshot ${input.runtimeSnapshotId} is missing rig control evidence for ${input.entry.rigControl.rigControlId}.`,
    evidence: input.evidence,
    impact: "Validator cannot prove deterministic rig control hierarchy evaluation without runtime snapshot evidence.",
    snapshotIds: input.runtimeSnapshotId === undefined ? [] : [input.runtimeSnapshotId]
  });

const createRigControlCheck = (input: {
  readonly checkId: string;
  readonly status: "pass" | "warning" | "fail" | "needs_review" | "not_applicable";
  readonly severity: "info" | "warning" | "error" | "blocking";
  readonly phase: string;
  readonly target: TargetRefDto;
  readonly targetPath: string;
  readonly message: string;
  readonly evidence: readonly string[];
  readonly impact: string;
  readonly snapshotIds?: readonly RuntimeSnapshotId[];
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: input.checkId,
    status: input.status,
    severity: input.severity,
    phase: input.phase,
    target: input.target,
    targetPath: input.targetPath,
    message: input.message,
    evidence: input.evidence,
    relatedAC: ["AC-MVP-009", "AC-MVP-010", "AC-MVP-013"],
    relatedScenarios: ["SC-DEF-002"],
    impact: input.impact,
    snapshotIds: input.snapshotIds ?? []
  });

const rigControlBasePath = (index: number): string =>
  `/model/rigControls/rigControls/${index}`;

const compareRigControlEntries = (left: RigControlEntry, right: RigControlEntry): number =>
  left.rigControl.rigControlId.localeCompare(right.rigControl.rigControlId) || left.index - right.index;
