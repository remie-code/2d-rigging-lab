/**
 * Physiology layer public surface (C2 Domain B). Electron-free, wall-clock-free,
 * Math.random-free pure generator. Domain C (frame heart) constructs a generator
 * and feeds `generator.sample(logicalTimeMs)` into the headless slot resolver.
 */
export type {
  PhysiologyBehavior,
  BehaviorSampleInput,
  SemanticSlotActivationContribution
} from "./behavior-class";
export {
  createPhysiologyGenerator,
  type PhysiologyGenerator,
  type PhysiologyGeneratorConfig
} from "./physiology-generator";
export {
  createBlinkBehavior,
  sampleBlinkActivation,
  walkBlinkTo,
  enumerateBlinkEvents,
  blinkEnvelope,
  resolveEffectiveBlink,
  INITIAL_BLINK_CURSOR,
  DEFAULT_BLINK_CONFIG,
  DEFAULT_BLINK_BASELINE,
  IDENTITY_BLINK_MODULATION,
  BLINK_BEHAVIOR_ID,
  BLINK_LEFT_SLOT_ID,
  BLINK_RIGHT_SLOT_ID,
  type BlinkConfig,
  type BlinkBaselineConfig,
  type BlinkModulation,
  type BlinkEvent,
  type BlinkWalkCursor
} from "./blink-behavior";
export {
  hashUnit,
  hashStringToSeed,
  mixSeeds
} from "./deterministic-hash";
