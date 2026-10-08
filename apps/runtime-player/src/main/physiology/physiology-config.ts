import type { PhysiologyBehavior } from "./behavior-class";
import {
  createBlinkBehavior,
  DEFAULT_BLINK_BASELINE,
  IDENTITY_BLINK_MODULATION,
  type BlinkBaselineConfig,
  type BlinkConfig
} from "./blink-behavior";
import { createGazeBehavior } from "./gaze-behavior";
import {
  createHeadBehavior,
  DEFAULT_HEAD_BASELINE,
  type HeadBaselineConfig,
  type HeadCouplingConfig
} from "./head-behavior";
import { createPostureBehavior } from "./posture-behavior";
import { DEFAULT_GAZE_BASELINE, type GazeBaselineConfig } from "./gaze-saccade";
import {
  DEFAULT_POSTURE_BASELINE,
  type PostureBaselineConfig
} from "./posture-reseat";
import { createSaccadeBlinkCoupling } from "./saccade-blink-coupling";

/**
 * Physiology config (C3 Domain A, wave-plan §4.1 / 裁定3). This is the input the
 * frame heart rebuilds its generator from — the「ツマミ即時反映」payload that a
 * config provider hands to the heart. It is the model-INDEPENDENT universal
 * vocabulary (baseline layer only, modulation = identity in C3, design §3.2 /
 * §6): the same config on any body produces the same physiology grammar.
 *
 * Purity: this module lives inside physiology/ and stays Electron-free / wall-
 * clock-free / Math.random-free. It only maps a declarative config onto the pure
 * behavior classes; it never samples a clock.
 *
 * Ownership (裁定3): the config's持ち主 is the main-process Physiology state
 * (both roles共通), delivered to the Autonomous Host heart through a config
 * provider on the composition deps. Domain A ships the config TYPE + a default
 * provider seam; Domain C swaps the provider's source for the real Physiology
 * state (revision tracking / override map / profile persistence).
 *
 * Open shape (裁量, task「将来の behavior 追加に開いた形」): Domain A carried only
 * `blink`. Domain B ADDS optional `gaze` / `head` / `posture` fields (baseline
 * only, C3 modulation = identity); the generator-construction below fans them out
 * into behaviors + couplings as they appear. New behavior fields are OPTIONAL so an
 * older/partial config still builds cleanly — and, deliberately, DEFAULT_PHYSIOLOGY_
 * CONFIG stays blink-only so the Domain A config-seam test (default → [blink]) and
 * the blink golden are unchanged. Domain C assembles the default-ON config for the
 * Autonomous Host from DEFAULT_FULL_PHYSIOLOGY_CONFIG / the per-family defaults.
 */
export type PhysiologyConfig = {
  /** Rejects a config authored under an incompatible schema (Domain C stale拒否). */
  readonly schemaVersion: "runtime-player-physiology-config-v1";
  /**
   * Blink baseline (C2 6-element schema, §6.1). Only the BASELINE is carried;
   * C3 modulation = identity, so the effective blink = baseline (§6.4). Domain C
   * exposes Frequency / Calmness / Crispness / Quirk as writes into this.
   */
  readonly blink: BlinkBaselineConfig;
  /**
   * Gaze baseline (design §1.1 / §6): Camera Focus / Restlessness / Dwell. Present
   * → a gaze behavior is fanned out AND the saccade-blink coupling (§3-2) is wired.
   */
  readonly gaze?: GazeBaselineConfig;
  /** Head baseline (design §1.2 / §6): Sway / Follow. Present → a head behavior is
   *  fanned out; it couples to gaze (§3-1) and posture (§3-3) when those are present. */
  readonly head?: HeadBaselineConfig;
  /** Posture baseline (design §1.3 / §6): Drift / Restlessness. Present → a posture
   *  behavior is fanned out (and parents the head via the reseat baseline, §3-3). */
  readonly posture?: PostureBaselineConfig;
  /**
   * Stage Presence (C3 Domain C UI carrier; DRIVEN by Domain D). The toggle (既定
   * Off) + normalized strength [0, 1]. The physiology BEHAVIOR fan-out below ignores
   * this field entirely — it is read by Domain D, which supplies the posture signal
   * to the Stage transform. Optional & absent from the DEFAULT configs so the C2/
   * Domain A/B behavior construction and the blink golden are unchanged.
   */
  readonly stagePresence?: PhysiologyStagePresenceConfig;
  /**
   * Speech articulation (C6 Domain E改 UI carrier; CONSUMED by the control-channel speech
   * evaluator, NOT the heart). Carries the re-articulation dip FLOOR the Physiology page's
   * `Articulation` slider maps to (§13). Like `stagePresence`, the physiology BEHAVIOR
   * fan-out below ignores it entirely — the composition root reads `speech.articulationFloor`
   * off this same config seam and hands it to the overlay store's speech evaluator. Optional
   * & absent from the DEFAULT configs so the behavior construction and the blink/physiology
   * golden are unchanged (additive, like stagePresence).
   */
  readonly speech?: PhysiologySpeechConfig;
};

