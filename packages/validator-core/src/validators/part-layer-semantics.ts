import type {
  DrawableDto,
  EditorStateFileDto,
  ModelPartDto,
  PackageDocumentDto
} from "@private-2d-rigging-lab/package-format";

import type { ValidationCheckResultDto } from "../validation-report.js";
import { ValidationCheckResultSchema } from "../validation-report.js";

export const validatePartLayerSemantics = (
  packageDocument: PackageDocumentDto
): readonly ValidationCheckResultDto[] => {
  const indexes = createPartLayerIndexes(packageDocument);
  const checks: ValidationCheckResultDto[] = [];

  checks.push(...validatePartHierarchy(indexes));
  checks.push(...validateDrawableMembership(indexes));
  checks.push(...validateEditorStateReferences(packageDocument.model.editorState, indexes));

  return checks;
};

interface PartWithIndex {
  readonly part: ModelPartDto;
  readonly index: number;
}

interface DrawableWithIndex {
  readonly drawable: DrawableDto;
  readonly index: number;
}

interface PartLayerIndexes {
  readonly packageDocument: PackageDocumentDto;
  readonly parts: readonly PartWithIndex[];
  readonly drawables: readonly DrawableWithIndex[];
  readonly partsById: ReadonlyMap<string, PartWithIndex>;
  readonly drawablesById: ReadonlyMap<string, DrawableWithIndex>;
  readonly knownEditorTargetIds: ReadonlySet<string>;
}

const createPartLayerIndexes = (packageDocument: PackageDocumentDto): PartLayerIndexes => {
  const parts = packageDocument.model.graph.parts.map((part, index) => ({ part, index }));
  const drawables = packageDocument.model.drawables.drawables.map((drawable, index) => ({ drawable, index }));

  return {
    packageDocument,
    parts,
    drawables,
    partsById: new Map(parts.map((entry) => [entry.part.partId, entry])),
    drawablesById: new Map(drawables.map((entry) => [entry.drawable.drawableId, entry])),
    knownEditorTargetIds: createKnownEditorTargetIds(packageDocument)
  };
};

const createKnownEditorTargetIds = (packageDocument: PackageDocumentDto): ReadonlySet<string> =>
  new Set([
    ...packageDocument.model.graph.parts.map((part) => part.partId),
    ...packageDocument.model.drawables.drawables.map((drawable) => drawable.drawableId),
    ...packageDocument.model.drawables.drawables.map((drawable) => drawable.meshId),
    ...packageDocument.model.meshes.meshes.map((mesh) => mesh.meshId),
    ...packageDocument.model.meshes.meshes.flatMap((mesh) => mesh.vertexStableIds),
    ...packageDocument.model.parameters.parameters.map((parameter) => parameter.parameterId),
    ...packageDocument.model.keyforms.keyformSets.map((keyformSet) => keyformSet.keyformSetId),
    ...packageDocument.model.rigControls.rigControls.map((rigControl) => rigControl.rigControlId),
    ...packageDocument.model.dynamics.dynamicsGroups.map((group) => group.dynamicsGroupId),
    ...packageDocument.model.masks.masks.map((mask) => mask.maskRelationId),
    ...packageDocument.assets.sourceManifest.sourceAssets.map((sourceAsset) => sourceAsset.sourceAssetId),
    ...packageDocument.assets.sourceManifest.sourceAssets.flatMap((sourceAsset) =>
      sourceAsset.layers.map((sourceLayer) => sourceLayer.sourceLayerId)
    ),
    ...(packageDocument.assets.textureAtlas?.textures.map((texture) => texture.textureId) ?? []),
    ...(packageDocument.assets.textureAtlas?.previewAssets?.map((previewAsset) => previewAsset.previewAssetId) ?? [])
  ]);

const validatePartHierarchy = (indexes: PartLayerIndexes): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  for (const partEntry of indexes.parts) {
    checks.push(...validatePartParentReference(partEntry, indexes));
    checks.push(...validatePartChildReferences(partEntry, indexes));
    checks.push(...validatePartOrderedChildren(partEntry, indexes));
  }

  const cycle = findFirstPartCycle(indexes);
  if (cycle !== undefined) {
    checks.push(createPartCycleCheck(cycle, indexes));
  }

  return checks;
};

