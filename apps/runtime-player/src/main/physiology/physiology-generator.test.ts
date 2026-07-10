import { describe, expect, it } from "vitest";

import { semanticSlotDefinitions } from "../live-mapping/semantic-slot-definitions";
import type { PhysiologyBehavior } from "./behavior-class";
import {
  BLINK_LEFT_SLOT_ID,
  BLINK_RIGHT_SLOT_ID,
  createBlinkBehavior,
  sampleBlinkActivation,
  DEFAULT_BLINK_CONFIG
} from "./blink-behavior";
import { mixSeeds, hashStringToSeed } from "./deterministic-hash";
import { createPhysiologyGenerator } from "./physiology-generator";

const SEED = 0x0badf00d;

describe("physiology generator — composition & output shape", () => {
  it("defaults to a single blink behavior emitting both eye slots (裁定4)", () => {
    const generator = createPhysiologyGenerator({ seed: SEED });
    expect(generator.behaviorIds).toEqual(["blink"]);

    for (const t of [0, 3600, 3650, 8000, 15000]) {
      const activations = generator.sample(t);
      expect(Object.keys(activations).sort()).toEqual(
        [BLINK_LEFT_SLOT_ID, BLINK_RIGHT_SLOT_ID].sort()
      );
      // 裁定4: left === right, no per-eye difference
      expect(activations[BLINK_LEFT_SLOT_ID]).toBe(activations[BLINK_RIGHT_SLOT_ID]);
      // 裁定5: 0 = open, 1 = closed → within [0,1]
      expect(activations[BLINK_LEFT_SLOT_ID]).toBeGreaterThanOrEqual(0);
      expect(activations[BLINK_LEFT_SLOT_ID]).toBeLessThanOrEqual(1);
    }
  });

  it("derives a decorrelated blink sub-seed from the session seed", () => {
    // The generator seeds blink with mix(sessionSeed, hash("blink")); a directly
    // seeded blink behavior with that sub-seed must match the generator output.
    const subSeed = mixSeeds(SEED >>> 0, hashStringToSeed("blink"));
    for (const t of [3600, 3660, 3720, 9000]) {
      expect(createPhysiologyGenerator({ seed: SEED }).sample(t)[BLINK_LEFT_SLOT_ID]).toBe(
        sampleBlinkActivation(subSeed, DEFAULT_BLINK_CONFIG, t)
      );
    }
  });

  it("is deterministic across two independent generator instances", () => {
    const a = createPhysiologyGenerator({ seed: SEED });
    const b = createPhysiologyGenerator({ seed: SEED });
    for (let frame = 0; frame < 3000; frame += 1) {
      expect(a.sample(frame * 16)).toEqual(b.sample(frame * 16));
    }
  });

  it("rejects duplicate behavior ids", () => {
    expect(() =>
      createPhysiologyGenerator({
        seed: SEED,
        behaviors: [createBlinkBehavior(), createBlinkBehavior()]
      })
    ).toThrow(/Duplicate physiology behaviorId/);
  });
});

describe("physiology generator — repertoire extension point (§4.2)", () => {
  it("composes an additional behavior without touching the generator body", () => {
    const breathingStub: PhysiologyBehavior = {
      behaviorId: "breathing-stub",
      slotIds: ["body-breath"],
      sample: ({ logicalTimeMs }) => ({
        // deterministic placeholder to prove merge, not a real breath keyform
        "body-breath": (logicalTimeMs % 1000) / 1000
      })
    };
    const generator = createPhysiologyGenerator({
      seed: SEED,
      behaviors: [createBlinkBehavior(), breathingStub]
    });
    expect(generator.behaviorIds).toEqual(["blink", "breathing-stub"]);

    const activations = generator.sample(3650);
    expect(Object.keys(activations).sort()).toEqual(
      [BLINK_LEFT_SLOT_ID, BLINK_RIGHT_SLOT_ID, "body-breath"].sort()
    );
    expect(activations["body-breath"]).toBeCloseTo(0.65, 6);
  });
});

describe("blink behavior — forward cursor equivalence (memo faithfulness)", () => {
  it("cursor-threaded sampling equals from-epoch evaluation for a monotonic series", () => {
    const behavior = createBlinkBehavior();
    for (let frame = 0; frame < 6000; frame += 1) {
      const t = frame * 16;
      const threaded = behavior.sample({ seed: SEED, logicalTimeMs: t })[BLINK_LEFT_SLOT_ID];
      const fromEpoch = sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, t);
      expect(threaded).toBe(fromEpoch);
    }
  });

  it("rewinds correctly when logical time goes backward", () => {
    const behavior = createBlinkBehavior();
    behavior.sample({ seed: SEED, logicalTimeMs: 50_000 });
    // Jump back — must still equal a from-epoch evaluation.
    for (const t of [0, 3650, 12000, 50_000]) {
      expect(behavior.sample({ seed: SEED, logicalTimeMs: t })[BLINK_LEFT_SLOT_ID]).toBe(
        sampleBlinkActivation(SEED, DEFAULT_BLINK_CONFIG, t)
      );
    }
  });
});

describe("blink slot ids stay in sync with the semantic slot vocabulary", () => {
  it("matches semantic-slot-definitions blink slot ids (§3.1 boundary)", () => {
    const blinkSlotIds = semanticSlotDefinitions
      .filter((definition) => definition.sourceKind === "blink-left" ||
        definition.sourceKind === "blink-right")
      .map((definition) => definition.slotId)
      .sort();
    expect(blinkSlotIds).toEqual([BLINK_LEFT_SLOT_ID, BLINK_RIGHT_SLOT_ID].sort());
  });
});