/** Stage Presence config field (C3 Domain C carrier / Domain D driver). */
export type PhysiologyStagePresenceConfig = {
  readonly enabled: boolean;
  readonly strength: number;
};

/**
 * Speech articulation config field (C6 Domain E改 carrier / speech-evaluator consumer).
 * `articulationFloor` is the re-articulation dip floor in [0, 1] the Articulation slider
 * maps to: near 1 = barely dips, lower = crisper (§13). It rides the Physiology config seam
 * but is read by the control-channel speech evaluator, never the physiology behavior fan-out.
 */
export type PhysiologySpeechConfig = {
  readonly articulationFloor: number;
};

/** The universal-default physiology config. Blink = C2普遍既定値 (retirement gate).
 *  Intentionally blink-only (see PhysiologyConfig docstring). */
export const DEFAULT_PHYSIOLOGY_CONFIG: PhysiologyConfig = {
  schemaVersion: "runtime-player-physiology-config-v1",
  blink: DEFAULT_BLINK_BASELINE
};

/**
 * The full default physiology config — blink + gaze + head + posture at their
 * universal baselines. This is what brings the Autonomous Host fully alive (visages
 * §8「視線・頭・姿勢が生き」). Domain C wires this (or a profile-overridden clone of it)
 * as the config provider's default so the running body has all four families ON,
 * while the terser DEFAULT_PHYSIOLOGY_CONFIG remains the blink-only retirement gate.
 */
export const DEFAULT_FULL_PHYSIOLOGY_CONFIG: PhysiologyConfig = {
  schemaVersion: "runtime-player-physiology-config-v1",
  blink: DEFAULT_BLINK_BASELINE,
  gaze: DEFAULT_GAZE_BASELINE,
  head: DEFAULT_HEAD_BASELINE,
  posture: DEFAULT_POSTURE_BASELINE
};

/**
 * A config provider: the seam the composition root injects so the heart can read
 * the current physiology config each tick. MUST return a STABLE reference while
 * the config is unchanged (the heart detects change by reference identity to
 * decide when to rebuild — a stable ref = no rebuild, no phase churn). Domain C's
 * immutable Physiology state naturally yields a new object per revision.
 */
export type PhysiologyConfigProvider = () => PhysiologyConfig;

/**
 * Map a physiology config's blink baseline onto a full {@link BlinkConfig}
 * (baseline × identity modulation). By construction
 * `physiologyConfigToBlinkConfig(DEFAULT_PHYSIOLOGY_CONFIG)` deep-equals the C2
 * `DEFAULT_BLINK_CONFIG`, which is the retirement gate keeping the blink golden
 * unchanged when blink is載せ替え onto the config path (wave-plan §4.1 柱3).
 */
export function physiologyConfigToBlinkConfig(
  config: PhysiologyConfig
): BlinkConfig {
  return {
    baseline: config.blink,
    modulation: IDENTITY_BLINK_MODULATION
  };
}

/**
 * Build the generator's behavior list from a physiology config. Blink is always
 * present (sourced from the config baseline). Domain B fans out gaze / head /
 * posture + the saccade-blink coupling as their config fields appear:
 *  - `head` is constructed WITH its sibling gaze/posture configs so it can couple
 *    (§3-1 follow, §3-3 posture-parent) via the shared coupling seed at sample time;
 *  - the saccade-blink coupling (§3-2) is only wired when `gaze` is present.
 * The heart is agnostic to which behaviors exist; it rebuilds the list only when
 * the config reference changes (ツマミ即時反映).
 *
 * Order note: the saccade-blink coupling is appended after blink and writes the same
 * eye slots; the generator merges eye-slot collisions by magnitude (max), so a synced
 * blink can only deepen a natural one regardless of order.
 */
export function createPhysiologyBehaviorsFromConfig(
  config: PhysiologyConfig
): readonly PhysiologyBehavior[] {
  const behaviors: PhysiologyBehavior[] = [
    createBlinkBehavior(physiologyConfigToBlinkConfig(config))
  ];
  if (config.gaze) {
    behaviors.push(createGazeBehavior(config.gaze));
  }
  if (config.head) {
    // Conditional spread (exactOptionalPropertyTypes): only include a sibling when
    // present, so an absent family stays absent rather than explicitly undefined.
    const coupling: HeadCouplingConfig = {
      ...(config.gaze ? { gaze: config.gaze } : {}),
      ...(config.posture ? { posture: config.posture } : {})
    };
    behaviors.push(createHeadBehavior(config.head, coupling));
  }
  if (config.posture) {
    behaviors.push(createPostureBehavior(config.posture));
  }
  if (config.gaze) {
    behaviors.push(createSaccadeBlinkCoupling(config.gaze));
  }
  return behaviors;
}
