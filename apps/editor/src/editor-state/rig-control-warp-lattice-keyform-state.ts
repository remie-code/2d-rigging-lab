import type { KeyformSetDto } from "@private-2d-rigging-lab/package-format";

import {
  type WarpLattice2dDraftPointState,
  warpLattice2dDraftControlPointCount
} from "./rig-control-warp-lattice-draft-state.js";

export interface RigControlWarpLatticeKeyformState {
  readonly keyformSetId: string;
  readonly keyIndex: number;
  readonly rigControlId: string;
  readonly parameterId: string;
  readonly keyValue: number;
  readonly compositionMode: "replace" | "additiveDelta";
  readonly controlPointOffsets: readonly WarpLattice2dDraftPointState[];
  readonly interpolation: "linear-1d-v1";
}

export const projectRigControlWarpLatticeKeyformState = (
  keyformSets: readonly KeyformSetDto[]
): readonly RigControlWarpLatticeKeyformState[] =>
  keyformSets.flatMap((keyformSet) => {
    if (
      keyformSet.evaluator !== "linear-1d-v1" ||
      keyformSet.target.kind !== "rigControl" ||
      keyformSet.target.property !== "controlPointOffsets" ||
      (keyformSet.compositionMode !== "replace" &&
        keyformSet.compositionMode !== "additiveDelta")
    ) {
      return [];
    }

    const compositionMode: RigControlWarpLatticeKeyformState["compositionMode"] =
      keyformSet.compositionMode;

    return keyformSet.keys.flatMap((key, keyIndex) => {
      const controlPointOffsets = toControlPointOffsets(key.statePatch);
      if (controlPointOffsets === null) {
        return [];
      }

      return [
        {
          keyformSetId: keyformSet.keyformSetId,
          keyIndex,
          rigControlId: keyformSet.target.id,
          parameterId: keyformSet.parameterId,
          keyValue: key.value,
          compositionMode,
          controlPointOffsets,
          interpolation: keyformSet.interpolation
        }
      ];
    });
  });

const toControlPointOffsets = (
  statePatch: unknown
): readonly WarpLattice2dDraftPointState[] | null => {
  const candidate =
    typeof statePatch === "object" &&
    statePatch !== null &&
    "controlPointOffsets" in statePatch
      ? (statePatch as { readonly controlPointOffsets?: unknown }).controlPointOffsets
      : statePatch;

  if (!Array.isArray(candidate) || candidate.length !== warpLattice2dDraftControlPointCount) {
    return null;
  }

  const offsets = candidate.map((point) => {
    if (
      typeof point !== "object" ||
      point === null ||
      !("x" in point) ||
      !("y" in point) ||
      typeof point.x !== "number" ||
      typeof point.y !== "number" ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    ) {
      return null;
    }

    return { x: point.x, y: point.y };
  });

  return offsets.every((point): point is WarpLattice2dDraftPointState => point !== null)
    ? offsets
    : null;
};