const validatePartParentReference = (
  partEntry: PartWithIndex,
  indexes: PartLayerIndexes
): readonly ValidationCheckResultDto[] => {
  const parentPartId = partEntry.part.parentPartId;
  if (parentPartId === undefined) {
    return [];
  }

  const parentEntry = indexes.partsById.get(parentPartId);
  if (parentEntry === undefined) {
    return [createPartParentMissingCheck(partEntry, parentPartId)];
  }

  if (!parentEntry.part.childPartIds.includes(partEntry.part.partId)) {
    return [
      createPartParentChildMismatchCheck({
        partEntry,
        relatedPartEntry: parentEntry,
        targetPath: `/model/graph/parts/${partEntry.index}/parentPartId`,
        reason: "parent-child-list-missing"
      })
    ];
  }

  return [];
};

const validatePartChildReferences = (
  partEntry: PartWithIndex,
  indexes: PartLayerIndexes
): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  partEntry.part.childPartIds.forEach((childPartId, childIndex) => {
    const firstChildIndex = partEntry.part.childPartIds.indexOf(childPartId);
    if (firstChildIndex !== childIndex) {
      checks.push(createPartDuplicateChildCheck(partEntry, childPartId, firstChildIndex, childIndex));
      return;
    }

    const childEntry = indexes.partsById.get(childPartId);
    if (childEntry === undefined) {
      checks.push(createPartChildMissingCheck(partEntry, childPartId, childIndex));
      return;
    }

    if (childEntry.part.parentPartId !== partEntry.part.partId) {
      checks.push(createPartParentChildMismatchCheck({
        partEntry,
        relatedPartEntry: childEntry,
        targetPath: `/model/graph/parts/${partEntry.index}/childPartIds/${childIndex}`,
        reason: "child-parent-id-mismatch"
      }));
    }
  });

  return checks;
};

const validateDrawableMembership = (indexes: PartLayerIndexes): readonly ValidationCheckResultDto[] => {
  const checks: ValidationCheckResultDto[] = [];

  for (const drawableEntry of indexes.drawables) {
    const partEntry = indexes.partsById.get(drawableEntry.drawable.partId);
    if (partEntry === undefined) {
      checks.push(createDrawablePartMissingCheck(drawableEntry));
      continue;
    }

    if (!partEntry.part.drawableIds.includes(drawableEntry.drawable.drawableId)) {
      checks.push(createDrawableMembershipMismatchCheck({
        partEntry,
        drawableEntry,
        targetPath: `/model/drawables/drawables/${drawableEntry.index}/partId`,
        reason: "drawable-part-list-missing"
      }));
    }
  }

  for (const partEntry of indexes.parts) {
    partEntry.part.drawableIds.forEach((drawableId, drawableListIndex) => {
      const drawableEntry = indexes.drawablesById.get(drawableId);
      if (drawableEntry === undefined) {
        checks.push(createPartDrawableMissingCheck(partEntry, drawableId, drawableListIndex));
        return;
      }

      if (drawableEntry.drawable.partId !== partEntry.part.partId) {
        checks.push(createDrawableMembershipMismatchCheck({
          partEntry,
          drawableEntry,
          targetPath: `/model/graph/parts/${partEntry.index}/drawableIds/${drawableListIndex}`,
          reason: "drawable-part-id-mismatch"
        }));
      }
    });
  }

  return checks;
};

const validatePartOrderedChildren = (
  partEntry: PartWithIndex,
  indexes: PartLayerIndexes
): readonly ValidationCheckResultDto[] => {
  const children = partEntry.part.children;
  if (children === undefined) {
    return [];
  }

  const checks: ValidationCheckResultDto[] = [];
  const seenChildKeys = new Map<string, number>();
  const orderedPartIds: string[] = [];
  const orderedDrawableIds: string[] = [];

  children.forEach((child, childIndex) => {
    const childKey = child.kind === "part" ? `part:${child.partId}` : `drawable:${child.drawableId}`;
    const firstIndex = seenChildKeys.get(childKey);
    if (firstIndex !== undefined) {
      checks.push(createPartOrderedChildDuplicateCheck(partEntry, childKey, firstIndex, childIndex));
      return;
    }

    seenChildKeys.set(childKey, childIndex);
    if (child.kind === "part") {
      orderedPartIds.push(child.partId);
      const childPart = indexes.partsById.get(child.partId);
      if (childPart === undefined) {
        checks.push(createPartOrderedChildMissingCheck(partEntry, childKey, childIndex));
      } else if (childPart.part.parentPartId !== partEntry.part.partId) {
        checks.push(createPartOrderedChildrenMismatchCheck(partEntry, childIndex, "part-parent-mismatch"));
      }
      return;
    }

    orderedDrawableIds.push(child.drawableId);
    const drawable = indexes.drawablesById.get(child.drawableId);
    if (drawable === undefined) {
      checks.push(createPartOrderedChildMissingCheck(partEntry, childKey, childIndex));
    } else if (drawable.drawable.partId !== partEntry.part.partId) {
      checks.push(createPartOrderedChildrenMismatchCheck(partEntry, childIndex, "drawable-parent-mismatch"));
    }
  });

  if (!sameStringArray(orderedPartIds, partEntry.part.childPartIds)) {
    checks.push(createPartOrderedChildrenMismatchCheck(partEntry, undefined, "childPartIds-mismatch"));
  }

  if (!sameStringArray(orderedDrawableIds, partEntry.part.drawableIds)) {
    checks.push(createPartOrderedChildrenMismatchCheck(partEntry, undefined, "drawableIds-mismatch"));
  }

  return checks;
};

