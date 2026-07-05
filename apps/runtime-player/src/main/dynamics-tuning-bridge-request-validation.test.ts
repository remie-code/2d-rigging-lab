import { describe, expect, it } from "vitest";

import {
  readDynamicsTuningGroupResetRequest,
  readDynamicsTuningGroupUpdateRequest
} from "./dynamics-tuning-bridge-request-validation";

describe("readDynamicsTuningGroupUpdateRequest", () => {
  it("accepts a fully-populated valid v2 override", () => {
    expect(
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        enabled: false,
        outputScale: 1.5,
        lengthScale: 0.5,
        limit: 0.75,
        damping: 3.2,
        gravityScale: 0.8
      })
    ).toEqual({
      groupId: "dyn_hair_sway",
      enabled: false,
      outputScale: 1.5,
      lengthScale: 0.5,
      limit: 0.75,
      damping: 3.2,
      gravityScale: 0.8
    });
  });

  it("omits fields that are absent from the request", () => {
    expect(
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        outputScale: 2
      })
    ).toEqual({
      groupId: "dyn_hair_sway",
      outputScale: 2
    });
  });

  it("rejects a non-positive outputScale (multiplier must be positive)", () => {
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        outputScale: -1
      })
    ).toThrow("outputScale must be positive");
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        outputScale: 0
      })
    ).toThrow("outputScale must be positive");
  });

  it("rejects a non-positive lengthScale (multiplier must be positive)", () => {
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        lengthScale: 0
      })
    ).toThrow("lengthScale must be positive");
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        lengthScale: -0.5
      })
    ).toThrow("lengthScale must be positive");
  });

  it("rejects negative replacement values (limit/damping/gravityScale must be non-negative)", () => {
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        limit: -0.1
      })
    ).toThrow("limit must be non-negative");
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        damping: -1
      })
    ).toThrow("damping must be non-negative");
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({
        groupId: "dyn_hair_sway",
        gravityScale: -2
      })
    ).toThrow("gravityScale must be non-negative");
  });

  it("rejects a missing group id", () => {
    expect(() =>
      readDynamicsTuningGroupUpdateRequest({ outputScale: 1 })
    ).toThrow("group id must be a non-empty string");
  });
});

describe("readDynamicsTuningGroupResetRequest", () => {
  it("reads the group id", () => {
    expect(
      readDynamicsTuningGroupResetRequest({ groupId: " dyn_hair_sway " })
    ).toEqual({ groupId: "dyn_hair_sway" });
  });
});
