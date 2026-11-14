import { describe, expect, it } from "vitest";
import {
  createReferenceImageState,
  modelPointToReferenceImage,
  referenceImagePointToModel,
  updateReferenceImageState
} from "./reference-image-transform.js";

describe("reference image transform", () => {
  it("keeps the drawn origin on re-pivot and the selected model point on scale and rotation", () => {
    const initial = createReferenceImageState({ width: 30, height: 20, byteLength: 100, sha256: "a".repeat(64) });
    const placed = updateReferenceImageState(initial, {
      translation: { x: -5, y: 18 }, scale: 0.75, rotationDegrees: 30
    });
    const pivot = { x: 4, y: 15 };
    const repivoted = updateReferenceImageState(placed, { pivot });
    expect(repivoted.transform.origin).toEqual(placed.transform.origin);
    const modelPivot = referenceImagePointToModel(placed.transform, pivot);
    const transformed = updateReferenceImageState(repivoted, {
      scale: 1.5, rotationDegrees: 450, translation: { x: 1, y: -2 }
    });
    expect(transformed.transform.rotationDegrees).toBe(90);
    const movedPivot = referenceImagePointToModel(transformed.transform, pivot);
    expect(movedPivot.x).toBeCloseTo(modelPivot.x + 1);
    expect(movedPivot.y).toBeCloseTo(modelPivot.y - 2);
    const pixel = { x: 12, y: 9 };
    const model = referenceImagePointToModel(transformed.transform, pixel);
    expect(model.x - movedPivot.x).toBeCloseTo(9);
    expect(model.y - movedPivot.y).toBeCloseTo(12);
    const recoveredPixel = modelPointToReferenceImage(transformed.transform, model);
    expect(recoveredPixel.x).toBeCloseTo(pixel.x);
    expect(recoveredPixel.y).toBeCloseTo(pixel.y);
  });
});
