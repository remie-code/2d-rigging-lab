import { describe, expect, it } from "vitest";

import type {
  RuntimeExportModelDto,
  RuntimeExportParameterDto
} from "@private-2d-rigging-lab/package-format";

import type { RuntimeExportLoadedPayload } from "../../preload/runtime-export-bridge-contract";
import { createAutoMappingSlots } from "./runtime-export-auto-mapping";

describe("Runtime Player auto mapping", () => {
  it("maps required semantic slots to direct external-input preset targets", () => {
    const slots = createAutoMappingSlots(createPayload({
      parameters: [
        createParameter("param_face_angle_x", "Face Angle X", "face.angle.x"),
        createParameter("param_face_angle_y", "Face Angle Y", "face.angle.y"),
        createParameter("param_face_angle_z", "Face Angle Z", "face.angle.z"),
        createParameter("param_eye_left_open", "Eye Left Open", "eye.left.open", {
          min: 0,
          max: 1,
          default: 1
        }),
        createParameter("param_eye_right_open", "Eye Right Open", "eye.right.open", {
          min: 0,
          max: 1,
          default: 1
        }),
        createParameter("param_eyeball_x", "Eyeball X", "eyeball.x", {
          min: -1,
          max: 1
        }),
        createParameter("param_eyeball_y", "Eyeball Y", "eyeball.y", {
          min: -1,
          max: 1
        }),
        createParameter("param_mouth_open", "Mouth Open", "mouth.open", {
          min: 0,
          max: 1
        }),
        createParameter("param_mouth_smile", "Mouth Smile", "mouth.smile", {
          min: 0,
          max: 1
        }),
        createParameter("param_body_angle_x", "Body Angle X", "body.angle.x", {
          semanticRole: "body",
          min: -10,
          max: 10
        }),
        createParameter("param_body_angle_z", "Body Angle Z", "body.angle.z", {
          semanticRole: "body",
          min: -10,
          max: 10
        })
      ]
    }));

    expect(slots).toHaveLength(11);
    expect(slots.map((slot) => [slot.slotId, slot.target?.parameterId])).toEqual([
      ["head-horizontal", "param_face_angle_x"],
      ["head-vertical", "param_face_angle_y"],
      ["head-tilt", "param_face_angle_z"],
      ["eye-blink-left", "param_eye_left_open"],
      ["eye-blink-right", "param_eye_right_open"],
      ["gaze-horizontal", "param_eyeball_x"],
      ["gaze-vertical", "param_eyeball_y"],
      ["mouth-open", "param_mouth_open"],
      ["mouth-smile", "param_mouth_smile"],
      ["body-x", "param_body_angle_x"],
      ["body-z", "param_body_angle_z"]
    ]);
    expect(slots.find((slot) => slot.slotId === "eye-blink-left")).toMatchObject({
      enabled: true,
      invert: true,
      strength: 1,
      status: "mapped"
    });
    expect(slots.find((slot) => slot.slotId === "body-x")).toMatchObject({
      group: "body",
      enabled: true,
      invert: false,
      strength: 0.35,
      smoothing: 0.75,
      status: "mapped"
    });
    expect(slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      group: "body",
      enabled: true,
      bodyRotationStrength: 0.25,
      bodyPositionStrength: 0.4,
      bodyRotationInvert: false,
      bodyPositionInvert: false,
      smoothing: 0.75,
      status: "mapped"
    });
  });

  it("maps body targets by standard display name and parameter id aliases", () => {
    const slots = createAutoMappingSlots(createPayload({
      parameters: [
        createParameter("custom_body_x", "Body Angle X", "custom.body.x", {
          semanticRole: "body",
          min: -10,
          max: 10
        }),
        createParameter("param_body_angle_z", "Custom Body Z", "custom.body.z", {
          semanticRole: "body",
          min: -10,
          max: 10
        })
      ]
    }));

    expect(slots.find((slot) => slot.slotId === "body-x")).toMatchObject({
      target: expect.objectContaining({
        parameterId: "custom_body_x"
      }),
      status: "mapped"
    });
    expect(slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      target: expect.objectContaining({
        parameterId: "param_body_angle_z"
      }),
      status: "mapped"
    });
  });

  it("does not map computed, hidden, read-only, or manifest-excluded targets", () => {
    const slots = createAutoMappingSlots(createPayload({
      parameters: [
        createParameter("param_face_angle_x", "Face Angle X", "face.angle.x"),
        createParameter("param_hidden_mouth_open", "Mouth Open", "mouth.open", {
          runtimeRole: "hidden-from-direct-controls",
          externalInput: false,
          readOnly: true
        }),
        createParameter("param_computed_smile", "Mouth Smile", "mouth.smile", {
          runtimeRole: "computed-dynamics-output",
          valueSource: "computedDynamics",
          externalInput: false,
          readOnly: true
        }),
        createParameter("param_internal_gaze", "Eyeball X", "eyeball.x", {
          runtimeRole: "runtime-internal",
          externalInput: false
        }),
        createParameter("param_authored_non_external_gaze_y", "Eyeball Y", "eyeball.y", {
          externalInput: false
        }),
        createParameter("param_manifest_excluded_eye", "Eye Left Open", "eye.left.open"),
        createParameter("param_hidden_body_x", "Body Angle X", "body.angle.x", {
          runtimeRole: "hidden-from-direct-controls",
          externalInput: false,
          readOnly: true
        }),
        createParameter("param_computed_body_z", "Body Angle Z", "body.angle.z", {
          runtimeRole: "computed-dynamics-output",
          valueSource: "computedDynamics",
          externalInput: false,
          readOnly: true
        })
      ],
      manifestExternalIds: ["param_face_angle_x"],
      computedIds: ["param_computed_smile", "param_computed_body_z"],
      hiddenIds: ["param_hidden_mouth_open", "param_hidden_body_x"]
    }));

    expect(slots.find((slot) => slot.slotId === "head-horizontal")).toMatchObject({
      target: expect.objectContaining({
        parameterId: "param_face_angle_x"
      }),
      status: "mapped"
    });
    expect(slots.find((slot) => slot.slotId === "mouth-open")).toMatchObject({
      target: null,
      enabled: false,
      status: "missing-target"
    });
    expect(slots.find((slot) => slot.slotId === "mouth-smile")).toMatchObject({
      target: null,
      status: "missing-target"
    });
    expect(slots.find((slot) => slot.slotId === "eye-blink-left")).toMatchObject({
      target: null,
      status: "missing-target"
    });
    expect(slots.find((slot) => slot.slotId === "gaze-horizontal")).toMatchObject({
      target: null,
      status: "missing-target"
    });
    expect(slots.find((slot) => slot.slotId === "gaze-vertical")).toMatchObject({
      target: null,
      status: "missing-target"
    });
    expect(slots.find((slot) => slot.slotId === "body-x")).toMatchObject({
      target: null,
      enabled: false,
      status: "missing-target"
    });
    expect(slots.find((slot) => slot.slotId === "body-z")).toMatchObject({
      target: null,
      enabled: false,
      status: "missing-target"
    });
    expect(slots.filter((slot) => slot.group !== "body")).toHaveLength(9);
  });
});

