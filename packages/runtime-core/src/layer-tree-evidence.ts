import {
  DrawableIdSchema,
  PartIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  DrawableId,
  JsonValue,
  PartId
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type {
  NormalizedPart,
  NormalizedRuntimeGraph
} from "./normalized-runtime-graph.js";
import type { EvaluatedDrawableTextureDto } from "./texture-projection.js";

export const EvaluatedPartSchema = z.object({
  partId: PartIdSchema,
  displayName: z.string(),
  parentPartId: PartIdSchema.optional(),
  childPartIds: z.array(PartIdSchema).default([]),
  drawableIds: z.array(DrawableIdSchema).default([]),
  hierarchyPath: z.array(PartIdSchema).default([]),
  depth: z.number().int().nonnegative(),
  drawableCount: z.number().int().nonnegative(),
  runtimeVisibleDrawableCount: z.number().int().nonnegative()
});
export type EvaluatedPartDto = z.infer<typeof EvaluatedPartSchema>;

export interface LayerTreeFieldChange {
  readonly path: string;
  readonly before: JsonValue;
  readonly after: JsonValue;
}

export interface ComparableDrawableLayerEvidence {
  readonly drawableId: DrawableId;
  readonly partId?: PartId | undefined;
  readonly texture?: EvaluatedDrawableTextureDto | undefined;
}

export const createEvaluatedParts = (
  graph: NormalizedRuntimeGraph
): readonly EvaluatedPartDto[] => {
  const parts = graph.parts === undefined ? [] : [...graph.parts.values()];
  if (parts.length === 0) {
    return [];
  }

  const partsById = new Map(parts.map((part) => [part.partId, part]));
  const childRefsByParent = createChildRefsByParent(parts);
  const orderedPartIds = orderPartIds(parts, partsById, childRefsByParent);

  return orderedPartIds.map((partId) => {
    const part = partsById.get(partId);
    if (part === undefined) {
      throw new Error(`Part order contained missing part: ${partId}`);
    }

    const drawableIds = [...part.drawableIds];
    const runtimeVisibleDrawableCount = drawableIds.filter((drawableId) => graph.drawables.get(drawableId)?.visible === true).length;
    const hierarchyPath = createHierarchyPath(part, partsById);

    return EvaluatedPartSchema.parse({
      partId: part.partId,
      displayName: part.displayName,
      ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
      childPartIds: [...part.childPartIds],
      drawableIds,
      hierarchyPath,
      depth: Math.max(0, hierarchyPath.length - 1),
      drawableCount: drawableIds.length,
      runtimeVisibleDrawableCount
    });
  });
};

export const createPartHierarchyChanges = (
  beforeParts: readonly EvaluatedPartDto[] | undefined,
  afterParts: readonly EvaluatedPartDto[] | undefined
): readonly LayerTreeFieldChange[] => {
  const beforePartsById = new Map((beforeParts ?? []).map((part) => [part.partId, part]));
  const afterPartsById = new Map((afterParts ?? []).map((part) => [part.partId, part]));
  const partIds = uniqueSortedStrings([...beforePartsById.keys(), ...afterPartsById.keys()]);
  const changes: LayerTreeFieldChange[] = [];

  for (const partId of partIds) {
    const beforePart = beforePartsById.get(partId as PartId);
    const afterPart = afterPartsById.get(partId as PartId);

    if (beforePart === undefined && afterPart !== undefined) {
      changes.push({
        path: `/parts/${partId}`,
        before: null,
        after: summarizePartForDiff(afterPart)
      });
      continue;
    }

    if (beforePart !== undefined && afterPart === undefined) {
      changes.push({
        path: `/parts/${partId}`,
        before: summarizePartForDiff(beforePart),
        after: null
      });
      continue;
    }

    if (beforePart !== undefined && afterPart !== undefined) {
      changes.push(...createExistingPartChanges(beforePart, afterPart));
    }
  }

  return changes.sort(compareChangesByPath);
};

export const createDrawableLayerChanges = (
  beforeDrawables: readonly ComparableDrawableLayerEvidence[],
  afterDrawables: readonly ComparableDrawableLayerEvidence[]
): readonly LayerTreeFieldChange[] => {
  const beforeDrawablesById = new Map(beforeDrawables.map((drawable) => [drawable.drawableId, drawable]));
  const changes: LayerTreeFieldChange[] = [];

  for (const afterDrawable of [...afterDrawables].sort(compareDrawablesById)) {
    const beforeDrawable = beforeDrawablesById.get(afterDrawable.drawableId);
    if (beforeDrawable === undefined) {
      continue;
    }

    if ((beforeDrawable.partId ?? null) !== (afterDrawable.partId ?? null)) {
      changes.push({
        path: `/drawables/${afterDrawable.drawableId}/partId`,
        before: beforeDrawable.partId ?? null,
        after: afterDrawable.partId ?? null
      });
    }

    changes.push(...createDrawableTextureChanges(beforeDrawable, afterDrawable));
  }

  return changes.sort(compareChangesByPath);
};

const createExistingPartChanges = (
  beforePart: EvaluatedPartDto,
  afterPart: EvaluatedPartDto
): readonly LayerTreeFieldChange[] => {
  const changes: LayerTreeFieldChange[] = [];
  addChangeIfDifferent(changes, `/parts/${afterPart.partId}/displayName`, beforePart.displayName, afterPart.displayName);
  addChangeIfDifferent(
    changes,
    `/parts/${afterPart.partId}/parentPartId`,
    beforePart.parentPartId ?? null,
    afterPart.parentPartId ?? null
  );
  addChangeIfDifferent(changes, `/parts/${afterPart.partId}/childPartIds`, beforePart.childPartIds, afterPart.childPartIds);
  addChangeIfDifferent(changes, `/parts/${afterPart.partId}/drawableIds`, beforePart.drawableIds, afterPart.drawableIds);
  addChangeIfDifferent(changes, `/parts/${afterPart.partId}/hierarchyPath`, beforePart.hierarchyPath, afterPart.hierarchyPath);
  return changes;
};

const createDrawableTextureChanges = (
  beforeDrawable: ComparableDrawableLayerEvidence,
  afterDrawable: ComparableDrawableLayerEvidence
): readonly LayerTreeFieldChange[] => {
  const changes: LayerTreeFieldChange[] = [];
  const beforeTexture = summarizeTextureForDiff(beforeDrawable.texture);
  const afterTexture = summarizeTextureForDiff(afterDrawable.texture);

  if (sameJsonValue(beforeTexture, afterTexture)) {
    return changes;
  }

  addChangeIfDifferent(
    changes,
    `/drawables/${afterDrawable.drawableId}/texture/status`,
    beforeTexture === null ? null : beforeTexture.status,
    afterTexture === null ? null : afterTexture.status
  );
  addChangeIfDifferent(
    changes,
    `/drawables/${afterDrawable.drawableId}/texture/textureId`,
    beforeTexture === null ? null : beforeTexture.textureId,
    afterTexture === null ? null : afterTexture.textureId
  );
  addChangeIfDifferent(
    changes,
    `/drawables/${afterDrawable.drawableId}/texture/sourceAssetId`,
    beforeTexture === null ? null : beforeTexture.sourceAssetId,
    afterTexture === null ? null : afterTexture.sourceAssetId
  );
  addChangeIfDifferent(
    changes,
    `/drawables/${afterDrawable.drawableId}/texture/sourceLayerId`,
    beforeTexture === null ? null : beforeTexture.sourceLayerId,
    afterTexture === null ? null : afterTexture.sourceLayerId
  );
  addChangeIfDifferent(
    changes,
    `/drawables/${afterDrawable.drawableId}/texture/projection`,
    beforeTexture === null ? null : beforeTexture.projection,
    afterTexture === null ? null : afterTexture.projection
  );

  return changes;
};

const addChangeIfDifferent = (
  changes: LayerTreeFieldChange[],
  path: string,
  before: JsonValue,
  after: JsonValue
): void => {
  if (sameJsonValue(before, after)) {
    return;
  }

  changes.push({ path, before, after });
};

const summarizePartForDiff = (part: EvaluatedPartDto): JsonValue => ({
  partId: part.partId,
  displayName: part.displayName,
  parentPartId: part.parentPartId ?? null,
  childPartIds: [...part.childPartIds],
  drawableIds: [...part.drawableIds],
  hierarchyPath: [...part.hierarchyPath]
});

const summarizeTextureForDiff = (
  texture: EvaluatedDrawableTextureDto | undefined
): null | {
  readonly status: string;
  readonly textureId: string | null;
  readonly sourceAssetId: string | null;
  readonly sourceLayerId: string | null;
  readonly projection: JsonValue;
} => {
  if (texture === undefined) {
    return null;
  }

  return {
    status: texture.status,
    textureId: texture.textureId ?? null,
    sourceAssetId: texture.sourceAssetId ?? null,
    sourceLayerId: texture.sourceLayerId ?? null,
    projection:
      texture.projection.kind === "uv"
        ? {
            kind: "uv",
            uvCount: texture.projection.uvCount,
            uvs: texture.projection.uvs?.map((uv) => ({ x: uv.x, y: uv.y })) ?? null
          }
        : { kind: "bounds_fit" }
  };
};

const orderPartIds = (
  parts: readonly NormalizedPart[],
  partsById: ReadonlyMap<PartId, NormalizedPart>,
  childRefsByParent: ReadonlyMap<PartId, readonly PartId[]>
): readonly PartId[] => {
  const ordered: PartId[] = [];
  const emitted = new Set<PartId>();
  const roots = parts
    .filter((part) => part.parentPartId === undefined || !partsById.has(part.parentPartId))
    .map((part) => part.partId)
    .sort(compareStrings);

  for (const rootId of roots) {
    appendPart(rootId, partsById, childRefsByParent, emitted, ordered, new Set());
  }

  for (const partId of parts.map((part) => part.partId).sort(compareStrings)) {
    appendPart(partId, partsById, childRefsByParent, emitted, ordered, new Set());
  }

  return ordered;
};

const appendPart = (
  partId: PartId,
  partsById: ReadonlyMap<PartId, NormalizedPart>,
  childRefsByParent: ReadonlyMap<PartId, readonly PartId[]>,
  emitted: Set<PartId>,
  ordered: PartId[],
  activePath: Set<PartId>
): void => {
  if (emitted.has(partId)) {
    return;
  }

  const part = partsById.get(partId);
  if (part === undefined || activePath.has(partId)) {
    return;
  }

  activePath.add(partId);
  emitted.add(partId);
  ordered.push(partId);

  const childPartIds = uniqueInPreferredOrder([
    ...part.childPartIds,
    ...(childRefsByParent.get(part.partId) ?? [])
  ]);
  for (const childPartId of childPartIds) {
    appendPart(childPartId, partsById, childRefsByParent, emitted, ordered, activePath);
  }
  activePath.delete(partId);
};

const createHierarchyPath = (
  part: NormalizedPart,
  partsById: ReadonlyMap<PartId, NormalizedPart>
): readonly PartId[] => {
  const reversedPath: PartId[] = [];
  const seen = new Set<PartId>();
  let current: NormalizedPart | undefined = part;

  while (current !== undefined && !seen.has(current.partId)) {
    reversedPath.push(current.partId);
    seen.add(current.partId);
    current = current.parentPartId === undefined ? undefined : partsById.get(current.parentPartId);
  }

  return reversedPath.reverse();
};

const createChildRefsByParent = (
  parts: readonly NormalizedPart[]
): ReadonlyMap<PartId, readonly PartId[]> => {
  const refs = new Map<PartId, PartId[]>();
  for (const part of parts) {
    if (part.parentPartId === undefined) {
      continue;
    }

    const existing = refs.get(part.parentPartId) ?? [];
    existing.push(part.partId);
    refs.set(part.parentPartId, existing);
  }

  return new Map([...refs.entries()].map(([partId, childPartIds]) => [partId, childPartIds.sort(compareStrings)]));
};

const compareDrawablesById = (
  left: ComparableDrawableLayerEvidence,
  right: ComparableDrawableLayerEvidence
): number => left.drawableId.localeCompare(right.drawableId);

const compareChangesByPath = (
  left: LayerTreeFieldChange,
  right: LayerTreeFieldChange
): number => left.path.localeCompare(right.path);

const uniqueSortedStrings = (values: readonly string[]): readonly string[] => [...new Set(values)].sort(compareStrings);

const uniqueInPreferredOrder = <TValue extends string>(
  values: readonly TValue[]
): readonly TValue[] => {
  const seen = new Set<TValue>();
  const ordered: TValue[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
};

const sameJsonValue = (left: JsonValue, right: JsonValue): boolean => JSON.stringify(left) === JSON.stringify(right);

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
