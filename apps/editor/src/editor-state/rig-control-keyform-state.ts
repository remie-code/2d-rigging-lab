import type { KeyformSetDto } from "@private-2d-rigging-lab/package-format";

export interface RigControlAngleKeyformState {
  readonly keyformSetId: string;
  readonly keyIndex: number;
  readonly rigControlId: string;
  readonly parameterId: string;
  readonly keyValue: number;
  readonly angleDegrees: number;
  readonly interpolation: "linear-1d-v1";
}

export const projectRigControlAngleKeyformState = (
  keyformSets: readonly KeyformSetDto[]
): readonly RigControlAngleKeyformState[] =>
  keyformSets.flatMap((keyformSet) => {
    if (
      keyformSet.evaluator !== "linear-1d-v1" ||
      keyformSet.target.kind !== "rigControl" ||
      keyformSet.target.property !== "angleDegrees"
    ) {
      return [];
    }

    return keyformSet.keys.flatMap((key, keyIndex) => {
      const angleDegrees = toAngleDegrees(key.statePatch);
      if (angleDegrees === null) {
        return [];
      }

      return [
        {
          keyformSetId: keyformSet.keyformSetId,
          keyIndex,
          rigControlId: keyformSet.target.id,
          parameterId: keyformSet.parameterId,
          keyValue: key.value,
          angleDegrees,
          interpolation: keyformSet.interpolation
        }
      ];
    });
  });

const toAngleDegrees = (statePatch: unknown): number | null => {
  if (typeof statePatch === "number" && Number.isFinite(statePatch)) {
    return statePatch;
  }

  if (
    typeof statePatch === "object" &&
    statePatch !== null &&
    "angleDegrees" in statePatch &&
    typeof statePatch.angleDegrees === "number" &&
    Number.isFinite(statePatch.angleDegrees)
  ) {
    return statePatch.angleDegrees;
  }

  return null;
};
