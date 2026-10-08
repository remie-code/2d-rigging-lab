import { describe, expect, it } from "vitest";

import { createRuntimeParameterFrame } from "../live-mapping/runtime-parameter-frame";
import { createAutoMappingSlots } from "../live-mapping/runtime-export-auto-mapping";
import { RuntimePlayerBodyFollowState } from "../live-mapping/body-follow-state";
import { createTemporaryDefaultInputProfile } from "../input-profiles/input-profile-defaults";
import {
  createModelMappingRuntimeExportIdentity
} from "./model-mapping-export-identity";
import { createModelMappingProfileDocument } from "./model-mapping-profile-slots";
import { restoreModelMappingProfileSlots } from "./model-mapping-profile-slots";
import {
  createModelMappingProfileTestParameter,
  createModelMappingProfileTestPayload
} from "./model-mapping-profile-test-fixtures.test-support";

describe("model mapping profile slot restore", () => {
  it("restores Body Follow controls from a saved profile", () => {
    const payload = createModelMappingProfileTestPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const autoSlots = createAutoMappingSlots(payload);
    const profile = createModelMappingProfileDocument({
      identity,
      slots: autoSlots.map((slot) =>
        slot.slotId === "body-z"
          ? {
              ...slot,
              enabled: false,
              bodyRotationStrength: 0.9,
              bodyRotationInvert: true,
              bodyPositionStrength: 0.15,
              bodyPositionInvert: true,
              smoothing: 0.5
            }
          : slot
      ),
      createdAtIso: "2026-06-23T00:00:00.000Z",
      updatedAtIso: "2026-06-23T00:01:00.000Z"
    });

    const restored = restoreModelMappingProfileSlots({
      payload,
      autoSlots,
      profile
    });

    expect(restored.warningMessages).toEqual([]);
    expect(restored.slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      enabled: false,
      status: "disabled",
      bodyRotationStrength: 0.9,
      bodyRotationInvert: true,
      bodyPositionStrength: 0.15,
      bodyPositionInvert: true,
      smoothing: 0.5
    });
  });

  it("falls back to auto mapping for stale saved targets", () => {
    const payload = createModelMappingProfileTestPayload();
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const autoSlots = createAutoMappingSlots(payload);
    const profile = createModelMappingProfileDocument({
      identity,
      slots: autoSlots.map((slot) =>
        slot.slotId === "body-z" && slot.target !== null
          ? {
              ...slot,
              target: {
                ...slot.target,
                parameterId: "old_body_angle_z"
              },
              bodyRotationStrength: 0.9
            }
          : slot
      ),
      createdAtIso: "2026-06-23T00:00:00.000Z",
      updatedAtIso: "2026-06-23T00:01:00.000Z"
    });

    const restored = restoreModelMappingProfileSlots({
      payload,
      autoSlots,
      profile
    });

    expect(restored.staleSlotCount).toBe(1);
    expect(restored.warningMessages[0]).toContain("old_body_angle_z");
    expect(restored.slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      target: {
        parameterId: "param_body_angle_z"
      },
      bodyRotationStrength: 0.25
    });
  });

  it("keeps live frame output sanitized after profile restore", () => {
    const payload = createModelMappingProfileTestPayload({
      parameters: [
        createModelMappingProfileTestParameter(
          "param_face_angle_x",
          "Face Angle X",
          "face.angle.x"
        )
      ]
    });
    const identity = createModelMappingRuntimeExportIdentity(payload);
    const autoSlots = createAutoMappingSlots(payload);
    const profile = createModelMappingProfileDocument({
      identity,
      slots: autoSlots.map((slot) =>
        slot.slotId === "head-horizontal"
          ? {
              ...slot,
              strength: 0.5,
              invert: true
            }
          : slot
      ),
      createdAtIso: "2026-06-23T00:00:00.000Z",
      updatedAtIso: "2026-06-23T00:01:00.000Z"
    });
    const restored = restoreModelMappingProfileSlots({
      payload,
      autoSlots,
      profile
    });
    const frame = createRuntimeParameterFrame({
      runtimeExportPayload: payload,
      trackingFrame: {
        source: "ifacialmocap",
        timestampMs: 100,
        sequence: 1,
        transport: "udp",
        blendshapes: {},
        head: {
          rotationEulerDeg: { x: 0, y: -30, z: 0 }
        }
      },
      sessionNeutral: null,
      inputProfile: createTemporaryDefaultInputProfile(),
      slots: restored.slots,
      sequence: 1,
      producedAtMs: 1000,
      bodyFollowState: new RuntimePlayerBodyFollowState()
    });

    expect(frame.parameterValues).toEqual({
      param_face_angle_x: -15
    });
    expect("trackingFrame" in frame).toBe(false);
    expect(Object.values(frame.parameterValues).every(Number.isFinite)).toBe(true);
  });
});
