import { describe, expect, it } from "vitest";

import { runtimePlayerDefaultStageMotionSettings } from "../window-state/window-state-stage-motion-settings";
import {
  deriveStagePresenceStageMotionSettings,
  STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX,
  STAGE_PRESENCE_MAX_SCALE_STRENGTH
} from "./stage-presence-drive";

/**
 * Stage Presence settings derivation (C3 Domain D + 追撃 §12 知覚性回収). These pin
 * that the Physiology `stagePresence` config (既定 Off, normalized strength [0,1])
 * maps onto Stage Motion settings WITHOUT touching the window-state settings, and
 * that the CONVEX (square `strength²`) gain map keeps the DEFAULT (0.3) 控えめ while
 * letting the RIGHT END (1) reach a plainly perceptible displacement (§12).
 */

describe("deriveStagePresenceStageMotionSettings", () => {
  it("passes the toggle through as settings.enabled", () => {
    expect(
      deriveStagePresenceStageMotionSettings({ enabled: false, strength: 0.5 })
        .enabled
    ).toBe(false);
    expect(
      deriveStagePresenceStageMotionSettings({ enabled: true, strength: 0.5 })
        .enabled
    ).toBe(true);
  });

  it("scales BOTH horizontal px and scale delta by the convex square gain (strength²)", () => {
    const zero = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 0
    });
    // strength 0 ⇒ no offset at all (gain = 0² = 0 ⇒ 0 for any input).
    expect(zero.horizontal.strengthPx).toBe(0);
    expect(zero.scale.strength).toBe(0);

    const full = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 1
    });
    // Right end (gain = 1² = 1) reaches the full maxima — plainly perceptible (§12).
    expect(full.horizontal.strengthPx).toBe(
      STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX
    );
    expect(full.scale.strength).toBe(STAGE_PRESENCE_MAX_SCALE_STRENGTH);

    // Default tone 0.3 (既定は控えめ): gain = 0.3² = 0.09, a small, subtle nudge
    // (≈ the pre-追撃 18px / 0.0135 output — 控えめさは維持).
    const def = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 0.3
    });
    expect(def.horizontal.strengthPx).toBeCloseTo(
      STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX * 0.09,
      10
    );
    expect(def.scale.strength).toBeCloseTo(
      STAGE_PRESENCE_MAX_SCALE_STRENGTH * 0.09,
      10
    );
  });

  it("increases strength monotonically with the tone", () => {
    const strengths = [0, 0.25, 0.5, 0.75, 1];
    const pxValues = strengths.map(
      (strength) =>
        deriveStagePresenceStageMotionSettings({ enabled: true, strength })
          .horizontal.strengthPx
    );
    const scaleValues = strengths.map(
      (strength) =>
        deriveStagePresenceStageMotionSettings({ enabled: true, strength }).scale
          .strength
    );
    for (let i = 1; i < strengths.length; i += 1) {
      expect(pxValues[i]!).toBeGreaterThan(pxValues[i - 1]!);
      expect(scaleValues[i]!).toBeGreaterThan(scaleValues[i - 1]!);
    }
  });

  it("keeps limits at the reachable maxima so |input| ≤ 1 never clips", () => {
    const full = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 1
    });
    // The reachable target offset at |input| = 1 equals strengthPx, so limit ≥
    // strengthPx guarantees no clipping of the derived strength at any strength.
    expect(full.horizontal.limitPx).toBe(
      STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX
    );
    expect(full.scale.limit).toBe(STAGE_PRESENCE_MAX_SCALE_STRENGTH);
    expect(full.horizontal.limitPx).toBeGreaterThanOrEqual(
      full.horizontal.strengthPx
    );
    expect(full.scale.limit).toBeGreaterThanOrEqual(full.scale.strength);
  });

  it("keeps the DEFAULT strength 0.3 conservative vs the camera-follow defaults (控えめ維持)", () => {
    // §12 shifts the RIGHT END above the camera-follow default on purpose (知覚性回収),
    // so the invariant that survives is the DEFAULT-tone 控えめさ: at strength 0.3 the
    // convex gain (0.09) keeps the offset well below the camera-follow default
    // (80px / 0.06), because the SAME posture signal already deforms body.angle
    // downstream — the default Stage nudge is small, not a second big motion.
    const def = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 0.3
    });
    expect(def.horizontal.strengthPx).toBeLessThan(
      runtimePlayerDefaultStageMotionSettings.horizontal.strengthPx
    );
    expect(def.scale.strength).toBeLessThan(
      runtimePlayerDefaultStageMotionSettings.scale.strength
    );

    // The full-strength end intentionally EXCEEDS the camera-follow default (§12
    // 右端は明確に大きい) — this is the perceptibility the manual gate asked for, not
    // a regression.
    const full = deriveStagePresenceStageMotionSettings({
      enabled: true,
      strength: 1
    });
    expect(full.horizontal.strengthPx).toBeGreaterThan(
      runtimePlayerDefaultStageMotionSettings.horizontal.strengthPx
    );
  });

  it("pins the full derived settings incl. deadZone/reaction (Domain D Lane3 N1)", () => {
    // Snapshot the WHOLE derived settings object at the default tone (0.3) so the
    // deadZone (0.02) and reaction (6) constants are fixed. The strength-scale
    // tests above only assert horizontal/scale; deadZone/reaction were unpinned, so
    // a wrong edit (e.g. widening deadZone) could silence the default strength 0.3
    // 控えめ微動 without any failing test — 設計§5「遅い drift は残す / micro-jitter
    // のみ切る」意図に反する退行を将来ここで検知する。
    expect(
      deriveStagePresenceStageMotionSettings({ enabled: true, strength: 0.3 })
    ).toEqual({
      enabled: true,
      horizontal: {
        // Convex square gain: 0.3² = 0.09 of MAX (200 × 0.09 = 18px, 控えめ維持).
        // Mirror the impl's `strength * strength` exactly (float-exact toEqual).
        strengthPx: STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX * (0.3 * 0.3),
        limitPx: STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX,
        invert: false
      },
      scale: {
        strength: STAGE_PRESENCE_MAX_SCALE_STRENGTH * (0.3 * 0.3),
        limit: STAGE_PRESENCE_MAX_SCALE_STRENGTH,
        invert: false
      },
      deadZone: 0.02,
      reaction: 6
    });
  });

  it("clamps a non-finite / out-of-range strength into [0,1]", () => {
    expect(
      deriveStagePresenceStageMotionSettings({
        enabled: true,
        strength: Number.NaN
      }).horizontal.strengthPx
    ).toBe(0);
    expect(
      deriveStagePresenceStageMotionSettings({ enabled: true, strength: 5 })
        .horizontal.strengthPx
    ).toBe(STAGE_PRESENCE_MAX_HORIZONTAL_STRENGTH_PX);
  });
});
