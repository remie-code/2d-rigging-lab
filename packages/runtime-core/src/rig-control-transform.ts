import { z } from "zod";

import { Vec2DtoSchema } from "@private-2d-rigging-lab/contracts";
import type { Vec2Dto } from "@private-2d-rigging-lab/contracts";

export const Affine2dMatrixSchema = z.object({
  a: z.number().finite(),
  b: z.number().finite(),
  c: z.number().finite(),
  d: z.number().finite(),
  e: z.number().finite(),
  f: z.number().finite()
});
export type Affine2dMatrixDto = z.infer<typeof Affine2dMatrixSchema>;

export const Rotation2dTransformStateSchema = z.object({
  pivot: Vec2DtoSchema,
  angleDegrees: z.number().finite(),
  translation: Vec2DtoSchema,
  scale: Vec2DtoSchema,
  matrix: Affine2dMatrixSchema
});
export type Rotation2dTransformStateDto = z.infer<typeof Rotation2dTransformStateSchema>;

export const identityAffine2d = (): Affine2dMatrixDto =>
  Affine2dMatrixSchema.parse({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0
  });

export const createRotation2dMatrix = (input: {
  readonly pivot: Vec2Dto;
  readonly angleDegrees: number;
  readonly translation: Vec2Dto;
  readonly scale: Vec2Dto;
}): Affine2dMatrixDto => {
  const radians = (input.angleDegrees * Math.PI) / 180;
  const cos = normalizeTransformNumber(Math.cos(radians));
  const sin = normalizeTransformNumber(Math.sin(radians));
  const a = normalizeTransformNumber(cos * input.scale.x);
  const b = normalizeTransformNumber(sin * input.scale.x);
  const c = normalizeTransformNumber(-sin * input.scale.y);
  const d = normalizeTransformNumber(cos * input.scale.y);
  const e = normalizeTransformNumber(input.translation.x + input.pivot.x - a * input.pivot.x - c * input.pivot.y);
  const f = normalizeTransformNumber(input.translation.y + input.pivot.y - b * input.pivot.x - d * input.pivot.y);

  return Affine2dMatrixSchema.parse({ a, b, c, d, e, f });
};

export const createRotation2dTransformState = (input: {
  readonly pivot: Vec2Dto;
  readonly angleDegrees: number;
  readonly translation: Vec2Dto;
  readonly scale: Vec2Dto;
}): Rotation2dTransformStateDto =>
  Rotation2dTransformStateSchema.parse({
    pivot: cloneVec2(input.pivot),
    angleDegrees: normalizeTransformNumber(input.angleDegrees),
    translation: cloneVec2(input.translation),
    scale: cloneVec2(input.scale),
    matrix: createRotation2dMatrix(input)
  });

export const composeAffine2d = (
  parent: Affine2dMatrixDto,
  child: Affine2dMatrixDto
): Affine2dMatrixDto =>
  Affine2dMatrixSchema.parse({
    a: normalizeTransformNumber(parent.a * child.a + parent.c * child.b),
    b: normalizeTransformNumber(parent.b * child.a + parent.d * child.b),
    c: normalizeTransformNumber(parent.a * child.c + parent.c * child.d),
    d: normalizeTransformNumber(parent.b * child.c + parent.d * child.d),
    e: normalizeTransformNumber(parent.a * child.e + parent.c * child.f + parent.e),
    f: normalizeTransformNumber(parent.b * child.e + parent.d * child.f + parent.f)
  });

export const applyAffine2dToPoint = (
  matrix: Affine2dMatrixDto,
  point: Vec2Dto
): Vec2Dto => ({
  x: normalizeTransformNumber(matrix.a * point.x + matrix.c * point.y + matrix.e),
  y: normalizeTransformNumber(matrix.b * point.x + matrix.d * point.y + matrix.f)
});

export const applyAffine2dToVertices = (
  matrix: Affine2dMatrixDto,
  vertices: readonly Vec2Dto[]
): Vec2Dto[] => vertices.map((vertex) => applyAffine2dToPoint(matrix, vertex));

export const affine2dMatricesEqual = (
  left: Affine2dMatrixDto | undefined,
  right: Affine2dMatrixDto | undefined
): boolean =>
  left?.a === right?.a &&
  left?.b === right?.b &&
  left?.c === right?.c &&
  left?.d === right?.d &&
  left?.e === right?.e &&
  left?.f === right?.f;

export const normalizeTransformNumber = (value: number): number => {
  if (Math.abs(value) < 1e-12) {
    return 0;
  }

  return Number(value.toFixed(12));
};

const cloneVec2 = (value: Vec2Dto): Vec2Dto => ({
  x: normalizeTransformNumber(value.x),
  y: normalizeTransformNumber(value.y)
});
