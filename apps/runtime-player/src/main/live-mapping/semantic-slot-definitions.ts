import type {
  RuntimePlayerMappingSlotGroup,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import type {
  InputProfileAxis,
  InputProfileDirection,
  InputProfileLearnedSign
} from "../input-profiles/input-profile-document";
import type { VowelLabel } from "./vowel-lipsync-estimator";

export type SemanticSlotSourceKind =
  | "head-centered"
  | "gaze-centered"
  | "blink-left"
  | "blink-right"
  | "mouth-open"
  | "mouth-smile"
  | "mouth-vowel"
  | "body-x"
  | "body-z";

export type SemanticSlotDefinition = {
  readonly slotId: RuntimePlayerMappingSlotId;
  readonly label: string;
  readonly group: RuntimePlayerMappingSlotGroup;
  readonly targetAliases: readonly string[];
  readonly targetDisplayName: string;
  readonly sourceKind: SemanticSlotSourceKind;
  readonly defaultInvert: boolean;
  readonly defaultStrength: number;
  readonly defaultSmoothing?: number;
  readonly defaultBodyRotationStrength?: number;
  readonly defaultBodyPositionStrength?: number;
  readonly defaultBodyRotationInvert?: boolean;
  readonly defaultBodyPositionInvert?: boolean;
  readonly fallbackPositiveSign?: InputProfileLearnedSign;
  readonly vowelLabel?: VowelLabel;
};

export const semanticSlotDefinitions: readonly SemanticSlotDefinition[] = [
  {
    slotId: "head-horizontal",
    label: "Head horizontal",
    group: "head",
    targetAliases: ["face.angle.x"],
    targetDisplayName: "Face Angle X",
    sourceKind: "head-centered",
    defaultInvert: false,
    defaultStrength: 1,
    fallbackPositiveSign: sign("y", -1)
  },
  {
    slotId: "head-vertical",
    label: "Head vertical",
    group: "head",
    targetAliases: ["face.angle.y"],
    targetDisplayName: "Face Angle Y",
    sourceKind: "head-centered",
    defaultInvert: false,
    defaultStrength: 1,
    fallbackPositiveSign: sign("x", 1)
  },
  {
    slotId: "head-tilt",
    label: "Head tilt",
    group: "head",
    targetAliases: ["face.angle.z"],
    targetDisplayName: "Face Angle Z",
    sourceKind: "head-centered",
    defaultInvert: false,
    defaultStrength: 1,
    fallbackPositiveSign: sign("z", -1)
  },
  {
    slotId: "eye-blink-left",
    label: "Eye blink left",
    group: "eyes",
    targetAliases: ["eye.left.open"],
    targetDisplayName: "Eye Left Open",
    sourceKind: "blink-left",
    defaultInvert: true,
    defaultStrength: 1
  },
  {
    slotId: "eye-blink-right",
    label: "Eye blink right",
    group: "eyes",
    targetAliases: ["eye.right.open"],
    targetDisplayName: "Eye Right Open",
    sourceKind: "blink-right",
    defaultInvert: true,
    defaultStrength: 1
  },
  {
    slotId: "gaze-horizontal",
    label: "Gaze horizontal",
    group: "eyes",
    targetAliases: ["eyeball.x"],
    targetDisplayName: "Eyeball X",
    sourceKind: "gaze-centered",
    defaultInvert: false,
    defaultStrength: 1,
    fallbackPositiveSign: sign("y", -1)
  },
  {
    slotId: "gaze-vertical",
    label: "Gaze vertical",
    group: "eyes",
    targetAliases: ["eyeball.y"],
    targetDisplayName: "Eyeball Y",
    sourceKind: "gaze-centered",
    defaultInvert: false,
    defaultStrength: 1,
    fallbackPositiveSign: sign("x", 1)
  },
  {
    slotId: "mouth-open",
    label: "Mouth open",
    group: "mouth",
    targetAliases: ["mouth.open"],
    targetDisplayName: "Mouth Open",
    sourceKind: "mouth-open",
    defaultInvert: false,
    defaultStrength: 1
  },
  {
    slotId: "mouth-smile",
    label: "Mouth smile",
    group: "mouth",
    targetAliases: ["mouth.smile"],
    targetDisplayName: "Mouth Smile",
    sourceKind: "mouth-smile",
    defaultInvert: false,
    defaultStrength: 1
  },
  {
    slotId: "mouth-vowel-a",
    label: "Mouth vowel A",
    group: "mouth",
    targetAliases: ["mouth.vowel.a"],
    targetDisplayName: "Mouth Vowel A",
    sourceKind: "mouth-vowel",
    defaultInvert: false,
    defaultStrength: 1,
    vowelLabel: "a"
  },
  {
    slotId: "mouth-vowel-i",
    label: "Mouth vowel I",
    group: "mouth",
    targetAliases: ["mouth.vowel.i"],
    targetDisplayName: "Mouth Vowel I",
    sourceKind: "mouth-vowel",
    defaultInvert: false,
    defaultStrength: 1,
    vowelLabel: "i"
  },
  {
    slotId: "mouth-vowel-u",
    label: "Mouth vowel U",
    group: "mouth",
    targetAliases: ["mouth.vowel.u"],
    targetDisplayName: "Mouth Vowel U",
    sourceKind: "mouth-vowel",
    defaultInvert: false,
    defaultStrength: 1,
    vowelLabel: "u"
  },
  {
    slotId: "mouth-vowel-e",
    label: "Mouth vowel E",
    group: "mouth",
    targetAliases: ["mouth.vowel.e"],
    targetDisplayName: "Mouth Vowel E",
    sourceKind: "mouth-vowel",
    defaultInvert: false,
    defaultStrength: 1,
    vowelLabel: "e"
  },
  {
    slotId: "mouth-vowel-o",
    label: "Mouth vowel O",
    group: "mouth",
    targetAliases: ["mouth.vowel.o"],
    targetDisplayName: "Mouth Vowel O",
    sourceKind: "mouth-vowel",
    defaultInvert: false,
    defaultStrength: 1,
    vowelLabel: "o"
  },
  {
    slotId: "body-x",
    label: "Body X",
    group: "body",
    targetAliases: ["body.angle.x", "param_body_angle_x"],
    targetDisplayName: "Body Angle X",
    sourceKind: "body-x",
    defaultInvert: false,
    defaultStrength: 0.35,
    defaultSmoothing: 0.75,
    fallbackPositiveSign: sign("y", -1)
  },
  {
    slotId: "body-z",
    label: "Body Z",
    group: "body",
    targetAliases: ["body.angle.z", "param_body_angle_z"],
    targetDisplayName: "Body Angle Z",
    sourceKind: "body-z",
    defaultInvert: false,
    defaultStrength: 1,
    defaultSmoothing: 0.75,
    defaultBodyRotationStrength: 0.25,
    defaultBodyPositionStrength: 0.4,
    defaultBodyRotationInvert: false,
    defaultBodyPositionInvert: false,
    fallbackPositiveSign: sign("z", -1)
  }
];

export function findSemanticSlotDefinition(
  slotId: RuntimePlayerMappingSlotId
): SemanticSlotDefinition {
  const definition = semanticSlotDefinitions.find((slot) =>
    slot.slotId === slotId
  );

  if (definition === undefined) {
    throw new Error(`Unknown mapping slot: ${slotId}`);
  }

  return definition;
}

function sign(
  axis: InputProfileAxis,
  direction: InputProfileDirection
): InputProfileLearnedSign {
  return { axis, direction };
}
