import { describe, expect, it } from "vitest";

import type { RuntimeExportDynamicsGroupDto } from "@private-2d-rigging-lab/package-format";

import {
  createDynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-export-identity";
import {
  createDynamicsTuningProfileDocument
} from "./dynamics-tuning-profile-groups";
import { RuntimePlayerDynamicsTuningState } from "./dynamics-tuning-state";
import type {
  DynamicsTuningProfileStoreLoadResult
} from "./dynamics-tuning-profile-store";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";

describe("RuntimePlayerDynamicsTuningState", () => {
  it("ignores stale signatures and keeps exported dynamics defaults", () => {
    const oldPayload = createPayload({
      packageHash: "sha256:stable-package",
      dynamicsGroups: [
        createDynamicsGroup({
          inputParameterId: "param_face_angle_x"
        })
      ]
    });
    const newPayload = createPayload({
      packageHash: "sha256:stable-package",
      dynamicsGroups: [
        createDynamicsGroup({
          inputParameterId: "param_face_angle_y"
        })
      ]
    });
    const oldIdentity = createDynamicsTuningRuntimeExportIdentity(oldPayload);
    const newIdentity = createDynamicsTuningRuntimeExportIdentity(newPayload);
    const state = new RuntimePlayerDynamicsTuningState({
      nowMs: () => Date.parse("2026-06-30T01:00:00.000Z")
    });

    const status = state.setRuntimeExportPayload(newPayload, {
      identity: newIdentity,
      profileFilePath: "profile.json",
      profile: createDynamicsTuningProfileDocument({
        identity: oldIdentity,
        groups: {
          dyn_hair_sway: {
            strength: 0.25,
            length: 2
          }
        },
        createdAtIso: "2026-06-30T00:00:00.000Z",
        updatedAtIso: "2026-06-30T00:01:00.000Z"
      }),
      state: "loaded",
      warningMessages: []
    });

    expect(status.profileStatus.kind).toBe("stale");
    expect(status.profileStatus.warningMessages[0]).toContain(
      "signature does not match"
    );
    expect(status.groups[0]?.override).toBeNull();
    expect(status.groups[0]?.effectiveValues).toMatchObject({
      strength: 1,
      length: 1
    });
    expect(state.getEffectiveProfile()?.groups).toEqual({});
  });

  it("restores matching groups and ignores missing group ids", () => {
    const payload = createPayload();
    const identity = createDynamicsTuningRuntimeExportIdentity(payload);
    const state = new RuntimePlayerDynamicsTuningState();
    const profile = createDynamicsTuningProfileDocument({
      identity,
      groups: {
        dyn_hair_sway: {
          enabled: false,
          strength: 0.4,
          reactionSpeed: 14
        },
        dyn_removed: {
          strength: 0.1
        }
      },
      createdAtIso: "2026-06-30T00:00:00.000Z",
      updatedAtIso: "2026-06-30T00:02:00.000Z"
    });
    const loadResult: DynamicsTuningProfileStoreLoadResult = {
      identity,
      profileFilePath: "profile.json",
      profile,
      state: "loaded",
      warningMessages: []
    };

    const status = state.setRuntimeExportPayload(payload, loadResult);

    expect(status.profileStatus.kind).toBe("stale");
    expect(status.profileStatus.warningMessages[0]).toContain("dyn_removed");
    expect(status.groups[0]?.effectiveValues).toMatchObject({
      enabled: false,
      strength: 0.4,
      reactionSpeed: 14
    });
    expect(state.getEffectiveProfile()?.groups).toEqual({
      dyn_hair_sway: {
        enabled: false,
        strength: 0.4,
        reactionSpeed: 14
      }
    });
  });

  it("increments the effective tuning revision for runtime updates", () => {
    const payload = createPayload();
    const state = new RuntimePlayerDynamicsTuningState({
      nowMs: () => Date.parse("2026-06-30T01:00:00.000Z")
    });

    state.setRuntimeExportPayload(payload);
    const initialRevision = state.getEffectiveProfile()?.revision;
    state.updateGroup({
      groupId: "dyn_hair_sway",
      strength: 0.3
    });
    const updated = state.getEffectiveProfile();

    expect(updated?.revision).toBe((initialRevision ?? 0) + 1);
    expect(updated?.groups.dyn_hair_sway).toEqual({
      strength: 0.3
    });
  });
});

function createPayload(input: {
  readonly packageHash?: string;
  readonly dynamicsGroups?: readonly RuntimeExportDynamicsGroupDto[];
} = {}): RuntimeExportLoadedPayload {
  return {
    artifacts: {
      manifest: {
        sourcePackage: {
          packageId: "pkg_dynamics_state_test",
          packageDisplayName: "Dynamics State Test",
          packageRevision: 1,
          packageHash: input.packageHash ?? "sha256:dynamics-state-test"
        },
        texturePages: []
      },
      model: {
        sourcePackage: {
          packageId: "pkg_dynamics_state_test",
          packageDisplayName: "Dynamics State Test",
          packageRevision: 1,
          packageHash: input.packageHash ?? "sha256:dynamics-state-test"
        },
        parameters: [
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
            parameterId: "param_face_angle_y",
            displayName: "Face Angle Y",
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
        ],
        inputManifest: {
          externalInputParameterIds: [
            "param_face_angle_x",
            "param_face_angle_y"
          ],
          computedDynamicsOutputParameterIds: ["param_hair_sway"],
          hiddenDirectControlParameterIds: ["param_hair_sway"]
        },
        dynamicsSolver: {
          solverVersion: "runtime-dynamics-pendulum-v1",
          fixedStepMs: 16.6667,
          resetPolicy: "reset-to-default-parameters-v1"
        },
        dynamicsGroups: input.dynamicsGroups ?? [createDynamicsGroup()]
      },
      atlas: {}
    },
    texturePage: {
      metadata: {},
      bytes: new Uint8Array()
    },
    summary: {
      packageId: "pkg_dynamics_state_test",
      packageRevision: 1,
      modelDisplayName: "Dynamics State Test",
      drawableCount: 0,
      meshCount: 0,
      parameterCount: 3,
      maskCount: 0,
      texturePage: {
        pageId: "page",
        path: "textures/page_0.rgba",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      },
      requiredCapabilities: []
    },
    loadedAtIso: "2026-06-30T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createDynamicsGroup(input: {
  readonly inputParameterId?: string;
} = {}): RuntimeExportDynamicsGroupDto {
  return {
    dynamicsGroupId: "dyn_hair_sway",
    displayName: "Hair Sway",
    enabled: true,
    inputs: [
      {
        parameterId: input.inputParameterId ?? "param_face_angle_x",
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
