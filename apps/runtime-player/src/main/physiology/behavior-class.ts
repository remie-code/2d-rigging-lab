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
