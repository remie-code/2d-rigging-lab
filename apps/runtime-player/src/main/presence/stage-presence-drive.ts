import type {
  RuntimePlayerStageMotionSettings
} from "../../preload/runtime-player-bridge-contract";
import type { PhysiologyStagePresenceConfig } from "../physiology";

/**
 * Stage Presence drive (C3 Domain D, wave-plan §4.4 / 設計§5 / research candidate c).
 *
 * The Autonomous Host feeds the SAME posture signal that deforms `body.angle`
 * (body-x → horizontal, body-z → depth, centered -1..1) into the head-less pure
 * calculator `composeRuntimePlayerStageMotionTransform`, so「体の向きが変わると画面
 * 位置も動く」is structurally coupled (設計§5-3: 駆動信号は姿勢連動のみ).
 *
 * This module owns the SEAM shape and the settings DERIVATION only. It never
 * touches the window-state `stageMotion.settings` (camera / calibration前提, Window
 * State保存) — Stage Presence has its OWN semantics and its OWN settings derived
 * here from the Physiology `stagePresence` config (裁定6 / §5-2: 別フィールド・別意味論).
 *
 * Placement: a neutral main-process leaf (not under `stage-motion/`) so both the
 * role-composition seam and the stage-motion runtime can depend on it downward
 * without a `../stage…` import path (which the process-boundary guard treats as a
 * renderer import).
 */

/**
 * A frame's worth of Stage Presence drive: the settings derived from the
 * `stagePresence` config plus the posture signal + its sample timestamp. When the
 * subsystem returns one, the Stage Motion runtime composes it through the pure
 * calculator instead of the tracking path (data branch, no runtime `if (role)`).
 */
export type RuntimePlayerStageMotionDrive = {
  readonly settings: RuntimePlayerStageMotionSettings;
  /** body-x posture activation (-1..1) or null when absent. */
  readonly horizontalInput: number | null;
  /** body-z posture activation (-1..1) or null when absent. */
  readonly depthInput: number | null;
  /** Wall-clock timestamp of the posture sample; drives frame-rate-independent smoothing. */
  readonly timestampMs: number;
};

/**
 * Reachable maxima at strength = 1 (二重適用リスク手当て, research §4 / 設計§5-4).
 * `body.angle` already deforms the rig on the same posture signal (body-z: rotation
 * 0.25 / position 0.4; body-x: strength 0.35), so the Stage OFFSET layered on top of
 * it is deliberately SMALL — a subtle sense of presence, not a second big motion.
 * These are intentionally well below the camera-follow window-state defaults
 * (horizontal 80px / scale 0.06); Stage Presence is a controlled, opt-in nudge.
 */
export const STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX = 60;
export const STAGE_PRESENCE_MAX_SCALE_STRENGTH = 0.05;
/** Small dead-zone so the slow drift still reads (posture振幅小), only micro-jitter is cut. */
const STAGE_PRESENCE_DEAD_ZONE = 0.02;
/** Reaction (approach speed): gentle, so the presence follows posture smoothly. */
const STAGE_PRESENCE_REACTION = 6;

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Map the Physiology `stagePresence` config (既定 Off, normalized strength [0,1])
 * onto a {@link RuntimePlayerStageMotionSettings}. strength scales BOTH the
 * horizontal offset (px) and the scale delta linearly; the limits stay at the
 * reachable maxima so |input| ≤ 1 never clips the derived strength. This is the
 * ONLY place the Stage Presence strength becomes Stage Motion knowledge; it never
 * reads or writes the window-state settings.
 */
export function deriveStagePresenceStageMotionSettings(
  stagePresence: PhysiologyStagePresenceConfig
): RuntimePlayerStageMotionSettings {
  const strength = clampUnit(stagePresence.strength);
  return {
    enabled: stagePresence.enabled,
    horizontal: {
      strengthPx: STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX * strength,
      limitPx: STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX,
      invert: false
    },
    scale: {
      strength: STAGE_PRESENCE_MAX_SCALE_STRENGTH * strength,
      limit: STAGE_PRESENCE_MAX_SCALE_STRENGTH,
      invert: false
    },
    deadZone: STAGE_PRESENCE_DEAD_ZONE,
    reaction: STAGE_PRESENCE_REACTION
  };
}
