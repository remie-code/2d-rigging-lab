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
            strength: 0.3,
            limit: 0.7,
            length: 1.8,
            sway: 2.5,
            reactionSpeed: 14,
            convergenceSpeed: 6
          },
          dyn_missing: {
            strength: 0.1
          }
        }
      })
    });

    expect(effectiveGroups[0]).toMatchObject({
      dynamicsGroupId: "dyn_hair_sway",
      enabled: false,
      pendulums: [
        {
          length: 1.8,
          sway: 2.5,
          reactionSpeed: 14,
          convergenceSpeed: 6
        }
      ],
      outputs: [
        {
          strength: 0.3,
          limit: 0.7
        }
      ]
    });
    expect(effectiveGroups).toHaveLength(1);
    expect(model).toEqual(before);
    expect(effectiveGroups[0]).not.toBe(model.dynamicsGroups[0]);
    expect(effectiveGroups[0]?.pendulums[0]).not.toBe(
      model.dynamicsGroups[0]?.pendulums[0]
    );
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
        influencePercent: 100,
        invert: false,
        normalization: {
          min: -30,
          center: 0,
          max: 30
        }
      }
    ],
    pendulums: [
      {
        length: 1,
        sway: 0.5,
        reactionSpeed: 8,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: "param_hair_sway",
        kind: "angle",
        strength: 1,
        invert: false,
        limit: 1
      }
    ]
  } as unknown as RuntimeExportDynamicsGroupDto;
}
