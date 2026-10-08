import type {
  DrawableId,
  MeshId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";

export interface RuntimeDrawableEvaluationBase {
  readonly drawableId: DrawableId;
  readonly meshId: MeshId;
  readonly visible: boolean;
  readonly opacity: number;
  readonly baseDrawOrder: number;
  readonly evaluatedDrawOrder: number;
  readonly vertices?: readonly Vec2Dto[] | undefined;
}
