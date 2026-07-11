import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createBlinkBehavior,
  DEFAULT_BLINK_CONFIG,
  resolveEffectiveBlink,
  sampleBlinkActivation,
  BLINK_LEFT_SLOT_ID
} from "./blink-behavior";
import {
  createPhysiologyBehaviorsFromConfig,
  DEFAULT_PHYSIOLOGY_CONFIG,
  physiologyConfigToBlinkConfig,
  type PhysiologyConfig
} from "./physiology-config";

/**
 * Physiology config path (C3 Domain A, 柱2/柱3). These tests pin the RETIREMENT
 * GATE: moving blink onto the config path must leave the C2 blink golden fully
 * unchanged at the default config, and the config→behavior mapping must be
 * faithful for non-default configs (ツマミ即時反映 depends on it).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const STEP_MS = 16;
const FRAMES = 900;
const GOLDEN_SEED = 0x5eed1234; // identical to blink-behavior-fixture.test.ts

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

describe("physiology config → blink mapping", () => {
  it("default config maps to the C2 DEFAULT_BLINK_CONFIG (baseline × identity)", () => {
    expect(physiologyConfigToBlinkConfig(DEFAULT_PHYSIOLOGY_CONFIG)).toEqual(
      DEFAULT_BLINK_CONFIG
    );
    // and the effective (post-modulation) blink is identical too
    expect(
      resolveEffectiveBlink(physiologyConfigToBlinkConfig(DEFAULT_PHYSIOLOGY_CONFIG))
    ).toEqual(resolveEffectiveBlink(DEFAULT_BLINK_CONFIG));
  });

  it("emits a single blink behavior sourced from the config baseline", () => {
    const behaviors = createPhysiologyBehaviorsFromConfig(
      DEFAULT_PHYSIOLOGY_CONFIG
    );
    expect(behaviors).toHaveLength(1);
    expect(behaviors[0]?.behaviorId).toBe("blink");
    // its output equals a blink behavior built from the C2 default config
    const reference = createBlinkBehavior(DEFAULT_BLINK_CONFIG);
    for (const t of [0, 3600, 3660, 8000, 15000]) {
      expect(behaviors[0]?.sample({ seed: 7, logicalTimeMs: t })[BLINK_LEFT_SLOT_ID]).toBe(
        reference.sample({ seed: 7, logicalTimeMs: t })[BLINK_LEFT_SLOT_ID]
      );
    }
  });

  it("a non-default config produces a faithful, different blink stream", () => {
    const faster: PhysiologyConfig = {
      ...DEFAULT_PHYSIOLOGY_CONFIG,
      blink: {
        ...DEFAULT_PHYSIOLOGY_CONFIG.blink,
        meanBlinkIntervalMs: 1200,
        closeDepth: 0.7
      }
    };
    const behaviors = createPhysiologyBehaviorsFromConfig(faster);
    const reference = createBlinkBehavior(physiologyConfigToBlinkConfig(faster));
    let differsFromDefault = false;
    for (let frame = 0; frame < 400; frame += 1) {
      const t = frame * STEP_MS;
      const viaConfig = behaviors[0]?.sample({ seed: 7, logicalTimeMs: t })[
        BLINK_LEFT_SLOT_ID
      ];
      expect(viaConfig).toBe(
        reference.sample({ seed: 7, logicalTimeMs: t })[BLINK_LEFT_SLOT_ID]
      );
      if (viaConfig !== sampleBlinkActivation(7, DEFAULT_BLINK_CONFIG, t)) {
        differsFromDefault = true;
      }
    }
    // the config genuinely changes the stream (immediate-reflection precondition)
    expect(differsFromDefault).toBe(true);
  });
});

describe("blink golden invariance under the config path (retirement gate)", () => {
  it("default config path reproduces the committed blink-default golden exactly", () => {
    const golden = JSON.parse(
      readFileSync(join(HERE, "blink-default.golden.json"), "utf8")
    ) as number[];

    const viaConfig: number[] = [];
    const blinkConfig = physiologyConfigToBlinkConfig(DEFAULT_PHYSIOLOGY_CONFIG);
    for (let frame = 0; frame < FRAMES; frame += 1) {
      viaConfig.push(
        round6(sampleBlinkActivation(GOLDEN_SEED, blinkConfig, frame * STEP_MS))
      );
    }

    // Byte-for-byte with the C2 golden — blink載せ替え did not shift a single frame.
    expect(viaConfig).toEqual(golden);
  });
});
