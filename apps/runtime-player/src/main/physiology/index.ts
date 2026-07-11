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
  mixSeeds,
  deriveBehaviorSeed
} from "./deterministic-hash";
export {
  createGazeBehavior,
  sampleGazeValue,
  GAZE_BEHAVIOR_ID,
  GAZE_HORIZONTAL_SLOT_ID,
  GAZE_VERTICAL_SLOT_ID
} from "./gaze-behavior";
export {
  sampleGazeLanding,
  walkGazeTo,
  stepFixation,
  enumerateFixations,
  INITIAL_GAZE_CURSOR,
  LARGE_SACCADE_THRESHOLD,
  DEFAULT_GAZE_BASELINE,
  type GazeBaselineConfig,
  type GazeFixation,
  type GazeWalkCursor
} from "./gaze-saccade";
export {
  createHeadBehavior,
  DEFAULT_HEAD_BASELINE,
  HEAD_BEHAVIOR_ID,
  HEAD_HORIZONTAL_SLOT_ID,
  HEAD_VERTICAL_SLOT_ID,
  HEAD_TILT_SLOT_ID,
  type HeadBaselineConfig,
  type HeadCouplingConfig
} from "./head-behavior";
export {
  createPostureBehavior,
  samplePostureValue,
  POSTURE_BEHAVIOR_ID,
  BODY_X_SLOT_ID,
  BODY_Z_SLOT_ID
} from "./posture-behavior";
export {
  sampleReseatBaseline,
  walkReseatTo,
  enumerateReseats,
  INITIAL_RESEAT_CURSOR,
  DEFAULT_POSTURE_BASELINE,
  type PostureBaselineConfig,
  type ReseatEvent,
  type ReseatCursor
} from "./posture-reseat";
export {
  createSaccadeBlinkCoupling,
  SACCADE_BLINK_BEHAVIOR_ID
} from "./saccade-blink-coupling";
export {
  smoothValueNoise,
  layeredValueNoise,
  homeSpringValue,
  SMOOTHERSTEP_MAX_SLOPE,
  NOISE_SPAN,
  type NoiseLayer,
  type HomeSpringParams
} from "./deterministic-noise";
export {
  DEFAULT_PHYSIOLOGY_CONFIG,
  DEFAULT_FULL_PHYSIOLOGY_CONFIG,
  physiologyConfigToBlinkConfig,
  createPhysiologyBehaviorsFromConfig,
  type PhysiologyConfig,
  type PhysiologyConfigProvider,
  type PhysiologyStagePresenceConfig,
  type PhysiologySpeechConfig
} from "./physiology-config";
