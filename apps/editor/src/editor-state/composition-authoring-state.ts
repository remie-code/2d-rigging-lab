import type {
  KeyformSetDto,
  MaskRelationDto
} from "@private-2d-rigging-lab/package-format";

export interface CompositionMaskRelationState {
  readonly maskRelationId: string;
  readonly maskDrawableIds: readonly string[];
  readonly targetDrawableIds: readonly string[];
  readonly maskGroupHint: string | null;
  readonly enabled: boolean;
}

export interface DrawableOpacityKeyformState {
  readonly keyformSetId: string;
  readonly keyIndex: number;
  readonly drawableId: string;
  readonly parameterId: string;
  readonly keyValue: number;
  readonly opacity: number;
  readonly interpolation: "linear-1d-v1";
}

export const projectCompositionMaskRelationState = (
  masks: readonly MaskRelationDto[]
): readonly CompositionMaskRelationState[] =>
  masks.map((mask) => ({
    maskRelationId: mask.maskRelationId,
    maskDrawableIds: [...mask.maskDrawableIds],
    targetDrawableIds: [...mask.targetDrawableIds],
    maskGroupHint: mask.maskGroupHint ?? null,
    enabled: mask.enabled
  }));

export const projectDrawableOpacityKeyformState = (
  keyformSets: readonly KeyformSetDto[]
): readonly DrawableOpacityKeyformState[] =>
  keyformSets.flatMap((keyformSet) => {
    if (
      keyformSet.evaluator !== "linear-1d-v1" ||
      keyformSet.target.kind !== "drawable" ||
      (keyformSet.target.property !== "opacity" && keyformSet.target.property !== "defaultOpacity")
    ) {
      return [];
    }

    return keyformSet.keys.flatMap((key, keyIndex) => {
      const opacity = toOpacityValue(key.statePatch);
      if (opacity === null) {
        return [];
      }

      return [
        {
          keyformSetId: keyformSet.keyformSetId,
          keyIndex,
          drawableId: keyformSet.target.id,
          parameterId: keyformSet.parameterId,
          keyValue: key.value,
          opacity,
          interpolation: keyformSet.interpolation
        }
      ];
    });
  });

const toOpacityValue = (statePatch: unknown): number | null => {
  if (typeof statePatch === "number" && Number.isFinite(statePatch)) {
    return statePatch;
  }

  if (
    typeof statePatch === "object" &&
    statePatch !== null &&
    "opacity" in statePatch &&
    typeof statePatch.opacity === "number" &&
    Number.isFinite(statePatch.opacity)
  ) {
    return statePatch.opacity;
  }

  if (
    typeof statePatch === "object" &&
    statePatch !== null &&
    "defaultOpacity" in statePatch &&
    typeof statePatch.defaultOpacity === "number" &&
    Number.isFinite(statePatch.defaultOpacity)
  ) {
    return statePatch.defaultOpacity;
  }

  return null;
};
