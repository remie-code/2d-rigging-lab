import {
  DrawableIdSchema,
  MaskRelationIdSchema
} from "@private-2d-rigging-lab/contracts";
import { z } from "zod";

import type { NormalizedRuntimeGraph } from "./normalized-runtime-graph.js";

export const EvaluatedMaskRelationSchema = z.object({
  maskRelationId: MaskRelationIdSchema,
  sourceDrawableIds: z.array(DrawableIdSchema),
  targetDrawableIds: z.array(DrawableIdSchema),
  enabled: z.literal(true),
  clippingIntent: z.literal("semanticClipping"),
  resolved: z.boolean()
});
export type EvaluatedMaskRelationDto = z.infer<typeof EvaluatedMaskRelationSchema>;

export type RuntimeMaskRelationFieldChange = {
  readonly path: string;
  readonly before: unknown;
  readonly after: unknown;
};

export const createEvaluatedMaskRelations = (
  graph: NormalizedRuntimeGraph
): readonly EvaluatedMaskRelationDto[] => {
  const drawableIds = new Set(graph.drawables.keys());

  return graph.masks
    .map((mask) =>
      EvaluatedMaskRelationSchema.parse({
        maskRelationId: mask.maskRelationId,
        sourceDrawableIds: [...mask.sourceDrawableIds],
        targetDrawableIds: [...mask.targetDrawableIds],
        enabled: true,
        clippingIntent: "semanticClipping",
        resolved:
          mask.sourceDrawableIds.every((drawableId) => drawableIds.has(drawableId)) &&
          mask.targetDrawableIds.every((drawableId) => drawableIds.has(drawableId))
      })
    )
    .sort(compareMaskRelationIds);
};

export const createMaskRelationChanges = (
  beforeMasks: readonly EvaluatedMaskRelationDto[],
  afterMasks: readonly EvaluatedMaskRelationDto[]
): readonly RuntimeMaskRelationFieldChange[] => {
  const beforeById = new Map(beforeMasks.map((mask) => [mask.maskRelationId, mask]));
  const afterById = new Map(afterMasks.map((mask) => [mask.maskRelationId, mask]));
  const changes: RuntimeMaskRelationFieldChange[] = [];

  for (const afterMask of [...afterMasks].sort(compareMaskRelationIds)) {
    const beforeMask = beforeById.get(afterMask.maskRelationId);
    const maskPath = createMaskRelationPath(afterMask.maskRelationId);
    if (beforeMask === undefined) {
      changes.push({
        path: maskPath,
        before: null,
        after: summarizeMaskRelationForDiff(afterMask)
      });
      continue;
    }

    changes.push(...createMaskRelationFieldChanges(beforeMask, afterMask, maskPath));
  }

  for (const beforeMask of [...beforeMasks].sort(compareMaskRelationIds)) {
    if (afterById.has(beforeMask.maskRelationId)) {
      continue;
    }

    changes.push({
      path: createMaskRelationPath(beforeMask.maskRelationId),
      before: summarizeMaskRelationForDiff(beforeMask),
      after: null
    });
  }

  return changes;
};

const createMaskRelationFieldChanges = (
  beforeMask: EvaluatedMaskRelationDto,
  afterMask: EvaluatedMaskRelationDto,
  maskPath: string
): readonly RuntimeMaskRelationFieldChange[] => {
  const changes: RuntimeMaskRelationFieldChange[] = [];

  if (!sameStringList(beforeMask.sourceDrawableIds, afterMask.sourceDrawableIds)) {
    changes.push({
      path: `${maskPath}/sourceDrawableIds`,
      before: beforeMask.sourceDrawableIds,
      after: afterMask.sourceDrawableIds
    });
  }

  if (!sameStringList(beforeMask.targetDrawableIds, afterMask.targetDrawableIds)) {
    changes.push({
      path: `${maskPath}/targetDrawableIds`,
      before: beforeMask.targetDrawableIds,
      after: afterMask.targetDrawableIds
    });
  }

  if (beforeMask.enabled !== afterMask.enabled) {
    changes.push({
      path: `${maskPath}/enabled`,
      before: beforeMask.enabled,
      after: afterMask.enabled
    });
  }

  if (beforeMask.clippingIntent !== afterMask.clippingIntent) {
    changes.push({
      path: `${maskPath}/clippingIntent`,
      before: beforeMask.clippingIntent,
      after: afterMask.clippingIntent
    });
  }

  if (beforeMask.resolved !== afterMask.resolved) {
    changes.push({
      path: `${maskPath}/resolved`,
      before: beforeMask.resolved,
      after: afterMask.resolved
    });
  }

  return changes;
};

const summarizeMaskRelationForDiff = (mask: EvaluatedMaskRelationDto) => ({
  maskRelationId: mask.maskRelationId,
  sourceDrawableIds: mask.sourceDrawableIds,
  targetDrawableIds: mask.targetDrawableIds,
  enabled: mask.enabled,
  clippingIntent: mask.clippingIntent,
  resolved: mask.resolved
});

const compareMaskRelationIds = (
  left: EvaluatedMaskRelationDto,
  right: EvaluatedMaskRelationDto
): number => left.maskRelationId.localeCompare(right.maskRelationId);

const createMaskRelationPath = (maskRelationId: string): string =>
  `/masks/${escapeJsonPointerSegment(maskRelationId)}`;

const escapeJsonPointerSegment = (segment: string): string => segment.replaceAll("~", "~0").replaceAll("/", "~1");

const sameStringList = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
