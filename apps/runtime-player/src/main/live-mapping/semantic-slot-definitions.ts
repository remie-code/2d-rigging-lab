import type {
  RuntimePlayerMappingSlotGroup,
  RuntimePlayerMappingSlotId
} from "../../preload/model-mapping-bridge-contract";
import type {
  InputProfileAxis,
  InputProfileDirection,
  InputProfileLearnedSign
} from "../input-profiles/input-profile-document";

export type SemanticSlotSourceKind =
  | "head-centered"
  | "gaze-centered"
  | "blink-left"
  | "blink-right"
  | "mouth-open"
  | "mouth-smile";

export type SemanticSlotDefinition = {
  readonly slotId: RuntimePlayerMappingSlotId;
  readonly label: string;
  readonly group: RuntimePlayerMappingSlotGroup;
  readonly targetAlias: string;
  readonly targetDisplayName: string;
  readonly sourceKind: SemanticSlotSourceKind;
  readonly defaultInvert: boolean;
  readonly fallbackPositiveSign?: InputProfileLearnedSign;
};

export const semanticSlotDefinitions: readonly SemanticSlotDefinition[] = [
  {
    slotId: "head-horizontal",
    label: "Head horizontal",
    group: "head",
    targetAlias: "face.angle.x",
    targetDisplayName: "Face Angle X",
    sourceKind: "head-centered",
    defaultInvert: false,
    fallbackPositiveSign: sign("y", -1)
  },
  {
    slotId: "head-vertical",
    label: "Head vertical",
    group: "head",
    targetAlias: "face.angle.y",
    targetDisplayName: "Face Angle Y",
    sourceKind: "head-centered",
    defaultInvert: false,
    fallbackPositiveSign: sign("x", 1)
  },
  {
    slotId: "head-tilt",
    label: "Head tilt",
    group: "head",
    targetAlias: "face.angle.z",
    targetDisplayName: "Face Angle Z",
    sourceKind: "head-centered",
    defaultInvert: false,
    fallbackPositiveSign: sign("z", -1)
  },
  {
    slotId: "eye-blink-left",
    label: "Eye blink left",
    group: "eyes",
    targetAlias: "eye.left.open",
    targetDisplayName: "Eye Left Open",
    sourceKind: "blink-left",
    defaultInvert: true
  },
  {
    slotId: "eye-blink-right",
    label: "Eye blink right",
    group: "eyes",
    targetAlias: "eye.right.open",
    targetDisplayName: "Eye Right Open",
    sourceKind: "blink-right",
    defaultInvert: true
  },
  {
    slotId: "gaze-horizontal",
    label: "Gaze horizontal",
    group: "eyes",
    targetAlias: "eyeball.x",
    targetDisplayName: "Eyeball X",
    sourceKind: "gaze-centered",
    defaultInvert: false,
    fallbackPositiveSign: sign("y", -1)
  },
  {
    slotId: "gaze-vertical",
    label: "Gaze vertical",
    group: "eyes",
    targetAlias: "eyeball.y",
    targetDisplayName: "Eyeball Y",
    sourceKind: "gaze-centered",
    defaultInvert: false,
    fallbackPositiveSign: sign("x", 1)
  },
  {
    slotId: "mouth-open",
    label: "Mouth open",
    group: "mouth",
    targetAlias: "mouth.open",
    targetDisplayName: "Mouth Open",
    sourceKind: "mouth-open",
    defaultInvert: false
  },
  {
    slotId: "mouth-smile",
    label: "Mouth smile",
    group: "mouth",
    targetAlias: "mouth.smile",
    targetDisplayName: "Mouth Smile",
    sourceKind: "mouth-smile",
    defaultInvert: false
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
