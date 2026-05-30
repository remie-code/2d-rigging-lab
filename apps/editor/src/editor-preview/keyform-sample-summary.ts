import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

import type { EditorPreviewKeyformSampleSummaryDto } from "./preview-dto.js";

type RuntimeKeyformSampleDto = RuntimeSnapshotDto["keyformSamples"][number];

export const summarizePreviewKeyformSamples = (
  samples: readonly RuntimeKeyformSampleDto[]
): EditorPreviewKeyformSampleSummaryDto => ({
  totalCount: samples.length,
  byEvaluator: summarizeByEvaluator(samples),
  byTarget: summarizeByTarget(samples)
});

const summarizeByEvaluator = (samples: readonly RuntimeKeyformSampleDto[]) =>
  [...countBy(samples, (sample) => sample.evaluator).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([evaluator, count]) => ({ evaluator, count }));

const summarizeByTarget = (samples: readonly RuntimeKeyformSampleDto[]) =>
  [...groupBy(samples, (sample) => sample.target).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([target, targetSamples]) => ({
      target,
      count: targetSamples.length,
      evaluators: [...new Set(targetSamples.map((sample) => sample.evaluator))].sort()
    }));

const countBy = <TValue, TKey>(values: readonly TValue[], getKey: (value: TValue) => TKey): Map<TKey, number> => {
  const counts = new Map<TKey, number>();
  for (const value of values) {
    const key = getKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
};

const groupBy = <TValue, TKey>(values: readonly TValue[], getKey: (value: TValue) => TKey): Map<TKey, TValue[]> => {
  const groups = new Map<TKey, TValue[]>();
  for (const value of values) {
    const key = getKey(value);
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [value]);
    } else {
      group.push(value);
    }
  }
  return groups;
};
