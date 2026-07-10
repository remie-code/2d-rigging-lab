import { describe, expect, it } from "vitest";

import type {
  RuntimePlayerMappingSlot,
  RuntimePlayerMappingTarget
} from "../../preload/model-mapping-bridge-contract";
import { RuntimePlayerBodyFollowState } from "./body-follow-state";
import { findSemanticSlotDefinition } from "./semantic-slot-definitions";
import { resolveSemanticSlotParameterValues } from "./headless-slot-resolver";

describe("headless slot resolver", () => {
  // Ruling 5: the generator emits "blink activation (0 = open / 1 = closed)".
  // The bare eye-blink defaults (defaultInvert:true / defaultStrength:1) must map
  // that activation to target.min = closed / target.max = open, so the resolver
  // can be driven directly by an activation Record with no TrackingFrame.
  it("maps bare eye-blink defaults so activation 1 = closed (target.min), 0 = open (target.max)", () => {
    const slots = [
      bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1)),
      bareDefaultSlot("eye-blink-right", target("param_eye_right_open", 0, 1, 1))
    ];

    // Fully closed.
    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "eye-blink-left": 1, "eye-blink-right": 1 }
      })
    ).toEqual({
      param_eye_left_open: 0,
      param_eye_right_open: 0
    });

    // Fully open.
    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "eye-blink-left": 0, "eye-blink-right": 0 }
      })
    ).toEqual({
      param_eye_left_open: 1,
      param_eye_right_open: 1
    });

    // Half closed → monotonic between the extremes (0.5 activation → 0.5 open).
    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "eye-blink-left": 0.5, "eye-blink-right": 0.5 }
      })
    ).toEqual({
      param_eye_left_open: 0.5,
      param_eye_right_open: 0.5
    });
  });

  it("honors a non-unit target range with the bare eye-blink invert", () => {
    const slots = [
      bareDefaultSlot(
        "eye-blink-left",
        target("param_eye_left_open", 0.2, 0.9, 0.9)
      )
    ];

    // activation 1 (closed) → target.min; activation 0 (open) → target.max.
    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "eye-blink-left": 1 }
      }).param_eye_left_open
    ).toBeCloseTo(0.2, 12);
    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "eye-blink-left": 0 }
      }).param_eye_left_open
    ).toBeCloseTo(0.9, 12);
  });

  it("supplies the same activation to both eyes (ruling 4: no left/right skew)", () => {
    const slots = [
      bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1)),
      bareDefaultSlot("eye-blink-right", target("param_eye_right_open", 0, 1, 1))
    ];

    const values = resolveSemanticSlotParameterValues({
      slots,
      activations: { "eye-blink-left": 0.73, "eye-blink-right": 0.73 }
    });

    expect(values.param_eye_left_open).toBe(values.param_eye_right_open);
  });

  describe("silently drops unmappable slots", () => {
    it("drops a slot whose target is null", () => {
      const slot: RuntimePlayerMappingSlot = {
        ...bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1)),
        target: null,
        status: "missing-target"
      };

      expect(
        resolveSemanticSlotParameterValues({
          slots: [slot],
          activations: { "eye-blink-left": 1 }
        })
      ).toEqual({});
    });

    it("drops a disabled slot", () => {
      const slot: RuntimePlayerMappingSlot = {
        ...bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1)),
        enabled: false,
        status: "disabled"
      };

      expect(
        resolveSemanticSlotParameterValues({
          slots: [slot],
          activations: { "eye-blink-left": 1 }
        })
      ).toEqual({});
    });

    it("drops a slot with a null activation", () => {
      const slots = [
        bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1))
      ];

      expect(
        resolveSemanticSlotParameterValues({
          slots,
          activations: { "eye-blink-left": null }
        })
      ).toEqual({});
    });

    it("drops a slot with no activation entry (undefined)", () => {
      const slots = [
        bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1))
      ];

      expect(
        resolveSemanticSlotParameterValues({ slots, activations: {} })
      ).toEqual({});
    });

    it("drops a slot with a non-finite (NaN/Infinity) activation", () => {
      const slots = [
        bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1)),
        bareDefaultSlot("eye-blink-right", target("param_eye_right_open", 0, 1, 1))
      ];

      expect(
        resolveSemanticSlotParameterValues({
          slots,
          activations: {
            "eye-blink-left": Number.NaN,
            "eye-blink-right": Number.POSITIVE_INFINITY
          }
        })
      ).toEqual({});
    });

    it("drops only the unmappable slot and keeps the rest", () => {
      const slots = [
        bareDefaultSlot("eye-blink-left", target("param_eye_left_open", 0, 1, 1)),
        bareDefaultSlot("eye-blink-right", target("param_eye_right_open", 0, 1, 1))
      ];

      expect(
        resolveSemanticSlotParameterValues({
          slots,
          activations: {
            "eye-blink-left": Number.NaN,
            "eye-blink-right": 0
          }
        })
      ).toEqual({ param_eye_right_open: 1 });
    });
  });

  it("clamps the resolved value into the target range", () => {
    // strength 2 pushes past target.max; the resolver clamps to it.
    const slots = [
      bareDefaultSlot("head-horizontal", target("param_face_angle_x", -30, 30, 0), {
        strength: 2
      })
    ];

    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "head-horizontal": 1 }
      })
    ).toEqual({ param_face_angle_x: 30 });
  });

  it("applies body smoothing through the shared bodyFollowState only when provided", () => {
    const slots = [
      bareDefaultSlot("body-x", target("param_body_angle_x", -10, 10, 0), {
        strength: 1,
        smoothing: 0.5
      })
    ];

    // Without a bodyFollowState the raw target value comes straight through.
    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "body-x": 1 }
      })
    ).toEqual({ param_body_angle_x: 10 });

    // With a fresh bodyFollowState the first sample seeds, the next lags halfway.
    const bodyFollowState = new RuntimePlayerBodyFollowState();
    resolveSemanticSlotParameterValues({
      slots,
      activations: { "body-x": 0 },
      bodyFollowState
    });
    expect(
      resolveSemanticSlotParameterValues({
        slots,
        activations: { "body-x": 1 },
        bodyFollowState
      })
    ).toEqual({ param_body_angle_x: 5 });
  });
});

function bareDefaultSlot(
  slotId: RuntimePlayerMappingSlot["slotId"],
  mappingTarget: RuntimePlayerMappingTarget,
  overrides: Partial<
    Pick<RuntimePlayerMappingSlot, "invert" | "strength" | "smoothing">
  > = {}
): RuntimePlayerMappingSlot {
  const definition = findSemanticSlotDefinition(slotId);

  return {
    slotId,
    label: definition.label,
    group: definition.group,
    target: mappingTarget,
    enabled: true,
    invert: overrides.invert ?? definition.defaultInvert,
    strength: overrides.strength ?? definition.defaultStrength,
    ...(overrides.smoothing === undefined
      ? {}
      : { smoothing: overrides.smoothing }),
    status: "mapped",
    warningMessages: []
  };
}

function target(
  parameterId: string,
  min: number,
  max: number,
  defaultValue: number
): RuntimePlayerMappingTarget {
  return {
    parameterId,
    displayName: parameterId,
    min,
    max,
    default: defaultValue
  };
}