function createPayload(input: {
  readonly parameters: readonly RuntimeExportParameterDto[];
  readonly manifestExternalIds?: readonly string[];
  readonly computedIds?: readonly string[];
  readonly hiddenIds?: readonly string[];
}): RuntimeExportLoadedPayload {
  return {
    artifacts: {
      model: {
        parameters: input.parameters,
        inputManifest: {
          externalInputParameterIds:
            input.manifestExternalIds ?? input.parameters
              .filter((parameter) => parameter.runtimeRole === "external-input")
              .map((parameter) => parameter.parameterId),
          computedDynamicsOutputParameterIds: input.computedIds ?? [],
          hiddenDirectControlParameterIds: input.hiddenIds ?? []
        }
      } as unknown as RuntimeExportModelDto,
      manifest: {},
      atlas: {}
    },
    texturePage: {
      metadata: {},
      bytes: new Uint8Array()
    },
    summary: {
      packageId: "pkg_mapping_test",
      packageRevision: 1,
      modelDisplayName: "Mapping Test",
      drawableCount: 0,
      meshCount: 0,
      parameterCount: input.parameters.length,
      maskCount: 0,
      texturePage: {
        pageId: "page",
        path: "page.raw",
        width: 1,
        height: 1,
        pixelFormat: "rgba8",
        byteLength: 4
      },
      requiredCapabilities: []
    },
    loadedAtIso: "2026-06-22T00:00:00.000Z"
  } as unknown as RuntimeExportLoadedPayload;
}

function createParameter(
  parameterId: string,
  displayName: string,
  projectPresetAlias: string,
  options: Partial<RuntimeExportParameterDto> = {}
): RuntimeExportParameterDto {
  return {
    parameterId,
    displayName,
    semanticRole: options.semanticRole ?? "face",
    projectPresetAlias,
    valueSource: options.valueSource ?? "authoredInput",
    runtimeRole: options.runtimeRole ?? "external-input",
    externalInput: options.externalInput ?? true,
    readOnly: options.readOnly ?? false,
    min: options.min ?? -30,
    max: options.max ?? 30,
    default: options.default ?? 0
  } as unknown as RuntimeExportParameterDto;
}
