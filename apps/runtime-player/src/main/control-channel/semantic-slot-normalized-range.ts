import type { SemanticSlotSourceKind } from "../live-mapping/semantic-slot-definitions";

/**
 * Normalized-value domain per semantic-slot sourceKind (C4 検証層 A-3 step 3).
 * The 器's resolver (`headless-slot-resolver.ts:19-21`) documents these domains
 * but only ever CLAMPS to them silently — which the channel must NOT do
 * (rejections never clamp, C4 §3.3). This small classifier surfaces the domain
 * as data so the channel can reject out-of-range values with
 * `slotValueOutOfRange` instead. It reads the same source-of-truth the resolver
 * clamps against; the resolver itself is untouched.
 *
 *  - centered slots (head-centered / gaze-centered / body-x / body-z): -1..1
 *  - weight slots (blink-left / blink-right / mouth-open / mouth-smile): 0..1
 *  - mouth-vowel (pre-blended activation): 0..1
 */

export type SemanticSlotNormalizedRange = {
  readonly min: number;
  readonly max: number;
};

export function semanticSlotNormalizedRange(
  sourceKind: SemanticSlotSourceKind
): SemanticSlotNormalizedRange {
  switch (sourceKind) {
    case "head-centered":
    case "gaze-centered":
    case "body-x":
    case "body-z":
      return { min: -1, max: 1 };
    case "blink-left":
    case "blink-right":
    case "mouth-open":
    case "mouth-smile":
    case "mouth-vowel":
      return { min: 0, max: 1 };
  }
}
