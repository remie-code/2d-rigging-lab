import type { PhysiologyBehavior } from "./behavior-class";
import { createBlinkBehavior } from "./blink-behavior";
import { deriveBehaviorSeed } from "./deterministic-hash";

/**
 * Physiology generator (C2 Domain B). Composes one or more behavior classes into
 * a single semantic-slot activation Record per logical instant.
 *
 * Purity/decoupling: this module holds only 振る舞いの知識A. It emits SEMANTIC
 * slot activations (slotId → 0..1). It never touches Electron, a wall clock, or
 * Math.random, and it never knows a model parameterId — Domain C hands the
 * output to the headless resolver (live-mapping/headless-slot-resolver.ts) which
 * owns 身体の知識B.
 *
 * Repertoire extension (§4.2): add a behavior by passing another
 * {@link PhysiologyBehavior} in `behaviors`; this body does not change.
 */

export type PhysiologyGeneratorConfig = {
  /**
   * Session seed (decided outside — the composition root / autonomous host — and
   * never exposed to the user, C2 §5). Each behavior receives a decorrelated
   * sub-seed derived from this + its behaviorId.
   */
  readonly seed: number;
  /**
   * Behavior classes to compose. Defaults to a single blink behavior with
   * universal defaults. Ids must be unique.
   */
  readonly behaviors?: readonly PhysiologyBehavior[];
};

export type PhysiologyGenerator = {
  /**
   * Sample every behavior at `logicalTimeMs` and merge their semantic-slot
   * contributions into one Record. The output is shaped to drop straight into
   * the headless resolver's `activations` (slotId → activation). For blink the
   * two eye slots carry the SAME value (裁定4). Polarity: 0 = open, 1 = closed
   * (裁定5).
   */
  sample(logicalTimeMs: number): Record<string, number>;
  readonly behaviorIds: readonly string[];
};

export function createPhysiologyGenerator(
  config: PhysiologyGeneratorConfig
): PhysiologyGenerator {
  const behaviors = config.behaviors ?? [createBlinkBehavior()];

  const seen = new Set<string>();
  for (const behavior of behaviors) {
    if (seen.has(behavior.behaviorId)) {
      throw new Error(
        `Duplicate physiology behaviorId: ${behavior.behaviorId}`
      );
    }
    seen.add(behavior.behaviorId);
  }

  // Pre-derive a decorrelated sub-seed per behavior from the session seed. The
  // session seed is ALSO threaded to each behavior as `couplingSeed` so a coupled
  // behavior can recompute a sibling's sub-seed via the SAME derivation (design
  // §3 結合); the two agree by construction.
  const couplingSeed = config.seed >>> 0;
  const seededBehaviors = behaviors.map((behavior) => ({
    behavior,
    seed: deriveBehaviorSeed(couplingSeed, behavior.behaviorId)
  }));

  return {
    behaviorIds: behaviors.map((behavior) => behavior.behaviorId),
    sample(logicalTimeMs: number): Record<string, number> {
      const activations: Record<string, number> = {};
      for (const { behavior, seed } of seededBehaviors) {
        const contribution = behavior.sample({ seed, logicalTimeMs, couplingSeed });
        for (const slotId of Object.keys(contribution)) {
          const value = contribution[slotId];
          if (value === undefined) {
            continue;
          }
          const existing = activations[slotId];
          // Slots are single-owner by construction (gaze/head/body each belong to
          // one behavior), so the common case is a plain assignment. The ONE
          // deliberate collision is the eye-blink slots: the natural blink and the
          // saccade-synced blink (coupling 2, design §3-2) both contribute a
          // closedness in [0, 1]. A synced blink is a UNION with the natural one,
          // so on collision we keep the larger-magnitude contribution (max) — a
          // synced blink can only deepen, never cut short, a natural blink.
          activations[slotId] =
            existing === undefined || Math.abs(value) > Math.abs(existing)
              ? value
              : existing;
        }
      }
      return activations;
    }
  };
}
