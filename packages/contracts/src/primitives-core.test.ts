import { describe, expect, it } from "vitest";

import {
  ActorSchema,
  CheckStatusSchema,
  RuntimeEvaluationProfileSchema,
  RuntimeEvaluationStrictnessSchema,
  RuntimeResetReasonSchema,
  RuntimeSourceSurfaceSchema,
  SeveritySchema,
  SnapshotDetailSchema,
  SurfaceSchema,
  ValidationProfileSchema
} from "./enums.js";
import {
  FiniteNumberSchema,
  RectDtoSchema,
  RectSchema,
  Transform2DDtoSchema,
  Transform2DSchema,
  Vec2DtoSchema,
  Vec2Schema
} from "./primitives.js";

describe("primitive schemas", () => {
  it("accepts finite numbers only", () => {
    expect(FiniteNumberSchema.parse(1.25)).toBe(1.25);
    expect(FiniteNumberSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(FiniteNumberSchema.safeParse(Number.NaN).success).toBe(false);
  });

  it("parses Vec2 DTOs", () => {
    expect(Vec2DtoSchema.parse({ x: 10, y: -4.5 })).toEqual({ x: 10, y: -4.5 });
    expect(Vec2Schema.parse({ x: 10, y: -4.5 })).toEqual({ x: 10, y: -4.5 });
  });

  it("requires nonnegative Rect dimensions", () => {
    expect(RectDtoSchema.parse({ x: 0, y: 1, width: 2, height: 3 })).toEqual({
      x: 0,
      y: 1,
      width: 2,
      height: 3
    });
    expect(RectSchema.safeParse({ x: 0, y: 0, width: -1, height: 2 }).success).toBe(false);
  });

  it("parses Transform2D DTOs", () => {
    expect(
      Transform2DDtoSchema.parse({
        translation: { x: 1, y: 2 },
        rotationDegrees: 45,
        scale: { x: 1, y: 1 }
      })
    ).toEqual({
      translation: { x: 1, y: 2 },
      rotationDegrees: 45,
      scale: { x: 1, y: 1 }
    });
    expect(
      Transform2DSchema.parse({
        translation: { x: 1, y: 2 },
        rotationDegrees: 45,
        scale: { x: 1, y: 1 }
      })
    ).toEqual({
      translation: { x: 1, y: 2 },
      rotationDegrees: 45,
      scale: { x: 1, y: 1 }
    });
  });
});

describe("common enum schemas", () => {
  it("parses shared authoring and diagnostic enum values", () => {
    expect(SurfaceSchema.parse("structuredApi")).toBe("structuredApi");
    expect(ActorSchema.parse("validatorRepairCandidate")).toBe("validatorRepairCandidate");
    expect(SeveritySchema.parse("blocking")).toBe("blocking");
    expect(CheckStatusSchema.parse("needs_review")).toBe("needs_review");
    expect(ValidationProfileSchema.parse("aiDryRun")).toBe("aiDryRun");
    expect(SnapshotDetailSchema.parse("targeted")).toBe("targeted");
  });

  it("parses runtime enum values, including deprecated profile compatibility", () => {
    expect(RuntimeResetReasonSchema.parse("validationRunStart")).toBe("validationRunStart");
    expect(RuntimeSourceSurfaceSchema.parse("validator")).toBe("validator");
    expect(RuntimeEvaluationStrictnessSchema.parse("demoSafe")).toBe("demoSafe");
    expect(RuntimeEvaluationProfileSchema.parse("validatorStrict")).toBe("validatorStrict");
  });

  it("rejects enum values with spaces or unknown values", () => {
    expect(SurfaceSchema.safeParse("structured api").success).toBe(false);
    expect(RuntimeEvaluationStrictnessSchema.safeParse("production").success).toBe(false);
  });
});