const validateEditorStateReferences = (
  editorState: EditorStateFileDto | undefined,
  indexes: PartLayerIndexes
): readonly ValidationCheckResultDto[] => {
  if (editorState === undefined) {
    return [];
  }

  return [
    ...validateEditorStateReferenceCollection(editorState.selection, "selection", indexes),
    ...validateEditorStateReferenceCollection(editorState.lockedIds, "lockedIds", indexes),
    ...validateEditorStateReferenceCollection(editorState.editorHiddenIds, "editorHiddenIds", indexes)
  ];
};

const validateEditorStateReferenceCollection = (
  targetIds: readonly string[],
  collection: "selection" | "lockedIds" | "editorHiddenIds",
  indexes: PartLayerIndexes
): readonly ValidationCheckResultDto[] =>
  targetIds.flatMap((targetId, targetIndex) =>
    indexes.knownEditorTargetIds.has(targetId)
      ? []
      : [createEditorStateStaleReferenceCheck(targetId, targetIndex, collection, indexes)]
  );

const findFirstPartCycle = (indexes: PartLayerIndexes): readonly string[] | undefined => {
  const edgesByParentId = createPartHierarchyEdges(indexes);
  const visitedPartIds = new Set<string>();
  const visitingIndexes = new Map<string, number>();
  const stack: string[] = [];

  const visit = (partId: string): readonly string[] | undefined => {
    const existingStackIndex = visitingIndexes.get(partId);
    if (existingStackIndex !== undefined) {
      return [...stack.slice(existingStackIndex), partId];
    }

    if (visitedPartIds.has(partId)) {
      return undefined;
    }

    visitingIndexes.set(partId, stack.length);
    stack.push(partId);

    for (const childPartId of edgesByParentId.get(partId) ?? []) {
      const cycle = visit(childPartId);
      if (cycle !== undefined) {
        return cycle;
      }
    }

    stack.pop();
    visitingIndexes.delete(partId);
    visitedPartIds.add(partId);
    return undefined;
  };

  for (const partEntry of indexes.parts) {
    const cycle = visit(partEntry.part.partId);
    if (cycle !== undefined) {
      return cycle;
    }
  }

  return undefined;
};

const createPartHierarchyEdges = (indexes: PartLayerIndexes): ReadonlyMap<string, readonly string[]> => {
  const edgesByParentId = new Map<string, string[]>();
  const addEdge = (parentPartId: string, childPartId: string): void => {
    const childPartIds = edgesByParentId.get(parentPartId) ?? [];
    if (!childPartIds.includes(childPartId)) {
      childPartIds.push(childPartId);
      edgesByParentId.set(parentPartId, childPartIds);
    }
  };

  for (const partEntry of indexes.parts) {
    for (const childPartId of partEntry.part.childPartIds) {
      if (indexes.partsById.has(childPartId)) {
        addEdge(partEntry.part.partId, childPartId);
      }
    }
  }

  for (const partEntry of indexes.parts) {
    const parentPartId = partEntry.part.parentPartId;
    if (parentPartId !== undefined && indexes.partsById.has(parentPartId)) {
      addEdge(parentPartId, partEntry.part.partId);
    }
  }

  return edgesByParentId;
};

const createDrawablePartMissingCheck = (drawableEntry: DrawableWithIndex): ValidationCheckResultDto => {
  const targetPath = `/model/drawables/drawables/${drawableEntry.index}/partId`;

  return ValidationCheckResultSchema.parse({
    checkId: "ref.drawablePartMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: drawableEntry.drawable.partId,
      path: targetPath
    },
    targetPath,
    message: `Drawable ${drawableEntry.drawable.drawableId} references missing part ${drawableEntry.drawable.partId}.`,
    evidence: [
      `drawableId=${drawableEntry.drawable.drawableId}`,
      `partId=${drawableEntry.drawable.partId}`,
      "partGraphMatch=missing"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The drawable cannot be placed in the package part hierarchy until its part reference resolves."
  });
};

