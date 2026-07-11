/**
 * Repertoire extension point for the physiology generator (C2 Domain B,
 * design c2-blink-and-generator-skeleton.md §4.2 / §3.1).
 *
 * A "behavior class" is a模型非依存の普遍部品 (エンベロープ三分割の①振る舞いクラス):
 * it owns only 振る舞いの知識A (いつ・どう瞬くか) and emits a partial map of
 * SEMANTIC slot activations. It never knows a model-specific parameterId — the
 * 身体の知識B (which parameterId a slot maps to) lives entirely in the headless
 * resolver (live-mapping/headless-slot-resolver.ts), downstream of this layer.
 *
 * Adding a future behavior (breathing, gaze micro-motion, …) means implementing
 * this interface and registering an instance with the generator — the generator
 * body does not change (§4.2 レパートリー拡張点).
 */

/**
 * Semantic-slot activation contributions from a single behavior at one logical
 * instant. Keys are SEMANTIC slot ids (e.g. `eye-blink-left`), NOT model
 * parameterIds. Values follow the slot's own polarity convention; for blink,
 * 0 = eyes open, 1 = eyes closed (裁定5 / semantic-slot-definitions eye-blink-*
 * defaultInvert:true).
 */
export type SemanticSlotActivationContribution = Readonly<
  Record<string, number>
>;

export type BehaviorSampleInput = {
  /**
   * Per-behavior sub-seed. Derived deterministically by the generator from the
   * session seed + the behavior id (see physiology-generator.ts). A behavior is
   * a pure function of this seed + its config + the logical time.
   */
  readonly seed: number;
  /**
   * Logical time in milliseconds since the generator's epoch. Supplied by the
   * caller (the frame heart, Domain C). A behavior NEVER reads a wall clock; all
   * time enters through this argument (裁定3).
   */
  readonly logicalTimeMs: number;
  /**
   * The generator's SESSION seed (C3 Domain B coupling seam, design §3 結合).
   * Every behavior receives its own decorrelated `seed`; `couplingSeed` is the
   * shared parent seed the generator derives each `seed` from. A COUPLED behavior
   * (head follows gaze; a saccade syncs a blink; the body parents the head)
   * recomputes a SIBLING's exact sub-seed via
   * `deriveBehaviorSeed(couplingSeed, siblingId)` and re-derives the sibling's
   * pure schedule — no state is shared between behaviors, only this seed and each
   * sibling's config. The generator always provides it; an isolated unit test may
   * omit it, in which case a coupled behavior simply does not couple (it degrades
   * to its own independent motion). It stays inside the main process and is never
   * written into a frame — the sanitization boundary is unchanged.
   */
  readonly couplingSeed?: number;
};

export interface PhysiologyBehavior {
  /**
   * Stable behavior id. Used by the generator to derive the sub-seed and to
   * keep behaviors decorrelated. Must be unique within a generator.
   */
  readonly behaviorId: string;
  /**
   * The semantic slot ids this behavior may write. Advisory metadata for the
   * generator/tests; the generator merges whatever `sample` returns.
   */
  readonly slotIds: readonly string[];
  /**
   * Sample this behavior's semantic-slot contribution at the given logical time.
   *
   * Determinism contract: for a fixed seed + fixed config, the returned
   * activation is a pure function of `logicalTimeMs`. An implementation MAY hold
   * a forward-only cursor as a performance memo of the pure walk, provided the
   * result for any given `logicalTimeMs` is identical to a from-epoch evaluation
   * (asserted by the cursor-equivalence test).
   */
  sample(input: BehaviorSampleInput): SemanticSlotActivationContribution;
}
