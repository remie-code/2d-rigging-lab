import type { TargetRefDto } from "@private-2d-rigging-lab/contracts";
import type {
  DrawableDto,
  PackageDocumentDto,
  RigControlDto
} from "@private-2d-rigging-lab/package-format";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";
import { validateRuntimeRigControlEvidence } from "./rig-control-runtime-evidence.js";
import { validateWarpLatticeDiagnostics } from "./warp-lattice-diagnostics.js";

interface RigControlEntry {
  readonly rigControl: RigControlDto;
  readonly index: number;
}

interface DrawableEntry {
  readonly drawable: DrawableDto;
  readonly index: number;
}

interface ChildBindingEntry {
  readonly parentEntry: RigControlEntry;
  readonly childId: string;
  readonly childIndex: number;
  readonly childCollection: "childDrawableIds" | "childRigControlIds";
}

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
  const warpLatticeChecks = validateWarpLatticeDiagnostics({
    packageDocument,
    rigControlEntries,
    rigControlsById,
    ...(cycleChecks.length > 0 || runtimeSnapshot === undefined ? {} : { runtimeSnapshot })
  });
  const runtimeEvidenceChecks = cycleChecks.length > 0
    ? []
    : validateRuntimeRigControlEvidence({
        rigControlEntries,
        packageDocument,
        rigControlsById,
        ...(runtimeSnapshot === undefined ? {} : { runtimeSnapshot })
      });

  return [
    ...referenceChecks,
    ...cycleChecks,
    ...warpLatticeChecks,
    ...runtimeEvidenceChecks
  ];
};

const validateRigControlReferences = (input: {
  readonly rigControlEntries: readonly RigControlEntry[];
  readonly rigControlsById: ReadonlyMap<string, RigControlEntry>;
  readonly drawablesById: ReadonlyMap<string, DrawableEntry>;
}): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];
  const drawableBindingsByChildId = new Map<string, ChildBindingEntry[]>();

  for (const entry of input.rigControlEntries) {
    if (
      entry.rigControl.parentId !== undefined &&
      input.rigControlsById.get(entry.rigControl.parentId) === undefined
    ) {
      checks.push(createParentMissingCheck(entry));
    }

    checks.push(
      ...createDuplicateChildBindingChecks({
        entry,
        childCollection: "childRigControlIds",
        childIds: entry.rigControl.childRigControlIds
      }),
      ...createDuplicateChildBindingChecks({
        entry,
        childCollection: "childDrawableIds",
        childIds: entry.rigControl.childDrawableIds
      })
    );

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

    const seenDrawableIdsForParent = new Set<string>();
    entry.rigControl.childDrawableIds.forEach((childDrawableId, childIndex) => {
      if (!seenDrawableIdsForParent.has(childDrawableId)) {
        seenDrawableIdsForParent.add(childDrawableId);
        const bindings = drawableBindingsByChildId.get(childDrawableId) ?? [];
        bindings.push({
          parentEntry: entry,
          childId: childDrawableId,
          childIndex,
          childCollection: "childDrawableIds"
        });
        drawableBindingsByChildId.set(childDrawableId, bindings);
      }

      if (input.drawablesById.get(childDrawableId) === undefined) {
        checks.push(createChildDrawableMissingCheck(entry, childDrawableId, childIndex));
      }
    });
  }

  checks.push(...createDrawableMultipleParentsChecks(drawableBindingsByChildId));

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

const createDuplicateChildBindingChecks = (input: {
  readonly entry: RigControlEntry;
  readonly childCollection: "childDrawableIds" | "childRigControlIds";
  readonly childIds: readonly string[];
}): readonly ValidationCheckResultDto[] => {
  const firstIndexByChildId = new Map<string, number>();
  const checks: ValidationCheckResultDto[] = [];

  input.childIds.forEach((childId, childIndex) => {
    const firstIndex = firstIndexByChildId.get(childId);
    if (firstIndex === undefined) {
      firstIndexByChildId.set(childId, childIndex);
      return;
    }

    checks.push(createDuplicateChildBindingCheck({
      entry: input.entry,
      childId,
      firstIndex,
      duplicateIndex: childIndex,
      childCollection: input.childCollection
    }));
  });

  return checks;
};

const createDrawableMultipleParentsChecks = (
  drawableBindingsByChildId: ReadonlyMap<string, readonly ChildBindingEntry[]>
): readonly ValidationCheckResultDto[] =>
  [...drawableBindingsByChildId.entries()]
    .filter(([, bindings]) => bindings.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([drawableId, bindings]) => createDrawableMultipleParentsCheck(drawableId, bindings));

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

const createDuplicateChildBindingCheck = (input: {
  readonly entry: RigControlEntry;
  readonly childId: string;
  readonly firstIndex: number;
  readonly duplicateIndex: number;
  readonly childCollection: "childDrawableIds" | "childRigControlIds";
}): ValidationCheckResultDto =>
  createRigControlCheck({
    checkId: "rigControl.duplicateChild",
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target: {
      kind: input.childCollection === "childDrawableIds" ? "drawable" : "rigControl",
      id: input.childId,
      path: `${rigControlBasePath(input.entry.index)}/${input.childCollection}/${input.duplicateIndex}`
    },
    targetPath: `${rigControlBasePath(input.entry.index)}/${input.childCollection}/${input.duplicateIndex}`,
    message:
      `Rig control ${input.entry.rigControl.rigControlId} lists child ${input.childId} ` +
      `more than once in ${input.childCollection}.`,
    evidence: [
      `rigControlId=${input.entry.rigControl.rigControlId}`,
      `childCollection=${input.childCollection}`,
      `childId=${input.childId}`,
      `firstIndex=${input.firstIndex}`,
      `duplicateIndex=${input.duplicateIndex}`
    ],
    impact: "Duplicate rig control child entries make binding operations ambiguous and must be removed."
  });

const createDrawableMultipleParentsCheck = (
  drawableId: string,
  bindings: readonly ChildBindingEntry[]
): ValidationCheckResultDto => {
  const firstBinding = bindings[0];
  if (firstBinding === undefined) {
    throw new Error("Expected at least one drawable binding.");
  }

  return createRigControlCheck({
    checkId: "rigControl.drawableMultipleParents",
    status: "fail",
    severity: "error",
    phase: "rigControl_semantic",
    target: {
      kind: "drawable",
      id: drawableId,
      path: `${rigControlBasePath(firstBinding.parentEntry.index)}/${firstBinding.childCollection}/${firstBinding.childIndex}`
    },
    targetPath: `${rigControlBasePath(firstBinding.parentEntry.index)}/${firstBinding.childCollection}/${firstBinding.childIndex}`,
    message: `Drawable ${drawableId} is bound under more than one rig control.`,
    evidence: [
      `drawableId=${drawableId}`,
      `parentRigControlIds=${bindings.map((binding) => binding.parentEntry.rigControl.rigControlId).join(",")}`,
      `parentCount=${bindings.length}`
    ],
    impact: "A drawable can have only one deformer parent, otherwise subtree transforms and opacity are ambiguous."
  });
};

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
    impact: input.impact
  });

const rigControlBasePath = (index: number): string =>
  `/model/rigControls/rigControls/${index}`;

const compareRigControlEntries = (left: RigControlEntry, right: RigControlEntry): number =>
  left.rigControl.rigControlId.localeCompare(right.rigControl.rigControlId) || left.index - right.index;