const createPartParentMissingCheck = (
  partEntry: PartWithIndex,
  parentPartId: string
): ValidationCheckResultDto => {
  const targetPath = `/model/graph/parts/${partEntry.index}/parentPartId`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.parentMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: partEntry.part.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${partEntry.part.partId} references missing parent part ${parentPartId}.`,
    evidence: [
      `partId=${partEntry.part.partId}`,
      `parentPartId=${parentPartId}`,
      "parentPartMatch=missing"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The part tree cannot be traversed deterministically while a parent reference is unresolved."
  });
};

const createPartChildMissingCheck = (
  partEntry: PartWithIndex,
  childPartId: string,
  childIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/graph/parts/${partEntry.index}/childPartIds/${childIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.childMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: partEntry.part.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${partEntry.part.partId} references missing child part ${childPartId}.`,
    evidence: [
      `partId=${partEntry.part.partId}`,
      `childPartId=${childPartId}`,
      "childPartMatch=missing"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The part tree cannot be traversed deterministically while a child reference is unresolved."
  });
};

const createPartDuplicateChildCheck = (
  partEntry: PartWithIndex,
  childPartId: string,
  firstChildIndex: number,
  duplicateChildIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/graph/parts/${partEntry.index}/childPartIds/${duplicateChildIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.duplicateChild",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: partEntry.part.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${partEntry.part.partId} lists child part ${childPartId} more than once.`,
    evidence: [
      `partId=${partEntry.part.partId}`,
      `childPartId=${childPartId}`,
      `firstChildIndex=${firstChildIndex}`,
      `duplicateChildIndex=${duplicateChildIndex}`,
      "reason=duplicate-child"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The part tree cannot derive a deterministic child ordering while a child part appears multiple times under the same parent."
  });
};

const createPartOrderedChildDuplicateCheck = (
  partEntry: PartWithIndex,
  childKey: string,
  firstChildIndex: number,
  duplicateChildIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/graph/parts/${partEntry.index}/children/${duplicateChildIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.orderedChildrenDuplicate",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: partEntry.part.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${partEntry.part.partId} lists ordered child ${childKey} more than once.`,
    evidence: [
      `partId=${partEntry.part.partId}`,
      `orderedChild=${childKey}`,
      `firstChildIndex=${firstChildIndex}`,
      `duplicateChildIndex=${duplicateChildIndex}`,
      "reason=duplicate-ordered-child"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The part tree cannot derive a deterministic mixed draw stack while a child appears multiple times under the same parent."
  });
};

const createPartOrderedChildMissingCheck = (
  partEntry: PartWithIndex,
  childKey: string,
  childIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/graph/parts/${partEntry.index}/children/${childIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.orderedChildrenTargetMissing",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: partEntry.part.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${partEntry.part.partId} references missing ordered child ${childKey}.`,
    evidence: [
      `partId=${partEntry.part.partId}`,
      `orderedChild=${childKey}`,
      `orderedChildIndex=${childIndex}`,
      "orderedChildMatch=missing"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The part tree cannot derive a deterministic mixed draw stack while an ordered child reference is unresolved."
  });
};

const createPartOrderedChildrenMismatchCheck = (
  partEntry: PartWithIndex,
  childIndex: number | undefined,
  reason:
    | "part-parent-mismatch"
    | "drawable-parent-mismatch"
    | "childPartIds-mismatch"
    | "drawableIds-mismatch"
): ValidationCheckResultDto => {
  const targetPath = childIndex === undefined
    ? `/model/graph/parts/${partEntry.index}/children`
    : `/model/graph/parts/${partEntry.index}/children/${childIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.orderedChildrenMembershipMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: partEntry.part.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${partEntry.part.partId} mixed ordered children disagree with part membership.`,
    evidence: [
      `partId=${partEntry.part.partId}`,
      ...(childIndex === undefined ? [] : [`orderedChildIndex=${childIndex}`]),
      `childPartIds=${partEntry.part.childPartIds.join(",")}`,
      `drawableIds=${partEntry.part.drawableIds.join(",")}`,
      `reason=${reason}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The editor and operation layer cannot share one mixed draw-stack authority while ordered children and membership mirrors disagree."
  });
};

const createPartParentChildMismatchCheck = (input: {
  readonly partEntry: PartWithIndex;
  readonly relatedPartEntry: PartWithIndex;
  readonly targetPath: string;
  readonly reason: "parent-child-list-missing" | "child-parent-id-mismatch";
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "part.parentChildMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: input.partEntry.part.partId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Part ${input.partEntry.part.partId} parent and child references disagree with ${input.relatedPartEntry.part.partId}.`,
    evidence: [
      `partId=${input.partEntry.part.partId}`,
      `relatedPartId=${input.relatedPartEntry.part.partId}`,
      `partParentPartId=${input.partEntry.part.parentPartId ?? "missing"}`,
      `relatedParentPartId=${input.relatedPartEntry.part.parentPartId ?? "missing"}`,
      `partChildPartIds=${input.partEntry.part.childPartIds.join(",")}`,
      `relatedChildPartIds=${input.relatedPartEntry.part.childPartIds.join(",")}`,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The validator cannot derive one deterministic part tree while reciprocal parent and child references disagree."
  });

const createPartCycleCheck = (
  cyclePath: readonly string[],
  indexes: PartLayerIndexes
): ValidationCheckResultDto => {
  const targetPartId = cyclePath[0] ?? "part_unknown";
  const partEntry = indexes.partsById.get(targetPartId);
  const targetPath = partEntry === undefined
    ? "/model/graph/parts"
    : `/model/graph/parts/${partEntry.index}`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.cycle",
    status: "fail",
    severity: "blocking",
    phase: "reference",
    target: {
      kind: "part",
      id: targetPartId,
      path: targetPath
    },
    targetPath,
    message: `Part hierarchy contains a cycle: ${cyclePath.join(" -> ")}.`,
    evidence: [
      `cyclePath=${cyclePath.join("->")}`,
      "edgeSources=parentPartId,childPartIds"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The runtime and editor cannot derive a stable parent-before-child part traversal from a cyclic hierarchy."
  });
};

