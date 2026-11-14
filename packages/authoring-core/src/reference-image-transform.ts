import {
  ReferenceImageStateSchema,
  ReferenceImageUpdateSchema,
  type ReferenceImageSource,
  type ReferenceImageState,
  type ReferenceImageTransform,
  type ReferenceImageUpdate
} from "@private-2d-rigging-lab/contracts";

type Point = ReferenceImageTransform["origin"];

const rotate = (point: Point, rotationDegrees: number): Point => {
  const angle = rotationDegrees * (Math.PI / 180);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
};

const imageOffsetToModel = (transform: ReferenceImageTransform, point: Point): Point =>
  rotate({ x: point.x * transform.scale, y: point.y * transform.scale }, transform.rotationDegrees);

/** Image coordinates measure pixel edges from the upper-left. Model coordinates are Y-down. */
export const referenceImagePointToModel = (transform: ReferenceImageTransform, point: Point): Point => {
  const offset = imageOffsetToModel(transform, point);
  return { x: transform.origin.x + offset.x, y: transform.origin.y + offset.y };
};

export const modelPointToReferenceImage = (transform: ReferenceImageTransform, point: Point): Point => {
  const offset = rotate({ x: point.x - transform.origin.x, y: point.y - transform.origin.y }, -transform.rotationDegrees);
  return { x: offset.x / transform.scale, y: offset.y / transform.scale };
};

export const createReferenceImageState = (image: ReferenceImageSource): ReferenceImageState =>
  ReferenceImageStateSchema.parse({
    image,
    displayMode: "overlay",
    opacity: 0.5,
    transform: {
      origin: { x: 0, y: 0 },
      pivot: { x: image.width / 2, y: image.height / 2 },
      scale: 1,
      rotationDegrees: 0
    }
  });

const normalizeRotation = (degrees: number): number => {
  const remainder = degrees % 360;
  if (remainder >= 180) return remainder - 360;
  if (remainder < -180) return remainder + 360;
  return remainder === 0 ? 0 : remainder;
};

/** Re-pivot first, then apply absolute scale/rotation about that pivot, then translate in model units. */
export const updateReferenceImageState = (state: ReferenceImageState, input: ReferenceImageUpdate): ReferenceImageState => {
  const update = ReferenceImageUpdateSchema.parse(input);
  const before = state.transform;
  const transform = {
    ...before,
    pivot: update.pivot ?? before.pivot,
    scale: update.scale ?? before.scale,
    rotationDegrees: normalizeRotation(update.rotationDegrees ?? before.rotationDegrees)
  };

  if (transform.scale !== before.scale || transform.rotationDegrees !== before.rotationDegrees) {
    const modelPivot = referenceImagePointToModel(before, transform.pivot);
    const offset = imageOffsetToModel(transform, transform.pivot);
    transform.origin = { x: modelPivot.x - offset.x, y: modelPivot.y - offset.y };
  }
  if (update.translation !== undefined) {
    transform.origin = {
      x: transform.origin.x + update.translation.x,
      y: transform.origin.y + update.translation.y
    };
  }

  return ReferenceImageStateSchema.parse({
    image: state.image,
    displayMode: update.displayMode ?? state.displayMode,
    opacity: update.opacity ?? state.opacity,
    transform
  });
};
