import { ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import type { ParameterId } from "@private-2d-rigging-lab/contracts";

import type { ParameterDto } from "./model-files.js";
import {
  PRESET_PARAMETER_LOCKED_FIELDS,
  type ParameterGroupDto,
  type ParameterLockedFieldDto,
  type ParameterSignConventionDto
} from "./parameter-metadata.js";

export type PresetParameterDto = ParameterDto & {
  readonly kind: "preset";
  readonly parameterType: "scalar";
  readonly group: ParameterGroupDto;
  readonly presetRole: string;
  readonly projectPresetAlias: string;
  readonly lockedFields: readonly ParameterLockedFieldDto[];
  readonly signConvention: ParameterSignConventionDto;
};

export type InitializedParameterDto = ParameterDto & {
  readonly kind: "preset" | "custom";
  readonly parameterType: "scalar";
  readonly group: ParameterGroupDto;
  readonly lockedFields: readonly ParameterLockedFieldDto[];
};

export const PRESET_PARAMETER_CATALOG: readonly PresetParameterDto[] = [
  createFaceAnglePreset("param_face_angle_x", "Face Angle X", "face.angle.x", {
    min: "screen-left face turn",
    default: "center face",
    max: "screen-right face turn"
  }),
  createFaceAnglePreset("param_face_angle_y", "Face Angle Y", "face.angle.y", {
    min: "downward face turn",
    default: "center face",
    max: "upward face turn"
  }),
  createFaceAnglePreset("param_face_angle_z", "Face Angle Z", "face.angle.z", {
    min: "counter-clockwise face roll",
    default: "level face",
    max: "clockwise face roll"
  }),
  createWeightPreset("param_eye_left_open", "Eye Left Open", "eye.left.open", "eyes", 1),
  createWeightPreset("param_eye_right_open", "Eye Right Open", "eye.right.open", "eyes", 1),
  createCenteredPreset("param_eyeball_x", "Eyeball X", "eyeball.x", "eyes", {
    min: "screen-left gaze",
    default: "center gaze",
    max: "screen-right gaze"
  }),
  createCenteredPreset("param_eyeball_y", "Eyeball Y", "eyeball.y", "eyes", {
    min: "downward gaze",
    default: "center gaze",
    max: "upward gaze"
  }),
  createCenteredPreset("param_gaze_x", "Gaze X", "gaze.x", "eyes", {
    min: "screen-left gaze expression",
    default: "center gaze expression",
    max: "screen-right gaze expression"
  }),
  createCenteredPreset("param_gaze_y", "Gaze Y", "gaze.y", "eyes", {
    min: "downward gaze expression",
    default: "center gaze expression",
    max: "upward gaze expression"
  }),
  createWeightPreset("param_mouth_open", "Mouth Open", "mouth.open", "mouth", 0),
  createWeightPreset("param_mouth_smile", "Mouth Smile", "mouth.smile", "mouth", 0),
  createCenteredPreset("param_mouth_form", "Mouth Form", "mouth.form", "mouth", {
    min: "negative mouth form",
    default: "neutral mouth form",
    max: "positive mouth form"
  }),
  createWeightPreset("param_mouth_vowel_a", "Mouth Vowel A", "mouth.vowel.a", "mouth", 0),
  createWeightPreset("param_mouth_vowel_i", "Mouth Vowel I", "mouth.vowel.i", "mouth", 0),
  createWeightPreset("param_mouth_vowel_u", "Mouth Vowel U", "mouth.vowel.u", "mouth", 0),
  createWeightPreset("param_mouth_vowel_e", "Mouth Vowel E", "mouth.vowel.e", "mouth", 0),
  createWeightPreset("param_mouth_vowel_o", "Mouth Vowel O", "mouth.vowel.o", "mouth", 0),
  createCenteredPreset("param_brow_left_y", "Brow Left Y", "brow.left.y", "browCheek", {
    min: "left brow down",
    default: "neutral left brow",
    max: "left brow up"
  }),
  createCenteredPreset("param_brow_right_y", "Brow Right Y", "brow.right.y", "browCheek", {
    min: "right brow down",
    default: "neutral right brow",
    max: "right brow up"
  }),
  createCenteredPreset("param_brow_left_form", "Brow Left Form", "brow.left.form", "browCheek", {
    min: "negative left brow form",
    default: "neutral left brow form",
    max: "positive left brow form"
  }),
  createCenteredPreset("param_brow_right_form", "Brow Right Form", "brow.right.form", "browCheek", {
    min: "negative right brow form",
    default: "neutral right brow form",
    max: "positive right brow form"
  }),
  createWeightPreset("param_cheek", "Cheek", "cheek", "browCheek", 0),
  createBodyAnglePreset("param_body_angle_x", "Body Angle X", "body.angle.x", {
    min: "screen-left body turn",
    default: "center body",
    max: "screen-right body turn"
  }),
  createBodyAnglePreset("param_body_angle_y", "Body Angle Y", "body.angle.y", {
    min: "downward body tilt",
    default: "center body",
    max: "upward body tilt"
  }),
  createBodyAnglePreset("param_body_angle_z", "Body Angle Z", "body.angle.z", {
    min: "counter-clockwise body roll",
    default: "level body",
    max: "clockwise body roll"
  }),
  createWeightPreset("param_breath", "Breath", "breath", "secondary", 0),
  createSwayPreset("param_hair_front_sway_x", "Hair Front Sway X", "hair.front.sway.x"),
  createSwayPreset("param_hair_front_sway_y", "Hair Front Sway Y", "hair.front.sway.y"),
  createSwayPreset("param_hair_side_sway_x", "Hair Side Sway X", "hair.side.sway.x"),
  createSwayPreset("param_hair_side_sway_y", "Hair Side Sway Y", "hair.side.sway.y"),
  createSwayPreset("param_hair_back_sway_x", "Hair Back Sway X", "hair.back.sway.x"),
  createSwayPreset("param_hair_back_sway_y", "Hair Back Sway Y", "hair.back.sway.y"),
  createSwayPreset("param_accessory_sway_x", "Accessory Sway X", "accessory.sway.x"),
  createSwayPreset("param_accessory_sway_y", "Accessory Sway Y", "accessory.sway.y")
];

export const PRESET_PARAMETER_IDS: ReadonlySet<ParameterId> = new Set(
  PRESET_PARAMETER_CATALOG.map((parameter) => parameter.parameterId)
);

export const getPresetParameterById = (
  parameterId: ParameterId | string
): PresetParameterDto | undefined =>
  PRESET_PARAMETER_CATALOG.find((parameter) => parameter.parameterId === parameterId);

export const isPresetParameterId = (parameterId: ParameterId | string): boolean =>
  getPresetParameterById(parameterId) !== undefined;

export const createInitializedParameterSurface = (
  storedParameters: readonly ParameterDto[]
): readonly InitializedParameterDto[] => {
  const storedById = new Map(storedParameters.map((parameter) => [parameter.parameterId, parameter]));
  const initializedPresets = PRESET_PARAMETER_CATALOG.map((preset) =>
    mergeStoredPresetOverride(preset, storedById.get(preset.parameterId))
  );
  const customParameters = storedParameters
    .filter((parameter) => !isPresetParameterId(parameter.parameterId))
    .map(toInitializedCustomParameter);

  return [...initializedPresets, ...customParameters];
};

export const toInitializedParameter = (parameter: ParameterDto): InitializedParameterDto =>
  isPresetParameterId(parameter.parameterId)
    ? mergeStoredPresetOverride(getPresetParameterById(parameter.parameterId) as PresetParameterDto, parameter)
    : toInitializedCustomParameter(parameter);

const mergeStoredPresetOverride = (
  preset: PresetParameterDto,
  stored: ParameterDto | undefined
): InitializedParameterDto => ({
  ...preset,
  ...(stored?.displayName === undefined ? {} : { displayName: stored.displayName }),
  lockedFields: [...PRESET_PARAMETER_LOCKED_FIELDS]
});

const toInitializedCustomParameter = (parameter: ParameterDto): InitializedParameterDto => ({
  parameterId: parameter.parameterId,
  displayName: parameter.displayName,
  valueSource: parameter.valueSource,
  min: parameter.min,
  max: parameter.max,
  default: parameter.default,
  recommendedUiStep: parameter.recommendedUiStep,
  kind: "custom",
  parameterType: "scalar",
  group: "custom",
  lockedFields: []
});

function createFaceAnglePreset(
  parameterId: string,
  displayName: string,
  presetRole: string,
  signConvention: ParameterSignConventionDto
): PresetParameterDto {
  return createPresetParameter({
    parameterId,
    displayName,
    presetRole,
    group: "face",
    semanticRole: "face",
    min: -30,
    max: 30,
    defaultValue: 0,
    recommendedUiStep: 0.1,
    signConvention
  });
}

function createBodyAnglePreset(
  parameterId: string,
  displayName: string,
  presetRole: string,
  signConvention: ParameterSignConventionDto
): PresetParameterDto {
  return createPresetParameter({
    parameterId,
    displayName,
    presetRole,
    group: "body",
    semanticRole: "body",
    min: -10,
    max: 10,
    defaultValue: 0,
    recommendedUiStep: 0.1,
    signConvention
  });
}

function createCenteredPreset(
  parameterId: string,
  displayName: string,
  presetRole: string,
  group: ParameterGroupDto,
  signConvention: ParameterSignConventionDto
): PresetParameterDto {
  return createPresetParameter({
    parameterId,
    displayName,
    presetRole,
    group,
    semanticRole: roleToSemanticGroup(presetRole),
    min: -1,
    max: 1,
    defaultValue: 0,
    recommendedUiStep: 0.01,
    signConvention
  });
}

function createWeightPreset(
  parameterId: string,
  displayName: string,
  presetRole: string,
  group: ParameterGroupDto,
  defaultValue: number
): PresetParameterDto {
  return createPresetParameter({
    parameterId,
    displayName,
    presetRole,
    group,
    semanticRole: roleToSemanticGroup(presetRole),
    min: 0,
    max: 1,
    defaultValue,
    recommendedUiStep: 0.01,
    signConvention: {
      min: "minimum weight",
      default: "default weight",
      max: "maximum weight"
    }
  });
}

function createSwayPreset(
  parameterId: string,
  displayName: string,
  presetRole: string
): PresetParameterDto {
  return createCenteredPreset(parameterId, displayName, presetRole, "secondary", {
    min: "negative sway",
    default: "neutral sway",
    max: "positive sway"
  });
}

function createPresetParameter(input: {
  readonly parameterId: string;
  readonly displayName: string;
  readonly presetRole: string;
  readonly group: ParameterGroupDto;
  readonly semanticRole: NonNullable<ParameterDto["semanticRole"]>;
  readonly min: number;
  readonly max: number;
  readonly defaultValue: number;
  readonly recommendedUiStep: number;
  readonly signConvention: ParameterSignConventionDto;
}): PresetParameterDto {
  return {
    parameterId: ParameterIdSchema.parse(input.parameterId),
    displayName: input.displayName,
    semanticRole: input.semanticRole,
    projectPresetAlias: input.presetRole,
    presetRole: input.presetRole,
    kind: "preset",
    parameterType: "scalar",
    group: input.group,
    valueSource: "authoredInput",
    min: input.min,
    max: input.max,
    default: input.defaultValue,
    recommendedUiStep: input.recommendedUiStep,
    signConvention: input.signConvention,
    lockedFields: [...PRESET_PARAMETER_LOCKED_FIELDS]
  };
}

function roleToSemanticGroup(
  presetRole: string
): NonNullable<ParameterDto["semanticRole"]> {
  if (presetRole.startsWith("eye") || presetRole.startsWith("eyeball") || presetRole.startsWith("gaze")) {
    return "eye";
  }
  if (presetRole.startsWith("mouth")) {
    return "mouth";
  }
  if (presetRole.startsWith("brow") || presetRole.startsWith("cheek")) {
    return "brow";
  }
  if (presetRole.startsWith("body")) {
    return "body";
  }
  if (presetRole.startsWith("hair")) {
    return "hair";
  }
  if (presetRole.startsWith("breath") || presetRole.startsWith("accessory")) {
    return "dynamics";
  }

  return "custom";
}
