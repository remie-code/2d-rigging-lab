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
 * Reachable maxima at strength = 1 (追撃 §12: 知覚性回収 / 二重適用リスク手当て).
 * The gain map from strength → these maxima is CONVEX (square, see below), so the
 * low end stays gentle while the top end is clearly perceptible. At the default
 * strength 0.3 the derived output (0.09 of MAX) matches the previous 控えめ nudge
 * (200 × 0.09 = 18px / 0.15 × 0.09 = 0.0135), but the right end (strength 1) reaches
 * a much larger, plainly visible displacement so the operator can feel on/off.
 *
 * `body.angle` already deforms the rig on the same posture signal (body-z: rotation
 * 0.25 / position 0.4; body-x: strength 0.35); the convex curve keeps the Stage
 * OFFSET small at typical strengths (二重適用手当て) yet gives the right end enough
 * travel to read against that rig deformation. Typical posture activation ±0.2..0.35
 * (posture-behavior drift 0.35/軸) × 200px = 40..70px at full strength — camera-follow
 * (80px) 相当の知覚性. deadZone / reaction / invert are UNCHANGED (上限側のゲイン写像のみ).
 */
export const STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX = 200;
export const STAGE_PRESENCE_MAX_SCALE_STRENGTH = 0.15;
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
 * horizontal offset (px) and the scale delta through a CONVEX (square) gain map
 * `strength²`, so the default strength 0.3 stays gentle (0.09 of MAX ≈ the previous
 * 控えめ nudge) while the right end (strength 1 ⇒ MAX) is plainly perceptible. The
 * square map is monotonic increasing on [0,1] and passes through the origin, so
 * strength 0 ⇒ no offset. The limits stay at the reachable maxima so |input| ≤ 1
 * never clips the derived strength. This is the ONLY place the Stage Presence
 * strength becomes Stage Motion knowledge; it never reads or writes the
 * window-state settings.
 */
export function deriveStagePresenceStageMotionSettings(
  stagePresence: PhysiologyStagePresenceConfig
): RuntimePlayerStageMotionSettings {
  const strength = clampUnit(stagePresence.strength);
  const gain = strength * strength;
  return {
    enabled: stagePresence.enabled,
    horizontal: {
      strengthPx: STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX * gain,
      limitPx: STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX,
      invert: false
    },
    scale: {
      strength: STAGE_PRESENCE_MAX_SCALE_STRENGTH * gain,
      limit: STAGE_PRESENCE_MAX_SCALE_STRENGTH,
      invert: false
    },
    deadZone: STAGE_PRESENCE_DEAD_ZONE,
    reaction: STAGE_PRESENCE_REACTION
  };
}
