import { referenceImagePointToModel } from "@private-2d-rigging-lab/authoring-core";
import type { ReferenceImageState } from "@private-2d-rigging-lab/contracts";
import type { SoftwareRenderForeground } from "@private-2d-rigging-lab/render-software";

import type { DecodedReferencePng } from "../reference-png.js";

export interface PerceptionReferenceImage {
  readonly state: ReferenceImageState;
  readonly png: DecodedReferencePng;
}

/** Build a presentation quad, outside the model scene and its mask/texture namespace. */
export const createReferenceImageForeground = ({ state, png }: PerceptionReferenceImage): SoftwareRenderForeground => {
  const { width, height, data } = png;
  const textureId = "reference-image";
  const uvs = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  return {
    drawable: {
      drawableId: "reference-image",
      textureRef: { textureId },
      mesh: {
        coordinateSpace: "stage",
        uvSpace: "layer-local-top-left-0-1-v1",
        vertices: uvs.map(({ x, y }) => referenceImagePointToModel(state.transform, { x: x * width, y: y * height })),
        uvs,
        triangles: [[0, 1, 2], [0, 2, 3]]
      },
      opacity: state.opacity,
      visible: true,
      drawOrder: 0,
      stableIndex: 0,
      blendMode: "normal-premultiplied-alpha-v0"
    },
    texture: {
      kind: "rgba8",
      textureId,
      width,
      height,
      bytes: data,
      alphaMode: "straight",
      contentSignature: state.image.sha256
    }
  };
};
