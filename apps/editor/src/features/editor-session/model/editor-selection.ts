import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";

export type EditorSelection =
  | {
      readonly kind: "part";
      readonly id: PartId;
    }
  | {
      readonly kind: "drawable";
      readonly id: DrawableId;
    };