const createPartDrawableMissingCheck = (
  partEntry: PartWithIndex,
  drawableId: string,
  drawableListIndex: number
): ValidationCheckResultDto => {
  const targetPath = `/model/graph/parts/${partEntry.index}/drawableIds/${drawableListIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "part.drawableMembershipMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "part",
      id: partEntry.part.partId,
      path: targetPath
    },
    targetPath,
    message: `Part ${partEntry.part.partId} lists missing drawable ${drawableId}.`,
    evidence: [
      `partId=${partEntry.part.partId}`,
      `drawableId=${drawableId}`,
      "drawableMatch=missing",
      "reason=part-drawable-missing"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The part membership list cannot be trusted while it names a drawable absent from model/drawables."
  });
};

const createDrawableMembershipMismatchCheck = (input: {
  readonly partEntry: PartWithIndex;
  readonly drawableEntry: DrawableWithIndex;
  readonly targetPath: string;
  readonly reason: "drawable-part-list-missing" | "drawable-part-id-mismatch";
}): ValidationCheckResultDto =>
  ValidationCheckResultSchema.parse({
    checkId: "part.drawableMembershipMismatch",
    status: "fail",
    severity: "error",
    phase: "reference",
    target: {
      kind: "drawable",
      id: input.drawableEntry.drawable.drawableId,
      path: input.targetPath
    },
    targetPath: input.targetPath,
    message: `Drawable ${input.drawableEntry.drawable.drawableId} and part ${input.partEntry.part.partId} membership disagree.`,
    evidence: [
      `drawableId=${input.drawableEntry.drawable.drawableId}`,
      `drawablePartId=${input.drawableEntry.drawable.partId}`,
      `partId=${input.partEntry.part.partId}`,
      `partDrawableIds=${input.partEntry.part.drawableIds.join(",")}`,
      `reason=${input.reason}`
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "The validator cannot derive deterministic drawable grouping while drawable.partId and part.drawableIds disagree."
  });

const createEditorStateStaleReferenceCheck = (
  targetId: string,
  targetIndex: number,
  collection: "selection" | "lockedIds" | "editorHiddenIds",
  indexes: PartLayerIndexes
): ValidationCheckResultDto => {
  const targetPath = `/model/editorState/${collection}/${targetIndex}`;

  return ValidationCheckResultSchema.parse({
    checkId: "editorState.staleReference",
    status: "warning",
    severity: "warning",
    phase: "reference",
    target: {
      kind: "package",
      id: indexes.packageDocument.manifest.packageId,
      path: targetPath
    },
    targetPath,
    message: `Editor state ${collection} references stale target ${targetId}.`,
    evidence: [
      `editorStateCollection=${collection}`,
      `editorStateRef=${targetId}`,
      "targetMatch=missing",
      "runtimeSemantics=unchanged"
    ],
    relatedAC: ["AC-MVP-004", "AC-MVP-011", "AC-MVP-013"],
    relatedScenarios: ["SC-PART-001", "SC-MVP-004"],
    impact: "Selection, lock, and editor-only hide state remain editor metadata, but stale references should be cleaned before final authoring evidence is accepted."
  });
};

const sameStringArray = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
