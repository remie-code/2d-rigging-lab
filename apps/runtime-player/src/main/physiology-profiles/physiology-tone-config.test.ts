import { describe, expect, it } from "vitest";

import {
  DEFAULT_BLINK_BASELINE,
  DEFAULT_FULL_PHYSIOLOGY_CONFIG,
  DEFAULT_GAZE_BASELINE,
  DEFAULT_HEAD_BASELINE,
  DEFAULT_POSTURE_BASELINE
} from "../physiology";
import {
  physiologyOverridesToConfig,
  resolveEffectiveSectionTones,
  sectionHasOverride
} from "./physiology-tone-config";

describe("physiology tone → config mapping", () => {
  it("maps the all-default tones to the universal full-baseline grammar", () => {
    // Anchoring: every 0.5 midpoint tone maps EXACTLY to the universal baseline, so
    // the all-default config IS the full physiology (default-ON = 視線・頭・姿勢 alive)
    // and Reset → 普遍既定 is the same construction.
    const config = physiologyOverridesToConfig({});

    expect(config.blink).toEqual(DEFAULT_BLINK_BASELINE);
    expect(config.gaze).toEqual(DEFAULT_GAZE_BASELINE);
    expect(config.head).toEqual(DEFAULT_HEAD_BASELINE);
    expect(config.posture).toEqual(DEFAULT_POSTURE_BASELINE);

    // The blink/gaze/head/posture grammar equals DEFAULT_FULL_PHYSIOLOGY_CONFIG.
    expect(config.blink).toEqual(DEFAULT_FULL_PHYSIOLOGY_CONFIG.blink);
    expect(config.gaze).toEqual(DEFAULT_FULL_PHYSIOLOGY_CONFIG.gaze);
    expect(config.head).toEqual(DEFAULT_FULL_PHYSIOLOGY_CONFIG.head);
    expect(config.posture).toEqual(DEFAULT_FULL_PHYSIOLOGY_CONFIG.posture);
  });

  it("carries Stage Presence as a config field, default Off (Domain D reads it)", () => {
    const config = physiologyOverridesToConfig({});
    expect(config.stagePresence).toEqual({ enabled: false, strength: 0.3 });

    const enabled = physiologyOverridesToConfig({
      stagePresence: { enabled: true, strength: 0.8 }
    });
    expect(enabled.stagePresence).toEqual({ enabled: true, strength: 0.8 });
  });

  it("normalizes Head: Follow so 0.6·follow stays < 1 (「全部は向かない」holds)", () => {
    // The task's sharp case: follow > ~1.667 breaks |follow| < |gaze|. The max tone
    // maps to an internal follow of 1.0, so the head gain (0.6·follow) never reaches 1.
    const maxFollow = physiologyOverridesToConfig({
      head: { follow: 1 }
    });
    expect(maxFollow.head?.follow).toBe(1);
    expect((maxFollow.head?.follow ?? 0) * 0.6).toBeLessThan(1);
  });

  it("maps blink Frequency inversely (higher tone = shorter mean interval)", () => {
    const slow = physiologyOverridesToConfig({ blink: { frequency: 0 } });
    const fast = physiologyOverridesToConfig({ blink: { frequency: 1 } });
    const mid = physiologyOverridesToConfig({ blink: { frequency: 0.5 } });

    expect(slow.blink.meanBlinkIntervalMs).toBe(6000);
    expect(fast.blink.meanBlinkIntervalMs).toBe(1800);
    expect(mid.blink.meanBlinkIntervalMs).toBe(
      DEFAULT_BLINK_BASELINE.meanBlinkIntervalMs
    );
    expect(fast.blink.meanBlinkIntervalMs).toBeLessThan(
      slow.blink.meanBlinkIntervalMs
    );
  });

  it("clamps out-of-range tones into [0, 1]", () => {
    const over = physiologyOverridesToConfig({ head: { sway: 5 } });
    const under = physiologyOverridesToConfig({ head: { sway: -3 } });

    expect(over.head?.sway).toBe(
      physiologyOverridesToConfig({ head: { sway: 1 } }).head?.sway
    );
    expect(under.head?.sway).toBe(
      physiologyOverridesToConfig({ head: { sway: 0 } }).head?.sway
    );
  });

  it("resolves effective tones and section-override flags", () => {
    expect(resolveEffectiveSectionTones("gaze", {})).toEqual({
      cameraFocus: 0.5,
      restlessness: 0.5,
      dwell: 0.5
    });
    expect(
      resolveEffectiveSectionTones("gaze", { gaze: { dwell: 0.9 } })
    ).toEqual({ cameraFocus: 0.5, restlessness: 0.5, dwell: 0.9 });

    expect(sectionHasOverride("gaze", {})).toBe(false);
    expect(sectionHasOverride("gaze", { gaze: { dwell: 0.5 } })).toBe(false);
    expect(sectionHasOverride("gaze", { gaze: { dwell: 0.9 } })).toBe(true);
    expect(
      sectionHasOverride("stagePresence", { stagePresence: { enabled: true } })
    ).toBe(true);
    expect(sectionHasOverride("stagePresence", {})).toBe(false);
  });
});
