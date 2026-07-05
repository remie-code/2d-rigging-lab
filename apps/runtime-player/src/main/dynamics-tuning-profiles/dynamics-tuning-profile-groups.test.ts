import { describe, expect, it } from "vitest";

import type { RuntimeExportDynamicsGroupDto } from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import type { RuntimePlayerDynamicsTuningGroupOverride } from "../../preload/dynamics-tuning-bridge-contract";
import {
  createDynamicsTuningGroupStatuses,
  sanitizeGroupOverride,
  sanitizeGroupOverrides
} from "./dynamics-tuning-profile-groups";

describe("sanitizeGroupOverride", () => {
  it("keeps valid v2 fields", () => {
    const sanitized = sanitizeGroupOverride({
      enabled: false,
      outputScale: 1.5,
      lengthScale: 0.5,
      limit: 0.75,
      damping: 3.2,
      gravityScale: 0.8
    });

    expect(sanitized).toEqual({
      enabled: false,
      outputScale: 1.5,
      lengthScale: 0.5,
      limit: 0.75,
      damping: 3.2,
      gravityScale: 0.8
    });
  });

  it("drops non-positive multiplier knobs (outputScale/lengthScale)", () => {
    const sanitizedNegative = sanitizeGroupOverride({
      outputScale: -2,
      lengthScale: -1
    } as RuntimePlayerDynamicsTuningGroupOverride);
    expect(Object.keys(sanitizedNegative)).toEqual([]);

    const sanitizedZero = sanitizeGroupOverride({
      outputScale: 0,
      lengthScale: 0
    } as RuntimePlayerDynamicsTuningGroupOverride);
    expect(Object.keys(sanitizedZero)).toEqual([]);
  });

  it("drops negative replacement knobs (limit/damping/gravityScale)", () => {
    const sanitized = sanitizeGroupOverride({
      limit: -0.1,
      damping: -1,
      gravityScale: -2
    } as RuntimePlayerDynamicsTuningGroupOverride);

    expect(Object.keys(sanitized)).toEqual([]);
  });

  it("drops the invalid key while keeping the valid ones", () => {
    const sanitized = sanitizeGroupOverride({
      outputScale: -2,
      damping: 4
    } as RuntimePlayerDynamicsTuningGroupOverride);

    expect(sanitized).toEqual({ damping: 4 });
    expect(sanitized).not.toHaveProperty("outputScale");
  });
});

describe("createDynamicsTuningGroupStatuses (invalid override falls back to defaults)", () => {
  it("treats an invalid outputScale override as no override (identity display)", () => {
    const payload = createPayload();

    // Runtime state persists overrides through sanitizeGroupOverrides (see
    // RuntimePlayerDynamicsTuningState.updateGroup / getEffectiveProfile), which
    // drops an override whose only field is an invalid (negative) outputScale.
    // The resulting empty map must render as "no override": effective values
    // equal the exported baseline (multiplier knob identity 1.0).
    const sanitizedOverrides = sanitizeGroupOverrides({
      dyn_hair_sway: {
        outputScale: -2
      } as RuntimePlayerDynamicsTuningGroupOverride
    });
    expect(sanitizedOverrides).toEqual({});

    const statuses = createDynamicsTuningGroupStatuses({
      payload,
      overrides: sanitizedOverrides
    });

    const group = statuses[0];
    expect(group?.hasOverride).toBe(false);
    expect(group?.override).toBeNull();
    expect(group?.effectiveValues).toEqual(group?.exportedValues);
    expect(group?.effectiveValues.outputScale).toBe(1);
    expect(group?.effectiveValues.lengthScale).toBe(1);
  });
});

function createPayload(): RuntimeExportLoadedPayload {
  const parameters = [
    {
      parameterId: "param_face_angle_x",
      displayName: "Face Angle X",
      valueSource: "authoredInput",
      runtimeRole: "external-input",
      externalInput: true,
      readOnly: false,
      min: -30,
      max: 30,
      default: 0
    },
    {
      parameterId: "param_hair_sway",
      displayName: "Hair Sway",
      valueSource: "authoredInput",
      runtimeRole: "computed-dynamics-output",
      externalInput: false,
      readOnly: true,
      min: -30,
      max: 30,
      default: 0
    }
  ];

  return {
    artifacts: {
      model: {
        parameters,
        dynamicsGroups: [createDynamicsGroup()]
      }
    },
    summary: {
      packageId: "pkg_dynamics_groups_test",
      packageRevision: 1,
      modelDisplayName: "Dynamics Groups Test"
    },
    loadedAtIso: "2026-06-30T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createDynamicsGroup(): RuntimeExportDynamicsGroupDto {
  return {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: "param_face_angle_x",
        kind: "angle",
        scale: 1
      }
    ],
    chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1
    },
    outputs: [
      {
        parameterId: "param_hair_sway",
        segmentIndex: 1,
        scale: 0.5,
        limit: 1
      }
    ]
  } as unknown as RuntimeExportDynamicsGroupDto;
}
