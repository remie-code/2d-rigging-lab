import type { PhysiologyBehavior } from "./behavior-class";
import { createBlinkBehavior } from "./blink-behavior";
import { hashStringToSeed, mixSeeds } from "./deterministic-hash";

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

  // Pre-derive a decorrelated sub-seed per behavior from the session seed.
  const seededBehaviors = behaviors.map((behavior) => ({
    behavior,
    seed: mixSeeds(config.seed >>> 0, hashStringToSeed(behavior.behaviorId))
  }));

  return {
    behaviorIds: behaviors.map((behavior) => behavior.behaviorId),
    sample(logicalTimeMs: number): Record<string, number> {
      const activations: Record<string, number> = {};
      for (const { behavior, seed } of seededBehaviors) {
        const contribution = behavior.sample({ seed, logicalTimeMs });
        for (const slotId of Object.keys(contribution)) {
          const value = contribution[slotId];
          if (value !== undefined) {
            activations[slotId] = value;
          }
        }
      }
      return activations;
    }
  };
}
