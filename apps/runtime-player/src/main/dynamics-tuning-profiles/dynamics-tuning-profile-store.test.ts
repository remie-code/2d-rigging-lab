import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type {
  RuntimeExportDynamicsGroupDto,
  RuntimeExportManifestDto,
  RuntimeExportModelDto,
  RuntimeExportParameterDto
} from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import {
  createDynamicsTuningRuntimeExportIdentity
} from "./dynamics-tuning-export-identity";
import {
  dynamicsTuningProfileSchemaVersion
} from "./dynamics-tuning-profile-document";
import {
  createDynamicsTuningProfileDocument
} from "./dynamics-tuning-profile-groups";
import { DynamicsTuningProfileStore } from "./dynamics-tuning-profile-store";

describe("DynamicsTuningProfileStore", () => {
  it("uses the Runtime Player userData dynamics tuning profile path", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-dynamics-tuning-profiles-")
    );
    const payload = createPayload({
      packageId: "pkg:dynamics/tuning"
    });
    const identity = createDynamicsTuningRuntimeExportIdentity(payload);
    const store = new DynamicsTuningProfileStore({ userDataPath });

    expect(store.getProfileFilePath(identity)).toBe(
      path.join(
        userDataPath,
        "dynamics-tuning-profiles",
        identity.safePackageId,
        `${identity.fingerprint}.json`
      )
    );

    await expect(store.loadProfile(payload)).resolves.toMatchObject({
      state: "missing",
      profile: null
    });
  });

  it("persists and reloads group-keyed override JSON", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-dynamics-tuning-profiles-")
    );
    const payload = createPayload();
    const identity = createDynamicsTuningRuntimeExportIdentity(payload);
    const store = new DynamicsTuningProfileStore({ userDataPath });
    const profile = createDynamicsTuningProfileDocument({
      identity,
      groups: {
        dyn_hair_sway: {
          enabled: false,
          strength: 0.25,
          limit: 0.75,
          length: 1.4,
          sway: 2,
          reactionSpeed: 12,
          convergenceSpeed: 4
        }
      },
      createdAtIso: "2026-06-30T00:00:00.000Z",
      updatedAtIso: "2026-06-30T00:01:00.000Z"
    });

    await store.saveProfile({ identity, profile });

    const written = JSON.parse(
      await readFile(store.getProfileFilePath(identity), "utf8")
    ) as unknown;
    const loaded = await store.loadProfile(payload);

    expect(written).toMatchObject({
      schemaVersion: dynamicsTuningProfileSchemaVersion,
      dynamicsSignatureHash: identity.dynamicsSignatureHash,
      groups: {
        dyn_hair_sway: {
          enabled: false,
          strength: 0.25,
          reactionSpeed: 12
        }
      }
    });
    expect(loaded.state).toBe("loaded");
    expect(loaded.profile?.groups.dyn_hair_sway).toMatchObject({
      enabled: false,
      limit: 0.75,
      convergenceSpeed: 4
    });
  });

  it("falls back safely when the profile file contains corrupt JSON", async () => {
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "runtime-player-dynamics-tuning-profiles-")
    );
    const payload = createPayload();
    const identity = createDynamicsTuningRuntimeExportIdentity(payload);
    const store = new DynamicsTuningProfileStore({ userDataPath });
    const profileFilePath = store.getProfileFilePath(identity);
    await mkdir(path.dirname(profileFilePath), { recursive: true });
    await writeFile(profileFilePath, "{not-json", "utf8");

    const loaded = await store.loadProfile(payload);

    expect(loaded.state).toBe("read-failed");
    expect(loaded.profile).toBeNull();
    expect(loaded.warningMessages[0]).toContain("invalid JSON");
  });
});

function createPayload(input: {
  readonly packageId?: string;
  readonly packageHash?: string;
  readonly dynamicsGroups?: readonly RuntimeExportDynamicsGroupDto[];
} = {}): RuntimeExportLoadedPayload {
  const sourcePackage = {
    packageId: input.packageId ?? "pkg_dynamics_tuning_test",
    packageDisplayName: "Dynamics Tuning Test",
    packageRevision: 1,
    packageHash: input.packageHash ?? "sha256:dynamics-tuning-test"
  };
  const parameters = [
    createParameter("param_face_angle_x", "Face Angle X", "external-input"),
    createParameter(
      "param_hair_sway",
      "Hair Sway",
      "computed-dynamics-output"
    )
  ];

  return {
    artifacts: {
      manifest: {
        sourcePackage,
        texturePages: []
      } as unknown as RuntimeExportManifestDto,
      model: {
        sourcePackage,
        parameters,
        inputManifest: {
          externalInputParameterIds: ["param_face_angle_x"],
          computedDynamicsOutputParameterIds: ["param_hair_sway"],
          hiddenDirectControlParameterIds: ["param_hair_sway"]
        },
        dynamicsSolver: {
          solverVersion: "runtime-dynamics-pendulum-v1",
          fixedStepMs: 16.6667,
          resetPolicy: "reset-to-default-parameters-v1"
        },
        dynamicsGroups: input.dynamicsGroups ?? [createDynamicsGroup()]
      } as unknown as RuntimeExportModelDto,
      atlas: {}
    },
    texturePage: {
      metadata: {},
      bytes: new Uint8Array()
    },
    summary: {
      packageId: sourcePackage.packageId,
      packageRevision: sourcePackage.packageRevision,
      modelDisplayName: sourcePackage.packageDisplayName,
      drawableCount: 0,
      meshCount: 0,
      parameterCount: parameters.length,
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

function createParameter(
  parameterId: string,
  displayName: string,
  runtimeRole: "external-input" | "computed-dynamics-output"
): RuntimeExportParameterDto {
  return {
    parameterId,
    displayName,
    valueSource: "authoredInput",
    runtimeRole,
    externalInput: runtimeRole === "external-input",
    readOnly: runtimeRole !== "external-input",
    min: -30,
    max: 30,
    default: 0
  } as unknown as RuntimeExportParameterDto;
}

function createDynamicsGroup(
  input: {
    readonly dynamicsGroupId?: string;
    readonly inputParameterId?: string;
  } = {}
): RuntimeExportDynamicsGroupDto {
  return {
    dynamicsGroupId: input.dynamicsGroupId ?? "dyn_hair_sway",
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
