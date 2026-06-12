import type { DrawableId, PartId, RigControlId } from "@private-2d-rigging-lab/contracts";

export type EditorSelection =
  | {
      readonly kind: "part";
      readonly id: PartId;
    }
  | {
      readonly kind: "drawable";
      readonly id: DrawableId;
    }
  | {
      readonly kind: "rigControl";
      readonly id: RigControlId;
    };
