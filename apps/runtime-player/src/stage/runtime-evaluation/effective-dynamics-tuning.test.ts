import { describe, expect, it } from "vitest";

import type {
  RuntimeExportDynamicsGroupDto,
  RuntimeExportModelDto
} from "@private-2d-rigging-lab/package-format";

import type {
  RuntimePlayerEffectiveDynamicsTuningProfile
} from "../../preload/dynamics-tuning-bridge-contract";
import {
  createEffectiveRuntimeExportDynamicsGroups
} from "./effective-dynamics-tuning";

describe("effective dynamics tuning", () => {
  it("layers group overrides without mutating Runtime Export model dynamics", () => {
    const model = createModel();
    const before = JSON.parse(JSON.stringify(model)) as unknown;

    const effectiveGroups = createEffectiveRuntimeExportDynamicsGroups({
      model,
      effectiveDynamicsTuning: createEffectiveProfile({
        revision: 2,
        groups: {
          dyn_hair_sway: {
            enabled: false,
            outputScale: 2,
            limit: 0.7,
            damping: 3.5,
            gravityScale: 0.5,
            lengthScale: 1.5
          },
          dyn_missing: {
            outputScale: 0.1
          }
        }
      })
    });

    // Multiplier knobs (Scale suffix) multiply the exported values; the rest
    // replace. Exported scale 0.5 * outputScale 2 = 1. Exported segmentLengths
    // [12, 6] * lengthScale 1.5 = [18, 9]. damping/gravityScale/limit replace.
    expect(effectiveGroups[0]).toMatchObject({
      dynamicsGroupId: "dyn_hair_sway",
      enabled: false,
      chain: {
        segmentLengths: [18, 9],
        damping: 3.5,
        gravityScale: 0.5
      },
      outputs: [
        {
          scale: 1,
          limit: 0.7
        }
      ]
    });
    expect(effectiveGroups).toHaveLength(1);
    expect(model).toEqual(before);
    expect(effectiveGroups[0]).not.toBe(model.dynamicsGroups[0]);
    expect(effectiveGroups[0]?.chain).not.toBe(model.dynamicsGroups[0]?.chain);
  });

  it("multiplies scale knobs and replaces the rest (numeric checks)", () => {
    const model = createModel();

    const effectiveGroups = createEffectiveRuntimeExportDynamicsGroups({
      model,
      effectiveDynamicsTuning: createEffectiveProfile({
        revision: 1,
        groups: {
          dyn_hair_sway: {
            outputScale: 2,
            lengthScale: 1.5,
            damping: 9,
            gravityScale: 0.25,
            limit: 0.9
          }
        }
      })
    });

    const group = effectiveGroups[0];
    // outputScale=2 doubles output.scale (0.5 -> 1).
    expect(group?.outputs[0]?.scale).toBeCloseTo(1, 10);
    // lengthScale=1.5 scales every segmentLength ([12, 6] -> [18, 9]).
    expect(group?.chain.segmentLengths).toEqual([18, 9]);
    // damping/gravityScale/limit are replaced, not multiplied.
    expect(group?.chain.damping).toBe(9);
    expect(group?.chain.gravityScale).toBe(0.25);
    expect(group?.outputs[0]?.limit).toBe(0.9);
  });

  it("clones dynamics groups unchanged when no override applies", () => {
    const model = createModel();

    const effectiveGroups = createEffectiveRuntimeExportDynamicsGroups({
      model,
      effectiveDynamicsTuning: null
    });

    expect(effectiveGroups[0]).toEqual(model.dynamicsGroups[0]);
    expect(effectiveGroups[0]).not.toBe(model.dynamicsGroups[0]);
  });
});

function createEffectiveProfile(input: {
  readonly revision: number;
  readonly groups: RuntimePlayerEffectiveDynamicsTuningProfile["groups"];
}): RuntimePlayerEffectiveDynamicsTuningProfile {
  return {
    schemaVersion: "runtime-player-effective-dynamics-tuning-v1",
    revision: input.revision,
    fingerprint: "package-hash-test",
    updatedAtIso: "2026-06-30T00:00:00.000Z",
    exportIdentity: {
      packageId: "pkg_effective_dynamics_tuning",
      packageRevision: 1,
      packageHash: "sha256:effective-dynamics-tuning",
      parameterSignatureHash: "sha256:parameters"
    },
    dynamicsSignatureHash: "sha256:dynamics",
    groups: input.groups
  };
}

function createModel(): RuntimeExportModelDto {
  return {
    sourcePackage: {
      packageId: "pkg_effective_dynamics_tuning",
      packageDisplayName: "Effective Dynamics Tuning",
      packageRevision: 1,
      packageHash: "sha256:effective-dynamics-tuning"
    },
    dynamicsGroups: [createDynamicsGroup()]
  } as unknown as RuntimeExportModelDto;
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
      segmentLengths: [12, 6],
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
